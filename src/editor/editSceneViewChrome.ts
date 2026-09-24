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

export function repaintEditGrid(
  gridGraphics: Phaser.GameObjects.Graphics,
  map: GameMap,
  activeLayer: Layer,
  showGrid: boolean,
): void {
  gridGraphics.clear();
  if (!showGrid) return;
  const color = activeLayer === "event" ? EVENT_GRID_COLOR : DEFAULT_GRID_COLOR;
  const alpha = activeLayer === "event" ? EVENT_GRID_ALPHA : DEFAULT_GRID_ALPHA;
  const tileSize = mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]);
  gridGraphics.lineStyle(1, color, alpha);
  for (let x = 0; x <= map.width; x += 1) {
    gridGraphics.moveTo(x * tileSize, 0);
    gridGraphics.lineTo(x * tileSize, map.height * tileSize);
  }
  for (let y = 0; y <= map.height; y += 1) {
    gridGraphics.moveTo(0, y * tileSize);
    gridGraphics.lineTo(map.width * tileSize, y * tileSize);
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
