import { afterEach, expect, it, vi } from "vitest";
import { clearTimeout, setTimeout } from "node:timers";
import * as sync from "@/project/supabaseProjectSync";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Owned fixture completion deadline")), 10_000);
    })]);
  } finally { clearTimeout(timer); }
}

afterEach(async () => {
  try { await drainOutcomeFixtures(); }
  finally {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory();
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
  let signalReading: () => void = () => { throw new Error("Read signal not initialized"); };
  const reading = new Promise<void>(resolve => { signalReading = resolve; });
  const readBody = response.text.bind(response);
  vi.spyOn(response, "text").mockImplementation(() => { signalReading(); return readBody(); });
  f.setCommitResponse(() => response);
  store.update(project => { project.meta.title = "New manual edit requiring a commit"; });
  const controller = new AbortController();
  await f.session.proveAppliedRevision(event => {
    if (event.type === "persistence_proof" && event.state.receipt) controller.abort();
  }, controller.signal);
  await bounded(reading);
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
