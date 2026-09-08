import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type SessionTurnOptions, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { appendConversationBubble } from "@/editor/panels/aiConversationLog";
import { buildAiActivityLogRecord } from "@/ai/activityLog";
import * as apply from "@/editor/tools/applyChangesetToStore";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { installFakeDom } from "./fakeDom";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse } from "./independentReviewFixture";

// Telemetry is not the apply boundary. Session, registered tools, runner, apply and undo stay real.
vi.mock("@/ai/activityLog", async original => ({
  ...await original<typeof import("@/ai/activityLog")>(),
  recordAiActivity: vi.fn(async input => buildAiActivityLogRecord(input)),
}));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  resetMapEditHistory();
});
afterEach(async () => {
  await store.flush();
  clearAgentBlueprint(); clearAgentGhostPreview(); resetMapEditHistory();
  _resetEditActivityForTest(); resetIntentDeclarationCache();
  restoreDom?.(); vi.restoreAllMocks();
});
const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
const tool = (name: string, args: unknown): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 } as const;

// Derived from the archived final-review probe: actual runner with the repository fake DOM.
function runnerFor(session: AssistantSession) {
  const noop = () => {};
  const log = document.createElement("div");
  const applyProposal = vi.fn<AiTurnRunnerDeps["applyProposal"]>(async calls => {
    expect(session.isDraftReviewApproved()).toBe(true);
    const applied = await apply.applyProposedProject(session.getProposedProject(), {
      base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "R1 title", toolNames: calls.map(call => call.name),
    });
    if (!applied.ok) throw new Error(applied.issue);
    session.recordAppliedProject(applied);
    session.rebaseProject(store.getCurrent());
    return "applied";
  });
  const surface: AiRunSurface = {
    panel: document.createElement("div"), log, sendButton: document.createElement("button"), controller: { session, auditHistory: [], statusTimeline: [] },
    turnBusy: false, disposed: false, abortNoticeShown: false, activeAbortController: null, collapseAfterAiWork: false, collapsed: false,
    conversationId: "r1-ask", conversationScope: "r1-ask", runningPhaseStatus: null, runningProgress: null,
    setStatus: noop, beginTurnProgress: noop, endTurnProgress: noop, refreshRunningStatus: noop, refreshAbortButton: noop,
    startLiveActivity: noop, completeLiveActivity: noop, expandForAiWork: noop, scheduleCollapseAfterAiWork: noop, notifyIfObscuredByTestPlay: noop,
    drainPendingSends: noop, persistConversation: noop, sendText: async () => {},
    appendBubble: (role, text) => appendConversationBubble({ log, role, text, removeStartScreen: noop }),
    appendReasoning: () => ({ box: document.createElement("div"), body: document.createElement("div") }), closeToolActivity: noop,
    clearLastReasoning: noop, isLastReasoningBox: () => false,
  };
  const deps: AiTurnRunnerDeps = { surface, applyingProposal: false, projectIdentityId: "r1-ask", workPlanSurfaceState: null, applyProposal,
    noteNoChanges: noop, beginWorkPlanTurn: noop, settleWorkPlanTurn: noop, refreshWorkPlanSurface: noop, showWorkPlan: noop, showAcceptance: noop,
    noteWorkPlanActivity: noop, appendMilestoneFeedLine: noop, appendTileThumbs: noop, appendTileGrid: noop, appendAiDocument: noop,
    hasPendingQuestion: () => false, openAiSettings: noop, renderQuickReplies: noop, refreshContextMeter: noop };
  const runner = createAiTurnRunner(deps);
  async function send(text: string, options: SessionTurnOptions = {}, abortTitle?: string) {
    let result: TurnResult | undefined;
    await runner.executeTurn(session, text, async (onEvent, signal) => {
      result = await session.sendUserMessage(text, event => {
        onEvent(event);
        if (event.type === "tool_call" && event.name === "set_title_screen" && event.result.ok && event.args.title === abortTitle) {
          surface.activeAbortController?.abort();
        }
      }, signal, options);
      return result;
    }, options);
    if (!result) throw new Error("Runner did not receive session result");
    return result;
  }
  return { runner, applyProposal, surface, send };
}

it.each(["explicit", "inferred", "inferred-plan"] as const)("does not apply a cancelled successful draft during %s Ask, then resumes once", async mode => {
  // Given: a successful real tool in the detached draft, cancelled at its subscribed result event.
  let round = 0;
  let asking = false;
  const session = new AssistantSession(store.getCurrent(), { config,
    declareIntent: facts => fixedDeclarer({ mode: asking && mode !== "explicit" ? "question" : "other" })(facts),
    chat: async (_config, request) => approvedReviewResponse(request) ?? (round++ === 0 ? tool("set_title_screen", { title: "CANCELLED_DRAFT" }) : final) });
  const f = runnerFor(session);
  const actualApply = vi.spyOn(apply, "applyProposedProject");
  const before = structuredClone(store.getCurrent());
  const cancelled = await f.send("Set title", {}, "CANCELLED_DRAFT");
  expect(cancelled.stoppedReason).toBe("aborted");
  expect(cancelled.proposedCalls.map(call => call.name)).toEqual(["set_title_screen"]);
  expect(actualApply).toHaveBeenCalledTimes(0);
  expect(session.syncBaselineFromStoreIfClean(store.getCurrent())).toBe(false);
  asking = true;
  // When: the same runner/session answers Ask without new tool calls.
  const question = await f.send("Why did you stop?", { composerMode: mode === "explicit" ? "ask" : mode === "inferred-plan" ? "plan" : "do" });
  // Then: retained work is not current proposal authority or query delivery.
  expect(f.applyProposal).toHaveBeenCalledTimes(0);
  expect(actualApply).toHaveBeenCalledTimes(0);
  expect(store.getCurrent()).toEqual(before);
  expect(question.proposedCalls).toEqual([]);
  expect(question.runOutcome?.delivery).toBe("no-change");
  expect(question.recap?.runOutcome).toEqual(question.runOutcome);
  expect(session.getHarnessSnapshot().runOutcome).toEqual(question.runOutcome);
  expect(session.syncBaselineFromStoreIfClean(store.getCurrent())).toBe(false);
  expect(session.getProposedProject().system.titleScreen?.title).toBe("CANCELLED_DRAFT");
  // A genuine explicit resume authorizes the retained draft, not a replayed tool.
  asking = false;
  const resumed = await f.send("Continue", { composerMode: "do", goalAction: "resume" });
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
  expect(actualApply).toHaveBeenCalledTimes(1);
  expect(store.getCurrent().system.titleScreen?.title).toBe("CANCELLED_DRAFT");
  expect(resumed.proposedCalls).toEqual([]);
  expect(resumed.appliedCalls?.map(call => call.args.title)).toEqual(["CANCELLED_DRAFT"]);
  await f.send("Continue", { goalAction: "resume" });
  expect(actualApply).toHaveBeenCalledTimes(1);
  expect(session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "set_title_screen")).toHaveLength(1);
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
});

it("keeps ordinary Do auto-apply and pending/applied coexistence without replay", async () => {
  // Given: a real first milestone and a second write cancelled before ordinary application.
  const responses = [tool("set_work_plan", { goal: "Titles", layers: [{ title: "Titles", items: [
    { title: "First", instruction: "First title", successTools: ["set_title_screen"] },
  ] }] }), tool("set_title_screen", { title: "APPLIED_FIRST" }), final, tool("set_title_screen", { title: "PENDING_SECOND" })];
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: async (_config, request) => approvedReviewResponse(request)
      ?? (!request.tools?.length ? { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" }
        : responses[round++] ?? final) });
  const f = runnerFor(session);
  const actualApply = vi.spyOn(apply, "applyProposedProject");
  const first = await f.send("Set title", { autonomous: true });
  expect(first.review?.status).toBe("approved");
  const result = await f.send("Continue", { goalAction: "resume" }, "PENDING_SECOND");
  expect(result.runOutcome?.delivery).toBe("draft");
  expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["APPLIED_FIRST"]);
  expect(result.proposedCalls.map(call => call.args.title)).toEqual(["PENDING_SECOND"]);
  expect(store.getCurrent().system.titleScreen?.title).toBe("APPLIED_FIRST");
  expect(actualApply).toHaveBeenCalledTimes(1);
  // When: ordinary Do resumes the retained work without another successful write.
  await f.send("Continue", { goalAction: "resume" });
  // Then: the pending call alone reaches ordinary apply; the milestone is not replayed.
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
  expect(f.applyProposal.mock.calls[0]?.[0].map(call => call.args.title)).toEqual(["PENDING_SECOND"]);
  expect(actualApply).toHaveBeenCalledTimes(2);
  expect(store.getCurrent().system.titleScreen?.title).toBe("PENDING_SECOND");
});

it("guards ordinary Ask apply even when an executor returns retained proposal calls", async () => {
  // Given: the real session's unapplied write, supplied by an executor without question filtering.
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    chat: async () => tool("set_title_screen", { title: "UNAUTHORIZED" }) });
  session.updateConfig({ ...config, maxToolCalls: 1 });
  const draft = await session.sendUserMessage("Set title");
  const f = runnerFor(session);
  const before = structuredClone(store.getCurrent());
  // When: the host has explicitly selected Ask.
  await f.runner.executeTurn(session, "Why?", async () => draft, { composerMode: "ask" });
  // Then: proposal count alone cannot override the host's authorization.
  expect(f.applyProposal).toHaveBeenCalledTimes(0);
  expect(store.getCurrent()).toEqual(before);
});

it.each(["explicit", "inferred"] as const)("does not milestone-apply retained acceptance work in autonomous %s Ask", async mode => {
  // Given: finished scheduling and a real canonical contract, with an unapplied successful write.
  const map = store.getCurrent().maps[store.getCurrent().startMapId];
  if (!map) throw new Error("Missing fixture map");
  const responses = [tool("set_work_plan", { goal: "Inspect", requirements: [{ id: "size", title: "Size",
    criteria: [{ kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.height }] }],
    layers: [{ title: "Inspect", items: [{ title: "Inspect", instruction: "Inspect" }] }],
  }), tool("skip_work_item", {}), tool("set_title_screen", { title: "ACCEPTANCE_DRAFT" })];
  let round = 0;
  let asking = false;
  const session = new AssistantSession(store.getCurrent(), { config,
    declareIntent: facts => fixedDeclarer({ mode: asking && mode === "inferred" ? "question" : "other" })(facts),
    chat: async () => responses[round++] ?? final });
  const f = runnerFor(session);
  const actualApply = vi.spyOn(apply, "applyProposedProject");
  const cancelled = await f.send("Inspect", {}, "ACCEPTANCE_DRAFT");
  expect(cancelled.proposedCalls).toHaveLength(1);
  expect(session.getAcceptanceSnapshot()).not.toBeNull();
  expect(actualApply).toHaveBeenCalledTimes(0);
  const before = structuredClone(store.getCurrent());
  asking = true;
  // When: an autonomous question reaches the final acceptance boundary with no new writes.
  const question = await f.send("Why?", { autonomous: true, composerMode: mode === "explicit" ? "ask" : "do" });
  // Then: neither milestone nor ordinary apply is authorized by retained acceptance work.
  expect(actualApply).toHaveBeenCalledTimes(0);
  expect(f.applyProposal).toHaveBeenCalledTimes(0);
  expect(store.getCurrent()).toEqual(before);
  expect(question.proposedCalls).toEqual([]);
  expect(question.runOutcome?.delivery).toBe("no-change");
  expect(session.syncBaselineFromStoreIfClean(store.getCurrent())).toBe(false);
});

it("keeps retained calls unauthorized when explicit Ask fails before intent", async () => {
  // Given: a cancelled draft and a fallible preparation boundary on the next send.
  let fail = false;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    prepareProjectWiki: async () => { if (fail) throw new Error("R1_PREPARATION_FAULT"); return undefined; },
    chat: async () => tool("set_title_screen", { title: "EARLY_DRAFT" }) });
  const f = runnerFor(session);
  await f.send("Set title", {}, "EARLY_DRAFT");
  fail = true;
  // When: explicit Ask cannot finish preparation.
  const result = await f.send("Why?", { composerMode: "ask" });
  // Then: even the failed result offers no apply authority, and the work is not discarded.
  expect(result.stoppedReason).toBe("error");
  expect(result.proposedCalls).toEqual([]);
  expect(f.applyProposal).toHaveBeenCalledTimes(0);
  expect(session.syncBaselineFromStoreIfClean(store.getCurrent())).toBe(false);
});
