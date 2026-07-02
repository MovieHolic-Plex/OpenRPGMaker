import type { PassFlag, Project, TileAiMetadata, TileGroupMetadata, TilesetDef } from "@/project/types";
import { DEFAULT_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { DIRT_ROAD_TILE, TERRAIN_TAG, describeChipsetTile } from "@/project/defaults/chipsetMapping";
import {
  COMBINED_TOWN_HARNESS_GROUPS,
  COMBINED_TOWN_HARNESS_PREFIX,
  type CombinedTownHarnessGroup,
} from "./combinedTownGroups";
import { applyEasyRpgThemeMetadataPacks } from "./themePacks";

const passable: PassFlag = { up: true, down: true, left: true, right: true };
const solid: PassFlag = { up: false, down: false, left: false, right: false };
type RuntimeHarnessGroup = {
  readonly defaultLayer: TileGroupMetadata["defaultLayer"];
  readonly tileIds: readonly number[];
  readonly stackable?: boolean;
};

export function isCombinedTownTileset(tileset: Pick<TilesetDef, "image">): boolean {
  return tileset.image.type === "bundled" && tileset.image.id === DEFAULT_TILESET_TEXTURE_KEY;
}

export function ensureTilesetHarnesses(project: Pick<Project, "tilesets">): boolean {
  let changed = false;
  for (const tileset of Object.values(project.tilesets)) {
    changed = applyCombinedTownHarness(tileset) || changed;
    changed = applyEasyRpgThemeMetadataPacks(tileset) || changed;
  }
  return changed;
}

export function applyCombinedTownHarness(tileset: TilesetDef): boolean {
  if (!isCombinedTownTileset(tileset)) return false;
  let changed = false;
  ensureTileMetaLength(tileset);
  for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
    for (const tile of group.tileIds) changed = applyTileContract(tileset, group, tile) || changed;
  }
  const groups = COMBINED_TOWN_HARNESS_GROUPS.map(({ passage: _passage, repeatability: _repeatability, stackable: _stackable, ...group }) => ({
    ...group,
    tileIds: [...group.tileIds],
    patternGrammar: clonePattern(group.patternGrammar),
  }));
  const current = tileset.tileGroups ?? [];
  const next = [...current.filter((group) => !group.id.startsWith(COMBINED_TOWN_HARNESS_PREFIX)), ...groups];
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    tileset.tileGroups = next;
    changed = true;
  }
  return changed;
}

export function harnessLayerForTile(tileset: Pick<TilesetDef, "id" | "image" | "tileGroups">, tile: number): "lower" | "upper" | null {
  const group = groupForTile(tileset, tile);
  if (!group || group.defaultLayer === "mixed" || group.defaultLayer === "event") return null;
  return group.defaultLayer;
}

export function isHarnessStackableTile(tileset: Pick<TilesetDef, "id" | "image" | "tileGroups">, tile: number): boolean {
  return groupForTile(tileset, tile)?.stackable === true;
}

export function combinedTownHarnessPrompt(tileset: Pick<TilesetDef, "id" | "image">): unknown {
  if (!isCombinedTownTileset(tileset)) return { active: false, rule: "이 타일셋에는 번호 의미 하네스가 없습니다." };
  return {
    active: true,
    rules: [
      "울타리, 창문, 문, 벽, 직선 지붕면, 지붕-벽 경계는 하위 레이어입니다.",
      "상위 레이어는 사선 지붕처럼 아래 벽/지형 위에 겹치는 오버레이에만 사용합니다.",
      "길과 물은 대표 타일을 칠하면 주변 연결에 맞춰 실제 타일이 바뀌는 오토타일입니다.",
      "userLocked 메타는 절대 덮어쓰지 않습니다.",
    ],
    groups: COMBINED_TOWN_HARNESS_GROUPS.map((group) => ({
      id: group.id,
      name: group.name,
      role: group.role,
      defaultLayer: group.defaultLayer,
      tileIds: group.tileIds,
      grammar: group.patternGrammar?.kind ?? "single",
      stackable: group.stackable === true,
    })),
  };
}

function applyTileContract(tileset: TilesetDef, group: CombinedTownHarnessGroup, tile: number): boolean {
  if (tile < 0 || tile >= tileset.count) return false;
  const descriptor = describeChipsetTile(tile);
  const meta = tileset.tileMeta?.[tile];
  let changed = false;
  const nextMeta: TileAiMetadata = {
    label: labelForTile(group, tile, descriptor.label),
    description: group.description,
    role: group.role,
    repeatability: group.repeatability,
    defaultLayer: group.defaultLayer,
    terrainTag: terrainTagForGroup(group, descriptor.terrainTag),
    passage: group.passage,
    confidence: group.confidence,
    source: "bundled-default",
    ...(meta?.userLocked ? { userLocked: true } : {}),
  };
  if (meta?.userLocked !== true && meta?.source !== "user" && JSON.stringify(meta) !== JSON.stringify(nextMeta)) {
    tileset.tileMeta![tile] = nextMeta;
    changed = true;
  }
  changed = setTileRuntimeContract(tileset, tile, group, tileset.tileMeta?.[tile]) || changed;
  return changed;
}

function setTileRuntimeContract(
  tileset: TilesetDef,
  tile: number,
  group: CombinedTownHarnessGroup,
  meta?: TileAiMetadata
): boolean {
  let changed = false;
  // mixed 그룹: 통행 가능(passable/star) 소품은 upper 오버레이, 고형(solid)은 lower.
  // RM2K3 정석 — 꽃/장식 같은 디테일은 lower 지형 위에 겹쳐 통행을 막지 않는다.
  const hasUserRuntime = isUserRuntimeMeta(meta);
  const priority = hasUserRuntime && (meta?.defaultLayer === "lower" || meta?.defaultLayer === "upper")
    ? meta.defaultLayer
    : resolveRuntimeLayer(group);
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
    : terrainTagForGroup(group, describeChipsetTile(tile).terrainTag);
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

function groupForTile(tileset: Pick<TilesetDef, "id" | "image" | "tileGroups">, tile: number): RuntimeHarnessGroup | null {
  if (isCombinedTownTileset(tileset)) {
    return COMBINED_TOWN_HARNESS_GROUPS.find((group) => group.tileIds.includes(tile)) ?? null;
  }
  return tileset.tileGroups?.find((group) => group.tileIds.includes(tile)) ?? null;
}

// harness 그룹 → 런타임 priority 결정.
// - defaultLayer가 명시(lower/upper)면 그대로.
// - mixed면 passage로 분기: 통행 가능(passable/star)은 upper 오버레이, 고형(solid)은 lower.
function resolveRuntimeLayer(group: CombinedTownHarnessGroup): "lower" | "upper" {
  if (group.defaultLayer === "upper") return "upper";
  if (group.defaultLayer === "mixed") return group.passage === "solid" ? "lower" : "upper";
  return "lower";
}

function terrainTagForGroup(group: CombinedTownHarnessGroup, fallback: number): number {
  if (group.role === "water") return TERRAIN_TAG.WATER;
  if (group.id.includes("dirt-road")) return TERRAIN_TAG.NORMAL;
  return fallback;
}

function labelForTile(group: CombinedTownHarnessGroup, tile: number, fallback: string): string {
  if (group.id.includes("dirt-road")) return roadLabel(tile);
  if (group.id.includes("lake-water")) return "물 오토타일";
  if (group.id.includes("roof-overlays")) return "사선 지붕";
  if (group.id.includes("windows")) return "창문";
  if (group.id.includes("fence")) return "울타리";
  if (group.id.includes("doors")) return "문/입구";
  if (group.id.includes("wall") || group.id.includes("boundary")) return group.name;
  if (fallback && !fallback.startsWith("Tile ")) return fallback.replace(/ upper-layer| lower-layer/gi, "").slice(0, 36);
  return `${group.name} ${tile}`;
}

function roadLabel(tile: number): string {
  if (tile === DIRT_ROAD_TILE.BODY || tile === DIRT_ROAD_TILE.BODY_ALT) return "흙길 중앙";
  if (tile === DIRT_ROAD_TILE.EDGE_NORTH) return "흙길 상단";
  if (tile === DIRT_ROAD_TILE.EDGE_SOUTH) return "흙길 하단";
  if (tile === DIRT_ROAD_TILE.EDGE_WEST) return "흙길 좌측";
  if (tile === DIRT_ROAD_TILE.EDGE_EAST) return "흙길 우측";
  return "흙길 모서리";
}

function clonePattern(patternGrammar: CombinedTownHarnessGroup["patternGrammar"]): CombinedTownHarnessGroup["patternGrammar"] {
  return patternGrammar ? { ...patternGrammar, parts: patternGrammar.parts.map((part) => ({ role: part.role, tileIds: [...part.tileIds] })) } : undefined;
}
