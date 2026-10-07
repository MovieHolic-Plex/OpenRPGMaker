import type { GameMap } from "@/project/types";
import { TILE } from "@/project/defaults/constants";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";

/**
 * 손댄 맵인가 — 이벤트가 있거나, 새 맵 바닥 채움 칸·빈 윗층이 아닌 칸이 하나라도 있으면 true.
 * (예전 authorVillageScope.isLivedMap 은 합본 마을 풀 칸 `TILE.GRASS` 로만 판정해 버들항 빈 맵도 「내용 있음」으로 봤다.
 * 마을 시공기와 함께 2026-10-07 옮겼다.)
 */
export function isLivedMap(map: GameMap): boolean {
  if (map.events.length > 0) return true;
  const fill = blankFillTileFor(map.tilesetId);
  for (let i = 0; i < map.lowerTiles.length; i += 1) {
    const tile = map.lowerTiles[i];
    if (tile !== fill && tile !== TILE.GRASS) return true;
  }
  for (let i = 0; i < map.upperTiles.length; i += 1) {
    if (map.upperTiles[i] !== TILE.EMPTY) return true;
  }
  return false;
}
