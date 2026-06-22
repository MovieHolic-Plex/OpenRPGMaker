import type { GameMap } from "../types";
import { CHIPSET_TILE_GROUPS, SAND_TILE } from "./chipsetMapping";

type Point = {
  readonly x: number;
  readonly y: number;
};

type SandNeighbors = {
  readonly north: boolean;
  readonly south: boolean;
  readonly west: boolean;
  readonly east: boolean;
};

const SAND_SURFACE_TILE_SET = new Set<number>(CHIPSET_TILE_GROUPS.sandGround);
const WATER_SURFACE_TILE_SET = new Set<number>(CHIPSET_TILE_GROUPS.water);

export function shapeSandEdges(map: GameMap): void {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const point = { x, y };
      if (isSandSurface(map, point)) {
        setLower(map, point, tileForSandCell(sandNeighbors(map, point)));
      }
    }
  }
}

function tileForSandCell(neighbors: SandNeighbors): number {
  const missingNorth = !neighbors.north;
  const missingSouth = !neighbors.south;
  const missingWest = !neighbors.west;
  const missingEast = !neighbors.east;

  if (missingNorth && missingWest) return SAND_TILE.CORNER_NORTH_WEST;
  if (missingNorth && missingEast) return SAND_TILE.CORNER_NORTH_EAST;
  if (missingSouth && missingWest) return SAND_TILE.CORNER_SOUTH_WEST;
  if (missingSouth && missingEast) return SAND_TILE.CORNER_SOUTH_EAST;
  if (missingNorth) return SAND_TILE.EDGE_NORTH;
  if (missingSouth) return SAND_TILE.EDGE_SOUTH;
  if (missingWest) return SAND_TILE.EDGE_WEST;
  if (missingEast) return SAND_TILE.EDGE_EAST;
  return SAND_TILE.BODY;
}

function sandNeighbors(map: GameMap, point: Point): SandNeighbors {
  return {
    north: isSandCompatibleSurface(map, { x: point.x, y: point.y - 1 }),
    south: isSandCompatibleSurface(map, { x: point.x, y: point.y + 1 }),
    west: isSandCompatibleSurface(map, { x: point.x - 1, y: point.y }),
    east: isSandCompatibleSurface(map, { x: point.x + 1, y: point.y }),
  };
}

function isSandCompatibleSurface(map: GameMap, point: Point): boolean {
  const tile = lowerAt(map, point);
  return tile !== undefined && (SAND_SURFACE_TILE_SET.has(tile) || WATER_SURFACE_TILE_SET.has(tile));
}

function isSandSurface(map: GameMap, point: Point): boolean {
  const tile = lowerAt(map, point);
  return tile !== undefined && SAND_SURFACE_TILE_SET.has(tile);
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
