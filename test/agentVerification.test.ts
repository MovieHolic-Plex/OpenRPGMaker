// test/agentVerification.test.ts
// Todo 3 — pure verification-gate module (src/ai/agentVerification.ts).
// Covers: canonical layer→tools selection table, verdict parsing (toolRunner result
// shape {ok, summary, issues, data}), the composed advisory report, and malformed-input
// safety. 재시도/중단 계약은 2026-08-30 에 제거됐다 — 검증은 자문이며 런을 멈추지 않는다. Canonical table below MUST match todo 5's
// integration (map/world → [run_lint, evaluate_game_quality]; quest/story →
// [run_lint, verify_quest]; final → [run_lint, play_walkthrough] or
// [run_lint, verify_quest×all questIds] fallback).

import { describe, expect, it } from "vitest";
import {
  EVALUATE_GAME_QUALITY_TOOL,
  PLAY_WALKTHROUGH_TOOL,
  RUN_LINT_TOOL,
  VERIFY_QUEST_TOOL,
  parseLayerVerdict,
  parseToolVerdict,
  runLayerVerificationReport,
  selectVerificationCalls,
  type LayerDescriptor,
  type ToolResultLike,
  type VerificationCallRecord,
} from "@/ai/agentVerification";

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
    summary: blocked ? "게임 품질 평가 차단" : "게임 품질 평가 통과",
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

  it("evaluate_game_quality blocks ONLY on projectLint errors (data.verdict.blocked)", () => {
    const verdict = parseToolVerdict(EVALUATE_GAME_QUALITY_TOOL, qualityResult(true, [
      { severity: "error", message: "projectLint 오류 1" },
    ]));
    expect(verdict.pass).toBe(false);
    expect(verdict.blockingIssues).toEqual(["projectLint 오류 1"]);
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
