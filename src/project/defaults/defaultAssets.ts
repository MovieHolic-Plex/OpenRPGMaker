import { createCastleTileset } from "./castleTileset";
import { createForestHarmonyTileset, FOREST_HARMONY_TEXTURE } from "./forestHarmony";
import { createTiboInteriorTileset, extendTiboInteriorDefaults, TIBO_INTERIOR_ID, TIBO_INTERIOR_TEXTURE } from "./tiboInterior";
import { composeCombinedTownRetroWorldTileset } from "./combinedTownRetroWorld";
import type { AssetSet, GameMap, PassFlag, ResourceKind, ResourceProfile, SpriteDef, TilesetDef } from "../types";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { CC0_AUDIO_ASSETS } from "@/assets/cc0AudioAssets";
import { BUNDLED_EASYRPG_CHARSET_ASSETS, BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetSheetHeight, bundledChipsetTileSize, bundledChipsetTilesPerRow, bundledEasyRpgTilesetId } from "@/assets/bundled";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { AUTHORABLE_FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import { applyCombinedTownHarness, applyEasyRpgThemeMetadataPacks, ensureTilesetHarnesses, RETRO_WORLD_TEXTURE_KEY } from "@/project/tilesetHarness";
import { bundledAssetRef, CASTLE_TILESET_TEXTURE_KEY, COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY, DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILES_PER_ROW, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_TEXTURE_KEY } from "./constants";
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

export function ensureBundledTilesets(project: { tilesets: Record<string, TilesetDef> }): boolean {
  let changed = false;
  for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
    const tileset = bundledEasyRpgTileset(asset);
    if (project.tilesets[tileset.id]) {
      if (tileset.id === TIBO_INTERIOR_ID) changed = extendTiboInteriorDefaults(project.tilesets[tileset.id]) || changed;
      continue;
    }
    project.tilesets[tileset.id] = tileset;
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
  if (asset.textureKey === FOREST_HARMONY_TEXTURE) return createForestHarmonyTileset();
  if (asset.textureKey === TIBO_INTERIOR_TEXTURE) return createTiboInteriorTileset();
  if (asset.textureKey === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY) return createCombinedTownRetroWorldTileset();
  return bundledStandardChipsetTileset(asset);
}

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
