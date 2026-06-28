// editor/EditScene.ts
// 에디터의 Phaser 씬. 맵을 그리드 단위로 렌더하고 입력을 actions로 보낸다.
// 데이터는 직접 쓰지 않고 store.subscribe 로 갱신을 받아 재렌더.

import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import {
  loadBundledAssets,
  registerBundledFrames,
  TILE_SIZE,
} from "@/assets/bundled";
import { store } from "@/project/store";
import { editorState, type PaintShape } from "@/editor/editorState";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { renderHoverTilePreview } from "@/editor/editSceneHoverPreview";
import { renderEditScene } from "@/editor/editSceneRender";
import {
  paintTile,
  eraseTile,
  toggleCollision,
  fillTile,
} from "@/editor/actions";
import { copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { recordProjectSnapshot, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { handleEditorKey, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { saveProjectNow } from "@/editor/saveActions";
import { tileCellsForPaintShape, tileRectFromDrag, tileRectWithinBounds, type TilePoint } from "@/editor/tileShapeTools";
import { committedEvents } from "@/project/eventDrafts";
import { topTileInStack } from "@/project/mapOverlayTiles";
import type { MapId } from "@/project/types";

const PhaserRuntime = getLoadedPhaser();

type BrushStroke = {
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
  readonly applyCell: (x: number, y: number) => void;
};

type TileLayer = "lower" | "upper";

type TilePickTarget = {
  readonly mapId: MapId;
  readonly layer: TileLayer;
  readonly x: number;
  readonly y: number;
};

type EventLayerClick = {
  readonly at: number;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
};

type EventLayerClickTarget = {
  readonly mapId: MapId;
  readonly ptr: Phaser.Input.Pointer;
  readonly x: number;
  readonly y: number;
};

type PanStart = {
  readonly screenX: number;
  readonly screenY: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly shellScrollLeft: number;
  readonly shellScrollTop: number;
};

type DragOperation =
  | {
    readonly kind: "select";
    readonly mapId: MapId;
    readonly start: TilePoint;
  }
  | {
    readonly kind: "shape";
    readonly layer: TileLayer;
    readonly mapId: MapId;
    readonly shape: Exclude<PaintShape, "pen">;
    readonly start: TilePoint;
    readonly tile: number;
};

const EVENT_LAYER_DOUBLE_CLICK_MS = 500;

export class EditScene extends PhaserRuntime.Scene {
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private hoverPreviewLayer: Phaser.GameObjects.Container | null = null;
  private overlayLayer: Phaser.GameObjects.Container | null = null;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private unsubStore: (() => void) | null = null;
  private unsubEditor: (() => void) | null = null;
  private isPainting = false;
  private lastPaintKey = "";
  private lastEventLayerClick: EventLayerClick | null = null;
  private lastPointerTile: { x: number; y: number } | null = null;
  private lastRenderStateKey = "";
  private lastCameraViewKey = "";
  private isPanning = false;
  private dragOperation: DragOperation | null = null;
  private spacePanActive = false;
  private panStart: PanStart | null = null;
  private readonly handleAuxiliaryCanvasPointerDown = (event: MouseEvent | PointerEvent): void => {
    if (!this.isMiddleButtonEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.startPanAt(event.clientX, event.clientY);
  };
  private readonly handleAuxiliaryCanvasClick = (event: MouseEvent | PointerEvent): void => {
    if (!this.isMiddleButtonEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  private readonly handleWindowPanMove = (event: MouseEvent | PointerEvent): void => {
    if (!this.isPanning) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.continuePanAt(event.clientX, event.clientY);
  };
  private readonly handleWindowPanEnd = (event?: MouseEvent | PointerEvent): void => {
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation();
    this.stopPan();
  };

  constructor() {
    super({ key: "EditScene" });
  }

  preload(): void {
    loadBundledAssets(this);
  }

  create(): void {
    registerBundledFrames(this);
    this.cameras.main.setBackgroundColor("#0f1115");

    this.tileLayer = this.add.container(0, 0);
    this.hoverPreviewLayer = this.add.container(0, 0);
    this.hoverPreviewLayer.setDepth(8);
    this.overlayLayer = this.add.container(0, 0);
    this.overlayLayer.setDepth(9);
    const gridGraphics = this.add.graphics();
    gridGraphics.setDepth(10);
    this.gridGraphics = gridGraphics;

    this.bindInput();
    this.redraw();

    // store/에디터 상태 변경 시 재렌더.
    this.unsubStore = store.subscribe(() => this.redraw());
    this.unsubEditor = editorState.subscribe(() => this.redrawWhenViewStateChanges());

    this.scale.on("resize", this.handleResize, this);

    // scene 정지/파괴 시 구독 해제(이중 호출 방지).
    this.events.once(PhaserRuntime.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(PhaserRuntime.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private cleanup(): void {
    this.unbindCanvasPanGuards();
    this.unbindWindowPanGuards();
    this.unsubStore?.();
    this.unsubEditor?.();
    this.unsubStore = null;
    this.unsubEditor = null;
  }

  private handleResize(): void {
    this.redraw();
  }

  // ── 입력 바인딩 ──
  private bindInput(): void {
    this.bindCanvasPanGuards();
    // 마우스 다운 → 드래그 중 계속 적용(페인트/충돌/지우개).
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      this.updatePointerStatus(ptr);
      this.updateHoverPreview(ptr);
      if (this.isRightClick(ptr)) {
        this.pickTileAtPointer(ptr);
        return;
      }
      if (this.shouldPan(ptr)) {
        this.startPan(ptr);
        return;
      }
      if (this.beginDragOperation(ptr)) return;
      this.isPainting = true;
      this.lastPaintKey = "";
      this.applyAtPointer(ptr);
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      this.updatePointerStatus(ptr);
      if (this.dragOperation && ptr.isDown) {
        this.updateDragOperation(ptr);
        return;
      }
      this.updateHoverPreview(ptr);
      if (this.isPanning) {
        this.continuePan(ptr);
        return;
      }
      if (this.isPainting && ptr.isDown) {
        this.applyAtPointer(ptr);
      }
    });
    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      this.finishDragOperation(ptr);
      this.isPainting = false;
      this.lastPaintKey = "";
      this.stopPan();
    });
    this.input.on("pointerout", () => {
      if (!this.dragOperation) this.clearHoverPreview();
    });
    this.input.on(
      "wheel",
      (_ptr: Phaser.Input.Pointer, _objects: readonly Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number) => {
        this.panCameraBy(deltaX, deltaY);
      }
    );
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.handleKeyDown(event));
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => this.handleKeyUp(event));
  }

  private shouldPan(ptr: Phaser.Input.Pointer): boolean {
    return editorState.get().tool === "pan" || this.spacePanActive || ptr.middleButtonDown() || ptr.button === 1;
  }

  private bindCanvasPanGuards(): void {
    const canvas = this.game.canvas;
    canvas.addEventListener("pointerdown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.addEventListener("mousedown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.addEventListener("auxclick", this.handleAuxiliaryCanvasClick, { capture: true });
  }

  private unbindCanvasPanGuards(): void {
    const canvas = this.game.canvas;
    canvas.removeEventListener("pointerdown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.removeEventListener("mousedown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.removeEventListener("auxclick", this.handleAuxiliaryCanvasClick, { capture: true });
  }

  private bindWindowPanGuards(): void {
    window.addEventListener("pointermove", this.handleWindowPanMove, { capture: true, passive: false });
    window.addEventListener("mousemove", this.handleWindowPanMove, { capture: true, passive: false });
    window.addEventListener("pointerup", this.handleWindowPanEnd, { capture: true });
    window.addEventListener("pointercancel", this.handleWindowPanEnd, { capture: true });
    window.addEventListener("mouseup", this.handleWindowPanEnd, { capture: true });
  }

  private unbindWindowPanGuards(): void {
    window.removeEventListener("pointermove", this.handleWindowPanMove, { capture: true });
    window.removeEventListener("mousemove", this.handleWindowPanMove, { capture: true });
    window.removeEventListener("pointerup", this.handleWindowPanEnd, { capture: true });
    window.removeEventListener("pointercancel", this.handleWindowPanEnd, { capture: true });
    window.removeEventListener("mouseup", this.handleWindowPanEnd, { capture: true });
  }

  private isRightClick(ptr: Phaser.Input.Pointer): boolean {
    return ptr.rightButtonDown() || ptr.button === 2;
  }

  private startPan(ptr: Phaser.Input.Pointer): void {
    const point = this.pointerScreenPosition(ptr);
    this.startPanAt(point.x, point.y);
  }

  private startPanAt(screenX: number, screenY: number): void {
    const camera = this.cameras.main;
    this.isPanning = true;
    this.isPainting = false;
    this.lastPaintKey = "";
    this.panStart = {
      screenX,
      screenY,
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      shellScrollLeft: this.canvasScrollShell()?.scrollLeft ?? 0,
      shellScrollTop: this.canvasScrollShell()?.scrollTop ?? 0,
    };
    this.bindWindowPanGuards();
  }

  private continuePan(ptr: Phaser.Input.Pointer): void {
    const point = this.pointerScreenPosition(ptr);
    this.continuePanAt(point.x, point.y);
  }

  private continuePanAt(screenX: number, screenY: number): void {
    const start = this.panStart;
    if (!start) return;
    const camera = this.cameras.main;
    const dx = screenX - start.screenX;
    const dy = screenY - start.screenY;
    camera.setScroll(
      start.scrollX - dx / camera.zoom,
      start.scrollY - dy / camera.zoom
    );
    const shell = this.canvasScrollShell();
    if (!shell) return;
    shell.scrollLeft = start.shellScrollLeft - dx;
    shell.scrollTop = start.shellScrollTop - dy;
  }

  private stopPan(): void {
    this.isPanning = false;
    this.panStart = null;
    this.unbindWindowPanGuards();
  }

  private pointerScreenPosition(ptr: Phaser.Input.Pointer): { readonly x: number; readonly y: number } {
    const event = ptr.event;
    if (event instanceof MouseEvent || event instanceof PointerEvent) {
      return { x: event.clientX, y: event.clientY };
    }
    return { x: ptr.x, y: ptr.y };
  }

  private canvasScrollShell(): HTMLElement | null {
    const canvas = this.game.canvas;
    const shell = canvas.closest("[data-testid='editor-canvas-scroll-shell']");
    return shell instanceof HTMLElement ? shell : null;
  }

  private isMiddleButtonEvent(event: MouseEvent | PointerEvent): boolean {
    return event.button === 1 || (event.buttons & 4) === 4;
  }

  private updateHoverPreview(ptr: Phaser.Input.Pointer): void {
    const { x, y } = this.pointerToTile(ptr);
    this.lastPointerTile = { x, y };
    this.renderHoverPreview(x, y);
  }

  private clearHoverPreview(): void {
    this.hoverPreviewLayer?.removeAll(true);
  }

  private renderHoverPreview(centerX: number, centerY: number): void {
    const layer = this.hoverPreviewLayer;
    const mapId = this.mapId();
    if (!layer || !mapId) return;
    renderHoverTilePreview({ centerX, centerY, layer, mapId, scene: this });
  }

  private beginDragOperation(ptr: Phaser.Input.Pointer): boolean {
    const mapId = this.mapId();
    if (!mapId) return false;
    const map = store.getCurrent().maps[mapId];
    if (!map) return false;
    const point = this.pointerToTile(ptr);
    if (!this.isInsideMapPoint(point, map)) return false;
    const state = editorState.get();
    if (state.tool === "select") {
      this.dragOperation = { kind: "select", mapId, start: point };
      selectTileRegion(mapId, { mapId, x: point.x, y: point.y, width: 1, height: 1 });
      return true;
    }
    if (state.tool === "paint" && state.paintShape !== "pen" && state.selectedTile >= 0) {
      const layer: TileLayer = state.layer === "upper" ? "upper" : "lower";
      const operation: Extract<DragOperation, { readonly kind: "shape" }> = { kind: "shape", layer, mapId, shape: state.paintShape, start: point, tile: state.selectedTile };
      this.dragOperation = operation;
      this.renderShapeDragPreview(operation, point);
      return true;
    }
    return false;
  }

  private updateDragOperation(ptr: Phaser.Input.Pointer): void {
    const operation = this.dragOperation;
    if (!operation) return;
    const point = this.pointerToTile(ptr);
    this.lastPointerTile = point;
    if (operation.kind === "select") {
      this.updateSelectionDrag(operation, point);
      return;
    }
    this.renderShapeDragPreview(operation, point);
  }

  private finishDragOperation(ptr: Phaser.Input.Pointer): void {
    const operation = this.dragOperation;
    if (!operation) return;
    const point = this.pointerToTile(ptr);
    if (operation.kind === "select") {
      this.updateSelectionDrag(operation, point);
    } else {
      this.commitShapeDrag(operation, point);
    }
    this.dragOperation = null;
    this.clearHoverPreview();
  }

  private updateSelectionDrag(operation: Extract<DragOperation, { readonly kind: "select" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map) return;
    const rect = tileRectWithinBounds(tileRectFromDrag(operation.start, point), { width: map.width, height: map.height });
    if (!rect) return;
    selectTileRegion(operation.mapId, { mapId: operation.mapId, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  private commitShapeDrag(operation: Extract<DragOperation, { readonly kind: "shape" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map) return;
    const cells = tileCellsForPaintShape(operation.shape, operation.start, point, { width: map.width, height: map.height });
    if (cells.length === 0) return;
    recordProjectSnapshot();
    for (const cell of cells) {
      paintTile(operation.mapId, operation.layer, cell.x, cell.y, operation.tile);
    }
  }

  private renderShapeDragPreview(operation: Extract<DragOperation, { readonly kind: "shape" }>, point: TilePoint): void {
    const layer = this.hoverPreviewLayer;
    if (!layer) return;
    layer.removeAll(true);
    const map = store.getCurrent().maps[operation.mapId];
    if (!map) return;
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) return;
    const cells = tileCellsForPaintShape(operation.shape, operation.start, point, { width: map.width, height: map.height });
    for (const cell of cells) {
      const preview = createChipsetTileObject(this, map, tileset, cell.x, cell.y, operation.tile);
      preview.setAlpha(0.62);
      layer.add(preview);
      const marker = this.add.rectangle(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x3bc9db, 0.18);
      marker.setOrigin(0, 0);
      marker.setStrokeStyle(1, 0xe7f5ff, 0.85);
      layer.add(marker);
    }
  }

  private isInsideMapPoint(point: TilePoint, map: { readonly width: number; readonly height: number }): boolean {
    return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
  }

  private applyAtPointer(ptr: Phaser.Input.Pointer): void {
    const mid = this.mapId();
    if (!mid) return;
    const { x, y } = this.pointerToTile(ptr);
    this.lastPointerTile = { x, y };
    this.updatePointerStatus(ptr);

    const tool = editorState.get().tool;
    const layer = editorState.get().layer;
    const { brushSize, selectedTile } = editorState.get();
    const key = `${x},${y}`;
    const firstStrokeTile = this.lastPaintKey === "";
    if (layer !== "event" && key === this.lastPaintKey) return;
    this.lastPaintKey = key;
    // event 레이어에선 타일 도구 동작 안 함.
    const tileLayer: "lower" | "upper" = layer === "upper" ? "upper" : "lower";
    const clickCount =
      layer === "event" ? this.eventLayerClickCount({ mapId: mid, ptr, x, y }) : this.pointerClickCount(ptr);

    if (layer === "event" && clickCount >= 2 && this.openExistingEventAt(mid, x, y)) {
      return;
    }

    switch (tool) {
      case "paint":
        recordProjectSnapshot();
        this.applyBrush({
          centerX: x,
          centerY: y,
          size: brushSize,
          applyCell: (brushX, brushY) => paintTile(mid, tileLayer, brushX, brushY, selectedTile),
        });
        break;
      case "fill":
        if (firstStrokeTile) {
          recordProjectSnapshot();
          fillTile(mid, tileLayer, x, y, selectedTile);
        }
        break;
      case "erase":
        recordProjectSnapshot();
        this.applyBrush({
          centerX: x,
          centerY: y,
          size: brushSize,
          applyCell: (brushX, brushY) => eraseTile(mid, tileLayer, brushX, brushY),
        });
        break;
      case "collision":
        recordProjectSnapshot();
        toggleCollision(mid, x, y);
        break;
      case "event":
        this.isPainting = false;
        this.lastPaintKey = "";
        this.handleEventClick(mid, x, y, clickCount >= 2);
        break;
      case "select":
        selectTileRegion(mid, { mapId: mid, x, y, width: 1, height: 1 });
        break;
      case "eyedropper":
        this.pickTileAt({ mapId: mid, layer: tileLayer, x, y });
        break;
      case "pan":
        break;
    }
  }

  private applyBrush(stroke: BrushStroke): void {
    const offset = Math.floor(stroke.size / 2);
    for (let y = stroke.centerY - offset; y <= stroke.centerY + offset; y++) {
      for (let x = stroke.centerX - offset; x <= stroke.centerX + offset; x++) {
        stroke.applyCell(x, y);
      }
    }
  }

  private pickTileAt(target: TilePickTarget): void {
    const map = store.getCurrent().maps[target.mapId];
    if (!map) return;
    if (target.x < 0 || target.y < 0 || target.x >= map.width || target.y >= map.height) return;
    const index = target.y * map.width + target.x;
    const tile =
      target.layer === "upper"
        ? topTileInStack(map, "upper", index) ?? map.upperTiles[index]
        : topTileInStack(map, "lower", index) ?? map.lowerTiles[index];
    const fallbackTile =
      target.layer === "upper" ? topTileInStack(map, "lower", index) ?? map.lowerTiles[index] : tile;
    const selectedTile = tile >= 0 ? tile : fallbackTile;
    if (selectedTile < 0) return;
    editorState.set({ selectedTile, layer: target.layer, tool: "paint" });
  }

  private pickTileAtPointer(ptr: Phaser.Input.Pointer): void {
    const mapId = this.mapId();
    if (!mapId) return;
    const { x, y } = this.pointerToTile(ptr);
    const layer = editorState.get().layer === "upper" ? "upper" : "lower";
    this.isPainting = false;
    this.lastPaintKey = "";
    this.pickTileAt({ mapId, layer, x, y });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // 텍스트 입력/모달이 포커스를 잡고 있으면 에디터 단축키를 끈다.
    if (shouldIgnoreEditorShortcut(event)) return;
    if (event.code === "Space") {
      event.preventDefault();
      this.spacePanActive = true;
      return;
    }
    if (!(event.ctrlKey || event.metaKey) && this.panWithArrowKey(event)) return;
    // RM2K3 스타일 단축키: F5/F6/F7 레이어, 1..7 도구, +/- 줌.
    if (!(event.ctrlKey || event.metaKey) && handleEditorKey(event)) return;
    this.handleShortcut(event);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.code !== "Space") return;
    event.preventDefault();
    this.spacePanActive = false;
    if (!this.isPanning) return;
    this.isPanning = false;
    this.panStart = null;
  }

  private panWithArrowKey(event: KeyboardEvent): boolean {
    const step = event.shiftKey ? TILE_SIZE * 16 : TILE_SIZE * 6;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        this.panCameraBy(-step, 0);
        return true;
      case "ArrowRight":
        event.preventDefault();
        this.panCameraBy(step, 0);
        return true;
      case "ArrowUp":
        event.preventDefault();
        this.panCameraBy(0, -step);
        return true;
      case "ArrowDown":
        event.preventDefault();
        this.panCameraBy(0, step);
        return true;
      default:
        return false;
    }
  }

  private panCameraBy(deltaX: number, deltaY: number): void {
    const camera = this.cameras.main;
    camera.setScroll(camera.scrollX + deltaX, camera.scrollY + deltaY);
  }

  private handleShortcut(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    // Ctrl+S: 저장(맵 컨텍스트와 무관하게 항상 동작).
    if (key === "s") {
      event.preventDefault();
      void saveProjectNow();
      return;
    }
    const mid = this.mapId();
    if (!mid) return;
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoMapEdit();
      } else {
        undoMapEdit();
      }
    } else if (key === "y") {
      event.preventDefault();
      redoMapEdit();
    } else if (key === "c") {
      event.preventDefault();
      copySelection(mid);
    } else if (key === "v") {
      event.preventDefault();
      const selection = editorState.get().selection;
      const target = this.lastPointerTile ?? selection ?? { x: 0, y: 0 };
      pasteClipboard(mid, target.x, target.y);
    }
  }

  private pointerToTile(ptr: Phaser.Input.Pointer): { x: number; y: number } {
    return {
      x: Math.floor(ptr.worldX / TILE_SIZE),
      y: Math.floor(ptr.worldY / TILE_SIZE),
    };
  }

  private updatePointerStatus(ptr: Phaser.Input.Pointer): void {
    const mid = this.mapId();
    if (!mid) return;
    const map = store.getCurrent().maps[mid];
    if (!map) return;
    const { x, y } = this.pointerToTile(ptr);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
      setTileToolStatus("cursor-position", "outside");
      setTileToolStatus("cursor-lower", "-");
      setTileToolStatus("cursor-upper", "-");
      return;
    }
    const index = y * map.width + x;
    setTileToolStatus("cursor-position", `${x},${y}`);
    setTileToolStatus("cursor-lower", String(topTileInStack(map, "lower", index) ?? map.lowerTiles[index]));
    setTileToolStatus("cursor-upper", String(topTileInStack(map, "upper", index) ?? map.upperTiles[index]));
  }

  private handleEventClick(mapId: MapId, x: number, y: number, openEditor = false): void {
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const existing = committedEvents(map.events).find((e) => e.x === x && e.y === y);
    if (existing) {
      editorState.set({ selectedEventId: existing.id, selectedEventPageId: null });
      if (openEditor) openEventEditorModal(mapId, existing.id);
    } else if (openEditor) {
      openNewEventEditorModal(mapId, x, y);
      editorState.set({ selectedEventId: null, selectedEventPageId: null });
    }
  }

  private openExistingEventAt(mapId: MapId, x: number, y: number): boolean {
    const map = store.getCurrent().maps[mapId];
    const existing = map ? committedEvents(map.events).find((event) => event.x === x && event.y === y) : undefined;
    if (!existing) return false;
    this.isPainting = false;
    this.lastPaintKey = "";
    editorState.set({ selectedEventId: existing.id, selectedEventPageId: null });
    openEventEditorModal(mapId, existing.id);
    return true;
  }

  private pointerClickCount(ptr: Phaser.Input.Pointer): number {
    const event = ptr.event;
    if (event instanceof MouseEvent || event instanceof PointerEvent) return event.detail;
    return 1;
  }

  private eventLayerClickCount(target: EventLayerClickTarget): number {
    const nativeClickCount = this.pointerClickCount(target.ptr);
    const now = Date.now();
    const previous = this.lastEventLayerClick;
    this.lastEventLayerClick = { at: now, mapId: target.mapId, x: target.x, y: target.y };
    if (nativeClickCount >= 2) return nativeClickCount;
    if (!previous) return 1;
    const sameTile = previous.mapId === target.mapId && previous.x === target.x && previous.y === target.y;
    return sameTile && now - previous.at <= EVENT_LAYER_DOUBLE_CLICK_MS ? 2 : 1;
  }

  private mapId(): MapId | null {
    const id = editorState.get().currentMapId ?? store.getCurrent().startMapId;
    return id;
  }

  // ── 렌더 ──
  private redraw(): void {
    const mid = this.mapId();
    if (!mid) return;
    this.lastRenderStateKey = this.renderStateKey(mid);
    const cameraViewKey = this.cameraViewKey(mid);
    const resetCamera = cameraViewKey !== this.lastCameraViewKey;
    this.lastCameraViewKey = cameraViewKey;
    const tileLayer = this.tileLayer;
    const hoverPreviewLayer = this.hoverPreviewLayer;
    const overlayLayer = this.overlayLayer;
    const gridGraphics = this.gridGraphics;
    if (!tileLayer || !hoverPreviewLayer || !overlayLayer || !gridGraphics) return;
    renderEditScene({ scene: this, tileLayer, overlayLayer, gridGraphics, mapId: mid, resetCamera });
    if (this.lastPointerTile) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
  }

  private redrawWhenViewStateChanges(): void {
    const mid = this.mapId();
    if (!mid) return;
    const nextKey = this.renderStateKey(mid);
    if (nextKey === this.lastRenderStateKey) return;
    this.redraw();
  }

  private renderStateKey(mapId: MapId): string {
    const state = editorState.get();
    const selection = state.selection;
    const selectionKey = selection
      ? `${selection.mapId}:${selection.x}:${selection.y}:${selection.width}:${selection.height}`
      : "none";
    return [
      mapId,
      state.zoom,
      state.tool,
      state.paintShape,
      state.layer,
      state.selectedTile,
      state.brushSize,
      state.selectedEventId ?? "none",
      selectionKey,
    ].join("|");
  }

  private cameraViewKey(mapId: MapId): string {
    const map = store.getCurrent().maps[mapId];
    const state = editorState.get();
    const mapKey = map ? `${map.width}x${map.height}` : "missing";
    const focus = typeof window === "undefined" ? "" : window.location.search;
    return [mapId, mapKey, state.zoom, focus].join("|");
  }
}

function setTileToolStatus(testId: string, text: string): void {
  const node = document.querySelector(`[data-testid="${testId}"]`);
  if (!node) return;
  node.textContent = text;
}
