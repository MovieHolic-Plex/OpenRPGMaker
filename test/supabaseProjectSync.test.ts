import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SUPABASE_PROJECT_ID,
  listSupabaseProjects,
  loadProjectFromSupabase,
  recordSupabaseAiAnalysisRun,
  saveProjectMapPatchToSupabase,
  saveProjectToSupabase,
} from "@/project/supabaseProjectSync";
import { createHouseTemplateGalleryProject } from "@/project/defaults";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { GameMap, MapTreeNode, Project } from "@/project/types";

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

  it("lists Supabase projects for direct project selection", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify([
        {
          current_json: { meta: { title: "안개 항구와 등대의 밤" } },
          project_id: "fog-harbor-lighthouse",
          title: null,
        },
        {
          current_json: { meta: { title: "Fallback ignored" } },
          project_id: "star-village",
          title: "별등 마을",
        },
      ]), { status: 200 });
    }) satisfies typeof fetch);

    const projects = await listSupabaseProjects(TEST_CONFIG);

    expect(projects).toEqual([
      { projectId: "fog-harbor-lighthouse", title: "안개 항구와 등대의 밤" },
      { projectId: "star-village", title: "별등 마을" },
    ]);
    expect(String(calls[0]?.input)).toContain("/rest/v1/projects?");
    expect(String(calls[0]?.input)).toContain("select=project_id%2Ctitle%2Ccurrent_json");
    expect(String(calls[0]?.input)).toContain("order=project_id.asc");
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

  it("repairs legacy sprite references from Supabase rows before project use", async () => {
    const source = JSON.parse(serialize(createHouseTemplateGalleryProject()));
    const legacySpriteId = legacySpriteReference("npc", "villager");
    const legacyTextureId = legacySpriteReference("tex", "npc", "villager");
    addLegacySpriteProbe(source, legacySpriteId, legacyTextureId);
    vi.stubGlobal("fetch", (async () => (
      new Response(JSON.stringify([{ current_json: source }]), { status: 200 })
    )) satisfies typeof fetch);

    const project = await loadProjectFromSupabase(TEST_CONFIG);
    const serialized = JSON.stringify(project);

    expect(serialized).not.toContain(legacySpriteId);
    expect(serialized).not.toContain(legacyTextureId);
    expect(serialized).toContain(DEFAULT_EASYRPG_CHARSET_ID);
  });

  it("drops Supabase village info documents for maps that no longer exist", async () => {
    const source = JSON.parse(serialize(createHouseTemplateGalleryProject()));
    if (!isRecord(source) || !isRecord(source.maps)) throw new Error("expected serialized project maps");
    const mapId = Object.keys(source.maps)[0];
    if (!mapId) throw new Error("expected at least one map");
    source.villageInfoDocuments = [
      { id: "doc_valid", mapId, title: "Valid.md", markdown: "# Valid" },
      { id: "doc_stale", mapId: "map_moonwell_forest", title: "Stale.md", markdown: "# Stale" },
    ];
    vi.stubGlobal("fetch", (async () => (
      new Response(JSON.stringify([{ current_json: source }]), { status: 200 })
    )) satisfies typeof fetch);

    const project = await loadProjectFromSupabase(TEST_CONFIG);

    expect(project?.villageInfoDocuments?.map((document) => document.id)).toEqual(["doc_valid"]);
  });

  it("removes legacy sprite references from Supabase save payloads", async () => {
    const project = createHouseTemplateGalleryProject();
    const legacySpriteId = legacySpriteReference("npc", "villager");
    const legacyTextureId = legacySpriteReference("tex", "npc", "villager");
    addLegacySpriteProbe(project, legacySpriteId, legacyTextureId);
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    await saveProjectToSupabase(project, TEST_CONFIG);
    const body = calls[0]?.init?.body;
    if (typeof body !== "string") throw new Error("expected string body");

    expect(body).not.toContain(legacySpriteId);
    expect(body).not.toContain(legacyTextureId);
    expect(body).toContain(DEFAULT_EASYRPG_CHARSET_ID);
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
    expect(payload.tileset_count).toBe(Object.keys(project.tilesets).length);
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

  it("merges a changed map into the latest project without replacing other maps", async () => {
    const baseProject = createHouseTemplateGalleryProject();
    const localProject = structuredClone(baseProject);
    const latestProject = structuredClone(baseProject);
    const editedMapId = firstMapId(baseProject);
    const remoteMapId = differentMapId(baseProject, editedMapId);
    localProject.maps[editedMapId] = renameMap(requiredMap(localProject, editedMapId), "Local edited map");
    latestProject.maps[remoteMapId] = renameMap(requiredMap(latestProject, remoteMapId), "Remote edited map");
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      if (calls.length === 1) {
        return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(latestProject)) }]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);
    const projectBody = calls[1]?.init?.body;
    if (typeof projectBody !== "string") throw new Error("expected project upsert body");
    const projectPayload = parseRecord(projectBody);
    const currentJson = projectPayload.current_json;
    if (!isRecord(currentJson) || !isRecord(currentJson.maps)) throw new Error("expected current_json maps");
    const mapRowsBody = calls[2]?.init?.body;
    if (typeof mapRowsBody !== "string") throw new Error("expected map rows body");
    const mapRows = parseRecords(mapRowsBody);

    expect(result.kind).toBe("saved");
    expect(requiredSerializedMapName(currentJson.maps, editedMapId)).toBe("Local edited map");
    expect(requiredSerializedMapName(currentJson.maps, remoteMapId)).toBe("Remote edited map");
    expect(String(calls[0]?.input)).toContain("/rest/v1/projects?");
    expect(String(calls[1]?.input)).toContain("on_conflict=project_id");
    expect(String(calls[2]?.input)).toContain("/rest/v1/maps?");
    expect(calls.some((call) => String(call.input).includes("/rest/v1/maps?") && call.init?.method === "DELETE")).toBe(false);
    expect(mapRows.map((row) => row.map_id)).toEqual([editedMapId]);
  });

  it("stops a stale same-map save before it overwrites a newer DB map", async () => {
    const baseProject = createHouseTemplateGalleryProject();
    const localProject = structuredClone(baseProject);
    const latestProject = structuredClone(baseProject);
    const editedMapId = firstMapId(baseProject);
    localProject.maps[editedMapId] = renameMap(requiredMap(localProject, editedMapId), "Local edited map");
    latestProject.maps[editedMapId] = renameMap(requiredMap(latestProject, editedMapId), "Remote edited map");
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(latestProject)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);

    expect(result.kind).toBe("conflict");
    if (result.kind !== "conflict") throw new Error("expected conflict result");
    expect(result.conflicts.map((conflict) => conflict.mapId)).toEqual([editedMapId]);
    expect(calls).toHaveLength(1);
  });

  it("preserves concurrent saves from separate editors touching different maps", async () => {
    const baseProject = createHouseTemplateGalleryProject();
    const firstEditorProject = structuredClone(baseProject);
    const secondEditorProject = structuredClone(baseProject);
    const firstMapId = firstMapIdOf(baseProject);
    const secondMapId = differentMapId(baseProject, firstMapId);
    firstEditorProject.maps[firstMapId] = renameMap(requiredMap(firstEditorProject, firstMapId), "Editor A map");
    secondEditorProject.maps[secondMapId] = renameMap(requiredMap(secondEditorProject, secondMapId), "Editor B map");
    let remoteProject = structuredClone(baseProject);
    let remoteSha256 = await projectSha256(remoteProject);
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(JSON.stringify([{
          current_json: JSON.parse(serialize(remoteProject)),
          current_sha256: remoteSha256,
        }]), { status: 200 });
      }
      if (method === "PATCH") {
        if (!String(input).includes(`current_sha256=eq.${remoteSha256}`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        const payload = bodyRecord(init);
        remoteProject = deserialize(JSON.stringify(payload.current_json));
        remoteSha256 = String(payload.current_sha256);
        return new Response(JSON.stringify([payload]), { status: 200 });
      }
      if (method === "POST" && String(input).includes("/rest/v1/projects?")) {
        const payload = bodyRecord(init);
        remoteProject = deserialize(JSON.stringify(payload.current_json));
        remoteSha256 = String(payload.current_sha256);
        return new Response(null, { status: 201 });
      }
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const [firstResult, secondResult] = await Promise.all([
      saveProjectMapPatchToSupabase({ project: firstEditorProject, baseProject }, TEST_CONFIG),
      saveProjectMapPatchToSupabase({ project: secondEditorProject, baseProject }, TEST_CONFIG),
    ]);

    expect(firstResult.kind).toBe("saved");
    expect(secondResult.kind).toBe("saved");
    expect(requiredMap(remoteProject, firstMapId).name).toBe("Editor A map");
    expect(requiredMap(remoteProject, secondMapId).name).toBe("Editor B map");
    expect(calls.filter((call) => call.init?.method === "PATCH")).toHaveLength(3);
  });

  it("preserves concurrent map tree additions from separate editors", async () => {
    const baseProject = createHouseTemplateGalleryProject();
    const firstEditorProject = structuredClone(baseProject);
    const secondEditorProject = structuredClone(baseProject);
    const sourceMap = requiredMap(baseProject, firstMapIdOf(baseProject));
    const firstNewMap = renameMap({ ...sourceMap, id: "editor_a_new_map" }, "Editor A new map");
    const secondNewMap = renameMap({ ...sourceMap, id: "editor_b_new_map" }, "Editor B new map");
    firstEditorProject.maps[firstNewMap.id] = firstNewMap;
    firstEditorProject.mapTree = appendMapTreeChild(firstEditorProject.mapTree, firstNewMap.id);
    secondEditorProject.maps[secondNewMap.id] = secondNewMap;
    secondEditorProject.mapTree = appendMapTreeChild(secondEditorProject.mapTree, secondNewMap.id);
    let remoteProject = structuredClone(baseProject);
    let remoteSha256 = await projectSha256(remoteProject);
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(JSON.stringify([{
          current_json: JSON.parse(serialize(remoteProject)),
          current_sha256: remoteSha256,
        }]), { status: 200 });
      }
      if (method === "PATCH") {
        if (!String(input).includes(`current_sha256=eq.${remoteSha256}`)) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        const payload = bodyRecord(init);
        remoteProject = deserialize(JSON.stringify(payload.current_json));
        remoteSha256 = String(payload.current_sha256);
        return new Response(JSON.stringify([payload]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const [firstResult, secondResult] = await Promise.all([
      saveProjectMapPatchToSupabase({ project: firstEditorProject, baseProject }, TEST_CONFIG),
      saveProjectMapPatchToSupabase({ project: secondEditorProject, baseProject }, TEST_CONFIG),
    ]);

    expect(firstResult.kind).toBe("saved");
    expect(secondResult.kind).toBe("saved");
    expect(requiredMap(remoteProject, firstNewMap.id).name).toBe("Editor A new map");
    expect(requiredMap(remoteProject, secondNewMap.id).name).toBe("Editor B new map");
    expect(mapTreeContains(remoteProject.mapTree, firstNewMap.id)).toBe(true);
    expect(mapTreeContains(remoteProject.mapTree, secondNewMap.id)).toBe(true);
    expect(calls.filter((call) => call.init?.method === "PATCH")).toHaveLength(3);
  });

  it("does not undo a remote same-map reparent when saving only that map content", async () => {
    const baseProject = createHouseTemplateGalleryProject();
    const localProject = structuredClone(baseProject);
    const remoteProject = structuredClone(baseProject);
    const editedMapId = differentMapId(baseProject, firstMapIdOf(baseProject));
    localProject.maps[editedMapId] = renameMap(requiredMap(localProject, editedMapId), "Editor A content");
    remoteProject.mapTree = moveMapTreeChildToRootEnd(remoteProject.mapTree, editedMapId);
    const remoteSha256 = await projectSha256(remoteProject);
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(JSON.stringify([{
          current_json: JSON.parse(serialize(remoteProject)),
          current_sha256: remoteSha256,
        }]), { status: 200 });
      }
      if (method === "PATCH") {
        return new Response(JSON.stringify([bodyRecord(init)]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);
    const projectBody = calls[1]?.init?.body;
    if (typeof projectBody !== "string") throw new Error("expected project upsert body");
    const projectPayload = parseRecord(projectBody);
    const currentJson = projectPayload.current_json;
    if (!isRecord(currentJson) || !isRecord(currentJson.mapTree)) throw new Error("expected current_json mapTree");
    const mergedProject = deserialize(JSON.stringify(currentJson));

    expect(result.kind).toBe("saved");
    expect(requiredMap(mergedProject, editedMapId).name).toBe("Editor A content");
    expect(mapTreeParent(mergedProject.mapTree, editedMapId)).toBe(mergedProject.mapTree.mapId);
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

function bodyRecord(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") throw new Error("expected string request body");
  return parseRecord(init.body);
}

function firstMapIdOf(project: Project): string {
  const mapId = Object.keys(project.maps)[0];
  if (!mapId) throw new Error("expected at least one map");
  return mapId;
}

function firstMapId(project: Project): string {
  return firstMapIdOf(project);
}

function differentMapId(project: Project, excludedMapId: string): string {
  const mapId = Object.keys(project.maps).find((candidate) => candidate !== excludedMapId);
  if (!mapId) throw new Error("expected a second map");
  return mapId;
}

function requiredMap(project: Project, mapId: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new Error(`expected map ${mapId}`);
  return map;
}

function renameMap(map: GameMap, name: string): GameMap {
  return { ...map, name };
}

function appendMapTreeChild(tree: MapTreeNode, mapId: string): MapTreeNode {
  return { ...tree, children: [...tree.children, { mapId, children: [] }] };
}

function mapTreeContains(tree: MapTreeNode, mapId: string): boolean {
  return tree.mapId === mapId || tree.children.some((child) => mapTreeContains(child, mapId));
}

function moveMapTreeChildToRootEnd(tree: MapTreeNode, mapId: string): MapTreeNode {
  return appendMapTreeChild(removeMapTreeNode(tree, mapId), mapId);
}

function removeMapTreeNode(tree: MapTreeNode, mapId: string): MapTreeNode {
  return { ...tree, children: tree.children.filter((child) => child.mapId !== mapId).map((child) => removeMapTreeNode(child, mapId)) };
}

function mapTreeParent(tree: MapTreeNode, mapId: string, parentId: string | null = null): string | null {
  if (tree.mapId === mapId) return parentId;
  for (const child of tree.children) {
    const found = mapTreeParent(child, mapId, tree.mapId);
    if (found) return found;
  }
  return null;
}

function requiredSerializedMapName(maps: Record<string, unknown>, mapId: string): string {
  const map = maps[mapId];
  if (!isRecord(map) || typeof map.name !== "string") throw new Error(`expected serialized map ${mapId}`);
  return map.name;
}

function legacySpriteReference(...parts: readonly string[]): string {
  return parts.join("_");
}

function addLegacySpriteProbe(project: unknown, legacySpriteId: string, legacyTextureId: string): void {
  if (!isRecord(project) || !isRecord(project.maps)) throw new Error("expected project maps");
  const map = Object.values(project.maps).find(isRecord);
  if (!map) throw new Error("expected at least one map");
  const events = Array.isArray(map.events) ? map.events : [];
  map.events = events;
  events.push({
    id: "ev_legacy_sprite_probe",
    x: 1,
    y: 1,
    sprite: { type: "bundled", id: legacySpriteId },
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "legacy_sprite_probe_page",
        name: "Legacy sprite probe",
        conditions: [],
        graphic: { sprite: { type: "bundled", id: legacyTextureId } },
        trigger: { kind: "action" },
        priority: "same",
        movement: {
          type: "custom",
          speed: 3,
          frequency: 3,
          route: {
            repeat: false,
            skippable: true,
            moves: [{ kind: "changeGraphic", spriteId: legacyTextureId }],
          },
        },
        commands: [],
      },
    ],
  });

  if (isRecord(project.assets) && isRecord(project.assets.sprites)) {
    project.assets.sprites[legacyTextureId] = {
      id: legacyTextureId,
      image: { type: "bundled", id: legacyTextureId },
      frames: 8,
      frameWidth: 32,
      frameHeight: 32,
    };
  }

  const resourceProfiles = Array.isArray(project.resourceProfiles) ? project.resourceProfiles : [];
  project.resourceProfiles = resourceProfiles;
  resourceProfiles.push({
    kind: "monster",
    name: "Legacy sprite probe",
    assetId: legacyTextureId,
  });
}

async function projectSha256(project: Project): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialize(project)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
