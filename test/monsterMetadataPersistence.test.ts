import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadProjectFromSupabase, saveProjectMapPatchToSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";
import type { Project } from "@/project/types";
import { AUDIO_PERSISTENCE_CONFIG as CONFIG, audioDescriptionProject, createAudioDescriptionTransport } from "./helpers/audioDescriptionPersistenceTransport";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", CONFIG.anonKey);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", CONFIG.projectId);
  vi.stubEnv("VITE_SUPABASE_URL", CONFIG.url);
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "");
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
});

afterEach(async () => {
  const { _resetEditActivityForTest } = await import("@/editor/editActivityLog");
  _resetEditActivityForTest();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function openStore(project: Project) {
  const { store } = await import("@/project/store");
  store.replaceProject(structuredClone(project));
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  store._setPersistedBaselineForTest(structuredClone(project));
  return store;
}

describe("monster metadata concurrent persistence", () => {
  it("merges per-field local deltas when a real conditional save loses its first SHA race", async ({ signal }) => {
    // Given
    const base = { ...audioDescriptionProject(undefined), monsterMetadata: { raw: { name: "B", tags: ["B"] } } };
    const local = { ...base, monsterMetadata: { raw: { name: "L", tags: ["B"] } } };
    const remote = { ...base, monsterMetadata: { raw: { name: "R", tags: ["R"], description: "REMOTE" }, orphan: { description: "ORPHAN" } } };
    const transport = createAudioDescriptionTransport(base, signal);
    vi.stubGlobal("fetch", transport.fetch);
    const held = transport.holdNextPatch();
    // When
    const pending = saveProjectMapPatchToSupabase({ baseProject: base, project: local }, CONFIG);
    await held.entered();
    await saveProjectToSupabase(remote, CONFIG);
    held.release();
    const result = await pending;
    // Then
    expect(result.kind).toBe("saved");
    expect(transport.rejectedCas).toBe(1);
    expect((await loadProjectFromSupabase(CONFIG))?.monsterMetadata).toEqual({ raw: { name: "L", tags: ["R"], description: "REMOTE" }, orphan: { description: "ORPHAN" } });
  }, 30_000);

  it("reconciles remote fields without recording an edit when consecutive map saves complete", async ({ signal }) => {
    // Given
    const base = { ...audioDescriptionProject(undefined), monsterMetadata: { raw: { name: "B" } } };
    const remote = { ...base, monsterMetadata: { raw: { name: "R", tags: ["R"] } } };
    const transport = createAudioDescriptionTransport(remote, signal);
    vi.stubGlobal("fetch", transport.fetch);
    const store = await openStore(base);
    const { subscribeEditActivity } = await import("@/editor/editActivityLog");
    const generations: number[] = [];
    const stop = subscribeEditActivity(entry => { generations.push(entry.generation); });
    const commits = transport.waitForCommits(2);
    // When
    for (const name of ["MAP_1", "MAP_2"]) {
      store.updateMap(base.startMapId, map => { map.name = name; }, { label: name });
      await store.flush();
    }
    await commits;
    stop();
    // Then
    expect(transport.accepted.map(project => project.monsterMetadata)).toEqual([remote.monsterMetadata, remote.monsterMetadata]);
    expect(store.getCurrent().monsterMetadata).toEqual(remote.monsterMetadata);
    expect(generations).toHaveLength(2);
    expect(store.hasUnsavedChanges()).toBe(false);
  }, 30_000);

  it("preserves fresh fields and live maps when a save response arrives late", async ({ signal }) => {
    // Given
    const base = { ...audioDescriptionProject(undefined), monsterMetadata: { raw: { name: "B", description: "B" } } };
    const remote = { ...base, monsterMetadata: { raw: { name: "R", tags: ["R"], description: "R" } } };
    const transport = createAudioDescriptionTransport(remote, signal);
    vi.stubGlobal("fetch", transport.fetch);
    const store = await openStore(base);
    store.update(draft => { draft.monsterMetadata = { raw: { name: "S", description: "B" } }; });
    const first = transport.holdNextPatch();
    const catchup = transport.holdNextPatch();
    const commits = transport.waitForCommits(2);
    // When
    const pending = store.flush();
    await first.entered();
    store.update(draft => { draft.monsterMetadata = { raw: { name: "S", description: "" } }; });
    store.updateMap(base.startMapId, map => { map.name = "FRESH_MAP"; });
    const fresh = store.getCurrent();
    first.release();
    await catchup.entered();
    const reconciled = store.getCurrent();
    catchup.release();
    await pending;
    await commits;
    // Then
    expect(reconciled.maps).toBe(fresh.maps);
    expect(reconciled.monsterMetadata).toEqual({ raw: { name: "S", tags: ["R"], description: "" } });
    expect((await loadProjectFromSupabase(CONFIG))?.monsterMetadata).toEqual(reconciled.monsterMetadata);
    expect(store.hasUnsavedChanges()).toBe(false);
  }, 30_000);

  it("does not adopt old metadata when a different project replaces the submitted lineage", async ({ signal }) => {
    // Given
    const base = audioDescriptionProject(undefined);
    const remote = { ...base, monsterMetadata: { old: { name: "OLD_REMOTE" } } };
    const transport = createAudioDescriptionTransport(remote, signal);
    vi.stubGlobal("fetch", transport.fetch);
    const store = await openStore(base);
    store.updateMap(base.startMapId, map => { map.name = "OLD_EDIT"; });
    const held = transport.holdNextPatch();
    const commits = transport.waitForCommits(1);
    // When
    const pending = store.flush();
    await held.entered();
    const replacement = { ...audioDescriptionProject(undefined), monsterMetadata: { replacement: { name: "NEW_PROJECT" } } };
    store.replaceProject(replacement);
    held.release();
    await pending;
    await commits;
    // A's historical response cannot persist B implicitly. B must own its flush.
    expect(store.getCurrent().monsterMetadata).toEqual(replacement.monsterMetadata);
    expect(transport.accepted.at(-1)?.monsterMetadata).toEqual(remote.monsterMetadata);
    expect(store.hasUnsavedChanges()).toBe(true);
    const replacementCommitted = transport.waitForCommits(2);
    await store.flush();
    await replacementCommitted;
    // Then
    expect(store.getCurrent().monsterMetadata).toEqual(replacement.monsterMetadata);
    expect(transport.accepted.at(-1)?.monsterMetadata).toEqual(replacement.monsterMetadata);
    expect(store.hasUnsavedChanges()).toBe(false);
  }, 30_000);

  it("retains baseline and fresh input when a deferred write fails", async ({ signal }) => {
    // Given
    const base = audioDescriptionProject(undefined);
    const transport = createAudioDescriptionTransport(base, signal);
    vi.stubGlobal("fetch", transport.fetch);
    const store = await openStore(base);
    store.update(draft => { draft.monsterMetadata = { raw: { name: "S" } }; });
    const baseline = structuredClone(store._getPersistedBaselineForTest());
    const held = transport.holdNextPatch();
    // When
    const pending = store.flush();
    const rejected = expect(pending).rejects.toMatchObject({ status: 503 });
    await held.entered();
    store.update(draft => { draft.monsterMetadata = { raw: { name: "F" } }; });
    const fresh = store.getCurrent();
    held.release(503);
    await rejected;
    // Then
    expect(store.getCurrent()).toBe(fresh);
    expect(store._getPersistedBaselineForTest()).toEqual(baseline);
    expect(store.hasUnsavedChanges()).toBe(true);
  }, 30_000);
});
