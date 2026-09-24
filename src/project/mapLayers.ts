import type { GameMap } from "@/project/types";

/**
 * 맵 칸의 층(MZ식 4층 + 그림자). 설계: docs/superpowers/specs/2026-09-24-mz-four-layer-design.md
 *
 * 1층 = lowerTiles, 2층 = lowerOverlayTiles, 3층 = upperTiles, 4층 = upperOverlayTiles.
 * 2·4층과 그림자는 선택 칸이라 옛 맵에는 없다 — 없으면 빈칸이다.
 * 층 번호와 칸 이름의 대응은 이 파일에만 둔다.
 *
 * 빈 선택 칸 정리(모든 칸이 -1/0 이면 키를 뺀다 — 옛 맵과 JSON 이 같아진다)는 **칸을 비울 수 있는 변형기 끝에서** 한다.
 * 저장 경로에서 따로 하지 않는다. 지금 그 자리는 다음이 전부다:
 * - `remapExtraLayers`/`cropExtraLayers` 가 스스로 정리 — 크기 바꾸기(actions.resizeMap, resize_map 도구,
 *   마을 넓히기), 밀기(mapShiftActions), 장소·프리셋 잘라내기, Pi 고스트 증분
 * - `compactMapLayers` 호출 — 붙여넣기·영역 지우기(editor/mapClipboard)
 * 새로 칸을 지우는 변형기(지우개·조수 도구 등)를 만들면 끝에서 `compactMapLayers` 를 부르고 이 목록에 더한다.
 * 크기를 바꾸거나 잘라내는 코드는 1층·3층을 새로 만들기 전에 반드시 `cropExtraLayers`/`remapExtraLayers` 를 부른다.
 */
export type TileLayerNo = 1 | 2 | 3 | 4;
export const TILE_LAYER_NOS: readonly TileLayerNo[] = [1, 2, 3, 4];
export type TileLayerGroup = "lower" | "upper";
export const EXTRA_LAYER_KEYS = ["lowerOverlayTiles", "upperOverlayTiles", "shadowBits"] as const;
type ExtraLayerKey = (typeof EXTRA_LAYER_KEYS)[number];
/** 선택 층만 가진 맵 모양. 옮기기 도우미는 이 셋만 읽고 쓴다. */
export type ExtraLayerFields = Pick<GameMap, ExtraLayerKey>;

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

/** 모두 빈 선택 칸을 지운다. 칸을 비울 수 있는 변형기 끝에서 부른다(위 머리말의 목록). */
export function compactMapLayers(map: GameMap): void {
  for (const key of EXTRA_LAYER_KEYS) {
    const values = map[key];
    if (values && isEmptyExtra(key, values)) delete map[key];
  }
}

/**
 * 길이가 칸 수(expected)와 다른 선택 칸 이름. 배열이 아닌 값은 여기서 세지 않는다(형식 오류는 검증기가 던진다).
 * 불러오기는 이 칸을 경고와 함께 버리고(`validateMaps`), 저장 쪽 검사(`projectLint` 왕복)는 오류로 보고한다.
 */
export function malformedExtraLayerKeys(map: Readonly<Record<string, unknown>>, expected: number): ExtraLayerKey[] {
  return EXTRA_LAYER_KEYS.filter((key) => {
    const value = map[key];
    return Array.isArray(value) && value.length !== expected;
  });
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
export function remapExtraLayers(map: ExtraLayerFields, width: number, height: number, sourceIndex: (targetIndex: number) => number): void {
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

/**
 * 원본 격자(sourceWidth×sourceHeight)의 (x,y) 부터 width×height 를 잘라 선택 칸을 옮긴다. 원본 밖은 빈칸.
 * 좌상단 기준 크기 바꾸기는 `cropExtraLayers(map, oldW, oldH, 0, 0, newW, newH)` 다.
 * 스프레드로 만든 사본에 불러도 원본 배열은 건드리지 않는다(새 배열을 붙이거나 칸을 지운다).
 */
export function cropExtraLayers(
  map: ExtraLayerFields,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  remapExtraLayers(map, width, height, (target) => {
    const sx = x + (target % width);
    const sy = y + Math.floor(target / width);
    return sx >= 0 && sy >= 0 && sx < sourceWidth && sy < sourceHeight ? sy * sourceWidth + sx : -1;
  });
}
