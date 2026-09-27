import savedForest from "@/assets/forestHarmonyTileset.json";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { FOREST_HARMONY_ID, FOREST_HARMONY_TEXTURE } from "@/project/defaults/forestHarmony";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import type { GameMap, TilesetDef } from "@/project/types";

/** 숲마을 시트에 남아 있는 옛 정지 호수 오토타일(1517~1563). 새로 칠하지 않고, 이미 저장된 맵의 물 판정에만 쓴다. */
export const FOREST_STATIC_LAKE_GROUP = "forest_harmony_lake_47";

/**
 * 숲마을·기후 시트에서 새로 칠할 물 칸. 합본 마을과 같은 0번 물 — 렌더가 이웃을 보고 물가 쿼터를 합성하고
 * 3프레임으로 움직인다(tilesetImage.COMBINED_TOWN_WATER_BLOCK_TEXTURES, lakeAutotile).
 * 1517~1563 호수는 프레임이 한 장뿐이라 편집기·게임 모두에서 멈춰 있었다(2026-09-27 사용자 보고).
 */
export const VILLAGE_ANIMATED_WATER_TILE = LAKE_AUTOTILE_TILE.OUTER_CORNER;

/** Map-only road helpers use the bundled definition; callers with a project pass
 * its actual tileset so authored shoreline edits remain authoritative. */
export function villageWaterPredicate(map: GameMap, tileset?: TilesetDef): (tile: number) => boolean {
  const definition = tileset ?? (map.tilesetId === FOREST_HARMONY_ID ? savedForest : undefined);
  if (definition?.image.type !== "bundled" || definition.image.id !== FOREST_HARMONY_TEXTURE) return isWaterChipsetTile;
  // 새 물(0~212 애니메이션)과 이미 저장된 옛 정지 호수(1517~1563) 둘 다 물이다.
  const legacy = new Set(definition.autotileGroups?.find(group => group.id === FOREST_STATIC_LAKE_GROUP)?.memberTileIds ?? []);
  return tile => isWaterChipsetTile(tile) || legacy.has(tile);
}
