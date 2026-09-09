import { defaultTilesets } from "../defaults/defaultAssets";
import { interiorObjectById, type InteriorObjectDef } from "../defaults/interiorObjectCatalog";
import { INTERIOR_TILESET_ID } from "../mapCreateSpec";
import type { StructureKitDef, TilesetDef } from "../types";
import type { SpatialAssetContext, SpatialGraphic } from "./types";

// Derive the identity AND layout from the shipped declaration, not the caller's ID/name.
// Retain only the immutable atlas signature, not another tileset/catalog registry.
const bundledInteriorAtlas = (() => {
  const tileset = defaultTilesets()[INTERIOR_TILESET_ID];
  if (!tileset) throw new TypeError("Shipped interior atlas declaration is missing");
  return Object.freeze({
    image: Object.freeze({ ...tileset.image }), kind: tileset.kind,
    tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow, count: tileset.count,
  });
})();

export type ResolvedSpatialGraphic =
  | { readonly source: "authored"; readonly kit: StructureKitDef }
  | { readonly source: "builtin"; readonly object: InteriorObjectDef };

function eligibleInteriorAtlas(tileset: TilesetDef): boolean {
  return tileset.image.type === "bundled"
    && bundledInteriorAtlas.image.type === "bundled"
    && tileset.image.id === bundledInteriorAtlas.image.id
    && tileset.tileSize === bundledInteriorAtlas.tileSize
    && tileset.tilesPerRow === bundledInteriorAtlas.tilesPerRow
    && tileset.count === bundledInteriorAtlas.count
    && (tileset.kind === undefined || tileset.kind === bundledInteriorAtlas.kind)
    && (tileset.tileGrafts === undefined || tileset.tileGrafts.length === 0);
}

/** Live lookup only. An authored kit is authoritative even when a consumer cannot rasterize it.
 * Frozen compositions consume their owner-keyed snapshot cells instead of this resolver.
 */
export function resolveSpatialGraphic(
  assets: Pick<SpatialAssetContext, "tilesets">,
  graphic: SpatialGraphic,
): ResolvedSpatialGraphic | undefined {
  const tileset = Object.hasOwn(assets.tilesets, graphic.tilesetId) ? assets.tilesets[graphic.tilesetId] : undefined;
  if (!tileset) return undefined;
  const kit = tileset.structureKits?.find(entry => entry.id === graphic.kitId);
  if (kit) return { source: "authored", kit };
  if (!eligibleInteriorAtlas(tileset)) return undefined;
  const object = interiorObjectById(graphic.kitId);
  return object === undefined ? undefined : { source: "builtin", object };
}
