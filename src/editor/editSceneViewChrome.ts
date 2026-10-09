// 도구·레이어·선택 타일이 바뀔 때 타일 GameObject 를 부수지 않고 색·오버레이만 맞춘다.
// 전체 renderEditScene 은 맵 내용이나 빈 칸 체커 알파(배경 미리보기)가 바뀔 때만 돈다.

import type Phaser from "phaser";
import type { Layer } from "@/editor/editorState";
import type { EditSceneTileIndex } from "@/editor/editSceneRender";
import { mapTileSize } from "@/project/tileGeometry";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

const LAYER_DIM_TINT = 0xc8d9bf;
const CHECKER_DARK = 0x15171c;
const CHECKER_LIGHT = 0x1a1d23;
const DEFAULT_GRID_COLOR = 0xffffff;
const DEFAULT_GRID_ALPHA = 0.08;
const EVENT_GRID_COLOR = 0x000000;
// 0.45 는 칸마다 검은 테를 둘러 타일이 어둡게 죽었다(2026-09-24 visual QA). 칸 경계만 읽히면 된다.
const EVENT_GRID_ALPHA = 0.22;

type AlphaObject = {
  setAlpha(alpha: number): unknown;
};

type TintObject = {
  setTint(tint: number): unknown;
  clearTint?(): unknown;
  isTinted?: boolean;
};

export function applyEditTileLayerPresentation(tileIndex: EditSceneTileIndex, activeLayer: Layer): void {
  const neutral = isMapOnlyCaptureMode();
  for (const [key, objects] of tileIndex) {
    const lower = key.startsWith("lower:");
    for (const object of objects) {
      if (isEmptyChecker(object)) continue;
      if (lower) {
        const alpha = neutral ? 1 : activeLayer === "upper" ? 0.58 : activeLayer === "event" ? 0.62 : 1;
        setAlphaIfPossible(object, alpha);
        if (!neutral && activeLayer === "upper") tintIfPossible(object, LAYER_DIM_TINT);
        else clearTintIfPossible(object);
      } else {
        setAlphaIfPossible(object, 1);
        if (!neutral && activeLayer === "lower") tintIfPossible(object, LAYER_DIM_TINT);
        else clearTintIfPossible(object);
      }
    }
  }
}

/** 격자를 그릴 칸 범위(양 끝 포함). 없으면 맵 전체. */
export type EditGridTileWindow = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

/**
 * 격자는 `bounds` 칸 범위 안에서만 긋는다. 맵 전체 선을 한 Graphics 에 담으면 WebGL 이 매 렌더마다
 * 선 수만큼 사각형을 다시 쌓는다(100×100 맵에서 202개 × 전체 길이). 창은 카메라가 청크 경계를
 * 넘을 때 EditScene.update 가 다시 준다.
 */
export function repaintEditGrid(
  gridGraphics: Phaser.GameObjects.Graphics,
  map: GameMap,
  activeLayer: Layer,
  showGrid: boolean,
  bounds?: EditGridTileWindow,
): void {
  gridGraphics.clear();
  if (!showGrid) return;
  const color = activeLayer === "event" ? EVENT_GRID_COLOR : DEFAULT_GRID_COLOR;
  const alpha = activeLayer === "event" ? EVENT_GRID_ALPHA : DEFAULT_GRID_ALPHA;
  const tileSize = mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]);
  const minX = bounds ? Math.max(0, bounds.minX) : 0;
  const minY = bounds ? Math.max(0, bounds.minY) : 0;
  const maxX = bounds ? Math.min(map.width, bounds.maxX + 1) : map.width;
  const maxY = bounds ? Math.min(map.height, bounds.maxY + 1) : map.height;
  if (maxX < minX || maxY < minY) return;
  gridGraphics.lineStyle(1, color, alpha);
  for (let x = minX; x <= maxX; x += 1) {
    gridGraphics.moveTo(x * tileSize, minY * tileSize);
    gridGraphics.lineTo(x * tileSize, maxY * tileSize);
  }
  for (let y = minY; y <= maxY; y += 1) {
    gridGraphics.moveTo(minX * tileSize, y * tileSize);
    gridGraphics.lineTo(maxX * tileSize, y * tileSize);
  }
  gridGraphics.strokePath();
}

function isEmptyChecker(object: object): boolean {
  if (!("fillColor" in object)) return false;
  const fill = object.fillColor;
  return fill === CHECKER_DARK || fill === CHECKER_LIGHT;
}

function setAlphaIfPossible(object: object, alpha: number): void {
  if (!isAlphaObject(object)) return;
  object.setAlpha(alpha);
}

function tintIfPossible(object: object, tint: number): void {
  if (!isTintObject(object)) return;
  object.setTint(tint);
}

function clearTintIfPossible(object: object): void {
  if (!isTintObject(object) || typeof object.clearTint !== "function") return;
  if (object.isTinted === false) return;
  object.clearTint();
}

function isAlphaObject(object: object): object is AlphaObject {
  return "setAlpha" in object && typeof object.setAlpha === "function";
}

function isTintObject(object: object): object is TintObject {
  return "setTint" in object && typeof object.setTint === "function";
}

function isMapOnlyCaptureMode(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") return false;
  return new URLSearchParams(window.location.search).get("mapOnlyCapture") === "1";
}
