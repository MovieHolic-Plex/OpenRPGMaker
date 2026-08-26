// editor/tools/mapTools.ts
// 맵 생성/타일 페인팅/도로/구조물/시작위치 쓰기 툴.

import { isPassable } from "@/project/collision";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { shapeRoadAround } from "@/project/defaults/roadAutotile";
import { shapeSandAround } from "@/project/defaults/sandAutotile";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { applyMapDeletion, planMapDeletion } from "@/project/mapDeletion";
import { cloneGameMap } from "@/project/mapClone";
import {
  appendToTree,
  canReparentMap,
  dissolveFolderKeepChildren,
  extractTreeNode,
  findParentMapId,
  findTreeNode,
  insertTreeNode,
  isMapTreeFolder,
  siblingIndex,
} from "@/project/mapTree";
import { markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { stampRectHouseKit } from "@/editor/houseKit";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
import { stampTownCityPlot, type TownCityPlotStyle } from "@/project/defaults/townHousePatterns";
import { kitIdForSmallHouseMaterial, type SmallHouseMaterial } from "@/editor/content/dbExtractedHouseTemplate";
import { genId } from "@/util/id";
import type { EncounterTableEntry, FieldSpawnDef, GameMap, PaletteSlotRole, Project, Rect, RoguelikeRoomDef, TilesetDef } from "@/project/types";
import { applyMapShift } from "@/editor/mapShiftActions";
import {
  floodFillCells,
  inMapBounds,
  lineCells,
  passabilityWarning,
  requireMap,
  setLower,
  type Point,
} from "./mapHelpers";
import { expandHardClusterPlacement, type HardClusterTileEdit } from "./clusterRulePlacement";
import { jitterPlacement, wobblePath } from "./naturalScatter";
import { jitterMaxOffset, naturalnessArg, naturalnessLabel, NATURALNESS_GUIDANCE, rngForTool } from "./naturalToolArgs";
import { paletteTilePickerForTool, type PaletteTilePicker } from "./paletteToolArgs";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { isSeason, isTimePhase, SEASONS, TIME_PHASES } from "@/project/gameTime";
import { COORD_SCHEMA } from "./schemaShapes";

// 맵 테두리를 벽으로 두른다.
function borderWalls(map: GameMap): void {
  for (let x = 0; x < map.width; x += 1) {
    setLower(map, x, 0, TILE.WALL);
    setLower(map, x, map.height - 1, TILE.WALL);
  }
  for (let y = 0; y < map.height; y += 1) {
    setLower(map, 0, y, TILE.WALL);
    setLower(map, map.width - 1, y, TILE.WALL);
  }
}

// 시작 맵이 유효하지 않으면 이 맵을 시작 맵으로 채택하고 통행 가능한 시작점을 잡는다.
function adoptStartIfNeeded(project: Project, map: GameMap): void {
  if (project.maps[project.startMapId]) return;
  project.startMapId = map.id;
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  project.startPos = { x: cx, y: cy };
}

function assertToolMapSize(width: number, height: number): void {
  if (width > MAX_TOOL_MAP_DIMENSION || height > MAX_TOOL_MAP_DIMENSION) {
    throw new ToolError(
      `맵 크기는 최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}까지 가능합니다. 더 넓은 월드는 여러 맵으로 나누고 transfer 이벤트로 연결하세요.`,
      { code: "map-too-large" }
    );
  }
}

const createMap: ToolDefinition = {
  name: "create_map",
  description: "새 맵을 생성한다(기본은 테두리 없는 잔디 평지, 최대 256×256). 돌벽 테두리가 필요할 때만 border:\"wall\"을 지정한다. 시작 맵이 없으면 이 맵을 시작 맵으로 채택한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "맵 이름" },
      width: { type: "integer", description: "가로 타일 수(3 이상, 최대 256)" },
      height: { type: "integer", description: "세로 타일 수(3 이상, 최대 256)" },
      id: { type: "string", description: "맵 id(생략 시 자동 생성)" },
      border: { type: "string", enum: ["none", "wall"], description: "테두리 처리(기본 none, wall이면 외곽 TILE.WALL)" },
    },
    required: ["name", "width", "height"],
  },
  run(draft, args): ToolExecResult {
    const width = args.width as number;
    const height = args.height as number;
    if (width < 3 || height < 3) throw new ToolError("맵 크기는 최소 3x3 이상이어야 합니다.");
    assertToolMapSize(width, height);
    const id = (args.id as string | undefined) ?? genId("map");
    if (draft.maps[id]) throw new ToolError(`이미 존재하는 맵 id입니다: ${id}`, { code: "map-exists", mapId: id });
    const size = width * height;
    const map: GameMap = {
      id,
      name: args.name as string,
      width,
      height,
      tilesetId: DEFAULT_TILESET_ID,
      tileSize: DEFAULT_TILE_SIZE,
      lowerTiles: new Array<number>(size).fill(TILE.GRASS),
      upperTiles: new Array<number>(size).fill(TILE.EMPTY),
      events: [],
    };
    const border = (args.border as "none" | "wall" | undefined) ?? "none";
    if (border === "wall") borderWalls(map);
    draft.maps[id] = map;
    // mapTree.mapId가 유효하지 않으면(빈 프로젝트) 이 맵을 트리 루트로 채택, 아니면 자식으로 추가.
    if (!draft.maps[draft.mapTree.mapId]) {
      draft.mapTree = { mapId: id, children: [] };
    } else if (draft.mapTree.mapId !== id && !draft.mapTree.children.some((child) => child.mapId === id)) {
      draft.mapTree.children.push({ mapId: id, children: [] });
    }
    adoptStartIfNeeded(draft, map);
    return { summary: `맵 '${map.name}' (${width}x${height}) 생성 — id ${id}`, data: { mapId: id } };
  },
};

const duplicateMap: ToolDefinition = {
  name: "duplicate_map",
  description: "맵 전체(타일·이벤트·BGM·배경·미니맵 설정)를 복제하고 원본 바로 뒤에 배치한다. 새 map id는 명시해야 한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      id: { type: "string", description: "새 맵 id" },
      name: { type: "string", description: "새 맵 이름(생략 시 '<원본> 복사')" },
    },
    required: ["mapId", "id"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const source = requireMap(draft, args.mapId as string);
    const id = args.id as string;
    if (draft.maps[id] || findTreeNode(draft.mapTree, id)) {
      throw new ToolError(`이미 사용 중인 맵/폴더 id입니다: ${id}`, { code: "map-exists", mapId: id });
    }
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : `${source.name} 복사`;
    const usedEventIds = new Set(Object.values(draft.maps).flatMap((map) => map.events.flatMap((event) => [event.id, ...(event.pages ?? []).map((page) => page.id)])));
    const nextEventId = (): string => {
      let candidate = genId("ev");
      while (usedEventIds.has(candidate)) candidate = genId("ev");
      usedEventIds.add(candidate);
      return candidate;
    };
    const copy = cloneGameMap(source, { newId: id, newName: name, nextEventId });
    draft.maps[id] = copy;
    const parentId = findParentMapId(draft.mapTree, source.id);
    const sourceIndex = siblingIndex(draft.mapTree, source.id);
    if (!insertTreeNode(draft.mapTree, { mapId: id, children: [] }, parentId ?? "", sourceIndex >= 0 ? sourceIndex + 1 : undefined)) {
      appendToTree(draft.mapTree, id);
    }
    return { summary: `맵 '${source.name}' 복제 → '${name}' (${id})`, data: { mapId: id } };
  },
};

const manageMapTree: ToolDefinition = {
  name: "manage_map_tree",
  description: "맵 트리의 분류 폴더를 생성·이름 변경·해제하거나 맵/폴더를 다른 분류로 이동한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      operation: { type: "string", enum: ["create_folder", "rename_folder", "dissolve_folder", "move"] },
      folderId: { type: "string" },
      mapId: { type: "string", description: "move 대상 맵 또는 폴더 id" },
      parentId: { type: "string", description: "상위 폴더 id. 루트는 빈 문자열" },
      index: { type: "integer", minimum: 0 },
      name: { type: "string" },
    },
    required: ["operation"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const operation = args.operation;
    if (operation === "create_folder") {
      const folderId = typeof args.folderId === "string" ? args.folderId : "";
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!folderId || !name) throw new ToolError("create_folder에는 folderId와 비어 있지 않은 name이 필요합니다.", { code: "invalid-args" });
      if (draft.maps[folderId] || findTreeNode(draft.mapTree, folderId)) throw new ToolError(`이미 사용 중인 맵/폴더 id입니다: ${folderId}`, { code: "map-tree-id-exists" });
      const parentId = typeof args.parentId === "string" ? args.parentId : "";
      if (!insertTreeNode(draft.mapTree, { mapId: folderId, kind: "folder", name, children: [] }, parentId, args.index as number | undefined)) {
        throw new ToolError(`상위 폴더를 찾을 수 없습니다: ${parentId || "(루트)"}`, { code: "map-tree-parent-not-found" });
      }
      return { summary: `맵 분류 '${name}' 생성`, data: { folderId } };
    }
    if (operation === "rename_folder") {
      const folderId = typeof args.folderId === "string" ? args.folderId : "";
      const name = typeof args.name === "string" ? args.name.trim() : "";
      const node = findTreeNode(draft.mapTree, folderId);
      if (!node || !isMapTreeFolder(node)) throw new ToolError(`맵 분류를 찾을 수 없습니다: ${folderId}`, { code: "map-tree-folder-not-found" });
      if (!name) throw new ToolError("rename_folder에는 비어 있지 않은 name이 필요합니다.", { code: "invalid-args" });
      node.name = name;
      return { summary: `맵 분류 이름 변경 → '${name}'`, data: { folderId } };
    }
    if (operation === "dissolve_folder") {
      const folderId = typeof args.folderId === "string" ? args.folderId : "";
      if (!dissolveFolderKeepChildren(draft.mapTree, folderId)) throw new ToolError(`해제할 맵 분류를 찾을 수 없습니다: ${folderId}`, { code: "map-tree-folder-not-found" });
      return { summary: `맵 분류 ${folderId} 해제 — 하위 항목 유지`, data: { folderId } };
    }
    if (operation === "move") {
      const mapId = typeof args.mapId === "string" ? args.mapId : "";
      const parentId = typeof args.parentId === "string" ? args.parentId : "";
      if (!canReparentMap(draft.mapTree, mapId, parentId)) throw new ToolError(`맵/폴더 ${mapId}을 ${parentId || "루트"} 아래로 이동할 수 없습니다.`, { code: "invalid-map-tree-move" });
      const oldParentId = findParentMapId(draft.mapTree, mapId);
      const oldIndex = siblingIndex(draft.mapTree, mapId);
      const node = extractTreeNode(draft.mapTree, mapId);
      if (!node) throw new ToolError(`이동할 맵/폴더를 찾을 수 없습니다: ${mapId}`, { code: "map-tree-node-not-found" });
      if (!insertTreeNode(draft.mapTree, node, parentId, args.index as number | undefined)) {
        insertTreeNode(draft.mapTree, node, oldParentId ?? "", oldIndex);
        throw new ToolError(`상위 폴더를 찾을 수 없습니다: ${parentId || "(루트)"}`, { code: "map-tree-parent-not-found" });
      }
      return { summary: `맵/분류 ${mapId} 이동 → ${parentId || "루트"}`, data: { mapId, parentId } };
    }
    throw new ToolError(`지원하지 않는 map tree 작업입니다: ${String(operation)}`, { code: "invalid-args" });
  },
};

const paintTiles: ToolDefinition = {
  name: "paint_tiles",
  description: "타일을 칠한다. mode: rect(사각형)/line(선)/fill(채우기)/cells(개별 셀). 통행성이 바뀌면 경고를 반환한다. 투명 배경 칩(벤치·나무·사선 지붕 등)은 상위 레이어 전용이라 자동 라우팅된다. 지형 오토타일 멤버(흙길/모래 등)는 이웃에 맞춰 자동 재성형된다(외딴 점·오목 코너 포함).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      layer: { type: "string", enum: ["lower", "upper"] },
      mode: { type: "string", enum: ["rect", "line", "fill", "cells"] },
      tile: { type: "integer", description: "타일 인덱스(-1=비움)" },
      from: COORD_SCHEMA,
      to: COORD_SCHEMA,
      cells: { type: "array", description: "[{x,y}...]", items: COORD_SCHEMA },
    },
    required: ["mapId", "layer", "mode", "tile"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    let layer = args.layer as "lower" | "upper";
    const tile = args.tile as number;
    const mode = args.mode as "rect" | "line" | "fill" | "cells";
    const from = args.from as Point | undefined;
    const to = args.to as Point | undefined;
    const cells = args.cells as Point[] | undefined;

    // 에디터 수동 페인트(effectiveLayer)와 같은 규칙으로 레이어를 라우팅한다 —
    // 홈 레이어가 단일 판정되는 타일(투명 배경 칩 = 상위 전용 등)은 요청과 무관하게 홈에 놓는다.
    let routedNote: string | null = null;
    const tileset = draft.tilesets[map.tilesetId];
    if (tile >= 0 && tileset) {
      const home = tileLayerHome(tileset, tile);
      if (home !== "both" && home !== layer) {
        if (mode === "fill") {
          throw new ToolError(
            `타일 ${tile}은(는) ${home === "upper" ? "상위(투명 배경 칩)" : "하위"} 레이어 전용입니다 — fill 모드는 lower만 지원하므로 rect/cells 모드로 칠하세요.`
          );
        }
        layer = home;
        routedNote = `타일 ${tile}은(는) ${home === "upper" ? "상위 레이어 전용(투명 배경 칩)" : "하위 레이어 전용"}이라 ${home}에 배치했습니다.`;
      }
    }

    let targetCells: Point[] = [];
    if (mode === "rect") {
      if (!from || !to) throw new ToolError("rect 모드는 from/to가 필요합니다.");
      for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y += 1)
        for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x += 1) targetCells.push({ x, y });
    } else if (mode === "line") {
      if (!from || !to) throw new ToolError("line 모드는 from/to가 필요합니다.");
      targetCells = lineCells(from, to);
    } else if (mode === "fill") {
      if (!from) throw new ToolError("fill 모드는 from(시작점)이 필요합니다.");
      if (layer !== "lower") throw new ToolError("fill 모드는 lower 레이어만 지원합니다.");
      targetCells = floodFillCells(map, from, tile);
    } else {
      if (!cells || cells.length === 0) throw new ToolError("cells 모드는 cells 배열이 필요합니다.");
      targetCells = cells;
    }

    const paintResult = applyClusterAwarePaint(map, tileset, layer, tile, targetCells);
    // 에디터 수동 페인트와 동일하게 지형 오토타일(흙길/모래 등)을 재성형한다 —
    // 편집 주변의 그룹 멤버 셀만 바뀌므로 비멤버 페인트에는 사실상 no-op.
    if (paintResult.lowerTouched.size > 0) {
      const lowerPoints = paintResult.touched.filter((cell) => paintResult.lowerTouched.has(coordKey(cell.x, cell.y)));
      for (const group of autotileGroupsForTileset(tileset)) shapeAutotileGroupAround(map, group, lowerPoints);
    }
    const warning = paintResult.touched.some((cell) => paintResult.lowerTouched.has(coordKey(cell.x, cell.y)))
      ? passabilityWarning(draft, map, paintResult.touched)
      : null;
    const skippedNote = paintResult.skipped > 0 ? `hard 규칙 동반 배치가 불가능한 ${paintResult.skipped}칸은 거부했습니다.` : null;
    const autoNote = paintResult.autoTiles > 0 ? `클러스터 동반 ${paintResult.autoTiles}타일 자동 포함` : null;
    const warnings = [...(routedNote ? [routedNote] : []), ...(skippedNote ? [skippedNote] : []), ...(warning ? [warning] : [])];
    return {
      summary: `${map.name}에 타일 ${tile} 페인트(${mode}, ${layer}, ${paintResult.touched.length}칸)${routedNote ? " — 상위 전용 칩 자동 라우팅" : ""}${autoNote ? ` — ${autoNote}` : ""}${skippedNote ? ` — ${skippedNote}` : ""}`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: { autoClusterTiles: paintResult.autoTiles, skippedClusterCells: paintResult.skipped, tilesTouched: paintResult.touched.length },
    };
  },
};

function applyClusterAwarePaint(
  map: GameMap,
  tileset: Project["tilesets"][string] | undefined,
  layer: "lower" | "upper",
  tile: number,
  cells: readonly Point[]
): { readonly autoTiles: number; readonly lowerTouched: ReadonlySet<string>; readonly skipped: number; readonly touched: readonly Point[] } {
  const planned = new Map<string, HardClusterTileEdit>();
  let autoTiles = 0;
  let skipped = 0;
  for (const cell of cells) {
    if (!inMapBounds(map, cell.x, cell.y)) {
      skipped += 1;
      continue;
    }
    const expansion = tileset
      ? expandHardClusterPlacement({ map, origin: cell, originLayer: layer, tile, tileset })
      : { autoTiles: 0, edits: [{ layer, tile, x: cell.x, y: cell.y }], ok: true as const };
    if (!expansion.ok || hasPaintConflict(planned, expansion.edits)) {
      skipped += 1;
      continue;
    }
    for (const edit of expansion.edits) planned.set(editKey(edit), edit);
    autoTiles += expansion.autoTiles;
  }

  const touched: Point[] = [];
  const lowerTouched = new Set<string>();
  for (const edit of planned.values()) {
    if (edit.layer === "lower") {
      setLower(map, edit.x, edit.y, edit.tile);
      lowerTouched.add(coordKey(edit.x, edit.y));
    } else {
      map.upperTiles[edit.y * map.width + edit.x] = edit.tile;
    }
    touched.push({ x: edit.x, y: edit.y });
  }
  return { autoTiles, lowerTouched, skipped, touched };
}

function hasPaintConflict(planned: ReadonlyMap<string, HardClusterTileEdit>, edits: readonly HardClusterTileEdit[]): boolean {
  for (const edit of edits) {
    const existing = planned.get(editKey(edit));
    if (existing && existing.tile !== edit.tile) return true;
    const otherLayer = planned.get(`${edit.layer === "lower" ? "upper" : "lower"}:${edit.x},${edit.y}`);
    if (otherLayer && otherLayer.tile !== TILE.EMPTY && edit.tile !== TILE.EMPTY) return true;
  }
  return false;
}

function editKey(edit: HardClusterTileEdit): string {
  return `${edit.layer}:${edit.x},${edit.y}`;
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

const paintRoad: ToolDefinition = {
  name: "paint_road",
  description: `폴리라인을 따라 도로를 깐다. style: dirt(흙길)/sand(모래). 프리셋이 있으면 개별 타일 id/style보다 presetId+paletteRole을 우선 사용하라. 오토타일로 가장자리를 자동 성형한다. ${NATURALNESS_GUIDANCE}`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      points: { type: "array", description: "[{x,y}...] 경로 꼭짓점", items: COORD_SCHEMA },
      style: { type: "string", enum: ["dirt", "sand"] },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 slot tileIds에서 선택" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      naturalness: { type: "number", description: "0~1 자연도. 0은 기존 직선 세그먼트와 동일, 기본 0.5" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 자연 경로)" },
    },
    required: ["mapId", "points"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const points = args.points as Point[];
    const style = args.style as "dirt" | "sand" | undefined;
    const naturalness = naturalnessArg(args);
    if (points.length < 1) throw new ToolError("경로에는 최소 1개의 점이 필요합니다.");
    const tileset = draft.tilesets[map.tilesetId];
    const picker = tileset ? paletteTilePickerForTool(tileset, args, roadSeedSignature(map, points, naturalness)) : null;
    if (!picker && style !== "dirt" && style !== "sand") {
      throw new ToolError("paint_road에는 style(dirt/sand) 또는 presetId+paletteRole이 필요합니다.", { code: "invalid-args", mapId: map.id });
    }
    const painted: Point[] = [];
    const body = picker ? () => picker.pick() : () => style === "dirt" ? DIRT_ROAD_TILE.BODY : SAND_TILE.BODY;
    const pathCells = naturalness === 0
      ? paintStraightRoad(map, points, body, painted)
      : paintNaturalRoad(map, points, body, naturalness, args, painted);
    if (!picker && style === "dirt") shapeRoadAround(map, painted);
    else if (!picker && style === "sand") shapeSandAround(map, painted);
    const source = picker ? `${picker.presetId}/${picker.role}` : style;
    return { summary: `${map.name}에 ${source} 도로 ${painted.length}칸 — 자연도 ${naturalnessLabel(naturalness)} / 경로 ${pathCells}칸` };
  },
};

function paintStraightRoad(map: GameMap, points: readonly Point[], body: () => number, painted: Point[]): number {
  let pathCells = 0;
  for (let i = 0; i < points.length; i += 1) {
    const segmentCells = i === 0 ? [points[0]] : lineCells(points[i - 1], points[i]);
    pathCells += segmentCells.filter((cell) => inMapBounds(map, cell.x, cell.y)).length;
    for (const cell of segmentCells) paintRoadCell(map, cell, body(), painted);
  }
  return pathCells;
}

function paintNaturalRoad(
  map: GameMap,
  points: readonly Point[],
  body: () => number,
  naturalness: number,
  args: Record<string, unknown>,
  painted: Point[]
): number {
  const result = wobblePath(points, naturalness, rngForTool(args, roadSeedSignature(map, points, naturalness)));
  const pathCells = result.path.filter((cell) => inMapBounds(map, cell.x, cell.y)).length;
  for (const cell of result.path) paintRoadCell(map, cell, body(), painted);
  for (const cell of result.widthCells) paintRoadCell(map, cell, body(), painted);
  return pathCells;
}

function paintRoadCell(map: GameMap, cell: Point, body: number, painted: Point[]): void {
  if (!inMapBounds(map, cell.x, cell.y)) return;
  map.lowerTiles[cell.y * map.width + cell.x] = body;
  map.upperTiles[cell.y * map.width + cell.x] = TILE.EMPTY;
  painted.push(cell);
}

function roadSeedSignature(map: GameMap, points: readonly Point[], naturalness: number): string {
  return `paint_road|${map.id}|${map.width}x${map.height}|${naturalnessLabel(naturalness)}|${points.map(pointSignature).join(";")}`;
}

const STRUCTURE_STYLES: readonly TownCityPlotStyle[] = ["l", "courtyard", "multi", "road", "plaster", "stone"];

const stampStructure: ToolDefinition = {
  name: "stamp_structure",
  description: `집/구조물 템플릿을 찍는다. template: l(ㄴ자 집)/courtyard(안뜰 딸린 집)/multi(연립 주택)/road(길)/plaster(회벽 소형 집)/stone(석조 소형 집). 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. 반환 diff에 문 좌표를 포함한다. ${NATURALNESS_GUIDANCE}`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      template: { type: "string", enum: STRUCTURE_STYLES as unknown as string[] },
      origin: { ...COORD_SCHEMA, description: "{x,y} 좌상단" },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 slot tileIds에서 선택" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      naturalness: { type: "number", description: "0~1 자연도. origin을 최대 2칸 지터(기본 0.5)" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 지터)" },
    },
    required: ["mapId", "template", "origin"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const template = args.template as TownCityPlotStyle;
    const requestedOrigin = args.origin as Point;
    const naturalness = naturalnessArg(args);
    if (!STRUCTURE_STYLES.includes(template)) throw new ToolError(`알 수 없는 구조물 템플릿: ${template}`);
    const tileset = draft.tilesets[map.tilesetId];
    const picker = tileset ? paletteTilePickerForTool(tileset, args, structureSeedSignature(map, template, requestedOrigin, naturalness)) : null;
    const origin = jitterPlacement(
      requestedOrigin,
      jitterMaxOffset(naturalness),
      rngForTool(args, structureSeedSignature(map, template, requestedOrigin, naturalness)),
      (candidate) => inMapBounds(map, candidate.x, candidate.y)
    );
    const before = snapshotTiles(map);
    stampTownCityPlot(map, template, origin.x, origin.y);
    const paletteTiles = picker && tileset
      ? applyPaletteToChangedCells(map, tileset, before, { x: origin.x, y: origin.y, width: 18, height: 16 }, picker)
      : 0;
    // 문 좌표는 대략적으로 구조물 하단 중앙으로 추정(정확 좌표는 템플릿별 상이).
    const door = { x: origin.x + 3, y: origin.y + 4 };
    return {
      summary: `${map.name}에 '${template}' 구조물 스탬프(${origin.x},${origin.y}) — 자연도 ${naturalnessLabel(naturalness)}${picker ? ` — 프리셋 ${picker.presetId}/${picker.role} ${paletteTiles}칸` : ""}`,
      data: { door, origin, paletteTiles },
    };
  },
};

const HOUSE_MATERIALS: readonly SmallHouseMaterial[] = ["plaster", "wood", "stone"];
const HOUSE_DOOR_TOP = 116;
const HOUSE_DOOR_BOTTOM = 146;

// 임의 크기 집 생성 — 벽 타일로 사각형을 채우는 오답("10x10 집" 사고)을 막는 정공법.
// 파라메트릭 buildPlan(지붕 4행 + 벽 N행 + 문 + 창문)을 합성해 스탬프 실행기에 넘긴다.
const HOUSE_MIN_WIDTH = 5;
const HOUSE_MAX_WIDTH = 30;
const HOUSE_MIN_HEIGHT = 6; // 지붕 4행 + 벽 최소 2행.
const HOUSE_MAX_HEIGHT = 24;

type HouseBuildArgs = {
  readonly origin: Point;
  readonly width: number;
  readonly height: number;
  readonly material: SmallHouseMaterial;
};

function houseBuildArgs(map: GameMap, args: Record<string, unknown>): HouseBuildArgs {
  const origin = args.origin as Point;
  const width = args.width as number;
  const height = args.height as number;
  const material = args.material as SmallHouseMaterial;
  if (!HOUSE_MATERIALS.includes(material)) throw new ToolError(`알 수 없는 재질: ${String(args.material)} (${HOUSE_MATERIALS.join("/")})`);
  if (!Number.isInteger(width) || width < HOUSE_MIN_WIDTH || width > HOUSE_MAX_WIDTH) {
    throw new ToolError(`width는 ${HOUSE_MIN_WIDTH}~${HOUSE_MAX_WIDTH} 사이여야 합니다: ${String(args.width)}`, { code: "invalid-args" });
  }
  if (!Number.isInteger(height) || height < HOUSE_MIN_HEIGHT || height > HOUSE_MAX_HEIGHT) {
    throw new ToolError(`height는 ${HOUSE_MIN_HEIGHT}~${HOUSE_MAX_HEIGHT} 사이여야 합니다(지붕 4행 포함): ${String(args.height)}`, { code: "invalid-args" });
  }
  if (origin.x < 0 || origin.y < 0 || origin.x + width > map.width || origin.y + height > map.height) {
    throw new ToolError(
      `집(${width}×${height})이 맵을 벗어납니다 — origin (${origin.x},${origin.y}), 맵 ${map.width}×${map.height}`,
      { code: "out-of-bounds", mapId: map.id, x: origin.x, y: origin.y }
    );
  }
  return { origin, width, height, material };
}

function houseFits(map: GameMap, origin: Point, width: number, height: number): boolean {
  return origin.x >= 0 && origin.y >= 0 && origin.x + width <= map.width && origin.y + height <= map.height;
}

function houseSeedSignature(map: GameMap, house: HouseBuildArgs, naturalness: number): string {
  return [
    "build_house",
    map.id,
    `${map.width}x${map.height}`,
    pointSignature(house.origin),
    `${house.width}x${house.height}`,
    house.material,
    naturalnessLabel(naturalness),
  ].join("|");
}

function structureSeedSignature(map: GameMap, template: TownCityPlotStyle, origin: Point, naturalness: number): string {
  return ["stamp_structure", map.id, `${map.width}x${map.height}`, template, pointSignature(origin), naturalnessLabel(naturalness)].join("|");
}

function pointSignature(point: Point): string {
  return `${point.x},${point.y}`;
}

type TileSnapshot = {
  readonly lower: readonly number[];
  readonly upper: readonly number[];
};

type PaletteApplyBounds = {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

function snapshotTiles(map: GameMap): TileSnapshot {
  return { lower: [...map.lowerTiles], upper: [...map.upperTiles] };
}

function applyPaletteToChangedCells(
  map: GameMap,
  tileset: TilesetDef,
  before: TileSnapshot,
  bounds: PaletteApplyBounds,
  picker: PaletteTilePicker
): number {
  let applied = 0;
  const x1 = Math.min(map.width, bounds.x + bounds.width);
  const y1 = Math.min(map.height, bounds.y + bounds.height);
  for (let y = Math.max(0, bounds.y); y < y1; y += 1) {
    for (let x = Math.max(0, bounds.x); x < x1; x += 1) {
      const index = y * map.width + x;
      const lowerChanged = before.lower[index] !== map.lowerTiles[index];
      const upperChanged = before.upper[index] !== map.upperTiles[index];
      if (!lowerChanged && !upperChanged) continue;
      if (!paletteRoleAppliesToCell(picker.role, y - bounds.y, bounds.height, lowerChanged, upperChanged)) continue;
      placePaletteTile(map, tileset, x, y, picker.pick(), picker.role);
      applied += 1;
    }
  }
  return applied;
}

function paletteRoleAppliesToCell(
  role: PaletteSlotRole,
  relativeY: number,
  height: number,
  lowerChanged: boolean,
  upperChanged: boolean
): boolean {
  switch (role) {
    case "roof":
      return upperChanged || relativeY < Math.min(4, height);
    case "wall":
      return lowerChanged && relativeY >= Math.min(3, height - 1);
    case "path":
    case "ground":
    case "water":
    case "boundary":
      return lowerChanged;
    case "decor":
    case "furniture":
      return upperChanged || !lowerChanged;
  }
}

function placePaletteTile(map: GameMap, tileset: TilesetDef, x: number, y: number, tile: number, role: PaletteSlotRole): void {
  const index = y * map.width + x;
  const layer = paletteLayerForTile(tileset, tile, role);
  if (layer === "upper") {
    map.upperTiles[index] = tile;
  } else {
    setLower(map, x, y, tile);
    map.upperTiles[index] = TILE.EMPTY;
  }
}

function paletteLayerForTile(tileset: TilesetDef, tile: number, role: PaletteSlotRole): "lower" | "upper" {
  if (role === "decor" || role === "furniture" || role === "roof") return "upper";
  const home = tileLayerHome(tileset, tile);
  if (home === "upper" || home === "lower") return home;
  return "lower";
}

function stampBuildHouse(map: GameMap, { origin, width, height, material }: HouseBuildArgs): Point {
  const result = stampRectHouseKit(map, {
    x: origin.x,
    y: origin.y,
    width,
    stories: 1,
    roofBodyRows: Math.max(1, height - 5),
    kitId: kitIdForSmallHouseMaterial(material),
  });
  if (!result.ok || !result.doorAt) throw new ToolError(result.reason ?? "집 시공 실패", { code: "house-kit-failed", mapId: map.id });
  const door = result.doorAt;
  map.lowerTiles[(door.y - 1) * map.width + door.x] = HOUSE_DOOR_TOP;
  map.lowerTiles[door.y * map.width + door.x] = HOUSE_DOOR_BOTTOM;
  return door;
}

function houseGrid(map: GameMap, origin: Point, width: number, height: number): { readonly lower: number[][]; readonly upper: number[][] } {
  const lower: number[][] = [];
  const upper: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    const lowerRow: number[] = [];
    const upperRow: number[] = [];
    for (let x = 0; x < width; x += 1) {
      const index = (origin.y + y) * map.width + origin.x + x;
      lowerRow.push(map.lowerTiles[index] ?? TILE.EMPTY);
      upperRow.push(map.upperTiles[index] ?? TILE.EMPTY);
    }
    lower.push(lowerRow);
    upper.push(upperRow);
  }
  return { lower, upper };
}

const previewHouse: ToolDefinition = {
  name: "preview_house",
  description:
    "요청한 크기의 집을 실제 맵에 짓지 않고 미리보기한다. build_house와 같은 스탬프 로직으로 throwaway 복제 맵에 찍은 뒤, 이미지 렌더링용 lower/upper 타일 그리드를 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { ...COORD_SCHEMA, description: "{x,y} 좌상단" },
      width: { type: "integer", description: `가로 칸 수(${HOUSE_MIN_WIDTH}~${HOUSE_MAX_WIDTH})` },
      height: { type: "integer", description: `세로 칸 수(${HOUSE_MIN_HEIGHT}~${HOUSE_MAX_HEIGHT}, 지붕 4행 포함)` },
      material: { type: "string", enum: HOUSE_MATERIALS as unknown as string[] },
    },
    required: ["mapId", "origin", "width", "height", "material"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const house = houseBuildArgs(map, args);
    const previewMap = structuredClone(map);
    const door = stampBuildHouse(previewMap, house);
    const grid = houseGrid(previewMap, house.origin, house.width, house.height);
    return {
      summary: `${map.name}에 ${house.width}×${house.height} ${house.material} 집 미리보기(${house.origin.x},${house.origin.y}) — 문 (${door.x},${door.y})`,
      data: { tilesetId: map.tilesetId, x: house.origin.x, y: house.origin.y, w: house.width, h: house.height, lower: grid.lower, upper: grid.upper, door },
    };
  },
};

const buildHouse: ToolDefinition = {
  name: "build_house",
  description:
    `요청한 크기의 직사각형 집을 짓는다(지붕 4행 + 벽 + 문 + 창문 자동 구성). width 5~30, height 6~24, material: plaster(회벽)/wood(목재)/stone(석재). 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. '10x10 집'처럼 크기가 지정된 집은 벽 타일을 직접 칠하지 말고 이 툴을 써라. 반환 data에 문 좌표 포함. ${NATURALNESS_GUIDANCE}`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { ...COORD_SCHEMA, description: "{x,y} 좌상단" },
      width: { type: "integer", description: `가로 칸 수(${HOUSE_MIN_WIDTH}~${HOUSE_MAX_WIDTH})` },
      height: { type: "integer", description: `세로 칸 수(${HOUSE_MIN_HEIGHT}~${HOUSE_MAX_HEIGHT}, 지붕 4행 포함)` },
      material: { type: "string", enum: HOUSE_MATERIALS as unknown as string[] },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 slot tileIds에서 선택" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      naturalness: { type: "number", description: "0~1 자연도. origin을 최대 2칸 지터(기본 0.5)" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 지터)" },
    },
    required: ["mapId", "origin", "width", "height", "material"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const baseHouse = houseBuildArgs(map, args);
    const naturalness = naturalnessArg(args);
    const tileset = draft.tilesets[map.tilesetId];
    const picker = tileset ? paletteTilePickerForTool(tileset, args, houseSeedSignature(map, baseHouse, naturalness)) : null;
    const origin = jitterPlacement(
      baseHouse.origin,
      jitterMaxOffset(naturalness),
      rngForTool(args, houseSeedSignature(map, baseHouse, naturalness)),
      (candidate) => houseFits(map, candidate, baseHouse.width, baseHouse.height)
    );
    const house = { ...baseHouse, origin };
    const before = snapshotTiles(map);
    const door = stampBuildHouse(map, house);
    const paletteTiles = picker && tileset
      ? applyPaletteToChangedCells(map, tileset, before, { x: house.origin.x, y: house.origin.y, width: house.width, height: house.height }, picker)
      : 0;
    return {
      summary: `${map.name}에 ${house.width}×${house.height} ${house.material} 집 건설(${house.origin.x},${house.origin.y}) — 문 (${door.x},${door.y}) — 자연도 ${naturalnessLabel(naturalness)}${picker ? ` — 프리셋 ${picker.presetId}/${picker.role} ${paletteTiles}칸` : ""}`,
      data: { door, origin: house.origin, width: house.width, height: house.height, material: house.material, paletteTiles },
    };
  },
};

// 영역 일괄 정리 — 잘못 깐 구조물/타일 무더기를 한 번에 걷어낸다.
const clearRegion: ToolDefinition = {
  name: "clear_region",
  description:
    "맵의 사각 영역을 정리한다: 상위 레이어는 비우고, 하위 레이어는 잔디(fill=grass, 기본) 또는 빈 칸(fill=empty)으로 되돌린다. 잘못 배치한 구조물을 지울 때 사용. 이벤트는 지우지 않고 경고로 알린다.",
  mode: "write",
  invalidArgsExample: { mapId: "map_1", x: 0, y: 0, w: 10, h: 8, layer: "both" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
      layer: { type: "string", enum: ["lower", "upper", "both"], description: "정리할 레이어(기본 both)" },
      fill: { type: "string", enum: ["grass", "empty"], description: "하위 레이어를 채울 값(기본 grass)" },
    },
    required: ["mapId", "x", "y", "w", "h"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x0 = Math.max(0, args.x as number);
    const y0 = Math.max(0, args.y as number);
    const x1 = Math.min(map.width, x0 + (args.w as number));
    const y1 = Math.min(map.height, y0 + (args.h as number));
    if (x1 <= x0 || y1 <= y0) throw new ToolError("정리할 영역이 맵과 겹치지 않습니다.", { code: "invalid-args" });
    const layer = (args.layer as "lower" | "upper" | "both" | undefined) ?? "both";
    const lowerFill = (args.fill as "grass" | "empty" | undefined) === "empty" ? TILE.EMPTY : TILE.GRASS;
    let cells = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const index = y * map.width + x;
        if (layer !== "upper") map.lowerTiles[index] = lowerFill;
        if (layer !== "lower") map.upperTiles[index] = TILE.EMPTY;
        cells += 1;
      }
    }
    const events = map.events.filter((event) => event.x >= x0 && event.x < x1 && event.y >= y0 && event.y < y1);
    return {
      summary: `${map.name} 영역 (${x0},${y0})~(${x1 - 1},${y1 - 1}) 정리 — ${cells}칸 (${layer}, 하위=${lowerFill === TILE.EMPTY ? "빈 칸" : "잔디"})`,
      warnings: events.length > 0 ? [`영역 안 이벤트 ${events.length}개는 남겨둠: ${events.map((event) => event.id).join(", ")} — 삭제하려면 remove_event`] : undefined,
      data: { cleared: cells, events: events.map((event) => event.id) },
    };
  },
};

// 영역 대칭 변환 — LLM 판단 없는 결정적 변환(코퍼스 mirror-symmetry가 "불가"이던 갭 해소).
// 비대칭 오토타일 경계는 후처리하지 않는다(설명에 명시).
const mirrorRegion: ToolDefinition = {
  name: "mirror_region",
  description:
    "사각 영역의 타일(하위/상위/스택)과 영역 안 이벤트 좌표를 좌우(horizontal) 또는 상하(vertical)로 대칭 변환한다. 결정적 변환 — 오토타일 경계는 보정하지 않으므로 필요하면 이후 다듬기 지시를 권한다.",
  mode: "write",
  invalidArgsExample: { mapId: "map_1", x: 2, y: 2, w: 8, h: 6, axis: "horizontal" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
      axis: { type: "string", enum: ["horizontal", "vertical"] },
    },
    required: ["mapId", "x", "y", "w", "h", "axis"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const axis = args.axis as "horizontal" | "vertical";
    const x0 = Math.max(0, args.x as number);
    const y0 = Math.max(0, args.y as number);
    const x1 = Math.min(map.width, x0 + (args.w as number));
    const y1 = Math.min(map.height, y0 + (args.h as number));
    if (x1 <= x0 || y1 <= y0) throw new ToolError("대칭할 영역이 맵과 겹치지 않습니다.", { code: "invalid-args" });

    const mirrorX = (x: number): number => (axis === "horizontal" ? x0 + (x1 - 1) - x : x);
    const mirrorY = (y: number): number => (axis === "vertical" ? y0 + (y1 - 1) - y : y);

    const srcLower = map.lowerTiles.slice();
    const srcUpper = map.upperTiles.slice();
    const srcLowerStacks = structuredClone(map.lowerTileStacks ?? {});
    const srcUpperStacks = structuredClone(map.upperTileStacks ?? {});
    const nextLowerStacks: Record<number, number[]> = structuredClone(map.lowerTileStacks ?? {});
    const nextUpperStacks: Record<number, number[]> = structuredClone(map.upperTileStacks ?? {});

    let cells = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const di = y * map.width + x;
        const si = mirrorY(y) * map.width + mirrorX(x);
        map.lowerTiles[di] = srcLower[si];
        map.upperTiles[di] = srcUpper[si];
        const lowerStack = srcLowerStacks[si];
        if (lowerStack) nextLowerStacks[di] = lowerStack.slice();
        else delete nextLowerStacks[di];
        const upperStack = srcUpperStacks[si];
        if (upperStack) nextUpperStacks[di] = upperStack.slice();
        else delete nextUpperStacks[di];
        cells += 1;
      }
    }
    if (Object.keys(nextLowerStacks).length > 0) map.lowerTileStacks = nextLowerStacks;
    else delete map.lowerTileStacks;
    if (Object.keys(nextUpperStacks).length > 0) map.upperTileStacks = nextUpperStacks;
    else delete map.upperTileStacks;

    let movedEvents = 0;
    for (const event of map.events) {
      if (event.x < x0 || event.x >= x1 || event.y < y0 || event.y >= y1) continue;
      const nx = mirrorX(event.x);
      const ny = mirrorY(event.y);
      if (nx !== event.x || ny !== event.y) {
        event.x = nx;
        event.y = ny;
        movedEvents += 1;
      }
    }
    return {
      summary: `${map.name} 영역 (${x0},${y0})~(${x1 - 1},${y1 - 1}) ${axis === "horizontal" ? "좌우" : "상하"} 대칭 — ${cells}칸, 이벤트 ${movedEvents}개 이동`,
      data: { cells, movedEvents, axis },
    };
  },
};

const setStartPosition: ToolDefinition = {
  name: "set_start_position",
  description: "게임 시작 맵/좌표를 지정한다. 통행 불가 타일이면 실패한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
    },
    required: ["mapId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x = args.x as number;
    const y = args.y as number;
    if (!inMapBounds(map, x, y)) throw new ToolError(`시작 위치가 맵 밖입니다: (${x}, ${y})`, { code: "start-out-of-bounds", mapId: map.id, x, y });
    if (!isPassable(draft, map, x, y)) {
      throw new ToolError(`시작 위치가 통행 불가 타일입니다: (${x}, ${y})`, { code: "start-impassable", mapId: map.id, x, y });
    }
    draft.startMapId = map.id;
    draft.startPos = { x, y };
    return { summary: `시작 위치 설정: ${map.name} (${x}, ${y})` };
  },
};

const setTilePassability: ToolDefinition = {
  name: "set_tile_passability",
  description: "타일셋의 특정 타일 통행 가능 여부를 설정한다(4방향 일괄). 겉보기와 실제 통행성이 다른 타일을 고칠 때 사용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      tile: { type: "integer", description: "타일 인덱스" },
      passable: { type: "boolean" },
    },
    required: ["tile", "passable"],
  },
  run(draft, args): ToolExecResult {
    const tilesetId = (args.tilesetId as string | undefined) ?? DEFAULT_TILESET_ID;
    const tileset = draft.tilesets[tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { code: "tileset-not-found" });
    const tile = args.tile as number;
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) {
      throw new ToolError(`타일 인덱스 범위 밖: ${tile} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
    }
    const passable = args.passable === true;
    tileset.passability[tile] = { up: passable, down: passable, left: passable, right: passable };
    // 사용자 확정 메타로 기록 — 없으면 다음 로드 때 하네스 계약이 통행성을 되돌린다.
    markUserTileRuntimeMetadata(tileset, tile, { passage: passable ? "passable" : "solid" });
    return { summary: `타일 ${tile} 통행성 → ${passable ? "통행 가능" : "통행 불가"} (${tilesetId})`, data: { tilesetId, tile, passable } };
  },
};

const rectSchema: JsonSchema = {
  type: "object",
  properties: {
    x: { type: "integer" },
    y: { type: "integer" },
    w: { type: "integer" },
    h: { type: "integer" },
  },
  required: ["x", "y", "w", "h"],
};

const encounterConditionsSchema: JsonSchema = {
  type: "object",
  properties: {
    switchId: { type: "string" },
    variableId: { type: "string" },
    atLeast: { type: "integer" },
    minPartyLevel: { type: "integer" },
    maxPartyLevel: { type: "integer" },
    region: rectSchema,
    timePhase: { type: "string", enum: TIME_PHASES },
    season: { type: "string", enum: SEASONS },
  },
};

const encounterEntrySchema: JsonSchema = {
  type: "object",
  properties: {
    troopId: { type: "string" },
    weight: { type: "integer" },
    conditions: encounterConditionsSchema,
  },
  required: ["troopId", "weight"],
};

const fieldGraphicSchema: JsonSchema = {
  type: "object",
  description: "EventPageGraphic 형태. 예: {sprite:{type:'uploaded',id:'...'},direction:'down',pattern:0}",
  additionalProperties: true,
};

const roguelikeEncounterChoiceSchema: JsonSchema = {
  type: "object",
  properties: {
    fieldSpawnId: { type: "string" },
    weight: { type: "integer" },
    minFloor: { type: "integer" },
    maxFloor: { type: "integer" },
  },
  required: ["fieldSpawnId"],
};

const roguelikeEncounterSlotSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    choices: { type: "array", items: roguelikeEncounterChoiceSchema },
  },
  required: ["id", "choices"],
};

function parseEncounterEntries(draft: Project, map: GameMap, value: unknown): EncounterTableEntry[] {
  if (!Array.isArray(value)) throw new ToolError("entries는 배열이어야 합니다.", { code: "invalid-entries", mapId: map.id });
  return value.map((entryValue, index) => parseEncounterEntry(draft, map, entryValue, `entries[${index}]`));
}

function parseEncounterEntry(draft: Project, map: GameMap, value: unknown, label: string): EncounterTableEntry {
  const entry = requireRecordValue(value, label);
  const troopId = stringField(entry, "troopId", label);
  assertKnownTroop(draft, troopId);
  const weight = integerField(entry, "weight", label);
  if (weight <= 0) throw new ToolError(`${label}.weight는 1 이상이어야 합니다.`, { code: "invalid-weight", mapId: map.id });
  const conditions = entry.conditions === undefined ? undefined : parseEncounterConditions(draft, map, entry.conditions, `${label}.conditions`);
  return conditions ? { troopId, weight, conditions } : { troopId, weight };
}

function parseEncounterConditions(draft: Project, map: GameMap, value: unknown, label: string): EncounterTableEntry["conditions"] {
  const input = requireRecordValue(value, label);
  const conditions: NonNullable<EncounterTableEntry["conditions"]> = {};
  if (input.switchId !== undefined) {
    conditions.switchId = stringField(input, "switchId", label);
    if (!draft.switches.some((sw) => sw.id === conditions.switchId)) {
      throw new ToolError(`${label}.switchId가 존재하지 않습니다: ${conditions.switchId}`, { code: "switch-not-found", mapId: map.id });
    }
  }
  if (input.variableId !== undefined) {
    conditions.variableId = stringField(input, "variableId", label);
    if (!draft.variables.some((variable) => variable.id === conditions.variableId)) {
      throw new ToolError(`${label}.variableId가 존재하지 않습니다: ${conditions.variableId}`, { code: "variable-not-found", mapId: map.id });
    }
    conditions.atLeast = integerField(input, "atLeast", label);
  }
  if (input.minPartyLevel !== undefined) conditions.minPartyLevel = integerField(input, "minPartyLevel", label);
  if (input.maxPartyLevel !== undefined) conditions.maxPartyLevel = integerField(input, "maxPartyLevel", label);
  if (conditions.minPartyLevel !== undefined && conditions.maxPartyLevel !== undefined && conditions.minPartyLevel > conditions.maxPartyLevel) {
    throw new ToolError(`${label}: minPartyLevel이 maxPartyLevel보다 큽니다.`, { code: "invalid-level-range", mapId: map.id });
  }
  if (input.region !== undefined) conditions.region = parseRect(input.region, `${label}.region`, map);
  if (input.timePhase !== undefined) {
    const timePhase = stringField(input, "timePhase", label);
    if (!isTimePhase(timePhase)) throw new ToolError(`${label}.timePhase가 잘못되었습니다: ${timePhase}`, { code: "invalid-time-phase", mapId: map.id });
    conditions.timePhase = timePhase;
  }
  if (input.season !== undefined) {
    const season = stringField(input, "season", label);
    if (!isSeason(season)) throw new ToolError(`${label}.season이 잘못되었습니다: ${season}`, { code: "invalid-season", mapId: map.id });
    conditions.season = season;
  }
  return conditions;
}

function parseFieldSpawn(draft: Project, map: GameMap, value: unknown, label: string): FieldSpawnDef {
  const input = requireRecordValue(value, label);
  const id = stringField(input, "id", label).trim();
  if (!id) throw new ToolError(`${label}.id는 비울 수 없습니다.`, { code: "invalid-spawn-id", mapId: map.id });
  const troopId = stringField(input, "troopId", label);
  assertKnownTroop(draft, troopId);
  const spawn: FieldSpawnDef = {
    id,
    troopId,
    area: parseRect(input.area, `${label}.area`, map),
  };
  if (input.maxAlive !== undefined) {
    const maxAlive = integerField(input, "maxAlive", label);
    if (maxAlive <= 0) throw new ToolError(`${label}.maxAlive는 1 이상이어야 합니다.`, { code: "invalid-max-alive", mapId: map.id });
    spawn.maxAlive = maxAlive;
  }
  if (input.respawnSec !== undefined) {
    const respawnSec = numberField(input, "respawnSec", label);
    if (respawnSec < 0) throw new ToolError(`${label}.respawnSec는 0 이상이어야 합니다.`, { code: "invalid-respawn", mapId: map.id });
    spawn.respawnSec = respawnSec;
  }
  if (input.chase !== undefined) spawn.chase = booleanField(input, "chase", label);
  if (input.graphic !== undefined) spawn.graphic = structuredClone(input.graphic) as FieldSpawnDef["graphic"];
  return spawn;
}

function parseRoguelikeRoom(map: GameMap, args: Record<string, unknown>): RoguelikeRoomDef {
  const slots = args.slots ?? map.roguelikeRoom?.encounterSlots ?? [];
  if (!Array.isArray(slots)) {
    throw new ToolError("slots는 배열이어야 합니다.", { code: "invalid-slots", mapId: map.id });
  }
  const knownSpawnIds = new Set((map.fieldSpawns ?? []).map((spawn) => spawn.id));
  const usedSlotIds = new Set<string>();
  const encounterSlots = slots.map((slotValue, slotIndex) => {
    const label = `slots[${slotIndex}]`;
    const slot = requireRecordValue(slotValue, label);
    const id = stringField(slot, "id", label).trim();
    if (!id) throw new ToolError(`${label}.id는 비울 수 없습니다.`, { code: "invalid-slot-id", mapId: map.id });
    if (usedSlotIds.has(id)) throw new ToolError(`${label}.id가 중복됩니다: ${id}`, { code: "duplicate-slot-id", mapId: map.id });
    usedSlotIds.add(id);
    if (!Array.isArray(slot.choices) || slot.choices.length === 0) {
      throw new ToolError(`${label}.choices는 하나 이상이어야 합니다.`, { code: "empty-slot", mapId: map.id });
    }
    const usedChoiceIds = new Set<string>();
    const choices = slot.choices.map((choiceValue, choiceIndex) => {
      const choiceLabel = `${label}.choices[${choiceIndex}]`;
      const choice = requireRecordValue(choiceValue, choiceLabel);
      const fieldSpawnId = stringField(choice, "fieldSpawnId", choiceLabel).trim();
      if (!knownSpawnIds.has(fieldSpawnId)) {
        throw new ToolError(`${choiceLabel}.fieldSpawnId가 존재하지 않습니다: ${fieldSpawnId}`, { code: "spawn-not-found", mapId: map.id });
      }
      if (usedChoiceIds.has(fieldSpawnId)) {
        throw new ToolError(`${choiceLabel}.fieldSpawnId가 슬롯 안에서 중복됩니다: ${fieldSpawnId}`, { code: "duplicate-spawn-choice", mapId: map.id });
      }
      usedChoiceIds.add(fieldSpawnId);
      const weight = choice.weight === undefined ? 1 : integerField(choice, "weight", choiceLabel);
      if (weight <= 0) throw new ToolError(`${choiceLabel}.weight는 1 이상이어야 합니다.`, { code: "invalid-weight", mapId: map.id });
      const minFloor = choice.minFloor === undefined ? undefined : runFloorField(choice, "minFloor", choiceLabel, map.id);
      const maxFloor = choice.maxFloor === undefined ? undefined : runFloorField(choice, "maxFloor", choiceLabel, map.id);
      if (minFloor !== undefined && maxFloor !== undefined && minFloor > maxFloor) {
        throw new ToolError(`${choiceLabel}.minFloor가 maxFloor보다 큽니다.`, { code: "invalid-floor-range", mapId: map.id });
      }
      return {
        fieldSpawnId,
        weight,
        ...(minFloor !== undefined ? { minFloor } : {}),
        ...(maxFloor !== undefined ? { maxFloor } : {}),
      };
    });
    return { id, choices };
  });
  const roomId = typeof args.roomId === "string"
    ? args.roomId.trim()
    : args.roomId === undefined
      ? map.roguelikeRoom?.roomId?.trim() ?? ""
      : "";
  if (args.roomId !== undefined && !roomId) {
    throw new ToolError("roomId는 비울 수 없습니다.", { code: "invalid-room-id", mapId: map.id });
  }
  const resetEventState = args.resetEventState === undefined
    ? map.roguelikeRoom?.resetEventState
    : booleanField(args, "resetEventState", "roguelikeRoom");
  return {
    ...(roomId ? { roomId } : {}),
    ...(resetEventState !== undefined ? { resetEventState } : {}),
    encounterSlots,
  };
}

function runFloorField(record: Record<string, unknown>, key: "minFloor" | "maxFloor", label: string, mapId: string): number {
  const value = integerField(record, key, label);
  if (value < 1 || value > 9_999) {
    throw new ToolError(`${label}.${key}는 1..9999 범위여야 합니다.`, { code: "invalid-floor", mapId });
  }
  return value;
}

function parseRect(value: unknown, label: string, map: GameMap): Rect {
  const input = requireRecordValue(value, label);
  const rect = {
    x: integerField(input, "x", label),
    y: integerField(input, "y", label),
    w: integerField(input, "w", label),
    h: integerField(input, "h", label),
  };
  if (rect.w <= 0 || rect.h <= 0) throw new ToolError(`${label}.w/h는 1 이상이어야 합니다.`, { code: "invalid-rect", mapId: map.id });
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
    throw new ToolError(`${label}가 맵 범위를 벗어납니다: (${rect.x},${rect.y}) ${rect.w}×${rect.h}`, { code: "rect-out-of-bounds", mapId: map.id });
  }
  return rect;
}

function assertKnownTroop(project: Project, troopId: string): void {
  if (!project.database.troops.some((troop) => troop.id === troopId)) {
    throw new ToolError(`존재하지 않는 트룹 id: ${troopId} — get_database_records(troops)로 확인하세요.`, { code: "troop-not-found" });
  }
}

function requireRecordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-object" });
  }
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new ToolError(`${label}.${key}는 문자열이어야 합니다.`, { code: "invalid-field" });
  return value;
}

function numberField(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ToolError(`${label}.${key}는 숫자여야 합니다.`, { code: "invalid-field" });
  return value;
}

function integerField(record: Record<string, unknown>, key: string, label: string): number {
  const value = numberField(record, key, label);
  if (!Number.isInteger(value)) throw new ToolError(`${label}.${key}는 정수여야 합니다.`, { code: "invalid-field" });
  return value;
}

function booleanField(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new ToolError(`${label}.${key}는 boolean이어야 합니다.`, { code: "invalid-field" });
  return value;
}

function nextFieldSpawnId(map: GameMap, troopId: string): string {
  const base = `hunt_${troopId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const used = new Set((map.fieldSpawns ?? []).map((spawn) => spawn.id));
  if (!used.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const id = `${base}_${index}`;
    if (!used.has(id)) return id;
  }
  throw new ToolError(`스폰 id를 만들 수 없습니다: ${base}`, { code: "spawn-id-exhausted", mapId: map.id });
}

const bgmSchema: JsonSchema = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["parent", "none", "custom"] },
    resourceId: { type: "string" },
    fadeInMs: { type: "integer", minimum: 0 },
  },
  required: ["mode"],
  additionalProperties: false,
};

const backgroundSchema: JsonSchema = {
  type: "object",
  properties: { imageId: { type: "string" }, scrollX: { type: "number" }, scrollY: { type: "number" } },
  required: ["imageId"],
  additionalProperties: false,
};

const minimapSchema: JsonSchema = {
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    corner: { type: "string", enum: ["topRight", "topLeft", "bottomRight", "bottomLeft"] },
    scale: { type: "number", minimum: 0.08, maximum: 0.5 },
    showEvents: { type: "boolean" },
    fogOfWar: { type: "boolean" },
  },
  required: ["enabled"],
  additionalProperties: false,
};

// 맵 속성 설정. 크기 변경은 resize_map, 트리 위치는 manage_map_tree로 분리.
const setMapProperties: ToolDefinition = {
  name: "set_map_properties",
  description: "맵 편집기의 전체 속성을 설정한다: 이름·타일셋·인카운트·BGM·배경·전투 배경·저장/이동/도주 제한·미니맵.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      name: { type: "string" },
      tilesetId: { type: "string" },
      encounterRate: { type: "integer" },
      troopIds: { type: "array", items: { type: "string" } },
      bgm: bgmSchema,
      clearBgm: { type: "boolean" },
      background: backgroundSchema,
      clearBackground: { type: "boolean" },
      battleBackground: { type: "string" },
      clearBattleBackground: { type: "boolean" },
      flags: {
        type: "object",
        properties: { disableSave: { type: "boolean" }, disableTeleport: { type: "boolean" }, disableEscape: { type: "boolean" } },
        additionalProperties: false,
      },
      minimap: minimapSchema,
      clearMinimap: { type: "boolean" },
    },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const changed: string[] = [];
    if (typeof args.name === "string" && args.name.trim()) {
      map.name = args.name.trim();
      changed.push(`이름='${map.name}'`);
    }
    if (typeof args.tilesetId === "string") {
      const tileset = draft.tilesets[args.tilesetId];
      if (!tileset) throw new ToolError(`존재하지 않는 타일셋 id: ${args.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
      map.tilesetId = tileset.id;
      map.tileSize = tileset.tileSize;
      changed.push(`타일셋=${tileset.id}`);
    }
    if (typeof args.encounterRate === "number") {
      if (args.encounterRate < 0) throw new ToolError("encounterRate는 0 이상이어야 합니다.");
      map.encounterRate = args.encounterRate;
      changed.push(`인카운트율=${args.encounterRate}`);
    }
    if (Array.isArray(args.troopIds)) {
      const troopIds = (args.troopIds as unknown[]).map(String);
      const known = new Set(draft.database.troops.map((troop) => troop.id));
      const missing = troopIds.filter((id) => !known.has(id));
      if (missing.length > 0) {
        throw new ToolError(`존재하지 않는 트룹 id: ${missing.join(", ")} — get_database_records(troops)로 확인하세요.`, { code: "troop-not-found" });
      }
      map.troopIds = troopIds;
      changed.push(`트룹 ${troopIds.length}종`);
    }
    if (args.clearBgm === true) {
      delete map.bgm;
      changed.push("BGM=기본");
    } else if (args.bgm && typeof args.bgm === "object" && !Array.isArray(args.bgm)) {
      const bgm = structuredClone(args.bgm) as GameMap["bgm"];
      if (bgm?.mode === "custom" && !bgm.resourceId) throw new ToolError("bgm.mode가 custom이면 resourceId가 필요합니다.", { code: "invalid-args", mapId: map.id });
      map.bgm = bgm;
      changed.push(`BGM=${bgm?.mode}`);
    }
    if (args.clearBackground === true) {
      delete map.background;
      changed.push("배경=기본");
    } else if (args.background && typeof args.background === "object" && !Array.isArray(args.background)) {
      map.background = structuredClone(args.background) as NonNullable<GameMap["background"]>;
      changed.push(`배경=${map.background.imageId}`);
    }
    if (args.clearBattleBackground === true) {
      delete map.battleBackground;
      changed.push("전투배경=기본");
    } else if (typeof args.battleBackground === "string" && args.battleBackground.trim()) {
      map.battleBackground = args.battleBackground.trim();
      changed.push(`전투배경=${map.battleBackground}`);
    }
    if (args.flags && typeof args.flags === "object" && !Array.isArray(args.flags)) {
      const flags = args.flags as { disableSave?: boolean; disableTeleport?: boolean; disableEscape?: boolean };
      if (flags.disableSave === true) map.disableSave = true; else delete map.disableSave;
      if (flags.disableTeleport === true) map.disableTeleport = true; else delete map.disableTeleport;
      if (flags.disableEscape === true) map.disableEscape = true; else delete map.disableEscape;
      changed.push("제한 설정");
    }
    if (args.clearMinimap === true) {
      delete map.minimap;
      changed.push("미니맵=끔");
    } else if (args.minimap && typeof args.minimap === "object" && !Array.isArray(args.minimap)) {
      map.minimap = structuredClone(args.minimap) as NonNullable<GameMap["minimap"]>;
      changed.push(`미니맵=${map.minimap.enabled ? "켬" : "끔"}`);
    }
    if (changed.length === 0) throw new ToolError("바꿀 맵 속성이 없습니다.", { code: "invalid-args", mapId: map.id });
    return { summary: `${map.name} 속성 변경 — ${changed.join(", ")}`, data: { mapId: map.id } };
  },
};

const setEncounterTable: ToolDefinition = {
  name: "set_encounter_table",
  description: "맵의 조건부/가중 랜덤 인카운터 테이블을 교체한다. encounterTable이 있으면 기존 troopIds 균등 선택보다 우선한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      entries: { type: "array", items: encounterEntrySchema },
    },
    required: ["mapId", "entries"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const entries = parseEncounterEntries(draft, map, args.entries);
    if (entries.length > 0) map.encounterTable = entries;
    else delete map.encounterTable;
    return {
      summary: `${map.name} 인카운터 테이블 ${entries.length}개 항목 설정`,
      data: { mapId: map.id, entries },
    };
  },
};

const makeHuntingGround: ToolDefinition = {
  name: "make_hunting_ground",
  description: "사냥터 구획을 만든다. fieldSpawns 항목을 추가하고, encounterEntries가 있으면 encounterTable로 설정한다(없으면 area region의 단일 인카운터를 설정).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: rectSchema,
      troopId: { type: "string" },
      maxAlive: { type: "integer" },
      respawnSec: { type: "integer" },
      chase: { type: "boolean" },
      graphic: fieldGraphicSchema,
      encounterEntries: { type: "array", items: encounterEntrySchema },
    },
    required: ["mapId", "area", "troopId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const troopId = args.troopId as string;
    assertKnownTroop(draft, troopId);
    const area = parseRect(args.area, "area", map);
    const spawn = parseFieldSpawn(draft, map, {
      id: nextFieldSpawnId(map, troopId),
      troopId,
      area,
      ...(args.maxAlive !== undefined ? { maxAlive: args.maxAlive } : {}),
      ...(args.respawnSec !== undefined ? { respawnSec: args.respawnSec } : {}),
      chase: args.chase === true,
      ...(args.graphic !== undefined ? { graphic: args.graphic } : {}),
    }, "fieldSpawn");
    map.fieldSpawns = [...(map.fieldSpawns ?? []), spawn];
    const entries = args.encounterEntries !== undefined
      ? parseEncounterEntries(draft, map, args.encounterEntries)
      : [{ troopId, weight: 1, conditions: { region: area } }];
    if (entries.length > 0) map.encounterTable = entries;
    else delete map.encounterTable;
    return {
      summary: `${map.name} 사냥터 구성 — 스폰 ${spawn.id}, 트룹 ${troopId}, 인카운터 ${entries.length}개`,
      data: { mapId: map.id, fieldSpawn: spawn, encounterTable: entries },
    };
  },
};

const configureRoguelikeRoom: ToolDefinition = {
  name: "configure_roguelike_room",
  description: "맵의 로그라이크 방 조우 슬롯과 이벤트 리셋 정책을 설정한다. 각 슬롯은 fieldSpawns 후보 중 하나를 런 seed·층·방·리셋 횟수로 결정적으로 선택한다. 기본적으로 새 방 세대는 셀프 스위치와 Erase Event 상태도 초기화한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      roomId: { type: "string", description: "생략 시 mapId" },
      resetEventState: { type: "boolean", description: "방 세대 변경 시 셀프 스위치/Erase Event 상태 초기화(기본 true)" },
      slots: { type: "array", items: roguelikeEncounterSlotSchema },
      clear: { type: "boolean", description: "true면 기존 로그라이크 방 설정 제거" },
    },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    if (args.clear === true) {
      delete map.roguelikeRoom;
      return { summary: `${map.name} 로그라이크 방 설정 제거`, data: { mapId: map.id } };
    }
    const room = parseRoguelikeRoom(map, args);
    map.roguelikeRoom = room;
    return {
      summary: `${map.name} 로그라이크 방 설정 — 슬롯 ${room.encounterSlots?.length ?? 0}개`,
      data: { mapId: map.id, roguelikeRoom: room },
    };
  },
};

const createFarmPlot: ToolDefinition = {
  name: "create_farm_plot",
  description: "맵의 경작 가능 영역(farmableArea)을 선언한다. 타일/울타리/흙 연출은 변경하지 않는다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: rectSchema,
    },
    required: ["mapId", "area"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const area = parseRect(args.area, "area", map);
    map.farmableArea ??= [];
    const duplicate = map.farmableArea.some((rect) => rect.x === area.x && rect.y === area.y && rect.w === area.w && rect.h === area.h);
    if (!duplicate) map.farmableArea.push(area);
    return {
      summary: `맵 '${map.name}' 경작 가능 영역 선언 (${area.x},${area.y},${area.w}x${area.h})${duplicate ? " — 기존 영역 재사용" : ""}`,
      data: { mapId: map.id, area },
    };
  },
};

// 맵 크기 변경(좌상단 기준 유지, 확장부는 잔디/빈 칸). 이벤트가 잘려 나가는 축소는 거부한다.
const resizeMapTool: ToolDefinition = {
  name: "resize_map",
  description: "맵 크기를 바꾼다(좌상단 기준, 확장부는 잔디, 최대 256×256). 축소로 이벤트가 범위 밖에 나가면 거부 — 먼저 move_event/remove_event로 정리하라.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      width: { type: "integer", description: "3 이상, 최대 256" },
      height: { type: "integer", description: "3 이상, 최대 256" },
    },
    required: ["mapId", "width", "height"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const width = args.width as number;
    const height = args.height as number;
    if (width < 3 || height < 3) throw new ToolError("맵 크기는 최소 3x3 이상이어야 합니다.");
    assertToolMapSize(width, height);
    const outEvents = map.events.filter((event) => event.x >= width || event.y >= height);
    if (outEvents.length > 0) {
      throw new ToolError(
        `축소 범위 밖 이벤트 ${outEvents.length}개: ${outEvents.slice(0, 5).map((event) => `${event.id}(${event.x},${event.y})`).join(", ")} — 먼저 옮기거나 지우세요.`,
        { code: "events-out-of-bounds", mapId: map.id }
      );
    }
    if (draft.startMapId === map.id && (draft.startPos.x >= width || draft.startPos.y >= height)) {
      throw new ToolError(`시작 좌표 (${draft.startPos.x},${draft.startPos.y})가 새 크기 밖입니다 — set_start_position으로 먼저 옮기세요.`, { code: "start-out-of-bounds" });
    }
    const oldW = map.width;
    const oldH = map.height;
    const newLower = new Array<number>(width * height).fill(TILE.GRASS);
    const newUpper = new Array<number>(width * height).fill(TILE.EMPTY);
    for (let y = 0; y < Math.min(oldH, height); y += 1) {
      for (let x = 0; x < Math.min(oldW, width); x += 1) {
        newLower[y * width + x] = map.lowerTiles[y * oldW + x];
        newUpper[y * width + x] = map.upperTiles[y * oldW + x];
      }
    }
    const nextLowerStacks = resizedTileStacks(map.lowerTileStacks, oldW, oldH, width, height);
    const nextUpperStacks = resizedTileStacks(map.upperTileStacks, oldW, oldH, width, height);
    map.width = width;
    map.height = height;
    map.lowerTiles = newLower;
    map.upperTiles = newUpper;
    if (nextLowerStacks) map.lowerTileStacks = nextLowerStacks;
    else delete map.lowerTileStacks;
    if (nextUpperStacks) map.upperTileStacks = nextUpperStacks;
    else delete map.upperTileStacks;
    return { summary: `${map.name} 크기 변경 ${oldW}×${oldH} → ${width}×${height}`, data: { mapId: map.id, width, height } };
  },
};

// 맵 삭제(파괴적). 시작 맵/마지막 맵은 거부. mapTree/연결/이동 명령 등 참조는 재배선/정리되고,
// 삭제 결과가 재로드(shape) 검증을 통과하지 못하면 차단된다(무결성 가드 — 도그푸딩 결함 ①).
const removeMapTool: ToolDefinition = {
  name: "remove_map",
  description:
    "맵을 삭제한다(파괴적 — 꼭 필요할 때만, 이유를 먼저 설명). 시작 맵은 삭제 불가. 맵 트리/연결/이동(transfer) 참조는 함께 정리되며, 무결성 검증에 실패하면 거부된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string" } },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    // 에이전트 경로는 시작 맵 삭제를 차단(암묵 재배선 금지) — 먼저 시작 위치를 옮기게 한다.
    if (draft.startMapId === map.id) throw new ToolError("시작 맵은 삭제할 수 없습니다 — 먼저 set_start_position으로 시작 맵을 옮기세요.", { code: "start-map" });
    const plan = planMapDeletion(draft, map.id);
    if (!plan.ok) throw new ToolError(plan.block.message, { code: plan.block.code });
    const name = map.name;
    applyMapDeletion(draft, map.id);
    const impact = plan.impact;
    const cleaned = [
      impact.incomingCommandCount > 0 ? `이동 명령 ${impact.incomingCommandCount}개` : null,
      impact.connectionCount > 0 ? `맵 연결 ${impact.connectionCount}개` : null,
      impact.questCount > 0 ? `퀘스트 ${impact.questCount}개` : null,
    ].filter(Boolean);
    return {
      summary: `맵 '${name}'(${map.id}) 삭제됨${cleaned.length > 0 ? ` — 함께 정리: ${cleaned.join(", ")}` : ""}`,
      data: { mapId: map.id, impact },
    };
  },
};

const shiftMap: ToolDefinition = {
  name: "shift_map",
  description: "맵 내용 밀기: 타일·이벤트·시작 위치를 dx/dy만큼 이동한다. 맵 편집기의 내용 이동과 같다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      dx: { type: "integer" },
      dy: { type: "integer" },
    },
    required: ["mapId", "dx", "dy"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const dx = args.dx as number;
    const dy = args.dy as number;
    if (!Number.isInteger(dx) || !Number.isInteger(dy)) {
      throw new ToolError("dx와 dy는 정수여야 합니다.", { code: "invalid-args", mapId: map.id });
    }
    if (!applyMapShift(draft, map.id, { dx, dy })) {
      throw new ToolError("이동할 오프셋이 없습니다.", { code: "invalid-args", mapId: map.id });
    }
    return { summary: `${map.name} 내용 (${dx}, ${dy}) 이동`, data: { mapId: map.id, dx, dy } };
  },
};

export const MAP_TOOLS: readonly ToolDefinition[] = [createMap, duplicateMap, manageMapTree, paintTiles, paintRoad, stampStructure, previewHouse, buildHouse, clearRegion, mirrorRegion, setStartPosition, setTilePassability, setMapProperties, setEncounterTable, makeHuntingGround, configureRoguelikeRoom, createFarmPlot, resizeMapTool, shiftMap, removeMapTool];

// 스키마 참조를 정적으로 검증하기 위한 도우미(사용처 없어도 트리 셰이킹 안전).
export type { JsonSchema };
