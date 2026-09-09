import { access } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { deferred, httpFixture, resultFor, submission } from "./aiJobsTestSupport.mjs";

// Deadlines only bound exact lifecycle signals. No elapsed-time assertion, sleep,
// polling or real Vitest timeout is used to trigger cancellation.
function bounded<T>(signal: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture lifecycle signal did not settle")), 5000);
    signal.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

it.each(["node-fifo", "vitest-lifo"] as const)("%s fixture abort settles accepted handlers before closing their scheduler", async hookOrder => {
  const controller = new AbortController();
  const hooks: Array<() => unknown> = [];
  // Model Node's registration-order hooks and the report adapter's reverse hooks.
  // This owner is per test; neither hooks nor cancellation can leak to another case.
  const owner = { signal: controller.signal, after: (hook: () => unknown) => { hooks.push(hook); } };
  const executeJob = vi.fn(async (input, host) => resultFor(input, host));
  const f = await httpFixture(owner, { executeJob });
  const entered = deferred();
  const release = deferred();
  const handlerSettled = deferred();
  const clientSettled = deferred();
  const order: string[] = [];
  const attempted: number[] = [];
  let accepted = 0;
  let cleanupFinished = false;
  let boundaryReleased = false;
  let cleanupResult: Promise<{ error: unknown }> | undefined;

  const putJson = f.repository.putJson.bind(f.repository);
  vi.spyOn(f.repository, "putJson").mockImplementation(async value => {
    // Real persistence completes, but its HTTP continuation is still held before
    // scheduler.admit. Socket closure cannot settle this continuation for us.
    const ref = await putJson(value);
    entered.resolve();
    await release.promise;
    order.push("repository-continuation-released");
    return ref;
  });
  const schedulerClose = f.scheduler.close.bind(f.scheduler);
  vi.spyOn(f.scheduler, "close").mockImplementation(() => {
    order.push("scheduler-close");
    return schedulerClose();
  });
  const repositoryClose = f.repository.close.bind(f.repository);
  vi.spyOn(f.repository, "close").mockImplementation(() => {
    order.push("repository-close");
    return repositoryClose();
  });
  const handlers = f.server.listeners("request");
  expect(handlers).toHaveLength(1);
  const handler = handlers[0];
  if (!handler) throw new Error("Expected the real fixture request handler");
  f.server.removeListener("request", handler);
  f.server.on("request", (req, res) => {
    accepted++;
    const work = Promise.resolve(handler.call(f.server, req, res));
    // Observe the actual returned handler promise, not response/socket events.
    work.then(() => { order.push("handler-settled"); handlerSettled.resolve(); }, handlerSettled.reject);
  });
  const reason = new Error("Explicit fixture test abort");
  const workload = (async () => {
    for (let index = 0; index < 28; index++) {
      attempted.push(index);
      const body = submission();
      body.input.payload = { reportAssets: null };
      expect((await f.post("", body, { "Idempotency-Key": "invalid" })).status).toBe(400);
    }
  })();
  const clientResult = workload.then(
    () => { order.push("client-settled"); clientSettled.resolve(); return { error: undefined }; },
    error => { order.push("client-settled"); clientSettled.resolve(); return { error }; },
  );
  const cleanup = async () => {
    const errors: unknown[] = [];
    const owned = hooks.splice(0);
    if (hookOrder === "vitest-lifo") owned.reverse();
    for (const hook of owned) {
      try { await hook(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Fixture cleanup failed");
  };
  try {
    await bounded(entered.promise);
    controller.abort(reason);
    cleanupResult = cleanup().then(
      () => { cleanupFinished = true; return { error: undefined }; },
      error => { cleanupFinished = true; return { error }; },
    );
    await bounded(clientSettled.promise);
    const beforeRelease = { cleanupFinished, schedulerClosed: order.includes("scheduler-close") };
    boundaryReleased = true;
    release.resolve();
    await bounded(handlerSettled.promise);
    const cleaned = await bounded(cleanupResult);
    const client = await bounded(clientResult);

    expect(beforeRelease).toEqual({ cleanupFinished: false, schedulerClosed: false });
    expect(client.error).toBe(reason);
    expect(cleaned.error).toBeUndefined();
    expect(attempted).toEqual([0]);
    expect(accepted).toBe(1);
    expect(order.indexOf("handler-settled")).toBeLessThan(order.indexOf("scheduler-close"));
    expect(order.indexOf("client-settled")).toBeLessThan(order.indexOf("scheduler-close"));
    expect(order.indexOf("scheduler-close")).toBeLessThan(order.indexOf("repository-close"));
    expect(f.errors).toEqual([]);
    expect(executeJob).not.toHaveBeenCalled();
    await expect(access(f.directory)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    if (!boundaryReleased) release.resolve();
    controller.abort(reason);
    // Do not strand the held route when an assertion or bounded signal fails.
    if (!cleanupResult) await cleanup();
    else {
      const result = await bounded(cleanupResult);
      if (result.error) throw result.error;
    }
    await bounded(clientResult);
    vi.restoreAllMocks();
  }
});
