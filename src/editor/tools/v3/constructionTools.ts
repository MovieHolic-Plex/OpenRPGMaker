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
    "길 어휘로 경유점(2개 이상)을 잇는 길을 깐다(v3 공정 4단계). 어휘에 8-이웃 variantMap 오토타일 정의가 필수 — 없으면 거부(승인 시 오토타일 정의 필요). 외곽+inner corner 변형을 자동 재계산한다. naturalness 0~1(기본 0.5), seed로 결정론 재현. 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의.",
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
    "소품을 area 안에 자연 산포한다(v3). material=타일 라벨/설명(예: \"침엽수\", \"나무 상자\", \"과일박스\"). 그룹 id·vocabId 금지. 물·길·통행 불가·upper 점유 칸 스킵. 면 채우기는 fill_region.",
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
    return placePropsOnDraft(draft, {
      mapId: map.id,
      area,
      material,
      count,
      ...(minGap === undefined ? {} : { minGap }),
      naturalness: naturalnessArg(args),
      ...(seed === undefined ? {} : { seed }),
    });
  },
};

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

// tile_erase — 승인 어휘를 소비하지 않는 유일한 배치 툴(지우기는 어휘 결정이 없다).
// v2 tile_paint의 erase 경로를 대체 — v3 시공 프리미티브에 없던 "되돌리기/청소" 수단.
const tileErase: ToolDefinition = {
  name: "tile_erase",
  description:
    "지정 사각형의 타일을 비운다(v3). layer: both(기본, 상·하위 모두)/lower/upper. 승인 어휘가 필요 없는 유일한 배치 툴 — 실수 정리·재시공 전 청소에 쓴다.",
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
    const allCells = cellsInRect(map, rect);
    const filtered = filterPassageProtectedCells(draft, map, allCells, (cell) => {
      const index = cell.y * map.width + cell.x;
      if (layer === "both" || layer === "lower") map.lowerTiles[index] = TILE.EMPTY;
      if (layer === "both" || layer === "upper") map.upperTiles[index] = TILE.EMPTY;
    });
    let cleared = 0;
    for (const cell of filtered.cells) {
      const index = cell.y * map.width + cell.x;
      if (layer === "both" || layer === "lower") map.lowerTiles[index] = TILE.EMPTY;
      if (layer === "both" || layer === "upper") map.upperTiles[index] = TILE.EMPTY;
      cleared += 1;
    }
    return {
      summary: `${map.name} (${rect.x},${rect.y}) ${rect.w}×${rect.h} 비움(${layer}) — ${cleared}/${allCells.length}칸${filtered.skipped.length > 0 ? `, 보호 ${filtered.skipped.length}칸 제외` : ""}.`,
      warnings: protectedSkipWarnings(filtered.skipped),
      data: { cleared, requested: allCells.length, skipped: filtered.skipped.length, layer },
    };
  },
};

export const CONSTRUCTION_TOOLS_V3: readonly ToolDefinition[] = [buildWall, buildRoof, placeDoor, placeWindow, layPath, placeProps, fillRegion, tileErase];
