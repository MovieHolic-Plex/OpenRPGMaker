import type { GameMap } from "@/project/types";

const EMPTY_TILE_STACK: readonly number[] = [];

export type TileStackLayer = "lower" | "upper";

export function tileStackAt(map: GameMap, layer: TileStackLayer, index: number): readonly number[] {
  clearTileStack(map, layer, index);
  return EMPTY_TILE_STACK;
}

export function topTileInStack(map: GameMap, layer: TileStackLayer, index: number): number | undefined {
  clearTileStack(map, layer, index);
  return undefined;
}

export function appendTileToStack(map: GameMap, layer: TileStackLayer, index: number, tile: number): void {
  if (!isValidCellIndex(map, index) || tile < 0) return;
  setLayerTile(map, layer, index, tile);
  clearTileStack(map, layer, index);
}

export function popTileFromStack(map: GameMap, layer: TileStackLayer, index: number): number | undefined {
  if (!isValidCellIndex(map, index)) return undefined;
  const stack = stackStore(map, layer)?.[index];
  clearTileStack(map, layer, index);
  return stack?.[stack.length - 1];
}

export function replaceTileStack(map: GameMap, layer: TileStackLayer, index: number, stack: readonly number[]): void {
  if (!isValidCellIndex(map, index)) return;
  if (stack.length > 0) {
    const tile = stack[stack.length - 1];
    if (tile !== undefined && tile >= 0) setLayerTile(map, layer, index, tile);
  }
  clearTileStack(map, layer, index);
}

export function clearTileStack(map: GameMap, layer: TileStackLayer, index: number): void {
  if (!isValidCellIndex(map, index)) return;
  const stacks = stackStore(map, layer);
  if (!stacks) return;
  delete stacks[index];
  clearStackStoreIfEmpty(map, layer);
}

export function resizedTileStacks(
  tileStacks: Record<number, number[]> | undefined,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): Record<number, number[]> | undefined {
  void tileStacks;
  void oldWidth;
  void oldHeight;
  void newWidth;
  void newHeight;
  return undefined;
}

function isValidCellIndex(map: GameMap, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < map.width * map.height;
}

function stackStore(map: GameMap, layer: TileStackLayer): Record<number, number[]> | undefined {
  return layer === "lower" ? map.lowerTileStacks : map.upperTileStacks;
}

function setLayerTile(map: GameMap, layer: TileStackLayer, index: number, tile: number): void {
  if (layer === "lower") map.lowerTiles[index] = tile;
  else map.upperTiles[index] = tile;
}

function clearStackStoreIfEmpty(map: GameMap, layer: TileStackLayer): void {
  const stacks = stackStore(map, layer);
  if (stacks && Object.keys(stacks).length > 0) return;
  if (layer === "lower") delete map.lowerTileStacks;
  else delete map.upperTileStacks;
}
