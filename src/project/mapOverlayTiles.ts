import type { GameMap } from "@/project/types";

const EMPTY_TILE_STACK: readonly number[] = [];

export type TileStackLayer = "lower" | "upper";

export function tileStackAt(map: GameMap, layer: TileStackLayer, index: number): readonly number[] {
  return stackStore(map, layer)?.[index] ?? EMPTY_TILE_STACK;
}

export function topTileInStack(map: GameMap, layer: TileStackLayer, index: number): number | undefined {
  const stack = stackStore(map, layer)?.[index];
  if (!stack || stack.length === 0) return undefined;
  return stack[stack.length - 1];
}

export function appendTileToStack(map: GameMap, layer: TileStackLayer, index: number, tile: number): void {
  if (!isValidCellIndex(map, index) || tile < 0) return;
  const stacks = ensureStackStore(map, layer);
  const stack = stacks[index] ?? [];
  stack.push(tile);
  stacks[index] = stack;
}

export function popTileFromStack(map: GameMap, layer: TileStackLayer, index: number): number | undefined {
  if (!isValidCellIndex(map, index)) return undefined;
  const stacks = stackStore(map, layer);
  const stack = stacks?.[index];
  if (!stacks || !stack || stack.length === 0) return undefined;
  const tile = stack.pop();
  if (stack.length === 0) {
    delete stacks[index];
    clearStackStoreIfEmpty(map, layer);
  }
  return tile;
}

export function replaceTileStack(map: GameMap, layer: TileStackLayer, index: number, stack: readonly number[]): void {
  if (!isValidCellIndex(map, index)) return;
  if (stack.length === 0) {
    const stacks = stackStore(map, layer);
    if (!stacks) return;
    delete stacks[index];
    clearStackStoreIfEmpty(map, layer);
    return;
  }
  ensureStackStore(map, layer)[index] = [...stack];
}

export function resizedTileStacks(
  tileStacks: Record<number, number[]> | undefined,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): Record<number, number[]> | undefined {
  if (!tileStacks) return undefined;
  const next: Record<number, number[]> = {};
  for (const [key, stack] of Object.entries(tileStacks)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) continue;
    const x = index % oldWidth;
    const y = Math.floor(index / oldWidth);
    if (x >= oldWidth || y >= oldHeight || x >= newWidth || y >= newHeight) continue;
    if (stack.length === 0) continue;
    next[y * newWidth + x] = [...stack];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function isValidCellIndex(map: GameMap, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < map.width * map.height;
}

function ensureStackStore(map: GameMap, layer: TileStackLayer): Record<number, number[]> {
  if (layer === "lower") {
    map.lowerTileStacks ??= {};
    return map.lowerTileStacks;
  }
  map.upperTileStacks ??= {};
  return map.upperTileStacks;
}

function stackStore(map: GameMap, layer: TileStackLayer): Record<number, number[]> | undefined {
  return layer === "lower" ? map.lowerTileStacks : map.upperTileStacks;
}

function clearStackStoreIfEmpty(map: GameMap, layer: TileStackLayer): void {
  const stacks = stackStore(map, layer);
  if (stacks && Object.keys(stacks).length > 0) return;
  if (layer === "lower") delete map.lowerTileStacks;
  else delete map.upperTileStacks;
}
