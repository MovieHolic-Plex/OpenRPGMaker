// editor/tools/mapTools.ts
// 맵 생성/타일 페인팅/도로/구조물/시작위치 쓰기 툴.

import { isPassable } from "@/project/collision";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { shapeRoadAround } from "@/project/defaults/roadAutotile";
import { shapeSandAround } from "@/project/defaults/sandAutotile";
import { removeFromTree } from "@/editor/mapTreeActions";
import { markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { stampTerrainTemplateHouse } from "@/project/defaults/terrainTemplateHouseStamp";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
import { stampTownCityPlot, type TownCityPlotStyle } from "@/project/defaults/townHousePatterns";
import { dbHouseVariantDoorBottomOffset, stampDbHouseVariant, type DbHouseShapeVariant } from "@/project/defaults/dbExtractedHouseVariants";
import type { SmallHouseMaterial } from "@/project/defaults/dbExtractedHouseTemplate";
import { genId } from "@/util/id";
import type { GameMap, Project } from "@/project/types";
import {
  fillRect,
  floodFill,
  inMapBounds,
  lineCells,
  passabilityWarning,
  requireMap,
  setLower,
  type Point,
} from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

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
  description: "새 맵을 생성한다(잔디 바닥 + 테두리 벽, 최대 256×256). 시작 맵이 없으면 이 맵을 시작 맵으로 채택한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "맵 이름" },
      width: { type: "integer", description: "가로 타일 수(3 이상, 최대 256)" },
      height: { type: "integer", description: "세로 타일 수(3 이상, 최대 256)" },
      id: { type: "string", description: "맵 id(생략 시 자동 생성)" },
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
    borderWalls(map);
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

const paintTiles: ToolDefinition = {
  name: "paint_tiles",
  description: "타일을 칠한다. mode: rect(사각형)/line(선)/fill(채우기)/cells(개별 셀). 통행성이 바뀌면 경고를 반환한다. 투명 배경 칩(벤치·나무·사선 지붕 등)은 상위 레이어 전용이라 자동 라우팅된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      layer: { type: "string", enum: ["lower", "upper"] },
      mode: { type: "string", enum: ["rect", "line", "fill", "cells"] },
      tile: { type: "integer", description: "타일 인덱스(-1=비움)" },
      from: { type: "object", description: "{x,y}" },
      to: { type: "object", description: "{x,y}" },
      cells: { type: "array", description: "[{x,y}...]", items: { type: "object" } },
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

    const apply = (x: number, y: number): void => {
      if (!inMapBounds(map, x, y)) return;
      if (layer === "lower") setLower(map, x, y, tile);
      else map.upperTiles[y * map.width + x] = tile;
    };

    let touched: Point[] = [];
    if (mode === "rect") {
      if (!from || !to) throw new ToolError("rect 모드는 from/to가 필요합니다.");
      if (layer === "lower") {
        fillRect(map, from, to, tile);
      } else {
        for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y += 1)
          for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x += 1) apply(x, y);
      }
      for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y += 1)
        for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x += 1) touched.push({ x, y });
    } else if (mode === "line") {
      if (!from || !to) throw new ToolError("line 모드는 from/to가 필요합니다.");
      touched = lineCells(from, to);
      for (const cell of touched) apply(cell.x, cell.y);
    } else if (mode === "fill") {
      if (!from) throw new ToolError("fill 모드는 from(시작점)이 필요합니다.");
      if (layer !== "lower") throw new ToolError("fill 모드는 lower 레이어만 지원합니다.");
      touched = floodFill(map, from, tile);
    } else {
      if (!cells || cells.length === 0) throw new ToolError("cells 모드는 cells 배열이 필요합니다.");
      touched = cells;
      for (const cell of cells) apply(cell.x, cell.y);
    }

    const warning = layer === "lower" ? passabilityWarning(draft, map, touched) : null;
    const warnings = [...(routedNote ? [routedNote] : []), ...(warning ? [warning] : [])];
    return {
      summary: `${map.name}에 타일 ${tile} 페인트(${mode}, ${layer}, ${touched.length}칸)${routedNote ? " — 상위 전용 칩 자동 라우팅" : ""}`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

const paintRoad: ToolDefinition = {
  name: "paint_road",
  description: "폴리라인을 따라 도로를 깐다. style: dirt(흙길)/sand(모래). 오토타일로 가장자리를 자동 성형한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      points: { type: "array", description: "[{x,y}...] 경로 꼭짓점", items: { type: "object" } },
      style: { type: "string", enum: ["dirt", "sand"] },
    },
    required: ["mapId", "points", "style"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const points = args.points as Point[];
    const style = args.style as "dirt" | "sand";
    if (points.length < 1) throw new ToolError("경로에는 최소 1개의 점이 필요합니다.");
    const painted: Point[] = [];
    const body = style === "dirt" ? DIRT_ROAD_TILE.BODY : SAND_TILE.BODY;
    for (let i = 0; i < points.length; i += 1) {
      const segmentCells = i === 0 ? [points[0]] : lineCells(points[i - 1], points[i]);
      for (const cell of segmentCells) {
        if (!inMapBounds(map, cell.x, cell.y)) continue;
        map.lowerTiles[cell.y * map.width + cell.x] = body;
        map.upperTiles[cell.y * map.width + cell.x] = TILE.EMPTY;
        painted.push(cell);
      }
    }
    if (style === "dirt") shapeRoadAround(map, painted);
    else shapeSandAround(map, painted);
    return { summary: `${map.name}에 ${style} 도로 ${painted.length}칸` };
  },
};

const STRUCTURE_STYLES: readonly TownCityPlotStyle[] = ["l", "courtyard", "multi", "road", "plaster", "stone"];

const stampStructure: ToolDefinition = {
  name: "stamp_structure",
  description: "집/구조물 템플릿을 찍는다. template: l(ㄴ자 집)/courtyard(안뜰 딸린 집)/multi(연립 주택)/road(길)/plaster(회벽 소형 집)/stone(석조 소형 집). 반환 diff에 문 좌표를 포함한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      template: { type: "string", enum: STRUCTURE_STYLES as unknown as string[] },
      origin: { type: "object", description: "{x,y} 좌상단" },
    },
    required: ["mapId", "template", "origin"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const template = args.template as TownCityPlotStyle;
    const origin = args.origin as Point;
    if (!STRUCTURE_STYLES.includes(template)) throw new ToolError(`알 수 없는 구조물 템플릿: ${template}`);
    stampTownCityPlot(map, template, origin.x, origin.y);
    // 문 좌표는 대략적으로 구조물 하단 중앙으로 추정(정확 좌표는 템플릿별 상이).
    const door = { x: origin.x + 3, y: origin.y + 4 };
    return { summary: `${map.name}에 '${template}' 구조물 스탬프(${origin.x},${origin.y})`, data: { door } };
  },
};

// 지형 템플릿(small_house_01 표) 기반 집 스탬프. stamp_structure(townHousePatterns)와 별개로
// DB 추출 지형 템플릿 계열(재질 3종 × 변형 4종)을 챗봇/헤드리스에서 쓸 수 있게 노출한다.
const HOUSE_VARIANTS: readonly DbHouseShapeVariant[] = ["template", "wide", "compact", "l"];
const HOUSE_MATERIALS: readonly SmallHouseMaterial[] = ["plaster", "wood", "stone"];
// 울타리 포함 최대 발자국(변형 플랜 기준 18×16) — 이 여유가 없으면 잘려 찍힌다.
const HOUSE_FOOTPRINT = { width: 18, height: 16 } as const;

const stampTemplateHouse: ToolDefinition = {
  name: "stamp_template_house",
  description:
    "지형 템플릿 기반 집을 찍는다. variant: template(small_house_01 표)/wide(넓은)/compact(작은)/l(ㄴ자 집), material: plaster(회벽)/wood(목재)/stone(석재). approachHeight로 문 앞 진입로를 깐다. 발자국 약 18×16 — 여유 있는 origin을 잡아라. 임의 크기 직사각형 집은 build_house를 써라. 반환 data에 문 좌표 포함.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { type: "object", description: "{x,y} 좌상단" },
      variant: { type: "string", enum: HOUSE_VARIANTS as unknown as string[] },
      material: { type: "string", enum: HOUSE_MATERIALS as unknown as string[] },
      includeFence: { type: "boolean", description: "울타리 포함(기본 true)" },
      approachHeight: { type: "integer", description: "문 아래로 깔 진입로 길이(칸)" },
    },
    required: ["mapId", "origin", "variant", "material"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const variant = args.variant as DbHouseShapeVariant;
    const material = args.material as SmallHouseMaterial;
    if (!HOUSE_VARIANTS.includes(variant)) throw new ToolError(`알 수 없는 집 변형: ${String(args.variant)} (${HOUSE_VARIANTS.join("/")})`);
    if (!HOUSE_MATERIALS.includes(material)) throw new ToolError(`알 수 없는 재질: ${String(args.material)} (${HOUSE_MATERIALS.join("/")})`);
    const origin = args.origin as Point;
    if (!inMapBounds(map, origin.x, origin.y)) {
      throw new ToolError(`origin이 맵 밖입니다: (${origin.x},${origin.y})`, { code: "out-of-bounds", mapId: map.id, x: origin.x, y: origin.y });
    }
    if (origin.x + HOUSE_FOOTPRINT.width > map.width || origin.y + HOUSE_FOOTPRINT.height > map.height) {
      throw new ToolError(
        `집 발자국(${HOUSE_FOOTPRINT.width}×${HOUSE_FOOTPRINT.height})이 맵을 벗어납니다 — origin (${origin.x},${origin.y}), 맵 ${map.width}×${map.height}`,
        { code: "out-of-bounds", mapId: map.id, x: origin.x, y: origin.y }
      );
    }
    stampDbHouseVariant(map, {
      material,
      origin,
      variant,
      includeFence: args.includeFence === undefined ? true : args.includeFence === true,
      approachHeight: typeof args.approachHeight === "number" ? args.approachHeight : undefined,
    });
    const doorOffset = dbHouseVariantDoorBottomOffset(variant);
    const door = { x: origin.x + doorOffset.x, y: origin.y + doorOffset.y };
    return {
      summary: `${map.name}에 지형 템플릿 집(${variant}/${material}) 스탬프(${origin.x},${origin.y}) — 문 (${door.x},${door.y})`,
      data: { door, variant, material },
    };
  },
};

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

function stampBuildHouse(map: GameMap, { origin, width, height, material }: HouseBuildArgs): Point {
  const wallRows = height - 4;
  const doorX = Math.floor(width / 2);
  const windows: { x: number; y: number }[] = [];
  if (wallRows >= 3) {
    for (let x = 2; x <= width - 3; x += 3) {
      if (Math.abs(x - doorX) > 1) windows.push({ x, y: 5 });
    }
  }
  stampTerrainTemplateHouse(map, {
    buildPlan: {
      fence: { x: 0, y: 0, width: 0, height: 0 },
      roads: [],
      house: {
        roof: { origin: { x: 0, y: 0 }, width },
        wall: { origin: { x: 0, y: 4 }, width, rows: wallRows },
        door: { x: doorX, topY: 4 + wallRows - 2, bottomY: 4 + wallRows - 1 },
        windows,
      },
    },
    material,
    origin,
    includeFence: false,
    paintRoads: false,
  });
  return { x: origin.x + doorX, y: origin.y + 4 + wallRows - 1 };
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
      origin: { type: "object", description: "{x,y} 좌상단" },
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
    "요청한 크기의 직사각형 집을 짓는다(지붕 4행 + 벽 + 문 + 창문 자동 구성). width 5~30, height 6~24, material: plaster(회벽)/wood(목재)/stone(석재). '10x10 집'처럼 크기가 지정된 집은 벽 타일을 직접 칠하지 말고 이 툴을 써라. 반환 data에 문 좌표 포함.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { type: "object", description: "{x,y} 좌상단" },
      width: { type: "integer", description: `가로 칸 수(${HOUSE_MIN_WIDTH}~${HOUSE_MAX_WIDTH})` },
      height: { type: "integer", description: `세로 칸 수(${HOUSE_MIN_HEIGHT}~${HOUSE_MAX_HEIGHT}, 지붕 4행 포함)` },
      material: { type: "string", enum: HOUSE_MATERIALS as unknown as string[] },
    },
    required: ["mapId", "origin", "width", "height", "material"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const house = houseBuildArgs(map, args);
    const door = stampBuildHouse(map, house);
    return {
      summary: `${map.name}에 ${house.width}×${house.height} ${house.material} 집 건설(${house.origin.x},${house.origin.y}) — 문 (${door.x},${door.y})`,
      data: { door, width: house.width, height: house.height, material: house.material },
    };
  },
};

// 영역 일괄 정리 — 잘못 깐 구조물/타일 무더기를 한 번에 걷어낸다.
const clearRegion: ToolDefinition = {
  name: "clear_region",
  description:
    "맵의 사각 영역을 정리한다: 상위 레이어는 비우고, 하위 레이어는 잔디(fill=grass, 기본) 또는 빈 칸(fill=empty)으로 되돌린다. 잘못 배치한 구조물을 지울 때 사용. 이벤트는 지우지 않고 경고로 알린다.",
  mode: "write",
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

// 맵 속성(이름/인카운트) 설정. 크기 변경은 resize_map으로 분리.
const setMapProperties: ToolDefinition = {
  name: "set_map_properties",
  description: "맵 속성을 설정한다: name(이름), encounterRate(랜덤 인카운트율, 0=없음), troopIds(인카운트 적 그룹 — 실제 트룹 id여야 함).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      name: { type: "string" },
      encounterRate: { type: "integer" },
      troopIds: { type: "array", items: { type: "string" } },
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
    if (changed.length === 0) throw new ToolError("바꿀 속성이 없습니다(name/encounterRate/troopIds 중 하나 이상).");
    return { summary: `${map.name} 속성 변경 — ${changed.join(", ")}`, data: { mapId: map.id } };
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

// 맵 삭제(파괴적). 시작 맵/마지막 맵은 거부, 다른 맵의 transfer가 참조하면 커밋 게이트가 거부한다.
const removeMapTool: ToolDefinition = {
  name: "remove_map",
  description: "맵을 삭제한다(파괴적 — 꼭 필요할 때만, 이유를 먼저 설명). 시작 맵은 삭제 불가. 다른 맵의 출입구(transfer)가 참조 중이면 무결성 게이트가 거부한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string" } },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    if (draft.startMapId === map.id) throw new ToolError("시작 맵은 삭제할 수 없습니다 — 먼저 set_start_position으로 시작 맵을 옮기세요.", { code: "start-map" });
    if (Object.keys(draft.maps).length <= 1) throw new ToolError("마지막 맵은 삭제할 수 없습니다.", { code: "last-map" });
    const name = map.name;
    delete draft.maps[map.id];
    removeFromTree(draft.mapTree, map.id);
    if (draft.mapConnections) {
      draft.mapConnections = draft.mapConnections.filter(
        (connection) => connection.from.mapId !== map.id && connection.to.mapId !== map.id
      );
    }
    return { summary: `맵 '${name}'(${map.id}) 삭제됨`, data: { mapId: map.id } };
  },
};

export const MAP_TOOLS: readonly ToolDefinition[] = [createMap, paintTiles, paintRoad, stampStructure, stampTemplateHouse, previewHouse, buildHouse, clearRegion, setStartPosition, setTilePassability, setMapProperties, resizeMapTool, removeMapTool];

// 스키마 참조를 정적으로 검증하기 위한 도우미(사용처 없어도 트리 셰이킹 안전).
export type { JsonSchema };
