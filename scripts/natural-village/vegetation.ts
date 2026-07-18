import { TILE } from "../../src/project/defaults/constants";
import type { GameMap } from "../../src/project/types";
import type { Point } from "./blueprint";
import { DARK_GRASS_TILES, GRASS_TILES } from "./scenery";

export function placeReferenceBroadleaf(map: GameMap, point: Point): void {
  if (!canPlaceTree(map, point.x, point.y, 2)) return;
  setUpper(map, point.x, point.y, 262);
  setUpper(map, point.x + 1, point.y, 263);
  setUpper(map, point.x, point.y + 1, 292);
  setUpper(map, point.x + 1, point.y + 1, 293);
}

export function placeReferenceConifer(map: GameMap, point: Point): void {
  if (!canPlaceTree(map, point.x, point.y, 1)) return;
  setUpper(map, point.x, point.y, 260);
  setUpper(map, point.x, point.y + 1, 290);
}

function canPlaceTree(map: GameMap, x0: number, y0: number, width: number): boolean {
  for (let y = y0; y <= y0 + 1; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
      const index = y * map.width + x;
      const lower = map.lowerTiles[index];
      if (lower === undefined
        || (!(GRASS_TILES as readonly number[]).includes(lower) && !(DARK_GRASS_TILES as readonly number[]).includes(lower))) return false;
      if (map.upperTiles[index] !== TILE.EMPTY) return false;
    }
  }
  return true;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  map.upperTiles[y * map.width + x] = tile;
}
