import { topTileInStack } from "@/project/mapOverlayTiles";
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

function tileAtLayer(map: GameMap, layer: VisibleTilePick["layer"], index: number): number {
  const baseTile = layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index];
  return topTileInStack(map, layer, index) ?? baseTile ?? -1;
}
