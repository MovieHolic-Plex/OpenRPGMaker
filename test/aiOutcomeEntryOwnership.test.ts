import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { declaredIntent } from "./intentFixture";
import type { IntentDeclarer } from "@/ai/intentDeclarationClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { SessionTurnOptions } from "@/ai/assistantSession";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";

afterEach(async () => {
  try { await drainOutcomeFixtures(); }
  finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory(); resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

const entries: readonly { readonly name: string; readonly text: string; readonly options: SessionTurnOptions; readonly retained: boolean }[] = [
  { name: "fresh request", text: "Inspect the project", options: {}, retained: false },
  { name: "explicit continuation", text: "계속", options: {}, retained: true },
  { name: "Ask continuation token", text: "계속", options: { composerMode: "ask" }, retained: false },
  { name: "new goal continuation token", text: "계속", options: { goalAction: "new-goal" }, retained: false },
  { name: "fresh instruction override", text: "계속", options: { instruction: "Inspect the project" }, retained: false },
  { name: "continuation instruction override", text: "Editor request envelope", options: { instruction: "계속" }, retained: true },
];

describe.each(["cancelled", "failed"] as const)("early %s entry", ending => {
  it.each(entries)("settles delivery for $name before the intent transport can reject", async entry => {
    // Given a genuinely applied and verified prior run in the same session.
    let faultArmed = false;
    const declareIntent = vi.fn<IntentDeclarer>(async (_facts, signal) => {
      // Preserve real transport cancellation, unlike fixedDeclarer which ignores the signal.
      signal?.throwIfAborted();
      if (faultArmed) throw new Error("Intent transport fixture failure");
      return { intent: declaredIntent({ mode: "other" }), elapsedMs: 0 };
    });
    const f = applyFixture(undefined, declareIntent);
    const first = await f.run();
    expect(first.review?.status).toBe("approved");
    expect(f.session.isDraftReviewApproved()).toBe(true);
    const applied = await applyProposedProject(f.session.getProposedProject(), {
      base: f.session.getProposalBase(), baseline: f.session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"],
    });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
    await f.session.proveAppliedRevision();
    expect(first.runOutcome?.delivery).toBe("persisted-verified");
    const receipt = f.session.getRunEndProof()?.receipt;
    expect(receipt).toBeDefined();
    faultArmed = true;
    // Cancellation at entry retires before dispatch; a live failed entry still reaches intent.
    const result = await f.session.sendUserMessage(entry.text, event => f.events.push(event),
      ending === "cancelled" ? AbortSignal.abort() : undefined, entry.options);
    // Then only trusted continuation retains the old owned work, never fresh failed/cancelled requests.
    const expected = { execution: ending, goal: "unassessed", delivery: entry.retained ? "persisted-verified" : "no-change" };
    expect(declareIntent).toHaveBeenCalledTimes(ending === "cancelled" ? 1 : 2);
    expect(result.stoppedReason).toBe(ending === "cancelled" ? "aborted" : "error");
    expect(result.runOutcome).toEqual(expected);
    expect(result.appliedCalls).toHaveLength(entry.retained ? 1 : 0);
    expect(result.proposedCalls).toHaveLength(0);
    expect(result.recap?.runOutcome).toEqual(expected);
    expect(f.session.getRunOutcome()).toEqual(expected);
    expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
    expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
    expect(first.runOutcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "persisted-verified" });
    expect(f.session.getRunEndProof()?.receipt).toBe(receipt);
  });
});
