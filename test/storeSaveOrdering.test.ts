import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioDescriptionOverrides } from "@/project/types";
import {
  AUDIO_PERSISTENCE_CONFIG as CONFIG,
  audioDescriptionProject,
  createAudioDescriptionTransport,
} from "./helpers/audioDescriptionPersistenceTransport";

let persistenceSignal: AbortSignal;

beforeEach(({ signal }) => {
  persistenceSignal = signal;
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("VITE_SUPABASE_URL", CONFIG.url);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", CONFIG.anonKey);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", CONFIG.projectId);
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network"); }));
});
afterEach(() => {
  vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

async function heldA() {
  const base = audioDescriptionProject(undefined);
  base.meta.title = "PROJECT_A";
  const remote = audioDescriptionProject({ music: { remote_only_A: "REMOTE_PROJECT_A" } }, base);
  const transport = createAudioDescriptionTransport(remote, persistenceSignal);
  vi.stubGlobal("fetch", transport.fetch);
  const sync = await import("@/project/supabaseProjectSync");
  // Observe the real full-save entry synchronously, retaining its actual transport.
  // A queued B request must not invoke this before A settles, even before hashing.
  const fullSave = vi.spyOn(sync, "saveProjectToSupabase");
  const { store } = await import("@/project/store");
  store.replaceProject(structuredClone(base));
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  store._setPersistedBaselineForTest(structuredClone(base));
  store.updateMap(base.startMapId, map => { map.name = "A_EDIT"; });
  const held = transport.holdNextPatch();
  const pending = store.flush();
  await held.entered();
  return {
    store, base, transport, held, pending, fullSave,
    reload: () => sync.loadProjectFromSupabase(CONFIG),
    replacement: (title: string, descriptions?: AudioDescriptionOverrides) => {
      const project = audioDescriptionProject(descriptions, base);
      project.meta.title = title;
      project.maps[base.startMapId]!.name = `${title}_MAP`;
      return project;
    },
  };
}

describe("explicit store flush transport ordering", () => {
  it.each([
    { name: "missing", descriptions: undefined },
    { name: "cleared", descriptions: { music: { replacement: "" } } },
    { name: "authored", descriptions: { music: { replacement: "PROJECT_B_ONLY" } } },
  ])("serializes an explicit B flush behind held A with $name descriptions", async ({ descriptions }) => {
    const f = await heldA();
    const commits = f.transport.waitForCommits(2);
    f.store.replaceProject(f.replacement("PROJECT_B", descriptions));
    const states: string[] = [];
    const unsubscribe = f.store.subscribeAutoSave(state => { states.push(state.kind); });
    const replacementFlush = f.store.flush();
    const coalesced = f.store.flush();
    try {
      // A is still physically held. Do not advance a timer or rely on how fast
      // B's hashing/network microtasks happen to run to establish that it waits.
      expect(f.fullSave).not.toHaveBeenCalled();
      expect(states).toEqual([]);
      expect(f.store.hasUnsavedChanges()).toBe(true);
      expect(f.transport.accepted).toHaveLength(0);
    } finally {
      f.held.release();
      unsubscribe();
      await Promise.allSettled([f.pending, replacementFlush, coalesced]);
    }
    const [oldResult, result, coalescedResult] = await Promise.all([f.pending, replacementFlush, coalesced]);
    await commits;
    expect(oldResult.kind).toBe("saved");
    expect(result.kind).toBe("saved");
    expect(coalescedResult).toEqual(result);
    expect(f.fullSave).toHaveBeenCalledTimes(1);
    expect(f.transport.accepted.map(project => project.meta.title)).toEqual(["PROJECT_A", "PROJECT_B"]);
    expect(f.transport.accepted[1]?.audioDescriptions).toEqual(descriptions);
    const loaded = await f.reload();
    expect(f.store.getCurrent().meta.title).toBe("PROJECT_B");
    expect(f.store.getCurrent().audioDescriptions).toEqual(descriptions);
    expect(loaded?.meta.title).toBe("PROJECT_B");
    expect(loaded?.audioDescriptions).toEqual(descriptions);
    expect(loaded?.maps[f.base.startMapId]?.name).toBe("PROJECT_B_MAP");
    expect(f.store.getCurrent().maps[f.base.startMapId]?.name).toBe("PROJECT_B_MAP");
    expect(f.transport.rejectedCas).toBe(0);
    expect(f.store.hasUnsavedChanges()).toBe(false);
    if (oldResult.kind !== "saved" || !oldResult.receipt || result.kind !== "saved" || !result.receipt) {
      throw new Error("Both accepted saves must retain their own receipt");
    }
    expect(f.store.isPersistenceReceiptCurrent(oldResult.receipt)).toBe(false);
    expect(f.store.isPersistenceReceiptCurrent(result.receipt)).toBe(true);
  }, 30_000);

  it("A alone cannot authorize B even after A has settled", async () => {
    const f = await heldA();
    const commit = f.transport.waitForCommits(1);
    f.store.replaceProject(f.replacement("PROJECT_B"));
    f.held.release();
    const oldResult = await f.pending;
    await commit;
    expect(f.fullSave).not.toHaveBeenCalled();
    expect(f.transport.accepted.map(project => project.meta.title)).toEqual(["PROJECT_A"]);
    expect((await f.reload())?.meta.title).toBe("PROJECT_A");
    expect(f.store.getCurrent().meta.title).toBe("PROJECT_B");
    expect(f.store.getCurrent().audioDescriptions).toBeUndefined();
    expect(f.store.hasUnsavedChanges()).toBe(true);
    if (oldResult.kind !== "saved" || !oldResult.receipt) throw new Error("Expected historical A receipt");
    expect(f.store.isPersistenceReceiptCurrent(oldResult.receipt)).toBe(false);
  }, 30_000);

  it.each([false, true])("queued B cannot write C (C requests its own flush: %s)", async ownCFlush => {
    const f = await heldA();
    const commits = f.transport.waitForCommits(ownCFlush ? 2 : 1);
    f.store.replaceProject(f.replacement("PROJECT_B"));
    const queuedB = f.store.flush();
    f.store.replaceProject(f.replacement("PROJECT_C", { music: { only_C: "PROJECT_C_ONLY" } }));
    const queuedC = ownCFlush ? f.store.flush() : undefined;
    try {
      expect(f.fullSave).not.toHaveBeenCalled();
      expect(f.store.hasUnsavedChanges()).toBe(true);
    } finally {
      f.held.release();
      await Promise.allSettled([f.pending, queuedB, queuedC]);
    }
    await f.pending;
    expect(await queuedB).toEqual({ kind: "disabled" });
    await commits;
    expect(f.transport.accepted.map(project => project.meta.title)).toEqual(
      ownCFlush ? ["PROJECT_A", "PROJECT_C"] : ["PROJECT_A"],
    );
    expect(f.store.getCurrent().meta.title).toBe("PROJECT_C");
    expect(f.store.getCurrent().audioDescriptions).toEqual({ music: { only_C: "PROJECT_C_ONLY" } });
    expect((await f.reload())?.meta.title).toBe(ownCFlush ? "PROJECT_C" : "PROJECT_A");
    expect(f.store.hasUnsavedChanges()).toBe(!ownCFlush);
    expect(f.fullSave).toHaveBeenCalledTimes(ownCFlush ? 1 : 0);
    if (queuedC) {
      const result = await queuedC;
      if (result.kind !== "saved" || !result.receipt) throw new Error("Expected C-owned receipt");
      expect(f.store.isPersistenceReceiptCurrent(result.receipt)).toBe(true);
    }
  }, 30_000);

  it("A's failure remains visible to A callers without rejecting an owned queued B save", async () => {
    const f = await heldA();
    const coalescedA = f.store.flush();
    const rejectedA = Promise.all([
      expect(f.pending).rejects.toMatchObject({ status: 503 }),
      expect(coalescedA).rejects.toMatchObject({ status: 503 }),
    ]);
    const commit = f.transport.waitForCommits(1);
    f.store.replaceProject(f.replacement("PROJECT_B", { music: { replacement: "PROJECT_B_ONLY" } }));
    const queuedB = f.store.flush();
    try { expect(f.fullSave).not.toHaveBeenCalled(); }
    finally {
      f.held.release(503);
      await Promise.allSettled([rejectedA, queuedB]);
    }
    await rejectedA;
    const result = await queuedB;
    await commit;
    expect(f.fullSave).toHaveBeenCalledTimes(1);
    expect(f.transport.accepted.map(project => project.meta.title)).toEqual(["PROJECT_B"]);
    expect((await f.reload())?.meta.title).toBe("PROJECT_B");
    expect(f.store.getCurrent().meta.title).toBe("PROJECT_B");
    expect(f.store.getCurrent().audioDescriptions).toEqual({ music: { replacement: "PROJECT_B_ONLY" } });
    expect(f.store.hasUnsavedChanges()).toBe(false);
    expect(f.store.getAutoSaveState().kind).toBe("saved");
    if (result.kind !== "saved" || !result.receipt) throw new Error("Expected B-owned receipt after A failure");
    expect(f.store.isPersistenceReceiptCurrent(result.receipt)).toBe(true);
  }, 30_000);

  it("preserves same-lineage coalescing and immediate map catch-up", async () => {
    const f = await heldA();
    const commits = f.transport.waitForCommits(2);
    const coalesced = f.store.flush();
    f.store.updateMap(f.base.startMapId, map => { map.name = "A_CATCH_UP"; });
    f.held.release();
    const [result, coalescedResult] = await Promise.all([f.pending, coalesced]);
    await commits;
    expect(coalescedResult).toEqual(result);
    expect(f.fullSave).not.toHaveBeenCalled();
    expect(f.transport.accepted.map(project => project.maps[f.base.startMapId]?.name)).toEqual(["A_EDIT", "A_CATCH_UP"]);
    expect((await f.reload())?.maps[f.base.startMapId]?.name).toBe("A_CATCH_UP");
    expect(f.store.getCurrent().maps[f.base.startMapId]?.name).toBe("A_CATCH_UP");
    expect(f.store.hasUnsavedChanges()).toBe(false);
    if (result.kind !== "saved" || !result.receipt) throw new Error("Expected coalesced catch-up receipt");
    expect(f.store.isPersistenceReceiptCurrent(result.receipt)).toBe(true);
  }, 30_000);
});
