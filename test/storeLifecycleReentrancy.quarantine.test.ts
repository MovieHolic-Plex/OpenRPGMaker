import { clearTimeout, setTimeout } from "node:timers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
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
    saveProjectToSupabase: save, saveProjectMapPatchToSupabase: async ({ project }: { project: Project }) => save(project) };
});
vi.mock("@/assets/supabaseResourceCache", () => ({ cacheSupabaseRootResources: async () => ({ skipped: [] }) }));

function signal<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Lifecycle signal deadline")), 10_000);
    })]);
  } finally { clearTimeout(timer); }
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("VITE_SUPABASE_URL", "https://lifecycle.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-only");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "lifecycle-contract");
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network"); }));
  remote.wire = serialize(createBlankProject());
  remote.writes = [];
  remote.save = null;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function loadedStore() {
  const { store } = await import("@/project/store");
  await store.load();
  await store.flush();
  remote.writes = [];
  return store;
}

describe("store lifecycle callback ownership", () => {
  it("still marks and persists a faceset repair when its target stays current", async () => {
    const store = await loadedStore();
    const project = structuredClone(store.getCurrent());
    project.assets.uploaded.pending_face = {
      id: "pending_face", name: "Pending face", kind: "faceset", dataUrl: "data:image/png;base64,AA==",
      meta: { width: 48, height: 48, sheetCell: 0, sheetSourceId: "old_sheet" },
    };
    remote.wire = serialize(project);
    vi.stubGlobal("document", {});
    vi.stubGlobal("Image", class {
      naturalWidth = 48;
      naturalHeight = 48;
      onload: (() => void) | null = null;
      set src(_value: string) { this.onload!(); }
    });
    expect((await store.reloadFromRemote()).kind).toBe("reloaded");
    expect(store.getCurrent().assets.uploaded.pending_face!.meta?.sheetCell).toBeUndefined();
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.getAutoSaveState().kind).toBe("pending");
    expect((await store.flush()).kind).toBe("saved");
    expect(remote.writes).toHaveLength(1);
    expect(remote.writes[0]!.assets.uploaded.pending_face!.meta?.sheetCell).toBeUndefined();
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it.each(["switch", "edit"])("a detached faceset repair cannot dirty or save the current %s target", async replacement => {
    const store = await loadedStore();
    const clean = structuredClone(store.getCurrent());
    const pending = structuredClone(clean);
    pending.assets.uploaded.pending_face = {
      id: "pending_face", name: "Pending face", kind: "faceset", dataUrl: "data:image/png;base64,AA==",
      meta: { width: 48, height: 48, sheetCell: 0, sheetSourceId: "old_sheet" },
    };
    remote.wire = serialize(pending);
    // Exercise the real async repair, not a mock changed flag. A single-face image
    // needs only its stale sheet markers cleared; no canvas or pixel substitute.
    const requested = signal<ControlledImage>();
    class ControlledImage {
      naturalWidth = 48;
      naturalHeight = 48;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { requested.resolve(this); }
    }
    vi.stubGlobal("document", {});
    vi.stubGlobal("Image", ControlledImage);
    const states: string[] = [];
    const unsubscribe = store.subscribeAutoSave(state => { states.push(state.kind); });
    const loading = store.reloadFromRemote({ force: true });
    const image = await bounded(requested.promise);
    const oldTarget = store.getCurrent();
    try {
      if (replacement === "switch") store.replaceProject(clean);
      else store.update(project => { project.meta.title = "Concurrent edit"; });
      const saved = await store.flush();
      if (saved.kind !== "saved" || !saved.receipt) throw new Error("Expected replacement receipt");
      const live = store.getCurrent();
      const before = serialize(live);
      const writes = remote.writes.length;
      const stateCount = states.length;
      image.onload!();
      expect((await bounded(loading)).kind).toBe("reloaded");
      expect(oldTarget.assets.uploaded.pending_face!.meta?.sheetCell).toBeUndefined();
      expect(store.getCurrent()).toBe(live);
      expect(serialize(live)).toBe(before);
      expect(store.hasUnsavedChanges()).toBe(false);
      expect(store.isPersistenceReceiptCurrent(saved.receipt)).toBe(true);
      expect(states.slice(stateCount)).toEqual([]);
      expect((await store.flush()).kind).toBe("saved");
      expect(remote.writes).toHaveLength(writes);
    } finally { image.onload!(); await bounded(loading); unsubscribe(); }
  });

  it.each([false, true])("a saving subscriber's replacement is not authorized by the old flush (own flush: %s)", async ownFlush => {
    const store = await loadedStore();
    const replacement = structuredClone(store.getCurrent());
    replacement.meta.title = "Replacement project";
    store.update(project => { project.meta.title = "Old dirty project"; });
    const submitted = signal<void>();
    const release = signal<void>();
    remote.save = async () => { submitted.resolve(); await bounded(release.promise); };
    let replacementFlush: ReturnType<typeof store.flush> | undefined;
    let switched = false;
    const unsubscribe = store.subscribeAutoSave(state => {
      if (state.kind !== "saving" || switched) return;
      switched = true;
      store.replaceProject(replacement);
      if (ownFlush) replacementFlush = store.flush();
    });
    const oldFlush = store.flush();
    try {
      if (ownFlush) await bounded(submitted.promise);
      // Check before releasing persistence: only an explicit replacement flush
      // may have reached the transport, never the stale outer flush.
      expect(remote.writes).toHaveLength(ownFlush ? 1 : 0);
      expect(store.hasUnsavedChanges()).toBe(true);
    } finally {
      release.resolve();
      unsubscribe();
      await bounded(oldFlush);
      if (replacementFlush) await bounded(replacementFlush);
    }
    expect(await bounded(oldFlush)).toEqual({ kind: "disabled" });
    if (replacementFlush) {
      const saved = await bounded(replacementFlush);
      if (saved.kind !== "saved" || !saved.receipt) throw new Error("Expected replacement receipt");
      expect(store.isPersistenceReceiptCurrent(saved.receipt)).toBe(true);
      expect(store.hasUnsavedChanges()).toBe(false);
    } else {
      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.getAutoSaveState().kind).toBe("pending");
      expect((await store.flush()).kind).toBe("saved");
    }
    expect(remote.writes).toHaveLength(1);
    expect(remote.writes[0]!.meta.title).toBe("Replacement project");
  });

  it("keeps same-lineage edits from a saving subscriber in the submitted snapshot", async () => {
    const store = await loadedStore();
    store.update(project => { project.meta.title = "Before callback"; });
    const unsubscribe = store.subscribeAutoSave(state => {
      if (state.kind === "saving") store.update(project => { project.meta.title = "Callback edit"; });
    });
    try {
      expect((await store.flush()).kind).toBe("saved");
      expect(remote.writes).toHaveLength(1);
      expect(remote.writes[0]!.meta.title).toBe("Callback edit");
      expect(store.hasUnsavedChanges()).toBe(false);
    } finally { unsubscribe(); }
  });
});
