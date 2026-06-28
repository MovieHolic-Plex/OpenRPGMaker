import type { AssetSet, PassFlag, ResourceKind, ResourceProfile, SpriteDef, TilesetDef } from "../types";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { BUNDLED_EASYRPG_CHARSET_ASSETS, BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledEasyRpgTilesetId } from "@/assets/bundled";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { applyCombinedTownHarness, applyEasyRpgThemeMetadataPacks, ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { bundledAssetRef, DEFAULT_SPRITE_FRAME_HEIGHT, DEFAULT_SPRITE_FRAME_WIDTH, DEFAULT_SPRITE_NPC, DEFAULT_TILE_COUNT, DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILES_PER_ROW, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_NAME, LEGACY_RM_TILESET_TEXTURE_KEY } from "./constants";
import { isSolidChipsetTile, isUpperChipsetTile, terrainTagForChipsetTile } from "./chipsetMapping";
import { SMALL_HOUSE_01_TERRAIN_TEMPLATE } from "./smallHouse01TerrainTemplate";

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

function legacyRmTileset(): TilesetDef {
  return makeBundledTileset(LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_NAME, LEGACY_RM_TILESET_TEXTURE_KEY);
}

function makeBundledTileset(id: string, name: string, textureKey: string): TilesetDef {
  const count = DEFAULT_TILE_COUNT;
  const passability: PassFlag[] = [];
  const priority: ("lower" | "upper")[] = [];
  const terrain: number[] = [];
  const useBundledNumberDefaults = textureKey === DEFAULT_TILESET_TEXTURE_KEY || textureKey === LEGACY_RM_TILESET_TEXTURE_KEY;
  for (let index = 0; index < count; index++) {
    passability.push(useBundledNumberDefaults && isSolidTile(index) ? solid() : passable());
    priority.push(useBundledNumberDefaults && isUpperTile(index) ? "upper" : "lower");
    terrain.push(useBundledNumberDefaults ? terrainTagForChipsetTile(index) : 0);
  }
  const tileset: TilesetDef = {
    id,
    name,
    image: bundledAssetRef(textureKey),
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
    ...(id === DEFAULT_TILESET_ID ? { terrainTemplates: [SMALL_HOUSE_01_TERRAIN_TEMPLATE] } : {}),
  };
  applyCombinedTownHarness(tileset);
  return tileset;
}

export function defaultTilesets(): Record<string, TilesetDef> {
  const tilesets: Record<string, TilesetDef> = {
    [DEFAULT_TILESET_ID]: defaultTileset(),
    [LEGACY_RM_TILESET_ID]: legacyRmTileset(),
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
    if (project.tilesets[tileset.id]) continue;
    project.tilesets[tileset.id] = tileset;
    changed = true;
  }
  changed = ensureTilesetHarnesses(project) || changed;
  return changed;
}

function bundledEasyRpgTileset(asset: (typeof BUNDLED_EASYRPG_CHIPSET_ASSETS)[number]): TilesetDef {
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
  const makeSprite = (id: string): SpriteDef => ({
    id,
    image: bundledAssetRef(`tex_${id}`),
    frames: 8,
    frameWidth: DEFAULT_SPRITE_FRAME_WIDTH,
    frameHeight: DEFAULT_SPRITE_FRAME_HEIGHT,
  });
  return {
    [DEFAULT_SPRITE_NPC]: makeSprite(DEFAULT_SPRITE_NPC),
  };
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
      tileWidth: 16,
      tileHeight: 16,
      imageWidth: 480,
      imageHeight: 256,
      assetId: DEFAULT_TILESET_TEXTURE_KEY,
    },
    ...BUNDLED_EASYRPG_CHIPSET_ASSETS.filter((asset) => asset.textureKey !== DEFAULT_TILESET_TEXTURE_KEY).map((asset) => ({
      kind: "chipset" as const,
      name: asset.name,
      tileWidth: 16,
      tileHeight: 16,
      imageWidth: 480,
      imageHeight: 256,
      assetId: asset.textureKey,
    })),
    {
      kind: "chipset",
      name: LEGACY_RM_TILESET_NAME,
      tileWidth: 16,
      tileHeight: 16,
      imageWidth: 480,
      imageHeight: 256,
      assetId: LEGACY_RM_TILESET_TEXTURE_KEY,
    },
    ...BUNDLED_EASYRPG_CHARSET_ASSETS.map((asset) => ({
      kind: "charset" as const,
      name: asset.name,
      tileWidth: 24,
      tileHeight: 32,
      imageWidth: 288,
      imageHeight: 256,
      assetId: asset.textureKey,
    })),
    {
      kind: "monster",
      name: "기본 몬스터",
      assetId: DEFAULT_SPRITE_NPC,
    },
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
  for (const asset of EASYRPG_RTP_ASSETS) {
    const kind = resourceKindForEasyRpgCategory(asset.category);
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
  let changed = false;
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
  if (kind === "chipset") return 16;
  if (kind === "charset") return 24;
  if (kind === "faceset") return 48;
  if (kind === "battleWeapon") return 64;
  return undefined;
}

function tileHeightForEasyRpgKind(kind: ResourceKind): number | undefined {
  if (kind === "chipset") return 16;
  if (kind === "charset") return 32;
  if (kind === "faceset") return 48;
  if (kind === "battleWeapon") return 64;
  return undefined;
}

function imageWidthForEasyRpgKind(kind: ResourceKind, fileName: string): number | undefined {
  if (kind === "chipset") return 480;
  if (kind === "charset") return 288;
  if (kind === "faceset") return 192;
  if (kind === "battleWeapon") return 192;
  if (kind === "title" || kind === "gameOver") return 320;
  if (kind === "system") return 160;
  if (kind === "system2") return 80;
  if (kind === "monster") return 64;
  if (kind === "picture") return 100;
  if (kind === "backdrop") return fileName.startsWith("Planet") ? 320 : 640;
  return undefined;
}

function imageHeightForEasyRpgKind(kind: ResourceKind, fileName: string): number | undefined {
  if (kind === "chipset") return 256;
  if (kind === "charset") return 256;
  if (kind === "faceset") return 192;
  if (kind === "battleWeapon") return 512;
  if (kind === "title" || kind === "gameOver") return 240;
  if (kind === "system") return 80;
  if (kind === "system2") return 96;
  if (kind === "monster") return 64;
  if (kind === "picture") return 100;
  if (kind === "backdrop") return fileName.startsWith("Planet") ? 240 : 480;
  return undefined;
}
