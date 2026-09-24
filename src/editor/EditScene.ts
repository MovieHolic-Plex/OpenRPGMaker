import { ensureUploadedTilesetTextures } from "@/assets/uploadedTilesets";
// editor/EditScene.ts
// 에디터의 Phaser 씬. 맵을 그리드 단위로 렌더하고 입력을 actions로 보낸다.
// 데이터는 직접 쓰지 않고 store.subscribe 로 갱신을 받아 재렌더.

import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import {
  ensureBundledProjectTextures,
  ensureUploadedCharsetTextures,
  loadBundledAssets,
  registerBundledFrames,
  TILE_SIZE,
} from "@/assets/bundled";
import { subscribeAgentFocusHighlight, type AgentFocusTarget } from "@/editor/agentFocus";
import {
  planCameraFocus,
  shouldDeferCameraFocus,
  subscribeEditorCameraFocus,
  type CameraFocusTarget,
  type PointerGestureState,
  type VisibleTileRect,
} from "@/editor/editorCameraFocus";
import {
  cameraLookAtForTarget,
  editorCameraBounds,
  filterAssistantOverlayRects,
  mergeNearbyRects,
  unoccludedCanvasRect,
  visibleTileRectFromViewport,
  type CanvasRect,
} from "@/editor/cameraFocusViewport";
import { subscribeAgentBlueprint } from "@/editor/agentBlueprint";
import { AgentBlueprintRenderer } from "@/editor/agentBlueprintRenderer";
import { isAgentGhostPreviewHidden, subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { AI_LIVE_CANVAS_EVENT } from "@/editor/aiLiveCanvas";
import { AgentFocusRenderer, AgentGhostPreviewRenderer } from "@/editor/agentPreviewRenderers";
import { subscribeInlineProposalActions } from "@/editor/proposalInlineApproval";
import { CameraScrollbars } from "@/editor/CameraScrollbars";
import { CameraPanController, pointerScreenPosition } from "@/editor/CameraPanController";
import { growMapOnEdges, mapEdgeGrowAxes, MAP_EDGE_GROW_ARM_MS, MAP_EDGE_GROW_STEP_MS, type MapEdgeGrowAxes } from "@/editor/mapEdgeGrow";
import { exceedsMapDimensionLimit, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { store, type ProjectChangeCell, type ProjectChangeDescriptor } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { MAP_BACKGROUND_LAYER_DEPTH } from "@/player/characterDepth";
import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import { mapBackgroundFitScale, mapBackgroundLayout, mapBackgroundTextureKey } from "@/player/playSceneMapBackground";
import {
  mapBackgroundPreviewEnabled,
  subscribeMapBackgroundPreview,
} from "@/editor/mapBackgroundPreviewState";
import { editorState, EDITOR_ZOOM_LEVELS, type TileClipboard } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import {
  renderEventLayerClickFeedback,
  type EventLayerClickFeedback,
} from "@/editor/editSceneEventMarkers";
import { retainEventLayerClickFeedback } from "@/editor/transientEditorChrome";
import { EVENT_EDITOR_CLOSED_WINDOW_EVENT } from "@/editor/eventEditorLifecycleEvents";
import {
  buildEventMarkerTooltipModel,
  collectCallTargetWarnings,
  renderEventMarkerTooltipElement,
} from "@/editor/eventMarkerUx";
import {
  computeEventMarkerTooltipPlacement,
  type TooltipAnchor,
} from "@/editor/eventMarkerTooltipPlacement";
import { renderHoverTilePreview, shouldShowPaintHoverPreview } from "@/editor/editSceneHoverPreview";
import { planEditSceneRenderForStoreChange } from "@/editor/editSceneRenderPlan";
import {
  editSceneTileWindowKey,
  renderEditScene,
  renderEditSceneTileCells,
  refreshEditSceneOverlay,
  renderVisibleEditSceneTiles,
  applyCameraView,
  shouldLazilyRenderEditMap,
  chunkCoord,
  type EditSceneRenderStats,
  type EditSceneTileIndex,
  syncSelectionOverlay,
} from "@/editor/editSceneRender";
import { applyEditTileLayerPresentation, repaintEditGrid } from "@/editor/editSceneViewChrome";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { resetCullableTiles, syncTileCulling } from "@/player/playSceneTileCulling";
import {
  cancelPastePreview,
  clearSelection,
  confirmPastePreview,
  copySelection,
  enterPastePreview,
  movePastePreview,
  selectTileRegion,
} from "@/editor/mapClipboard";
import {
  enterPanTool,
  escapeOwnedByTransientSurface,
  resolveEscapeAction,
} from "@/editor/escapeToPan";
import { handleEditorKey, handleHistoryHotkey, historyHotkeyOwnedByPanel, isHistoryHotkeyChord, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { copyEventAt, openEventLayerContextMenu, pasteEventAt } from "@/editor/panels/eventLayerContextMenu";
import { isCellInsideSelection } from "@/editor/panels/mapSelectionContextMenu";
import { openStructurePlacementContextMenu } from "@/editor/panels/structurePlacementContextMenu";
import {
  isRegionTaskModalOpen,
  isRegionTaskRegionLocked,
  openRegionTaskModal,
  REGION_TASK_MODAL_EVENT,
  retargetRegionTaskModal,
} from "@/editor/panels/regionTaskModal";
import { REGION_TASK_STATUS_EVENT, regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { BUILD_PALETTE_VISIBILITY_EVENT, isBuildPaletteEnabled, renderBuildPalettePopup } from "@/editor/panels/buildPalette";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { getEditorMapViewport, setEditorMapViewport } from "@/editor/editorMapViewport";
import { setClientPointTileResolver, setRegionClientRectResolver } from "@/editor/regionClientRect";
import { setCanvasPointerBridge, type CanvasGestureClaim, type CanvasPointerPoint } from "@/editor/canvasPointerBridge";
import { resolveCanvasGestureOwner } from "@/editor/canvasPointerOwnership";
import { repositionMapLocationLayer } from "@/editor/mapLocationLayer";
import { repositionRegionChunkOverlay } from "@/editor/regionTask/regionChunkOverlayView";
import { notifyRightDragRegionSelected } from "@/editor/selectionChipHint";
import { computeMapViewport } from "@/ai/mapViewportContext";
import { renderSelectionActionChips, shouldShowSelectionActionChips } from "@/editor/selectionActionChips";
import {
  anchoredBuildPalettePosition,
  anchoredSelectionChipsPosition,
} from "@/editor/selectionOverlayAnchor";
import { isSignificantRegionDrag, regionRectFromDrag } from "@/editor/regionRightDrag";
import { saveProjectNow } from "@/editor/saveActions";
import { TilePaintEngine } from "@/editor/TilePaintEngine";
import { DragOperationHandler } from "@/editor/DragOperationHandler";
import { editorWorkingEvents } from "@/project/eventDrafts";
import { findEventCoveringPoint } from "@/project/eventFootprintQuery";
import { topTileInStack } from "@/project/mapOverlayTiles";
import type { MapId } from "@/project/types";
import { clearMapDissolveVeil } from "@/editor/mapDissolveVeil";
import { prefersReducedMotion } from "@/util/reducedMotion";
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
/**
 * 이벤트 레이어 빈 칸 좌클릭이 팬으로 승격되는 문턱(px). tilePaletteSheet 의
 * RANGE_DRAG_THRESHOLD_PX 와 같은 값으로 맞춘다 — 클릭과 드래그의 경계는 표면마다
 * 달라야 할 이유가 없다.
 *
 * 0 이면 안 된다: 눌렀다 뗀 클릭에도 트랙패드는 1~2px 를 흘리고, 그 한 픽셀이 「여기에
 * 새 이벤트」 예약을 팬으로 바꿔 버린다(클릭이 통째로 증발한다).
 */
const EVENT_LAYER_PAN_THRESHOLD_PX = 4;
/** 캔버스·조수 가림 사각형을 재는 주기. 매 프레임 DOM 을 재면 레이아웃이 흔들린다. */
const OVERLAY_GEOMETRY_TTL_MS = 250;

function overlayGeometryNowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
const TOOLTIP_ANCHORS: readonly TooltipAnchor[] = ["top-right", "top-left", "bottom-right", "bottom-left"];

type TileRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type CameraView = {
  readonly worldView: { readonly x: number; readonly y: number };
  readonly zoom: number;
};

export function tileRectToScreenRect(rect: TileRect, camera: CameraView, tileSize: number = TILE_SIZE): TileRect {
  return {
    x: Math.round((rect.x * tileSize - camera.worldView.x) * camera.zoom),
    y: Math.round((rect.y * tileSize - camera.worldView.y) * camera.zoom),
    width: Math.max(1, Math.round(rect.width * tileSize * camera.zoom)),
    height: Math.max(1, Math.round(rect.height * tileSize * camera.zoom)),
  };
}

// 위치 헬퍼는 selectionOverlayAnchor.ts — 테스트/재사용용 re-export
import { tileRectToClientRect } from "@/editor/selectionOverlayAnchor";
export { anchoredBuildPalettePosition, anchoredSelectionChipsPosition } from "@/editor/selectionOverlayAnchor";

export function regionTaskBadgeText(phase: "running" | "pending"): string | null {
  return phase === "pending" ? "✓ 변경 확인 대기" : null;
}

export class EditScene extends PhaserRuntime.Scene {
  private tileLayer: Phaser.GameObjects.Container | null = null;
  /** 상위(덧그림) 타일 컨테이너 — tileLayer 뒤에 와서 upper가 항상 lower 위에 그려진다. */
  private upperTileLayer: Phaser.GameObjects.Container | null = null;
  private hoverPreviewLayer: Phaser.GameObjects.Container | null = null;
  private selectionLayer: Phaser.GameObjects.Container | null = null;
  private overlayLayer: Phaser.GameObjects.Container | null = null;
  private agentBlueprintLayer: Phaser.GameObjects.Container | null = null;
  private agentGhostPreviewLayer: Phaser.GameObjects.Container | null = null;
  private agentFocusHighlightLayer: Phaser.GameObjects.Container | null = null;
  private eventClickFeedbackLayer: Phaser.GameObjects.Container | null = null;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private unsubStore: (() => void) | null = null;
  private unsubEditor: (() => void) | null = null;
  private unsubAgentGhost: (() => void) | null = null;
  private unsubMapBackgroundPreview: (() => void) | null = null;
  /** 맵 배경 미리보기(토글이 켜져 있을 때만). 하층 타일 아래 depth 의 컨테이너다. */
  private mapBackgroundLayer: Phaser.GameObjects.Container | null = null;
  private mapBackgroundSprites: Phaser.GameObjects.TileSprite[] = [];
  /** 미리보기 중인 레이어 스펙(배율 재계산용). */
  private mapBackgroundPreviewSpecs: readonly { readonly fit: "native" | "cover" }[] = [];
  private unsubAgentFocus: (() => void) | null = null;
  private unsubCameraFocus: (() => void) | null = null;
  private unsubInlineApproval: (() => void) | null = null;
  private unsubAgentBlueprint: (() => void) | null = null;
  /** 원본 보기(꾹 누름) 마지막 값 — 토글이 바뀐 순간에만 청사진을 다시 그린다. */
  private lastGhostHidden = false;
  private agentBlueprintRenderer: AgentBlueprintRenderer | null = null;
  private agentGhostPreviewRenderer: AgentGhostPreviewRenderer | null = null;
  private agentFocusRenderer: AgentFocusRenderer | null = null;
  private isPainting = false;
  private lastPaintKey = "";
  private lastEventLayerClick: EventLayerClick | null = null;
  private lastPointerClick: EventLayerClick | null = null;
  private eventLayerClickFeedback: EventLayerClickFeedback | null = null;
  private lastPointerTile: { x: number; y: number } | null = null;
  private lastRenderedMapId: MapId | null = null;
  private lastMaterializedTileWindowKey = "";
  private lastRenderStateKey = "";
  /** 레이어 색·충돌 오버레이·이벤트 마커·격자. 타일 메시 재생성 키와 분리한다. */
  private lastViewChromeKey = "";
  private lastCameraViewKey = "";
  private lastAppliedZoom = 0;
  private readonly tileIndex: EditSceneTileIndex = new Map();
  /** large-map lazy 경로의 타일 청크 컨테이너 저장소(비-lazy 맵은 사용하지 않는다). */
  private readonly tileChunks: Map<string, Phaser.GameObjects.Container> = new Map();
  private cameraPanController: CameraPanController | null = null;
  private mapEdgeBand: Phaser.GameObjects.Graphics | null = null;
  private pointerOverCanvas = false;
  private mapEdgeGrowArmedAt = 0;
  private mapEdgeGrowLastAt = 0;
  private mapEdgeGrowLimitNoted = false;
  private cameraScrollbars: CameraScrollbars | null = null;
  private navigationGeometry: { canvas: CanvasRect; unoccluded: CanvasRect; zoom: number } | null = null;
  private navigationResizeObserver: ResizeObserver | null = null;

  private readonly handleCanvasZoomWheel = (event: WheelEvent): void => this.zoomAtWheel(event);

  private zoomAtWheel(event: WheelEvent): void {
    if (!event.ctrlKey || !event.cancelable) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // A zoom cannot change the coordinates of an edit already in flight.
    if (event.deltaY === 0 || shouldDeferCameraFocus(this.pointerGestureState())) return;
    this.cancelCameraFocus();
    const camera = this.cameras.main;
    const canvas = this.game.canvas.getBoundingClientRect();
    const x = (event.clientX - canvas.left) * camera.width / canvas.width;
    const y = (event.clientY - canvas.top) * camera.height / canvas.height;
    camera.preRender();
    const anchor = camera.getWorldPoint(x, y);
    const levels = EDITOR_ZOOM_LEVELS;
    const index = levels.indexOf(editorState.get().zoom);
    const zoom = levels[Math.max(0, Math.min(levels.length - 1, index + (event.deltaY < 0 ? 1 : -1)))];
    editorState.set({ zoom });
    this.syncNavigationGeometry();
    camera.preRender();
    const shifted = camera.getWorldPoint(x, y);
    camera.setScroll(camera.scrollX + anchor.x - shifted.x, camera.scrollY + anchor.y - shifted.y);
    camera.preRender();
    this.afterCameraMoved();
  }
  private tilePaintEngine: TilePaintEngine | null = null;
  private dragOperationHandler: DragOperationHandler | null = null;
  private rightRegionGesture: RightRegionGesture | null = null;
  /**
   * 이벤트 레이어 **빈 칸**에서 눌린 좌클릭. 문턱을 넘으면 카메라 팬으로 승격한다.
   *
   * 왜 후보를 두는가(pointerdown 에서 곧장 팬하지 않는 이유): 이벤트 레이어의 좌클릭
   * 한 번은 「여기에 새 이벤트」 자리 예약이고 두 번은 편집기 열기다. 누른 즉시 팬을
   * 잡으면 그 두 동작이 사라진다. 눌린 자리는 팬 기준점으로도 필요하므로 함께 들고 있는다.
   *
   * 이벤트 **위**에서 누른 좌클릭은 이 후보를 만들지 않는다 — 그건 DragOperationHandler 의
   * eventDragCandidate 이고, 이벤트 이동은 지금 그대로 둔다(감독 결정).
   */
  private eventLayerPanCandidate: { readonly screenX: number; readonly screenY: number } | null = null;
  /**
   * 사용자 제스처 때문에 미뤄 둔 카메라 초점 요청 — **한 칸**만 둔다(새 요청이 옛 요청을 덮는다).
   * 미룬 요청을 그냥 버리면 조수가 "여기 고쳤어요" 하고도 화면은 딴 데를 보고 있다. 반대로 큐로
   * 쌓으면 제스처가 끝나는 순간 카메라가 여러 번 튄다 — 마지막 요청만 사용자에게 의미가 있다.
   */
  private deferredCameraFocus: CameraFocusTarget | null = null;
  private activeCameraFocus: { target: CameraFocusTarget; zoom: number } | null = null;
  /**
   * 게시된 뷰포트 스냅샷의 기하 서명 — 이것이 바뀔 만큼만 다시 게시한다.
   *
   * 게시 지점을 열거하는 방식은 이미 실패했다(실측 2026-08-30): 부팅 직후 마지막 게시가 카메라가
   * 맵 중심으로 정착하기 **전**에 일어나 100×100 맵에서 사용자는 타일 (50,50) 을 보는데 스냅샷은
   * (17,12) 을 가리켰다 — 33칸 오차. 유리 도크를 펼치면 가림 범위가 바뀌는데(첫 AI 턴이 자동으로
   * 펼친다) 그 또한 게시를 부를 지점이 없었다. 그래서 이젠 "변하면 게시한다"로 바꾼다.
   */
  private lastPublishedViewportSignature = "";
  /**
   * 내비게이션 기하(스크롤바 투영·카메라 바운드)의 무변화 프레임 조기 종료 키.
   * 카메라 scroll/zoom·캔버스 크기·맵 크기가 모두 같으면 setBounds+preRender+투영을
   * 통째로 건너뛴다 — update() 는 매 프레임 불린다.
   */
  private lastNavGeometryKey = "";
  /** 캔버스·오버레이 rect 캐시 — 프레임마다 getBoundingClientRect 를 부르면 레이아웃이 흔들린다. */
  private cachedCanvasRect: CanvasRect | null = null;
  private cachedUnoccludedRect: CanvasRect | null = null;
  private overlayGeometryReadAtMs = 0;
  /** 마지막 우클릭 드래그가 끝난 화면 좌표 — 칩 바를 놓은 자리에 띄우기 위한 anchor. */
  private lastRightDragScreen: { readonly x: number; readonly y: number } | null = null;
  /** 붙여넣기 고스트를 마지막으로 조립한 클립보드·원점. 같은 클립보드면 칸만 옮긴다. */
  private pasteGhostClipboard: TileClipboard | null = null;
  private pasteGhostAt: { x: number; y: number } | null = null;
  /** 맵 캔버스에서 우클릭이 시작되면 true. 버튼을 놓는 순간 contextmenu 가 문서 타겟으로 뜨는 경우 대비. */
  private suppressBrowserContextMenuUntil = 0;
  private buildPalettePopup: HTMLElement | null = null;
  private buildPalettePopupKey = "";
  private readonly handleBuildPaletteVisibilityChange = (): void => this.renderBuildPaletteOverlay();
  private readonly handleLiveCanvas = (): void => {
    this.renderAgentGhostPreview();
    this.renderAgentBlueprint();
  };
  private activeRegionTask: { readonly mapId: string; readonly region: RegionRect; readonly phase: "running" | "pending"; readonly runId: number | null } | null = null;
  private regionTaskBadge: HTMLElement | null = null;
  /** 선택 영역 위에 붙는 W×H 배지. 드래그 중에도 갱신되어 크기를 놓기 전에 알려준다. */
  private regionSizeBadge: HTMLElement | null = null;
  private eventMarkerTooltipEl: HTMLElement | null = null;
  private eventMarkerTooltipKey = "";
  private readonly handleEventEditorClosed = (): void => {
    this.clearEventLayerClickFeedback();
  };

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
    this.cameras.main.setBackgroundColor("#E7E0D0");
    // 배경 미리보기는 하층 타일 **아래** 다 — 타일이 깔린 칸은 가리고 빈 칸만 뚫린다(플레이와 같은 순서).
    this.mapBackgroundLayer = this.add.container(0, 0);
    this.mapBackgroundLayer.setDepth(MAP_BACKGROUND_LAYER_DEPTH);
    // Round texture sampling, not world-space scroll: flooring scroll can move a
    // wheel anchor by up to eight screen pixels at the existing maximum zoom.
    this.cameras.main.roundPixels = false;

    this.tileLayer = this.add.container(0, 0);
    this.upperTileLayer = this.add.container(0, 0);
    // tileLayer(기본 depth 0)와 upperTileLayer(기본 depth 0)는 add 순서대로 그려진다 —
    // 같은 depth면 display list 등록 순서가 드로 순서다. 명시 depth는 붙이지 않는다:
    // hover(8)·selection(8.5)·overlay(9)·grid(10)이 타일 두 컨테이너보다 위에 온다.
    this.hoverPreviewLayer = this.add.container(0, 0);
    this.hoverPreviewLayer.setDepth(8);
    this.selectionLayer = this.add.container(0, 0);
    this.selectionLayer.setDepth(8.5);
    this.overlayLayer = this.add.container(0, 0);
    this.overlayLayer.setDepth(9);
    const gridGraphics = this.add.graphics();
    gridGraphics.setDepth(10);
    this.gridGraphics = gridGraphics;
    this.mapEdgeBand = this.add.graphics();
    this.mapEdgeBand.setDepth(10.1);
    // 청사진은 계획, 고스트는 실물 초안이다 — 계획이 아래로 깔려야 실물이 그 위에 올라간다.
    this.agentBlueprintLayer = this.add.container(0, 0);
    this.agentBlueprintLayer.setDepth(10.2);
    this.agentGhostPreviewLayer = this.add.container(0, 0);
    this.agentGhostPreviewLayer.setDepth(10.5);
    this.agentFocusHighlightLayer = this.add.container(0, 0);
    this.agentFocusHighlightLayer.setDepth(11);
    this.agentBlueprintRenderer = new AgentBlueprintRenderer(this, this.agentBlueprintLayer, () => this.mapId());
    this.agentGhostPreviewRenderer = new AgentGhostPreviewRenderer(this, this.agentGhostPreviewLayer, () => this.mapId());
    this.agentFocusRenderer = new AgentFocusRenderer(this, this.agentFocusHighlightLayer, () => this.mapId());
    this.cameraPanController = new CameraPanController(this, {
      onPanStart: () => {
        this.cancelCameraFocus();
        this.isPainting = false;
        this.lastPaintKey = "";
      },
      onPanMove: () => {
        this.cameras.main.preRender();
        this.afterCameraMoved();
      },
      onPanEnd: () => this.replayDeferredCameraFocus(),
    });
    this.eventClickFeedbackLayer = this.add.container(0, 0);
    this.eventClickFeedbackLayer.setDepth(12);

    this.bindInput();
    const canvasHost = this.game.canvas.parentElement;
    if (canvasHost) this.cameraScrollbars = new CameraScrollbars(canvasHost, (x, y) => {
      if (!shouldDeferCameraFocus(this.pointerGestureState())) this.panCameraBy(x, y);
    });
    this.observeNavigationGeometry();
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
    this.unsubAgentGhost = subscribeAgentGhostPreview(() => {
      this.renderAgentGhostPreview();
      // 원본 보기(꾹 누름) 토글은 고스트 스토어에서 발화한다 — 청사진도 같은 토글을 따르므로
      // 값이 **바뀐 순간에만** 다시 그린다. 매 프리뷰 갱신(150ms 스로틀)마다 다시 그리면
      // 사각형·라벨 최대 40장을 계속 새로 만든다.
      const hidden = isAgentGhostPreviewHidden();
      if (hidden === this.lastGhostHidden) return;
      this.lastGhostHidden = hidden;
      this.renderAgentBlueprint();
    });
    this.unsubAgentBlueprint = subscribeAgentBlueprint(() => this.renderAgentBlueprint());
    // 미리보기 토글은 씬 밖(캔버스 툴바)에서 뒤집힌다 — 구독이 없으면 켜도 아무 일도 안 한다.
    this.unsubMapBackgroundPreview = subscribeMapBackgroundPreview(() => this.redraw());

    this.scale.on("resize", this.handleResize, this);
    window.addEventListener(BUILD_PALETTE_VISIBILITY_EVENT, this.handleBuildPaletteVisibilityChange);
    window.addEventListener(AI_LIVE_CANVAS_EVENT, this.handleLiveCanvas);
    window.addEventListener(REGION_TASK_STATUS_EVENT, this.handleRegionTaskStatus);
    // 편집기가 닫히면 「편집 위치 x,y」 배너를 거둔다 — 결과물이 아니라 편집 중 크롬이다(2026-09-17 리뷰 P0-4).
    window.addEventListener(EVENT_EDITOR_CLOSED_WINDOW_EVENT, this.handleEventEditorClosed);
    // 영역 작업 창이 닫히면 선택 칩 오버레이를 되살린다(열릴 때는 숨긴다).
    window.addEventListener(REGION_TASK_MODAL_EVENT, this.handleRegionTaskModalToggle);
    this.unsubInlineApproval = subscribeInlineProposalActions(() => this.refreshAgentGhostDomMarkers());
    if (typeof window !== "undefined") {
      // e2e/진단 스펙용 후킹 — 카메라 수학을 스펙에 복제하지 않도록 엔진의 실제 값을 노출한다.
      const editWindow = window as unknown as {
        __oprnEditCamera?: () => { scrollX: number; scrollY: number; width: number; height: number; zoom: number };
        __oprnEditWorldToClient?: (worldX: number, worldY: number) => { x: number; y: number };
        __oprnEditMapViewport?: () => unknown;
        __oprnEditVisibleArea?: () => unknown;
      };
      // 조수가 실제로 읽는 뷰포트 스냅샷과, 그 스냅샷을 만든 기하학(캔버스·가림 제외·worldView·줌).
      // e2e 가 카메라·가림 계산을 다시 구현하면 두 소스가 갈라지므로 씬의 값을 그대로 내보낸다.
      editWindow.__oprnEditMapViewport = () => getEditorMapViewport();
      editWindow.__oprnEditVisibleArea = () => this.cameraVisibleArea();
      editWindow.__oprnEditCamera = () => {
        const c = this.cameras.main;
        return { scrollX: c.scrollX, scrollY: c.scrollY, width: c.width, height: c.height, zoom: c.zoom };
      };
      // 월드 좌표 → 클라이언트 좌표. scrollX/Y 는 3.60+ 줌 규약 때문에 화면 왼쪽 위와
      // 직접 대응하지 않으므로(실측 2026-08-11), 렌더가 실제로 쓰는 worldView 사각형을 쓴다.
      editWindow.__oprnEditWorldToClient = (worldX: number, worldY: number) => {
        const c = this.cameras.main;
        const rect = this.game.canvas.getBoundingClientRect();
        return {
          x: rect.x + (worldX - c.worldView.x) * c.zoom,
          y: rect.y + (worldY - c.worldView.y) * c.zoom,
        };
      };
    }

    // 선택 액션 바가 영역 작업 창을 열 때 대상 영역의 화면 사각형(avoid)을 알아야 한다.
    // 그 계산은 Phaser 카메라를 읽으므로 여기서만 가능하다 — 등록소에 꽂아 둔다.
    setRegionClientRectResolver((region) => this.regionClientRect(region));
    // 로케이션 레이어(DOM 오버레이)는 사람의 포인터를 타일로 바꿔야 한다. 역변환도 카메라를
    // 읽으므로 같은 등록소에 꽂는다 — 오버레이가 Phaser 를 직접 참조하지 않게 한다.
    setClientPointTileResolver((point) => this.clientPointToTile(point));
    // 로케이션 오버레이는 포인터의 **표적**이 되므로 캔버스의 팬/영역 제스처를 스스로 시작할 수 없다.
    // 카메라와 장면 제스처를 가진 쪽이 «양보할 때인가»와 «이미 지나간 좌표에서 제스처를 시작하라»를 꽂는다.
    setCanvasPointerBridge({
      claim: (point) => this.claimCanvasPointer(point),
      eventIdAt: (point) => this.eventIdCoveringClientPoint(point),
      openEvent: (request) => openEventEditorModal(request.mapId as MapId, request.eventId),
    });
    // scene 정지/파괴 시 구독 해제(이중 호출 방지).
    this.events.once(PhaserRuntime.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(PhaserRuntime.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private cleanup(): void {
    this.cancelCameraFocus(false);
    this.unbindCanvasPanGuards();
    this.navigationResizeObserver?.disconnect();
    this.cameraScrollbars?.destroy();
    this.cameraScrollbars = null;
    this.navigationGeometry = null;
    this.lastNavGeometryKey = "";
    this.scale.off("resize", this.handleResize, this);
    this.unbindBrowserContextMenuGuards();
    this.rightRegionGesture = null;
    // 미뤄 둔 초점은 씬과 함께 버린다 — 아래 stopPan 이 재생을 시도하기 전에 비워야 한다.
    this.deferredCameraFocus = null;
    // 컬링 추적 목록을 풀어 씬이 내려가도 객체를 붙잡지 않게 한다.
    resetCullableTiles(this);

    this.mapEdgeBand?.destroy();
    this.mapEdgeBand = null;
    this.stopPan();
    this.unsubStore?.();
    this.unsubEditor?.();
    this.unsubAgentGhost?.();
    this.unsubAgentFocus?.();
    this.unsubCameraFocus?.();
    this.unsubMapBackgroundPreview?.();
    this.unsubAgentBlueprint?.();
    this.unsubStore = null;
    this.unsubEditor = null;
    this.unsubAgentGhost = null;
    this.unsubAgentFocus = null;
    this.unsubCameraFocus = null;
    this.unsubMapBackgroundPreview = null;
    this.unsubAgentBlueprint = null;
    this.clearAgentGhostPreviewLayer();
    this.clearAgentBlueprintLayer();
    this.clearAgentFocusHighlight();
    window.removeEventListener(BUILD_PALETTE_VISIBILITY_EVENT, this.handleBuildPaletteVisibilityChange);
    window.removeEventListener(AI_LIVE_CANVAS_EVENT, this.handleLiveCanvas);
    window.removeEventListener(REGION_TASK_STATUS_EVENT, this.handleRegionTaskStatus);
    window.removeEventListener(EVENT_EDITOR_CLOSED_WINDOW_EVENT, this.handleEventEditorClosed);
    window.removeEventListener(REGION_TASK_MODAL_EVENT, this.handleRegionTaskModalToggle);
    this.unsubInlineApproval?.();
    this.unsubInlineApproval = null;
    if (typeof window !== "undefined") {
      const editWindow = window as unknown as {
        __oprnEditCamera?: unknown;
        __oprnEditWorldToClient?: unknown;
        __oprnEditMapViewport?: unknown;
        __oprnEditVisibleArea?: unknown;
      };
      delete editWindow.__oprnEditCamera;
      delete editWindow.__oprnEditWorldToClient;
      delete editWindow.__oprnEditMapViewport;
      delete editWindow.__oprnEditVisibleArea;
    }
    this.clearBuildPaletteOverlay();
    // 씬이 내려가는 중에 전환이 걸려 있으면 그 뒷정리(reveal)가 영영 오지 않는다 —
    // 다음 씬이 종이색 판에 덮인 채로 뜨는 것은 하드컷보다 나쁘다.
    clearMapDissolveVeil();
    this.regionTaskBadge?.remove();
    this.regionTaskBadge = null;
    this.activeRegionTask = null;
    this.regionSizeBadge?.remove();
    this.regionSizeBadge = null;
    setRegionClientRectResolver(null);
    setClientPointTileResolver(null);
    setCanvasPointerBridge(null);
    setEditorMapViewport(null);
  }

  private handleResize(): void {
    // 다음 기하 읽기를 강제한다 — 캔버스 사각형이 바뀌었으므로 캐시는 낡았다.
    this.overlayGeometryReadAtMs = 0;
    this.lastNavGeometryKey = "";
    this.syncNavigationGeometry();
    this.redraw();
  }

  /**
   * Phaser가 매 프레임 부른다. 카메라 scroll/zoom은 어느 경로로든 바뀔 수 있으므로(부팅 정착,
   * 모드 전환, 휠 줌, 키보드 팬, cameraStability 재정렬) 게시 지점을 열거하지 않고 서명이
   * 바뀔 때 게시한다. 무변화 프레임은 수 번의 수치 복사·문자열 비교만 하고 끝난다.
   */
  update(): void {
    if (this.activeCameraFocus && shouldDeferCameraFocus(this.pointerGestureState())) this.cancelCameraFocus();
    this.stepMapEdgeGrow();
    this.syncNavigationGeometry();
    this.syncPublishedViewport();
    this.syncTileCullingFrame();
  }

  /**
   * 화면 밖 타일의 visible 을 끈다. renderEditScene 가 타일을 만들 때 trackCullableTile 로
   * 추적해 둔다. 카메라가 타일 경계를 넘을 때만 다시 계산하므로 무변화 프레임은 거의 공짜다.
   * 큰 맵(128×128 = 타일 3만 개)에서 화면에 보이는 것은 수백 칸인데, Phaser 의 Container 는
   * 절두체 컬링이 없어 이걸 직접 해주지 않으면 화면 밖 타일도 매 프레임 렌더 큐에 들어간다.
   */
  private syncTileCullingFrame(): void {
    const view = this.cameras?.main?.worldView;
    if (!view || view.width <= 0 || view.height <= 0) return;
    const mapId = this.mapId();
    if (!mapId) return;
    const map = store.getCurrent().maps[mapId];
    if (map && shouldLazilyRenderEditMap(map) && this.tileLayer && this.upperTileLayer && this.overlayLayer && this.gridGraphics) {
      const nextWindowKey = editSceneTileWindowKey(this, map);
      if (nextWindowKey !== this.lastMaterializedTileWindowKey) {
        renderVisibleEditSceneTiles({
          scene: this,
          tileLayer: this.tileLayer,
          upperTileLayer: this.upperTileLayer,
          tileChunks: this.tileChunks,
          overlayLayer: this.overlayLayer,
          gridGraphics: this.gridGraphics,
          mapId,
          tileIndex: this.tileIndex,
          backgroundPreview: mapBackgroundPreviewEnabled(),
        });
        this.lastMaterializedTileWindowKey = nextWindowKey;
      }
    }
    // 청크 절전 — 화면 밖 청크 컨테이너를 통째로 숨겨 프레임당 자식 순회를 화면 근처로 묶는다.
    if (this.tileChunks.size > 0) {
      const tileSize = this.activeTileSize();
      const firstCx = chunkCoord(Math.floor(view.x / tileSize) - 2);
      const lastCx = chunkCoord(Math.floor((view.x + view.width) / tileSize) + 2);
      const firstCy = chunkCoord(Math.floor(view.y / tileSize) - 2);
      const lastCy = chunkCoord(Math.floor((view.y + view.height) / tileSize) + 2);
      for (const [key, chunk] of this.tileChunks) {
        const [cx, cy] = key.split(",").map(Number);
        const visible = cx >= firstCx && cx <= lastCx && cy >= firstCy && cy <= lastCy;
        if (chunk.visible !== visible) chunk.setVisible(visible);
      }
    }
    syncTileCulling(this, view, this.activeTileSize());
  }

  private observeNavigationGeometry(): void {
    // 캔버스 크기만 즉시 무효화한다. AI 패널의 class/style/높이는 스트리밍 중 토큰마다 바뀌고,
    // 그때 시계를 0으로 돌리면 250ms TTL 이 풀려 매 프레임 getBoundingClientRect 가 편집을 막는다.
    // 조수 카드 가림은 update() 가 TTL 안에 다시 잰다.
    this.navigationResizeObserver = new ResizeObserver(() => {
      this.overlayGeometryReadAtMs = 0;
    });
    this.navigationResizeObserver.observe(this.game.canvas);
  }

  private syncNavigationGeometry(): void {
    if (!this.cameraScrollbars) return;
    const camera = this.cameras.main;
    const mapId = this.mapId();
    const map = mapId && store.getCurrent().maps[mapId];
    if (!map) return;
    const area = this.cameraVisibleArea({ cachedGeometry: true });
    if (!area) return;
    // 무변화 프레임 조기 종료 — 카메라·캔버스·맵 크기가 모두 같으면 기하가 같다는 뜻이다.
    // 게이트 지점(맵 전환·applyCameraZoomOnly)에서 lastNavGeometryKey 를 비워 재동기화를 강제한다.
    const navKey = [
      Math.round(camera.scrollX), Math.round(camera.scrollY), camera.zoom,
      Math.round(area.canvas.x), Math.round(area.canvas.y), Math.round(area.canvas.width), Math.round(area.canvas.height),
      Math.round(area.unoccluded.x - area.canvas.x), Math.round(area.unoccluded.y - area.canvas.y),
      Math.round(area.unoccluded.width), Math.round(area.unoccluded.height),
      map.width, map.height,
    ].join("|");
    if (navKey === this.lastNavGeometryKey) return;
    const previous = this.navigationGeometry;
    if (previous && shouldDeferCameraFocus(this.pointerGestureState())) {
      camera.preRender();
      const origin = camera.getWorldPoint(0, 0);
      this.cameraScrollbars.sync({ ...area, worldView: { ...area.worldView, x: origin.x, y: origin.y } }, map.width * this.activeTileSize(), map.height * this.activeTileSize());
      this.lastNavGeometryKey = navKey;
      return;
    }
    const offset = (geometry: { canvas: CanvasRect; unoccluded: CanvasRect }) => ({
      x: geometry.unoccluded.x - geometry.canvas.x + (geometry.unoccluded.width - geometry.canvas.width) / 2,
      y: geometry.unoccluded.y - geometry.canvas.y + (geometry.unoccluded.height - geometry.canvas.height) / 2,
    });
    const now = offset(area);
    // Resize changes the camera width before this callback. Preserve the previous
    // unobstructed world center, not the stale midpoint or the assistant's pixels.
    if (previous && !this.activeCameraFocus) {
      const before = offset(previous);
      const dx = (previous.canvas.width - area.canvas.width) / 2 + (before.x / previous.zoom - now.x / camera.zoom);
      const dy = (previous.canvas.height - area.canvas.height) / 2 + (before.y / previous.zoom - now.y / camera.zoom);
      if (dx !== 0 || dy !== 0) camera.setScroll(camera.scrollX + dx, camera.scrollY + dy);
    }
    this.navigationGeometry = { canvas: area.canvas, unoccluded: area.unoccluded, zoom: camera.zoom };
    const bounds = editorCameraBounds({
      mapWidth: map.width * this.activeTileSize(), mapHeight: map.height * this.activeTileSize(), ...area,
    });
    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    camera.preRender();
    const origin = camera.getWorldPoint(0, 0);
    this.cameraScrollbars.sync({ ...area, worldView: { ...area.worldView, x: origin.x, y: origin.y } }, map.width * this.activeTileSize(), map.height * this.activeTileSize());
    this.lastNavGeometryKey = navKey;
  }

  private syncPublishedViewport(): void {
    const signature = this.viewportSignature();
    if (signature === this.lastPublishedViewportSignature) return;
    this.publishMapViewport();
  }

  private viewportSignature(): string {
    const area = this.cameraVisibleArea({ cachedGeometry: true });
    if (!area) return `none|${this.mapId() ?? ""}`;
    return [
      this.mapId() ?? "",
      Math.round(area.worldView.x),
      Math.round(area.worldView.y),
      Math.round(area.worldView.width),
      Math.round(area.worldView.height),
      Math.round(area.unoccluded.x - area.canvas.x),
      Math.round(area.unoccluded.y - area.canvas.y),
      Math.round(area.unoccluded.width),
      Math.round(area.unoccluded.height),
      area.zoom,
    ].join("|");
  }

  private redrawForStoreChange(change: ProjectChangeDescriptor): void {
    // 자료 보관함에서 방금 가져온 캐릭셋은 preload 가 끝난 뒤에 생긴다 — 텍스처를 뒤늦게
    // 실어 주지 않으면 그 캐릭셋을 쓴 이벤트가 새로고침 전까지 빈 칸으로 보인다.
    // 타일 칠하기(scope: "map")마다 업로드 목록을 훑지 않도록 자산/프로젝트 변경에서만 돈다.
    if (change.scope !== "map") {
      ensureUploadedCharsetTextures(this, store.getCurrent(), () => this.redraw());
      ensureUploadedTilesetTextures(this, store.getCurrent(), () => this.redraw());
      ensureBundledProjectTextures(this, store.getCurrent(), () => this.redraw());
    }
    const mapId = this.mapId();
    const nextFeedback = retainEventLayerClickFeedback({
      feedback: this.eventLayerClickFeedback,
      currentMapId: mapId,
      changeOrigin: change.origin,
    });
    if (nextFeedback !== this.eventLayerClickFeedback) {
      this.eventLayerClickFeedback = nextFeedback;
      this.renderEventLayerClickFeedback();
    }
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
      this.cancelCameraFocus(true, ptr);
      this.updatePointerStatus(ptr);
      // 붙여넣기 미리보기 모드: 좌클릭 → 확정, 우클릭/맵 밖 → 취소.
      if (editorState.get().pastePreview) {
        const tile = this.pointerToTile(ptr);
        this.handlePastePreviewPointerDown(this.isRightClick(ptr), tile);
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
      this.clearPendingEventCoordinateForPointerContext(ptr);
      if (this.beginDragOperation(ptr)) return;
      // 페인트 시작 전 호버(raw 팔레트 타일)를 지운다 — 성형된 결과와 겹쳐 깜빡이는 UX 방지.
      this.suppressPaintHoverPreview();
      this.isPainting = true;
      this.lastPaintKey = "";
      // 이벤트 레이어: 눌린 칸에 이벤트가 있으면 드래그 이동 후보로 기록(클릭/더블클릭은 그대로).
      this.maybeBeginEventDragCandidate(ptr);
      // 이벤트가 없었다면 같은 좌클릭이 카메라 팬 후보가 된다(문턱을 넘을 때만 승격).
      this.armEventLayerPanCandidate(ptr);
      this.applyAtPointer(ptr);
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      this.pointerOverCanvas = true;
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
      // 이벤트 이동이 팬보다 **먼저**다 — 두 후보는 배타적이지만(하나는 이벤트 위, 하나는
      // 빈 칸) 순서를 적어 두어야 나중에 읽는 사람이 소유권을 헷갈리지 않는다.
      if (ptr.isDown && this.tryPromoteEventDrag(ptr)) return;
      // 이벤트 레이어 빈 칸에서 시작한 좌클릭이 문턱을 넘으면 카메라 팬으로 승격한다.
      if (ptr.isDown && this.tryPromoteEventLayerPan(ptr)) return;
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
      // 스트로크 종료 후 호버 복원 (성형된 맵 타일 위에 raw 프리뷰 가능) — 캔버스 안에서만 뜻이 있다.
      if (this.endPointerGesture(ptr) === "gesture") this.updateHoverPreview(ptr);
      // 제스처가 끝났으니 미뤄 둔 조수 초점을 지금 재생한다.
      this.replayDeferredCameraFocus();
    });
    this.input.on("pointerout", () => {
      this.pointerOverCanvas = false;
      this.clearMapEdgeBand();
      if (!this.getDragOperationHandler().active()) this.clearHoverPreview();
    });
    this.input.on("pointerupoutside", (ptr: Phaser.Input.Pointer) => {
      this.endPointerGesture(ptr);
      this.replayDeferredCameraFocus();
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
    if (this.cameraPanController?.shouldPan(ptr)) return true;
    const state = editorState.get();
    // Select's unoccupied outside-map target is neutral. Inside-map selection,
    // paint/event tools, existing selections and placement previews own their drag.
    if (ptr.button !== 0 || state.tool !== "select" || state.selection || state.activePaletteStamp
      || shouldDeferCameraFocus(this.pointerGestureState())) return false;
    const mapId = this.mapId();
    const map = mapId && store.getCurrent().maps[mapId];
    if (!map) return false;
    const { x, y } = this.pointerToTile(ptr);
    return x < 0 || y < 0 || x >= map.width || y >= map.height;
  }

  private bindCanvasPanGuards(): void {
    this.game.canvas.addEventListener("wheel", this.handleCanvasZoomWheel, { capture: true, passive: false });
    this.cameraPanController?.bindCanvasGuards();
  }

  private unbindCanvasPanGuards(): void {
    this.game.canvas.removeEventListener("wheel", this.handleCanvasZoomWheel, true);
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
    this.beginRightRegionGestureAt(this.pointerScreenPosition(ptr), this.pointerToTile(ptr));
  }

  /** 화면 좌표 + 타일로 시작하는 단일 구현. DOM 오버레이와 Phaser 입력이 같은 길을 쓴다. */
  private beginRightRegionGestureAt(screen: { readonly x: number; readonly y: number }, tile: { readonly x: number; readonly y: number }): void {
    // 영역 작업이 돌고 있거나 결과 검토 중이면 대상 영역이 잠긴다. 창은 비모달이라 캔버스가
    // 살아 있고, 그 상태로 새 영역을 잡으면 선택과 창이 서로 다른 곳을 가리킨다 —
    // 「적용」이 화면에 보이는 선택이 아닌 옛 영역을 고치게 된다. 그래서 제스처를 아예
    // 시작하지 않고 조용히 넘긴다.
    if (isRegionTaskRegionLocked()) return;
    const mapId = this.mapId();
    if (!mapId) return;
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) return;
    this.rightRegionGesture = { mapId, start: tile, screen, moved: false };
    // The action-chip DOM depends on the final selection. Rebuilding it for
    // every pointermove forces layout and creates a dozen buttons repeatedly
    // while the user is still dragging. Keep the lightweight Phaser outline
    // and size badge live, then build the chips once on pointerup.
    this.clearBuildPaletteOverlay();
    // mouseup 시 contextmenu 가 문서 타겟으로 뜨는 브라우저 대비.
    this.suppressBrowserContextMenuUntil = Date.now() + 1500;
    this.isPainting = false;
    this.lastPaintKey = "";
    // 우클릭 시작 시점에는 기존 선택을 유지 — 드래그가 실제로 진행되면 updateRightRegionGesture에서 새 선택을 만든다.
    // 이전에는 여기서 1×1 선택을 만들었는데, 클릭으로 끝나면 1×1 박스가 캔버스에 남는 문제가 있었다.
  }

  /** 붙여넣기 미리보기 모드 클릭 처리 — Phaser 포인터다운과 오버레이 claim("scene")이 공통으로 사용한다. */
  private handlePastePreviewPointerDown(isRightClick: boolean, tile: { readonly x: number; readonly y: number } | null): void {
    const mid = this.mapId();
    if (isRightClick || !mid || !tile || tile.x < 0 || tile.y < 0) {
      cancelPastePreview();
    } else {
      confirmPastePreview(mid);
    }
    // 붙여넣기 미리보기도 제스처다 — 확정/취소로 끝나면 미뤄 둔 초점을 재생한다.
    this.replayDeferredCameraFocus();
  }

  /** 오버레이에서 넘어온 우클릭을 pointerdown 의 우클릭과 같은 순서로 처리한다. */
  private beginRightRegionGestureFromClientPoint(point: CanvasPointerPoint): void {
    // DOM 오버레이 경로에는 Phaser 포인터 객체가 없으므로 pointer 없이 settleZoom=true 로 카메라 초점을 취소한다.
    this.cancelCameraFocus(true);
    const tile = this.clientPointToTile({ x: point.clientX, y: point.clientY });
    if (!tile) return;
    this.beginRightRegionGestureAt({ x: point.clientX, y: point.clientY }, tile);
  }

  /** 오버레이가 삼킨 pointerdown 을 캔버스 제스처로 되살린다. 판정은 순수 모듈 하나가 갖는다. */
  /**
   * 그 화면 좌표를 덮는 이벤트의 id (2026-09-12).
   *
   * 로케이션 오버레이가 «이 칸에 이벤트가 있는가» 를 물을 때 쓴다. 오버레이는 store 를
   * 읽을 수도 있지만, 편집 중 초안(`editorWorkingEvents`) 을 아는 쪽은 씬이다 — 초안과
   * 저장본이 갈라지는 순간 오버레이가 «보이는데 안 잡히는» 판정을 하게 된다.
   */
  private eventIdCoveringClientPoint(point: CanvasPointerPoint): string | null {
    const mapId = this.mapId();
    if (!mapId) return null;
    const map = store.getCurrent().maps[mapId];
    if (!map) return null;
    const tile = this.clientPointToTile({ x: point.clientX, y: point.clientY });
    if (!tile) return null;
    return findEventCoveringPoint(editorWorkingEvents(map.events), tile.x, tile.y)?.id ?? null;
  }

  private claimCanvasPointer(point: CanvasPointerPoint): CanvasGestureClaim | null {
    const state = editorState.get();
    const tool = state.tool;
    const tile = this.clientPointToTile({ x: point.clientX, y: point.clientY });
    const mapId = this.mapId();
    const map = mapId ? store.getCurrent().maps[mapId] : undefined;
    const owner = resolveCanvasGestureOwner({
      pointer: point,
      pastePreviewActive: state.pastePreview !== null,
      panArmed: this.cameraPanController?.armed() ?? false,
      tool,
      selectionActive: state.selection !== null,
      paletteStampActive: state.activePaletteStamp !== null && state.activePaletteStamp !== undefined,
      deferCameraFocus: shouldDeferCameraFocus(this.pointerGestureState()),
      tileInMapBounds: Boolean(map && tile && tile.x >= 0 && tile.y >= 0 && tile.x < map.width && tile.y < map.height),
    });
    if (!owner) return null;
    if (owner === "scene") {
      return {
        kind: "scene",
        start: () => {
          this.cancelCameraFocus(true);
          const isRight = point.button === 2 || (point.buttons & 2) === 2;
          this.handlePastePreviewPointerDown(isRight, tile);
        },
      };
    }
    if (owner === "pan") {
      return { kind: "pan", start: () => this.cameraPanController?.startFromScreenPoint(point.clientX, point.clientY) };
    }
    return { kind: "region", start: () => this.beginRightRegionGestureFromClientPoint(point) };
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
      // 우클릭 드래그 → **영역을 잡는 동작**이다. 놓은 자리에 선택 액션 바가 뜨고,
      // AI 작업은 그 바의 첫 버튼이다.
      // 한동안은 여기서 영역 작업 창을 바로 열었는데(우클릭 드래그의 목적이 사실상 AI라는
      // 전제), 그러면 복사·붙여넣기·지우기·구조물 저장이 전부 창 뒤로 밀려 Esc(취소
      // 어포던스)를 거쳐야 닿았다. 실수로 드래그해도 큰 창이 떴다. 제스처는 선택까지만 하고
      // 무엇을 할지는 바에서 고른다.
      this.lastRightDragScreen = screen;
      selectTileRegion(gesture.mapId, {
        mapId: gesture.mapId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      // 창이 떠 있는 채로 다시 영역을 잡았다면 그건 **대상 재지정**이다. 창을 새 영역으로
      // 갈아 끼우고(입력해 둔 지시문은 따라온다) 칩 바나 첫사용 힌트는 띄우지 않는다 —
      // 창이 이미 그 자리에 있고, 칩 바는 창이 열려 있는 동안 물러나 있다.
      if (retargetRegionTaskModal(rect, screen)) return;
      notifyRightDragRegionSelected();
      return;
    }

    // 이미 잡혀 있는 다중 선택 안을 우클릭 탭 → 그 선택을 유지하고 액션 바를 놓은 자리로
    // 되살린다(스포이트로 선택을 잃지 않는다). 예전에는 여기서 AI 창을 열었다.
    const existing = editorState.get().selection;
    if (
      existing &&
      existing.mapId === gesture.mapId &&
      isSignificantRegionDrag(existing) &&
      isCellInsideSelection(existing, end.x, end.y)
    ) {
      this.lastRightDragScreen = screen;
      this.renderBuildPaletteOverlay();
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
    // 찍어 둔 구조물을 덮은 칸이면 구조물 메뉴(다시 찍기·지우기·킷 편집 + 스포이트). 아니면 곧장 스포이트.
    if (
      openStructurePlacementContextMenu({
        mapId: gesture.mapId,
        x: end.x,
        y: end.y,
        point: screen,
        onPickTile: () => this.getTilePaintEngine().pickVisibleTileAt(gesture.mapId, end.x, end.y),
      })
    ) {
      return;
    }
    this.getTilePaintEngine().pickTileAtPointer(ptr);
  }

  /**
   * 타일 영역의 클라이언트(화면) 사각형. 영역 작업 팝오버가 대상 영역과 캔버스 고스트
   * 미리보기를 덮지 않도록 넘긴다(`avoid`). 카메라/캔버스를 못 읽는 환경에서는 null 이고,
   * 그때는 팝오버가 기존 anchor 배치를 그대로 쓴다.
   *
   * 창을 여는 주체는 이제 선택 액션 바(Phaser 비의존 DOM)라, 이 계산을
   * regionClientRect 등록소로 내보낸다.
   */
  private regionClientRect(region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null {
    const canvas = this.game?.canvas;
    const camera = this.cameras?.main;
    if (!canvas || !camera || typeof canvas.getBoundingClientRect !== "function") return null;
    const canvasRect = canvas.getBoundingClientRect();
    return tileRectToClientRect({
      tileRect: region,
      worldView: { x: camera.worldView.x, y: camera.worldView.y },
      zoom: camera.zoom,
      canvasOrigin: { x: canvasRect.left, y: canvasRect.top },
      tileSize: this.activeTileSize(),
    });
  }

  private startPan(ptr: Phaser.Input.Pointer): void {
    this.cameraPanController?.start(ptr);
  }

  private continuePan(ptr: Phaser.Input.Pointer): void {
    this.cameraPanController?.continue(ptr);
  }

  private stopPan(): void {
    // 실제 활성 팬이 끝나면 CameraPanController의 onPanEnd가 미뤄 둔 초점을 재생한다.
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
      this.clearHoverPreviewLayer();
      return;
    }
    this.renderHoverPreview(x, y);
  }

  private clearHoverPreview(): void {
    this.lastPointerTile = null;
    this.clearEventMarkerTooltip();
    this.clearHoverPreviewLayer();
  }

  /** 페인트 스트로크 중 raw 호버만 제거 (포인터 좌표·툴팁 상태 유지). */
  private suppressPaintHoverPreview(): void {
    this.clearHoverPreviewLayer();
  }

  // ── 붙여넣기 미리보기 고스트 ──
  // 클립보드 내용을 반투명 타일로 커서 위치에 그린다.
  private renderPastePreviewGhost(): void {
    const layer = this.hoverPreviewLayer;
    if (!layer) return;
    const preview = editorState.get().pastePreview;
    const clipboard = editorState.get().clipboard;
    if (!preview || !clipboard) {
      this.clearPastePreviewGhost();
      return;
    }
    const mapId = this.mapId();
    if (!mapId) return;
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    if (!tileset) return;
    if (
      this.pasteGhostClipboard === clipboard
      && this.pasteGhostAt
      && layer.list.length > 0
    ) {
      const dx = (preview.x - this.pasteGhostAt.x) * this.activeTileSize();
      const dy = (preview.y - this.pasteGhostAt.y) * this.activeTileSize();
      if (dx !== 0 || dy !== 0) {
        for (const child of layer.list) {
          const positioned = child as Phaser.GameObjects.GameObject & { x: number; y: number };
          positioned.x += dx;
          positioned.y += dy;
        }
        this.pasteGhostAt = { x: preview.x, y: preview.y };
      }
      return;
    }
    this.clearHoverPreviewLayer();
    this.pasteGhostClipboard = clipboard;
    this.pasteGhostAt = { x: preview.x, y: preview.y };
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
        preview.x * this.activeTileSize(),
        preview.y * this.activeTileSize(),
        w * this.activeTileSize(),
        h * this.activeTileSize(),
        0x51cf66,
        0.08,
      );
      border.setOrigin(0, 0);
      border.setStrokeStyle(2, 0x51cf66, 0.9);
      layer.add(border);
    }
  }

  private clearPastePreviewGhost(): void {
    this.clearHoverPreviewLayer();
  }

  private clearHoverPreviewLayer(): void {
    this.hoverPreviewLayer?.removeAll(true);
    this.pasteGhostClipboard = null;
    this.pasteGhostAt = null;
  }

  private syncSelectionOverlay(): void {
    const layer = this.selectionLayer;
    const mapId = this.mapId();
    if (!layer || !mapId) return;
    syncSelectionOverlay(this, layer, mapId);
  }

  private shouldRenderPaintHover(): boolean {
    if (editorState.get().pastePreview) return false;
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
      this.clearHoverPreviewLayer();
      return;
    }
    renderHoverTilePreview({ centerX, centerY, layer, mapId, scene: this, tileSize: this.activeTileSize() });
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

  /**
   * 이벤트 레이어 **빈 칸** 좌클릭을 팬 후보로 기록한다.
   *
   * "빈 칸"의 판정은 DragOperationHandler 에 맡긴다: maybeBeginEventDragCandidate 가 방금
   * 같은 포인터로 findEventCoveringPoint(=이벤트 **몸 사각** 조회)를 돌렸으므로, 후보가
   * 없다는 것이 곧 "이 칸에는 옮길 이벤트가 없다"는 뜻이다. 여기서 좌표 판정을 다시
   * 구현하면 앵커만 보던 시절의 2×2 이벤트 결함이 되살아난다.
   */
  private armEventLayerPanCandidate(ptr: Phaser.Input.Pointer): void {
    this.eventLayerPanCandidate = null;
    if (editorState.get().layer !== "event") return;
    if (ptr.button !== 0) return;
    if (this.getDragOperationHandler().busy()) return;
    const screen = this.pointerScreenPosition(ptr);
    this.eventLayerPanCandidate = { screenX: screen.x, screenY: screen.y };
  }

  /** 팬 후보가 문턱을 넘었으면 카메라 팬으로 승격한다. 넘기 전에는 클릭이 살아 있다. */
  private tryPromoteEventLayerPan(ptr: Phaser.Input.Pointer): boolean {
    const candidate = this.eventLayerPanCandidate;
    if (!candidate) return false;
    const screen = this.pointerScreenPosition(ptr);
    const dx = screen.x - candidate.screenX;
    const dy = screen.y - candidate.screenY;
    if (Math.hypot(dx, dy) < EVENT_LAYER_PAN_THRESHOLD_PX) return false;
    this.eventLayerPanCandidate = null;
    // 팬이 됐으니 이건 클릭이 아니다 — 눌린 순간 applyAtPointer 가 잡아 둔 「여기에 새
    // 이벤트」 예약을 되돌린다. 남겨 두면 화면을 민 뒤 엉뚱한 칸의 CTA 가 떠 있다.
    this.isPainting = false;
    this.lastPaintKey = "";
    editorState.set({ pendingEventCoordinate: null });
    this.cancelCameraFocus();
    this.cameraPanController?.startFromScreenPoint(candidate.screenX, candidate.screenY);
    this.continuePan(ptr);
    return true;
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
    // 문서에서 떨어진 캔버스의 씬은 키를 먹지 않는다. 부트 도중 teardown 이 스쳐 게임이
    // 추적에서 빠지면(고아) KeyboardManager 의 window 리스너만 남아, 보이는 씬과 이 씬이
    // 한 번의 Ctrl+Z 를 각각 되돌려 두 단계가 사라졌다. 씬 쪽에서도 문을 닫아 두면
    // 어떤 누수 경로가 생겨도 키 소비로 번지지 않는다.
    if (!this.game.canvas?.isConnected) return;
    // 히스토리 키는 굵은 가드보다 먼저 — shouldIgnoreEditorShortcut 은 체크박스/슬라이더
    // 포커스까지 INPUT 으로 묶어 되돌리기를 삼켰다. handleHistoryHotkey 가 텍스트 편집
    // 포커스만 정확히 양보하고, 성공/빈 스택 모두 토스트로 알린다.
    if (this.handleHistoryKey(event)) return;
    // 텍스트 입력/모달이 포커스를 잡고 있으면 에디터 단축키를 끈다.
    if (shouldIgnoreEditorShortcut(event)) return;
    if (this.cameraPanController?.handleSpaceKeyDown(event)) return;
    if (!(event.ctrlKey || event.metaKey) && this.panWithArrowKey(event)) return;
    if (!(event.ctrlKey || event.metaKey) && event.key === "Escape" && this.handleEscapeKey()) return;
    // RM2K3 스타일 단축키: F5/F6/F7 레이어, 1..7 도구, +/- 줌.
    if (!(event.ctrlKey || event.metaKey) && handleEditorKey(event)) return;
    this.handleShortcut(event);
  }

  private handleHistoryKey(event: KeyboardEvent): boolean {
    if (!isHistoryHotkeyChord(event)) return false;
    // 데이터베이스/이벤트 에디터 모달은 자체 리스너로 같은 키를 처리한다 — 두 번 되돌리지 않는다.
    if (historyHotkeyOwnedByPanel()) return false;
    const mid = this.mapId();
    if (mid && !canEditMap(mid)) {
      event.preventDefault();
      toast(mapEditLockNotice(mid), "error");
      return true;
    }
    const applied = handleHistoryHotkey(event);
    // 드래그 중에 되돌리면 브러시가 살아 있어 다음 pointermove 가 복원된 칸을
    // 스냅샷 없이 다시 칠한다. 적용된 뒤에만 제스처를 버린다.
    if (applied) this.abandonOpenPaintGesture();
    return applied;
  }

  /**
   * Esc 사슬의 **마지막** 소비자. 이 앞에 누가 있고 왜 여기가 마지막인지는
   * editor/escapeToPan.ts 머리말이 file:line 으로 적어 둔다(Phaser 는 defaultPrevented
   * 된 키를 발화하지 않으므로, 앞에서 preventDefault 한 표면의 Esc 는 여기 오지 않는다).
   *
   * 순서 판정을 resolveEscapeAction 으로 뺀 이유: Esc 회귀는 언제나 "누가 먼저
   * 가져가는가"에서 났고, 실제 사슬(캡처/버블 + Phaser 가드)은 단위 테스트로 재현하기
   * 어렵지만 **순서**만은 순수 함수로 잠글 수 있다.
   */
  private handleEscapeKey(): boolean {
    const state = editorState.get();
    const action = resolveEscapeAction({
      // 영역 작업 창이 떠 있으면 Esc 는 그 창의 것이다. 창이 비모달이 되면서 포커스가
      // 캔버스에 있는 채로 Esc 가 여기까지 올 수 있게 됐는데, 그때 선택까지 지워 버리면
      // Esc 한 번에 창과 선택이 함께 사라져 칩 바로 돌아갈 수 없다.
      regionTaskModalOpen: isRegionTaskModalOpen(),
      modalLayerOpen: hasOpenModalLayer(),
      transientOwnerOpen: escapeOwnedByTransientSurface(),
      pastePreviewActive: state.pastePreview !== null,
      selectionActive: state.selection !== null,
      panToolActive: state.tool === "pan",
    });
    switch (action) {
      case "defer-to-owner":
      case "none":
        return false;
      case "cancel-paste-preview":
        cancelPastePreview();
        this.clearPastePreviewGhost();
        this.replayDeferredCameraFocus();
        return true;
      case "clear-selection":
        clearSelection();
        return true;
      case "enter-pan":
        // 새 팬 구현을 만들지 않는다 — 기존 「화면 밀기」 도구를 켜면 좌클릭 드래그 팬,
        // grab 커서, 툴바 aria-pressed, 사이드바 상태 배지가 한꺼번에 따라온다.
        enterPanTool();
        return true;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.cameraPanController?.handleSpaceKeyUp(event);
  }

  private panWithArrowKey(event: KeyboardEvent): boolean {
    const step = event.shiftKey ? this.activeTileSize() * 16 : this.activeTileSize() * 6;
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
    this.cancelCameraFocus();
    this.cameraPanController?.panBy(deltaX, deltaY);
  }

  private clearMapEdgeBand(): void {
    this.mapEdgeBand?.clear();
    this.mapEdgeGrowArmedAt = 0;
  }

  /** 맵 테두리 바깥에 포인터가 있으면 그 방향으로 맵 칸을 늘린다. 모서리는 가로·세로를 함께 늘린다. */
  private stepMapEdgeGrow(): void {
    const band = this.mapEdgeBand;
    const gesture = this.pointerGestureState();
    const busy = gesture.painting || gesture.panning || gesture.dragging || gesture.rightRegionGesture || gesture.pastePreview;
    const ptr = this.input?.activePointer;
    if (!band || !this.pointerOverCanvas || busy || !ptr || ptr.isDown) {
      this.clearMapEdgeBand();
      return;
    }
    const mapId = this.mapId();
    const map = mapId ? store.getCurrent().maps[mapId] : undefined;
    const camera = this.cameras?.main;
    if (!mapId || !map || !camera) {
      this.clearMapEdgeBand();
      return;
    }
    const world = ptr.positionToCamera(camera) as { readonly x: number; readonly y: number };
    const tileSize = this.activeTileSize();
    const zoom = camera.zoom > 0 ? camera.zoom : 1;
    const axes = mapEdgeGrowAxes({
      worldX: world.x,
      worldY: world.y,
      mapWidthPx: map.width * tileSize,
      mapHeightPx: map.height * tileSize,
      zoom,
    });
    this.paintMapEdgeBand(axes, map.width * tileSize, map.height * tileSize);
    if (!axes) {
      this.mapEdgeGrowArmedAt = 0;
      this.mapEdgeGrowLimitNoted = false;
      return;
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.mapEdgeGrowArmedAt === 0) this.mapEdgeGrowArmedAt = now;
    if (now - this.mapEdgeGrowArmedAt < MAP_EDGE_GROW_ARM_MS) return;
    if (now - this.mapEdgeGrowLastAt < MAP_EDGE_GROW_STEP_MS) return;
    this.mapEdgeGrowLastAt = now;
    const grown = growMapOnEdges(mapId, axes);
    if (!grown) {
      const wantsWidth = (axes.left || axes.right) && exceedsMapDimensionLimit(map.width + 1, 1);
      const wantsHeight = (axes.up || axes.down) && exceedsMapDimensionLimit(1, map.height + 1);
      if ((wantsWidth || wantsHeight) && !this.mapEdgeGrowLimitNoted) {
        this.mapEdgeGrowLimitNoted = true;
        toast(mapSizeLimitMessage(), "error");
      }
      return;
    }
    if (grown.dx !== 0 || grown.dy !== 0) {
      camera.setScroll(camera.scrollX + grown.dx * tileSize, camera.scrollY + grown.dy * tileSize);
      this.afterCameraMoved();
    }
  }

  private paintMapEdgeBand(axes: MapEdgeGrowAxes | null, mapWidthPx: number, mapHeightPx: number): void {
    const band = this.mapEdgeBand;
    if (!band) return;
    band.clear();
    if (!axes) return;
    const zoom = this.cameras.main.zoom > 0 ? this.cameras.main.zoom : 1;
    const thickness = 6 / zoom;
    band.fillStyle(0xe8a04a, 0.45);
    if (axes.left) band.fillRect(-thickness, 0, thickness, mapHeightPx);
    if (axes.right) band.fillRect(mapWidthPx, 0, thickness, mapHeightPx);
    if (axes.up) band.fillRect(0, -thickness, mapWidthPx, thickness);
    if (axes.down) band.fillRect(0, mapHeightPx, mapWidthPx, thickness);
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
    if (key === "v" && !canEditMap(mid)) {
      event.preventDefault();
      toast(mapEditLockNotice(mid), "error");
      return;
    }
    if (key === "c") {
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

  /**
   * 화면(클라이언트) 좌표 → 타일. `pointerToTile` 과 같은 기하를 쓰되 Phaser 포인터 없이
   * 계산한다(DOM 오버레이용). 카메라/캔버스를 못 읽으면 null.
   */
  private clientPointToTile(point: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } | null {
    const canvas = this.game?.canvas;
    const camera = this.cameras?.main;
    if (!canvas || !camera || typeof canvas.getBoundingClientRect !== "function") return null;
    const rect = canvas.getBoundingClientRect();
    const worldX = camera.worldView.x + (point.x - rect.left) / camera.zoom;
    const worldY = camera.worldView.y + (point.y - rect.top) / camera.zoom;
    const tileSize = this.activeTileSize();
    return { x: Math.floor(worldX / tileSize), y: Math.floor(worldY / tileSize) };
  }

  private pointerToTile(ptr: Phaser.Input.Pointer): { x: number; y: number } {
    const world = ptr.positionToCamera(this.cameras.main) as { readonly x: number; readonly y: number };
    const tileSize = this.activeTileSize();
    return {
      x: Math.floor(world.x / tileSize),
      y: Math.floor(world.y / tileSize),
    };
  }

  /**
   * 현재 맵의 좌표 단위. 렌더(`createChipsetTileObject`)·컬링(`cameraTileWindow`)·
   * 이 함수가 **같은 값**을 읽어야 클릭한 칸과 칠해지는 칸이 일치한다.
   * 맵을 못 찾으면 16 으로 내려간다(부팅 직후·맵 전환 중).
   */
  private activeTileSize(): number {
    const project = store.getCurrent();
    const map = project.maps[this.mapId() ?? ""];
    return mapTileSize(map, map ? project.tilesets[map.tilesetId] : undefined);
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
      // 더블클릭이 맵 밖으로 벗어나면 아무 일도 안 일어나던 무반응 데드엔드 수정
      // (2026-08-18 초보자 UX 리뷰 P1-5) — 피드백 없는 실패는 금지.
      if (openEditor) toast("맵 안쪽 타일을 더블클릭하면 새 이벤트를 만듭니다", "info");
      editorState.set({ pendingEventCoordinate: null });
      return;
    }
    const existing = findEventCoveringPoint(editorWorkingEvents(map.events), x, y);
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
      !findEventCoveringPoint(editorWorkingEvents(map.events), x, y),
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
      !findEventCoveringPoint(editorWorkingEvents(map.events), pending.x, pending.y),
    );
    if (!valid) editorState.set({ pendingEventCoordinate: null });
  }

  private offerEventLayerSwitchAt(mapId: MapId, x: number, y: number, layer: string, clickCount: number): boolean {
    void mapId;
    void x;
    void y;
    void layer;
    void clickCount;
    return false;
  }

  private openExistingEventAt(mapId: MapId, x: number, y: number): boolean {
    const map = store.getCurrent().maps[mapId];
    const existing = map ? findEventCoveringPoint(editorWorkingEvents(map.events), x, y) : undefined;
    if (!existing) return false;
    this.isPainting = false;
    this.lastPaintKey = "";
    editorState.set({ selectedEventId: existing.id, selectedEventPageId: null, pendingEventCoordinate: null });
    openEventEditorModal(mapId, existing.id);
    return true;
  }

  private pointerClickCount(ptr: Phaser.Input.Pointer): number {
    const event = ptr.event;
    if (event instanceof MouseEvent || event instanceof PointerEvent) {
      // Chromium 실측(2026-08-11): pointerdown 의 detail 은 항상 0 이고 클릭 횟수는
      // mousedown/click 에만 실린다. Phaser 핸들러가 받는 ptr.event 는 네이티브
      // pointerdown 이므로 detail 만으로는 더블클릭을 판별할 수 없다.
      if (event.detail >= 2) return event.detail;
    }
    // 같은 타일을 500ms 안에 두 번 누르면 더블클릭으로 본다(eventLayerClickCount 와 동일 규칙).
    const mapId = this.mapId();
    const { x, y } = this.pointerToTile(ptr);
    const now = Date.now();
    const previous = this.lastPointerClick;
    this.lastPointerClick = mapId ? { at: now, mapId, x, y } : null;
    if (!previous || !mapId) return 1;
    const sameTile = previous.mapId === mapId && previous.x === x && previous.y === y;
    return sameTile && now - previous.at <= EVENT_LAYER_DOUBLE_CLICK_MS ? 2 : 1;
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
      this.navigationGeometry = null;
      this.lastNavGeometryKey = "";
      this.lastPointerTile = null;
      // 맵이 바뀌면 미뤄 둔 초점은 버린다 — 다른 맵의 요청이라 panCameraToTile 이 어차피 mapId 에서 버린다.
      this.deferredCameraFocus = null;
      this.clearHoverPreview();
      this.clearAgentFocusHighlight();
      this.clearEventLayerClickFeedback();
      this.lastPaintKey = "";
      this.dragOperationHandler?.clear();
      this.lastMaterializedTileWindowKey = "";
    }
    this.lastRenderedMapId = mid;
    this.lastRenderStateKey = this.renderStateKey(mid);
    this.lastViewChromeKey = this.viewChromeKey();
    this.lastAppliedZoom = editorState.get().zoom;
    const cameraViewKey = this.cameraViewKey(mid);
    const resetCamera = cameraViewKey !== this.lastCameraViewKey;
    if (mapChanged || resetCamera) this.cancelCameraFocus(false);
    this.lastCameraViewKey = cameraViewKey;
    const tileLayer = this.tileLayer;
    const upperTileLayer = this.upperTileLayer;
    const hoverPreviewLayer = this.hoverPreviewLayer;
    const overlayLayer = this.overlayLayer;
    const gridGraphics = this.gridGraphics;
    if (!tileLayer || !upperTileLayer || !hoverPreviewLayer || !overlayLayer || !gridGraphics) return;
    renderEditScene({
      scene: this,
      backgroundPreview: mapBackgroundPreviewEnabled(),
      tileLayer,
      upperTileLayer,
      tileChunks: this.tileChunks,
      overlayLayer,
      gridGraphics,
      mapId: mid,
      tileIndex: this.tileIndex,
      resetCamera,
      preserveCameraLookAt: resetCamera && !mapChanged,
    });
    const renderedMap = store.getCurrent().maps[mid];
    this.lastMaterializedTileWindowKey = renderedMap && shouldLazilyRenderEditMap(renderedMap)
      ? editSceneTileWindowKey(this, renderedMap)
      : "";
    this.renderEventLayerClickFeedback();
    // 배경 미리보기는 타일 렌더와 별개다 — 토글·맵·그림이 바뀔 때만 스프라이트를 다시 만든다.
    this.renderMapBackgroundPreview();
    this.renderAgentGhostPreview();
    // 청사진도 고스트와 같이 다시 그린다 — 청사진 스토어 구독만으로는 부족하다. 맵 전환은
    // editorState/store 만 흔들므로, 다시 그리지 않으면 A 맵의 "2/7 집" 사각형이 B 맵의 같은
    // 타일 좌표 위에 그대로 남고(레이어는 맵을 따라 비워지지 않는다), 계획이 굳은 뒤 A 로
    // 돌아오면 다음 상태 변화까지 아무것도 안 보인다.
    this.renderAgentBlueprint();
    this.publishMapViewport();
    if (!mapChanged && this.lastPointerTile && this.shouldRenderPaintHover()) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
    this.syncSelectionOverlay();
    this.renderBuildPaletteOverlay();
  }

  private canIncrementallyRenderCells(mapId: MapId): boolean {
    if (this.lastRenderedMapId !== mapId) return false;
    if (!this.tileLayer || !this.upperTileLayer || !this.overlayLayer || !this.gridGraphics) return false;
    return this.lastRenderStateKey === this.renderStateKey(mapId);
  }


  /**
   * 맵 배경 미리보기 — 토글이 켜져 있을 때만 그린다.
   *
   * 기본값에서 그리지 않는 이유: 빈 하위 칸의 체커는 "여기 바닥이 없다" 를 보이게 하는 의도된
   * 신호이고 사용자가 유지를 요구했다(2026-08-27). 미리보기 중에도 체커를 통째로 지우지 않고
   * 알파만 낮춘다(`editSceneRender.createEmptyTile`) — 배경과 신호가 같이 읽힌다.
   *
   * 배치는 플레이와 같다: 화면 고정(`scrollFactor 0`) + 카메라 줌 보정. 팬할 때 좌표만 다시 쓴다.
   * 스크롤 위상은 0 으로 둔다 — 움직임의 정본은 플레이 화면이다.
   */
  private renderMapBackgroundPreview(): void {
    const container = this.mapBackgroundLayer;
    if (!container) return;
    const mapId = this.mapId();
    const background = mapId ? store.getCurrent().maps[mapId]?.background : undefined;
    const enabled = mapBackgroundPreviewEnabled();
    // 플레이와 같은 스택(첫 장 + layers, 앞이 아래)로 미리보기 — 저작 화면에서 보는 게임 상태와 렌더가 달라지 않게.
    const specs = enabled && background
      ? [background, ...(background.layers ?? [])].filter((entry) => (entry.imageId ?? "").trim() !== "")
      : [];
    // 편집기 캔버스는 플레이와 같은 계약을 따른다 — 배경은 **창 타일을 깐 칸에서만** 보이고
    // 빈 칸은 가려진다(RM2K 방식, playSceneMapRuntime §renderEmptyCellCover). 캔버스는
    // 체커가 "바닥 없음" 신호라 배경을 안 그리므로, 여기서는 스프라이트를 깔되 빈 칸 위에는
    // 올리지 않는다 — 창 타일 칸에서만 보이게 하는 것이 그 규칙의 시각적 결과다.
    if (specs.length === 0) {
      this.clearMapBackgroundPreview();
      return;
    }
    const missing = specs.filter((spec) => !this.textures.exists(mapBackgroundTextureKey(spec.imageId)));
    if (missing.some((spec) => !resolveAssetResourceUrl(spec.imageId, { project: store.getCurrent() }))) {
      // 플레이는 경고를 남기고 건너뛴 — 미리보기도 같은 귟c칙으로 그림을 생략한다.
      this.clearMapBackgroundPreview();
      return;
    }
    const apply = (): void => {
      if (this.mapId() !== mapId || !mapBackgroundPreviewEnabled()) return;
      const ready = specs.filter((spec) => this.textures.exists(mapBackgroundTextureKey(spec.imageId)));
      const previous = this.mapBackgroundSprites;
      const sprites: Phaser.GameObjects.TileSprite[] = [];
      for (const [index, spec] of ready.entries()) {
        const textureKey = mapBackgroundTextureKey(spec.imageId);
        let sprite = previous[index];
        if (!sprite) {
          sprite = this.add.tileSprite(0, 0, 16, 16, textureKey);
          sprite.setOrigin(0, 0);
          sprite.setScrollFactor(0);
          container.add(sprite);
        } else if (sprite.texture.key !== textureKey) {
          sprite.setTexture(textureKey);
        }
        sprite.setDepth(MAP_BACKGROUND_LAYER_DEPTH + index);
        // 플레이와 같은 배율 규칙(cover 면 뷰포트를 덮게 확대). 1:1 이면 1920x1080 아트가
        // 좌상단 구석만 보여 «저작 화면과 게임 화면이 다른» 상태가 된다.
        applyPreviewFit(this, sprite, spec.fit);
        sprites.push(sprite);
      }
      for (const leftover of previous.slice(ready.length)) leftover.setVisible(false);
      this.mapBackgroundSprites = sprites;
      this.mapBackgroundPreviewSpecs = ready.map((entry) => ({ fit: entry.fit ?? "native" }));
      this.layoutMapBackgroundPreview();
    };
    if (missing.length === 0) {
      apply();
      return;
    }
    void Promise.all(
      missing.map((spec) => {
        const url = resolveAssetResourceUrl(spec.imageId, { project: store.getCurrent() });
        return url ? ensureSceneImageTexture(this, mapBackgroundTextureKey(spec.imageId), url) : Promise.resolve(undefined);
      }),
    ).then(() => {
      if (this.mapId() !== mapId || !mapBackgroundPreviewEnabled()) return;
      apply();
    });
  }

    private layoutMapBackgroundPreview(): void {
    const specs = this.mapBackgroundPreviewSpecs;
    for (const [index, sprite] of this.mapBackgroundSprites.entries()) {
      if (!sprite.visible) continue;
      const spec = specs[index];
      if (spec) applyPreviewFit(this, sprite, spec.fit);
      const layout = mapBackgroundLayout(this.cameras.main);
      if (sprite.width !== layout.width || sprite.height !== layout.height) sprite.setSize(layout.width, layout.height);
      sprite.setPosition(layout.x, layout.y);
    }
  }

  private clearMapBackgroundPreview(): void {
    this.mapBackgroundPreviewSpecs = [];
    for (const sprite of this.mapBackgroundSprites) sprite.setVisible(false);
  }

  private redrawCells(cells: readonly ProjectChangeCell[]): EditSceneRenderStats {
    const mid = this.mapId();
    const tileLayer = this.tileLayer;
    const upperTileLayer = this.upperTileLayer;
    const overlayLayer = this.overlayLayer;
    const gridGraphics = this.gridGraphics;
    if (!mid || !tileLayer || !upperTileLayer || !overlayLayer || !gridGraphics) return { tileObjectsUpdated: 0 };
    const stats = renderEditSceneTileCells({
      scene: this,
      backgroundPreview: mapBackgroundPreviewEnabled(),
      tileLayer,
      upperTileLayer,
      tileChunks: this.tileChunks,
      overlayLayer,
      gridGraphics,
      mapId: mid,
      tileIndex: this.tileIndex,
    }, cells);
    if (cells.some((cell) => cell.layer === "event")) {
      refreshEditSceneOverlay({ scene: this, tileLayer, upperTileLayer, tileChunks: this.tileChunks, overlayLayer, gridGraphics, mapId: mid });
    }
    if (this.lastPointerTile && this.shouldRenderPaintHover()) this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
    this.syncSelectionOverlay();
    this.renderBuildPaletteOverlay();
    return stats;
  }

  private redrawWhenViewStateChanges(): void {
    const mid = this.mapId();
    if (!mid) return;
    const state = editorState.get();
    if (state.zoom !== this.lastAppliedZoom) {
      // 줌은 카메라 속성이다 — 타일 오브젝트는 줌에 의존하지 않으므로 전체 재렌더 없이
      // 카메라 기하만 다시 적용한다. 타일 오브젝트 재생성은 O(N²)라(Phaser 컨테이너
      // 재부모화·remove 의 indexOf) 줌 단계마다 돌면 큰 맵에서 프리즈가 된다.
      this.applyCameraZoomOnly(mid);
    }
    const nextKey = this.renderStateKey(mid);
    if (nextKey !== this.lastRenderStateKey) {
      this.redraw();
      return;
    }
    const chromeKey = this.viewChromeKey();
    if (chromeKey !== this.lastViewChromeKey) {
      this.lastViewChromeKey = chromeKey;
      this.syncViewChrome(mid);
    }
    // 붙여넣기 미리보기 고스트 — editorState 변화(위치 이동 등)마다 갱신.
    if (state.pastePreview) {
      this.renderPastePreviewGhost();
    } else {
      this.clearPastePreviewGhost();
    }
    this.syncSelectionOverlay();
    this.renderBuildPaletteOverlay();
    if (this.lastPointerTile && this.shouldRenderPaintHover()) {
      this.renderHoverPreview(this.lastPointerTile.x, this.lastPointerTile.y);
    }
  }

  /**
   * 레이어 흐림·충돌 칠·이벤트 고리·격자. 타일 그림 자체는 이미 만들어져 있다.
   */
  private syncViewChrome(mapId: MapId): void {
    const tileLayer = this.tileLayer;
    const upperTileLayer = this.upperTileLayer;
    const overlayLayer = this.overlayLayer;
    const gridGraphics = this.gridGraphics;
    if (!tileLayer || !upperTileLayer || !overlayLayer || !gridGraphics) return;
    const map = store.getCurrent().maps[mapId];
    if (!map) return;
    const state = editorState.get();
    applyEditTileLayerPresentation(this.tileIndex, state.layer);
    refreshEditSceneOverlay({
      scene: this,
      tileLayer,
      upperTileLayer,
      tileChunks: this.tileChunks,
      overlayLayer,
      gridGraphics,
      mapId,
      tileIndex: this.tileIndex,
    });
    repaintEditGrid(gridGraphics, map, state.layer, state.showGrid);
  }

  private applyCameraZoomOnly(mid: MapId): void {
    const map = store.getCurrent().maps[mid];
    if (!map) return;
    this.lastAppliedZoom = editorState.get().zoom;
    applyCameraView(this, map, true);
    this.lastCameraViewKey = this.cameraViewKey(mid);
    this.lastNavGeometryKey = "";
    this.syncNavigationGeometry();
    this.layoutMapBackgroundPreview();
    this.publishMapViewport();
  }

  /**
   * 타일 GameObject 를 다시 만들어야 하는 입력만 담는다.
   * 도구·레이어·선택 타일·붓·스탬프는 그림 내용이 아니다 — viewChromeKey 와 호버가 맡는다.
   * selection / pastePreview 도 넣지 마라. 우클릭 드래그·Ctrl+V 고스트가 타일 전체를 다시 만들게 된다.
   */
  private renderStateKey(mapId: MapId): string {
    // 미리보기 토글은 빈 칸 체커의 알파를 바꾼다 — 상태 키에 없으면 증분 렌더가 그 사실을 놓친다.
    return [
      mapId,
      mapBackgroundPreviewEnabled() ? "bg-preview" : "bg-hidden",
    ].join("|");
  }

  private viewChromeKey(): string {
    const state = editorState.get();
    return [
      state.tool,
      state.layer,
      state.selectedEventId ?? "none",
      state.selectedEventPageId ?? "none",
      state.showGrid ? "grid" : "nogrid",
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
    const area = this.cameraVisibleArea();
    if (!area) {
      setEditorMapViewport(null);
      return;
    }
    // 조수가 읽는 "보이는 영역" = worldView ∩ 가림 제외 영역. 카드가 덮은 왼쪽 절반을 보인다고
    // 말하면 모델은 사용자가 못 보는 칸을 "여기"로 해석한다.
    const offsetX = area.unoccluded.x - area.canvas.x;
    const offsetY = area.unoccluded.y - area.canvas.y;
    const snapshot = computeMapViewport(
      map,
      {
        worldLeftPx: area.worldView.x + offsetX / area.zoom,
        worldTopPx: area.worldView.y + offsetY / area.zoom,
        worldWidthPx: area.unoccluded.width / area.zoom,
        worldHeightPx: area.unoccluded.height / area.zoom,
        tileSize: this.activeTileSize(),
      },
    );
    setEditorMapViewport(snapshot);
    this.lastPublishedViewportSignature = this.viewportSignature();
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
    const hasEvent = findEventCoveringPoint(editorWorkingEvents(map.events), x, y) !== undefined;
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
    const existing = map ? findEventCoveringPoint(editorWorkingEvents(map.events), x, y) : undefined;
    if (!existing) {
      this.clearEventMarkerTooltip();
      return;
    }

    const model = buildEventMarkerTooltipModel(existing, collectCallTargetWarnings(store.getCurrent(), existing));

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
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const tileSize = this.activeTileSize();
    // worldView 는 렌더가 실제로 쓰는 사각형이다. scrollX/Y 는 3.60+ 줌 규약 때문에 화면
    // 왼쪽 위와 대응하지 않아 배치가 호스트 코너로 밀려났다(실측 2026-08-27).
    const tileRect = {
      x: canvasRect.left - hostRect.left + (tileX * tileSize - camera.worldView.x) * camera.zoom,
      y: canvasRect.top - hostRect.top + (tileY * tileSize - camera.worldView.y) * camera.zoom,
      width: tileSize * camera.zoom,
      height: tileSize * camera.zoom,
    };

    const placement = computeEventMarkerTooltipPlacement({
      tile: tileRect,
      tip: {
        width: Math.max(1, tipRect.width || tip.offsetWidth || 180),
        height: Math.max(1, tipRect.height || tip.offsetHeight || 72),
      },
      host: {
        width: Math.max(1, hostRect.width),
        height: Math.max(1, hostRect.height),
      },
    });

    for (const anchor of TOOLTIP_ANCHORS) {
      tip.classList.toggle(`tip-anchor-${anchor}`, placement.anchor === anchor);
    }
    tip.style.left = `${Math.round(placement.left)}px`;
    tip.style.top = `${Math.round(placement.top)}px`;
  }

  private clearEventLayerClickFeedback(): void {
    if (this.eventLayerClickFeedback === null) {
      this.eventClickFeedbackLayer?.removeAll(true);
      return;
    }
    this.eventLayerClickFeedback = null;
    this.renderEventLayerClickFeedback();
  }

  private renderEventLayerClickFeedback(): void {
    const layer = this.eventClickFeedbackLayer;
    if (!layer) return;
    layer.removeAll(true);
    const feedback = this.eventLayerClickFeedback;
    if (!feedback || feedback.mapId !== this.mapId() || editorState.get().layer !== "event") return;
    renderEventLayerClickFeedback({ scene: this, overlayLayer: layer, tileSize: this.activeTileSize() }, feedback);
  }

  private renderAgentGhostPreview(): void {
    this.agentGhostPreviewRenderer?.render();
  }

  private renderAgentBlueprint(): void {
    this.agentBlueprintRenderer?.render();
  }

  private clearAgentBlueprintLayer(): void {
    this.agentBlueprintRenderer?.clear();
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
    // 사용자의 손이 화면 위에 있으면 카메라를 빼앗지 않는다 — 판정 근거는
    // shouldDeferCameraFocus 주석(드래그 커밋이 라이브 카메라로 타일을 다시 구한다).
    // 대신 요청을 한 칸에 적어 두고 제스처가 끝나는 순간 한 번 재생한다.
    if (shouldDeferCameraFocus(this.pointerGestureState())) {
      this.deferredCameraFocus = target;
      return;
    }
    const active = this.activeCameraFocus;
    if (active && JSON.stringify(active.target) === JSON.stringify(target)) return;
    const camera = this.cameras.main;
    camera.preRender();
    const plan = planCameraFocus(target, map, this.visibleTileRect(), 1, {
      currentZoom: camera.zoom,
      zoomLevels: EDITOR_ZOOM_LEVELS,
    });
    if (!plan) {
      // A newer, already-visible destination also supersedes a previous trip.
      if (target.onlyIfOffscreen && planCameraFocus({ ...target, onlyIfOffscreen: false }, map, null)) this.cancelCameraFocus();
      return;
    }
    const startZoom = camera.zoom;
    const startX = camera.scrollX + camera.width / 2;
    const startY = camera.scrollY + camera.height / 2;
    this.cancelCameraFocus(false);
    // 줌은 팬보다 **먼저** 바꾼다: editorState.set 이 redraw → applyCameraView 로 카메라를 다시 세우므로
    // 순서를 뒤집으면 방금 계산한 팬 목표가 리셋된 카메라에 덮인다. 줌이 바뀌면 worldView 크기도
    // 달라지므로 팬 목표는 줌 적용 뒤의 기하학으로 구한다.
    const nextZoom = EDITOR_ZOOM_LEVELS.find((level) => level === plan.zoom);
    if (nextZoom !== undefined && nextZoom !== editorState.get().zoom) editorState.set({ zoom: nextZoom });
    // 계획은 이미 대상 사각형의 정확한 중심을 담고 있다(분수 타일) — +0.5 를 더하면 반 타일 밀린다.
    const targetWorldX = plan.centerTileX * this.activeTileSize();
    const targetWorldY = plan.centerTileY * this.activeTileSize();
    const area = this.cameraVisibleArea();
    // 조수 카드가 캔버스를 덮고 있으면 캔버스 중앙 = 카드 뒤다. 가림을 뺀 영역의 중앙에 대상이
    // 오도록 lookAt 을 민다(cameraLookAtForTarget).
    const lookAt = area
      ? cameraLookAtForTarget({
        targetWorldX,
        targetWorldY,
        canvas: area.canvas,
        unoccluded: area.unoccluded,
        zoom: nextZoom ?? editorState.get().zoom,
      })
      : { x: targetWorldX, y: targetWorldY };
    const endZoom = nextZoom ?? editorState.get().zoom;
    // State records the destination zoom once. Restore the live camera before the browser paints,
    // then interpolate both zoom and look-at on the same clock (no snap before the pan).
    camera.setZoom(startZoom);
    camera.centerOn(startX, startY);
    camera.preRender();
    const motion = { target, zoom: endZoom };
    this.activeCameraFocus = motion;
    const distance = Math.hypot(lookAt.x - startX, lookAt.y - startY) * startZoom;
    const duration = Math.min(650, Math.max(300, 300 + distance * 0.15));
    // 팬을 돌리지 않는 두 경우. 동작 줄이기는 접근성이고, `immediate` 는 맵 전환이다 —
    // 둘 다 「마지막 프레임만 실행」으로 목적지에 그대로 세운다.
    const arriveNow = prefersReducedMotion() || target.immediate === true;
    // 카메라가 움직이면 DOM 마커·선택 팔레트 오버레이·AI 뷰포트 스냅샷이 전부 낡는다.
    // 손 팬은 onPanMove 에서 이미 이 셋을 되맞추는데 프로그램 팬은 아무것도 하지 않아
    // 조수가 데려간 화면에서 마커가 엉뚱한 자리에 남고 AI 는 이전 위치를 계속 읽었다.
    const advance = (_camera: unknown, progress: number): void => {
      if (this.activeCameraFocus !== motion || this.mapId() !== mid) return;
      const eased = progress * progress * (3 - 2 * progress);
      camera.setZoom(startZoom * Math.pow(endZoom / startZoom, eased));
      camera.centerOn(startX + (lookAt.x - startX) * eased, startY + (lookAt.y - startY) * eased);
      // Phaser updates worldView during render, after effect callbacks. Publish this frame, not the last.
      camera.preRender();
      // 6번째 인자는 onComplete 가 아니라 **onUpdate** 다(phaser Pan.js: "invoked every frame
      // for the duration of the effect"). DOM 마커·팔레트를 매 프레임 다시 만들면 영역 작업의
      // 인라인 승인 툴바가 그 사이에 갈려 pointerdown/up 이 다른 노드에 떨어질 수 있으므로
      // 그 뒷정리는 마지막 프레임에만 한다. 반면 뷰포트 스냅샷은 매 프레임 게시한다 —
      // 팬이 도는 300ms 동안 조수가 도구를 부르면 출발 지점의 화면을 사실로 읽어 버린다.
      if (progress < 1) {
        // 좌표만 다시 쓰는 재배치는 노드를 만들지 않으므로 매 프레임 해도 안전하다 —
        // 300ms 팬 동안 로케이션 상자가 제자리에 남아 있으면 그 화면이 곧 거짓말이 된다.
        repositionMapLocationLayer();
        this.publishMapViewport();
        return;
      }
      this.activeCameraFocus = null;
      this.afterCameraMoved();
    };
    if (arriveNow) advance(camera, 1);
    else camera.pan(lookAt.x, lookAt.y, duration, "Sine.easeInOut", true, advance);
  }

  private cancelCameraFocus(settleZoom = true, pointer?: Phaser.Input.Pointer): void {
    const motion = this.activeCameraFocus;
    if (!motion) return;
    this.activeCameraFocus = null;
    const camera = this.cameras.main;
    camera.panEffect.reset();
    if (settleZoom) {
      camera.preRender();
      const anchor = pointer ? camera.getWorldPoint(pointer.x, pointer.y) : null;
      camera.setZoom(motion.zoom);
      camera.preRender();
      // Finishing a fractional zoom must not move the tile the user just clicked.
      if (anchor && pointer) {
        const shifted = camera.getWorldPoint(pointer.x, pointer.y);
        camera.setScroll(camera.scrollX + anchor.x - shifted.x, camera.scrollY + anchor.y - shifted.y);
        camera.preRender();
      }
      this.afterCameraMoved();
    }
  }

  /**
   * 제스처가 끝나는 순간 미뤄 둔 초점을 정확히 한 번 재생한다.
   * 다른 제스처가 아직 살아 있으면(예: 붙여넣기 미리보기 위에서 팬을 놓았다) 슬롯을 그대로 둔다.
   */
  private replayDeferredCameraFocus(): void {
    const target = this.deferredCameraFocus;
    if (!target) return;
    if (shouldDeferCameraFocus(this.pointerGestureState())) return;
    this.deferredCameraFocus = null;
    this.panCameraToTile(target);
  }

  /**
   * 포인터 릴리스로 제스처를 내린다. 캔버스 안(pointerup)과 밖(pointerupoutside)이 **같은 몸**을 써야 한다.
   * Phaser 는 POINTER_UP 과 POINTER_UP_OUTSIDE 중 하나만 발화하므로(둘 다 오지 않는다), 밖에서 놓은
   * 릴리스가 드래그·우클릭 영역 상태를 남기면 shouldDeferCameraFocus 의 dragging 이 참으로 남아 미뤄 둔
   * 조수 초점이 영구히 갇힌다 — 슬롯을 비우는 다른 지점은 맵 전환과 씬 정리뿐이고 둘 다 요청을 버린다.
   * 도형·선택 드래그는 캔버스 경계를 넘겨 끝나는 일이 흔하다(2026-08-30 리뷰 실측).
   */
  /** 되돌리기·다시실행이 적용된 스트로크는 커밋하지 않고 끝낸다. */
  private abandonOpenPaintGesture(): void {
    this.isPainting = false;
    this.lastPaintKey = "";
    this.dragOperationHandler?.clear();
    this.clearHoverPreview();
  }

  private endPointerGesture(ptr: Phaser.Input.Pointer): "right-region" | "gesture" {
    if (this.rightRegionGesture) {
      this.finishRightRegionGesture(ptr);
      return "right-region";
    }
    this.finishDragOperation(ptr);
    this.getDragOperationHandler().clearEventCandidate();
    // 승격되지 않은 팬 후보도 여기서 내려야 한다. 남으면 다음 pointermove(버튼을 뗀 뒤의
    // 단순 호버)가 옛 기준점으로 카메라를 밀어 버린다.
    this.eventLayerPanCandidate = null;
    this.isPainting = false;
    this.lastPaintKey = "";
    this.stopPan();
    return "gesture";
  }

  /** 카메라 양보 판정에 넘길 제스처 스냅샷 — 판정 자체는 순수 함수가 한다. */
  private pointerGestureState(): PointerGestureState {
    return {
      painting: this.isPainting,
      panning: this.cameraPanController?.active() ?? false,
      dragging: this.dragOperationHandler?.busy() ?? false,
      rightRegionGesture: this.rightRegionGesture !== null,
      pastePreview: editorState.get().pastePreview !== null,
    };
  }

  /** 프로그램 팬이 끝난 뒤 카메라 좌표에 의존하는 표면을 다시 맞춘다(손 팬의 onPanMove 와 같은 몸). */
  private afterCameraMoved(): void {
    // 배경 미리보기는 플레이와 같이 **화면 고정**이다 — 팬할 때 노드를 다시 만들지 않고
    // 좌표만 고쳐 쓴다(로케이션 상자와 같은 계약).
    this.layoutMapBackgroundPreview();
    this.syncNavigationGeometry();
    this.refreshAgentGhostDomMarkers();
    this.renderBuildPaletteOverlay();
    // 검토 중인 청크 도형도 카메라를 따라간다. 노드를 다시 만들지 않고 좌표만 고쳐 쓴다.
    repositionRegionChunkOverlay();
    // 로케이션 상자·설계 고스트도 카메라를 따라간다. 같은 계약: 노드는 그대로, 좌표만.
    // (인스펙터는 손대지 않는다 — 팬 중에 이름을 입력하고 있을 수 있다.)
    repositionMapLocationLayer();
    this.publishMapViewport();
  }

  /**
   * 지금 실제로 보이는 타일 사각형(**분수** 단위). 카메라 worldView 와 가림 제외 캔버스 사각형을
   * 같은 헬퍼에서 가져오므로 조수의 팬 판정과 뷰포트 스냅샷이 한 소스를 본다.
   * 정수로 깎지 않는다 — 99% 보이는 타일을 버리면 이미 화면 안인 대상을 다시 끌어당긴다.
   */
  private visibleTileRect(): VisibleTileRect | null {
    const area = this.cameraVisibleArea();
    if (!area) return null;
    return visibleTileRectFromViewport({
      worldView: area.worldView,
      canvas: area.canvas,
      unoccluded: area.unoccluded,
      zoom: area.zoom,
      tileSize: this.activeTileSize(),
    });
  }

  /**
   * 카메라 초점·뷰포트 스냅샷이 공유하는 단 하나의 기하학 소스.
   * Use the inverse rendered camera transform: scrollX/Y is not the top-left,
   * and Phaser's worldView is rounded for culling even with fractional scroll.
   * 캔버스 사각형을 못 재는 환경(단위 테스트: DOM 없음)에서는 "가림 없음 + 캔버스 = worldView×zoom" 으로
   * 떨어져 동작이 정의된 상태를 유지한다.
   *
   * `cachedGeometry` 는 **매 프레임 서명 검사 전용**이다. 이벤트 경로(팬 목표·가시 판정·e2e 훅)는 항상
   * 새로 잰다 — 그쪽까지 캐시를 쓰면 조수 카드가 방금 펼쳐진 상황에서 다음 팬이 낡은 가림을 쓴다.
   */
  private cameraVisibleArea(options?: { readonly cachedGeometry?: boolean }): {
    readonly canvas: CanvasRect;
    readonly unoccluded: CanvasRect;
    readonly worldView: CanvasRect;
    readonly zoom: number;
  } | null {
    const camera = this.cameras?.main;
    const view = camera?.worldView;
    if (!camera || !view || view.width <= 0 || view.height <= 0) return null;
    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    const origin = camera.getWorldPoint(0, 0);
    const worldView: CanvasRect = { x: origin.x, y: origin.y, width: camera.width / zoom, height: camera.height / zoom };
    const geometry = options?.cachedGeometry === true
      ? this.cachedOverlayGeometry(worldView, zoom)
      : this.freshOverlayGeometry(worldView, zoom);
    return { canvas: geometry.canvas, unoccluded: geometry.unoccluded, worldView, zoom };
  }

  private freshOverlayGeometry(worldView: CanvasRect, zoom: number): { readonly canvas: CanvasRect; readonly unoccluded: CanvasRect } {
    const measured = this.canvasClientRect();
    this.cachedCanvasRect = measured;
    this.cachedUnoccludedRect = measured ? unoccludedCanvasRect(measured, this.assistantOverlayRects(measured)) : null;
    this.overlayGeometryReadAtMs = overlayGeometryNowMs();
    return this.geometryOrFallback(worldView, zoom);
  }

  /**
   * 캔버스·가림 사각형을 250ms 가진다. 매 프레임 getBoundingClientRect 를 부르면 채팅이 스트림 되는
   * 동안 레이아웃을 계속 돌리게 된다. 도크를 접거나 펴는 것은 사람 속도의 사건이니 4회/초로 충분하다.
   */
  private cachedOverlayGeometry(worldView: CanvasRect, zoom: number): { readonly canvas: CanvasRect; readonly unoccluded: CanvasRect } {
    if (this.cachedCanvasRect === null || overlayGeometryNowMs() - this.overlayGeometryReadAtMs > OVERLAY_GEOMETRY_TTL_MS) {
      return this.freshOverlayGeometry(worldView, zoom);
    }
    return this.geometryOrFallback(worldView, zoom);
  }

  private geometryOrFallback(worldView: CanvasRect, zoom: number): { readonly canvas: CanvasRect; readonly unoccluded: CanvasRect } {
    const canvas = this.cachedCanvasRect
      ?? { x: 0, y: 0, width: worldView.width * zoom, height: worldView.height * zoom };
    return { canvas, unoccluded: this.cachedUnoccludedRect ?? canvas };
  }

  private canvasClientRect(): CanvasRect | null {
    const canvas = this.game?.canvas;
    if (!canvas || typeof canvas.getBoundingClientRect !== "function") return null;
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }

  /**
   * 캔버스 위에 떠 있는 조수 표면 사각형 — DOM 을 재는 유일한 지점이다.
   * 투명 inset:0 패널(ai-panel)은 가림이 아니므로 세지 않는다. 입력줄과 펼친 기록 카드만
   * 모은 뒤 한 덩어리로 합쳐 가림 계산에 넘긴다.
   */
  private assistantOverlayRects(canvas: CanvasRect): readonly CanvasRect[] {
    if (typeof document === "undefined" || typeof document.querySelector !== "function") return [];
    const host = document.querySelector<HTMLElement>(".ai-chat-float-host");
    if (!host || typeof host.querySelectorAll !== "function") return [];
    const rects: CanvasRect[] = [];
    for (const node of host.querySelectorAll<HTMLElement>('[data-testid="ai-command-bar"], [data-testid="ai-chat-body"]')) {
      if (typeof node.getBoundingClientRect !== "function") continue;
      const style = typeof window !== "undefined" && typeof window.getComputedStyle === "function"
        ? window.getComputedStyle(node)
        : null;
      if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) continue;
      if (style && parseFloat(style.maxHeight) === 0) continue;
      const rect = node.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) continue;
      // 실제로 캔버스를 덮는 것만 센다 — 접힌 카드가 캔버스 밖에 있으면 가림이 아니다.
      if (rect.right <= canvas.x || rect.left >= canvas.x + canvas.width) continue;
      if (rect.bottom <= canvas.y || rect.top >= canvas.y + canvas.height) continue;
      rects.push({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    }
    return mergeNearbyRects(filterAssistantOverlayRects(canvas, rects));
  }

  private renderBuildPaletteOverlay(): void {
    if (typeof document === "undefined") return;
    const selection = editorState.get().selection;
    const mapId = this.mapId();
    // 크기 배지는 칩 바와 수명이 다르다 — 영역 작업 창이 열려 있는 동안에도 대상 영역을
    // 가리키고 있어야 한다. 그래서 아래 가드들보다 먼저, 항상 갱신한다.
    // (이 함수는 redraw·pan·창 토글 모두에서 불리므로 배지 추적점으로 충분하다.)
    this.renderRegionSizeBadge();
    if (this.rightRegionGesture) {
      this.clearBuildPaletteOverlay();
      this.renderRegionTaskBadge();
      return;
    }
    // 영역 작업 창이 열려 있으면 칩/팔레트 오버레이를 띄우지 않는다 — 창과 칩 바가 같은
    // 자리에 겹쳐 화면이 어수선해진다. 창을 닫으면 다시 나타난다.
    if (isRegionTaskModalOpen()) {
      this.clearBuildPaletteOverlay();
      this.renderRegionTaskBadge();
      return;
    }
    if (!shouldShowSelectionActionChips({
      selection,
      pastePreview: editorState.get().pastePreview,
      mapId,
    })) {
      this.clearBuildPaletteOverlay();
      this.renderRegionTaskBadge();
      return;
    }
    if (!selection) return;
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
      const popup = kind === "build"
        ? renderBuildPalettePopup()
        : renderSelectionActionChips(selection, openRegionTaskModal, () => this.replayDeferredCameraFocus());
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
      worldView: { x: camera.worldView.x, y: camera.worldView.y },
      zoom: camera.zoom,
    }, this.activeTileSize());
    const canvasRect = canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    // Bound the wrapping selection toolbar before measuring and anchoring it.
    if (isChips) popup.style.maxWidth = `${Math.max(1, Math.min(640, canvasRect.width - 16))}px`;
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

  /**
   * 선택 영역 위 W×H 배지. 드래그 **중에도** 갱신되므로 크기를 놓기 전에 알 수 있다 —
   * 예전에는 놓은 뒤 칩 바에서야 크기가 나왔고, 캔버스에는 청록 사각형 하나뿐이었다.
   * 크기 정보가 선택 사각형 옆에 붙으므로 칩 바에서는 그 텍스트를 뺐다.
   * 배치·수명 관리는 renderRegionTaskBadge 와 같은 모양(캔버스 호스트에 DOM 하나).
   */
  private renderRegionSizeBadge(): void {
    if (typeof document === "undefined") return;
    const selection = editorState.get().selection;
    const mapId = this.mapId();
    const host = this.game?.canvas?.parentElement;
    const camera = this.cameras?.main;
    if (!selection || selection.mapId !== mapId || !host || !camera) {
      this.regionSizeBadge?.remove();
      this.regionSizeBadge = null;
      return;
    }
    if (!this.regionSizeBadge || !this.regionSizeBadge.isConnected) {
      const badge = document.createElement("div");
      badge.className = "region-size-badge";
      badge.dataset.testid = "region-size-badge";
      host.append(badge);
      this.regionSizeBadge = badge;
    }
    this.regionSizeBadge.textContent = `${selection.width}×${selection.height}`;
    const rect = tileRectToScreenRect(
      { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
      { worldView: { x: camera.worldView.x, y: camera.worldView.y }, zoom: camera.zoom }, this.activeTileSize()
    );
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    // 작업 진행 배지(region-task-badge)와 같은 자리를 쓰지 않도록 왼쪽 위 모서리에 붙인다.
    this.regionSizeBadge.style.left = `${Math.round(canvasRect.left - hostRect.left + rect.x)}px`;
    this.regionSizeBadge.style.top = `${Math.round(canvasRect.top - hostRect.top + rect.y - 22)}px`;
  }

  private renderRegionTaskBadge(): void {
    if (typeof document === "undefined") return;
    const task = this.activeRegionTask;
    const mapId = this.mapId();
    const host = this.game.canvas?.parentElement;
    const badgeText = task ? regionTaskBadgeText(task.phase) : null;
    if (!task || task.mapId !== mapId || !host || !badgeText) {
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
    this.regionTaskBadge.textContent = badgeText;
    const camera = this.cameras.main;
    const rect = tileRectToScreenRect(
      { x: task.region.x, y: task.region.y, width: task.region.width, height: task.region.height },
      { worldView: { x: camera.worldView.x, y: camera.worldView.y }, zoom: camera.zoom }, this.activeTileSize()
    );
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    this.regionTaskBadge.style.left = `${Math.round(canvasRect.left - hostRect.left + rect.x)}px`;
    this.regionTaskBadge.style.top = `${Math.round(canvasRect.top - hostRect.top + rect.y - 26)}px`;
  }
}

function setTileToolStatus(testId: string, text: string): void {
  const node = document.querySelector(`[data-testid="${testId}"]`);
  // Runs per pointermove; an equal write still replaces the text node and wakes every
  // body-subtree MutationObserver.
  if (!node || node.textContent === text) return;
  node.textContent = text;
}

/** 미리보기 스프라이트의 타일 배율. 플레이와 같은 규칙(cover = 뷰포트를 덮는 배율)이다. */
function applyPreviewFit(
  scene: {
    readonly cameras: { readonly main: { readonly zoom: number; readonly width: number; readonly height: number } };
    readonly textures: Phaser.Textures.TextureManager;
  },
  sprite: Phaser.GameObjects.TileSprite,
  fit: "native" | "cover" | undefined,
): void {
  if (fit !== "cover") {
    if (sprite.tileScaleX !== 1 || sprite.tileScaleY !== 1) sprite.setTileScale(1, 1);
    return;
  }
  const camera = scene.cameras.main;
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const source = scene.textures.get(sprite.texture.key).getSourceImage() as {
    readonly width?: number;
    readonly naturalWidth?: number;
    readonly height?: number;
    readonly naturalHeight?: number;
  };
  const scale = mapBackgroundFitScale(
    "cover",
    { width: camera.width / zoom, height: camera.height / zoom },
    {
      width: Math.max(1, Number(source.naturalWidth ?? source.width ?? 0)),
      height: Math.max(1, Number(source.naturalHeight ?? source.height ?? 0)),
    },
  );
  if (sprite.tileScaleX !== scale || sprite.tileScaleY !== scale) sprite.setTileScale(scale, scale);
}
