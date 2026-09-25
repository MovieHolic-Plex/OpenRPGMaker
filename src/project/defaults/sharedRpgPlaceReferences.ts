import saved from "@/assets/sharedRpgPlaceReferences.json";
import type { TilesetDef } from "../types";
import { referenceRevision, type TilesetReferenceCategory } from "../tilesetReferences";
import previousReferences from "../../../tiledata/rpg-places/previous-reference.json";

// Fantasy shop/castle/demon-castle places (tiledata/rpg-places): one category per bundled tileset the maps are drawn on.
const CATEGORY_BY_TILESET = saved as unknown as Record<string, TilesetReferenceCategory>;
const TEXTURE_BY_TILESET: Readonly<Record<string, string>> = {
  tibo_interior_expanded: "tex_tibo_interior_expanded",
  easyrpg_chipset_dungeon: "tex_easyrpg_chipset_dungeon",
  forest_harmony: "tex_forest_harmony",
};

/** Add the shipped category once to the bundled tileset copy and retire unedited older revisions; authored or
 * shared-from categories are left alone. */
export function ensureRpgPlaceReferences(tileset: TilesetDef): boolean {
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
