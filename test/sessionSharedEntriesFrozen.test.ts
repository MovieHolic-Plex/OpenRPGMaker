// 덫: 조수 세션이 스토어와 객체째 공유하는 항목(타일셋·업로드 자산)을 제자리에서 고치는 자리가 없다.
//
// 왜: 세션의 초안은 예전에 통째 복제본이라 `ctx.project.tilesets[id]` 를 제자리에서 고쳐도 스토어는 멀쩡했다. 지금은 그 객체가
// 스토어의 것이다(src/ai/sessionProjectCopy.ts) — 제자리 쓰기 하나가 승인 없이 스토어의 타일셋을 바꾸고, 저장 diff 에서도 사라진다.
// 그래서 스토어의 항목을 깊게 얼린 채로 도구와 세션을 돌린다. 얼린 객체에 쓰면 던진다(모듈은 strict). 삼켜진 예외도 본다(아래 watch).
//
// 무엇을 돌리나:
//  · 읽기 도구 전부 — 실행기가 `ctx.project` 를 그대로 넘긴다(toolRunner: `tool.run(ctx.project, …)`). 공유 항목에 바로 닿는 유일한 도구들이다.
//  · 타일 영역(domains 에 "tile")의 쓰기 도구 전부 — 도구 자신은 `createDraft` 의 «읽을 때 복제» 사전만 받지만, 실행기의 앞뒤 처리
//    (집 보호 · 변경 요약 · 커밋 검사 · 장면 다듬기)는 고치기 전 프로젝트를 그대로 읽는다. 새 그리기 도구는 등록만 하면 여기로 들어온다.
//  · 조수 v2 동사(make_place · edit_place · draw_object · place_object · dress_room · move_object …) — 도구 실행기를 거치지 않고
//    `env.ctx.project`(세션 초안)를 직접 읽고 갈아 끼운다. 장소를 하나 지은 뒤 동사 전부를 한 번씩 부른다.
//  · «map» 영역 쓰기 도구 — 마을 하나를 지은 뒤 40개를 본문까지 가는 인자로 이어 부른다(다른 칩셋 물건 찍기 = 이식 포함). 부르지 못하는 것은
//    까닭과 함께 MAP_TOOLS_NOT_CALLED 에 남긴다 — 새 «map» 쓰기 도구가 둘 중 어디에도 없으면 시험이 떨어진다.
//  · 세션 한 턴(타일 이름 붙이기 + 타일 이식) → 적용 — 세션의 정규화·검수·적용 경로.
import { Session } from "node:inspector";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { AssistantSession, type AssistantSessionOptions, type SessionTurnOptions, type TurnResult } from "@/ai/assistantSession";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { sessionDraftCopy } from "@/ai/sessionProjectCopy";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { appendConversationBubble } from "@/editor/panels/aiConversationLog";
import { createProposalHost } from "@/editor/panels/aiProposalCard";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import { runTool } from "@/editor/tools";
import { allTools } from "@/editor/tools/toolRegistry";
import type { JsonSchema, ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { installFakeDom } from "./fakeDom";
import { independentReviewPayload } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";

// 도구 250여 개를 실제로 부르고(쓰기 도구는 호출마다 초안을 뜬다) 세션 한 턴을 끝까지 돌린다.
vi.setConfig({ testTimeout: 600_000, hookTimeout: 300_000 });

/** V8 이 얼린 객체에 쓸 때 내는 말: 대입 · 추가(push 포함) · 삭제 · 재정의. */
const FROZEN_WRITE = /read only property|not extensible|Cannot (delete|redefine) property/;

const NAMED_TILESET = "jp_city";
const GRAFT_TILESET = "pirate_isles";
const GRAFT_SOURCE = "tex_beodeul_architecture";

/** 무거운 맵 저작 도구(하나에 수 초~십수 초). 실행기의 앞뒤 처리는 다른 쓰기 도구와 같은 코드라 덫에서 뺀다. */
const HEAVY_WORLD_AUTHORING = new Set(["author_jrpg_chapter", "expand_jrpg_campaign_volume"]);

/**
 * 삼켜진 예외까지 보는 감시. 도구 실행기는 던진 것을 `issues` 로 바꾸고, 도구 안의 try/catch 는 그마저 지운다 — 결과만 보면 놓친다.
 * 같은 프로세스의 디버거 세션이 예외마다 멈춰 말(description)을 읽고 바로 이어 간다.
 */
function watchFrozenWrites(): { readonly seen: string[]; stop(): void } {
  const seen: string[] = [];
  const session = new Session();
  session.connect();
  session.on("Debugger.paused", (message) => {
    try {
      const data = message.params.data as { description?: unknown } | undefined;
      const description = typeof data?.description === "string" ? data.description : "";
      if (FROZEN_WRITE.test(description)) {
        // 말 + 던진 자리 여섯 층(시험기가 바꾼 코드의 줄 번호라 원본과 몇 줄 어긋난다 — 함수 이름과 파일로 찾는다). 같은 자리는 한 번만 적는다.
        const where = description.split("\n").slice(0, 7).map((line) => line.trim().replace(/\(?\S*\/(src|test)\//, "($1/")).join(" < ");
        if (!seen.includes(where)) seen.push(where);
      }
    } finally {
      session.post("Debugger.resume");
    }
  });
  session.post("Debugger.enable");
  session.post("Debugger.setPauseOnExceptions", { state: "all" });
  return {
    seen,
    stop() {
      session.post("Debugger.setPauseOnExceptions", { state: "none" });
      session.post("Debugger.disable");
      session.disconnect();
    },
  };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
}

/** 스토어의 지금 프로젝트가 든 타일셋·업로드 자산 항목을 모두 깊게 얼리고, 그 객체들을 돌려준다. */
function freezeStoreEntries(): { tilesets: Record<string, unknown>; uploaded: Record<string, unknown> } {
  const current = store.getCurrent();
  const tilesets: Record<string, unknown> = { ...current.tilesets };
  const uploaded: Record<string, unknown> = { ...current.assets.uploaded };
  for (const entry of [...Object.values(tilesets), ...Object.values(uploaded)]) deepFreeze(entry);
  return { tilesets, uploaded };
}

/** 스키마에서 «검증은 지나가는» 가장 작은 인자를 만든다. 대부분의 도구는 이 인자로 자기 본문까지 들어간다. */
function sampleArgs(schema: JsonSchema | undefined, key: string, ids: { mapId: string; tilesetId: string }): unknown {
  if (!schema) return "x";
  if (schema.enum?.length) return schema.enum[0];
  if (schema.oneOf?.length) return sampleArgs(schema.oneOf[0], key, ids);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === "object" || (!type && schema.properties)) {
    const out: Record<string, unknown> = {};
    for (const name of schema.required ?? []) out[name] = sampleArgs(schema.properties?.[name], name, ids);
    return out;
  }
  if (type === "array") return schema.minItems ? [sampleArgs(schema.items, key, ids)] : [];
  if (type === "number" || type === "integer") return schema.minimum ?? 1;
  if (type === "boolean") return false;
  if (/tileset/i.test(key)) return ids.tilesetId;
  if (/map/i.test(key)) return ids.mapId;
  return "x";
}

/**
 * «map» 영역 쓰기 도구를 본문까지 가는 인자로 부르는 순서(마을 하나와 빈 시작 맵 위에서). 앞 호출이 만든 것(로케이션·연결·문서·스폰·맵)을
 * 뒤 호출이 고치거나 지운다 — 한 초안을 이어 쓰며 순서대로 부른다.
 */
function mapToolCalls(town: string, blank: string): Array<[string, Record<string, unknown>]> {
  return [
    ["create_map", { id: "map_trap_jp", name: "덫 거리", width: 20, height: 15, tilesetId: "jp_city" }],
    // 다른 칩셋의 공용 물건을 찍으면 그 그림이 이 칩셋에 이식된다 — 타일셋을 고치는 길이다.
    ["stamp_object", { objectId: "kit:beodeul_city/bd-house-cstable", mapId: "map_trap_jp", x: 4, y: 4 }],
    ["paint_tiles", { mapId: blank, layer: "lower", mode: "rect", tile: 1, from: { x: 1, y: 1 }, to: { x: 3, y: 3 } }],
    ["clear_region", { mapId: blank, x: 0, y: 0, w: 4, h: 4, layer: "both" }],
    ["mirror_region", { mapId: blank, x: 2, y: 2, w: 6, h: 4, axis: "horizontal" }],
    ["copy_map_region", { from: { mapId: town, x: 20, y: 20, w: 4, h: 4 }, to: { mapId: blank, x: 2, y: 2 } }],
    ["move_region", { from: { mapId: blank, x: 2, y: 2, w: 2, h: 2 }, to: { mapId: blank, x: 6, y: 6 } }],
    ["build_house", { mapId: blank, origin: { x: 3, y: 2 }, width: 6, height: 7, material: "plaster" }],
    ["set_map_door", { mapId: blank, x: 5, y: 9, kind: "auto", width: 1, height: 1 }],
    ["set_tile_passability", { mapId: blank, tile: 1, passable: false }],
    ["set_start_position", { mapId: blank, x: 12, y: 12 }],
    ["set_map_properties", { mapId: blank, name: "덫 맵" }],
    ["set_encounter_table", { mapId: blank, entries: [{ troopId: "troop_slime", weight: 10 }] }],
    ["make_hunting_ground", { mapId: blank, area: { x: 12, y: 2, w: 5, h: 5 }, troopId: "troop_slime" }],
    ["remove_field_spawn", { mapId: blank, spawnId: "hunt_troop_slime" }],
    ["configure_roguelike_room", { mapId: blank }],
    ["create_farm_plot", { mapId: blank, area: { x: 12, y: 9, w: 4, h: 3 } }],
    ["create_map_location", { mapId: blank, name: "광장", x: 14, y: 2, w: 3, h: 3 }],
    ["update_map_location", { mapId: blank, locationId: "loc1", name: "큰 광장" }],
    ["delete_map_location", { mapId: blank, locationId: "loc1" }],
    ["manage_map_tree", { operation: "create_folder", folderId: "folder_trap", name: "덫 폴더" }],
    ["upsert_map_connection", { connection: { id: "conn_trap", from: { mapId: town, x: 30, y: 58 }, to: { mapId: blank, x: 12, y: 12 }, playerEnabled: true, npcEnabled: false } }],
    ["delete_map_connection", { connectionId: "conn_trap" }],
    ["upsert_village_document", { document: { id: "doc_trap", mapId: town, title: "덫", markdown: "덫" } }],
    ["delete_village_document", { documentId: "doc_trap" }],
    ["add_street_walkers", { mapId: town, walkers: [{ name: "행인", graphic: { query: "마을 사람" }, stops: [{ x: 28, y: 40 }, { x: 32, y: 40 }], speed: 3 }] }],
    ["place_lift", { mapId: town, x: 20, y: 20, direction: "up", distance: 2, toMapId: blank, toX: 12, toY: 12 }],
    ["set_action_combat", { enabled: true }],
    ["make_action_enemy", { enemyId: "enemy_slime", actionProfile: { contactDamage: 1, moveIntervalMs: 400 } }],
    ["create_map", { id: "map_trap_room", name: "덫 방", width: 20, height: 15 }],
    ["author_map_puzzle", { mapId: "map_trap_room", presetId: "lever_secret_passage", x: 10, y: 7 }],
    ["create_map", { id: "map_trap_route", name: "덫 길", width: 20, height: 15 }],
    ["make_timed_escape", { mapId: blank, seconds: 60, start: { x: 8, y: 13, width: 3, height: 1 }, exit: { x: 8, y: 0, width: 4, height: 1 }, checkpoint: { x: 10, y: 12 }, area: { x: 0, y: 0, width: 20, height: 15 }, from: "south", bands: 3 }],
    ["author_wild_route", { mapId: "map_trap_route", exits: [{ x: 10, y: 14 }, { x: 10, y: 0 }], grassPatches: 2, encounters: [{ troopId: "troop_slime", weight: 1 }] }],
    ["author_forest_route", { fromMapId: town, side: "north", count: 1 }],
    ["author_snow_route", { fromMapId: town, side: "east", count: 1 }],
    ["author_worldmap_structure", { id: "world_trap", structure: "region-routes" }],
    ["derive_map_variant", { sourceMapId: blank, variants: [{ id: "map_trap_variant", era: "중세" }] }],
    ["duplicate_map", { mapId: "map_trap_jp", id: "map_trap_copy" }],
    ["shift_map", { mapId: "map_trap_copy", dx: 1, dy: 0 }],
    ["clear_map", { mapId: "map_trap_copy", confirmDestroy: true }],
    ["remove_map", { mapId: "map_trap_copy" }],
  ];
}

/**
 * 이 덫이 부르지 않는 «map» 영역 쓰기 도구와 까닭 — 무엇이 빠졌는지 보이게 둔다. 새 «map» 쓰기 도구는 위 순서나 여기 중 한 곳에 들어가야 한다(아래 시험이 센다).
 * 칩셋 전용 잇기·꾸미기 도구는 그 칩셋의 구성기 맵(시간이 드는 저작)이 있어야 본문에 들어간다. 장소 저작 문서·참고·개념 카드·그림 계정·
 * 연애 계약·월드맵 빌드가 없는 빈 프로젝트에서는 앞 검사에서 멈춘다(그 앞 검사까지는 도구 실행기의 같은 앞뒤 처리를 지난다).
 */
const MAP_TOOLS_NOT_CALLED: Readonly<Record<string, string>> = {
  import_region_reference: "참고 지역 목록이 비어 있다",
  upsert_spatial_design: "장소 저작 문서가 없는 레거시 프로젝트",
  apply_spatial_build: "장소 저작 미리보기가 없다",
  edit_spatial_occurrence: "장소 저작 문서가 없는 레거시 프로젝트",
  build_concept_example: "개념 카드가 노트에 없다",
  stage_map_reveal: "드러낼 장치 이벤트가 필요하다",
  link_jp_city_interior: "jp_city 구성기 거리 맵 전용",
  link_campus_interior: "modern_campus 야외 맵 전용",
  link_modern_city_interior: "modern_city 맵 전용",
  link_desert_east_interior: "desert_east 맵 전용",
  link_sengoku_edo_interior: "sengoku_edo 맵 전용",
  link_joseon_interior: "조선 칩셋 맵 전용",
  link_sky_island_interior: "sky_island 맵 전용",
  link_steampunk_interior: "steampunk 맵 전용",
  link_prehistoric_interior: "prehistoric 맵 전용",
  link_snow_north_interior: "snow_north 맵 전용",
  dress_village_quarter: "버들 마을의 빈 구역이 필요하다(집 보호 영역)",
  dress_joseon_market: "joseon_baram 맵 전용",
  generate_map_background: "그림 생성 계정이 필요하다",
  adopt_layout_regions: "빌더 layoutPlan 이 있는 맵 전용",
  generate_map: "폐기 예정 — 이 칩셋 전용 생성 로직 없음",
  set_romance_stage: "확정된 연애 장면 계약이 필요하다",
  edit_world_terrain: "월드맵 빌드가 필요하다",
  derive_world_variant: "월드맵이 필요하다",
  link_world_entrance: "월드맵이 필요하다",
};

let frozen: { tilesets: Record<string, unknown>; uploaded: Record<string, unknown> };
let watch: { readonly seen: string[]; stop(): void };

beforeAll(() => {
  installFakeDom();
  resetIntentDeclarationCache();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  project.assets.uploaded["upload-a"] = { id: "upload-a", name: "Uploaded A", kind: "charset", dataUrl: "data:image/png;base64,AA==", meta: {} };
  store.replace(project);
  resetMapEditHistory();
  frozen = freezeStoreEntries();
  watch = watchFrozenWrites();
});

afterAll(() => watch.stop());

/** 스토어도, 세션 초안도 얼린 그 객체를 그대로 가리킨다(값은 얼어 있으니 바뀔 수 없다). */
function expectStoreEntriesUntouched(): void {
  for (const id of Object.keys(frozen.tilesets)) expect(store.getCurrent().tilesets[id]).toBe(frozen.tilesets[id]);
  for (const id of Object.keys(frozen.uploaded)) expect(store.getCurrent().assets.uploaded[id]).toBe(frozen.uploaded[id]);
}

describe("스토어와 공유하는 타일셋·업로드 자산 항목을 얼린 채 — 제자리에서 고치는 자리가 없다", () => {
  it("자기 점검: 스토어 항목이 정말 얼어 있고, 감시가 삼켜진 얼린-쓰기를 본다", () => {
    expect(Object.keys(frozen.tilesets).length).toBeGreaterThanOrEqual(40);
    const tileset = store.getCurrent().tilesets[NAMED_TILESET]!;
    expect(Object.isFrozen(tileset)).toBe(true);
    expect(Object.isFrozen(tileset.passability)).toBe(true);
    const before = watch.seen.length;
    try {
      tileset.name = "제자리에서 고친 이름";
    } catch {
      // 일부러 삼킨다 — 감시가 이것을 봐야 한다.
    }
    expect(watch.seen.length).toBe(before + 1);
    expect(watch.seen[before]).toContain("read only property 'name'");
    watch.seen.length = before;
    expect(store.getCurrent().tilesets[NAMED_TILESET]!.name).not.toBe("제자리에서 고친 이름");
  });

  it("읽기 도구 전부와 타일 영역 쓰기 도구를 세션 초안에서 부른다 — 얼린 항목에 쓰지 않는다", () => {
    const live = store.getCurrent();
    expect(store.ownsSettledEntriesOf(live)).toBe(true);
    // 세션이 초안을 뜨는 방법 그대로다(AssistantSession: `this.toolContext(sessionDraftCopy(project))`).
    const base = sessionDraftCopy(live);
    for (const id of Object.keys(frozen.tilesets)) expect(base.tilesets[id]).toBe(frozen.tilesets[id]);
    for (const id of Object.keys(frozen.uploaded)) expect(base.assets.uploaded[id]).toBe(frozen.uploaded[id]);

    const mapId = Object.keys(base.maps)[0]!;
    const ids = { mapId, tilesetId: base.maps[mapId]!.tilesetId };
    /** 타일셋을 고치는 도구는 반드시 성공하는 인자로 부른다 — 아래에서 «그 타일셋이 새 객체가 됐다» 까지 확인한다. */
    const tilesetWrites: Record<string, { args: Record<string, unknown>; tilesetId: string }> = {
      set_tile_metadata: { tilesetId: NAMED_TILESET, args: { tilesetId: NAMED_TILESET, entries: [{ tile: 3, label: "덫 이름" }] } },
      set_tile_rules: { tilesetId: NAMED_TILESET, args: { tilesetId: NAMED_TILESET, entries: [{ tile: 3, passable: false }] } },
      upsert_tile_group: { tilesetId: NAMED_TILESET, args: { tilesetId: NAMED_TILESET, name: "덫 묶음", role: "prop", tileIds: [3, 4] } },
      set_tileset_properties: { tilesetId: NAMED_TILESET, args: { tilesetId: NAMED_TILESET, name: "덫이 고친 이름" } },
      set_tile_grafts: { tilesetId: GRAFT_TILESET, args: { tilesetId: GRAFT_TILESET, grafts: [{ targetTile: 5, sourceChipset: GRAFT_SOURCE, sourceTile: 4 }] } },
    };

    const tools = allTools().filter((tool) => tool.mode === "read" || (tool.domains?.includes("tile") && !HEAVY_WORLD_AUTHORING.has(tool.name)) || tool.name in tilesetWrites);
    const hits: string[] = [];
    const ok = { read: 0, write: 0 };
    const total = { read: 0, write: 0 };
    const replaced: Record<string, string[]> = {};
    for (const tool of tools) {
      const candidates = tool.name in tilesetWrites
        ? [tilesetWrites[tool.name]!.args]
        : [tool.invalidArgsExample, sampleArgs(tool.parameters, "", ids) as Record<string, unknown>].filter((args): args is Record<string, unknown> => args !== undefined);
      total[tool.mode] += 1;
      for (const args of candidates) {
        // 도구마다 같은 초안에서 새로 시작한다 — 쓰기 도구는 `ctx.project` 를 갈아 끼울 뿐 초안을 고치지 않는다.
        const ctx: ToolContext = { project: base, assistantRun: true };
        let said: string;
        let succeeded = false;
        try {
          const result = runTool(ctx, tool.name, structuredClone(args));
          succeeded = result.ok;
          said = `${result.summary} ${(result.issues ?? []).map((issue) => issue.message).join(" | ")}`;
        } catch (cause) {
          said = cause instanceof Error ? `${cause.message}\n${cause.stack ?? ""}` : String(cause);
        }
        if (FROZEN_WRITE.test(said)) hits.push(`${tool.name}: ${said.slice(0, 400)}`);
        if (!succeeded) continue;
        ok[tool.mode] += 1;
        const changed = Object.keys(ctx.project.tilesets).filter((id) => ctx.project.tilesets[id] !== frozen.tilesets[id]);
        if (changed.length > 0) replaced[tool.name] = changed;
        break;
      }
    }

    expect(hits).toEqual([]);
    expect(watch.seen).toEqual([]);
    // 덫이 헛돌지 않는다: 읽기 도구는 모두 불렸고 대부분이 본문까지 갔다. 타일셋을 고치는 도구는 그 타일셋만 새 객체로 갈아 끼웠다.
    expect(total.read).toBe(allTools().filter((tool) => tool.mode === "read").length);
    expect(total.read).toBeGreaterThanOrEqual(150);
    expect(ok.read).toBeGreaterThanOrEqual(80);
    expect(total.write).toBeGreaterThanOrEqual(60);
    for (const [name, { tilesetId }] of Object.entries(tilesetWrites)) expect([name, replaced[name]]).toEqual([name, [tilesetId]]);
    // 스키마에서 만든 인자만으로도 타일셋을 갈아 끼우는 도구가 여럿 있다(버들 바닥·풀·빛 도구의 이식, 구조물 키트, 애니메이션 띠, 팔레트 …).
    expect(Object.keys(replaced).length).toBeGreaterThanOrEqual(8);
    // 스토어도, 도구가 받은 초안도 그대로다 — 같은 객체를 가리킨다.
    for (const id of Object.keys(frozen.tilesets)) {
      expect(store.getCurrent().tilesets[id]).toBe(frozen.tilesets[id]);
      expect(base.tilesets[id]).toBe(frozen.tilesets[id]);
    }
    for (const id of Object.keys(frozen.uploaded)) expect(store.getCurrent().assets.uploaded[id]).toBe(frozen.uploaded[id]);
  });

  it("조수 v2 동사 전부를 세션 초안에서 부른다(장소 하나를 지은 뒤) — 얼린 항목에 쓰지 않는다", async () => {
    const live = store.getCurrent();
    const project = sessionDraftCopy(live);
    for (const id of Object.keys(frozen.tilesets)) expect(project.tilesets[id]).toBe(frozen.tilesets[id]);
    const task = "시장 마을을 만들고 노점과 사람을 놓아 줘";
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = {
      ctx, request: { task, provider: "local-cli:claude", mapIds: [], project: live, projectKey: `["project","frozen-v2"]` } as never,
      emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), render: async () => "", checkpoint: async () => {},
      preferToolNextTurn: () => {}, clearToolPreference: () => {},
    } as unknown as PiAssistantV2Env;
    const tools = createV2Tools(env, new V2Session());
    const hits: string[] = [];
    const said = new Map<string, string>();
    const call = async (name: string, args: unknown): Promise<string> => {
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) return "";
      let body: string;
      try {
        const result = await tool.execute(`frozen-${name}`, args);
        body = (result.content as { type: string; text?: string }[]).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
      } catch (cause) {
        body = cause instanceof Error ? `${cause.message}\n${cause.stack ?? ""}` : String(cause);
      }
      if (FROZEN_WRITE.test(body)) hits.push(`${name}: ${body.slice(0, 400)}`);
      said.set(name, body);
      return body;
    };

    // 장소부터 짓는다 — 그래야 고치기·채우기·옮기기·놓기 동사가 본문까지 간다. 버들항 마을은 첫 호출에 땅 그림을 돌려주고(실패 아님) 둘째에 짓는다.
    const spec = { type: "village", name: "시장 마을", style: "fantasy", size: "medium", features: ["plaza", "market stalls"], floors: 1 };
    let made = await call("make_place", { spec });
    for (let i = 0; i < 3 && /"notFailure":true/u.test(made); i++) made = await call("make_place", { spec });
    const mapId = Object.keys(ctx.project.maps).find((id) => ctx.project.maps[id]!.name === "시장 마을") ?? "";
    // 장소가 정말 섰다 — 아니면 뒤의 동사들이 거절 글만 돌려주고 덫이 헛돈다.
    expect(ctx.project.maps[mapId], made.slice(0, 600)).toBeDefined();
    expect(ctx.project).not.toBe(project);
    const at = { x: 10, y: 10 };
    const objectId = ctx.project.tilesets[ctx.project.maps[mapId]!.tilesetId]?.structureKits?.[0]?.id ?? "x";

    const scripted: Record<string, unknown> = {
      edit_place: { patch: { mapId, set: { name: "시장 마을", size: "medium", floors: 1, features: ["plaza", "market stalls"] }, addAnchors: [{ zone: "광장", what: "우물", near: at }], variant: 1, dressing: 1 } },
      draw_object: { object: { what: "시장 노점", mapId, at } },
      place_object: { mapId, objectId, at },
      dress_room: { mapId, at, purpose: "잡화점" },
      move_object: { mapId, edits: [{ at, to: { x: at.x + 1, y: at.y } }] },
      add_people: { people: [{ role: "상인", name: "노점 주인", where: "광장", firstTalk: ["어서 오세요."] }] },
      inspect: { mapId },
      review_layout: { mapId },
      find_pieces: { query: "barrel" },
      room_parts: { purpose: "잡화점" },
      read_specs: { names: ["all"] },
    };
    // 바깥 모델·사람을 기다리는 동사(질문·잔일 일꾼·그림 생성기)는 이 덫의 대상이 아니다 — 프로젝트를 고치지 않는다.
    const skip = new Set(["make_place", "ask_user", "ask_helpers", "generate_art", "make_game"]);
    let called = 0;
    for (const tool of tools) {
      if (skip.has(tool.name)) continue;
      const args = scripted[tool.name] ?? sampleArgs(tool.parameters as JsonSchema, "", { mapId, tilesetId: ctx.project.maps[mapId]!.tilesetId });
      await call(tool.name, args);
      called += 1;
    }

    expect(hits).toEqual([]);
    expect(watch.seen).toEqual([]);
    // 덫이 헛돌지 않는다: 장소가 섰고, 짓기·고치기·물건 동사가 다 불렸다.
    for (const name of ["edit_place", "draw_object", "place_object", "dress_room", "move_object", "add_people", "add_event", "add_scene", "write_blueprint"]) expect(said.has(name), name).toBe(true);
    expect(called).toBeGreaterThanOrEqual(15);
    expectStoreEntriesUntouched();
  });

  it("«map» 영역 쓰기 도구를 세션 초안에서 이어 부른다(마을 하나를 지은 뒤) — 얼린 항목에 쓰지 않고, 고친 타일셋만 새 객체다", () => {
    const ctx: ToolContext = { project: sessionDraftCopy(store.getCurrent()), assistantRun: true };
    const blank = ctx.project.startMapId;
    const hits: string[] = [];
    const failed: string[] = [];
    const run = (name: string, args: Record<string, unknown>): void => {
      let said: string;
      try {
        const result = runTool(ctx, name, structuredClone(args));
        said = `${result.summary} ${(result.issues ?? []).map((issue) => issue.message).join(" | ")}`;
        if (!result.ok) failed.push(`${name}: ${said.slice(0, 300)}`);
      } catch (cause) {
        said = cause instanceof Error ? `${cause.message}\n${cause.stack ?? ""}` : String(cause);
        failed.push(`${name}: ${said.slice(0, 300)}`);
      }
      if (FROZEN_WRITE.test(said)) hits.push(`${name}: ${said.slice(0, 400)}`);
    };
    run("author_beodeul_town", { width: 60, height: 60, seed: 17977 });
    const town = Object.keys(ctx.project.maps).find((id) => id !== blank)!;
    expect(town).toBeDefined();
    const calls = mapToolCalls(town, blank);
    for (const [name, args] of calls) run(name, args);

    expect(hits).toEqual([]);
    expect(watch.seen).toEqual([]);
    // 덫이 헛돌지 않는다: 순서의 호출이 모두 본문까지 가 성공했다.
    expect(failed).toEqual([]);
    // 등록부의 «map» 쓰기 도구는 모두 불렸거나, 부르지 않는 까닭이 적혀 있다.
    const called = new Set(["author_beodeul_town", ...calls.map(([name]) => name)]);
    const mapWrites = allTools().filter((tool) => tool.mode === "write" && tool.domains?.includes("map") && !tool.domains?.includes("tile")).map((tool) => tool.name);
    expect(mapWrites.filter((name) => !called.has(name) && !(name in MAP_TOOLS_NOT_CALLED))).toEqual([]);
    expect(Object.keys(MAP_TOOLS_NOT_CALLED).filter((name) => called.has(name) || !mapWrites.includes(name))).toEqual([]);
    expect(mapWrites.filter((name) => called.has(name)).length).toBeGreaterThanOrEqual(40);
    // 마을·이식·통행·길 도구는 고친 타일셋만 새 객체로 갈아 끼우고, 나머지는 스토어의 얼린 객체를 그대로 가리킨다.
    const replaced = Object.keys(ctx.project.tilesets).filter((id) => frozen.tilesets[id] !== undefined && ctx.project.tilesets[id] !== frozen.tilesets[id]);
    expect(replaced).toContain("jp_city");
    expect(replaced).toContain("beodeul_city");
    for (const id of Object.keys(frozen.tilesets)) if (!replaced.includes(id)) expect(ctx.project.tilesets[id]).toBe(frozen.tilesets[id]);
    expectStoreEntriesUntouched();
  });

  it("세션 한 턴(타일 이름 · 이식)을 적용까지 — 얼린 항목에 쓰지 않고, 고친 타일셋만 새 객체다", async () => {
    const call = (id: string, name: string, args: Record<string, unknown>): ChatResult => ({
      message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
      finishReason: "tool_calls",
    });
    const script: ChatResult[] = [
      call("name", "set_tile_metadata", { tilesetId: NAMED_TILESET, entries: [{ tile: 3, label: "덫 이름" }] }),
      call("graft", "set_tile_grafts", { tilesetId: GRAFT_TILESET, grafts: [{ targetTile: 5, sourceChipset: GRAFT_SOURCE, sourceTile: 4 }] }),
    ];
    const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
    let written = 0;
    const options: AssistantSessionOptions = {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 },
      declareIntent: async (facts) => fixedDeclarer({ mode: "other" })(facts),
      prepareProjectWiki: async () => undefined,
      yieldToUi: async () => {},
      chat: async (_config, request) => {
        const review = independentReviewPayload(request);
        if (!review) return script[written++] ?? final;
        const findings = review.requiredProblems.map((problem, index) => ({ id: `required-${index}`, target: "draft", problem, requestedChange: "Resolve the required problem", validation: problem }));
        return {
          message: { role: "assistant", content: JSON.stringify({ revision: review.revision, verdict: findings.length ? "changes_requested" : "approved", summary: "Scoped fixture review", findings }) },
          finishReason: "stop",
        };
      },
    };
    const session = new AssistantSession(store.getCurrent(), options);
    for (const id of Object.keys(frozen.tilesets)) expect(session.getProposedProject().tilesets[id]).toBe(frozen.tilesets[id]);

    // test/aiRunEpoch.test.ts 와 같은 실제 턴 실행기 + 제안 적용기(applyProposal → 스토어).
    const noop = (): void => {};
    const log = document.createElement("div");
    const surface = {
      panel: document.createElement("div"), log, sendButton: document.createElement("button"), controller: { session, auditHistory: [], statusTimeline: [] },
      turnBusy: false, disposed: false, abortNoticeShown: false, activeAbortController: null, collapseAfterAiWork: false, collapsed: false,
      conversationId: "frozen", conversationScope: "frozen", runningPhaseStatus: null, runningProgress: null,
      setStatus: noop, beginTurnProgress: noop, endTurnProgress: noop, refreshRunningStatus: noop, refreshAbortButton: noop, startLiveActivity: noop, completeLiveActivity: noop,
      expandForAiWork: noop, scheduleCollapseAfterAiWork: noop, notifyIfObscuredByTestPlay: noop, drainPendingSends: noop, persistConversation: noop, sendText: async () => {},
      appendBubble: (role: never, text: never) => appendConversationBubble({ log, role, text, removeStartScreen: noop }),
      appendReasoning: () => ({ box: document.createElement("div"), body: document.createElement("div") }), closeToolActivity: noop, clearLastReasoning: noop, isLastReasoningBox: () => false,
    } as unknown as AiRunSurface;
    const proposal = createProposalHost({ proposalNoticeHost: document.createElement("div"), controller: surface.controller, appendBubble: surface.appendBubble, setStatus: surface.setStatus });
    const runner = createAiTurnRunner({
      surface, applyingProposal: false, projectIdentityId: "frozen", workPlanSurfaceState: null, applyProposal: proposal.applyProposal, noteNoChanges: proposal.noteNoChanges,
      beginWorkPlanTurn: noop, settleWorkPlanTurn: noop, refreshWorkPlanSurface: noop, showWorkPlan: noop, showAcceptance: noop, noteWorkPlanActivity: noop, appendMilestoneFeedLine: noop,
      appendTileThumbs: noop, appendTileGrid: noop, appendAiDocument: noop, hasPendingQuestion: () => false, openAiSettings: noop, renderQuickReplies: noop, refreshContextMeter: noop,
    } as unknown as AiTurnRunnerDeps);
    const turnOptions: SessionTurnOptions = {};
    let result: TurnResult | undefined;
    await runner.executeTurn(session, "타일 3에 이름을 붙이고 타일 하나를 이식해 줘", async (onEvent, signal) => {
      result = await session.sendUserMessage("타일 3에 이름을 붙이고 타일 하나를 이식해 줘", onEvent, signal, turnOptions);
      return result;
    }, turnOptions);

    expect(watch.seen).toEqual([]);
    expect(result?.appliedCalls?.map((applied) => applied.name)).toEqual(["set_tile_metadata", "set_tile_grafts"]);
    const applied: Project = store.getCurrent();
    expect(applied.tilesets[NAMED_TILESET]!.tileMeta?.[3]?.label).toBe("덫 이름");
    expect(applied.tilesets[GRAFT_TILESET]!.tileGrafts).toEqual([{ targetTile: 5, sourceChipset: GRAFT_SOURCE, sourceTile: 4 }]);
    // 얼린 원본은 그대로이고(얼어 있으니 바뀔 수 없다 — 값으로도 확인한다), 고친 두 타일셋만 새 객체다.
    expect((frozen.tilesets[NAMED_TILESET] as Project["tilesets"][string]).tileMeta?.[3]?.label).not.toBe("덫 이름");
    expect((frozen.tilesets[GRAFT_TILESET] as Project["tilesets"][string]).tileGrafts ?? []).toEqual([]);
    const replaced = Object.keys(applied.tilesets).filter((id) => applied.tilesets[id] !== frozen.tilesets[id]);
    expect(replaced.sort()).toEqual([NAMED_TILESET, GRAFT_TILESET].sort());
    for (const id of Object.keys(frozen.uploaded)) expect(applied.assets.uploaded[id]).toBe(frozen.uploaded[id]);
    // 적용 뒤의 세션 초안도 스토어와 같은 객체를 가리킨다 — 다음 턴이 다시 통째로 복제하지 않는다.
    for (const id of Object.keys(applied.tilesets)) expect(session.getProposedProject().tilesets[id]).toBe(applied.tilesets[id]);
  });
});
