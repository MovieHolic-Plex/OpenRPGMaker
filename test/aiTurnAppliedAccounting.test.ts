import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { reviewingChat } from "./aiEpochFixture";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
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
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { approvedReviewResponse, imageDeliveryForRequest } from "./independentReviewFixture";
import { approvedReview } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";
import { runTool } from "@/editor/tools/toolRunner";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";
import { HISTORICAL_PLACEMENT_CORRECTION } from "./fixtures/placementRequests";
import { isProposalCompletenessWarning } from "@/ai/proposalCompleteness";
import { FLOOR_PAINT_ARGS, WALL_PAINT_ARGS, PRESERVED_PAINT_SPEC, preservedPaintContext } from "./fixtures/preservedPaint";

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
function reviewedTitleSession() {
  let round = 0;
  return new AssistantSession(store.getCurrent(), {
    config: { ...defaultAiConfig(), model: "test", liteModel: "test", maxToolCalls: 4 },
    declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => round++ % 2 === 0 ? {
      message: { role: "assistant", content: null, tool_calls: [{ id: `title-${round}`, type: "function",
        function: { name: "set_title_screen", arguments: JSON.stringify({ title: `Title ${round}` }) } }] }, finishReason: "tool_calls",
    } : { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" }),
  });
}
function setup(sessionOverride?: AssistantSession) {
  const log = document.createElement("div");
  const appendBubble = vi.fn((_role: unknown, text: string) => {
    const bubble = document.createElement("div"); bubble.textContent = text; log.append(bubble); return bubble;
  });
  const session = sessionOverride ?? new AssistantSession(store.getCurrent(), { yieldToUi: cooperativeNodeYield });
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
  it.each(["complete", "partial", "invalidated"] as const)("uses current native maintenance facts at terminal UI (%s)", async (coverage) => {
    const ctx = preservedPaintContext();
    store.replace(ctx.project);
    const entries = [
      { name: "set_build_spec", args: PRESERVED_PAINT_SPEC },
      { name: "paint_tiles", args: FLOOR_PAINT_ARGS },
      { name: "paint_tiles", args: { ...WALL_PAINT_ARGS, cells: coverage === "partial" ? WALL_PAINT_ARGS.cells.slice(1) : WALL_PAINT_ARGS.cells } },
      ...(coverage === "invalidated" ? [{ name: "paint_tiles", args: { ...WALL_PAINT_ARGS, tile: 342, cells: [{ x: 0, y: 0 }] } }] : []),
      { name: "repair_acceptance", args: { itemId: "acceptance-contract", criteria: [
        { kind: "targetChange", target: { mapId: "map_basement" }, region: { x: 1, y: 1, w: 10, h: 8 } },
      ] } },
      { name: "show_map_region", args: { mapId: "map_basement", x: 0, y: 0, w: 12, h: 10 } },
    ];
    let writer = 0;
    const session = new AssistantSession(ctx.project, {
      config: { authMode: "apiKey", baseUrl: "x", model: "stub", apiKey: "test", maxToolCalls: 8, maxTokens: 32768 },
      declareIntent: fixedDeclarer({ mode: "modify" }),
      renderImages: async () => [{ label: "Native basement", dataUrl: "data:image/png;base64,AA==" }],
      chat: async (_config, request) => approvedReviewResponse(request) ?? {
        imageDelivery: imageDeliveryForRequest(request),
        message: writer++ === 0 ? { role: "assistant", content: null, tool_calls: entries.map((entry, index) => ({
          id: `p7-${index}`, type: "function", function: { name: entry.name, arguments: JSON.stringify(entry.args) },
        })) } : { role: "assistant", content: "WRITER_SENTINEL" }, finishReason: writer === 1 ? "tool_calls" : "stop",
      },
    });
    const result = await session.sendUserMessage("바닥을 칠하고 기존 벽은 유지해줘");
    expect(result.proposedCalls.map(call => call.result.ok)).toEqual(coverage === "invalidated" ? [true, true, true] : [true, true]);
    const expected = proposalCompletenessWarnings({ calls: result.proposedCalls,
      buildSpecs: session.getCompletionSpecs(result.proposedCalls), project: session.getProposedProject() });
    expect(expected).toHaveLength(coverage === "complete" ? 0 : 1);
    const h = setup(session);
    h.deps.applyProposal.mockImplementation(async () => {
      store.replace(session.getProposedProject());
      return "applied";
    });
    await h.runner.executeTurn(session, "바닥을 칠하고 기존 벽은 유지해줘", async () => result);
    if (coverage === "complete") {
      expect(result.review?.status).toBe("approved");
      expect(h.appendBubble.mock.calls.filter(([, text]) => isProposalCompletenessWarning(text)).map(([, text]) => text)).toEqual(expected);
      expect(result.proposedCalls.flatMap(call => call.result.diff?.warnings ?? []).filter(isProposalCompletenessWarning)).toEqual(expected);
      expect(h.deps.applyProposal).toHaveBeenCalledWith(result.proposedCalls, expect.anything());
      expect(store.getCurrent().maps.map_basement.lowerTiles).toEqual(session.getProposedProject().maps.map_basement.lowerTiles);
    } else {
      // The same native warning reaches independent review; its approval-shaped
      // reply cannot let a partial/invalidated draft cross the panel apply gate.
      expect(result.review?.status).toBe("changes_requested");
      expect(result.review?.findings.filter(finding => isProposalCompletenessWarning(finding.problem)).map(finding => finding.problem)).toEqual(expected);
      expect(h.deps.applyProposal).not.toHaveBeenCalled();
      expect(store.getCurrent().maps.map_basement.lowerTiles).toEqual(ctx.project.maps.map_basement.lowerTiles);
    }
    expect(result.runOutcome?.goal).toBe("incomplete");
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
  });

  it("uses the real session's plural selection instead of the most recent spec", async () => {
    const ctx = { project: store.getCurrent() };
    for (const id of ["a", "b"]) expect(runTool(ctx, "create_map", { id, name: id, width: 20, height: 20 }).ok).toBe(true);
    store.replace(ctx.project);
    const calls = [...["a", "b"].map(mapId => ({ name: "set_build_spec", args: { mapId, assets: [
      { id: "paint", kind: "terrain", x: 3, y: 3, w: 3, h: 3 },
      { id: "missing", kind: "prop", x: 15, y: 15, w: 1, h: 1 },
    ] } })), ...["a", "b"].map(mapId => ({ name: "paint_tiles", args: { mapId, from: { x: 3, y: 3 }, to: { x: 4, y: 4 }, mode: "rect", layer: "lower", tile: 281 } }))];
    const session = new AssistantSession(ctx.project, { yieldToUi: cooperativeNodeYield,
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

  it("keeps this turn's detached appearance handoff out of zero-change failure reporting", async () => {
    const h = setup();
    const before = JSON.stringify(store.getCurrent());
    const result = {
      assistantText: "Review the candidate in the database.",
      proposedCalls: [],
      stoppedReason: "final" as const,
      appearanceGeneration: { status: "generating" as const, appearanceId: "appearance", slot: "face" as const },
    };

    await h.runner.executeTurn(h.session, "캐릭터 외형의 얼굴 그림을 만들어줘", async () => result);

    expect(h.deps.noteNoChanges).not.toHaveBeenCalled();
    expect(h.deps.applyProposal).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(observed.preference).toHaveBeenLastCalledWith(expect.objectContaining({ changed: false }));
  });

  it("does not carry a previous appearance handoff into a later empty turn", async () => {
    const h = setup();
    const pending = {
      assistantText: "", proposedCalls: [], stoppedReason: "final" as const,
      appearanceGeneration: { status: "generating" as const, appearanceId: "appearance", slot: "face" as const },
    };
    await h.runner.executeTurn(h.session, "first", async () => pending);
    h.deps.noteNoChanges.mockClear();

    await h.runner.executeTurn(h.session, "second", async () => ({
      assistantText: "", proposedCalls: [], stoppedReason: "final",
    }));

    expect(h.deps.noteNoChanges).toHaveBeenCalledTimes(1);
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
    const session = reviewedTitleSession();
    const result = await session.sendUserMessage("Change title");
    expect(session.isDraftReviewApproved()).toBe(true);
    const h = setup(session);
    h.deps.applyProposal.mockResolvedValue("rejected");
    await h.runner.executeTurn(h.session, "타이틀을 고쳐줘", async () => result);
    expect(h.deps.applyProposal).toHaveBeenCalledTimes(1);
    expect(observed.preference).toHaveBeenLastCalledWith(expect.objectContaining({ changed: false }));
    expect(observed.activity).toHaveBeenLastCalledWith(expect.objectContaining({ result: expect.objectContaining({ appliedCalls: 0 }) }));
  });

  it("원장과 종료 시 적용한 제안을 모두 세되 원장은 다시 적용하지 않는다", async () => {
    const session = reviewedTitleSession();
    await session.sendUserMessage("Change title");
    expect(session.isDraftReviewApproved()).toBe(true);
    const applied = await applyProposedProject(session.getProposedProject(), {
      base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent",
      summary: "First title", toolNames: ["set_title_screen"],
    });
    if (!applied.ok) throw new Error(applied.issue);
    session.recordAppliedProject(applied); session.rebaseProject(store.getCurrent());
    const result = await session.sendUserMessage("Continue", undefined, undefined, { goalAction: "resume" });
    expect(session.isDraftReviewApproved()).toBe(true);
    const pending = result.proposedCalls[0];
    if (!pending) throw new Error("Second reviewed proposal missing");
    const h = setup(session);
    await h.runner.executeTurn(h.session, "타이틀을 고쳐줘", async () => result);
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


describe("applied baseline across rejected and unrelated requests", () => {
  it.each([false, true])("preserves earlier applied work through the real apply/sync boundary (autonomous=%s)", async autonomous => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
    const project = store.getCurrent();
    let turn = 0, writerRound = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12 },
      declareIntent: fixedDeclarer({ mode: "modify" }),
      yieldToUi: cooperativeNodeYield,
      chat: async (_config, request): Promise<ChatResult> => {
        const review = approvedReviewResponse(request);
        if (review) return turn === 1 ? { message: { role: "assistant", content: "Malformed review" }, finishReason: "stop" } : review;
        if (writerRound++ > 0) return { message: { role: "assistant", content: "Writer finished" }, finishReason: "stop" };
        if (turn === 2) expect(session.getProposedProject().system.titleScreen?.title).toBe("Kept approved title");
        const args = turn === 0 ? { title: "Kept approved title" } : turn === 1 ? { title: "Rejected title" }
          : { showInputHint: !session.getProposedProject().system.titleScreen?.showInputHint };
        return { message: { role: "assistant", content: null, tool_calls: [{ id: `turn-${turn}`, type: "function", function: {
          name: "set_title_screen", arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
      },
    });
    const h = setup(session);
    const host = createProposalHost({ proposalNoticeHost: document.createElement("div"), controller: h.deps.surface.controller,
      appendBubble: h.appendBubble, setStatus: vi.fn() });
    const first = await session.sendUserMessage("Set the title", () => {}, undefined, { autonomous });
    expect(first.review?.status).toBe("approved");
    if (!autonomous) expect(await host.applyProposal(first.proposedCalls)).toBe("applied");
    expect(store.getCurrent().system.titleScreen?.title).toBe("Kept approved title");
    expect(session.baselineProject).toEqual(store.getCurrent());
    expect(session.syncBaselineFromStoreIfClean(store.getCurrent())).toBe(true);
    turn = 1; writerRound = 0;
    const rejected = await session.sendUserMessage("Replace the title", () => {}, undefined, { autonomous });
    expect(rejected.stoppedReason).toBe("error");
    expect(session.getProposedProject().system.titleScreen?.title).toBe("Rejected title");
    expect(session.baselineProject.system.titleScreen?.title).toBe("Kept approved title");
    expect(session.syncBaselineFromStoreIfClean(store.getCurrent())).toBe(false);
    turn = 2; writerRound = 0;
    const unrelated = await session.sendUserMessage("Change only the input hint", () => {}, undefined, { autonomous });
    expect(unrelated.review?.status).toBe("approved");
    if (!autonomous) expect(await host.applyProposal(unrelated.proposedCalls)).toBe("applied");
    expect(store.getCurrent().system.titleScreen?.title).toBe("Kept approved title");
    expect(session.baselineProject).toEqual(store.getCurrent());
    expect(session.getProposedProject()).toEqual(store.getCurrent());
  });
});
