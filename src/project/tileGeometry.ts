import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import type { GameMap, TilesetDef } from "@/project/types";

/** Legacy documents without geometry keep the original 16px grid. */
export const DEFAULT_TILE_SIZE = RESOURCE_SLICING.chipset.cellWidth;

export function tilesetTileSize(tileset?: Partial<Pick<TilesetDef, "tileSize">> | null): number {
  const value = tileset?.tileSize;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : DEFAULT_TILE_SIZE;
}

/** World coordinates belong to the map, never to a process-wide active tileset. */
export function mapTileSize(
  map?: Partial<Pick<GameMap, "tileSize">> | null,
  tileset?: Partial<Pick<TilesetDef, "tileSize">> | null,
): number {
  const value = map?.tileSize;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : tilesetTileSize(tileset);
}
