import { vi } from "vitest";
import { spatialPersistenceHttp } from "./spatialPersistenceHttp";
import { spatialFixture } from "./spatialSchemaFixture";

/** Real store/sync/HTTP; spies only await background audit writes, never replace behavior. */
export async function spatialStoreFixture(root?: Record<string, unknown>) {
  const http = await spatialPersistenceHttp();
  try {
    vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
    vi.stubEnv("VITE_SUPABASE_URL", http.config.url);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", http.config.anonKey);
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", http.config.projectId);
    vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
    const entries = new Map<string, string>();
    const location = new URL(`http://127.0.0.1/?project=${http.config.projectId}`);
    const browser = {
      location,
      history: { state: null, replaceState: (_state: unknown, _title: string, url: string | URL) => { location.href = new URL(String(url), location).href; } },
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => { entries.set(key, value); },
        removeItem: (key: string) => { entries.delete(key); },
      },
    };
    vi.stubGlobal("window", browser);
    const fixture = spatialFixture();
    http.state.root = root ?? { ...fixture.project, spatialAuthoring: fixture.document };
    const sync = await import("../../src/project/supabaseProjectSync");
    const audit = vi.spyOn(sync, "recordProjectCommitToSupabase");
    const { store } = await import("../../src/project/store");
    return {
      http, store, sync, browser,
      async [Symbol.asyncDispose]() {
        for (const result of audit.mock.results) if (result.type === "return") await result.value;
        await http[Symbol.asyncDispose]();
      },
    };
  } catch (error) {
    await http[Symbol.asyncDispose]();
    throw error;
  }
}
