import { RESOURCE_SLICING } from "./resourceSlicing";
import {
  CASTLE_REFERENCE_TILESET_TEXTURE_KEY,
  CASTLE_REFERENCE_TILE_SIZE,
  CASTLE_REFERENCE_TILES_PER_ROW,
  CASTLE_TILESET_TEXTURE_KEY,
  CASTLE_TILES_PER_ROW,
  CASTLE_TILE_SIZE,
} from "@/project/defaults/constants";

/** Source atlas geometry, shared by frame registration, previews and tile grafts. */
export function bundledChipsetTileSize(key: string): number {
  if (key === "tex_slates_32") return 32;
  if (key === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILE_SIZE;
  if (key === CASTLE_REFERENCE_TILESET_TEXTURE_KEY) return CASTLE_REFERENCE_TILE_SIZE;
  return RESOURCE_SLICING.chipset.cellWidth;
}

export function bundledChipsetTilesPerRow(key: string): number {
  if (key === "tex_shared_forest_village_objects") return 6;
  if (key === "tex_slates_32") return 56;
  if (key === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILES_PER_ROW;
  if (key === CASTLE_REFERENCE_TILESET_TEXTURE_KEY) return CASTLE_REFERENCE_TILES_PER_ROW;
  return RESOURCE_SLICING.chipset.columns;
}
