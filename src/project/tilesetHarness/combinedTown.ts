import { isForestHarmonyTileset } from "@/project/defaults/forestHarmony";
import type { PassFlag, Project, TileAiMetadata, TileGroupMetadata, TilesetDef } from "@/project/types";
import { CASTLE_TILESET_TEXTURE_KEY, COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY, DEFAULT_TILESET_TEXTURE_KEY, TILE } from "@/project/defaults/constants";
import {
  DIRT_ROAD_TILE,
  TERRAIN_TAG,
  describeChipsetTile,
  isTransparentChipsetTile,
  rm2k3StairPassFlag,
  rm2k3WoodFloorPassFlag,
  WOOD_FLOOR_PASSABILITY,
} from "@/project/defaults/chipsetMapping";
import {
  COMBINED_TOWN_HARNESS_GROUPS,
  COMBINED_TOWN_HARNESS_PREFIX,
  type CombinedTownHarnessGroup,
} from "./combinedTownGroups";
import { applyEasyRpgThemeMetadataPacks } from "./themePacks";
import { hasInteriorCabinetOverride } from "@/project/defaults/interiorTransparentPropLayerRepair";
import { hasInteriorLongTableOverride } from "./interiorLongTableLegacy";
import { roleCapabilities } from "@/project/tileRoles";
import { chipsetLabelCorrection, seedChipsetLabelCorrections } from "@/project/defaults/chipsetLabelCorrections";

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

/**
 * 합본 마을 타일 좌표(0~479)가 그대로 맞는 타일셋인가 — 합본 마을 자체, 또는 위 480칸이 합본 마을인
 * 「합본 마을+레트로 월드맵」 혼합 칩셋(2026-09-18). 숲마을도 이 480칸을 보존한다. 마을 시공기의 스코프 가드.
 */
export function isCombinedTownCompatibleTileset(tileset: Pick<TilesetDef, "image">): boolean {
  return isCombinedTownTileset(tileset) || isForestHarmonyTileset(tileset)
    || (tileset.image.type === "bundled" && tileset.image.id === COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY);
}

export function isStandard480Tileset(tileset: Pick<TilesetDef, "count">): boolean {
  return tileset.count === 480;
}

export function ensureTilesetHarnesses(project: Pick<Project, "tilesets">): boolean {
  let changed = false;
  for (const tileset of Object.values(project.tilesets)) {
    if (isCombinedTownTileset(tileset)) {
      changed = applyCombinedTownHarness(tileset) || changed;
    } else {
      changed = applyCustomChipsetMinimalHarness(tileset) || changed;
    }
    changed = applyEasyRpgThemeMetadataPacks(tileset) || changed;
    changed = seedChipsetLabelCorrections(tileset) || changed;
  }
  return changed;
}

function applyCustomChipsetMinimalHarness(tileset: TilesetDef): boolean {
  // Castle2.png ships its own custom-atlas layer defaults. The legacy RM2k3 transparency
  // table is indexed by unrelated 16px combined-town cells and must not reinterpret them.
  if (tileset.image.type === "bundled" && tileset.image.id === CASTLE_TILESET_TEXTURE_KEY) return false;
  let changed = false;
  ensureTileMetaLength(tileset);
  const cabinetOverride = tileset.image.type === "bundled"
    && tileset.image.id === "tex_easyrpg_chipset_interior" && hasInteriorCabinetOverride(tileset);
  const tableOverride = hasInteriorLongTableOverride(tileset);
  for (let tile = 0; tile < tileset.count; tile += 1) {
    if (cabinetOverride && (tile === 148 || tile === 178)) continue;
    if (tableOverride && (tile === 325 || tile === 326 || tile === 327)) continue;
    if (!isTransparentChipsetTile(tile)) continue;
    if (isTreeTrunkTileId(tile)) continue;
    const meta = tileset.tileMeta?.[tile];
    if (isUserRuntimeMeta(meta) && meta?.defaultLayer === "lower") continue;
    if (tileset.priority[tile] !== "upper") {
      tileset.priority[tile] = "upper";
      changed = true;
    }
  }
  return changed;
}

export function applyCombinedTownHarness(tileset: TilesetDef): boolean {
  if (!isCombinedTownTileset(tileset)) return false;
  if (!isStandard480Tileset(tileset)) return false;
  let changed = false;
  ensureTileMetaLength(tileset);
  for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
    for (const tile of group.tileIds) changed = applyTileContract(tileset, group, tile) || changed;
  }
  changed = enforceTransparentOverlayPriority(tileset) || changed;
  // RM2k3 데크/층계: wood floor 가장자리 4방향 + 돌계단 가로 통행 (그룹 일괄 passable 이후 덮어씀)
  changed = applyRm2k3ElevationPassability(tileset) || changed;
  const current = tileset.tileGroups ?? [];
  const suppressed = normalizeSuppressedHarnessGroupIds(tileset);
  if (suppressed.changed) changed = true;
  const suppressedIds = new Set(suppressed.ids);
  const harnessIds = new Set(COMBINED_TOWN_HARNESS_GROUPS.map((group) => group.id));
  const currentById = new Map(current.map((group) => [group.id, group]));
  const preserved = current.filter((group) => !harnessIds.has(group.id) && !isBundledCombinedTownHarnessGroup(group));
  const groups = COMBINED_TOWN_HARNESS_GROUPS.flatMap((group) => {
    if (suppressedIds.has(group.id)) return [];
    const existing = currentById.get(group.id);
    return existing ? [preserveHarnessGroup(existing, group)] : [cloneHarnessGroup(group)];
  });
  const next = [...preserved, ...groups];
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    tileset.tileGroups = next;
    changed = true;
  }
  changed = seedChipsetLabelCorrections(tileset) || changed;
  return changed;
}

/** 나무 수관(윗단) — 상위 ★. */
export const TREE_CANOPY_TILE_IDS = new Set<number>([260, 261, 262, 263]);
/** 나무 밑동(아랫단) — 하위 solid. 수관이 이 위에 겹치면 숲. */
export const TREE_TRUNK_TILE_IDS = new Set<number>([290, 291, 292, 293]);

export function isTreeCanopyTileId(tile: number): boolean {
  return TREE_CANOPY_TILE_IDS.has(tile);
}

export function isTreeTrunkTileId(tile: number): boolean {
  return TREE_TRUNK_TILE_IDS.has(tile);
}

// 투명 배경 칩(스프라이트형)은 상위 레이어 전용 — 그룹 계약이 lower/mixed로 정하더라도
// 투명 부분 아래가 검게 보이는 하위 배치는 금지한다. 사용자가 명시적으로 하위로 확정한
// 타일(userLocked/user 메타 + defaultLayer:"lower")만 예외.
// 예외: 나무 밑동은 숲 겹침을 위해 하위 solid 로 둔다(수관 upper 와 같은 칸에 공존).
export function isUpperOnlyOverlayTile(tileset: Pick<TilesetDef, "count" | "image" | "tileMeta">, tile: number): boolean {
  if (!isCombinedTownTileset(tileset) || !isStandard480Tileset(tileset) || !isTransparentChipsetTile(tile)) return false;
  if (isTreeTrunkTileId(tile)) return false;
  const meta = tileset.tileMeta?.[tile];
  if (isUserRuntimeMeta(meta) && meta?.defaultLayer === "lower") return false;
  return true;
}

// 저장된 프로젝트 치유: 예전 분류로 priority가 lower로 남은 투명 칩을 로드 시 upper로 승격.
function enforceTransparentOverlayPriority(tileset: TilesetDef): boolean {
  if (!isStandard480Tileset(tileset)) return false;
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
      // 성채(map_castle_keep) 실측 조립 순서
      "성 맵: 자유조립 금지 — build_castle 툴(castleKit.stampCastle, 금본 map_castle_keep)로만 시공한다. 성문 접근로만 sand/dirt로 잇고 마당은 잔디 통행 유지.",
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
    description: "",
    role: group.role,
    repeatability: group.repeatability,
    defaultLayer: group.defaultLayer,
    terrainTag: terrainTagForGroup(tileset, group, descriptor.terrainTag),
    passage: group.passage,
    confidence: group.confidence,
    source: "bundled-default",
    ...(meta?.userLocked ? { userLocked: true } : {}),
    ...chipsetLabelCorrection(tileset.image.id, tile),
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
  // 나무 수관(윗칸)은 항상 upper + 통행 가능(★) — 숲에서 캐노피가 겹쳐 그려지고 하층 통행을 따른다.
  // 나무 밑동은 solid 로 막되, 투명 칩이면 upper 에 둔다(enforceTransparentOverlayPriority).
  const hasUserRuntime = isUserRuntimeMeta(meta);
  const treeCanopy = isTreeCanopyTileId(tile);
  const treeTrunk = isTreeTrunkTileId(tile);
  const priority = hasUserRuntime && (meta?.defaultLayer === "lower" || meta?.defaultLayer === "upper")
    ? meta.defaultLayer
    : treeCanopy
      ? "upper"
      : treeTrunk
        ? "lower"
        : resolveRuntimeLayer(group);
  if (tileset.priority[tile] !== priority) {
    tileset.priority[tile] = priority;
    changed = true;
  }
  const passage = hasUserRuntime && meta?.passage
    ? meta.passage
    : treeCanopy
      ? "passable"
      : treeTrunk
        ? "solid"
        : group.passage;
  const passability = passage === "solid" ? solid : passable;
  if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(passability)) {
    tileset.passability[tile] = { ...passability };
    changed = true;
  }
  const terrain = hasUserRuntime && typeof meta?.terrainTag === "number"
    ? meta.terrainTag
    : terrainTagForGroup(tileset, group, describeChipsetTile(tile).terrainTag);
  if (tileset.terrain[tile] !== terrain) {
    tileset.terrain[tile] = terrain;
    changed = true;
  }
  return changed;
}

function isUserRuntimeMeta(meta: TileAiMetadata | undefined): boolean {
  return meta?.source === "user" || meta?.userLocked === true;
}

/** RM2k3: 데크 가장자리 칩 4방향 + 가로 돌계단. userLocked 메타는 건드리지 않음. */
function applyRm2k3ElevationPassability(tileset: TilesetDef): boolean {
  let changed = false;
  const woodTiles = [
    WOOD_FLOOR_PASSABILITY.body,
    WOOD_FLOOR_PASSABILITY.edgeWest,
    WOOD_FLOOR_PASSABILITY.edgeEast,
    WOOD_FLOOR_PASSABILITY.edgeNorth,
    WOOD_FLOOR_PASSABILITY.edgeSouth,
  ] as const;
  for (const tile of woodTiles) {
    if (isUserRuntimeMeta(tileset.tileMeta?.[tile])) continue;
    const flag = rm2k3WoodFloorPassFlag(tile);
    if (!flag || tile >= tileset.passability.length) continue;
    if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(flag)) {
      tileset.passability[tile] = { ...flag };
      changed = true;
    }
    if (tileset.priority[tile] !== "lower") {
      tileset.priority[tile] = "lower";
      changed = true;
    }
  }
  // 돌계단 111–113: 밟을 수 있는 ○ (전방향). 고상 분리는 데크 edge 칩이 담당.
  const stairFlag = rm2k3StairPassFlag();
  for (const tile of [111, 112, 113] as const) {
    if (isUserRuntimeMeta(tileset.tileMeta?.[tile])) continue;
    if (tile >= tileset.passability.length) continue;
    if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(stairFlag)) {
      tileset.passability[tile] = { ...stairFlag };
      changed = true;
    }
    if (tileset.priority[tile] !== "lower") {
      tileset.priority[tile] = "lower";
      changed = true;
    }
  }
  return changed;
}

function ensureTileMetaLength(tileset: TilesetDef): void {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
}

function normalizeSuppressedHarnessGroupIds(tileset: TilesetDef): { readonly changed: boolean; readonly ids: readonly string[] } {
  const raw = tileset.suppressedHarnessGroupIds ?? [];
  const ids = [...new Set(raw.filter((id) => id.startsWith(COMBINED_TOWN_HARNESS_PREFIX)))];
  const changed = ids.length !== raw.length || ids.some((id, index) => raw[index] !== id);
  if (changed) tileset.suppressedHarnessGroupIds = ids;
  return { changed, ids };
}

function preserveHarnessGroup(existing: TileGroupMetadata, group: CombinedTownHarnessGroup): TileGroupMetadata {
  const next = structuredClone(existing);
  if (next.rules === undefined) next.rules = cloneRules(group.rules);
  return next;
}

function isBundledCombinedTownHarnessGroup(group: TileGroupMetadata): boolean {
  return group.id.startsWith(COMBINED_TOWN_HARNESS_PREFIX) && group.source !== "user";
}

function cloneHarnessGroup(group: CombinedTownHarnessGroup): TileGroupMetadata {
  const { passage: _passage, repeatability: _repeatability, stackable: _stackable, ...metadata } = group;
  return {
    ...metadata,
    tileIds: [...metadata.tileIds],
    patternGrammar: clonePattern(metadata.patternGrammar),
    rules: cloneRules(metadata.rules),
  };
}

function groupForTile(tileset: Pick<TilesetDef, "id" | "image" | "tileGroups">, tile: number): RuntimeHarnessGroup | null {
  if (isCombinedTownTileset(tileset)) {
    return COMBINED_TOWN_HARNESS_GROUPS.find((group) => group.tileIds.includes(tile)) ?? null;
  }
  return tileset.tileGroups?.find((group) => group.tileIds.includes(tile)) ?? null;
}

// 레이어 분류(tileLayerClassification)가 mixed 그룹과 그룹 미소속을 구분할 수 있도록
// 그룹의 레이어/스택 속성을 노출한다. 내장 타운 타일 그림판은 정적 하네스 그룹을 우선한다.
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
  // mixed + stackable 소품(탁자·상자·벤치 등): 통행 ×여도 상위 유지.
  // RM2k3 가구는 상위 ×(막힘)이며, lower로 내리면 투명 칩이 검게 보인다.
  // (나무 수관/밑동은 setTileRuntimeContract 특수 분기가 priority를 덮어쓴다.)
  if (group.defaultLayer === "mixed") {
    if (group.stackable) return "upper";
    return group.passage === "solid" ? "lower" : "upper";
  }
  return "lower";
}

function terrainTagForGroup(tileset: TilesetDef, group: CombinedTownHarnessGroup, fallback: number): number {
  if (roleCapabilities(tileset, group.role).terrainTag === "water") return TERRAIN_TAG.WATER;
  // id 기반 조건 — 역할로 접히지 않는다. 흙길 그룹의 role 은 terrain 이다.
  if (group.id.includes("dirt-road")) return TERRAIN_TAG.NORMAL;
  return fallback;
}

function labelForTile(group: CombinedTownHarnessGroup, tile: number, fallback: string): string {
  if (group.id.includes("dirt-road")) return roadLabel(tile);
  if (group.id.includes("tall-grass")) return "키큰 풀"; // "tall-grass-autotile"이 "grass-autotile"에 매칭되지 않도록 먼저 처리.
  if (group.id.includes("grass-autotile")) return "잔디";
  if (group.id.includes("lake-water")) return "물 오토타일";
  if (group.id.includes("conifer-tree")) return tile === 260 ? "침엽수 상단" : "침엽수 하단";
  if (group.id.includes("dry-tree")) return tile === 261 ? "마른나무 상단" : "마른나무 하단";
  if (group.id.includes("broadleaf-tree")) return broadleafLabel(tile);
  if (group.id.includes("bench-horizontal")) return tile === 327 ? "벤치 좌" : "벤치 우";
  if (group.id.includes("bench-vertical")) return tile === 358 ? "세로 의자 상" : "세로 의자 하";
  if (group.id.includes("table-horizontal")) {
    if (tile === 234) return "가로 탁자 좌";
    if (tile === 235) return "가로 탁자 중";
    return "가로 탁자 우";
  }
  if (group.id.includes("table-vertical")) {
    if (tile === 144) return "세로 탁자 상";
    if (tile === 174) return "세로 탁자 중";
    return "세로 탁자 하";
  }
  if (group.id.includes("table-chairs")) {
    if (tile === 175) return "의자(아래 봄)";
    if (tile === 176) return "의자(위 봄)";
    if (tile === 205) return "의자(오른쪽 봄)";
    return "의자(왼쪽 봄)";
  }
  if (group.id.includes("free-chairs")) return tile === 147 ? "의자(등받이 없음)" : "의자(등받이 있음)";
  if (group.id.includes("house-yard")) {
    if (tile === 349) return "장작 더미";
    if (tile === 350) return "우편함";
    if (tile === 351) return "화분";
    return "항아리";
  }
  if (group.id.includes("cemetery")) {
    if (tile === 323) return "묘지";
    if (tile === 353) return "묘비";
    return "해골";
  }
  if (group.id.includes("wall-ladder")) return "벽 사다리";
  if (group.id.includes("fruit-box")) return tile === 202 ? "과일박스 좌" : "과일박스 우";
  if (group.id.includes("wood-box")) return "나무 상자";
  if (group.id.includes("wood-floor-deck")) {
    if (tile === WOOD_FLOOR_PASSABILITY.body) return "나무 바닥 바디";
    if (tile === WOOD_FLOOR_PASSABILITY.edgeWest) return "나무 바닥 서측(←막힘)";
    if (tile === WOOD_FLOOR_PASSABILITY.edgeEast) return "나무 바닥 동측(→막힘)";
    if (tile === WOOD_FLOOR_PASSABILITY.edgeNorth) return "나무 바닥 북측(↑막힘)";
    if (tile === WOOD_FLOOR_PASSABILITY.edgeSouth) return "나무 바닥 남측(↓막힘)";
    return "나무 바닥 데크";
  }
  if (group.id.includes("timber-post-rail")) {
    if (tile === 223) return "목조 난간 바디";
    if (tile === 193) return "목조 기둥";
    return "목조 난간/기둥";
  }
  if (group.id.includes("market-rail-upper")) {
    if (tile === 468) return "장터 레일 좌";
    if (tile === 469) return "장터 레일 중";
    return "장터 레일 우";
  }
  if (group.id.includes("stone-step-slab")) return "돌단/석판";
  if (group.id.includes("barrel-prop")) return tile === 177 ? "술통" : "오크통";
  if (group.id.includes("plaza-statue")) return tile === 266 ? "석상 상단" : "석상 하단";
  if (group.id.includes("plaza-pillar")) return tile === 267 ? "돌기둥 상단" : "돌기둥 하단";
  if (group.id.includes("village-well")) return "우물";
  if (group.id.includes("small-props")) return smallPropLabel(tile);
  if (group.id.includes("magic-circle")) return "마법진";
  if (group.id.includes("wood-door")) return tile === 116 ? "나무 문 상" : "나무 문 하";
  if (group.id.includes("stone-stairs")) {
    if (tile === 111) return "돌계단 좌";
    if (tile === 112) return "돌계단 중";
    return "돌계단 우";
  }
  if (group.id.includes("castle-windows")) {
    if (tile === 28) return "성 열린 창문";
    if (tile === 58) return "성 창문";
    return "깨진 창문조각";
  }
  if (group.id.includes("castle-roof-deck")) return castleRoofDeckLabel(tile);
  if (group.id.includes("castle-wall-face")) return castleWallFaceLabel(tile);
  if (group.id.includes("castle-round-tower")) return roundTowerLabel(tile);
  if (group.id.includes("bush-props")) return "덤불";
  if (group.id.includes("branch-props")) return "가지";
  if (group.id.includes("roof-body")) return "사선 지붕";
  if (group.id.includes("roof-overlays")) return "사선 지붕 캡";
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

/** small-props 가방 멤버의 구체 라벨 — place_props material로 개별 지정 가능하게 한다.
 * 2026-07-16 사용자 교정: 320=벽보(벽 전용), 440=팻말(갈림길), 441=그루터기, 443=자갈 바닥(텍스처),
 * 382/412=돌바닥 사이 잡석(단독 배치 어색), 472=방패 간판(무기점), 473=물약 간판(잡화점). */
function smallPropLabel(tile: number): string {
  switch (tile) {
    case 318:
      return "벽 횃불";
    case 381:
      return "모닥불";
    case 320:
      return "벽보";
    case 319:
      return "쪽문";
    case 259:
      return "마른 가지";
    case 441:
    case 442:
      return "바위"; // 412 돌바닥 패치 위에 섞어 쓴다
    case 443:
      return "자갈(사용 금지)";
    case 440:
      return "팻말";
    case 411:
      return "이끼 자갈";
    case 472:
      return "방패 간판";
    case 473:
      return "물약 간판";
    default:
      return `마을 소품 ${tile}`;
  }
}

function castleRoofDeckLabel(tile: number): string {
  switch (tile) {
    case 18:
      return "성 지붕 좌상";
    case 19:
      return "성 지붕 상단";
    case 20:
      return "성 지붕 우상";
    case 48:
      return "성 지붕 좌측";
    case 49:
      return "성 지붕 바닥(옅은)";
    case 50:
      return "성 지붕 중단";
    case 78:
      return "성 지붕 좌측(하)";
    case 79:
      return "성 지붕 바닥(진한)";
    case 80:
      return "성 지붕 중단(하)";
    case 108:
      return "성 지붕 좌하";
    case 109:
      return "성 지붕 하단";
    case 110:
      return "성 지붕 우하";
    default:
      return "성 지붕/여장";
  }
}

function castleWallFaceLabel(tile: number): string {
  if (tile === 21) return "성벽 상단";
  if (tile === 51) return "성벽 중단";
  if (tile === 81) return "성벽 하단";
  return "성벽 정면";
}

function roundTowerLabel(tile: number): string {
  switch (tile) {
    case 24:
      return "원형 타워 캡 좌";
    case 25:
      return "원형 타워 캡 우";
    case 54:
      return "원형 타워 베이스 좌";
    case 55:
      return "원형 타워 베이스 우";
    case 138:
      return "원형 타워 목 좌";
    case 139:
      return "원형 타워 목 우";
    case 140:
      return "원형 타워 몸 좌";
    case 141:
      return "원형 타워 몸 우";
    case 142:
      return "원형 타워 창문 좌";
    case 143:
      return "원형 타워 창문 우";
    default:
      return "원형 타워";
  }
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
