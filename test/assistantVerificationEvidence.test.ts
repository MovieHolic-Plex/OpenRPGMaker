import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { VERIFICATION_TOOL_NAMES } from "@/ai/agentVerification";
import { getTool, runTool } from "@/editor/tools";
import * as applyStore from "@/editor/tools/applyChangesetToStore";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse } from "./independentReviewFixture";

type Call = { name: string; args: Record<string, unknown> };
const lint: Call = { name: "run_lint", args: {} };
const write: Call = { name: "set_title_screen", args: { title: "검증 계약" } };
const complete: Call = { name: "complete_work_item", args: {} };
const clean = { summary: "lint clean", data: { counts: { errors: 0 }, issues: [] } };
const broken = { summary: "lint: error 14건", data: { counts: { errors: 14 }, issues: [] } };

afterEach(() => vi.restoreAllMocks());

function scriptedSession(required: string[], rounds: Call[][], nextRequired?: string[], separateLayers = false) {
  let cursor = 0;
  const items = [required, ...(nextRequired ? [nextRequired] : [])]
    .map((successTools, index) => ({ title: `확인 ${index + 1}`, instruction: "필수 검사 통과", successTools,
      verificationChecks: successTools.filter(tool => VERIFICATION_TOOL_NAMES.has(tool)).flatMap(tool => {
        const calls = rounds.flat().filter(call => call.name === tool);
        const args = tool === "verify_quest" ? calls.find(call => call.args.questId === (index ? "b" : "a"))?.args ?? calls[0]?.args : calls[0]?.args;
        return args ? [{ tool, args, ...(tool === "run_scene_test" ? { interactionTargets: [] } : {}) }] : [];
      }),
    }));
  const plan: Call = { name: "set_work_plan", args: {
    goal: "검증 계약 확인", layers: separateLayers
      ? items.map((item, index) => ({ title: `레이어 ${index + 1}`, items: [item] }))
      : [{ title: "검증", items }],
  } };
  const steps = [[plan], ...rounds];
  const session = new AssistantSession(createBlankProject(), {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
    chat: async (_config, request): Promise<ChatResult> => {
      const review = approvedReviewResponse(request);
      if (review) return review;
      const calls = steps[cursor++];
      return calls ? {
        message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({
          id: `call_${cursor}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
        })) }, finishReason: "tool_calls",
      } : { message: { role: "assistant", content: "작업과 검증을 모두 완료했습니다." }, finishReason: "stop" };
    },
  });
  return session;
}

function completedCalls(events: SessionEvent[]) {
  return events.filter((event) => event.type === "tool_call" && event.name === "complete_work_item")
    .map((event) => event.type === "tool_call" && event.result.ok);
}

describe("필수 검증의 실행 성공과 통과는 별도 계약", () => {
  it.each([
    ["run_lint", {}, broken.data],
    ["check_reachability", { mapId: "map_start", from: { x: 0, y: 0 }, targets: [{ x: 1, y: 1 }] }, { reachable: false, unreachable: [{ x: 1, y: 1 }] }],
    ["verify_quest", { questId: "quest" }, { ok: false, failureReason: "퀘스트 도달 불가" }],
    ["play_walkthrough", { scenario: [{ expect: "ended" }] }, { ok: false, failureReason: "엔딩 미도달" }],
    ["run_scene_test", { mapId: "map_start", start: { x: 0, y: 0 }, steps: [] }, { ok: false, failureReason: "장면 실패" }],
    ["evaluate_game_quality", {}, { verdict: { blocked: true }, integrity: { objective: { issues: [{ severity: "error", message: "참조 오류" }] } } }],
  ] as const)("%s ok:true 실패는 명시·자동 완료 근거가 되지 않고 최종 응답에 남는다", async (name, args, data) => {
    vi.spyOn(getTool(name)!, "run").mockReturnValue({ summary: "검사 실행됨", data });
    const events: SessionEvent[] = [];
    const session = scriptedSession(["set_title_screen", name], [[write, { name, args }, complete]]);
    const result = await session.sendUserMessage("제목을 바꾸고 필수 검증을 확인해줘", (event) => events.push(event));
    expect(completedCalls(events)).toEqual([false]);
    expect(result.workPlan?.layers[0]?.items[0]?.status).not.toBe("done");
    const call = events.find((event) => event.type === "tool_call" && event.name === name);
    expect(call?.type === "tool_call" && call.result.ok).toBe(true);
    expect(result.assistantText).toContain("검증이 아직 통과되지 않았습니다");
    expect(result.assistantText).toContain(name);
    const finalMessage = events.filter((event) => event.type === "assistant_message").at(-1);
    expect(finalMessage).toMatchObject({ type: "assistant_message", content: result.assistantText });
    expect(result.runOutcome).toBeDefined();
    expect(events.at(-1)).toEqual({ type: "run_outcome", runOutcome: result.runOutcome });
  }, 30000);

  it("run_lint 실제 실행 결과도 ok:true를 유지한다", () => {
    const project = createBlankProject();
    project.startMapId = "missing_map";
    const result = runTool({ project }, "run_lint", {});
    expect(result.ok).toBe(true);
    expect((result.data as { counts: { errors: number } }).counts.errors).toBeGreaterThan(0);
  });

  it("같은 검사 재실패는 앞선 성공을 제거하고, 이후 실제 재통과는 복구한다", async () => {
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValueOnce(clean).mockReturnValueOnce(broken).mockReturnValue(clean);
    const events: SessionEvent[] = [];
    const session = scriptedSession(["set_title_screen", "run_lint"], [[write, lint, lint, complete], [lint, complete]]);
    const result = await session.sendUserMessage("검사를 수정하고 재실행해줘", (event) => events.push(event));
    expect(completedCalls(events)).toEqual([false, true]);
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(result.assistantText).not.toContain("검증이 아직 통과되지 않았습니다");
  });

  it("쓰기 이후에는 이전 검증 성공으로 완료할 수 없고 다시 검사해야 한다", async () => {
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue(clean);
    const events: SessionEvent[] = [];
    const session = scriptedSession(["set_title_screen", "run_lint"], [[lint, write, complete], [lint, complete]]);
    const result = await session.sendUserMessage("검사 후 제목을 바꾸고 재검사해줘", (event) => events.push(event));
    expect(completedCalls(events)).toEqual([false, true]);
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
  });

  it("재검사 없는 쓰기는 최종 보고에서도 검증 통과로 남지 않는다", async () => {
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue(clean);
    const session = scriptedSession(["set_title_screen", "run_lint"], [[lint, write, complete]]);
    const result = await session.sendUserMessage("검사 후 제목을 바꿔줘");
    expect(result.workPlan?.layers[0]?.items[0]?.status).not.toBe("done");
    expect(result.assistantText).toContain("run_lint: 변경 후 재검증 필요");
  });

  it("실행되지 않은 잘못된 인자는 고친 호출로 복구할 수 있다", async () => {
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue(clean);
    const events: SessionEvent[] = [];
    const session = scriptedSession(["set_title_screen", "run_lint"], [
      [write, lint, { ...lint, args: { reachability: false } }, complete], [lint, complete],
    ]);
    const result = await session.sendUserMessage("검사 인자를 고쳐서 다시 확인해줘", (event) => events.push(event));
    expect(events.filter((event) => event.type === "tool_call" && event.name === "run_lint")
      .map((event) => event.type === "tool_call" && event.result.ok)).toEqual([true, false, true]);
    expect(completedCalls(events)).toEqual([false, true]);
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(result.assistantText).not.toContain("검증이 아직 통과되지 않았습니다");
  });

  it("warning-only lint는 통과하며 거부된 쓰기는 성공 근거를 무효화하지 않는다", async () => {
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue({ summary: "경고 1건", data: { counts: { errors: 0 }, issues: [{ severity: "warning", message: "권고" }] } });
    const events: SessionEvent[] = [];
    const session = scriptedSession(["set_title_screen", "run_lint"], [[write, lint, { ...write, args: { invalid: true } }, complete]]);
    const result = await session.sendUserMessage("제목과 검사를 확인해줘", (event) => events.push(event));
    expect(events.filter((event) => event.type === "tool_call" && event.name === write.name)
      .map((event) => event.type === "tool_call" && event.result.ok)).toEqual([true, false]);
    expect(completedCalls(events)).toEqual([true]);
    expect(result.assistantText).not.toContain("검증이 아직 통과되지 않았습니다");
  });

  it("레이어의 선재 lint 오류는 자문을 유지하면서 최종 응답에 보고한다", async () => {
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue(broken);
    // Pure read milestone: no apply, flush, remote load or DB writes.
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(false);
    const session = scriptedSession(["get_project_summary"], [[{ name: "get_project_summary", args: {} }, complete]]);
    const result = await session.sendUserMessage("프로젝트를 확인해줘", () => {}, undefined, { autonomous: true });
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text.includes("agent_run:verification-advisory"))).toBe(true);
    expect(result.assistantText).toContain("lint 오류 14건");
  });

  it.each([false, true])("final assessment reruns earlier quality on the current artifact without replaying work (explicit=%s)", async (explicit) => {
    const qualityTool = getTool("evaluate_game_quality");
    const lintTool = getTool("run_lint");
    if (!qualityTool || !lintTool) throw new Error("Required verification tool missing");
    const quality = vi.spyOn(qualityTool, "run")
      .mockReturnValue({ summary: "품질 통과", data: { verdict: { blocked: false } } });
    vi.spyOn(lintTool, "run").mockReturnValue(clean);
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(false);
    // Persistence is outside this test: keep the real tool/plan/advisory order,
    // but apply the second layer's draft through an in-memory boundary.
    vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async (applied) => ({
      ok: true, applied,
      commit: { commitId: null, persisted: false, reviewStatus: "approved", summary: "test", toolNames: [], recordedAt: "2026-09-05T00:00:00.000Z" },
    }));
    const session = scriptedSession(["get_project_summary"], [
      [...(explicit ? [{ name: "evaluate_game_quality", args: {} }] : []), { name: "get_project_summary", args: {} }, complete],
      [write, complete],
    ], ["set_title_screen"], true);
    const result = await session.sendUserMessage("프로젝트 확인 후 제목을 수정해줘", () => {}, undefined, { autonomous: true });
    expect(result.workPlan?.layers.flatMap((layer) => layer.items.map((item) => item.status))).toEqual(["done", "done"]);
    expect(quality.mock.calls[0]?.[0]).not.toEqual(session.getProposedProject());
    expect(quality.mock.calls.at(-1)?.[0]).toEqual(session.getProposedProject());
    expect(result.completionAssessment?.checks.map(check => check.name)).toEqual(["run_lint", "evaluate_game_quality"]);
    expect(result.completionAssessment?.verification).toEqual([]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen"]);
  });

  it("다음 항목은 자기 대상의 검증으로 완료하며 이전 항목의 stale 검사는 최종 보고에 보존한다", async () => {
    vi.spyOn(getTool("verify_quest")!, "run").mockReturnValue({ summary: "완주", data: { ok: true } });
    const events: SessionEvent[] = [];
    const session = scriptedSession(["verify_quest"], [
      [{ name: "verify_quest", args: { questId: "a" } }, complete],
      [write, { name: "verify_quest", args: { questId: "b" } }, complete],
    ], ["set_title_screen", "verify_quest"]);
    const result = await session.sendUserMessage("퀘스트를 각각 확인해줘", (event) => events.push(event));
    expect(completedCalls(events)).toEqual([true, true]);
    expect(result.workPlan?.layers[0]?.items.map((item) => item.status)).toEqual(["done", "done"]);
    expect(result.assistantText).toContain("verify_quest: 변경 후 재검증 필요");
  });

  it("실패한 walkthrough 실행은 레이어의 성공 시나리오로 기록하지 않는다", async () => {
    const play = vi.spyOn(getTool("play_walkthrough")!, "run")
      .mockReturnValue({ summary: "워크스루 실행됨", data: { ok: false, failureReason: "엔딩 미도달" } });
    vi.spyOn(getTool("run_lint")!, "run").mockReturnValue(clean);
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(false);
    const session = scriptedSession(["get_project_summary"], [[
      { name: "play_walkthrough", args: { scenario: [{ expect: "ended" }] } },
      { name: "get_project_summary", args: {} }, complete,
    ]]);
    const result = await session.sendUserMessage("프로젝트를 확인해줘", () => {}, undefined, { autonomous: true });
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(play).toHaveBeenCalledTimes(1);
    expect(result.assistantText).toContain("play_walkthrough: 엔딩 미도달");
  });
});

describe("verification ownership regression", () => {
  it("does not turn a successful unowned dummy probe into an obligation after removal", () => {
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_scene_test", { mapId: "cellar", start: { x: 6, y: 3 },
      steps: [{ kind: "interact", eventId: "ev_dummy_fix" }] }, { ok: true, data: { ok: true } });
    evidence.invalidateAfterWrite();
    expect(evidence.problems()).toEqual([]);
  });

  it.each([false, true])("records wire281 no-selected-target setup without a promise (unrelated autorun=%s)", autorun => {
    const project = createBlankProject();
    if (autorun) project.maps[project.startMapId]!.events.push({ id: "ambient-auto", x: 0, y: 0, trigger: { kind: "auto" }, commands: [] });
    const args = { mapId: project.startMapId, start: { x: 6, y: 3 },
      steps: [{ kind: "face", dir: "down" }, { kind: "interact" }] };
    const result = runTool({ project }, "run_scene_test", args);
    expect(result).toMatchObject({ ok: true, data: { ok: false,
      setupFailure: { kind: "no-interaction-target", stepIndex: 1, mapId: project.startMapId } } });
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_scene_test", args, result);
    expect(evidence.problems()).toEqual([]);
  });
});

describe("검증 근거의 대상과 변경 수명", () => {
  it("reports the exact stale scope when a different destination is rechecked", () => {
    const evidence = new ToolVerificationEvidence();
    const from = { x: 24, y: 114 };
    const frontage = { mapId: "world", from, targets: [{ x: 24, y: 115 }] };
    const guide = { mapId: "world", from, targets: [{ x: 24, y: 116 }] };
    const passing = { ok: true, data: { reachable: true } };
    const checkId = JSON.stringify(["check_reachability", frontage]);
    const ownerId = "frontage-owner";
    evidence.adopt({ checkId, ownerId, name: "check_reachability", args: frontage });
    evidence.observe("check_reachability", frontage, passing, "explicit", ownerId, checkId);
    const original = evidence.snapshot().requirements[0]!;
    expect(original).toMatchObject({ checkId, ownerId, args: frontage, status: "passed" });
    expect(evidence.snapshot().attempts[0]?.status).toBe("passed");
    evidence.invalidateAfterWrite();
    expect(evidence.snapshot().requirements).toEqual([{ ...original, status: "stale" }]);
    evidence.observe("check_reachability", guide, passing, "explicit", "guide-owner");
    expect(evidence.snapshot().attempts.at(-1)).toMatchObject({ args: guide, status: "passed" });
    expect(evidence.snapshot().requirements).toEqual([{ ...original, status: "stale" }]);
    expect(evidence.passed("check_reachability")).toBe(false);
    expect(evidence.problems().join("\n")).toContain(JSON.stringify(["check_reachability", frontage]));
    expect(evidence.problems().join("\n")).not.toContain(JSON.stringify(["check_reachability", guide]));
    evidence.observe("check_reachability", frontage, passing, "explicit", ownerId, checkId);
    expect(evidence.snapshot().requirements).toEqual([original]);
    expect(evidence.snapshot().attempts).toHaveLength(3);
    expect(evidence.snapshot().attempts.every(attempt => attempt.status === "passed")).toBe(true);
    expect(evidence.passed("check_reachability")).toBe(true);
    expect(evidence.problems()).toEqual([]);
  });

  it("실제 advisory 실패는 보고하며 같은 대상의 자동 재통과로 해소한다", () => {
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, { ok: true, ...broken }, "advisory");
    evidence.invalidateAfterWrite();
    expect(evidence.snapshot().findings).toHaveLength(1);
    expect(evidence.snapshot().findings[0]?.verdict.blockingIssues).toHaveLength(1);
    evidence.observe("run_lint", {}, { ok: true, ...clean }, "advisory");
    evidence.invalidateAfterWrite();
    expect(evidence.problems()).toEqual([]);
  });

  it("다른 대상의 성공은 실패를 덮지 않으며, 인자 키 순서가 달라도 같은 대상을 재검증한다", () => {
    const evidence = new ToolVerificationEvidence();
    evidence.observe("check_reachability", { mapId: "a", from: { x: 0, y: 0 }, targets: [{ x: 2, y: 2 }] }, { ok: true, data: { reachable: false } });
    evidence.observe("check_reachability", { mapId: "b", from: { x: 0, y: 0 }, targets: [{ x: 2, y: 2 }] }, { ok: true, data: { reachable: true } });
    expect(evidence.passed("check_reachability")).toBe(false);
    evidence.observe("check_reachability", { from: { y: 0, x: 0 }, mapId: "a", targets: [{ y: 2, x: 2 }] }, { ok: true, data: { reachable: true } });
    expect(evidence.passed("check_reachability")).toBe(true);
    expect(evidence.problems()).toEqual([]);
  });

  it("새 프로젝트 변경 뒤 모든 검사 대상은 stale이며 각 대상을 재검사해야 한다", () => {
    const evidence = new ToolVerificationEvidence();
    for (const questId of ["a", "b"]) {
      evidence.adopt({ checkId: questId, ownerId: "goal", name: "verify_quest", args: { questId } });
      evidence.observe("verify_quest", { questId }, { ok: true, data: { ok: true } });
    }
    evidence.invalidateAfterWrite();
    evidence.observe("verify_quest", { questId: "a" }, { ok: true, data: { ok: true } });
    expect(evidence.passed("verify_quest")).toBe(false);
    evidence.observe("verify_quest", { questId: "b" }, { ok: true, data: { ok: true } });
    expect(evidence.passed("verify_quest")).toBe(true);
    evidence.clear();
    expect(evidence.problems()).toEqual([]);
    expect(evidence.passed("verify_quest")).toBe(false);
  });
});
