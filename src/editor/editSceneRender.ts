import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { editorState, type Layer } from "@/editor/editorState";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { renderEventMarkers } from "@/editor/editSceneEventMarkers";
import { editorCameraBounds } from "@/editor/cameraFocusViewport";
import { planEditorCameraCenter, viewportCenterWorld } from "@/editor/cameraStability";
import { tilePassability } from "@/project/collision";
import { tileStackAt, topTileInStack } from "@/project/mapOverlayTiles";
import { store, type ProjectChangeCell } from "@/project/store";
import { renderWalkEncounterOverlay } from "@/editor/walkEncounterOverlay";
import { invalidateCullingWindow, resetCullableTiles, trackCullableTile } from "@/player/playSceneTileCulling";
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
  /**
   * 맵 배경 미리보기가 켜져 있는가. 켜져 있으면 빈 칸 체커를 옅게 그린다 — 배경이 뒤로 비치되
   * "여기 바닥이 없다" 는 신호는 남는다(체커를 통째로 지우는 건 금지된 결정이다).
   */
  readonly backgroundPreview?: boolean;
  /** 같은 맵에서 줌만 바뀐 경우 true. 맵 전환이면 넘기지 않아 한가운데로 둔다. */
  readonly preserveCameraLookAt?: boolean;
}

export type EditSceneTileIndex = Map<string, Phaser.GameObjects.GameObject[]>;

/**
 * Large maps should not pay the cost of creating every tile before the first frame.
 * The existing culling pass can hide objects, but it cannot undo their construction.
 * Keep the threshold below the common 128×128 render-contract fixture so the existing
 * small/editor capture behavior remains unchanged while 100×100 hosted maps use the lazy path.
 */
export const LAZY_EDIT_MAP_CELL_THRESHOLD = 8_192;

type EditSceneTileWindow = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export function shouldLazilyRenderEditMap(map: GameMap): boolean {
  return map.width * map.height > LAZY_EDIT_MAP_CELL_THRESHOLD;
}

function cameraTileWindow(scene: Phaser.Scene, map: GameMap): EditSceneTileWindow {
  const view = scene.cameras?.main?.worldView;
  if (!view || view.width <= 0 || view.height <= 0) {
    return { minX: 0, minY: 0, maxX: map.width - 1, maxY: map.height - 1 };
  }
  const margin = 2;
  const minX = Math.max(0, Math.floor(view.x / TILE_SIZE) - margin);
  const minY = Math.max(0, Math.floor(view.y / TILE_SIZE) - margin);
  const maxX = Math.min(map.width - 1, Math.floor((view.x + view.width) / TILE_SIZE) + margin);
  const maxY = Math.min(map.height - 1, Math.floor((view.y + view.height) / TILE_SIZE) + margin);
  return { minX, minY, maxX, maxY };
}

export function editSceneTileWindowKey(scene: Phaser.Scene, map: GameMap): string {
  const window = cameraTileWindow(scene, map);
  return `${window.minX},${window.minY},${window.maxX},${window.maxY}`;
}

export type EditSceneRenderStats = {
  readonly tileObjectsUpdated: number;
};

export function renderEditScene(context: EditSceneRenderContext): EditSceneRenderStats {
  const map = store.getCurrent().maps[context.mapId];
  if (!map) return { tileObjectsUpdated: 0 };
  const mapOnlyCapture = isMapOnlyCaptureMode();
  const state = editorState.get();

  // 전체 재렌더: 이전 타일 객체를 전부 파괴하므로 컬링 추적 목록도 비운다.
  // removeAll(true) 이후 새로 만드는 객체는 renderTileCellLayer 에서 다시 추적된다.
  resetCullableTiles(context.scene);
  context.tileLayer.removeAll(true);
  context.tileIndex?.clear();
  context.overlayLayer.removeAll(true);
  context.gridGraphics.clear();

  if (context.resetCamera) applyCameraView(context.scene, map, context.preserveCameraLookAt === true);
  const tileObjectsUpdated = renderTiles(context, map, mapOnlyCapture);
  if (mapOnlyCapture) return { tileObjectsUpdated };
  renderWalkEncounterOverlay(context.scene, context.overlayLayer, map);
  if (state.tool === "collision") renderCollisionOverlay(context, map);
  if (state.showGrid) renderGrid(context.gridGraphics, map, state.layer);
  renderStartPosition(context);
  renderEventMarkers(context, map, state.layer);
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
  // lower 재추가가 upper 위에 올라가지 않도록 항상 lower → upper 순으로 그린다.
  const uniqueCells = uniqueRenderableTileCells(cells)
    .slice()
    .sort((a, b) => (a.layer === b.layer ? 0 : a.layer === "lower" ? -1 : 1));
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
  // Container 자식 depth 정렬 — 증분 lower 재추가로 한 프레임 upper가 가려지는 깜빡임 방지.
  if ("sort" in context.tileLayer && typeof context.tileLayer.sort === "function") {
    context.tileLayer.sort("depth");
  }
  // 새 타일이 visible=true 로 만들어졌다. 카메라가 안 움직였으면 sameWindow early-out 으로
  // 컬링이 안 걸리므로, 적용 창을 무효화해 다음 update() 가 강제 재계산하게 한다.
  // 새 타일이 없으면 무효화할 필요가 없다 — 파괴된 타일은 active===false 가드가 처리한다.
  if (tileObjectsUpdated > 0) invalidateCullingWindow(context.scene);
  return { tileObjectsUpdated };
}

function renderTiles(context: EditSceneRenderContext, map: GameMap, mapOnlyCapture: boolean): number {
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return 0;
  const activeLayer = mapOnlyCapture ? "event" : editorState.get().layer;
  const window = mapOnlyCapture || !context.tileIndex || !shouldLazilyRenderEditMap(map)
    ? { minX: 0, minY: 0, maxX: map.width - 1, maxY: map.height - 1 }
    : cameraTileWindow(context.scene, map);
  let tileObjectsUpdated = 0;
  for (let y = window.minY; y <= window.maxY; y++) {
    for (let x = window.minX; x <= window.maxX; x++) {
      tileObjectsUpdated += renderTileCellLayer(context, map, activeLayer, "lower", x, y).length;
    }
  }
  for (let y = window.minY; y <= window.maxY; y++) {
    for (let x = window.minX; x <= window.maxX; x++) {
      tileObjectsUpdated += renderTileCellLayer(context, map, activeLayer, "upper", x, y).length;
    }
  }
  return tileObjectsUpdated;
}

/** Materialize the newly visible cells of a large map after the camera moves. */
export function renderVisibleEditSceneTiles(
  context: EditSceneRenderContext & { readonly tileIndex: EditSceneTileIndex },
): EditSceneRenderStats {
  const map = store.getCurrent().maps[context.mapId];
  if (!map || !shouldLazilyRenderEditMap(map)) return { tileObjectsUpdated: 0 };
  const window = cameraTileWindow(context.scene, map);
  let tileObjectsUpdated = 0;
  for (let y = window.minY; y <= window.maxY; y++) {
    for (let x = window.minX; x <= window.maxX; x++) {
      const lowerKey = tileIndexKey("lower", x, y);
      if (!context.tileIndex.has(lowerKey)) {
        tileObjectsUpdated += renderTileCellLayer(context, map, editorState.get().layer, "lower", x, y).length;
      }
      const upperKey = tileIndexKey("upper", x, y);
      if (!context.tileIndex.has(upperKey)) {
        tileObjectsUpdated += renderTileCellLayer(context, map, editorState.get().layer, "upper", x, y).length;
      }
    }
  }
  if (tileObjectsUpdated > 0 && "sort" in context.tileLayer && typeof context.tileLayer.sort === "function") {
    context.tileLayer.sort("depth");
  }
  return { tileObjectsUpdated };
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
      addTileObject(context, objects, lowerTile, 0, x, y);
    } else {
      addTileObject(context, objects, createEmptyTile(context.scene, x, y, context.backgroundPreview === true), 0, x, y);
    }
    for (const stackedLower of tileStackAt(map, "lower", i)) {
      const lowerTile = createChipsetTileObject(context.scene, map, tileset, x, y, stackedLower);
      lowerTile.setAlpha(lowerAlpha);
      addTileObject(context, objects, lowerTile, 1, x, y);
    }
  } else {
    const dimUpper = activeLayer === "lower";
    const upper = map.upperTiles[i];
    if (upper >= 0) {
      const upperTile = createChipsetTileObject(context.scene, map, tileset, x, y, upper);
      if (dimUpper) tintIfPossible(upperTile, 0xc8d9bf);
      // depth 2 was too close to lower(0); keep upper clearly above lower stacks for canopy preview
      addTileObject(context, objects, upperTile, 20, x, y);
    }
    for (const stackedUpper of tileStackAt(map, "upper", i)) {
      const upperTile = createChipsetTileObject(context.scene, map, tileset, x, y, stackedUpper);
      if (dimUpper) tintIfPossible(upperTile, 0xc8d9bf);
      addTileObject(context, objects, upperTile, 21, x, y);
    }
  }
  context.tileIndex?.set(tileIndexKey(layer, x, y), objects);
  return objects;
}

function addTileObject(
  context: EditSceneRenderContext,
  objects: Phaser.GameObjects.GameObject[],
  object: Phaser.GameObjects.GameObject,
  depth: number,
  x: number,
  y: number
): void {
  if ("setDepth" in object && typeof object.setDepth === "function") object.setDepth(depth);
  context.tileLayer.add(object);
  // 컬링 추적 — update() 의 syncTileCulling 이 화면 밖 타일의 visible 을 끈다.
  // setVisible 이 없는 객체(예: 테스트 mock)는 trackCullableTile 가 자동으로 건너뛴다.
  trackCullableTile(context.scene, object, x, y);
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
    // 같은 칸 upper도 반드시 재렌더: lower만 컨테이너 끝에 다시 add 되면 upper 위에 덮여
    // "상위 물건이 잠깐 사라졌다 다시 나타나는" 깜빡임이 난다.
    if (cell.layer === "lower") {
      add("upper", cell.x, cell.y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          add("lower", cell.x + dx, cell.y + dy);
          add("upper", cell.x + dx, cell.y + dy);
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

/** 빈 하위 칸의 체커. 미리보기 중에는 알파를 낮춰 뒤의 배경이 비치게 한다(신호는 유지). */
function createEmptyTile(scene: Phaser.Scene, x: number, y: number, translucent = false): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(
    x * TILE_SIZE,
    y * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    (x + y) % 2 === 0 ? 0x15171c : 0x1a1d23
  );
  if (translucent) r.setAlpha(0.35);
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

type SelectionRect = Phaser.GameObjects.Rectangle & {
  setPosition(x: number, y: number): SelectionRect;
  setSize(width: number, height: number): SelectionRect;
};

function isSelectionRect(value: unknown): value is SelectionRect {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SelectionRect>;
  return typeof candidate.setPosition === "function"
    && typeof candidate.setSize === "function"
    && typeof candidate.setOrigin === "function"
    && typeof candidate.setStrokeStyle === "function";
}

/**
 * 선택 사각형은 타일 레이어와 수명이 다르다. 우클릭 드래그 중 선택만 바뀌는데
 * 맵 타일을 전부 다시 만들면 Phaser 3.90 의 O(N²) 재부모화가 그대로 살아난다.
 * 전용 컨테이너에서 두 사각형만 옮기거나 다시 그린다.
 */
export function syncSelectionOverlay(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  mapId: MapId,
): void {
  const state = editorState.get();
  const selection = state.selection;
  if (!selection || selection.mapId !== mapId || state.pastePreview) {
    layer.removeAll(true);
    return;
  }
  const x = selection.x * TILE_SIZE;
  const y = selection.y * TILE_SIZE;
  const w = selection.width * TILE_SIZE;
  const h = selection.height * TILE_SIZE;
  const existing = layer.list ?? [];
  if (existing.length === 2 && isSelectionRect(existing[0]) && isSelectionRect(existing[1])) {
    existing[0].setPosition(x, y).setSize(w, h);
    existing[1].setPosition(x, y).setSize(w, h);
    return;
  }
  layer.removeAll(true);

  // 이중 테두리: 어두운 바깥 + 밝은 청록 안쪽. 단색 청록 하나였을 때는 물·하늘 타일 위에서
  // 경계가 배경에 묻혀 어디까지 골랐는지 보이지 않았다. 어느 지형 위에서도 한쪽은 대비를 낸다.
  // 마칭앤츠 애니메이션은 쓰지 않는다 — 이 편집기는 매 프레임 작업으로 렉을 겪은 이력이 있고,
  // 정적 이중선으로 목적(경계 판독)은 달성된다.
  const outline = scene.add.rectangle(x, y, w, h, 0x3bc9db, 0.12);
  outline.setOrigin(0, 0);
  outline.setStrokeStyle(4, 0x10333a, 0.75);
  layer.add(outline);

  const inner = scene.add.rectangle(x, y, w, h, 0x000000, 0);
  inner.setOrigin(0, 0);
  inner.setStrokeStyle(2, 0x7fe7f5, 1);
  layer.add(inner);
}

export function applyCameraView(scene: Phaser.Scene, map: GameMap, preserveLookAt: boolean): void {
  const mapW = map.width * TILE_SIZE;
  const mapH = map.height * TILE_SIZE;
  const cam = scene.cameras.main;
  const previousCenter = preserveLookAt ? readCameraLookAt(cam) : null;
  cam.setZoom(editorState.get().zoom);
  const canvas = { x: 0, y: 0, width: cam.width, height: cam.height };
  const bounds = editorCameraBounds({ mapWidth: mapW, mapHeight: mapH, canvas, unoccluded: canvas, zoom: cam.zoom });
  cam.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
  const focus = devCameraFocusTile(map);
  const center = planEditorCameraCenter({
    mapWidthPx: mapW,
    mapHeightPx: mapH,
    previousCenter,
    preserveLookAt,
    devFocusWorld: focus
      ? { x: (focus.x + 0.5) * TILE_SIZE, y: (focus.y + 0.5) * TILE_SIZE }
      : null,
  });
  cam.centerOn(center.x, center.y);
}

function readCameraLookAt(cam: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } | null {
  if (!Number.isFinite(cam.scrollX) || !Number.isFinite(cam.scrollY)) return null;
  if (!Number.isFinite(cam.width) || !Number.isFinite(cam.height) || cam.width <= 0 || cam.height <= 0) return null;
  return viewportCenterWorld({
    scrollX: cam.scrollX,
    scrollY: cam.scrollY,
    width: cam.width,
    height: cam.height,
    zoom: cam.zoom,
  });
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
