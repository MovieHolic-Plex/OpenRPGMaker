import { afterEach, describe, expect, it, vi } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import {
  loadProjectFromSupabaseCanonicalStore,
  recordAiAnalysisRun,
  saveProjectToSupabaseCanonicalStore,
} from "@/project/tileMetadataDb";

type FetchCall = {
  readonly init: RequestInit | undefined;
  readonly input: RequestInfo | URL;
};

const TEST_ENV = {
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  VITE_SUPABASE_PROJECT_ID: "rpg-zzu-house-template-gallery",
  VITE_SUPABASE_URL: "http://dbserver:8100",
} as const;

describe("canonical project persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("loads project snapshots through Supabase instead of browser IndexedDB", async () => {
    const source = createHouseTemplateGalleryProject();
    stubSupabaseEnv();
    vi.stubGlobal("indexedDB", failingIndexedDb());
    vi.stubGlobal("fetch", (async () => (
      new Response(JSON.stringify([{ current_json: JSON.parse(serialize(source)) }]), { status: 200 })
    )) satisfies typeof fetch);

    const restored = await loadProjectFromSupabaseCanonicalStore();

    expect(restored.found).toBe(true);
    expect(restored.project?.startMapId).toBe(source.startMapId);
  });

  it("saves Supabase canonical project snapshots", async () => {
    const project = createHouseTemplateGalleryProject();
    const calls: FetchCall[] = [];
    stubSupabaseEnv();
    vi.stubGlobal("indexedDB", failingIndexedDb());
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    await saveProjectToSupabaseCanonicalStore(project);

    expect(String(calls[0]?.input)).toContain("/rest/v1/projects?");
    expect(calls[0]?.init?.method).toBe("POST");
  });

  it("store flush and AI analysis logging do not touch IndexedDB", async () => {
    const calls: FetchCall[] = [];
    stubSupabaseEnv();
    vi.stubGlobal("indexedDB", failingIndexedDb());
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);
    store.replace(createHouseTemplateGalleryProject());

    await store.flush();
    await recordAiAnalysisRun({
      tilesetId: "easyrpg_chipset_combined_town",
      selectedTiles: [240],
      promptContext: { prompt: "classify" },
      result: { ok: true },
    });

    expect(calls.some((call) => String(call.input).includes("/rest/v1/projects?"))).toBe(true);
    expect(calls.some((call) => String(call.input).includes("/rest/v1/ai_analysis_runs?"))).toBe(true);
  });
});

function stubSupabaseEnv(): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", TEST_ENV.VITE_SUPABASE_ANON_KEY);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", TEST_ENV.VITE_SUPABASE_PROJECT_ID);
  vi.stubEnv("VITE_SUPABASE_URL", TEST_ENV.VITE_SUPABASE_URL);
}

function failingIndexedDb(): object {
  return new Proxy({}, {
    get() {
      throw new Error("IndexedDB must not be used for canonical project persistence");
    },
  });
}
