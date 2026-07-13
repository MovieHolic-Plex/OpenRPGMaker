import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { editorState, type Layer } from "@/editor/editorState";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { renderEventMarkers } from "@/editor/editSceneEventMarkers";
import { tilePassability } from "@/project/collision";
import { tileStackAt, topTileInStack } from "@/project/mapOverlayTiles";
import { store, type ProjectChangeCell } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";
export { editorEventMarkerTexture, eventMarkerTileScale, renderEventLayerClickFeedback } from "@/editor/editSceneEventMarkers";

const DEFAULT_GRID_COLOR = 0xffffff;
const DEFAULT_GRID_ALPHA = 0.08;
const EVENT_GRID_COLOR = 0x000000;
const EVENT_GRID_ALPHA = 0.45;

type CameraFocus = {
  readonly x: number;
  readonly y: number;
};

type TintableGameObject = {
  readonly setTint: (tint: number) => unknown;
};

type RenderableTileCell = ProjectChangeCell & { readonly layer: "lower" | "upper" };

export interface EditSceneRenderContext {
  readonly scene: Phaser.Scene;
  readonly tileLayer: Phaser.GameObjects.Container;
  readonly overlayLayer: Phaser.GameObjects.Container;
  readonly gridGraphics: Phaser.GameObjects.Graphics;
  readonly mapId: MapId;
  readonly tileIndex?: EditSceneTileIndex;
  readonly resetCamera?: boolean;
}

export type EditSceneTileIndex = Map<string, Phaser.GameObjects.GameObject[]>;

export type EditSceneRenderStats = {
  readonly tileObjectsUpdated: number;
};

export function renderEditScene(context: EditSceneRenderContext): EditSceneRenderStats {
  const map = store.getCurrent().maps[context.mapId];
  if (!map) return { tileObjectsUpdated: 0 };
  const mapOnlyCapture = isMapOnlyCaptureMode();
  const state = editorState.get();

  context.tileLayer.removeAll(true);
  context.tileIndex?.clear();
  context.overlayLayer.removeAll(true);
  context.gridGraphics.clear();

  if (context.resetCamera) applyCameraView(context.scene, map);
  const tileObjectsUpdated = renderTiles(context, map, mapOnlyCapture);
  if (mapOnlyCapture) return { tileObjectsUpdated };
  if (state.tool === "collision") renderCollisionOverlay(context, map);
  if (state.showGrid) renderGrid(context.gridGraphics, map, state.layer);
  renderStartPosition(context);
  renderEventMarkers(context, map, state.layer);
  renderSelection(context);
  return { tileObjectsUpdated };
}

export function renderEditSceneTileCells(
  context: EditSceneRenderContext & { readonly tileIndex: EditSceneTileIndex },
  cells: readonly ProjectChangeCell[]
): EditSceneRenderStats {
  const map = store.getCurrent().maps[context.mapId];
  if (!map) return { tileObjectsUpdated: 0 };
  const mapOnlyCapture = isMapOnlyCaptureMode();
  const activeLayer = mapOnlyCapture ? "event" : editorState.get().layer;
  const uniqueCells = uniqueRenderableTileCells(cells);
  let tileObjectsUpdated = 0;
  for (const cell of uniqueCells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) continue;
    const key = tileIndexKey(cell.layer, cell.x, cell.y);
    const previous = context.tileIndex.get(key) ?? [];
    for (const object of previous) {
      context.tileLayer.remove(object, true);
    }
    const next = renderTileCellLayer(context, map, activeLayer, cell.layer, cell.x, cell.y);
    if (next.length) context.tileIndex.set(key, next);
    else context.tileIndex.delete(key);
    tileObjectsUpdated += next.length;
  }
  return { tileObjectsUpdated };
}

function renderTiles(context: EditSceneRenderContext, map: GameMap, mapOnlyCapture: boolean): number {
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return 0;
  const activeLayer = mapOnlyCapture ? "event" : editorState.get().layer;
  let tileObjectsUpdated = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      tileObjectsUpdated += renderTileCellLayer(context, map, activeLayer, "lower", x, y).length;
    }
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      tileObjectsUpdated += renderTileCellLayer(context, map, activeLayer, "upper", x, y).length;
    }
  }
  return tileObjectsUpdated;
}

function renderTileCellLayer(
  context: EditSceneRenderContext,
  map: GameMap,
  activeLayer: Layer,
  layer: "lower" | "upper",
  x: number,
  y: number
): Phaser.GameObjects.GameObject[] {
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return [];
  const objects: Phaser.GameObjects.GameObject[] = [];
  const i = y * map.width + x;
  if (layer === "lower") {
    const lowerAlpha = activeLayer === "upper" ? 0.58 : 1;
    const lower = map.lowerTiles[i];
    if (lower >= 0) {
      const lowerTile = createChipsetTileObject(context.scene, map, tileset, x, y, lower);
      lowerTile.setAlpha(lowerAlpha);
      addTileObject(context, objects, lowerTile, 0);
    } else {
      addTileObject(context, objects, createEmptyTile(context.scene, x, y), 0);
    }
    for (const stackedLower of tileStackAt(map, "lower", i)) {
      const lowerTile = createChipsetTileObject(context.scene, map, tileset, x, y, stackedLower);
      lowerTile.setAlpha(lowerAlpha);
      addTileObject(context, objects, lowerTile, 1);
    }
  } else {
    const dimUpper = activeLayer === "lower";
    const upper = map.upperTiles[i];
    if (upper >= 0) {
      const upperTile = createChipsetTileObject(context.scene, map, tileset, x, y, upper);
      if (dimUpper) tintIfPossible(upperTile, 0xc8d9bf);
      // depth 2 was too close to lower(0); keep upper clearly above lower stacks for canopy preview
      addTileObject(context, objects, upperTile, 20);
    }
    for (const stackedUpper of tileStackAt(map, "upper", i)) {
      const upperTile = createChipsetTileObject(context.scene, map, tileset, x, y, stackedUpper);
      if (dimUpper) tintIfPossible(upperTile, 0xc8d9bf);
      addTileObject(context, objects, upperTile, 21);
    }
  }
  context.tileIndex?.set(tileIndexKey(layer, x, y), objects);
  return objects;
}

function addTileObject(
  context: EditSceneRenderContext,
  objects: Phaser.GameObjects.GameObject[],
  object: Phaser.GameObjects.GameObject,
  depth: number
): void {
  if ("setDepth" in object && typeof object.setDepth === "function") object.setDepth(depth);
  context.tileLayer.add(object);
  objects.push(object);
}

function uniqueRenderableTileCells(cells: readonly ProjectChangeCell[]): readonly RenderableTileCell[] {
  const unique = new Map<string, RenderableTileCell>();
  const add = (layer: "lower" | "upper", x: number, y: number) => {
    unique.set(tileIndexKey(layer, x, y), { x, y, layer });
  };
  for (const cell of cells) {
    if (cell.layer === "event") continue;
    add(cell.layer, cell.x, cell.y);
    // 하위 타일의 쿼터 합성(벽 프레임 랩·지형 9-슬라이스·호수 기슭·길)은 이웃 의존 —
    // 칠한 셀만 다시 그리면 이웃 셀에 낡은 프레임 조각이 남는다. 8방 이웃도 함께 재렌더.
    if (cell.layer === "lower") {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx !== 0 || dy !== 0) add("lower", cell.x + dx, cell.y + dy);
        }
      }
    }
  }
  return [...unique.values()];
}

function tileIndexKey(layer: "lower" | "upper", x: number, y: number): string {
  return `${layer}:${x},${y}`;
}

function tintIfPossible(object: Phaser.GameObjects.GameObject, tint: number): void {
  if (!isTintable(object)) return;
  object.setTint(tint);
}

function isTintable(object: Phaser.GameObjects.GameObject): object is Phaser.GameObjects.GameObject & TintableGameObject {
  return "setTint" in object && typeof object.setTint === "function";
}

function createEmptyTile(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(
    x * TILE_SIZE,
    y * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    (x + y) % 2 === 0 ? 0x15171c : 0x1a1d23
  );
  r.setOrigin(0, 0);
  return r;
}

function renderCollisionOverlay(context: EditSceneRenderContext, map: GameMap): void {
  const project = store.getCurrent();
  const tileset = project.tilesets[map.tilesetId];
  const collG = context.scene.add.graphics();
  collG.fillStyle(0xff4444, 0.35);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const lower = topTileInStack(map, "lower", i) ?? map.lowerTiles[i];
      const upper = topTileInStack(map, "upper", i) ?? map.upperTiles[i];
      if (!tileset) continue;
      const pass = tilePassability(tileset, lower, upper);
      if (!pass.up && !pass.down && !pass.left && !pass.right) {
        collG.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  context.overlayLayer.add(collG);
}

function renderGrid(gridGraphics: Phaser.GameObjects.Graphics, map: GameMap, activeLayer: Layer): void {
  const color = activeLayer === "event" ? EVENT_GRID_COLOR : DEFAULT_GRID_COLOR;
  const alpha = activeLayer === "event" ? EVENT_GRID_ALPHA : DEFAULT_GRID_ALPHA;
  gridGraphics.lineStyle(1, color, alpha);
  for (let x = 0; x <= map.width; x++) {
    gridGraphics.moveTo(x * TILE_SIZE, 0);
    gridGraphics.lineTo(x * TILE_SIZE, map.height * TILE_SIZE);
  }
  for (let y = 0; y <= map.height; y++) {
    gridGraphics.moveTo(0, y * TILE_SIZE);
    gridGraphics.lineTo(map.width * TILE_SIZE, y * TILE_SIZE);
  }
  gridGraphics.strokePath();
}

function renderStartPosition(context: EditSceneRenderContext): void {
  const project = store.getCurrent();
  if (project.startMapId !== context.mapId) return;
  const s = context.scene.add.rectangle(
    project.startPos.x * TILE_SIZE + TILE_SIZE / 2,
    project.startPos.y * TILE_SIZE + TILE_SIZE / 2,
    TILE_SIZE - 6,
    TILE_SIZE - 6,
    0x69db7c,
    0.5
  );
  s.setStrokeStyle(2, 0x69db7c);
  context.overlayLayer.add(s);
}

function renderSelection(context: EditSceneRenderContext): void {
  const selection = editorState.get().selection;
  if (!selection || selection.mapId !== context.mapId) return;
  const rect = context.scene.add.rectangle(
    selection.x * TILE_SIZE,
    selection.y * TILE_SIZE,
    selection.width * TILE_SIZE,
    selection.height * TILE_SIZE,
    0x3bc9db,
    0.12
  );
  rect.setOrigin(0, 0);
  rect.setStrokeStyle(2, 0x3bc9db, 0.9);
  context.overlayLayer.add(rect);
}

function applyCameraView(scene: Phaser.Scene, map: GameMap): void {
  const mapW = map.width * TILE_SIZE;
  const mapH = map.height * TILE_SIZE;
  const cam = scene.cameras.main;
  cam.setZoom(editorState.get().zoom);
  const paddingX = Math.max(TILE_SIZE * 8, cam.width / cam.zoom / 2);
  const paddingY = Math.max(TILE_SIZE * 8, cam.height / cam.zoom / 2);
  cam.setBounds(-paddingX, -paddingY, mapW + paddingX * 2, mapH + paddingY * 2);
  const focus = devCameraFocusTile(map);
  if (focus) {
    cam.centerOn((focus.x + 0.5) * TILE_SIZE, (focus.y + 0.5) * TILE_SIZE);
    return;
  }
  cam.centerOn(mapW / 2, mapH / 2);
}

function isMapOnlyCaptureMode(): boolean {
  if (typeof window === "undefined" || !isLocalDevHost(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("mapOnlyCapture") === "1";
}

function devCameraFocusTile(map: GameMap): CameraFocus | null {
  if (typeof window === "undefined" || !isLocalDevHost(window.location.hostname)) return null;
  const params = new URLSearchParams(window.location.search);
  const x = parseTileParam(params.get("focusX"), map.width);
  const y = parseTileParam(params.get("focusY"), map.height);
  if (x === null || y === null) return null;
  return { x, y };
}

function parseTileParam(value: string | null, limit: number): number | null {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= limit) return null;
  return parsed;
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
