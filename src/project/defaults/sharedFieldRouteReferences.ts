import saved from "@/assets/sharedFieldRouteReferences.json";
import type { TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

// Fields between villages (tiledata/field-routes): one category per bundled tileset the fields are drawn on —
// the forest village sheet and the four climate sheets.
const CATEGORY_BY_TILESET = saved as unknown as Record<string, TilesetReferenceCategory>;
const TEXTURE_BY_TILESET: Readonly<Record<string, string>> = {
  forest_harmony: "tex_forest_harmony",
  forest_harmony_snow: "tex_forest_harmony_snow",
  forest_harmony_volcano: "tex_forest_harmony_volcano",
  forest_harmony_desert: "tex_forest_harmony_desert",
  forest_harmony_autumn: "tex_forest_harmony_autumn",
};

/** Add the shipped category once to the bundled tileset copy; authored or shared-from categories are left alone. */
export function ensureFieldRouteReferences(tileset: TilesetDef): boolean {
  const category = CATEGORY_BY_TILESET[tileset.id];
  if (!category || tileset.image.type !== "bundled" || tileset.image.id !== TEXTURE_BY_TILESET[tileset.id]
    || tileset.referenceSourceTilesetId) return false;
  if ((tileset.referenceDocuments ?? []).some(c => c.id === category.id)) return false;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), structuredClone(category)];
  return true;
}
