import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { declaredIntent } from "./intentFixture";
import type { IntentDeclarer } from "@/ai/intentDeclarationClient";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { SessionTurnOptions, TurnResult } from "@/ai/assistantSession";
import { LlmAbortError, LlmError, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { getTool } from "@/editor/tools/toolRegistry";
import { clearTimeout, setTimeout } from "node:timers";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

const ownedRuns = new Set<{ controller: AbortController; pending: Promise<TurnResult> }>();
async function bounded<T>(pending: Promise<T>, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller?.abort(); reject(new Error("Entry fixture completion deadline")); }, 10_000);
    })]);
  } finally { clearTimeout(timer); }
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

const entries: readonly { readonly name: string; readonly text: string; readonly options: SessionTurnOptions; readonly retained: boolean }[] = [
  { name: "fresh request", text: "Inspect the project", options: {}, retained: false },
  { name: "explicit continuation", text: "계속", options: {}, retained: true },
  { name: "Ask continuation token", text: "계속", options: { composerMode: "ask" }, retained: false },
  { name: "new goal continuation token", text: "계속", options: { goalAction: "new-goal" }, retained: false },
  { name: "fresh instruction override", text: "계속", options: { instruction: "Inspect the project" }, retained: false },
  { name: "continuation instruction override", text: "Editor request envelope", options: { instruction: "계속" }, retained: true },
];

describe.each(["cancelled", "failed", "already-aborted"] as const)("early %s entry", ending => {
  it.each(entries)("settles delivery for $name at its actual entry boundary", async entry => {
    // Given a genuinely applied and verified prior run in the same session.
    let faultArmed = false;
    const raw = 'Set title to "Run-owned title"';
    const entered = deferred<void>();
    const rejected = deferred<never>();
    const working: ChatRequest[] = [];
    let seamSnapshot: ReturnType<typeof f.session.getHarnessSnapshot> | undefined;
    async function fault(signal?: AbortSignal): Promise<never> {
      if (signal?.aborted) throw new LlmAbortError();
      const abort = () => rejected.reject(new LlmAbortError());
      signal?.addEventListener("abort", abort, { once: true });
      try {
        seamSnapshot = f.session.getHarnessSnapshot();
        entered.resolve();
        return await rejected.promise;
      } finally { signal?.removeEventListener("abort", abort); }
    }
    const declareIntent = vi.fn<IntentDeclarer>(async (facts, signal) => {
      if (faultArmed) return fault(signal);
      expect(facts.userText).toBe(raw);
      expect(facts.requestCoverage).toMatchObject([{ requestId: "request-1", rawInstruction: raw,
        units: [{ id: "request-1:source:0", coverage: "uncovered", source: { start: 0, end: raw.length, quote: raw } }] }]);
      return { intent: declaredIntent({ mode: "modify", requestRequirements: { entries: [{
        source: [{ start: 0, end: raw.length, quote: raw }],
        criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Run-owned title" }],
        bindings: [{ source: { start: raw.indexOf('"'), end: raw.length, quote: '"Run-owned title"' },
          role: "value", criterionIndex: 0, fieldPath: ["value"] }],
      }] } }), elapsedMs: 0 };
    });
    let setupRound = 0;
    const f = applyFixture(async (_config, request): Promise<ChatResult> => {
      if (faultArmed) { working.push(request); return fault(request.signal); }
      if (setupRound++ === 0) return { message: { role: "assistant", content: null, tool_calls: [{
        id: "title", type: "function", function: { name: "set_title_screen", arguments: JSON.stringify({ title: "Run-owned title" }) },
      }] }, finishReason: "tool_calls" };
      return { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
    }, declareIntent);
    const setupController = new AbortController();
    const setup = { controller: setupController,
      pending: f.session.sendUserMessage(raw, event => f.events.push(event), setupController.signal) };
    ownedRuns.add(setup);
    let first: TurnResult;
    try { first = await bounded(setup.pending, setupController); }
    finally { setupController.abort(); await bounded(setup.pending); ownedRuns.delete(setup); }
    expect(declareIntent).toHaveBeenCalledTimes(1);
    const applied = await applyProposedProject(f.session.getProposedProject(), {
      source: "agent", summary: "Title", toolNames: ["set_title_screen"],
    });
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
    await bounded(f.session.proveAppliedRevision());
    expect(first.runOutcome?.delivery).toBe("persisted-verified");
    const receipt = f.session.getRunEndProof()?.receipt;
    expect(receipt).toBeDefined();
    if (!receipt) throw new Error("Native receipt missing");
    expect(store.isPersistenceReceiptForProject(receipt, store.getCurrent())).toBe(true);
    expect(first.runOutcome?.goal).toBe("satisfied");
    faultArmed = true;
    const controller = new AbortController();
    if (ending === "already-aborted") controller.abort();
    const eventStart = f.events.length;
    const run = { controller, pending: f.session.sendUserMessage(entry.text, event => f.events.push(event), controller.signal, entry.options) };
    ownedRuns.add(run);
    try {
      if (ending !== "already-aborted") {
        await bounded(entered.promise, controller);
        if (ending === "cancelled") controller.abort();
        else rejected.reject(new LlmError("Entry boundary transport fixture failure", 401));
      }
      const result = await bounded(run.pending, controller);
      // Then only trusted continuation retains the old owned work, never fresh failed/cancelled requests.
      const retainedSource = entry.retained || entry.name === "Ask continuation token";
      const execution = ending === "failed" ? "failed" : "cancelled";
      const expected = { execution, goal: retainedSource ? "satisfied" : "incomplete", delivery: entry.retained ? "persisted-verified" : "no-change" };
      expect(declareIntent).toHaveBeenCalledTimes(ending === "already-aborted" || retainedSource ? 1 : 2);
      expect(working).toHaveLength(ending !== "already-aborted" && retainedSource ? 1 : 0);
      if (ending !== "already-aborted" && !retainedSource) {
        expect(declareIntent.mock.calls[1]?.[0].userText).toBe(entry.options.instruction ?? entry.text);
      }
      if (entry.name === "Ask continuation token") {
        expect(working.flatMap(request => request.tools ?? []).filter(tool => getTool(tool.function.name)?.mode === "write")).toEqual([]);
      }
      const expectedIds = retainedSource ? ["request-1:source:0"]
        : entry.options.goalAction === "new-goal" ? ["request-2:source:0"] : ["request-1:source:0", "request-2:source:0"];
      const snapshot = ending === "already-aborted" ? f.session.getHarnessSnapshot() : seamSnapshot;
      expect(snapshot?.requests?.map(request => ({ id: request.requestId, raw: request.rawInstruction }))).toEqual(
        retainedSource ? [{ id: "request-1", raw }]
          : entry.options.goalAction === "new-goal" ? [{ id: "request-2", raw: "계속" }]
            : [{ id: "request-1", raw }, { id: "request-2", raw: "Inspect the project" }]);
      // Soft checks report every projection of the same early-boundary defect without
      // preventing the independent receipt, call-ownership and cleanup checks below.
      const trace = JSON.stringify({ ending, entry: entry.name, requests: snapshot?.requests,
        acceptance: snapshot?.acceptance, result: result.runOutcome, recap: result.recap?.runOutcome,
        getter: f.session.getRunOutcome(), harness: f.session.getHarnessSnapshot().runOutcome,
        lastEvent: f.events.at(-1), applied: result.appliedCalls?.length, proposed: result.proposedCalls.length });
      expect.soft(snapshot?.acceptance?.items.map(item => item.id), trace).toEqual(expectedIds);
      expect.soft(snapshot?.acceptance?.items.map(item => ({ id: item.id, required: item.required, coverage: item.coverage, status: item.status })), trace).toEqual(
        expectedIds.map(id => ({ id, required: true, coverage: id === "request-1:source:0" ? "declared" : "uncovered",
          status: id === "request-1:source:0" ? "verified" : "blocked" })));
      expect(result.stoppedReason).toBe(execution === "cancelled" ? "aborted" : "error");
      expect.soft(result.runOutcome, trace).toEqual(expected);
      expect(result.appliedCalls).toHaveLength(entry.retained ? 1 : 0);
      expect(result.proposedCalls).toHaveLength(0);
      expect.soft(result.recap?.runOutcome, trace).toEqual(expected);
      expect.soft(f.session.getRunOutcome(), trace).toEqual(expected);
      expect.soft(f.session.getHarnessSnapshot().runOutcome, trace).toEqual(expected);
      expect.soft(f.events.at(-1), trace).toEqual({ type: "run_outcome", runOutcome: expected });
      expect(first.runOutcome).toEqual({ execution: "response-final", goal: "satisfied", delivery: "persisted-verified" });
      expect(f.session.getRunEndProof()?.receipt).toBe(receipt);
      expect(f.events.slice(eventStart).filter(event => event.type === "tool_call" || event.type === "milestone_applied")).toEqual([]);
    } finally { controller.abort(); await bounded(run.pending); ownedRuns.delete(run); }
  });
});
