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
import { subscribeAgentFocusHighlight, type AgentFocusTarget } from "@/editor/agentFocus";
import { subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { AgentFocusRenderer, AgentGhostPreviewRenderer } from "@/editor/agentPreviewRenderers";
import { CameraPanController, pointerScreenPosition } from "@/editor/CameraPanController";
import { store, type ProjectChangeCell, type ProjectChangeDescriptor } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { showConfirm } from "@/editor/ui/modal";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import {
  renderEventLayerClickFeedback,
  type EventLayerClickFeedback,
} from "@/editor/editSceneEventMarkers";
import { eventLayerSwitchPrompt, eventMarkerTooltip, shouldOfferEventLayerSwitch } from "@/editor/eventMarkerUx";
import { renderHoverTilePreview } from "@/editor/editSceneHoverPreview";
import { planEditSceneRenderForStoreChange } from "@/editor/editSceneRenderPlan";
import { renderEditScene, renderEditSceneTileCells, type EditSceneRenderStats, type EditSceneTileIndex } from "@/editor/editSceneRender";
import { copySelection, pasteClipboard } from "@/editor/mapClipboard";
import { redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { handleEditorKey, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { copyEventAt, openEventLayerContextMenu, pasteEventAt } from "@/editor/panels/eventLayerContextMenu";
import { isCellInsideSelection } from "@/editor/panels/mapSelectionContextMenu";
import { openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { BUILD_PALETTE_VISIBILITY_EVENT, isBuildPaletteEnabled, renderBuildPalettePopup } from "@/editor/panels/buildPalette";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { isSignificantRegionDrag, regionRectFromDrag } from "@/editor/regionRightDrag";
import { selectTileRegion } from "@/editor/mapClipboard";
import { saveProjectNow } from "@/editor/saveActions";
import { TilePaintEngine } from "@/editor/TilePaintEngine";
import { DragOperationHandler } from "@/editor/DragOperationHandler";
import { committedEvents } from "@/project/eventDrafts";
import { topTileInStack } from "@/project/mapOverlayTiles";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";

const PhaserRuntime = getLoadedPhaser();

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

/** 우클릭 드래그: 영역 선택 후 AI 팝오버. 클릭만이면 스포이트. */
type RightRegionGesture = {
  readonly mapId: MapId;
  readonly start: { readonly x: number; readonly y: number };
  readonly screen: { readonly x: number; readonly y: number };
  moved: boolean;
};

const EVENT_LAYER_DOUBLE_CLICK_MS = 500;
const BUILD_PALETTE_GAP_PX = 8;
const BUILD_PALETTE_CANVAS_PADDING_PX = 8;

type TileRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type CameraView = {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
};

type PixelSize = {
  readonly width: number;
  readonly height: number;
};

type PixelPoint = {
  readonly x: number;
  readonly y: number;
};

export function tileRectToScreenRect(rect: TileRect, camera: CameraView, tileSize = TILE_SIZE): TileRect {
  return {
    x: Math.round((rect.x * tileSize - camera.scrollX) * camera.zoom),
    y: Math.round((rect.y * tileSize - camera.scrollY) * camera.zoom),
    width: Math.max(1, Math.round(rect.width * tileSize * camera.zoom)),
    height: Math.max(1, Math.round(rect.height * tileSize * camera.zoom)),
  };
}

export function anchoredBuildPalettePosition(input: {
  readonly selectionRect: TileRect;
  readonly popupSize: PixelSize;
  readonly canvasSize: PixelSize;
  readonly gap?: number;
  readonly padding?: number;
}): PixelPoint {
  const gap = input.gap ?? BUILD_PALETTE_GAP_PX;
  const padding = input.padding ?? BUILD_PALETTE_CANVAS_PADDING_PX;
  const maxX = Math.max(padding, input.canvasSize.width - input.popupSize.width - padding);
  const maxY = Math.max(padding, input.canvasSize.height - input.popupSize.height - padding);
  const rightX = input.selectionRect.x + input.selectionRect.width + gap;
  const leftX = input.selectionRect.x - input.popupSize.width - gap;
  const preferredX = rightX + input.popupSize.width + padding <= input.canvasSize.width ? rightX : leftX;
  const centeredY = input.selectionRect.y + input.selectionRect.height / 2 - input.popupSize.height / 2;
  return {
    x: clampNumber(preferredX, padding, maxX),
    y: clampNumber(centeredY, padding, maxY),
  };
}

export class EditScene extends PhaserRuntime.Scene {
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private hoverPreviewLayer: Phaser.GameObjects.Container | null = null;
  private overlayLayer: Phaser.GameObjects.Container | null = null;
  private agentGhostPreviewLayer: Phaser.GameObjects.Container | null = null;
  private agentFocusHighlightLayer: Phaser.GameObjects.Container | null = null;
  private eventClickFeedbackLayer: Phaser.GameObjects.Container | null = null;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private unsubStore: (() => void) | null = null;
  private unsubEditor: (() => void) | null = null;
  private unsubAgentGhost: (() => void) | null = null;
  private unsubAgentFocus: (() => void) | null = null;
  private agentGhostPreviewRenderer: AgentGhostPreviewRenderer | null = null;
  private agentFocusRenderer: AgentFocusRenderer | null = null;
  private isPainting = false;
  private lastPaintKey = "";
  private lastEventLayerClick: EventLayerClick | null = null;
  private eventLayerClickFeedback: EventLayerClickFeedback | null = null;
  private lastPointerTile: { x: number; y: number } | null = null;
  private lastRenderedMapId: MapId | null = null;
  private lastRenderStateKey = "";
  private lastCameraViewKey = "";
  private readonly tileIndex: EditSceneTileIndex = new Map();
  private cameraPanController: CameraPanController | null = null;
  private tilePaintEngine: TilePaintEngine | null = null;
  private dragOperationHandler: DragOperationHandler | null = null;
  private rightRegionGesture: RightRegionGesture | null = null;
  /** 맵 캔버스에서 우클릭이 시작되면 true. 버튼을 놓는 순간 contextmenu 가 문서 타겟으로 뜨는 경우 대비. */
  private suppressBrowserContextMenuUntil = 0;
  private buildPalettePopup: HTMLElement | null = null;
  private buildPalettePopupKey = "";
  private readonly handleBuildPaletteVisibilityChange = (): void => this.renderBuildPaletteOverlay();
  /**
   * 브라우저 기본 컨텍스트 메뉴만 차단.
   * mousedown/pointerdown 에 preventDefault 하면 Phaser 우클릭 드래그가 먹통이 된다.
   * 우클릭을 '놓는' 순간 contextmenu 가 canvas 밖(body 등)으로 발생하기도 해서 document capture + 시간창을 쓴다.
   */
  private readonly suppressCanvasBrowserMenu = (event: Event): void => {
    if (!this.shouldSuppressBrowserContextMenu(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  private readonly armCanvasRightButtonSuppress = (event: MouseEvent | PointerEvent): void => {
    if (event.button !== 2) return;
    if (!this.isEventOnEditCanvasSurface(event.target)) return;
    // 버튼을 놓은 뒤 contextmenu 가 늦게 뜨는 브라우저를 위해 짧게 유지.
    this.suppressBrowserContextMenuUntil = Date.now() + 1500;
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
    this.agentGhostPreviewLayer = this.add.container(0, 0);
    this.agentGhostPreviewLayer.setDepth(10.5);
    this.agentFocusHighlightLayer = this.add.container(0, 0);
    this.agentFocusHighlightLayer.setDepth(11);
    this.agentGhostPreviewRenderer = new AgentGhostPreviewRenderer(this, this.agentGhostPreviewLayer, () => this.mapId());
    this.agentFocusRenderer = new AgentFocusRenderer(this, this.agentFocusHighlightLayer, () => this.mapId());
    this.cameraPanController = new CameraPanController(this, {
      onPanStart: () => {
        this.isPainting = false;
        this.lastPaintKey = "";
      },
      onPanMove: () => {
        this.refreshAgentGhostDomMarkers();
        this.renderBuildPaletteOverlay();
      },
    });
    this.eventClickFeedbackLayer = this.add.container(0, 0);
    this.eventClickFeedbackLayer.setDepth(12);

    this.bindInput();
    this.redraw();

    // store/에디터 상태 변경 시 재렌더.
    this.unsubStore = store.subscribe((_project, change) => this.redrawForStoreChange(change));
    this.unsubEditor = editorState.subscribe(() => this.redrawWhenViewStateChanges());
    this.unsubAgentGhost = subscribeAgentGhostPreview(() => this.renderAgentGhostPreview());
    this.unsubAgentFocus = subscribeAgentFocusHighlight((target) => this.showAgentFocusHighlight(target));

    this.scale.on("resize", this.handleResize, this);
    window.addEventListener(BUILD_PALETTE_VISIBILITY_EVENT, this.handleBuildPaletteVisibilityChange);

    // scene 정지/파괴 시 구독 해제(이중 호출 방지).
    this.events.once(PhaserRuntime.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(PhaserRuntime.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private cleanup(): void {
    this.unbindCanvasPanGuards();
    this.unbindBrowserContextMenuGuards();
    this.rightRegionGesture = null;
    this.stopPan();
    this.unsubStore?.();
    this.unsubEditor?.();
    this.unsubAgentGhost?.();
    this.unsubAgentFocus?.();
    this.unsubStore = null;
    this.unsubEditor = null;
    this.unsubAgentGhost = null;
    this.unsubAgentFocus = null;
    this.clearAgentGhostPreviewLayer();
    this.clearAgentFocusHighlight();
    window.removeEventListener(BUILD_PALETTE_VISIBILITY_EVENT, this.handleBuildPaletteVisibilityChange);
    this.clearBuildPaletteOverlay();
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
    this.bindBrowserContextMenuGuards();
    // 마우스 다운 → 드래그 중 계속 적용(페인트/충돌/지우개).
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      this.updatePointerStatus(ptr);
      this.updateHoverPreview(ptr);
      if (this.isRightClick(ptr)) {
        // 우클릭: 드래그 시작하면 영역 AI, 클릭만이면 스포이트(아래 pointerup).
        this.beginRightRegionGesture(ptr);
        return;
      }
      if (this.shouldPan(ptr)) {
        this.startPan(ptr);
        return;
      }
      if (this.tryOfferEventLayerSwitchFromPointer(ptr)) return;
      if (this.beginDragOperation(ptr)) return;
      this.isPainting = true;
      this.lastPaintKey = "";
      // 이벤트 레이어: 눌린 칸에 이벤트가 있으면 드래그 이동 후보로 기록(클릭/더블클릭은 그대로).
      this.maybeBeginEventDragCandidate(ptr);
      this.applyAtPointer(ptr);
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      this.updatePointerStatus(ptr);
      // 우클릭 제스처 중에는 버튼 플래그가 브라우저마다 들쭉날쭉해도 추적을 이어간다.
      if (this.rightRegionGesture) {
        this.updateRightRegionGesture(ptr);
        return;
      }
      if (this.getDragOperationHandler().active() && ptr.isDown) {
        this.updateDragOperation(ptr);
        return;
      }
      // 이벤트를 누른 채 다른 칸으로 이동하면 드래그 이동을 시작한다.
      if (ptr.isDown && this.tryPromoteEventDrag(ptr)) return;
      this.updateHoverPreview(ptr);
      if (this.cameraPanController?.active()) {
        this.continuePan(ptr);
        return;
      }
      if (this.isPainting && ptr.isDown) {
        this.applyAtPointer(ptr);
      }
    });
    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      if (this.rightRegionGesture) {
        this.finishRightRegionGesture(ptr);
        return;
      }
      this.finishDragOperation(ptr);
      this.getDragOperationHandler().clearEventCandidate();
      this.isPainting = false;
      this.lastPaintKey = "";
      this.stopPan();
    });
    this.input.on("pointerout", () => {
      if (!this.getDragOperationHandler().active()) this.clearHoverPreview();
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
    return this.cameraPanController?.shouldPan(ptr) ?? false;
  }

  private bindCanvasPanGuards(): void {
    this.cameraPanController?.bindCanvasGuards();
  }

  private unbindCanvasPanGuards(): void {
    this.cameraPanController?.unbindCanvasGuards();
  }

  private bindBrowserContextMenuGuards(): void {
    const canvas = this.game.canvas;
    if (!canvas) return;
    // 메뉴만 막고, pointer down/up 은 Phaser가 받아야 우클릭 드래그가 된다.
    this.input.mouse?.disableContextMenu();
    // document capture: 드래그 후 포인터가 캔버스 밖으로 나간 채 mouseup → contextmenu 가 body에 뜨는 경우 차단.
    document.addEventListener("contextmenu", this.suppressCanvasBrowserMenu, true);
    canvas.addEventListener("mousedown", this.armCanvasRightButtonSuppress, true);
    canvas.addEventListener("pointerdown", this.armCanvasRightButtonSuppress, true);
    const host = canvas.parentElement;
    host?.addEventListener("mousedown", this.armCanvasRightButtonSuppress, true);
    host?.addEventListener("pointerdown", this.armCanvasRightButtonSuppress, true);
  }

  private unbindBrowserContextMenuGuards(): void {
    document.removeEventListener("contextmenu", this.suppressCanvasBrowserMenu, true);
    const canvas = this.game.canvas;
    if (!canvas) return;
    canvas.removeEventListener("mousedown", this.armCanvasRightButtonSuppress, true);
    canvas.removeEventListener("pointerdown", this.armCanvasRightButtonSuppress, true);
    const host = canvas.parentElement;
    host?.removeEventListener("mousedown", this.armCanvasRightButtonSuppress, true);
    host?.removeEventListener("pointerdown", this.armCanvasRightButtonSuppress, true);
    this.suppressBrowserContextMenuUntil = 0;
  }

  private shouldSuppressBrowserContextMenu(event: Event): boolean {
    if (Date.now() < this.suppressBrowserContextMenuUntil) return true;
    if (this.rightRegionGesture) return true;
    return this.isEventOnEditCanvasSurface(event.target);
  }

  private isEventOnEditCanvasSurface(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (target === this.game.canvas) return true;
    if (target.closest?.("[data-testid='edit-canvas']")) return true;
    if (target.closest?.(".phaser-container")) return true;
    if (target.closest?.(".editor-canvas-scroll-shell")) return true;
    return false;
  }

  private isRightClick(ptr: Phaser.Input.Pointer): boolean {
    return ptr.rightButtonDown() || ptr.button === 2;
  }

  private beginRightRegionGesture(ptr: Phaser.Input.Pointer): void {
    const mapId = this.mapId();
    if (!mapId) return;
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    const start = this.pointerToTile(ptr);
    if (start.x < 0 || start.y < 0 || start.x >= map.width || start.y >= map.height) return;
    const screen = this.pointerScreenPosition(ptr);
    this.rightRegionGesture = { mapId, start, screen, moved: false };
    // mouseup 시 contextmenu 가 문서 타겟으로 뜨는 브라우저 대비.
    this.suppressBrowserContextMenuUntil = Date.now() + 1500;
    this.isPainting = false;
    this.lastPaintKey = "";
    // 드래그 미리보기용 1×1 선택(클릭으로 끝나면 스포이트 시 지워도 됨).
    selectTileRegion(mapId, { mapId, x: start.x, y: start.y, width: 1, height: 1 });
  }

  private updateRightRegionGesture(ptr: Phaser.Input.Pointer): void {
    const gesture = this.rightRegionGesture;
    if (!gesture) return;
    const map = store.getCurrent().maps[gesture.mapId];
    if (!map) return;
    const end = this.pointerToTile(ptr);
    const rect = regionRectFromDrag(gesture.start, end, { width: map.width, height: map.height });
    if (!rect) return;
    if (rect.x !== gesture.start.x || rect.y !== gesture.start.y || rect.width > 1 || rect.height > 1) {
      gesture.moved = true;
    }
    selectTileRegion(gesture.mapId, {
      mapId: gesture.mapId,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    this.lastPointerTile = end;
  }

  private finishRightRegionGesture(ptr: Phaser.Input.Pointer): void {
    const gesture = this.rightRegionGesture;
    this.rightRegionGesture = null;
    // 버튼을 놓은 직후 contextmenu 가 한 번 더 올 수 있음.
    this.suppressBrowserContextMenuUntil = Math.max(this.suppressBrowserContextMenuUntil, Date.now() + 800);
    if (!gesture) return;
    const map = store.getCurrent().maps[gesture.mapId];
    if (!map) return;
    const end = this.pointerToTile(ptr);
    const rect = regionRectFromDrag(gesture.start, end, { width: map.width, height: map.height });
    const significant = isSignificantRegionDrag(rect) || gesture.moved;

    const screen = this.pointerScreenPosition(ptr);
    if (significant && rect) {
      // 우클릭 드래그 → 영역 확정 + 포인터 근처 AI 팝오버
      selectTileRegion(gesture.mapId, {
        mapId: gesture.mapId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      this.openRegionAiPopover(gesture.mapId, rect, screen);
      return;
    }

    // 이미 잡혀 있는 다중 선택 안을 우클릭 탭 → 그 영역 AI 팝오버 (스포이트 대신).
    const existing = editorState.get().selection;
    if (
      existing &&
      existing.mapId === gesture.mapId &&
      isSignificantRegionDrag(existing) &&
      isCellInsideSelection(existing, end.x, end.y)
    ) {
      this.openRegionAiPopover(
        existing.mapId,
        { x: existing.x, y: existing.y, width: existing.width, height: existing.height },
        screen,
      );
      return;
    }

    // 우클릭 탭(1칸) → 스포이트. 이벤트 레이어에서는 기존 컨텍스트 메뉴 유지.
    if (editorState.get().layer === "event") {
      this.openEventLayerMenu(ptr);
      return;
    }
    this.getTilePaintEngine().pickTileAtPointer(ptr);
  }

  private openRegionAiPopover(
    mapId: MapId,
    region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    screen: { readonly x: number; readonly y: number },
  ): void {
    if (!canEditMap(mapId)) {
      toast(mapEditLockNotice(mapId), "error");
      return;
    }
    requestAiSelectionContext(
      { mapId, x: region.x, y: region.y, width: region.width, height: region.height },
      false,
    );
    openRegionTaskModal({
      mapId,
      region,
      anchor: { x: screen.x, y: screen.y },
    });
  }

  private startPan(ptr: Phaser.Input.Pointer): void {
    this.cameraPanController?.start(ptr);
  }

  private continuePan(ptr: Phaser.Input.Pointer): void {
    this.cameraPanController?.continue(ptr);
  }

  private stopPan(): void {
    this.cameraPanController?.stop();
  }

  private pointerScreenPosition(ptr: Phaser.Input.Pointer): { readonly x: number; readonly y: number } {
    return pointerScreenPosition(ptr);
  }

  private updateHoverPreview(ptr: Phaser.Input.Pointer): void {
    const { x, y } = this.pointerToTile(ptr);
    this.lastPointerTile = { x, y };
    this.updateEventMarkerTooltip(x, y);
    this.renderHoverPreview(x, y);
  }

  private clearHoverPreview(): void {
    this.lastPointerTile = null;
    this.clearEventMarkerTooltip();
    this.hoverPreviewLayer?.removeAll(true);
  }

  private renderHoverPreview(centerX: number, centerY: number): void {
    const layer = this.hoverPreviewLayer;
    const mapId = this.mapId();
    if (!layer || !mapId) return;
    renderHoverTilePreview({ centerX, centerY, layer, mapId, scene: this });
  }

  private beginDragOperation(ptr: Phaser.Input.Pointer): boolean {
    return this.getDragOperationHandler().begin(ptr);
  }

  // 이벤트 레이어에서 눌린 칸에 이벤트가 있으면 드래그 이동 후보로 기록한다.
  // 실제 드래그(다른 칸으로 이동)가 시작되기 전까지는 클릭/더블클릭 동작을 방해하지 않는다.
  private maybeBeginEventDragCandidate(ptr: Phaser.Input.Pointer): void {
    this.getDragOperationHandler().maybeBeginEventDragCandidate(ptr);
  }

  // 후보 이벤트를 누른 채 다른 칸으로 움직이면 eventMove 드래그로 승격한다.
  private tryPromoteEventDrag(ptr: Phaser.Input.Pointer): boolean {
    return this.getDragOperationHandler().tryPromoteEventDrag(ptr);
  }

  private updateDragOperation(ptr: Phaser.Input.Pointer): void {
    this.getDragOperationHandler().update(ptr);
  }

  private finishDragOperation(ptr: Phaser.Input.Pointer): void {
    this.getDragOperationHandler().finish(ptr);
  }

  private applyAtPointer(ptr: Phaser.Input.Pointer): void {
    this.getTilePaintEngine().applyAtPointer(ptr);
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
    if (this.cameraPanController?.handleSpaceKeyDown(event)) return;
    if (!(event.ctrlKey || event.metaKey) && this.panWithArrowKey(event)) return;
    // RM2K3 스타일 단축키: F5/F6/F7 레이어, 1..7 도구, +/- 줌.
    if (!(event.ctrlKey || event.metaKey) && handleEditorKey(event)) return;
    this.handleShortcut(event);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.cameraPanController?.handleSpaceKeyUp(event);
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
    this.cameraPanController?.panBy(deltaX, deltaY);
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

  private offerEventLayerSwitchAt(mapId: MapId, x: number, y: number, layer: string, clickCount: number): boolean {
    const map = store.getCurrent().maps[mapId];
    const existing = map ? committedEvents(map.events).find((event) => event.x === x && event.y === y) : undefined;
    if (!shouldOfferEventLayerSwitch({ activeLayer: layer as "lower" | "upper" | "event", clickCount, hasEvent: Boolean(existing) })) {
      return false;
    }
    if (!existing) return false;
    // 커스텀 인앱 모달(§2.4): 확인은 비동기로 받고, 제안이 뜬 시점에 페인팅은 즉시 멈춘다.
    this.isPainting = false;
    this.lastPaintKey = "";
    void showConfirm({ title: "이벤트 레이어 전환", message: eventLayerSwitchPrompt(existing), confirmLabel: "전환" }).then((confirmed) => {
      if (!confirmed) {
        toast("이벤트 레이어 전환을 취소했습니다.", "info");
        return;
      }
      editorState.set({ layer: "event", tool: "event", selectedEventId: existing.id, selectedEventPageId: null });
      openEventEditorModal(mapId, existing.id);
    });
    return true;
  }

  private tryOfferEventLayerSwitchFromPointer(ptr: Phaser.Input.Pointer): boolean {
    const mapId = this.mapId();
    if (!mapId) return false;
    const layer = editorState.get().layer;
    if (layer === "event") return false;
    if (!canEditMap(mapId)) return false;
    const { x, y } = this.pointerToTile(ptr);
    return this.offerEventLayerSwitchAt(mapId, x, y, layer, this.pointerClickCount(ptr));
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
  private tilesetForMap(mapId: MapId) {
    const project = store.getCurrent();
    const map = project.maps[mapId];
    return map ? project.tilesets[map.tilesetId] : undefined;
  }

  private getTilePaintEngine(): TilePaintEngine {
    this.tilePaintEngine ??= new TilePaintEngine({
      mapId: () => this.mapId(),
      pointerToTile: (ptr) => this.pointerToTile(ptr),
      updatePointerStatus: (ptr) => this.updatePointerStatus(ptr),
      eventLayerClickCount: (target) => this.eventLayerClickCount(target),
      pointerClickCount: (ptr) => this.pointerClickCount(ptr),
      offerEventLayerSwitchAt: (mapId, x, y, layer, clickCount) => this.offerEventLayerSwitchAt(mapId, x, y, layer, clickCount),
      showEventLayerClickFeedback: (mapId, x, y) => this.showEventLayerClickFeedback(mapId, x, y),
      openExistingEventAt: (mapId, x, y) => this.openExistingEventAt(mapId, x, y),
      handleEventClick: (mapId, x, y, openEditor) => this.handleEventClick(mapId, x, y, openEditor),
      tilesetForMap: (mapId) => this.tilesetForMap(mapId),
      setLastPointerTile: (point) => {
        this.lastPointerTile = point;
      },
      getPaintState: () => ({ isPainting: this.isPainting, lastPaintKey: this.lastPaintKey }),
      setPaintState: (state) => {
        if (state.isPainting !== undefined) this.isPainting = state.isPainting;
        if (state.lastPaintKey !== undefined) this.lastPaintKey = state.lastPaintKey;
      },
    });
    return this.tilePaintEngine;
  }

  private getDragOperationHandler(): DragOperationHandler {
    this.dragOperationHandler ??= new DragOperationHandler(this, {
      mapId: () => this.mapId(),
      pointerToTile: (ptr) => this.pointerToTile(ptr),
      hoverPreviewLayer: () => this.hoverPreviewLayer,
      clearHoverPreview: () => this.clearHoverPreview(),
      showEventLayerClickFeedback: (mapId, x, y) => this.showEventLayerClickFeedback(mapId, x, y),
      setLastPointerTile: (point) => {
        this.lastPointerTile = point;
      },
      setPaintState: (state) => {
        if (state.isPainting !== undefined) this.isPainting = state.isPainting;
        if (state.lastPaintKey !== undefined) this.lastPaintKey = state.lastPaintKey;
      },
    });
    return this.dragOperationHandler;
  }

  private redraw(): void {
    const mid = this.mapId();
    if (!mid) return;
    const mapChanged = this.lastRenderedMapId !== mid;
    if (mapChanged) {
      this.lastPointerTile = null;
      this.clearHoverPreview();
      this.clearAgentFocusHighlight();
      this.lastPaintKey = "";
      this.dragOperationHandler?.clear();
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
    this.renderAgentGhostPreview();
    if (!mapChanged && this.lastPointerTile) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
    this.renderBuildPaletteOverlay();
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
    this.renderBuildPaletteOverlay();
    return stats;
  }

  private redrawWhenViewStateChanges(): void {
    const mid = this.mapId();
    if (!mid) return;
    const nextKey = this.renderStateKey(mid);
    if (nextKey === this.lastRenderStateKey) {
      this.renderBuildPaletteOverlay();
      return;
    }
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

  private updateEventMarkerTooltip(x: number, y: number): void {
    const mapId = this.mapId();
    const canvas = this.game.canvas;
    if (!mapId || !canvas) return;
    const map = store.getCurrent().maps[mapId];
    const existing = map ? committedEvents(map.events).find((event) => event.x === x && event.y === y) : undefined;
    canvas.title = existing ? eventMarkerTooltip(existing) : "";
  }

  private clearEventMarkerTooltip(): void {
    const canvas = this.game.canvas;
    if (canvas) canvas.title = "";
  }

  private renderEventLayerClickFeedback(): void {
    const layer = this.eventClickFeedbackLayer;
    if (!layer) return;
    layer.removeAll(true);
    const feedback = this.eventLayerClickFeedback;
    if (!feedback || feedback.mapId !== this.mapId() || editorState.get().layer !== "event") return;
    renderEventLayerClickFeedback({ scene: this, overlayLayer: layer }, feedback);
  }

  private renderAgentGhostPreview(): void {
    this.agentGhostPreviewRenderer?.render();
  }

  private clearAgentGhostPreviewLayer(): void {
    this.agentGhostPreviewRenderer?.clear();
  }

  private refreshAgentGhostDomMarkers(): void {
    this.agentGhostPreviewRenderer?.refreshDomMarkers();
  }

  private showAgentFocusHighlight(target: AgentFocusTarget): void {
    this.agentFocusRenderer?.show(target);
  }

  private clearAgentFocusHighlight(): void {
    this.agentFocusRenderer?.clear();
  }

  private renderBuildPaletteOverlay(): void {
    if (typeof document === "undefined") return;
    const selection = editorState.get().selection;
    const mapId = this.mapId();
    if (!isBuildPaletteEnabled() || !selection || selection.mapId !== mapId) {
      this.clearBuildPaletteOverlay();
      return;
    }
    const host = this.game.canvas.parentElement;
    if (!host) {
      this.clearBuildPaletteOverlay();
      return;
    }

    const popupKey = `${selection.mapId}:${selection.x}:${selection.y}:${selection.width}:${selection.height}`;
    if (!this.buildPalettePopup || this.buildPalettePopupKey !== popupKey || !this.buildPalettePopup.isConnected) {
      this.clearBuildPaletteOverlay();
      const popup = renderBuildPalettePopup();
      if (!popup) return;
      popup.classList.add("build-palette-floating");
      popup.style.left = "0px";
      popup.style.top = "0px";
      popup.style.visibility = "hidden";
      host.append(popup);
      this.buildPalettePopup = popup;
      this.buildPalettePopupKey = popupKey;
    }
    this.positionBuildPaletteOverlay(selection);
  }

  private positionBuildPaletteOverlay(selection: TileRect): void {
    const popup = this.buildPalettePopup;
    if (!popup) return;
    const canvas = this.game.canvas;
    const host = canvas.parentElement;
    if (!host) return;
    const camera = this.cameras.main;
    const selectionRect = tileRectToScreenRect(selection, {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
    });
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const popupSize = {
      width: Math.max(1, popupRect.width || popup.offsetWidth || 184),
      height: Math.max(1, popupRect.height || popup.offsetHeight || 140),
    };
    const canvasSize = {
      width: Math.max(1, canvasRect.width || canvas.width),
      height: Math.max(1, canvasRect.height || canvas.height),
    };
    const point = anchoredBuildPalettePosition({ selectionRect, popupSize, canvasSize });
    popup.style.left = `${Math.round(canvasRect.left - hostRect.left + point.x)}px`;
    popup.style.top = `${Math.round(canvasRect.top - hostRect.top + point.y)}px`;
    popup.style.visibility = "";
  }

  private clearBuildPaletteOverlay(): void {
    this.buildPalettePopup?.remove();
    this.buildPalettePopup = null;
    this.buildPalettePopupKey = "";
  }
}

function setTileToolStatus(testId: string, text: string): void {
  const node = document.querySelector(`[data-testid="${testId}"]`);
  if (!node) return;
  node.textContent = text;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
