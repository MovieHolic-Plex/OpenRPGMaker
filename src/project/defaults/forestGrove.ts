import canopy from "@/assets/forestGroveCanopy.json";
import type { AutotileGroup, TilesetDef } from "../types";

export const FOREST_GROVE_GROUP = "forest_harmony_grove_47";

/** Append approved reference pixels through normal graft/export support. Never
 * replace old canopy slots, locked metadata, or a user's existing extension. */
export function ensureForestGroveTileset(tileset: TilesetDef): void {
  if (tileset.image.type !== "bundled" || tileset.image.id !== "tex_forest_harmony"
    || tileset.autotileGroups?.some(group => group.id === FOREST_GROVE_GROUP)) return;
  const lastGraft = Math.max(-1, ...(tileset.tileGrafts ?? []).map(graft => graft.targetTile));
  const start = Math.ceil(Math.max(tileset.count, lastGraft + 1) / tileset.tilesPerRow) * tileset.tilesPerRow;
  const members = canopy.sources.map((_, i) => start + i);
  const group: AutotileGroup = {
    id: FOREST_GROVE_GROUP, name: "굽이숲 · 이어진 수관", neighborhood: 8,
    memberTileIds: members, connectTileIds: members,
    variantMap: Object.fromEntries(canopy.variants.map((offset, mask) => [String(mask), start + offset])),
  };
  tileset.count = Math.ceil((start + members.length) / tileset.tilesPerRow) * tileset.tilesPerRow;
  tileset.tileMeta ??= [];
  for (let tile = start; tile < tileset.count; tile++) {
    tileset.terrain[tile] = 0;
    tileset.priority[tile] = "upper";
    tileset.passability[tile] = { up: false, down: false, left: false, right: false };
    tileset.tileMeta[tile] = { label: "굽이숲 수관", source: "user", passage: "solid",
      userLocked: true, defaultLayer: "upper", layerBacking: "none" };
  }
  tileset.tileGrafts = [...(tileset.tileGrafts ?? []), ...canopy.sources.map((sourceTile, i) => ({
    sourceChipset: canopy.sourceChipset, sourceTile, targetTile: start + i,
  }))];
  tileset.autotileGroups = [...(tileset.autotileGroups ?? []), group];
}
