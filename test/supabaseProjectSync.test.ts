import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SUPABASE_PROJECT_ID,
  loadProjectFromSupabase,
  recordSupabaseAiAnalysisRun,
  saveProjectToSupabase,
} from "@/project/supabaseProjectSync";
import { createHouseTemplateGalleryProject } from "@/project/defaults";
import { serialize } from "@/project/io";

const TEST_CONFIG = {
  anonKey: "test-anon-key",
  projectId: "rpg-zzu-house-template-gallery",
  url: "http://dbserver:8100",
} as const;

type FetchCall = {
  readonly init: RequestInit | undefined;
  readonly input: RequestInfo | URL;
};

describe("Supabase project sync", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("loads a Supabase current_json row through the project parser", async () => {
    const source = createHouseTemplateGalleryProject();
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(source)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const project = await loadProjectFromSupabase(TEST_CONFIG);

    expect(Object.values(project?.maps ?? {}).some((map) => map.width === 50 && map.height === 50)).toBe(true);
    expect(String(calls[0]?.input)).toContain("/rest/v1/projects?");
    expect(calls[0]?.init?.headers).toMatchObject({
      "Accept-Profile": "rpg_zzu",
      apikey: "test-anon-key",
    });
  });

  it("uses the app canonical Supabase project id when the env id is omitted", async () => {
    const source = createHouseTemplateGalleryProject();
    const calls: FetchCall[] = [];
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(source)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const project = await loadProjectFromSupabase();

    expect(project?.startMapId).toBe(source.startMapId);
    expect(String(calls[0]?.input)).toContain(`project_id=eq.${DEFAULT_SUPABASE_PROJECT_ID}`);
  });

  it("repairs sparse Supabase current_json database defaults before reference validation", async () => {
    const source = JSON.parse(serialize(createHouseTemplateGalleryProject()));
    if (!isRecord(source) || !isRecord(source.database) || !Array.isArray(source.database.skills)) {
      throw new Error("expected serialized project database skills");
    }
    source.database.skills = source.database.skills.filter((skill) => isRecord(skill) && skill.id !== "skill_item_ether");
    vi.stubGlobal("fetch", (async () => (
      new Response(JSON.stringify([{ current_json: source }]), { status: 200 })
    )) satisfies typeof fetch);

    const project = await loadProjectFromSupabase(TEST_CONFIG);

    expect(project?.database.skills.some((skill) => skill.id === "skill_item_ether")).toBe(true);
    expect(project?.database.items.some((item) => item.id === "item_ether" && item.skillId === "skill_item_ether")).toBe(true);
  });

  it("saves the project as a Supabase projects upsert payload", async () => {
    const project = createHouseTemplateGalleryProject();
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const result = await saveProjectToSupabase(project, TEST_CONFIG);
    const body = calls[0]?.init?.body;
    if (typeof body !== "string") throw new Error("expected string body");
    const payload = parseRecord(body);

    expect(result.kind).toBe("saved");
    expect(String(calls[0]?.input)).toContain("on_conflict=project_id");
    expect(String(calls[1]?.input)).toContain("/rest/v1/maps?");
    expect(calls[1]?.init?.method).toBe("DELETE");
    expect(String(calls[2]?.input)).toContain("/rest/v1/maps?");
    expect(String(calls[3]?.input)).toContain("/rest/v1/tilesets?");
    expect(calls[3]?.init?.method).toBe("DELETE");
    expect(String(calls[4]?.input)).toContain("/rest/v1/tilesets?");
    expect(String(calls[5]?.input)).toContain("/rest/v1/terrain_templates?");
    expect(calls[5]?.init?.method).toBe("DELETE");
    expect(String(calls[6]?.input)).toContain("/rest/v1/terrain_templates?");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toMatchObject({
      "Content-Profile": "rpg_zzu",
      Prefer: "resolution=merge-duplicates,return=minimal",
    });
    expect(payload.project_id).toBe(TEST_CONFIG.projectId);
    expect(payload.map_count).toBe(6);
    expect(payload.tileset_count).toBe(10);
    expect(payload.current_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps current_json as canonical when optional normalized tables are absent", async () => {
    const project = createHouseTemplateGalleryProject();
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      if (calls.length === 1) return new Response(null, { status: 201 });
      return new Response(JSON.stringify({
        code: "PGRST205",
        message: "Could not find the table 'rpg_zzu.maps' in the schema cache",
      }), { status: 404 });
    }) satisfies typeof fetch);

    const result = await saveProjectToSupabase(project, TEST_CONFIG);

    expect(result.kind).toBe("saved");
    expect(calls).toHaveLength(2);
    expect(String(calls[0]?.input)).toContain("/rest/v1/projects?");
    expect(String(calls[1]?.input)).toContain("/rest/v1/maps?");
  });

  it("records AI tile analysis runs in Supabase", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const result = await recordSupabaseAiAnalysisRun({
      tilesetId: "easyrpg_chipset_combined_town",
      selectedTiles: [240, 405],
      promptContext: { intent: "terrain-template" },
      result: { status: "ok" },
    }, TEST_CONFIG);
    const body = calls[0]?.init?.body;
    if (typeof body !== "string") throw new Error("expected string body");
    const payload = parseRecords(body)[0];
    if (!payload) throw new Error("expected one AI analysis row");

    expect(result.kind).toBe("saved");
    expect(String(calls[0]?.input)).toContain("/rest/v1/ai_analysis_runs?");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toMatchObject({
      "Content-Profile": "rpg_zzu",
      Prefer: "resolution=merge-duplicates,return=minimal",
    });
    expect(payload.project_id).toBe(TEST_CONFIG.projectId);
    expect(payload.tileset_id).toBe("easyrpg_chipset_combined_town");
    expect(payload.selected_tile_ids_json).toEqual([240, 405]);
    expect(payload.prompt_context_json).toEqual({ intent: "terrain-template" });
    expect(payload.result_json).toEqual({ status: "ok" });
  });

  it("treats a missing AI analysis table as an optional logging sink", async () => {
    vi.stubGlobal("fetch", (async () => (
      new Response(JSON.stringify({
        code: "PGRST205",
        message: "Could not find the table 'rpg_zzu.ai_analysis_runs' in the schema cache",
      }), { status: 404 })
    )) satisfies typeof fetch);

    const result = await recordSupabaseAiAnalysisRun({
      tilesetId: "easyrpg_chipset_combined_town",
      selectedTiles: [240],
      promptContext: { intent: "classify" },
      result: { status: "ok" },
    }, TEST_CONFIG);

    expect(result.kind).toBe("not-configured");
  });
});

function parseRecord(json: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) {
    throw new Error("expected JSON object");
  }
  return parsed;
}

function parseRecords(json: string): readonly Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
    throw new Error("expected JSON object array");
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
