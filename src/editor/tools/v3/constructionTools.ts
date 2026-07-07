// editor/tools/v3/constructionTools.ts
// 공정 프리미티브 6종 (타일 툴 v3, 2026-07-07 설계 — V3B).
//
// 계약(설계 축 1·4): 전부 version 3, layer 인자 없음(어휘의 layerHome이 결정론 배치),
// 승인된 어휘(origin:"user")만 소비 — 미승인은 assertApprovedOrFail이 하드 차단.
// 모든 인자 오류에 "다시 보낼 형식 예시" 동봉(v2 규약 승계). RNG는 시드 기반만.
// 공정 순서: build_wall → place_door/place_window → build_roof → lay_path → place_props.

import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { TILE } from "@/project/defaults/constants";
import {
  approvedVocabulary,
  assertApprovedOrFail,
  type VocabLayerHome,
} from "@/project/tileVocabulary";
import type { AutotileGroup, GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { inMapBounds, requireMap, setLower, setUpper, type Point } from "../mapHelpers";
import { wobblePath, poissonScatter } from "../naturalScatter";
import { naturalnessArg, naturalnessLabel, rngForTool } from "../naturalToolArgs";
import { PLACEMENT_TOOLS } from "../placementTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "../types";
import { byName, coerceInt, coercePoint, coercePointArray, compactArgs, failWithExample } from "../v2/tileToolsV2Support";
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

const v1Scatter = byName(PLACEMENT_TOOLS, "scatter_object");

const WALL_EXAMPLE = { mapId: "map_1", rect: { x: 8, y: 6, w: 6, h: 4 }, wallVocabId: "plaster-wall-9slice" };
const ROOF_EXAMPLE = { mapId: "map_1", roofVocabId: "red-roof", wallRect: { x: 8, y: 6, w: 6, h: 4 } };
const DOOR_EXAMPLE = { mapId: "map_1", at: { x: 10, y: 9 }, doorVocabId: "wood-door" };
const WINDOW_EXAMPLE = { mapId: "map_1", at: { x: 9, y: 7 }, windowVocabId: "house-window" };
const PATH_EXAMPLE = { mapId: "map_1", points: [{ x: 2, y: 12 }, { x: 14, y: 12 }, { x: 20, y: 8 }], pathVocabId: "dirt-path", naturalness: 0.5 };
const PROPS_EXAMPLE = { mapId: "map_1", area: { x: 2, y: 2, w: 18, h: 12 }, propVocabId: "conifer-tree", count: 8, naturalness: 0.6 };

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

// 승인된 어휘 그룹 조회 — 미승인/미존재는 assertApprovedOrFail이 안내와 함께 거부한다.
function requireApprovedGroup(tileset: TilesetDef, vocabId: unknown, field: string, example: Record<string, unknown>): TileGroupMetadata {
  if (typeof vocabId !== "string" || vocabId.length === 0) failWithExample(`${field}(승인된 어휘 그룹 id)가 필요합니다`, example);
  assertApprovedOrFail(tileset, { groupId: vocabId });
  const group = tileset.tileGroups?.find((entry) => entry.id === vocabId);
  if (!group) throw new ToolError(`타일 그룹을 찾을 수 없습니다: ${vocabId}`, { code: "group-not-found" });
  return group;
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

function approvedWallGroups(tileset: TilesetDef): TileGroupMetadata[] {
  const approvedIds = new Set(approvedVocabulary(tileset).groups.filter((entry) => entry.role === "wall").map((entry) => entry.id));
  return (tileset.tileGroups ?? []).filter((group) => approvedIds.has(group.id));
}

function detectWallRegion(map: GameMap, tileset: TilesetDef): Rect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;
  for (const group of approvedWallGroups(tileset)) {
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
  return approvedWallGroups(tileset).some((group) => group.tileIds.includes(tile));
}

const buildWall: ToolDefinition = {
  name: "build_wall",
  description:
    "승인된 벽 어휘로 벽을 시공한다(v3 공정 1단계). rect 영역에 9분할(nine_slice)/기둥(vertical) 패턴을 전개하며 레이어는 어휘의 layerHome이 결정한다(layer 인자 없음). 미승인 어휘는 거부 — 먼저 propose_tile_vocabulary로 승인을 받으라. 시공 후 place_door/place_window → build_roof 순서로 진행하라.",
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
      wallVocabId: { type: "string", description: "승인된 벽 어휘 그룹 id(tile_query ask=unapproved/palette로 조회)" },
    },
    required: ["mapId", "rect", "wallVocabId"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, WALL_EXAMPLE);
    const rect = coerceRect(args.rect, "rect", WALL_EXAMPLE);
    requireRectInMap(map, rect, "rect", WALL_EXAMPLE);
    const group = requireApprovedGroup(tileset, args.wallVocabId, "wallVocabId", WALL_EXAMPLE);
    const profile = tilesetGrammarProfile(tileset);
    const expansion = expandWall(tileset, group, rect, profile, WALL_EXAMPLE);
    const applied = applyEdits(map, expansion.edits);
    return {
      summary: `${map.name}에 '${group.name}' 벽 ${rect.w}×${rect.h}(${applied}칸) 시공 — 다음 공정: place_door/place_window → build_roof.`,
      data: { wallRegion: expansion.region, cells: applied, groupId: group.id },
    };
  },
};

const buildRoof: ToolDefinition = {
  name: "build_roof",
  description:
    "승인된 지붕 어휘로 벽 위에 지붕을 얹는다(v3 공정 3단계). wallRect 생략 시 맵의 벽 어휘 셀을 스캔해 자동 감지한다. 벽이 없으면 거부 — 먼저 build_wall로 벽을 지으라. 처마/사선 오버레이 레이어는 어휘 layerHome(perCell) 규약으로 자동 판정된다.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      roofVocabId: { type: "string", description: "승인된 지붕 어휘 그룹 id" },
      wallRect: {
        type: "object", description: "지붕을 얹을 벽 영역(생략 시 자동 감지)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
      },
    },
    required: ["mapId", "roofVocabId"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, ROOF_EXAMPLE);
    const group = requireApprovedGroup(tileset, args.roofVocabId, "roofVocabId", ROOF_EXAMPLE);
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
    return {
      summary: `${map.name}의 벽(${wallRegion.x},${wallRegion.y} ${wallRegion.w}×${wallRegion.h}) 위에 '${group.name}' 지붕 ${applied}칸을 얹음.`,
      data: { roofRegion: expansion.region, wallRegion, cells: applied, groupId: group.id },
    };
  },
};

// 문/창문 공용: 대상 셀이 벽 어휘 셀이 아니면 거부(공정 순서 강제).
function placeOnWall(kind: "door" | "window", draft: Project, args: Record<string, unknown>, idField: string, example: Record<string, unknown>): ToolExecResult {
  const { map, tileset } = requireMapContext(draft, args, example);
  const at = coercePoint(args.at, "at", example);
  const group = requireApprovedGroup(tileset, args[idField], idField, example);
  if (!isWallCell(map, tileset, at.x, at.y)) {
    throw new ToolError(
      `(${at.x},${at.y})은(는) 벽 셀(승인된 벽 어휘 타일)이 아닙니다. 먼저 build_wall로 벽을 짓고 벽 위 좌표를 지정하세요. — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
      { code: kind === "door" ? "door-needs-wall" : "window-needs-wall", mapId: map.id, x: at.x, y: at.y }
    );
  }
  const profile = tilesetGrammarProfile(tileset);
  const home = vocabLayerHomeFor(group, profile);
  const edits = doorLikeEdits(tileset, group, at, home);
  const applied = applyEdits(map, edits);
  const label = kind === "door" ? "문" : "창문";
  return {
    summary: `${map.name} (${at.x},${at.y}) 벽에 '${group.name}' ${label} ${applied}칸 설치.`,
    data: { at, cells: applied, groupId: group.id },
  };
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
    "승인된 문 어휘를 벽 셀에 설치한다(v3 공정 2단계). 대상 셀이 벽(승인된 벽 어휘 타일)이 아니면 거부. 문 어휘가 세로 1×2 패턴이면 위 칸까지 자동 전개. layer 인자 없음 — 어휘 layerHome이 결정.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      at: { type: "object", description: "문 하단 칸(벽 셀)", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      doorVocabId: { type: "string", description: "승인된 문 어휘 그룹 id" },
    },
    required: ["mapId", "at", "doorVocabId"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    return placeOnWall("door", draft, args, "doorVocabId", DOOR_EXAMPLE);
  },
};

const placeWindow: ToolDefinition = {
  name: "place_window",
  description:
    "승인된 창문 어휘를 벽 셀에 설치한다(v3 공정 2단계). 대상 셀이 벽(승인된 벽 어휘 타일)이 아니면 거부. layer 인자 없음 — 창문 같은 투명 소품은 어휘 layerHome(upper/perCell)이 벽을 보존하며 겹친다.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      at: { type: "object", description: "창문 칸(벽 셀)", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      windowVocabId: { type: "string", description: "승인된 창문 어휘 그룹 id" },
    },
    required: ["mapId", "at", "windowVocabId"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    return placeOnWall("window", draft, args, "windowVocabId", WINDOW_EXAMPLE);
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
    "승인된 길 어휘로 경유점(2개 이상)을 잇는 길을 깐다(v3 공정 4단계). 어휘에 8-이웃 variantMap 오토타일 정의가 필수 — 없으면 거부(승인 시 오토타일 정의 필요). 외곽+inner corner 변형을 자동 재계산한다. naturalness 0~1(기본 0.5), seed로 결정론 재현.",
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
      pathVocabId: { type: "string", description: "승인된 길 어휘 그룹 id" },
      naturalness: { type: "number", description: "0~1. 0=직선, 0.5=기본, 0.8+=구불구불" },
      seed: { type: "integer", description: "결정론 시드(생략 가능)" },
    },
    required: ["mapId", "points", "pathVocabId"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, PATH_EXAMPLE);
    const points = coercePointArray(args.points, "points", PATH_EXAMPLE);
    if (points.length < 2) failWithExample("points는 경유점 2개 이상이어야 합니다", PATH_EXAMPLE);
    const group = requireApprovedGroup(tileset, args.pathVocabId, "pathVocabId", PATH_EXAMPLE);
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
    return {
      summary: `${map.name}에 '${group.name}' 길 ${painted.length}칸 — 자연도 ${naturalnessLabel(naturalness)}, 오토타일 재계산 ${reshaped}칸(inner corner 포함).`,
      data: { pathCells: painted.length, reshaped, groupId: group.id },
    };
  },
};

const placeProps: ToolDefinition = {
  name: "place_props",
  description:
    "승인된 소품 어휘를 area 안에 자연 산포한다(v3 공정 5단계). propVocabId가 그룹이면 기존 산포 엔진(풋프린트 원자 배치·클러스터 hard 규칙·보호셀 회피)을 그대로 쓰고, 승인된 낱개 타일 id(숫자)면 포아송 산포로 배치한다. layer 인자 없음 — 어휘 layerHome이 결정.",
  mode: "write",
  version: 3,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: {
        type: "object", description: "산포 영역(맵 좌표)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      propVocabId: { type: "string", description: "승인된 소품 어휘: 그룹 id 또는 승인된 낱개 타일 id(숫자 문자열)" },
      count: { type: "integer", description: "배치 개수" },
      minGap: { type: "integer", description: "간격(기본 1)" },
      naturalness: { type: "number", description: "0~1(기본 0.5)" },
      seed: { type: "integer" },
    },
    required: ["mapId", "area", "propVocabId", "count"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const { map, tileset } = requireMapContext(draft, args, PROPS_EXAMPLE);
    const area = coerceRect(args.area, "area", PROPS_EXAMPLE);
    const count = coerceInt(args.count, "count", PROPS_EXAMPLE);
    const rawId = typeof args.propVocabId === "string" ? args.propVocabId.trim() : "";
    if (!rawId) failWithExample("propVocabId(승인된 소품 어휘)가 필요합니다", PROPS_EXAMPLE);

    const group = tileset.tileGroups?.find((entry) => entry.id === rawId);
    if (group) {
      assertApprovedOrFail(tileset, { groupId: group.id });
      // 기존 산포 엔진 재사용(클러스터 hard 규칙 유지) — 승인 검사만 이 계층에서 추가한다.
      return v1Scatter.run(draft, compactArgs({
        mapId: args.mapId, area: args.area, count, groupId: group.id,
        minGap: args.minGap, naturalness: args.naturalness, seed: args.seed,
      }));
    }
    if (!/^\d+$/.test(rawId)) {
      // 그룹도 숫자 타일 id도 아니면 미승인 그룹 경로로 보내 합의 안내를 받게 한다.
      assertApprovedOrFail(tileset, { groupId: rawId });
    }
    const tileId = Number(rawId);
    assertApprovedOrFail(tileset, { tileId });
    const naturalness = naturalnessArg(args);
    const minGap = typeof args.minGap === "number" && Number.isInteger(args.minGap) ? Math.max(0, args.minGap) : 1;
    const signature = `place_props|${map.id}|${area.x},${area.y},${area.w},${area.h}|${tileId}|${count}|${naturalnessLabel(naturalness)}`;
    const rng = rngForTool(args, signature);
    const scatter = poissonScatter({ x: area.x, y: area.y, width: area.w, height: area.h }, count, minGap, rng);
    const declared = tileset.tileMeta?.[tileId]?.defaultLayer;
    const tileHome: VocabLayerHome = declared === "lower" || declared === "upper" ? declared : "perCell";
    const home = layerForVocabTile(tileset, tileHome, tileId);
    let placed = 0;
    for (const cell of scatter.points) {
      if (!inMapBounds(map, cell.x, cell.y)) continue;
      const index = cell.y * map.width + cell.x;
      if (map.upperTiles[index] !== TILE.EMPTY) continue; // 기존 소품/구조물 보존.
      if (home === "upper") setUpper(map, cell.x, cell.y, tileId);
      else setLower(map, cell.x, cell.y, tileId);
      placed += 1;
    }
    return {
      summary: `${map.name} (${area.x},${area.y}) ${area.w}×${area.h}에 소품(타일 ${tileId}) ${placed}/${count}개 산포 — 자연도 ${naturalnessLabel(naturalness)}.`,
      data: { placed, requested: count, tileId },
    };
  },
};

export const CONSTRUCTION_TOOLS_V3: readonly ToolDefinition[] = [buildWall, buildRoof, placeDoor, placeWindow, layPath, placeProps];

// v3가 대체하는 v2 배치 툴 → 대체 v3 툴 이름. 레지스트리가 이 표로 deprecated 마킹한다
// (V1_TILE_SUPERSEDED와 동일 방식 — LLM 비노출, getTool/실행 호환 유지).
export const V2_TILE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  ["tile_paint", "lay_path"],
  ["tile_road", "lay_path"],
  ["tile_scatter", "place_props"],
  ["tile_structure", "build_wall"],
]);
