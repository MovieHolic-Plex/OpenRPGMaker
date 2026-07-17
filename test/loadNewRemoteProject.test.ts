import { afterEach, describe, expect, it, vi } from "vitest";

describe("store.loadNewRemoteProject — welcome genre remote branch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps remote persistence on, mints a new project id, and does not disable DB", async () => {
    const storage = new Map<string, string>();
    const location = {
      hostname: "127.0.0.1",
      pathname: "/",
      search: "?project=rpg-zzu-dungeon-example",
      href: "http://127.0.0.1:9999/?project=rpg-zzu-dungeon-example",
      hash: "",
    };
    vi.stubGlobal("window", {
      location,
      history: {
        state: null,
        replaceState: (_state: unknown, _title: string, url: string) => {
          const next = new URL(url, "http://127.0.0.1:9999");
          location.pathname = next.pathname;
          location.search = next.search;
          location.hash = next.hash;
          location.href = next.toString();
        },
      },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
      },
    });
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-dungeon-example");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");
    const { supabaseProjectConfig } = await import("@/project/supabaseProjectConfig");

    const result = await store.loadNewRemoteProject(createBlankProject(), { title: "몬스터 수집" });

    expect(store.isLoaded()).toBe(true);
    expect(store.getCurrent().meta.title).toBe("몬스터 수집");
    expect(result.projectId).toMatch(/^rpg-zzu-[a-f0-9]{10}$/);
    expect(result.projectId).not.toBe("rpg-zzu-dungeon-example");

    const config = supabaseProjectConfig();
    expect(config?.projectId).toBe(result.projectId);
    expect(store.getDbPersistenceStatus().kind).toBe("ready");

    // Remote path stays open — flush is not disabled by the welcome blank branch.
    const flushed = await store.flush();
    expect(flushed.kind).not.toBe("disabled");
    expect(flushed.kind).not.toBe("not-configured");
  });

  it("without DB config stays not-configured rather than load-failed disabled", async () => {
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "", href: "http://127.0.0.1:9999/" },
      history: { replaceState: () => undefined },
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    });
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
    vi.resetModules();

    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");

    const result = await store.loadNewRemoteProject(createBlankProject());
    expect(result.projectId).toBeNull();
    expect(store.getDbPersistenceStatus().kind).toBe("not-configured");
    const flushed = await store.flush();
    expect(flushed.kind).toBe("not-configured");
  });
});
