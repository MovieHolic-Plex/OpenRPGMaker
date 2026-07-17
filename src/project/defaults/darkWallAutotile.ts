/**
 * Interior dark-wall terrain autotile (EasyRPG Interior chipset).
 *
 * Contract (2026-07-15 Option B):
 * - Store only brush **366** on every dark wall cell.
 * - Do NOT rewrite edges/corners into 396–458 at save time.
 * - Render samples 368/396–458 as quarter sources only (see interiorDarkWallQuarter).
 */
import {
  shapeAutotileGroupAround,
  type AutotilePoint,
} from "@/project/defaults/autotileEngine";
import type { AutotileGroup, GameMap } from "@/project/types";

export const DARK_WALL_TILE = {
  /** Only stored dark-wall id. */
  BODY: 366,
} as const;

/** @deprecated legacy variant ids — no longer written by createDarkWallAutotileGroup */
export const DARK_WALL_LEGACY_VARIANT_TILES = {
  EDGE_NORTH: 367,
  EDGE_SOUTH: 427,
  EDGE_WEST: 396,
  EDGE_EAST: 398,
  CORNER_NORTH_WEST: 368,
  CORNER_NORTH_EAST: 369,
  CORNER_SOUTH_WEST: 426,
  CORNER_SOUTH_EAST: 428,
} as const;

export const DARK_WALL_CONNECT_FLOOR = 72;

export const DARK_WALL_AUTOTILE_GROUP_ID = "harness-interior-house-v1-dark-wall-autotile";

/** Render-only quarter source atlas (not store members). */
export const DARK_WALL_QUARTER_SOURCE = {
  center: 427,
  concave: 368,
  edgeN: 397, // top line
  edgeS: 457, // bottom line
  edgeW: 426, // left line
  edgeE: 428, // right line
  cornerNW: 396, // top+left
  cornerNE: 398, // top+right
  cornerSW: 456, // bottom+left
  cornerSE: 458, // bottom+right
} as const;

export function createDarkWallAutotileGroup(): AutotileGroup {
  const body = DARK_WALL_TILE.BODY;
  // Every mask writes body only — no multi-variant store map.
  const variantMap: Record<string, number> = {};
  for (let mask = 0; mask < 16; mask += 1) variantMap[String(mask)] = body;
  return {
    id: DARK_WALL_AUTOTILE_GROUP_ID,
    name: "실내 어두운 벽 (366 전용 저장)",
    neighborhood: 4,
    memberTileIds: [body],
    connectTileIds: [body, DARK_WALL_CONNECT_FLOOR],
    triggerTileIds: [body],
    variantMap,
  };
}

/** Paint brush 366 on cells; reshape keeps store as 366. */
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
  return tile === DARK_WALL_TILE.BODY || group.memberTileIds.includes(tile);
}
