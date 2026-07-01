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
    // store.load()는 Supabase 네트워크 로드에 결합되어 있으므로, flush() 경로만
    // 격리하기 위해 loaded=true + 원격 저장 활성화 상태를 직접 설정한다.
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
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

  it("reports when canonical persistence is not configured instead of pretending to save", async () => {
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", (async () => {
      throw new Error("fetch should not run without Supabase env");
    }) satisfies typeof fetch);
    // env가 설정되어 있지 않으면(not-configured) flush()는 fetch를 호출하지 않고
    // not-configured 결과를 반환해야 한다. loaded=true로 게이트를 통과시킨다.
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(createHouseTemplateGalleryProject());

    const result = await store.flush();

    expect(result.kind).toBe("not-configured");
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
