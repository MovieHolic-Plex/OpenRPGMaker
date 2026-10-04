import { RESOURCE_SLICING } from "./resourceSlicing";
import beodeulCitySheet from "./beodeulCitySheet.json";
import joseonBaramSheet from "./joseonBaramSheet.json";
import modernCitySheet from "./modernCitySheet.json";
import jpCitySheet from "./jpCitySheet.json";
import atlasBiomeInteriorSheet from "./atlasBiomeInteriorSheet.json";
import {
  CASTLE_REFERENCE_TILESET_TEXTURE_KEY,
  CASTLE_REFERENCE_TILE_SIZE,
  CASTLE_REFERENCE_TILES_PER_ROW,
  CASTLE_TILESET_TEXTURE_KEY,
  CASTLE_TILES_PER_ROW,
  CASTLE_TILE_SIZE,
  LPC_WOODEN_FURNITURE_16_TILE_SIZE,
  LPC_WOODEN_FURNITURE_16_TILES_PER_ROW,
  LPC_WOODEN_FURNITURE_16_TEXTURE_KEY,
  LPC_WOODEN_FURNITURE_TILE_SIZE,
  LPC_WOODEN_FURNITURE_TILES_PER_ROW,
  LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";

/** Source atlas geometry, shared by frame registration, previews and tile grafts. */
export function bundledChipsetTileSize(key: string): number {
  if (key === "tex_slates_32") return 32;
  if (key === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILE_SIZE;
  if (key === CASTLE_REFERENCE_TILESET_TEXTURE_KEY) return CASTLE_REFERENCE_TILE_SIZE;
  if (key === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_TILE_SIZE;
  if (key === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_16_TILE_SIZE;
  return RESOURCE_SLICING.chipset.cellWidth;
}

export function bundledChipsetTilesPerRow(key: string): number {
  if (key === "tex_forest_harmony_grass_joins") return 10;
  if (key === "tex_shared_forest_village_objects") return 6;
  if (key === "tex_slates_32") return 56;
  if (key === "tex_beodeul_city") return beodeulCitySheet.tilesPerRow;
  if (key === "tex_joseon_baram") return joseonBaramSheet.tilesPerRow;
  if (key === "tex_modern_city") return modernCitySheet.tilesPerRow;
  if (key === "tex_jp_city") return jpCitySheet.tilesPerRow;
  if (key === "tex_atlas_biome_interior") return atlasBiomeInteriorSheet.tilesPerRow;
  if (key === CASTLE_TILESET_TEXTURE_KEY) return CASTLE_TILES_PER_ROW;
  if (key === CASTLE_REFERENCE_TILESET_TEXTURE_KEY) return CASTLE_REFERENCE_TILES_PER_ROW;
  if (key === LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_TILES_PER_ROW;
  if (key === LPC_WOODEN_FURNITURE_16_TEXTURE_KEY) return LPC_WOODEN_FURNITURE_16_TILES_PER_ROW;
  return RESOURCE_SLICING.chipset.columns;
}
