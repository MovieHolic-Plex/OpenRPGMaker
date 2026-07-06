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
import { store, type ProjectChangeCell, type ProjectChangeDescriptor } from "@/project/store";
import { editorState, type PaintShape } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import {
  renderEventLayerClickFeedback,
  type EventLayerClickFeedback,
} from "@/editor/editSceneEventMarkers";
import { renderHoverTilePreview } from "@/editor/editSceneHoverPreview";
import { planEditSceneRenderForStoreChange } from "@/editor/editSceneRenderPlan";
import { renderEditScene, renderEditSceneTileCells, type EditSceneRenderStats, type EditSceneTileIndex } from "@/editor/editSceneRender";
import {
  paintTile,
  eraseTile,
  toggleCollision,
  fillTile,
} from "@/editor/actions";
import { copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { recordProjectSnapshot, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { handleEditorKey, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { copyEventAt, eventLayerContextMenuItems, openEventLayerContextMenu, pasteEventAt } from "@/editor/panels/eventLayerContextMenu";
import { openMapContextMenu } from "@/editor/panels/mapContextMenu";
import { isCellInsideSelection, regionTaskMenuItems } from "@/editor/panels/mapSelectionContextMenu";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { saveProjectNow } from "@/editor/saveActions";
import { placeStructureStamp, previewStructureStampCells } from "@/editor/structureStampTools";
import type { StructureStampId } from "@/editor/structureStampTools";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { tileCellsForPaintShape, tileRectFromDrag, tileRectWithinBounds, type TilePoint } from "@/editor/tileShapeTools";
import { compatibleStampIdForTile, tileStampById, tileStampsForTile, type TileStamp } from "@/editor/tileStampBrushes";
import { visibleTilePickAt } from "@/editor/tilePicking";
import { committedEvents } from "@/project/eventDrafts";
import { moveEvent } from "@/editor/eventActions";
import { topTileInStack } from "@/project/mapOverlayTiles";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";

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
    readonly autoConnect: boolean;
  }
  | {
    readonly kind: "structure";
    readonly mapId: MapId;
    readonly stampId: StructureStampId;
  }
  | {
    // 이벤트 레이어에서 NPC/이벤트를 드래그해 다른 칸으로 옮긴다.
    readonly kind: "eventMove";
    readonly mapId: MapId;
    readonly eventId: string;
    readonly origin: TilePoint;
  };

const EVENT_LAYER_DOUBLE_CLICK_MS = 500;

export class EditScene extends PhaserRuntime.Scene {
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private hoverPreviewLayer: Phaser.GameObjects.Container | null = null;
  private overlayLayer: Phaser.GameObjects.Container | null = null;
  private eventClickFeedbackLayer: Phaser.GameObjects.Container | null = null;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private unsubStore: (() => void) | null = null;
  private unsubEditor: (() => void) | null = null;
  private isPainting = false;
  private lastPaintKey = "";
  private lastEventLayerClick: EventLayerClick | null = null;
  private eventLayerClickFeedback: EventLayerClickFeedback | null = null;
  private lastPointerTile: { x: number; y: number } | null = null;
  private lastRenderedMapId: MapId | null = null;
  private lastRenderStateKey = "";
  private lastCameraViewKey = "";
  private readonly tileIndex: EditSceneTileIndex = new Map();
  private isPanning = false;
  private dragOperation: DragOperation | null = null;
  // 이벤트 레이어에서 눌린 이벤트. 포인터가 다른 칸으로 움직이면 eventMove 드래그로 승격한다.
  private eventDragCandidate: { readonly mapId: MapId; readonly eventId: string; readonly origin: TilePoint } | null = null;
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
    this.eventClickFeedbackLayer = this.add.container(0, 0);
    this.eventClickFeedbackLayer.setDepth(12);

    this.bindInput();
    this.redraw();

    // store/에디터 상태 변경 시 재렌더.
    this.unsubStore = store.subscribe((_project, change) => this.redrawForStoreChange(change));
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

  private redrawForStoreChange(change: ProjectChangeDescriptor): void {
    const mapId = this.mapId();
    const plan = planEditSceneRenderForStoreChange({
      change,
      currentMapId: mapId,
      canIncrementalCells: mapId !== null && this.canIncrementallyRenderCells(mapId),
    });
    if (plan.kind === "skip") return;
    if (plan.kind === "cells") {
      this.redrawCells(plan.cells);
      return;
    }
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
        if (this.tryOpenRegionTaskMenu(ptr)) return; // 선택 영역 안 우클릭 → 영역 작업 메뉴
        if (editorState.get().layer === "event") {
          this.openEventLayerMenu(ptr);
        } else {
          this.pickTileAtPointer(ptr);
        }
        return;
      }
      if (this.shouldPan(ptr)) {
        this.startPan(ptr);
        return;
      }
      if (this.beginDragOperation(ptr)) return;
      this.isPainting = true;
      this.lastPaintKey = "";
      // 이벤트 레이어: 눌린 칸에 이벤트가 있으면 드래그 이동 후보로 기록(클릭/더블클릭은 그대로).
      this.maybeBeginEventDragCandidate(ptr);
      this.applyAtPointer(ptr);
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      this.updatePointerStatus(ptr);
      if (this.dragOperation && ptr.isDown) {
        this.updateDragOperation(ptr);
        return;
      }
      // 이벤트를 누른 채 다른 칸으로 이동하면 드래그 이동을 시작한다.
      if (this.eventDragCandidate && ptr.isDown && this.tryPromoteEventDrag(ptr)) return;
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
      this.eventDragCandidate = null;
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
    this.lastPointerTile = null;
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
    if (state.tool === "paint" && state.activeStructureStampId) {
      const operation: Extract<DragOperation, { readonly kind: "structure" }> = {
        kind: "structure",
        mapId,
        stampId: state.activeStructureStampId,
      };
      this.dragOperation = operation;
      this.renderStructureDragPreview(operation, point);
      return true;
    }
    if (state.tool === "paint" && state.paintShape !== "pen" && state.selectedTile >= 0) {
      const layer: TileLayer = state.layer === "upper" ? "upper" : "lower";
      const operation: Extract<DragOperation, { readonly kind: "shape" }> = {
        kind: "shape",
        layer,
        mapId,
        shape: state.paintShape,
        start: point,
        tile: state.selectedTile,
        autoConnect: state.autoConnectMode,
      };
      this.dragOperation = operation;
      this.renderShapeDragPreview(operation, point);
      return true;
    }
    return false;
  }

  // 이벤트 레이어에서 눌린 칸에 이벤트가 있으면 드래그 이동 후보로 기록한다.
  // 실제 드래그(다른 칸으로 이동)가 시작되기 전까지는 클릭/더블클릭 동작을 방해하지 않는다.
  private maybeBeginEventDragCandidate(ptr: Phaser.Input.Pointer): void {
    this.eventDragCandidate = null;
    if (editorState.get().layer !== "event") return;
    const mapId = this.mapId();
    if (!mapId) return;
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    const point = this.pointerToTile(ptr);
    if (!this.isInsideMapPoint(point, map)) return;
    const existing = committedEvents(map.events).find((event) => event.x === point.x && event.y === point.y);
    if (!existing) return;
    this.eventDragCandidate = { mapId, eventId: existing.id, origin: point };
  }

  // 후보 이벤트를 누른 채 다른 칸으로 움직이면 eventMove 드래그로 승격한다.
  private tryPromoteEventDrag(ptr: Phaser.Input.Pointer): boolean {
    const candidate = this.eventDragCandidate;
    if (!candidate) return false;
    const point = this.pointerToTile(ptr);
    if (point.x === candidate.origin.x && point.y === candidate.origin.y) return false;
    this.dragOperation = {
      kind: "eventMove",
      mapId: candidate.mapId,
      eventId: candidate.eventId,
      origin: candidate.origin,
    };
    this.eventDragCandidate = null;
    this.isPainting = false;
    this.lastPaintKey = "";
    this.renderEventMoveDragPreview(this.dragOperation, point);
    return true;
  }

  private renderEventMoveDragPreview(
    operation: Extract<DragOperation, { readonly kind: "eventMove" }>,
    point: TilePoint
  ): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map || !this.isInsideMapPoint(point, map)) return;
    // 드롭 예정 칸을 이벤트 레이어 하이라이트로 표시한다.
    this.showEventLayerClickFeedback(operation.mapId, point.x, point.y);
  }

  private commitEventMoveDrag(
    operation: Extract<DragOperation, { readonly kind: "eventMove" }>,
    point: TilePoint
  ): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map || !this.isInsideMapPoint(point, map)) return; // 맵 밖 → 취소
    if (point.x === operation.origin.x && point.y === operation.origin.y) return; // 제자리 → 무시
    if (!canEditMap(operation.mapId)) {
      toast(mapEditLockNotice(operation.mapId), "error");
      return;
    }
    const occupied = committedEvents(map.events).some(
      (event) => event.id !== operation.eventId && event.x === point.x && event.y === point.y
    );
    if (occupied) {
      toast("이미 다른 이벤트가 있는 칸입니다.", "error");
      return;
    }
    recordProjectSnapshot();
    moveEvent(operation.mapId, operation.eventId, point.x, point.y);
    editorState.set({ selectedEventId: operation.eventId });
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
    if (operation.kind === "structure") {
      this.renderStructureDragPreview(operation, point);
      return;
    }
    if (operation.kind === "eventMove") {
      this.renderEventMoveDragPreview(operation, point);
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
    } else if (operation.kind === "structure") {
      this.commitStructureDrag(operation, point);
    } else if (operation.kind === "eventMove") {
      this.commitEventMoveDrag(operation, point);
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
      paintTile(operation.mapId, operation.layer, cell.x, cell.y, operation.tile, { autoConnect: operation.autoConnect });
    }
  }

  private commitStructureDrag(operation: Extract<DragOperation, { readonly kind: "structure" }>, point: TilePoint): void {
    const map = store.getCurrent().maps[operation.mapId];
    if (!map || !this.isInsideMapPoint(point, map)) return;
    recordProjectSnapshot();
    placeStructureStamp(operation.mapId, { id: operation.stampId, origin: point });
  }

  private renderStructureDragPreview(operation: Extract<DragOperation, { readonly kind: "structure" }>, point: TilePoint): void {
    const layer = this.hoverPreviewLayer;
    if (!layer) return;
    layer.removeAll(true);
    const map = store.getCurrent().maps[operation.mapId];
    if (!map || !this.isInsideMapPoint(point, map)) return;
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) return;
    const cells = previewStructureStampCells(map, { id: operation.stampId, origin: point });
    for (const cell of cells) {
      const preview = createChipsetTileObject(this, map, tileset, cell.x, cell.y, cell.tile);
      preview.setAlpha(cell.layer === "upper" ? 0.72 : 0.58);
      layer.add(preview);
      const marker = this.add.rectangle(cell.x * TILE_SIZE, cell.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x51cf66, 0.12);
      marker.setOrigin(0, 0);
      marker.setStrokeStyle(1, 0xd3f9d8, 0.72);
      layer.add(marker);
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
    if (!canEditMap(mid) && this.toolCanMutateMap(tool)) {
      this.isPainting = false;
      this.lastPaintKey = "";
      toast(mapEditLockNotice(mid), "error");
      return;
    }
    const { activePaletteStamp, activeStampId, activeStructureStampId, autoConnectMode, brushSize, selectedTile } = editorState.get();
    const tileset = this.currentTileset();
    const key = `${x},${y}`;
    const firstStrokeTile = this.lastPaintKey === "";
    if (layer !== "event" && key === this.lastPaintKey) return;
    this.lastPaintKey = key;
    // event 레이어에선 타일 도구 동작 안 함.
    const tileLayer: "lower" | "upper" = layer === "upper" ? "upper" : "lower";
    const clickCount =
      layer === "event" ? this.eventLayerClickCount({ mapId: mid, ptr, x, y }) : this.pointerClickCount(ptr);
    if (layer === "event") this.showEventLayerClickFeedback(mid, x, y);

    if (layer === "event" && clickCount >= 2 && this.openExistingEventAt(mid, x, y)) {
      return;
    }

    switch (tool) {
      case "paint":
        recordProjectSnapshot();
        {
          if (activePaletteStamp) {
            this.applyPaletteStamp({ mapId: mid, stamp: activePaletteStamp, x, y });
            break;
          }
          if (activeStructureStampId) {
            placeStructureStamp(mid, { id: activeStructureStampId, origin: { x, y } });
            break;
          }
          const stamp = tileset
            ? tileStampsForTile(selectedTile, tileset).find((candidate) => candidate.id === activeStampId) ?? null
            : tileStampById(activeStampId);
          if (stamp) {
            this.applyStamp({ mapId: mid, layer: tileLayer, x, y, stamp, autoConnect: autoConnectMode });
          } else {
            this.applyBrush({
              centerX: x,
              centerY: y,
              size: brushSize,
              applyCell: (brushX, brushY) => paintTile(mid, tileLayer, brushX, brushY, selectedTile, { autoConnect: autoConnectMode }),
            });
          }
        }
        break;
      case "fill":
        if (firstStrokeTile) {
          recordProjectSnapshot();
          fillTile(mid, tileLayer, x, y, selectedTile, { autoConnect: autoConnectMode });
        }
        break;
      case "erase":
        recordProjectSnapshot();
        this.applyBrush({
          centerX: x,
          centerY: y,
          size: brushSize,
          applyCell: (brushX, brushY) => eraseTile(mid, tileLayer, brushX, brushY, { autoConnect: autoConnectMode }),
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
    const tileset = this.tilesetForMap(target.mapId);
    editorState.set({
      activeStampId: compatibleStampIdForTile(editorState.get().activeStampId, selectedTile, tileset),
      selectedTile,
      layer: target.layer,
      tool: "paint",
    });
  }

  private pickTileAtPointer(ptr: Phaser.Input.Pointer): void {
    const mapId = this.mapId();
    if (!mapId) return;
    const { x, y } = this.pointerToTile(ptr);
    const map = store.getCurrent().maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const pick = visibleTilePickAt(map, y * map.width + x);
    if (!pick) return;
    this.isPainting = false;
    this.lastPaintKey = "";
    const tileset = this.tilesetForMap(mapId);
    editorState.set({
      activePaletteStamp: null,
      activeStampId: compatibleStampIdForTile(editorState.get().activeStampId, pick.tile, tileset),
      activeStructureStampId: null,
      selectedTile: pick.tile,
      layer: pick.layer,
      tool: "paint",
    });
  }

  // 우클릭 셀이 현재 맵의 활성 선택 영역 안이면 "이 영역에 AI 작업…" 메뉴를 연다.
  // 이벤트 레이어에서는 기존 이벤트 항목도 함께 보여 아무것도 잃지 않는다. 편집 잠금
  // 맵이면 열지 않는다(false 반환 → 기존 우클릭 동작으로 폴백).
  private tryOpenRegionTaskMenu(ptr: Phaser.Input.Pointer): boolean {
    const mapId = this.mapId();
    if (!mapId || !canEditMap(mapId)) return false;
    const selection = editorState.get().selection;
    if (!selection || selection.mapId !== mapId) return false;
    const { x, y } = this.pointerToTile(ptr);
    if (!isCellInsideSelection(selection, x, y)) return false;

    const point = this.pointerScreenPosition(ptr);
    const map = store.getCurrent().maps[mapId];
    const eventItems =
      editorState.get().layer === "event"
        ? eventLayerContextMenuItems({ mapId, x, y }).map((item, index) =>
            index === 0 ? { ...item, separatorBefore: true } : item,
          )
        : [];
    this.isPainting = false;
    this.lastPaintKey = "";
    this.lastPointerTile = { x, y };
    openMapContextMenu({
      items: [...regionTaskMenuItems(selection), ...eventItems],
      mapId,
      mapName: `${map?.name ?? mapId} (${x},${y})`,
      point,
    });
    return true;
  }

  private openEventLayerMenu(ptr: Phaser.Input.Pointer): void {
    const mapId = this.mapId();
    if (!mapId) return;
    if (!canEditMap(mapId)) {
      toast(mapEditLockNotice(mapId), "error");
      return;
    }
    const { x, y } = this.pointerToTile(ptr);
    const point = this.pointerScreenPosition(ptr);
    this.isPainting = false;
    this.lastPaintKey = "";
    this.lastPointerTile = { x, y };
    openEventLayerContextMenu({ mapId, point, x, y });
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
    if ((key === "z" || key === "y" || key === "v") && !canEditMap(mid)) {
      event.preventDefault();
      toast(mapEditLockNotice(mid), "error");
      return;
    }
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
      if (editorState.get().layer === "event") {
        const t = this.lastPointerTile;
        if (t) copyEventAt({ mapId: mid, x: t.x, y: t.y });
        return;
      }
      copySelection(mid);
    } else if (key === "v") {
      event.preventDefault();
      if (editorState.get().layer === "event") {
        const selection = editorState.get().selection;
        const t = this.lastPointerTile ?? selection ?? { x: 0, y: 0 };
        pasteEventAt({ mapId: mid, x: t.x, y: t.y });
        return;
      }
      const selection = editorState.get().selection;
      const target = this.lastPointerTile ?? selection ?? { x: 0, y: 0 };
      pasteClipboard(mid, target.x, target.y);
    }
  }

  private pointerToTile(ptr: Phaser.Input.Pointer): { x: number; y: number } {
    const world = ptr.positionToCamera(this.cameras.main) as { readonly x: number; readonly y: number };
    return {
      x: Math.floor(world.x / TILE_SIZE),
      y: Math.floor(world.y / TILE_SIZE),
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

  private toolCanMutateMap(tool: string): boolean {
    return tool === "paint" || tool === "fill" || tool === "erase" || tool === "collision" || tool === "event";
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
  private currentTileset() {
    const mapId = this.mapId();
    return mapId ? this.tilesetForMap(mapId) : undefined;
  }

  private tilesetForMap(mapId: MapId) {
    const project = store.getCurrent();
    const map = project.maps[mapId];
    return map ? project.tilesets[map.tilesetId] : undefined;
  }

  private redraw(): void {
    const mid = this.mapId();
    if (!mid) return;
    const mapChanged = this.lastRenderedMapId !== mid;
    if (mapChanged) {
      this.lastPointerTile = null;
      this.clearHoverPreview();
      this.lastPaintKey = "";
      this.dragOperation = null;
    }
    this.lastRenderedMapId = mid;
    this.lastRenderStateKey = this.renderStateKey(mid);
    const cameraViewKey = this.cameraViewKey(mid);
    const resetCamera = cameraViewKey !== this.lastCameraViewKey;
    this.lastCameraViewKey = cameraViewKey;
    const tileLayer = this.tileLayer;
    const hoverPreviewLayer = this.hoverPreviewLayer;
    const overlayLayer = this.overlayLayer;
    const gridGraphics = this.gridGraphics;
    if (!tileLayer || !hoverPreviewLayer || !overlayLayer || !gridGraphics) return;
    renderEditScene({ scene: this, tileLayer, overlayLayer, gridGraphics, mapId: mid, tileIndex: this.tileIndex, resetCamera });
    this.renderEventLayerClickFeedback();
    if (!mapChanged && this.lastPointerTile) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
  }

  private canIncrementallyRenderCells(mapId: MapId): boolean {
    if (this.lastRenderedMapId !== mapId) return false;
    if (!this.tileLayer || !this.overlayLayer || !this.gridGraphics) return false;
    return this.lastRenderStateKey === this.renderStateKey(mapId);
  }

  private redrawCells(cells: readonly ProjectChangeCell[]): EditSceneRenderStats {
    const mid = this.mapId();
    const tileLayer = this.tileLayer;
    const overlayLayer = this.overlayLayer;
    const gridGraphics = this.gridGraphics;
    if (!mid || !tileLayer || !overlayLayer || !gridGraphics) return { tileObjectsUpdated: 0 };
    const stats = renderEditSceneTileCells({
      scene: this,
      tileLayer,
      overlayLayer,
      gridGraphics,
      mapId: mid,
      tileIndex: this.tileIndex,
    }, cells);
    if (this.lastPointerTile) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
    return stats;
  }

  private applyStamp(input: {
    readonly autoConnect: boolean;
    readonly layer: TileLayer;
    readonly mapId: MapId;
    readonly stamp: TileStamp;
    readonly x: number;
    readonly y: number;
  }): void {
    for (const cell of input.stamp.cells) {
      paintTile(input.mapId, input.layer, input.x + cell.dx, input.y + cell.dy, cell.tile, { autoConnect: input.autoConnect });
    }
  }

  private applyPaletteStamp(input: {
    readonly mapId: MapId;
    readonly stamp: PaletteStamp;
    readonly x: number;
    readonly y: number;
  }): void {
    for (const cell of input.stamp.cells) {
      paintTile(input.mapId, cell.layer, input.x + cell.dx, input.y + cell.dy, cell.tile, { autoConnect: false });
    }
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
      state.autoConnectMode,
      state.activePaletteStamp ? `${state.activePaletteStamp.source.startTile}:${state.activePaletteStamp.source.endTile}` : "none",
      state.activeStampId ?? "none",
      state.activeStructureStampId ?? "none",
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

  private showEventLayerClickFeedback(mapId: MapId, x: number, y: number): void {
    const map = store.getCurrent().maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const hasEvent = committedEvents(map.events).some((event) => event.x === x && event.y === y);
    const mode = hasEvent ? "edit" : "create";
    this.eventLayerClickFeedback = { mapId, x, y, mode };
    setTileToolStatus(
      "event-click-status",
      hasEvent ? `이벤트 ${x},${y} · 더블클릭 편집` : `빈 타일 ${x},${y} · 더블클릭 생성`
    );
    this.renderEventLayerClickFeedback();
  }

  private renderEventLayerClickFeedback(): void {
    const layer = this.eventClickFeedbackLayer;
    if (!layer) return;
    layer.removeAll(true);
    const feedback = this.eventLayerClickFeedback;
    if (!feedback || feedback.mapId !== this.mapId() || editorState.get().layer !== "event") return;
    renderEventLayerClickFeedback({ scene: this, overlayLayer: layer }, feedback);
  }
}

function setTileToolStatus(testId: string, text: string): void {
  const node = document.querySelector(`[data-testid="${testId}"]`);
  if (!node) return;
  node.textContent = text;
}
