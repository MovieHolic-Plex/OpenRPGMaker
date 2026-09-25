import saved from "@/assets/sharedRpgInteriorReferences.json";
import type { TilesetDef } from "../types";
import { referenceRevision, type TilesetReferenceCategory } from "../tilesetReferences";
import previousReferences from "../../../tiledata/rpg-interiors/previous-reference.json";

// RPG interiors (tiledata/rpg-interiors): purpose categories on the Tibo interior sheet, one on the ship sheet and the
// sewer prison on the dungeon sheet.
const SHIPPED = saved as unknown as readonly { tilesetId: string; category: TilesetReferenceCategory }[];
const TEXTURE_BY_TILESET: Readonly<Record<string, string>> = {
  tibo_interior_expanded: "tex_tibo_interior_expanded",
  easyrpg_chipset_ship: "tex_easyrpg_chipset_ship",
  easyrpg_chipset_dungeon: "tex_easyrpg_chipset_dungeon",
};

/** Add each shipped category once to the bundled tileset copy and retire unedited older revisions; authored or
 * shared-from categories are left alone. */
export function ensureRpgInteriorReferences(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== TEXTURE_BY_TILESET[tileset.id] || tileset.referenceSourceTilesetId) return false;
  // Retire exact shipped revisions only; keep any locally edited guidance.
  const kept = (tileset.referenceDocuments ?? []).filter(c => {
    const previous = previousReferences.find(p => p.id === c.id);
    return !previous || previous.revision !== referenceRevision(c);
  });
  let changed = kept.length !== (tileset.referenceDocuments ?? []).length;
  if (changed) tileset.referenceDocuments = kept;
  for (const { tilesetId, category } of SHIPPED) {
    if (tilesetId !== tileset.id || (tileset.referenceDocuments ?? []).some(c => c.id === category.id)) continue;
    tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), structuredClone(category)];
    changed = true;
  }
  return changed;
}
