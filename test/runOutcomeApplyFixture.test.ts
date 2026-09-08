import { afterEach, expect, it, vi } from "vitest";
import { clearTimeout, setTimeout } from "node:timers";
import * as sync from "@/project/supabaseProjectSync";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { declaredIntent } from "./intentFixture";
import { resetIntentDeclarationCache, type IntentDeclarer } from "@/ai/intentDeclarationClient";

const ownedRuns = new Set<{ controller: AbortController; pending: Promise<unknown> }>();

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Owned fixture completion deadline")), 10_000);
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
    resetMapEditHistory();
    resetIntentDeclarationCache();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

it("awaits real manual writer body handling when proof is cancelled at the receipt", async () => {
  // Given a real background manual commit whose optional-table response body is held.
  const f = applyFixture();
  const commits = vi.spyOn(sync, "recordProjectCommitToSupabase");
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const bodyWriter = stream.writable.getWriter();
  const response = new Response(stream.readable, { status: 404 });
  const reading = Promise.withResolvers<void>();
  const readBody = response.text.bind(response);
  vi.spyOn(response, "text").mockImplementation(() => { reading.resolve(); return readBody(); });
  f.setCommitResponse(() => response);
  store.update(project => { project.meta.title = "New manual edit requiring a commit"; });
  const controller = new AbortController();
  await f.session.proveAppliedRevision(event => {
    if (event.type === "persistence_proof" && event.state.receipt) controller.abort();
  }, controller.signal);
  await bounded(reading.promise);
  const call = commits.mock.results[0];
  if (!call || call.type !== "return") throw new Error("Real background writer did not start");
  let completed = false;
  const completion = call.value.then(() => { completed = true; });
  try {
    // When cleanup drains while the native response.text() remains pending.
    const completedAtDrain = drainOutcomeFixtures().then(() => completed);
    await bounded(bodyWriter.write(new TextEncoder().encode("PGRST205")));
    await bounded(bodyWriter.close());
    // Then drainage includes native body parsing and writer completion, not just fetch arrival.
    expect(await completedAtDrain).toBe(true);
    expect(await call.value).toMatchObject({ kind: "not-configured" });
  } finally {
    await bounded(completion);
    bodyWriter.releaseLock();
  }
});

it("finishes drainage without a new changes row when a save is deduplicated", async () => {
  // Given a genuinely saved revision with its background writer completed.
  applyFixture();
  const commits = vi.spyOn(sync, "recordProjectCommitToSupabase");
  await store.flush();
  for (const call of commits.mock.results) {
    if (call.type === "return") await bounded(call.value);
  }
  const count = commits.mock.calls.length;
  // When the same revision is flushed and cleanup drains observed writers.
  await store.flush();
  await drainOutcomeFixtures();
  // Then deduplication requires no invented transport event.
  expect(commits.mock.calls).toHaveLength(count);
});

it("declares a real title source and settles its original handle through native apply and proof", async () => {
  const raw = 'Set title to "Run-owned title"';
  const declareIntent = vi.fn<IntentDeclarer>(async facts => {
    expect(facts.userText).toBe(raw);
    expect(facts.requestCoverage).toMatchObject([{ requestId: "request-1", rawInstruction: raw,
      units: [{ id: "request-1:source:0", coverage: "uncovered", source: { start: 0, end: raw.length, quote: raw } }] }]);
    return { elapsedMs: 0, intent: declaredIntent({ mode: "modify", requestRequirements: { entries: [{
      source: [{ start: 0, end: raw.length, quote: raw }],
      criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Run-owned title" }],
      bindings: [{ source: { start: raw.indexOf('"'), end: raw.length, quote: '"Run-owned title"' },
        role: "value", criterionIndex: 0, fieldPath: ["value"] }],
    }] } }) };
  });
  const f = applyFixture(undefined, declareIntent);
  const controller = new AbortController();
  const pending = f.session.sendUserMessage(raw, event => f.events.push(event), controller.signal);
  const run: { controller: AbortController; pending: Promise<unknown> } = { controller, pending };
  ownedRuns.add(run);
  try {
    const result = await bounded(pending);
    expect(declareIntent).toHaveBeenCalledTimes(1);
    expect(result.runOutcome?.delivery).toBe("draft");
    expect(f.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(f.session.getAcceptanceSnapshot()?.items).toMatchObject([{ id: "request-1:source:0", required: true, coverage: "declared" }]);
    expect(result.proposedCalls.map(call => call.name)).toEqual(["set_title_screen"]);
    const applied = await bounded(applyProposedProject(f.session.getProposedProject(), {
      source: "agent", summary: "Title", toolNames: ["set_title_screen"],
    }));
    if (!applied.ok) throw new Error(applied.issue);
    f.session.recordAppliedProject(applied); f.session.rebaseProject(store.getCurrent());
    const proving = f.session.proveAppliedRevision(event => f.events.push(event), controller.signal);
    run.pending = proving;
    const proof = await bounded(proving);
    expect(proof).toMatchObject({ status: "succeeded", verified: true, proof: { kind: "verified", isCurrent: true } });
    if (!proof.receipt) throw new Error("Native proof did not return a receipt");
    expect(store.isPersistenceReceiptForProject(proof.receipt, store.getCurrent())).toBe(true);
    expect(store.isPersistenceReceiptCurrent(proof.receipt)).toBe(true);
    const expected = { execution: "response-final", goal: "satisfied", delivery: "persisted-verified" };
    expect(result.runOutcome).toEqual(expected);
    expect(result.recap?.runOutcome).toEqual(expected);
    expect(f.session.getRunOutcome()).toEqual(expected);
    expect(f.session.getHarnessSnapshot().runOutcome).toEqual(expected);
    expect(f.events.at(-1)).toEqual({ type: "run_outcome", runOutcome: expected });
    expect(result.appliedCalls).toHaveLength(1);
    expect(result.proposedCalls).toHaveLength(0);
  } finally { controller.abort(); await bounded(run.pending); ownedRuns.delete(run); }
});
