import type { PassFlag, TileAiMetadata, TileGroupMetadata, TilesetDef } from "@/project/types";

export const DUNGEON_METADATA_PACK_ID = "dungeon-v1";
export const DUNGEON_METADATA_PACK_VERSION = "1";
export const DUNGEON_TEXTURE_KEY = "tex_easyrpg_chipset_dungeon";
export const DUNGEON_HARNESS_PREFIX = "harness-dungeon-v1-";

export const INTERIOR_METADATA_PACK_ID = "interior-house-v1";
export const INTERIOR_METADATA_PACK_VERSION = "1";
export const INTERIOR_TEXTURE_KEY = "tex_easyrpg_chipset_interior";
export const INTERIOR_HARNESS_PREFIX = "harness-interior-house-v1-";

type PackHarnessGroup = Omit<TileGroupMetadata, "tileIds"> & {
  readonly passage: NonNullable<TileAiMetadata["passage"]>;
  readonly repeatability: NonNullable<TileAiMetadata["repeatability"]>;
  readonly tileIds: readonly number[];
};

type ThemeMetadataPack = {
  readonly id: string;
  readonly version: string;
  readonly textureKey: string;
  readonly prefix: string;
  readonly groups: readonly PackHarnessGroup[];
};

const passable: PassFlag = { up: true, down: true, left: true, right: true };
const solid: PassFlag = { up: false, down: false, left: false, right: false };

export const DUNGEON_HARNESS_GROUPS: readonly PackHarnessGroup[] = [
  packGroup(DUNGEON_HARNESS_PREFIX, "floor", "던전 바닥", "terrain", "lower", [270, 271, 300, 301], "passable", "repeat", "방과 복도를 채우는 통행 가능한 던전 바닥입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "stone-wall", "던전 석벽", "wall", "lower", [1, 2, 3, 31, 32, 33], "solid", "repeat", "방 외곽과 복도 경계를 막는 단단한 던전 벽입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "door-trim", "던전 입구/장식", "building", "lower", [91, 92, 121, 122], "solid", "fixed", "방 입구 주변을 표시하는 비통행 던전 구조물입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "prop-detail", "던전 소품", "prop", "mixed", [210, 211, 240, 241], "solid", "fixed", "바닥 위에 배치할 수 있는 던전 장식 소품입니다."),
];

export const INTERIOR_HARNESS_GROUPS: readonly PackHarnessGroup[] = [
  packGroup(INTERIOR_HARNESS_PREFIX, "floor", "실내 바닥", "terrain", "lower", [270, 271, 300, 301], "passable", "repeat", "실내 방을 채우는 통행 가능한 바닥입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "wall", "실내 벽", "wall", "lower", [1, 2, 3, 31, 32, 33], "solid", "repeat", "방 외곽을 막는 실내 벽입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "room-trim", "실내 구조/가구", "building", "lower", [84, 85, 86, 114, 115, 116], "solid", "fixed", "방 가장자리와 가구 배치를 위한 비통행 실내 구조물입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "decor", "실내 장식", "prop", "mixed", [210, 211, 240, 241], "solid", "fixed", "실내 미리보기에 배치할 수 있는 장식 소품입니다."),
];

const THEME_PACKS: readonly ThemeMetadataPack[] = [
  { id: DUNGEON_METADATA_PACK_ID, version: DUNGEON_METADATA_PACK_VERSION, textureKey: DUNGEON_TEXTURE_KEY, prefix: DUNGEON_HARNESS_PREFIX, groups: DUNGEON_HARNESS_GROUPS },
  { id: INTERIOR_METADATA_PACK_ID, version: INTERIOR_METADATA_PACK_VERSION, textureKey: INTERIOR_TEXTURE_KEY, prefix: INTERIOR_HARNESS_PREFIX, groups: INTERIOR_HARNESS_GROUPS },
];

export function applyEasyRpgThemeMetadataPacks(tileset: TilesetDef): boolean {
  const pack = themePackForTileset(tileset);
  if (!pack) return false;
  return applyThemeMetadataPack(tileset, pack);
}

export function isThemePackTileset(tileset: Pick<TilesetDef, "image">): boolean {
  return tileset.image.type === "bundled" && THEME_PACKS.some((pack) => pack.textureKey === tileset.image.id);
}

function themePackForTileset(tileset: Pick<TilesetDef, "image">): ThemeMetadataPack | null {
  if (tileset.image.type !== "bundled") return null;
  return THEME_PACKS.find((pack) => pack.textureKey === tileset.image.id) ?? null;
}

function applyThemeMetadataPack(tileset: TilesetDef, pack: ThemeMetadataPack): boolean {
  let changed = false;
  ensureTileMetaLength(tileset);
  for (const group of pack.groups) {
    for (const tile of group.tileIds) changed = applyTileContract(tileset, group, tile) || changed;
  }

  const groups = pack.groups.map(({ passage: _passage, repeatability: _repeatability, ...group }) => ({
    ...group,
    tileIds: [...group.tileIds],
    patternGrammar: clonePattern(group.patternGrammar),
  }));
  const current = tileset.tileGroups ?? [];
  const usedGroupIds = new Set(groups.map((group) => group.id));
  const preserved: TileGroupMetadata[] = [];
  for (const group of current.filter((candidate) => !isPackOwnedGroup(candidate, pack))) {
    const preservedGroup = preserveUserPrefixCollision(group, pack, usedGroupIds);
    usedGroupIds.add(preservedGroup.id);
    preserved.push(preservedGroup);
  }
  const next = [...preserved, ...groups];
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    tileset.tileGroups = next;
    changed = true;
  }
  return changed;
}

function isPackOwnedGroup(group: TileGroupMetadata, pack: ThemeMetadataPack): boolean {
  return group.id.startsWith(pack.prefix) && group.source === "bundled-default";
}

function preserveUserPrefixCollision(
  group: TileGroupMetadata,
  pack: ThemeMetadataPack,
  usedGroupIds: ReadonlySet<string>
): TileGroupMetadata {
  if (!group.id.startsWith(pack.prefix) || !usedGroupIds.has(group.id)) return group;
  let suffix = 1;
  let id = `${group.id}-user-preserved`;
  while (usedGroupIds.has(id)) {
    suffix += 1;
    id = `${group.id}-user-preserved-${suffix}`;
  }
  return { ...group, id };
}

function applyTileContract(tileset: TilesetDef, group: PackHarnessGroup, tile: number): boolean {
  if (tile < 0 || tile >= tileset.count) return false;
  const meta = tileset.tileMeta?.[tile];
  if (meta?.userLocked === true || meta?.source === "user") return setTileRuntimeContract(tileset, tile, group, meta);
  const nextMeta: TileAiMetadata = {
    label: `${group.name} ${tile}`,
    description: group.description,
    role: group.role,
    repeatability: group.repeatability,
    defaultLayer: group.defaultLayer,
    terrainTag: group.role === "terrain" ? 0 : undefined,
    passage: group.passage,
    confidence: "high",
    source: "bundled-default",
  };
  let changed = false;
  if (JSON.stringify(meta) !== JSON.stringify(nextMeta)) {
    tileset.tileMeta![tile] = nextMeta;
    changed = true;
  }
  return setTileRuntimeContract(tileset, tile, group, tileset.tileMeta?.[tile]) || changed;
}

function setTileRuntimeContract(
  tileset: TilesetDef,
  tile: number,
  group: PackHarnessGroup,
  meta?: TileAiMetadata
): boolean {
  let changed = false;
  const hasUserRuntime = isUserRuntimeMeta(meta);
  const priority = hasUserRuntime && (meta?.defaultLayer === "lower" || meta?.defaultLayer === "upper")
    ? meta.defaultLayer
    : group.defaultLayer === "upper" ? "upper" : "lower";
  if (tileset.priority[tile] !== priority) {
    tileset.priority[tile] = priority;
    changed = true;
  }
  const passage = hasUserRuntime && meta?.passage ? meta.passage : group.passage;
  const passability = passage === "solid" ? solid : passable;
  if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(passability)) {
    tileset.passability[tile] = { ...passability };
    changed = true;
  }
  const terrain = hasUserRuntime && typeof meta?.terrainTag === "number"
    ? meta.terrainTag
    : group.role === "terrain" ? 0 : tileset.terrain[tile] ?? 0;
  if (tileset.terrain[tile] !== terrain) {
    tileset.terrain[tile] = terrain;
    changed = true;
  }
  return changed;
}

function isUserRuntimeMeta(meta: TileAiMetadata | undefined): boolean {
  return meta?.source === "user" || meta?.userLocked === true;
}

function ensureTileMetaLength(tileset: TilesetDef): void {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
}

function packGroup(
  prefix: string,
  id: string,
  name: string,
  role: TileGroupMetadata["role"],
  defaultLayer: TileGroupMetadata["defaultLayer"],
  tileIds: readonly number[],
  passage: PackHarnessGroup["passage"],
  repeatability: PackHarnessGroup["repeatability"],
  description: string
): PackHarnessGroup {
  return {
    id: `${prefix}${id}`,
    name,
    role,
    defaultLayer,
    tileIds,
    description,
    placementRules: description,
    confidence: "high",
    source: "bundled-default",
    passage,
    repeatability,
  };
}

function clonePattern(patternGrammar: PackHarnessGroup["patternGrammar"]): PackHarnessGroup["patternGrammar"] {
  return patternGrammar ? { ...patternGrammar, parts: patternGrammar.parts.map((part) => ({ role: part.role, tileIds: [...part.tileIds] })) } : undefined;
}
