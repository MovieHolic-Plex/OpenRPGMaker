// editor/tools/generateMapTool.ts
// 테마 맵 생성기. create_map+paint 계열의 조합으로 구현하되,
// **생성→도달성 검사→국소 수리(통로 뚫기) 루프를 내장**해 항상 입구에서 모든 POI에 도달 가능한 맵을 반환한다.
// aiPreviewThemeGrammar는 AiPreview 계약에 강결합돼 재사용 대신 독자 구현한다.

import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { exceedsMapDimensionLimit, MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { genId } from "@/util/id";
import type { GameMap } from "@/project/types";
import { assertMapIdAvailable, inMapBounds, lineCells, setLower, setUpper, type Point } from "./mapHelpers";
import { assignCreatedMapBgm } from "./mapTools";
import {
  resolveMapGenerationPalette,
  requireMapGenerationProfile,
  type MapGenerationLayout,
  type MapGenerationPaletteResolver,
  type MapGenerationTile,
} from "./mapGenerationProfiles";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { COORD_SCHEMA } from "./schemaShapes";

type MapTheme = "village" | "forest" | "cave";

// 외곽 테두리 처리. create_map(mapTools.ts)과 같은 규약 — 기본은 테두리 없음.
// 2026-07-08 47b0d51d 가 create_map 의 강제 돌벽 테두리를 옵션으로 강등했는데
// generate_map 은 같은 패턴이 남아 있었다(사용자 보고 2026-08-29: "타일 깔라 하면
// 항상 외곽에 벽을 깐다"). 장애물 팔레트는 프로파일 13종 전부 벽/솔리드 타일이라
// (mapGenerationProfiles.ts: village/cave=306 TILE.WALL 등) 테마와 무관하게
// 맵 4변이 통행 불가 벽으로 봉인됐다.
type MapBorder = "none" | "wall";

function paintPaletteTile(map: GameMap, x: number, y: number, choice: MapGenerationTile): void {
  if (choice.layer === "upper") setUpper(map, x, y, choice.tile);
  else setLower(map, x, y, choice.tile);
}

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
  palette: MapGenerationPaletteResolver,
  border: MapBorder,
): GameMap {
  const size = width * height;
  const map: GameMap = {
    id,
    name,
    width,
    height,
    tilesetId,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(size).fill(palette("base").tile),
    upperTiles: new Array<number>(size).fill(TILE.EMPTY),
    events: [],
  };
  if (border === "wall") {
    for (let x = 0; x < width; x += 1) {
      paintPaletteTile(map, x, 0, palette("obstacle"));
      paintPaletteTile(map, x, height - 1, palette("obstacle"));
    }
    for (let y = 0; y < height; y += 1) {
      paintPaletteTile(map, 0, y, palette("obstacle"));
      paintPaletteTile(map, width - 1, y, palette("obstacle"));
    }
  }
  return map;
}

function paintLayoutGrammar(map: GameMap, layout: MapGenerationLayout, palette: MapGenerationPaletteResolver): void {
  if (layout === "rooms") {
    const splitX = Math.floor(map.width / 2);
    for (let y = 2; y < map.height - 2; y += 1) paintPaletteTile(map, splitX, y, palette("obstacle"));
    setLower(map, splitX, Math.floor(map.height / 2), palette("base").tile);
    return;
  }
  if (layout === "ship") {
    for (let x = 2; x < map.width - 2; x += 1) {
      paintPaletteTile(map, x, 2, palette("obstacle"));
      paintPaletteTile(map, x, map.height - 3, palette("obstacle"));
    }
    return;
  }
  if (layout === "city") {
    for (let y = 3; y < map.height - 1; y += 6) {
      for (let x = 1; x < map.width - 1; x += 1) setLower(map, x, y, palette("base").tile);
    }
    for (let x = 4; x < map.width - 1; x += 7) {
      for (let y = 1; y < map.height - 1; y += 1) setLower(map, x, y, palette("base").tile);
    }
    return;
  }
  if (layout === "world") {
    for (let y = 4; y < map.height - 1; y += 7) {
      for (let x = 1; x < map.width - 1; x += 1) paintPaletteTile(map, x, y, palette("accent"));
    }
  }
}

function assertGeneratedMapSize(width: number, height: number): void {
  if (exceedsMapDimensionLimit(width, height)) {
    throw new ToolError(mapSizeLimitMessage("생성 맵 크기"), { code: "map-too-large" });
  }
}

// L자 통로로 두 점을 잇되, 지나는 칸을 통행 가능한 floor로 만든다.
// 외곽 벽 테두리가 있을 때만 가장자리 칸을 건너뛴다 — border none 인데도 1칸을
// 비우면 맵 끝 이동을 벽에 붙일 자리가 없어진다.
function carvePath(map: GameMap, from: Point, to: Point, floor: number, border: MapBorder): void {
  const corner: Point = { x: to.x, y: from.y };
  for (const cell of [...lineCells(from, corner), ...lineCells(corner, to)]) {
    if (!inMapBounds(map, cell.x, cell.y)) continue;
    const onEdge = cell.x === 0 || cell.y === 0 || cell.x === map.width - 1 || cell.y === map.height - 1;
    if (border === "wall" && onEdge) continue;
    setLower(map, cell.x, cell.y, floor);
  }
}

const generateMap: ToolDefinition = {
  name: "generate_map",
  description:
    `테마(village/forest/cave) 맵을 생성한다(기본은 테두리 없는 평지, 최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}). 입구→모든 POI 도달성을 생성기가 보장(생성→검사→통로 수리 루프). `
    + "테마에 맞는 BGM을 CC0 카탈로그에서 고른다(같은 seed면 같은 곡, bgm/bgmResourceId가 있으면 그걸 쓴다). "
    + "동굴/던전처럼 외곽이 막혀야 할 때만 border:\"wall\"을 지정한다 — 지정하면 맵 4변이 통행 불가 장애물로 봉인된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      theme: { type: "string", enum: ["village", "forest", "cave"] },
      border: { type: "string", enum: ["none", "wall"], description: "테두리 처리(기본 none, wall이면 외곽 4변을 테마 장애물 타일로 봉인)" },
      tilesetId: { type: "string", description: "이 맵에 사용할 타일셋. 타일셋별 전용 생성 로직을 선택한다." },
      name: { type: "string" },
      width: { type: "integer", description: `가로 타일 수(최대 ${MAX_TOOL_MAP_DIMENSION})` },
      height: { type: "integer", description: `세로 타일 수(최대 ${MAX_TOOL_MAP_DIMENSION})` },
      entrance: { ...COORD_SCHEMA, description: "{x,y} 입구(생략 시 좌측 중앙)" },
      pois: { type: "array", description: "[{x,y}] 관심 지점", items: COORD_SCHEMA },
      chokepoints: { type: "integer", description: "장애물 밀도(0~100, 기본 12)" },
      seed: { type: "integer", description: "타일 산포·BGM 선택 시드(BGM은 별도 네임스페이스, 생략 시 1)" },
      bgmResourceId: { type: "string", description: "맵 BGM 리소스 id. 있으면 자동 선택을 건너뛴다." },
      bgm: {
        type: "object",
        description: "명시적 BGM 설정. 있으면 자동 선택을 건너뛴다.",
        properties: {
          mode: { type: "string", enum: ["parent", "none", "custom"] },
          resourceId: { type: "string" },
          fadeInMs: { type: "integer" },
        },
      },
      id: { type: "string" },
    },
    required: ["theme", "width", "height"],
  },
  run(draft, args): ToolExecResult {
    const theme = args.theme as MapTheme;
    if (!["village", "forest", "cave"].includes(theme)) throw new ToolError(`알 수 없는 테마: ${theme}`, { code: "unknown-theme" });
    const tilesetId = (args.tilesetId as string | undefined) ?? DEFAULT_TILESET_ID;
    const generationProfile = requireMapGenerationProfile(draft, tilesetId);
    if (generationProfile.layout === "rooms") {
      throw new ToolError(
        "실내는 개념 꾸러미로 시공합니다. get_concept_facility로 장소·물건을 읽고 place_concept(plan, 새 mapId)을 사용하세요. 현재 개념 시공은 실내 칩셋을 지원합니다.",
        { code: "concept-interior-required" },
      );
    }
    const palette = resolveMapGenerationPalette(draft, generationProfile, generationProfile.palettes[theme]);
    const width = args.width as number;
    const height = args.height as number;
    if (width < 6 || height < 6) throw new ToolError("생성 맵은 최소 6x6 이상이어야 합니다.");
    assertGeneratedMapSize(width, height);
    const id = (args.id as string | undefined) ?? genId("map");
    // code:"map-exists" 누락으로 이 경로만 감사·게이트에서 다른 실패로 세어졌다(진단 근본원인 15).
    assertMapIdAvailable(draft, id);
    const rng = mulberry32((args.seed as number | undefined) ?? 1);
    const border = (args.border as MapBorder | undefined) ?? "none";
    const map = blankThemedMap(
      id,
      (args.name as string | undefined) ?? `${theme} 맵`,
      width,
      height,
      tilesetId,
      palette,
      border,
    );
    paintLayoutGrammar(map, generationProfile.layout, palette);

    const inset = border === "wall" ? 1 : 0;
    const entrance = (args.entrance as Point | undefined) ?? { x: inset, y: Math.floor(height / 2) };
    const pois = ((args.pois as Point[] | undefined) ?? defaultPois(width, height, inset)).filter((poi) => inMapBounds(map, poi.x, poi.y));
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
        if (rng() * 100 < density) paintPaletteTile(map, x, y, palette("obstacle"));
      }
    }
    // 입구 확보.
    const path = palette("path").tile;
    setLower(map, entrance.x, entrance.y, path);

    // 입구→각 POI 통로 카빙.
    for (const poi of pois) carvePath(map, entrance, poi, path, border);

    // 도달성 수리 루프: 미도달 POI가 없어질 때까지 통로를 다시 판다.
    let repairs = 0;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const reachable = computeReachableCells(draft, map, entrance.x, entrance.y);
      const unreachable = pois.filter((poi) => !isAdjacentOrOn(reachable, poi.x, poi.y));
      if (unreachable.length === 0) break;
      for (const poi of unreachable) {
        carvePath(map, entrance, poi, path, border);
        repairs += 1;
      }
    }

    const bgmResourceId = assignCreatedMapBgm(map, args, { themeOrName: theme, defaultSeed: 1 });

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
      summary: `${theme}/${generationProfile.layout} 맵 '${map.name}'(${width}x${height}) 생성 — POI ${pois.length}개, 통로 수리 ${repairs}회, 테두리 ${border === "wall" ? "벽" : "없음"}, BGM ${bgmResourceId}`,
      data: {
        mapId: id,
        entrance,
        pois,
        border,
        generationProfile: generationProfile.tilesetId,
        generationLayout: generationProfile.layout,
        bgmResourceId,
      },
    };
  },
};

function defaultPois(width: number, height: number, inset: number): Point[] {
  return [
    { x: width - 1 - inset, y: inset },
    { x: width - 1 - inset, y: height - 1 - inset },
    { x: Math.floor(width / 2), y: height - 1 - inset },
  ];
}

export const MAP_GEN_TOOLS: readonly ToolDefinition[] = [generateMap];
