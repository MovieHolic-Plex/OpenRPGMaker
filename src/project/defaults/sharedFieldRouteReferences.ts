import saved from "@/assets/sharedFieldRouteReferences.json";
import type { TilesetDef } from "../types";
import { referenceRevision, type TilesetReferenceCategory } from "../tilesetReferences";
import previousReferences from "../../../tiledata/field-routes/previous-reference.json";

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

/** Add the shipped category once to the bundled tileset copy and retire unedited older revisions; authored or
 * shared-from categories are left alone. */
export function ensureFieldRouteReferences(tileset: TilesetDef): boolean {
  const category = CATEGORY_BY_TILESET[tileset.id];
  if (!category || tileset.image.type !== "bundled" || tileset.image.id !== TEXTURE_BY_TILESET[tileset.id]
    || tileset.referenceSourceTilesetId) return false;
  // Retire exact shipped revisions only; keep any locally edited guidance.
  const kept = (tileset.referenceDocuments ?? []).filter(c => {
    const previous = previousReferences.find(p => p.id === c.id);
    return !previous || previous.revision !== referenceRevision(c);
  });
  const retired = kept.length !== (tileset.referenceDocuments ?? []).length;
  if (retired) tileset.referenceDocuments = kept;
  if (kept.some(c => c.id === category.id)) return retired;
  tileset.referenceDocuments = [...kept, structuredClone(category)];
  return true;
}
