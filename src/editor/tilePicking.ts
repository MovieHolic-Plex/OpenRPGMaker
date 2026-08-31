import { topTileInStack } from "@/project/mapOverlayTiles";
import { TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";

export type VisibleTilePick = {
  readonly layer: "lower" | "upper";
  readonly tile: number;
};

export function visibleTilePickAt(map: GameMap, index: number): VisibleTilePick | null {
  const upperTile = tileAtLayer(map, "upper", index);
  if (upperTile >= 0) return { layer: "upper", tile: upperTile };
  const lowerTile = tileAtLayer(map, "lower", index);
  if (lowerTile >= 0) return { layer: "lower", tile: lowerTile };
  return null;
}

/**
 * 현재 편집 레이어에서 집기. 덧그림의 빈 칸은 공백(`TILE.EMPTY`)을 유효한 붓으로 돌려
 * 이후 칠이 지우개처럼 동작하게 한다. 바닥의 빈 칸은 집지 않는다(체커 구멍을 붓으로 만들지 않음).
 */
export function layerTilePickAt(
  map: GameMap,
  index: number,
  layer: VisibleTilePick["layer"],
): VisibleTilePick | null {
  const tile = tileAtLayer(map, layer, index);
  if (layer === "upper") return { layer: "upper", tile: tile >= 0 ? tile : TILE.EMPTY };
  if (tile >= 0) return { layer: "lower", tile };
  return null;
}

function tileAtLayer(map: GameMap, layer: VisibleTilePick["layer"], index: number): number {
  const baseTile = layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index];
  return topTileInStack(map, layer, index) ?? baseTile ?? -1;
}
