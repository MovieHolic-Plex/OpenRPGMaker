import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { appendConversationBubble } from "@/editor/panels/aiConversationLog";
import { buildAiActivityLogRecord, type AiActivityLogInput, type AiActivityLogRecord } from "@/ai/activityLog";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { installFakeDom } from "./fakeDom";
import { fixture, plan, size, skip, target } from "./requiredOutcomeFixture";
import type { TurnResult } from "@/ai/assistantSession";

const activity = vi.hoisted(() => vi.fn<(input: AiActivityLogInput) => Promise<AiActivityLogRecord>>());
vi.mock("@/ai/activityLog", async original => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: activity,
}));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom(); resetIntentDeclarationCache();
  activity.mockImplementation(async input => buildAiActivityLogRecord(input));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
});
afterEach(() => {
  clearAgentBlueprint(); clearAgentGhostPreview(); resetIntentDeclarationCache();
  activity.mockReset(); restoreDom?.(); vi.restoreAllMocks();
});

function setup() {
  const f = fixture();
  const log = document.createElement("div");
  const noop = () => {};
  const sendText = vi.fn<AiRunSurface["sendText"]>(async () => {});
  const surface: AiRunSurface = {
    panel: document.createElement("div"), log, sendButton: document.createElement("button"),
    controller: { session: f.session, auditHistory: [], statusTimeline: [] },
    turnBusy: false, disposed: false, abortNoticeShown: false, activeAbortController: null,
    collapseAfterAiWork: false, collapsed: false, conversationId: "blocked", conversationScope: "blocked",
    runningPhaseStatus: null, runningProgress: null,
    setStatus: noop, beginTurnProgress: noop, endTurnProgress: noop, refreshRunningStatus: noop,
    refreshAbortButton: noop, startLiveActivity: noop, completeLiveActivity: noop,
    expandForAiWork: noop, scheduleCollapseAfterAiWork: noop, notifyIfObscuredByTestPlay: noop,
    drainPendingSends: noop, persistConversation: noop, sendText,
    appendBubble: (role, text) => appendConversationBubble({ log, role, text, removeStartScreen: noop }),
    appendReasoning: () => ({ box: document.createElement("div"), body: document.createElement("div") }),
    closeToolActivity: noop, clearLastReasoning: noop, isLastReasoningBox: () => false,
  };
  const deps: AiTurnRunnerDeps = {
    surface, applyingProposal: false, projectIdentityId: "blocked", workPlanSurfaceState: null,
    applyProposal: async () => "rejected", noteNoChanges: noop, beginWorkPlanTurn: noop,
    settleWorkPlanTurn: noop, refreshWorkPlanSurface: noop, showWorkPlan: noop, showAcceptance: noop,
    noteWorkPlanActivity: noop, appendMilestoneFeedLine: noop, appendTileThumbs: noop,
    appendTileGrid: noop, appendAiDocument: noop, hasPendingQuestion: () => false,
    openAiSettings: noop, renderQuickReplies: noop, refreshContextMeter: noop,
  };
  return { ...f, log, sendText, surface, runner: createAiTurnRunner(deps) };
}

it("offers the real Continue control when required work blocks without a budget stop", async () => {
  // Given a real canonical unmet requirement, not a test-authored blocked outcome.
  const f = setup();
  // When the real runner settles the actual session result.
  await f.runner.executeTurn(f.session, "Inspect", () => f.run([[plan([size]), skip]]));
  // Then the existing control is mounted by production rendering and forwards a user continuation.
  const button = f.log.querySelector<HTMLButtonElement>("[data-testid=ai-continue-run]");
  expect(button).not.toBeNull();
  button?.click();
  expect(f.sendText).toHaveBeenCalledExactlyOnceWith("계속", undefined, { userResume: true });
});

it("keeps one Continue control when a question follows blocked work", async () => {
  // Given the previous blocked result in this real runner log.
  const f = setup();
  await f.runner.executeTurn(f.session, "Inspect", () => f.run([[plan([size]), skip]]));
  const button = f.log.querySelector("[data-testid=ai-continue-run]");
  f.surface.appendBubble("user", "What remains?");
  expect(button?.closest(".is-collapsed")).not.toBeNull();
  // When an actual Ask response finishes without authorizing resume.
  await f.runner.executeTurn(f.session, "What remains?", () => f.run([], { composerMode: "ask" }), { composerMode: "ask" });
  // Then the same user action leaves the native collapsed history group without duplication.
  expect(f.log.querySelectorAll("[data-testid=ai-continue-run]")).toHaveLength(1);
  expect(f.log.querySelector("[data-testid=ai-continue-run]")).toBe(button);
  expect(button?.closest(".is-collapsed")).toBeNull();
  expect(f.sendText).not.toHaveBeenCalled();
});

it("does not publish a Continue control when the blocked owner is retired", async () => {
  // Given an owned turn that will lose publication ownership.
  const f = setup();
  // When a real blocked result arrives after owner replacement.
  await f.runner.executeTurn(f.session, "Inspect", async () => {
    const result = await f.run([[plan([size]), skip]]);
    f.surface.activeAbortController = new AbortController();
    return result;
  });
  // Then stale completion cannot add a control to the replacement surface.
  expect(f.log.querySelector("[data-testid=ai-continue-run]")).toBeNull();
});

it("publishes the resumed unfinished result instead of the preceding question outcome", async () => {
  // Given blocked requirements followed by a genuine question.
  const f = setup();
  const invalidResize = { name: "resize_map", args: { mapId: target.mapId, width: 1, height: 1 } };
  const source = "Inspect this map";
  await f.run([[plan([size])], [invalidResize], [invalidResize], [invalidResize], [invalidResize]], {}, source);
  const workItemId = f.session.getWorkPlan()?.layers[0]?.items.find(item => item.status === "blocked")?.id;
  if (!workItemId) throw new Error("Missing blocked work item");
  const authoring = f.session.getAcceptanceSnapshot();
  const sizeItem = authoring?.items.find(item => item.id === size.id);
  const sourceItem = authoring?.items.find(item => item.id === "request-1:source:0");
  expect(sourceItem).toMatchObject({ coverage: "uncovered", source: { text: source } });
  expect(sizeItem?.source?.text).toBe(source);
  const authoringRequestId = sizeItem?.source?.requestId;
  if (!authoringRequestId) throw new Error("Missing authoring request id");
  expect(f.session.getWorkPlan()?.layers[0]?.items.find(item => item.id === workItemId)?.status).toBe("blocked");
  const question = await f.run([], { composerMode: "ask" }, "What remains?");
  expect(question.runOutcome?.execution).toBe("response-final");
  expect(question.proposedCalls ?? []).toEqual([]);
  expect(f.session.getWorkPlan()?.layers[0]?.items.find(item => item.id === workItemId)?.status).toBe("blocked");
  const questionOutcome = question.runOutcome;
  const raw = await f.run([], {}, "계속");
  expect(raw.runOutcome?.execution).toBe("response-final");
  expect(f.session.getWorkPlan()?.layers[0]?.items.find(item => item.id === workItemId)?.status).toBe("blocked");
  expect(f.events.some(event => event.type === "work_plan" && event.plan.layers.some(layer =>
    layer.items.some(item => item.id === workItemId && item.status === "in_progress")))).toBe(false);
  let resumed: TurnResult | undefined;
  f.setPlanner(req => req.tools?.length
    ? null
    : { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" });
  await f.runner.executeTurn(f.session, "계속", async () => {
    resumed = await f.run([[{ name: "get_project_summary", args: {} }]], { composerMode: "do", goalAction: "resume" }, "계속");
    return resumed;
  });
  // Then current result, harness, recap, final event and real activity builder agree.
  const expected = { execution: "blocked", goal: "incomplete", delivery: "no-change" };
  expect(resumed?.execution?.requestId).toBe(authoringRequestId);
  expect(f.events.some(event => event.type === "work_plan" && event.plan.layers.some(layer =>
    layer.items.some(item => item.id === workItemId && item.status === "in_progress")))).toBe(true);
  expect(f.session.getWorkPlan()?.goal).toBe("Map contract");
  expect(f.session.getAcceptanceSnapshot()?.items.find(item => item.id === "request-1:source:0")).toMatchObject({
    coverage: "uncovered", source: { text: source },
  });
  expect(f.session.getAcceptanceSnapshot()?.items.find(item => item.id === size.id)?.source?.text).toBe(source);
  expect(f.session.getRunOutcome()).toEqual(expected);
  expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
  expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
  expect(resumed?.runOutcome).toEqual(expected);
  expect(resumed?.recap?.runOutcome).toEqual(expected);
  expect(resumed?.runOutcome).not.toEqual(questionOutcome);
  const finalInput = activity.mock.calls.at(-1)?.[0];
  if (!finalInput) throw new Error("Missing actual runner publication");
  const record = buildAiActivityLogRecord(finalInput);
  expect(record.result.runOutcome).toEqual(expected);
  expect(record.result.recap?.runOutcome).toEqual(expected);
});
