import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { legacyRawFixture } from "./support/spatialLegacyImportFixture";
import { spatialStoreFixture } from "./support/spatialStoreFixture";
import { spatialStoreLifecycle } from "./support/spatialStoreLifecycle";
import { spatialPersistenceHttp } from "./support/spatialPersistenceHttp";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it("activates untouched raw shops and archive when the editor has loaded through the legacy reader", async () => {
  // Given raw legacy rows loaded through the ordinary repaired hybrid reader.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  f.http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  await f.store.load();
  const count = f.http.trace.length;
  // When the explicit store operation activates, not a load/render or ordinary save.
  const accepted = await f.store.activateSpatialAuthoring();
  // Then ordinary JSON preserved raw values while the canonical editor uses its normalized copy.
  expect(accepted.kind).toBe("saved");
  const publication = f.http.trace.slice(count).find(call => call.path.endsWith("publish_spatial_project"));
  assert(publication && typeof publication.body === "object");
  expect(publication.body).toMatchObject({ p_operation: "activate", p_legacy_baseline: JSON.parse(raw.json) });
  expect(f.store.getCurrent().spatialAuthoring?.legacyImport.backup.json).toBe(raw.json);
  expect(f.http.state.root?.maps).toEqual(JSON.parse(raw.json).maps);
}, 60_000);

describe("stale activation lifecycle", () => {
  let setup: Promise<{ readonly f: Awaited<ReturnType<typeof spatialStoreFixture>>; readonly run: (signal: AbortSignal) => Promise<void> }>;
  let disposeFixture: (() => Promise<void>) | undefined;
  let bodySettled: Promise<unknown>;
  let matcherSettled: Promise<unknown>;
  let cleanup: Promise<void> | undefined;

  beforeEach(async () => {
    disposeFixture = undefined;
    bodySettled = Promise.resolve();
    matcherSettled = Promise.resolve();
    cleanup = undefined;
    setup = (async () => {
      // Given unchanged raw data, after the outer module reset and fixture environment installation.
      const raw = legacyRawFixture();
      const f = await spatialStoreFixture(raw.root);
      // Own disposal before load/import can fail; runner cancellation need not await the test body.
      disposeFixture = async () => {
        f.http.state.heldPath = "";
        f.http.release();
        await bodySettled;
        await matcherSettled;
        await f[Symbol.asyncDispose]();
      };
      f.http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
      await f.store.load();
      const { createEventDraft } = await import("../src/editor/eventDraftActions");
      return { f, run(signal: AbortSignal) {
        const body = (async () => {
          const path = "/rest/v1/rpc/publish_spatial_project";
          f.http.state.heldPath = path;
          const earlyDeadline = new AbortController();
          const nativeTimeout = AbortSignal.timeout;
          const clock = vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => ms === 5000 ? earlyDeadline.signal : nativeTimeout(ms));
          const received = f.http.requested(path, signal);
          const captured = f.http.completed("/rest/v1/maps", signal);
          // Observe both now: captured can reject before control ever reaches await received.
          const waiters = Promise.allSettled([received, captured]);
          const pending = f.store.activateSpatialAuthoring();
          const settled = Promise.allSettled([pending]);
          const mapId = f.store.getCurrent().startMapId;
          let eventId = "";
          try {
            await captured;
            clock.mockRestore();
            // Expire the old fixture budget at a real capture event, independently of CPU speed.
            earlyDeadline.abort(new DOMException("Fixture pre-publication budget expired", "TimeoutError"));
            await received;
            eventId = createEventDraft(mapId, 3, 4);
            f.store.update(draft => { draft.meta.title = "typed during activation"; });
          } finally {
            clock.mockRestore();
            f.http.state.heldPath = "";
            // When activation accepts only its untouched raw baseline.
            f.http.release();
            await Promise.all([settled, waiters]);
          }
          await expect(pending).rejects.toMatchObject({ code: "activation-stale", accepted: { serverRevision: 1 } });
          // Then newer local content stays dirty and the archived raw baseline is not rewritten.
          expect(f.store.getCurrent().meta.title).toBe("typed during activation");
          expect(f.store.getCurrent().maps[mapId].events.find(event => event.id === eventId)?.draft?.kind).toBe("new");
          expect(f.store.getCurrent().spatialAuthoring).toBeUndefined();
          expect(f.http.state.root?.spatialAuthoring).toMatchObject({ legacyImport: { backup: { json: raw.json } } });
          expect(f.store.hasUnsavedChanges()).toBe(true);
          expect(f.http.state.root?.meta).toEqual(raw.root.meta);
        })();
        bodySettled = Promise.allSettled([body]);
        return body;
      } };
    })();
    await setup;
  });

  function disposeScope() {
    return cleanup ??= (async () => {
      // A timed-out setup may still be loading. Its failure remains owned by beforeEach.
      await Promise.allSettled([setup]);
      await disposeFixture?.();
    })();
  }
  // Nested afterEach runs before the outer mocks/environment/timer reset, even on setup failure.
  afterEach(disposeScope);

  it("preserves dirty drafts and reports remote acceptance when activation adoption becomes stale", async ({ signal }) => {
    const { run } = await setup;
    await run(signal);
  });

  it("drains the original matcher when test-scope cancellation precedes raw-root completion", async ({ signal: runnerSignal, onTestFinished }) => {
    // Given the original rejected matcher, whose planned cancellation differs from the test scope.
    const { f, run } = await setup;
    const testScope = new AbortController();
    const scope = new AbortController();
    const reason = new DOMException("Caller cancelled during raw capture", "AbortError");
    const cancelled = new DOMException("Test scope cancelled before raw root", "AbortError");
    const signal = AbortSignal.any([runnerSignal, testScope.signal]);
    const requested = f.http.requested("/rest/v1/projects", runnerSignal);
    const root = f.http.completed("/rest/v1/projects", signal);
    const captureStart = f.http.trace.length;
    onTestFinished(() => {
      expect(f.http.lifecycle.closed).toBe(true);
      expect(f.http.trace.filter(call => call.path.endsWith("sync_spatial_mirrors"))).toMatchObject([{ status: 200 }]);
    });
    const primary = (async () => {
      const rejected = expect(run(AbortSignal.any([signal, scope.signal]))).rejects.toMatchObject({ name: "AbortError", cause: reason });
      matcherSettled = Promise.allSettled([rejected]);
      f.http.state.heldPath = "/rest/v1/projects";
      await root;
      scope.abort(reason);
      await rejected;
    })();
    const rejectedPrimary = expect(primary).rejects.toMatchObject({ name: "AbortError", cause: cancelled });
    // When the real request arrives, abort before releasing its held response; no clock race.
    const abort = requested.then(() => {
      const captured = f.http.trace.slice(captureStart);
      testScope.abort(cancelled);
      expect(captured).toEqual([]);
    });
    // Then the primary cause survives; drain through the registered disposer before Vitest auto-awaits assertions.
    await Promise.all([rejectedPrimary, abort]);
    await disposeScope();
  });

  it("retains primary cancellation and isolates the next fixture when teardown overlaps raw capture", async ({ signal }) => {
    // Given both real activation waiters, with a causal cancellation before map capture completes.
    const { f, run } = await setup;
    const scope = new AbortController();
    const reason = new DOMException("Caller cancelled during raw capture", "AbortError");
    const root = f.http.completed("/rest/v1/projects", signal);
    const rejected = expect(run(AbortSignal.any([signal, scope.signal]))).rejects.toMatchObject({ name: "AbortError", cause: reason });
    // Own the assertion derivative before root can reject and skip its normal await.
    matcherSettled = Promise.allSettled([rejected]);
    await root;
    // When cancellation starts teardown while the real activation is still running.
    scope.abort(reason);
    await Promise.all([rejected, disposeScope()]);
    // Then Vitest must report no secondary unhandled rejection, and old work precedes a fresh fixture.
    expect(f.http.trace.filter(call => call.path.endsWith("sync_spatial_mirrors"))).toMatchObject([{ status: 200 }]);
    expect(f.http.lifecycle.closed).toBe(true);
    await using next = await spatialPersistenceHttp();
    expect(next.state.root).toBeNull();
    expect(next.trace).toEqual([]);
  });
});

it.each(["requested", "completed"] as const)("cancels %s when its caller scope ends", async method => {
  // Given a real fixture with an outstanding event in a caller-owned scope.
  await using http = await spatialPersistenceHttp();
  const scope = new AbortController();
  const reason = new DOMException("Caller cancelled", "AbortError");
  const rejected = expect(http[method]("/never", scope.signal)).rejects.toMatchObject({ name: "AbortError", cause: reason });
  // When that scope is cancelled, rather than waiting for a private timeout.
  scope.abort(reason);
  // Then the original cancellation reaches the waiter.
  await rejected;
});

it("cancels outstanding event waiters when the HTTP fixture is disposed", async () => {
  // Given request and completion subscriptions whose events will never arrive.
  const http = await spatialPersistenceHttp();
  const scope = new AbortController();
  const requested = expect(http.requested("/never", scope.signal)).rejects.toMatchObject({ name: "AbortError", cause: { name: "AbortError" } });
  const completed = expect(http.completed("/never", scope.signal)).rejects.toMatchObject({ name: "AbortError", cause: { name: "AbortError" } });
  // When disposal ends their owning fixture scope.
  await http[Symbol.asyncDispose]();
  // Then both waiters settle rather than surviving into another test.
  await Promise.all([requested, completed]);
});

it("rejects activation on a raw overlay race without normalizing or force-saving the changed baseline", async ({ signal }) => {
  // Given an untouched raw capture and a request held before baseline comparison.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  f.http.state.maps = [{ map_id: raw.overlay.id, map_json: raw.overlay }];
  await f.store.load();
  const path = "/rest/v1/rpc/publish_spatial_project";
  f.http.state.heldPath = path;
  const received = f.http.requested(path, signal);
  const pending = f.store.activateSpatialAuthoring();
  const rejected = expect(pending).rejects.toMatchObject({ code: "conflict", status: 409 });
  const settled = Promise.allSettled([rejected]);
  try {
    await received;
    f.http.state.maps = [{ map_id: raw.overlay.id, map_json: { ...raw.overlay, name: "concurrent child" } }];
  } finally {
    // When the server compares the now-stale independent raw baseline.
    f.http.state.heldPath = "";
    f.http.release();
    await settled;
  }
  await rejected;
  // Then no marker was adopted and no retry can silently rewrite raw content.
  expect(f.store.getCurrent().spatialAuthoring).toBeUndefined();
  expect(f.http.trace.filter(call => call.path === path)).toHaveLength(1);
  expect(f.store.getPersistenceRecovery()).toMatchObject({ kind: "blocked", error: { code: "conflict" } });
});

it.each(["old-version", "missing-sha"] as const)("keeps raw activation limitations explicit when %s prevents publication", async fault => {
  // Given a loadable legacy project without a legal activation prerequisite.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture({ ...raw.root, version: fault === "old-version" ? 3 : 4 });
  if (fault === "missing-sha") f.http.state.sha = null;
  await f.store.load();
  // When explicit activation captures raw state, not the normalized Project version.
  await expect(f.store.activateSpatialAuthoring()).rejects.toMatchObject({ code: fault === "old-version" ? "unsupported-legacy-version" : "sha-unavailable" });
  // Then the limitation is exposed before any write, without inferred activation/upsert.
  expect(f.http.trace.filter(call => call.method !== "GET")).toEqual([]);
});

it("does not adopt an activation response into a replacement lineage", async ({ signal }) => {
  // Given an activation accepted remotely but held during mirror synchronization.
  const raw = legacyRawFixture();
  await using f = await spatialStoreFixture(raw.root);
  await f.store.load();
  const path = "/rest/v1/rpc/sync_spatial_mirrors";
  f.http.state.heldPath = path;
  const received = f.http.requested(path, signal);
  const pending = f.store.activateSpatialAuthoring();
  const settled = Promise.allSettled([pending]);
  try {
    await received;
    const replacement = structuredClone(f.store.getCurrent());
    replacement.meta.title = "separate imported lineage";
    f.store.replaceProject(replacement);
  } finally {
    // When the old activation returns.
    f.http.state.heldPath = "";
    f.http.release();
    await settled;
  }
  await pending;
  // Then it cannot graft the old converted library into new local content; the sticky target blocks legacy saves.
  expect(f.store.getCurrent().spatialAuthoring).toBeUndefined();
  expect(f.store.getCurrent().meta.title).toBe("separate imported lineage");
  await expect(f.store.flush()).rejects.toMatchObject({ code: "canonical-replacement" });
});

spatialStoreLifecycle(async own => {
  // Given the unchanged loaded raw root, before activation or the coalesced edit.
  const raw = legacyRawFixture();
  const f = own(await spatialStoreFixture(raw.root));
  await f.store.load();
  return { raw, f };
}, run => {
  it("blocks a coalesced flush when an edit makes raw activation adoption stale", ({ signal }) => run(async ({ raw, f }, observe) => {
    const path = "/rest/v1/rpc/publish_spatial_project";
    f.http.state.heldPath = path;
    const received = f.http.requested(path, signal);
    const outcomes = [observe(expect(f.store.activateSpatialAuthoring()).rejects.toMatchObject({ code: "activation-stale" }))];
    try {
      await received;
      f.store.update(draft => { draft.meta.title = "coalesced newer root"; });
      outcomes.push(observe(expect(f.store.flush()).rejects.toMatchObject({ code: "activation-stale" })));
    } finally {
      // When the raw root is accepted but the waiting flush owns a different local generation.
      f.http.state.heldPath = "";
      f.http.release();
      await Promise.allSettled(outcomes);
    }
    await Promise.all(outcomes);
    // Then no stale-root catch-up uses the fresh token; local edits stay dirty/exportable.
    expect(f.store.hasUnsavedChanges()).toBe(true);
    expect(f.store.getCurrent().meta.title).toBe("coalesced newer root");
    expect(f.http.state.root?.meta).toEqual(raw.root.meta);
    expect(f.http.trace.filter(call => call.path === path).map(call => call.body)).toMatchObject([{ p_operation: "activate" }]);
  }));
});
