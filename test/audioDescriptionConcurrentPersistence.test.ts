import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadProjectFromSupabase, saveProjectMapPatchToSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";
import type { AudioDescriptionOverrides, Project } from "@/project/types";
import {
  AUDIO_PERSISTENCE_CONFIG as CONFIG,
  audioDescriptionProject,
  createAudioDescriptionTransport,
} from "./helpers/audioDescriptionPersistenceTransport";

let persistenceSignal: AbortSignal;

beforeEach(({ signal }) => {
  persistenceSignal = signal;
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

describe("audio description concurrent persistence", () => {
  it.each([false, true])("cancels transport waits when already aborted is %s", async (alreadyAborted) => {
    const controller = new AbortController();
    const reason = new Error("cancelled by owning test");
    const transport = createAudioDescriptionTransport(
      audioDescriptionProject(undefined),
      controller.signal,
    );
    const held = transport.holdNextPatch();
    const nativeTimeout = vi.spyOn(AbortSignal, "timeout");
    if (alreadyAborted) controller.abort(reason);
    const rejected = Promise.all([
      expect(transport.waitForCommits(1)).rejects.toBe(reason),
      expect(held.entered()).rejects.toBe(reason),
    ]);
    if (!alreadyAborted) controller.abort(reason);
    await rejected;
    expect(nativeTimeout).not.toHaveBeenCalled();
  }, 30_000);

  it.each<{
    name: string;
    base: AudioDescriptionOverrides | undefined;
    local: AudioDescriptionOverrides | undefined;
    remote: AudioDescriptionOverrides | undefined;
    expected: AudioDescriptionOverrides | undefined;
  }>([
    {
      name: "unchanged local key",
      base: { music: { raw: "B" } }, local: { music: { raw: "B" } },
      remote: { music: { raw: "R" } }, expected: { music: { raw: "R" } },
    },
    {
      name: "remote clear",
      base: { music: { raw: "B" } }, local: { music: { raw: "B" } },
      remote: { music: { raw: "" } }, expected: { music: { raw: "" } },
    },
    {
      name: "remote reset",
      base: { music: { raw: "B" } }, local: { music: { raw: "B" } },
      remote: undefined, expected: undefined,
    },
    {
      name: "remote addition to an absent field",
      base: undefined, local: undefined,
      remote: { sound: { raw: "R" } }, expected: { sound: { raw: "R" } },
    },
    {
      name: "different keys in one kind",
      base: undefined, local: { music: { local: "L" } },
      remote: { music: { remote: "R" } }, expected: { music: { local: "L", remote: "R" } },
    },
    {
      name: "same raw ID in different kinds",
      base: undefined, local: { music: { raw: "L" } },
      remote: { sound: { raw: "R" } }, expected: { music: { raw: "L" }, sound: { raw: "R" } },
    },
    {
      name: "same-key local edit wins",
      base: { sound: { raw: "B" } }, local: { sound: { raw: "L" } },
      remote: { sound: { raw: "R" } }, expected: { sound: { raw: "L" } },
    },
    {
      name: "same-key local clear wins",
      base: { sound: { raw: "B" } }, local: { sound: { raw: "" } },
      remote: { sound: { raw: "R" } }, expected: { sound: { raw: "" } },
    },
    {
      name: "same-key local reset wins",
      base: { sound: { raw: "" } }, local: undefined,
      remote: { sound: { raw: "R" } }, expected: undefined,
    },
    {
      name: "own raw IDs and exact stored whitespace",
      base: undefined, local: { music: { ["__proto__"]: " \tL\n " } },
      remote: { music: { constructor: "R" } },
      expected: { music: { ["__proto__"]: " \tL\n ", constructor: "R" } },
    },
  ])("merges descriptions after a conditional-write race when $name", async (scenario) => {
    // Given
    const base = audioDescriptionProject(scenario.base);
    const local = audioDescriptionProject(scenario.local, base);
    const remote = audioDescriptionProject(scenario.remote, base);
    const inputs = structuredClone({ base, local, remote });
    const transport = createAudioDescriptionTransport(base, persistenceSignal);
    vi.stubGlobal("fetch", transport.fetch);
    const held = transport.holdNextPatch();
    // When: another real save wins the first SHA race.
    const pending = saveProjectMapPatchToSupabase({ baseProject: base, project: local }, CONFIG);
    await held.entered();
    const remoteResult = await saveProjectToSupabase(remote, CONFIG);
    const remoteLoaded = await loadProjectFromSupabase(CONFIG);
    held.release();
    const result = await pending;
    const loaded = await loadProjectFromSupabase(CONFIG);
    // Then
    expect(remoteResult.kind).toBe("saved");
    expect(remoteLoaded?.audioDescriptions).toEqual(scenario.remote);
    expect(result.kind).toBe("saved");
    expect(transport.rejectedCas).toBe(1);
    expect(loaded?.audioDescriptions).toEqual(scenario.expected);
    expect(Object.hasOwn(loaded ?? {}, "audioDescriptions")).toBe(scenario.expected !== undefined);
    expect({ base, local, remote }).toEqual(inputs);
  }, 30_000);

  it.each([
    { name: "remote edit", remote: { music: { raw: "R" } } },
    { name: "remote clear", remote: { music: { raw: "" } } },
    { name: "remote reset", remote: undefined },
  ] as const)("preserves $name through consecutive map saves without recording a user edit", async ({ remote }) => {
    // Given
    const base = audioDescriptionProject({ music: { raw: "B" } });
    const transport = createAudioDescriptionTransport(audioDescriptionProject(remote, base), persistenceSignal);
    vi.stubGlobal("fetch", transport.fetch);
    const store = await openStore(base);
    const { subscribeEditActivity } = await import("@/editor/editActivityLog");
    const generations: number[] = [];
    const synchronized: Project[] = [];
    const submitted: Project[] = [];
    const stopActivity = subscribeEditActivity((entry) => { generations.push(entry.generation); });
    const stopStore = store.subscribe((project, change) => {
      if (change.origin === "system") synchronized.push(project);
    });
    const commits = transport.waitForCommits(2);
    // When
    await Promise.all([
      commits,
      (async () => {
        for (const name of ["MAP_1", "MAP_2"]) {
          store.updateMap(base.startMapId, (map) => { map.name = name; }, { label: name });
          submitted.push(store.getCurrent());
          await store.flush();
        }
      })(),
    ]);
    stopStore();
    stopActivity();
    const loaded = await loadProjectFromSupabase(CONFIG);
    // Then
    expect(transport.accepted.map((project) => project.audioDescriptions)).toEqual([remote, remote]);
    expect(store.getCurrent().audioDescriptions).toEqual(remote);
    expect(loaded?.audioDescriptions).toEqual(remote);
    expect(loaded?.maps[base.startMapId]?.name).toBe("MAP_2");
    expect(synchronized).toHaveLength(1);
    expect(synchronized[0]?.maps).toBe(submitted[0]?.maps);
    expect(submitted[0]?.audioDescriptions).toEqual({ music: { raw: "B" } });
    expect(store.getCurrent().maps).toBe(submitted[1]?.maps);
    expect(generations).toHaveLength(2);
    expect(store.hasUnsavedChanges()).toBe(false);
  }, 30_000);

  it.each([
    { name: "set", fresh: { music: { raw: "F" } }, expected: { music: { raw: "F", remote: "R" } } },
    { name: "clear", fresh: { music: { raw: "" } }, expected: { music: { raw: "", remote: "R" } } },
    { name: "reset", fresh: undefined, expected: { music: { remote: "R" } } },
  ] as const)("keeps fresh map edits and a fresh description $name when a response arrives late", async ({ fresh, expected }) => {
    // Given
    const base = audioDescriptionProject({ music: { raw: "B" } });
    const remote = audioDescriptionProject({ music: { raw: "R", remote: "R" } }, base);
    const transport = createAudioDescriptionTransport(remote, persistenceSignal);
    vi.stubGlobal("fetch", transport.fetch);
    const store = await openStore(base);
    store.update((draft) => { draft.audioDescriptions = { music: { raw: "S" } }; }, { scope: "project", label: "DESC_S" });
    store.updateMap(base.startMapId, (map) => { map.name = "MAP_S"; });
    const first = transport.holdNextPatch();
    const catchup = transport.holdNextPatch();
    const commits = transport.waitForCommits(2);
    // When
    const [, { freshProject, reconciled, result }] = await Promise.all([
      commits,
      (async () => {
        const pending = store.flush();
        await first.entered();
        store.update((draft) => {
          if (fresh === undefined) delete draft.audioDescriptions;
          else draft.audioDescriptions = fresh;
        }, { scope: "project", label: "DESC_F" });
        store.updateMap(base.startMapId, (map) => { map.name = "MAP_F"; });
        const freshProject = store.getCurrent();
        first.release();
        await catchup.entered();
        const reconciled = store.getCurrent();
        catchup.release();
        const result = await pending;
        return { freshProject, reconciled, result };
      })(),
    ]);
    const loaded = await loadProjectFromSupabase(CONFIG);
    // Then
    expect(result.kind).toBe("saved");
    expect(reconciled.maps).toBe(freshProject.maps);
    expect(reconciled.audioDescriptions).toEqual(expected);
    expect(freshProject.audioDescriptions).toEqual(fresh);
    expect(store.getCurrent().maps).toBe(freshProject.maps);
    expect(transport.accepted.map((project) => project.audioDescriptions)).toEqual([
      { music: { raw: "S", remote: "R" } }, expected,
    ]);
    expect(loaded?.maps[base.startMapId]?.name).toBe("MAP_F");
    expect(loaded?.audioDescriptions).toEqual(expected);
    expect(store.hasUnsavedChanges()).toBe(false);
  }, 30_000);

  it("retains the baseline and fresh local input when a deferred write fails", async () => {
    // Given
    const base = audioDescriptionProject({ music: { raw: "B" } });
    const remote = audioDescriptionProject({ music: { raw: "R", remote: "R" } }, base);
    const transport = createAudioDescriptionTransport(remote, persistenceSignal);
    vi.stubGlobal("fetch", transport.fetch);
    const store = await openStore(base);
    store.update((draft) => { draft.audioDescriptions = { music: { raw: "L" } }; }, { scope: "project" });
    const baseline = structuredClone(store._getPersistedBaselineForTest());
    const held = transport.holdNextPatch();
    // When
    const pending = store.flush();
    const rejected = expect(pending).rejects.toMatchObject({ status: 503 });
    await held.entered();
    store.update((draft) => { draft.audioDescriptions = { music: { raw: "" } }; }, { scope: "project" });
    store.updateMap(base.startMapId, (map) => { map.name = "MAP_F"; });
    const fresh = store.getCurrent();
    held.release(503);
    await rejected;
    // Then: failure does not adopt the candidate merge or advance the baseline.
    expect(store.getCurrent()).toBe(fresh);
    expect(store._getPersistedBaselineForTest()).toEqual(baseline);
    expect(store.getAutoSaveState().kind).toBe("error");
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(transport.accepted).toHaveLength(0);
    expect((await loadProjectFromSupabase(CONFIG))?.audioDescriptions).toEqual(remote.audioDescriptions);
  }, 30_000);
});
