// editor/tools/v3/constructionTools.ts
// 공정 프리미티브 6종 (타일 툴 v3 — V3B).
//
// 계약: version 3, layer 인자 없음(어휘 layerHome). 재료는 material=타일 label/description
// (vocabId/그룹 id 금지). soft-allow + vocabSoftConfirm.
// 공정 순서: build_wall → place_door/place_window → build_roof → lay_path → place_props.

import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { worldmapAutoTile, worldmapEraseTile, worldmapMaterialGroup } from '@/project/worldmapAutoBrush';
import { autotileGroupLayer, shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import { isPassable, tilePassability } from "@/project/collision";
import { roleCapabilities } from "@/project/tileRoles";
import { tileMetaLocked, tileMetaOrigin } from "@/project/tilesetPalette";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { TILE } from "@/project/defaults/constants";
import {
  isFlatFillGroup,
  resolveMaterialByLabel,
  suggestMaterialsByLabel,
  VOCAB_SOFT_CONFIRM_WARNING_PREFIX,
  type VocabLayerHome,
  type VocabSoftConfirm,
} from "@/project/tileVocabulary";
import type { AutotileGroup, GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { forestCompositionApplies, measureForestArea, plantForestComposition } from "../forestComposition";
import { protectedHouseCells } from "../houseProtection";
import {
  forestPackingFor,
  forestPlacementPlan,
  forestTreeKindFromResolvedMaterial,
  type ForestDensity,
  treeFootprintCells,
} from "../forestDensity";
import {
  FOUR_LAYER_GUIDANCE_SHORT,
  TOOL_LAYER_ENUM,
  inMapBounds,
  parseToolLayer,
  reachableCellCount,
  requireMap,
  setLower,
  setUpper,
  toolLayerLabel,
  type Point,
} from "../mapHelpers";
import { autotileLayerView, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { cellLayerTiles, compactMapLayers, setLayerTileAt, setShadowAt, shadowAt, type TileLayerNo } from "@/project/mapLayers";
import { expandCellsAgainstWalls } from "../wallFlush";
import { wobblePath } from "../naturalScatter";
import {
  filterRoadWidthCells,
  paintRoadGround,
  repairRoadPath,
  roadGapFailure,
  roadObstacleMaskFor,
  roadRepairWarnings,
  withWidthCells,
} from "../roadObstacles";
import { naturalnessArg, naturalnessLabel, rngForTool } from "../naturalToolArgs";
import { placePropsOnDraft } from "../placePropsDomain";
import { type ScatterPacking } from "../placementTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "../types";
import { coerceInt, coercePoint, coercePointArray, failWithExample } from "../toolArgCoerce";
import { tilesetGrammarProfile } from "./grammarProfiles";
import {
  expandRoof,
  expandWall,
  layerForVocabTile,
  resolveAutotile,
  vocabLayerHomeFor,
  type CellEdit,
  type Rect,
} from "./rmTypeExpander";
import {
  atomFromGroup,
  fillRun,
  hardAdjacencyViolation,
  mirrorTile,
  planRows,
  type AisleAxis,
  type RowAtom,
  type RunCell,
} from "./rowArrangement";
import { isBareBoard, mapTexture } from "@/project/mapTexture";

const WALL_EXAMPLE = { mapId: "map_1", rect: { x: 8, y: 6, w: 6, h: 4 }, material: "흰 집 벽" };
const ROOF_EXAMPLE = { mapId: "map_1", material: "빨간 지붕", wallRect: { x: 8, y: 6, w: 6, h: 4 } };
const DOOR_EXAMPLE = { mapId: "map_1", at: { x: 10, y: 9 }, material: "문" };
const WINDOW_EXAMPLE = { mapId: "map_1", at: { x: 9, y: 7 }, material: "창문" };
const PATH_EXAMPLE = { mapId: "map_1", points: [{ x: 2, y: 12 }, { x: 14, y: 12 }, { x: 20, y: 8 }], material: "흙길", naturalness: 0.5 };
const PROPS_EXAMPLE = { mapId: "map_1", area: { x: 2, y: 2, w: 18, h: 12 }, material: "침엽수", count: 8, naturalness: 0.6 };
const FILL_EXAMPLE = {
  mapId: "map_1",
  rect: { x: 28, y: 28, w: 10, h: 8 },
  material: "물",
  layer: "lower",
  shape: "rect",
};
const FILL_CIRCLE_EXAMPLE = {
  mapId: "map_1",
  rect: { x: 20, y: 18, w: 12, h: 12 },
  material: "물",
  layer: "lower",
  shape: "circle",
};
const ARRANGE_EXAMPLE = {
  mapId: "map_1",
  rect: { x: 6, y: 4, w: 14, h: 12 },
  material: "벤치",
  axis: "vertical",
  aisleWidth: 2,
  rowGap: 1,
  symmetric: true,
};

export type FillRegionShape = "rect" | "ellipse" | "circle";

/** rect 안 셀 마스크. circle/ellipse는 셀 중심이 타원 내부일 때만 포함. */
export function cellsInFillShape(map: GameMap, rect: Rect, shape: FillRegionShape = "rect"): Point[] {
  const inRect = cellsInRect(map, rect);
  if (shape === "rect") return inRect;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let rx = Math.max(rect.w / 2, 0.5);
  let ry = Math.max(rect.h / 2, 0.5);
  if (shape === "circle") {
    const r = Math.min(rx, ry);
    rx = r;
    ry = r;
  }
  return inRect.filter((cell) => {
    const dx = cell.x + 0.5 - cx;
    const dy = cell.y + 0.5 - cy;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  });
}

export function coerceFillShape(value: unknown, example: Record<string, unknown>): FillRegionShape {
  if (value === undefined || value === null || value === "") return "rect";
  if (value === "rect" || value === "ellipse" || value === "circle") return value;
  failWithExample("shape는 rect|ellipse|circle 중 하나여야 합니다(원형 호수=circle)", example);
}

interface MapContext {
  readonly map: GameMap;
  readonly tileset: TilesetDef;
}

function requireMapContext(draft: Project, args: Record<string, unknown>, example: Record<string, unknown>): MapContext {
  if (typeof args.mapId !== "string" || args.mapId.length === 0) failWithExample("mapId(문자열)가 필요합니다", example);
  const map = requireMap(draft, args.mapId);
  const tileset = draft.tilesets[map.tilesetId];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
  return { map, tileset };
}

interface BuildGroupAccess {
  readonly group: TileGroupMetadata;
  readonly softConfirm?: VocabSoftConfirm;
}

/** 재료 문자열(타일 label/description) → 전개 그룹. vocabId 금지. */
function requireMaterialGroup(
  tileset: TilesetDef,
  material: unknown,
  example: Record<string, unknown>,
  options: { preferRoles?: readonly string[]; requireAutotileGroup?: boolean } = {},
): BuildGroupAccess {
  if (typeof material !== "string" || material.trim().length === 0) {
    failWithExample("material(타일 라벨/설명, 예: \"물\"·\"침엽수\"·\"흰 집 벽\")이 필요합니다", example);
  }
  const access = resolveMaterialByLabel(tileset, material, {
    preferGroup: true,
    preferRoles: options.preferRoles,
    requireAutotileGroup: options.requireAutotileGroup,
  });
  if (access.status === "missing") {
    const suggestions = access.suggestions.length > 0 || access.suggestionKind === "fillable"
      ? access.suggestions
      : suggestMaterialsByLabel(tileset, material, 5);
    const labels = suggestions.map((s) => `"${s.label}"`).join(", ");
    // 있는 라벨인데 채울 수 없는 재료였다면 「비슷한 라벨」로 같은 문자열을 되돌려 주지 않는다 —
    // 그 순환이 모델을 같은 실패로 되돌리고 결국 place_props 같은 우회로 몰았다(2026-09-03 실측).
    const hint = suggestions.length === 0
      ? access.suggestionKind === "fillable"
        ? ` 이 타일셋에 면 채우기가 지원되는 재료가 없습니다. 참고문서의 바탕 대표 칸은 paint_tiles로, 여러 칸 패턴은 stamp_object 또는 stamp_layer_block으로 놓으세요. 다른 재료로 바꾸지 마세요.`
        : ` tile_query ask:"labels" 로 타일 라벨/설명을 조회하세요.`
      : access.suggestionKind === "fillable"
        ? ` 채울 수 있는 재료: ${labels} — material에 이 문자열을 넣거나, 바닥 마감이면 paint_tiles(단일 타일)를 쓰세요.`
        : ` 비슷한 라벨(그룹): ${labels} — material에 이 문자열을 넣으세요.`;
    throw new ToolError(`${access.message}${hint} — 다시 보낼 형식 예시: ${JSON.stringify(example)}`, { code: "material-not-found" });
  }
  if (access.kind !== "group") {
    throw new ToolError(
      `material "${material}" 은(는) 단일 타일("${access.matchedLabel}")입니다. 벽/지붕/길/수역은 패턴 재료 라벨이 필요합니다.`,
      { code: "material-needs-group" },
    );
  }
  if (access.status === "soft") return { group: access.group, softConfirm: access.softConfirm };
  return { group: access.group };
}

function withSoftConfirm(result: ToolExecResult, soft?: VocabSoftConfirm): ToolExecResult {
  if (!soft) return result;
  const warning = `${VOCAB_SOFT_CONFIRM_WARNING_PREFIX}: ${soft.name} — 적용하면 이 재료를 합의합니다`;
  const data = typeof result.data === "object" && result.data !== null
    ? { ...(result.data as Record<string, unknown>), vocabSoftConfirm: soft }
    : { vocabSoftConfirm: soft };
  return {
    ...result,
    summary: `${result.summary} (재료 목업 확인 대기)`,
    warnings: [...(result.warnings ?? []), warning],
    data,
  };
}

function coerceRect(value: unknown, field: string, example: Record<string, unknown>): Rect {
  if (typeof value !== "object" || value === null) failWithExample(`${field}({x,y,w,h})가 필요합니다`, example);
  const raw = value as Record<string, unknown>;
  const rect = {
    x: coerceInt(raw.x, `${field}.x`, example),
    y: coerceInt(raw.y, `${field}.y`, example),
    w: coerceInt(raw.w, `${field}.w`, example),
    h: coerceInt(raw.h, `${field}.h`, example),
  };
  if (rect.w < 1 || rect.h < 1) failWithExample(`${field}.w/h는 1 이상이어야 합니다`, example);
  return rect;
}

/**
 * 중심선(점 2개 이상) + 폭 → 띠 칸. 세로 쪽 선분은 행마다 폭 칸(가로), 가로 쪽 선분은 열마다 폭 칸(세로)을 칠한다.
 * 굽은 운하·강·대로를 fill_region 한 번에 — 행마다 사각형을 부르던 것(라운드 4 조수 시험: 운하 하나에 30~84번)을 줄인다.
 */
export function cellsAlongPath(map: GameMap, points: readonly Point[], width: number): Point[] {
  const seen = new Set<number>(); const out: Point[] = [];
  const lo = Math.floor((width - 1) / 2), hi = width - 1 - lo;
  const add = (x: number, y: number) => { if (!inMapBounds(map, x, y)) return; const k = y * map.width + x; if (!seen.has(k)) { seen.add(k); out.push({ x, y }); } };
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!, b = points[i]!; const dx = b.x - a.x, dy = b.y - a.y; const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const vertical = Math.abs(dy) >= Math.abs(dx);
    for (let t = 0; t <= steps; t += 1) {
      const cx = Math.round(a.x + (dx * t) / steps), cy = Math.round(a.y + (dy * t) / steps);
      for (let o = -lo; o <= hi; o += 1) { if (vertical) add(cx + o, cy); else add(cx, cy + o); }
    }
  }
  return out;
}

function requireRectInMap(map: GameMap, rect: Rect, field: string, example: Record<string, unknown>): void {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
    failWithExample(`${field}가 맵(${map.width}×${map.height}) 밖입니다: (${rect.x},${rect.y}) ${rect.w}×${rect.h}`, example);
  }
}

function applyEdits(map: GameMap, edits: readonly CellEdit[]): number {
  let applied = 0;
  for (const edit of edits) {
    if (!inMapBounds(map, edit.x, edit.y)) continue;
    if (edit.layer === "upper") setUpper(map, edit.x, edit.y, edit.tile);
    else setLower(map, edit.x, edit.y, edit.tile);
    applied += 1;
  }
  return applied;
}

interface ProtectedCell {
  readonly x: number;
  readonly y: number;
  readonly reason: string;
}

function cellsInRect(map: GameMap, rect: Rect): Point[] {
  const cells: Point[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (inMapBounds(map, x, y)) cells.push({ x, y });
    }
  }
  return cells;
}

function protectedPassageCells(project: Project, map: GameMap): Map<string, string> {
  const cells = new Map<string, string>();
  if (project.startMapId === map.id) cells.set(pointKey(project.startPos), "시작 위치");
  const transfers: Point[] = [];
  for (const candidate of Object.values(project.maps)) {
    for (const event of candidate.events) collectTransferTargets(event, map.id, transfers);
  }
  for (const commonEvent of project.commonEvents) collectTransferTargets(commonEvent, map.id, transfers);
  for (const point of transfers) cells.set(pointKey(point), "transfer 목적지");
  return cells;
}

function filterPassageProtectedCells(
  project: Project,
  map: GameMap,
  cells: readonly Point[],
  preview: (cell: Point) => void
): { cells: Point[]; skipped: ProtectedCell[] } {
  const protectedCells = protectedPassageCells(project, map);
  if (protectedCells.size === 0) return { cells: [...cells], skipped: [] };
  const kept: Point[] = [];
  const skipped: ProtectedCell[] = [];
  for (const cell of cells) {
    const reason = protectedCells.get(pointKey(cell));
    if (reason === undefined) {
      kept.push(cell);
      continue;
    }
    const index = cell.y * map.width + cell.x;
    const layers = cellLayerTiles(map, index);
    const shadow = shadowAt(map, index);
    preview(cell);
    const passable = isPassable(project, map, cell.x, cell.y);
    restoreCellLayers(map, index, layers, shadow);
    if (passable) kept.push(cell);
    else skipped.push({ ...cell, reason });
  }
  return { cells: kept, skipped };
}

/** 칸 하나의 1~4층·그림자를 되돌린다(미리보기 뒤 복원). 없던 선택 칸은 만들지 않는다. */
function restoreCellLayers(map: GameMap, index: number, layers: readonly [number, number, number, number], shadow: number): void {
  map.lowerTiles[index] = layers[0];
  map.upperTiles[index] = layers[2];
  setLayerTileAt(map, 2, index, layers[1]);
  setLayerTileAt(map, 4, index, layers[3]);
  setShadowAt(map, index, shadow);
}

interface LayerSnapshot {
  readonly lower: readonly number[];
  readonly upper: readonly number[];
  readonly lowerOverlay?: readonly number[];
  readonly upperOverlay?: readonly number[];
  readonly shadow?: readonly number[];
}

function snapshotLayers(map: GameMap): LayerSnapshot {
  return {
    lower: map.lowerTiles.slice(), upper: map.upperTiles.slice(),
    lowerOverlay: map.lowerOverlayTiles?.slice(), upperOverlay: map.upperOverlayTiles?.slice(), shadow: map.shadowBits?.slice(),
  };
}

/** 스냅샷과 비교해 1~4층·그림자 중 하나라도 바뀐 칸 수. */
function changedLayerCells(map: GameMap, before: LayerSnapshot): number {
  let count = 0;
  for (let index = 0; index < before.lower.length; index += 1) {
    const now = cellLayerTiles(map, index);
    if (now[0] !== before.lower[index] || now[2] !== before.upper[index]
      || now[1] !== (before.lowerOverlay?.[index] ?? -1) || now[3] !== (before.upperOverlay?.[index] ?? -1)
      || shadowAt(map, index) !== (before.shadow?.[index] ?? 0)) count += 1;
  }
  return count;
}

function protectedSkipWarnings(skipped: readonly ProtectedCell[]): string[] | undefined {
  if (skipped.length === 0) return undefined;
  const seen = new Set<string>();
  const unique = skipped.filter((cell) => {
    const key = `${cell.x},${cell.y}:${cell.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const samples = unique.slice(0, 3).map((cell) => `(${cell.x},${cell.y})은 ${cell.reason}라 제외했습니다`);
  const extra = unique.length > samples.length ? ` 외 ${unique.length - samples.length}칸` : "";
  return [`${samples.join(", ")}${extra}`];
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

// 채우기가 덮어쓰면 안 되는 저작물 — 역할 능력 `structure`(벽·지붕·건물·성채). 2026-09-03 실측: 8×6 모래 채움이
// 집 한 채의 벽(lower)을 모래로 바꾸고 지붕(upper)을 지웠는데 조수는 「오브젝트는 그대로」라고 답했다.
function structureGroupNameForTile(tileset: TilesetDef, tile: number): string | null {
  for (const group of tileset.tileGroups ?? []) {
    if (roleCapabilities(tileset, group.role).structure && group.tileIds.includes(tile)) return group.name;
  }
  return null;
}

function splitProtectedFillCells(
  cells: readonly Point[],
  reasonFor: (cell: Point) => string | null,
): { cells: Point[]; skipped: ProtectedCell[] } {
  const kept: Point[] = [];
  const skipped: ProtectedCell[] = [];
  for (const cell of cells) {
    const reason = reasonFor(cell);
    if (reason === null) kept.push(cell);
    else skipped.push({ ...cell, reason });
  }
  return { cells: kept, skipped };
}

/** 이벤트(NPC·간판·문)가 서 있는 칸. 통행 불가 재료가 그 위를 덮으면 이벤트가 물속·벽속에 갇힌다. */
function splitEventCells(map: GameMap, cells: readonly Point[]): { cells: Point[]; skipped: ProtectedCell[] } {
  const occupied = new Map<string, string>();
  for (const event of map.events) occupied.set(`${event.x},${event.y}`, `이벤트(${event.id})`);
  if (occupied.size === 0) return { cells: [...cells], skipped: [] };
  const kept: Point[] = [];
  const skipped: ProtectedCell[] = [];
  for (const cell of cells) {
    const reason = occupied.get(pointKey(cell));
    if (reason === undefined) kept.push(cell);
    else skipped.push({ ...cell, reason });
  }
  return { cells: kept, skipped };
}

/** 타일 혼자 놓였을 때(상위 없음) 어느 방향으로도 지나갈 수 없는가. */
function tileBlocksPassage(tileset: TilesetDef, tile: number): boolean {
  const pass = tilePassability(tileset, tile, TILE.EMPTY);
  return !(pass.up || pass.down || pass.left || pass.right);
}

/**
 * 통행 불가 채움이 시작 위치를 사방으로 막으면, 채움 집합에서 한 줄을 빼 밖으로 나가는 통로를 남긴다.
 * 시작 칸 하나만 보호하면 플레이어는 첫 프레임부터 갇힌다(2026-09-03 실측: 5×5 물, 이웃 통행 0).
 * 방향은 채움 밖 통행 가능 칸까지 가장 짧은 쪽을 고른다. 통로 칸은 현재 타일 그대로 둔다.
 */
function reserveStartExit(project: Project, map: GameMap, cells: readonly Point[]): { cells: Point[]; corridor: Point[] } {
  if (project.startMapId !== map.id) return { cells: [...cells], corridor: [] };
  const start = project.startPos;
  const fill = new Set(cells.map(pointKey));
  // 이벤트(NPC·간판)가 선 칸은 타일이 통행 가능해도 플레이어가 지나갈 수 없다 — 출구로 세지 않는다.
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  const walkable = (x: number, y: number): boolean =>
    inMapBounds(map, x, y) && !occupied.has(`${x},${y}`) && isPassable(project, map, x, y);
  const openAfterFill = (x: number, y: number): boolean => !fill.has(`${x},${y}`) && walkable(x, y);
  const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  if (dirs.some((dir) => openAfterFill(start.x + dir.x, start.y + dir.y))) return { cells: [...cells], corridor: [] };
  let best: Point[] | null = null;
  for (const dir of dirs) {
    const path: Point[] = [];
    let x = start.x + dir.x;
    let y = start.y + dir.y;
    let reachesOutside = false;
    while (inMapBounds(map, x, y)) {
      if (!fill.has(`${x},${y}`)) {
        reachesOutside = walkable(x, y);
        break;
      }
      // 통로가 될 칸은 지금도 지나갈 수 있어야 한다(나무·벽·이벤트 위는 비워도 통로가 안 된다).
      if (!walkable(x, y)) break;
      path.push({ x, y });
      x += dir.x;
      y += dir.y;
    }
    if (!reachesOutside || path.length === 0) continue;
    if (!best || path.length < best.length) best = path;
  }
  if (!best) return { cells: [...cells], corridor: [] };
  const corridor = new Set(best.map(pointKey));
  return { cells: cells.filter((cell) => !corridor.has(pointKey(cell))), corridor: best };
}

function collectTransferTargets(value: unknown, mapId: string, out: Point[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectTransferTargets(item, mapId, out);
    return;
  }
  if (!isPlainRecord(value)) return;
  if (value.kind === "transfer" && value.mapId === mapId && typeof value.x === "number" && typeof value.y === "number") {
    out.push({ x: value.x, y: value.y });
  }
  for (const child of Object.values(value)) collectTransferTargets(child, mapId, out);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 벽 어휘 셀 스캔 — build_roof(자동 감지)/place_door/place_window가 소비한다.
// 벽은 하위 레이어 시공이 규약이므로 lowerTiles만 본다.
export function wallCellsAt(map: GameMap, group: TileGroupMetadata): Point[] {
  const members = new Set<number>(group.tileIds);
  const cells: Point[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (members.has(map.lowerTiles[y * map.width + x])) cells.push({ x, y });
    }
  }
  return cells;
}

// soft 벽 시공 직후에도 문/지붕이 동작하도록 origin 과 무관하게 role=wall 그룹을 본다.
function wallRoleGroups(tileset: TilesetDef): TileGroupMetadata[] {
  return (tileset.tileGroups ?? []).filter((group) => group.role === "wall");
}

function detectWallRegion(map: GameMap, tileset: TilesetDef): Rect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;
  for (const group of wallRoleGroups(tileset)) {
    for (const cell of wallCellsAt(map, group)) {
      found = true;
      if (cell.x < minX) minX = cell.x;
      if (cell.y < minY) minY = cell.y;
      if (cell.x > maxX) maxX = cell.x;
      if (cell.y > maxY) maxY = cell.y;
    }
  }
  return found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
}

function isWallCell(map: GameMap, tileset: TilesetDef, x: number, y: number): boolean {
  if (!inMapBounds(map, x, y)) return false;
  const tile = map.lowerTiles[y * map.width + x];
  return wallRoleGroups(tileset).some((group) => group.tileIds.includes(tile));
}

const buildWall: ToolDefinition = {
  name: "build_wall",
  description:
    "material(타일 라벨/설명)로 벽을 시공한다(v3). rect에 정의된 확장 패턴 전개. 그룹 id 금지. 시공 후 place_door/place_window → build_roof. 야외 벽·울타리·탑은 지원하는 확장 패턴이 정의된 재료만 build_wall로 시공한다. 패턴 없는 고정형 울타리 소품은 place_props, 안뜰·광장 바닥은 fill_region(오토타일 재료). 실내/방 맵 요청에는 쓰지 말 것(실내 세션 툴). 집 외장은 author_house.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      rect: {
        type: "object", description: "시공 영역(맵 좌표)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      material: { type: "string", description: "벽 재료: 타일 라벨/설명(예: \"흰 집 벽\"). 그룹 id 금지" },
    },
    required: ["mapId", "rect", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, WALL_EXAMPLE);
    const rect = coerceRect(args.rect, "rect", WALL_EXAMPLE);
    requireRectInMap(map, rect, "rect", WALL_EXAMPLE);
    const { group, softConfirm } = requireMaterialGroup(tileset, args.material, WALL_EXAMPLE, { preferRoles: ["wall"] });
    const profile = tilesetGrammarProfile(tileset);
    let expansion: ReturnType<typeof expandWall>;
    try {
      expansion = expandWall(tileset, group, rect, profile, WALL_EXAMPLE);
    } catch (error) {
      if (!(error instanceof ToolError) || error.code !== "pattern-undefined") throw error;
      // 「T1b 위저드에서 패턴을 정의하라」 는 모델이 할 수 없는 일이다 — 같은 호출이 8번 반복됐다(2026-09-24
      // 추격 호러: 실내 칩셋 '크림 회벽' 으로 방 벽을 세우려다 방 5개가 벽 없는 맨바닥으로 남았다).
      // 쓸 수 있는 재료와, 실내라면 방을 통째로 짓는 경로를 짚는다.
      const buildable = wallRoleGroups(tileset).filter((entry) => (entry.patternGrammar?.parts.length ?? 0) > 0).map((entry) => `"${entry.name}"`);
      const interior = map.climate?.mode === "indoor" || /interior|inside|실내/iu.test(`${tileset.id} ${tileset.name ?? ""}`);
      throw new ToolError(
        `'${group.name}' 은(는) 벽 전개 패턴이 없어 build_wall 로 세울 수 없습니다. ` +
          (buildable.length ? `이 타일셋에서 build_wall 로 세울 수 있는 벽: ${buildable.slice(0, 8).join(", ")}. ` : "이 타일셋에는 build_wall 로 세울 수 있는 벽 재료가 없습니다. ") +
          (interior ? "실내 방(벽·문·가구)은 build_hand_interior_room 으로 지으세요 — 방마다 새 mapId 로 짓고 create_transfer_pair 로 잇습니다. " : "") +
          "같은 재료로 다시 부르지 마세요.",
        { code: "pattern-undefined", mapId: map.id },
      );
    }
    const applied = applyEdits(map, expansion.edits);
    return withSoftConfirm({
      summary: `${map.name}에 '${group.name}' 벽 ${rect.w}×${rect.h}(${applied}칸) 시공 — 다음 공정: place_door/place_window → build_roof.`,
      data: { wallRegion: expansion.region, cells: applied, groupId: group.id },
    }, softConfirm);
  },
};

const buildRoof: ToolDefinition = {
  name: "build_roof",
  description:
    "지붕 어휘로 벽 위에 지붕을 얹는다(v3 공정 3단계). wallRect 생략 시 맵의 벽 어휘 셀을 스캔해 자동 감지한다. 벽이 없으면 거부 — 먼저 build_wall로 벽을 지으라. 처마/사선 오버레이 레이어는 어휘 layerHome(perCell) 규약으로 자동 판정된다. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      material: { type: "string", description: "지붕 재료: 타일 라벨/설명. 그룹 id 금지" },
      wallRect: {
        type: "object", description: "지붕을 얹을 벽 영역(생략 시 자동 감지)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
      },
    },
    required: ["mapId", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, ROOF_EXAMPLE);
    const { group, softConfirm } = requireMaterialGroup(tileset, args.material, ROOF_EXAMPLE, { preferRoles: ["roof"] });
    const wallRegion = args.wallRect !== undefined ? coerceRect(args.wallRect, "wallRect", ROOF_EXAMPLE) : detectWallRegion(map, tileset);
    if (!wallRegion) {
      throw new ToolError(
        `지붕을 얹을 벽이 없습니다. 먼저 build_wall로 벽을 지으세요. — 다시 보낼 형식 예시: ${JSON.stringify(ROOF_EXAMPLE)}`,
        { code: "no-wall-for-roof", mapId: map.id }
      );
    }
    const profile = tilesetGrammarProfile(tileset);
    const expansion = expandRoof(tileset, group, wallRegion, profile, ROOF_EXAMPLE);
    const applied = applyEdits(map, expansion.edits);
    return withSoftConfirm({
      summary: `${map.name}의 벽(${wallRegion.x},${wallRegion.y} ${wallRegion.w}×${wallRegion.h}) 위에 '${group.name}' 지붕 ${applied}칸을 얹음.`,
      data: { roofRegion: expansion.region, wallRegion, cells: applied, groupId: group.id },
    }, softConfirm);
  },
};

// 문/창문 공용: 대상 셀이 벽 어휘 셀이 아니면 거부(공정 순서 강제).
function placeOnWall(kind: "door" | "window", draft: Project, args: Record<string, unknown>, example: Record<string, unknown>): ToolExecResult {
  const { map, tileset } = requireMapContext(draft, args, example);
  const at = coercePoint(args.at, "at", example);
  const { group, softConfirm } = requireMaterialGroup(tileset, args.material, example, { preferRoles: ["prop"] });
  if (!isWallCell(map, tileset, at.x, at.y)) {
    throw new ToolError(
      `(${at.x},${at.y})은(는) 벽 셀(벽 어휘 타일)이 아닙니다. 먼저 build_wall로 벽을 짓고 벽 위 좌표를 지정하세요. — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
      { code: kind === "door" ? "door-needs-wall" : "window-needs-wall", mapId: map.id, x: at.x, y: at.y }
    );
  }
  const profile = tilesetGrammarProfile(tileset);
  const home = vocabLayerHomeFor(group, profile);
  const edits = doorLikeEdits(tileset, group, at, home);
  const applied = applyEdits(map, edits);
  const label = kind === "door" ? "문" : "창문";
  return withSoftConfirm({
    summary: `${map.name} (${at.x},${at.y}) 벽에 '${group.name}' ${label} ${applied}칸 설치.`,
    data: { at, cells: applied, groupId: group.id,
      ...(kind === 'door' ? { front: { x: at.x, y: at.y + 1 }, transferEndpoint: { mapId: map.id, x: at.x, y: at.y + 1, doorAt: at } } : {}),
    },
  }, softConfirm);
}

// 문 어휘가 세로 패턴(1×2 입구 규약)이면 위 칸(상단)+지정 칸(하단)으로 전개, 아니면 지정 칸 1칸.
function doorLikeEdits(tileset: TilesetDef, group: TileGroupMetadata, at: Point, home: VocabLayerHome): CellEdit[] {
  const grammar = group.patternGrammar;
  if (grammar?.kind === "vertical_expandable" && grammar.parts.length > 0) {
    const top = grammar.parts.find((part) => part.role === "top" || part.role === "topCap")?.tileIds[0];
    const bottom = grammar.parts.find((part) => part.role === "bottom" || part.role === "bottomCap")?.tileIds[0] ?? group.tileIds[group.tileIds.length - 1];
    const edits: CellEdit[] = [];
    if (top !== undefined) edits.push({ x: at.x, y: at.y - 1, layer: layerForVocabTile(tileset, home, top), tile: top });
    if (bottom !== undefined) edits.push({ x: at.x, y: at.y, layer: layerForVocabTile(tileset, home, bottom), tile: bottom });
    return edits;
  }
  const tile = group.tileIds[0];
  return tile === undefined ? [] : [{ x: at.x, y: at.y, layer: layerForVocabTile(tileset, home, tile), tile }];
}

const placeDoor: ToolDefinition = {
  name: "place_door",
  description:
    "문 어휘를 벽 셀에 설치한다(v3 공정 2단계). 대상 셀이 벽(벽 어휘 타일)이 아니면 거부. 문 어휘가 세로 1×2 패턴이면 위 칸까지 자동 전개. layer 인자 없음 — 어휘 layerHome이 결정. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의. 문 시각 배치의 정본 툴. 실제 맵 이동은 create_transfer_pair. 결과 data.transferEndpoint를 a/b에 그대로 넣어 문앞을 연결한다. 문 그림 칸과 밟는 문앞 칸을 혼동하지 않는다.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      at: { type: "object", description: "문 하단 칸(벽 셀)", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      material: { type: "string", description: "문 재료: 타일 라벨/설명(예: \"문\"). 그룹 id 금지" },
    },
    required: ["mapId", "at", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    return placeOnWall("door", draft, args, DOOR_EXAMPLE);
  },
};

const placeWindow: ToolDefinition = {
  name: "place_window",
  description:
    "창문 어휘를 벽 셀에 설치한다(v3 공정 2단계). 대상 셀이 벽(벽 어휘 타일)이 아니면 거부. layer 인자 없음 — 창문 같은 투명 소품은 어휘 layerHome(upper/perCell)이 벽을 보존하며 겹친다. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      at: { type: "object", description: "창문 칸(벽 셀)", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      material: { type: "string", description: "창문 재료: 타일 라벨/설명(예: \"창문\"). 그룹 id 금지" },
    },
    required: ["mapId", "at", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    return placeOnWall("window", draft, args, WINDOW_EXAMPLE);
  },
};

// 어휘 그룹과 연결된 오토타일 정의(variantMap) — 멤버 타일 겹침이 가장 큰 것을 고른다.
function autotileGroupForVocab(tileset: TilesetDef, group: TileGroupMetadata): AutotileGroup | null {
  const vocabTiles = new Set<number>(group.tileIds);
  let best: AutotileGroup | null = null;
  let bestOverlap = 0;
  for (const candidate of autotileGroupsForTileset(tileset)) {
    const overlap = candidate.memberTileIds.filter((tile) => vocabTiles.has(tile)).length;
    if (overlap > bestOverlap) {
      best = candidate;
      bestOverlap = overlap;
    }
  }
  return best;
}

const layPath: ToolDefinition = {
  name: "lay_path",
  description:
    "길 어휘로 경유점(2개 이상)을 잇는 길을 깐다(v3 공정 4단계). 월드맵 연결 붓은 material=길 하나로 초원·사막·설원 바탕을 자동으로 맞추며 강 횡단은 방향에 맞는 다리로 놓는다(4방향 길 지원). 정확한 경로·폭은 fill_region(material=길,path,width)을 쓴다. 어휘에 8-이웃 variantMap 오토타일 정의가 필수 — 없으면 거부하고, 오류가 돌려주는 정확한 fill_region 대안을 그대로 재시도한다. 상위 레이어 4-이웃 길은 문서 계약에 따라 fill_region(...,layer:'upper') 또는 paint_tiles로 놓는다. 외곽+inner corner 변형을 자동 재계산한다. 경로가 집·벽 같은 건물을 만나면 그 칸을 덮지 않고 자동으로 우회한다(저작물 보호). 나무·울타리는 치우고, 물은 우회 우선·불가 시 건넌다. 우회로가 없어 길이 끊기면 막힌 좌표와 함께 실패한다. naturalness 0~1(기본 0.5), seed로 결정론 재현. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      points: {
        type: "array", description: "경유점 [{x,y},...] 2개 이상",
        items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      },
      material: { type: "string", description: "길 재료: 타일 라벨/설명(예: \"흙길\"). 그룹 id 금지" },
      naturalness: { type: "number", description: "0~1. 0=직선, 0.5=기본, 0.8+=구불구불" },
      seed: { type: "integer", description: "결정론 시드(생략 가능)" },
    },
    required: ["mapId", "points", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, PATH_EXAMPLE);
    const points = coercePointArray(args.points, "points", PATH_EXAMPLE);
    if (points.length < 2) failWithExample("points는 경유점 2개 이상이어야 합니다", PATH_EXAMPLE);
    const { group, softConfirm } = requireMaterialGroup(tileset, args.material, PATH_EXAMPLE, { preferRoles: ["terrain"] });
    const autotile = autotileGroupForVocab(tileset, group);
    const worldmapAuto = worldmapMaterialGroup(tileset, args.material)?.id === group.id;
    const fallbackLayer = autotile && autotileGroupLayer(autotile) === "upper" ? "upper" : "lower";
    const fillFallback = JSON.stringify({ mapId: map.id, material: group.name, path: points, width: 2, layer: fallbackLayer });
    if (autotile && (autotile.neighborhood ?? 4) === 4 && !group.id.startsWith('worldmap-brush-road-')) {
      throw new ToolError(
        `이 재료는 4방향 오토타일입니다. 같은 재료와 경유점은 이 정확한 fill_region 호출로 놓으세요: ${fillFallback}. 8방향으로 재저작하거나 다른 바닥으로 바꾸지 마세요.`,
        { code: "path-use-fill-region", mapId: map.id }
      );
    }
    if (!autotile || (autotile.neighborhood ?? 4) !== 8 && !group.id.startsWith('worldmap-brush-road-')) {
      throw new ToolError(
        `길 어휘 '${group.name}'(${group.id})에 8-이웃 variantMap 오토타일 정의가 없습니다. 상위 레이어 4-이웃 길은 문서 계약상 이 정확한 fill_region 호출을 사용하세요: ${fillFallback}. 8방향 정의가 필요한 재료라면 승인 시에만 오토타일 편집기로 추가하세요. — 다시 보낼 형식 예시: ${JSON.stringify(PATH_EXAMPLE)}`,
        { code: "path-needs-autotile", mapId: map.id }
      );
    }
    const naturalness = naturalnessArg(args);
    const signature = `lay_path|${map.id}|${map.width}x${map.height}|${naturalnessLabel(naturalness)}|${points.map((point) => `${point.x},${point.y}`).join(";")}`;
    const result = wobblePath(points, naturalness, rngForTool(args, signature));
    const body = autotile.variantMap[String(255)] ?? group.tileIds[0];
    const mask = roadObstacleMaskFor(draft, map);
    const routed = repairRoadPath(map, mask, result.path);
    const gapFailure = roadGapFailure(routed);
    if (gapFailure) throw new ToolError(gapFailure, { code: "path-blocked", mapId: map.id });
    const repair = withWidthCells(routed, filterRoadWidthCells(mask, result.widthCells));
    const painted: Point[] = [];
    for (const cell of repair.cells) {
      if (!inMapBounds(map, cell.x, cell.y)) continue;
      paintRoadGround(map, tileset, cell.x, cell.y, worldmapAuto ? worldmapAutoTile(map, tileset, body, cell.x, cell.y, repair.cells) : body);
      painted.push(cell);
    }
    if (painted.length === 0) {
      if (repair.blocked > 0) {
        throw new ToolError(
          `요청 경로 ${repair.blocked}칸이 전부 통행 불가라 길을 한 칸도 깔지 못했습니다`
          + ` — 경유점을 건물·물 밖으로 옮기세요.`,
          { code: "path-blocked", mapId: map.id }
        );
      }
      failWithExample("경로가 전부 맵 밖입니다 — points 좌표를 맵 안으로 고치세요", PATH_EXAMPLE);
    }
    const reshaped = worldmapAuto ? shapeAllAutotileGroupsAround(map, autotileGroupsForTileset(tileset), painted)
      : resolveAutotile(autotile, painted, map, (x, y) => mask(x, y) !== "structure");
    const warnings = roadRepairWarnings(repair);
    return withSoftConfirm({
      summary: `${map.name}에 '${group.name}' 길 ${painted.length}칸 — 자연도 ${naturalnessLabel(naturalness)}, 오토타일 재계산 ${reshaped}칸(inner corner 포함).`
        + (repair.blocked > 0 ? ` — 통행 불가 ${repair.blocked}칸 우회` : ""),
      ...(warnings.length > 0 ? { warnings } : {}),
      data: {
        detouredSegments: repair.detours,
        disconnectedSegments: repair.gaps,
        endpointBlocked: repair.startBlocked || repair.endBlocked,
        groupId: group.id,
        obstacleCells: repair.blocked,
        pathCells: painted.length,
        reshaped,
        structureCells: repair.structureCells,
        waterCrossings: repair.waterCrossings.length,
      },
    }, softConfirm);
  },
};

/**
 * 맵 대부분을 한 바닥으로 채운 뒤 아무것도 올리지 않으면 플레이어에게는 「빈 판」만 보인다.
 * 2026-09-24 꿈 세계 도그푸딩: create_map → fill_region → upsert_event 만으로 세계 5개를 끝내
 * 촛불 숲·계단 바다·시계 사막이 전부 흙 한 장이었고 조사 대상은 맨바닥 위 투명 칸이었다.
 * 막지 않고, 다음 단계를 알려 준다.
 */
function bareBoardWarnings(map: GameMap, filledCells: number, layer: string): string[] {
  const cells = map.width * map.height;
  if (layer !== "lower" || cells < 64 || filledCells < cells * 0.6) return [];
  if (!isBareBoard(mapTexture(map))) return [];
  return [
    `${map.name} 은 지금 바닥 한 가지뿐인 빈 판입니다 — 이 장소를 알아보게 하는 사물·지형(나무·바위·가구·기둥·장식)을 ` +
      `place_props(material:"타일 라벨")나 paint_tiles 로 깔고, 조사할 사물 이벤트는 그 사물 타일 칸이나 바로 옆에 두세요.`,
  ];
}

const placeProps: ToolDefinition = {
  name: "place_props",
  description:
    "소품을 area 안에 산포한다(v3). material=타일 라벨/설명(예: \"침엽수\", \"나무 상자\", \"과일박스\"). 그룹 id·vocabId 금지. 물·길·통행 불가·upper 점유 칸 스킵. 면 채우기는 fill_region.  밀도는 enum 으로 직접: 숲=density:\"dense\", 울창·빽빽·통행 불가=\"impassable\", 드문드문·가로수=\"sparse\"(코드가 문장을 읽지 않는다). 숲마을 칩(forest_harmony)에서 dense·impassable 은 침엽수 산포가 아니라 굽이숲 수관과 3줄 밑동을 깐다. 같은 area 에 place_props 는 1회. 물·호수 칸 위 금지 — area 는 호수 바깥 육지만, 호수를 채운 뒤 둘레에 깔 것. 장식 박스·나무상자·나무박스는 material:\"나무 상자\"(count:N), 과일박스는 material:\"과일박스\" — small-props 가방이나 place_chest 로 대체 금지. 마을 규모 숲은 author_village({forestDensity}). 등불·장식 소품도 이 툴."
    + "숲은 모델이 density:sparse|normal|dense|impassable 을 넣으면 count·packing을 면적에서 자동 계산한다"
    + "(sparse=15%, normal=40%, 숲=dense 80%, 울창/빽빽/통행 불가=impassable 100%). "
    + "사용자 문장을 코드가 읽지 않는다 — 밀도 enum을 생략하면 일반 산포(count 필수). "
    + "일반 소품을 빽빽하게·통행 불가로 놓을 때는 packing:\"dense\" + count=area 면적(결과에 남은 통행 칸 수).",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: {
        type: "object",
        description: "산포 영역(맵 좌표). 마을 산포는 한 칸에 몰지 말고 구역별로 넓은 area를 여러 번",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      material: { type: "string", description: "소품 재료: 타일 라벨/설명(예: \"침엽수\", \"나무 상자\"). 그룹 id 금지" },
      count: { type: "integer", description: "배치 개수. 나무 density를 주면 생략 가능" },
      density: {
        type: "string",
        enum: ["sparse", "normal", "dense", "impassable"],
        description: "나무 전용 밀도. 모델이 넣는다(숲=dense, 울창/통행 불가=impassable). count·packing을 area 면적에서 계산. 사용자 문장을 코드가 읽지 않는다.",
      },
      minGap: { type: "integer", description: "간격(기본 1; 마을 산포는 2+ 권장)" },
      naturalness: { type: "number", description: "0~1(기본 0.5). <0.3=한곳 뭉침(uniform), 0.3~0.7=poisson 산포, >0.7=cluster" },
      packing: {
        type: "string",
        enum: ["natural", "dense"],
        description: "\"dense\"=빈틈 없이 맞닿게 채워 통행을 막는다(간격 0, 자연도 무시). 기본 \"natural\"",
      },
      seed: { type: "integer" },
    },
    required: ["mapId", "area", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, PROPS_EXAMPLE);
    const area = coerceRect(args.area, "area", PROPS_EXAMPLE);
    requireRectInMap(map, area, "area", PROPS_EXAMPLE);
    if (args.trunkVisible !== undefined || args.origins !== undefined) {
      failWithExample("trunkVisible·origins는 숲 합성 내부 전용이라 place_props 인자로 받지 않습니다(density로 숲을 심으세요)", PROPS_EXAMPLE);
    }
    const density = coercePlacePropsForestDensity(args.density);
    const material = typeof args.material === "string" ? args.material.trim() : "";
    if (!material) failWithExample("material(타일 라벨/설명, 예: \"침엽수\"·\"나무 상자\")이 필요합니다", PROPS_EXAMPLE);
    const resolved = resolveMaterialByLabel(tileset, material, {
      preferGroup: true,
      preferRoles: ["prop", "terrain"],
    });
    const forestMaterial = resolved.status === "missing"
      ? undefined
      : forestTreeKindFromResolvedMaterial({
        kind: resolved.kind,
        ...(resolved.kind === "group" ? { groupId: resolved.group.id, groupName: resolved.group.name } : {}),
        matchedLabel: resolved.matchedLabel,
      });
    if (density && resolved.status !== "missing" && !forestMaterial) {
      failWithExample("density는 침엽수/활엽수 material에만 쓸 수 있습니다", PROPS_EXAMPLE);
    }
    // 왜 density=dense·impassable 이 다른 경로인가: 숲은 나무 한 재료를 밀집하는 것이 아니라
    // 수종·덤불·하층식생이 섞인 지형이다(렌더 실측: 한 재료 dense 는 산울타리 밭으로 읽혔다).
    if (density && forestMaterial && args.count === undefined && forestCompositionApplies(density)) {
      const seed = args.seed === undefined ? 11 : coerceInt(args.seed, "seed", PROPS_EXAMPLE);
      const composition = plantForestComposition(draft, {
        mapId: map.id,
        area,
        density,
        seed,
        primary: forestMaterial,
      });
      // 보고는 심은 것을 이름대로 적는다 — 덤불을 나무로 세면 실적 부풀리기다.
      const measured = measureForestArea(map, [area]);
      // 경계에서 걸어 들어올 수 있는 칸 수를 함께 적는다 — 수관 타일은 통행 가능이라
      // "나무 몇 칸"만으로는 지나갈 수 있는지 말할 수 없다(impassable 은 이 값이 0이어야 한다).
      const reachable = reachableCellCount(draft, map, area);
      return {
        summary: `${map.name} (${area.x},${area.y}) ${area.w}×${area.h} 숲 합성(density=${density})`
          + ` — ${composition.materials.join("·") || "배치 없음"} ${composition.placed}그루,`
          + ` 숲 덮은 비율 ${Math.round(measured.forestCoverage * 100)}%`
          + ` (나무 ${measured.treeCells}칸 = ${Math.round(measured.treeCoverage * 100)}%,`
          + ` 덤불 ${measured.bushCells}칸, 하층식생 ${measured.undergrowthCells}칸,`
          + ` 밖에서 걸어 들어올 수 있는 칸 ${reachable}).`,
        data: {
          placed: composition.placed,
          requested: composition.requested,
          packing: "dense",
          density,
          materials: composition.materials,
          forestCoverage: measured.forestCoverage,
          treeCoverage: measured.treeCoverage,
          treeCells: measured.treeCells,
          bushCells: measured.bushCells,
          undergrowthCells: measured.undergrowthCells,
          closedGaps: composition.closedGaps,
          reachableCells: reachable,
        },
        ...(composition.warnings.length > 0 ? { warnings: [...composition.warnings] } : {}),
      };
    }
    const plan = density && forestMaterial
      ? forestPlacementPlan({ area, footprintCells: treeFootprintCells(forestMaterial), density })
      : undefined;
    const count = args.count === undefined
      ? plan?.count ?? failWithExample("count가 필요합니다(나무는 density로 대신할 수 있습니다)", PROPS_EXAMPLE)
      : coerceInt(args.count, "count", PROPS_EXAMPLE);
    if (count < 1) failWithExample("count는 1 이상이어야 합니다", PROPS_EXAMPLE);
    const minGap = plan?.minGap
      ?? (typeof args.minGap === "number" && Number.isInteger(args.minGap) ? args.minGap : undefined);
    const seed = args.seed === undefined ? undefined : coerceInt(args.seed, "seed", PROPS_EXAMPLE);
    const packing = density
      ? forestPackingFor(density)
      : (args.packing === undefined ? undefined : coercePacking(args.packing));
    return placePropsOnDraft(draft, {
      mapId: map.id,
      area,
      material,
      count,
      ...(minGap === undefined ? {} : { minGap }),
      naturalness: plan?.naturalness ?? naturalnessArg(args),
      ...(seed === undefined ? {} : { seed }),
      ...(packing === undefined ? {} : { packing }),
    });
  },
};

function coercePlacePropsForestDensity(value: unknown): ForestDensity | undefined {
  if (value === undefined) return undefined;
  if (value === "sparse" || value === "normal" || value === "dense" || value === "impassable") return value;
  failWithExample("density는 sparse|normal|dense|impassable 중 하나여야 합니다", PROPS_EXAMPLE);
}

function coercePacking(value: unknown): ScatterPacking {
  if (value === "natural" || value === "dense") return value;
  failWithExample('packing은 "natural" 또는 "dense"여야 합니다', PROPS_EXAMPLE);
}

function fillBodyTile(group: TileGroupMetadata, autotile: AutotileGroup | null): number | null {
  const center = group.patternGrammar?.parts.find((part) => part.role === "center")?.tileIds[0];
  return center ?? (autotile ? autotile.variantMap[String(255)] : undefined) ?? flatFillBodyTile(group) ?? group.tileIds[0] ?? null;
}

/** 문법 없는 바닥 그룹의 몸통 — 설명의 「몸통 N」「대표 바디 N」이 이기고, 3×3 테두리 세트면 가운데. */
function flatFillBodyTile(group: TileGroupMetadata): number | undefined {
  if (group.patternGrammar) return undefined;
  const named = /(?:몸통|대표\s*바디)\s*(\d+)/u.exec(group.description ?? "");
  if (named && group.tileIds.includes(Number(named[1]))) return Number(named[1]);
  return flatNineSlice(group)?.[1]?.[1];
}

/**
 * 문법 없는 3×3 테두리 바닥(카펫·돗자리·단상)의 9칸 — tileIds 끝 9개가 시트에서 3×3 블록일 때만.
 * [행][열] = [위·가운데·아래][왼·가운데·오른].
 */
function flatNineSlice(group: TileGroupMetadata): number[][] | undefined {
  if (group.patternGrammar) return undefined;
  const text = `${group.name} ${group.description ?? ""}`;
  if (group.tileIds.length !== 9 && !/3×3|3x3|9-?슬라이스|테두리/u.test(text)) return undefined;
  if (group.tileIds.length < 9) return undefined;
  const t = group.tileIds.slice(-9);
  const stride = t[3]! - t[0]!;
  if (stride <= 2) return undefined;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    if (t[row * 3 + col] !== t[0]! + row * stride + col) return undefined;
  }
  return [t.slice(0, 3), t.slice(3, 6), t.slice(6, 9)];
}

function assertFillRegionGroup(tileset: TilesetDef, group: TileGroupMetadata, autotile: AutotileGroup | null): void {
  const kind = group.patternGrammar?.kind;
  if (autotile || kind === "autotile_3x3" || kind === "animated_terrain" || isFlatFillGroup(tileset, group)) return;
  throw new ToolError(
    `fill_region은 autotile_3x3/animated_terrain 지형 그룹만 채울 수 있습니다: ${group.name}(${group.id})`,
    { code: "fill-needs-autotile-group" }
  );
}

const PLAIN_WATER_MATERIAL = /^(물|맑은 물|호수|호수 물|연못|못|물웅덩이|water|lake|pond)$/iu;
/** 흔한 물 낱말 → 시트의 움직이는 물 오토타일 어휘(animated_terrain 수역). 없으면 null(라벨 검색으로 간다). */
function plainWaterMaterialGroup(tileset: TilesetDef, material: unknown): TileGroupMetadata | null {
  if (typeof material !== "string" || !PLAIN_WATER_MATERIAL.test(material.trim())) return null;
  return (tileset.tileGroups ?? []).find((group) => group.role === "water" && group.patternGrammar?.kind === "animated_terrain") ?? null;
}

const fillRegion: ToolDefinition = {
  name: "fill_region",
  description:
    "material(타일 라벨/설명, 예: \"물\"/\"잔디\")로 영역을 채운다(v3). 그룹 id 금지. 숲마을·기후 시트의 \"물\"·\"호수\"·\"연못\"도 움직이는 물 오토타일(0~212, 물가 자동 합성)로 깐다. shape: rect(기본·사각형 전체)|ellipse(rect 안 타원)|circle(rect 안 내접 원). 원형/둥근 호수는 반드시 shape=circle(또는 ellipse). rect만 쓰면 네모 호수가 된다. 굽은 강·운하·넓은 굽은 길은 rect 대신 path(중심선 점)+width 로 한 번에 칠한다. 호수·강·바닥·지면 면 작업용(실내 나무 바닥·돌바닥·카펫처럼 오토타일이 아닌 통행 바닥도 채운다 — 3×3 테두리 카펫은 가장자리에 테두리). 나무/바위/꽃은 place_props. lower 기본. 벽과 1칸 틈이 있으면 그 틈을 메워 벽에 붙인다(맵 가장자리 1칸은 그대로). transfer/시작 위치 보호 칸은 제외+warning. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의. 타원=ellipse. 물·잔디·바닥 면은 이 툴, 벽은 build_wall, 길은 paint_road. " + FOUR_LAYER_GUIDANCE_SHORT + " 1층을 칠하면 그 칸의 2층 장식을 비운다.",
  mode: "write",
  version: 3,
  invalidArgsExample: FILL_CIRCLE_EXAMPLE,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      rect: {
        type: "object",
        description: "채울 바운딩 박스(맵 좌표). circle/ellipse도 이 박스 안에서 마스크한다",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      material: { type: "string", description: "지형 재료: 타일 라벨/설명(예: \"물\", \"잔디\"). 그룹 id 금지" },
      path: {
        type: "array", items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
        description: "rect 대신: 굽은 강·운하·대로의 중심선 점(2개 이상). 점 사이를 width 칸 띠로 한 번에 칠한다(세로 쪽 선분은 행마다, 가로 쪽은 열마다). 굽이마다 점 하나",
      },
      width: { type: "integer", description: "path 띠 폭(1~8, 기본 4)" },
      layer: { type: "string", enum: [...TOOL_LAYER_ENUM], description: "기본 1(lower). 수역/바닥은 1층, 1층 위에 겹치는 풀·흙 장식은 2층. lower=1, upper=3" },
      shape: {
        type: "string",
        enum: ["rect", "ellipse", "circle"],
        description: "월드맵은 재료 이름(강/길/호수/숲/산맥)만으로 바탕과 기본 층을 맞춘다. 길 path는 강 횡단에 다리를 놓는다. 기본 rect. 원형 호수/둥근 연못=circle, 타원 호수=ellipse. '원형' 요청에 rect 금지",
      },
      clearUpper: {
        type: "boolean",
        description: "채운 칸의 상위 레이어(나무·소품)를 비울지. 기본: 물처럼 통행 불가 재료면 true(물 위에 소품을 둘 수 없다), 모래·잔디 같은 통행 가능 재료면 false(그대로 둔다). 사용자가 「나무는 그대로」라 했으면 false 를 명시",
      },
    },
    required: ["mapId", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const shapeExample = args.shape === "circle" || args.shape === "ellipse" ? FILL_CIRCLE_EXAMPLE : FILL_EXAMPLE;
    const { map, tileset } = requireMapContext(draft, args, shapeExample);
    const pathPoints = Array.isArray(args.path) && args.path.length ? (args.path as unknown[]).map((p, i) => {
      const r = (p ?? {}) as Record<string, unknown>; return { x: coerceInt(r.x, `path[${i}].x`, shapeExample), y: coerceInt(r.y, `path[${i}].y`, shapeExample) };
    }) : null;
    if (pathPoints && pathPoints.length < 2) failWithExample("path 는 점 2개 이상이어야 합니다", shapeExample);
    const pathWidth = args.width === undefined ? 4 : coerceInt(args.width, "width", shapeExample);
    if (pathPoints && (pathWidth < 1 || pathWidth > 8)) failWithExample("width 는 1~8 이어야 합니다", shapeExample);
    const pathCells = pathPoints ? cellsAlongPath(map, pathPoints, pathWidth) : null;
    if (pathCells && !pathCells.length) failWithExample("path 가 맵 밖입니다", shapeExample);
    const rect = pathCells
      ? (() => { const xs = pathCells.map(c => c.x), ys = pathCells.map(c => c.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 }; })()
      : coerceRect(args.rect, "rect", shapeExample);
    requireRectInMap(map, rect, "rect", shapeExample);
    const shape = coerceFillShape(args.shape, FILL_CIRCLE_EXAMPLE);
    const requestedLayer = args.layer === undefined ? "lower" : args.layer;
    const parsedLayer = parseToolLayer(requestedLayer);
    if (parsedLayer === null) failWithExample(`layer는 ${TOOL_LAYER_ENUM.join("/")} 중 하나여야 합니다(lower=1층, upper=3층)`, shapeExample);
    // 숲마을·기후 시트도 어휘의 「애니메이션 물 오토타일」(0~212)로 칠한다. 이 시트들은 합본 마을과 같은 칸에 물 블록을
    // 두고 렌더가 물가 쿼터를 합성해 3프레임으로 움직인다(tilesetImage.COMBINED_TOWN_WATER_BLOCK_TEXTURES).
    // 2026-09-25 에 1517~1563 호수로 돌렸던 것은 그 합성이 들어가기 전의 「물가 없는 남색 판」 때문이었고,
    // 그 호수는 프레임이 한 장이라 물이 멈춰 보였다(2026-09-27 사용자 보고).
    // 「물」·「호수」·「연못」은 라벨 검색에 맡기지 않는다 — 화산 시트는 물 칸 라벨이 「용암 · 물 오토타일」이라 「물」이
    // 단일 타일로 잡혀 fill-needs-group 으로 실패했다(2026-09-27 실측). 시트의 물 오토타일 그룹으로 바로 간다.
    const waterGroup = plainWaterMaterialGroup(tileset, args.material);
    const { group, softConfirm } = waterGroup ? { group: waterGroup, softConfirm: undefined }
      : requireMaterialGroup(tileset, args.material, shapeExample, { preferRoles: ["water", "terrain"], requireAutotileGroup: true });
    const autotile = autotileGroupForVocab(tileset, group);
    // 겹침 오토타일(울타리·주차선)은 3층이 집이다 — layer 를 안 주면 거기에 깐다(바닥을 지우지 않는다).
    const layerNo: TileLayerNo = args.layer === undefined && autotile && autotileGroupLayer(autotile) === "upper" ? 3 : parsedLayer;
    assertFillRegionGroup(tileset, group, autotile);
    const body = fillBodyTile(group, autotile);
    if (body === null) {
      throw new ToolError(`채울 타일을 찾을 수 없습니다: ${group.name}(${group.id})`, { code: "fill-empty-group", mapId: map.id });
    }
    const worldmapAuto = worldmapMaterialGroup(tileset, args.material)?.id === group.id;
    // Read context once before writing: a preceding cell must not change the next cell's background/bridge axis.
    const worldmapContext = worldmapAuto ? structuredClone(map) : map;

    const bboxCells = cellsInRect(map, rect);
    const maskCells = pathCells ?? cellsInFillShape(map, rect, shape);
    // 벽과의 1칸 틈 메우기는 MV 팩에서 끈다 — 건물·울타리·물체가 모두 「벽」이라 옥상이 울타리 쪽으로 혹처럼 자라고
    // 이웃 건물과 붙어 버린다(2026-09-25 헤드리스 실측: 7×3 옥상이 30칸). 조수가 준 사각형 그대로 칠한다.
    const allCells = tileset.mvPack || tileset.autotileGroups?.some(g => g.id === 'worldmap-brush-grass-sea')
      ? maskCells : expandCellsAgainstWalls(draft, map, maskCells);
    const gapCells = allCells.length - maskCells.length;
    if (allCells.length === 0) {
      throw new ToolError(
        `shape=${shape} 마스크에 포함될 칸이 없습니다. rect를 키우거나 shape를 확인하세요`,
        { code: "fill-empty-shape", mapId: map.id },
      );
    }
    // 채우기는 면만 바꾼다 — 벽·지붕·건물 칸은 건너뛰고, 통행 불가 재료는 이벤트 칸도 건너뛴다.
    const houses = new Set(protectedHouseCells(map).map(pointKey));
    const protectedReason = (cell: Point): string | null => {
      if (houses.has(pointKey(cell))) return "완성된 집";
      const index = cell.y * map.width + cell.x;
      const structure = structureGroupNameForTile(tileset, map.lowerTiles[index])
        ?? structureGroupNameForTile(tileset, map.upperTiles[index]);
      return structure === null ? null : `구조물(${structure})`;
    };
    const structure = splitProtectedFillCells(allCells, protectedReason);
    const blocksPassage = layerNo === 1 && tileBlocksPassage(tileset, body);
    // 상위 소품 처리 기본값은 재료가 정한다 — 물 위 소품은 배치 검증이 error 로 잡으니 비우고,
    // 모래·잔디 위 나무는 남긴다(「나무는 그대로 두고」). 인자가 있으면 그것을 따른다.
    const clearUpper = typeof args.clearUpper === "boolean" ? args.clearUpper : blocksPassage;
    const events = blocksPassage ? splitEventCells(map, structure.cells) : { cells: structure.cells, skipped: [] as ProtectedCell[] };
    // 1층을 칠하면 그 칸의 2층 장식을 지운다(바닥을 바꾸면 그 위 장식도 바뀐다). clearUpper 는 3·4층을 함께 비운다.
    const paintCell = (cell: Point): void => {
      const index = cell.y * map.width + cell.x;
      if (layerNo === 1) {
        map.lowerTiles[index] = worldmapAuto ? worldmapAutoTile(worldmapContext, tileset, body, cell.x, cell.y, pathCells ?? maskCells) : body;
        setLayerTileAt(map, 2, index, TILE.EMPTY);
        if (clearUpper) {
          map.upperTiles[index] = TILE.EMPTY;
          setLayerTileAt(map, 4, index, TILE.EMPTY);
        }
      } else setLayerTileAt(map, layerNo, index, body);
    };
    const filtered = filterPassageProtectedCells(draft, map, events.cells, paintCell);
    const exit = blocksPassage ? reserveStartExit(draft, map, filtered.cells) : { cells: filtered.cells, corridor: [] as Point[] };
    const before = snapshotLayers(map);
    let upperCleared = 0;
    for (const cell of exit.cells) {
      if (clearUpper && layerNo === 1 && map.upperTiles[cell.y * map.width + cell.x] !== TILE.EMPTY) upperCleared += 1;
      paintCell(cell);
    }
    // 오토타일은 칠한 층 배열에서 모양을 잡는다(2층 풀 장식은 2층 이웃 기준). 겹침 오토타일은 3층, 나머지 3·4층 물체는 그대로 둔다.
    // 모양 재계산은 이 재료 칸만 바꾼다 — 벽·지붕 재료는 칠한 순간 「구조물」이라 보호 판정만 쓰면
    // 방금 칠한 외벽·옥상의 가장자리를 영영 못 맞춘다(2026-09-24 MV 팩 실측: 재계산 0칸).
    const autotileMembers = new Set(autotile?.memberTileIds ?? []);
    const reshapes = autotile !== undefined && autotile !== null
      && (autotileGroupLayer(autotile) === "upper" ? layerNo === 3 : layerNo === 1 || layerNo === 2);
    const reshapeView = reshapes ? autotileLayerView(map, layerNo) : null;
    const reshaped = autotile && reshapeView
      ? resolveAutotile(autotile, exit.cells, reshapeView, (x, y) => autotileMembers.has(reshapeView.lowerTiles[y * map.width + x]!)
        || protectedReason({ x, y }) === null) : 0;
    // 1층을 채운 칸은 2층 장식도 비웠으므로 둘레 2층 장식의 가장자리를 다시 잡는다(2층이 있는 맵만).
    if (layerNo === 1 && map.lowerOverlayTiles) {
      const overlay = autotileLayerView(map, 2);
      for (const group of autotileGroupsForTileset(tileset)) shapeAutotileGroupAround(overlay, group, exit.cells);
    }
    // MV 팩 재료는 서로 다른 오토타일끼리 맞닿으면 양쪽이 가장자리를 그린다 — 흙 속 잔디·보도 속 화단의
    // 둘레 흙·보도 칸도 다시 맞춘다. 내장 타일셋은 기존 결과(재료 자신만 재계산)를 그대로 둔다.
    const neighborsReshaped = (tileset.mvPack || tileset.autotileGroups?.some(candidate=>candidate.id.startsWith('worldmap-brush-')))
      ? shapeAllAutotileGroupsAround(map, autotileGroupsForTileset(tileset).filter((candidate) => candidate.id !== autotile?.id), exit.cells)
      : 0;
    // 3×3 테두리 바닥은 채운 면의 가장자리에 테두리를, 안쪽에 몸통을 둔다(1칸 폭 줄은 몸통 그대로).
    const nine = !autotile ? flatNineSlice(group) : undefined;
    if (nine) {
      const inFill = new Set(exit.cells.map(pointKey));
      const has = (x: number, y: number) => inFill.has(pointKey({ x, y }));
      for (const cell of exit.cells) {
        const up = has(cell.x, cell.y - 1), down = has(cell.x, cell.y + 1), west = has(cell.x - 1, cell.y), east = has(cell.x + 1, cell.y);
        const row = up === down ? 1 : up ? 2 : 0;
        const col = west === east ? 1 : west ? 2 : 0;
        const tile = nine[row]![col]!;
        setLayerTileAt(map, layerNo, cell.y * map.width + cell.x, tile);
      }
    }
    const mutatedCells = changedLayerCells(map, before);
    compactMapLayers(map);
    const skippedAll = [...structure.skipped, ...events.skipped, ...filtered.skipped];
    const shapeNote = shape === "rect" ? "" : ` shape=${shape}`;
    const gapNote = gapCells > 0 ? ` (벽 틈 메움 ${gapCells}칸)` : "";
    const skipNote = skippedAll.length > 0 ? `, 보호 ${skippedAll.length}칸 제외` : "";
    const upperNote = upperCleared > 0 ? `, 상위 ${upperCleared}칸 비움` : "";
    const exitNote = exit.corridor.length > 0 ? `, 시작 위치 통로 ${exit.corridor.length}칸 비움` : "";
    const warnings = [
      ...(protectedSkipWarnings(skippedAll) ?? []),
      ...bareBoardWarnings(map, exit.cells.length, layerNo === 1 ? "lower" : String(requestedLayer)),
      ...(exit.corridor.length > 0
        ? [`시작 위치 (${draft.startPos.x},${draft.startPos.y})가 사방으로 막혀 밖으로 나가는 통로 ${exit.corridor.length}칸((${exit.corridor[0].x},${exit.corridor[0].y})~(${exit.corridor[exit.corridor.length - 1].x},${exit.corridor[exit.corridor.length - 1].y}))을 비워 두었습니다`]
        : []),
    ];
    return withSoftConfirm({
      summary: `${map.name} (${rect.x},${rect.y}) ${rect.w}×${rect.h}${shapeNote}을 '${group.name}'로 ${mutatedCells > 0 ? "채움" : "변경 없음"} — ${exit.cells.length}/${maskCells.length}칸${gapNote}, 실제 변경 ${mutatedCells}칸, 오토타일 재계산 ${reshaped + neighborsReshaped}칸${skipNote}${upperNote}${exitNote}.`,
      ...(warnings.length > 0 ? { warnings } : {}),
      data: {
        filled: exit.cells.length,
        mutatedCells,
        requested: allCells.length,
        bboxCells: bboxCells.length,
        maskCells: maskCells.length,
        gapCells,
        shape,
        reshaped: reshaped + neighborsReshaped,
        groupId: group.id,
        layer: requestedLayer,
        effectiveLayer: toolLayerLabel(layerNo),
        upperCleared,
        skipped: { structure: structure.skipped.length, events: events.skipped.length, passage: filtered.skipped.length },
        exitCorridor: exit.corridor,
      },
    }, softConfirm);
  },
};

const ERASE_EXAMPLE = { mapId: "map_1", rect: { x: 8, y: 6, w: 6, h: 4 }, layer: "both" };
const ERASE_MARKET_EXAMPLE = { mapId: "map_1", rect: { x: 8, y: 6, w: 12, h: 10 }, kind: "market" };

// kind=market 이 지우는 시장/상점 데크 타일 집합. 집 키트 id는 절대 넣지 않는다.
// (흙길 PATH 360 도 시장 타일이 아니다 — 남긴다.)
export const MARKET_ERASE_TILES: ReadonlySet<number> = new Set([
  192, 222, 228, 229, 230, // 나무 마루 본체/테두리
  223, 193,                // 목재 보/기둥
  468, 469, 470,           // 좌판 난간
  234, 235, 236,           // 진열대
  202, 203,                // 과일 진열
  237,                     // 나무 상자
  268,                     // 돌 단
]);

// 파란 벽돌 집 키트(벽·창문·지붕). kind=market 은 이 타일이 있는 레이어를 절대 건드리지 않는다.
const HOUSE_KIT_TILES: ReadonlySet<number> = new Set([
  15, 16, 17, 45, 46, 47, 75, 76, 77, // 벽
  87,                                 // 창문
  406, 407, 467,                      // 지붕(lower)
  356, 357, 386, 387,                 // 지붕(upper)
]);

export type TileEraseKind = "all" | "market";

function coerceEraseKind(value: unknown): TileEraseKind {
  if (value === undefined || value === null || value === "" || value === "all") return "all";
  if (value === "market") return "market";
  failWithExample("kind는 all|market 중 하나여야 합니다(시장/상점 데크만 철거=market)", ERASE_MARKET_EXAMPLE);
}

interface MarketErasePlan {
  readonly cell: Point;
  readonly lowerTo?: number;
  readonly upperTo?: number;
}

// 셀별 계획: 시장 타일이 있는 레이어만 비운다(lower는 잔디 복원). 집 키트 레이어는 계획에서 제외.
function planMarketErase(map: GameMap, cells: readonly Point[], layer: "both" | "lower" | "upper"): MarketErasePlan[] {
  const plans: MarketErasePlan[] = [];
  for (const cell of cells) {
    const index = cell.y * map.width + cell.x;
    const lower = map.lowerTiles[index];
    const upper = map.upperTiles[index];
    const clearLower = (layer === "both" || layer === "lower") && !HOUSE_KIT_TILES.has(lower) && MARKET_ERASE_TILES.has(lower);
    const clearUpper = (layer === "both" || layer === "upper") && !HOUSE_KIT_TILES.has(upper) && MARKET_ERASE_TILES.has(upper);
    if (!clearLower && !clearUpper) continue;
    plans.push({
      cell,
      ...(clearLower ? { lowerTo: TILE.GRASS } : {}),
      ...(clearUpper ? { upperTo: TILE.EMPTY } : {}),
    });
  }
  return plans;
}

function applyMarketPlan(map: GameMap, plan: MarketErasePlan): void {
  const index = plan.cell.y * map.width + plan.cell.x;
  if (plan.lowerTo !== undefined) map.lowerTiles[index] = plan.lowerTo;
  if (plan.upperTo !== undefined) map.upperTiles[index] = plan.upperTo;
}

// 지우기의 "기본 바닥" — 하위를 빈 칸(TILE.EMPTY)으로 남기면 에디터에는 빈 칸 체커가,
// 플레이에는 검은 배경이 드러난다(editSceneRender 의 createEmptyTile / createPlayGame 의 "#000").
// 조수에게 "이거 지워·다시 해줘" 를 시키면 되돌릴 곳은 구멍이 아니라 지면이다 — clear_region(기본 잔디),
// planMarketErase(잔디 복원), resize_map, applyMapShift 는 이미 그렇게 한다. tile_erase 만 이 열 밖에 있어서
// 조수가 기본 바닥을 체커로 남기는 상황을 만들어 왔다(사용자 보고 2026-08-27).
// 관측된 통행 가능 하위 지면만 후보로 삼는다. 구조물 최빈값(테두리 벽 포함)은 바닥이 아니다.
// rect 밖 후보를 우선하고 없으면 안쪽 후보를 쓴다. 후보가 없으면 타일을 지어내지 않고 변경 전에 실패한다.
// 진짜 구멍(하늘 맵·허공)이 필요하면 clear_region 의 fill="empty" 를 쓴다.
function baseGroundTile(map: GameMap, rect: Rect, tileset: TilesetDef): number {
  const outside = new Map<number, number>();
  const inside = new Map<number, number>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.lowerTiles[y * map.width + x];
      if (tile === undefined || tile < 0) continue;
      const within = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const counts = within ? inside : outside;
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
  }
  const tile = mostFrequentTile(outside, tileset) ?? mostFrequentTile(inside, tileset);
  if (tile === null) {
    throw new ToolError(
      "복원할 바닥을 찾을 수 없습니다. 현재 타일셋의 통행 가능한 하위 지면을 tile_query로 확인하고 명시적으로 바닥을 칠한 뒤 다시 정리하세요. 상위만 지우려면 layer:\"upper\"를 사용하세요.",
      { code: "erase-ground-unresolved", mapId: map.id },
    );
  }
  return tile;
}

function isRestorationGround(tileset: TilesetDef, tile: number): boolean {
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) return false;
  if (tileLayerHome(tileset, tile) !== "lower" || tileset.priority[tile] === "upper" || tileBlocksPassage(tileset, tile)) return false;
  const meta = tileset.tileMeta?.[tile];
  if (meta?.passage === "solid" || meta?.passage === "star") return false;
  // Bundled semantic tables also use "floor" for ungrouped indoor surfaces.
  const isGroundRole = (role: string): boolean => role === "floor" || roleCapabilities(tileset, role).naturalGround;
  // A human's explicit tile role overrides inherited group vocabulary, but never runtime passage/layer rules.
  if (meta?.role && (tileMetaOrigin(meta) === "user" || tileMetaLocked(meta))) return isGroundRole(meta.role);
  const roles = (tileset.tileGroups ?? []).filter(group => group.tileIds.includes(tile)).map(group => group.role);
  const groundRoles: string[] = meta?.role ? [meta.role, ...roles] : roles;
  if (groundRoles.length > 0) return groundRoles.every(isGroundRole);
  // 역할표가 없는 번들 키트(몬스터 기후 등)는 덧그림 칸의 받침(layerBacking)으로 지면을 선언한다 — 저자가 그 칸을 덧그림 밑 바닥으로 정했다.
  // 이 근거가 없어서 서리꽃 마을 눈밭(448)을 바닥으로 못 찾고 tile_erase 가 실패했다(2026-10-06 몬스터 이어 고치기).
  return declaredBackingTiles(tileset).has(tile);
}

const backingTilesCache = new WeakMap<TilesetDef, ReadonlySet<number>>();
function declaredBackingTiles(tileset: TilesetDef): ReadonlySet<number> {
  let set = backingTilesCache.get(tileset);
  if (!set) {
    set = new Set(Object.values(tileset.tileMeta ?? {}).map(meta => meta?.layerBacking).filter((tile): tile is number => typeof tile === "number"));
    backingTilesCache.set(tileset, set);
  }
  return set;
}

function mostFrequentTile(counts: ReadonlyMap<number, number>, tileset: TilesetDef): number | null {
  let best: number | null = null;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count > bestCount && isRestorationGround(tileset, tile)) {
      best = tile;
      bestCount = count;
    }
  }
  return best;
}

type EraseLayer = "both" | "all" | "lower" | "upper" | "2" | "4" | "shadow";
const ERASE_LAYER_ENUM = ["both", "all", "lower", "upper", "1", "2", "3", "4", "shadow"] as const;

/** 지우기 층 인자 → 범위 이름. "1"/"3" 은 paint_tiles 와 같은 별칭(lower/upper). 모르면 null. */
function coerceEraseLayer(value: unknown): EraseLayer | null {
  if (value === "1") return "lower";
  if (value === "3") return "upper";
  return value === "both" || value === "all" || value === "lower" || value === "upper" || value === "2" || value === "4" || value === "shadow"
    ? value : null;
}

/**
 * 지우기 범위. both/all = 칸 전체(1층은 바닥 복원). lower = 1층 바닥 복원 + 그 위 2층 장식(1층을 바꾸면 2층도 비운다).
 * upper = 3·4층(3층 물체가 빠지면 그 위 4층도 뜬다). 2/4/shadow = 그 층만.
 */
function eraseScope(layer: EraseLayer): { readonly ground: boolean; readonly layers: readonly TileLayerNo[]; readonly shadow: boolean } {
  switch (layer) {
    case "both":
    case "all": return { ground: true, layers: [2, 3, 4], shadow: true };
    case "lower": return { ground: true, layers: [2], shadow: false };
    case "upper": return { ground: false, layers: [3, 4], shadow: false };
    case "2": return { ground: false, layers: [2], shadow: false };
    case "4": return { ground: false, layers: [4], shadow: false };
    case "shadow": return { ground: false, layers: [], shadow: true };
  }
}

// tile_erase — 승인 어휘를 소비하지 않는 유일한 배치 툴(지우기는 어휘 결정이 없다).
// v2 tile_paint의 erase 경로를 대체 — v3 시공 프리미티브에 없던 "되돌리기/청소" 수단.
const tileErase: ToolDefinition = {
  name: "tile_erase",
  description:
    "지정 사각형을 정리한다(v3). layer: both(기본, 칸 전체 — 1·2·3·4층·그림자)/all(both 와 같다)/lower=1(1층 바닥 복원 + 2층 비움)/upper=3(3·4층)/2/4/shadow(그 층만). " + FOUR_LAYER_GUIDANCE_SHORT + " 상위는 빈 칸이 되고, 하위는 맵에서 관측된 통행 가능한 하위 지면(rect 밖 우선, 없으면 안쪽의 최빈 지면)으로 복원한다. 벽·지붕·소품·막힌 타일은 바닥 후보가 아니다. 유효한 지면이 없으면 erase-ground-unresolved로 변경 없이 실패한다. 바닥 자리가 진짜 빈 칸이어야 하는 경우(하늘 맵·허공)만 clear_region 의 fill=\"empty\" 를 쓴다. 승인 어휘가 필요 없는 유일한 배치 툴 — 실수 정리·재시공 전 청소에 쓴다.  상점·가게 철거는 find_layout_regions({mapId, query})로 영역을 먼저 찾은 뒤 tile_erase({mapId, rect, kind:\"market\"})(kind market 은 상점 타일만 지워 이웃 집·흙길 보존) → show_map_region 으로 결과 확인. 영역 상자는 find_layout_regions 가 준 rect 를 쓰고 비전으로 추측하지 말 것. 기존 것을 고칠 때는 get_map_region/find_layout_regions 로 현재 상태를 먼저 확인하고 이 툴로 정리한 뒤 다시 깐다." +
    "kind: all(기본, rect 전체를 통째로 비움)/market(시장·상점 데크 철거 전용 — 나무 마루·좌판 난간·진열대·과일·나무 상자·돌 단만 지우고, " +
    "겹친 집(벽·창문·지붕)·흙길(360)·잔디처럼 시장 타일이 아닌 것은 그대로 보존한다. 시장 lower를 지운 칸은 잔디로 되돌린다). " +
    "집과 시장이 한 bbox에 섞여 있으면 kind=market 을 쓸 것 — kind 생략(all)은 집까지 다 지운다.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      rect: {
        type: "object", description: "비울 영역(맵 좌표)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      layer: { type: "string", enum: [...ERASE_LAYER_ENUM], description: "기본 both(칸 전체). 1=lower, 3=upper, 2/4/shadow 는 그 층만" },
      kind: {
        type: "string",
        enum: ["all", "market"],
        description: "기본 all(rect 전체 비움). market=시장/상점 데크만 철거하고 집·흙길·잔디는 보존",
      },
    },
    required: ["mapId", "rect"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, ERASE_EXAMPLE);
    const rect = coerceRect(args.rect, "rect", ERASE_EXAMPLE);
    const layer = coerceEraseLayer(args.layer === undefined ? "both" : args.layer);
    if (layer === null) {
      failWithExample(`layer는 ${ERASE_LAYER_ENUM.join("/")} 중 하나여야 합니다(1=lower, 3=upper)`, ERASE_EXAMPLE);
    }
    const kind = coerceEraseKind(args.kind);
    const allCells = cellsInRect(map, rect);
    if (kind === "market") {
      const marketLayer = layer === "all" ? "both" : layer;
      if (marketLayer !== "both" && marketLayer !== "lower" && marketLayer !== "upper") {
        failWithExample("kind=market 은 layer both/lower/upper 만 받습니다", ERASE_MARKET_EXAMPLE);
      }
      const plans = planMarketErase(map, allCells, marketLayer);
      const planByKey = new Map(plans.map((plan) => [pointKey(plan.cell), plan] as const));
      const filtered = filterPassageProtectedCells(draft, map, plans.map((plan) => plan.cell), (cell) => {
        const plan = planByKey.get(pointKey(cell));
        if (plan) applyMarketPlan(map, plan);
      });
      for (const cell of filtered.cells) {
        const plan = planByKey.get(pointKey(cell));
        if (plan) applyMarketPlan(map, plan);
      }
      return {
        summary: `${map.name} (${rect.x},${rect.y}) ${rect.w}×${rect.h} 시장 데크 철거(${layer}) — ${filtered.cells.length}/${allCells.length}칸(집·흙길·잔디 보존)${filtered.skipped.length > 0 ? `, 보호 ${filtered.skipped.length}칸 제외` : ""}.`,
        warnings: protectedSkipWarnings(filtered.skipped),
        data: {
          cleared: filtered.cells.length,
          requested: allCells.length,
          skipped: filtered.skipped.length,
          layer,
          kind,
        },
      };
    }
    const scope = eraseScope(layer);
    const groundTile = scope.ground ? baseGroundTile(map, rect, tileset) : null;
    const eraseCell = (cell: Point): void => {
      const index = cell.y * map.width + cell.x;
      if (groundTile !== null) map.lowerTiles[index] = worldmapEraseTile(tileset, map.lowerTiles[index]!) ?? groundTile;
      for (const no of scope.layers) setLayerTileAt(map, no, index, TILE.EMPTY);
      if (scope.shadow) setShadowAt(map, index, 0);
    };
    const filtered = filterPassageProtectedCells(draft, map, allCells, eraseCell);
    let cleared = 0;
    for (const cell of filtered.cells) {
      eraseCell(cell);
      cleared += 1;
    }
    // MV 팩: 지운 자리 둘레의 울타리·차선·흙 가장자리를 다시 맞춘다(지운 끝이 끊긴 모양으로 남지 않게).
    const reshaped = tileset?.mvPack || tileset?.autotileGroups?.some(group => group.id.startsWith('worldmap-brush-'))
      ? shapeAllAutotileGroupsAround(map, autotileGroupsForTileset(tileset), filtered.cells) : 0;
    compactMapLayers(map);
    return {
      summary: `${map.name} (${rect.x},${rect.y}) ${rect.w}×${rect.h} 정리(${layer}) — ${cleared}/${allCells.length}칸${groundTile === null ? "" : `, 하위는 기본 바닥 ${groundTile} 복원`}${filtered.skipped.length > 0 ? `, 보호 ${filtered.skipped.length}칸 제외` : ""}.`,
      warnings: protectedSkipWarnings(filtered.skipped),
      data: { cleared, requested: allCells.length, skipped: filtered.skipped.length, layer, kind, groundTile, ...(reshaped ? { reshaped } : {}) },
    };
  },
};

interface RowMaterial {
  readonly atom: RowAtom;
  /** 낱장 타일 재료면 null — hard 규칙·거울 교체는 그룹 어휘에서만 나온다. */
  readonly group: TileGroupMetadata | null;
  readonly home: VocabLayerHome;
  readonly label: string;
  readonly softConfirm?: VocabSoftConfirm;
}

function coerceAisleAxis(value: unknown): AisleAxis {
  if (value === undefined || value === null || value === "") return "vertical";
  if (value === "vertical" || value === "horizontal") return value;
  failWithExample(
    "axis는 vertical(통로가 세로 — 좌우로 줄이 갈림) 또는 horizontal(통로가 가로 — 상하로 갈림)이어야 합니다",
    ARRANGE_EXAMPLE,
  );
}

/** 줄 배치 재료 — 그룹이면 문법에서 원자를 파생하고, 낱장 타일이면 1칸 원자로 쓴다. */
function requireRowMaterial(
  tileset: TilesetDef,
  material: unknown,
  options: { readonly axis: AisleAxis; readonly symmetric: boolean },
): RowMaterial {
  if (typeof material !== "string" || material.trim().length === 0) {
    failWithExample("material(타일 라벨/설명, 예: \"벤치\"·\"의자(단독)\"·\"탁자(가로)\")이 필요합니다", ARRANGE_EXAMPLE);
  }
  const access = resolveMaterialByLabel(tileset, material, { preferGroup: true });
  if (access.status === "missing") {
    const suggestions = access.suggestions.length > 0 ? access.suggestions : suggestMaterialsByLabel(tileset, material, 5);
    const hint = suggestions.length > 0
      ? ` 비슷한 라벨: ${suggestions.map((entry) => `"${entry.label}"`).join(", ")} — material에 이 문자열을 넣으세요.`
      : ` tile_query ask:"labels" 로 타일 라벨/설명을 조회하세요.`;
    throw new ToolError(`${access.message}${hint} — 다시 보낼 형식 예시: ${JSON.stringify(ARRANGE_EXAMPLE)}`, {
      code: "material-not-found",
    });
  }
  if (access.kind === "group") {
    return {
      atom: atomFromGroup(tileset, access.group, options, ARRANGE_EXAMPLE),
      group: access.group,
      home: vocabLayerHomeFor(access.group, tilesetGrammarProfile(tileset)),
      label: access.group.name || access.matchedLabel,
      softConfirm: access.softConfirm,
    };
  }
  return {
    atom: { kind: "fixed", w: 1, h: 1, cells: [{ dx: 0, dy: 0, tile: access.tileId }], shape: "1칸" },
    group: null,
    home: "perCell",
    label: access.matchedLabel,
    softConfirm: access.softConfirm,
  };
}

// 통로를 두고 줄을 반복하는 결정론 배치. 기존 프리미티브는 면 채우기(fill_region)와 랜덤
// 산포(place_props)뿐이어서 "좌우로 줄지어 앉히는" 문법이 없었다(2026-08-29).
const arrangeRows: ToolDefinition = {
  name: "arrange_rows",
  description:
    "통로 하나를 두고 좌우(또는 상하)로 같은 줄을 반복 배치한다(v3) — 교회 신도석·극장 좌석·강의실 책상·병영 침상처럼 자리를 줄지어 놓는 결정론 배치. "
    + "material은 타일 라벨/설명(예: \"벤치\"·\"의자(단독)\"), 그룹 id 금지. axis는 통로가 뻗는 방향이고 줄은 통로와 수직으로 놓인다. "
    + "면을 통째로 채우려면 fill_region, 숲/들판 랜덤 산포는 place_props.",
  mode: "write",
  version: 3,
  invalidArgsExample: ARRANGE_EXAMPLE,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      rect: {
        type: "object", description: "배치 영역(맵 좌표) — 통로까지 포함한 전체 구획",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      material: { type: "string", description: "자리 재료: 타일 라벨/설명(예: \"벤치\", \"의자(단독)\", \"탁자(가로)\"). 그룹 id 금지" },
      axis: {
        type: "string",
        enum: ["horizontal", "vertical"],
        description: "통로가 뻗는 방향. 기본 vertical(통로가 세로로 뻗고 줄은 가로로 놓여 좌우로 갈린다)",
      },
      aisleWidth: { type: "integer", description: "가운데 통로 폭(칸). 기본 2. 0이면 통로 없이 한 덩어리" },
      rowGap: { type: "integer", description: "줄 사이 빈 칸. 기본 1" },
      symmetric: { type: "boolean", description: "통로 건너편 줄의 방향 타일을 거울상으로 바꿔 서로 마주보게 한다. 기본 false" },
    },
    required: ["mapId", "rect", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, ARRANGE_EXAMPLE);
    const rect = coerceRect(args.rect, "rect", ARRANGE_EXAMPLE);
    requireRectInMap(map, rect, "rect", ARRANGE_EXAMPLE);
    const axis = coerceAisleAxis(args.axis);
    const symmetric = args.symmetric === true;
    const aisleWidth = args.aisleWidth === undefined ? 2 : coerceInt(args.aisleWidth, "aisleWidth", ARRANGE_EXAMPLE);
    const rowGap = args.rowGap === undefined ? 1 : coerceInt(args.rowGap, "rowGap", ARRANGE_EXAMPLE);
    if (aisleWidth < 0) failWithExample("aisleWidth는 0 이상이어야 합니다(0=통로 없이 한 덩어리)", ARRANGE_EXAMPLE);
    if (rowGap < 0) failWithExample("rowGap은 0 이상이어야 합니다", ARRANGE_EXAMPLE);

    const material = requireRowMaterial(tileset, args.material, { axis, symmetric });
    const plan = planRows(rect, axis, aisleWidth, rowGap, material.atom);
    if (plan.lines.length === 0) {
      throw new ToolError(
        `rect ${rect.w}×${rect.h}에 '${material.label}' 줄(${material.atom.shape}, 두께 ${plan.thickness})을 놓을 자리가 없습니다`
          + ` — 영역을 넓히거나 aisleWidth(${aisleWidth})/rowGap(${rowGap})을 줄이세요. — 다시 보낼 형식 예시: ${JSON.stringify(ARRANGE_EXAMPLE)}`,
        { code: "rect-too-small" },
      );
    }

    const protectedCells = protectedPassageCells(draft, map);
    const placed: RunCell[] = [];
    let leftover = 0;
    let mirrored = 0;
    let skipped = 0;
    for (const line of plan.lines) {
      const fill = fillRun(material.atom, line.rect, plan.runAxis);
      leftover += fill.leftover;
      for (const unit of fill.units) {
        // 거울 교체는 타일만 바꾸고 원자 내부 셀 순서는 건드리지 않는다 — 벤치처럼 hard
        // adjacency(327은 328 바로 왼쪽)가 방향을 고정한 원자는 뒤집으면 규칙 위반이 된다.
        const cells = symmetric && line.side === "b" && material.group !== null
          ? unit.map((cell) => {
            const flipped = mirrorTile(tileset, material.group as TileGroupMetadata, cell.tile, axis);
            if (flipped === null) return cell;
            mirrored += 1;
            return { ...cell, tile: flipped };
          })
          : unit;
        if (cells.some((cell) => !inMapBounds(map, cell.x, cell.y) || protectedCells.has(pointKey(cell)))) {
          skipped += 1;
          continue;
        }
        placed.push(...cells);
      }
    }

    if (placed.length === 0) {
      throw new ToolError(
        `'${material.label}' 줄을 한 칸도 놓지 못했습니다(자리 ${plan.lines.length}줄, 통행 보호로 건너뜀 ${skipped}개)`
          + ` — 시작 지점·이벤트가 없는 영역을 고르거나 rect를 옮기세요.`,
        { code: "no-placement" },
      );
    }
    if (material.group) {
      const violation = hardAdjacencyViolation(material.group, placed);
      if (violation) throw new ToolError(violation, { code: "cluster-rule-violation" });
    }

    const applied = applyEdits(map, placed.map((cell) => ({
      x: cell.x,
      y: cell.y,
      layer: layerForVocabTile(tileset, material.home, cell.tile),
      tile: cell.tile,
    })));

    const warnings: string[] = [];
    if (leftover > 0) {
      warnings.push(
        `'${material.label}'은 ${material.atom.shape} 원자라 줄 끝 ${leftover}칸이 나눠떨어지지 않아 비워 뒀습니다`
          + ` — 딱 맞추려면 rect 크기나 aisleWidth를 조정하세요.`,
      );
    }
    if (skipped > 0) warnings.push(`통행 보호 칸(시작 지점·이벤트)과 겹쳐 자리 ${skipped}개를 건너뛰었습니다.`);
    if (symmetric && mirrored === 0) {
      warnings.push(
        `symmetric을 켰지만 '${material.label}'에는 ${axis === "vertical" ? "좌우" : "상하"} 방향 구분 타일이 없어`
          + ` 거울 교체 없이 같은 자리를 대칭으로만 놓았습니다.`,
      );
    }

    return withSoftConfirm({
      summary: `${map.name}에 '${material.label}' 줄 배치 — ${plan.lines.length}줄 ${applied}칸`
        + `(${axis === "vertical" ? "통로 세로" : "통로 가로"} ${aisleWidth}칸, 줄 간격 ${rowGap}${symmetric ? ", 대칭" : ""}).`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: {
        lines: plan.lines.length,
        cells: applied,
        aisle: plan.aisle,
        axis,
        atom: material.atom.shape,
        groupId: material.group?.id,
        leftover,
        mirrored,
        skipped,
      },
    }, material.softConfirm);
  },
};

export const CONSTRUCTION_TOOLS_V3: readonly ToolDefinition[] = [buildWall, buildRoof, placeDoor, placeWindow, layPath, placeProps, fillRegion, arrangeRows, tileErase];
