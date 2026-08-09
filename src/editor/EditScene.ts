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
import { subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { AgentFocusRenderer, AgentGhostPreviewRenderer } from "@/editor/agentPreviewRenderers";
import { subscribeInlineProposalActions } from "@/editor/proposalInlineApproval";
import { CameraPanController, pointerScreenPosition } from "@/editor/CameraPanController";
import { store, type ProjectChangeCell, type ProjectChangeDescriptor } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import {
  renderEventLayerClickFeedback,
  type EventLayerClickFeedback,
} from "@/editor/editSceneEventMarkers";
import {
  buildEventMarkerTooltipModel,
  eventLayerSwitchNotice,
  renderEventMarkerTooltipElement,
  shouldOfferEventLayerSwitch,
} from "@/editor/eventMarkerUx";
import { renderHoverTilePreview, shouldShowPaintHoverPreview } from "@/editor/editSceneHoverPreview";
import { planEditSceneRenderForStoreChange } from "@/editor/editSceneRenderPlan";
import { renderEditScene, renderEditSceneTileCells, type EditSceneRenderStats, type EditSceneTileIndex } from "@/editor/editSceneRender";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import {
  cancelPastePreview,
  clearSelection,
  confirmPastePreview,
  copySelection,
  enterPastePreview,
  movePastePreview,
  selectTileRegion,
} from "@/editor/mapClipboard";
import { redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { handleEditorKey, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { copyEventAt, openEventLayerContextMenu, pasteEventAt } from "@/editor/panels/eventLayerContextMenu";
import { isCellInsideSelection } from "@/editor/panels/mapSelectionContextMenu";
import {
  isRegionTaskModalOpen,
  openRegionTaskModal,
  REGION_TASK_MODAL_EVENT,
} from "@/editor/panels/regionTaskModal";
import { REGION_TASK_STATUS_EVENT, regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { BUILD_PALETTE_VISIBILITY_EVENT, isBuildPaletteEnabled, renderBuildPalettePopup } from "@/editor/panels/buildPalette";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { setEditorMapViewport } from "@/editor/editorMapViewport";
import { computeMapViewport } from "@/ai/mapViewportContext";
import { renderSelectionActionChips } from "@/editor/selectionActionChips";
import {
  anchoredBuildPalettePosition,
  anchoredSelectionChipsPosition,
} from "@/editor/selectionOverlayAnchor";
import { isSignificantRegionDrag, regionRectFromDrag } from "@/editor/regionRightDrag";
import { saveProjectNow } from "@/editor/saveActions";
import { TilePaintEngine } from "@/editor/TilePaintEngine";
import { DragOperationHandler } from "@/editor/DragOperationHandler";
import { editorWorkingEvents } from "@/project/eventDrafts";
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

export function tileRectToScreenRect(rect: TileRect, camera: CameraView, tileSize = TILE_SIZE): TileRect {
  return {
    x: Math.round((rect.x * tileSize - camera.scrollX) * camera.zoom),
    y: Math.round((rect.y * tileSize - camera.scrollY) * camera.zoom),
    width: Math.max(1, Math.round(rect.width * tileSize * camera.zoom)),
    height: Math.max(1, Math.round(rect.height * tileSize * camera.zoom)),
  };
}

// 위치 헬퍼는 selectionOverlayAnchor.ts — 테스트/재사용용 re-export
export { anchoredBuildPalettePosition, anchoredSelectionChipsPosition } from "@/editor/selectionOverlayAnchor";

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
  private unsubCameraFocus: (() => void) | null = null;
  private unsubInlineApproval: (() => void) | null = null;
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
  /** 마지막 우클릭 드래그가 끝난 화면 좌표 — 칩 바를 놓은 자리에 띄우기 위한 anchor. */
  private lastRightDragScreen: { readonly x: number; readonly y: number } | null = null;
  /** 맵 캔버스에서 우클릭이 시작되면 true. 버튼을 놓는 순간 contextmenu 가 문서 타겟으로 뜨는 경우 대비. */
  private suppressBrowserContextMenuUntil = 0;
  private buildPalettePopup: HTMLElement | null = null;
  private buildPalettePopupKey = "";
  private readonly handleBuildPaletteVisibilityChange = (): void => this.renderBuildPaletteOverlay();
  private activeRegionTask: { readonly mapId: string; readonly region: RegionRect; readonly phase: "running" | "pending"; readonly runId: number | null } | null = null;
  private regionTaskBadge: HTMLElement | null = null;
  private eventMarkerTooltipEl: HTMLElement | null = null;
  private eventMarkerTooltipKey = "";
  private readonly handleRegionTaskStatus = (event: Event): void => {
    const detail = regionTaskStatusDetail(event);
    if (!detail) return;
    const activeRunId = this.activeRegionTask?.runId ?? null;
    if (detail.running) {
      if (detail.runId !== undefined && activeRunId !== null && detail.runId < activeRunId) return;
      this.activeRegionTask = {
        mapId: detail.mapId,
        region: detail.region,
        phase: detail.phase ?? "running",
        runId: detail.runId ?? null,
      };
    } else {
      if (
        this.activeRegionTask &&
        detail.runId !== undefined &&
        activeRunId !== null &&
        detail.runId !== activeRunId
      ) return;
      this.activeRegionTask = null;
    }
    this.renderRegionTaskBadge();
  };
  /** 영역 작업 창 열림/닫힘 → 선택 칩 오버레이를 숨기거나 되살린다. */
  private readonly handleRegionTaskModalToggle = (): void => {
    this.renderBuildPaletteOverlay();
  };
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
    loadBundledAssets(this, store.getCurrent());
  }

  create(): void {
    registerBundledFrames(this, store.getCurrent());
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
        this.publishMapViewport();
      },
    });
    this.eventClickFeedbackLayer = this.add.container(0, 0);
    this.eventClickFeedbackLayer.setDepth(12);

    this.bindInput();
    this.redraw();

    // store/에디터 상태 변경 시 재렌더.
    this.unsubStore = store.subscribe((_project, change) => {
      this.clearInvalidPendingEventCoordinate();
      this.redrawForStoreChange(change);
    });
    this.unsubEditor = editorState.subscribe((state) => {
      const pending = state.pendingEventCoordinate;
      if (pending && (this.mapId() !== pending.mapId || state.layer !== "event" || state.tool !== "event")) {
        editorState.set({ pendingEventCoordinate: null });
        return;
      }
      this.redrawWhenViewStateChanges();
    });
    this.unsubAgentFocus = subscribeAgentFocusHighlight((target) => this.showAgentFocusHighlight(target));
    this.unsubCameraFocus = subscribeEditorCameraFocus((target) => this.panCameraToTile(target));
    this.unsubAgentGhost = subscribeAgentGhostPreview(() => this.renderAgentGhostPreview());

    this.scale.on("resize", this.handleResize, this);
    window.addEventListener(BUILD_PALETTE_VISIBILITY_EVENT, this.handleBuildPaletteVisibilityChange);
    window.addEventListener(REGION_TASK_STATUS_EVENT, this.handleRegionTaskStatus);
    // 영역 작업 창이 닫히면 선택 칩 오버레이를 되살린다(열릴 때는 숨긴다).
    window.addEventListener(REGION_TASK_MODAL_EVENT, this.handleRegionTaskModalToggle);
    this.unsubInlineApproval = subscribeInlineProposalActions(() => this.refreshAgentGhostDomMarkers());
    if (typeof window !== "undefined") {
      (window as any).__rpgzzuEditCamera = () => {
        const c = this.cameras.main;
        return { scrollX: c.scrollX, scrollY: c.scrollY, width: c.width, height: c.height, zoom: c.zoom };
      };
    }

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
    this.unsubCameraFocus?.();
    this.unsubStore = null;
    this.unsubEditor = null;
    this.unsubAgentGhost = null;
    this.unsubAgentFocus = null;
    this.unsubCameraFocus = null;
    this.clearAgentGhostPreviewLayer();
    this.clearAgentFocusHighlight();
    window.removeEventListener(BUILD_PALETTE_VISIBILITY_EVENT, this.handleBuildPaletteVisibilityChange);
    window.removeEventListener(REGION_TASK_STATUS_EVENT, this.handleRegionTaskStatus);
    window.removeEventListener(REGION_TASK_MODAL_EVENT, this.handleRegionTaskModalToggle);
    this.unsubInlineApproval?.();
    this.unsubInlineApproval = null;
    if (typeof window !== "undefined") {
      delete (window as any).__rpgzzuEditCamera;
    }
    this.clearBuildPaletteOverlay();
    this.regionTaskBadge?.remove();
    this.regionTaskBadge = null;
    this.activeRegionTask = null;
    setEditorMapViewport(null);
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
      // 붙여넣기 미리보기 모드: 좌클릭 → 확정, 우클릭 → 취소.
      if (editorState.get().pastePreview) {
        const mid = this.mapId();
        const { x, y } = this.pointerToTile(ptr);
        if (this.isRightClick(ptr) || !mid || x < 0 || y < 0) {
          cancelPastePreview();
        } else {
          confirmPastePreview(mid);
        }
        return;
      }
      if (this.isRightClick(ptr)) {
        // 우클릭: 드래그 시작하면 영역 AI, 클릭만이면 스포이트(아래 pointerup).
        this.updateHoverPreview(ptr);
        this.beginRightRegionGesture(ptr);
        return;
      }
      if (this.shouldPan(ptr)) {
        this.startPan(ptr);
        return;
      }
      if (this.tryOfferEventLayerSwitchFromPointer(ptr)) return;
      this.clearPendingEventCoordinateForPointerContext(ptr);
      if (this.beginDragOperation(ptr)) return;
      // 페인트 시작 전 호버(raw 팔레트 타일)를 지운다 — 성형된 결과와 겹쳐 깜빡이는 UX 방지.
      this.suppressPaintHoverPreview();
      this.isPainting = true;
      this.lastPaintKey = "";
      // 이벤트 레이어: 눌린 칸에 이벤트가 있으면 드래그 이동 후보로 기록(클릭/더블클릭은 그대로).
      this.maybeBeginEventDragCandidate(ptr);
      this.applyAtPointer(ptr);
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      this.updatePointerStatus(ptr);
      // 붙여넣기 미리보기: 커서 추종.
      if (editorState.get().pastePreview) {
        const mid = this.mapId();
        const { x, y } = this.pointerToTile(ptr);
        this.lastPointerTile = { x, y };
        if (mid) movePastePreview(mid, x, y);
        this.renderPastePreviewGhost();
        return;
      }
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
      // 스트로크 종료 후 호버 복원 (성형된 맵 타일 위에 raw 프리뷰 가능).
      this.updateHoverPreview(ptr);
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
    // 우클릭 시작 시점에는 기존 선택을 유지 — 드래그가 실제로 진행되면 updateRightRegionGesture에서 새 선택을 만든다.
    // 이전에는 여기서 1×1 선택을 만들었는데, 클릭으로 끝나면 1×1 박스가 캔버스에 남는 문제가 있었다.
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
      // 우클릭 드래그 → 영역 선택 확정 + **놓은 자리에 영역 작업 창을 바로 띄운다.**
      // 예전에는 선택 칩 바만 떴고 그 안의 「AI」를 한 번 더 눌러야 이 창이 나왔다.
      // 우클릭 드래그로 영역을 잡는 목적이 사실상 AI 작업이므로 그 한 단계를 없앴다.
      // 칩(복사/붙여넣기/지우기)은 창을 닫으면 선택이 남아 있어 그때 나타난다.
      this.lastRightDragScreen = screen;
      selectTileRegion(gesture.mapId, {
        mapId: gesture.mapId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      this.openRegionAiPopover(
        gesture.mapId,
        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        screen,
      );
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

    // 우클릭 탭(1칸) → 스포이트. 드래그 미리보기로 만든 1×1 선택을 해제한다.
    // 이벤트 레이어에서는 기존 컨텍스트 메뉴 유지.
    if (editorState.get().layer === "event") {
      this.openEventLayerMenu(ptr);
      return;
    }
    // 스포이트 직전 1×1 잔여 선택 박스 제거 — 기존 다중 선택이 있으면 유지.
    const sel = editorState.get().selection;
    if (sel && sel.width <= 1 && sel.height <= 1 && sel.mapId === gesture.mapId) {
      editorState.set({ selection: null });
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
    if (!this.shouldRenderPaintHover()) {
      this.hoverPreviewLayer?.removeAll(true);
      return;
    }
    this.renderHoverPreview(x, y);
  }

  private clearHoverPreview(): void {
    this.lastPointerTile = null;
    this.clearEventMarkerTooltip();
    this.hoverPreviewLayer?.removeAll(true);
  }

  /** 페인트 스트로크 중 raw 호버만 제거 (포인터 좌표·툴팁 상태 유지). */
  private suppressPaintHoverPreview(): void {
    this.hoverPreviewLayer?.removeAll(true);
  }

  // ── 붙여넣기 미리보기 고스트 ──
  // 클립보드 내용을 반투명 타일로 커서 위치에 그린다.
  private renderPastePreviewGhost(): void {
    const layer = this.hoverPreviewLayer;
    if (!layer) return;
    layer.removeAll(true);
    const preview = editorState.get().pastePreview;
    const clipboard = editorState.get().clipboard;
    if (!preview || !clipboard) return;
    const mapId = this.mapId();
    if (!mapId) return;
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) return;
    for (let cy = 0; cy < clipboard.height; cy++) {
      for (let cx = 0; cx < clipboard.width; cx++) {
        const x = preview.x + cx;
        const y = preview.y + cy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const idx = cy * clipboard.width + cx;
        // 하위 레이어
        const lowerTile = clipboard.lower.tiles[idx];
        if (lowerTile !== undefined && lowerTile >= 0) {
          const obj = createChipsetTileObject(this, map, tileset, x, y, lowerTile);
          obj.setAlpha(0.4);
          layer.add(obj);
        }
        // 상위 레이어
        const upperTile = clipboard.upper.tiles[idx];
        if (upperTile !== undefined && upperTile >= 0) {
          const obj = createChipsetTileObject(this, map, tileset, x, y, upperTile);
          obj.setAlpha(0.55);
          layer.add(obj);
        }
      }
    }
    // 외곽선 — 붙여넣기 범위 표시.
    const w = Math.min(clipboard.width, map.width - preview.x);
    const h = Math.min(clipboard.height, map.height - preview.y);
    if (w > 0 && h > 0) {
      const border = this.add.rectangle(
        preview.x * TILE_SIZE,
        preview.y * TILE_SIZE,
        w * TILE_SIZE,
        h * TILE_SIZE,
        0x51cf66,
        0.08,
      );
      border.setOrigin(0, 0);
      border.setStrokeStyle(2, 0x51cf66, 0.9);
      layer.add(border);
    }
  }

  private clearPastePreviewGhost(): void {
    this.hoverPreviewLayer?.removeAll(true);
  }

  private shouldRenderPaintHover(): boolean {
    return shouldShowPaintHoverPreview({
      isPainting: this.isPainting,
      dragActive: this.getDragOperationHandler().active(),
    });
  }

  private renderHoverPreview(centerX: number, centerY: number): void {
    const layer = this.hoverPreviewLayer;
    const mapId = this.mapId();
    if (!layer || !mapId) return;
    if (!this.shouldRenderPaintHover()) {
      layer.removeAll(true);
      return;
    }
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
    editorState.set({ pendingEventCoordinate: null });
    if (!canEditMap(mapId)) {
      editorState.set({ pendingEventCoordinate: null });
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
    if (!(event.ctrlKey || event.metaKey) && event.key === "Escape" && this.handleEscapeKey()) return;
    // RM2K3 스타일 단축키: F5/F6/F7 레이어, 1..7 도구, +/- 줌.
    if (!(event.ctrlKey || event.metaKey) && handleEditorKey(event)) return;
    this.handleShortcut(event);
  }

  private handleEscapeKey(): boolean {
    // 붙여넣기 미리보기 취소가 최우선.
    if (cancelPastePreview()) {
      this.clearPastePreviewGhost();
      return true;
    }
    // 그 다음 선택 해제.
    if (editorState.get().selection) {
      clearSelection();
      return true;
    }
    return false;
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
      // Ctrl+V: 붙여넣기 미리보기 모드 진입 — 고스트가 커서를 추종하고 클릭으로 확정.
      const lastPos = this.lastPointerTile ?? editorState.get().selection ?? { x: 0, y: 0 };
      if (enterPastePreview(mid, lastPos.x, lastPos.y)) {
        this.renderPastePreviewGhost();
      }
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
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) {
      editorState.set({ pendingEventCoordinate: null });
      return;
    }
    const existing = editorWorkingEvents(map.events).find((e) => e.x === x && e.y === y);
    if (existing) {
      editorState.set({ selectedEventId: existing.id, selectedEventPageId: null, pendingEventCoordinate: null });
      if (openEditor) openEventEditorModal(mapId, existing.id);
    } else if (openEditor) {
      editorState.set({ pendingEventCoordinate: null });
      openNewEventEditorModal(mapId, x, y);
    } else {
      editorState.set({ selectedEventId: null, selectedEventPageId: null, pendingEventCoordinate: { mapId, x, y } });
    }
  }

  private clearPendingEventCoordinateForPointerContext(ptr: Phaser.Input.Pointer): void {
    const pending = editorState.get().pendingEventCoordinate;
    if (!pending) return;
    const mapId = this.mapId();
    const map = mapId ? store.getCurrent().maps[mapId] : undefined;
    const { x, y } = this.pointerToTile(ptr);
    const validEmptyEventTile = Boolean(
      mapId &&
      map &&
      canEditMap(mapId) &&
      editorState.get().layer === "event" &&
      editorState.get().tool === "event" &&
      x >= 0 &&
      y >= 0 &&
      x < map.width &&
      y < map.height &&
      !editorWorkingEvents(map.events).some((event) => event.x === x && event.y === y),
    );
    if (!validEmptyEventTile) editorState.set({ pendingEventCoordinate: null });
  }

  private clearInvalidPendingEventCoordinate(): void {
    const pending = editorState.get().pendingEventCoordinate;
    if (!pending) return;
    const map = store.getCurrent().maps[pending.mapId];
    const valid = Boolean(
      map &&
      pending.x >= 0 &&
      pending.y >= 0 &&
      pending.x < map.width &&
      pending.y < map.height &&
      !editorWorkingEvents(map.events).some((event) => event.x === pending.x && event.y === pending.y),
    );
    if (!valid) editorState.set({ pendingEventCoordinate: null });
  }

  private offerEventLayerSwitchAt(mapId: MapId, x: number, y: number, layer: string, clickCount: number): boolean {
    const map = store.getCurrent().maps[mapId];
    const existing = map ? editorWorkingEvents(map.events).find((event) => event.x === x && event.y === y) : undefined;
    if (!shouldOfferEventLayerSwitch({ activeLayer: layer as "lower" | "upper" | "event", clickCount, hasEvent: Boolean(existing) })) {
      return false;
    }
    if (!existing) return false;
    // 더블클릭은 "이걸 편집하고 싶다"가 명확하다(D13) — 확인 모달 없이 즉시 전환하고 편집기를 연다.
    this.isPainting = false;
    this.lastPaintKey = "";
    editorState.set({ layer: "event", tool: "event", selectedEventId: existing.id, selectedEventPageId: null });
    toast(eventLayerSwitchNotice(existing), "info");
    openEventEditorModal(mapId, existing.id);
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
    const existing = map ? editorWorkingEvents(map.events).find((event) => event.x === x && event.y === y) : undefined;
    if (!existing) return false;
    this.isPainting = false;
    this.lastPaintKey = "";
    editorState.set({ selectedEventId: existing.id, selectedEventPageId: null, pendingEventCoordinate: null });
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
    // 프로젝트 교체 후에도 옛 mapId가 남아 있으면 맵이 안 그려지므로 유효한 id로 해석한다.
    const project = store.getCurrent();
    const preferred = editorState.get().currentMapId;
    if (preferred && project.maps[preferred]) return preferred;
    if (project.maps[project.startMapId]) return project.startMapId;
    const first = Object.keys(project.maps)[0];
    return first ?? null;
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
    this.publishMapViewport();
    if (!mapChanged && this.lastPointerTile && this.shouldRenderPaintHover()) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
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
    if (this.lastPointerTile && this.shouldRenderPaintHover()) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
    this.renderBuildPaletteOverlay();
    return stats;
  }

  private redrawWhenViewStateChanges(): void {
    const mid = this.mapId();
    if (!mid) return;
    const nextKey = this.renderStateKey(mid);
    if (nextKey === this.lastRenderStateKey) {
      // 붙여넣기 미리보기 고스트 — editorState 변화(위치 이동 등)마다 갱신.
      if (editorState.get().pastePreview) {
        this.renderPastePreviewGhost();
      } else {
        this.clearPastePreviewGhost();
      }
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
      state.brushSize,
      state.selectedEventId ?? "none",
      selectionKey,
    ].join("|");
  }

  /** AI 어시스턴트용: 현재 카메라가 비추는 타일 뷰포트를 게시한다. */
  private publishMapViewport(): void {
    const mapId = this.mapId();
    const project = store.getCurrent();
    const map = mapId ? project.maps[mapId] : undefined;
    if (!mapId || !map) {
      setEditorMapViewport(null);
      return;
    }
    const camera = this.cameras.main;
    const tileSize = map.tileSize || TILE_SIZE;
    const snapshot = computeMapViewport(
      map,
      {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom,
        viewWidthPx: this.scale.width,
        viewHeightPx: this.scale.height,
        tileSize,
      },
    );
    setEditorMapViewport(snapshot);
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
    const hasEvent = editorWorkingEvents(map.events).some((event) => event.x === x && event.y === y);
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
    if (!mapId || !canvas) {
      this.clearEventMarkerTooltip();
      return;
    }
    const map = store.getCurrent().maps[mapId];
    const existing = map ? editorWorkingEvents(map.events).find((event) => event.x === x && event.y === y) : undefined;
    if (!existing) {
      this.clearEventMarkerTooltip();
      return;
    }

    const model = buildEventMarkerTooltipModel(existing);
    // Native title remains for accessibility / no-DOM fallbacks.
    canvas.title = model.plainText;

    const host = canvas.parentElement;
    if (!host || typeof document === "undefined") return;

    const key = `${mapId}:${existing.id}:${model.plainText}`;
    if (!this.eventMarkerTooltipEl || !this.eventMarkerTooltipEl.isConnected || this.eventMarkerTooltipKey !== key) {
      this.eventMarkerTooltipEl?.remove();
      const tip = renderEventMarkerTooltipElement(model);
      host.append(tip);
      this.eventMarkerTooltipEl = tip;
      this.eventMarkerTooltipKey = key;
    }

    this.positionEventMarkerTooltip(x, y);
  }

  private clearEventMarkerTooltip(): void {
    const canvas = this.game.canvas;
    if (canvas) canvas.title = "";
    this.eventMarkerTooltipEl?.remove();
    this.eventMarkerTooltipEl = null;
    this.eventMarkerTooltipKey = "";
  }

  private positionEventMarkerTooltip(tileX: number, tileY: number): void {
    const tip = this.eventMarkerTooltipEl;
    const canvas = this.game.canvas;
    const host = canvas?.parentElement;
    if (!tip || !canvas || !host) return;

    const camera = this.cameras.main;
    const tileRect = tileRectToScreenRect(
      { x: tileX, y: tileY, width: 1, height: 1 },
      { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom },
    );
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const tipWidth = Math.max(1, tipRect.width || tip.offsetWidth || 180);
    const tipHeight = Math.max(1, tipRect.height || tip.offsetHeight || 72);
    const hostWidth = Math.max(1, hostRect.width);
    const hostHeight = Math.max(1, hostRect.height);

    const canvasOffsetX = canvasRect.left - hostRect.left;
    const canvasOffsetY = canvasRect.top - hostRect.top;
    const GAP = 8;

    // Center horizontally above the event tile.
    let left = canvasOffsetX + tileRect.x + (tileRect.width - tipWidth) / 2;
    // Default: directly above the tile.
    let top = canvasOffsetY + tileRect.y - tipHeight - GAP;
    let placedAbove = true;

    // Not enough room above — flip below the tile.
    if (top < 8) {
      top = canvasOffsetY + tileRect.y + tileRect.height + GAP;
      placedAbove = false;
    }

    // Clamp horizontally into the host.
    if (left < 8) left = 8;
    if (left + tipWidth > hostWidth - 8) {
      left = hostWidth - tipWidth - 8;
    }

    // Clamp vertically.
    if (top + tipHeight > hostHeight - 8) {
      top = hostHeight - tipHeight - 8;
    }
    if (top < 8) top = 8;

    tip.classList.toggle("tip-above", placedAbove);
    tip.classList.toggle("tip-below", !placedAbove);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
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

  private panCameraToTile(target: CameraFocusTarget): void {
    const mid = this.mapId();
    if (!mid || target.mapId !== mid) return;
    const map = store.getCurrent().maps[target.mapId];
    if (!map) return;
    if (target.tileX < 0 || target.tileY < 0 || target.tileX >= map.width || target.tileY >= map.height) return;
    const worldX = (target.tileX + 0.5) * TILE_SIZE;
    const worldY = (target.tileY + 0.5) * TILE_SIZE;
    this.cameras.main.pan(worldX, worldY, 300, "Cubic.easeOut", true);
  }

  private renderBuildPaletteOverlay(): void {
    if (typeof document === "undefined") return;
    const selection = editorState.get().selection;
    const mapId = this.mapId();
    // 영역 작업 창이 열려 있으면 칩/팔레트 오버레이를 띄우지 않는다 — 우클릭 드래그가 창을
    // 바로 열게 되면서 둘이 동시에 떠 화면이 어수선해졌다. 창을 닫으면 다시 나타난다.
    if (isRegionTaskModalOpen()) {
      this.clearBuildPaletteOverlay();
      this.renderRegionTaskBadge();
      return;
    }
    if (!selection || selection.mapId !== mapId) {
      this.clearBuildPaletteOverlay();
      this.renderRegionTaskBadge();
      return;
    }
    const host = this.game.canvas.parentElement;
    if (!host) {
      this.clearBuildPaletteOverlay();
      this.renderRegionTaskBadge();
      return;
    }

    const kind = isBuildPaletteEnabled() ? "build" : "chips";
    const popupKey = `${kind}:${selection.mapId}:${selection.x}:${selection.y}:${selection.width}:${selection.height}`;
    if (!this.buildPalettePopup || this.buildPalettePopupKey !== popupKey || !this.buildPalettePopup.isConnected) {
      this.clearBuildPaletteOverlay();
      const popup = kind === "build" ? renderBuildPalettePopup() : renderSelectionActionChips(selection);
      if (!popup) {
        this.renderRegionTaskBadge();
        return;
      }
      popup.classList.add("build-palette-floating");
      popup.style.left = "0px";
      popup.style.top = "0px";
      popup.style.visibility = "hidden";
      host.append(popup);
      this.buildPalettePopup = popup;
      this.buildPalettePopupKey = popupKey;
    }
    this.positionBuildPaletteOverlay(selection);
    this.renderRegionTaskBadge();
  }

  private positionBuildPaletteOverlay(selection: TileRect): void {
    const popup = this.buildPalettePopup;
    if (!popup) return;
    const canvas = this.game.canvas;
    const host = canvas.parentElement;
    if (!host) return;
    const isChips = popup.classList.contains("selection-action-chips");
    const camera = this.cameras.main;
    const selectionRect = tileRectToScreenRect(selection, {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
    });
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    // visibility:hidden 첫 프레임에서 0 크기가 나올 수 있어 칩/팔레트 기본값을 다르게 둔다.
    const fallback = isChips ? { width: 420, height: 44 } : { width: 228, height: 140 };
    const popupRect = popup.getBoundingClientRect();
    const popupSize = {
      width: Math.max(1, popupRect.width || popup.offsetWidth || fallback.width),
      height: Math.max(1, popupRect.height || popup.offsetHeight || fallback.height),
    };
    const canvasSize = {
      width: Math.max(1, canvasRect.width || canvas.width),
      height: Math.max(1, canvasRect.height || canvas.height),
    };
    const point = isChips
      ? anchoredSelectionChipsPosition({
          selectionRect,
          popupSize,
          canvasSize,
          // lastRightDragScreen 은 viewport 좌표 — 캔버스 내 좌표로 변환해 전달.
          // 선택 칩을 드래그 놓은 자리(context-menu 처럼)에 띄운다.
          pointer: this.lastRightDragScreen
            ? {
                x: this.lastRightDragScreen.x - canvasRect.left,
                y: this.lastRightDragScreen.y - canvasRect.top,
              }
            : undefined,
        })
      : anchoredBuildPalettePosition({ selectionRect, popupSize, canvasSize });
    if (isChips) {
      // overflow:hidden 호스트/상태바 클리핑을 피하려고 viewport fixed 로 올린다.
      popup.style.position = "fixed";
      popup.style.left = `${Math.round(canvasRect.left + point.x)}px`;
      popup.style.top = `${Math.round(canvasRect.top + point.y)}px`;
      popup.style.right = "auto";
      popup.style.bottom = "auto";
    } else {
      popup.style.position = "absolute";
      popup.style.left = `${Math.round(canvasRect.left - hostRect.left + point.x)}px`;
      popup.style.top = `${Math.round(canvasRect.top - hostRect.top + point.y)}px`;
    }
    popup.style.visibility = "";
    // 실제 렌더 크기로 한 번 더 맞춤(칩 바가 가로로 늘어난 뒤 중앙 정렬 보정).
    if (isChips && (popupRect.width < 8 || popupRect.height < 8)) {
      requestAnimationFrame(() => {
        if (this.buildPalettePopup === popup && popup.isConnected) {
          this.positionBuildPaletteOverlay(selection);
        }
      });
    }
  }

  private clearBuildPaletteOverlay(): void {
    this.buildPalettePopup?.remove();
    this.buildPalettePopup = null;
    this.buildPalettePopupKey = "";
  }

  private renderRegionTaskBadge(): void {
    if (typeof document === "undefined") return;
    const task = this.activeRegionTask;
    const mapId = this.mapId();
    const host = this.game.canvas?.parentElement;
    if (!task || task.mapId !== mapId || !host) {
      this.regionTaskBadge?.remove();
      this.regionTaskBadge = null;
      return;
    }
    if (!this.regionTaskBadge || !this.regionTaskBadge.isConnected) {
      const badge = document.createElement("div");
      badge.className = "region-task-badge";
      badge.dataset.testid = "region-task-badge";
      host.append(badge);
      this.regionTaskBadge = badge;
    }
    this.regionTaskBadge.textContent = task.phase === "pending" ? "✓ 변경 확인 대기" : "✨ AI 작업 중…";
    const camera = this.cameras.main;
    const rect = tileRectToScreenRect(
      { x: task.region.x, y: task.region.y, width: task.region.width, height: task.region.height },
      { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom },
    );
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    this.regionTaskBadge.style.left = `${Math.round(canvasRect.left - hostRect.left + rect.x)}px`;
    this.regionTaskBadge.style.top = `${Math.round(canvasRect.top - hostRect.top + rect.y - 26)}px`;
  }
}

function setTileToolStatus(testId: string, text: string): void {
  const node = document.querySelector(`[data-testid="${testId}"]`);
  if (!node) return;
  node.textContent = text;
}
