import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SUPABASE_PROJECT_ID,
  hydrateLastRemoteCommitTip,
  listSupabaseAiActivityLogs,
  listSupabaseProjects,
  loadProjectFromSupabase,
  peekLastRemoteCommitTip,
  recordSupabaseAiActivityLog,
  recordSupabaseAiAnalysisRun,
  recordSupabaseConversation,
  recordSupabaseUserSkill,
  saveProjectMapPatchToSupabase,
  saveProjectToSupabase,
  seedLastRemoteCommitTip,
} from "@/project/supabaseProjectSync";
import { createBlankProject, createHouseTemplateGalleryProject } from "@/project/defaults";
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
      if (String(input).includes("/rest/v1/maps?")) return new Response(JSON.stringify([]), { status: 200 });
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
          project_id: "fog-harbor-lighthouse",
          title: "안개 항구와 등대의 밤",
          map_count: 4,
          tileset_count: 12,
          updated_at: "2026-07-30T21:53:00+00:00",
        },
        {
          project_id: "star-village",
          title: "별등 마을",
          map_count: 2,
          tileset_count: 12,
          updated_at: "2026-07-28T10:00:00+00:00",
        },
        {
          project_id: "untitled-project",
          title: null,
        },
      ]), { status: 200 });
    }) satisfies typeof fetch);

    const projects = await listSupabaseProjects(TEST_CONFIG);

    expect(projects).toEqual([
      {
        projectId: "fog-harbor-lighthouse",
        title: "안개 항구와 등대의 밤",
        mapCount: 4,
        tilesetCount: 12,
        updatedAt: "2026-07-30T21:53:00+00:00",
      },
      {
        projectId: "star-village",
        title: "별등 마을",
        mapCount: 2,
        tilesetCount: 12,
        updatedAt: "2026-07-28T10:00:00+00:00",
      },
      // 카운트/시각 컬럼이 없는 행도 목록에서 빠지지 않는다.
      { projectId: "untitled-project", title: "untitled-project", mapCount: 0, tilesetCount: 0, updatedAt: null },
    ]);
    expect(String(calls[0]?.input)).toContain("/rest/v1/projects?");
    expect(String(calls[0]?.input)).toContain("select=project_id%2Ctitle");
    expect(String(calls[0]?.input)).toContain("map_count");
    expect(String(calls[0]?.input)).not.toContain("current_json");
    expect(String(calls[0]?.input)).toContain("order=updated_at.desc");
    expect(calls[0]?.init?.headers).toMatchObject({
      "Accept-Profile": "rpg_zzu",
      apikey: "test-anon-key",
    });
  });

  it("uses the app canonical Supabase project id when the env id is omitted", async () => {
    const source = createHouseTemplateGalleryProject();
    const calls: FetchCall[] = [];
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      if (String(input).includes("/rest/v1/maps?")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(source)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const project = await loadProjectFromSupabase();

    expect(project?.startMapId).toBe(source.startMapId);
    expect(String(calls[0]?.input)).toContain(`project_id=eq.${DEFAULT_SUPABASE_PROJECT_ID}`);
  });

  it("treats Supabase current_json as canonical — does not backfill removed database records", async () => {
    // DB is the source of truth for authored database records (items, skills, states,
    // animations). A sparse DB row must load as-is; JSON defaults never silently re-add
    // authored records the DB row omits. Local is cache-only.
    const source = JSON.parse(serialize(minimalValidProject()));
    expect(source.database.items.some((item: { id: string }) => item.id === "item_capture_orb")).toBe(true);
    // drop a leaf default item (no skillId, not an enemy drop target) from the DB row
    source.database.items = source.database.items.filter((item: { id: string }) => item.id !== "item_capture_orb");
    vi.stubGlobal("fetch", (async (input) => {
      if (String(input).includes("/rest/v1/maps?")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([{ current_json: source }]), { status: 200 });
    }) satisfies typeof fetch);

    const project = await loadProjectFromSupabase(TEST_CONFIG);

    // Removed item stays removed — no JSON-default backfill on load.
    expect(project?.database.items.some((item) => item.id === "item_capture_orb")).toBe(false);
    // Untouched items still load from the DB row (proves DB load works, not empty).
    expect((project?.database.items.length ?? 0)).toBeGreaterThan(0);
  });

  it("repairs legacy sprite references from Supabase rows before project use", async () => {
    const source = JSON.parse(serialize(createHouseTemplateGalleryProject()));
    const legacySpriteId = legacySpriteReference("npc", "villager");
    const legacyTextureId = legacySpriteReference("tex", "npc", "villager");
    addLegacySpriteProbe(source, legacySpriteId, legacyTextureId);
    vi.stubGlobal("fetch", (async (input) => {
      if (String(input).includes("/rest/v1/maps?")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([{ current_json: source }]), { status: 200 });
    }) satisfies typeof fetch);

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
    vi.stubGlobal("fetch", (async (input) => {
      if (String(input).includes("/rest/v1/maps?")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify([{ current_json: source }]), { status: 200 });
    }) satisfies typeof fetch);

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
    expect(calls.some((call) => String(call.input).includes("/rest/v1/terrain_templates?"))).toBe(false);
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
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/rest/v1/projects?")) {
        return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(latestProject)) }]), { status: 200 });
      }
      if (method === "GET" && url.includes("/rest/v1/maps?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);
    const projectCall = calls.find((call) => String(call.input).includes("/rest/v1/projects?") && (call.init?.method === "POST" || call.init?.method === "PATCH"));
    const projectBody = projectCall?.init?.body;
    if (typeof projectBody !== "string") throw new Error("expected project upsert body");
    const projectPayload = parseRecord(projectBody);
    const currentJson = projectPayload.current_json;
    if (!isRecord(currentJson) || !isRecord(currentJson.maps)) throw new Error("expected current_json maps");
    const mapRowsCall = calls.find((call) => String(call.input).includes("/rest/v1/maps?") && call.init?.method === "POST");
    const mapRowsBody = mapRowsCall?.init?.body;
    if (typeof mapRowsBody !== "string") throw new Error("expected map rows body");
    const mapRows = parseRecords(mapRowsBody);

    expect(result.kind).toBe("saved");
    expect(requiredSerializedMapName(currentJson.maps, editedMapId)).toBe("Local edited map");
    expect(requiredSerializedMapName(currentJson.maps, remoteMapId)).toBe("Remote edited map");
    expect(calls.some((call) => String(call.input).includes("/rest/v1/projects?") && (call.init?.method ?? "GET") === "GET")).toBe(true);
    expect(String(projectCall?.input)).toContain("on_conflict=project_id");
    expect(String(mapRowsCall?.input)).toContain("/rest/v1/maps?");
    expect(calls.some((call) => String(call.input).includes("/rest/v1/maps?") && call.init?.method === "DELETE")).toBe(false);
    expect(mapRows.map((row) => row.map_id)).toEqual([editedMapId]);
  });

  it("does not stop a stale same-map save before it overwrites a newer DB map", async () => {
    const baseProject = createHouseTemplateGalleryProject();
    const localProject = structuredClone(baseProject);
    const latestProject = structuredClone(baseProject);
    const editedMapId = firstMapId(baseProject);
    localProject.maps[editedMapId] = renameMap(requiredMap(localProject, editedMapId), "Local edited map");
    latestProject.maps[editedMapId] = renameMap(requiredMap(latestProject, editedMapId), "Remote edited map");
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/rest/v1/maps?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (method === "POST" && url.includes("/rest/v1/maps?")) {
        return new Response(null, { status: 201 });
      }
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(latestProject)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);

    expect(result.kind).toBe("conflict");
    if (result.kind !== "conflict") throw new Error("expected conflict result");
    expect(result.conflicts.map((conflict) => conflict.mapId)).toEqual([editedMapId]);
    expect(calls.some((call) => String(call.input).includes("/rest/v1/projects?") && call.init?.method === "POST")).toBe(false);
    expect(calls.some((call) => String(call.input).includes("/rest/v1/projects?") && call.init?.method === "PATCH")).toBe(false);
  });

  it("does not false-conflict when the load path repairs a saved map (shop commands)", async () => {
    // todo 8 실측 결함: 첫 마일스톤 저장 후 매 flush가 kind=conflict로 끝나 데모 행이
    // 다음 마일스톤을 저장할 수 없었다. 로드 경로(repairSupabaseCurrentJson + deserialize →
    // validateProjectV4)는 저장본을 로드할 때 맵을 변형한다 — normalizeShopCommands가 shop
    // 커맨드에 branchOnTransaction/transactionBranch/branchOnFailedTransaction/
    // failedTransactionBranch 기본 필드를 주입한다. 에디터 메모리의 persistedBaseline/로컬
    // 프로젝트는 이 변형을 거치지 않으므로, 같은 논리 맵도 JSON 문자열이 달라져
    // latestSnapshot !== baseSnapshot && latestSnapshot !== localSnapshot 으로
    // 매 flush가 가짜 conflict로 끝났다. base/로컬을 같은 serialize→repair→deserialize 파이프라인에
    // 통과시켜 비교를 대칭으로 만든다(실제 동시 수정만 conflict).
    const baseProject = minimalValidProject();
    const mapId = firstMapId(baseProject);
    const map = requiredMap(baseProject, mapId);
    // shop 커맨드는 에디터 툴(make_villager shop)이 만드는 그대로 — 페이지 커맨드에 들어가고
    // branch 필드 없음(로드 시 normalizeShopCommands가 주입 대상).
    map.events = [
      {
        id: "ev_merchant_probe",
        name: "잡화상",
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "ev_merchant_probe_p0",
            name: "잡화상",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [
              {
                kind: "shop",
                itemIds: ["item_potion"],
                stock: [{ itemId: "item_potion" }],
                allowSell: true,
                quantityMode: "select",
                shopType: "normal",
                messageType: "welcome",
              },
            ],
          },
        ],
      },
    ];
    // 로컬 편집: 같은 맵에 주민 하나 추가(상점 맵을 실제로 수정한 상황).
    const localProject = structuredClone(baseProject);
    const localMap = requiredMap(localProject, mapId);
    localMap.events = [...localMap.events, {
      id: "ev_villager_probe",
      name: "도윤",
      x: 4,
      y: 4,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "ev_villager_probe_p0",
          name: "도윤",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    }];
    // DB 행 = 첫 마일스톤이 저장한 그대로(상점 커맨드에 branch 필드 없음).
    // saveProjectMapPatchToSupabase 가 로드 파이프라인을 통과시켜 branch 필드를 주입한다.
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/rest/v1/maps?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if ((method === "POST" || method === "PATCH") && url.includes("/rest/v1/projects?")) {
        return new Response(JSON.stringify([bodyRecord(init)]), { status: 200 });
      }
      if (method === "POST" && url.includes("/rest/v1/maps?")) {
        return new Response(null, { status: 201 });
      }
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(baseProject)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);

    // 가짜 conflict가 아니라 저장되어야 한다 — 상점 맵의 로드 정규화 차이는 무시하고 병합.
    expect(result.kind).toBe("saved");
    if (result.kind !== "saved") throw new Error("expected saved result");
    // 병합본에 로컬 편집(주민)이 남아 있어야 한다.
    expect(requiredMap(result.project ?? localProject, mapId).events.map((event) => event.id)).toContain("ev_villager_probe");
    expect(calls.some((call) => String(call.input).includes("/rest/v1/projects?") && (call.init?.method === "POST" || call.init?.method === "PATCH"))).toBe(true);
  });

  it("does not false-conflict when only the repair pipeline differs (dangling refs elsewhere)", async () => {
    // todo 8 2차 실측: 마일스톤 2 적용 후 flush가 여전히 conflict로 끝났다. 로컬 드래프트는
    // 도중 상태라 전체 검증(deserialize)이 던질 수 있다(예: 커밋 거부된 upsert_enemy → 끊긴
    // troop 참조, stale villageInfoDocument). 그때 canonicalize 폴백이 원본을 그대로 쓰면
    // latest(로드 수리본) vs base(수리 전)가 다시 갈라져 가짜 conflict가 재발한다.
    // 수정: base/로컬도 로드와 동일한 repairSupabaseCurrentJson → deserialize 파이프라인을
    // 통과시킨다(repair가 villageInfoDocuments 를 prune 하고 resourceProfiles 를 보충하므로
    // 맵 비교가 대칭이 된다). 로컬 전체 검증이 실패해도 base와 latest가 같으면 conflict 아님.
    const baseProject = minimalValidProject();
    const mapId = firstMapId(baseProject);
    const map = requiredMap(baseProject, mapId);
    map.events = [
      {
        id: "ev_merchant_probe",
        name: "잡화상",
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "ev_merchant_probe_p0",
            name: "잡화상",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [
              {
                kind: "shop",
                itemIds: ["item_potion"],
                stock: [{ itemId: "item_potion" }],
                allowSell: true,
                quantityMode: "select",
                shopType: "normal",
                messageType: "welcome",
              },
            ],
          },
        ],
      },
    ];
    const localProject = structuredClone(baseProject);
    const localMap = requiredMap(localProject, mapId);
    localMap.events = [...localMap.events, {
      id: "ev_villager_probe",
      name: "도윤",
      x: 4,
      y: 4,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "ev_villager_probe_p0",
          name: "도윤",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    }];
    // 전체 검증을 깨는 내용: 삭제된 맵을 가리키는 stale villageInfoDocument.
    // deserialize(serialize())은 mapId 검증에서 던지지만, 로드 파이프라인은
    // repairSupabaseCurrentJson 이 prune 한 뒤 deserialize 한다 — base/로컬도 같은
    // 파이프라인을 통과해야 latest(수리본)와 대칭이다. 실측과 동일하게 **base 도** 이 내용을
    // 갖는다(첫 승인이 중간 상태 드래프트를 저장한 뒤 persistedBaseline 이 됨) —
    // canonicalize(v1, repair 없이 serialize→deserialize)이 base 에서 던져 원본 폴백 →
    // latest(수리본)와 다시 갈라져 가짜 conflict 가 재발했다.
    const staleDoc = { id: "stale_doc_probe", mapId: "map_missing_xyz", title: "stale", markdown: "stale" };
    (baseProject.villageInfoDocuments as { id: string; mapId: string; title: string; markdown: string }[]).push(staleDoc);
    (localProject.villageInfoDocuments as { id: string; mapId: string; title: string; markdown: string }[]).push(staleDoc);
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/rest/v1/maps?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if ((method === "POST" || method === "PATCH") && url.includes("/rest/v1/projects?")) {
        return new Response(JSON.stringify([bodyRecord(init)]), { status: 200 });
      }
      if (method === "POST" && url.includes("/rest/v1/maps?")) {
        return new Response(null, { status: 201 });
      }
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(baseProject)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);

    // 로컬 드래프트가 전체 검증을 통과하지 못해도, base와 latest가 로드 파이프라인 기준으로
    // 같으면 가짜 conflict 없이 저장되어야 한다.
    expect(result.kind).toBe("saved");
    if (result.kind !== "saved") throw new Error("expected saved result");
    expect(requiredMap(result.project ?? localProject, mapId).events.map((event) => event.id)).toContain("ev_villager_probe");
  });

  it("does not false-conflict on jsonb key reordering (alphabetical vs insertion order)", async () => {
    // todo 8 3차 실측: 두 번의 연속 flush(전체 저장 → 맵 패치 → 맵 패치) 중 두 번째 패치가
    // 가짜 conflict로 끝났다. 원인: Supabase current_json/map_json은 PostgreSQL jsonb 로
    // 저장되어 객체 키가 **알파벳순 정렬**된다. 반면 에디터 메모리(persistedBaseline/로컬
    // 드래프트) 객체는 삽입 순서 키를 유지한다 — 같은 논리 맵도 JSON.stringify 결과가
    // 달라져 mapSaveConflicts의 latest !== base && latest !== local 판정이 매번 참이 된다.
    // 수정: mapSnapshot을 키 재귀 정렬 비교 문자열(canonicalJsonString)로 바꿔 jsonb 왕복
    // 여부와 무관하게 같은 논리 값은 같은 문자열이 되게 한다(배열 순서·값은 유지).
    // 이 테스트는 JSON 키 순서만 다른 최신 맵과 기본 맵을 비교해 가짜 conflict가 없음을 고정한다.
    const baseProject = minimalValidProject();
    const mapId = firstMapId(baseProject);
    const map = requiredMap(baseProject, mapId);
    map.events = [{
      id: "ev_order_probe",
      name: "순서 프로브",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
    }];
    const localProject = structuredClone(baseProject);
    const localMap = requiredMap(localProject, mapId);
    // 로컬 편집: 같은 맵에 주민 하나 추가.
    localMap.events = [...localMap.events, {
      id: "ev_villager_order",
      name: "도윤",
      x: 4,
      y: 4,
      trigger: { kind: "action" },
      commands: [],
    }];
    // DB 행 = baseProject 직렬화를 **jsonb 정렬 순서**로 뒤집은 것 — PostgreSQL이 키를
    // 알파벳순으로 재정렬하는 것을 재현한다.
    const dbJson = deserialize(JSON.stringify(JSON.parse(serialize(baseProject))));
    const dbJsonText = JSON.stringify(dbJson);
    // 키를 재귀 정렬해 저장본 텍스트를 만든다(load 경로는 이 정렬된 텍스트를 파싱한다).
    function sortedText(value: unknown): string {
      if (Array.isArray(value)) return `[${value.map((entry) => sortedText(entry)).join(",")}]`;
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${sortedText(record[key])}`).join(",")}}`;
      }
      return JSON.stringify(value);
    }
    const sortedRowText = sortedText(JSON.parse(dbJsonText));
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.includes("/rest/v1/maps?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if ((method === "POST" || method === "PATCH") && url.includes("/rest/v1/projects?")) {
        return new Response(JSON.stringify([bodyRecord(init)]), { status: 200 });
      }
      if (method === "POST" && url.includes("/rest/v1/maps?")) {
        return new Response(null, { status: 201 });
      }
      // 저장본은 jsonb 정렬 키 순서로 반환된다.
      return new Response(JSON.stringify([{ current_json: JSON.parse(sortedRowText) }]), { status: 200 });
    }) satisfies typeof fetch);

    const result = await saveProjectMapPatchToSupabase({ project: localProject, baseProject }, TEST_CONFIG);

    expect(result.kind).toBe("saved");
    if (result.kind !== "saved") throw new Error("expected saved result");
    expect(requiredMap(result.project ?? localProject, mapId).events.map((event) => event.id)).toContain("ev_villager_order");
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
        if (String(input).includes("/rest/v1/maps?")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
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
        if (String(input).includes("/rest/v1/maps?")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
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
        if (String(input).includes("/rest/v1/maps?")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
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
    const projectCall = calls.find((call) => String(call.input).includes("/rest/v1/projects?") && (call.init?.method === "POST" || call.init?.method === "PATCH"));
    const projectBody = projectCall?.init?.body;
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
      promptContext: { intent: "house-kit" },
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
    expect(payload.prompt_context_json).toEqual({ intent: "house-kit" });
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

  it("records AI activity logs in Supabase", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    const result = await recordSupabaseAiActivityLog({
      logId: "11111111-1111-4111-8111-111111111111",
      channel: "region",
      instruction: "호수와 나무",
      mapId: "map_1",
      payload: { ok: true, toolCalls: [{ name: "fill_region" }] },
    }, TEST_CONFIG);
    const body = calls[0]?.init?.body;
    if (typeof body !== "string") throw new Error("expected string body");
    const payload = parseRecords(body)[0];
    if (!payload) throw new Error("expected one AI activity row");

    expect(result.kind).toBe("saved");
    expect(String(calls[0]?.input)).toContain("/rest/v1/ai_activity_logs?");
    expect(payload.log_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.channel).toBe("region");
    expect(payload.instruction).toBe("호수와 나무");
    expect(payload.map_id).toBe("map_1");
  });

  it("fails with the required migration when the activity table is missing", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const url = String(input);
      if (url.includes("ai_activity_logs")) {
        return new Response(
          JSON.stringify({
            code: "PGRST205",
            message: "Could not find the table 'rpg_zzu.ai_activity_logs' in the schema cache",
          }),
          { status: 404 },
        );
      }
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);

    await expect(recordSupabaseAiActivityLog({
      logId: "22222222-2222-4222-8222-222222222222",
      channel: "chat",
      instruction: "나무 1개",
      payload: { toolCalls: [] },
    }, TEST_CONFIG)).rejects.toMatchObject({
      migration: "20260709000000_ai_activity_logs.sql",
      table: "rpg_zzu.ai_activity_logs",
    });

    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.input)).toContain("ai_activity_logs");
  });

  it("fails with the required migration when the conversation table is missing", async () => {
    vi.stubGlobal("fetch", (async () => new Response(
      JSON.stringify({
        code: "PGRST205",
        message: "Could not find the table 'rpg_zzu.ai_conversations' in the schema cache",
      }),
      { status: 404 },
    )) satisfies typeof fetch);

    await expect(recordSupabaseConversation({
      conversationId: "conversation-1",
      title: "마을 만들기",
      model: "test-model",
      entries: [],
      savedAt: Date.UTC(2026, 7, 24),
    }, TEST_CONFIG)).rejects.toMatchObject({
      migration: "20260713000000_ai_conversations_user_skills.sql",
      table: "rpg_zzu.ai_conversations",
    });
  });

  it("fails with the required migration when the user skills table is missing", async () => {
    vi.stubGlobal("fetch", (async () => new Response(
      JSON.stringify({ code: "PGRST205", message: "missing user_skills" }),
      { status: 404 },
    )) satisfies typeof fetch);

    await expect(recordSupabaseUserSkill({
      id: "skill-one",
      icon: "⭐",
      name: "검증 스킬",
      description: "migration check",
      template: "verify",
      skill: {},
    }, TEST_CONFIG)).rejects.toMatchObject({
      migration: "20260713000000_ai_conversations_user_skills.sql",
      table: "rpg_zzu.user_skills",
    });
  });

  it("lists AI activity scoped to project and merges primary with fallback", async () => {
    vi.stubGlobal("fetch", (async (input) => {
      const url = String(input);
      if (url.includes("ai_activity_logs")) {
        expect(url).toContain("project_id=eq.");
        return new Response(JSON.stringify([
          { log_id: "a1", channel: "chat", instruction: "primary", created_at: "2026-07-14T12:00:00.000Z" },
        ]), { status: 200 });
      }
      if (url.includes("ai_analysis_runs")) {
        expect(url).toContain("project_id=eq.");
        return new Response(JSON.stringify([
          {
            run_id: "b1",
            prompt_context_json: { channel: "region", instruction: "fallback-only" },
            result_json: { ok: true },
            created_at: "2026-07-14T11:00:00.000Z",
          },
          {
            run_id: "a1",
            prompt_context_json: { channel: "chat", instruction: "stale-fallback" },
            result_json: {},
            created_at: "2026-07-14T10:00:00.000Z",
          },
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) satisfies typeof fetch);

    const rows = await listSupabaseAiActivityLogs(20, TEST_CONFIG);
    expect(rows.map((r) => r.log_id)).toEqual(["a1", "b1"]);
    expect(rows[0]?.instruction).toBe("primary");
    expect(rows[1]?.source).toBe("ai_analysis_runs_fallback");
  });

  it("hydrates last remote commit tip from commit list", async () => {
    vi.stubGlobal("fetch", (async () => new Response(JSON.stringify([
      { commit_id: "tip-commit-9", message: "latest", summary: "latest", review_status: "direct", author_id: null, author_label: null, author_kind: null, agent_name: null, created_at: "2026-07-14T12:00:00.000Z" },
    ]), { status: 200 })) satisfies typeof fetch);
    const tip = await hydrateLastRemoteCommitTip(TEST_CONFIG);
    expect(tip).toBe("tip-commit-9");
    expect(peekLastRemoteCommitTip(TEST_CONFIG.projectId)).toBe("tip-commit-9");
  });

  it("overlays map_json from maps table onto current_json on load", async () => {
    const source = createHouseTemplateGalleryProject();
    const mapId = firstMapId(source);
    const overlayMap = renameMap(requiredMap(source, mapId), "Maps table wins");
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      calls.push({ input, init });
      const url = String(input);
      if (url.includes("/rest/v1/maps?")) {
        return new Response(JSON.stringify([{ map_id: mapId, map_json: overlayMap }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ current_json: JSON.parse(serialize(source)) }]), { status: 200 });
    }) satisfies typeof fetch);

    const project = await loadProjectFromSupabase(TEST_CONFIG);

    expect(project?.maps[mapId]?.name).toBe("Maps table wins");
    expect(calls.some((call) => String(call.input).includes("/rest/v1/maps?"))).toBe(true);
  });

});

function minimalValidProject(): Project {
  // Unit-test asset env lacks generated monster art; strip those resource refs so
  // deserialize reference validation passes without depending on bundled generated art.
  const project = createBlankProject();
  for (const enemy of project.database.enemies) {
    const e = enemy as unknown as { monsterResourceId?: string; speciesId?: string };
    delete e.monsterResourceId;
    delete e.speciesId;
  }
  for (const species of project.database.monsterSpecies ?? []) {
    if (species.graphic) (species.graphic as { monsterResourceId?: string }).monsterResourceId = undefined;
  }
  return project;
}

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
