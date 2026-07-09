// editor/tools/generateMapTool.ts
// 테마 맵 생성기. create_map+paint 계열의 조합으로 구현하되,
// **생성→도달성 검사→국소 수리(통로 뚫기) 루프를 내장**해 항상 입구에서 모든 POI에 도달 가능한 맵을 반환한다.
// aiPreviewThemeGrammar는 AiPreview 계약에 강결합돼 재사용 대신 독자 구현한다.

import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { genId } from "@/util/id";
import type { GameMap } from "@/project/types";
import { inMapBounds, lineCells, setLower, type Point } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type MapTheme = "village" | "forest" | "cave";

interface ThemePalette {
  readonly floor: number;
  readonly obstacle: number;
  readonly decor: number;
}

const BUSH_OBSTACLE = 289;

const THEME_PALETTES: Record<MapTheme, ThemePalette> = {
  village: { floor: TILE.GRASS, obstacle: BUSH_OBSTACLE, decor: TILE.FLOWERS },
  forest: { floor: TILE.GRASS, obstacle: BUSH_OBSTACLE, decor: TILE.DARK_GRASS },
  cave: { floor: 421, obstacle: TILE.WALL, decor: TILE.WATER },
};

// 결정적 PRNG(mulberry32) — Math.random 미사용(재현성).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blankThemedMap(id: string, name: string, width: number, height: number, palette: ThemePalette): GameMap {
  const size = width * height;
  const map: GameMap = {
    id,
    name,
    width,
    height,
    tilesetId: DEFAULT_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(size).fill(palette.floor),
    upperTiles: new Array<number>(size).fill(TILE.EMPTY),
    events: [],
  };
  for (let x = 0; x < width; x += 1) {
    setLower(map, x, 0, TILE.WALL);
    setLower(map, x, height - 1, TILE.WALL);
  }
  for (let y = 0; y < height; y += 1) {
    setLower(map, 0, y, TILE.WALL);
    setLower(map, width - 1, y, TILE.WALL);
  }
  return map;
}

function assertGeneratedMapSize(width: number, height: number): void {
  if (width > MAX_TOOL_MAP_DIMENSION || height > MAX_TOOL_MAP_DIMENSION) {
    throw new ToolError(
      `생성 맵 크기는 최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}까지 가능합니다. 넓은 지역은 여러 맵으로 나누고 transfer 이벤트로 연결하세요.`,
      { code: "map-too-large" }
    );
  }
}

// L자 통로로 두 점을 잇되, 지나는 칸을 통행 가능한 floor로 만든다.
function carvePath(map: GameMap, from: Point, to: Point, floor: number): void {
  const corner: Point = { x: to.x, y: from.y };
  for (const cell of [...lineCells(from, corner), ...lineCells(corner, to)]) {
    if (inMapBounds(map, cell.x, cell.y) && cell.x > 0 && cell.y > 0 && cell.x < map.width - 1 && cell.y < map.height - 1) {
      setLower(map, cell.x, cell.y, floor);
    }
  }
}

const generateMap: ToolDefinition = {
  name: "generate_map",
  description: "테마(village/forest/cave) 맵을 생성한다(최대 256×256). 입구→모든 POI 도달성을 생성기가 보장(생성→검사→통로 수리 루프).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      theme: { type: "string", enum: ["village", "forest", "cave"] },
      name: { type: "string" },
      width: { type: "integer", description: "가로 타일 수(최대 256)" },
      height: { type: "integer", description: "세로 타일 수(최대 256)" },
      entrance: { type: "object", description: "{x,y} 입구(생략 시 좌측 중앙)" },
      pois: { type: "array", description: "[{x,y}] 관심 지점", items: { type: "object" } },
      chokepoints: { type: "integer", description: "장애물 밀도(0~100, 기본 12)" },
      seed: { type: "integer" },
      id: { type: "string" },
    },
    required: ["theme", "width", "height"],
  },
  run(draft, args): ToolExecResult {
    const theme = args.theme as MapTheme;
    const palette = THEME_PALETTES[theme];
    if (!palette) throw new ToolError(`알 수 없는 테마: ${theme}`, { code: "unknown-theme" });
    const width = args.width as number;
    const height = args.height as number;
    if (width < 6 || height < 6) throw new ToolError("생성 맵은 최소 6x6 이상이어야 합니다.");
    assertGeneratedMapSize(width, height);
    const id = (args.id as string | undefined) ?? genId("map");
    if (draft.maps[id]) throw new ToolError(`이미 존재하는 맵 id입니다: ${id}`, { mapId: id });
    const rng = mulberry32((args.seed as number | undefined) ?? 1);
    const map = blankThemedMap(id, (args.name as string | undefined) ?? `${theme} 맵`, width, height, palette);

    const entrance = (args.entrance as Point | undefined) ?? { x: 1, y: Math.floor(height / 2) };
    const pois = ((args.pois as Point[] | undefined) ?? defaultPois(width, height)).filter((poi) => inMapBounds(map, poi.x, poi.y));
    const density = Math.max(0, Math.min(100, (args.chokepoints as number | undefined) ?? 12));

    // 보호 셀(입구/POI + 그 인접)은 장애물을 놓지 않는다.
    const protectedCells = new Set<string>();
    const protect = (p: Point): void => {
      for (const d of [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]) {
        protectedCells.add(`${p.x + d.x},${p.y + d.y}`);
      }
    };
    protect(entrance);
    for (const poi of pois) protect(poi);

    // 장애물 산포.
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        if (protectedCells.has(`${x},${y}`)) continue;
        if (rng() * 100 < density) setLower(map, x, y, palette.obstacle);
      }
    }
    // 입구 확보.
    setLower(map, entrance.x, entrance.y, palette.floor);

    // 입구→각 POI 통로 카빙.
    for (const poi of pois) carvePath(map, entrance, poi, palette.floor);

    // 도달성 수리 루프: 미도달 POI가 없어질 때까지 통로를 다시 판다.
    let repairs = 0;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const reachable = computeReachableCells(draft, map, entrance.x, entrance.y);
      const unreachable = pois.filter((poi) => !isAdjacentOrOn(reachable, poi.x, poi.y));
      if (unreachable.length === 0) break;
      for (const poi of unreachable) {
        carvePath(map, entrance, poi, palette.floor);
        repairs += 1;
      }
    }

    draft.maps[id] = map;
    if (!draft.maps[draft.mapTree.mapId]) {
      draft.mapTree = { mapId: id, children: [] };
    } else if (draft.mapTree.mapId !== id && !draft.mapTree.children.some((child) => child.mapId === id)) {
      draft.mapTree.children.push({ mapId: id, children: [] });
    }
    if (!draft.maps[draft.startMapId]) {
      draft.startMapId = id;
      draft.startPos = { ...entrance };
    }

    return {
      summary: `${theme} 맵 '${map.name}'(${width}x${height}) 생성 — POI ${pois.length}개, 통로 수리 ${repairs}회`,
      data: { mapId: id, entrance, pois },
    };
  },
};

function defaultPois(width: number, height: number): Point[] {
  return [
    { x: width - 2, y: 1 },
    { x: width - 2, y: height - 2 },
    { x: Math.floor(width / 2), y: height - 2 },
  ];
}

export const MAP_GEN_TOOLS: readonly ToolDefinition[] = [generateMap];
