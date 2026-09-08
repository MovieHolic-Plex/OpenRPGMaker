import { setTimeout, clearTimeout } from "node:timers";
import { vi } from "vitest";
import type { AssistantSession, SessionTurnOptions, TurnResult } from "@/ai/assistantSession";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import { createProposalHost } from "@/editor/panels/aiProposalCard";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { appendConversationBubble } from "@/editor/panels/aiConversationLog";

export function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Deferred not initialized"); };
  let reject: (reason: unknown) => void = () => { throw new Error("Deferred not initialized"); };
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
export async function bounded<T>(promise: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    deadline = setTimeout(() => reject(new Error("Epoch signal deadline")), 10_000);
  })]); }
  finally { clearTimeout(deadline); }
}

/** Public runner and proposal host; tools, mutation, commit, save, proof and UI remain connected. */
export function epochRunner(session: AssistantSession) {
  const noop = () => {};
  const log = document.createElement("div");
  const surface: AiRunSurface = {
    panel: document.createElement("div"), log, sendButton: document.createElement("button"), controller: { session, auditHistory: [], statusTimeline: [] },
    turnBusy: false, disposed: false, abortNoticeShown: false, activeAbortController: null, collapseAfterAiWork: false, collapsed: false,
    conversationId: "epoch", conversationScope: "epoch", runningPhaseStatus: null, runningProgress: null,
    setStatus: vi.fn(), beginTurnProgress: noop, endTurnProgress: noop, refreshRunningStatus: noop, refreshAbortButton: noop,
    startLiveActivity: noop, completeLiveActivity: noop, expandForAiWork: noop, scheduleCollapseAfterAiWork: noop, notifyIfObscuredByTestPlay: vi.fn(),
    drainPendingSends: noop, persistConversation: vi.fn(), sendText: async () => {},
    appendBubble: (role, text) => appendConversationBubble({ log, role, text, removeStartScreen: noop }),
    appendReasoning: () => ({ box: document.createElement("div"), body: document.createElement("div") }), closeToolActivity: noop,
    clearLastReasoning: noop, isLastReasoningBox: () => false,
  };
  const proposal = createProposalHost({ proposalNoticeHost: document.createElement("div"), controller: surface.controller,
    appendBubble: surface.appendBubble, setStatus: surface.setStatus });
  const deps: AiTurnRunnerDeps = { surface, applyingProposal: false, projectIdentityId: "epoch", workPlanSurfaceState: null,
    applyProposal: vi.fn(proposal.applyProposal), noteNoChanges: proposal.noteNoChanges,
    beginWorkPlanTurn: noop, settleWorkPlanTurn: vi.fn(), refreshWorkPlanSurface: noop, showWorkPlan: noop, showAcceptance: noop,
    noteWorkPlanActivity: noop, appendMilestoneFeedLine: noop, appendTileThumbs: noop, appendTileGrid: noop, appendAiDocument: noop,
    hasPendingQuestion: () => false, openAiSettings: noop, renderQuickReplies: vi.fn(), refreshContextMeter: noop };
  const runner = createAiTurnRunner(deps);
  const send = async (text: string, options: SessionTurnOptions = {}) => {
    let result: TurnResult | undefined;
    await runner.executeTurn(session, text, async (onEvent, signal) => {
      result = await session.sendUserMessage(text, onEvent, signal, options);
      return result;
    }, options);
    if (!result) throw new Error("Real session did not settle");
    return result;
  };
  return { runner, surface, deps, proposal, send };
}
