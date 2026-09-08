import { afterEach, expect, it, vi } from "vitest";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { TurnResult } from "@/ai/assistantSession";

afterEach(async () => {
  try { await drainOutcomeFixtures(); }
  finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory(); resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

const cases = [
  { action: "continue", verified: false, delivery: "persisted", calls: 1 },
  { action: "continue", verified: true, delivery: "persisted-verified", calls: 1 },
  { action: "proof-retry", verified: false, delivery: "persisted-verified", calls: 1 },
  { action: "query", verified: true, delivery: "no-change", calls: 0 },
  { action: "ask", verified: true, delivery: "no-change", calls: 0 },
] as const;
it.each(cases)("preserves delivery ownership for $action with verified=$verified", async spec => {
  // Given actual ordinary application and a real accepted receipt in this session.
  const f = applyFixture();
  const first = await f.run();
  expect(first.review?.status).toBe("approved");
  expect(f.session.isDraftReviewApproved()).toBe(true);
  const applied = await applyProposedProject(f.session.getProposedProject(), { base: f.session.getProposalBase(), baseline: f.session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
  if (!applied.ok) throw new Error(applied.issue);
  f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
  if (!spec.verified) f.setProofResponse(() => Response.json([], { status: 503 }));
  await f.session.proveAppliedRevision();
  expect(first.runOutcome?.delivery).toBe(spec.verified ? "persisted-verified" : "persisted");
  const receipt = f.session.getRunEndProof()?.receipt;
  expect(receipt).toBeDefined();
  f.setProofResponse();
  const actions = {
    continue: () => f.session.sendUserMessage("계속", event => f.events.push(event)),
    "proof-retry": () => f.session.retryLastTurn(event => f.events.push(event)),
    query: () => f.session.sendUserMessage("Inspect the current project", event => f.events.push(event)),
    ask: () => f.session.sendUserMessage("계속", event => f.events.push(event), undefined, { composerMode: "ask" }),
  } satisfies Record<typeof cases[number]["action"], () => Promise<TurnResult>>;
  // When the actual public continuation, proof-retry or fresh-query boundary runs.
  const result = await actions[spec.action]();
  // Then only trusted continuation/retry retains the owned receipt and calls; fresh queries cannot borrow them.
  const expected = { execution: "response-final", goal: "unassessed", delivery: spec.delivery };
  expect(result.runOutcome).toEqual(expected);
  expect(result.appliedCalls).toHaveLength(spec.calls);
  expect(result.proposedCalls).toHaveLength(0);
  expect(result.recap?.runOutcome).toEqual(expected);
  expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
  expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
  expect(f.session.getRunEndProof()?.receipt).toBe(receipt);
});

it.each(["continue", "query"] as const)("distinguishes %s after a failed milestone proof", async action => {
  // Given a completed native milestone whose accepted save has a failed proof.
  let round = 0;
  const f = applyFixture(async () => {
    if (round++ === 0) return { message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: {
      name: "set_work_plan", arguments: JSON.stringify({ goal: "Title", layers: [{ title: "Title", items: [
        { title: "Title", instruction: "Set title", successTools: ["set_title_screen"] },
      ] }] }),
    } }] }, finishReason: "tool_calls" };
    if (round === 2) return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
      name: "set_title_screen", arguments: JSON.stringify({ title: "Owned milestone" }),
    } }] }, finishReason: "tool_calls" };
    return { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
  });
  f.setProofResponse(() => Response.json([], { status: 503 }));
  const first = await f.session.sendUserMessage("Set title", event => f.events.push(event), undefined, { autonomous: true });
  expect(first.runOutcome?.delivery).toBe("persisted");
  const receipt = f.session.getRunEndProof()?.receipt;
  f.setProofResponse();
  // When a trusted manual continuation retries the completed plan, or a fresh Ask queries it.
  const result = action === "continue"
    ? await f.session.sendUserMessage("계속", event => f.events.push(event), undefined, { autonomous: true })
    : await f.session.sendUserMessage("Inspect the title", event => f.events.push(event), undefined, { composerMode: "ask" });
  // Then only manual continuation owns the saved work and its retried proof; no tool is replayed.
  const expected = { execution: "response-final", goal: "unassessed", delivery: action === "continue" ? "persisted-verified" : "no-change" };
  expect(result.runOutcome).toEqual(expected);
  expect(result.recap?.runOutcome).toEqual(expected);
  expect(f.session.getRunEndProof()?.receipt).toBe(receipt);
  expect(result.appliedCalls).toHaveLength(action === "continue" ? 1 : 0);
  expect(f.events.filter(event => event.type === "tool_call" && event.name === "set_title_screen")).toHaveLength(1);
});
