import { MONSTER_GAME_TOOLS } from './monsterGameTools';
import { MONSTER_TOURNAMENT_TOOLS } from './monsterTournamentTools';
import { MONSTER_BATCH_TOOLS } from './monsterBatchTools';
import { bindStreetToolLookup } from "./jpCityStreetTool";
import { bindRegionToolLookup } from "./jpRegionTool";
import { bindThemeToolLookup } from "./themeScenes";
import { bindSpaceBlueprintToolLookup } from "@/editor/spacePresetCatalog";
import { MAP_EMPTINESS_TOOLS } from "./mapEmptiness";
import { OPENING_ANIMATIC_TOOLS } from "./openingAnimaticTools";
import { MUSIC_AUTHORING_TOOLS } from './musicAuthoringTools';
import { NPC_PATROL_TOOLS } from './npcPatrolTools';
import { FIELD_ENEMY_TOOLS } from './fieldEnemyTools';
import { FIELD_OBSTACLE_TOOLS } from './fieldObstacleTools';
import { TRAINER_TOOLS } from './trainerTools';
import { MONSTER_CENTER_TOOLS } from './monsterCenterTools';
import { BADGE_GATE_TOOLS } from './badgeGateTools';
import { MONSTER_PC_TOOLS } from './monsterPcTools';
import { GAME_SYSTEM_AUTHORING_TOOLS } from './gameSystemAuthoringTools';
import { OPENING_STORYBOOK_TOOLS } from './openingStorybookTools';
import { TILE_ASSEMBLY_GUIDE_TOOLS } from "./tileAssemblyGuideTools";
import { AUTHORING_PRESET_TOOLS } from './authoringPresetTools';
import { AUTHORING_HARNESS_TOOLS } from '../../harnesses/_core/authoringRegistry';
import { INTERIOR_PLACEMENT_TOOLS } from "./interiorPlacementTools";
import { KIT_AREA_TOOLS } from "./kitAreaTools";
import { TILESET_REFERENCE_TOOLS, withTilesetReferencePurpose } from "./tilesetReferenceTools";
// editor/tools/toolRegistry.ts
// 모든 툴(읽기+쓰기)의 단일 레지스트리. 툴 추가 = 각 *Tools.ts 배열에 한 줄 추가로 끝난다.
// toOpenAiTools()로 OpenAI function calling `tools` 배열을 자동 파생한다.

import { BATTLE_TOOLS } from "./battleTools";
import { COMBO_TECH_TOOLS } from "./comboTechTools";
import { TROOP_BATTLE_PAGE_TOOLS } from "./troopBattlePageTools";
import { CLUSTER_RULE_TOOLS } from "./clusterRuleTools";
import { DB_TOOLS } from "./dbTools";
import { ENEMY_PIXEL_SHEET_TOOLS } from "./enemyPixelSheetTools";
import { ENDING_TOOLS } from "./endingTools";
import { COMPANION_TOOLS } from "./companionTools";
import { TIME_GATE_TOOLS } from "./timeGateTools";
import { MAP_VARIANT_TOOLS } from "./mapVariantTools";
import { TILE_CHANGE_EFFECT_TOOLS } from "./tileChangeEffectTools";
import { VEHICLE_TOOLS } from "./vehicleTools";
import { EVENT_COMMAND_ASSIST_TOOLS } from "./eventCommandAssistTool";
import { EVENT_TOOLS } from "./eventTools";
import { BEODEUL_DOOR_TOOLS } from "./beodeulDoorTools";
import { BEODEUL_HAMLET_TOOLS } from './beodeulHamletTools';
import { BEODEUL_COURTYARD_TOOLS } from './beodeulCourtyardTools';
import { BEODEUL_VEGETATION_TOOLS } from './beodeulVegetationTools';
import { BEODEUL_LIGHT_TOOLS } from './beodeulLightTools';
import { BEODEUL_GROUND_TOOLS } from './beodeulGroundTools';
import { BEODEUL_ARCHITECTURE_TOOLS } from './beodeulArchitectureTools';
import { DIRECTING_GUIDE_TOOLS } from "./directingGuideTools";
import { ASSISTANT_SKILL_TOOLS } from "./assistantSkillTools";
import { DIALOGUE_TOOLS } from "./dialogueTools";
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
import { WORLD_VARIANT_TOOLS } from "./worldVariantTools";
import { WORLD_ATLAS_TOOLS } from "./worldAtlasTools";
import { WORLDMAP_ICON_TOOLS } from "./worldmapIconTools";
import { IMPACT_CUTSCENE_TOOLS } from "./impactCutsceneTools";
import { CUTSCENE_PREVIEW_TOOLS } from "./cutscenePreviewTools";
import { CUTSCENE_STAGE_TOOLS } from "./cutsceneStageTools";
import { STAGE_PERFORMANCE_TOOLS } from "./stagePerformanceTools";
import { MECH_CHARSET_TOOLS } from "./mechCharsetTools";
import { PIXEL_ART_TOOLS } from "./pixelArtTools";
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
import { GENRE_LOCK_TOOLS } from "./genreLockTools";
import { WILD_ROUTE_TOOLS } from "./wildRouteTool";
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
import { STRUCTURE_KIT_TOOLS } from "./structureKitTools";
import { TILESET_OBJECT_TOOLS } from "./tilesetObjectTools";
import { HAND_INTERIOR_TOOLS } from "./handInteriorTools";
import { bindJrpgVolumeToolLookup, JRPG_VOLUME_TOOLS } from "./jrpgVolumeTools";
import { JRPG_CHAPTER_TOOLS } from "./jrpgChapterTools";
import { PUZZLE_AUTHORING_TOOLS } from "./puzzleAuthoringTools";
import { SPACE_BLUEPRINT_TOOLS } from "./spaceBlueprintTools";
import { JP_CITY_TOOLS } from "./jpCityTools";
import { CAMPUS_TOOLS } from "./campusTools";
import { MODERN_CITY_TOOLS } from "./modernCityTools";
import { DESERT_EAST_TOOLS } from "./desertEastTools";
import { WIZARDING_SPACE_TOOLS } from "./wizardingSpaceTools";
import { PIRATE_ISLES_TOOLS } from "./pirateIslesTools";
import { SENGOKU_EDO_TOOLS } from "./sengokuEdoTools";
import { SKY_ISLAND_TOOLS } from "./skyIslandTools";
import { STEAMPUNK_CITY_TOOLS } from "./steampunkCityTools";
import { SF_STATION_TOOLS } from "./sfStationTools";
import { GOTHIC_PLACE_TOOLS } from "./gothicPlaceTools";
import { PREHISTORIC_TOOLS } from "./prehistoricTools";
import { SNOW_NORTH_TOOLS } from "./snowNorthTools";
import { FIND_VILLAGE_TYPE_TOOL } from "./villageTypeTool";
import { DRESS_JOSEON_MARKET_TOOL, DRESS_VILLAGE_QUARTER_TOOL } from "./villageQuarterTool";
import { TRANSIT_TOOLS } from "./transitTools";
import { ADD_STREET_WALKERS_TOOL } from "./streetWalkersTool";
import { AI_DOC_TOOLS } from "./aiDocTools";
import { RETRO_CHOREOGRAPHY_TOOLS } from "./retroChoreographyTools";
import { CINEMATIC_TOOLS } from "./cinematicTools";
import { IMAGE_ASSET_TOOLS } from "./imageAssetTools";
import { MAP_BACKGROUND_GENERATION_TOOLS } from "./mapBackgroundGenerationTool";
import { TITLE_ART_TOOLS } from "./titleArtTools";
import { PRESENTATION_TOOLS } from "./presentationTools";
import { TITLE_IMPROVE_TOOLS } from "./titleImproveTools";
import { AUDIO_DESCRIPTION_TOOLS } from "./audioDescriptionTools";
import { ORIGINAL_MUSIC_TOOLS } from './originalMusicTools';
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import { VIEW_FOCUS_TOOLS } from "./viewFocusTools";
import { CHARACTER_APPEARANCE_TOOLS } from "./characterAppearanceTools";
import { WORLD_GRAPH_TOOLS } from "./worldGraphTools";
import { DUNGEON_LINK_TOOLS } from "./dungeonLinkTools";
import { TILE_QUERY_TOOLS } from "./tileQueryTool";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "./authorBeodeulTown";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS, AUTHOR_DUNGEON_TOOL } from "./dungeonTools";
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
import { STORE_TOOLS } from "./storeTools";
import { OBJECT_GEN_TOOLS } from "./objectGenTool";
import { SCENE_SETTING_TOOLS } from "./sceneSettingTools";

export { PLACEMENT_TOOLS };

// 구 비전/샘플 조회 등은 tile_query로 통합 — 레지스트리에 남아 있으면 deprecated.
export const LEGACY_TILE_KNOWLEDGE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  ["set_group_layout", "propose_tile_vocabulary"],
  ["suggest_group_from_range", "propose_tile_vocabulary"],
  ["render_group_sample", "tile_query"],
  ["show_tile_grid", "tile_query"],
  ["show_tiles", "tile_query"],
]);

// 옛 쓰기 툴 이름 → 대체 도구(LLM 비노출). 숲마을·합본 마을 시공기(author_village·build_village 계열·author_house)와
// 그 레거시 이름 매핑은 2026-10-07 저작권 정리로 칩셋과 함께 지웠다 — 옛 이름 호출은 unknown-tool 로 거부된다.
export const CONSTRUCTION_WRITE_SUPERSEDED: ReadonlyMap<string, string> = new Map();

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

/**
 * EasyRPG 칩셋 번호를 깔고 그 칩셋 맵을 만드는 생성기(던전 방 파이프라인·generate_map) — 대체 생성 칩셋이 생기기 전까지 조수에게 숨긴다
 * (2026-10-06 사용자 결정, retiredEasyRpgTilesets.ts). 던전·숲·들판은 등록 장소를 import_region_reference 로 가져온다. 편집기 실행 호환은 남긴다.
 */
function retireEasyRpgGenerator(tool: ToolDefinition): ToolDefinition {
  return { ...tool, deprecated: true, supersededBy: "import_region_reference" };
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
  AUTHOR_BEODEUL_TOWN_TOOL,
  AUTHOR_DUNGEON_TOOL,
  AUTHOR_BEODEUL_DUNGEON_ALIAS,
  ...WORLD_STRUCTURE_TOOLS,
  ...SPATIAL_TOOLS,
  BUILD_CONCEPT_EXAMPLE_TOOL,
  ...SHARED_SCENE_TOOLS,
  ...SHARED_OBJECT_TOOLS,
  ...SCENE_SETTING_TOOLS,
  ...withDomain(CONSTRUCTION_TOOLS_V3, "tile"),
  ...withDomain(HOUSE_VISION_TOOLS, "tile"),
  // 손 도트 실내 v5 — 실내를 까는 유일한 조수 경로(2026-09-29). 옛 EasyRPG·Tibo 실내 방 세션·던전 방 파이프라인·팩 마을·
  // 숲 조립·키큰 풀 도구는 2026-10-07 저작권 정리로 칩셋과 함께 지웠다.
  ...withDomain(HAND_INTERIOR_TOOLS, "tile"),
  // AI 참고 청사진 — 공간 이름 한 마디(오피스 로비·강의실·강변·알현실…)를 청사진 규칙 + 요청 뉘앙스 + 새 씨앗으로 매번 다르게 짓는다(2026-10-18).
  ...SPACE_BLUEPRINT_TOOLS,
  // 일본 도시(jp_city) 건물 조립 — 부품 사전으로 가변 폭·층수 건물을 jp_city 맵에 짓는다(M3). oprn-jp 맵에서만 동작한다.
  ...withDomain(JP_CITY_TOOLS, "tile"),
  // 현대 학교·캠퍼스(modern_campus) 야외 구성(학교 마당·교외 거리)과 건물 문 ↔ 실내 이음. modern_campus 맵에서만 동작한다.
  ...withDomain(CAMPUS_TOOLS, "tile"),
  // 도쿄풍 도시(modern_city) 거리 구성기(도로·교차로·건물 키트·공원·소품·차)와 건물 문 ↔ 실내 이음. modern_city 맵에서만 동작한다.
  ...withDomain(MODERN_CITY_TOOLS, "tile"),
  // 사막·동양풍(desert_east) 야외·실내 구성과 건물 문 ↔ 실내 이음. desert_east 맵에서만 동작한다.
  ...withDomain(DESERT_EAST_TOOLS, "tile"),
  // 마법 학교(해리포터풍, wizarding_world) 공간 빌더 — 13공간 레시피로 방·야외 한 장을 한 번에 짓는다(통행 한 덩이 보장).
  ...withDomain(WIZARDING_SPACE_TOOLS, "tile"),
  // 열대 군도·해적 항구(pirate_isles) 맵 구성기 — 항구·섬 마을·요새·난파선 섬·배/술집/오두막/동굴 안을 씨앗으로 한 장째 짠다. oprn-pirate 맵에서만 동작한다.
  ...withDomain(PIRATE_ISLES_TOOLS, "tile"),
  // 전국·에도 일본(sengoku_edo) 야외 구성(성하마을·여관 거리·무가 저택·성·신사/절·농촌)과 건물 문 ↔ 실내 이음. sengoku_edo 맵에서만 동작한다.
  ...withDomain(SENGOKU_EDO_TOOLS, "tile"),
  // 하늘섬(sky_island) 구성기 — 마을·신전 섬·비공정 부두·섬 사슬·실내 방 한 장(섬·건물·다리·소품, 도달 검사)과 건물 문 ↔ 실내 이음. sky_island 맵에서만 동작한다.
  ...withDomain(SKY_ISLAND_TOOLS, "tile"),
  // 스팀펑크 도시(steampunk_city) 구성기 — 거리·공장역·운하 부두·실내 여섯 가지를 한 번에 짓고(배치·통행은 구성기), 건물 문 ↔ 실내를 잇는다.
  ...withDomain(STEAMPUNK_CITY_TOOLS, "tile"),
  // JRPG 한 고장 분량 — 마을 집 문 ↔ 여관·상점·장로 실내, 가장자리 ↔ 가도(보이는 적·상자), 가도 끝 ↔ 던전(중간 보스·수호자)을 하위 도구로 잇는다.
  ...withDomain(JRPG_VOLUME_TOOLS, "tile"),
  // 크로노 트리거·FF6 한 장 — 거점 장면 + 실내·장면·던전 갈래 + NPC·퀘스트·사건 컷신·시간의 문을 하위 도구로 묶는다.
  ...withDomain(JRPG_CHAPTER_TOOLS, "tile"),
  // SF 정거장·네온 거리(sf_station) 맵 구성기 — 정거장·연구 기지 실내·네온 거리·달 기지를 씨앗으로 한 장째 짠다. oprn-scifi 맵에서만 동작한다.
  ...withDomain(SF_STATION_TOOLS, "tile"),
  ...withDomain(GOTHIC_PLACE_TOOLS, "tile"),
  // 선사 시대 원시 세계(prehistoric) 구성기 — 부족 마을·늪지·화산 골짜기·화석 계곡·실내 넷을 한 번에 짓고(배치·통행·바닥 가장자리는 구성기), 집·동굴 문 ↔ 실내를 잇는다.
  ...withDomain(PREHISTORIC_TOOLS, "tile"),
  // 북방 설원(snow_north) 구성기 — 눈 마을·얼어붙은 호수·얼음 동굴 입구·겨울 장터·실내 다섯을 한 번에 짓고(배치·통행·오토타일 덩이는 구성기), 집 문 ↔ 실내를 잇는다.
  ...withDomain(SNOW_NORTH_TOOLS, "tile"),
  // 마을 종류 표(시대·세계별 60여 종 → 칩셋·시공 도구·선택지, 그림 없는 종류는 «없다») — src/ai/villageTypeCatalog.ts.
  FIND_VILLAGE_TYPE_TOOL,
  // 지은 마을에 쓰임 한 덩이(광산·포도원·신전 폐허·마법사의 탑·장터·조선 장터)를 번들 조각으로(통행 유지).
  DRESS_VILLAGE_QUARTER_TOOL,
  DRESS_JOSEON_MARKET_TOOL,
  // 맵 위 탈것(차 흐름·버스·노면전차·전철·지하철) — 길 그림에서 자동으로 또는 칸 경로로 노선을 깐다. 런타임이 실제로 움직인다.
  ...withDomain(TRANSIT_TOOLS, "map"),
  ...withDomain([ADD_STREET_WALKERS_TOOL], "event"),
  ...withDomain(STRUCTURE_KIT_TOOLS, "tile"),
  ...withDomain(TILESET_OBJECT_TOOLS, "tile"),
  ...withDomain(TILE_QUERY_TOOLS, "tile"),
  ...withDomain(MAP_TOOLS, "map"),
  ...withDomain(MAP_BACKGROUND_GENERATION_TOOLS, "map"),
  // MZ 4층 쓰기(stamp_layer_block·paint_shadow) — 각 툴이 map·tile 두 도메인을 선언한다.
  ...withDomain(LAYER_TOOLS, "map"),
  ...withDomain(RELIEF_TOOLS, "map"),
  ...withDomain(TERRAIN_TOOLS, "map"),
  ...withDomain(MAP_LOCATION_TOOLS, "map"),
  ...withDomain(ACTION_TOOLS, "map"),
  ...withDomain(MAP_GEN_TOOLS, "map").map(retireEasyRpgGenerator),
  ...withDomain(WILD_ROUTE_TOOLS, "map"),
  ...withDomain(EVENT_TOOLS, "event"),
  ...BEODEUL_DOOR_TOOLS,
  ...BEODEUL_GROUND_TOOLS,
  ...BEODEUL_LIGHT_TOOLS,
  ...BEODEUL_HAMLET_TOOLS,
  ...BEODEUL_COURTYARD_TOOLS,
  ...BEODEUL_VEGETATION_TOOLS,
  ...BEODEUL_ARCHITECTURE_TOOLS,
  ...withDomain(EVENT_COMMAND_ASSIST_TOOLS, "event"),
  ...withDomain(NPC_CAST_TOOLS, "event"),
  ...AUTHORING_HARNESS_TOOLS,
  ...withDomain(COMPANION_TOOLS, "event"),
  ...withDomain(TIME_GATE_TOOLS, "event"),
  ...withDomain(MAP_VARIANT_TOOLS, "map"),
  ...withDomain(TILE_CHANGE_EFFECT_TOOLS, "event"),
  ...withDomain(VEHICLE_TOOLS, "event"),
  ...withDomain(INVESTIGATION_TOOLS, "event"),
  ...withDomain(PUZZLE_AUTHORING_TOOLS, "event"),
  ...withDomain(MYSTERY_CASE_TOOLS, "event"),
  ...withDomain(NARRATIVE_HORROR_TEMPLATE_TOOLS, "event"),
  ...withDomain(CUTSCENE_ART_TOOLS, "event"),
  ...withDomain(WORLD_TERRAIN_TOOLS, "world"),
  ...withDomain(WORLD_VARIANT_TOOLS, "world"),
  ...withDomain(WORLD_ATLAS_TOOLS, "world"),
  ...withDomain(WORLDMAP_ICON_TOOLS, "world"),
  // 충돌 전용 지름길은 script_cutscene_staged 하나로 합친다(2026-10-02 조수 시험: 두 도구가 있으면 모델은 전용 쪽만 쓰고
  // 일반 도구를 외면했다). 실행·코드 호환은 getTool 로 유지 — 오프라인 사슬·옛 세션 재생.
  ...withDomain(IMPACT_CUTSCENE_TOOLS, "event").map((tool) => ({ ...tool, deprecated: true, supersededBy: "script_cutscene_staged" })),
  ...withDomain(CUTSCENE_STAGE_TOOLS, "event"),
  ...withDomain(STAGE_PERFORMANCE_TOOLS, "event"),
  ...withDomain(MECH_CHARSET_TOOLS, "event"),
  ...withDomain(PIXEL_ART_TOOLS, "event"),
  ...withDomain(CUTSCENE_PREVIEW_TOOLS, "event"),
  ...withDomain(DIRECTING_GUIDE_TOOLS, "event"),
  // 조수 스킬(assistant-skills/*/SKILL.md 번들) — 장면 다듬기 교훈 등. 장면·이벤트 작업에서 읽는다.
  ...withDomain(ASSISTANT_SKILL_TOOLS, "event"),
  // 대사 관리(윤문) — 대사 색인·문맥·제안/적용·화자 말투 메모. 자료집 「대사」 탭과 같은 색인을 쓴다.
  ...withDomain(DIALOGUE_TOOLS, "event"),
  ...withDomain(LIFE_FLOWER_TOOLS, "event"),
  ...withDomain(LIGHTING_TOOLS, "event"),
  ...withDomain(ENDING_TOOLS, "event"),
  ...withDomain(DB_TOOLS, "database"),
  // 도트 몬스터 공방 5종 도구 — 원형·팔레트 조회(list_monster_pixel_archetypes), 9칸 시트 정밀 검사(inspect_enemy_pixel_sheet),
  // 새 9칸 시트 생성(author_enemy_pixel_sheet), 제자리 수정·셀 패치(edit_enemy_pixel_sheet), 전용 스킬 안무 배선(set_enemy_skill_choreography).
  ...withDomain(ENEMY_PIXEL_SHEET_TOOLS, "database"),
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
  ...STORE_TOOLS,
  ...OBJECT_GEN_TOOLS,
  ...TILE_ASSEMBLY_GUIDE_TOOLS,
  ...INTERIOR_PLACEMENT_TOOLS,
  ...KIT_AREA_TOOLS,
  // 혼합 도메인 — 각 툴이 자기 domains 를 선언하고, 선언이 없으면 map 으로 떨어진다.
  ...withDomain(AUTHORING_MISC_TOOLS, "map"),
  ...withDomain(RESOURCE_TOOLS, "system"),
  ...withDomain(MONSTER_RESOURCE_TOOLS, "database"),
  ...withDomain(WORLD_GRAPH_TOOLS, "world"),
  ...DUNGEON_LINK_TOOLS,
  ...withDomain(PALETTE_PRESET_TOOLS, "tile"),
  ...withDomain(QUEST_TOOLS, "quest"),
  ...withDomain(STORY_ARC_TOOLS, "event"),
  ...withDomain(STORY_TOOLS, "quest"),
  ...withDomain(BATTLE_TOOLS, "battle"),
  ...withDomain(COMBO_TECH_TOOLS, "battle"),
  ...withDomain(TROOP_BATTLE_PAGE_TOOLS, "battle"),
  ...withDomain(REFACTOR_TOOLS, "system"),
  ...withDomain(QUALITY_EVALUATION_TOOLS, "system"),
  ...withDomain(HISTORY_TOOLS, "system"),
  ...withDomain(TIME_TOOLS, "system"),
  ...withDomain(MONSTER_SYSTEM_TOOLS, "system"),
  ...GENRE_LOCK_TOOLS,
  ...withDomain(CINEMATIC_TOOLS, "system"),
  ...withDomain(OPENING_ANIMATIC_TOOLS, "system"),
  ...withDomain(MUSIC_AUTHORING_TOOLS, 'system'),
  ...withDomain(GAME_SYSTEM_AUTHORING_TOOLS, 'system'),
  ...withDomain(MONSTER_GAME_TOOLS, 'system'),
  ...withDomain(MONSTER_TOURNAMENT_TOOLS, 'system'),
  ...withDomain(MONSTER_BATCH_TOOLS, 'database'),
  ...withDomain(NPC_PATROL_TOOLS, 'event'),
  ...withDomain(FIELD_ENEMY_TOOLS, 'event'),
  ...withDomain(FIELD_OBSTACLE_TOOLS, 'event'),
  ...withDomain(TRAINER_TOOLS, 'event'),
  ...withDomain(MONSTER_CENTER_TOOLS, 'event'),
  ...withDomain(BADGE_GATE_TOOLS, 'event'),
  ...withDomain(MONSTER_PC_TOOLS, 'event'),
  ...withDomain(OPENING_STORYBOOK_TOOLS, 'system'),
  ...withDomain(IMAGE_ASSET_TOOLS, "system"),
  ...withDomain(TITLE_ART_TOOLS, "system"),
  ...withDomain(PRESENTATION_TOOLS, "system"),
  ...withDomain(TITLE_IMPROVE_TOOLS, "system"),
  ...withDomain(AUDIO_DESCRIPTION_TOOLS, "system"),
  ...withDomain(ORIGINAL_MUSIC_TOOLS, 'system'),
  ...withDomain(EXPORT_TOOLS, "system"),
  ...withDomain(PLAY_TOOLS, "system"),
  ...withDomain(QUERY_TOOLS, "map"),
  ...MAP_EMPTINESS_TOOLS,
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
bindStreetToolLookup(getTool);
bindRegionToolLookup(getTool);
bindThemeToolLookup(getTool);
bindSpaceBlueprintToolLookup(getTool);
bindJrpgVolumeToolLookup(getTool);

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
