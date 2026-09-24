import type { GameMap } from "@/project/types";

/**
 * 맵 칸의 층(MZ식 4층 + 그림자). 설계: docs/superpowers/specs/2026-09-24-mz-four-layer-design.md
 *
 * 1층 = lowerTiles, 2층 = lowerOverlayTiles, 3층 = upperTiles, 4층 = upperOverlayTiles.
 * 2·4층과 그림자는 선택 칸이라 옛 맵에는 없다 — 없으면 빈칸이다.
 * 층 번호와 칸 이름의 대응은 이 파일에만 둔다.
 */
export type TileLayerNo = 1 | 2 | 3 | 4;
export const TILE_LAYER_NOS: readonly TileLayerNo[] = [1, 2, 3, 4];
export type TileLayerGroup = "lower" | "upper";
export const EXTRA_LAYER_KEYS = ["lowerOverlayTiles", "upperOverlayTiles", "shadowBits"] as const;
type ExtraLayerKey = (typeof EXTRA_LAYER_KEYS)[number];

export function layerGroup(layer: TileLayerNo): TileLayerGroup {
  return layer <= 2 ? "lower" : "upper";
}

function overlayKey(layer: 2 | 4): "lowerOverlayTiles" | "upperOverlayTiles" {
  return layer === 2 ? "lowerOverlayTiles" : "upperOverlayTiles";
}

export function layerTileAt(map: GameMap, layer: TileLayerNo, index: number): number {
  if (layer === 1) return map.lowerTiles[index] ?? -1;
  if (layer === 3) return map.upperTiles[index] ?? -1;
  return map[overlayKey(layer)]?.[index] ?? -1;
}

export function setLayerTileAt(map: GameMap, layer: TileLayerNo, index: number, tile: number): void {
  if (index < 0 || index >= map.width * map.height) return;
  if (layer === 1) { map.lowerTiles[index] = tile; return; }
  if (layer === 3) { map.upperTiles[index] = tile; return; }
  const key = overlayKey(layer);
  const tiles = map[key];
  if (!tiles) {
    if (tile < 0) return;
    map[key] = new Array<number>(map.width * map.height).fill(-1);
  }
  map[key]![index] = tile < 0 ? -1 : tile;
}

export function shadowAt(map: GameMap, index: number): number {
  return map.shadowBits?.[index] ?? 0;
}

export function setShadowAt(map: GameMap, index: number, bits: number): void {
  if (index < 0 || index >= map.width * map.height) return;
  const value = bits & 0b1111;
  if (!map.shadowBits) {
    if (value === 0) return;
    map.shadowBits = new Array<number>(map.width * map.height).fill(0);
  }
  map.shadowBits[index] = value;
}

export function cellLayerTiles(map: GameMap, index: number): readonly [number, number, number, number] {
  return [layerTileAt(map, 1, index), layerTileAt(map, 2, index), layerTileAt(map, 3, index), layerTileAt(map, 4, index)];
}

export function hasExtraLayers(map: GameMap): boolean {
  return EXTRA_LAYER_KEYS.some((key) => map[key] !== undefined);
}

function isEmptyExtra(key: ExtraLayerKey, values: readonly number[]): boolean {
  const empty = key === "shadowBits" ? 0 : -1;
  return values.every((value) => value === empty);
}

/** 모두 빈 선택 칸을 지운다. 저장 전·크기 변경 뒤에 부른다. */
export function compactMapLayers(map: GameMap): void {
  for (const key of EXTRA_LAYER_KEYS) {
    const values = map[key];
    if (values && isEmptyExtra(key, values)) delete map[key];
  }
}

/** 선택 칸의 깊은 복사. 없는 칸은 결과에도 없다(스프레드로 붙이면 옛 맵 모양이 그대로다). */
export function cloneExtraLayers(map: GameMap): Pick<GameMap, ExtraLayerKey> {
  const out: Pick<GameMap, ExtraLayerKey> = {};
  for (const key of EXTRA_LAYER_KEYS) {
    const values = map[key];
    if (values) out[key] = values.slice();
  }
  return out;
}

/**
 * 크기 바꾸기·밀기용. 새 격자(width×height)의 각 칸에 원본 칸 번호(sourceIndex)를 받아 옮긴다.
 * sourceIndex 가 -1 이면 빈칸. 결과가 모두 비면 칸을 지운다. map.width/height 는 호출자가 바꾼다.
 */
export function remapExtraLayers(map: GameMap, width: number, height: number, sourceIndex: (targetIndex: number) => number): void {
  for (const key of EXTRA_LAYER_KEYS) {
    const source = map[key];
    if (!source) continue;
    const empty = key === "shadowBits" ? 0 : -1;
    const next = new Array<number>(width * height).fill(empty);
    for (let target = 0; target < next.length; target += 1) {
      const from = sourceIndex(target);
      if (from >= 0) next[target] = source[from] ?? empty;
    }
    if (isEmptyExtra(key, next)) delete map[key];
    else map[key] = next;
  }
}
