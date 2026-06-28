import { afterEach, describe, expect, it, vi } from "vitest";

describe("Project store remote persistence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
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
});
