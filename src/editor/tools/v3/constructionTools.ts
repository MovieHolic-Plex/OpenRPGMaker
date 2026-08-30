// editor/tools/v3/constructionTools.ts
// 공정 프리미티브 6종 (타일 툴 v3 — V3B).
//
// 계약: version 3, layer 인자 없음(어휘 layerHome). 재료는 material=타일 label/description
// (vocabId/그룹 id 금지). soft-allow + vocabSoftConfirm.
// 공정 순서: build_wall → place_door/place_window → build_roof → lay_path → place_props.

import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import {
  resolveMaterialByLabel,
  suggestMaterialsByLabel,
  VOCAB_SOFT_CONFIRM_WARNING_PREFIX,
  type VocabLayerHome,
  type VocabSoftConfirm,
} from "@/project/tileVocabulary";
import type { AutotileGroup, GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { inMapBounds, requireMap, setLower, setUpper, type Point } from "../mapHelpers";
import { wobblePath } from "../naturalScatter";
import { naturalnessArg, naturalnessLabel, rngForTool } from "../naturalToolArgs";
import { placePropsOnDraft } from "../placePropsDomain";
import type { ScatterPacking } from "../placementTools";
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
    const suggestions = access.suggestions.length > 0
      ? access.suggestions
      : suggestMaterialsByLabel(tileset, material, 5);
    const hint = suggestions.length > 0
      ? ` 비슷한 라벨: ${suggestions.map((s) => `"${s.label}"`).join(", ")} — material에 이 문자열을 넣으세요.`
      : ` tile_query ask:"labels" 로 타일 라벨/설명을 조회하세요.`;
    // 레거시 테스트/로그 호환 키워드 "비슷한 그룹" 도 함께 표기
    throw new ToolError(`${access.message}${hint.replace("비슷한 라벨", "비슷한 라벨(그룹)")} — 다시 보낼 형식 예시: ${JSON.stringify(example)}`, { code: "material-not-found" });
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
    const lower = map.lowerTiles[index];
    const upper = map.upperTiles[index];
    preview(cell);
    const passable = isPassable(project, map, cell.x, cell.y);
    map.lowerTiles[index] = lower;
    map.upperTiles[index] = upper;
    if (passable) kept.push(cell);
    else skipped.push({ ...cell, reason });
  }
  return { cells: kept, skipped };
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
    "material(타일 라벨/설명)로 벽을 시공한다(v3). rect에 9분할/기둥 패턴 전개. 그룹 id 금지. 시공 후 place_door/place_window → build_roof.",
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
    const expansion = expandWall(tileset, group, rect, profile, WALL_EXAMPLE);
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
    data: { at, cells: applied, groupId: group.id },
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
    "문 어휘를 벽 셀에 설치한다(v3 공정 2단계). 대상 셀이 벽(벽 어휘 타일)이 아니면 거부. 문 어휘가 세로 1×2 패턴이면 위 칸까지 자동 전개. layer 인자 없음 — 어휘 layerHome이 결정. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의.",
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
    "길 어휘로 경유점(2개 이상)을 잇는 길을 깐다(v3 공정 4단계). 어휘에 8-이웃 variantMap 오토타일 정의가 필수 — 없으면 거부(승인 시 오토타일 정의 필요). 외곽+inner corner 변형을 자동 재계산한다. 경로가 집·물 같은 통행 불가 칸을 만나면 그 칸을 덮지 않고 자동으로 우회한다(저작물 보호). naturalness 0~1(기본 0.5), seed로 결정론 재현. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의.",
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
    if (!autotile || (autotile.neighborhood ?? 4) !== 8) {
      throw new ToolError(
        `길 어휘 '${group.name}'(${group.id})에 8-이웃 variantMap 오토타일 정의가 없습니다. 승인 시 오토타일 정의가 필요합니다(inner corner 마감용) — 타일셋 오토타일 편집기에서 8방향 그룹을 정의하세요. — 다시 보낼 형식 예시: ${JSON.stringify(PATH_EXAMPLE)}`,
        { code: "path-needs-autotile", mapId: map.id }
      );
    }
    const naturalness = naturalnessArg(args);
    const signature = `lay_path|${map.id}|${map.width}x${map.height}|${naturalnessLabel(naturalness)}|${points.map((point) => `${point.x},${point.y}`).join(";")}`;
    const result = wobblePath(points, naturalness, rngForTool(args, signature));
    const body = autotile.variantMap[String(255)] ?? group.tileIds[0];
    const painted: Point[] = [];
    for (const cell of [...result.path, ...result.widthCells]) {
      if (!inMapBounds(map, cell.x, cell.y)) continue;
      setLower(map, cell.x, cell.y, body);
      painted.push(cell);
    }
    if (painted.length === 0) failWithExample("경로가 전부 맵 밖입니다 — points 좌표를 맵 안으로 고치세요", PATH_EXAMPLE);
    const reshaped = resolveAutotile(autotile, painted, map);
    return withSoftConfirm({
      summary: `${map.name}에 '${group.name}' 길 ${painted.length}칸 — 자연도 ${naturalnessLabel(naturalness)}, 오토타일 재계산 ${reshaped}칸(inner corner 포함).`,
      data: { pathCells: painted.length, reshaped, groupId: group.id },
    }, softConfirm);
  },
};

const placeProps: ToolDefinition = {
  name: "place_props",
  description:
    "소품을 area 안에 산포한다(v3). material=타일 라벨/설명(예: \"침엽수\", \"나무 상자\", \"과일박스\"). 그룹 id·vocabId 금지. 물·길·통행 불가·upper 점유 칸 스킵. 면 채우기는 fill_region. "
    + "사용자가 빽빽하게·통행 불가·길 막기를 요구하면 packing:\"dense\" 로 보내고 count 는 area 면적만큼 크게 잡는다(결과에 남은 통행 칸 수가 나온다).",
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
      count: { type: "integer", description: "배치 개수" },
      minGap: { type: "integer", description: "간격(기본 1; 마을 산포는 2+ 권장)" },
      naturalness: { type: "number", description: "0~1(기본 0.5). <0.3=한곳 뭉침(uniform), 0.3~0.7=poisson 산포, >0.7=cluster" },
      packing: {
        type: "string",
        enum: ["natural", "dense"],
        description: "\"dense\"=빈틈 없이 맞닿게 채워 통행을 막는다(간격 0, 자연도 무시). 기본 \"natural\"",
      },
      seed: { type: "integer" },
    },
    required: ["mapId", "area", "material", "count"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map } = requireMapContext(draft, args, PROPS_EXAMPLE);
    const area = coerceRect(args.area, "area", PROPS_EXAMPLE);
    const count = coerceInt(args.count, "count", PROPS_EXAMPLE);
    const material = typeof args.material === "string" ? args.material.trim() : "";
    if (!material) failWithExample("material(타일 라벨/설명, 예: \"침엽수\"·\"나무 상자\")이 필요합니다", PROPS_EXAMPLE);
    const minGap = typeof args.minGap === "number" && Number.isInteger(args.minGap) ? args.minGap : undefined;
    const seed = args.seed === undefined ? undefined : coerceInt(args.seed, "seed", PROPS_EXAMPLE);
    const packing = args.packing === undefined ? undefined : coercePacking(args.packing);
    return placePropsOnDraft(draft, {
      mapId: map.id,
      area,
      material,
      count,
      ...(minGap === undefined ? {} : { minGap }),
      naturalness: naturalnessArg(args),
      ...(seed === undefined ? {} : { seed }),
      ...(packing === undefined ? {} : { packing }),
    });
  },
};

function coercePacking(value: unknown): ScatterPacking {
  if (value === "natural" || value === "dense") return value;
  failWithExample('packing은 "natural" 또는 "dense"여야 합니다', PROPS_EXAMPLE);
}

function fillBodyTile(group: TileGroupMetadata, autotile: AutotileGroup | null): number | null {
  const center = group.patternGrammar?.parts.find((part) => part.role === "center")?.tileIds[0];
  return center ?? (autotile ? autotile.variantMap[String(255)] : undefined) ?? group.tileIds[0] ?? null;
}

function assertFillRegionGroup(group: TileGroupMetadata, autotile: AutotileGroup | null): void {
  const kind = group.patternGrammar?.kind;
  if (autotile || kind === "autotile_3x3" || kind === "animated_terrain") return;
  throw new ToolError(
    `fill_region은 autotile_3x3/animated_terrain 지형 그룹만 채울 수 있습니다: ${group.name}(${group.id})`,
    { code: "fill-needs-autotile-group" }
  );
}

const fillRegion: ToolDefinition = {
  name: "fill_region",
  description:
    "material(타일 라벨/설명, 예: \"물\"/\"잔디\")로 영역을 채운다(v3). 그룹 id 금지. shape: rect(기본·사각형 전체)|ellipse(rect 안 타원)|circle(rect 안 내접 원). 원형/둥근 호수는 반드시 shape=circle(또는 ellipse). rect만 쓰면 네모 호수가 된다. 호수·강·바닥·지면 면 작업용. 나무/바위/꽃은 place_props. lower 기본. transfer/시작 위치 보호 칸은 제외+warning. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의.",
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
      layer: { type: "string", enum: ["lower", "upper"], description: "기본 lower. 수역/바닥은 lower를 사용한다" },
      shape: {
        type: "string",
        enum: ["rect", "ellipse", "circle"],
        description: "기본 rect. 원형 호수/둥근 연못=circle, 타원 호수=ellipse. '원형' 요청에 rect 금지",
      },
    },
    required: ["mapId", "rect", "material"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const shapeExample = args.shape === "circle" || args.shape === "ellipse" ? FILL_CIRCLE_EXAMPLE : FILL_EXAMPLE;
    const { map, tileset } = requireMapContext(draft, args, shapeExample);
    const rect = coerceRect(args.rect, "rect", shapeExample);
    requireRectInMap(map, rect, "rect", shapeExample);
    const shape = coerceFillShape(args.shape, FILL_CIRCLE_EXAMPLE);
    const layer = args.layer === undefined ? "lower" : args.layer;
    if (layer !== "lower" && layer !== "upper") failWithExample("layer는 lower/upper 중 하나여야 합니다", shapeExample);
    const { group, softConfirm } = requireMaterialGroup(tileset, args.material, shapeExample, { preferRoles: ["water", "terrain"], requireAutotileGroup: true });
    const autotile = autotileGroupForVocab(tileset, group);
    assertFillRegionGroup(group, autotile);
    const body = fillBodyTile(group, autotile);
    if (body === null) {
      throw new ToolError(`채울 타일을 찾을 수 없습니다: ${group.name}(${group.id})`, { code: "fill-empty-group", mapId: map.id });
    }

    const bboxCells = cellsInRect(map, rect);
    const allCells = cellsInFillShape(map, rect, shape);
    if (allCells.length === 0) {
      throw new ToolError(
        `shape=${shape} 마스크에 포함될 칸이 없습니다. rect를 키우거나 shape를 확인하세요`,
        { code: "fill-empty-shape", mapId: map.id },
      );
    }
    const filtered = filterPassageProtectedCells(draft, map, allCells, (cell) => {
      const index = cell.y * map.width + cell.x;
      if (layer === "upper") map.upperTiles[index] = body;
      else {
        map.lowerTiles[index] = body;
        map.upperTiles[index] = TILE.EMPTY;
      }
    });
    for (const cell of filtered.cells) {
      const index = cell.y * map.width + cell.x;
      if (layer === "upper") map.upperTiles[index] = body;
      else {
        map.lowerTiles[index] = body;
        map.upperTiles[index] = TILE.EMPTY;
      }
    }
    const reshaped = layer === "lower" && autotile ? resolveAutotile(autotile, filtered.cells, map) : 0;
    const skipped = filtered.skipped.length;
    const shapeNote = shape === "rect" ? "" : ` shape=${shape}`;
    return withSoftConfirm({
      summary: `${map.name} (${rect.x},${rect.y}) ${rect.w}×${rect.h}${shapeNote}을 '${group.name}'로 채움 — ${filtered.cells.length}/${bboxCells.length}칸(마스크 ${allCells.length}), 오토타일 재계산 ${reshaped}칸${skipped > 0 ? `, 보호 ${skipped}칸 제외` : ""}.`,
      warnings: protectedSkipWarnings(filtered.skipped),
      data: {
        filled: filtered.cells.length,
        requested: allCells.length,
        bboxCells: bboxCells.length,
        shape,
        reshaped,
        groupId: group.id,
        layer,
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
// rect 밖에서 가장 흔한 하위 타일을 기본 바닥으로 본다 — 실내는 실내 바닥, 야외는 잔디가 자연히 잡힌다.
// 맵 전체가 rect 면 안쪽 최빈값, 그마저도 없으면 잔디.
// 진짜 구멍(하늘 맵·허공)이 필요하면 clear_region 의 fill="empty" 를 쓴다.
function baseGroundTile(map: GameMap, rect: Rect): number {
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
  return mostFrequentTile(outside) ?? mostFrequentTile(inside) ?? TILE.GRASS;
}

function mostFrequentTile(counts: ReadonlyMap<number, number>): number | null {
  let best: number | null = null;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count > bestCount) {
      best = tile;
      bestCount = count;
    }
  }
  return best;
}

// tile_erase — 승인 어휘를 소비하지 않는 유일한 배치 툴(지우기는 어휘 결정이 없다).
// v2 tile_paint의 erase 경로를 대체 — v3 시공 프리미티브에 없던 "되돌리기/청소" 수단.
const tileErase: ToolDefinition = {
  name: "tile_erase",
  description:
    "지정 사각형을 정리한다(v3). layer: both(기본, 상·하위 모두)/lower/upper. 상위는 빈 칸이 되고, 하위는 맵의 기본 바닥(rect 밖에서 가장 흔한 하위 타일 — 실내는 실내 바닥, 야외는 잔디)으로 되돌아가 바닥에 구멍을 남기지 않는다. 바닥 자리가 진짜 빈 칸이어야 하는 경우(하늘 맵·허공)만 clear_region 의 fill=\"empty\" 를 쓴다. 승인 어휘가 필요 없는 유일한 배치 툴 — 실수 정리·재시공 전 청소에 쓴다. " +
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
      layer: { type: "string", enum: ["both", "lower", "upper"], description: "기본 both" },
      kind: {
        type: "string",
        enum: ["all", "market"],
        description: "기본 all(rect 전체 비움). market=시장/상점 데크만 철거하고 집·흙길·잔디는 보존",
      },
    },
    required: ["mapId", "rect"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map } = requireMapContext(draft, args, ERASE_EXAMPLE);
    const rect = coerceRect(args.rect, "rect", ERASE_EXAMPLE);
    const layer = args.layer === undefined ? "both" : args.layer;
    if (layer !== "both" && layer !== "lower" && layer !== "upper") {
      failWithExample("layer는 both/lower/upper 중 하나여야 합니다", ERASE_EXAMPLE);
    }
    const kind = coerceEraseKind(args.kind);
    const allCells = cellsInRect(map, rect);
    if (kind === "market") {
      const plans = planMarketErase(map, allCells, layer);
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
    const groundTile = baseGroundTile(map, rect);
    const filtered = filterPassageProtectedCells(draft, map, allCells, (cell) => {
      const index = cell.y * map.width + cell.x;
      if (layer === "both" || layer === "lower") map.lowerTiles[index] = groundTile;
      if (layer === "both" || layer === "upper") map.upperTiles[index] = TILE.EMPTY;
    });
    let cleared = 0;
    for (const cell of filtered.cells) {
      const index = cell.y * map.width + cell.x;
      if (layer === "both" || layer === "lower") map.lowerTiles[index] = groundTile;
      if (layer === "both" || layer === "upper") map.upperTiles[index] = TILE.EMPTY;
      cleared += 1;
    }
    return {
      summary: `${map.name} (${rect.x},${rect.y}) ${rect.w}×${rect.h} 정리(${layer}) — ${cleared}/${allCells.length}칸${layer === "upper" ? "" : `, 하위는 기본 바닥 ${groundTile} 복원`}${filtered.skipped.length > 0 ? `, 보호 ${filtered.skipped.length}칸 제외` : ""}.`,
      warnings: protectedSkipWarnings(filtered.skipped),
      data: { cleared, requested: allCells.length, skipped: filtered.skipped.length, layer, kind, groundTile },
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
