import { afterEach, describe, expect, it, vi } from "vitest";

describe("Project store remote persistence", () => {
  afterEach(() => {
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
    await vi.advanceTimersByTimeAsync(1500);

    expect(saveResult).toEqual({ kind: "not-loaded" });
    expect(fetchSpy).not.toHaveBeenCalled();
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

    const { store } = await import("@/project/store");
    await store.load();
    store.update((draft) => {
      draft.meta.title = "must not overwrite canonical Supabase";
    });
    await vi.advanceTimersByTimeAsync(1500);

    expect(fetchSpy).not.toHaveBeenCalled();
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
      staleProject.system.titleScreen.backgroundResourceId = "rpg-zzu-title-blue";
    }
    storage.set("rpg-zzu:dev-project:127.0.0.1/?blankProject=1", serialize(staleProject));

    vi.resetModules();
    const { store } = await import("@/project/store");
    const project = await store.load();
    store.update((draft) => {
      draft.meta.title = "fresh project edits stay temporary";
    });
    const saveResult = await store.flush();

    expect(project.meta.title).toBe("새 프로젝트");
    expect(Object.keys(project.maps)).toHaveLength(1);
    expect(project.system.titleScreen?.backgroundResourceId).toBe("rpg-zzu-title-field");
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

    const firstModule = await import("@/project/store");
    await firstModule.store.load();
    const mapId = firstModule.store.getCurrent().startMapId;
    firstModule.store.update((draft) => {
      const map = draft.maps[mapId];
      if (map) map.name = "저장 검증 도시";
    });

    const saveResult = await firstModule.store.flush();

    vi.resetModules();
    const secondModule = await import("@/project/store");
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

    const { store } = await import("@/project/store");
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
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]?.method ?? "GET").toBe("GET");
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

    const saveMapPatch = vi.fn();
    vi.doMock("@/project/supabaseProjectSync", async () => {
      const actual = await vi.importActual<typeof import("@/project/supabaseProjectSync")>(
        "@/project/supabaseProjectSync",
      );
      return {
        ...actual,
        saveProjectToSupabase: vi.fn(async (project: import("@/project/types").Project) => {
          // Slow RTT: paint happens while this is in flight.
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { kind: "saved" as const, project };
        }),
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
    // Paint again while save is still awaiting the network.
    store.updateMap(mapId, (map) => {
      map.lowerTiles[0] = secondTile;
    });
    await vi.advanceTimersByTimeAsync(50);
    const result = await flushPromise;

    expect(result.kind).toBe("saved");
    // Local-first: second paint during RTT must remain visible (not rewound by save response).
    expect(store.getCurrent().maps[mapId]?.lowerTiles[0]).toBe(secondTile);
    expect(store.hasUnsavedChanges()).toBe(true);
  });
});
