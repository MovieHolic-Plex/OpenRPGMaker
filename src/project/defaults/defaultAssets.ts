import { ensureSharedCastleReferences } from "./sharedCastleReferences";
import { createSharedVillageObjectsTileset, ensureSharedVillageObjectReferences, SHARED_VILLAGE_OBJECT_ID, SHARED_VILLAGE_OBJECT_TEXTURE } from "./sharedVillageObjects";
import { createCastleTileset } from "./castleTileset";
import { createForestHarmonyTileset, ensureForestHarmonyReferences, FOREST_HARMONY_ID, FOREST_HARMONY_TEXTURE } from "./forestHarmony";
import { createForestGrassJoinsTileset, extendForestGrassJoinsTileset, FOREST_GRASS_JOINS_TEXTURE } from "./forestGrassJoins";
import { createLpcWoodenFurniture16Tileset, createLpcWoodenFurnitureTileset, seedLpcWoodenFurniture16Kits, seedLpcWoodenFurnitureKits } from "./lpcWoodenFurniture";
import { createTiboInteriorTileset, extendTiboInteriorDefaults, TIBO_INTERIOR_ID, TIBO_INTERIOR_TEXTURE } from "./tiboInterior";
import { createSlates32Tileset, SLATES_32_ID } from "./slates32";
import { composeCombinedTownRetroWorldTileset } from "./combinedTownRetroWorld";
import type { AssetSet, GameMap, PassFlag, ResourceKind, ResourceProfile, SpriteDef, TilesetDef } from "../types";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { CC0_AUDIO_ASSETS } from "@/assets/cc0AudioAssets";
import { BUNDLED_EASYRPG_CHARSET_ASSETS, BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetSheetHeight, bundledChipsetTilesPerRow, bundledChipsetTileSize, bundledEasyRpgTilesetId, LPC_WOODEN_FURNITURE_16_TEXTURE_KEY, LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY, SLATES_32_TEXTURE_KEY } from "@/assets/bundled";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { AUTHORABLE_FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import { applyCombinedTownHarness, applyEasyRpgThemeMetadataPacks, ensureTilesetHarnesses, RETRO_WORLD_TEXTURE_KEY } from "@/project/tilesetHarness";
import { bundledAssetRef, CASTLE_TILESET_ID, CASTLE_TILESET_TEXTURE_KEY, COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY, COMBINED_TOWN_RETRO_WORLD_TILESET_ID, DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILES_PER_ROW, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_TEXTURE_KEY } from "./constants";
import { isSolidChipsetTile, isUpperChipsetTile, terrainTagForChipsetTile } from "./chipsetMapping";

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

export function defaultTileset(): TilesetDef {
  return makeBundledTileset(DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY);
}

function makeBundledTileset(id: string, name: string, textureKey: string): TilesetDef {
  const count = DEFAULT_TILE_COUNT;
  const passability: PassFlag[] = [];
  const priority: ("lower" | "upper")[] = [];
  const terrain: number[] = [];
  const useBundledNumberDefaults = textureKey === DEFAULT_TILESET_TEXTURE_KEY;
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
  const tilesets: Record<string, TilesetDef> = {
    [DEFAULT_TILESET_ID]: defaultTileset(),
  };
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
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
        delete project.tilesets[id];
        changed = true;
      }
      continue;
    }
    if (project.tilesets[id]) {
      if (asset.textureKey === FOREST_GRASS_JOINS_TEXTURE) changed = extendForestGrassJoinsTileset(project.tilesets[id]) || changed;
      if (id === FOREST_HARMONY_ID) changed = ensureForestHarmonyReferences(project.tilesets[id]) || changed;
      changed = ensureSharedCastleReferences(project.tilesets[id]) || changed;
      if (id === SHARED_VILLAGE_OBJECT_ID) changed = ensureSharedVillageObjectReferences(project.tilesets[id]) || changed;
      if (id === TIBO_INTERIOR_ID) changed = extendTiboInteriorDefaults(project.tilesets[id]) || changed;
      changed = seedLpcWoodenFurnitureKits(project.tilesets[id]) || changed;
      changed = seedLpcWoodenFurniture16Kits(project.tilesets[id]) || changed;
      continue;
    }
    project.tilesets[id] = bundledEasyRpgTileset(asset);
    changed = true;
  }
  changed = ensureTilesetHarnesses(project) || changed;
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

export function removeLegacySpriteReferences(project: unknown): boolean {
  let changed = false;

  const visit = (value: unknown): void => {
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
  return DEFAULT_TILESET_ID;
}

function bundledEasyRpgTileset(asset: (typeof BUNDLED_EASYRPG_CHIPSET_ASSETS)[number]): TilesetDef {
  if (asset.textureKey === CASTLE_TILESET_TEXTURE_KEY) return createCastleTileset();
  if (asset.textureKey === SHARED_VILLAGE_OBJECT_TEXTURE) return createSharedVillageObjectsTileset();
  if (asset.textureKey === FOREST_HARMONY_TEXTURE) return createForestHarmonyTileset();
  if (asset.textureKey === FOREST_GRASS_JOINS_TEXTURE) return createForestGrassJoinsTileset();
  if (asset.textureKey === TIBO_INTERIOR_TEXTURE) return createTiboInteriorTileset();
  if (asset.textureKey === SLATES_32_TEXTURE_KEY) return createSlates32Tileset();
  if (asset.textureKey === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return createLpcWoodenFurnitureTileset();
  if (asset.textureKey === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return createLpcWoodenFurniture16Tileset();
  if (asset.textureKey === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY) return createCombinedTownRetroWorldTileset();
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
 * 위 반쪽은 defaultTileset() 과 칸별로 같고, 아래 반쪽은 레트로 월드맵 정의를 +480 으로 옮긴 것이다.
 */
export function createCombinedTownRetroWorldTileset(): TilesetDef {
  const retroWorldAsset = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((asset) => asset.textureKey === RETRO_WORLD_TEXTURE_KEY);
  if (!retroWorldAsset) throw new Error(`번들 칩셋 목록에 ${RETRO_WORLD_TEXTURE_KEY} 가 없습니다.`);
  const town = defaultTileset();
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
      name: DEFAULT_TILESET_NAME,
      tileWidth: tileWidthForEasyRpgKind("chipset"),
      tileHeight: tileHeightForEasyRpgKind("chipset"),
      imageWidth: 480,
      imageHeight: 256,
      assetId: DEFAULT_TILESET_TEXTURE_KEY,
    },
    ...BUNDLED_EASYRPG_CHIPSET_ASSETS.filter((asset) => asset.textureKey !== DEFAULT_TILESET_TEXTURE_KEY).map((asset) => ({
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
  for (const asset of CC0_ICON_ASSETS) {
    if (profiles.some((profile) => profile.assetId === asset.id)) continue;
    profiles.push({
      kind: "picture",
      name: asset.name,
      imageWidth: 16,
      imageHeight: 16,
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

export function ensureBundledResourceProfiles(project: { resourceProfiles: ResourceProfile[] }): boolean {
  // 이미 저장된 프로젝트에 남아 있는 4x4 얼굴 시트 프로필도 걷어낸다 — 그대로 두면
  // 리소스 관리자에 192x192 시트가 계속 보인다(실측: 얼굴 그래픽 목록이 낱장 112장 대신 시트 5장이었다).
  // 생성 시리즈 낱장 프로필(generated-actor-hero-XX-face-NN)도 같은 규칙으로 걷어낸다 —
  // 저작 목록에서 내렸으므로, 저장본의 남은 프로필은 로드 한 번에 수렴시킨다.
  const staleFaceSheetIds = new Set<string>(LEGACY_FACESET_SHEET_IDS);
  const nextResourceProfiles = project.resourceProfiles.filter(
    (profile) => profile.assetId !== LEGACY_RM_TILESET_TEXTURE_KEY
      && !(profile.kind === "faceset" && profile.assetId !== undefined
        && (staleFaceSheetIds.has(profile.assetId) || GENERATED_FACESET_FACE_IDS.has(profile.assetId)))
  );
  let changed = nextResourceProfiles.length !== project.resourceProfiles.length;
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
