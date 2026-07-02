import { afterEach, describe, expect, it, vi } from "vitest";

describe("Supabase project runtime config", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses legacy browser DB config only when Vite env is empty", async () => {
    const storage = new Map<string, string>();
    storage.set(
      "rpg-zzu:supabase-project-config",
      JSON.stringify({ url: "http://dbserver:8100/", anonKey: "runtime-key", projectId: "runtime-project" }),
    );
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();

    const { dbPersistenceStatus } = await import("@/project/persistenceStatus");

    expect(dbPersistenceStatus({ disabledReason: null, env: {} })).toEqual({
      kind: "ready",
      projectId: "runtime-project",
      source: "legacy",
      url: "http://dbserver:8100",
    });
  });

  it("uses Vite env as the default when stale legacy browser config exists", async () => {
    const storage = new Map<string, string>();
    storage.set(
      "rpg-zzu:supabase-project-config",
      JSON.stringify({ url: "http://127.0.0.1:1", anonKey: "stale-key", projectId: "stale-project" }),
    );
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();

    const { dbPersistenceStatus } = await import("@/project/persistenceStatus");

    expect(
      dbPersistenceStatus({
        disabledReason: null,
        env: {
          VITE_SUPABASE_ANON_KEY: "env-key",
          VITE_SUPABASE_PROJECT_ID: "env-project",
          VITE_SUPABASE_URL: "http://dbserver:8100",
        },
      }),
    ).toEqual({
      kind: "ready",
      projectId: "env-project",
      source: "env",
      url: "http://dbserver:8100",
    });
  });

  it("normalizes and saves browser DB config", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.resetModules();

    const { saveSupabaseProjectConfigDraft, supabaseProjectConfig, supabaseProjectConfigDraftWithSource } = await import(
      "@/project/supabaseProjectConfig"
    );
    saveSupabaseProjectConfigDraft({ anonKey: " key ", projectId: " project ", url: "http://dbserver:8100/" });

    expect(supabaseProjectConfig({})).toEqual({
      anonKey: "key",
      projectId: "project",
      url: "http://dbserver:8100",
    });
    expect(supabaseProjectConfigDraftWithSource({}).source).toBe("custom");
    expect(storage.get("rpg-zzu:supabase-project-config")).toContain('"source":"custom"');
  });
});
