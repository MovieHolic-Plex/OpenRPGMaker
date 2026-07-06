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
    expect(project.system.titleScreen?.backgroundResourceId).toBe("easyrpg-title-title1");
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
});
