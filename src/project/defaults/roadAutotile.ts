import type { GameMap } from "../types";
import { DIRT_ROAD_TILE } from "./chipsetMapping";

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

type RoadNeighbors = {
  readonly north: boolean;
  readonly south: boolean;
  readonly west: boolean;
  readonly east: boolean;
};

const ROAD_SURFACE_TILES = [
  DIRT_ROAD_TILE.BODY,
  DIRT_ROAD_TILE.BODY_ALT,
  DIRT_ROAD_TILE.EDGE_NORTH,
  DIRT_ROAD_TILE.EDGE_SOUTH,
  DIRT_ROAD_TILE.EDGE_WEST,
  DIRT_ROAD_TILE.EDGE_EAST,
  DIRT_ROAD_TILE.CORNER_NORTH_WEST,
  DIRT_ROAD_TILE.CORNER_NORTH_EAST,
  DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
  DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
] as const;

const ROAD_SURFACE_TILE_SET = new Set<number>(ROAD_SURFACE_TILES);
const ROAD_RECHECK_OFFSETS = [
  { x: 0, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
] as const;

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
  return tileForRoadCell(roadNeighbors(map, point));
}

export function shapeRoadEdges(map: GameMap, rects: readonly RoadRect[]): void {
  for (const rect of rects) {
    forEachRoadPoint(rect, (point) => {
      setLower(map, point, tileForRoadCell(roadNeighbors(map, point)));
    });
  }
}

export function shapeRoadAround(map: GameMap, points: readonly Point[]): void {
  const visited = new Set<string>();
  for (const point of points) {
    for (const offset of ROAD_RECHECK_OFFSETS) {
      const candidate = { x: point.x + offset.x, y: point.y + offset.y };
      const key = `${candidate.x},${candidate.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!isRoadSurface(map, candidate)) continue;
      setLower(map, candidate, tileForRoadCell(roadNeighbors(map, candidate)));
    }
  }
}

function forEachRoadPoint(rect: RoadRect, visit: (point: Point) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      visit({ x, y });
    }
  }
}

function tileForRoadCell(neighbors: RoadNeighbors): number {
  const missingNorth = !neighbors.north;
  const missingSouth = !neighbors.south;
  const missingWest = !neighbors.west;
  const missingEast = !neighbors.east;

  if (missingNorth && missingWest) return DIRT_ROAD_TILE.CORNER_NORTH_WEST;
  if (missingNorth && missingEast) return DIRT_ROAD_TILE.CORNER_NORTH_EAST;
  if (missingSouth && missingWest) return DIRT_ROAD_TILE.CORNER_SOUTH_WEST;
  if (missingSouth && missingEast) return DIRT_ROAD_TILE.CORNER_SOUTH_EAST;
  if (missingNorth) return DIRT_ROAD_TILE.EDGE_NORTH;
  if (missingSouth) return DIRT_ROAD_TILE.EDGE_SOUTH;
  if (missingWest) return DIRT_ROAD_TILE.EDGE_WEST;
  if (missingEast) return DIRT_ROAD_TILE.EDGE_EAST;
  return DIRT_ROAD_TILE.BODY;
}

function roadNeighbors(map: GameMap, point: Point): RoadNeighbors {
  return {
    north: isRoadSurface(map, { x: point.x, y: point.y - 1 }),
    south: isRoadSurface(map, { x: point.x, y: point.y + 1 }),
    west: isRoadSurface(map, { x: point.x - 1, y: point.y }),
    east: isRoadSurface(map, { x: point.x + 1, y: point.y }),
  };
}

function isRoadSurface(map: GameMap, point: Point): boolean {
  const tile = lowerAt(map, point);
  return tile !== undefined && ROAD_SURFACE_TILE_SET.has(tile);
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
