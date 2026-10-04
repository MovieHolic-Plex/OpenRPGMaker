import type Phaser from "phaser";
import { editorState, type Layer, type TileSelection } from "@/editor/editorState";
import { createChipsetTileObject, createRawChipsetTileObject } from "@/editor/chipsetTileRender";
import { renderEventMarkers } from "@/editor/editSceneEventMarkers";
import { editorCameraBounds } from "@/editor/cameraFocusViewport";
import { planEditorCameraCenter, viewportCenterWorld } from "@/editor/cameraStability";
import { cellPassability } from "@/project/collision";
import { layerTileAt, shadowAt } from "@/project/mapLayers";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { store, type ProjectChangeCell } from "@/project/store";
import { renderWalkEncounterOverlay } from "@/editor/walkEncounterOverlay";
import { repaintEditGrid } from "@/editor/editSceneViewChrome";
import { invalidateCullingWindow, resetCullableTiles, trackCullableTile, untrackCullableTile } from "@/player/playSceneTileCulling";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap, MapId } from "@/project/types";
import { reliefCellLiftPx } from "@/player/reliefStrips";
import { RELIEF_MAX_LEVEL } from "@/project/relief/types";
import { reliefPaintsCell } from "@/project/relief/screen";
import { prepareReliefRead, reliefGroundAvailable, reliefTilesetImage } from "./reliefGroundSurface";
import { tilesetTextureKey } from "./tilesetImage";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import { terrainReachability } from "@/project/terrainReachability";
import { renderTerrainDesignOverlay } from "./terrainDesignOverlay";
import type { TilesetDef } from "@/project/types";
export { editorEventMarkerTexture, eventMarkerTileScale, renderEventLayerClickFeedback } from "@/editor/editSceneEventMarkers";

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
  /**
   * 하위(바닥) 타일 컨테이너. 상위 컨테이너보다 **반드시 먼저** 화면 순서에 와야 한다 —
   * 두 컨테이너 분리가 전체 sort("depth") 없이 lower→upper 드로 순서를 보장하는 방법이다.
   */
  readonly tileLayer: Phaser.GameObjects.Container;
  /** 상위(덧그림) 타일 컨테이너. tileLayer 뒤에 붙는다. */
  readonly upperTileLayer: Phaser.GameObjects.Container;
  /**
   * 청크 컨테이너 저장소(large-map lazy 경로 전용). 있으면 하위·상위 타일 객체를
   * 16×16칸 청크 컨테이너 아래에 붙여 화면 밖 청크를 통째로 숨긴다.
   * 없으면(작은 맵·테스트) 기존처럼 레이어 컨테이너에 곧장 붙인다.
   */
  readonly tileChunks?: Map<string, Phaser.GameObjects.Container>;
  /**
   * 높이 지형 컨테이너(lower 와 upper 사이). 절벽 띠와 **들린 칸의 하층 타일**이 줄 depth 로 섞여 있고
   * 넣을 때마다 depth 로 정렬한다 — 남쪽 절벽이 북쪽 고지대 타일을 가리는 순서가 여기서 나온다.
   * 줄 Y 의 depth = Y × {@link EDIT_RELIEF_ROW_DEPTH} + 줄 안 순서(윗면 0 < 타일 1~3 < 벽 7 < 벽면 장식 8).
   */
  readonly reliefLayer?: Phaser.GameObjects.Container;
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
 * 큰 맵의 타일을 청크 컨테이너(16×16칸)로 묶는다. 프레임마다 Phaser가 컨테이너 자식을
 * 순회하므로(visibility·transform) 화면 밖 청크를 visible=false 로 두면 그 자식 전체가
 * 렌더 큐에서 빠진다 — 개별 타일 visible 컬링보다 한 단계 위의 절약이다.
 * 청크 컨테이너는 지연 맵(lazy) 경로에서만 쓴다 — 작은 맵은 컨테이너 오버헤드가 이득보다 크다.
 */
export const EDIT_TILE_CHUNK_TILES = 16;

/**
 * 청크 컨테이너 관리. tileLayer/upperTileLayer 의 자식은 청크 컨테이너가 된다.
 * lazy 경로에서만 활성화되고, 비-lazy 경로는 기존처럼 평평한 리스트를 유지한다.
 */
export type EditTileChunkHost = {
  readonly chunks: Map<string, Phaser.GameObjects.Container>;
};

function chunkKey(layer: "lower" | "upper", cx: number, cy: number): string {
  // Both layers share the registry, but must keep their own parent containers.
  return `${layer}:${cx},${cy}`;
}

/** 칸 좌표 → 청크 좌표. */
export function chunkCoord(tile: number): number {
  return Math.floor(tile / EDIT_TILE_CHUNK_TILES);
}

/** 큰 맵에서 청크 컨테이너를 얻거나 만든다. 자식 위치는 월드 좌표 그대로(청크는 0,0). */
function getOrCreateChunk(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  chunks: Map<string, Phaser.GameObjects.Container>,
  layer: "lower" | "upper",
  cx: number,
  cy: number,
): Phaser.GameObjects.Container {
  const key = chunkKey(layer, cx, cy);
  let chunk = chunks.get(key);
  if (!chunk) {
    chunk = scene.add.container(0, 0);
    parent.add(chunk);
    chunks.set(key, chunk);
  }
  return chunk;
}

/**
 * Large maps should not pay the cost of creating every tile before the first frame.
 * The existing culling pass can hide objects, but it cannot undo their construction.
 * 8_192 left every map up to 90×90 fully materialized (tens of thousands of objects for a
 * 64×64 town with stacks/shadows). 2_048 sends 46×46 and larger through the camera window;
 * when the window covers the whole map (zoomed out, or tests without a camera) the lazy
 * path still renders every cell, so small-map capture behavior is unchanged.
 */
export const LAZY_EDIT_MAP_CELL_THRESHOLD = 2_048;

type EditSceneTileWindow = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export function shouldLazilyRenderEditMap(map: GameMap): boolean {
  return map.width * map.height > LAZY_EDIT_MAP_CELL_THRESHOLD;
}

export function cameraTileWindow(scene: Phaser.Scene, map: GameMap): EditSceneTileWindow {
  const view = scene.cameras?.main?.worldView;
  if (!view || view.width <= 0 || view.height <= 0) {
    return { minX: 0, minY: 0, maxX: map.width - 1, maxY: map.height - 1 };
  }
  // 컬링 창은 **월드 픽셀을 칸으로 나누는** 계산이다 — 여기서 16 을 쓰면 32px 맵에서
  // 창이 두 배 넓게 잡혀 화면 밖 타일이 materialize 되거나(느림) 안쪽이 빈다(검은 칸).
  const tileSize = mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]);
  const margin = 2;
  const minX = Math.max(0, Math.floor(view.x / tileSize) - margin);
  const minY = Math.max(0, Math.floor(view.y / tileSize) - margin);
  const maxX = Math.min(map.width - 1, Math.floor((view.x + view.width) / tileSize) + margin);
  // Elevated cells are drawn north of their stored row. Materialize those source rows too.
  const maxY = Math.min(map.height - 1, Math.floor((view.y + view.height) / tileSize) + margin + (map.relief ? RELIEF_MAX_LEVEL : 0));
  return { minX, minY, maxX, maxY };
}

/** Candidate source cells before neighbour expansion/sort. Include old residents
 * so a reduced overhang can destroy tiles outside the new source window. */
export function residentReliefTileCells(scene: Phaser.Scene, map: GameMap, index: EditSceneTileIndex): { x: number; y: number }[] {
  const indices = new Set<number>();
  const window = cameraTileWindow(scene, map);
  for (let y = window.minY; y <= window.maxY; y++) for (let x = window.minX; x <= window.maxX; x++) indices.add(y * map.width + x);
  for (const key of index.keys()) {
    const cell = parseTileIndexKey(key);
    if (cell) indices.add(cell.y * map.width + cell.x);
  }
  return [...indices].map(i => ({ x: i % map.width, y: Math.floor(i / map.width) }));
}

export function editSceneTileWindowKey(scene: Phaser.Scene, map: GameMap): string {
  const window = cameraTileWindow(scene, map);
  return `${window.minX},${window.minY},${window.maxX},${window.maxY}`;
}

/**
 * 격자를 그을 칸 범위 — 카메라 창을 청크 경계로 넓히고 한 청크 여유를 더한다. 청크 단위로 잘라야
 * 팬하는 동안 칸 하나 넘을 때마다가 아니라 청크 하나 넘을 때만 격자를 다시 긋는다.
 */
export function editGridTileWindow(scene: Phaser.Scene, map: GameMap): EditSceneTileWindow {
  const window = cameraTileWindow(scene, map);
  const minX = Math.max(0, (chunkCoord(window.minX) - 1) * EDIT_TILE_CHUNK_TILES);
  const minY = Math.max(0, (chunkCoord(window.minY) - 1) * EDIT_TILE_CHUNK_TILES);
  const maxX = Math.min(map.width - 1, (chunkCoord(window.maxX) + 2) * EDIT_TILE_CHUNK_TILES - 1);
  const maxY = Math.min(map.height - 1, (chunkCoord(window.maxY) + 2) * EDIT_TILE_CHUNK_TILES - 1);
  return { minX, minY, maxX, maxY };
}

export type EditSceneRenderStats = {
  readonly tileObjectsUpdated: number;
};

export const EDIT_RELIEF_ROW_DEPTH = 10;
export const RELIEF_STRIP_NAME = "relief-strip";

export function renderEditScene(context: EditSceneRenderContext): EditSceneRenderStats {
  const map = store.getCurrent().maps[context.mapId];
  if (!map) return { tileObjectsUpdated: 0 };
  prepareReliefRead(map);
  const mapOnlyCapture = isMapOnlyCaptureMode();
  const state = editorState.get();

  // 전체 재렌더: 이전 타일 객체를 전부 파괴하므로 컬링 추적 목록도 비운다.
  // removeAll(true) 이후 새로 만드는 객체는 renderTileCellLayer 에서 다시 추적된다.
  resetCullableTiles(context.scene);
  context.tileLayer.removeAll(true);
  context.upperTileLayer.removeAll(true);
  // 절벽 띠(이름 RELIEF_STRIP_NAME)는 EditScene 이 relief 가 바뀔 때만 다시 만든다 — 타일만 버린다.
  for (const child of [...(context.reliefLayer?.list ?? [])]) if (child.name !== RELIEF_STRIP_NAME) context.reliefLayer?.remove(child, true);
  context.tileChunks?.clear();
  context.tileIndex?.clear();
  context.overlayLayer.removeAll(true);
  context.gridGraphics.clear();

  if (context.resetCamera) applyCameraView(context.scene, map, context.preserveCameraLookAt === true);
  const tileObjectsUpdated = renderTiles(context, map, mapOnlyCapture);
  if (map.relief) context.reliefLayer?.sort("depth");
  if (mapOnlyCapture) return { tileObjectsUpdated };
  renderWalkEncounterOverlay(context.scene, context.overlayLayer, map, mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]));
  if (state.tool === "collision") renderCollisionOverlay(context, map);
  if (state.terrainReachability) renderTerrainReachability(context, map);
  renderTerrainDesignOverlay(context.scene, context.overlayLayer, store.getCurrent(), map, state);
  if (state.showGrid) repaintEditGrid(context.gridGraphics, map, state.layer, true, editGridTileWindow(context.scene, map));
  renderStartPosition(context);
  renderEventMarkers({ ...context, tileSize: mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]) }, map, state.layer);
  return { tileObjectsUpdated };
}

/** 칸 갱신 뒤에 이벤트 마커만 다시 그린다. 타일 레이어는 건드리지 않는다. */
export function refreshEditSceneOverlay(context: EditSceneRenderContext): void {
  const map = store.getCurrent().maps[context.mapId];
  if (!map) return;
  const state = editorState.get();
  context.overlayLayer.removeAll(true);
  const tileSize = mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]);
  renderWalkEncounterOverlay(context.scene, context.overlayLayer, map, tileSize);
  if (state.tool === "collision") renderCollisionOverlay(context, map);
  if (state.terrainReachability) renderTerrainReachability(context, map);
  renderTerrainDesignOverlay(context.scene, context.overlayLayer, store.getCurrent(), map, state);
  renderStartPosition(context);
  renderEventMarkers({ ...context, tileSize }, map, state.layer);
}

export function renderEditSceneTileCells(
  context: EditSceneRenderContext & { readonly tileIndex: EditSceneTileIndex },
  cells: readonly ProjectChangeCell[]
): EditSceneRenderStats {
  const map = store.getCurrent().maps[context.mapId];
  if (!map) return { tileObjectsUpdated: 0 };
  prepareReliefRead(map);
  const mapOnlyCapture = isMapOnlyCaptureMode();
  const activeLayer = mapOnlyCapture ? "event" : editorState.get().layer;
  // lower 재추가가 upper 위에 올라가지 않도록 항상 lower → upper 순으로 그린다.
  // (컨테이너 분리 후에도 유지 — 같은 컨테이너 안 순서 보장은 아니지만 이웃 셀 간
  // 쿼터 합성 프레임이 낡은 조각 위에 그려지는 순서는 이 정렬이 읽기 쉽게 지켜준다.)
  const uniqueCells = uniqueRenderableTileCells(cells)
    .slice()
    .sort((a, b) => (a.layer === b.layer ? 0 : a.layer === "lower" ? -1 : 1));
  const lazyWindow = shouldLazilyRenderEditMap(map) ? cameraTileWindow(context.scene, map) : null;
  const limitToWindow = lazyWindow !== null && isPartialTileWindow(lazyWindow, map);
  let tileObjectsUpdated = 0;
  for (const cell of uniqueCells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) continue;
    const key = tileIndexKey(cell.layer, cell.x, cell.y);
    if (limitToWindow && lazyWindow && isOutsideTileWindow(lazyWindow, cell.x, cell.y)) {
      // 화면 밖은 맵 배열이 정본이다. 객체를 만들면 팬으로 이미 줄어든 창이 다시 맵 전체가 된다.
      const previous = context.tileIndex.get(key) ?? [];
      for (const object of previous) destroyTrackedTile(context, object, cell.x, cell.y);
      context.tileIndex.delete(key);
      continue;
    }
    const previous = context.tileIndex.get(key) ?? [];
    for (const object of previous) destroyTrackedTile(context, object, cell.x, cell.y);
    const next = renderTileCellLayer(context, map, activeLayer, cell.layer, cell.x, cell.y);
    if (next.length) context.tileIndex.set(key, next);
    else context.tileIndex.delete(key);
    tileObjectsUpdated += next.length;
  }
  // Container 전체 sort("depth") 는 제거됐다 — lower/upper 컨테이너 분리로 컨테이너 간
  // 순서가 고정됐고, 셀 내부 순서는 remove + add(끝 삽입)가 지켜준다. 매 스토어 변경의
  // 전체 StableSort(자식 수 O(N log N), 순간 편차 O(N))가 페인트 경로에서 사라진다.
  // 새 타일이 visible=true 로 만들어졌다. 카메라가 안 움직였으면 sameWindow early-out 으로
  // 컬링이 안 걸리므로, 적용 창을 무효화해 다음 update() 가 강제 재계산하게 한다.
  // 새 타일이 없으면 무효화할 필요가 없다 — 파괴된 타일은 active===false 가드가 처리한다.
  if (tileObjectsUpdated > 0) invalidateCullingWindow(context.scene);
  if (tileObjectsUpdated > 0 && map.relief) context.reliefLayer?.sort("depth");
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
  prepareReliefRead(map);
  const window = cameraTileWindow(context.scene, map);
  for (const [key, objects] of context.tileIndex) {
    const parsed = parseTileIndexKey(key);
    if (!parsed || !isOutsideTileWindow(window, parsed.x, parsed.y)) continue;
    for (const object of objects) destroyTrackedTile(context, object, parsed.x, parsed.y);
    context.tileIndex.delete(key);
  }
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
  // (renderVisibleEditSceneTiles 도 같은 계약 — 컨테이너 분리로 sort 호출이 없다.)
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
  const tileSize = mapTileSize(map, tileset);
  if (layer === "lower") {
    // 비활성 레이어의 실물을 눈으로 분리한다(2026-09-21). upper 에서는 물들인 회록,
    // event 에서도 0.62 로 내린다 — 이벤트 배지만 선명하면 배지가 어디에 떠 있는지가 즉시 읽힌다.
    const lowerAlpha = activeLayer === "upper" ? 0.58 : activeLayer === "event" ? 0.62 : 1;
    const lower = map.lowerTiles[i];
    const ownsGround = reliefGroundAvailable(map, reliefTilesetImage(context.scene.textures, tilesetTextureKey(tileset)));
    // 경사로 도트가 있는 바이옴의 경사로 칸은 relief 경사로 도트가 바닥을 칠한다(게임과 같게) — 타일은 그리지 않는다
    if (lower >= 0 && !ownsGround && !reliefPaintsCell(map.relief, x, y)) {
      const lowerTile = createChipsetTileObject(context.scene, map, tileset, x, y, lower);
      lowerTile.setAlpha(lowerAlpha);
      if (activeLayer === "upper") tintIfPossible(lowerTile, 0xc8d9bf);
      addTileObject(context, objects, lowerTile, 0, "lower", x, y);
    } else if (lower < 0) {
      addTileObject(context, objects, createEmptyTile(context.scene, x, y, tileSize, context.backgroundPreview === true), 0, "lower", x, y);
    }
    if (!ownsGround) {
      for (const stackedLower of tileStackAt(map, "lower", i)) {
        const lowerTile = createChipsetTileObject(context.scene, map, tileset, x, y, stackedLower);
        lowerTile.setAlpha(lowerAlpha);
        if (activeLayer === "upper") tintIfPossible(lowerTile, 0xc8d9bf);
        addTileObject(context, objects, lowerTile, 1, "lower", x, y);
      }
      // 2층·그림자 — 게임과 같은 순서(1층 → 1층 스택 → 2층 → 그림자). 2층은 합성 없이 칩 그대로.
      const overlay = layerTileAt(map, 2, i);
      if (overlay >= 0) {
        const overlayTile = createRawChipsetTileObject(context.scene, map, tileset, x, y, overlay);
        overlayTile.setAlpha(lowerAlpha);
        if (activeLayer === "upper") tintIfPossible(overlayTile, 0xc8d9bf);
        addTileObject(context, objects, overlayTile, 1, "lower", x, y);
      }
      const bits = shadowAt(map, i);
      if (bits !== 0) {
        for (const shade of createShadowQuarters(context.scene, x, y, tileSize, bits)) {
          shade.setAlpha(0.5 * lowerAlpha);
          addTileObject(context, objects, shade, 2, "lower", x, y);
        }
      }
    }
  } else {
    const dimUpper = activeLayer === "lower";
    const upper = map.upperTiles[i];
    if (upper >= 0) {
      const upperTile = createChipsetTileObject(context.scene, map, tileset, x, y, upper);
      if (dimUpper) tintIfPossible(upperTile, 0xc8d9bf);
      // depth 2 was too close to lower(0); keep upper clearly above lower stacks for canopy preview
      addTileObject(context, objects, upperTile, 20, "upper", x, y);
    }
    for (const stackedUpper of tileStackAt(map, "upper", i)) {
      const upperTile = createChipsetTileObject(context.scene, map, tileset, x, y, stackedUpper);
      if (dimUpper) tintIfPossible(upperTile, 0xc8d9bf);
      addTileObject(context, objects, upperTile, 21, "upper", x, y);
    }
    // 4층 — 3층 스택 위, 합성 없이 칩 그대로.
    const overlay = layerTileAt(map, 4, i);
    if (overlay >= 0) {
      const overlayTile = createRawChipsetTileObject(context.scene, map, tileset, x, y, overlay);
      if (dimUpper) tintIfPossible(overlayTile, 0xc8d9bf);
      addTileObject(context, objects, overlayTile, 21, "upper", x, y);
    }
  }
  context.tileIndex?.set(tileIndexKey(layer, x, y), objects);
  return objects;
}

/**
 * 타일은 청크 컨테이너의 자식이다. `tileLayer.remove` 는 직계 자식만 파괴하므로
 * 청크에 담긴 스프라이트는 남고 인덱스만 지워져, 다시 그 창에 들어오면 겹친다.
 */
function destroyTrackedTile(
  context: EditSceneRenderContext,
  object: Phaser.GameObjects.GameObject,
  _x: number,
  _y: number,
): void {
  untrackCullableTile(context.scene, object as unknown as Parameters<typeof untrackCullableTile>[1]);
  const parent = object.parentContainer;
  if (parent) {
    parent.remove(object, true);
    // Chunk identity reflects visual Y and layer, which can differ from stored Y.
    if (parent !== context.reliefLayer && parent.list?.length === 0) {
      for (const [key, chunk] of context.tileChunks ?? []) if (chunk === parent) {
        context.tileChunks!.delete(key);
        parent.parentContainer?.remove(parent);
        parent.destroy();
        break;
      }
    }
    return;
  }
  // Renderer fixtures do not always attach parentContainer.
  for (const [key, chunk] of context.tileChunks ?? []) {
    chunk.remove(object, true);
    if (chunk.list?.length === 0) {
      context.tileChunks!.delete(key);
      chunk.parentContainer?.remove(chunk);
      chunk.destroy();
    }
  }
  context.tileLayer.remove(object, true);
  context.upperTileLayer.remove(object, true);
}

function addTileObject(
  context: EditSceneRenderContext,
  objects: Phaser.GameObjects.GameObject[],
  object: Phaser.GameObjects.GameObject,
  depth: number,
  layer: "lower" | "upper",
  x: number,
  y: number
): void {
  const map = store.getCurrent().maps[context.mapId];
  const tileSize = map ? mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]) : 0;
  const liftPx = map ? reliefCellLiftPx(map.relief, x, y, tileSize) : 0;
  if (liftPx > 0 && "y" in object && typeof object.y === "number") {
    // 높이 지형: 칸 윗면으로 올린다. 하층은 절벽 띠와 같은 컨테이너에서 줄 depth 로 섞이고,
    // 상층은 upper 컨테이너 그대로(절벽 위에 뜬다 — 게임의 ★ 수관과 같은 자리).
    object.y -= liftPx;
    if (layer === "lower" && context.reliefLayer) {
      if ("setDepth" in object && typeof object.setDepth === "function") object.setDepth(y * EDIT_RELIEF_ROW_DEPTH + 1 + depth);
      context.reliefLayer.add(object);
      trackCullableTile(context.scene, object, x, y - Math.floor(liftPx / tileSize));
      objects.push(object);
      return;
    }
  }
  if ("setDepth" in object && typeof object.setDepth === "function") object.setDepth(depth);
  const parent = layer === "lower" ? context.tileLayer : context.upperTileLayer;
  // 레이어별 컨테이너로 간다 — 부모 list 순서(lower 컨테이너 → upper 컨테이너)가 곧
  // 드로 순서다. 셀 재렌더는 remove + add(끝 삽입)로 같은 컨테이너 안 상대 순서를 유지한다.
  // 청크 저장소가 있으면(large-map lazy) 레이어와 객체 사이에 16×16칸 청크를 둔다 —
  // 프레임 순회 대상을 화면 근처 청크로 몰아 화면 밖 청크는 visible 한 번으로 통째로 쉰다.
  const visualY = y - Math.floor(liftPx / tileSize);
  const target = context.tileChunks
    ? getOrCreateChunk(context.scene, parent, context.tileChunks, layer, chunkCoord(x), chunkCoord(visualY))
    : parent;
  target.add(object);
  // 컬링 추적 — update() 의 syncTileCulling 이 화면 밖 타일의 visible 을 끈다.
  // setVisible 이 없는 객체(예: 테스트 mock)는 trackCullableTile 가 자동으로 건너뛴다.
  trackCullableTile(context.scene, object, x, visualY);
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

function parseTileIndexKey(key: string): { readonly x: number; readonly y: number } | null {
  const match = /^(?:lower|upper):(-?\d+),(-?\d+)$/.exec(key);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function isOutsideTileWindow(window: EditSceneTileWindow, x: number, y: number): boolean {
  return x < window.minX || y < window.minY || x > window.maxX || y > window.maxY;
}

function isPartialTileWindow(window: EditSceneTileWindow, map: GameMap): boolean {
  return window.minX > 0 || window.minY > 0 || window.maxX < map.width - 1 || window.maxY < map.height - 1;
}

function tintIfPossible(object: Phaser.GameObjects.GameObject, tint: number): void {
  if (!isTintable(object)) return;
  object.setTint(tint);
}

function isTintable(object: Phaser.GameObjects.GameObject): object is Phaser.GameObjects.GameObject & TintableGameObject {
  return "setTint" in object && typeof object.setTint === "function";
}

/** 그림자 조각(칸의 ¼)마다 검정 사각형 하나. bit0 왼위·bit1 오른위·bit2 왼아래·bit3 오른아래. 알파는 호출자가 정한다. */
function createShadowQuarters(scene: Phaser.Scene, x: number, y: number, tileSize: number, bits: number): Phaser.GameObjects.Rectangle[] {
  const half = tileSize / 2;
  const out: Phaser.GameObjects.Rectangle[] = [];
  for (let quarter = 0; quarter < 4; quarter += 1) {
    if (!(bits & (1 << quarter))) continue;
    const rect = scene.add.rectangle(x * tileSize + (quarter % 2) * half, y * tileSize + Math.floor(quarter / 2) * half, half, half, 0x000000);
    rect.setOrigin(0, 0);
    out.push(rect);
  }
  return out;
}

/** 빈 하위 칸의 체커. 미리보기 중에는 알파를 낮춰 뒤의 배경이 비치게 한다(신호는 유지). */
function createEmptyTile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tileSize: number,
  translucent = false
): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(
    x * tileSize,
    y * tileSize,
    tileSize,
    tileSize,
    (x + y) % 2 === 0 ? 0x15171c : 0x1a1d23
  );
  if (translucent) r.setAlpha(0.35);
  r.setOrigin(0, 0);
  return r;
}

const reachCache=new WeakMap<GameMap,{tileset:TilesetDef;start:string;cells:Uint8Array}>();
function renderTerrainReachability(context:EditSceneRenderContext,map:GameMap):void {
  const project=store.getCurrent();if(project.startMapId!==map.id)return;
  const tileset=project.tilesets[map.tilesetId];if(!tileset)return;
  const key=`${project.startPos.x},${project.startPos.y}`;let cached=reachCache.get(map);
  if(!cached || cached.start!==key || cached.tileset!==tileset){cached={tileset,start:key,cells:terrainReachability(project,map,project.startPos)};reachCache.set(map,cached);}
  const tileSize=mapTileSize(map,tileset),g=context.scene.add.graphics(),lift=map.relief?reliefLiftField(map.relief):null;
  // One graphics object, run lengths on flat rows. Reuse results when only view chrome changes.
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;){
    const ok=cached.cells[y*map.width+x]===1,h=lift?cellLift(lift,x,y):0;let end=x+1;
    while(end<map.width && (cached.cells[y*map.width+end]===1)===ok && (lift?cellLift(lift,end,y):0)===h)end++;
    g.fillStyle(ok?0x2f9e44:0xe03131,ok?.22:.26);g.fillRect(x*tileSize,(y-h)*tileSize,(end-x)*tileSize,tileSize);x=end;
  }
  context.overlayLayer.add(g);
}

function renderCollisionOverlay(context: EditSceneRenderContext, map: GameMap): void {
  const project = store.getCurrent();
  const tileset = project.tilesets[map.tilesetId];
  const tileSize = mapTileSize(map, tileset);
  const collG = context.scene.add.graphics();
  collG.fillStyle(0xff4444, 0.35);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!tileset) continue;
      // 1~4층 모두 본다(4층 × 가 통행 3층 위에 있으면 빨갛게). 옛 스택 top 도 cellPassability 가 반영한다.
      const pass = cellPassability(tileset, map, y * map.width + x);
      if (!pass.up && !pass.down && !pass.left && !pass.right) {
        collG.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  }
  context.overlayLayer.add(collG);
}

function renderStartPosition(context: EditSceneRenderContext): void {
  const project = store.getCurrent();
  if (project.startMapId !== context.mapId) return;
  const map = store.getCurrent().maps[context.mapId];
  const tileSize = mapTileSize(map, map ? store.getCurrent().tilesets[map.tilesetId] : undefined);
  const s = context.scene.add.rectangle(
    project.startPos.x * tileSize + tileSize / 2,
    project.startPos.y * tileSize + tileSize / 2,
    tileSize - 6,
    tileSize - 6,
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
  preview?: TileSelection,
): void {
  const state = editorState.get();
  const selection = preview ?? state.selection;
  if (!selection || selection.mapId !== mapId || state.pastePreview) {
    layer.removeAll(true);
    return;
  }
  const map = store.getCurrent().maps[mapId];
  const tileSize = mapTileSize(map, map ? store.getCurrent().tilesets[map.tilesetId] : undefined);
  const x = selection.x * tileSize;
  const y = selection.y * tileSize;
  const w = selection.width * tileSize;
  const h = selection.height * tileSize;
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
  const tileSize = mapTileSize(map, store.getCurrent().tilesets[map.tilesetId]);
  const mapW = map.width * tileSize;
  const mapH = map.height * tileSize;
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
      ? { x: (focus.x + 0.5) * tileSize, y: (focus.y + 0.5) * tileSize }
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

export function isMapOnlyCaptureMode(): boolean {
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
