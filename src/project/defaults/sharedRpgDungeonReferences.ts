import saved from "@/assets/sharedRpgDungeonReferences.json";
import type { TilesetDef } from "../types";
import { referenceRevision, type TilesetReferenceCategory } from "../tilesetReferences";
import previousReferences from "../../../tiledata/rpg-dungeons/previous-reference.json";

// RPG dungeon places (tiledata/rpg-dungeons): three categories on the bundled dungeon sheet — every map is drawn
// on its numbering (the oprn_dungeon_* place tilesets are that sheet with grafts or repainted colours).
const CATEGORIES_BY_TILESET = saved as unknown as Record<string, readonly TilesetReferenceCategory[]>;
const TEXTURE_BY_TILESET: Readonly<Record<string, string>> = {
  easyrpg_chipset_dungeon: "tex_easyrpg_chipset_dungeon",
};

/** Add each shipped category once to the bundled tileset copy and retire unedited older revisions
 * (tiledata/rpg-dungeons/previous-reference.json); authored or shared-from categories are left alone. */
export function ensureRpgDungeonReferences(tileset: TilesetDef): boolean {
  const categories = CATEGORIES_BY_TILESET[tileset.id];
  if (!categories || tileset.image.type !== "bundled" || tileset.image.id !== TEXTURE_BY_TILESET[tileset.id]
    || tileset.referenceSourceTilesetId) return false;
  // Retire exact shipped revisions only; keep any locally edited guidance.
  const kept = (tileset.referenceDocuments ?? []).filter(c => {
    const previous = previousReferences.find(p => p.id === c.id);
    return !previous || previous.revision !== referenceRevision(c);
  });
  let changed = kept.length !== (tileset.referenceDocuments ?? []).length;
  if (changed) tileset.referenceDocuments = kept;
  const missing = categories.filter(category => !(tileset.referenceDocuments ?? []).some(c => c.id === category.id));
  if (missing.length) {
    tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...missing.map(category => structuredClone(category))];
    changed = true;
  }
  return changed;
}
