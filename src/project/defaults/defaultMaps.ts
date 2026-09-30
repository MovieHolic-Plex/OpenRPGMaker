import { genId } from "@/util/id";
import type { GameMap, MapId, MapTreeNode } from "../types";
import { dirtLikeTiles } from "./chipsetMapping";
import {
  DEFAULT_TILE_SIZE,
  COMBINED_TOWN_TILESET_ID,
  DEFAULT_TILESET_ID,
  TILE,
} from "./constants";
import { paintRoadRect, shapeRoadEdges, type RoadRect } from "./roadAutotile";
import { addStarterVillageNpcs } from "./starterVillageNpcs";
// 쇼케이스·마켓타운 맵 빌더는 **여기서 re-export 하지 않는다**.
// 통과용 re-export 한 줄이 `@/editor/content/townShowcaseMaps` → dbExtractedHouseTemplate →
// houseKit ↔ houseInteriors(인테리어 파이프라인 전체)를 이 파일의 그래프에 끌어왔고,
// defaultMaps 는 defaultProject → `@/project/defaults` 배럴로 이어지므로 그 배럴을 import 하는
// 테스트 1,244개가 파일마다 그 그래프를 다시 평가했다(실측 2026-09-17: 배럴 335모듈·6.8MB,
// 파일당 collect 1.40 s. 이 줄들을 끊으면 162모듈·0.87 s).
// 필요한 쪽은 원본에서 직접 가져가라:
//   import { createTownCityShowcaseMap, ... } from "@/editor/content/townShowcaseMaps";
//   import { createMarketTownMap, marketTownStartPos } from "@/project/defaults/marketTownMap";
// villageShoppingStreetBuild 도 같은 이유(+ toolRunner/store 순환)로 re-export 하지 않는다.
// createVillageShoppingStreet* 는 villageShoppingStreetMap / defaultProject 경로를 사용.

const STARTER_MAP_SIZE = 30;
const LOG_CABIN_SHOWCASE_SIZE = 32;
const RETRO_HOUSE_SHOWCASE_SIZE = 10;
const RETRO_EXTERIOR_TILESET_ID = "easyrpg_chipset_retro_house";
const RETRO_GRASS = 270;
const RETRO_HOUSE_LOWER_PATTERN = [
  [270, 270, 270, 270, 270, 270, 270, 270, 270],
  [270, 270, 270, 270, 270, 270, 270, 270, 270],
  [270, 102, 103, 103, 103, 103, 104, 270, 270],
  [270, 132, 133, 133, 133, 133, 134, 270, 270],
  [270, 132, 133, 133, 133, 133, 134, 270, 270],
  [270, 162, 163, 163, 163, 163, 164, 270, 270],
  [270, 270, 270, 270, 270, 270, 270, 270, 270],
  [270, 270, 270, 270, 270, 270, 270, 270, 270],
] as const;
const RETRO_HOUSE_UPPER_PATTERN = [
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, 375, 375, 375, 375, 375, 375, -1, -1],
  [-1, 405, 405, 405, 405, 405, 405, -1, -1],
  [-1, -1, 85, -1, -1, 85, -1, -1, -1],
  [-1, -1, -1, 116, -1, -1, -1, -1, -1],
  [-1, -1, -1, 146, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
] as const;
const DIAGONAL_ROOF_LOWER_PATTERN = [
  [-1, -1, -1, -1, 374, 375, 374, 375, 374, -1, -1, -1, -1],
  [-1, -1, -1, 374, 375, 374, 375, 374, 375, 374, -1, -1, -1],
  [-1, -1, 374, 375, 374, 375, 374, 375, 374, 375, 374, -1, -1],
  [-1, 374, 375, 374, 375, 374, 375, 374, 375, 374, 375, 374, -1],
  [374, 375, 374, 375, 374, 375, 374, 375, 374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404, 405, 404, 405, 404, 405, 404, 405, 404],
] as const;
const DIAGONAL_ROOF_UPPER_PATTERN = [
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-1, -1, 404, 405, 404, 405, 404, 405, 404, 405, 404, -1, -1],
  [-1, -1, 15, 16, 16, 16, 16, 16, 16, 16, 17, -1, -1],
  [-1, -1, 45, 46, 46, 46, 329, 46, 46, 46, 47, -1, -1],
  [-1, -1, 75, 76, 76, 76, 359, 76, 76, 76, 77, -1, -1],
] as const;
const SMALL_LOG_CABIN_PATTERN = [
  [374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404],
  [102, 103, 103, 103, 104],
  [132, 133, 329, 133, 134],
  [162, 163, 359, 163, 164],
] as const;
const PORCH_LOG_CABIN_PATTERN = [
  [374, 375, 374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404, 405, 404],
  [102, 103, 103, 103, 103, 103, 104],
  [132, 133, 133, 329, 133, 133, 134],
  [162, 163, 163, 359, 163, 163, 164],
  [-1, 438, 379, 379, 379, 410, -1],
  [-1, 408, -1, 327, 328, 408, -1],
] as const;
const STARTER_VILLAGE_HOUSE_ORIGINS = [
  { x: 5, y: 5 },
  { x: 19, y: 5 },
  { x: 5, y: 17 },
] as const;
const STARTER_VILLAGE_ROADS = [
  { x: 4, y: 10, width: 20, height: 3 },
  { x: 13, y: 10, width: 3, height: 15 },
  { x: 7, y: 22, width: 9, height: 3 },
] as const satisfies readonly RoadRect[];

/**
 * 새 맵 바닥 채움 칸. `TILE.GRASS`(240)는 합본 마을 시트의 칸 번호라 버들항에서는 벽이다.
 * 버들항의 민무늬 풀 칸은 737 (openwiki/beodeul-city.md).
 */
const BEODEUL_PLAIN_GRASS_TILE = 737;

function blankFillTileFor(tilesetId: string): number {
  return tilesetId === "beodeul_city" ? BEODEUL_PLAIN_GRASS_TILE : TILE.GRASS;
}

export function createBlankMap(
  name: string,
  width: number,
  height: number,
  tilesetId: string = DEFAULT_TILESET_ID,
  tileSize: number = DEFAULT_TILE_SIZE
): GameMap {
  const n = width * height;
  return {
    id: genId("map"),
    name,
    width,
    height,
    tilesetId,
    tileSize,
    lowerTiles: new Array<number>(n).fill(blankFillTileFor(tilesetId)),
    upperTiles: new Array<number>(n).fill(TILE.EMPTY),
    events: [],
  };
}

export function createStarterMap(): GameMap {
  const map = createBlankMap("마을", STARTER_MAP_SIZE, STARTER_MAP_SIZE, COMBINED_TOWN_TILESET_ID);
  decorateStarterVillage(map);
  return map;
}

export function createLogCabinShowcaseMap(): GameMap {
  const map = createBlankMap("통나무집 시험장", LOG_CABIN_SHOWCASE_SIZE, LOG_CABIN_SHOWCASE_SIZE, COMBINED_TOWN_TILESET_ID);
  paintRoadNetwork(map, [
    { x: 2, y: 10, width: 28, height: 3 },
    { x: 20, y: 9, width: 3, height: 8 },
    { x: 13, y: 12, width: 3, height: 7 },
    { x: 13, y: 26, width: 3, height: 4 },
  ]);
  stampLower(map, { x: 4, y: 1 }, DIAGONAL_ROOF_LOWER_PATTERN);
  stampUpper(map, { x: 4, y: 1 }, DIAGONAL_ROOF_UPPER_PATTERN);
  stampLower(map, { x: 20, y: 4 }, SMALL_LOG_CABIN_PATTERN);
  stampLower(map, { x: 10, y: 19 }, PORCH_LOG_CABIN_PATTERN);
  stampUpper(map, { x: 2, y: 13 }, [[378, 379, 379, 379, 439]]);
  stampUpper(map, { x: 24, y: 13 }, [[409, 379, 379, 379, 380]]);
  stampUpper(map, { x: 2, y: 14 }, [[408], [408], [438]]);
  stampUpper(map, { x: 28, y: 14 }, [[408], [408], [410]]);
  stampUpper(map, { x: 5, y: 27 }, [[327, 328]]);
  stampUpper(map, { x: 23, y: 25 }, [[327, 328]]);
  clearUpperTilesOnRoad(map);
  return map;
}

export function createRetroHouseShowcaseMap(): GameMap {
  const map = createBlankMap(
    "EasyRPG 집 시험장",
    RETRO_HOUSE_SHOWCASE_SIZE,
    RETRO_HOUSE_SHOWCASE_SIZE,
    RETRO_EXTERIOR_TILESET_ID
  );
  map.lowerTiles.fill(RETRO_GRASS);
  stampLower(map, { x: 0, y: 1 }, RETRO_HOUSE_LOWER_PATTERN);
  stampUpper(map, { x: 0, y: 1 }, RETRO_HOUSE_UPPER_PATTERN);
  return map;
}

export function singleNodeTree(mapId: MapId): MapTreeNode {
  return { mapId, children: [] };
}

function paintRoadNetwork(map: GameMap, rects: readonly RoadRect[]): void {
  for (const rect of rects) paintRoadRect(map, rect);
  shapeRoadEdges(map, rects);
}

function decorateStarterVillage(map: GameMap): void {
  // 외곽 돌벽 프레임은 넣지 않는다 — 풀밭이 가장자리까지 이어지게 한다.
  paintRoadNetwork(map, STARTER_VILLAGE_ROADS);
  for (const origin of STARTER_VILLAGE_HOUSE_ORIGINS) {
    stampLower(map, origin, SMALL_LOG_CABIN_PATTERN);
  }
  clearUpperTilesOnRoad(map);
  addStarterVillageNpcs(map);
}

function stampUpper(
  map: GameMap,
  origin: { readonly x: number; readonly y: number },
  pattern: readonly (readonly number[])[]
): void {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) setUpper(map, origin.x + x, origin.y + y, tile);
    }
  }
}

function stampLower(
  map: GameMap,
  origin: { readonly x: number; readonly y: number },
  pattern: readonly (readonly number[])[]
): void {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) setLower(map, origin.x + x, origin.y + y, tile);
    }
  }
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (!isInside(map, x, y)) return;
  map.upperTiles[y * map.width + x] = tile;
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (!isInside(map, x, y)) return;
  map.lowerTiles[y * map.width + x] = tile;
}

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function clearUpperTilesOnRoad(map: GameMap): void {
  const roadTiles = new Set<number>(dirtLikeTiles());
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    const lower = map.lowerTiles[index];
    if (lower !== undefined && roadTiles.has(lower)) map.upperTiles[index] = TILE.EMPTY;
  }
}
