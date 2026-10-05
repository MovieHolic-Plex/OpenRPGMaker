import { TILE_ASSEMBLY_GUIDE_TOOLS } from "./tileAssemblyGuideTools";
import { AUTHORING_PRESET_TOOLS } from './authoringPresetTools';
import { AUTHORING_HARNESS_TOOLS } from '../../harnesses/_core/authoringRegistry';
import { INTERIOR_PLACEMENT_TOOLS } from "./interiorPlacementTools";
import { PUBLIC_TILE_RECIPE_TOOLS } from "./publicTileRecipeTools";
import { FOREST_RECIPE_TOOLS } from "./forestRecipeTools";
import { TILESET_REFERENCE_TOOLS, withTilesetReferencePurpose } from "./tilesetReferenceTools";
// editor/tools/toolRegistry.ts
// 모든 툴(읽기+쓰기)의 단일 레지스트리. 툴 추가 = 각 *Tools.ts 배열에 한 줄 추가로 끝난다.
// toOpenAiTools()로 OpenAI function calling `tools` 배열을 자동 파생한다.

import { BATTLE_TOOLS } from "./battleTools";
import { TROOP_BATTLE_PAGE_TOOLS } from "./troopBattlePageTools";
import { CLUSTER_RULE_TOOLS } from "./clusterRuleTools";
import { DB_TOOLS } from "./dbTools";
import { ENDING_TOOLS } from "./endingTools";
import { COMPANION_TOOLS } from "./companionTools";
import { TIME_GATE_TOOLS } from "./timeGateTools";
import { VEHICLE_TOOLS } from "./vehicleTools";
import { EVENT_COMMAND_ASSIST_TOOLS } from "./eventCommandAssistTool";
import { EVENT_TOOLS } from "./eventTools";
import { DIRECTING_GUIDE_TOOLS } from "./directingGuideTools";
import { NPC_CAST_TOOLS } from "./npcCastTools";
import { EXPORT_TOOLS } from "./exportTools";
import { MAP_GEN_TOOLS } from "./generateMapTool";
import { GROUP_LAYOUT_TOOLS } from "./groupLayoutTools";
import { GROUP_SAMPLE_TOOLS } from "./groupSampleTool";
import { HISTORY_TOOLS } from "./historyTools";
import { HOUSE_VISION_TOOLS } from "./houseVisionTools";
import { INVESTIGATION_TOOLS } from "./investigationTools";
import { MYSTERY_CASE_TOOLS } from "./mysteryCaseTool";
import { NARRATIVE_HORROR_TEMPLATE_TOOLS } from "./narrativeHorrorTemplateTools";
import { CUTSCENE_ART_TOOLS } from "./cutsceneArtTools";
import { WORLD_TERRAIN_TOOLS } from "./worldTerrainTools";
import { WORLDMAP_ICON_TOOLS } from "./worldmapIconTools";
import { IMPACT_CUTSCENE_TOOLS } from "./impactCutsceneTools";
import { CUTSCENE_PREVIEW_TOOLS } from "./cutscenePreviewTools";
import { CUTSCENE_STAGE_TOOLS } from "./cutsceneStageTools";
import { LIFE_FLOWER_TOOLS } from "./lifeFlowerTools";
import { LIGHTING_TOOLS } from "./lightingTools";
import { ACTION_TOOLS } from "./actionTools";
import { PROJECT_WIKI_TOOLS } from "./projectWikiTools";
import { MAP_TOOLS } from "./mapTools";
import { LAYER_TOOLS } from "./layerTools";
import { RELIEF_TOOLS } from "./reliefTools";
import { TERRAIN_TOOLS } from "./terrainTools";
import { MAP_LOCATION_TOOLS } from "./mapLocationTools";
import { MONSTER_SYSTEM_TOOLS } from "./monsterSystemTools";
import { WILD_ROUTE_TOOLS } from "./wildRouteTool";
import { TALL_GRASS_TOOLS } from "./tallGrassTool";
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
import { TILESET_OBJECT_TOOLS } from "./tilesetObjectTools";
import { PACK_TOWN_TOOLS } from "./packTownTools";
import { VILLAGE_TOOLS } from "./villageBuilder";
import { VILLAGE_SESSION_TOOLS } from "./villageSession";
import { INTERIOR_ROOM_SESSION_TOOLS } from "./interiorRoomSession";
import { HAND_INTERIOR_TOOLS } from "./handInteriorTools";
import { JP_CITY_TOOLS } from "./jpCityTools";
import { DUNGEON_ROOM_SESSION_TOOLS } from "./dungeonRoomSession";
import { AI_DOC_TOOLS } from "./aiDocTools";
import { RETRO_CHOREOGRAPHY_TOOLS } from "./retroChoreographyTools";
import { CINEMATIC_TOOLS } from "./cinematicTools";
import { IMAGE_ASSET_TOOLS } from "./imageAssetTools";
import { TITLE_ART_TOOLS } from "./titleArtTools";
import { PRESENTATION_TOOLS } from "./presentationTools";
import { TITLE_IMPROVE_TOOLS } from "./titleImproveTools";
import { FENCE_REPAIR_TOOLS } from "./fenceRepairTools";
import { AUDIO_DESCRIPTION_TOOLS } from "./audioDescriptionTools";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import { VIEW_FOCUS_TOOLS } from "./viewFocusTools";
import { CHARACTER_APPEARANCE_TOOLS } from "./characterAppearanceTools";
import { WORLD_GRAPH_TOOLS } from "./worldGraphTools";
import { TILE_QUERY_TOOLS } from "./tileQueryTool";
import { AUTHOR_HOUSE_TOOL } from "./authorHouseToolDef";
import { AUTHOR_VILLAGE_TOOL } from "./authorVillageToolDef";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "./authorBeodeulTown";
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
import { MONSTER_RESOURCE_TOOLS } from "./monsterResourceTools";
import { withMonsterAppearanceEnvelope } from "./monsterAppearanceTools";
import { WORLD_STRUCTURE_TOOLS } from "./worldStructureTools";
import { WORLD_CANON_TOOLS } from "./worldCanonTools";
import { SPATIAL_TOOLS } from "./spatialTools";
import { BUILD_CONCEPT_EXAMPLE_TOOL } from "./conceptExampleTool";
import { SHARED_SCENE_TOOLS } from "./sharedSceneTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { WEB_SEARCH_TOOLS } from "./webSearchTool";
import { TILESET_CHANGE_TOOLS } from "./tilesetChangeTools";

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
  return tools.map((definition) => {
    const tool = withTilesetReferencePurpose(withMonsterAppearanceEnvelope(definition));
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
  ["check_city_form", ["map"]],
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

/** 옛 실내 칩셋(EasyRPG 실내·Tibo 번호) 전용 도구 — 조수에게 보이지 않게 deprecated 로 돌리고 대체 도구를 적는다. */
function retireOldInteriorTool(tool: ToolDefinition): ToolDefinition {
  return { ...tool, deprecated: true, supersededBy: "build_hand_interior_room" };
}

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
  ...AUTHORING_PRESET_TOOLS,
  ...PROJECT_WIKI_TOOLS,
  ...WORLD_CANON_TOOLS,
  ...PROJECT_TOOLS,
  ...withDomain(VOCABULARY_TOOLS_V3, "tile"),
  AUTHOR_HOUSE_TOOL,
  AUTHOR_VILLAGE_TOOL,
  AUTHOR_BEODEUL_TOWN_TOOL,
  ...WORLD_STRUCTURE_TOOLS,
  ...SPATIAL_TOOLS,
  BUILD_CONCEPT_EXAMPLE_TOOL,
  ...SHARED_SCENE_TOOLS,
  ...SHARED_OBJECT_TOOLS,
  ...withDomain(CONSTRUCTION_TOOLS_V3, "tile"),
  ...withDomain(FENCE_REPAIR_TOOLS, "tile"),
  ...withDomain(HOUSE_VISION_TOOLS, "tile"),
  ...withDomain(VILLAGE_TOOLS, "tile"),
  ...withDomain(VILLAGE_SESSION_TOOLS, "tile"),
  // 손 도트 실내 v5 — 실내를 까는 유일한 조수 경로(2026-09-29). 옛 EasyRPG·Tibo 실내 칸 번호로 짓는 방 세션·개념 시설 시공은
  // 조수 목록에서 뺀다(deprecated: 노출 제외, 실행 호환은 유지 — 옛 세션 재생·테스트).
  ...withDomain(HAND_INTERIOR_TOOLS, "tile"),
  // 일본 도시(jp_city) 건물 조립 — 부품 사전으로 가변 폭·층수 건물을 jp_city 맵에 짓는다(M3). oprn-jp 맵에서만 동작한다.
  ...withDomain(JP_CITY_TOOLS, "tile"),
  ...withDomain(INTERIOR_ROOM_SESSION_TOOLS, "tile").map(retireOldInteriorTool),
  ...withDomain(DUNGEON_ROOM_SESSION_TOOLS, "tile"),
  ...withDomain(CASTLE_TOOLS, "tile"),
  ...withDomain(STRUCTURE_KIT_TOOLS, "tile"),
  ...withDomain(TILESET_OBJECT_TOOLS, "tile"),
  ...withDomain(PACK_TOWN_TOOLS, "tile"),
  ...withDomain(TILE_QUERY_TOOLS, "tile"),
  ...withDomain(MAP_TOOLS, "map"),
  // MZ 4층 쓰기(stamp_layer_block·paint_shadow) — 각 툴이 map·tile 두 도메인을 선언한다.
  ...withDomain(LAYER_TOOLS, "map"),
  ...withDomain(RELIEF_TOOLS, "map"),
  ...withDomain(TERRAIN_TOOLS, "map"),
  ...withDomain(MAP_LOCATION_TOOLS, "map"),
  ...withDomain(ACTION_TOOLS, "map"),
  ...withDomain(MAP_GEN_TOOLS, "map"),
  ...withDomain(WILD_ROUTE_TOOLS, "map"),
  ...withDomain(TALL_GRASS_TOOLS, "map"),
  ...withDomain(EVENT_TOOLS, "event"),
  ...withDomain(EVENT_COMMAND_ASSIST_TOOLS, "event"),
  ...withDomain(NPC_CAST_TOOLS, "event"),
  ...AUTHORING_HARNESS_TOOLS,
  ...withDomain(COMPANION_TOOLS, "event"),
  ...withDomain(TIME_GATE_TOOLS, "event"),
  ...withDomain(VEHICLE_TOOLS, "event"),
  ...withDomain(INVESTIGATION_TOOLS, "event"),
  ...withDomain(MYSTERY_CASE_TOOLS, "event"),
  ...withDomain(NARRATIVE_HORROR_TEMPLATE_TOOLS, "event"),
  ...withDomain(CUTSCENE_ART_TOOLS, "event"),
  ...withDomain(WORLD_TERRAIN_TOOLS, "world"),
  ...withDomain(WORLDMAP_ICON_TOOLS, "world"),
  // 충돌 전용 지름길은 script_cutscene_staged 하나로 합친다(2026-10-02 조수 시험: 두 도구가 있으면 모델은 전용 쪽만 쓰고
  // 일반 도구를 외면했다). 실행·코드 호환은 getTool 로 유지 — 오프라인 사슬·옛 세션 재생.
  ...withDomain(IMPACT_CUTSCENE_TOOLS, "event").map((tool) => ({ ...tool, deprecated: true, supersededBy: "script_cutscene_staged" })),
  ...withDomain(CUTSCENE_STAGE_TOOLS, "event"),
  ...withDomain(CUTSCENE_PREVIEW_TOOLS, "event"),
  ...withDomain(DIRECTING_GUIDE_TOOLS, "event"),
  ...withDomain(LIFE_FLOWER_TOOLS, "event"),
  ...withDomain(LIGHTING_TOOLS, "event"),
  ...withDomain(ENDING_TOOLS, "event"),
  ...withDomain(DB_TOOLS, "database"),
  ...withDomain(RETRO_CHOREOGRAPHY_TOOLS, "database"),
  ...withDomain(LIFE_SYSTEM_TOOLS, "database"),
  ...withDomain(LIFE_ECONOMY_TOOLS, "database"),
  ...withDomain(LIFE_COLLECTION_TOOLS, "database"),
  ...withDomain(FARM_SPATIAL_TOOLS, "database"),
  ...withDomain(GAME_SYSTEM_TOGGLE_TOOLS, "system"),
  ...withDomain(TILESET_ATLAS_TOOLS, "tile"),
  ...TILESET_REFERENCE_TOOLS,
  // 다른 칩셋 계열이 필요할 때 사용자에게 묻는 도구 — 실행기 거부 메시지가 이름을 부르므로 core 로 늘 노출한다.
  ...TILESET_CHANGE_TOOLS,
  ...TILE_ASSEMBLY_GUIDE_TOOLS,
  ...INTERIOR_PLACEMENT_TOOLS,
  ...FOREST_RECIPE_TOOLS,
  ...PUBLIC_TILE_RECIPE_TOOLS,
  // 혼합 도메인 — 각 툴이 자기 domains 를 선언하고, 선언이 없으면 map 으로 떨어진다.
  ...withDomain(AUTHORING_MISC_TOOLS, "map"),
  ...withDomain(RESOURCE_TOOLS, "system"),
  ...withDomain(MONSTER_RESOURCE_TOOLS, "database"),
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
  ...withDomain(CINEMATIC_TOOLS, "system"),
  ...withDomain(IMAGE_ASSET_TOOLS, "system"),
  ...withDomain(TITLE_ART_TOOLS, "system"),
  ...withDomain(PRESENTATION_TOOLS, "system"),
  ...withDomain(TITLE_IMPROVE_TOOLS, "system"),
  ...withDomain(AUDIO_DESCRIPTION_TOOLS, "system"),
  ...withDomain(EXPORT_TOOLS, "system"),
  ...withDomain(PLAY_TOOLS, "system"),
  ...withDomain(QUERY_TOOLS, "map"),
  // Documentation tools belong to the system domain for explicitly scoped callers.
  ...withDomain(AI_DOC_TOOLS, "system"),
  ...withDomain(TILE_METADATA_TOOLS, "tile"),
  ...withDomain(CLUSTER_RULE_TOOLS, "tile"),
  ...withDomain(GROUP_LAYOUT_TOOLS, "tile"),
  ...withDomain(GROUP_SAMPLE_TOOLS, "tile"),
  ...withDomain(VISION_QUERY_TOOLS, "map"),
  // View focus is domain-independent.
  ...VIEW_FOCUS_TOOLS,
  ...withDomain(CHARACTER_APPEARANCE_TOOLS, "database"),
  ...withDomain(PLACEMENT_TOOLS, "tile"),
  ...withDomain(RANGE_CLASSIFY_TOOLS, "tile"),
  // 웹 검색은 UI 상태로 예측할 수 없다 — "최신 정보가 필요하다" 는 도메인이 아니라 요청의 성질이다.
  ...WEB_SEARCH_TOOLS,
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

// OpenAI Chat Completions `tools` 배열로 변환. deprecated 툴은 어떤 모드에서도 노출하지 않는다.
export function toOpenAiTools(tools: readonly ToolDefinition[] = TOOL_REGISTRY, opts: ToolExposureOptions = {}): OpenAiTool[] {
  const domains = domainsFromOptions(opts);
  // Explicit domain filters serve scoped callers only. Never rank, pin or truncate capabilities.
  return tools.filter((tool) => tool.deprecated !== true && exposedInDomains(tool, domains))
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: injectToolReasonSchema(tool.parameters),
      },
    }));
}
