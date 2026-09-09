import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bounded, deferred } from "./persistenceTestSignals";

// Audit mirroring is fire-and-forget and has its own contracts; it must not escape into the next test's transport.
vi.mock("@/project/projectCommitLog", () => ({
  recordManualProjectCommitAfterSave: vi.fn(),
  resetManualProjectCommitBaseline: vi.fn(),
}));

async function importBootConfiguredStore() {
  const [storeModule, { createDevShowcaseProjectForLocation }] = await Promise.all([
    import("@/project/store"),
    import("@/editor/devShowcaseProjects"),
  ]);
  storeModule.setDevProjectFactory(createDevShowcaseProjectForLocation);
  return storeModule;
}

function remoteCalls(fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchSpy.mock.calls.filter(([input]) => String(input).includes("/rest/v1/"));
}

describe("Project store remote persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response("[]", { status: 200 })));
  });

  afterEach(() => {
    vi.doUnmock("@/project/supabaseProjectSync");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("does not write to Supabase before the canonical project has loaded", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await import("@/project/store");
    store.update((draft) => {
      draft.meta.title = "pre-load draft must stay local";
    });
    const saveResult = await store.flush();
    expect(saveResult).toEqual({ kind: "not-loaded" });
    expect(store.getAutoSaveState().kind).toBe("idle");
    expect(remoteCalls(fetchSpy)).toEqual([]);
  });

  it("does not auto-save local dev showcase projects to Supabase", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", search: "?freshProject=1" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await importBootConfiguredStore();
    await store.load();
    store.update((draft) => {
      draft.meta.title = "must not overwrite canonical Supabase";
    });
    // This session reports a non-persisted edit immediately and never arms remote autosave.
    expect(store.getAutoSaveState()).toMatchObject({ kind: "error", code: "session-not-persisted" });
    expect(await store.flush()).toEqual({ kind: "saved-local" });
    expect(remoteCalls(fetchSpy)).toEqual([]);
  });

  it("always creates a new fresh project instead of reloading local dev overrides", async () => {
    const storage = new Map<string, string>();
    const setItem = vi.fn((key: string, value: string) => storage.set(key, value));
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "?blankProject=1" },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem,
      },
    });
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const [{ createBlankProject }, { serialize }] = await Promise.all([
      import("@/project/defaults"),
      import("@/project/io"),
    ]);
    const staleProject = createBlankProject();
    staleProject.meta.title = "stale local override";
    if (staleProject.system.titleScreen) {
      staleProject.system.titleScreen.backgroundResourceId = "oprn-title-blue";
    }
    storage.set("oprn:dev-project:127.0.0.1/?blankProject=1", serialize(staleProject));

    vi.resetModules();
    const { store } = await importBootConfiguredStore();
    const project = await store.load();
    store.update((draft) => {
      draft.meta.title = "fresh project edits stay temporary";
    });
    const saveResult = await store.flush();

    expect(project.meta.title).toBe("새 프로젝트");
    expect(Object.keys(project.maps)).toHaveLength(1);
    expect(project.system.titleScreen?.backgroundResourceId).toBe("oprn-title-field");
    expect(saveResult).toEqual({ kind: "saved-local" });
    expect(setItem).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("saves and reloads local edits for dev showcase projects without Supabase", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "?devProject=1&townArchitectureCity=1&cacheBust=1" },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const firstModule = await importBootConfiguredStore();
    await firstModule.store.load();
    const mapId = firstModule.store.getCurrent().startMapId;
    firstModule.store.update((draft) => {
      const map = draft.maps[mapId];
      if (map) map.name = "저장 검증 도시";
    });

    const saveResult = await firstModule.store.flush();

    vi.resetModules();
    const secondModule = await importBootConfiguredStore();
    await secondModule.store.load();

    expect(saveResult).toEqual({ kind: "saved-local" });
    expect(secondModule.store.getCurrent().maps[mapId]?.name).toBe("저장 검증 도시");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports why DB persistence is unavailable for local dev showcase projects", async () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", search: "?freshProject=1" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    vi.resetModules();

    const { store } = await importBootConfiguredStore();
    await store.load();

    expect(store.getDbPersistenceStatus()).toEqual({ kind: "disabled", reason: "dev-showcase" });
  });

  it("requires DB configuration before opening a project", async () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await import("@/project/store");

    await expect(store.load()).rejects.toMatchObject({ name: "DbConnectionRequiredError" });
    expect(store.isLoaded()).toBe(false);
    expect(store.getDbPersistenceStatus().kind).toBe("not-configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("marks the project loaded when reconnect recovers a blocked first boot", async () => {
    // Given: configured online storage and a store that has not completed its first load.
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => undefined },
    });
    const [{ createHouseTemplateGalleryProject }, { serialize }] = await Promise.all([
      import("@/project/defaults"),
      import("@/project/io"),
    ]);
    const currentJson = JSON.parse(serialize(createHouseTemplateGalleryProject()));
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/rest/v1/projects?")) {
        return new Response(JSON.stringify([{ current_json: currentJson, current_sha256: "test-sha" }]), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    }));
    vi.resetModules();
    const { store } = await import("@/project/store");

    // When: the first-boot connection flow reconnects to the selected project.
    const result = await store.reconnectRemotePersistence();

    // Then: connected means the editor can pass its loaded gate immediately.
    expect(result).toEqual({ kind: "connected", source: "remote" });
    expect(store.isLoaded()).toBe(true);
  });

  it("does not create a DB project when the selected project row is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "missing-project");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await import("@/project/store");

    await expect(store.load()).rejects.toMatchObject({ name: "DbConnectionRequiredError" });
    const calls = remoteCalls(fetchSpy);
    expect(calls.filter(([input]) => String(input).includes("/rest/v1/projects?"))).toHaveLength(1);
    expect(calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
    expect(store.isLoaded()).toBe(false);
  });

  it("skips remote flush when there are no unsaved changes", async () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-house-template-gallery");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await import("@/project/store");
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    const result = await store.flush();

    expect(result).toEqual({ kind: "saved" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it("keeps local map paint when remote save finishes with a stale snapshot", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-paint-local-first");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    vi.resetModules();

    type Project = import("@/project/types").Project;
    const fullStarted = deferred<void>();
    const fullResponse = deferred<void>();
    const patchStarted = deferred<void>();
    const patchResponse = deferred<void>();
    const saveFull = vi.fn(async (project: Project) => {
      fullStarted.resolve();
      await fullResponse.promise;
      return { kind: "saved" as const, project };
    });
    const saveMapPatch = vi.fn(async (input: { readonly project: Project; readonly baseProject: Project }) => {
      patchStarted.resolve();
      await patchResponse.promise;
      return { kind: "saved" as const, project: input.project };
    });
    vi.doMock("@/project/supabaseProjectSync", async () => {
      const actual = await vi.importActual<typeof import("@/project/supabaseProjectSync")>(
        "@/project/supabaseProjectSync",
      );
      return {
        ...actual,
        saveProjectToSupabase: saveFull,
        saveProjectMapPatchToSupabase: saveMapPatch,
      };
    });

    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");
    const project = createBlankProject();
    const mapId = project.startMapId;
    store.replaceProject(project);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(null);

    const firstTile = 7;
    const secondTile = 9;
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = firstTile;
    });

    const flushPromise = store.flush();
    await bounded(fullStarted.promise);
    // Paint again while save is still awaiting the network.
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = secondTile;
    });
    fullResponse.resolve();
    await bounded(patchStarted.promise);
    expect(store.getCurrent().maps[mapId]?.lowerTiles[0]).toBe(secondTile);
    expect(store.hasUnsavedChanges()).toBe(true);
    patchResponse.resolve();
    const result = await bounded(flushPromise);

    expect(result.kind).toBe("saved");
    expect(store.getCurrent().maps[mapId]?.lowerTiles[0]).toBe(secondTile);
    expect(saveFull).toHaveBeenCalledTimes(1);
    expect(saveMapPatch).toHaveBeenCalledTimes(1);
    const catchUp = saveMapPatch.mock.calls[0]?.[0] as { readonly project: Project } | undefined;
    expect(catchUp?.project.maps[mapId]?.lowerTiles[0]).toBe(secondTile);
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it("does not apply stale map-patch response over newer local paint", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-paint-map-patch");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    vi.resetModules();

    type Project = import("@/project/types").Project;
    const requests = [deferred<void>(), deferred<void>()];
    const responses = [deferred<void>(), deferred<void>()];
    let requestIndex = 0;
    const saveMapPatch = vi.fn(async (input: {
      readonly project: Project;
      readonly baseProject: Project;
    }) => {
      const index = requestIndex++;
      const request = requests[index];
      const response = responses[index];
      if (!request || !response) throw new Error("Unexpected extra map save");
      request.resolve();
      await response.promise;
      return { kind: "saved" as const, project: structuredClone(input.project) };
    });
    vi.doMock("@/project/supabaseProjectSync", async () => {
      const actual = await vi.importActual<typeof import("@/project/supabaseProjectSync")>(
        "@/project/supabaseProjectSync",
      );
      return {
        ...actual,
        saveProjectToSupabase: vi.fn(),
        saveProjectMapPatchToSupabase: saveMapPatch,
      };
    });

    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");
    const project = createBlankProject();
    const mapId = project.startMapId;
    store.replaceProject(project);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store._setPersistedBaselineForTest(structuredClone(project));

    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = 11;
    });
    const flushPromise = store.flush();
    await bounded(requests[0].promise);
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = 22;
    });
    responses[0].resolve();
    await bounded(requests[1].promise);
    expect(store.getCurrent().maps[mapId]?.lowerTiles[0]).toBe(22);
    expect(store.hasUnsavedChanges()).toBe(true);
    responses[1].resolve();
    const result = await bounded(flushPromise);

    expect(result.kind).toBe("saved");
    expect(store.getCurrent().maps[mapId]?.lowerTiles[0]).toBe(22);
    expect(saveMapPatch).toHaveBeenCalledTimes(2);
    const secondPatch = saveMapPatch.mock.calls[1]?.[0] as {
      readonly project: Project;
    } | undefined;
    expect(secondPatch?.project.maps[mapId]?.lowerTiles[0]).toBe(22);
    expect(store.hasUnsavedChanges()).toBe(false);
  });
});
