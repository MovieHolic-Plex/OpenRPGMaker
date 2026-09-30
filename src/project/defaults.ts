export {
  DEFAULT_ACTOR_ID,
  DEFAULT_ANIMATION_ID,
  DEFAULT_CLASS_ID,
  DEFAULT_ENEMY_ID,
  DEFAULT_EQUIPMENT_ID,
  DEFAULT_ITEM_ID,
  DEFAULT_SKILL_ID,
  DEFAULT_SOLID_TILES,
  DEFAULT_EASYRPG_CHARSET_ID,
  DEFAULT_SPRITE_FRAME_HEIGHT,
  DEFAULT_SPRITE_FRAME_WIDTH,
  DEFAULT_STATE_ID,
  DEFAULT_TILE_COUNT,
  DEFAULT_TILE_SIZE,
  COMBINED_TOWN_TILESET_ID,
  COMBINED_TOWN_TILESET_NAME,
  COMBINED_TOWN_TILESET_TEXTURE_KEY,
  DEFAULT_TILESET_ID,
  DEFAULT_TILESET_NAME,
  DEFAULT_TILESET_TEXTURE_KEY,
  DEFAULT_TILES_PER_ROW,
  DEFAULT_TROOP_ID,
  LEGACY_RM_TILESET_ID,
  LEGACY_RM_TILESET_NAME,
  LEGACY_RM_TILESET_TEXTURE_KEY,
  TILE,
} from "./defaults/constants";
export {
  defaultAssetSet,
  defaultResourceProfiles,
  defaultSprites,
  defaultTilesets,
  defaultTileset,
  combinedTownTileset,
  ensureBundledResourceProfiles,
  ensureBundledTilesets,
  removeLegacyRmTileset,
} from "./defaults/defaultAssets";
export {
  POKEMON_OVERWORLD_PRESET,
  pokemonPresetRole,
  pokemonPresetGroupIds,
  pokemonPresetRoleLabels,
  type PokemonChipsetPreset,
  type PokemonPresetRole,
  type PokemonPresetTool,
} from "./defaults/pokemonChipsetPreset";
export { repairInteriorTransparentPropLayers } from "./defaults/interiorTransparentPropLayerRepair";
export { createStarterHouseInteriorMap } from "./defaults/starterHouseTransfer";
export {
  defaultDatabase,
  defaultSession,
  defaultSystem,
  defaultTerms,
} from "./defaults/defaultDatabase";
export {
  createBlankMap,
  createLogCabinShowcaseMap,
  createRetroHouseShowcaseMap,
  createStarterMap,
  singleNodeTree,
} from "./defaults/defaultMaps";
export { createBlankProject, ensureSwitchVariableSlots } from "./defaults/blankProject";

// ─────────────────────────────────────────────────────────────────────────────
// 이 배럴은 **가벼운 것만** 내보낸다. 데모·쇼케이스 프로젝트/맵 빌더와 《천공의 계단》은
// 여기서 빠졌다 — 그것들이 `@/editor/content/*` → houseKit ↔ houseInteriors(에디터 인테리어
// 파이프라인)를 끌어서, 이 배럴을 import 하는 테스트 1,244개가 파일마다 335모듈·6.8MB 를
// 다시 평가하게 만들었다(실측 2026-09-17: 파일당 collect 1.40 s → 분리 후 162모듈·0.87 s).
//
// 옮겨간 곳:
//   create*Project(데모·쇼케이스)  → "@/project/defaults/defaultProject"
//   createModernNocturneProject    → "@/project/defaults/modernNocturneGame"
//   createSkyStairProject, SKY_*   → "@/editor/content/skyStairGame"
//   쇼케이스 맵 빌더·관련 타입      → "@/editor/content/townShowcaseMaps"
//   createMarketTownMap 등          → "@/project/defaults/marketTownMap"
// 새 데모 빌더를 여기에 다시 추가하지 마라. 추가하면 위 비용이 그대로 돌아온다.
// ─────────────────────────────────────────────────────────────────────────────
