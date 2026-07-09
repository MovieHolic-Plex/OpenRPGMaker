import type { GameMap } from "../types";
import { TILE } from "./constants";
import { CHIPSET_TILE_GROUPS, dirtLikeTiles } from "./chipsetMapping";
import { LAKE_AUTOTILE_TILE } from "./lakeAutotile";
import { paintRoadRect, shapeRoadEdges, type RoadRect } from "./roadAutotile";
import { shapeSandEdges } from "./sandAutotile";
import { paintStarterMapObjects } from "./starterMapObjects";

type Point = { readonly x: number; readonly y: number };
type Rect = Point & { readonly width: number; readonly height: number };
type Oval = { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number };

const SAND_BODY_TILES = CHIPSET_TILE_GROUPS.sandBody;
const WATER_TILES = CHIPSET_TILE_GROUPS.waterBody;
const STONE_TILES = CHIPSET_TILE_GROUPS.stoneFloorBody;
const WALL_TILES = CHIPSET_TILE_GROUPS.stoneWallBody;
const DARK_WALL_TILES = CHIPSET_TILE_GROUPS.darkWallBody;
const WOOD_BRIDGE_TILES = CHIPSET_TILE_GROUPS.woodFloorBody;
const GROUND_DETAIL_TILES = CHIPSET_TILE_GROUPS.groundDetail;
const BASE_GRASS_TILES = [240, 241, 270, 271, 300, 301, 330, 331] as const;
const DARK_GRASS_TILES = [243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335] as const;
const ROAD_RECTS = [
  { x: 31, y: 4, width: 4, height: 56 },
  { x: 6, y: 34, width: 52, height: 4 },
  { x: 43, y: 38, width: 4, height: 16 },
  { x: 18, y: 23, width: 4, height: 11 },
] as const satisfies readonly RoadRect[];

export function decorateStarterMap64(map: GameMap): void {
  paintNaturalBase(map);
  // 맵 가장자리 WALL 프레임 제거(열린 필드). 내부 장식 벽 띠만 유지한다.
  paintInteriorWallBands(map);
  paintGrassPatches(map);
  paintWaterAndShore(map);
  paintBridgeAndGroundDetails(map);
  paintRoads(map);
  paintPlazas(map);
  paintDesertAndOasis(map);
  shapeSandEdges(map);
  paintStarterMapObjects(map);
  clearUpperTilesOnRoad(map);
}

function paintNaturalBase(map: GameMap): void {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const point = { x, y };
      setLower(map, point, pick(BASE_GRASS_TILES, point));
    }
  }
}

function paintInteriorWallBands(map: GameMap): void {
  fillLowerRect(map, { x: 3, y: 2, width: 23, height: 2 }, WALL_TILES);
  fillLowerRect(map, { x: 38, y: 2, width: 23, height: 2 }, WALL_TILES);
  fillLowerRect(map, { x: 3, y: 60, width: 23, height: 2 }, WALL_TILES);
  fillLowerRect(map, { x: 38, y: 60, width: 23, height: 2 }, WALL_TILES);
}

function paintWaterAndShore(map: GameMap): void {
  paintLake(map, { cx: 12, cy: 26, rx: 6, ry: 5 });
  paintLake(map, { cx: 53, cy: 15, rx: 5, ry: 3 });
}

function paintDesertAndOasis(map: GameMap): void {
  paintOval(map, { cx: 56, cy: 31, rx: 3, ry: 2 }, SAND_BODY_TILES);
  paintOval(map, { cx: 56, cy: 31, rx: 1.25, ry: 1.25 }, WATER_TILES);
}

function paintGrassPatches(map: GameMap): void {
  paintOval(map, { cx: 18, cy: 13, rx: 11, ry: 9 }, DARK_GRASS_TILES);
  paintOval(map, { cx: 48, cy: 24, rx: 10, ry: 8 }, DARK_GRASS_TILES);
  paintOval(map, { cx: 16, cy: 49, rx: 9, ry: 7 }, DARK_GRASS_TILES);
  paintOval(map, { cx: 50, cy: 57, rx: 8, ry: 5 }, DARK_GRASS_TILES);
}

function paintBridgeAndGroundDetails(map: GameMap): void {
  fillLowerRect(map, { x: 7, y: 15, width: 14, height: 2 }, WOOD_BRIDGE_TILES);
  fillLowerRect(map, { x: 23, y: 55, width: 4, height: 4 }, DARK_WALL_TILES);
  fillLowerRect(map, { x: 35, y: 24, width: 4, height: 4 }, GROUND_DETAIL_TILES);
  fillLowerRect(map, { x: 57, y: 32, width: 3, height: 3 }, GROUND_DETAIL_TILES);
  fillLowerRect(map, { x: 5, y: 52, width: 4, height: 3 }, GROUND_DETAIL_TILES);
}

function paintRoads(map: GameMap): void {
  for (const rect of ROAD_RECTS) {
    paintRoadRect(map, rect);
  }
  shapeRoadEdges(map, ROAD_RECTS);
}

function paintPlazas(map: GameMap): void {
  fillLowerRect(map, { x: 39, y: 11, width: 10, height: 8 }, STONE_TILES);
  fillLowerRect(map, { x: 46, y: 45, width: 10, height: 9 }, SAND_BODY_TILES);
  fillLowerRect(map, { x: 15, y: 44, width: 8, height: 7 }, STONE_TILES);
}

function fillLowerRect(map: GameMap, rect: Rect, tiles: readonly number[]): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const point = { x, y };
      setLower(map, point, pick(tiles, point));
    }
  }
}

function paintOval(map: GameMap, oval: Oval, tiles: readonly number[]): void {
  const left = Math.floor(oval.cx - oval.rx);
  const right = Math.ceil(oval.cx + oval.rx);
  const top = Math.floor(oval.cy - oval.ry);
  const bottom = Math.ceil(oval.cy + oval.ry);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const point = { x, y };
      if (insideOval(point, oval)) setLower(map, point, pick(tiles, point));
    }
  }
}

function paintLake(map: GameMap, oval: Oval): void {
  const left = Math.floor(oval.cx - oval.rx);
  const right = Math.ceil(oval.cx + oval.rx);
  const top = Math.floor(oval.cy - oval.ry);
  const bottom = Math.ceil(oval.cy + oval.ry);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const point = { x, y };
      if (insideLakeCell(point, oval)) setLower(map, point, LAKE_AUTOTILE_TILE.BODY);
    }
  }
}

function insideLakeCell(point: Point, oval: Oval): boolean {
  if (!insideOval(point, oval)) return false;
  return lakeCardinalNeighborCount(point, oval) > 1;
}

function lakeCardinalNeighborCount(point: Point, oval: Oval): number {
  let count = 0;
  if (insideOval({ x: point.x, y: point.y - 1 }, oval)) count += 1;
  if (insideOval({ x: point.x, y: point.y + 1 }, oval)) count += 1;
  if (insideOval({ x: point.x - 1, y: point.y }, oval)) count += 1;
  if (insideOval({ x: point.x + 1, y: point.y }, oval)) count += 1;
  return count;
}

function setLower(map: GameMap, point: Point, tile: number): void {
  if (!inBounds(map, point)) return;
  map.lowerTiles[point.y * map.width + point.x] = tile;
}

function inBounds(map: GameMap, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function insideOval(point: Point, oval: Oval): boolean {
  const dx = (point.x - oval.cx) / oval.rx;
  const dy = (point.y - oval.cy) / oval.ry;
  return dx * dx + dy * dy <= 1;
}

function pick(tiles: readonly number[], point: Point): number {
  return tiles[seed(point) % tiles.length] ?? TILE.GRASS;
}

function seed(point: Point): number {
  let value = Math.imul(point.x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(point.y ^ 0xc2b2ae35, 0x27d4eb2f);
  value ^= value >>> 15;
  return value >>> 0;
}

function clearUpperTilesOnRoad(map: GameMap): void {
  const roadTiles = new Set<number>(dirtLikeTiles());
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    const lower = map.lowerTiles[index];
    if (lower !== undefined && roadTiles.has(lower)) map.upperTiles[index] = TILE.EMPTY;
  }
}
