import { afterEach, expect, it, vi } from "vitest";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { resetIntentDeclarationCache, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { TurnResult } from "@/ai/assistantSession";
import { declaredIntent } from "./intentFixture";
import { LlmError } from "@/ai/llmClient";
import { clearTimeout, setTimeout } from "node:timers";

const ownedRuns = new Set<{ controller: AbortController; pending: Promise<TurnResult> }>();
async function bounded<T>(pending: Promise<T>, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller?.abort(); reject(new Error("Continuation fixture completion deadline")); }, 10_000);
    })]);
  } finally { clearTimeout(timer); }
}
async function owned(start: (signal: AbortSignal) => Promise<TurnResult>): Promise<TurnResult> {
  const controller = new AbortController();
  const run = { controller, pending: start(controller.signal) };
  ownedRuns.add(run);
  try { return await bounded(run.pending, controller); }
  finally { controller.abort(); await bounded(run.pending); ownedRuns.delete(run); }
}

afterEach(async () => {
  try {
    for (const run of ownedRuns) run.controller.abort();
    await bounded(Promise.all([...ownedRuns].map(run => run.pending)));
    ownedRuns.clear();
    await drainOutcomeFixtures();
  }
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
  const declareIntent = vi.fn<IntentDeclarer>(async facts => ({ elapsedMs: 0,
    intent: declaredIntent({ mode: facts.userText === "Inspect the current project" ? "question" : "other" }),
  }));
  const f = applyFixture(undefined, declareIntent);
  const first = await f.run();
  expect(declareIntent).toHaveBeenCalledTimes(0); // Legacy setup deliberately bypasses extraction.
  const applied = await applyProposedProject(f.session.getProposedProject(), { source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
  if (!applied.ok) throw new Error(applied.issue);
  f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
  if (!spec.verified) f.setProofResponse(() => Response.json([], { status: 503 }));
  await f.session.proveAppliedRevision();
  expect(first.runOutcome?.delivery).toBe(spec.verified ? "persisted-verified" : "persisted");
  const receipt = f.session.getRunEndProof()?.receipt;
  expect(receipt).toBeDefined();
  f.setProofResponse();
  const actions = {
    continue: () => owned(signal => f.session.sendUserMessage("계속", event => f.events.push(event), signal)),
    "proof-retry": () => owned(signal => f.session.retryLastTurn(event => f.events.push(event), signal)),
    query: () => owned(signal => f.session.sendUserMessage("Inspect the current project", event => f.events.push(event), signal)),
    ask: () => owned(signal => f.session.sendUserMessage("계속", event => f.events.push(event), signal, { composerMode: "ask" })),
  } satisfies Record<typeof cases[number]["action"], () => Promise<TurnResult>>;
  // When the actual public continuation, proof-retry or fresh-query boundary runs.
  const result = await actions[spec.action]();
  expect(declareIntent).toHaveBeenCalledTimes(spec.action === "query" ? 1 : 0);
  if (spec.action === "query") {
    expect(declareIntent.mock.calls[0]?.[0].userText).toBe("Inspect the current project");
    expect((await declareIntent.mock.results[0]?.value)?.intent.mode).toBe("question");
  }
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
  let setup = true;
  const raw = 'Set title to "Owned milestone"';
  const declareIntent = vi.fn<IntentDeclarer>(async facts => ({ elapsedMs: 0, intent: declaredIntent({
    mode: facts.userText === raw ? "modify" : "question",
    ...(facts.userText === raw ? { requestRequirements: { entries: [{
      source: [{ start: 0, end: raw.length, quote: raw }],
      criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Owned milestone" }],
      bindings: [{ source: { start: raw.indexOf('"'), end: raw.length, quote: '"Owned milestone"' },
        role: "value", criterionIndex: 0, fieldPath: ["value"] }],
    }] } } : {}),
  }) }));
  const f = applyFixture(async (_config, request) => {
    if (!setup) {
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
      return { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
    }
    if (round++ === 0) return { message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: {
      name: "set_work_plan", arguments: JSON.stringify({ goal: "Title", layers: [{ title: "Title", items: [
        { title: "Title", instruction: "Set title", successTools: ["set_title_screen"] },
      ] }] }),
    } }] }, finishReason: "tool_calls" };
    if (round === 2) return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: {
      name: "set_title_screen", arguments: JSON.stringify({ title: "Owned milestone" }),
    } }] }, finishReason: "tool_calls" };
    throw new LlmError("Unexpected milestone fixture transport exhaustion", 401);
  }, declareIntent);
  f.setProofResponse(() => Response.json([], { status: 503 }));
  const first = await owned(signal => f.session.sendUserMessage(raw, event => f.events.push(event), signal, { autonomous: true }));
  expect(first.runOutcome?.delivery).toBe("persisted");
  expect(first.runOutcome?.goal).toBe("satisfied");
  expect(declareIntent).toHaveBeenCalledTimes(1);
  expect(declareIntent.mock.calls[0]?.[0].userText).toBe(raw);
  expect(f.session.getRunEndProof()).toMatchObject({ status: "failed", verified: false });
  const receipt = f.session.getRunEndProof()?.receipt;
  expect(receipt).toBeDefined();
  setup = false;
  f.setProofResponse();
  // When a trusted manual continuation retries the completed plan, or a fresh Ask queries it.
  const result = action === "continue"
    ? await owned(signal => f.session.sendUserMessage("계속", event => f.events.push(event), signal, { autonomous: true }))
    : await owned(signal => f.session.sendUserMessage("Inspect the title", event => f.events.push(event), signal, { composerMode: "ask" }));
  // Then only manual continuation owns the saved work and its retried proof; no tool is replayed.
  const expected = { execution: "response-final", goal: "satisfied", delivery: action === "continue" ? "persisted-verified" : "no-change" };
  expect(result.runOutcome).toEqual(expected);
  expect(result.recap?.runOutcome).toEqual(expected);
  expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
  expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
  expect(f.session.getRunEndProof()?.receipt).toBe(receipt);
  expect(result.appliedCalls).toHaveLength(action === "continue" ? 1 : 0);
  expect(result.proposedCalls).toHaveLength(0);
  expect(f.events.filter(event => event.type === "milestone_applied")).toHaveLength(1);
  expect(f.events.filter(event => event.type === "tool_call" && event.name === "set_title_screen")).toHaveLength(1);
});
