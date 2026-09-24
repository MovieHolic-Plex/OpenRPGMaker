import saved from "@/assets/sharedRpgDungeonReferences.json";
import type { TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

// RPG dungeon places (tiledata/rpg-dungeons): three categories on the bundled dungeon sheet — every map is drawn
// on its numbering (the oprn_dungeon_* place tilesets are that sheet with grafts or repainted colours).
const CATEGORIES_BY_TILESET = saved as unknown as Record<string, readonly TilesetReferenceCategory[]>;
const TEXTURE_BY_TILESET: Readonly<Record<string, string>> = {
  easyrpg_chipset_dungeon: "tex_easyrpg_chipset_dungeon",
};

/** Add each shipped category once to the bundled tileset copy; authored or shared-from categories are left alone. */
export function ensureRpgDungeonReferences(tileset: TilesetDef): boolean {
  const categories = CATEGORIES_BY_TILESET[tileset.id];
  if (!categories || tileset.image.type !== "bundled" || tileset.image.id !== TEXTURE_BY_TILESET[tileset.id]
    || tileset.referenceSourceTilesetId) return false;
  const missing = categories.filter(category => !(tileset.referenceDocuments ?? []).some(c => c.id === category.id));
  if (!missing.length) return false;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...missing.map(category => structuredClone(category))];
  return true;
}
