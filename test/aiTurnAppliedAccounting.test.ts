import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { buildAiActivityLogRecord } from "@/ai/activityLog";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import { createAiRegionTaskRunner } from "@/editor/panels/aiRegionTaskRunner";
import { editorState } from "@/editor/editorState";
import { clearAgentGhostPreview, getAgentGhostPreviewState, type AgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { createProposalHost } from "@/editor/panels/aiProposalCard";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { createBlankProject } from "@/project/defaults";
import { proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import { approvedReview } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";
import { runTool } from "@/editor/tools/toolRunner";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";
import { HISTORICAL_PLACEMENT_CORRECTION } from "./fixtures/placementRequests";
import { isProposalCompletenessWarning } from "@/ai/proposalCompleteness";

const observed = vi.hoisted(() => ({
  activity: vi.fn(async () => ({})),
  preference: vi.fn(() => ({})),
  gate: vi.fn(),
}));
vi.mock("@/ai/activityLog", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/ai/activityLog")>(), recordAiActivity: observed.activity,
}));
vi.mock("@/ai/preferenceSignals", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/ai/preferenceSignals")>(), observeTurn: observed.preference, shouldDistillPreferences: () => false,
}));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: observed.gate }));

let restoreDom: (() => void) | null = null;
beforeEach(() => {
  observed.activity.mockClear(); observed.preference.mockClear(); observed.gate.mockClear();
  restoreDom = installFakeDom();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
});
afterEach(() => { clearAgentGhostPreview(); editorState.set({ currentMapId: null }); restoreDom?.(); vi.restoreAllMocks(); });

function titleCall(title: string): ProposedCall {
  const args = { title };
  const result = runTool({ project: store.getCurrent() }, "set_title_screen", args);
  expect(result.ok, result.summary).toBe(true);
  return { name: "set_title_screen", args, result, summary: result.summary };
}
function setup(sessionOverride?: AssistantSession) {
  const log = document.createElement("div");
  const appendBubble = vi.fn((_role: unknown, text: string) => {
    const bubble = document.createElement("div"); bubble.textContent = text; log.append(bubble); return bubble;
  });
  const session = sessionOverride ?? {
    isDraftReviewApproved: () => true,
    proveAppliedRevision: vi.fn(),
    getCompletionSpecs: () => [],
    getWorkPlan: () => null,
    getActiveSpec: () => null, getAuditEntries: () => [], getProposedProject: () => store.getCurrent(),
  } as unknown as AssistantSession;
  const controller = { session, auditHistory: [] };
  const surface = {
    panel: document.createElement("div"), log, sendButton: document.createElement("button"), controller,
    turnBusy: false, disposed: false, collapsed: false, conversationId: "test-turn", conversationScope: "test-scope",
    appendBubble, setStatus: vi.fn(), expandForAiWork: vi.fn(), beginTurnProgress: vi.fn(), endTurnProgress: vi.fn(),
    refreshAbortButton: vi.fn(), persistConversation: vi.fn(), notifyIfObscuredByTestPlay: vi.fn(), drainPendingSends: vi.fn(),
    startLiveActivity: vi.fn(), closeToolActivity: vi.fn(),
  } as unknown as AiRunSurface;
  const deps = {
    surface, applyingProposal: false, projectIdentityId: "test", workPlanSurfaceState: null,
    beginWorkPlanTurn: vi.fn(), showAcceptance: vi.fn(),
    applyProposal: vi.fn<AiTurnRunnerDeps["applyProposal"]>(async () => "applied"), noteNoChanges: vi.fn(), settleWorkPlanTurn: vi.fn(),
    refreshWorkPlanSurface: vi.fn(), showWorkPlan: vi.fn(), noteWorkPlanActivity: vi.fn(), appendMilestoneFeedLine: vi.fn(),
    appendTileThumbs: vi.fn(), appendTileGrid: vi.fn(), appendAiDocument: vi.fn(), hasPendingQuestion: () => false,
    openAiSettings: vi.fn(), renderQuickReplies: vi.fn(), refreshContextMeter: vi.fn(),
  } satisfies AiTurnRunnerDeps;
  return { deps, session, log, appendBubble, runner: createAiTurnRunner(deps) };
}

describe("panel map completeness selection", () => {
  it("uses the real session's plural selection instead of the most recent spec", async () => {
    const ctx = { project: store.getCurrent() };
    for (const id of ["a", "b"]) expect(runTool(ctx, "create_map", { id, name: id, width: 20, height: 20 }).ok).toBe(true);
    store.replace(ctx.project);
    const calls = [...["a", "b"].map(mapId => ({ name: "set_build_spec", args: { mapId, assets: [
      { id: "paint", kind: "terrain", x: 3, y: 3, w: 3, h: 3 },
      { id: "missing", kind: "prop", x: 15, y: 15, w: 1, h: 1 },
    ] } })), ...["a", "b"].map(mapId => ({ name: "paint_tiles", args: { mapId, from: { x: 3, y: 3 }, to: { x: 4, y: 4 }, mode: "rect", layer: "lower", tile: 281 } }))];
    const session = new AssistantSession(ctx.project, {
      config: { authMode: "apiKey", baseUrl: "x", model: "stub", apiKey: "test", maxToolCalls: 1, maxTokens: 8192 },
      declareIntent: fixedDeclarer({ mode: "modify" }),
      chat: async () => ({ message: { role: "assistant", content: null, tool_calls: calls.map((entry, index) => ({
        id: `c${index}`, type: "function", function: { name: entry.name, arguments: JSON.stringify(entry.args) },
      })) }, finishReason: "tool_calls" }),
    });
    const result = await session.sendUserMessage("Edit both maps");
    expect(result.proposedCalls).toHaveLength(2);
    const expected = proposalCompletenessWarnings({ calls: result.proposedCalls, buildSpecs: session.getCompletionSpecs(result.proposedCalls) });
    expect(expected).toHaveLength(2);
    const selection = vi.spyOn(session, "getCompletionSpecs");
    const h = setup(session);
    await h.runner.executeTurn(session, "Edit both maps", async () => result);
    // The exhausted turn has no independent approval, so even real successful
    // writes must stop before completeness decoration and application.
    expect(selection).not.toHaveBeenCalled();
    expect(h.deps.applyProposal).not.toHaveBeenCalled();
  });
});

describe("running-tool event target forwarding", () => {
  it.each([
    [{ mapId: "a" }, "a"],
    [{ target: { kind: "existing", mapId: "a" } }, "a"],
    [undefined, null],
  ] as const)("uses event target %j rather than the viewed map in chat", async (args, owner) => {
    // Given: the user is now viewing B, but the event may target A.
    const h = setup();
    editorState.set({ currentMapId: "b" });
    let observedState: AgentGhostPreviewState | undefined;
    // When: an in-flight turn delivers tool_started.
    await h.runner.executeTurn(h.session, "inspect target", async onEvent => {
      onEvent({ type: "tool_started", name: "get_map_region", index: 1, args });
      observedState = getAgentGhostPreviewState();
      return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
    });
    // Then: ownership comes from the event; even unknown activity stays in chat.
    expect(observedState).toMatchObject({ runningToolMapId: owner });
    expect(h.deps.surface.startLiveActivity).toHaveBeenCalledWith("get_map_region", 1);
  });

  it("forwards the tool target instead of the viewed map or selected region map", async () => {
    // Given: B is viewed and the region request originated on C.
    const h = setup();
    editorState.set({ currentMapId: "b" });
    let observedState: AgentGhostPreviewState | undefined;
    const regionRunner = createAiRegionTaskRunner({
      surface: h.deps.surface, status: document.createElement("div"), selectionTaskActive: false,
      activeSelectionRegionController: null, activeSelectionRegionKey: null,
      currentSelectionForRegionTask: () => ({ mapId: "c", region: { x: 0, y: 0, width: 2, height: 2 } }),
      refreshContextChips: vi.fn(),
      declareIntent: async () => ({ elapsedMs: 0, intent: {
        mode: "question", space: "none", facility: null, targetMapId: "c", useSelection: true,
        clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: [], summary: "", source: "llm",
      } }),
      runRegion: async options => {
        options.onEvent?.({ type: "tool_started", name: "get_map_region", index: 1, args: { mapId: "a" } });
        observedState = getAgentGhostPreviewState();
        return { ok: true, applied: false, changedCells: 0, changedEvents: 0, clippedCells: 0, proposedCalls: 0, assistantText: "" };
      },
    });
    // When: the region runner delivers activity targeting A.
    await regionRunner.sendSelectionRegionTask("inspect target");
    // Then: neither the viewed map nor the selection replaces the tool target.
    expect(observedState).toMatchObject({ runningToolMapId: "a" });
    expect(h.deps.surface.startLiveActivity).toHaveBeenCalledWith("get_map_region", 1);
  });
});

describe("턴 표면의 이미 적용된 쓰기 정산", () => {
  it.each([
    [HISTORICAL_PLACEMENT_CORRECTION, 0],
    ["기존 나무 10개는 보존하고 꽃 3개 추가해줘", 1],
    ["나무 10개 배치해줘", 1],
    ["이름을 바꿔줘\n[컨텍스트] 현재 맵: 나무 10개 추가해줘 (map_blank_start)", 0],
  ] satisfies ReadonlyArray<readonly [string, number]>)("displays placement warnings only for requested additions: %s", async (requestText, expected) => {
    const h = setup();
    const args = { mapId: store.getCurrent().startMapId, name: "마을" };
    const result = runTool({ project: store.getCurrent() }, "set_map_properties", args);
    expect(result.ok, result.summary).toBe(true);
    await h.runner.executeTurn(h.session, requestText, async () => ({
      assistantText: "", proposedCalls: [],
      appliedCalls: [{ name: "set_map_properties", args, result, summary: result.summary }], stoppedReason: "final",
    }));
    expect(h.appendBubble.mock.calls.filter(([, text]) => isProposalCompletenessWarning(text))).toHaveLength(expected);
  });

  it("활동 로그 변환기와 JSON 왕복이 적용 건수를 보존한다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat", instruction: "타이틀 변경", toolCalls: [], audit: [],
      result: { ok: true, proposedCalls: 0, appliedCalls: 3, stoppedReason: "token-budget" },
    });
    expect(JSON.parse(JSON.stringify(record)).result).toMatchObject({ appliedCalls: 3, proposedCalls: 0 });
  });

  it.each(["max-tool-calls", "token-budget", "error"] as const)("%s 이후 원장만 남아도 변경 없음으로 기록하지 않는다", async (stop) => {
    const h = setup();
    const appliedCalls = [titleCall("첫 제목"), titleCall("최종 제목")];
    const result: TurnResult = { assistantText: "실행을 멈췄습니다.", proposedCalls: [], appliedCalls, stoppedReason: stop };
    await h.runner.executeTurn(h.session, "타이틀을 고쳐줘", async (onEvent) => {
      // 이벤트와 반환 원장은 같은 두 건이다. 4건으로 중복 계산하지 않아야 한다.
      onEvent({ type: "milestone_applied", title: "타이틀", toolCount: 2 });
      return result;
    });
    expect(h.deps.noteNoChanges).not.toHaveBeenCalled();
    expect(h.deps.applyProposal).not.toHaveBeenCalled();
    expect(h.log.textContent).not.toMatch(/변경 제안 없음|변경 없음\(0건\)/);
    expect(observed.gate).not.toHaveBeenCalled();
    expect(observed.preference).toHaveBeenLastCalledWith(expect.objectContaining({ changed: true, toolNames: ["set_title_screen", "set_title_screen"] }));
    expect(observed.activity).toHaveBeenLastCalledWith(expect.objectContaining({
      result: expect.objectContaining({ appliedCalls: 2, proposedCalls: 0 }),
      toolCalls: expect.arrayContaining([expect.objectContaining({ name: "set_title_screen" })]),
    }));
  });

  it("적용이 거부된 제안은 실제 변경으로 세지 않는다", async () => {
    const h = setup();
    h.deps.applyProposal.mockResolvedValue("rejected");
    await h.runner.executeTurn(h.session, "타이틀을 고쳐줘", async () => ({
      assistantText: "제목 변경", proposedCalls: [titleCall("제안 제목")], stoppedReason: "final", review: approvedReview,
    }));
    expect(observed.preference).toHaveBeenLastCalledWith(expect.objectContaining({ changed: false }));
    expect(observed.activity).toHaveBeenLastCalledWith(expect.objectContaining({ result: expect.objectContaining({ appliedCalls: 0 }) }));
  });

  it("원장과 종료 시 적용한 제안을 모두 세되 원장은 다시 적용하지 않는다", async () => {
    const h = setup();
    const pending = titleCall("추가 제목");
    await h.runner.executeTurn(h.session, "타이틀을 고쳐줘", async () => ({
      assistantText: "제목 변경", proposedCalls: [pending], appliedCalls: [titleCall("기존 적용")], stoppedReason: "final", review: approvedReview,
    }));
    expect(h.deps.applyProposal).toHaveBeenCalledWith([pending], expect.anything());
    expect(observed.activity).toHaveBeenLastCalledWith(expect.objectContaining({ result: expect.objectContaining({ appliedCalls: 2, proposedCalls: 1 }) }));
  });

  it("제안 호스트를 직접 호출해도 적용된 턴에는 변경 없음 알림을 만들지 않는다", () => {
    const h = setup();
    const host = document.createElement("div");
    const proposal = createProposalHost({ proposalNoticeHost: host, controller: h.deps.surface.controller, appendBubble: h.appendBubble, setStatus: vi.fn() });
    proposal.noteNoChanges({ assistantText: "", proposedCalls: [], appliedCalls: [titleCall("적용 제목")], stoppedReason: "token-budget" }, ["미완성 목표가 남아 있습니다."]);
    expect(h.appendBubble).not.toHaveBeenCalled();
    expect(host.children).toHaveLength(0);
  });
});


describe("independent review application boundary", () => {
  it.each(["error", "max-tool-calls", "token-budget", "aborted", "final"] as const)("does not replay successful writes from unapproved %s turns", async stoppedReason => {
    const h = setup();
    await h.runner.executeTurn(h.session, "Change title", async () => ({ assistantText: "Unapproved draft",
      proposedCalls: [titleCall("Unapproved")], stoppedReason,
      review: { ...approvedReview, status: stoppedReason === "error" ? "approved" : "unapproved" } }));
    expect(h.deps.applyProposal).not.toHaveBeenCalled();
  });
  it("rejects direct proposal-host application without current session approval", async () => {
    const h = setup();
    vi.spyOn(h.session, "isDraftReviewApproved").mockReturnValue(false);
    const host = createProposalHost({ proposalNoticeHost: document.createElement("div"),
      controller: h.deps.surface.controller, appendBubble: h.appendBubble, setStatus: vi.fn() });
    const before = store.getCurrent();
    expect(await host.applyProposal([titleCall("Unapproved")])).toBe("rejected");
    expect(store.getCurrent()).toBe(before);
  });
});
