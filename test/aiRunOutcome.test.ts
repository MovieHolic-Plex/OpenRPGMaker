import { describe, expect, it, afterEach, beforeEach, vi, expectTypeOf } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { AGENT_UX_POLICY_LINES } from "@/ai/promptPolicies";
import { composeSystemPrompt } from "@/ai/systemPromptEnvelope";
import { createBlankProject } from "@/project/defaults";
import { activeTools } from "@/editor/tools";
import { EVALUATE_GAME_QUALITY_TOOL, PLAY_WALKTHROUGH_TOOL, RUN_LINT_TOOL, VERIFY_QUEST_TOOL, parseLayerVerdict, parseToolVerdict, runLayerVerificationReport, selectVerificationCalls, type LayerDescriptor, type ToolResultLike, type VerificationCallRecord } from "@/ai/agentVerification";
import { buildEventAssistPrompt, parseAndValidate } from "@/ai/eventCommandAssist";
import { eventResourceIdSet } from "@/ai/eventResourceCatalog";
import { BGM_CATALOG, findBgmTrack } from "@/assets/bgmCatalog";
import { SE_CATALOG } from "@/assets/seCatalog";
import { parseAudioPrompt } from "./support/audioPrompt";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig, type AiConfig, DEFAULT_LITE_MODEL, DEFAULT_MODEL } from "@/ai/llmClient";
import { ASSISTANT_ENGINE_STORAGE_KEY, assistantEngineLead, loadAssistantEngine, saveAssistantEngine } from "@/ai/localCliEngine";
import { modelForRole, configForRole } from "@/ai/modelRoles";
import { setKnownOpenAiCompatEndpoints, type OpenAiCompatEndpointPublic } from "@/ai/openAiCompat";
import { configForPlanAccount } from "@/ai/planDefaults";
import { configForProviderSelection, workProviderIds } from "@/ai/providerSelection";
import { applyTeamPlan } from "@/ai/teamApply";
import { buildTeamPlan, type TeamInputs } from "@/ai/teamPlan";
import { KEY_ROUTES, keyRouteAdoptModel } from "@/ai/keyRoutes";
import { configForUltrabrain } from "@/ai/ultrabrainConfig";
import { defaultModelForAuthMode, modelCatalogForAuthMode } from "@/ai/modelCatalog";
import { tierModelFor } from "@/ai/modelPresets";
import { CHATGPT_DEFAULT_MODEL, CLAUDE_DEFAULT_EFFORT, CLAUDE_DEFAULT_MODEL, DEFAULT_OH_MY_PI_PROVIDER, RECOMMENDED_OH_MY_PI_PROVIDER, getOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { resolvePixelModel } from "@/ai/pixelModel";
import { AI_INSTRUCTIONS_MAX_CHARS, aiInstructionsSection, normalizeAiInstructions } from "@/ai/projectInstructions";
import type { AcceptanceStatus } from "@/ai/assistantAcceptance";
import { deriveRunOutcome, type RunOutcome } from "@/ai/runOutcome";
import { EMPTY_SESSION_USAGE, addSessionUsage, formatSessionUsage, formatTokenCount } from "@/ai/sessionUsage";
import type { AiUiEvent } from "@/ai/uiEventTypes";
import { aiUiEventMarker, clearAiUiEvents, flushAiUiEvents, installAiUiEventCapture, listAiUiEvents, recordAiUiEvent, resetAiUiEventLogForTest, resolveAiUiSurface, setAiUiEventSink, takeAiUiEventsSince } from "@/ai/uiEventLog";
import { isDestructiveOutcome } from "@/ai/approvalPolicy";
import type { ChangeSummary } from "@/project/types";
import { requiresVisualReview, reviewEvidenceImages } from "@/ai/independentReview";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("agentUxPolicyPrompt", () => {
  isolateTimers();
  function prompt(): string {
    return buildSystemPrompt(createBlankProject(), { budgetChars: 20000 });
  }
  describe("agent UX policy prompt", () => {
    it("ships identical policy bytes through the main prompt and shared envelope", () => {
      const wrapped = composeSystemPrompt({ surface: "chat", body: "POLICY_COPY_BOUNDARY", includePolicy: true });
      for (const shipped of [prompt(), wrapped]) {
        const start = shipped.indexOf(AGENT_UX_POLICY_LINES.split("\n")[0]);
        expect(shipped.slice(start, start + AGENT_UX_POLICY_LINES.length)).toBe(AGENT_UX_POLICY_LINES);
      }
    });
    // Retired: the author_house shape-variety policy (templateId/kitId, look_at_houses) left promptPolicies.ts with author_house.

    it("exposes the supported real-time combat authoring capabilities", () => {
      const tools = activeTools();
      expect(tools.find((tool) => tool.name === "set_action_combat")?.mode).toBe("write");
      expect(tools.find((tool) => tool.name === "make_action_enemy")?.mode).toBe("write");
    });

    // 봉투(systemPromptEnvelope)를 거쳐도 정책 문장이 변형·손실되지 않아야 한다. 정책을
    // promptPolicies 한 곳에 모아 둬도 닿는 경로가 하나면 통합이 아니다 — 봉투가 그 배급 지점이다.
    it("survives the shared envelope byte-for-byte", () => {
      const wrapped = composeSystemPrompt({
        surface: "chat",
        body: "## 채널 고유 지침\n- 아무 규칙",
        includePolicy: true,
      });
      expect(wrapped).toContain(AGENT_UX_POLICY_LINES);
      // 정책이 본문보다 먼저 읽힌다 — 상위에서 잘려도 정책이 먼저 살아남는 순서.
      expect(wrapped.indexOf("## UX 응답 정책(반드시 준수)")).toBeLessThan(wrapped.indexOf("## 채널 고유 지침"));
    });

    it("stays out of JSON-only surfaces where tone rules would corrupt the output", () => {
      const wrapped = composeSystemPrompt({
        surface: "tileset-analysis",
        body: "Return exactly one JSON object.",
      });
      expect(wrapped).not.toContain("## UX 응답 정책(반드시 준수)");
      expect(wrapped).not.toContain("3~5문장");
    });
  });
});

// test/agentVerification.test.ts
// Todo 3 — pure verification-gate module (src/ai/agentVerification.ts).
// Covers: canonical layer→tools selection table, verdict parsing (toolRunner result
// shape {ok, summary, issues, data}), the composed advisory report, and malformed-input
// safety. 재시도/중단 계약은 2026-08-30 에 제거됐다 — 검증은 자문이며 런을 멈추지 않는다. Canonical table below MUST match todo 5's
// integration (map/world → [run_lint, evaluate_game_quality]; quest/story →
// [run_lint, verify_quest]; final → [run_lint, play_walkthrough] or
// [run_lint, verify_quest×all questIds] fallback).
describe("agentVerification", () => {
  isolateTimers();
  // ── helpers ──────────────────────────────────────────────────────

  function call(name: string, args: Record<string, unknown> = {}, ok = true, layerId?: string): VerificationCallRecord {
    return layerId !== undefined ? { name, args, ok, layerId } : { name, args, ok };
  }
  function defineQuest(id: string, ok = true, layerId?: string): VerificationCallRecord {
    return call("define_quest", { id }, ok, layerId);
  }
  function createQuest(key: string, ok = true): VerificationCallRecord {
    return call("create_quest", { def: { key } }, ok);
  }
  function playWalkthrough(scenario: unknown, ok = true, layerId?: string): VerificationCallRecord {
    return call("play_walkthrough", { scenario }, ok, layerId);
  }
  /** run_lint's real result shape: issues live in data.issues (toolRunner read wrapper). */
  function lintResult(issues: Array<{ severity: string; code?: string; message: string }> = []): ToolResultLike {
    return {
      ok: true,
      summary: `lint: error ${issues.filter((i) => i.severity === "error").length}건`,
      data: { counts: { errors: 0, warnings: 0, infos: 0 }, issues },
    };
  }
  function qualityResult(blocked: boolean, objectiveIssues: Array<{ severity: string; message: string }> = []): ToolResultLike {
    return {
      ok: true,
      summary: blocked ? "무결성 점검: 오류 있음" : "무결성 점검: 이상 없음",
      issues: objectiveIssues,
      data: {
        verdict: { blocked, objectiveErrorCount: blocked ? objectiveIssues.length : 0 },
        integrity: { objective: { issues: objectiveIssues } },
      },
    };
  }
  /** verify_quest / play_walkthrough report pass/fail via data.ok (top-level ok stays true). */
  function scenarioResult(ok: boolean, failureReason?: string): ToolResultLike {
    return { ok: true, summary: ok ? "성공" : "실패", data: { ok, failureReason, stepsRun: 3, totalSteps: 5 } };
  }
  function layer(partial: Partial<LayerDescriptor> & { title: string }): LayerDescriptor {
    return partial as LayerDescriptor;
  }
  // ── canonical selection table ────────────────────────────────────

  describe("selectVerificationCalls — canonical layer→tools table", () => {
    it("map layer → [run_lint, evaluate_game_quality], no args", () => {
      expect(selectVerificationCalls(layer({ title: "마을 만들기", kind: "map" }), [])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: EVALUATE_GAME_QUALITY_TOOL, args: {} },
      ]);
    });

    it("world layer → same map/world bucket", () => {
      expect(selectVerificationCalls(layer({ title: "세계 지도", kind: "world" }), [])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: EVALUATE_GAME_QUALITY_TOOL, args: {} },
      ]);
    });

    it("no kind + unmatched title defaults to map/world", () => {
      expect(selectVerificationCalls(layer({ title: "필드 맵" }), [])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: EVALUATE_GAME_QUALITY_TOOL, args: {} },
      ]);
    });

    it("unknown explicit kind → deterministic map/world default (never crashes, no wrong verify calls)", () => {
      expect(selectVerificationCalls(layer({ title: "전투 밸런스", kind: "battle" }), [defineQuest("q1")])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: EVALUATE_GAME_QUALITY_TOOL, args: {} },
      ]);
    });

    it("quest layer → [run_lint, verify_quest] with most recent successful define_quest id", () => {
      const history = [defineQuest("q1"), defineQuest("q2")];
      expect(selectVerificationCalls(layer({ title: "퀘스트 체인", kind: "quest" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q2" } },
      ]);
    });

    it("story kind → quest/story bucket (verify_quest, not play_walkthrough)", () => {
      expect(selectVerificationCalls(layer({ title: "스토리 아크", kind: "story" }), [defineQuest("q1")])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
      ]);
    });

    it("quest classification by title inference when kind absent", () => {
      expect(selectVerificationCalls(layer({ title: "퀘스트 2개 + 컷신" }), [defineQuest("q1")])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
      ]);
    });

    it("create_quest family also yields questId (def.key)", () => {
      expect(selectVerificationCalls(layer({ title: "퀘스트", kind: "quest" }), [createQuest("q-herb")])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q-herb" } },
      ]);
    });

    it("failed define_quest calls are ignored; most recent SUCCESSFUL wins", () => {
      const history = [defineQuest("q1"), defineQuest("q2", false), defineQuest("q3")];
      expect(selectVerificationCalls(layer({ title: "퀘스트", kind: "quest" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q3" } },
      ]);
    });

    it("questId comes from the RUN history (prior layers included), not just this layer", () => {
      const history = [defineQuest("q1", true, "L1")];
      expect(selectVerificationCalls(layer({ id: "L2", title: "퀘스트 보완", kind: "quest" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
      ]);
    });

    it("quest layer with empty quest history → still [run_lint] (no verify_quest without an id)", () => {
      expect(selectVerificationCalls(layer({ title: "퀘스트", kind: "quest" }), [])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
      ]);
    });

    it("final layer with its own successful play_walkthrough → [run_lint, play_walkthrough] using the layer's scenario", () => {
      const scenario = [
        { do: "moveTo", mapId: "village", x: 5, y: 5 },
        { do: "interact", eventId: "mayor" },
        { expect: "switch", switchId: "sw_q1_done", value: true },
        { expect: "ended" },
      ];
      const history = [playWalkthrough(scenario, true, "L3")];
      expect(selectVerificationCalls(layer({ id: "L3", title: "최종 검증", kind: "final" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: PLAY_WALKTHROUGH_TOOL, args: { scenario } },
      ]);
    });

    it("final layer classification by title (최종 검증) without explicit kind", () => {
      const history = [playWalkthrough([{ expect: "ended" }], true, "L3")];
      const calls = selectVerificationCalls(layer({ id: "L3", title: "최종 검증" }), history);
      expect(calls).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: PLAY_WALKTHROUGH_TOOL, args: { scenario: [{ expect: "ended" }] } },
      ]);
    });

    it("final layer via isFinal flag even when title is generic", () => {
      const history = [playWalkthrough([{ expect: "ended" }], true, "L9")];
      const calls = selectVerificationCalls(layer({ id: "L9", title: "마무리 작업", isFinal: true }), history);
      expect(calls[1]).toEqual({ name: PLAY_WALKTHROUGH_TOOL, args: { scenario: [{ expect: "ended" }] } });
    });

    it("final layer without own play_walkthrough → verify_quest×ALL questIds in run history (first-appearance order, deduped)", () => {
      const history = [defineQuest("q1", true, "L1"), defineQuest("q2", true, "L2"), defineQuest("q1", true, "L3")];
      expect(selectVerificationCalls(layer({ id: "L3", title: "최종 검증", kind: "final" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q2" } },
      ]);
    });

    it("play_walkthrough attributed to a PRIOR layer does not count as this layer's own → verify_quest×all fallback", () => {
      const history = [playWalkthrough([{ expect: "ended" }], true, "L2"), defineQuest("q1", true, "L1")];
      expect(selectVerificationCalls(layer({ id: "L3", title: "최종 검증", kind: "final" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
      ]);
    });

    it("play_walkthrough with MALFORMED scenario (not an array) → treated as absent → verify_quest×all fallback", () => {
      const history = [playWalkthrough("not-an-array", true, "L3"), defineQuest("q1")];
      expect(selectVerificationCalls(layer({ id: "L3", title: "최종 검증", kind: "final" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
      ]);
    });

    it("failed play_walkthrough call is never used as the final scenario → verify_quest×all fallback", () => {
      const history = [playWalkthrough([{ expect: "ended" }], false, "L3"), defineQuest("q1")];
      expect(selectVerificationCalls(layer({ id: "L3", title: "최종 검증", kind: "final" }), history)).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
      ]);
    });

    it("final layer with no scenario and empty quest history → still [run_lint]", () => {
      expect(selectVerificationCalls(layer({ title: "최종 검증", kind: "final" }), [])).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
      ]);
    });

    it("unattributed play_walkthrough records are treated as the final layer's own (most recent wins)", () => {
      const history = [playWalkthrough([{ expect: "ended" }], true)];
      const calls = selectVerificationCalls(layer({ id: "L3", title: "최종 검증", kind: "final" }), history);
      expect(calls[1]).toEqual({ name: PLAY_WALKTHROUGH_TOOL, args: { scenario: [{ expect: "ended" }] } });
    });

    it("run_lint is always first and carries empty args; nothing beyond the table is ever added", () => {
      for (const history of [[], [defineQuest("q1")], [playWalkthrough([{ expect: "ended" }], true, "L")]]) {
        for (const l of [
          layer({ title: "맵", kind: "map" }),
          layer({ title: "퀘스트", kind: "quest" }),
          layer({ id: "L", title: "최종", kind: "final" }),
        ]) {
          const calls = selectVerificationCalls(l, history);
          expect(calls.length).toBeGreaterThan(0);
          expect(calls[0]).toEqual({ name: RUN_LINT_TOOL, args: {} });
          const names = calls.map((c) => c.name);
          expect(names.filter((n) => ![RUN_LINT_TOOL, EVALUATE_GAME_QUALITY_TOOL, VERIFY_QUEST_TOOL, PLAY_WALKTHROUGH_TOOL].includes(n))).toEqual([]);
        }
      }
    });
  });
  // ── verdict parsing ──────────────────────────────────────────────

  describe("parseToolVerdict — tool result → {pass, blockingIssues[], warnings[]}", () => {
    it("run_lint counts still block when detailed issues are absent or truncated", () => {
      for (const issues of [undefined, [], [{ severity: "warning", message: "비차단 경고" }]]) {
        const result = { ok: true, data: { counts: { errors: 14 }, issues } };
        expect(parseToolVerdict(RUN_LINT_TOOL, result)).toMatchObject({ pass: false, blockingIssues: ["lint 오류 14건"] });
        expect(result.ok).toBe(true);
      }
    });

    it("check_reachability uses reachable, not execution ok", () => {
      expect(parseToolVerdict("check_reachability", { ok: true, data: { reachable: false } }).pass).toBe(false);
      expect(parseToolVerdict("check_reachability", { ok: true, data: { reachable: true } }).pass).toBe(true);
    });

    it("run_scene_test uses its scenario verdict", () => {
      expect(parseToolVerdict("run_scene_test", scenarioResult(false, "문을 통과하지 못함")))
        .toMatchObject({ pass: false, blockingIssues: ["문을 통과하지 못함"] });
    });

    it("run_lint error (inside data.issues, real shape) blocks", () => {
      const result = lintResult([
        { severity: "error", code: "tileset-missing", message: "타일셋 참조 없음" },
        { severity: "warning", code: "soft", message: "권장 사항" },
      ]);
      const verdict = parseToolVerdict(RUN_LINT_TOOL, result);
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues).toEqual(["타일셋 참조 없음"]);
      expect(verdict.warnings).toContain("권장 사항");
    });

    it("run_lint with warnings only → pass, warnings surfaced, nothing blocks", () => {
      const verdict = parseToolVerdict(RUN_LINT_TOOL, lintResult([{ severity: "warning", message: "비차단 경고" }]));
      expect(verdict.pass).toBe(true);
      expect(verdict.blockingIssues).toEqual([]);
      expect(verdict.warnings).toEqual(["비차단 경고"]);
    });

    // 차단 집합은 projectLint 오류만이 아니다 — 빈 맵(99081a0b1)·미호출 엔딩(419e067fa)도 error 로 온다.
    it("evaluate_game_quality blocks on every error-severity objective issue (data.verdict.blocked)", () => {
      const verdict = parseToolVerdict(EVALUATE_GAME_QUALITY_TOOL, qualityResult(true, [
        { severity: "error", message: "projectLint 오류 1" },
        { severity: "error", message: "'빈 마을'(map_2) 은 만들기만 하고 …" },
        { severity: "error", message: "엔딩 '진엔딩'(end_1)을 실행하는 triggerEnding 명령이 없습니다." },
        { severity: "warning", message: "비차단 경고" },
      ]));
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues).toEqual([
        "projectLint 오류 1",
        "'빈 마을'(map_2) 은 만들기만 하고 …",
        "엔딩 '진엔딩'(end_1)을 실행하는 triggerEnding 명령이 없습니다.",
      ]);
      expect(verdict.warnings).toContain("비차단 경고");
    });

    it("evaluate_game_quality with only warnings → pass (warnings never block)", () => {
      const verdict = parseToolVerdict(EVALUATE_GAME_QUALITY_TOOL, qualityResult(false, [
        { severity: "warning", message: "비차단 경고" },
      ]));
      expect(verdict.pass).toBe(true);
      expect(verdict.blockingIssues).toEqual([]);
      expect(verdict.warnings).toContain("비차단 경고");
    });

    it("evaluate_game_quality blocked with no detailed issues → synthesized blocking message", () => {
      const verdict = parseToolVerdict(EVALUATE_GAME_QUALITY_TOOL, qualityResult(true, []));
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues.length).toBe(1);
    });

    it("verify_quest failure arrives via data.ok=false → blocking with failureReason", () => {
      const verdict = parseToolVerdict(VERIFY_QUEST_TOOL, scenarioResult(false, "step 3 실패: 도달 불가"));
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues).toEqual(["step 3 실패: 도달 불가"]);
    });

    it("verify_quest success (data.ok=true) → pass", () => {
      const verdict = parseToolVerdict(VERIFY_QUEST_TOOL, scenarioResult(true));
      expect(verdict.pass).toBe(true);
      expect(verdict.blockingIssues).toEqual([]);
    });

    it("play_walkthrough failure (data.ok=false) → blocking", () => {
      const verdict = parseToolVerdict(PLAY_WALKTHROUGH_TOOL, scenarioResult(false, "엔딩 미도달"));
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues).toEqual(["엔딩 미도달"]);
    });

    it("tool-level ok:false (exception/arg error) → blocking with summary", () => {
      const verdict = parseToolVerdict(RUN_LINT_TOOL, { ok: false, summary: "'run_lint' 실행 실패: boom" });
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues).toEqual(["'run_lint' 실행 실패: boom"]);
    });

    it("result with missing ok → fail-closed blocking (deterministic safe)", () => {
      const verdict = parseToolVerdict(RUN_LINT_TOOL, { summary: "상태 불명" } as ToolResultLike);
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues.length).toBe(1);
    });

    it("top-level warnings array is surfaced and never blocks", () => {
      const verdict = parseToolVerdict(PLAY_WALKTHROUGH_TOOL, { ok: true, summary: "성공", warnings: ["영역 잘림"], data: { ok: true } });
      expect(verdict.pass).toBe(true);
      expect(verdict.warnings).toEqual(["영역 잘림"]);
    });
  });
  describe("parseLayerVerdict — multi-tool gate verdict", () => {
    it("all tools pass → gate passes", () => {
      const verdict = parseLayerVerdict([
        { name: RUN_LINT_TOOL, result: lintResult() },
        { name: EVALUATE_GAME_QUALITY_TOOL, result: qualityResult(false) },
      ]);
      expect(verdict.pass).toBe(true);
      expect(verdict.blockingIssues).toEqual([]);
    });

    it("any tool fails → gate fails; blocking issues prefixed with tool name", () => {
      const verdict = parseLayerVerdict([
        { name: RUN_LINT_TOOL, result: lintResult([{ severity: "error", message: "맵 연결 끊김" }]) },
        { name: EVALUATE_GAME_QUALITY_TOOL, result: qualityResult(false) },
      ]);
      expect(verdict.pass).toBe(false);
      expect(verdict.blockingIssues).toEqual(["run_lint: 맵 연결 끊김"]);
    });

    it("empty results → pass (nothing blocked)", () => {
      const verdict = parseLayerVerdict([]);
      expect(verdict.pass).toBe(true);
      expect(verdict.blockingIssues).toEqual([]);
      expect(verdict.warnings).toEqual([]);
    });
  });
  // ── composed advisory report ─────────────────────────────────────

  describe("runLayerVerificationReport — selection + verdict, no gating", () => {
    it("map layer, clean results → calls selected, verdict pass", () => {
      const report = runLayerVerificationReport(
        layer({ id: "L1", title: "마을", kind: "map" }),
        [],
        [
          { name: RUN_LINT_TOOL, result: lintResult() },
          { name: EVALUATE_GAME_QUALITY_TOOL, result: qualityResult(false) },
        ]
      );
      expect(report.calls).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: EVALUATE_GAME_QUALITY_TOOL, args: {} },
      ]);
      expect(report.verdict.pass).toBe(true);
    });

    it("quest layer, lint error → verdict fails and names the blocking issue (advisory only)", () => {
      const report = runLayerVerificationReport(
        layer({ id: "L2", title: "퀘스트", kind: "quest" }),
        [defineQuest("q1")],
        [{ name: RUN_LINT_TOOL, result: lintResult([{ severity: "error", message: "이벤트 연결 끊김" }]) }]
      );
      expect(report.calls).toEqual([
        { name: RUN_LINT_TOOL, args: {} },
        { name: VERIFY_QUEST_TOOL, args: { questId: "q1" } },
      ]);
      expect(report.verdict.pass).toBe(false);
      expect(report.verdict.blockingIssues).toContain("run_lint: 이벤트 연결 끊김");
    });

    it("repeated failures stay reportable — the module exposes no retry budget or stop reason", () => {
      const failing: ToolResultLike = scenarioResult(false, "실패");
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const report = runLayerVerificationReport(
          layer({ id: "L3", title: "최종 검증", kind: "final" }),
          [playWalkthrough([{ expect: "ended" }], true, "L3")],
          [{ name: PLAY_WALKTHROUGH_TOOL, result: failing }]
        );
        expect(report.verdict.pass).toBe(false);
        expect(Object.keys(report)).toEqual(["calls", "verdict"]);
      }
    });
  });
});

// test/aiAudioPromptBias.test.ts
// AI 이벤트 명령 프롬프트가 음악·효과음을 카탈로그 머리 40개로 자르는 편향을 지킨다.
// 검증 집합은 프롬프트 절단과 달리 카탈로그 전 id 를 받아야 한다.
describe("aiAudioPromptBias", () => {
  isolateTimers();
  const MAX_REF_ENTRIES = 40;
  // Matches PROMPT_SE_HEAD_IDS in src/ai/eventResourceCatalog.ts; the kjg/kra/kis sounds left the SE catalog in the public baseline (0d4f13e7c8).
  const FUNCTIONAL_SE_IDS = [
    "cc0-se-osx-wooded-box-open",
    "cc0-se-orp-inventory-coin",
    "cc0-se-osx-bell-01",
    "cc0-se-osx-door-open",
    "cc0-se-osx-door-close-01",
    "cc0-se-ors-wood-01",
  ] as const;
  const BGM_PROMPT_SCENES = ["village", "field", "forest", "dungeon", "night", "battle", "title"] as const;
  type BgmPromptScene = (typeof BGM_PROMPT_SCENES)[number];
  /** Phase 1 THEME_RULES.categoryNeedles. cave → dungeon. title 은 프롬프트 전용. */
  const BGM_PROMPT_SCENE_RULES: readonly { scene: BgmPromptScene; needles: readonly string[] }[] = [
    { scene: "title", needles: ["타이틀", "메뉴"] },
    { scene: "battle", needles: ["전투", "보스"] },
    { scene: "night", needles: ["야간 · 휴식", "밤"] },
    { scene: "dungeon", needles: ["던전", "유적", "동굴", "광산", "광물"] },
    {
      scene: "village",
      needles: ["마을", "광장", "길드", "회관", "시장 · 아침 생활", "축제", "과수원", "어촌", "찻집", "공원", "양봉"],
    },
    { scene: "forest", needles: ["숲 · 탐험", "잎다리", "소나무", "양치식물", "사과꽃"] },
    { scene: "field", needles: ["필드", "초원", "장거리"] },
  ];
  function bgmPromptScene(category: string): BgmPromptScene | null {
    for (const rule of BGM_PROMPT_SCENE_RULES) {
      if (rule.needles.some((needle) => category.includes(needle))) return rule.scene;
    }
    return null;
  }
  function maxCategoryShare(ids: readonly string[], categoryOf: (id: string) => string | undefined): number {
    const counts = new Map<string, number>();
    for (const id of ids) {
      const category = categoryOf(id);
      if (!category) continue;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return Math.max(0, ...counts.values()) / ids.length;
  }
  function refSectionIds(prompt: string, slot: "music" | "sound"): string[] {
    return parseAudioPrompt(prompt, slot).entries.map(entry => entry.id);
  }
  describe("AI 프롬프트 오디오 절단 편향", () => {
    it("블랭크 프로젝트의 음악 40개는 7개 장면 축을 덮고, 효과음 40개는 상자/동전/문/징글/발소리를 포함하며 한 분류가 과반이 아니다", () => {
      const project = createBlankProject();
      const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId });
      const musicIds = refSectionIds(prompt, "music");
      const soundIds = refSectionIds(prompt, "sound");

      expect(musicIds).toHaveLength(MAX_REF_ENTRIES);
      expect(soundIds).toHaveLength(MAX_REF_ENTRIES);

      const musicScenes = new Set(
        musicIds.flatMap((id) => {
          const category = findBgmTrack(id)?.category;
          const scene = category ? bgmPromptScene(category) : null;
          return scene ? [scene] : [];
        }),
      );
      expect([...musicScenes].sort()).toEqual([...BGM_PROMPT_SCENES].sort());
      for (const scene of ["village", "forest", "dungeon", "night", "battle"] as const) {
        expect(musicScenes.has(scene), scene).toBe(true);
      }
      expect(
        musicIds.some((id) => findBgmTrack(id)?.category.includes("소나무") === true),
        "pine-road(소나무) 가 숲 축으로 머리에 있어야 한다",
      ).toBe(true);
      expect(musicIds).not.toEqual(BGM_CATALOG.slice(0, MAX_REF_ENTRIES).map((track) => track.id));
      expect(maxCategoryShare(musicIds, (id) => findBgmTrack(id)?.category)).toBeLessThanOrEqual(0.5);

      const soundSet = new Set(soundIds);
      for (const id of FUNCTIONAL_SE_IDS) {
        expect(soundSet.has(id), id).toBe(true);
      }
      const uiOnly = soundIds.every((id) => {
        const entry = SE_CATALOG.find((item) => item.id === id);
        return entry?.category.startsWith("UI") === true;
      });
      expect(uiOnly).toBe(false);
      expect(maxCategoryShare(soundIds, (id) => SE_CATALOG.find((item) => item.id === id)?.category)).toBeLessThanOrEqual(
        0.5,
      );
    });

    it("검증 집합은 카탈로그 전 id 를 그대로 받는다", () => {
      const project = createBlankProject();
      const musicSet = eventResourceIdSet("music", project);
      const soundSet = eventResourceIdSet("sound", project);

      for (const track of BGM_CATALOG) {
        expect(musicSet.has(track.id), track.id).toBe(true);
      }
      for (const entry of SE_CATALOG) {
        expect(soundSet.has(entry.id), entry.id).toBe(true);
      }

      const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId });
      const shownMusic = new Set(refSectionIds(prompt, "music"));
      const shownSound = new Set(refSectionIds(prompt, "sound"));
      const hiddenMusic = BGM_CATALOG.find((track) => !shownMusic.has(track.id));
      const hiddenSound = SE_CATALOG.find((entry) => !shownSound.has(entry.id));
      expect(hiddenMusic, "프롬프트에 안 실린 BGM 이 있어야 절단이 살아 있다").toBeDefined();
      expect(hiddenSound, "프롬프트에 안 실린 SE 가 있어야 절단이 살아 있다").toBeDefined();

      const musicResult = parseAndValidate(
        project,
        JSON.stringify([{ kind: "playAudio", resourceId: hiddenMusic!.id, loop: true }]),
      );
      const soundResult = parseAndValidate(
        project,
        JSON.stringify([{ kind: "playAudio", resourceId: hiddenSound!.id, loop: false }]),
      );
      if (!musicResult.ok) throw new Error(musicResult.errors.join(" / "));
      if (!soundResult.ok) throw new Error(soundResult.errors.join(" / "));
    });
  });
});

// Claude 로 도는 길의 기본 = Claude Sonnet 5.5 · high (오너 결정 2026-11-23: 「조수는 sonnet 5.5 high 만 쓰게」).
// 지난 Claude 기본: 2026-11-16 Opus 5.5 · medium.
// 2026-11-19 에는 공장 기본(저장 없음)과 첫 실행의 우선 계정이 ChatGPT(GPT-6.2 Sol · medium)였지만, 2026-11-23(오너 결정)에 다시 Claude 가 됐다 — test/aiDefaultModelForced.test.ts.
// 이 파일은 공장 기본·Claude 를 고른·Claude 를 가진 길이 Sonnet 5.5 · high 한 모델인지 묶는다.
//
// 이 파일은 «들어가는 길마다 기본이 무엇으로 풀리는가» 를 한 자리에 고정한다:
//   Claude 로 도는 길(구독 CLI · Anthropic 키 · 편집기 안 계정) — 계획·실행·시각·작문·시공·감독이 모두 claude-sonnet-5-5 · high 한 모델.
//     Haiku 워커·팀장 나누기는 기본이 아니다(설정에서 고를 수는 있다).
//   Claude 를 쓸 수 없는 길(ChatGPT 만 · Google 만) — 그 계정의 기본(Sol · Argon).
//   이미 저장된 설정 — 그대로. 저장값이 옛 Claude 기본과 똑같을 때만 읽을 때 새 기본으로 올린다(PR #2535 와 같은 규칙, 디스크에는 쓰지 않는다).
describe("aiDefaultClaudeSonnetHigh", () => {
  isolateTimers();
  const OPUS = "claude-opus-5-5";
  const SONNET = "claude-sonnet-5-5";
  const HAIKU = "claude-haiku-5-5";
  const ROLES = ["deep", "build", "vision", "writer"] as const;
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true, writable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: (key: string) => { storage.delete(key); },
      },
    });
    setKnownOpenAiCompatEndpoints([]);
  });
  afterEach(() => {
    setKnownOpenAiCompatEndpoints([]);
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  /** 역할 넷 + 계획·감독(ultrabrain)을 `제공자/모델@강도` 로. */
  function resolved(config: AiConfig): Record<string, string> {
    const brain = configForUltrabrain(config);
    return {
      ...Object.fromEntries(ROLES.map((role) => { const m = modelForRole(config, role); return [role, `${m.provider}/${m.model}@${m.thinkingLevel}`]; })),
      plan: `${brain.providerId}/${brain.model}@${brain.reasoningEffort}`,
    };
  }
  const every = (slot: string, plan = slot): Record<string, string> => ({ deep: slot, build: slot, vision: slot, writer: slot, plan });
  const cli = (id: "claude" | "codex") => ({ id, state: "ready", billing: "subscription" });
  const oauth = (providerId: string) => ({ providerId, connected: true, authKind: "oauth" });
  /** 첫 실행 마법사가 하는 일 그대로: 찾은 것으로 팀을 고르고(buildTeamPlan) 저장한다(applyTeamPlan + aiSetupWizardDeps.selectProvider). */
  async function firstRun(partial: Partial<TeamInputs>): Promise<AiConfig> {
    const plan = buildTeamPlan({ clis: [], accounts: [], keys: [], ...partial });
    if (!plan) throw new Error("찾은 연결이 없다");
    const result = await applyTeamPlan(plan, {
      adoptKey: async (sourceId, modelId) => {
        const endpoint = { id: "openai-compat:claude-key", name: sourceId, defaultModel: modelId, models: [modelId] } as unknown as OpenAiCompatEndpointPublic;
        setKnownOpenAiCompatEndpoints([endpoint]);
        return endpoint.id;
      },
      saveEngine: saveAssistantEngine,
      saveLead: (lead) => { if (lead) throw new Error(`기본에는 팀장이 없어야 한다: ${JSON.stringify(lead)}`); },
      selectProvider: (providerId, workerModel) => {
        const base = configForProviderSelection(loadAiConfig(), providerId);
        saveAiConfig(providerId === "openai-codex" ? configForPlanAccount(base, providerId) : { ...base, model: workerModel });
      },
    });
    expect(result).toEqual({ ok: true });
    return loadAiConfig();
  }
  describe("들어가는 길마다 — Claude 로 도는 길은 모든 역할이 Sonnet 5.5 · high 한 모델", () => {
    it("새 설치(저장 없음): 공장 기본은 ChatGPT 의 GPT-6.2 Sol · high 다(2026-11-28) — Claude 로 시작하지 않는다", () => {
      expect(resolved(loadAiConfig())).toEqual(every("openai-codex/gpt-6.2-sol@high"));
      expect(resolved(defaultAiConfig())).toEqual(every("openai-codex/gpt-6.2-sol@high"));
      expect(defaultAiConfig()).toMatchObject({ providerId: "openai-codex", model: "gpt-6.2-sol", liteModel: "gpt-6.2-sol", reasoningEffort: "high" });
    });

    it("새 설치 + Claude CLI 구독: 같은 CLI 로 Sonnet 5.5 · high 하나 — 팀장도 Haiku 워커도 없다", async () => {
      const config = await firstRun({ clis: [cli("claude")] });
      expect(resolved(config)).toEqual(every(`local-cli:claude/${SONNET}@high`));
      expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "claude", routineModel: SONNET, deepModel: SONNET, effort: "high" });
      expect(assistantEngineLead(loadAssistantEngine())).toBeUndefined();
      expect(JSON.stringify(resolved(config))).not.toContain("haiku");
    });

    it("새 설치 + Claude CLI 와 Google 계정이 같이 있으면(ChatGPT 없음) Claude 하나로 시작한다", async () => {
      const config = await firstRun({ clis: [cli("claude")], accounts: [oauth("google-antigravity")] });
      expect(resolved(config)).toEqual(every(`local-cli:claude/${SONNET}@high`));
    });

    it("새 설치 + Claude CLI 와 ChatGPT 가 같이 있으면 ChatGPT(GPT-6.2 Sol · high) 하나로 시작한다(2026-11-28 오너 결정)", async () => {
      const config = await firstRun({ clis: [cli("claude"), cli("codex")], accounts: [oauth("google-antigravity")] });
      expect(resolved(config)).toEqual(every("local-cli:codex/gpt-6.2-sol@high"));
    });

    it("Anthropic 키: 입양한 엔드포인트의 모든 역할이 Sonnet 5.5 · high 이다", async () => {
      expect(keyRouteAdoptModel("claude")).toBe("sonnet");
      const config = await firstRun({ keys: [{ id: "ANTHROPIC_API_KEY", family: "claude", label: "ANTHROPIC_API_KEY", models: KEY_ROUTES.claude.models }] });
      expect(resolved(config)).toEqual(every(`openai-compat:claude-key/${SONNET}@high`));
      expect(loadAssistantEngine()).toBeUndefined();
    });

    it("편집기 안 Claude 계정: 다른 계정에서 Claude 로 바꾸면 모든 역할·감독이 Sonnet 5.5 · high 이다 — 「균형」 의 medium 으로 풀리지 않는다", () => {
      saveAiConfig(configForProviderSelection(loadAiConfig(), "google-antigravity"));
      const config = configForProviderSelection(loadAiConfig(), "anthropic");
      expect(resolved(config)).toEqual(every(`anthropic/${SONNET}@high`));
      expect(config.model).toBe(SONNET);
      expect(config.liteModel).toBe(SONNET);
    });
  });
  describe("들어가는 길마다 — ChatGPT 를 쓸 수 있는 길은 GPT-6.2 Sol · high, Google 만이면 Argon", () => {
    it("ChatGPT 구독(Codex CLI)만: Sol · high 하나", async () => {
      expect(resolved(await firstRun({ clis: [cli("codex")] }))).toEqual(every("local-cli:codex/gpt-6.2-sol@high"));
    });

    it("편집기 안 ChatGPT 로그인만: Sol · high 하나(계획·감독도 high)", async () => {
      expect(resolved(await firstRun({ accounts: [oauth("openai-codex")] }))).toEqual(every("openai-codex/gpt-6.2-sol@high"));
    });

    it("Google 로그인만: Gemini 4 Argon medium, 계획·감독은 high", async () => {
      expect(resolved(await firstRun({ accounts: [oauth("google-antigravity")] }))).toEqual(every("google-antigravity/gemini-4-argon@medium", "google-antigravity/gemini-4-argon@high"));
    });
  });
  describe("이미 저장된 설정 — 건드리지 않는다", () => {
    const stored = (blob: Record<string, unknown>): void => { storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(blob)); };
    const slots = (provider: string, model: string) => Object.fromEntries(ROLES.map((role) => [role, { provider, model, thinkingLevel: "medium" }]));

    it("옛 공장 기본(Google · Argon medium · 감독 high)으로 저장된 설정은 Claude·ChatGPT 로 옮기지 않는다", () => {
      stored({ providerId: "google-antigravity", model: "gemini-4-argon", liteModel: "gemini-4-argon", reasoningEffort: "medium",
        ultrabrainProviderId: "google-antigravity", ultrabrainModel: "gemini-4-argon", ultrabrainReasoningEffort: "high",
        roleModels: slots("google-antigravity", "gemini-4-argon"), modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 });
      expect(resolved(loadAiConfig())).toEqual(every("google-antigravity/gemini-4-argon@medium", "google-antigravity/gemini-4-argon@high"));
    });

    it("ChatGPT 로 저장된 설정도 그대로다", () => {
      stored({ providerId: "openai-codex", model: "gpt-6.1-sol", liteModel: "gpt-6.1-sol", ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-6.1-sol",
        ultrabrainReasoningEffort: "high", roleModels: slots("openai-codex", "gpt-6.1-sol"), modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 });
      expect(resolved(loadAiConfig())).toEqual(every("openai-codex/gpt-6.1-sol@medium", "openai-codex/gpt-6.1-sol@high"));
    });

    it("직접 고른 Terra 도 읽을 때 Sol 로 올리고 medium 이상은 유지한다", () => {
      const terra = (thinkingLevel: string) => ({ provider: "openai-codex", model: "gpt-6.1-terra", thinkingLevel });
      const raw = JSON.stringify({
        providerId: "openai-codex", model: "gpt-6.1-terra", liteModel: "gpt-6.1-terra", reasoningEffort: "off",
        ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-6.1-terra", ultrabrainReasoningEffort: "low",
        roleModels: { deep: terra("low"), build: terra("high"), writer: terra("off"), vision: terra("minimal") },
        pixelModel: terra("high"), assistantRoles: { advisor: terra("xhigh") },
        modelSelectionOverrides: { deep: true, build: true, writer: true, vision: true, ultrabrain: true, pixel: true, advisor: true },
        roleModelsPolicyVersion: 1,
      });
      storage.set(AI_CONFIG_STORAGE_KEY, raw);
      const config = loadAiConfig();
      expect(config).toMatchObject({ model: "gpt-6.2-sol", liteModel: "gpt-6.2-sol", reasoningEffort: "medium" });
      const medium = "openai-codex/gpt-6.2-sol@medium";
      expect(resolved(config)).toEqual({ ...every(medium), build: "openai-codex/gpt-6.2-sol@high" });
      expect(config.pixelModel).toMatchObject({ model: "gpt-6.2-sol", thinkingLevel: "high" });
      expect(config.assistantRoles?.advisor).toMatchObject({ model: "gpt-6.2-sol", thinkingLevel: "xhigh" });
      expect(storage.get(AI_CONFIG_STORAGE_KEY)).toBe(raw);
      saveAiConfig(config);
      expect(loadAiConfig()).toEqual(config);
    });

    it.each([["low", "medium"], ["high", "high"]])("저장된 Codex Terra 엔진을 Sol 로 읽는다 (%s → %s)", (effort, expected) => {
      storage.set(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify({
        kind: "local-cli", cli: "codex", routineModel: "gpt-6.1-terra", deepModel: "gpt-6.1-terra", effort, policyVersion: 2,
      }));
      expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "codex", routineModel: "gpt-6.2-sol", deepModel: "gpt-6.2-sol", effort: expected });
      expect(resolved(loadAiConfig())).toEqual(every(`local-cli:codex/gpt-6.2-sol@${expected}`));
    });

    it("지난 Claude 기본(Opus 5.5 medium)으로 저장된 계정 설정은 ChatGPT·Sonnet 으로 옮기지 않는다(2026-11-19 · 2026-11-23)", () => {
      stored({ providerId: "anthropic", model: OPUS, liteModel: OPUS, reasoningEffort: "medium",
        ultrabrainProviderId: "anthropic", ultrabrainModel: OPUS, ultrabrainReasoningEffort: "medium",
        roleModels: slots("anthropic", OPUS), modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 });
      expect(resolved(loadAiConfig())).toEqual(every(`anthropic/${OPUS}@medium`));
    });

    it("사람이 Sonnet·Haiku 를 직접 고른 Claude 설정은 그대로다", () => {
      stored({ providerId: "anthropic", model: "claude-sonnet-5-5", liteModel: HAIKU, ultrabrainProviderId: "anthropic", ultrabrainModel: OPUS, ultrabrainReasoningEffort: "high",
        roleModels: { ...slots("anthropic", "claude-sonnet-5-5"), deep: { provider: "anthropic", model: HAIKU, thinkingLevel: "low" } },
        modelSelectionOverrides: { deep: true, build: true, vision: true, writer: true, ultrabrain: true }, roleModelsPolicyVersion: 1 });
      expect(resolved(loadAiConfig())).toEqual({ deep: `anthropic/${HAIKU}@low`, build: "anthropic/claude-sonnet-5-5@medium", vision: "anthropic/claude-sonnet-5-5@medium",
        writer: "anthropic/claude-sonnet-5-5@medium", plan: `anthropic/${OPUS}@high` });
    });
  });
  describe("옛 Claude 기본과 똑같은 저장값만 읽을 때 새 기본으로 올린다 (PR #2535 와 같은 규칙)", () => {
    const LEGACY_ENGINE = { kind: "local-cli", cli: "claude", routineModel: HAIKU, deepModel: OPUS, effort: "medium", teamLead: true };

    it("Claude 구독 옛 기본(Opus 팀장 + Haiku 워커)으로 저장된 엔진 선택은 Sonnet 5.5 · high 하나로 읽는다 — 디스크는 그대로", () => {
      const raw = JSON.stringify(LEGACY_ENGINE);
      storage.set(ASSISTANT_ENGINE_STORAGE_KEY, raw);
      expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "claude", routineModel: SONNET, deepModel: SONNET, effort: "high" });
      expect(assistantEngineLead(loadAssistantEngine())).toBeUndefined();
      expect(resolved(loadAiConfig())).toEqual(every(`local-cli:claude/${SONNET}@high`));
      expect(storage.get(ASSISTANT_ENGINE_STORAGE_KEY)).toBe(raw);
    });

    it("2026-11-16 ~ 11-23 기본(Opus 5.5 하나 · medium, 표식 2)으로 저장된 엔진 선택은 Sonnet 5.5 · high 로 읽는다 — 표식 3 이 찍힌 같은 값은 그대로", () => {
      const opusOne = { kind: "local-cli", cli: "claude", routineModel: OPUS, deepModel: OPUS, effort: "medium" };
      const raw = JSON.stringify({ ...opusOne, policyVersion: 2 });
      storage.set(ASSISTANT_ENGINE_STORAGE_KEY, raw);
      expect(loadAssistantEngine()).toEqual({ kind: "local-cli", cli: "claude", routineModel: SONNET, deepModel: SONNET, effort: "high" });
      expect(storage.get(ASSISTANT_ENGINE_STORAGE_KEY)).toBe(raw);
      saveAssistantEngine(opusOne as Parameters<typeof saveAssistantEngine>[0]);
      expect(loadAssistantEngine()).toEqual(opusOne);
      storage.set(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify({ ...opusOne, effort: "high", policyVersion: 2 }));
      expect(loadAssistantEngine()?.routineModel).toBe(OPUS);
    });

    it("그 뒤에 사람이 다시 고른 Opus 팀장 + Haiku 워커는 그대로 둔다(저장이 표식을 찍는다)", () => {
      saveAssistantEngine({ kind: "local-cli", cli: "claude", routineModel: HAIKU, deepModel: OPUS, effort: "medium", teamLead: true });
      expect(loadAssistantEngine()).toEqual(LEGACY_ENGINE);
      expect(assistantEngineLead(loadAssistantEngine())).toEqual({ provider: "local-cli:claude", model: OPUS, thinkingLevel: "medium" });
      expect(modelForRole(loadAiConfig(), "deep").model).toBe(HAIKU);
    });

    it("옛 기본에서 한 칸이라도 고친 엔진 선택은 그대로 둔다", () => {
      for (const edited of [{ ...LEGACY_ENGINE, effort: "high" }, { ...LEGACY_ENGINE, teamLead: false }, { ...LEGACY_ENGINE, routineModel: "sonnet" }, { ...LEGACY_ENGINE, cli: "codex" }]) {
        storage.set(ASSISTANT_ENGINE_STORAGE_KEY, JSON.stringify(edited));
        expect(loadAssistantEngine()?.routineModel, JSON.stringify(edited)).toBe(edited.routineModel);
      }
    });

    it("Claude 계정을 골랐을 때 제품이 채운 Haiku 칸은 조수 기본(Sonnet 5.5)으로 읽고, 사람이 고른 Haiku 칸은 그대로 둔다 — 강도는 저장된 대로", () => {
      const blob = (pinned: Record<string, true>) => ({ providerId: "anthropic", model: HAIKU, liteModel: HAIKU, ultrabrainProviderId: "anthropic", ultrabrainModel: OPUS, ultrabrainReasoningEffort: "high",
        roleModels: Object.fromEntries(ROLES.map((role) => [role, { provider: "anthropic", model: HAIKU, thinkingLevel: "medium" }])), modelSelectionOverrides: pinned, roleModelsPolicyVersion: 1 });
      const raw = JSON.stringify(blob({}));
      storage.set(AI_CONFIG_STORAGE_KEY, raw);
      expect(resolved(loadAiConfig())).toEqual(every(`anthropic/${SONNET}@medium`, `anthropic/${OPUS}@high`));
      expect(loadAiConfig().model).toBe(SONNET);
      expect(loadAiConfig().liteModel).toBe(SONNET);
      expect(storage.get(AI_CONFIG_STORAGE_KEY)).toBe(raw);

      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(blob({ deep: true })));
      expect(resolved(loadAiConfig())).toEqual({ ...every(`anthropic/${SONNET}@medium`, `anthropic/${OPUS}@high`), deep: `anthropic/${HAIKU}@medium` });
      expect(loadAiConfig().liteModel).toBe(HAIKU);
    });

    it("다른 계정의 Haiku(사용자 지정 엔드포인트 등)는 건드리지 않는다", () => {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-compat:my-proxy", model: HAIKU, liteModel: HAIKU,
        roleModels: { deep: { provider: "openai-compat:my-proxy", model: HAIKU, thinkingLevel: "medium" } }, modelSelectionOverrides: {}, roleModelsPolicyVersion: 1 }));
      expect(modelForRole(loadAiConfig(), "deep")).toEqual({ provider: "openai-compat:my-proxy", model: HAIKU, thinkingLevel: "medium" });
      expect(loadAiConfig().model).toBe(HAIKU);
    });
  });
  describe("곁 호출도 조수 기본 모델 — 기본값은 한 곳(src/ai/claudeDefault.ts) (N6, 2026-11-16)", () => {
    // r7a(조수 Opus 5.5 medium)에서 화면 검수 곁 호출 7번이 따로 박혀 있던 다른 모델로 갔다.
    // 기본값을 적는 모든 자리가 같은 상수를 보는지, 곁 호출(화면 검수 · 검토자)이 Claude 로 갈 때 조수 기본(Sonnet 5.5 · high)인지 묶는다.
    it("기본값을 적는 자리가 모두 같은 상수다", async () => {
      const { ASSISTANT_CLAUDE_MODEL, ASSISTANT_CLAUDE_EFFORT } = await import("@/ai/claudeDefault");
      const { CLAUDE_DEFAULT_MODEL, CLAUDE_DEFAULT_EFFORT } = await import("@/ai/ohMyPiProviders");
      const { LOCAL_CLI_DEFAULT_MODELS } = await import("@/ai/localCliEngine");
      const { CLAUDE_SUBSCRIPTION_ENGINE } = await import("@/ai/planDefaults");
      expect([ASSISTANT_CLAUDE_MODEL, ASSISTANT_CLAUDE_EFFORT]).toEqual([SONNET, "high"]);
      expect([CLAUDE_DEFAULT_MODEL, CLAUDE_DEFAULT_EFFORT]).toEqual([ASSISTANT_CLAUDE_MODEL, ASSISTANT_CLAUDE_EFFORT]);
      expect(LOCAL_CLI_DEFAULT_MODELS.claude).toEqual({ routine: ASSISTANT_CLAUDE_MODEL, deep: ASSISTANT_CLAUDE_MODEL });
      expect(CLAUDE_SUBSCRIPTION_ENGINE).toMatchObject({ routineModel: ASSISTANT_CLAUDE_MODEL, deepModel: ASSISTANT_CLAUDE_MODEL, effort: ASSISTANT_CLAUDE_EFFORT });
      expect(CLAUDE_SUBSCRIPTION_ENGINE.teamLead).toBeUndefined();
    });

    it("역할 표(JSON)의 Claude 칸 — 주·검토자·눈·도트의 첫 후보가 그 상수 · high 이고, 어느 칸에도 Opus·Haiku 가 먼저 서지 않는다", async () => {
      const matrix = (await import("@/ai/assistantRoleMatrix.json")).default as { families: Record<string, { routes: { providerId: string; roles: Record<string, { model: string; thinkingLevel: string }[]> }[] }> };
      const route = matrix.families.claude!.routes.find((r) => r.providerId === "local-cli:claude")!;
      for (const role of ["main", "advisor", "vision", "pixel"]) {
        expect(route.roles[role]?.[0], role).toEqual({ model: SONNET, thinkingLevel: "high" });
      }
      expect(route.roles.smol).toBeUndefined();
    });

    it("화면 검수(VQA) — Claude 로 넘어가면 Sonnet 5.5 · high 이고, GPT 단독에서는 Claude CLI 를 몰래 호출하지 않는다", async () => {
      const { vqaReviewerCandidates } = await import("@/ai/v2/judge/vqa");
      const { familyOfProviderId } = await import("@/ai/assistantRoles");
      const claudeOf = (main: { provider: string; model: string }, extraKeyed: string[] = []) => vqaReviewerCandidates({ main, keyed: new Set([main.provider, ...extraKeyed]), familyOf: (id) => familyOfProviderId(id, [main.model]) })
        .filter((p) => p.provider === "local-cli:claude");
      // 조수가 Claude(Sonnet)로 돌 때: Claude 검수자는 Sonnet · high 하나(주 모델과 합쳐짐 — 지은 모델과 검수 모델이 같다).
      expect(claudeOf({ provider: "local-cli:claude", model: SONNET })).toEqual([{ provider: "local-cli:claude", model: SONNET, effort: "high", sameAsMain: true }]);
      // GPT 단독에서는 미연결 Claude CLI 를 몰래 부르지 않는다.
      expect(claudeOf({ provider: "openai-codex", model: "gpt-6.2-sol" })).toEqual([]);
      // Claude CLI 가 명시적으로 keyed 됐을 때만 다른 계열 검수자로 선다.
      expect(claudeOf({ provider: "openai-codex", model: "gpt-6.1-terra" }, ["local-cli:claude"])).toEqual([{ provider: "local-cli:claude", model: SONNET, effort: "high", sameAsMain: false }]);
      expect(claudeOf({ provider: "google-antigravity", model: "gemini-4-argon" }, ["local-cli:claude"])[0]).toMatchObject({ model: SONNET, effort: "high" });
    });

    it("검토자(advisor) 자동 배정 — Claude 만 연결되면 Sonnet 5.5 · high", async () => {
      const { resolveAssistantRoles } = await import("@/ai/assistantRoles");
      const { mockConnectedRoutes } = await import("@/editor/panels/aiRoleMatrixSettings");
      const roles = resolveAssistantRoles(mockConnectedRoutes("claude"));
      expect(roles.advisor).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: SONNET, thinkingLevel: "high" } });
      expect(roles.vision).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: SONNET, thinkingLevel: "high" } });
    });
  });
});

// 기본 모델 계약 둘.
//   ① 새 설정의 공장 기본 = Claude Sonnet 5.5 · high — 계획·실행·시각·작문·시공·감독 모든 슬롯이 한 모델이다(오너 결정 2026-11-23: 「조수는 sonnet 5.5 high 만 쓰게」).
//      ChatGPT 를 고른 사람의 기본은 GPT-6.2 Sol · medium 이다(2026-11-19 에는 이것이 공장 기본이었다).
//   ② Google 계정(옛 저장값의 기본 제공자)의 기본 모델 = gemini-4-argon — 네 소스가 한 값이다(2026-08-26 강제, 2026-10-14 Argon 이동).
//
// 왜 계약으로 고정하는가: 기본 모델이 여러 곳에서 각자 정해지면(llmClient 의 DEFAULT_MODEL /
// DEFAULT_LITE_MODEL, modelCatalog 의 제공자별 추천 첫 항목, ohMyPiProviders 의 제공자 기본값)
// 한 곳만 바꿨을 때 나머지가 조용히 갈라진다. 실측(2026-08-26): 게이트웨이가 허용하지 않는
// 모델이 기본값으로 남아 400 "Model not allowed" 로 턴이 죽었고, 어디를 고쳐야 하는지
// 소스가 네 군데로 흩어져 있었다. 그래서 네 소스를 한 값으로 묶어 계약으로 잡는다.
//
// 네 소스만으로는 부족했다(실측 2026-09-26): 3.8 이동에서 프리셋 「빠르게」 의 fast 티어와
// modelForRole 의 리터럴 폴백이 3.7 로 남아, 「빠르게」 를 고르면 기본 모델이 조용히
// 내려앉았다. 파생 기본값도 같은 계약에 넣는다.
describe("aiDefaultModelForced", () => {
  isolateTimers();
  /** Google 계정(옛 저장값의 기본 제공자)의 기본 모델. */
  const FORCED_DEFAULT = "gemini-4-argon";
  /** 새 설정의 공장 기본(오너 결정 2026-11-28) — 저장된 설정이 없으면 이 제공자·모델·강도다. */
  const FACTORY_PROVIDER = "openai-codex";
  const FACTORY_MODEL = "gpt-6.2-sol";
  const FACTORY_EFFORT = "high";
  /** Claude 길의 기본(2026-11-23~11-27 에는 공장 기본이었다) — Claude 를 고르면 이 모델이다. */
  const CLAUDE_MODEL = "claude-sonnet-5-5";
  describe("공장 기본 = ChatGPT GPT-6.2 Sol · high", () => {
    it("권장 제공자와 조수 기본 모델 상수가 ChatGPT · GPT-6.2 Sol · high 다(Claude 길의 기본 상수는 Sonnet 5.5)", () => {
      expect(RECOMMENDED_OH_MY_PI_PROVIDER).toBe(FACTORY_PROVIDER);
      expect(CHATGPT_DEFAULT_MODEL).toBe(FACTORY_MODEL);
      expect(CLAUDE_DEFAULT_MODEL).toBe(CLAUDE_MODEL);
      expect(CLAUDE_DEFAULT_EFFORT).toBe("high");
    });

    it("defaultAiConfig 의 제공자와 두 모델 슬롯이 공장 기본이다", () => {
      const config = defaultAiConfig();

      expect(config.providerId).toBe(FACTORY_PROVIDER);
      expect(config.model).toBe(FACTORY_MODEL);
      expect(config.liteModel).toBe(FACTORY_MODEL);
    });

    it("공장 기본 추론 강도가 high 다", () => {
      expect(defaultAiConfig().reasoningEffort).toBe(FACTORY_EFFORT);
    });

    it("새 설정의 모든 역할 슬롯이 Claude 의 Sonnet 5.5 · high 다", () => {
      const roles = defaultAiConfig().roleModels ?? {};
      for (const role of ["deep", "vision", "writer", "build"] as const) {
        expect(roles[role], role).toEqual({ provider: FACTORY_PROVIDER, model: FACTORY_MODEL, thinkingLevel: FACTORY_EFFORT });
      }
    });

    it("계획·감독(ultrabrain)도 같은 모델 · high 다", () => {
      expect(defaultAiConfig()).toMatchObject({ ultrabrainProviderId: FACTORY_PROVIDER, ultrabrainModel: FACTORY_MODEL, ultrabrainReasoningEffort: FACTORY_EFFORT });
      expect(configForUltrabrain(defaultAiConfig())).toMatchObject({ providerId: FACTORY_PROVIDER, model: FACTORY_MODEL, reasoningEffort: FACTORY_EFFORT });
    });

    it("도트 저작 칸은 비어 있어 계획 모델(Sonnet 5.5 high)을 따른다 — 다른 계정을 요구하지 않는다", () => {
      expect(defaultAiConfig().pixelModel).toBeUndefined();
      expect(resolvePixelModel(defaultAiConfig())).toEqual({ follows: true, model: { provider: FACTORY_PROVIDER, model: FACTORY_MODEL, thinkingLevel: FACTORY_EFFORT } });
    });

    it("그림 만들기는 공장 기본과 무관하게 ChatGPT 뿐이다(오너 결정 2026-11-19)", () => {
      expect(defaultAiConfig().imageProviderId).toBe("openai-codex");
    });

    it("공장 기본 모델은 Claude 카탈로그에서 실제로 고를 수 있다(드롭다운 누락 방지)", () => {
      expect(modelCatalogForAuthMode("chatgpt", FACTORY_PROVIDER).flatMap((g) => g.models)).toContain(FACTORY_MODEL);
    });
  });
  describe("Claude 계정의 기본 = Sonnet 5.5 · high", () => {
    it("Claude 계정의 카탈로그 첫 항목·제공자 레코드·두 티어가 모두 Sonnet 5.5 다(프리셋이 Haiku 로 내리지 않는다)", () => {
      expect(defaultModelForAuthMode("chatgpt", "anthropic")).toBe(CLAUDE_MODEL);
      expect(getOhMyPiProvider("anthropic")?.defaultModel).toBe(CLAUDE_MODEL);
      expect(tierModelFor("anthropic", "fast")).toBe(CLAUDE_MODEL);
      expect(tierModelFor("anthropic", "strong")).toBe(CLAUDE_MODEL);
    });

    it("모델이 빈 Claude 설정의 modelForRole 폴백도 Sonnet 5.5 다", () => {
      expect(modelForRole({ providerId: "anthropic" } as AiConfig, "deep").model).toBe(CLAUDE_MODEL);
    });
  });
  describe("ChatGPT 길의 기본 = GPT-6.2 Sol · high (공장 기본)", () => {
    it("ChatGPT 카탈로그 첫 항목과 제공자 레코드가 GPT-6.2 Sol 이고 두 티어가 같다", () => {
      expect(defaultModelForAuthMode("chatgpt", FACTORY_PROVIDER)).toBe(FACTORY_MODEL);
      expect(getOhMyPiProvider(FACTORY_PROVIDER)?.defaultModel).toBe(FACTORY_MODEL);
      expect(tierModelFor(FACTORY_PROVIDER, "fast")).toBe(FACTORY_MODEL);
      expect(tierModelFor(FACTORY_PROVIDER, "strong")).toBe(FACTORY_MODEL);
    });

    it("모델이 빈 ChatGPT 설정의 modelForRole 폴백도 공장 기본 모델이다", () => {
      expect(modelForRole({ providerId: FACTORY_PROVIDER } as AiConfig, "deep").model).toBe(FACTORY_MODEL);
    });
  });
  describe("Google 계정의 강제 기본 모델", () => {
    it("감독 모델과 실행(lite) 모델 상수가 모두 강제 기본값이다(옛 저장값의 모델 기본)", () => {
      expect(DEFAULT_MODEL).toBe(FORCED_DEFAULT);
      expect(DEFAULT_LITE_MODEL).toBe(FORCED_DEFAULT);
    });

    it("기본 제공자의 카탈로그 추천 첫 항목이 강제 기본값이다", () => {
      expect(defaultModelForAuthMode("chatgpt", DEFAULT_OH_MY_PI_PROVIDER)).toBe(FORCED_DEFAULT);

      const groups = modelCatalogForAuthMode("chatgpt", DEFAULT_OH_MY_PI_PROVIDER);
      expect(groups[0]?.models[0]).toBe(FORCED_DEFAULT);
    });

    it("기본 제공자 레코드의 defaultModel 도 강제 기본값이다", () => {
      expect(getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER)?.defaultModel).toBe(FORCED_DEFAULT);
    });

    it("강제 기본값은 카탈로그에서 실제로 고를 수 있다(드롭다운 누락 방지)", () => {
      const models = modelCatalogForAuthMode("chatgpt", DEFAULT_OH_MY_PI_PROVIDER).flatMap((g) => g.models);

      expect(models).toContain(FORCED_DEFAULT);
    });

    it("기본 제공자의 fast 티어가 강제 기본값이다(「빠르게」 프리셋이 모델을 내리지 않는다)", () => {
      expect(tierModelFor(DEFAULT_OH_MY_PI_PROVIDER, "fast")).toBe(FORCED_DEFAULT);
    });

    it("역할 모델이 저장돼 있지 않으면 modelForRole 폴백도 강제 기본값이다", () => {
      expect(modelForRole({} as AiConfig, "deep").model).toBe(FORCED_DEFAULT);
    });

  });
});

// test/aiProjectInstructions.test.ts
// 감독 지침(project.aiInstructions) — 정규화·블록 조립·시스템 프롬프트 생존.
//
// 마지막 케이스가 이 기능의 존재 이유다: 토큰 예산을 아무리 조여도 지침은 시스템 프롬프트에
// 남아야 한다. 예산 안(capability index 옆)에 넣으면 작은 예산에서 조용히 잘려 나가고,
// 사용자는 "규칙을 저장했는데 조수가 무시한다" 를 겪는다.
describe("aiProjectInstructions", () => {
  isolateTimers();
  describe("normalizeAiInstructions", () => {
    it("Given CRLF 와 앞뒤 공백 When 정규화 Then LF 로 통일되고 공백이 떨어진다", () => {
      expect(normalizeAiInstructions("  1줄\r\n2줄\r  ")).toBe("1줄\n2줄");
    });

    it("Given 비어 있거나 문자열이 아닌 값 When 정규화 Then 빈 문자열이다", () => {
      expect(normalizeAiInstructions("")).toBe("");
      expect(normalizeAiInstructions("   \n  ")).toBe("");
      expect(normalizeAiInstructions(null)).toBe("");
      expect(normalizeAiInstructions(undefined)).toBe("");
    });

    it("Given 상한 초과 When 정규화 Then 상한에서 잘린다", () => {
      const long = "가".repeat(AI_INSTRUCTIONS_MAX_CHARS + 500);

      expect(normalizeAiInstructions(long)).toHaveLength(AI_INSTRUCTIONS_MAX_CHARS);
    });
  });
  describe("aiInstructionsSection", () => {
    it("Given 미설정 When 블록 조립 Then null(프롬프트에 아무것도 붙지 않는다)", () => {
      expect(aiInstructionsSection("")).toBeNull();
      expect(aiInstructionsSection(undefined)).toBeNull();
    });

    it("Given 지침 When 블록 조립 Then 우선순위와 생존 규칙을 명시한다", () => {
      const section = aiInstructionsSection("이 게임은 4방향 이동이다.")!;

      expect(section).toContain("## 감독 지침(이 프로젝트 고정 규칙)");
      expect(section).toContain("이 절을 따른다");
      expect(section).toContain("이 게임은 4방향 이동이다.");
    });
  });
  describe("buildSystemPrompt 의 감독 지침 주입", () => {
    it("Given 지침 없는 프로젝트 When 프롬프트 조립 Then 지침 절이 없다", () => {
      const prompt = buildSystemPrompt(createBlankProject());

      expect(prompt).not.toContain("## 감독 지침");
    });

    it("Given 지침 있는 프로젝트 When 프롬프트 조립 Then 지침 절이 포함된다", () => {
      const project = { ...createBlankProject(), aiInstructions: "타일셋 B 는 쓰지 마라." };

      const prompt = buildSystemPrompt(project);

      expect(prompt).toContain("## 감독 지침(이 프로젝트 고정 규칙)");
      expect(prompt).toContain("타일셋 B 는 쓰지 마라.");
    });

    it("Given 극단적으로 작은 문자 예산 When 프롬프트 조립 Then 지침은 살아남는다(예산 밖 고정분)", () => {
      const project = { ...createBlankProject(), aiInstructions: "전투는 턴제다." };

      const prompt = buildSystemPrompt(project, { budgetChars: 400 });

      expect(prompt).toContain("전투는 턴제다.");
    });
  });
});

describe("aiProviderSelection", () => {
  isolateTimers();
  const codex = "openai-codex";
  const google = "google-antigravity";
  afterEach(() => vi.unstubAllGlobals());
  describe("account selection and persisted work models", () => {
    it("a first ChatGPT selection routes work to gpt-6.2-sol high for every work role", () => {
      const next = configForProviderSelection(defaultAiConfig(), codex);
      // 직접 고른 역할이 없으면 계획·시공·작문·실행·시각 모두 ChatGPT(GPT-6.2 Sol high)로 간다.
      expect(workProviderIds(next)).toEqual([codex]);
      for (const role of ["vision", "deep", "build", "writer"] as const) {
        expect(configForRole(next, role).providerId).toBe(codex);
        expect(configForRole(next, role).model).toBe("gpt-6.2-sol");
        expect(configForRole(next, role).reasoningEffort).toBe("high");
      }
      expect(next.ultrabrainProviderId).toBe(codex);
      expect(next.ultrabrainModel).toBe("gpt-6.2-sol");
      expect(next.ultrabrainReasoningEffort).toBe("high");
      expect(next.imageProviderId).toBe(codex);
    });

    it("티어 매핑이 없는 계정(Grok)으로 바꾸면 이전 제공자 모델을 남기지 않고 그 계정의 기본 모델을 쓴다", () => {
      const next = configForProviderSelection(defaultAiConfig(), "xai-oauth");
      for (const role of ["vision", "deep", "build", "writer"] as const) {
        expect(configForRole(next, role).providerId).toBe("xai-oauth");
        expect(configForRole(next, role).model).toBe("grok-4.6");
      }
      expect(next.ultrabrainModel).toBe("grok-4.6");
    });

    it("preserves direct mixed-account choices through save, reload, and account switching", () => {
      const values = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      });
      const config = defaultAiConfig();
      config.roleModels = { vision: { provider: google, model: "gemini-3-pro", thinkingLevel: "high" } };
      config.imageProviderId = google;
      config.modelSelectionOverrides = { vision: true, image: true };
      saveAiConfig(config);
      const next = configForProviderSelection(loadAiConfig(), codex);
      expect(next.roleModels?.vision).toEqual(config.roleModels.vision);
      expect(next.imageProviderId).toBe(codex);
      expect(new Set(workProviderIds(next))).toEqual(new Set([codex, google]));
      const aligned = configForProviderSelection(next, codex, true);
      expect(workProviderIds(aligned)).toEqual([codex]);
      expect(aligned.roleModels?.vision?.model).toBe("gpt-6.2-sol");
      expect(aligned.modelSelectionOverrides).toEqual({});
      expect(aligned.imageProviderId).toBe(codex);
      expect(aligned.imageModel).toBe("codex-image-default");
    });

    it("treats stored legacy choices as explicit until the user aligns them", () => {
      const legacy = { ...defaultAiConfig(), providerId: google, ultrabrainProviderId: google, ultrabrainModel: "gemini-4-argon",
        roleModels: { writer: { provider: google, model: "gemini-3-pro", thinkingLevel: "high" } } };
      delete legacy.modelSelectionOverrides;
      vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(legacy) });
      const next = configForProviderSelection(loadAiConfig(), codex);
      expect(next.roleModels?.writer?.provider).toBe(google);
      expect(next.ultrabrainProviderId).toBe(google);
    });
  });
});

describe("aiRunOutcome", () => {
  isolateTimers();
  type Facts = Parameters<typeof deriveRunOutcome>[0];
  const executions = [
    "response-final", "awaiting-user", "blocked", "cancelled", "budget-exhausted", "failed",
  ] as const satisfies readonly RunOutcome["execution"][];
  const assessments = [
    { acceptance: null, goal: "unassessed" },
    { acceptance: "pending", goal: "incomplete" },
    { acceptance: "working", goal: "incomplete" },
    { acceptance: "verifying", goal: "incomplete" },
    { acceptance: "verified", goal: "satisfied" },
    { acceptance: "blocked", goal: "incomplete" },
  ] as const satisfies readonly {
    readonly acceptance: AcceptanceStatus | null;
    readonly goal: RunOutcome["goal"];
  }[];
  const deliveries = [
    { hasPendingDraft: false, hasApplied: false, persistence: "none", delivery: "no-change" },
    { hasPendingDraft: false, hasApplied: false, persistence: "accepted", delivery: "no-change" },
    { hasPendingDraft: false, hasApplied: false, persistence: "verified-current", delivery: "no-change" },
    { hasPendingDraft: false, hasApplied: true, persistence: "none", delivery: "applied" },
    { hasPendingDraft: false, hasApplied: true, persistence: "accepted", delivery: "persisted" },
    { hasPendingDraft: false, hasApplied: true, persistence: "verified-current", delivery: "persisted-verified" },
    { hasPendingDraft: true, hasApplied: false, persistence: "none", delivery: "draft" },
    { hasPendingDraft: true, hasApplied: false, persistence: "accepted", delivery: "draft" },
    { hasPendingDraft: true, hasApplied: false, persistence: "verified-current", delivery: "draft" },
    { hasPendingDraft: true, hasApplied: true, persistence: "none", delivery: "draft" },
    { hasPendingDraft: true, hasApplied: true, persistence: "accepted", delivery: "draft" },
    { hasPendingDraft: true, hasApplied: true, persistence: "verified-current", delivery: "draft" },
  ] as const satisfies readonly (Pick<Facts, "hasPendingDraft" | "hasApplied" | "persistence"> & {
    readonly delivery: RunOutcome["delivery"];
  })[];
  const queryFacts = {
    execution: "response-final", acceptance: null,
    hasPendingDraft: false, hasApplied: false, persistence: "none",
  } as const satisfies Facts;
  describe("deriveRunOutcome", () => {
    it("exposes the readonly normalized API when imported by a caller", () => {
      // Given
      const facts: Facts = queryFacts;
      // When
      const outcome = deriveRunOutcome(facts);
      // Then
      expectTypeOf(outcome).toEqualTypeOf<RunOutcome>();
      expectTypeOf<Facts>().toEqualTypeOf<{
        readonly execution: RunOutcome["execution"];
        readonly acceptance: AcceptanceStatus | null;
        readonly hasPendingDraft: boolean;
        readonly hasApplied: boolean;
        readonly persistence: "none" | "accepted" | "verified-current";
        readonly visualDelivery?: { readonly attempted: number; readonly attached: number };
      }>();
      expect(outcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change", imageAttached: false });
    });

    // The three axes are independent projections, so each axis is checked against its contract table
    // without enumerating the full execution x assessment x delivery cross product.
    for (const execution of executions) {
      for (const { acceptance, goal } of assessments) {
        it(`projects execution=${execution} acceptance=${acceptance} onto the execution and goal axes`, () => {
          // Given: expected axes come from the fixed contract tables, not the implementation.
          const facts = Object.freeze({ ...queryFacts, execution, acceptance });
          // When
          const outcome = deriveRunOutcome(facts);
          // Then
          expect(outcome).toEqual({ execution, goal, delivery: "no-change", imageAttached: false });
        });
      }
    }

    it.each(deliveries)(
      "projects $delivery when pending=$hasPendingDraft applied=$hasApplied persistence=$persistence",
      ({ hasPendingDraft, hasApplied, persistence, delivery }) => {
        // Given
        const facts = Object.freeze({ ...queryFacts, hasPendingDraft, hasApplied, persistence });
        // When
        const outcome = deriveRunOutcome(facts);
        // Then
        expect(outcome).toEqual({ execution: "response-final", goal: "unassessed", delivery, imageAttached: false });
      },
    );

    it("preserves accepted persistence when the owner cannot supply a current passing proof", () => {
      // Given: failed proof leaves the accepted save fact intact; this is not a proof-authority test.
      const facts: Facts = { ...queryFacts, acceptance: "verifying", hasApplied: true, persistence: "accepted" };
      // When
      const outcome = deriveRunOutcome(facts);
      // Then
      expect(outcome).toEqual({ execution: "response-final", goal: "incomplete", delivery: "persisted", imageAttached: false });
    });

    it("leaves caller facts unchanged when a pending draft wins over applied work", () => {
      // Given: mutable caller input also must not be frozen or rewritten by projection.
      const facts: Facts = { ...queryFacts, execution: "cancelled", hasPendingDraft: true, hasApplied: true };
      const before = { ...facts };
      // When
      deriveRunOutcome(facts);
      // Then
      expect(facts).toEqual(before);
      expect(Object.isFrozen(facts)).toBe(false);
    });

    it("returns an immutable value when projecting normalized facts", () => {
      // Given
      const facts = Object.freeze({ ...queryFacts });
      // When
      const outcome = deriveRunOutcome(facts);
      // Then: every output field is primitive, so freezing the object freezes the whole value.
      expect(Object.isFrozen(outcome)).toBe(true);
      expect(Reflect.set(outcome, "delivery", "persisted-verified")).toBe(false);
      expect(outcome.delivery).toBe("no-change");
    });

    it("does not borrow old delivery or assessment when a new query follows verified applied work", () => {
      // Given: prior invocation is fixture setup, not a source of current-run authority.
      deriveRunOutcome({ ...queryFacts, acceptance: "verified", hasApplied: true, persistence: "verified-current" });
      // When
      const outcome = deriveRunOutcome(queryFacts);
      // Then
      expect(outcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change", imageAttached: false });
    });
  });
});

// test/aiSessionUsage.test.ts
// 사용량 집계 — 호출 지점에서 세는 것의 계약. 여기서 잠그는 것은 "무엇을 세고 무엇을
// 모른다고 말하는가" 다: usage 를 안 준 호출도 호출 수에는 들어가고, 그 사실이 따로 남는다.
// (구 구현은 감사 로그 문자열 정규식이라 요약·플래너 콜을 통째로 놓쳤다.)
describe("aiSessionUsage", () => {
  isolateTimers();
  describe("addSessionUsage", () => {
    it("Given 같은 모델 두 호출 When 집계 Then 합계와 모델별이 모두 누적된다", () => {
      let totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 100, completion_tokens: 20 });
      totals = addSessionUsage(totals, "gpt-x", { prompt_tokens: 300, completion_tokens: 5 });

      expect(totals.calls).toBe(2);
      expect(totals.promptTokens).toBe(400);
      expect(totals.completionTokens).toBe(25);
      expect(totals.byModel).toHaveLength(1);
      expect(totals.byModel[0]).toMatchObject({ model: "gpt-x", calls: 2, promptTokens: 400, completionTokens: 25 });
    });

    it("Given 서로 다른 모델 When 집계 Then 첫 등장 순서로 분해된다", () => {
      let totals = addSessionUsage(EMPTY_SESSION_USAGE, "big", { prompt_tokens: 10, completion_tokens: 1 });
      totals = addSessionUsage(totals, "lite", { prompt_tokens: 4, completion_tokens: 2 });
      totals = addSessionUsage(totals, "big", { prompt_tokens: 6, completion_tokens: 3 });

      expect(totals.byModel.map((entry) => entry.model)).toEqual(["big", "lite"]);
      expect(totals.byModel[0]!.calls).toBe(2);
      expect(totals.byModel[1]!.calls).toBe(1);
    });

    it("Given usage 없는 호출 When 집계 Then 호출 수는 세고 계량 미보고로 표시한다", () => {
      const totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", undefined);

      expect(totals.calls).toBe(1);
      expect(totals.promptTokens).toBe(0);
      expect(totals.callsWithoutUsage).toBe(1);
      expect(formatSessionUsage(totals)).toContain("계량 미보고 1회");
    });

    it("Given 음수·NaN usage When 집계 Then 0 으로 취급한다(합계가 뒤로 가지 않는다)", () => {
      const totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", {
        prompt_tokens: -50,
        completion_tokens: Number.NaN,
      });

      expect(totals.promptTokens).toBe(0);
      expect(totals.completionTokens).toBe(0);
      expect(totals.callsWithoutUsage).toBe(1);
    });

    it("Given 빈 모델 이름 When 집계 Then 자리표시 라벨로 묶인다(집계가 사라지지 않는다)", () => {
      const totals = addSessionUsage(EMPTY_SESSION_USAGE, "   ", { prompt_tokens: 7 });

      expect(totals.byModel[0]!.model).toBe("(모델 미지정)");
    });

    it("Given 입력 집계 When 다시 집계 Then 원본은 불변이다", () => {
      const first = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 100 });
      addSessionUsage(first, "gpt-x", { prompt_tokens: 100 });

      expect(first.calls).toBe(1);
      expect(EMPTY_SESSION_USAGE.calls).toBe(0);
    });
  });
  describe("formatTokenCount / formatSessionUsage", () => {
    it("Given 네 자리 이상 When 포맷 Then 천 단위 구분을 로케일 없이 넣는다", () => {
      expect(formatTokenCount(0)).toBe("0");
      expect(formatTokenCount(999)).toBe("999");
      expect(formatTokenCount(1000)).toBe("1,000");
      expect(formatTokenCount(84_120)).toBe("84,120");
      expect(formatTokenCount(-5)).toBe("0");
    });

    it("Given 호출 0건 When 요약 Then 숫자 0 대신 상태 문장을 준다", () => {
      expect(formatSessionUsage(EMPTY_SESSION_USAGE)).toBe("아직 요청 없음");
    });

    it("Given 정상 집계 When 요약 Then 호출·입력·출력 세 항목만 남는다", () => {
      const totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 84_120, completion_tokens: 6_410 });

      expect(formatSessionUsage(totals)).toBe("호출 1회 · 입력 84,120 · 출력 6,410");
    });
  });
});

// AI 표면 프론트 액션 수집기(src/ai/uiEventLog.ts) 계약.
//
// 왜 이 4가지를 잠그는가: 이 모듈은 «빠짐없이 남기기» 를 위해 document capture 를 쓴다. 그 힘
// 때문에 틀리면 (a) 조수와 무관한 클릭까지 삼켜 로그가 수십 배로 늘고, (b) 링버퍼가 넘쳐
// 정작 필요한 구간이 사라지고, (c) 최악으로는 입력을 가로채 기능을 죽인다. 특히 (c) 는
// 2026-08-19 에 전면 투명 레이어가 맵 클릭을 삼켜 P0 이 된 것과 같은 실패 방식이다.
describe("aiUiEventLog", () => {
  isolateTimers();
  function stubStorage(): void {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
  }
  describe("ai ui event log", () => {
    beforeEach(() => {
      stubStorage();
      resetAiUiEventLogForTest();
    });

    afterEach(() => {
      resetAiUiEventLogForTest();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("keeps at most 300 events and drops the oldest", () => {
      for (let index = 0; index < 320; index += 1) {
        recordAiUiEvent({ surface: "panel", action: `click:btn-${index}` });
      }
      const rows = listAiUiEvents();
      expect(rows).toHaveLength(300);
      expect(rows[0]?.action).toBe("click:btn-20");
      expect(rows.at(-1)?.action).toBe("click:btn-319");
    });

    it("slices a turn window by monotonic seq, not by index", () => {
      recordAiUiEvent({ surface: "panel", action: "click:before" });
      const marker = aiUiEventMarker();
      recordAiUiEvent({ surface: "panel", action: "click:during-1" });
      recordAiUiEvent({ surface: "context-panel", action: "context-compact" });
      expect(takeAiUiEventsSince(marker).map((event) => event.action)).toEqual([
        "click:during-1",
        "context-compact",
      ]);
      // 두 번 꺼내도 같은 구간이 나온다 — 소비가 아니라 조회다(턴 행 + ui 행이 둘 다 싣는다).
      expect(takeAiUiEventsSince(marker)).toHaveLength(2);
    });

    it("carries the detail payload that the click alone cannot tell", () => {
      recordAiUiEvent({
        surface: "context-panel",
        action: "context-compact",
        label: "context-compact",
        detail: { beforeTokens: 110_869, afterTokens: 21_004 },
      });
      expect(listAiUiEvents(1)[0]?.detail).toEqual({ beforeTokens: 110_869, afterTokens: 21_004 });
      expect(listAiUiEvents(1)[0]?.reason).toBe("사용자 클릭: context-compact");
    });

    it("flushes a batch to the sink and clears pending", () => {
      const seen: AiUiEvent[][] = [];
      setAiUiEventSink((events) => seen.push([...events]));
      recordAiUiEvent({ surface: "panel", action: "click:a" });
      recordAiUiEvent({ surface: "panel", action: "click:b" });
      flushAiUiEvents();
      expect(seen).toHaveLength(1);
      expect(seen[0]?.map((event) => event.action)).toEqual(["click:a", "click:b"]);
      flushAiUiEvents();
      expect(seen).toHaveLength(1); // 빈 flush 는 sink 를 부르지 않는다
    });

    it("survives a sink that throws — 기록이 앱을 죽이면 안 된다", () => {
      setAiUiEventSink(() => {
        throw new Error("remote down");
      });
      recordAiUiEvent({ surface: "panel", action: "click:a" });
      expect(() => flushAiUiEvents()).not.toThrow();
    });

    it("keeps the ring in memory when localStorage is unavailable", () => {
      vi.stubGlobal("localStorage", undefined);
      resetAiUiEventLogForTest();
      const marker = aiUiEventMarker();
      recordAiUiEvent({ surface: "panel", action: "click:a" });
      expect(listAiUiEvents().map((event) => event.action)).toEqual(["click:a"]);
      expect(takeAiUiEventsSince(marker)).toHaveLength(1);
    });

    describe("delegated capture", () => {
      class FakeElement {
        constructor(
          readonly matchList: readonly string[],
          readonly testid: string | null,
          readonly text = "",
        ) {}
        closest(selector: string): FakeElement | null {
          if (selector === "[data-testid]") return this.testid === null ? null : this;
          return this.matchList.includes(selector) ? this : null;
        }
        getAttribute(): string | null {
          return null;
        }
        get dataset(): { testid?: string } {
          return this.testid === null ? {} : { testid: this.testid };
        }
        get textContent(): string {
          return this.text;
        }
      }

      type Listener = (event: unknown) => void;

      function fakeDocument(): {
        readonly target: Parameters<typeof installAiUiEventCapture>[0];
        dispatch: (type: string, event: unknown) => void;
        readonly captureFlags: boolean[];
      } {
        const listeners = new Map<string, Listener[]>();
        const captureFlags: boolean[] = [];
        const target = {
          addEventListener: (type: string, listener: Listener, capture?: boolean) => {
            listeners.set(type, [...(listeners.get(type) ?? []), listener]);
            if (capture !== undefined) captureFlags.push(capture);
          },
          removeEventListener: (type: string, listener: Listener) => {
            listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
          },
          defaultView: null,
        };
        return {
          target: target as unknown as Parameters<typeof installAiUiEventCapture>[0],
          dispatch: (type, event) => (listeners.get(type) ?? []).forEach((listener) => listener(event)),
          captureFlags,
        };
      }

      it("records clicks inside AI surfaces and ignores everything else", () => {
        const doc = fakeDocument();
        // FakeElement 는 instanceof Element 를 통과하지 못하므로 전역 Element 를 갈아둔다.
        vi.stubGlobal("Element", FakeElement);
        installAiUiEventCapture(doc.target);

        doc.dispatch("click", {
          type: "click",
          target: new FakeElement([".ai-chat-panel"], "ai-send", "보내기"),
        });
        // 맵 캔버스는 계측 범위 밖이다 — AI 표면 선택자에 안 걸리므로 아무것도 남지 않아야 한다.
        doc.dispatch("click", {
          type: "click",
          target: new FakeElement([".map-canvas"], "map-canvas"),
        });
        // AI 표면 안이지만 testid 가 없으면 나중에 무엇이었는지 못 읽는다 — 남기지 않는다.
        doc.dispatch("click", {
          type: "click",
          target: new FakeElement([".ai-chat-panel"], null, "여백"),
        });

        const rows = listAiUiEvents();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.action).toBe("click:ai-send");
        expect(rows[0]?.surface).toBe("panel");
        expect(rows[0]?.label).toBe("보내기");
      });

      it("never calls preventDefault or stopPropagation — 읽기 전용 관찰자다", () => {
        const doc = fakeDocument();
        vi.stubGlobal("Element", FakeElement);
        installAiUiEventCapture(doc.target);
        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();
        const stopImmediatePropagation = vi.fn();
        doc.dispatch("click", {
          type: "click",
          target: new FakeElement([".ai-chat-panel"], "ai-send"),
          preventDefault,
          stopPropagation,
          stopImmediatePropagation,
        });
        expect(preventDefault).not.toHaveBeenCalled();
        expect(stopPropagation).not.toHaveBeenCalled();
        expect(stopImmediatePropagation).not.toHaveBeenCalled();
        // capture 단계로 붙는다(click/change 각각) — 그래서 삼키지 않는 것이 계약으로 중요하다.
        expect(doc.captureFlags.filter(Boolean).length).toBeGreaterThanOrEqual(2);
      });

      it("installs one listener set even when called twice", () => {
        const doc = fakeDocument();
        vi.stubGlobal("Element", FakeElement);
        installAiUiEventCapture(doc.target);
        installAiUiEventCapture(doc.target);
        doc.dispatch("click", {
          type: "click",
          target: new FakeElement([".ai-chat-panel"], "ai-send"),
        });
        expect(listAiUiEvents()).toHaveLength(1);
      });
    });

    it("resolves the narrowest surface first", () => {
      const inModal = {
        closest: (selector: string) =>
          selector === ".ai-history-window" || selector === ".ai-chat-panel" ? {} : null,
      } as unknown as Element;
      expect(resolveAiUiSurface(inModal)).toBe("history-modal");
      expect(resolveAiUiSurface(null)).toBeNull();
    });

    it("clears the buffer on demand", () => {
      recordAiUiEvent({ surface: "panel", action: "click:a" });
      clearAiUiEvents();
      expect(listAiUiEvents()).toHaveLength(0);
    });
  });
});

// test/approvalDestructiveOutcome.test.ts
// 결과 기반 파괴성 판정 — 2026-08-29 modify 진단 근본원인 9 회귀 가드.
//
// 옛 판정은 툴 **이름 목록**뿐이라, 승인 마찰이 정직한 수정에만 걸렸다:
//   "지우고 제대로 다시 놓는다"(remove_event 포함) → 체크박스 재승인 벽
//   "새 맵을 만들어 거기 짓는다"(기존 맵을 통째로 교체) → 마찰 0으로 즉시 적용
describe("approvalDestructiveOutcome", () => {
  isolateTimers();
  function diff(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
    return {
      tilesChanged: 0,
      eventsAdded: 0,
      eventsModified: 0,
      eventsRemoved: 0,
      mapsAdded: 0,
      mapsRemoved: 0,
      dbRecordsChanged: 0,
      tilesetsChanged: 0,
      switchesAdded: 0,
      variablesAdded: 0,
      worldEntitiesAdded: 0,
      worldEntitiesModified: 0,
      palettePresetsAdded: 0,
      palettePresetsModified: 0,
      endingsChanged: 0,
      sessionChanged: false,
      systemChanged: false,
      warnings: [],
      ...overrides,
    };
  }
  function call(name: string, overrides: Partial<ProposedCall> = {}): ProposedCall {
    return {
      name,
      args: {},
      summary: `${name} summary`,
      result: { ok: true, summary: `${name} summary` },
      destructive: false,
      ...overrides,
    };
  }
  describe("isDestructiveOutcome", () => {
    it("이름 목록은 종전대로 파괴로 본다", () => {
      for (const name of ["remove_event", "remove_map", "clear_region", "reset_project", "delete_resource", "delete_database_record"]) {
        expect(isDestructiveOutcome(name, {}, diff()), name).toBe(true);
      }
    });

    it("이름이 무해해도 diff 가 소실을 보고하면 파괴다", () => {
      expect(isDestructiveOutcome("run_interior_room_pipeline", {}, diff({ eventsRemoved: 3 }))).toBe(true);
      expect(isDestructiveOutcome("author_village", {}, diff({ mapsRemoved: 1 }))).toBe(true);
    });

    it("replaceExisting 옵트인은 diff 없이도 파괴다", () => {
      expect(isDestructiveOutcome("start_interior_room_session", { replaceExisting: true }, undefined)).toBe(true);
      // 플래그가 꺼져 있거나 없으면 판정에 영향이 없다.
      expect(isDestructiveOutcome("start_interior_room_session", { replaceExisting: false }, diff())).toBe(false);
      expect(isDestructiveOutcome("start_interior_room_session", {}, diff())).toBe(false);
    });

    it("추가만 하는 변경은 파괴가 아니다", () => {
      expect(isDestructiveOutcome("paint_tiles", {}, diff({ tilesChanged: 400 }))).toBe(false);
      expect(isDestructiveOutcome("place_npc", {}, diff({ eventsAdded: 2 }))).toBe(false);
      expect(isDestructiveOutcome("create_map", {}, diff({ mapsAdded: 1 }))).toBe(false);
    });

    it("diff 가 없으면(조회 툴 등) 파괴가 아니다", () => {
      expect(isDestructiveOutcome("get_map_region", {}, undefined)).toBe(false);
    });
  });
});

// 2026-09-17: "rejects fake approval with ordinary targetChange acceptance and … evidence" 삭제 — 검수 모델의 승인을
// 이미지 증거 부족(map-background-rendering-unavailable)으로 뒤집는 검증이었으나, 결정적 검사(lint error 0)에서
// 이미지 확인은 승인 조건이 아니고 검수 모델도 호출되지 않는다.
describe("assistantBackgroundReview", () => {
  isolateTimers();
  afterEach(() => vi.unstubAllGlobals());
  describe("background review evidence", () => {
    // 2026-10-22: 미리보기가 배경을 첫 프레임으로 그리게 되어(mapBackgroundPreview.ts) 배경 맵을 통째로 거부하지 않는다.
    // 그림을 못 읽은 배경은 지어내지 않고 라벨에 그 사실을 남긴다.
    it("does not refuse a background map and does not fabricate an unreadable background", async () => {
      const restore = installFakeDom();
      try {
        // This surface uses onerror properties; fakeDom's Image only dispatches listeners.
        vi.stubGlobal("Image", class {
          onerror: (() => void) | null = null;
          set src(_value: string) { this.onerror?.(); }
        });
        const project = createBlankProject(), map = project.maps[project.startMapId];
        map.background = { imageId: "missing-resource", scrollX: 4 };
        await renderToolImages(project, "show_map_region", {
          mapId: map.id, x: 0, y: 0, w: 1, h: 1, lower: [[-1]], upper: [[-1]],
        }).then(
          images => { for (const image of images) expect(image.label).toMatch(/배경 그림 missing-resource/); },
          error => expect(String(error)).not.toContain("map-background-rendering-unavailable"),
        );
      } finally { vi.unstubAllGlobals(); restore(); }
    });

    it.each(["image", "scroll", "remove"])("classifies %s background changes as visual and permanently retires old evidence", mutation => {
      const project = createBlankProject(), map = project.maps[project.startMapId];
      map.background = { imageId: "easyrpg-backdrop-dawn1", scrollX: 0 };
      const before = structuredClone(project), evidence = new AssistantImageEvidence();
      const receipt = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height });
      if (!receipt) throw new Error("Missing receipt");
      evidence.deliver([receipt]);
      if (mutation === "image") map.background.imageId = "easyrpg-backdrop-sky1";
      else if (mutation === "scroll") map.background.scrollX = 4;
      else delete map.background;
      expect(requiresVisualReview(before, project, map.id)).toBe(true);
      expect(evidence.current(project)).toEqual([]);
      expect(evidence.current(before)).toEqual([]);
    });

    it("classifies map tile size and legacy event sprites, but exempts dialogue and metadata edits", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      map.events.push({ id: "npc", x: 1, y: 1, sprite: { kind: "action" }, commands: [] });
      const beforeProject = structuredClone(project);
      map.name = "Renamed map";
      map.events[0].commands = [{ kind: "text", body: "Changed dialogue" }];
      expect(requiresVisualReview(beforeProject, project, map.id)).toBe(false);
      map.tileSize += 1;
      expect(requiresVisualReview(beforeProject, project, map.id)).toBe(true);
      map.tileSize = beforeProject.maps[map.id].tileSize;
      map.events[0].sprite = { type: "builtin", id: "replacement" };
      expect(requiresVisualReview(beforeProject, project, map.id)).toBe(true);
    });
  });
});

// 2026-09-17: 「independent review image budget」 세션 테스트 2건 삭제 — reviewCurrentDraft 가 검수 모델을
// 호출하지 않으므로(결정적 lint 검사만) 검수 이미지 봉투·과대 봉투 회복은 검증할 대상이 없다.
describe("assistantReviewImageBudget", () => {
  isolateTimers();
  const image = (dataUrl: string, label = "render") => ({ label, dataUrl });
  describe("reviewEvidenceImages", () => {
    it("ships one copy of a render captured twice", () => {
      const twice = [
        { mapId: "a", images: [image("data:image/png;base64,SAME")] },
        { mapId: "a", images: [image("data:image/png;base64,SAME")] },
      ];
      expect(reviewEvidenceImages(twice, new Set(["a"]))).toHaveLength(1);
    });

    it("keeps distinct renders of the same map", () => {
      const entries = [
        { mapId: "a", images: [image("data:image/png;base64,LEFT")] },
        { mapId: "a", images: [image("data:image/png;base64,RIGHT")] },
      ];
      expect(reviewEvidenceImages(entries, new Set(["a"]))).toHaveLength(2);
    });

    // The narrowing retry drops a map's before/after context; carrying its render anyway
    // costs the whole envelope without giving the reviewer anything to judge it against.
    it("drops renders of maps outside the reviewed set", () => {
      const entries = [
        { mapId: "changed", images: [image("data:image/png;base64,CHANGED")] },
        { mapId: "context", images: [image("data:image/png;base64,CONTEXT")] },
      ];
      const kept = reviewEvidenceImages(entries, new Set(["changed"]));
      expect(kept.map(({ dataUrl }) => dataUrl)).toEqual(["data:image/png;base64,CHANGED"]);
    });
  });
});
