import { clearTimeout, setTimeout } from "node:timers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { interiorObjectFromKit } from "@/editor/interiorRoomVocab";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";

const remote = vi.hoisted(() => ({ wire: "", writes: [] as Project[], save: null as null | (() => Promise<void>) }));
vi.mock("@/project/supabaseProjectSync", async importOriginal => {
  const actual = await importOriginal<typeof import("@/project/supabaseProjectSync")>();
  const save = async (project: Project) => {
    const submitted = structuredClone(project);
    remote.writes.push(submitted);
    if (remote.save) await remote.save();
    remote.wire = serialize(submitted);
    return { kind: "saved" as const, project: deserialize(remote.wire) };
  };
  return { ...actual, loadProjectFromSupabase: async () => deserialize(remote.wire),
    recordProjectCommitToSupabase: async () => ({ kind: "saved", commitId: "local-deferred-lineage" }),
    saveProjectToSupabase: save, saveProjectMapPatchToSupabase: async ({ project }: { project: Project }) => save(project) };
});
vi.mock("@/assets/supabaseResourceCache", () => ({ cacheSupabaseRootResources: async () => ({ skipped: [] }) }));

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Deferred lineage signal deadline")), 10_000);
    })]);
  } finally { clearTimeout(timer); }
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("VITE_SUPABASE_URL", "https://deferred-lineage.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-only");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "deferred-lineage-contract");
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network"); }));
  remote.wire = serialize(createBlankProject());
  remote.writes = [];
  remote.save = null;
});
afterEach(() => {
  vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

async function fixture() {
  const { store } = await import("@/project/store");
  await store.load();
  await store.flush();
  remote.writes = [];
  const clean = structuredClone(store.getCurrent());
  clean.meta.title = "Clean replacement B";
  const timers = vi.spyOn(globalThis, "setTimeout");
  const intervals = vi.spyOn(globalThis, "setInterval");
  const cleared = vi.spyOn(globalThis, "clearTimeout");
  const clearedIntervals = vi.spyOn(globalThis, "clearInterval");
  const registered = (delay: number, interval = false) => {
    const spy = interval ? intervals : timers;
    const index = spy.mock.calls.findLastIndex(call => call[1] === delay);
    if (index < 0) throw new Error(`Missing registered ${interval ? "interval" : "timer"}: ${delay}`);
    const callback = spy.mock.calls[index]![0];
    if (typeof callback !== "function") throw new Error("Expected callable timer");
    return { callback: callback as () => void | Promise<void>, handle: spy.mock.results[index]!.value };
  };
  const migrate = async () => {
    const legacy = structuredClone(clean);
    legacy.meta.title = "Migrating project A";
    legacy.tilesets.easyrpg_chipset_interior!.structureKits = [{
      id: "cabinet", kind: "section", name: "캐비닛", width: 1, height: 2,
      rows: [{ tiles: [148] }, { tiles: [178] }], learnedFrom: "interior-catalog",
      ai: { description: "", placementRules: "", snap: "wall-north", themes: ["bedroom", "dining"] },
    }];
    remote.wire = serialize(legacy);
    expect((await store.reloadFromRemote({ force: true })).kind).toBe("reloaded");
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.getAutoSaveState().kind).toBe("pending");
    expect(remote.writes).toHaveLength(0);
    return registered(4000);
  };
  const reload = async () => {
    remote.wire = serialize(clean);
    expect((await store.reloadFromRemote({ force: true })).kind).toBe("reloaded");
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.getCurrent().meta.title).toBe(clean.meta.title);
  };
  const fail = async () => {
    remote.save = async () => { throw new Error("Controlled save failure"); };
    await expect(store.flush()).rejects.toThrow("Controlled save failure");
    remote.save = null;
    expect(store.hasUnsavedChanges()).toBe(true);
    const state = store.getAutoSaveState();
    if (state.kind !== "error") throw new Error("Expected retryable save error");
    return registered(Math.min(10_000 * 2 ** state.retryCount, 120_000));
  };
  const saved = () => {
    const done = Promise.withResolvers<void>();
    const unsubscribe = store.subscribeAutoSave(state => {
      if (state.kind === "saved") { unsubscribe(); done.resolve(); }
    });
    return { promise: done.promise, unsubscribe };
  };
  return { store, clean, registered, migrate, reload, fail, saved, cleared, clearedIntervals };
}

describe("deferred store persistence owns its scheduling lineage", () => {
  it.each(["migration", "retry", "health"] as const)("ignores A's %s callback on clean B before any state or persistence access", async kind => {
    const f = await fixture();
    let obsolete = await f.migrate();
    if (kind !== "migration") {
      obsolete = await f.fail();
      if (kind === "health") obsolete = f.registered(30_000, true);
    }
    await f.reload();
    const live = f.store.getCurrent();
    const before = serialize(live);
    const state = f.store.getAutoSaveState();
    const writes = remote.writes.length;
    const states: string[] = [];
    const unsubscribe = f.store.subscribeAutoSave(value => { states.push(value.kind); });
    try {
      // Invoke the exact captured callback even if it was cancelled: already-queued
      // callbacks must be harmless, not just absent from the timer registry.
      await obsolete.callback();
      expect(remote.writes).toHaveLength(writes);
      expect(fetch).not.toHaveBeenCalled();
      expect(states).toEqual([]);
      expect(f.store.getAutoSaveState()).toBe(state);
      expect(f.store.getCurrent()).toBe(live);
      expect(serialize(live)).toBe(before);
      expect(f.store.hasUnsavedChanges()).toBe(false);
      f.store.update(project => { project.meta.title = "B's own edit"; });
      expect((await f.store.flush()).kind).toBe("saved");
      expect(remote.writes).toHaveLength(writes + 1);
      expect(remote.writes.at(-1)!.meta.title).toBe("B's own edit");
      expect(f.store.hasUnsavedChanges()).toBe(false);
    } finally { unsubscribe(); }
  });

  it.each(["migration", "retry", "health"] as const)("A's %s callback cannot save dirty B or steal B's newer timer", async kind => {
    const f = await fixture();
    let obsolete = await f.migrate();
    if (kind !== "migration") {
      obsolete = await f.fail();
      if (kind === "health") obsolete = f.registered(30_000, true);
    }
    await f.reload();
    f.store.update(project => { project.meta.title = "B timer owner"; });
    let current = f.registered(4000);
    if (kind !== "migration") {
      current = await f.fail();
      if (kind === "health") current = f.registered(30_000, true);
    }
    expect(current.handle).not.toBe(obsolete.handle);
    const writes = remote.writes.length;
    const state = f.store.getAutoSaveState();
    await obsolete.callback();
    expect(remote.writes).toHaveLength(writes);
    expect(fetch).not.toHaveBeenCalled();
    expect(f.store.hasUnsavedChanges()).toBe(true);
    expect(f.store.getAutoSaveState()).toBe(state);
    expect((await f.store.flush()).kind).toBe("saved");
    // flush must still own and cancel B's handle, not a null stolen by A.
    expect(kind === "health" ? f.clearedIntervals : f.cleared).toHaveBeenCalledWith(current.handle);
    expect(remote.writes).toHaveLength(writes + 1);
    expect(remote.writes.at(-1)!.meta.title).toBe("B timer owner");
    expect(f.store.hasUnsavedChanges()).toBe(false);
  });

  it("a superseded same-lineage migration timer cannot consume the newer edit timer", async () => {
    const f = await fixture();
    const obsolete = await f.migrate();
    f.store.update(project => { project.meta.title = "Same-lineage edit"; });
    const current = f.registered(4000);
    expect(current.handle).not.toBe(obsolete.handle);
    await obsolete.callback();
    expect(remote.writes).toHaveLength(0);
    expect(f.store.hasUnsavedChanges()).toBe(true);
    const saved = f.saved();
    try { current.callback(); await bounded(saved.promise); }
    finally { saved.unsubscribe(); }
    expect(remote.writes).toHaveLength(1);
    expect(remote.writes[0]!.meta.title).toBe("Same-lineage edit");
    expect(f.store.hasUnsavedChanges()).toBe(false);
  });

  it.each(["migration", "retry", "health"] as const)("the current %s callback persists migration and catches up concurrent edits", async kind => {
    const f = await fixture();
    let current = await f.migrate();
    if (kind !== "migration") current = await f.fail();
    if (kind === "health") {
      current = f.registered(30_000, true);
      vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    }
    const writes = remote.writes.length;
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let submissions = 0;
    remote.save = async () => {
      if (++submissions === 1) { started.resolve(); await bounded(release.promise); }
    };
    const saved = f.saved();
    try {
      current.callback();
      await bounded(started.promise);
      f.store.update(project => { project.meta.title = "Same-lineage catch-up"; });
    } finally { release.resolve(); }
    try { await bounded(saved.promise); }
    finally { saved.unsubscribe(); }
    expect(remote.writes).toHaveLength(writes + 2);
    expect(remote.writes.at(-1)!.meta.title).toBe("Same-lineage catch-up");
    const kit = remote.writes.at(-1)!.tilesets.easyrpg_chipset_interior!.structureKits![0]!;
    expect(interiorObjectFromKit(kit).cells).toEqual([
      { dx: 0, dy: 0, layer: "upper", tile: 148 }, { dx: 0, dy: 1, layer: "upper", tile: 178 },
    ]);
    expect(f.store.hasUnsavedChanges()).toBe(false);
  });

  it("a pending subscriber's replacement keeps its own timer registration", async () => {
    const f = await fixture();
    let switched = false;
    let replacementTimer: ReturnType<typeof f.registered> | undefined;
    const unsubscribe = f.store.subscribeAutoSave(state => {
      if (state.kind !== "pending" || switched) return;
      switched = true;
      f.store.replaceProject(f.clean);
      replacementTimer = f.registered(4000);
    });
    try {
      f.store.update(project => { project.meta.title = "Old edit"; });
      expect(replacementTimer).toBeDefined();
      expect((await f.store.flush()).kind).toBe("saved");
      expect(f.cleared).toHaveBeenCalledWith(replacementTimer!.handle);
      expect(remote.writes).toHaveLength(1);
      expect(remote.writes[0]!.meta.title).toBe(f.clean.meta.title);
    } finally { unsubscribe(); }
  });

  it("an error subscriber's replacement does not acquire the old failed save's retry", async () => {
    const f = await fixture();
    await f.migrate();
    const unsubscribe = f.store.subscribeAutoSave(state => {
      if (state.kind === "error") f.store.replaceProject(f.clean);
    });
    remote.save = async () => { throw new Error("Controlled save failure"); };
    try { await expect(f.store.flush()).rejects.toThrow("Controlled save failure"); }
    finally { unsubscribe(); remote.save = null; }
    expect(() => f.registered(20_000)).toThrow("Missing registered");
    expect(() => f.registered(30_000, true)).toThrow("Missing registered");
    expect(f.store.hasUnsavedChanges()).toBe(true);
    expect((await f.store.flush()).kind).toBe("saved");
    expect(remote.writes.at(-1)!.meta.title).toBe(f.clean.meta.title);
  });

  it("an in-flight A health response cannot clear B's retry or persist B", async () => {
    const f = await fixture();
    await f.migrate();
    await f.fail();
    const health = f.registered(30_000, true);
    const requested = Promise.withResolvers<void>();
    const response = Promise.withResolvers<Response>();
    vi.stubGlobal("fetch", vi.fn(() => { requested.resolve(); return response.promise; }));
    const checking = health.callback();
    await bounded(requested.promise);
    await f.reload();
    f.store.update(project => { project.meta.title = "B retry owner"; });
    const retry = await f.fail();
    const writes = remote.writes.length;
    const state = f.store.getAutoSaveState();
    response.resolve(new Response(null, { status: 200 }));
    await bounded(Promise.resolve(checking));
    expect(remote.writes).toHaveLength(writes);
    expect(f.store.getAutoSaveState()).toBe(state);
    expect(f.cleared).not.toHaveBeenCalledWith(retry.handle);
    const saved = f.saved();
    try { retry.callback(); await bounded(saved.promise); }
    finally { saved.unsubscribe(); }
    expect(remote.writes).toHaveLength(writes + 1);
    expect(remote.writes.at(-1)!.meta.title).toBe("B retry owner");
    expect(f.store.hasUnsavedChanges()).toBe(false);
  });
});
