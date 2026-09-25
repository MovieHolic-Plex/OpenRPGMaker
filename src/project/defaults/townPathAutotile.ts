import type { GameMap } from "../types";
import { setLayerTileAt } from "../mapLayers";
import { SAND_TILE } from "./chipsetMapping";
import { TILE } from "./constants";
import type { RoadRect } from "./roadAutotile";

type TownPathNeighbors = {
  readonly north: boolean;
  readonly south: boolean;
  readonly west: boolean;
  readonly east: boolean;
};

const TOWN_PATH_TILES = [
  SAND_TILE.BODY,
  SAND_TILE.EDGE_NORTH,
  SAND_TILE.EDGE_SOUTH,
  SAND_TILE.EDGE_WEST,
  SAND_TILE.EDGE_EAST,
  SAND_TILE.CORNER_NORTH_WEST,
  SAND_TILE.CORNER_NORTH_EAST,
  SAND_TILE.CORNER_SOUTH_WEST,
  SAND_TILE.CORNER_SOUTH_EAST,
] as const;

const TOWN_PATH_TILE_SET = new Set<number>(TOWN_PATH_TILES);

/** 길이 덮지 않을 칸 — 기존 건물을 마스킹해 관통을 마는다. */
export type TownPathSkip = (x: number, y: number) => boolean;

export function paintTownPathNetwork(
  map: GameMap,
  rects: readonly RoadRect[],
  skip?: TownPathSkip
): void {
  for (const rect of rects) paintTownPathRect(map, rect, skip);
  for (const rect of rects) {
    forEachTownPathPoint(map, rect, (point) => {
      if (skip?.(point.x, point.y)) return;
      setLower(map, point.x, point.y, tileForTownPathCell(townPathNeighbors(map, point)));
    });
  }
}

export function shapeAllTownPaths(map: GameMap): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.lowerTiles[y * map.width + x];
      if (tile !== undefined && TOWN_PATH_TILE_SET.has(tile)) {
        setLower(map, x, y, tileForTownPathCell(townPathNeighbors(map, { x, y })));
      }
    }
  }
}

export function clearUpperTilesOnTownPath(map: GameMap): void {
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    const lower = map.lowerTiles[index];
    if (lower !== undefined && TOWN_PATH_TILE_SET.has(lower)) map.upperTiles[index] = TILE.EMPTY;
  }
}

export function offsetTownRect(originX: number, originY: number, rect: RoadRect): RoadRect {
  return {
    x: originX + rect.x,
    y: originY + rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function paintTownPathRect(map: GameMap, rect: RoadRect, skip?: TownPathSkip): void {
  forEachTownPathPoint(map, rect, (point) => {
    if (skip?.(point.x, point.y)) return;
    setLower(map, point.x, point.y, SAND_TILE.BODY);
  });
}

function forEachTownPathPoint(
  map: GameMap,
  rect: RoadRect,
  visit: (point: { readonly x: number; readonly y: number }) => void
): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (isInside(map, x, y)) visit({ x, y });
    }
  }
}

function tileForTownPathCell(neighbors: TownPathNeighbors): number {
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

function townPathNeighbors(map: GameMap, point: { readonly x: number; readonly y: number }): TownPathNeighbors {
  return {
    north: isTownPath(map, point.x, point.y - 1),
    south: isTownPath(map, point.x, point.y + 1),
    west: isTownPath(map, point.x - 1, point.y),
    east: isTownPath(map, point.x + 1, point.y),
  };
}

function isTownPath(map: GameMap, x: number, y: number): boolean {
  if (!isInside(map, x, y)) return false;
  const tile = map.lowerTiles[y * map.width + x];
  return tile !== undefined && TOWN_PATH_TILE_SET.has(tile);
}

// 1층을 칠하면 그 칸의 2층 장식을 지운다(MZ 4층 공통 규칙). 옛 맵(2층 없음)에는 no-op.
function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (!isInside(map, x, y)) return;
  const index = y * map.width + x;
  map.lowerTiles[index] = tile;
  setLayerTileAt(map, 2, index, -1);
}

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}
