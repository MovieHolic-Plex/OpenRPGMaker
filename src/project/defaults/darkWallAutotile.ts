/**
 * Interior dark-wall terrain autotile (EasyRPG Interior chipset).
 *
 * RM-style: paint brush tile **366** (body); `shapeAutotileGroupAround` rewrites
 * edges/outer corners from 4-neighbor connectivity. Floor **72** is connect-only
 * so a wall ring around a room gets correct N/E/S/W edges and corners.
 *
 * Sheet block (approx):
 *   366 367 368 369 370 371
 *   396 397 398 399 400 401
 *   426 427 428 429 430 431
 *   456 457 458 459 460 461
 */
import {
  buildEdgeCornerVariantMap,
  shapeAutotileGroupAround,
  type AutotilePoint,
} from "@/project/defaults/autotileEngine";
import type { AutotileGroup, GameMap } from "@/project/types";

export const DARK_WALL_TILE = {
  /** Brush / body — what the user paints. */
  BODY: 366,
  EDGE_NORTH: 367,
  EDGE_SOUTH: 427,
  EDGE_WEST: 396,
  EDGE_EAST: 398,
  CORNER_NORTH_WEST: 368,
  CORNER_NORTH_EAST: 369,
  CORNER_SOUTH_WEST: 426,
  CORNER_SOUTH_EAST: 428,
} as const;

/** Floor tile treated as connected neighbor (inside room), not a wall member. */
export const DARK_WALL_CONNECT_FLOOR = 72;

export const DARK_WALL_AUTOTILE_GROUP_ID = "harness-interior-house-v1-dark-wall-autotile";

const MEMBER_TILE_IDS: readonly number[] = [
  DARK_WALL_TILE.BODY,
  DARK_WALL_TILE.EDGE_NORTH,
  DARK_WALL_TILE.EDGE_SOUTH,
  DARK_WALL_TILE.EDGE_WEST,
  DARK_WALL_TILE.EDGE_EAST,
  DARK_WALL_TILE.CORNER_NORTH_WEST,
  DARK_WALL_TILE.CORNER_NORTH_EAST,
  DARK_WALL_TILE.CORNER_SOUTH_WEST,
  DARK_WALL_TILE.CORNER_SOUTH_EAST,
  // same sheet companions often used as edges in authored maps
  397, 456, 457, 458, 399, 400, 401, 429, 431, 459, 460, 461, 370, 371,
];

export function createDarkWallAutotileGroup(): AutotileGroup {
  const memberTileIds = [...new Set(MEMBER_TILE_IDS)];
  return {
    id: DARK_WALL_AUTOTILE_GROUP_ID,
    name: "실내 어두운 벽 (366 브러시)",
    neighborhood: 4,
    memberTileIds,
    connectTileIds: [...memberTileIds, DARK_WALL_CONNECT_FLOOR],
    // trigger when painting body 366 (and any member)
    triggerTileIds: memberTileIds,
    variantMap: buildEdgeCornerVariantMap({
      body: DARK_WALL_TILE.BODY,
      edgeN: DARK_WALL_TILE.EDGE_NORTH,
      edgeS: DARK_WALL_TILE.EDGE_SOUTH,
      edgeW: DARK_WALL_TILE.EDGE_WEST,
      edgeE: DARK_WALL_TILE.EDGE_EAST,
      cornerNW: DARK_WALL_TILE.CORNER_NORTH_WEST,
      cornerNE: DARK_WALL_TILE.CORNER_NORTH_EAST,
      cornerSW: DARK_WALL_TILE.CORNER_SOUTH_WEST,
      cornerSE: DARK_WALL_TILE.CORNER_SOUTH_EAST,
    }),
  };
}

/** Paint brush 366 on cells, then reshape edges/corners. */
export function paintDarkWallAndShape(
  map: GameMap,
  cells: readonly AutotilePoint[],
  group: AutotileGroup = createDarkWallAutotileGroup(),
): void {
  for (const { x, y } of cells) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    map.lowerTiles[y * map.width + x] = DARK_WALL_TILE.BODY;
  }
  shapeAutotileGroupAround(map, group, cells);
}

export function isDarkWallTile(tile: number, group: AutotileGroup = createDarkWallAutotileGroup()): boolean {
  return group.memberTileIds.includes(tile);
}
