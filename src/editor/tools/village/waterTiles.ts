import savedForest from "@/assets/forestHarmonyTileset.json";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { FOREST_HARMONY_ID, FOREST_HARMONY_TEXTURE } from "@/project/defaults/forestHarmony";
import type { GameMap, TilesetDef } from "@/project/types";

/** Map-only road helpers use the bundled definition; callers with a project pass
 * its actual tileset so authored shoreline edits remain authoritative. */
export function villageWaterPredicate(map: GameMap, tileset?: TilesetDef): (tile: number) => boolean {
  const definition = tileset ?? (map.tilesetId === FOREST_HARMONY_ID ? savedForest : undefined);
  if (definition?.image.type !== "bundled" || definition.image.id !== FOREST_HARMONY_TEXTURE) return isWaterChipsetTile;
  const members = new Set(definition.autotileGroups?.find(group => group.id === "forest_harmony_lake_47")?.memberTileIds ?? []);
  return tile => members.has(tile);
}
