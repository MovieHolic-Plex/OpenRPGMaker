import { genId } from "@/util/id";
import type { GameMap, MapId, MapTreeNode } from "../types";
import { dirtLikeTiles } from "./chipsetMapping";
import {
  DEFAULT_TILE_SIZE,
  DEFAULT_TILESET_ID,
  TILE,
} from "./constants";
import { decorateStarterMap64 } from "./decoratedStarterMap";
import { paintRoadRect, shapeRoadEdges, type RoadRect } from "./roadAutotile";
export {
  createTownArchitectureCityMap,
  createTownArchitectureTestMap,
  createDbExtractedHouseTemplateMap,
  createSmallHouseVariantMap,
  createSmallHouseVariantMaps,
  createTownCityShowcaseMap,
  createTownHouseShowcaseMap,
  type SmallHouseVariantIndex,
  type TownHouseShowcaseStyle,
} from "./townShowcaseMaps";

const STARTER_MAP_SIZE = 64;
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
    lowerTiles: new Array<number>(n).fill(TILE.GRASS),
    upperTiles: new Array<number>(n).fill(TILE.EMPTY),
    events: [],
  };
}

export function createStarterMap(): GameMap {
  const map = createBlankMap("마을", STARTER_MAP_SIZE, STARTER_MAP_SIZE);
  decorateStarterMap64(map);
  return map;
}

export function createLogCabinShowcaseMap(): GameMap {
  const map = createBlankMap("통나무집 시험장", LOG_CABIN_SHOWCASE_SIZE, LOG_CABIN_SHOWCASE_SIZE);
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
