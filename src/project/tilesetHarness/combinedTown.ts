import type { PassFlag, Project, TileAiMetadata, TileGroupMetadata, TilesetDef } from "@/project/types";
import { DEFAULT_TILESET_TEXTURE_KEY, TILE } from "@/project/defaults/constants";
import { DIRT_ROAD_TILE, TERRAIN_TAG, describeChipsetTile, isTransparentChipsetTile } from "@/project/defaults/chipsetMapping";
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
  changed = enforceTransparentOverlayPriority(tileset) || changed;
  const current = tileset.tileGroups ?? [];
  const currentById = new Map(current.map((group) => [group.id, group]));
  const groups = COMBINED_TOWN_HARNESS_GROUPS.map(({ passage: _passage, repeatability: _repeatability, stackable: _stackable, ...group }) => {
    const existingRules = currentById.get(group.id)?.rules;
    return {
      ...group,
      tileIds: [...group.tileIds],
      patternGrammar: clonePattern(group.patternGrammar),
      rules: existingRules !== undefined ? cloneRules(existingRules) : cloneRules(group.rules),
    };
  });
  const next = [...current.filter((group) => !group.id.startsWith(COMBINED_TOWN_HARNESS_PREFIX)), ...groups];
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    tileset.tileGroups = next;
    changed = true;
  }
  return changed;
}

// 투명 배경 칩(스프라이트형)은 상위 레이어 전용 — 그룹 계약이 lower/mixed로 정하더라도
// 투명 부분 아래가 검게 보이는 하위 배치는 금지한다. 사용자가 명시적으로 하위로 확정한
// 타일(userLocked/user 메타 + defaultLayer:"lower")만 예외.
export function isUpperOnlyOverlayTile(tileset: Pick<TilesetDef, "image" | "tileMeta">, tile: number): boolean {
  if (!isCombinedTownTileset(tileset) || !isTransparentChipsetTile(tile)) return false;
  const meta = tileset.tileMeta?.[tile];
  if (isUserRuntimeMeta(meta) && meta?.defaultLayer === "lower") return false;
  return true;
}

// 저장된 프로젝트 치유: 예전 분류로 priority가 lower로 남은 투명 칩을 로드 시 upper로 승격.
function enforceTransparentOverlayPriority(tileset: TilesetDef): boolean {
  let changed = false;
  for (let tile = 0; tile < tileset.count; tile += 1) {
    if (!isUpperOnlyOverlayTile(tileset, tile)) continue;
    if (tileset.priority[tile] !== "upper") {
      tileset.priority[tile] = "upper";
      changed = true;
    }
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
      "문, 벽, 직선 지붕면, 지붕-벽 경계처럼 불투명한 건축 칩은 하위 레이어입니다.",
      "투명 배경을 가진 스프라이트형 칩(벤치·사선 지붕·나무·울타리·창문·소품)은 상위 레이어 전용입니다 — 하위에 칠해도 자동으로 상위로 라우팅됩니다.",
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

// 레이어 분류(tileLayerClassification)가 mixed 그룹과 그룹 미소속을 구분할 수 있도록
// 그룹의 레이어/스택 속성을 노출한다. 내장 타운 칩셋은 정적 하네스 그룹을 우선한다.
export function harnessGroupForTile(
  tileset: Pick<TilesetDef, "id" | "image" | "tileGroups">,
  tile: number
): { readonly defaultLayer: TileGroupMetadata["defaultLayer"]; readonly stackable?: boolean } | null {
  return groupForTile(tileset, tile);
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
  if (group.id.includes("conifer-tree")) return tile === 260 ? "침엽수 상단" : "침엽수 하단";
  if (group.id.includes("dry-tree")) return tile === 261 ? "마른나무 상단" : "마른나무 하단";
  if (group.id.includes("broadleaf-tree")) return broadleafLabel(tile);
  if (group.id.includes("bush-props")) return "덤불";
  if (group.id.includes("branch-props")) return "가지";
  if (group.id.includes("roof-overlays")) return "사선 지붕";
  if (group.id.includes("windows")) return "창문";
  if (group.id.includes("fence")) return "울타리";
  if (group.id.includes("doors")) return "문/입구";
  if (group.id.includes("stone-floor-trap")) return "돌바닥";
  if (group.id.includes("castle-solid-tiles")) return castleSolidLabel(tile);
  if (group.id.includes("wall") || group.id.includes("boundary")) return group.name;
  if (fallback && !fallback.startsWith("Tile ")) return fallback.replace(/ upper-layer| lower-layer/gi, "").slice(0, 36);
  return `${group.name} ${tile}`;
}

function castleSolidLabel(tile: number): string {
  if (tile === TILE.STAIRS) return "계단";
  return "어두운 벽";
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

function cloneRules(rules: CombinedTownHarnessGroup["rules"]): CombinedTownHarnessGroup["rules"] {
  return rules?.map((rule) => ({ ...rule, params: { ...rule.params } }));
}

function broadleafLabel(tile: number): string {
  switch (tile) {
    case 262:
      return "활엽수 좌상";
    case 263:
      return "활엽수 우상";
    case 292:
      return "활엽수 좌하";
    case 293:
      return "활엽수 우하";
    default:
      return "활엽수";
  }
}
