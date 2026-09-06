import type { TilesetDef } from "@/project/types";
import { DEFAULT_TILESET_TEXTURE_KEY, LEGACY_RM_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { DUNGEON_TEXTURE_KEY, INTERIOR_TEXTURE_KEY } from "@/project/tilesetHarness/themePacks";
import { isWorldTileset, isWorldAnimatedTile } from "@/project/defaults/worldCoastMapping";
import { animationStripForTile } from "@/project/defaults/chipsetAnimation";
export function isDefaultTilesetTexture(tileset: TilesetDef): boolean {
  return (
    tileset.image.type === "bundled" &&
    (tileset.image.id === DEFAULT_TILESET_TEXTURE_KEY || tileset.image.id === LEGACY_RM_TILESET_TEXTURE_KEY)
  );
}

export function supportsChipsetQuarterComposition(tileset: TilesetDef): boolean {
  return isWorldTileset(tileset) || isDefaultTilesetTexture(tileset)
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY)
    || (tileset.image.type === "bundled" && tileset.image.id === DUNGEON_TEXTURE_KEY);
}

/** Interior fire and ungrafted World strips animate without enabling town road/tree rules. */
export function supportsChipsetTileAnimation(tileset: TilesetDef, tile: number): boolean {
  return isDefaultTilesetTexture(tileset)
    || (isWorldTileset(tileset) && isWorldAnimatedTile(tile, tileset))
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY
      && animationStripForTile(tile)?.baseTile === 124);
}
