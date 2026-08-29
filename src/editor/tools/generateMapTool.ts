// editor/tools/generateMapTool.ts
// 테마 맵 생성기. create_map+paint 계열의 조합으로 구현하되,
// **생성→도달성 검사→국소 수리(통로 뚫기) 루프를 내장**해 항상 입구에서 모든 POI에 도달 가능한 맵을 반환한다.
// aiPreviewThemeGrammar는 AiPreview 계약에 강결합돼 재사용 대신 독자 구현한다.

import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { genId } from "@/util/id";
import type { GameMap } from "@/project/types";
import { assertMapIdAvailable, inMapBounds, lineCells, setLower, type Point } from "./mapHelpers";
import {
  applyMapGenerationPassage,
  requireMapGenerationProfile,
  type MapGenerationLayout,
  type MapGenerationPalette,
} from "./mapGenerationProfiles";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { COORD_SCHEMA } from "./schemaShapes";

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

function blankThemedMap(
  id: string,
  name: string,
  width: number,
  height: number,
  tilesetId: string,
  palette: ThemePalette,
  pathTile: number,
): GameMap {
  const size = width * height;
  const map: GameMap = {
    id,
    name,
    width,
    height,
    tilesetId,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(size).fill(palette.floor),
    upperTiles: new Array<number>(size).fill(TILE.EMPTY),
    events: [],
  };
  for (let x = 0; x < width; x += 1) {
    setLower(map, x, 0, palette.obstacle);
    setLower(map, x, height - 1, palette.obstacle);
  }
  for (let y = 0; y < height; y += 1) {
    setLower(map, 0, y, palette.obstacle);
    setLower(map, width - 1, y, palette.obstacle);
  }
  setLower(map, 1, Math.floor(height / 2), pathTile);
  return map;
}

function themePalette(profile: MapGenerationPalette): ThemePalette {
  return { floor: profile.base, obstacle: profile.obstacle, decor: profile.accent };
}

function paintLayoutGrammar(map: GameMap, layout: MapGenerationLayout, palette: ThemePalette): void {
  if (layout === "rooms") {
    const splitX = Math.floor(map.width / 2);
    for (let y = 2; y < map.height - 2; y += 1) setLower(map, splitX, y, palette.obstacle);
    setLower(map, splitX, Math.floor(map.height / 2), palette.floor);
    return;
  }
  if (layout === "ship") {
    for (let x = 2; x < map.width - 2; x += 1) {
      setLower(map, x, 2, palette.obstacle);
      setLower(map, x, map.height - 3, palette.obstacle);
    }
    return;
  }
  if (layout === "city") {
    for (let y = 3; y < map.height - 1; y += 6) {
      for (let x = 1; x < map.width - 1; x += 1) setLower(map, x, y, palette.floor);
    }
    for (let x = 4; x < map.width - 1; x += 7) {
      for (let y = 1; y < map.height - 1; y += 1) setLower(map, x, y, palette.floor);
    }
    return;
  }
  if (layout === "world") {
    for (let y = 4; y < map.height - 1; y += 7) {
      for (let x = 1; x < map.width - 1; x += 1) setLower(map, x, y, palette.decor);
    }
  }
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
      tilesetId: { type: "string", description: "이 맵에 사용할 타일셋. 타일셋별 전용 생성 로직을 선택한다." },
      name: { type: "string" },
      width: { type: "integer", description: "가로 타일 수(최대 256)" },
      height: { type: "integer", description: "세로 타일 수(최대 256)" },
      entrance: { ...COORD_SCHEMA, description: "{x,y} 입구(생략 시 좌측 중앙)" },
      pois: { type: "array", description: "[{x,y}] 관심 지점", items: COORD_SCHEMA },
      chokepoints: { type: "integer", description: "장애물 밀도(0~100, 기본 12)" },
      seed: { type: "integer" },
      id: { type: "string" },
    },
    required: ["theme", "width", "height"],
  },
  run(draft, args): ToolExecResult {
    const theme = args.theme as MapTheme;
    const fallbackPalette = THEME_PALETTES[theme];
    if (!fallbackPalette) throw new ToolError(`알 수 없는 테마: ${theme}`, { code: "unknown-theme" });
    const tilesetId = (args.tilesetId as string | undefined) ?? DEFAULT_TILESET_ID;
    const generationProfile = requireMapGenerationProfile(draft, tilesetId);
    const generationPalette = generationProfile.palettes[theme];
    const palette = themePalette(generationPalette);
    applyMapGenerationPassage(draft, generationProfile, generationPalette);
    const width = args.width as number;
    const height = args.height as number;
    if (width < 6 || height < 6) throw new ToolError("생성 맵은 최소 6x6 이상이어야 합니다.");
    assertGeneratedMapSize(width, height);
    const id = (args.id as string | undefined) ?? genId("map");
    // code:"map-exists" 누락으로 이 경로만 감사·게이트에서 다른 실패로 세어졌다(진단 근본원인 15).
    assertMapIdAvailable(draft, id);
    const rng = mulberry32((args.seed as number | undefined) ?? 1);
    const map = blankThemedMap(
      id,
      (args.name as string | undefined) ?? `${theme} 맵`,
      width,
      height,
      tilesetId,
      palette,
      generationPalette.path,
    );
    paintLayoutGrammar(map, generationProfile.layout, palette);

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
    setLower(map, entrance.x, entrance.y, generationPalette.path);

    // 입구→각 POI 통로 카빙.
    for (const poi of pois) carvePath(map, entrance, poi, generationPalette.path);

    // 도달성 수리 루프: 미도달 POI가 없어질 때까지 통로를 다시 판다.
    let repairs = 0;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const reachable = computeReachableCells(draft, map, entrance.x, entrance.y);
      const unreachable = pois.filter((poi) => !isAdjacentOrOn(reachable, poi.x, poi.y));
      if (unreachable.length === 0) break;
      for (const poi of unreachable) {
        carvePath(map, entrance, poi, generationPalette.path);
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
      summary: `${theme}/${generationProfile.layout} 맵 '${map.name}'(${width}x${height}) 생성 — POI ${pois.length}개, 통로 수리 ${repairs}회`,
      data: {
        mapId: id,
        entrance,
        pois,
        generationProfile: generationProfile.tilesetId,
        generationLayout: generationProfile.layout,
      },
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
