import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import * as activity from "@/ai/activityLog";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { fixedDeclarer } from "./intentFixture";
import { epochRunner, reviewingChat } from "./aiEpochFixture";
import { installFakeDom } from "./fakeDom";

vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
let restoreDom: () => void;
beforeEach(() => {
  restoreDom = installFakeDom();
  vi.spyOn(activity, "recordAiActivity").mockImplementation(async entry => activity.buildAiActivityLogRecord(entry));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  resetMapEditHistory();
});
afterEach(async () => {
  await store.flush(); clearAgentBlueprint(); clearAgentGhostPreview(); resetMapEditHistory();
  restoreDom(); vi.restoreAllMocks();
});

it.each(["current", "stale-base", "retired", "unreviewed"] as const)(
  "requires independent approval and P3 authority for an error result: %s", async boundary => {
    let writerCalls = 0;
    const session = new AssistantSession(store.getCurrent(), {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 4 },
      declareIntent: fixedDeclarer({ mode: "modify", tools: ["set_title_screen"] }),
      yieldToUi: async () => {},
      chat: reviewingChat(async () => {
        if (writerCalls++ === 0) return { message: { role: "assistant", content: null,
          tool_calls: [{ id: "title", type: "function", function: { name: "set_title_screen",
            arguments: JSON.stringify({ title: "APPROVED_ERROR_TITLE" }) } }] }, finishReason: "tool_calls" };
        if (boundary === "unreviewed") throw new Error("Authoring failed before review");
        return { message: { role: "assistant", content: "Writer finished" }, finishReason: "stop" };
      }),
    });
    const host = epochRunner(session);
    const before = structuredClone(store.getCurrent());
    let authored: TurnResult | undefined;
    let errorResult: TurnResult | undefined;
    await host.runner.executeTurn(session, "Change title", async (onEvent, signal) => {
      authored = await session.sendUserMessage("Change title", onEvent, signal);
      expect(authored.proposedCalls).toHaveLength(1);
      if (boundary === "unreviewed") {
        expect(authored.stoppedReason).toBe("error");
        expect(session.isDraftReviewApproved()).toBe(false);
        errorResult = authored;
        return authored;
      }
      expect(authored.review?.status).toBe("approved");
      expect(session.isDraftReviewApproved()).toBe(true);
      expect(session.getRunOperation().signal.aborted).toBe(false);
      // Fault input at the runner's existing execution-result seam. The proposal,
      // review revision, operation and base above are real, not fabricated approval.
      errorResult = { ...authored, stoppedReason: "error", error: "Post-review authoring error" };
      if (boundary === "stale-base") store.update(project => { project.meta.title = "HUMAN_EDIT"; });
      if (boundary === "retired") session.retireRun();
      return errorResult;
    });
    expect(errorResult?.stoppedReason).toBe("error");
    expect(writerCalls).toBe(2);
    if (boundary === "current") {
      expect(host.deps.applyProposal).toHaveBeenCalledTimes(1);
      expect(await vi.mocked(host.deps.applyProposal).mock.results[0]?.value).toBe("applied");
      expect(store.getCurrent().system.titleScreen?.title).toBe("APPROVED_ERROR_TITLE");
      expect(authored?.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen"]);
      expect(authored?.proposedCalls).toEqual([]);
      expect(session.getRunEndProof()).toMatchObject({ status: "failed", verified: false, reason: "disabled" });
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent()).toEqual(before);
    } else {
      expect(authored?.appliedCalls).toEqual([]);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
      expect(store.getCurrent()).toEqual(boundary === "stale-base"
        ? { ...before, meta: { ...before.meta, title: "HUMAN_EDIT" } } : before);
      if (boundary === "stale-base") {
        expect(host.deps.applyProposal).toHaveBeenCalledTimes(1);
        expect(await vi.mocked(host.deps.applyProposal).mock.results[0]?.value).toBe("rejected");
      } else expect(host.deps.applyProposal).not.toHaveBeenCalled();
    }
  },
);
