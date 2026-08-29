import type { GameMap } from "@/project/types";

const EMPTY_TILE_STACK: readonly number[] = [];

export type TileStackLayer = "lower" | "upper";

/**
 * 스택은 폐기된 개념이라 언제나 빈 배열이다.
 *
 * 읽기 함수는 **맵을 건드리지 않는다**. 예전에는 여기서 clearTileStack 을 불러 delete +
 * Object.keys 로 map.lowerTileStacks / upperTileStacks 를 지웠다. 렌더 경로
 * (editSceneRender.ts:138, playSceneMapRuntime.ts:151) 가 store 의 살아 있는 맵을 그대로
 * 넘기므로, 화면을 한 번 그리는 것만으로 undo·자동저장 밖에서 저작 데이터가 사라졌다.
 * 정리는 쓰기 함수(appendTileToStack·replaceTileStack·popTileFromStack)와 명시적
 * clearTileStack 에만 남긴다.
 */
export function tileStackAt(map: GameMap, layer: TileStackLayer, index: number): readonly number[] {
  void map;
  void layer;
  void index;
  return EMPTY_TILE_STACK;
}

export function topTileInStack(map: GameMap, layer: TileStackLayer, index: number): number | undefined {
  void map;
  void layer;
  void index;
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
