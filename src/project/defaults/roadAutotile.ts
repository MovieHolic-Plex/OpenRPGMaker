import type { GameMap } from "../types";
import { autotileNeighborMask, autotileVariantForMask, shapeAutotileGroupAround } from "./autotileEngine";
import { DEFAULT_ROAD_AUTOTILE_GROUP } from "./autotileGroups";
import { DIRT_ROAD_TILE } from "./chipsetMapping";

// 흙길 셰이핑 — 내장 오토타일 그룹(builtin_dirt_road)에 위임한다.
// 8방향 판정: 볼록 9-슬라이스 + 외딴 점(360) + 오목 코너(362)까지 자동 성형.

export type RoadRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type RoadPoint = {
  readonly x: number;
  readonly y: number;
};
type Point = RoadPoint;

const ROAD_SURFACE_TILE_SET = new Set<number>(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
const ROAD_CONNECT_TILE_SET = new Set<number>(
  DEFAULT_ROAD_AUTOTILE_GROUP.connectTileIds ?? DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds
);

export function paintRoadRect(map: GameMap, rect: RoadRect): void {
  forEachRoadPoint(rect, (point) => {
    setLower(map, point, DIRT_ROAD_TILE.BODY);
  });
}

export function isRoadTile(tile: number): boolean {
  return ROAD_SURFACE_TILE_SET.has(tile);
}

export function roadAutotileTileForCell(map: GameMap, point: Point): number | null {
  if (lowerAt(map, point) !== DIRT_ROAD_TILE.BODY_ALT) return null;
  return roadVariantAt(map, point);
}

export function shapeRoadEdges(map: GameMap, rects: readonly RoadRect[]): void {
  for (const rect of rects) {
    forEachRoadPoint(rect, (point) => {
      setLower(map, point, roadVariantAt(map, point));
    });
  }
}

export function shapeRoadAround(map: GameMap, points: readonly Point[]): void {
  shapeAutotileGroupAround(map, DEFAULT_ROAD_AUTOTILE_GROUP, points);
}

function roadVariantAt(map: GameMap, point: Point): number {
  const mask = autotileNeighborMask(map, point.x, point.y, (tile) => ROAD_CONNECT_TILE_SET.has(tile), DEFAULT_ROAD_AUTOTILE_GROUP.neighborhood ?? 4);
  return autotileVariantForMask(DEFAULT_ROAD_AUTOTILE_GROUP, mask) ?? DIRT_ROAD_TILE.BODY;
}

function forEachRoadPoint(rect: RoadRect, visit: (point: Point) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      visit({ x, y });
    }
  }
}

function lowerAt(map: GameMap, point: Point): number | undefined {
  if (!inBounds(map, point)) return undefined;
  return map.lowerTiles[point.y * map.width + point.x];
}

function setLower(map: GameMap, point: Point, tile: number): void {
  if (!inBounds(map, point)) return;
  map.lowerTiles[point.y * map.width + point.x] = tile;
}

function inBounds(map: GameMap, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}
