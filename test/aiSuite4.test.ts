import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { configForLegacySupervisor } from "@/ai/ultrabrainConfig";
import { defaultAiConfig, configForLiteModel, type AiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { configForRole, modelForRole, parseRoleModels } from "@/ai/modelRoles";
import { ORCHESTRATOR_SYSTEM_PROMPT, buildDefaultWorkPlan, buildOrchestratorUserPayload, workPlanFromOrchestratorDecision, type WorkPlan, completeWorkItemById, openWorkItemIds } from "@/ai/workPlan";
import { detectNarrativeHorrorGenre, requiredSuccessToolsForUserText } from "@/ai/narrativeHorrorWorkPlan";
import { type ProposedCall, AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { overInsertionNotice, reviewOverInsertion } from "@/ai/overInsertionReview";
import { type ToolResult, activeTools, runTool, toOpenAiTools } from "@/editor/tools";
import type { ChangeSummary, Command } from "@/project/types";
import { defaultFreezeGuard } from "@/ai/pageFreezeGuard";
import { planRequiredToolSchemas, mentionedToolSchemas, planRequiredToolNames } from "@/ai/planToolExposure";
import { createBlankProject } from "@/project/defaults";
import { applyAssistantEngine, assistantEngineLead } from "../src/ai/localCliEngine";
import { CLAUDE_SUBSCRIPTION_ENGINE, configForPlanAccount, planCandidates } from "../src/ai/planDefaults";
import { buildDistillUserPayload, DISTILL_SYSTEM_PROMPT, distillPreferences, formatCountersForDistill, formatPendingForDistill, parseDistillResponse } from "@/ai/preferenceDistiller";
import { loadPreferenceFacts, savePreferenceFacts, type PreferenceFact, buildPreferenceMemorySection, buildPreferenceMemorySectionFrom, clearPreferenceFacts, comparePreferenceRank, deletePreferenceFact, dropPreferenceFactsUnpinned, evictOverLimit, GLOBAL_PREFERENCE_LIMIT, listPreferenceFacts, normalizePreferenceText, PREFERENCE_MEMORY_STORAGE_KEY, PREFERENCE_PRECEDENCE_LINE, PREFERENCE_PROJECT_SUBHEADING, PREFERENCE_SECTION_HEADING, PREFERENCE_SECTION_MAX_CHARS, PREFERENCE_SECTION_MAX_LINES, PREFERENCE_TEXT_MAX_CHARS, PROJECT_PREFERENCE_LIMIT, setPreferenceFactPinned, upsertPreferenceFact, upsertPreferenceFactIn } from "@/ai/preferenceMemory";
import { DISTILL_FAILURE_LIMIT, loadPreferenceSignals, savePreferenceSignals, UNDO_WEIGHT, type PendingPreferenceSignal, type PreferenceSignalState, clearPreferenceSignals, containsCorrectionCue, containsStatedPreferenceCue, consumePendingSignals, CORRECTION_CUES, CORRECTION_WEIGHT, CORRECTION_WINDOW_MS, counterKeysForTurn, DISTILL_PENDING_THRESHOLD, emptyPreferenceSignalState, noteAiChangeUndone, notePreferenceDistillFailure, noteUndoIn, observeTurn, observeTurnIn, PENDING_SIGNAL_LIMIT, PENDING_TEXT_MAX_CHARS, PREFERENCE_SIGNALS_STORAGE_KEY, SETTLED_WEIGHT, shouldDistillPreferences, STATED_PREFERENCE_CUES } from "@/ai/preferenceSignals";
import { resolveProposalApplyMode } from "@/ai/approvalPolicy";
import { isQuotaOrRateLimitError, lowestRemaining, quotaFailureCopy, usageChipSuffix, usageDetail, type ProviderUsageSnapshot } from "@/ai/providerQuota";
import { EMPTY_SESSION_USAGE, addSessionUsage } from "@/ai/sessionUsage";
import { buildRunRecap, extractRunProcess, formatElapsedMs, formatRunRecapPlayerLine, parseRunRecapPayload, serializeRunRecap, usageDelta } from "@/ai/runRecap";
import { buildStampPlannerUserPayload, buildStampRepairPrompt, clampRectToTarget, classifyFastPathCommand, FAST_PATH_QUEST_OR_EVENT_GUIDANCE, parseStampPlan, STAMP_MAX_STEPS, validateStampStep, type StampPlanFacts } from "@/ai/stampPlanner";
import { AGENT_UX_POLICY_LINES } from "@/ai/promptPolicies";
import { composeSystemPrompt, type AiSurface } from "@/ai/systemPromptEnvelope";
import { isolateTimers } from "./mergedTeardown";
import { CALIBRATION_CLAMP_MAX_RATIO, CALIBRATION_CLAMP_MIN_RATIO, CALIBRATION_WINDOW, DEFAULT_CHARS_PER_TOKEN, TOKEN_CALIBRATION_STORAGE_KEY, calibratedBudgetChars, charsPerTokenEstimate, estimatePromptChars, loadTokenObservations, recordTokenObservation, saveTokenObservations, type TokenObservation } from "@/ai/tokenBudget";
import { DEFAULT_BUDGET_CHARS } from "@/ai/contextBuilder";
import { createTurnTiming } from "@/ai/turnTiming";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { crossMapVerification } from "./fixtures/verificationOwnership";
import { fixedDeclarer } from "./intentFixture";
import { defaultYieldToUi, YIELD_TO_UI_FALLBACK_MS } from "@/ai/yieldToUi";

describe("runRecap", () => {
  isolateTimers();
  describe("modelRoles", () => {
    isolateTimers();
    describe("independent specialist selections", () => {
      it("migrates old writer/executor selections without changing explicit model ids", () => {
        // An old save has no per-role slots; the factory default seeds every role slot (gemini-4-argon since #2535, claude-opus-5-5 since 2026-11-16, gpt-6.2-sol since 2026-11-19, claude-sonnet-5-5 since 2026-11-23).
        const { roleModels: _factoryRoleSlots, ...factory } = defaultAiConfig();
        const config = { ...factory, model: "custom-writer", liteModel: "custom-deep" };
        expect(modelForRole(config, "writer").model).toBe("custom-writer");
        expect(modelForRole(config, "deep").model).toBe("custom-deep");
        expect(modelForRole(config, "vision").model).toBe("custom-writer");
      });
      it("keeps role provider, model and effort independent of legacy settings and autonomy", () => {
        const roleModels = parseRoleModels({ vision: { provider: "openai-codex", model: "future-vision", thinkingLevel: "high" } });
        expect(configForRole({ ...defaultAiConfig(), providerId: "google-antigravity", reasoningEffort: "off", roleModels }, "vision"))
          .toMatchObject({ providerId: "openai-codex", model: "future-vision", reasoningEffort: "high", apiKey: "" });
        const config = { ...defaultAiConfig(), roleModels: { ...roleModels, deep: { provider: "openai-codex", model: "deep-selected", thinkingLevel: "high" as const } } };
        expect(resolveSurfaceAiConfig("tileset-analysis", config)).toMatchObject({ model: "future-vision", providerId: "openai-codex", reasoningEffort: "high" });
        // 고르지 않은 칸은 공장 기본(ChatGPT GPT-6.2 Sol · high, 2026-11-28) 그대로다 — 고른 칸(vision·deep)의 모델을 따라가지 않는다.
        expect(resolveSurfaceAiConfig("structure-kit", config)).toMatchObject({ model: "gpt-6.2-sol", providerId: "openai-codex" });
        expect(resolveSurfaceAiConfig("region", config)).toMatchObject({ model: "deep-selected", reasoningEffort: "high" });
        expect(configForLiteModel(config)).toMatchObject({ providerId: "openai-codex", model: "deep-selected", reasoningEffort: "high" });
        expect(configForLegacySupervisor(config)).toMatchObject({ providerId: "openai-codex", model: "gpt-6.2-sol", reasoningEffort: "high", maxTokens: config.maxTokens });
        expect(parseRoleModels({ deep: { model: "", provider: 4 }, writer: null })).toEqual({});
      });
    });
  });
  describe("narrativeHorrorRouting", () => {
    isolateTimers();
    describe("narrative/horror successTools routing", () => {
      it("detects moon / witch / ib genres", () => {
        expect(detectNarrativeHorrorGenre("투더문 회상 컷신")).toBe("moon-cutscene");
        expect(detectNarrativeHorrorGenre("마녀의 집 트랩 호러")).toBe("witch-horror");
        expect(detectNarrativeHorrorGenre("이브 갤러리 조사 퍼즐")).toBe("ib-gallery");
      });

      it("maps genres to template successTools", () => {
        expect(requiredSuccessToolsForUserText("회상 스토리 엔딩")).toEqual(["script_cutscene_preset"]);
        expect(requiredSuccessToolsForUserText("저택 트랩 추격")).toEqual(["make_horror_loop"]);
        expect(requiredSuccessToolsForUserText("미술관 갤러리 조사")).toEqual(["make_gallery_room"]);
      });

      it("fallback work plan pins template tools for gallery intent", () => {
        const plan = buildDefaultWorkPlan("이브 갤러리 조사 호러 10분 슬라이스");
        const item = plan.layers[0]!.items[0]!;
        expect(item.successTools).toContain("make_gallery_room");
        expect(item.instruction).toContain("make_gallery_room");
      });

      it("planner system prompt requires narrative/horror successTools", () => {
        expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("script_cutscene_preset");
        expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("make_horror_loop");
        expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("make_gallery_room");
      });
    });
  });
  describe("overInsertionReview", () => {
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
      const result: ToolResult = { ok: true, summary: name, diff: diff() };
      return { name, args: {}, summary: name, result, destructive: false, ...overrides };
    }
    describe("reviewOverInsertion", () => {
      it("일반 1건 타일 쓰기는 검토 없이 통과한다", () => {
        const paint = call("paint_tiles", {
          result: { ok: true, summary: "paint", diff: diff({ tilesChanged: 12 }) },
        });
        const review = reviewOverInsertion({ calls: [paint], beforeMapCount: 1, afterMapCount: 1 });
        expect(review.needsReview).toBe(false);
      });

      it("파괴성 호출은 검토를 강제하고 destructive를 올린다", () => {
        const review = reviewOverInsertion({
          calls: [call("remove_event", { destructive: true })],
          beforeMapCount: 1,
          afterMapCount: 1,
        });
        expect(review.needsReview).toBe(true);
        expect(review.destructive).toBe(true);
      });

      it("승인 메타데이터만으로는 검토를 강제하지 않는다", () => {
        const review = reviewOverInsertion({
          calls: [call("propose_tile_vocabulary", { requiresApproval: true, approvalWarning: "재료 합의" })],
          beforeMapCount: 1,
          afterMapCount: 1,
        });
        expect(review.needsReview).toBe(false);
        expect(review.destructive).toBe(false);
      });

      it("이벤트 대량 추가는 검토를 강제한다", () => {
        const review = reviewOverInsertion({
          calls: [call("place_npc", {
            result: { ok: true, summary: "npc", diff: diff({ eventsAdded: 10 }) },
          })],
          beforeMapCount: 1,
          afterMapCount: 1,
        });
        expect(review.needsReview).toBe(true);
        expect(review.destructive).toBe(false);
      });

      it("새 맵 추가와 대량 쓰기는 검토를 강제한다", () => {
        const fresh = reviewOverInsertion({
          calls: [call("create_map")],
          beforeMapCount: 1,
          afterMapCount: 2,
        });
        expect(fresh.needsReview).toBe(true);
        const mass = reviewOverInsertion({
          calls: Array.from({ length: 6 }, (_, i) => call("paint_tiles", {
            result: { ok: true, summary: `p${i}`, diff: diff({ tilesChanged: 10 }) },
          })),
          beforeMapCount: 1,
          afterMapCount: 1,
        });
        expect(mass.needsReview).toBe(true);
      });

      it("공지 페이로드는 파괴 여부에 따라 제목을 바꾼다", () => {
        expect(overInsertionNotice({
          calls: [call("reset_project", { destructive: true })],
          beforeMapCount: 1,
          afterMapCount: 1,
        }).title).toContain("파괴");
      });
    });
  });
  describe("pageFreezeGuard", () => {
    isolateTimers();
    /** 실제 Web Locks 계약을 흉내낸다: 콜백이 끝날 때까지 락을 쥔다. */
    function fakeLocks() {
      const held = new Set<string>();
      const seen: string[] = [];
      return {
        held,
        seen,
        api: {
          request: async (name: string, callback: () => Promise<unknown>): Promise<void> => {
            held.add(name);
            seen.push(name);
            try {
              await callback();
            } finally {
              held.delete(name);
            }
          },
        },
      };
    }
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    };
    afterEach(() => {
      vi.unstubAllGlobals();
    });
    describe("defaultFreezeGuard", () => {
      it("가드가 살아 있는 동안 Web Lock 을 쥐고 있다", async () => {
        const locks = fakeLocks();
        vi.stubGlobal("navigator", { locks: locks.api });

        const release = await defaultFreezeGuard();

        expect(locks.held.size).toBe(1);
        release();
        await flush();
        expect(locks.held.size).toBe(0);
      });

      it("release 를 여러 번 불러도 터지지 않고 한 번만 놓는다", async () => {
        const locks = fakeLocks();
        vi.stubGlobal("navigator", { locks: locks.api });

        const release = await defaultFreezeGuard();
        release();
        release();
        await flush();

        expect(locks.held.size).toBe(0);
        expect(locks.seen).toHaveLength(1);
      });

      it("동시에 두 턴이 돌아도 서로를 막지 않는다", async () => {
        const locks = fakeLocks();
        vi.stubGlobal("navigator", { locks: locks.api });

        // 같은 이름이면 두 번째 request 가 첫 번째 해제까지 대기해 턴이 멈춘다.
        const first = await defaultFreezeGuard();
        const second = await defaultFreezeGuard();

        expect(locks.held.size).toBe(2);
        expect(new Set(locks.seen).size).toBe(2);
        first();
        second();
        await flush();
        expect(locks.held.size).toBe(0);
      });

      it("Web Locks 가 없는 환경(Node·구 브라우저)에서는 조용히 통과한다", async () => {
        vi.stubGlobal("navigator", undefined);

        const release = await defaultFreezeGuard();

        expect(() => release()).not.toThrow();
      });

      it("락 획득이 실패해도 턴을 깨지 않는다", async () => {
        vi.stubGlobal("navigator", {
          locks: { request: () => Promise.reject(new Error("lock denied")) },
        });

        const release = await defaultFreezeGuard();

        expect(() => release()).not.toThrow();
      });

      it("락을 잡는 데 오래 걸려도 턴 시작을 막지 않는다", async () => {
        // 획득을 영원히 지연시키는 구현. 가드는 keep-alive 일 뿐이라 턴을 볼모로 잡으면 안 된다.
        vi.stubGlobal("navigator", { locks: { request: () => new Promise<void>(() => {}) } });

        const release = await Promise.race([
          defaultFreezeGuard(),
          new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
        ]);

        expect(release).not.toBe("timeout");
      });
    });
  });
  describe("paintToolExposure", () => {
    isolateTimers();
    describe("precise tile painting is an active capability", () => {
      it("exposes the required paint operation instead of substituting semantic fill", () => {
        const plan = workPlanFromOrchestratorDecision({
          action: "new_plan", goal: "Paint a verified atlas tile",
          layers: [{ title: "Terrain", items: [{ title: "Paint", instruction: "Paint the inspected tile", successTools: ["paint_tiles"] }] }],
        });
        expect(planRequiredToolSchemas(plan).map(tool => tool.function.name)).toContain("paint_tiles");
        expect(toOpenAiTools().map(tool => tool.function.name)).toContain("paint_tiles");
        expect(activeTools().some(tool => tool.name === "fill_region")).toBe(true);
      });

      it("can paint actual atlas cells on a blank map", () => {
        const context = { project: createBlankProject() };
        const mapId = context.project.startMapId;
        // 새 프로젝트 기본 칩셋은 바뀐다(EasyRPG 눈 칸 67 → 버들항, #1789) — 고정 지형 값 대신 칠한 칸이 그대로 남는지 본다.
        const tile = 5;
        const result = runTool(context, "paint_tiles", {
          mapId, layer: "lower", mode: "rect", tile, from: { x: 2, y: 2 }, to: { x: 8, y: 8 },
        });
        expect(result.ok, result.summary).toBe(true);
        const painted = context.project.maps[mapId];
        expect(painted.lowerTiles[4 * painted.width + 4]).toBe(tile);
        expect(painted.lowerTiles[1 * painted.width + 1]).not.toBe(tile);
      });

      it("does not advertise hidden legacy names as canonical planner capabilities", () => {
        const payload = buildOrchestratorUserPayload({ userText: "Inspect the map", activePlan: null });
        expect(payload).not.toContain("clear_region");
        expect(payload).toContain("paint_tiles");
      });
    });
  });
  describe("planDefaults", () => {
    isolateTimers();
    const cli = (id: "claude" | "codex" | "gemini", state: string, billing: string) => ({ id, state, billing });
    const oauth = (providerId: string, extra: Record<string, unknown> = {}) => ({ providerId, connected: true, authKind: "oauth", ...extra });
    describe("first-run plan defaults", () => {
      it("orders ChatGPT (the default, owner decision 2026-11-28), then Claude, then the rest, one card per plan", () => {
        const plans = planCandidates(
          [cli("gemini", "ready", "subscription"), cli("codex", "ready", "subscription"), cli("claude", "ready", "subscription")],
          [oauth("openai-codex"), oauth("google-antigravity")],
        );
        expect(plans.map((plan) => plan.key)).toEqual(["codex-cli", "claude-cli", "gemini-cli"]);
        expect(planCandidates([cli("gemini", "ready", "subscription"), cli("claude", "ready", "subscription")], []).map((plan) => plan.key)).toEqual(["claude-cli", "gemini-cli"]);
      });

      it("gives a ChatGPT subscription Sol high alone and a Claude subscription Sonnet 5.5 high alone", () => {
        const [codex, claude] = planCandidates([cli("claude", "ready", "subscription"), cli("codex", "ready", "subscription")], []);
        expect(codex?.kind === "local-cli" && codex.engine).toMatchObject({ cli: "codex", routineModel: "gpt-6.2-sol", deepModel: "gpt-6.2-sol", effort: "high" });
        expect(codex?.kind === "local-cli" && assistantEngineLead(codex.engine)).toBeUndefined();
        expect(claude?.kind === "local-cli" && claude.engine).toEqual({ kind: "local-cli", cli: "claude", routineModel: "claude-sonnet-5-5", deepModel: "claude-sonnet-5-5", effort: "high" });
        expect(claude?.kind === "local-cli" && assistantEngineLead(claude.engine)).toBeUndefined();
        expect(claude?.setup).toBe("Sonnet 5.5 하나가 계획부터 만들기까지 해요.");
        expect(applyAssistantEngine({ model: "x" }, CLAUDE_SUBSCRIPTION_ENGINE)).toMatchObject({
          providerId: "local-cli:claude", model: "claude-sonnet-5-5", liteModel: "claude-sonnet-5-5",
          ultrabrainProviderId: "local-cli:claude", ultrabrainModel: "claude-sonnet-5-5", ultrabrainReasoningEffort: "high",
          roleModels: Object.fromEntries(["deep", "build", "writer", "vision"].map((role) => [role, { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" }])),
          pixelModel: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" },
        });
      });

      it("skips API-key logins, env keys, expired and missing logins", () => {
        expect(planCandidates(
          [cli("claude", "ready", "api"), cli("codex", "login-required", "unknown"), cli("gemini", "not-installed", "unknown")],
          [oauth("openai-codex", { env: true }), oauth("google-antigravity", { expired: true }), oauth("openai-codex", { authKind: "apiKey" })],
        )).toEqual([]);
      });

      it("falls back to an in-app ChatGPT login when the Codex CLI is not signed in", () => {
        expect(planCandidates([], [oauth("openai-codex")]).map((plan) => plan.key)).toEqual(["codex-account"]);
        const next = configForPlanAccount<Parameters<typeof configForPlanAccount>[0]>({ providerId: "openai-codex", model: "gpt-6.1-sol", roleModels: { writer: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" } }, modelSelectionOverrides: { vision: true } }, "openai-codex");
        expect(next.model).toBe("gpt-6.2-sol");
        expect(next.ultrabrainModel).toBe("gpt-6.2-sol");
        expect(next.ultrabrainReasoningEffort).toBe("high");
        expect(next.roleModels?.writer?.model).toBe("gpt-6.2-sol");
        expect(next.roleModels?.vision).toBeUndefined();
      });

      it("still gives a lead to a user who splits the models in settings, and drops it once they merge them", () => {
        // 나누기는 기본이 아니지만 설정에서 고를 수 있다(Opus 팀장 + Haiku 워커는 2026-11-16 까지의 기본이었다).
        const split = { ...CLAUDE_SUBSCRIPTION_ENGINE, routineModel: "claude-haiku-5-5", deepModel: "claude-opus-5-5", teamLead: true };
        expect(assistantEngineLead(split)).toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" });
        expect(assistantEngineLead({ ...split, deepModel: split.routineModel })).toBeUndefined();
        expect(assistantEngineLead({ ...split, teamLead: false })).toBeUndefined();
      });
    });
  });
  // test/planToolExposure.test.ts
  // 자율 런 계획 요구 툴 노출 — 도메인 게이트·40툴 상한과 무관하게 successTools/지시문 툴을 보장.
  describe("planToolExposure", () => {
    isolateTimers();
    function plan(items: Array<{ successTools?: readonly string[]; instruction?: string }>): WorkPlan {
      return {
        id: "wp_test",
        goal: "새 RPG 프로젝트를 만들어줘: plan_world로 시작, play_walkthrough로 검증. 프로젝트 제목: '자율 마을의 전설'.",
        createdAt: "2026-08-14T00:00:00.000Z",
        layers: [
          {
            id: "L1",
            title: "세계",
            items: items.map((item, index) => ({
              id: `L1-${index}`,
              title: `항목 ${index}`,
              instruction: item.instruction ?? "지시문",
              ...(item.successTools ? { successTools: item.successTools } : {}),
              status: "pending",
            })),
          },
        ],
      };
    }
    describe("planRequiredToolNames", () => {
      it("successTools 를 모두 수집한다", () => {
        const names = planRequiredToolNames(
          plan([
            { successTools: ["plan_world", "set_session_start"] },
            { successTools: ["build_village", "author_house"] },
            { successTools: ["verify_quest", "play_walkthrough"] },
          ]),
        );
        for (const want of ["plan_world", "set_session_start", "build_village", "author_house", "verify_quest", "play_walkthrough"]) {
          expect(names).toContain(want);
        }
      });

      it("지시문에 적힌 툴 이름도 수집한다(부분 문자열 오탐 없음)", () => {
        const names = planRequiredToolNames(
          plan([
            { instruction: "set_encounter_table + upsert_enemy/upsert_troop 5종을 만든다" },
            // author_village 는 2026-10-07 저작권 정리로 삭제돼 레지스트리에 없다 — 지금 있는 place_props 로 본다.
            { instruction: "place_props 를 호출한다" },
          ]),
        );
        expect(names).toContain("set_encounter_table");
        expect(names).toContain("upsert_enemy");
        expect(names).toContain("upsert_troop");
        expect(names).toContain("place_props");
        // "props" 단독 토큰은 툴이 아니다 — place_props 와 혼동하지 않는다.
        expect(names).not.toContain("props");
      });

      it("목표문에 적힌 툴도 수집한다", () => {
        const names = planRequiredToolNames(plan([{ instruction: "아무것도 안 함" }]));
        expect(names).toContain("plan_world");
        expect(names).toContain("play_walkthrough");
      });

      it("중복을 제거한다", () => {
        const names = planRequiredToolNames(
          plan([
            { successTools: ["plan_world"], instruction: "plan_world 로 시작" },
            { successTools: ["plan_world"] },
          ]),
        );
        expect(names.filter((n) => n === "plan_world")).toHaveLength(1);
      });
    });
    describe("planRequiredToolSchemas", () => {
      it("레지스트리에 존재하는 툴만 스키마로 변환한다", () => {
        const schemas = planRequiredToolSchemas(
          plan([
            { successTools: ["plan_world", "no_such_tool_xyz", "play_walkthrough"] },
          ]),
        );
        const names = schemas.map((s) => s.function.name);
        expect(names).toContain("plan_world");
        expect(names).toContain("play_walkthrough");
        expect(names).not.toContain("no_such_tool_xyz");
        for (const schema of schemas) {
          expect(schema.type).toBe("function");
          expect(schema.function.parameters.type).toBe("object");
        }
      });

      it("deprecated 툴은 supersededBy 로 대체해 노출한다", () => {
        // show_tiles 는 deprecated + supersededBy=tile_query — 계획이 옛 이름을 요구해도 대체 도구가 노출된다.
        // (build_village→author_village 짝은 2026-10-07 저작권 정리로 둘 다 삭제됐다.)
        const schemas = planRequiredToolSchemas(plan([{ successTools: ["show_tiles"] }]));
        const names = schemas.map((s) => s.function.name);
        expect(names).toContain("tile_query");
        expect(names).not.toContain("show_tiles");
        for (const schema of schemas) {
          expect(schema.type).toBe("function");
          expect(schema.function.description.length).toBeGreaterThan(0);
        }
      });
    });
    describe("mentionedToolSchemas", () => {
      it("사용자가 정확히 지목한 활성 도구는 도메인 상한과 무관하게 스키마로 복원한다", () => {
        const schemas = mentionedToolSchemas(
          "먼저 get_event로 읽고 set_shop_stock으로 재고를 고쳐. get_events_extra는 도구가 아니다.",
        );
        const names = schemas.map((schema) => schema.function.name);

        expect(names).toContain("get_event");
        expect(names).toContain("set_shop_stock");
        expect(names).not.toContain("get_events_extra");
      });
    });
  });
  // test/preferenceDistiller.test.ts
  // 증류 계약. 이 단계는 fire-and-forget 경로에서 불리므로 **어떤 실패도 throw 하지 않아야** 한다.
  // 파싱 실패가 조용히 무변경으로 끝나는지, 고정 항목이 drop 을 면제받는지, 연속 실패가 큐를
  // 막지 않는지가 핵심이다.
  describe("preferenceDistiller", () => {
    isolateTimers();
    const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    function createMemoryStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      };
    }
    const CONFIG: AiConfig = {
      authMode: "chatgpt",
      baseUrl: "https://example.invalid/v1",
      model: "test-model",
      apiKey: "",
      maxToolCalls: 8,
      maxTokens: 4096,
    };
    function undoSignal(index: number): PendingPreferenceSignal {
      return { at: index, kind: "undo", instruction: `마을을 크게 만들어 줘 ${index}`, toolNames: ["author_house"], weight: UNDO_WEIGHT };
    }
    function statedSignal(): PendingPreferenceSignal {
      return { at: 1, kind: "stated", instruction: "항상 마을은 작게 만들어 줘", note: "항상 마을은 작게 만들어 줘", toolNames: [], weight: 0 };
    }
    function seedSignals(pending: readonly PendingPreferenceSignal[], extra: Partial<PreferenceSignalState> = {}): void {
      savePreferenceSignals({
        counters: { "tool:author_house": { pos: 1, neg: 6, at: 10 }, "scale:large": { pos: 0, neg: 6, at: 10 } },
        pending: [...pending],
        lastTurn: null,
        distillFailures: 0,
        ...extra,
      });
    }
    function chatReturning(content: string): (config: AiConfig, req: ChatRequest) => Promise<ChatResult> {
      return () => Promise.resolve({ message: { role: "assistant", content } } as ChatResult);
    }
    beforeEach(() => {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: createMemoryStorage(),
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
      if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
        return;
      }
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    describe("시스템 프롬프트", () => {
      it("JSON 전용과 형식·상한을 명시한다", () => {
        expect(DISTILL_SYSTEM_PROMPT).toContain("JSON 객체 하나");
        expect(DISTILL_SYSTEM_PROMPT).toContain("\"upsert\"");
        expect(DISTILL_SYSTEM_PROMPT).toContain("\"drop\"");
        expect(DISTILL_SYSTEM_PROMPT).toContain("최대 3건");
        // 통계 문장이 성향으로 새어 나가면 프롬프트가 숫자만 늘고 행동이 안 바뀐다.
        expect(DISTILL_SYSTEM_PROMPT).toContain("툴 이름·횟수는 text 에 넣지 않습니다");
      });
    });
    describe("입력 조립", () => {
      it("집계는 부정 우세 순으로 보여 준다", () => {
        const state: PreferenceSignalState = {
          counters: {
            "tool:a": { pos: 5, neg: 0, at: 1 },
            "tool:b": { pos: 0, neg: 7, at: 2 },
            "tool:zero": { pos: 0, neg: 0, at: 3 },
          },
          pending: [],
          lastTurn: null,
          distillFailures: 0,
        };
        const formatted = formatCountersForDistill(state);
        expect(formatted.indexOf("tool:b")).toBeLessThan(formatted.indexOf("tool:a"));
        // 아무 신호도 없는 축은 토큰만 먹는다.
        expect(formatted).not.toContain("tool:zero");
      });

      it("집계가 없으면 없다고 말한다", () => {
        expect(formatCountersForDistill({ counters: {}, pending: [], lastTurn: null, distillFailures: 0 })).toBe("(집계 없음)");
      });

      it("신호 원문에 종류 라벨과 반응이 함께 실린다", () => {
        const formatted = formatPendingForDistill({
          counters: {},
          pending: [statedSignal(), { at: 2, kind: "correction", instruction: "크게 만들어 줘", note: "아니 너무 크다", toolNames: [], weight: -2 }],
          lastTurn: null,
          distillFailures: 0,
        });
        expect(formatted).toContain("[사용자 선언]");
        expect(formatted).toContain("[정정]");
        expect(formatted).toContain("반응: 아니 너무 크다");
      });

      it("이미 기억된 성향을 id 와 함께 넘긴다 — 그래야 모델이 drop 대상을 지목할 수 있다", () => {
        savePreferenceFacts([
          {
            id: "pref-1",
            text: "마을은 크게 만든다",
            scope: "global",
            strength: "medium",
            evidence: 2,
            source: "observed",
            updatedAt: 1,
          },
          {
            id: "pref-other",
            text: "남의 프로젝트 사실",
            scope: "project",
            projectScopeKey: "local:B::m1",
            strength: "weak",
            evidence: 1,
            source: "observed",
            updatedAt: 1,
          },
        ]);
        const payload = buildDistillUserPayload(
          { counters: {}, pending: [undoSignal(1)], lastTurn: null, distillFailures: 0 },
          "local:A::m1",
        );
        expect(payload).toContain("pref-1");
        expect(payload).not.toContain("pref-other");
      });
    });
    describe("응답 파싱", () => {
      it("맨 JSON 을 읽는다", () => {
        const parsed = parseDistillResponse('{"upsert":[{"text":"작게","scope":"global","strength":"strong"}],"drop":["x"]}');
        expect(parsed).toEqual({ upsert: [{ text: "작게", scope: "global", strength: "strong" }], drop: ["x"] });
      });

      it("코드펜스가 섞여도 건져낸다", () => {
        const parsed = parseDistillResponse("설명\n```json\n{\"upsert\":[],\"drop\":[]}\n```\n끝");
        expect(parsed).toEqual({ upsert: [], drop: [] });
      });

      it("upsert 는 3건으로 자른다", () => {
        const many = JSON.stringify({
          upsert: Array.from({ length: 6 }, (_, index) => ({ text: `성향 ${index}`, scope: "global", strength: "weak" })),
        });
        expect(parseDistillResponse(many)?.upsert).toHaveLength(3);
      });

      it("모양이 어긋난 항목과 값은 걸러지거나 안전한 기본으로 떨어진다", () => {
        const parsed = parseDistillResponse(
          JSON.stringify({ upsert: [{ text: "  " }, null, { text: "좋음", scope: "nope", strength: "nope" }], drop: ["ok", 5, ""] }),
        );
        expect(parsed?.upsert).toEqual([{ text: "좋음", scope: "global", strength: "weak" }]);
        expect(parsed?.drop).toEqual(["ok"]);
      });

      it("JSON 이 아니면 null", () => {
        expect(parseDistillResponse("성향을 정리했습니다.")).toBeNull();
        expect(parseDistillResponse("{깨진")).toBeNull();
        expect(parseDistillResponse("")).toBeNull();
      });
    });
    describe("증류 실행", () => {
      it("신호가 없으면 모델을 부르지 않는다", async () => {
        const chat = vi.fn(chatReturning("{}"));
        const result = await distillPreferences({ chat, config: CONFIG });
        expect(result).toEqual({ ok: false, upserted: 0, dropped: 0, skipped: "no-signals" });
        expect(chat).not.toHaveBeenCalled();
      });

      it("트리거 조건 미달이면 건너뛴다", async () => {
        seedSignals([undoSignal(1), undoSignal(2)]);
        const chat = vi.fn(chatReturning("{}"));
        const result = await distillPreferences({ chat, config: CONFIG });
        expect(result.skipped).toBe("not-due");
        expect(chat).not.toHaveBeenCalled();
      });

      it("force 는 조건을 무시한다", async () => {
        seedSignals([undoSignal(1)]);
        const chat = vi.fn(chatReturning('{"upsert":[],"drop":[]}'));
        const result = await distillPreferences({ chat, config: CONFIG, force: true });
        expect(result.ok).toBe(true);
        expect(chat).toHaveBeenCalledTimes(1);
      });

      it("명시 선언 1건이면 즉시 돌고 성향을 저장한다", async () => {
        seedSignals([statedSignal()]);
        const chat = vi.fn(chatReturning('{"upsert":[{"text":"마을은 집 4채 이하로 작게 유지한다","scope":"global","strength":"strong"}],"drop":[]}'));
        const result = await distillPreferences({ chat, config: CONFIG });
        expect(result).toEqual({ ok: true, upserted: 1, dropped: 0 });
        const facts = loadPreferenceFacts();
        expect(facts).toHaveLength(1);
        expect(facts[0].text).toBe("마을은 집 4채 이하로 작게 유지한다");
        expect(facts[0].strength).toBe("strong");
        // 소비한 신호는 비워져 같은 신호로 두 번 증류하지 않는다.
        expect(loadPreferenceSignals().pending).toEqual([]);
      });

      it("JSON 전용 요청 형식으로 부른다", async () => {
        seedSignals([statedSignal()]);
        const chat = vi.fn(chatReturning('{"upsert":[],"drop":[]}'));
        await distillPreferences({ chat, config: CONFIG });
        const [config, request] = chat.mock.calls[0];
        expect(config).toBe(CONFIG);
        expect(request.response_format).toEqual({ type: "json_object" });
        expect(request.messages[0]).toEqual({ role: "system", content: DISTILL_SYSTEM_PROMPT });
        expect(request.messages[1].role).toBe("user");
      });

      it("고정된 성향은 drop 에서 무시된다", async () => {
        const pinned: PreferenceFact = {
          id: "pinned-1",
          text: "사용자가 고정한 성향",
          scope: "global",
          strength: "strong",
          evidence: 3,
          source: "manual",
          updatedAt: 1,
          pinned: true,
        };
        const loose: PreferenceFact = { ...pinned, id: "loose-1", text: "관측 성향", source: "observed", pinned: false };
        savePreferenceFacts([pinned, loose]);
        seedSignals([statedSignal()]);
        const chat = chatReturning('{"upsert":[],"drop":["pinned-1","loose-1"]}');
        const result = await distillPreferences({ chat, config: CONFIG });
        expect(result.dropped).toBe(1);
        expect(loadPreferenceFacts().map((fact) => fact.id)).toEqual(["pinned-1"]);
      });

      it("프로젝트 스코프인데 조회 키를 모르면 전역으로 내린다", async () => {
        seedSignals([statedSignal()]);
        const chat = chatReturning('{"upsert":[{"text":"이 게임은 호러다","scope":"project","strength":"strong"}],"drop":[]}');
        await distillPreferences({ chat, config: CONFIG });
        const facts = loadPreferenceFacts();
        expect(facts).toHaveLength(1);
        expect(facts[0].scope).toBe("global");
      });

      it("조회 키가 있으면 프로젝트 성향으로 저장한다", async () => {
        seedSignals([statedSignal()]);
        const chat = chatReturning('{"upsert":[{"text":"이 게임은 호러다","scope":"project","strength":"strong"}],"drop":[]}');
        await distillPreferences({ chat, config: CONFIG, projectScopeKey: "local:A::m1" });
        const facts = loadPreferenceFacts();
        expect(facts[0].scope).toBe("project");
        expect(facts[0].projectScopeKey).toBe("local:A::m1");
      });

      it("파싱 실패는 던지지 않고 무변경으로 끝난다", async () => {
        seedSignals([statedSignal()]);
        const chat = chatReturning("성향을 정리했습니다.");
        const result = await distillPreferences({ chat, config: CONFIG });
        expect(result).toEqual({ ok: false, upserted: 0, dropped: 0 });
        expect(loadPreferenceFacts()).toEqual([]);
        // 신호는 남는다 — 다음 턴에 다시 시도한다.
        expect(loadPreferenceSignals().pending).toHaveLength(1);
        expect(loadPreferenceSignals().distillFailures).toBe(1);
      });

      it("전송 실패도 던지지 않는다", async () => {
        seedSignals([statedSignal()]);
        const chat = () => Promise.reject(new Error("network down"));
        await expect(distillPreferences({ chat, config: CONFIG })).resolves.toEqual({ ok: false, upserted: 0, dropped: 0 });
        expect(loadPreferenceSignals().distillFailures).toBe(1);
      });

      it("연속 실패가 상한에 닿으면 pending 을 잘라 큐를 뚫는다", async () => {
        seedSignals([statedSignal(), undoSignal(1), undoSignal(2), undoSignal(3)]);
        const chat = chatReturning("JSON 아님");
        for (let attempt = 0; attempt < DISTILL_FAILURE_LIMIT; attempt += 1) {
          await distillPreferences({ chat, config: CONFIG });
        }
        const loaded = loadPreferenceSignals();
        expect(loaded.pending).toHaveLength(2);
        expect(loaded.distillFailures).toBe(0);
      });

      it("빈 결과도 성공이다 — \"만들 것 없음\"이 정상 판단이므로 신호를 비운다", async () => {
        seedSignals([statedSignal()]);
        const chat = chatReturning('{"upsert":[],"drop":[]}');
        const result = await distillPreferences({ chat, config: CONFIG });
        expect(result).toEqual({ ok: true, upserted: 0, dropped: 0 });
        expect(loadPreferenceSignals().pending).toEqual([]);
      });

      it("멀티모달 응답(비문자열 content)은 파싱 실패로 처리된다", async () => {
        seedSignals([statedSignal()]);
        const chat = () =>
          Promise.resolve({ message: { role: "assistant", content: [{ type: "text", text: "{}" }] } } as unknown as ChatResult);
        const result = await distillPreferences({ chat, config: CONFIG });
        expect(result.ok).toBe(false);
      });
    });
  });
  // test/preferenceMemory.test.ts
  // 성향 저장소 계약. 이 파일이 지키는 것은 "AI 가 사람의 성향을 기억한다"의 하부 구조 전부다 —
  // 상한 축출, 고정 면제, 프롬프트 블록의 우선순위 문장·하드캡.
  describe("preferenceMemory", () => {
    isolateTimers();
    const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    function createMemoryStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      };
    }
    function fact(overrides: Partial<PreferenceFact> & { readonly id: string; readonly text: string }): PreferenceFact {
      return {
        scope: "global",
        strength: "medium",
        evidence: 1,
        source: "observed",
        updatedAt: 1_000,
        ...overrides,
      };
    }
    beforeEach(() => {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: createMemoryStorage(),
      });
    });
    afterEach(() => {
      if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
        return;
      }
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    describe("저장과 복원", () => {
      it("저장한 성향을 그대로 되읽는다", () => {
        expect(upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "strong" })).toBe(true);
        const loaded = loadPreferenceFacts();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].text).toBe("마을은 작게 유지한다");
        expect(loaded[0].strength).toBe("strong");
        expect(loaded[0].evidence).toBe(1);
      });

      it("같은 문장을 다시 관측하면 행을 늘리지 않고 근거를 올린다", () => {
        upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "weak" });
        upsertPreferenceFact({ text: "마을은,  작게 유지한다.", scope: "global", strength: "weak" });
        const loaded = loadPreferenceFacts();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].evidence).toBe(2);
      });

      it("근거가 쌓여도 강도는 약한 쪽으로 내려가지 않는다", () => {
        upsertPreferenceFact({ text: "어두운 톤을 선호한다", scope: "global", strength: "strong" });
        upsertPreferenceFact({ text: "어두운 톤을 선호한다", scope: "global", strength: "weak" });
        expect(loadPreferenceFacts()[0].strength).toBe("strong");
      });

      it("직접 입력(manual) 근거는 이후 관측이 덮어쓰지 않는다", () => {
        upsertPreferenceFact({ text: "집은 4채 이하", scope: "global", source: "manual", pinned: true });
        upsertPreferenceFact({ text: "집은 4채 이하", scope: "global", source: "observed" });
        const loaded = loadPreferenceFacts();
        expect(loaded[0].source).toBe("manual");
        expect(loaded[0].pinned).toBe(true);
      });

      it("프로젝트 스코프는 조회 키 없이는 저장되지 않는다", () => {
        expect(upsertPreferenceFact({ text: "이 게임은 호러다", scope: "project" })).toBe(false);
        expect(loadPreferenceFacts()).toHaveLength(0);
      });

      it("문장은 상한 길이로 잘린다", () => {
        upsertPreferenceFact({ text: "가".repeat(PREFERENCE_TEXT_MAX_CHARS + 40), scope: "global" });
        expect(loadPreferenceFacts()[0].text).toHaveLength(PREFERENCE_TEXT_MAX_CHARS);
      });

      it("깨진 저장값은 조용히 빈 목록으로 떨어진다", () => {
        localStorage.setItem(PREFERENCE_MEMORY_STORAGE_KEY, "{not json");
        expect(loadPreferenceFacts()).toEqual([]);
      });

      it("localStorage 가 없으면 로드는 빈 목록, 저장은 no-op", () => {
        Reflect.deleteProperty(globalThis, "localStorage");
        expect(loadPreferenceFacts()).toEqual([]);
        expect(() => savePreferenceFacts([fact({ id: "a", text: "x" })])).not.toThrow();
        expect(upsertPreferenceFact({ text: "y", scope: "global" })).toBe(false);
      });
    });
    describe("상한 축출", () => {
      it("전역 상한을 넘으면 최약체부터 버린다", () => {
        const facts = Array.from({ length: GLOBAL_PREFERENCE_LIMIT + 3 }, (_, index) =>
          fact({ id: `g${index}`, text: `성향 ${index}`, strength: index < 4 ? "strong" : "weak", evidence: index }),
        );
        const kept = evictOverLimit(facts);
        expect(kept).toHaveLength(GLOBAL_PREFERENCE_LIMIT);
        // strong 4건은 전부 살아 있어야 한다.
        expect(kept.filter((entry) => entry.strength === "strong")).toHaveLength(4);
      });

      it("프로젝트 상한은 프로젝트별로 따로 센다", () => {
        const make = (key: string, count: number): PreferenceFact[] =>
          Array.from({ length: count }, (_, index) =>
            fact({ id: `${key}-${index}`, text: `${key} ${index}`, scope: "project", projectScopeKey: key }),
          );
        const kept = evictOverLimit([
          ...make("local:A::m1", PROJECT_PREFERENCE_LIMIT + 4),
          ...make("local:B::m1", 2),
        ]);
        expect(kept.filter((entry) => entry.projectScopeKey === "local:A::m1")).toHaveLength(PROJECT_PREFERENCE_LIMIT);
        expect(kept.filter((entry) => entry.projectScopeKey === "local:B::m1")).toHaveLength(2);
      });

      it("고정된 항목은 상한 계산에서 면제된다", () => {
        const pinned = Array.from({ length: GLOBAL_PREFERENCE_LIMIT + 5 }, (_, index) =>
          fact({ id: `p${index}`, text: `고정 ${index}`, pinned: true, strength: "weak" }),
        );
        expect(evictOverLimit(pinned)).toHaveLength(GLOBAL_PREFERENCE_LIMIT + 5);
      });

      it("상한에 밀려 즉시 축출되는 신규는 저장됐다고 보고하지 않는다", () => {
        const full = Array.from({ length: GLOBAL_PREFERENCE_LIMIT }, (_, index) =>
          fact({ id: `s${index}`, text: `강한 성향 ${index}`, strength: "strong", evidence: 9 }),
        );
        const result = upsertPreferenceFactIn(full, { text: "약한 신규", scope: "global", strength: "weak" });
        expect(result.changed).toBe(false);
        expect(result.fact).toBeNull();
        expect(result.facts).toHaveLength(GLOBAL_PREFERENCE_LIMIT);
      });
    });
    describe("삭제와 고정", () => {
      it("증류 drop 은 고정된 항목을 지우지 못한다", () => {
        savePreferenceFacts([
          fact({ id: "keep", text: "고정된 성향", pinned: true }),
          fact({ id: "gone", text: "보통 성향" }),
        ]);
        expect(dropPreferenceFactsUnpinned(["keep", "gone"])).toBe(1);
        expect(loadPreferenceFacts().map((entry) => entry.id)).toEqual(["keep"]);
      });

      it("사용자 삭제는 고정된 항목도 지운다", () => {
        savePreferenceFacts([fact({ id: "keep", text: "고정된 성향", pinned: true })]);
        deletePreferenceFact("keep");
        expect(loadPreferenceFacts()).toHaveLength(0);
      });

      it("고정 토글이 저장된다", () => {
        savePreferenceFacts([fact({ id: "a", text: "성향 A" })]);
        setPreferenceFactPinned("a", true);
        expect(loadPreferenceFacts()[0].pinned).toBe(true);
        setPreferenceFactPinned("a", false);
        expect(loadPreferenceFacts()[0].pinned).toBe(false);
      });

      it("전체 비우기는 저장 키를 없앤다", () => {
        savePreferenceFacts([fact({ id: "a", text: "성향 A" })]);
        clearPreferenceFacts();
        expect(localStorage.getItem(PREFERENCE_MEMORY_STORAGE_KEY)).toBeNull();
        expect(loadPreferenceFacts()).toEqual([]);
      });
    });
    describe("프롬프트 블록", () => {
      it("우선순위 문장이 반드시 들어간다", () => {
        const section = buildPreferenceMemorySectionFrom([fact({ id: "a", text: "마을은 작게" })]);
        expect(section).toContain(PREFERENCE_SECTION_HEADING);
        expect(section).toContain(PREFERENCE_PRECEDENCE_LINE);
        expect(section).toContain("- [보통] 마을은 작게");
      });

      it("성향이 없으면 빈 문자열이다", () => {
        expect(buildPreferenceMemorySectionFrom([])).toBe("");
      });

      it("조회 키가 맞는 프로젝트 성향만 소제목과 함께 붙는다", () => {
        const facts = [
          fact({ id: "g", text: "전역 성향" }),
          fact({ id: "p", text: "이 게임은 호러다", scope: "project", projectScopeKey: "local:A::m1" }),
          fact({ id: "q", text: "남의 프로젝트", scope: "project", projectScopeKey: "local:B::m1" }),
        ];
        const section = buildPreferenceMemorySectionFrom(facts, "local:A::m1");
        expect(section).toContain(PREFERENCE_PROJECT_SUBHEADING);
        expect(section).toContain("이 게임은 호러다");
        expect(section).not.toContain("남의 프로젝트");
      });

      it("조회 키가 없으면 프로젝트 성향과 소제목이 모두 빠진다", () => {
        const section = buildPreferenceMemorySectionFrom(
          [fact({ id: "p", text: "이 게임은 호러다", scope: "project", projectScopeKey: "local:A::m1" })],
        );
        expect(section).toBe("");
      });

      it("강한 것부터 나열한다", () => {
        const section = buildPreferenceMemorySectionFrom([
          fact({ id: "w", text: "약한 성향", strength: "weak" }),
          fact({ id: "s", text: "강한 성향", strength: "strong" }),
        ]);
        expect(section.indexOf("강한 성향")).toBeLessThan(section.indexOf("약한 성향"));
      });

      it("줄 수 하드캡을 넘기지 않고 생략 건수를 밝힌다", () => {
        const facts = Array.from({ length: PREFERENCE_SECTION_MAX_LINES + 5 }, (_, index) =>
          fact({ id: `g${index}`, text: `성향 ${index}`, pinned: true }),
        );
        const section = buildPreferenceMemorySectionFrom(facts);
        const bullets = section.split("\n").filter((line) => line.startsWith("- ["));
        expect(bullets).toHaveLength(PREFERENCE_SECTION_MAX_LINES);
        expect(section).toContain("5건은 지면상 생략");
      });

      it("문자 수 하드캡을 넘기지 않는다", () => {
        const facts = Array.from({ length: PREFERENCE_SECTION_MAX_LINES }, (_, index) =>
          fact({ id: `g${index}`, text: `${index}`.padEnd(PREFERENCE_TEXT_MAX_CHARS, "가"), pinned: true }),
        );
        const section = buildPreferenceMemorySectionFrom(facts);
        // 생략 안내 한 줄은 캡 판정 뒤에 붙으므로 넉넉히 잡는다.
        expect(section.length).toBeLessThanOrEqual(PREFERENCE_SECTION_MAX_CHARS + 40);
      });

      it("localStorage 경유 블록도 같은 계약을 지킨다", () => {
        upsertPreferenceFact({ text: "밝은 톤을 선호한다", scope: "global", strength: "strong" });
        const section = buildPreferenceMemorySection();
        expect(section).toContain(PREFERENCE_PRECEDENCE_LINE);
        expect(section).toContain("밝은 톤을 선호한다");
      });
    });
    describe("보조 계산", () => {
      it("정규화가 공백·문장부호·대소문자를 접는다", () => {
        expect(normalizePreferenceText("  Village  SMALL,  please. ")).toBe("village small please");
      });

      it("랭크 비교는 강도 → 근거 → 최신 순", () => {
        const strong = fact({ id: "a", text: "a", strength: "strong", evidence: 1, updatedAt: 1 });
        const weakMany = fact({ id: "b", text: "b", strength: "weak", evidence: 9, updatedAt: 9 });
        expect(comparePreferenceRank(strong, weakMany)).toBeLessThan(0);

        const older = fact({ id: "c", text: "c", evidence: 2, updatedAt: 1 });
        const newer = fact({ id: "d", text: "d", evidence: 2, updatedAt: 5 });
        expect(comparePreferenceRank(newer, older)).toBeLessThan(0);
      });

      it("설정 화면 목록은 전역/프로젝트를 나눠 준다", () => {
        savePreferenceFacts([
          fact({ id: "g", text: "전역" }),
          fact({ id: "p", text: "프로젝트", scope: "project", projectScopeKey: "local:A::m1" }),
        ]);
        const listed = listPreferenceFacts("local:A::m1");
        expect(listed.global.map((entry) => entry.id)).toEqual(["g"]);
        expect(listed.project.map((entry) => entry.id)).toEqual(["p"]);
        expect(listPreferenceFacts().project).toEqual([]);
      });
    });
  });
  // test/preferenceSignals.test.ts
  // 결정론 집계 계약. 되돌리기 −3 / 정정 −2 / 무사통과 +1 과 60초 창 경계, 그리고 어휘 상수 표면.
  // 어휘 목록이 조용히 줄면 부정 신호가 통째로 사라져 "학습이 안 된다"로 되돌아가고, 원인이
  // 프롬프트가 아니라 이 상수라는 걸 알아채기 어렵다 — 그래서 표면 자체를 단정한다.
  describe("preferenceSignals", () => {
    isolateTimers();
    const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    function createMemoryStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      };
    }
    beforeEach(() => {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: createMemoryStorage(),
      });
    });
    afterEach(() => {
      if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
        return;
      }
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    describe("가중 상수", () => {
      it("되돌리기가 무사통과 3회를 덮는다", () => {
        expect(UNDO_WEIGHT).toBe(-3);
        expect(CORRECTION_WEIGHT).toBe(-2);
        expect(SETTLED_WEIGHT).toBe(1);
        expect(Math.abs(UNDO_WEIGHT)).toBe(SETTLED_WEIGHT * 3);
      });
    });
    describe("어휘 상수 표면", () => {
      it("정정 어휘가 실제 사용자 발화를 잡는다", () => {
        expect(CORRECTION_CUES.length).toBeGreaterThanOrEqual(8);
        for (const text of ["아니 그게 아니야", "집 말고 나무로", "다시 해줘", "너무 크다", "취소해", "그거 지워"]) {
          expect(containsCorrectionCue(text)).toBe(true);
        }
        expect(containsCorrectionCue("마을을 하나 만들어 줘")).toBe(false);
      });

      it("명시 선언 어휘가 취향 선언을 잡는다", () => {
        expect(STATED_PREFERENCE_CUES.length).toBeGreaterThanOrEqual(8);
        for (const text of ["항상 작게 만들어 줘", "앞으로는 물어보지 마", "나는 어두운 분위기가 좋아", "이거 기억해"]) {
          expect(containsStatedPreferenceCue(text)).toBe(true);
        }
        expect(containsStatedPreferenceCue("여기에 집 하나")).toBe(false);
      });
    });
    describe("카운터 키", () => {
      it("툴 이름과 지시문 주제를 함께 뽑는다", () => {
        const keys = counterKeysForTurn("마을을 작게 만들고 어둡게 해줘", ["author_house", "paint_tiles"]);
        expect(keys).toContain("tool:author_house");
        expect(keys).toContain("tool:paint_tiles");
        expect(keys).toContain("scale:small");
        expect(keys).toContain("tone:dark");
        expect(keys).not.toContain("scale:large");
      });

      it("빈 툴 이름은 키를 만들지 않는다", () => {
        expect(counterKeysForTurn("아무 말", ["", "  "])).toEqual([]);
      });
    });
    describe("턴 관측", () => {
      const turn = (state: PreferenceSignalState, instruction: string, at: number, changed = true) =>
        observeTurnIn(state, { instruction, toolNames: ["author_house"], changed, at });

      it("변경을 남긴 턴이 정정 없이 넘어가면 무사통과 +1", () => {
        let state = turn(emptyPreferenceSignalState(), "마을을 작게 만들어 줘", 1_000);
        state = turn(state, "나무를 심어 줘", 2_000);
        expect(state.counters["tool:author_house"]).toEqual({ pos: SETTLED_WEIGHT, neg: 0, at: 2_000 });
        expect(state.counters["scale:small"]).toEqual({ pos: SETTLED_WEIGHT, neg: 0, at: 2_000 });
        expect(state.pending).toHaveLength(0);
      });

      it("60초 안의 부정 발화는 정정 −2 로 집계된다", () => {
        let state = turn(emptyPreferenceSignalState(), "마을을 크게 만들어 줘", 1_000);
        state = turn(state, "아니 너무 크다", 1_000 + CORRECTION_WINDOW_MS);
        expect(state.counters["tool:author_house"]).toEqual({ pos: 0, neg: 2, at: 1_000 + CORRECTION_WINDOW_MS });
        expect(state.pending).toHaveLength(1);
        expect(state.pending[0].kind).toBe("correction");
        // pending 은 **직전 턴의 지시문**을 대상으로 남긴다 — 증류가 무엇이 거부됐는지 알아야 한다.
        expect(state.pending[0].instruction).toBe("마을을 크게 만들어 줘");
        expect(state.pending[0].note).toBe("아니 너무 크다");
      });

      it("창을 1ms 넘기면 정정이 아니라 무사통과다", () => {
        let state = turn(emptyPreferenceSignalState(), "마을을 크게 만들어 줘", 1_000);
        state = turn(state, "아니 너무 크다", 1_001 + CORRECTION_WINDOW_MS);
        expect(state.counters["tool:author_house"].neg).toBe(0);
        expect(state.counters["tool:author_house"].pos).toBe(SETTLED_WEIGHT);
        expect(state.pending.filter((signal) => signal.kind === "correction")).toHaveLength(0);
      });

      it("아무것도 바꾸지 않은 턴은 신호가 되지 않는다", () => {
        let state = turn(emptyPreferenceSignalState(), "이 맵 설명해 줘", 1_000, false);
        state = turn(state, "아니 그게 아니야", 2_000);
        expect(state.counters).toEqual({});
      });

      it("명시 선언은 즉시 pending 에 쌓인다", () => {
        const state = turn(emptyPreferenceSignalState(), "항상 마을은 작게 만들어 줘", 1_000);
        expect(state.pending).toHaveLength(1);
        expect(state.pending[0].kind).toBe("stated");
        expect(state.pending[0].weight).toBe(0);
      });

      it("지시문은 상한 길이로 잘려 저장된다", () => {
        const state = turn(emptyPreferenceSignalState(), "가".repeat(PENDING_TEXT_MAX_CHARS + 50), 1_000);
        expect(state.lastTurn?.instruction).toHaveLength(PENDING_TEXT_MAX_CHARS);
      });
    });
    describe("되돌리기", () => {
      it("되돌리면 −3 이 들어가고 그 턴은 무사통과를 받지 못한다", () => {
        let state = observeTurnIn(emptyPreferenceSignalState(), {
          instruction: "마을을 크게 만들어 줘",
          toolNames: ["author_house"],
          changed: true,
          at: 1_000,
        });
        state = noteUndoIn(state, { at: 1_500 });
        expect(state.counters["tool:author_house"]).toEqual({ pos: 0, neg: 3, at: 1_500 });
        expect(state.pending[0].kind).toBe("undo");
        expect(state.pending[0].instruction).toBe("마을을 크게 만들어 줘");

        // 다음 턴이 와도 되돌린 턴에 +1 을 주지 않는다.
        state = observeTurnIn(state, { instruction: "나무를 심어 줘", toolNames: ["paint_tiles"], changed: true, at: 2_000 });
        expect(state.counters["tool:author_house"]).toEqual({ pos: 0, neg: 3, at: 1_500 });
      });

      it("호출부가 툴 이름을 주면 직전 턴 대신 그것을 쓴다", () => {
        const state = noteUndoIn(emptyPreferenceSignalState(), { toolNames: ["author_dungeon"], at: 1_000 });
        expect(state.counters["tool:author_dungeon"].neg).toBe(3);
      });

      it("대상이 아무것도 없으면 상태를 바꾸지 않는다", () => {
        const before = emptyPreferenceSignalState();
        expect(noteUndoIn(before, {})).toBe(before);
      });
    });
    describe("증류 트리거", () => {
      it("명시 선언 1건이면 건수를 기다리지 않는다", () => {
        const state = observeTurnIn(emptyPreferenceSignalState(), {
          instruction: "항상 작게 만들어 줘",
          toolNames: [],
          changed: false,
          at: 1_000,
        });
        expect(state.pending).toHaveLength(1);
        expect(shouldDistillPreferences(state)).toBe(true);
      });

      it("선언 없이 관측만 쌓이면 상한 건수에서 돈다", () => {
        const state: PreferenceSignalState = {
          ...emptyPreferenceSignalState(),
          pending: Array.from({ length: DISTILL_PENDING_THRESHOLD - 1 }, (_, index) => ({
            at: index,
            kind: "undo" as const,
            instruction: `지시 ${index}`,
            toolNames: [],
            weight: UNDO_WEIGHT,
          })),
        };
        expect(shouldDistillPreferences(state)).toBe(false);
        expect(
          shouldDistillPreferences({
            ...state,
            pending: [...state.pending, { at: 99, kind: "undo", instruction: "하나 더", toolNames: [], weight: UNDO_WEIGHT }],
          }),
        ).toBe(true);
      });
    });
    describe("저장 게이트", () => {
      it("관측이 저장되고 되읽힌다", () => {
        observeTurn({ instruction: "마을을 작게", toolNames: ["author_house"], changed: true, at: 1_000 });
        noteAiChangeUndone({ at: 1_500 });
        const loaded = loadPreferenceSignals();
        expect(loaded.counters["tool:author_house"].neg).toBe(3);
        expect(loaded.pending).toHaveLength(1);
      });

      it("pending 은 상한을 넘지 않는다", () => {
        let state = emptyPreferenceSignalState();
        for (let index = 0; index < PENDING_SIGNAL_LIMIT + 6; index += 1) {
          state = noteUndoIn(state, { instruction: `지시 ${index}`, toolNames: ["t"], at: index });
        }
        expect(state.pending).toHaveLength(PENDING_SIGNAL_LIMIT);
        expect(state.pending[0].instruction).toBe(`지시 ${6}`);
      });

      it("증류 성공은 pending 과 실패 카운터를 비운다", () => {
        savePreferenceSignals({
          counters: { "tool:a": { pos: 1, neg: 0, at: 1 } },
          pending: [{ at: 1, kind: "undo", instruction: "x", toolNames: [], weight: UNDO_WEIGHT }],
          lastTurn: null,
          distillFailures: 2,
        });
        consumePendingSignals();
        const loaded = loadPreferenceSignals();
        expect(loaded.pending).toEqual([]);
        expect(loaded.distillFailures).toBe(0);
        // 카운터는 남는다 — 증류가 실패해도 집계는 손실되지 않아야 한다는 설계와 같은 이유.
        expect(loaded.counters["tool:a"]).toEqual({ pos: 1, neg: 0, at: 1 });
      });

      it("연속 실패 상한에 닿으면 pending 앞 절반을 버린다", () => {
        savePreferenceSignals({
          ...emptyPreferenceSignalState(),
          pending: Array.from({ length: 6 }, (_, index) => ({
            at: index,
            kind: "undo" as const,
            instruction: `지시 ${index}`,
            toolNames: [],
            weight: UNDO_WEIGHT,
          })),
        });
        for (let attempt = 0; attempt < DISTILL_FAILURE_LIMIT - 1; attempt += 1) {
          notePreferenceDistillFailure();
          expect(loadPreferenceSignals().pending).toHaveLength(6);
        }
        notePreferenceDistillFailure();
        const loaded = loadPreferenceSignals();
        expect(loaded.pending).toHaveLength(3);
        expect(loaded.pending[0].instruction).toBe("지시 3");
        expect(loaded.distillFailures).toBe(0);
      });

      it("깨진 저장값은 빈 상태로 떨어진다", () => {
        localStorage.setItem(PREFERENCE_SIGNALS_STORAGE_KEY, "[[[");
        expect(loadPreferenceSignals()).toEqual(emptyPreferenceSignalState());
      });

      it("모양이 어긋난 항목은 걸러진다", () => {
        localStorage.setItem(
          PREFERENCE_SIGNALS_STORAGE_KEY,
          JSON.stringify({
            counters: { good: { pos: 1, neg: 2, at: 3 }, bad: { pos: "1" } },
            pending: [{ at: 1, kind: "undo", instruction: "x", toolNames: [], weight: -3 }, { kind: "nope" }],
            lastTurn: { at: "nope" },
            distillFailures: -5,
          }),
        );
        const loaded = loadPreferenceSignals();
        expect(Object.keys(loaded.counters)).toEqual(["good"]);
        expect(loaded.pending).toHaveLength(1);
        expect(loaded.lastTurn).toBeNull();
        expect(loaded.distillFailures).toBe(0);
      });

      it("전체 비우기가 저장 키를 없앤다", () => {
        observeTurn({ instruction: "x", toolNames: ["t"], changed: true, at: 1 });
        clearPreferenceSignals();
        expect(localStorage.getItem(PREFERENCE_SIGNALS_STORAGE_KEY)).toBeNull();
      });

      it("localStorage 가 없으면 조용히 빈 상태로 동작한다", () => {
        Reflect.deleteProperty(globalThis, "localStorage");
        expect(loadPreferenceSignals()).toEqual(emptyPreferenceSignalState());
        expect(() => observeTurn({ instruction: "x", toolNames: [], changed: true, at: 1 })).not.toThrow();
        expect(() => noteAiChangeUndone()).not.toThrow();
      });
    });
  });
  describe("proposalApplyMode", () => {
    isolateTimers();
    describe("resolveProposalApplyMode", () => {
      it("쓰기 호출이 있으면 종류와 개수에 관계없이 바로 적용한다", () => {
        expect(resolveProposalApplyMode({ callCount: 1 })).toBe("apply-now");
        expect(resolveProposalApplyMode({ callCount: 7 })).toBe("apply-now");
      });

      it("변경 0건만 적용 대상이 아니다", () => {
        expect(resolveProposalApplyMode({ callCount: 0 })).toBe("no-changes");
      });
    });
  });
  describe("providerQuota", () => {
    isolateTimers();
    describe("isQuotaOrRateLimitError", () => {
      it.each([
        "429 Too Many Requests",
        '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}',
        "Cloud Code Assist API error (429): RESOURCE_EXHAUSTED",
        "rate_limit_error: Number of request tokens has exceeded your per-minute rate limit",
        "You've hit your usage limit. Resets in 3h12m0s",
        "요청 한도 초과(429): 잠시 후 다시 시도하세요.",
      ])("한도 문구로 판정한다: %s", (message) => {
        expect(isQuotaOrRateLimitError(message)).toBe(true);
      });

      it.each([
        "502 Bad Gateway",
        "socket hang up",
        "stream ended without a finish reason",
        "인증 실패(401): API 키가 없거나 잘못되었습니다.",
        "자율성 「보통」의 작업 한도(30턴)에 도달해 중단했습니다",
        "작업 시간 한도에 닿아 멈췄다",
        "QuotaExceededError: Failed to execute 'setItem' on 'Storage'",
        "타일 429번을 칠했다",
        "",
      ])("일시 끊김·인증 오류는 한도로 보지 않는다: %s", (message) => {
        expect(isQuotaOrRateLimitError(message)).toBe(false);
      });
    });
    describe("quotaFailureCopy", () => {
      it("제공자 이름과 전환 안내를 넣고 성공을 말하지 않는다", () => {
        const text = quotaFailureCopy("Codex(ChatGPT)", false);
        expect(text).toContain("Codex(ChatGPT)");
        expect(text).toContain("다른 AI 연결");
        expect(text).toContain("적용하지 않았어요");
        expect(text).not.toMatch(/완료|적용했/);
      });

      it("이미 반영한 변경이 있으면 그 사실을 남긴다", () => {
        expect(quotaFailureCopy("Antigravity", true)).toContain("반영한 변경은 남아 있고");
      });
    });
    describe("usage 칩 문구", () => {
      const readable: ProviderUsageSnapshot = {
        provider: "openai-codex",
        readable: true,
        fetchedAt: 0,
        windows: [
          { label: "5시간", remainingFraction: 0.63, resetsAt: 30 * 60_000 },
          { label: "주간", remainingFraction: 0.9 },
        ],
      };

      it("읽을 수 있으면 가장 적게 남은 창의 비율을 보인다", () => {
        expect(lowestRemaining(readable)).toBeCloseTo(0.63);
        expect(usageChipSuffix(readable)).toBe("남음 63%");
        expect(usageDetail(readable, 0)).toBe("5시간: 63% 남음 · 30분 뒤 초기화 / 주간: 90% 남음");
      });

      it("소진 창은 0% 로 센다", () => {
        expect(usageChipSuffix({ ...readable, windows: [{ label: "5시간", exhausted: true }, { label: "주간", remainingFraction: 0.5 }] })).toBe("남음 0%");
      });

      it("읽을 수 없으면 숫자를 지어내지 않고 「알 수 없음」 과 이유를 보인다", () => {
        const unknown: ProviderUsageSnapshot = { provider: "openai-compat:x", readable: false, fetchedAt: 0, windows: [], reason: "이 연결은 남은 한도를 알려 주지 않아요." };
        expect(usageChipSuffix(unknown)).toBe("한도 알 수 없음");
        expect(usageChipSuffix(null)).toBe("한도 알 수 없음");
        expect(usageDetail(unknown)).toBe("이 연결은 남은 한도를 알려 주지 않아요.");
      });
    });
  });
  describe("runRecap", () => {
    isolateTimers();
    describe("usageDelta", () => {
      it("세션 누적에서 이번 목표만 뺀다", () => {
        const before = addSessionUsage(EMPTY_SESSION_USAGE, "big", { prompt_tokens: 100, completion_tokens: 10 });
        let after = addSessionUsage(before, "big", { prompt_tokens: 40, completion_tokens: 5 });
        after = addSessionUsage(after, "lite", { prompt_tokens: 8, completion_tokens: 2 });
        const delta = usageDelta(before, after);
        expect(delta.calls).toBe(2);
        expect(delta.promptTokens).toBe(48);
        expect(delta.completionTokens).toBe(7);
        expect(delta.byModel.map((entry) => entry.model)).toEqual(["big", "lite"]);
        expect(delta.byModel[0]).toMatchObject({ calls: 1, promptTokens: 40, completionTokens: 5 });
      });
    });
    describe("extractRunProcess", () => {
      it("플래너·Ralph·볼륨·같은 툴 연속을 과정으로 남긴다", () => {
        const steps = extractRunProcess([
          { kind: "status", text: "planner:direct-rejected 한 턴" },
          { kind: "status", text: "volume-contract:forced-plan" },
          { kind: "tool", name: "place_npc", ok: true },
          { kind: "tool", name: "place_npc", ok: true },
          { kind: "status", text: "ralph:continue step=1/256" },
          { kind: "status", text: "volume-contract:continue 1/8 상점 +0" },
          { kind: "status", text: "tools:exposed 40 — place_npc" },
          { kind: "status", text: "턴 종료(final) — 제안 2건 · 출력 토큰 ~12" },
        ]);
        expect(steps.map((step) => step.kind)).toEqual([
          "planner",
          "volume",
          "tool",
          "ralph",
          "volume",
          "end",
        ]);
        expect(steps.find((step) => step.kind === "tool")?.text).toBe("place_npc ok ×2");
      });
    });
    describe("player line vs log payload", () => {
      it("채팅 줄은 토큰과 경과만 담고 과정은 JSON 로그에 둔다", () => {
        const usage = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 84_120, completion_tokens: 6_410 });
        const recap = buildRunRecap({
          elapsedMs: 48_210,
          usage,
          audit: [
            { kind: "status", text: "planner:new_plan items=3" },
            { kind: "tool", name: "author_village", ok: true },
            { kind: "status", text: "ralph:continue step=1/256" },
          ],
          stoppedReason: "final",
          proposedWrites: 1,
        });
        expect(formatElapsedMs(recap.elapsedMs)).toBe("48초");
        expect(formatRunRecapPlayerLine(recap)).toBe("토큰 입력 84,120 · 출력 6,410 · 48초");
        expect(formatRunRecapPlayerLine(recap)).not.toContain("ralph");
        const parsed = parseRunRecapPayload(`run-recap ${serializeRunRecap(recap)}`);
        expect(parsed?.ralphContinues).toBe(1);
        expect(parsed?.usage.promptTokens).toBe(84_120);
        expect(parsed?.process.some((step) => step.kind === "ralph")).toBe(true);
        expect(serializeRunRecap(recap)).not.toContain("agent_run:auto-continue");
      });

      it("공급자가 usage 를 안 주면 미보고로 말한다", () => {
        const usage = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", undefined);
        const recap = buildRunRecap({
          elapsedMs: 1500,
          usage,
          audit: [],
          stoppedReason: "final",
          proposedWrites: 0,
        });
        expect(formatRunRecapPlayerLine(recap)).toBe("토큰 미보고 · LLM 1회 · 2초");
      });
    });
  });
  // 바로 깔기 모델 계획 층 — 파싱·허용 목록·대상 사각형 자르기. 네트워크 없음.
  describe("stampPlanner", () => {
    isolateTimers();
    const FACTS: StampPlanFacts = {
      text: "땅을 동그랗게, 물을 동그랗게 옆에 나무",
      mapId: "map_a",
      mapWidth: 40,
      mapHeight: 30,
      target: { x: 10, y: 5, w: 20, h: 10 },
      targetIsSelection: true,
      tilesetId: "forest_harmony",
      fillMaterials: ["흙", "잔디", "물"],
      materialHint: "소품·지형 material 라벨 예: 침엽수(prop)",
    };
    describe("parseStampPlan", () => {
      it("splits one sentence into several steps inside the target", () => {
        const raw = JSON.stringify({
          steps: [
            { tool: "fill_region", args: { rect: { x: 10, y: 5, w: 8, h: 10 }, material: "흙", shape: "circle" }, label: "왼쪽 흙 원" },
            { tool: "fill_region", args: { rect: { x: 18, y: 5, w: 8, h: 10 }, material: "물", shape: "circle" }, label: "가운데 물 원" },
            { tool: "place_props", args: { area: { x: 26, y: 5, w: 4, h: 10 }, material: "침엽수", density: "impassable" }, label: "오른쪽 나무" },
          ],
        });
        const plan = parseStampPlan(raw, FACTS);
        expect(plan.error).toBeUndefined();
        expect(plan.dropped).toEqual([]);
        expect(plan.steps.map((step) => step.tool)).toEqual(["fill_region", "fill_region", "place_props"]);
        expect(plan.steps[0]!.args).toEqual({ mapId: "map_a", rect: { x: 10, y: 5, w: 8, h: 10 }, material: "흙", shape: "circle" });
        expect(plan.steps[2]!.args).toMatchObject({ mapId: "map_a", area: { x: 26, y: 5, w: 4, h: 10 }, density: "impassable" });
      });

      it("reads fenced JSON and chatter around it", () => {
        const raw = "여기 있습니다\n```json\n{\"steps\":[{\"tool\":\"tile_erase\",\"args\":{}}]}\n```";
        const plan = parseStampPlan(raw, FACTS);
        expect(plan.steps).toHaveLength(1);
        // rect 가 없으면 대상 전체.
        expect(plan.steps[0]!.args).toEqual({ mapId: "map_a", rect: FACTS.target, layer: "both" });
      });

      it("reports unreadable output", () => {
        expect(parseStampPlan("not json", FACTS).error).toBeDefined();
        expect(parseStampPlan("{\"foo\":1}", FACTS).error).toBeDefined();
      });

      it("drops tools outside the allow-list and steps without material", () => {
        const raw = JSON.stringify({
          steps: [
            { tool: "delete_map", args: {} },
            { tool: "fill_region", args: { rect: { x: 10, y: 5, w: 2, h: 2 } } },
            { tool: "place_props", args: { material: "침엽수" } },
          ],
        });
        const plan = parseStampPlan(raw, FACTS);
        expect(plan.steps.map((step) => step.tool)).toEqual(["place_props"]);
        expect(plan.dropped).toHaveLength(2);
        expect(plan.dropped[0]).toContain("delete_map");
      });

      it("caps the number of steps", () => {
        const steps = Array.from({ length: STAMP_MAX_STEPS + 3 }, () => ({ tool: "tile_erase", args: {} }));
        const plan = parseStampPlan(JSON.stringify({ steps }), FACTS);
        expect(plan.steps).toHaveLength(STAMP_MAX_STEPS);
        expect(plan.dropped.length).toBeGreaterThan(0);
      });
    });
    describe("clamping to the target rect", () => {
      it("cuts rects that leave the target and drops ones fully outside", () => {
        expect(clampRectToTarget({ x: 0, y: 0, w: 15, h: 8 }, FACTS.target)).toEqual({ x: 10, y: 5, w: 5, h: 3 });
        expect(clampRectToTarget({ x: 25, y: 12, w: 50, h: 50 }, FACTS.target)).toEqual({ x: 25, y: 12, w: 5, h: 3 });
        expect(clampRectToTarget({ x: 0, y: 0, w: 5, h: 5 }, FACTS.target)).toBeNull();
        expect(clampRectToTarget({ x: 12, y: 6, w: 0, h: 3 }, FACTS.target)).toBeNull();
        // 모델이 width/height 로 적어도 받는다.
        expect(clampRectToTarget({ x: 12, y: 6, width: 2, height: 3 }, FACTS.target)).toEqual({ x: 12, y: 6, w: 2, h: 3 });
      });

      it("clamps road points and door positions into the target", () => {
        const road = validateStampStep({ tool: "paint_road", args: { points: [{ x: 0, y: 0 }, { x: 99, y: 7 }] } }, FACTS);
        expect("step" in road && road.step.args.points).toEqual([{ x: 10, y: 5 }, { x: 29, y: 7 }]);
        const door = validateStampStep({ tool: "place_door", args: { at: { x: 100, y: 100 }, material: "문" } }, FACTS);
        expect("step" in door && door.step.args.at).toEqual({ x: 29, y: 14 });
      });

      it("drops a fill whose rect lies fully outside the target", () => {
        const check = validateStampStep({ tool: "fill_region", args: { rect: { x: 0, y: 0, w: 3, h: 3 }, material: "물" } }, FACTS);
        expect("dropped" in check).toBe(true);
      });

      it("gives non-tree props a count when no density is given", () => {
        const check = validateStampStep({ tool: "place_props", args: { area: { x: 10, y: 5, w: 2, h: 3 }, material: "나무 상자" } }, FACTS);
        expect("step" in check && check.step.args).toMatchObject({ count: 6, packing: "dense" });
      });

      it("validates place_house inside the target and converts house walls to place_house", () => {
        const check = validateStampStep({ tool: "place_house", args: { area: { x: 12, y: 6, w: 8, h: 7 }, size: "small", count: 2 } }, FACTS);
        expect("step" in check && check.step.args).toMatchObject({ area: { x: 12, y: 6, w: 8, h: 7 }, size: "small", count: 2, stories: 1 });
        const converted = parseStampPlan(JSON.stringify({
          steps: [
            { tool: "build_wall", args: { rect: { x: 12, y: 6, w: 7, h: 6 }, material: "벽" } },
            { tool: "place_door", args: { at: { x: 15, y: 11 }, material: "문" } },
          ],
        }), { ...FACTS, text: "여기에 작은 집 지어줘" });
        expect(converted.steps.map((step) => step.tool)).toEqual(["place_house"]);
      });

      it("validates place_dungeon_room and converts dungeon wall+fill plans into place_dungeon_room", () => {
        const check = validateStampStep(
          { tool: "place_dungeon_room", args: { area: { x: 10, y: 5, w: 10, h: 8 }, kind: "room", hazard: "lava" } },
          FACTS,
        );
        expect("step" in check && check.step.args).toMatchObject({
          area: { x: 10, y: 5, w: 10, h: 8 },
          kind: "room",
          hazard: "lava",
        });
        const converted = parseStampPlan(
          JSON.stringify({
            steps: [
              { tool: "fill_region", args: { rect: { x: 10, y: 5, w: 10, h: 8 }, material: "흙" }, label: "던전 방 바닥" },
              { tool: "build_wall", args: { rect: { x: 10, y: 5, w: 10, h: 8 }, material: "벽" }, label: "던전 방 외벽" },
            ],
          }),
          { ...FACTS, text: "던전 입구 방과 계단" },
        );
        expect(converted.steps.map((step) => step.tool)).toEqual(["place_dungeon_room"]);
      });
    });
    describe("prompts", () => {
      it("puts the real tileset labels in the user payload", () => {
        const payload = JSON.parse(buildStampPlannerUserPayload(FACTS)) as Record<string, unknown>;
        expect(payload.fillMaterials).toEqual(["흙", "잔디", "물"]);
        expect(payload.sentence).toBe(FACTS.text);
        expect(payload.target).toMatchObject({ x: 10, y: 5, w: 20, h: 10, source: "user selection" });
      });

      it("repair prompt carries the tool error and omits mapId", () => {
        const text = buildStampRepairPrompt([{
          step: { tool: "fill_region", args: { mapId: "map_a", rect: FACTS.target, material: "땅" }, label: "땅" },
          error: "라벨/설명이 \"땅\" 인 타일을 찾지 못했습니다. 채울 수 있는 재료: \"흙\"",
        }]);
        expect(text).toContain("찾지 못했습니다");
        expect(text).not.toContain("map_a");
      });
    });
    describe("3-Tier Fast-Path Command Classification & Guard Contract", () => {
      it("classifies Tier 1 direct spatial ops (place, erase, move) as allowed", () => {
        expect(classifyFastPathCommand("돌 우물과 가로등 두 개 깔아줘")).toMatchObject({
          tier: "SPATIAL_DIRECT_OP",
          allowed: true,
          spatialOp: "place",
        });
        expect(classifyFastPathCommand("오른쪽 위 나무 지워줘")).toMatchObject({
          tier: "SPATIAL_DIRECT_OP",
          allowed: true,
          spatialOp: "erase",
        });
        expect(classifyFastPathCommand("광장 분수대 없애줘")).toMatchObject({
          tier: "SPATIAL_DIRECT_OP",
          allowed: true,
          spatialOp: "erase",
        });
        expect(classifyFastPathCommand("우물을 광장 한가운데로 옮겨줘")).toMatchObject({
          tier: "SPATIAL_DIRECT_OP",
          allowed: true,
          spatialOp: "move",
        });
        expect(classifyFastPathCommand("집을 오른쪽으로 4칸 옮겨줘")).toMatchObject({
          tier: "SPATIAL_DIRECT_OP",
          allowed: true,
          spatialOp: "move",
        });
      });

      it("hard-rejects Tier 2 quest, narrative, boss/puzzle event, party recruitment, and shop/inn wiring requests", () => {
        for (const sentence of [
          "퀘스트 세우기",
          "마을 촌장한테 퀘스트 만들어줘",
          "대장간 보스전 이벤트 만들어줘",
          "석상 퍼즐 기믹 짜줘",
          "동료 영입 이벤트 만들어줘",
          "상점 숙소 기능 배선해줘",
          "NPC 대화 스토리 짜줘",
        ]) {
          const res = classifyFastPathCommand(sentence);
          expect(res.allowed).toBe(false);
          expect(res.tier).toBe("QUEST_OR_NARRATIVE_REJECTED");
          expect(res.code).toBe("FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT");
          expect(res.guidance).toBe(FAST_PATH_QUEST_OR_EVENT_GUIDANCE);
        }
      });

      it("validates erase_object and move_object steps", () => {
        const eraseCheck = validateStampStep(
          { tool: "erase_object", args: { query: "나무", region: "오른쪽 위" } },
          { ...FACTS, text: "오른쪽 위 나무 지워줘" },
        );
        expect("step" in eraseCheck && eraseCheck.step.tool).toBe("erase_object");
        expect("step" in eraseCheck && eraseCheck.step.args).toMatchObject({
          query: "나무",
          region: "오른쪽 위",
        });

        const moveCheck = validateStampStep(
          { tool: "move_object", args: { query: "집", dx: 4, dy: 0 } },
          { ...FACTS, text: "집을 오른쪽으로 4칸 옮겨줘" },
        );
        expect("step" in moveCheck && moveCheck.step.tool).toBe("move_object");
        expect("step" in moveCheck && moveCheck.step.args).toMatchObject({
          query: "집",
          dx: 4,
          dy: 0,
        });
      });

      it("validates all 22 extended fast-path tools and allows guild boards and lever+gate pairs", () => {
        expect(classifyFastPathCommand("모험가 길드와 의뢰 게시판 만들어줘").allowed).toBe(true);
        expect(classifyFastPathCommand("레버와 열리는 철문 깔아줘").allowed).toBe(true);
        const tools = [
          "place_bridge",
          "carve_waterfall_pond",
          "carve_lake_island",
          "retheme_season_biome",
          "build_market_bazaar",
          "build_harbor_dock",
          "build_farm_ranch",
          "build_rail_crossing",
          "place_inn",
          "place_church_healer",
          "place_guild_board",
          "place_travel_portal",
          "place_roaming_enemies",
          "place_switch_and_gate",
          "place_camp_rest",
          "place_mimic_and_sparkles",
          "repeat_line_or_grid",
          "mirror_region",
          "enclose_with_wall",
          "auto_connect_roads",
          "populate_crowd",
          "set_mood_weather",
        ] as const;
        for (const tool of tools) {
          const check = validateStampStep({ tool, args: { area: FACTS.target } }, { ...FACTS, text: "여관과 마을 사람들로 꾸며줘" });
          expect("step" in check, `Expected ${tool} to validate`).toBe(true);
          if ("step" in check) expect(check.step.tool).toBe(tool);
        }
      });
    });
  });
  // test/systemPromptEnvelope.test.ts
  // 공용 프롬프트 봉투 계약. 이 파일이 지키는 것은 "모든 AI 표면이 같은 지점에서 정책·성향을 받는다"다.
  // 순서 단정이 중요하다 — 고정 블록(성향·정책)이 본문 뒤에 오면 상위에서 프롬프트가 잘릴 때
  // 통째로 사라지고, 그게 원래의 "AI 가 기억하지 못한다" 증상이다.
  describe("systemPromptEnvelope", () => {
    isolateTimers();
    const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    function createMemoryStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      };
    }
    const BODY = "## 채널 고유 지침\n- 이 채널만의 규칙";
    beforeEach(() => {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: createMemoryStorage(),
      });
    });
    afterEach(() => {
      if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
        return;
      }
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    describe("조립 순서", () => {
      it("성향 → 정책 → 본문 순으로 붙는다", () => {
        const prompt = composeSystemPrompt({
          surface: "chat",
          body: BODY,
          includePolicy: true,
          includeMemory: true,
          memorySection: "## 사용자 성향\n- [강함] 작게",
        });
        const memoryAt = prompt.indexOf("## 사용자 성향");
        const policyAt = prompt.indexOf("## UX 응답 정책");
        const bodyAt = prompt.indexOf("## 채널 고유 지침");
        expect(memoryAt).toBeGreaterThanOrEqual(0);
        expect(memoryAt).toBeLessThan(policyAt);
        expect(policyAt).toBeLessThan(bodyAt);
      });

      it("블록 사이는 빈 줄 하나로 구분된다", () => {
        const prompt = composeSystemPrompt({
          surface: "chat",
          body: "본문",
          includeMemory: true,
          memorySection: "성향",
        });
        expect(prompt).toBe("성향\n\n본문");
      });
    });
    describe("표면별 포함 규칙", () => {
      it("본문만 넘기면 본문 그대로다 — 봉투가 조용히 무언가를 덧붙이지 않는다", () => {
        expect(composeSystemPrompt({ surface: "structure-kit", body: BODY })).toBe(BODY);
      });

      it("정책을 켜면 AGENT_UX_POLICY_LINES 가 한 글자도 변형되지 않고 들어간다", () => {
        const prompt = composeSystemPrompt({ surface: "chat", body: BODY, includePolicy: true });
        expect(prompt).toContain(AGENT_UX_POLICY_LINES);
      });

      it("성향을 켜도 기억이 비어 있으면 아무것도 붙지 않는다", () => {
        expect(composeSystemPrompt({ surface: "chat", body: BODY, includeMemory: true })).toBe(BODY);
      });

      it("성향을 켜면 저장된 성향이 우선순위 문장과 함께 들어간다", () => {
        upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "strong" });
        const prompt = composeSystemPrompt({ surface: "chat", body: BODY, includeMemory: true });
        expect(prompt).toContain("마을은 작게 유지한다");
        expect(prompt).toContain(PREFERENCE_PRECEDENCE_LINE);
        expect(prompt.startsWith(buildPreferenceMemorySection())).toBe(true);
      });

      it("JSON 전용 표면처럼 성향을 끄면 저장돼 있어도 안 붙는다", () => {
        upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "strong" });
        const prompt = composeSystemPrompt({ surface: "tileset-analysis", body: BODY });
        expect(prompt).not.toContain("마을은 작게 유지한다");
        expect(prompt).not.toContain("## UX 응답 정책");
      });

      it("프로젝트 조회 키를 넘기면 그 프로젝트 성향만 실린다", () => {
        upsertPreferenceFact({ text: "이 게임은 호러다", scope: "project", projectScopeKey: "local:A::m1" });
        upsertPreferenceFact({ text: "남의 게임 설정", scope: "project", projectScopeKey: "local:B::m1" });
        const prompt = composeSystemPrompt({
          surface: "chat",
          body: BODY,
          includeMemory: true,
          projectScopeKey: "local:A::m1",
        });
        expect(prompt).toContain("이 게임은 호러다");
        expect(prompt).not.toContain("남의 게임 설정");
      });

      it("주입된 memorySection 이 localStorage 조회를 이긴다(테스트/호출부 주입 경로)", () => {
        upsertPreferenceFact({ text: "저장된 성향", scope: "global" });
        const prompt = composeSystemPrompt({
          surface: "region",
          body: BODY,
          includeMemory: true,
          memorySection: "주입된 성향",
        });
        expect(prompt).toContain("주입된 성향");
        expect(prompt).not.toContain("저장된 성향");
      });
    });
    describe("경계값", () => {
      it("본문이 비면 고정 블록만 남는다", () => {
        const prompt = composeSystemPrompt({ surface: "chat", body: "   ", includePolicy: true });
        expect(prompt).toBe(AGENT_UX_POLICY_LINES);
      });

      it("모두 비면 빈 문자열이다", () => {
        expect(composeSystemPrompt({ surface: "chat", body: "", includePolicy: false, includeMemory: true })).toBe("");
      });

      it("모든 표면 식별자가 동일하게 처리된다 — 표면은 어휘일 뿐 분기가 아니다", () => {
        const surfaces: AiSurface[] = ["chat", "region", "cluster", "event-command", "structure-kit", "tileset-analysis"];
        const prompts = surfaces.map((surface) => composeSystemPrompt({ surface, body: BODY, includePolicy: true }));
        expect(new Set(prompts).size).toBe(1);
      });
    });
  });
});

// test/tokenBudget.test.ts
// 토큰 예산 보정 계약 테스트 — 순수 계산(기본값 재현·중앙값·클램프)과 localStorage 게이트 폴백.
describe("tokenBudget", () => {
  isolateTimers();
  function obs(promptChars: number, promptTokens: number): TokenObservation {
    return { promptChars, promptTokens };
  }
  /** 비율 목록 → 관측 목록(토큰 1000 기준). */
  function obsWithRatios(ratios: readonly number[]): TokenObservation[] {
    return ratios.map((ratio) => obs(Math.round(ratio * 1000), 1000));
  }
  describe("charsPerTokenEstimate — 순수 계산", () => {
    it("빈 관측이면 기본 계수를 그대로 돌려준다", () => {
      expect(charsPerTokenEstimate([])).toBe(DEFAULT_CHARS_PER_TOKEN);
      expect(charsPerTokenEstimate([], 3)).toBe(3);
    });

    it("무효 관측(0/음수/NaN)은 무시되어 기본 계수로 폴백한다", () => {
      const invalid = [obs(0, 100), obs(-5, 100), obs(100, 0), obs(Number.NaN, 100), obs(100, Number.NaN)];
      expect(charsPerTokenEstimate(invalid)).toBe(DEFAULT_CHARS_PER_TOKEN);
    });

    it("최근 N개 중앙값 — 아웃라이어 하나가 계수를 끌고 가지 못한다", () => {
      // 한국어 실측에 가까운 2.4~2.6 사이에서 아웃라이어 50이 하나 섞여도 중앙값은 안정적이다.
      const estimate = charsPerTokenEstimate(obsWithRatios([2.4, 2.5, 2.6, 50]));
      expect(estimate).toBeGreaterThanOrEqual(2.5);
      expect(estimate).toBeLessThanOrEqual(2.6);
    });

    it("중앙값이 클램프 밖이면 기본값의 0.5×~1.5×로 잘린다", () => {
      const upper = charsPerTokenEstimate(obsWithRatios([100, 120, 90]));
      expect(upper).toBe(DEFAULT_CHARS_PER_TOKEN * CALIBRATION_CLAMP_MAX_RATIO);
      const lower = charsPerTokenEstimate(obsWithRatios([0.4, 0.3, 0.5]));
      expect(lower).toBe(DEFAULT_CHARS_PER_TOKEN * CALIBRATION_CLAMP_MIN_RATIO);
    });

    it("윈도우(CALIBRATION_WINDOW) 밖의 오래된 관측은 버린다", () => {
      // 오래된 관측은 비율 3.9(≈기본), 최근 윈도우는 전부 2.0 — 최근만 반영돼야 한다.
      const old = obsWithRatios(Array.from({ length: 5 }, () => 3.9));
      const recent = obsWithRatios(Array.from({ length: CALIBRATION_WINDOW }, () => 2));
      expect(charsPerTokenEstimate([...old, ...recent])).toBe(2);
    });
  });
  describe("calibratedBudgetChars — 예산 재척도", () => {
    it("관측이 없으면 현행 예산을 정확히 재현한다(보수적 기본값)", () => {
      expect(calibratedBudgetChars(DEFAULT_BUDGET_CHARS, [])).toBe(DEFAULT_BUDGET_CHARS);
    });

    it("관측 계수 비율만큼 예산을 재척도한다(한국어 → 축소)", () => {
      // chars/token 2 (기본 4의 절반) → 같은 토큰 목표를 지키려면 문자 예산도 절반.
      expect(calibratedBudgetChars(12000, obsWithRatios([2, 2, 2]))).toBe(6000);
    });

    it("클램프 덕에 예산은 기본의 0.5×~1.5×를 벗어나지 않는다", () => {
      expect(calibratedBudgetChars(12000, obsWithRatios([100, 100, 100]))).toBe(18000);
      expect(calibratedBudgetChars(12000, obsWithRatios([0.1, 0.1, 0.1]))).toBe(6000);
    });
  });
  describe("estimatePromptChars — 프롬프트 문자 수", () => {
    it("문자열 content·text 파트·tool_calls 이름/인자·extraChars를 합산한다", () => {
      const estimate = estimatePromptChars(
        [
          { content: "abcd" }, // 4
          { content: [{ type: "text", text: "한국어여섯자" }] }, // 6
          { content: null, tool_calls: [{ function: { name: "place_npc", arguments: "{\"x\":1}" } }] }, // 9 + 7
        ],
        100,
      );
      expect(estimate.chars).toBe(4 + 6 + 9 + 7 + 100);
      expect(estimate.hasImages).toBe(false);
    });

    it("이미지 파트는 문자 수에서 빼고 hasImages로 표시한다(관측 제외 신호)", () => {
      const estimate = estimatePromptChars([
        { content: [{ type: "text", text: "ab" }, { type: "image_url" }] },
      ]);
      expect(estimate.chars).toBe(2);
      expect(estimate.hasImages).toBe(true);
    });
  });
  // ── localStorage 게이트 ───────────────────────────────────────────

  type MutableGlobal = { localStorage?: unknown };
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  function installFakeLocalStorage(): Map<string, string> {
    const store = new Map<string, string>();
    (globalThis as MutableGlobal).localStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    return store;
  }
  function removeLocalStorage(): void {
    delete (globalThis as MutableGlobal).localStorage;
  }
  afterEach(() => {
    if (originalDescriptor) Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    else removeLocalStorage();
  });
  describe("localStorage 게이트", () => {
    it("localStorage가 없으면(Node) 로드는 빈 목록, 저장/기록은 조용히 넘어간다", () => {
      removeLocalStorage();
      expect(loadTokenObservations()).toEqual([]);
      expect(() => saveTokenObservations([obs(100, 50)])).not.toThrow();
      // 저장소가 없으니 기록은 누적되지 않고, 이번 관측만 담긴 목록을 돌려준다.
      expect(recordTokenObservation(obs(100, 50))).toEqual([obs(100, 50)]);
      expect(recordTokenObservation(obs(200, 50))).toEqual([obs(200, 50)]);
    });

    it("기록(record)은 로드→추가→트림→저장 라운드트립으로 누적된다", () => {
      const store = installFakeLocalStorage();
      recordTokenObservation(obs(100, 50));
      const second = recordTokenObservation(obs(200, 80));
      expect(second).toEqual([obs(100, 50), obs(200, 80)]);
      expect(loadTokenObservations()).toEqual([obs(100, 50), obs(200, 80)]);
      expect(store.has(TOKEN_CALIBRATION_STORAGE_KEY)).toBe(true);
    });

    it("윈도우를 넘는 관측은 오래된 것부터 버린다", () => {
      installFakeLocalStorage();
      for (let index = 1; index <= CALIBRATION_WINDOW + 3; index += 1) {
        recordTokenObservation(obs(index * 10, 10));
      }
      const loaded = loadTokenObservations();
      expect(loaded).toHaveLength(CALIBRATION_WINDOW);
      expect(loaded[0]).toEqual(obs(40, 10)); // 1~3번째가 밀려남.
    });

    it("깨진 JSON·무효 항목은 조용히 빈 목록/필터링으로 폴백한다", () => {
      const store = installFakeLocalStorage();
      store.set(TOKEN_CALIBRATION_STORAGE_KEY, "{broken json");
      expect(loadTokenObservations()).toEqual([]);
      store.set(
        TOKEN_CALIBRATION_STORAGE_KEY,
        JSON.stringify({ observations: [obs(100, 50), { promptChars: "x", promptTokens: 1 }, 42] }),
      );
      expect(loadTokenObservations()).toEqual([obs(100, 50)]);
    });

    it("record에 무효 관측을 넘기면 저장하지 않고 기존 목록을 돌려준다", () => {
      installFakeLocalStorage();
      recordTokenObservation(obs(100, 50));
      expect(recordTokenObservation(obs(0, 50))).toEqual([obs(100, 50)]);
      expect(loadTokenObservations()).toEqual([obs(100, 50)]);
    });
  });
});

// 턴 단계 기록기의 계약을 잠근다.
//
// 실측 배경(2026-09-26): 읽기 전용 3턴 Pi 실행의 벽시계는 thinking low 6.36s/7.41s, high 9.09s/8.47s 였고
// 로컬 도구 실행은 ~0ms 였다. 즉 시간은 «모델 호출이 몇 번 돌았나» 에 있고, 같은 단계가 한 턴에
// 여러 번 돈다(쓰기 도구마다 체크포인트, 맵마다 검수). 누적이 깨지면 12번 돈 단계가 1번짜리로
// 보여 병목이 표에서 사라진다.
describe("turnTiming", () => {
  isolateTimers();
  /** 테스트 시계 — 눌러 둔 값만 흐르므로 sleep 없이 구간 길이를 정확히 고정한다. */
  function fakeClock(): { now: () => number; advance: (ms: number) => void } {
    let value = 0;
    return {
      now: () => value,
      advance: (ms) => {
        value += ms;
      },
    };
  }
  describe("createTurnTiming", () => {
    it("같은 단계가 여러 번 돌면 ms 를 합산한다", () => {
      const clock = fakeClock();
      const timing = createTurnTiming(clock.now);

      timing.start("checkpoint");
      clock.advance(120);
      timing.end("checkpoint");
      clock.advance(5);
      timing.start("review");
      clock.advance(40);
      timing.end("review");
      timing.start("checkpoint");
      clock.advance(80);
      timing.end("checkpoint");

      const record = timing.snapshot();
      // 마지막 값(80)이 아니라 합(200)이다 — 이게 이 모듈의 존재 이유다.
      expect(record.stages).toEqual([
        { name: "checkpoint", ms: 200 },
        { name: "review", ms: 40 },
      ]);
      // 열 순서는 «처음 열린 순서» 다. checkpoint 가 나중에 또 돌아도 앞자리를 유지한다.
      expect(record.stages.map((stage) => stage.name)).toEqual(["checkpoint", "review"]);
      expect(record.totalMs).toBe(245);
    });

    it("start 없는 end 는 무시한다", () => {
      const clock = fakeClock();
      const timing = createTurnTiming(clock.now);

      clock.advance(10);
      timing.end("never-opened");
      timing.start("model");
      clock.advance(30);
      timing.end("model");
      // 오류 경로에서 finally 가 한 번 더 닫는 상황 — 두 번째 end 가 합을 늘리면 안 된다.
      clock.advance(500);
      timing.end("model");

      const record = timing.snapshot();
      expect(record.stages).toEqual([{ name: "model", ms: 30 }]);
    });

    it("snapshot 은 반복 호출해도 상태를 바꾸지 않는다", () => {
      const clock = fakeClock();
      const timing = createTurnTiming(clock.now);

      timing.start("model");
      clock.advance(50);
      timing.end("model");

      const first = timing.snapshot();
      const second = timing.snapshot();
      expect(second.stages).toEqual(first.stages);
      // totalMs 만 시계를 따라 늘어난다(구간 합은 그대로) — 스냅샷이 누적을 비우지 않는 증거다.
      clock.advance(70);
      const third = timing.snapshot();
      expect(third.stages).toEqual(first.stages);
      expect(third.totalMs).toBe(first.totalMs + 70);

      // 이어서 같은 단계를 더 돌리면 앞선 스냅샷이 아니라 기록기의 누적에 더해진다.
      timing.start("model");
      clock.advance(20);
      timing.end("model");
      expect(timing.snapshot().stages).toEqual([{ name: "model", ms: 70 }]);
      expect(first.stages).toEqual([{ name: "model", ms: 50 }]);
    });

    it("start 가 한 번도 없으면 totalMs 0, 단계 없음", () => {
      const clock = fakeClock();
      const timing = createTurnTiming(clock.now);
      clock.advance(1_000);

      const record = timing.snapshot();
      expect(record.totalMs).toBe(0);
      expect(record.stages).toEqual([]);
    });
  });
});

describe("verificationFindingOwnership", () => {
  isolateTimers();
  const scene = "run_scene_test";
  const requirementId = "accepted-route";
  function fixture(adopted = false) {
    const f = crossMapVerification();
    f.project.session.gold = 37;
    f.project.maps.mapB!.events[0]!.pages![0]!.commands = [{ kind: "changeGold", op: "+=", amount: 18 }];
    const args = { ...f.a };
    const initialState = structuredClone(f.project.session);
    const evidence = new ToolVerificationEvidence();
    const acceptance = new AssistantAcceptanceLedger("cross-map", "Reward ownership", f.project);
    const criteria = [{ kind: "mapDimensions" as const, target: { mapId: f.root.id }, width: f.root.width, height: f.root.height }];
    acceptance.adopt([{ id: "size", title: "Map", criteria }]);
    if (adopted) evidence.adopt({ checkId: requirementId, ownerId: "owner", name: scene, args, initialState,
      interactionTargets: [{ stepIndex: 2, mapId: "mapA", eventId: "shared_npc" }] });
    const route = (mapId: string) => {
      f.root.events[0]!.pages![0]!.commands = [{ kind: "transfer", mapId, x: 2, y: 2 }];
      evidence.invalidateAfterWrite();
    };
    const repair = (mapId: string) => {
      f.project.maps[mapId]!.events[0]!.pages![0]!.commands = [{ kind: "changeGold", op: "+=", amount: 20 }];
      evidence.invalidateAfterWrite();
    };
    const observe = (checkId?: string, seed = initialState) => {
      const result = runTool({ project: f.project }, scene, args);
      evidence.observe(scene, args, result, "explicit", "owner", checkId, seed);
      return result;
    };
    const terminal = () => acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status;
    return { ...f, args, criteria, initialState, evidence, route, repair, observe, terminal };
  }
  describe("map-qualified unresolved finding ownership", () => {
    it.each([false, true])("retains both negatives with identical args and seed; repeated owner deduplicates (adopted=%s)", adopted => {
      const f = fixture(adopted);
      expect(f.observe()).toMatchObject({ ok: true, data: { ok: false, finalState: { mapId: f.root.id, gold: 56 } } });
      const a = f.evidence.snapshot().findings[0]!;
      if (adopted) expect(a.checkId).toBe(requirementId);
      f.observe();
      expect(f.evidence.snapshot().findings).toEqual([a]);
      f.route("mapB");
      expect(f.observe()).toMatchObject({ ok: true, data: { ok: false, finalState: { mapId: f.root.id, gold: 55 }, interactions: [
        { stepIndex: 0, mapId: f.root.id, eventId: "doorA" },
        { stepIndex: 2, mapId: "mapB", eventId: "shared_npc" },
        { stepIndex: 3, mapId: "mapB", eventId: "exit" },
      ] } });
      const both = f.evidence.snapshot().findings;
      expect(both).toHaveLength(2);
      expect(new Set(both.map(entry => entry.checkId)).size).toBe(2);
      expect(both[0]).toEqual(a);
      expect(both[1]).toMatchObject({ args: a.args, initialState: a.initialState, ownerId: a.ownerId });
      f.observe();
      expect(f.evidence.snapshot().findings).toEqual(both);
      expect(f.evidence.snapshot().attempts.map(attempt => attempt.status)).toEqual(["negative", "negative", "negative", "negative"]);
      expect(f.terminal()).toBe("blocked");
    });

    it.each([false, true])("an exact A repair cannot verify terminal acceptance while B still fails (adopted=%s)", adopted => {
      const f = fixture(adopted);
      f.observe();
      f.route("mapB");
      f.observe();
      f.route("mapA");
      f.repair("mapA");
      expect(f.observe()).toMatchObject({ ok: true, data: { ok: true } });
      // Assert the terminal boundary before inspecting the finding count: baseline
      // falsely reports verified here, even though a fresh B run remains negative.
      expect(f.terminal()).toBe("blocked");
      const b = f.evidence.snapshot().findings[0]!;
      expect(f.evidence.snapshot().findings).toHaveLength(1);
      expect(b.result).toMatchObject({ data: { interactions: expect.arrayContaining([
        { stepIndex: 2, mapId: "mapB", eventId: "shared_npc" },
      ]) } });
      if (adopted) expect(f.evidence.snapshot().requirements[0]?.status).toBe("passed");
      expect(f.evidence.correction("unknown", f.args)).toBeNull();
      expect(f.evidence.correction(b.checkId, { ...f.args, start: { x: 1, y: 1 } })).toBeNull();
      expect(f.evidence.correction(b.checkId, f.args)).toEqual({ name: scene, args: f.args });
      // A real pass dispatched for B's check is not a pass against B's receipt.
      expect(f.observe(b.checkId)).toMatchObject({ ok: true, data: { ok: true } });
      expect(f.evidence.snapshot().findings).toEqual([b]);
      f.route("mapB");
      expect(f.observe(b.checkId)).toMatchObject({ ok: true, data: { ok: false } });
      expect(f.evidence.snapshot().findings).toEqual([b]);
      f.repair("mapB");
      expect(f.observe(b.checkId)).toMatchObject({ ok: true, data: { ok: true } });
      expect(f.evidence.snapshot().findings).toEqual([]);
      f.route("mapA");
      expect(f.observe()).toMatchObject({ ok: true, data: { ok: true } });
      expect(f.terminal()).toBe("verified");
    });

    it("retains separate initial-state ownership for the same map and arguments", () => {
      const f = fixture();
      f.observe();
      const a = f.evidence.snapshot().findings[0]!;
      f.project.session.gold++;
      const otherSeed = structuredClone(f.project.session);
      f.evidence.invalidateAfterWrite();
      f.observe(undefined, otherSeed);
      expect(f.evidence.snapshot().findings).toHaveLength(2);
      f.repair("mapA");
      f.observe(undefined, otherSeed);
      expect(f.evidence.snapshot().findings).toEqual([a]);
      expect(f.terminal()).toBe("blocked");
      f.project.session = structuredClone(f.initialState);
      f.evidence.invalidateAfterWrite();
      f.observe();
      expect(f.terminal()).toBe("verified");
    });

    it("normal session writes and checkId corrections retain B at the terminal boundary", async () => {
      const f = fixture();
      type Call = { name: string; args: Record<string, unknown> };
      const events: SessionEvent[] = [];
      let session: AssistantSession;
      let originalId: string | undefined;
      let bId: string | undefined;
      let both: ReturnType<AssistantSession["getVerificationSnapshot"]> | undefined;
      const patch = (mapId: string, eventId: string, commands: Command[]): Call => {
        const event = f.project.maps[mapId]!.events.find(event => event.id === eventId)!;
        return { name: "upsert_event", args: { mapId, event: { id: eventId,
          pages: [{ ...structuredClone(event.pages![0]!), commands }] } } };
      };
      const route = (mapId: string) => patch(f.root.id, "doorA", [{ kind: "transfer", mapId, x: 2, y: 2 }]);
      const repair = (mapId: string) => patch(mapId, "shared_npc", [{ kind: "changeGold", op: "+=", amount: 20 }]);
      const correction = (checkId: string | undefined): Call => ({ name: "correct_verification", args: { checkId, args: f.args } });
      const probe: Call = { name: scene, args: f.args };
      const rounds: (() => Call[])[] = [
        // 2026-09-17: 세션의 수용 원장은 사라졌다 — plan 의 acceptance 배열은 무시되므로 넣지 않는다.
        () => [{ name: "set_work_plan", args: { goal: "Reward ownership",
          layers: [{ title: "Inspect", items: [{ title: "Reward", instruction: "Check reward", successTools: [scene],
            verificationChecks: [{ tool: scene, args: f.args, interactionTargets: [{ stepIndex: 2, mapId: "mapA", eventId: "shared_npc" }] }] }] }] } }, probe],
        () => {
          originalId = session.getVerificationSnapshot().findings[0]?.checkId;
          return [route("mapB"), probe, probe];
        },
        () => {
          both = session.getVerificationSnapshot();
          bId = both.findings.find(finding => finding.checkId !== originalId)?.checkId;
          return [correction("unknown"), route("mapA"), repair("mapA"), correction(bId), correction(originalId)];
        },
      ];
      let round = 0;
      session = new AssistantSession(f.project, {
        config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 20 },
        declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
        chat: async (_config, request): Promise<ChatResult> => {
          if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
          const calls = rounds.shift()?.();
          round++;
          return calls ? { message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({
            id: `${round}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
          })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
        },
      });
      await session.sendUserMessage("Inspect reward ownership.", event => events.push(event));
      expect(both?.findings).toHaveLength(2);
      expect(both?.requirements).toHaveLength(1);
      expect(originalId).toBe(both?.requirements[0]?.checkId);
      expect(both?.findings[0]?.initialState).toEqual(both?.findings[1]?.initialState);
      expect(both?.findings[0]?.args).toEqual(both?.findings[1]?.args);
      expect(session.getVerificationSnapshot().findings.map(finding => finding.checkId)).toEqual([bId]);
      expect(session.getVerificationSnapshot().requirements[0]?.status).toBe("passed");
      const corrections = events.filter(event => event.type === "tool_call" && event.name === "correct_verification");
      expect(corrections.map(event => event.type === "tool_call" && event.result.ok)).toEqual([false, true, true]);
      expect(corrections[1]).toMatchObject({ result: { data: { ok: true, tool: scene, checkId: bId,
        verification: { findings: both?.findings } } } });
      const writes = events.filter(event => event.type === "tool_call" && event.name === "upsert_event");
      expect(writes.map(event => event.type === "tool_call" && event.result.ok)).toEqual([true, true, true]);
      expect(session.getVerificationSnapshot().attempts.map(attempt => attempt.status)).toEqual(["negative", "negative", "negative", "passed", "passed"]);
      rounds.push(() => [route("mapB"), repair("mapB"), correction(bId), route("mapA"), probe]);
      await session.sendUserMessage("Continue.", event => events.push(event));
      expect(session.getVerificationSnapshot().findings).toEqual([]);
      expect(session.getVerificationSnapshot().requirements).toHaveLength(1);
    });
  });
});

describe("workItemCompletionWaiver", () => {
  isolateTimers();
  function planWith(successTools: readonly string[]): WorkPlan {
    return {
      goal: "마을 손보기",
      currentItemId: "i1",
      layers: [{ id: "l1", title: "레이어", items: [
        { id: "i1", title: "안내원 배치", status: "in_progress", successTools: [...successTools] },
        { id: "i2", title: "간판 세우기", status: "pending" },
      ] }],
    } as unknown as WorkPlan;
  }
  // F4(`.omo/evidence/ai-assistant-failure-modes.md`): 앞선 게이트·스키마 거부로 successTools 기록이
  // 남지 않으면 항목을 영원히 닫을 수 없어, 같은 항목이 예산이 마를 때까지 재시도됐다.
  describe("작업 항목 완료 — 선언한 툴 기록이 비었을 때", () => {
    it("기본값은 그대로 거부하고 누락된 툴을 알려준다", () => {
      const result = completeWorkItemById(planWith(["place_npc"]), "i1", undefined, { successfulTools: ["get_map_info"] });
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.missingTools).toEqual(["place_npc"]);
    });

    it("면제를 켜도 산출물 검사가 막으면 완료되지 않는다", () => {
      const plan = planWith(["place_npc"]);
      const result = completeWorkItemById(plan, "i1", undefined, {
        successfulTools: [],
        waiveMissingTools: true,
        outcomeGate: () => ({ ok: false, reason: "⚠ 미이행: 실제 변경이 없습니다(체인지셋 0건)." }),
      });
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("체인지셋 0건");
      expect(plan.layers[0]!.items[0]!.status).toBe("in_progress");
    });

    it("면제 + 산출물 검사 통과면 닫고, 무엇을 면제했는지 항목에 남긴다", () => {
      const plan = planWith(["place_npc"]);
      const result = completeWorkItemById(plan, "i1", undefined, {
        successfulTools: ["make_villager"],
        waiveMissingTools: true,
        outcomeGate: () => ({ ok: true }),
      });
      expect(result.ok).toBe(true);
      expect(result.ok === true && result.waivedTools).toEqual(["place_npc"]);
      expect(plan.layers[0]!.items[0]!.status).toBe("done");
      expect(plan.layers[0]!.items[0]!.note).toContain("place_npc");
      expect(plan.currentItemId).toBe("i2");
    });

    it("쓰기 기록 자체가 없으면 면제 대상이 아니다", () => {
      const plan = planWith([]);
      plan.layers[0]!.items[0]! = { ...plan.layers[0]!.items[0]!, requiresAnyWrite: true };
      const result = completeWorkItemById(plan, "i1", undefined, {
        successfulTools: [], waiveMissingTools: true, outcomeGate: () => ({ ok: true }),
      });
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("쓰기 툴 기록이 없습니다");
    });

    it("막힌 항목도 유효한 id 목록에 넣는다", () => {
      const plan = planWith(["place_npc"]);
      plan.layers[0]!.items[0]! = { ...plan.layers[0]!.items[0]!, status: "blocked" };
      expect(openWorkItemIds(plan)).toEqual(["i1", "i2"]);
    });
  });
});

describe("yieldToUi", () => {
  isolateTimers();
  describe("defaultYieldToUi", () => {
    let doc: EventTarget & {
      visibilityState: DocumentVisibilityState;
      defaultView: EventTarget;
      hasFocus: () => boolean;
    };
    let focused: boolean;
    let paint: FrameRequestCallback;
    let requestFrame: ReturnType<typeof vi.fn>;
    let cancelFrame: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      focused = true;
      doc = Object.assign(new EventTarget(), {
        visibilityState: "visible" as DocumentVisibilityState,
        defaultView: new EventTarget(),
        hasFocus: () => focused,
      });
      requestFrame = vi.fn((callback: FrameRequestCallback) => {
        paint = callback;
        return 7;
      });
      cancelFrame = vi.fn();
      vi.stubGlobal("document", doc);
      vi.stubGlobal("requestAnimationFrame", requestFrame);
      vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it("보이는 탭에서는 다음 프레임까지 기다리고 폴백을 정리한다", async () => {
      const done = vi.fn();
      const work = defaultYieldToUi().then(done);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled();
      paint(0);
      await work;
      expect(done).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("숨은 탭에서는 프레임과 타이머가 모두 멈춰도 이벤트 루프를 양보한다", async () => {
      doc.visibilityState = "hidden";
      const done = vi.fn();
      const work = defaultYieldToUi().then(done);
      await Promise.resolve();
      expect(done).not.toHaveBeenCalled(); // 즉시 resolve하는 마이크로태스크 루프도 금지.
      // 가짜 타이머를 전진시키지 않는다. 실제 MessageChannel 태스크가 완료해야 한다.
      await work;
      expect(done).toHaveBeenCalledOnce();
      expect(requestFrame).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("프레임을 기다리던 중 탭을 숨겨도 타이머 없이 이어지고 리스너를 정리한다", async () => {
      const removeListener = vi.spyOn(doc, "removeEventListener");
      const done = vi.fn();
      const work = defaultYieldToUi().then(done);
      doc.visibilityState = "hidden";
      doc.dispatchEvent(new Event("visibilitychange"));
      await work;
      expect(cancelFrame).toHaveBeenCalledWith(7);
      expect(removeListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
      paint(0); // 취소 직전 이미 큐에 들어온 콜백도 중복 완료시키지 않는다.
      expect(done).toHaveBeenCalledOnce();
    });

    it("보이지만 포커스가 없는 창도 프레임과 타이머 없이 이어진다", async () => {
      focused = false;
      await defaultYieldToUi();
      expect(requestFrame).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("프레임 대기 중 다른 창으로 포커스를 옮겨도 이어지고 blur 리스너를 정리한다", async () => {
      const removeListener = vi.spyOn(doc.defaultView, "removeEventListener");
      const work = defaultYieldToUi();
      focused = false;
      doc.defaultView.dispatchEvent(new Event("blur"));
      await work;
      expect(cancelFrame).toHaveBeenCalledWith(7);
      expect(removeListener).toHaveBeenCalledWith("blur", expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
    });

    it("보인다고 보고하지만 프레임이 멈추면 타이머로 이어지고 프레임을 취소한다", async () => {
      const work = defaultYieldToUi();
      await vi.advanceTimersByTimeAsync(YIELD_TO_UI_FALLBACK_MS);
      await work;
      expect(cancelFrame).toHaveBeenCalledWith(7);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("rAF 호출이 실패해도 폴백으로 완료한다", async () => {
      requestFrame.mockImplementation(() => { throw new Error("rAF unavailable"); });
      const work = defaultYieldToUi();
      await vi.advanceTimersByTimeAsync(YIELD_TO_UI_FALLBACK_MS);
      await work;
    });

    it.each([undefined, class { constructor() { throw new Error("MessageChannel unavailable"); } }])(
      "MessageChannel을 쓸 수 없는 숨은 탭은 타이머로 양보한다 (%s)",
      async (channel) => {
        vi.stubGlobal("MessageChannel", channel);
        doc.visibilityState = "hidden";
        const work = defaultYieldToUi();
        await vi.runAllTimersAsync();
        await work;
        expect(requestFrame).not.toHaveBeenCalled();
      },
    );

    it("프레임 API가 없는 Node에서는 브라우저 자원 없이 완료한다", async () => {
      vi.stubGlobal("document", undefined);
      vi.stubGlobal("requestAnimationFrame", undefined);
      await defaultYieldToUi();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
