// editor/tools/toolRegistry.ts
// 모든 툴(읽기+쓰기)의 단일 레지스트리. 툴 추가 = 각 *Tools.ts 배열에 한 줄 추가로 끝난다.
// toOpenAiTools()로 OpenAI function calling `tools` 배열을 자동 파생한다.

import { BATTLE_TOOLS } from "./battleTools";
import { TROOP_BATTLE_PAGE_TOOLS } from "./troopBattlePageTools";
import { CLUSTER_RULE_TOOLS } from "./clusterRuleTools";
import { DB_TOOLS } from "./dbTools";
import { ENDING_TOOLS } from "./endingTools";
import { COMPANION_TOOLS } from "./companionTools";
import { EVENT_TOOLS } from "./eventTools";
import { NPC_CAST_TOOLS } from "./npcCastTools";
import { EXPORT_TOOLS } from "./exportTools";
import { MAP_GEN_TOOLS } from "./generateMapTool";
import { GROUP_LAYOUT_TOOLS } from "./groupLayoutTools";
import { GROUP_SAMPLE_TOOLS } from "./groupSampleTool";
import { HISTORY_TOOLS } from "./historyTools";
import { HOUSE_VISION_TOOLS } from "./houseVisionTools";
import { INVESTIGATION_TOOLS } from "./investigationTools";
import { NARRATIVE_HORROR_TEMPLATE_TOOLS } from "./narrativeHorrorTemplateTools";
import { LIGHTING_TOOLS } from "./lightingTools";
import { ACTION_TOOLS } from "./actionTools";
import { MAP_TOOLS } from "./mapTools";
import { MONSTER_SYSTEM_TOOLS } from "./monsterSystemTools";
import { PALETTE_PRESET_TOOLS } from "./palettePresetTools";
import { PLAY_TOOLS } from "./playTools";
import { PLACEMENT_TOOLS } from "./placementTools";
import { QUERY_TOOLS } from "./queryTools";
import { QUEST_TOOLS } from "./questTools";
import { RANGE_CLASSIFY_TOOLS } from "./rangeClassifyTools";
import { REFACTOR_TOOLS } from "./refactorTools";
import { STORY_TOOLS } from "./storyTools";
import { STORY_ARC_TOOLS } from "./storyArcTools";
import { QUALITY_EVALUATION_TOOLS } from "./qualityEvaluation";
import { TILE_METADATA_TOOLS } from "./tileMetadataTools";
import { TIME_TOOLS } from "./timeTools";
import { injectToolReasonSchema } from "@/ai/toolReason";
import type { JsonSchema, ToolDefinition, ToolDomain } from "./types";
import { V1_TILE_SUPERSEDED } from "./v2";
import { CONSTRUCTION_TOOLS_V3, VOCABULARY_TOOLS_V3 } from "./v3";
import { CASTLE_TOOLS } from "./castleBuilder";
import { STRUCTURE_KIT_TOOLS } from "./structureKitTools";
import { VILLAGE_TOOLS } from "./villageBuilder";
import { VILLAGE_SESSION_TOOLS } from "./villageSession";
import { INTERIOR_ROOM_SESSION_TOOLS } from "./interiorRoomSession";
import { DUNGEON_ROOM_SESSION_TOOLS } from "./dungeonRoomSession";
import { AI_DOC_TOOLS } from "./aiDocTools";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import { VIEW_FOCUS_TOOLS } from "./viewFocusTools";
import { WORLD_GRAPH_TOOLS } from "./worldGraphTools";
import { TILE_QUERY_TOOLS } from "./tileQueryTool";
import { getActiveToolDomainInfo } from "@/editor/assistantToolMode";
import { AUTHOR_HOUSE_TOOL } from "./authorHouseToolDef";
import { AUTHOR_VILLAGE_TOOL } from "./authorVillageToolDef";
import { PROJECT_TOOLS } from "./projectTools";
import { FIND_TOOLS } from "./discoveryTools";
import { LIFE_SYSTEM_TOOLS } from "./lifeSystemTools";
import { LIFE_ECONOMY_TOOLS } from "./lifeEconomyTools";
import { LIFE_COLLECTION_TOOLS } from "./lifeCollectionTools";
import { FARM_SPATIAL_TOOLS } from "./farmSpatialTools";
import { GAME_SYSTEM_TOGGLE_TOOLS } from "./gameSystemToggleTools";
import { TILESET_ATLAS_TOOLS } from "./tilesetAtlasTools";
import { AUTHORING_MISC_TOOLS } from "./authoringMiscTools";
import { RESOURCE_TOOLS } from "./resourceTools";

export { PLACEMENT_TOOLS };

// 구 비전/샘플 조회 등은 tile_query로 통합 — 레지스트리에 남아 있으면 deprecated.
export const LEGACY_TILE_KNOWLEDGE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  ["set_group_layout", "propose_tile_vocabulary"],
  ["suggest_group_from_range", "propose_tile_vocabulary"],
  ["render_group_sample", "tile_query"],
  ["show_tile_grid", "tile_query"],
  ["show_tiles", "tile_query"],
]);

// construction route manifest: 레거시 쓰기 → canonical facade (LLM 비노출, 직접 실행 호환).
// preview_house는 읽기 진단이므로 여기 넣지 않는다(공개 유지).
// build_house_kit / build_house_lots / stamp_structure_kit 는 등록 자체가 제거됐다 —
// 레지스트리에 정의가 없으므로 superseded 매핑도 두지 않는다. 옛 이름 호출은 unknown-tool 로 거부된다.
export const CONSTRUCTION_WRITE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  ["build_house", "author_house"],
  ["build_house_kit", "author_house"],
  ["build_house_lots", "author_house"],
  ["plan_village", "author_village"],
  ["materialize_village_spec", "author_village"],
  ["revise_village_plan", "author_village"],
  ["run_village_pipeline", "author_village"],
  ["build_village", "author_village"],
  ["start_village_session", "author_village"],
  ["plant_tree_clusters", "author_village"],
  ["advance_village_build", "author_village"],
  ["run_village_session", "author_village"],
]);

// 레거시 툴 이름에 deprecated + supersededBy 부여 (LLM 비노출, getTool 실행 호환).
function tagLegacy(tools: readonly ToolDefinition[]): readonly ToolDefinition[] {
  return tools.map((tool) => {
    if (tool.deprecated) return tool;
    const superseded =
      CONSTRUCTION_WRITE_SUPERSEDED.get(tool.name)
      ?? V1_TILE_SUPERSEDED.get(tool.name)
      ?? LEGACY_TILE_KNOWLEDGE_SUPERSEDED.get(tool.name);
    if (superseded) {
      return { ...tool, version: tool.version ?? (1 as const), deprecated: true, supersededBy: superseded };
    }
    return { ...tool, version: tool.version ?? (1 as const) };
  });
}

// ── 컨텍스트 모드 도메인 태깅(§2.2.2) ────────────────────────────────────────
// 노출 정책의 단일 소스: 패밀리 배열 단위 일괄 태깅 + 이름 단위 오버라이드.
// "core"는 모든 모드 상시 노출(스펙 §2.2.2의 정확한 5종).
// 참조 id 조회(get_database_records)는 core 다: speciesId/elementRates/itemId 를 쓰는 모든 쓰기 툴의
// 전제 조건인데 40툴 트림에서 잘리면 모델이 id 를 발명하고 무결성 검증에서 거부된다
// (2026-08-23 실측: 발명한 element id 3개 거부 후 "속성 id 조회 기능이 없다"며 작업 3건 포기).
const CORE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "create_map", "resize_map", "get_project_summary", "list_resources", "tile_query", "get_database_records",
]);

// 혼합 패밀리(QUERY_TOOLS 등)의 이름 단위 도메인 교정.
const NAME_DOMAIN_OVERRIDES: ReadonlyMap<string, readonly ToolDomain[]> = new Map([
  ["get_map_region", ["map"]],
  ["check_reachability", ["map"]],
  ["highlight_map_region", ["map"]],
  ["find_events", ["event"]],
  ["get_event", ["event"]],
  ["find_switch_usage", ["event"]],
  ["list_npc_graphics", ["event"]],
  ["get_database_records", ["database"]],
  ["query_tiles", ["tile"]],
  // 흙길 오토타일 — MAP_TOOLS에 있어도 타일 시공 도메인에서 써야 한다(lay_path만 열려 길이 안 깔리던 문제).
  ["paint_road", ["tile", "map"]],
  ["run_lint", ["system"]],
  ["list_project_commits", ["system"]],
  ["evaluate_game_quality", ["system"]],
]);

function withDomain(tools: readonly ToolDefinition[], domain: ToolDomain): readonly ToolDefinition[] {
  return tools.map((tool) => ({
    ...tool,
    domains: CORE_TOOL_NAMES.has(tool.name)
      ? (["core"] as const)
      : tool.domains
        ? tool.domains
        : (NAME_DOMAIN_OVERRIDES.get(tool.name) ?? [domain]),
  }));
}

// 레지스트리 순서: canonical construction → 정공법(v3) → 활성 맵/이벤트… → 레거시(deprecated) 엔진 호환.
export const TOOL_REGISTRY: readonly ToolDefinition[] = tagLegacy([
  FIND_TOOLS,
  ...PROJECT_TOOLS,
  ...withDomain(VOCABULARY_TOOLS_V3, "tile"),
  AUTHOR_HOUSE_TOOL,
  AUTHOR_VILLAGE_TOOL,
  ...withDomain(CONSTRUCTION_TOOLS_V3, "tile"),
  ...withDomain(HOUSE_VISION_TOOLS, "tile"),
  ...withDomain(VILLAGE_TOOLS, "tile"),
  ...withDomain(VILLAGE_SESSION_TOOLS, "tile"),
  ...withDomain(INTERIOR_ROOM_SESSION_TOOLS, "tile"),
  ...withDomain(DUNGEON_ROOM_SESSION_TOOLS, "tile"),
  ...withDomain(CASTLE_TOOLS, "tile"),
  ...withDomain(STRUCTURE_KIT_TOOLS, "tile"),
  ...withDomain(TILE_QUERY_TOOLS, "tile"),
  ...withDomain(MAP_TOOLS, "map"),
  ...withDomain(ACTION_TOOLS, "map"),
  ...withDomain(MAP_GEN_TOOLS, "map"),
  ...withDomain(EVENT_TOOLS, "event"),
  ...withDomain(NPC_CAST_TOOLS, "event"),
  ...withDomain(COMPANION_TOOLS, "event"),
  ...withDomain(INVESTIGATION_TOOLS, "event"),
  ...withDomain(NARRATIVE_HORROR_TEMPLATE_TOOLS, "event"),
  ...withDomain(LIGHTING_TOOLS, "event"),
  ...withDomain(ENDING_TOOLS, "event"),
  ...withDomain(DB_TOOLS, "database"),
  ...withDomain(LIFE_SYSTEM_TOOLS, "database"),
  ...withDomain(LIFE_ECONOMY_TOOLS, "database"),
  ...withDomain(LIFE_COLLECTION_TOOLS, "database"),
  ...withDomain(FARM_SPATIAL_TOOLS, "database"),
  ...withDomain(GAME_SYSTEM_TOGGLE_TOOLS, "system"),
  ...withDomain(TILESET_ATLAS_TOOLS, "tile"),
  // 혼합 도메인 — 각 툴이 자기 domains 를 선언하고, 선언이 없으면 map 으로 떨어진다.
  ...withDomain(AUTHORING_MISC_TOOLS, "map"),
  ...withDomain(RESOURCE_TOOLS, "system"),
  ...withDomain(WORLD_GRAPH_TOOLS, "world"),
  ...withDomain(PALETTE_PRESET_TOOLS, "tile"),
  ...withDomain(QUEST_TOOLS, "quest"),
  ...withDomain(STORY_ARC_TOOLS, "event"),
  ...withDomain(STORY_TOOLS, "quest"),
  ...withDomain(BATTLE_TOOLS, "battle"),
  ...withDomain(TROOP_BATTLE_PAGE_TOOLS, "battle"),
  ...withDomain(REFACTOR_TOOLS, "system"),
  ...withDomain(QUALITY_EVALUATION_TOOLS, "system"),
  ...withDomain(HISTORY_TOOLS, "system"),
  ...withDomain(TIME_TOOLS, "system"),
  ...withDomain(MONSTER_SYSTEM_TOOLS, "system"),
  ...withDomain(EXPORT_TOOLS, "system"),
  ...withDomain(PLAY_TOOLS, "system"),
  ...withDomain(QUERY_TOOLS, "map"),
  // present_doc / list_ai_docs: "core" 는 **모든 도메인에 상시 노출**이라 맵 크기를 묻는
  // 한 줄짜리 질문에도 따라붙었다. 어떤 스킬·프롬프트도 이 둘을 요구하지 않으므로(grep 확인)
  // system 도메인으로 내려 필요할 때만 노출한다. 노출 상한(40) 자리도 그만큼 돌아온다.
  ...withDomain(AI_DOC_TOOLS, "system"),
  ...withDomain(TILE_METADATA_TOOLS, "tile"),
  ...withDomain(CLUSTER_RULE_TOOLS, "tile"),
  ...withDomain(GROUP_LAYOUT_TOOLS, "tile"),
  ...withDomain(GROUP_SAMPLE_TOOLS, "tile"),
  ...withDomain(VISION_QUERY_TOOLS, "map"),
  // 도메인을 주지 않는다 — 도메인 없는 툴은 모든 모드의 라운드로빈 트림을 통과하면서 핀을 쓰지 않는다.
  // isPinnedTool은 도메인이 있는 툴만 핀할 수 있어, map 도메인과 핀을 함께 주면 상한(40)의 한 자리를
  // 강제로 예약한다. 실측에서는 그 예약 때문에 test/regionIntentExposure.test.ts의 대표 도구 보장 3건이 실패했다.
  ...VIEW_FOCUS_TOOLS,
  ...withDomain(PLACEMENT_TOOLS, "tile"),
  ...withDomain(RANGE_CLASSIFY_TOOLS, "tile"),
]);

const TOOL_BY_NAME = new Map<string, ToolDefinition>(TOOL_REGISTRY.map((tool) => [tool.name, tool]));

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_BY_NAME.get(name);
}

export function allTools(): readonly ToolDefinition[] {
  return TOOL_REGISTRY;
}

/** LLM/UI에 보여줄 활성 툴만 (deprecated 제외). */
export function activeTools(): readonly ToolDefinition[] {
  return TOOL_REGISTRY.filter((tool) => tool.deprecated !== true);
}

export interface OpenAiTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

// 컨텍스트 모드 노출 옵션(§2.2.2). mode가 없으면 종전대로 deprecated만 거른다.
export interface ToolExposureOptions {
  readonly domains?: ReadonlySet<ToolDomain>;
  readonly mode?: ToolDomain;
}

// 다도메인 region AI에서 place_props·place_npc가 함께 남도록 여유.
// 이 핀 목록은 전역이다(일반 채팅 등 region-task 이외 흐름도 공유). 상한(40) 초과 시
// 비핀 자리는 도메인별 라운드로빈 쿼터로 배분되므로(trimToExposureCap), 핀 1개 추가의
// 비용은 특정 도메인(특히 레지스트리 후순위 패밀리) 전멸이 아니라 전 도메인에 1툴씩
// 분산된다 — 2026-07-10 라이브 실측(place_chest 크라우드아웃)의 재발 방지 구조.
const MAX_EXPOSED_TOOLS = 40;
// 핀 규칙: deprecated(=supersededBy 가 붙는) 툴은 절대 핀하지 않는다. toOpenAiTools가
// deprecated를 먼저 걸러내므로 핀해도 노출되지 않고, "보장됐다"는 착각만 남는다.
// 재발 방지는 test/toolRegistry.test.ts 의 "핀된 툴은 deprecated가 아니다" 가드가 담당한다.
export const PINNED_TOOLS_BY_DOMAIN: ReadonlyMap<ToolDomain, ReadonlySet<string>> = new Map([
  ["system", new Set(["reset_project", "configure_time_system", "evaluate_game_quality"])],
  ["tile", new Set([
    "author_house", // 집·여관 외장 canonical facade (build_house_kit/lots의 대체 툴)
    "author_village",
    "place_props",
    "build_castle", // 성채 모듈(지붕면/성벽/원형타워) 결정론 시공
    // 실내 하네스 — 상한(40) 트림에서 **실제로 노출되는** 야외 시공 툴(author_house 등)에
    // 밀려 "실내 만들어줘"가 외장 집으로 새는 것을 막는다.
    // (build_house_kit/build_house_lots는 deprecated=비노출이라 애초에 핀 대상이 아니다.)
    "start_interior_room_session",
    "run_interior_room_pipeline",
    "advance_interior_room_build",
    "evaluate_interior_room",
    // 실내 유일한 in-place 경로. 핀 없이는 상한 트림에서 밀려, 기존 실내 맵을 고치라는 요청에
    // 모델 손에 "새 방을 시공하는" 세션 툴만 남았다(2026-08-29 modify 진단 근본원인 8).
    "furnish_interior_space",
    // list_interior_room_sessions 는 핀하지 않는다 — 핀이 이미 상한(40)을 넘겨 라운드로빈으로
    // 배분되는 상태라, 핀을 하나 더 얹으면 tile 버킷 꼬리의 evaluate_interior_room 이 밀려난다
    // (실측: test/regionIntentExposure.test.ts interior 보장 실패). 조회용이라 furnish_interior_space
    // 설명이 mapId 로 바로 고치라고 안내하는 것으로 충분하고, 필요하면 find_tools 로 잡힌다.
    "fill_region",
    "build_wall",
    // door-transfer 가이드가 "문 시각 배치는 place_door" 라고 직접 가리키는 대표 도구다. 실내 하네스
    // 4종이 핀에 들어오며 tile 도메인이 상한(40) 트림에 걸리자 이것이 밀려나, 문을 그리는 경로가
    // 노출에서 사라졌다(test/regionIntentExposure.test.ts door-transfer 보장 실패).
    "place_door",
    "paint_road", // 흙길/모래 8방 오토타일 — lay_path만 핀되면 AI가 길을 안 깔거나 비성형 경로로 감
    "lay_path",
    "tile_query",
    // propose_tile_vocabulary: LLM 비노출(deprecated). 핀하지 않음.
    "tile_erase", // transform 가이드 대표 도구(regionIntentExposure) — clear_region 폐기 후 유일한 지우기 경로
  ])],
  ["event", new Set([
    "place_npc", "make_villager", "list_npc_graphics", "find_events", "get_event", "set_shop_stock",
    // 영역 작업 quest-trigger/mood/door-transfer 가이드 대표 도구(2026-07-10 라이브 실측 수정) —
    // event 도메인 안에서도 EVENT_TOOLS/LIGHTING_TOOLS 뒤쪽 정의라 상한(40) 슬라이스에서 밀려
    // place_chest 등이 노출 안 되던 문제.
    "place_chest", "place_storage_chest", "place_savepoint", "set_scene_mood", "set_lighting_volume", "create_transfer_pair",
    "author_story_arc",
    // 컷신/선택지 요청의 대표 도구. 트림에서 밀리면 모델이 "선택지를 만드는 입력이 없다"고
    // 사용자에게 보고한다(2026-08-23 실측) — 있는 기능을 없다고 말하게 만드는 노출 누락이다.
    "script_cutscene", "script_cutscene_preset",
    // 엔딩 툴은 event 도메인으로 태깅돼 있다(withDomain(ENDING_TOOLS,"event")). quest 쪽에 핀해도
    // isPinnedTool 이 tool.domains 를 보므로 효과가 없어 "엔딩 정의 기능이 없다"는 오보가 계속됐다.
    "define_ending", "list_endings",
  ])],
  ["database", new Set([
    // 상성표/속성 요청의 대표 도구.
    "set_type_chart", "upsert_item", "upsert_enemy",
    // 농장 건물·집 장식 쓰기 툴. 쿼터 트림에 밀리면 모델이 "농장 건물 기능이 없다"고 보고한다.
    "upsert_farm_building_type", "upsert_home_decoration_type",
    "upsert_farm_animal_building", "set_session_farm_state", "create_farm_plot",
  ])],
  ["map", new Set([
    // reset_project 는 map 핀에서 뺐다 — "이 맵 처음부터 다시 칠해줘" 같은 부분 재작업 요청에
    // 전체 초기화 툴이 손에 잡히는 미끼였다(2026-08-29 modify 진단 근본원인 13). system 도메인에만 남긴다.
    "author_village",
    "get_map_region", "show_map_region", "get_project_summary",
    // 수정 요청에서 tile 도메인이 닫힌 턴에도 "지우기" 경로가 남아야 한다 — tile_erase 가 유일한
    // 지우기 툴인데(clear_region 폐기) tile 핀에만 있어서 map 도메인만 열린 턴에는 사라졌다.
    "tile_erase",
    // 영역 작업 transform/battle-trap/structure 가이드 대표 도구(2026-07-10 라이브 실측 수정).
    // 쿼터 트림이 핀 비용을 전 도메인에 분산하므로, 가이드가 안내하는 대표 도구는 핀으로 보장한다.
    "mirror_region", "set_encounter_table", "make_hunting_ground", "create_farm_plot",
  ])],
  // define_ending 이 트림되면 "엔딩을 정의하는 기능이 없다"는 잘못된 보고로 이어진다(2026-08-23 실측).
  ["quest", new Set([
    "author_story_arc",
    "define_quest",
    "create_quest",
    "verify_quest",
    "lint_quest",
    "generate_walkthrough",
  ])],
  ["world", new Set([
    "plan_world",
    "build_world",
    "link_maps",
    "lint_world",
  ])],
]);
const WRITE_HEAVY_DOMAIN_ORDER: ReadonlyMap<ToolDomain, number> = new Map([
  ["tile", 0],
  ["event", 1],
  ["database", 2],
  ["battle", 3],
  ["quest", 4],
  ["world", 5],
  ["map", 6],
  ["system", 7],
  ["core", 8],
]);

function domainsFromOptions(opts: ToolExposureOptions): ReadonlySet<ToolDomain> | undefined {
  if (opts.domains) return opts.domains;
  if (!opts.mode) return undefined;
  return new Set<ToolDomain>(["core", opts.mode]);
}

// 도메인 스코핑 판정: 도메인 없는 툴은 범용(항상), core는 상시, 그 외엔 활성 도메인과 교집합이 있어야 노출.
function exposedInDomains(tool: ToolDefinition, domains: ReadonlySet<ToolDomain> | undefined): boolean {
  if (domains === undefined || !tool.domains) return true;
  return tool.domains.includes("core") || tool.domains.some((domain) => domains.has(domain));
}

function toolPrimaryDomain(tool: ToolDefinition): ToolDomain | undefined {
  return tool.domains?.find((domain) => domain !== "core") ?? tool.domains?.[0];
}

function domainPriority(domain: ToolDomain, domains: ReadonlySet<ToolDomain>): number {
  if (domain === "core") return 0;
  const info = getActiveToolDomainInfo(domains);
  if (!info) return 4;
  if (domain === info.uiDomain) return 1;
  if (info.intentDomains.has(domain)) return 2;
  if (info.recentDomains.has(domain)) return 3;
  return 4;
}

function removableDomains(exposed: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain>): ToolDomain[] {
  const active = new Set<ToolDomain>();
  for (const tool of exposed) {
    const domain = toolPrimaryDomain(tool);
    if (domain && domain !== "core") active.add(domain);
  }
  active.delete("database");
  // 강한 의도/UI 도메인은 통째로 드롭하지 않는다(region: tile+event 동시 필요).
  // recent/weak/map 보조만 도메인 단위로 빼고, 나머지는 pin+상한 슬라이스.
  return [...active]
    .filter((domain) => domainPriority(domain, domains) >= 3)
    .sort((a, b) => {
      const priority = domainPriority(b, domains) - domainPriority(a, domains);
      if (priority !== 0) return priority;
      return (WRITE_HEAVY_DOMAIN_ORDER.get(b) ?? 99) - (WRITE_HEAVY_DOMAIN_ORDER.get(a) ?? 99);
    });
}

function isPinnedTool(tool: ToolDefinition, domains: ReadonlySet<ToolDomain>): boolean {
  if (tool.domains?.includes("core")) return true;
  for (const domain of tool.domains ?? []) {
    if (!domains.has(domain)) continue;
    if (PINNED_TOOLS_BY_DOMAIN.get(domain)?.has(tool.name)) return true;
  }
  return false;
}

// 상한 트림 — 레지스트리 등록 순서 슬라이스가 아니라 도메인별 라운드로빈 쿼터.
// 종전 slice(0, room)은 등록 후순위 도메인(worldTools 등)을 통째로 밀어냈고, 핀을 하나
// 추가할 때마다 그 비용이 전부 마지막 도메인에 전가됐다. 라운드로빈은 활성 도메인마다
// 최소 ⌊room/도메인 수⌋개를 보장하고, 핀 추가 비용을 전 도메인에 1툴씩 분산한다.
// 도메인 내부 순서는 레지스트리 순서를 유지한다(패밀리 배열 앞쪽 = 우선 노출 의도).
function trimToExposureCap(exposed: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain>): readonly ToolDefinition[] {
  if (exposed.length <= MAX_EXPOSED_TOOLS) return exposed;
  const pinned = exposed.filter((tool) => isPinnedTool(tool, domains));
  if (pinned.length >= MAX_EXPOSED_TOOLS) {
    // 핀 자체가 상한을 넘으면 레지스트리 순서로 자르지 않는다. 뒤쪽에 등록된 강한
    // 의도 도메인(system 등)이 통째로 사라지므로, 도메인별 라운드로빈으로 최소
    // 도달성을 보장한 뒤 원래 레지스트리 순서로 반환한다.
    const NO_DOMAIN = "__none__" as const;
    const buckets = new Map<ToolDomain | typeof NO_DOMAIN, ToolDefinition[]>();
    for (const tool of pinned) {
      const key = toolPrimaryDomain(tool) ?? NO_DOMAIN;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(tool);
      else buckets.set(key, [tool]);
    }
    const order = [...buckets.keys()].sort((a, b) => {
      const pa = a === NO_DOMAIN ? 99 : domainPriority(a, domains);
      const pb = b === NO_DOMAIN ? 99 : domainPriority(b, domains);
      if (pa !== pb) return pa - pb;
      const wa = a === NO_DOMAIN ? 99 : (WRITE_HEAVY_DOMAIN_ORDER.get(a) ?? 99);
      const wb = b === NO_DOMAIN ? 99 : (WRITE_HEAVY_DOMAIN_ORDER.get(b) ?? 99);
      return wa - wb;
    });
    const picked = new Set<ToolDefinition>();
    while (picked.size < MAX_EXPOSED_TOOLS) {
      let tookAny = false;
      for (const key of order) {
        if (picked.size >= MAX_EXPOSED_TOOLS) break;
        const quantum = key !== NO_DOMAIN && domainPriority(key, domains) <= 2 ? 2 : 1;
        for (let take = 0; take < quantum && picked.size < MAX_EXPOSED_TOOLS; take += 1) {
          const next = buckets.get(key)?.shift();
          if (!next) break;
          picked.add(next);
          tookAny = true;
        }
      }
      if (!tookAny) break;
    }
    return exposed.filter((tool) => picked.has(tool));
  }
  const rest = exposed.filter((tool) => !isPinnedTool(tool, domains));

  const NO_DOMAIN = "__none__" as const;
  const buckets = new Map<ToolDomain | typeof NO_DOMAIN, ToolDefinition[]>();
  for (const tool of rest) {
    const key = toolPrimaryDomain(tool) ?? NO_DOMAIN;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(tool);
    else buckets.set(key, [tool]);
  }
  // 중요한 도메인이 먼저 뽑는다(우선순위 낮은 숫자 = 중요). 동률은 쓰기 중심 순서.
  const order = [...buckets.keys()].sort((a, b) => {
    const pa = a === NO_DOMAIN ? 99 : domainPriority(a, domains);
    const pb = b === NO_DOMAIN ? 99 : domainPriority(b, domains);
    if (pa !== pb) return pa - pb;
    const wa = a === NO_DOMAIN ? 99 : (WRITE_HEAVY_DOMAIN_ORDER.get(a) ?? 99);
    const wb = b === NO_DOMAIN ? 99 : (WRITE_HEAVY_DOMAIN_ORDER.get(b) ?? 99);
    return wa - wb;
  });

  // 가중 라운드로빈: UI/강한 의도 도메인(priority ≤ 2)은 라운드당 2개, 나머지는 1개.
  // 균등 배분은 강한 의도 도메인(예: database 전량 유지 기대)을 약한 도메인과 같은
  // 지분으로 깎아버린다 — 의도가 명확한 도메인이 더 넓은 툴셋을 받아야 한다.
  let room = MAX_EXPOSED_TOOLS - pinned.length;
  const picked = new Set<ToolDefinition>(pinned);
  while (room > 0) {
    let tookAny = false;
    for (const key of order) {
      if (room <= 0) break;
      const quantum = key !== NO_DOMAIN && domainPriority(key, domains) <= 2 ? 2 : 1;
      for (let take = 0; take < quantum && room > 0; take += 1) {
        const next = buckets.get(key)?.shift();
        if (!next) break;
        picked.add(next);
        room -= 1;
        tookAny = true;
      }
    }
    if (!tookAny) break;
  }
  // 반환은 원래 노출 순서(레지스트리 순서)를 유지해 프롬프트 안정성을 지킨다.
  return exposed.filter((tool) => picked.has(tool));
}

function applyExposureLimit(exposed: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain> | undefined): readonly ToolDefinition[] {
  if (domains === undefined || exposed.length <= MAX_EXPOSED_TOOLS) return exposed;
  const removable = removableDomains(exposed, domains);
  // 단일 활성 도메인(event/map 등)만 남은 상태에서는 제거할 약한 도메인이 없다.
  // 여기서 slice 하면 조회 보조 툴이 잘려 원래 모드가 망가지므로 다도메인 폭주에만 상한을 적용한다.
  if (removable.length <= 1) return trimToExposureCap(exposed, domains);
  const removed = new Set<ToolDomain>();
  let limited = [...exposed];
  for (const domain of removable) {
    if (limited.length <= MAX_EXPOSED_TOOLS) break;
    removed.add(domain);
    limited = limited.filter((tool) => {
      if (isPinnedTool(tool, domains) || tool.domains?.includes("core") || !tool.domains) return true;
      return tool.domains.some((toolDomain) => !removed.has(toolDomain));
    });
  }
  return trimToExposureCap(limited, domains);
}

// OpenAI Chat Completions `tools` 배열로 변환. deprecated 툴은 어떤 모드에서도 노출하지 않는다.
export function toOpenAiTools(tools: readonly ToolDefinition[] = TOOL_REGISTRY, opts: ToolExposureOptions = {}): OpenAiTool[] {
  const domains = domainsFromOptions(opts);
  return applyExposureLimit(
    tools.filter((tool) => tool.deprecated !== true && exposedInDomains(tool, domains)),
    domains
  )
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: injectToolReasonSchema(tool.parameters),
      },
    }));
}
