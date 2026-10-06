import {ATLAS_CARTOGRAPHY_TEXTURE, createAtlasCartographyTileset, ensureAtlasCartographyReferences} from "./atlasCartography";
import { ensureSharedCastleReferences } from "./sharedCastleReferences";
import { ensureRpgPlaceReferences } from "./sharedRpgPlaceReferences";
import { ensureRpgInteriorReferences } from "./sharedRpgInteriorReferences";
import { ensureRpgDungeonReferences } from "./sharedRpgDungeonReferences";
import { ensureFieldRouteReferences } from "./sharedFieldRouteReferences";
import { ensureElfTreetopReferences } from "./sharedElfTreetopReferences";
import { CLIMATE_VILLAGE_TEXTURES, createClimateVillageTileset, ensureClimateBareTrees, ensureClimateVillageReferences } from "./climateVillages";
import { ATLAS_BIOME_TEXTURES, createAtlasBiomeTileset, ensureAtlasBiomeReferences } from "./atlasBiomes";
import { ATLAS_BIOME_WORLD_TEXTURE, createAtlasBiomeWorldTileset } from "./atlasBiomeWorld";
import { WORLDMAP_SELECTED_TEXTURE, createWorldmapSelectedTileset, ensureWorldmapSelectedTileset } from "./worldmapSelected";
import { WORLDMAP_AUTHORING_TEXTURE, WORLDMAP_AUTHORING_ID, createWorldmapAuthoringTileset, ensureWorldmapAuthoringBrushes } from './worldmapAuthoring';
import { createSharedVillageObjectsTileset, ensureSharedVillageObjectReferences, SHARED_VILLAGE_OBJECT_ID, SHARED_VILLAGE_OBJECT_TEXTURE } from "./sharedVillageObjects";
import { createCastleTileset } from "./castleTileset";
import { BEODEUL_CITY_TEXTURE, createBeodeulCityTileset, ensureBeodeulCityReferences, ensureBeodeulCityTileset } from "./beodeulCity";
import { JOSEON_BARAM_TEXTURE, createJoseonBaramTileset, ensureJoseonBaramReferences, ensureJoseonBaramTileset } from "./joseonBaram";
import { MODERN_CITY_TEXTURE, createModernCityTileset, ensureModernCityReferences, ensureModernCityTileset } from "./modernCity";
import { JP_CITY_TEXTURE, createJpCityTileset, ensureJpCityReferences, ensureJpCityTileset } from "./jpCity";
import { WIZARDING_WORLD_TEXTURE, createWizardingWorldTileset, ensureWizardingWorldReferences, ensureWizardingWorldTileset } from "./wizardingWorld";
import { createEmeraldMonsterKitTileset, ensureEmeraldMonsterKitTileset, isEmeraldMonsterKitTexture } from "./emeraldMonsterKit";
import { createMonsterKitTileset, ensureMonsterKitTileset, isMonsterKitTexture } from "./monsterKit";
import { ensureForestGroveInterior } from "./forestGrove";
import { ensureForestTallGrass } from "./forestTallGrass";
import { createForestHarmonyTileset, ensureForestHarmonyReferences, FOREST_HARMONY_ID, FOREST_HARMONY_TEXTURE } from "./forestHarmony";
import { ensureForestHarmonyVillageSlots } from "./forestHarmonyExtension";
import { ensureForestHarmonyHouseParts } from "./forestHarmonyHouseParts";
import { ensureForestHarmonyTreetopParts } from "./forestHarmonyTreetopParts";
import { ATLAS_VEHICLES_TEXTURE, createAtlasVehiclesTileset, ensureAtlasVehiclesReferences } from "./atlasVehicles";
import { ensureForestHarmonyAtlasTownParts } from "./forestHarmonyAtlasTownParts";
import { repairForestTreeShadowPassage } from "./forestHarmonyTreeShadows";
import { createForestGrassJoinsTileset, extendForestGrassJoinsTileset, FOREST_GRASS_JOINS_TEXTURE } from "./forestGrassJoins";
import { createLpcWoodenFurniture16Tileset, createLpcWoodenFurnitureTileset, seedLpcWoodenFurniture16Kits, seedLpcWoodenFurnitureKits } from "./lpcWoodenFurniture";
import { createTiboInteriorTileset, extendTiboInteriorDefaults, TIBO_INTERIOR_ID, TIBO_INTERIOR_TEXTURE } from "./tiboInterior";
import { ATLAS_BIOME_INTERIOR_TEXTURE, createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "./atlasBiomeInterior";
import { ATLAS_BIOME_DUNGEON_TEXTURE, createAtlasBiomeDungeonTileset } from "./atlasBiomeDungeon";
import { createSlates32Tileset, SLATES_32_ID } from "./slates32";
import { composeCombinedTownRetroWorldTileset } from "./combinedTownRetroWorld";
import type { AssetSet, GameMap, PassFlag, ResourceKind, ResourceProfile, SpriteDef, TilesetDef } from "../types";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { CC0_AUDIO_ASSETS } from "@/assets/cc0AudioAssets";
import { BUNDLED_EASYRPG_CHARSET_ASSETS, BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetSheetHeight, bundledChipsetTilesPerRow, bundledChipsetTileSize, bundledEasyRpgTilesetId, LPC_WOODEN_FURNITURE_16_TEXTURE_KEY, LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY, SLATES_32_TEXTURE_KEY } from "@/assets/bundled";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { AUTHORABLE_FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import previousFaceNames from "@/assets/previousFaceReferenceNames.json";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import { refreshMvPackGuide } from "@/project/rpgmakerMv/refreshGuide";
import { applyCombinedTownHarness, applyEasyRpgThemeMetadataPacks, ensureTilesetHarnesses, RETRO_WORLD_TEXTURE_KEY } from "@/project/tilesetHarness";
import { bundledAssetRef, CASTLE_TILESET_ID, COMBINED_TOWN_TILESET_ID, COMBINED_TOWN_TILESET_NAME, COMBINED_TOWN_TILESET_TEXTURE_KEY, CASTLE_TILESET_TEXTURE_KEY, COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY, COMBINED_TOWN_RETRO_WORLD_TILESET_ID, DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILES_PER_ROW, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_TEXTURE_KEY } from "./constants";
import { isSolidChipsetTile, isUpperChipsetTile, terrainTagForChipsetTile } from "./chipsetMapping";
import { EXTRA_LAYER_KEYS } from "@/project/mapLayers";

const DUNGEON_TILESET_ID = "easyrpg_chipset_dungeon";
const INTERIOR_TILESET_ID = "easyrpg_chipset_interior";

function passable(): PassFlag {
  return { up: true, down: true, left: true, right: true };
}

function solid(): PassFlag {
  return { up: false, down: false, left: false, right: false };
}

function isUpperTile(index: number): boolean {
  return isUpperChipsetTile(index);
}

function isSolidTile(index: number): boolean {
  return isSolidChipsetTile(index);
}

/** 새 프로젝트의 기본 타일셋 = 버들항(2026-09-30~). 합본 마을은 `combinedTownTileset()`. */
export function defaultTileset(): TilesetDef {
  return bundledEasyRpgTileset(bundledAssetForTextureKey(DEFAULT_TILESET_TEXTURE_KEY));
}

/** 합본 마을(EasyRPG CC0) — 예전 기본. 기존 프로젝트와 TILE.* 칸 번호가 이 타일셋을 가리킨다. */
export function combinedTownTileset(): TilesetDef {
  return makeBundledTileset(COMBINED_TOWN_TILESET_ID, COMBINED_TOWN_TILESET_NAME, COMBINED_TOWN_TILESET_TEXTURE_KEY);
}

function bundledAssetForTextureKey(textureKey: string): (typeof BUNDLED_EASYRPG_CHIPSET_ASSETS)[number] {
  const asset = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((candidate) => candidate.textureKey === textureKey);
  if (!asset) throw new Error(`번들 칩셋 목록에 ${textureKey} 가 없습니다.`);
  return asset;
}

function makeBundledTileset(id: string, name: string, textureKey: string): TilesetDef {
  const count = DEFAULT_TILE_COUNT;
  const passability: PassFlag[] = [];
  const priority: ("lower" | "upper")[] = [];
  const terrain: number[] = [];
  const useBundledNumberDefaults = textureKey === COMBINED_TOWN_TILESET_TEXTURE_KEY;
  for (let index = 0; index < count; index++) {
    passability.push(useBundledNumberDefaults && isSolidTile(index) ? solid() : passable());
    priority.push(useBundledNumberDefaults && isUpperTile(index) ? "upper" : "lower");
    terrain.push(useBundledNumberDefaults ? terrainTagForChipsetTile(index) : 0);
  }
  const tileset: TilesetDef = {
    id,
    name,
    image: bundledAssetRef(textureKey),
    kind: "rpg2k",
    tileSize: DEFAULT_TILE_SIZE,
    tilesPerRow: DEFAULT_TILES_PER_ROW,
    count,
    passability,
    priority,
    terrain,
    tileMeta: Array.from({ length: count }, () => ({
      label: "",
      description: "",
    })),
    tileGroups: [],
  };
  applyCombinedTownHarness(tileset);
  return tileset;
}

export function defaultTilesets(): Record<string, TilesetDef> {
  // 기본(버들항)이 맨 앞이고 합본 마을은 번들 목록에서 이어서 들어간다 — 기존 프로젝트가 계속 쓰는 타일셋이다.
  const tilesets: Record<string, TilesetDef> = {
    [DEFAULT_TILESET_ID]: defaultTileset(),
  };
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    // 잔디 사선 10칸은 숲 이식용 그림이다. 맵이 이 타일셋을 직접 쓰지 않으면 목록에 올리지 않는다.
    if (asset.textureKey === FOREST_GRASS_JOINS_TEXTURE) continue;
    const tileset = bundledEasyRpgTileset(asset);
    if (tileset.id === DEFAULT_TILESET_ID) continue;
    tilesets[tileset.id] = tileset;
  }
  return tilesets;
}

function villageObjectTilesetUsedByMaps(project: { maps?: Readonly<Record<string, { tilesetId?: string }>> }): boolean {
  const maps = project.maps;
  // 맵 목록이 없으면 사용 중인지 알 수 없다. 그 경우 시트를 지우지 않는다.
  if (!maps) return true;
  return Object.values(maps).some((map) => map?.tilesetId === SHARED_VILLAGE_OBJECT_ID);
}

function grassJoinsTilesetUsedByMaps(project: { maps?: Readonly<Record<string, { tilesetId?: string }>> }): boolean {
  const maps = project.maps;
  if (!maps) return true;
  return Object.values(maps).some((map) => map?.tilesetId === "forest_harmony_grass_joins");
}

export function ensureBundledTilesets(project: { tilesets: Record<string, TilesetDef>; maps?: Readonly<Record<string, { tilesetId?: string }>> }): boolean {
  let changed = false;
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    // 존재 확인이 **먼저**다. 생성자를 먼저 부르면 타일셋이 이미 있는 흔한 경우에도
    // 3~5MB 짜리 JSON 사본을 만들어 그대로 버린다 — 실측 2026-09-22: 프로젝트 로드마다
    // 164ms 였고 그 대부분이 버려지는 사본이었다(수정 후 26ms).
    const id = bundledTilesetIdForAsset(asset);
    // 선별 소품 19종은 숲 시트 아래 행으로 붙인다. 이 시트를 타일셋으로 쓰는 맵이 없을 때만
    // 목록에서 빼며, 맵이 있으면 칸 번호가 깨지지 않게 시트를 남긴다.
    if (id === SHARED_VILLAGE_OBJECT_ID && !villageObjectTilesetUsedByMaps(project)) {
      if (project.tilesets[id]) {
      if (asset.textureKey === ATLAS_CARTOGRAPHY_TEXTURE) changed = ensureAtlasCartographyReferences(project.tilesets[id]) || changed;
        delete project.tilesets[id];
        changed = true;
      }
      continue;
    }
    // 잔디 사선 경계는 숲 아틀라스를 덮지 않으려고 둔 10칸 그림이다. 맵이 그 타일셋 id를
    // 쓰지 않으면 목록에서 빼도 이식(sourceChipset)은 텍스처 키로 계속 읽는다.
    if (asset.textureKey === FOREST_GRASS_JOINS_TEXTURE && !grassJoinsTilesetUsedByMaps(project)) {
      if (project.tilesets[id]) {
        delete project.tilesets[id];
        changed = true;
      }
      continue;
    }
    if (project.tilesets[id]) {
      if (asset.textureKey === WORLDMAP_SELECTED_TEXTURE) changed = ensureWorldmapSelectedTileset(project.tilesets[id]) || changed;
      if (asset.textureKey === FOREST_GRASS_JOINS_TEXTURE) changed = extendForestGrassJoinsTileset(project.tilesets[id]) || changed;
      if (id === FOREST_HARMONY_ID) changed = ensureForestHarmonyReferences(project.tilesets[id]) || changed;
      // Older saves stop at 2550/2610: append the shared tail slots (only past the end or into blank slots).
      if (id === FOREST_HARMONY_ID) changed = ensureForestHarmonyVillageSlots(project.tilesets[id]) || changed;
      // House parts (chimneys, dormers, awnings, gable finials) from 3060 — gable house forms use them when present.
      if (id === FOREST_HARMONY_ID) changed = ensureForestHarmonyHouseParts(project.tilesets[id]) || changed;
      // Elf treetop village parts from 3131 (after the house parts) — decks, rope bridges, trunk houses.
      if (id === FOREST_HARMONY_ID) changed = ensureForestHarmonyTreetopParts(project.tilesets[id]) || changed;
      // Atlas town parts from 3311 (after the treetop parts) — ship, fountain, stalls, fire, scaffolds, festival lanterns.
      if (id === FOREST_HARMONY_ID) changed = ensureForestHarmonyAtlasTownParts(project.tilesets[id]) || changed;
      // 2026-09-27 판 나무 그림자 칸은 ○ 라서 1층 밑동의 × 를 덮었다 — 이미 붙은 칸을 ★ 로 고친다.
      if (id === FOREST_HARMONY_ID) changed = repairForestTreeShadowPassage(project.tilesets[id]) || changed;
      changed = ensureSharedCastleReferences(project.tilesets[id]) || changed;
      changed = ensureRpgPlaceReferences(project.tilesets[id]) || changed;
      changed = ensureRpgInteriorReferences(project.tilesets[id]) || changed;
      changed = ensureRpgDungeonReferences(project.tilesets[id]) || changed;
      changed = ensureClimateVillageReferences(project.tilesets[id]) || changed;
      // Leafless trees appended to the snow, volcano and desert sheets (2880~): older saves grow to the new count.
      changed = ensureClimateBareTrees(project.tilesets[id]) || changed;
      // Groves made before the leaf interior gain its depth variants (forest_harmony and the climate sheets).
      changed = ensureForestGroveInterior(project.tilesets[id]) || changed;
      // Tall grass E/F/G: F and G groups, the fixed E grammar (forest_harmony and the climate sheets).
      changed = ensureForestTallGrass(project.tilesets[id]) || changed;
      changed = ensureFieldRouteReferences(project.tilesets[id]) || changed;
      changed = ensureElfTreetopReferences(project.tilesets[id]) || changed;
      // Atlas biome sheets (tiledata/atlas-biomes): the shipped biome guidance.
      changed = ensureAtlasBiomeReferences(project.tilesets[id]) || changed;
      if (id === SHARED_VILLAGE_OBJECT_ID) changed = ensureSharedVillageObjectReferences(project.tilesets[id]) || changed;
      // 버들항 v6 (tiledata/beodeul-city): the shipped city guidance for older copies.
      if (asset.textureKey === BEODEUL_CITY_TEXTURE) {
        changed = ensureBeodeulCityTileset(project.tilesets[id]) || changed;
        changed = ensureBeodeulCityReferences(project.tilesets[id]) || changed;
      }
      // 조선 · 바람의나라풍 (tiledata/joseon-village): 번들 칸 표와 참고문서를 옛 사본에도 맞춘다.
      if (asset.textureKey === JOSEON_BARAM_TEXTURE) {
        changed = ensureJoseonBaramTileset(project.tilesets[id]) || changed;
        changed = ensureJoseonBaramReferences(project.tilesets[id]) || changed;
      }
      // 현대 도시 · 도쿄풍 (modern-chipset 하네스 굽기): 번들 칸 표와 참고문서를 옛 사본에도 맞춘다(칸 번호는 덧붙이기 전용).
      if (asset.textureKey === MODERN_CITY_TEXTURE) {
        changed = ensureModernCityTileset(project.tilesets[id]) || changed;
        changed = ensureModernCityReferences(project.tilesets[id]) || changed;
      }
      // 일본 도시 (jp_city 굽기): modern_city 와 별개 번들. 번들 칸 표·`jp-` 부품/오토타일·참고문서를 옛 사본에도 맞춘다(칸 번호는 덧붙이기 전용).
      if (asset.textureKey === JP_CITY_TEXTURE) {
        changed = ensureJpCityTileset(project.tilesets[id]) || changed;
        changed = ensureJpCityReferences(project.tilesets[id]) || changed;
      }
      // 마법 학교 · 해리포터풍 (wizarding_world 굽기): 번들 칸 표·`wz-` 부품/오토타일·참고문서를 옛 사본에도 맞춘다(칸 번호는 덧붙이기 전용).
      if (asset.textureKey === WIZARDING_WORLD_TEXTURE) {
        changed = ensureWizardingWorldTileset(project.tilesets[id]) || changed;
        changed = ensureWizardingWorldReferences(project.tilesets[id]) || changed;
      }
      if (asset.textureKey === ATLAS_VEHICLES_TEXTURE) changed = ensureAtlasVehiclesReferences(project.tilesets[id]) || changed;
      // 몬스터 수집 손 도트 시트(지역별): 다시 구운 시트면 칸 표를 번들 것으로, 아니면 빠진 번들 킷만 더한다.
      if (isMonsterKitTexture(asset.textureKey)) changed = ensureMonsterKitTileset(project.tilesets[id]) || changed;
      if (isEmeraldMonsterKitTexture(asset.textureKey)) changed = ensureEmeraldMonsterKitTileset(project.tilesets[id]) || changed;
      if (id === TIBO_INTERIOR_ID) changed = extendTiboInteriorDefaults(project.tilesets[id]) || changed;
      // 생성 칩셋 공용 실내(손 도트 v5): 옛 정의(Tibo 번호 기반)는 새 정의로 통째로 바꾼다. 옛 칩셋을 쓰던 맵은 그대로 두고 경고만.
      if (asset.textureKey === ATLAS_BIOME_INTERIOR_TEXTURE) changed = ensureAtlasBiomeInteriorCurrent(project, id) || changed;
      changed = seedLpcWoodenFurnitureKits(project.tilesets[id]) || changed;
      changed = seedLpcWoodenFurniture16Kits(project.tilesets[id]) || changed;
      continue;
    }
    project.tilesets[id] = bundledEasyRpgTileset(asset);
    changed = true;
  }
  changed = ensureTilesetHarnesses(project) || changed;
  for (const tileset of Object.values(project.tilesets)) if (tileset.mvPack) changed = refreshMvPackGuide(tileset) || changed;
  changed = ensureWorldmapAuthoringBrushes(project) || changed;
  return changed;
}

export function removeLegacyRmTileset(project: { maps: Record<string, GameMap>; tilesets: Record<string, TilesetDef> }): boolean {
  let changed = false;
  for (const map of Object.values(project.maps)) {
    if (map.tilesetId !== LEGACY_RM_TILESET_ID) continue;
    map.tilesetId = legacyRmTilesetReplacementId(map);
    changed = true;
  }
  if (project.tilesets[LEGACY_RM_TILESET_ID]) {
    delete project.tilesets[LEGACY_RM_TILESET_ID];
    changed = true;
  }
  return changed;
}

/** removeLegacySpriteReferences 가 이미 깨끗하다고 확인한 공유 항목(타일셋·업로드 자산 객체). */
const cleanSharedEntries = new WeakSet<object>();

export function removeLegacySpriteReferences(project: unknown): boolean {
  let changed = false;
  // 호스트가 저장마다 부른다. 얼린 가지는 호스트가 저장 행에서 읽은 타일셋 본문이다 — 저장될 때 이미 이 복구를
  // 지났고(같은 규칙으로 수렴), 바꿀 수도 없다. 실측(2026-09-28, 팀 호스트 저장 한 번): 문서 순회 1.2s 중 대부분이 여기였다.
  const seen = new WeakSet<object>();

  // 타일셋·업로드 자산 항목은 스토어·스냅샷·draft 가 객체째 공유하고 제자리에서 고치지 않는다(projectClone 계약).
  // 한 번 깨끗하다고 본 항목은 다시 훑지 않는다. 왜(2026-09-28 실측, 새 프로젝트 149MB): 편집·적용마다 이 청소가
  // 타일셋 347개와 업로드 자산 66MB 를 전부 훑어 240ms 였다.
  const visitSharedDictionary = (dictionary: Record<string, unknown>): void => {
    for (const key of Object.keys(dictionary)) {
      if (isLegacySpriteReference(key)) {
        delete dictionary[key];
        changed = true;
        continue;
      }
      const item = dictionary[key];
      if (!isRecord(item)) {
        visit(item);
        continue;
      }
      if (cleanSharedEntries.has(item)) continue;
      const changedBefore = changed;
      changed = false;
      visit(item);
      if (!changed) cleanSharedEntries.add(item);
      changed = changed || changedBefore;
    }
  };

  const visit = (value: unknown): void => {
    if (value !== null && typeof value === "object") {
      if (Object.isFrozen(value) || seen.has(value)) return;
      seen.add(value);
    }
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (typeof item === "string" && isLegacySpriteReference(item)) {
          value[index] = DEFAULT_EASYRPG_CHARSET_ID;
          changed = true;
          continue;
        }
        visit(item);
      }
      return;
    }

    if (!isRecord(value)) return;

    if (Array.isArray(value.resourceProfiles)) {
      const nextProfiles = value.resourceProfiles.filter((profile) => (
        !isRecord(profile) || !isLegacySpriteReference(profile.assetId)
      ));
      if (nextProfiles.length !== value.resourceProfiles.length) {
        value.resourceProfiles = nextProfiles;
        changed = true;
      }
    }

    for (const key of Object.keys(value)) {
      // Tile grids are number arrays. Walking every cell looking for a sprite id
      // made heavy-project load scan millions of numbers for a match that cannot occur.
      if (key === "lowerTiles" || key === "upperTiles" || key === "lowerTileStacks" || key === "upperTileStacks") continue;
      if ((EXTRA_LAYER_KEYS as readonly string[]).includes(key)) continue;
      const item = value[key];
      if (isLegacySpriteReference(key)) {
        delete value[key];
        changed = true;
        continue;
      }
      if (typeof item === "string" && isLegacySpriteReference(item)) {
        value[key] = DEFAULT_EASYRPG_CHARSET_ID;
        changed = true;
        continue;
      }
      if ((key === "tilesets" || key === "uploaded") && isRecord(item)) {
        visitSharedDictionary(item);
        continue;
      }
      visit(item);
    }
  };

  visit(project);
  return changed;
}

function isLegacySpriteReference(value: unknown): value is string {
  return typeof value === "string" && LEGACY_SPRITE_REFERENCES.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const LEGACY_SPRITE_REFERENCES = new Set([
  ["npc", "villager"].join("_"),
  ["tex", "npc", "villager"].join("_"),
  ["DEFAULT", "SPRITE", "NPC"].join("_"),
  ["TEX", "NPC"].join("_"),
]);

function legacyRmTilesetReplacementId(map: Pick<GameMap, "id" | "name">): string {
  const label = `${map.id} ${map.name}`.toLowerCase();
  if (label.includes("dungeon") || label.includes("던전")) return DUNGEON_TILESET_ID;
  if (label.includes("interior") || label.includes("실내")) return INTERIOR_TILESET_ID;
  return COMBINED_TOWN_TILESET_ID;
}

function bundledEasyRpgTileset(asset: (typeof BUNDLED_EASYRPG_CHIPSET_ASSETS)[number]): TilesetDef {
  if (asset.textureKey === WORLDMAP_AUTHORING_TEXTURE) return createWorldmapAuthoringTileset();
  const tileset = bundledEasyRpgTilesetBase(asset);
  ensureRpgPlaceReferences(tileset);
  ensureRpgInteriorReferences(tileset);
  ensureRpgDungeonReferences(tileset);
  ensureFieldRouteReferences(tileset);
  ensureElfTreetopReferences(tileset);
  return tileset;
}

function bundledEasyRpgTilesetBase(asset: (typeof BUNDLED_EASYRPG_CHIPSET_ASSETS)[number]): TilesetDef {
  if (asset.textureKey === CASTLE_TILESET_TEXTURE_KEY) return createCastleTileset();
  if (asset.textureKey === SHARED_VILLAGE_OBJECT_TEXTURE) return createSharedVillageObjectsTileset();
  if (asset.textureKey === BEODEUL_CITY_TEXTURE) return createBeodeulCityTileset();
  if (asset.textureKey === JOSEON_BARAM_TEXTURE) return createJoseonBaramTileset();
  if (asset.textureKey === MODERN_CITY_TEXTURE) return createModernCityTileset();
  if (asset.textureKey === JP_CITY_TEXTURE) return createJpCityTileset();
  if (asset.textureKey === WIZARDING_WORLD_TEXTURE) return createWizardingWorldTileset();
  if (isMonsterKitTexture(asset.textureKey)) return createMonsterKitTileset(asset.textureKey);
  if (isEmeraldMonsterKitTexture(asset.textureKey)) return createEmeraldMonsterKitTileset(asset.textureKey);
  if (asset.textureKey === ATLAS_VEHICLES_TEXTURE) return createAtlasVehiclesTileset();
  // New projects start with the shared tail slots the place documents use (2550~2759).
  if (asset.textureKey === FOREST_HARMONY_TEXTURE) {
    const tileset = createForestHarmonyTileset();
    ensureForestHarmonyVillageSlots(tileset);
    ensureForestHarmonyHouseParts(tileset);
    ensureForestHarmonyTreetopParts(tileset);
    ensureForestHarmonyAtlasTownParts(tileset);
    return tileset;
  }
  if (asset.textureKey === FOREST_GRASS_JOINS_TEXTURE) return createForestGrassJoinsTileset();
  if (asset.textureKey === TIBO_INTERIOR_TEXTURE) return createTiboInteriorTileset();
  if (asset.textureKey === ATLAS_BIOME_INTERIOR_TEXTURE) return createAtlasBiomeInteriorTileset();
  if (asset.textureKey === ATLAS_BIOME_DUNGEON_TEXTURE) return createAtlasBiomeDungeonTileset();
  if (asset.textureKey === ATLAS_CARTOGRAPHY_TEXTURE) return createAtlasCartographyTileset();
  if (asset.textureKey === SLATES_32_TEXTURE_KEY) return createSlates32Tileset();
  if (asset.textureKey === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return createLpcWoodenFurnitureTileset();
  if (asset.textureKey === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return createLpcWoodenFurniture16Tileset();
  if (asset.textureKey === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY) return createCombinedTownRetroWorldTileset();
  const climate = CLIMATE_VILLAGE_TEXTURES[asset.textureKey];
  if (climate) return createClimateVillageTileset(climate);
  const biome = ATLAS_BIOME_TEXTURES[asset.textureKey];
  if (biome) return createAtlasBiomeTileset(biome);
  if (asset.textureKey === ATLAS_BIOME_WORLD_TEXTURE) {
    const world = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((a) => a.textureKey === "tex_easyrpg_chipset_world");
    if (!world) throw new Error("번들 칩셋 목록에 tex_easyrpg_chipset_world 가 없습니다.");
    return createAtlasBiomeWorldTileset(bundledStandardChipsetTileset(world));
  }
  if (asset.textureKey === WORLDMAP_SELECTED_TEXTURE) {
    const world = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((a) => a.textureKey === "tex_easyrpg_chipset_world");
    if (!world) throw new Error("번들 월드 지형이 없습니다.");
    const base = bundledStandardChipsetTileset(world);
    ensureTilesetHarnesses({ tilesets: { [base.id]: base } });
    return createWorldmapSelectedTileset(base);
  }
  return bundledStandardChipsetTileset(asset);
}

/**
 * 타일셋 id 만 계산한다 — 생성자를 부르지 않는다.
 *
 * 왜 별도 함수인가: 특수 생성자들은 3~5MB 짜리 JSON 을 통째로 복제한다
 * (`createForestHarmonyTileset` 37ms, `createCastleTileset` 4ms — 실측 2026-09-22).
 * `ensureBundledTilesets` 는 "이미 있으면 참고문서만 보강" 이 정상 경로인데, 생성자를 먼저
 * 부르면 그 사본을 만들어 그대로 버린다. id 는 텍스처 키에서 바로 나오므로 복제가 필요 없다.
 *
 * 특수 타일셋의 id 는 각 모듈의 상수와 같아야 한다 — 다르면 존재 확인이 빗나가 타일셋이
 * 중복 생성된다. 그 계약은 `test/bundledTilesetIdParity.test.ts` 가 생성자 결과와 대조한다.
 */
function bundledTilesetIdForAsset(asset: (typeof BUNDLED_EASYRPG_CHIPSET_ASSETS)[number]): string {
  if (asset.textureKey === WORLDMAP_AUTHORING_TEXTURE) return WORLDMAP_AUTHORING_ID;
  if (asset.textureKey === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILESET_ID;
  if (asset.textureKey === SHARED_VILLAGE_OBJECT_TEXTURE) return SHARED_VILLAGE_OBJECT_ID;
  if (asset.textureKey === FOREST_HARMONY_TEXTURE) return FOREST_HARMONY_ID;
  if (asset.textureKey === TIBO_INTERIOR_TEXTURE) return TIBO_INTERIOR_ID;
  if (asset.textureKey === SLATES_32_TEXTURE_KEY) return SLATES_32_ID;
  if (asset.textureKey === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY) return COMBINED_TOWN_RETRO_WORLD_TILESET_ID;
  return bundledEasyRpgTilesetId(asset.textureKey);
}

/** 계약 테스트 전용 — id 계산이 생성자 결과와 같은지 대조한다. */
export const bundledTilesetIdForAssetForTest = bundledTilesetIdForAsset;

/**
 * 「합본 마을 + 레트로 월드맵」 — 두 원본 정의(하네스·시맨틱 적용 후)를 이어 붙인다.
 * 위 반쪽은 combinedTownTileset() 과 칸별로 같고, 아래 반쪽은 레트로 월드맵 정의를 +480 으로 옮긴 것이다.
 */
export function createCombinedTownRetroWorldTileset(): TilesetDef {
  const retroWorldAsset = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((asset) => asset.textureKey === RETRO_WORLD_TEXTURE_KEY);
  if (!retroWorldAsset) throw new Error(`번들 칩셋 목록에 ${RETRO_WORLD_TEXTURE_KEY} 가 없습니다.`);
  const town = combinedTownTileset();
  const retroWorld = bundledStandardChipsetTileset(retroWorldAsset);
  // 원본 둘을 **로드 후 상태**로 맞춘 뒤 잇는다. 생성 직후의 레트로 월드맵은 전부 하위 레이어인데,
  // 프로젝트를 열 때 하네스가 투명 칩을 상위로 올린다(applyCustomChipsetMinimalHarness). 그 규칙은
  // 480 미만 번호에만 걸리므로 혼합 칩셋의 아래 반쪽은 여기서 미리 같은 상태를 받아야 단독
  // 레트로 월드맵과 칸별로 같아진다.
  ensureTilesetHarnesses({ tilesets: { [town.id]: town, [retroWorld.id]: retroWorld } });
  return composeCombinedTownRetroWorldTileset(town, retroWorld);
}

function bundledStandardChipsetTileset(asset: (typeof BUNDLED_EASYRPG_CHIPSET_ASSETS)[number]): TilesetDef {
  const tileset = makeBundledTileset(bundledEasyRpgTilesetId(asset.textureKey), asset.name, asset.textureKey);
  tileset.tileMeta = Array.from({ length: tileset.count }, () => ({
    label: "",
    description: "",
    source: "unknown",
  }));
  tileset.tileGroups = [];
  applyEasyRpgThemeMetadataPacks(tileset);
  return tileset;
}

export function defaultSprites(): Record<string, SpriteDef> {
  return {};
}

export function defaultAssetSet(): AssetSet {
  return {
    sprites: defaultSprites(),
    uploaded: {},
  };
}

export function defaultResourceProfiles(): ResourceProfile[] {
  const profiles: ResourceProfile[] = [
    {
      kind: "chipset",
      name: COMBINED_TOWN_TILESET_NAME,
      tileWidth: tileWidthForEasyRpgKind("chipset"),
      tileHeight: tileHeightForEasyRpgKind("chipset"),
      imageWidth: 480,
      imageHeight: 256,
      assetId: COMBINED_TOWN_TILESET_TEXTURE_KEY,
    },
    ...BUNDLED_EASYRPG_CHIPSET_ASSETS.filter((asset) => asset.textureKey !== COMBINED_TOWN_TILESET_TEXTURE_KEY).map((asset) => ({
      kind: "chipset" as const,
      name: asset.name,
      // 16px 규격이 아닌 시트(Slates 32px)는 자기 기하를 그대로 보고한다 — 16 으로 적으면
      // 자료 보관함 미리보기가 시트를 2배로 잘못 잘라 보여준다.
      tileWidth: bundledChipsetTileSize(asset.textureKey),
      tileHeight: bundledChipsetTileSize(asset.textureKey),
      imageWidth: bundledChipsetTilesPerRow(asset.textureKey) * bundledChipsetTileSize(asset.textureKey),
      // 확장 시트(Tibo 1056·합본 마을+레트로 월드맵+숲 나무 608)는 256 이 아니다 — 칸 수에서 유도한다.
      imageHeight: bundledChipsetSheetHeight(asset.textureKey),
      assetId: asset.textureKey,
    })),
    ...BUNDLED_EASYRPG_CHARSET_ASSETS.map((asset) => ({
      kind: "charset" as const,
      name: asset.name,
      tileWidth: tileWidthForEasyRpgKind("charset"),
      tileHeight: tileHeightForEasyRpgKind("charset"),
      imageWidth: 288,
      imageHeight: 256,
      assetId: asset.textureKey,
    })),
  ];
  // 기본 타일셋(버들항)의 자료 프로필이 칩셋 목록 맨 앞에 오게 한다.
  const defaultProfileIndex = profiles.findIndex((profile) => profile.assetId === DEFAULT_TILESET_TEXTURE_KEY);
  if (defaultProfileIndex > 0) profiles.unshift(...profiles.splice(defaultProfileIndex, 1));
  for (const asset of CC0_ICON_ASSETS) {
    if (profiles.some((profile) => profile.assetId === asset.id)) continue;
    profiles.push({
      kind: "picture",
      name: asset.name,
      imageWidth: asset.imageWidth,
      imageHeight: asset.imageHeight,
      assetId: asset.id,
    });
  }
  for (const asset of CC0_AUDIO_ASSETS) {
    if (profiles.some((profile) => profile.assetId === asset.id)) continue;
    profiles.push({
      kind: asset.kind,
      name: asset.name,
      assetId: asset.id,
    });
  }
  // 얼굴은 낱장 파일이 리소스다. 4x4 시트(EASYRPG_RTP_ASSETS 의 faceset 행)는 v3 로드 해석용으로만
  // 남아 있는 레거시라 저자에게 보이는 리소스 목록에는 등록하지 않는다. 생성 시리즈(hero-XX-face)
  // 낱장도 같은 이유로 뺀다 — 저장본 호환용 등록만 FACESET_FACE_ASSETS 에 남긴다.
  for (const face of AUTHORABLE_FACESET_FACE_ASSETS) {
    if (profiles.some((profile) => profile.assetId === face.id)) continue;
    profiles.push({
      kind: "faceset",
      name: face.name,
      imageWidth: FACE_IMAGE_SIZE,
      imageHeight: FACE_IMAGE_SIZE,
      assetId: face.id,
    });
  }
  for (const asset of EASYRPG_RTP_ASSETS) {
    const kind = resourceKindForEasyRpgCategory(asset.category);
    if (kind === "faceset") continue;
    if (profiles.some((profile) => profile.assetId === asset.id)) continue;
    profiles.push({
      kind,
      name: asset.name,
      tileWidth: tileWidthForEasyRpgKind(kind),
      tileHeight: tileHeightForEasyRpgKind(kind),
      imageWidth: imageWidthForEasyRpgKind(kind, asset.fileName),
      imageHeight: imageHeightForEasyRpgKind(kind, asset.fileName),
      assetId: asset.id,
    });
  }
  return profiles;
}

export function ensureBundledResourceProfiles(project: { resourceProfiles: ResourceProfile[]; assets?: { uploaded?: Record<string, unknown> } }): boolean {
  // 이미 저장된 프로젝트에 남아 있는 4x4 얼굴 시트 프로필도 걷어낸다 — 그대로 두면
  // 리소스 관리자에 192x192 시트가 계속 보인다(실측: 얼굴 그래픽 목록이 낱장 112장 대신 시트 5장이었다).
  // 생성 시리즈 낱장 프로필(generated-actor-hero-XX-face-NN)도 같은 규칙으로 걷어낸다 —
  // 저작 목록에서 내렸으므로, 저장본의 남은 프로필은 로드 한 번에 수렴시킨다.
  const staleFaceSheetIds = new Set<string>(LEGACY_FACESET_SHEET_IDS);
  const nextResourceProfiles = project.resourceProfiles.filter(
    (profile) => profile.assetId !== LEGACY_RM_TILESET_TEXTURE_KEY
      && !(profile.kind === "faceset" && profile.assetId !== undefined
        && !project.assets?.uploaded?.[profile.assetId]
        && (staleFaceSheetIds.has(profile.assetId) || GENERATED_FACESET_FACE_IDS.has(profile.assetId)))
  );
  let changed = nextResourceProfiles.length !== project.resourceProfiles.length;
  const itemIconAssets = new Map(CC0_ICON_ASSETS.map((asset) => [asset.id, asset]));
  const faces = new Map(AUTHORABLE_FACESET_FACE_ASSETS.map(face => [face.id, face]));
  for (const profile of nextResourceProfiles) {
    const previousName = profile.assetId ? (previousFaceNames as Readonly<Record<string, string>>)[profile.assetId] : undefined;
    const face = profile.assetId ? faces.get(profile.assetId) : undefined;
    if (profile.kind === "faceset" && face && previousName === profile.name && !project.assets?.uploaded?.[face.id]) {
      profile.name = face.name;
      changed = true;
    }
    const asset = profile.assetId ? itemIconAssets.get(profile.assetId) : undefined;
    if (!asset || profile.kind !== "picture") continue;
    if (profile.imageWidth === asset.imageWidth && profile.imageHeight === asset.imageHeight) continue;
    profile.imageWidth = asset.imageWidth;
    profile.imageHeight = asset.imageHeight;
    changed = true;
  }
  project.resourceProfiles = nextResourceProfiles;
  const existingAssetIds = new Set(project.resourceProfiles.map((profile) => profile.assetId).filter((assetId) => assetId !== undefined));
  for (const profile of defaultResourceProfiles()) {
    if (profile.assetId === undefined) continue;
    if (existingAssetIds.has(profile.assetId)) continue;
    project.resourceProfiles.push({ ...profile });
    existingAssetIds.add(profile.assetId);
    changed = true;
  }
  return changed;
}

function resourceKindForEasyRpgCategory(category: (typeof EASYRPG_RTP_ASSETS)[number]["category"]): ResourceKind {
  return category;
}

function tileWidthForEasyRpgKind(kind: ResourceKind): number | undefined {
  return getResourceProfileSpec(kind).tileWidth;
}

function tileHeightForEasyRpgKind(kind: ResourceKind): number | undefined {
  return getResourceProfileSpec(kind).tileHeight;
}

function imageWidthForEasyRpgKind(kind: ResourceKind, fileName: string): number | undefined {
  const slicing = getResourceProfileSpec(kind).slicing;
  if (slicing.kind === "grid" && slicing.sheetWidth !== undefined) return slicing.sheetWidth;
  if (kind === "title" || kind === "gameOver") return 320;
  if (kind === "system") return 160;
  if (kind === "system2") return 80;
  if (kind === "monster") return 64;
  if (kind === "picture") return 100;
  if (kind === "backdrop") return fileName.startsWith("Planet") ? 320 : 640;
  return undefined;
}

function imageHeightForEasyRpgKind(kind: ResourceKind, fileName: string): number | undefined {
  const slicing = getResourceProfileSpec(kind).slicing;
  if (slicing.kind === "grid" && slicing.sheetHeight !== undefined) return slicing.sheetHeight;
  if (kind === "title" || kind === "gameOver") return 240;
  if (kind === "system") return 80;
  if (kind === "system2") return 96;
  if (kind === "monster") return 64;
  if (kind === "picture") return 100;
  if (kind === "backdrop") return fileName.startsWith("Planet") ? 240 : 480;
  return undefined;
}
