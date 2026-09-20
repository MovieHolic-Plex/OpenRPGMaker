import { destroyGame, getGame, startEditGame } from "@/app/mode";
import { clearTileGraftImageCache } from "@/assets/tileGraftImageCache";
import { scheduleEditorAssetWarmup } from "@/assets/editorAssetWarmup";
import {
  DEFAULT_ASSISTANT_TEMPERATURE,
  parseAssistantTemperature,
  type AssistantTemperature,
} from "@/editor/assistantTemperature";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { editorState, editorStateChangedOnlyCanvasOverlay } from "@/editor/editorState";
import { registerAiBootIntentTarget, clearPendingAiBootIntent } from "@/editor/aiBootIntent";
import { dismissCoachMarks } from "@/editor/coachMarks";
import { installSelectionChipHint } from "@/editor/selectionChipHint";
import { installToolCursor } from "@/editor/toolCursor";
import {
  applyEditorUiModeClasses,
  getEditorChrome,
  getEditorUiMode,
  subscribeEditorUiMode,
} from "@/editor/editorUiMode";
import {
  ensureCurrentMapLock,
  getMapEditLockStatus,
  isMapEditLockTakeoverImmediate,
  lockOwnerPhrase,
  subscribeMapEditLocks,
  takeoverMapLock,
  type MapEditLockStatus,
} from "@/editor/mapEditLocks";
import { installLayoutBboxOverlay } from "@/editor/layoutBboxOverlay";
import { installMapLocationLayer } from "@/editor/mapLocationLayer";
import { locationLayerState, subscribeLocationLayer } from "@/editor/mapLocationLayerState";
import { subscribeMapBackgroundPreview } from "@/editor/mapBackgroundPreviewState";
import { installLocationDrawModeGuard } from "@/editor/locationDrawMode";
import { getMapEditHistoryState } from "@/editor/mapEditHistory";
import { bindMapSurfaceFocusHandoff } from "@/editor/mapSurfaceFocus";
import { installEditorToolHook } from "@/editor/editorToolHook";
import { cleanupProjectE2EBridge } from "@/editor/editorToolHook";
import { selectEditorMap } from "@/editor/mapSelection";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createAiSidebarWorkspace } from "@/editor/panels/aiSidebarWorkspace";
import { closeSidebarSurface, teardownSidebarSurfaces } from '@/editor/panels/sidebarSurface';
import { refreshAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { showConfirm } from "@/editor/ui/modal";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import {
  closeTestPlayModal,
  openRandomTroopBattleTestModal,
  openSelectedEventTestModal,
  openTestPlayModal,
  openTroopBattleTestModal,
} from "@/editor/panels/testPlayModal";
// 좌측 패널 본문(팔레트·맵 트리)은 이제 패널 레지스트리가 그린다 — 여기서 직접 import 하지 않는다.
import { dockSignature, mountDock, renderDockPanels, type DockMount } from "@/editor/workspace/dockHost";
import { resolveLeftDockPanels } from "@/editor/workspace/leftDockPanels";
import { isMapPanelCollapsed, subscribeMapPanel } from "@/editor/workspace/mapPanelSection";
import type { PanelId } from "@/editor/workspace/panelRegistry";
import { getWorkspaceLayout, subscribeWorkspace } from "@/editor/workspace/workspaceStore";
import { ProjectExportMirror } from "@/editor/projectExportMirror";
import { isSaveSkippedLocation } from "@/project/devProjectPersistence";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import {
  AUTHORING_TEST_BOOT_SUCCESS_EVENT,
  authoringProjectFingerprint,
  loadAuthoringJourneyProgress,
  recordAuthoringJourneyChange,
  recordSuccessfulTestBoot,
  saveAuthoringJourneyProgress,
  setManualJourneyStage,
} from "@/editor/authoringJourney";
import { renderAuthoringJourney } from "@/editor/panels/authoringJourneyStrip";

const LEFT_PANEL_DEFAULT_WIDTH = 526;
const LEFT_PANEL_MIN_WIDTH = 184;
const LEFT_PANEL_MAX_WIDTH = 640;
const MIN_CANVAS_WIDTH = 520;
const MAP_TREE_DEFAULT_HEIGHT = 300;
const MAP_TREE_MIN_HEIGHT = 80;
const MAP_TREE_MAX_HEIGHT = 480;
// 맵 트리 자동 높이 — 기본은 "내용에 맞춤"이다. 고정 300px 은 맵이 1~2개인 프로젝트에서
// 좌패널 3분의 1을 빈 칸으로 두고 타일 시트를 눌렀다(실측 1440×900: 시트 275px 에 191칸 중
// 8행). 하한은 리사이저 드롭 표적과 행 하나가 들어가는 150px, 상한은 좌패널 32% 또는 240px 중
// 작은 쪽 — 맵이 많아도(실측 16개) 시트가 200px 아래로 눌리지 않는다. 사용자가 리사이저를 끌면
// 수동으로 전환되고(mapTreeHeight 저장), 리사이저를 더블클릭하면 다시 자동이다.
const MAP_TREE_AUTO_MIN_HEIGHT = 150;
// 상한을 320/40% → 240/32% 로 낮췄다 — 목록 약 4~5행이면 맵을 고르는 데 충분하고,
// 그 이상은 시트(이 면의 주 작업 영역)의 몫이다. 더 보고 싶으면 리사이저로 연다.
const MAP_TREE_AUTO_MAX_HEIGHT = 240;
const MAP_TREE_AUTO_MAX_RATIO = 0.32;
/** 자동 측정이 헤더·목록의 반올림으로 스크롤바를 만들지 않게 두는 여유. */
const MAP_TREE_AUTO_SLACK = 6;
/** 접힌 섹션 = 헤더 한 줄. 헤더를 아직 못 잰 첫 페인트의 폴백. */
const MAP_TREE_COLLAPSED_FALLBACK_HEIGHT = 44;
/**
 * 자동 높이가 타일 시트에 남겨야 하는 최소 높이. 맵이 많을 때 상한(320/40%)만으로는 부족했다 —
 * 1440×950 전문가 + 맵 16개에서 시트가 197px 로 눌렸다(팔레트 크롬 311px + 맵 320px). 시트는
 * 이 면의 주 작업 영역이라(test/e2e/palette-tiles-come-first.spec.ts: 260px 하한) 맵 도크가
 * 그 몫을 먹지 못하게 좌패널 높이에서 팔레트 크롬과 이 값을 뺀 만큼만 허용한다.
 */
const PALETTE_SHEET_RESERVE_HEIGHT = 280;
const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";
// CSS `--basic-rail-width` owns the beginner panel width; this is its pre-layout fallback.
const BASIC_RAIL_FALLBACK_WIDTH = 288;

type LoadedEditorLayout = {
  readonly leftWidth: number;
  readonly mapTreeHeight: number;
  /** 맵 트리 높이를 내용에 맞춰 자동으로 잡는가. 리사이저를 끌면 false 가 된다. */
  readonly mapTreeAuto: boolean;
  readonly assistantTemperature: AssistantTemperature;
};

const initialLayout = loadEditorLayout();
let leftWidth = initialLayout.leftWidth;
let leftRoot: HTMLElement | null = null;
let leftMapRoot: HTMLElement | null = null;
let leftResizer: HTMLElement | null = null;
let mapTreeResizer: HTMLElement | null = null;
let phaserHost: HTMLElement | null = null;
let canvasToolbarRoot: HTMLElement | null = null;
let chatFloatRoot: HTMLElement | null = null;
let aiChatPanelRoot: HTMLElement | null = null;
let aiSidebarWorkspace: ReturnType<typeof createAiSidebarWorkspace> | null = null;
let mapLockBannerRoot: HTMLElement | null = null;
let authoringJourneyRoot: HTMLElement | null = null;
// 저장 모드 배너 호스트는 항상 DOM에 두고 내용만 갈아 끼운다 — 공용 데모 → 사본 전환처럼
// 부팅 뒤에 persistence 상태가 바뀌어도 배너가 붙고 떨어진다(emit(project) 가 repaint 를 탄다).
let persistenceBannerHost: HTMLElement | null = null;
let authoringJourneyOpen = false;
let authoringJourneyReferenceIssues: readonly string[] | null = null;
let projectExportNode: HTMLElement | null = null;
let unsubStore: (() => void) | null = null;
let unsubEditor: (() => void) | null = null;
let lastEditorPanelState = editorState.get();
let unsubMapLocks: (() => void) | null = null;
let mapTreeHeight = initialLayout.mapTreeHeight;
let mapTreeAuto = initialLayout.mapTreeAuto;
/** 자동 모드가 마지막으로 잰 높이. 첫 페인트는 기본값으로 시작해 측정 뒤 갱신된다. */
let mapTreeAutoHeight = MAP_TREE_DEFAULT_HEIGHT;
let mapTreeFitRaf = 0;
let mapTreeObserver: MutationObserver | null = null;
let unsubMapPanel: (() => void) | null = null;
let assistantTemperature = initialLayout.assistantTemperature;
let unsubUiMode: (() => void) | null = null;
let unsubLayoutBbox: (() => void) | null = null;
let unsubLocationLayer: (() => void) | null = null;
let unsubLocationToggle: (() => void) | null = null;
let unsubLocationDrawGuard: (() => void) | null = null;
let unsubMapBackgroundPreview: (() => void) | null = null;
/** 마지막으로 툴바·패널에 반영한 레이어 켜짐. 드래그 중 재렌더를 걸러내는 기준이다. */
let lastRenderedLocationLayerEnabled: boolean | null = null;
let unsubWorkspace: (() => void) | null = null;
// 좌측 도크 마운트 — 패널 호스트를 레이아웃 데이터에서 만든 결과. 구성이 바뀔 때만 다시 짓는다.
let leftDock: DockMount | null = null;

export function renderEditor(main: HTMLElement): void {
  clearChildren(main);
  installEditorToolHook(); // 헤드리스(Playwright) 에디터 조작용 window.__oprnEditorTool.
  applyEditorUiModeClasses(getEditorUiMode());

  // 도크는 하나(입력줄 = float)다. 예전에는 glass/side/float 3분기가 첫 페인트부터
  // 클래스와 `--ai-chat-side-width` 를 갈라 잡았다 — side 가 사라지면서 캔버스는 항상
  // 전폭이고 이 변수는 영구 0 이다.
  const layout = el("div", {
    class: "editor-layout chat-dock-float has-ai-sidebar",
    dataset: { testid: "editor-layout" },
  });
  layout.style.setProperty("--ai-chat-side-width", "0px");
  document.body?.classList?.add?.("ai-chat-dock-float");
  const left = el("div", { class: "left-panel" });
  const canvasArea = el("div", { class: "canvas-area" });
  const canvasScrollShell = el("div", {
    class: "editor-canvas-scroll-shell",
    dataset: { testid: "editor-canvas-scroll-shell" },
  });
  const phaserContainer = el("div", {
    class: "phaser-container",
    dataset: { testid: "edit-canvas" },
  });
  const canvasToolbar = el("div", {
    class: "canvas-toolbar",
    dataset: { testid: "editor-zoom-controls" },
  });
  const mapLockBanner = el("div", {
    class: "map-lock-banner is-hidden",
    dataset: { testid: "map-lock-banner" },
  });
  // Pointer diagnostics remain available to automated editor harnesses without
  // recreating the retired, visible bottom statusbar.
  const cursorDiagnostics = el("div", {
    attrs: { hidden: "true", "aria-hidden": "true" },
    dataset: { testid: "editor-cursor-diagnostics" },
    children: [
      el("span", { dataset: { testid: "cursor-position" }, text: "outside" }),
      el("span", { dataset: { testid: "cursor-lower" }, text: "-" }),
      el("span", { dataset: { testid: "cursor-upper" }, text: "-" }),
    ],
  });
  const authoringJourney = el("div", { class: "authoring-journey-host" });
  const chatFloatHost = el("div", {
    class: "ai-chat-float-host ai-chat-sidebar-host",
    dataset: { testid: "chat-float-host" },
  });
  leftResizer = el("div", {
    class: "resizer resizer-left",
    attrs: { title: "드래그로 크기 조절", role: "separator", "aria-label": "좌측 패널 너비 조절", "aria-orientation": "vertical", tabindex: "0" },
    dataset: { testid: "left-panel-resizer" },
  });
  mountLeftDock(left);
  canvasScrollShell.append(phaserContainer);
  // 저장 모드 배너(결함 ⑩)는 캔버스 열 상단에 넣는다 — .main(flex row)의 형제로 넣으면
  // 좌측 열처럼 배치되어 레이아웃이 깨진다.
  const bannerHost = el("div", { class: "persistence-banner-host" });
  canvasArea.append(bannerHost);
  persistenceBannerHost = bannerHost;
  paintPersistenceBanner();
  canvasArea.append(canvasScrollShell, mapLockBanner, canvasToolbar, authoringJourney, cursorDiagnostics);
  aiSidebarWorkspace?.dispose();
  aiSidebarWorkspace = createAiSidebarWorkspace(left, chatFloatHost, () => { applyLayout(); scheduleFitCanvas(); });
  layout.append(aiSidebarWorkspace.root, leftResizer, canvasArea);
  const aiPanel = renderAiChatPanel({
    getAssistantTemperature: () => assistantTemperature,
    onAssistantTemperatureChange: setAssistantTemperature,
  });
  const teamSidebar = aiPanel.querySelector<HTMLElement>(".ai-team-sidebar");
  if (teamSidebar) layout.append(teamSidebar);
  // 조수 느낌표 버튼은 **캔버스 영역 안**에 놓는다. 오른쪽 아래는 팀 레일(84px)이 이미 쓰고
  // 있는데, absolute 로 canvas-area 안에 두면 레일이 시작하는 곳에서 자동으로 끝나
  // 겹침 계산이 필요 없다(실측 1440×1000: 레일 왼쪽 1357px, 버튼 오른쪽 1341px).
  const suggestionPeek = aiPanel.querySelector<HTMLElement>(".ai-suggestion-peek");
  if (suggestionPeek) canvasArea.append(suggestionPeek);
  main.append(layout, projectExportNodeElement());

  leftRoot = left;
  phaserHost = phaserContainer;
  canvasToolbarRoot = canvasToolbar;
  chatFloatRoot = chatFloatHost;
  aiChatPanelRoot = aiPanel;
  mapLockBannerRoot = mapLockBanner;
  authoringJourneyRoot = authoringJourney;

  mountAssistantOverlay();
  applyLayout();
  applyEditorUiModeLayout();
  refreshPanels();
  ensureCurrentMapLock();
  bindLeftResizer();
  // 맵 트리 리사이저는 도크가 만들 때(mountLeftDock) 함께 묶인다 — 재마운트마다 새 노드다.
  // 레이아웃 ResizeObserver 는 side 도크 폭을 다시 재는 것만 하던 것이라 함께 걷었다.
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("oprn:test-play-window", onTestPlayWindowRequest);
  window.addEventListener(AUTHORING_TEST_BOOT_SUCCESS_EVENT, onAuthoringTestBootSuccess);
  bindMapSurfaceFocusHandoff(phaserContainer);
  void startEditGame(phaserContainer).then(() => scheduleFitCanvas());
  unsubLayoutBbox = installLayoutBboxOverlay();
  // 명명 로케이션 레이어. 꺼져 있으면 포인터를 받지 않으므로 타일 편집과 겹치지 않는다.
  unsubLocationLayer = installMapLocationLayer();
  // 켠 뒤의 도구 전이는 감시자 하나가 잡는다 — 팔레트·사이드바·구조 킷이 각자 끄지 않는다.
  unsubLocationDrawGuard = installLocationDrawModeGuard();
  // 툴바의 로케이션 토글이 눌린 상태를 그대로 보여야 한다 — 레이어 상태 변화에 토글도 다시 그린다.
  unsubLocationToggle = subscribeLocationLayer(() => {
    // 이 구독은 선택·드래그 미리보기까지 받는다(레이어 자신이 오버레이를 그린다). 도구 모드가
    // 바뀔 때만 툴바·패널을 다시 짓는다 — 매 pointermove 마다 도크를 통째로 새로 만들면
    // 그리는 동안 좌측 팔레트·맵 트리가 계속 재조립된다(2026-09-11 실측).
    const enabled = locationLayerState().enabled;
    if (enabled === lastRenderedLocationLayerEnabled) return;
    lastRenderedLocationLayerEnabled = enabled;
    if (canvasToolbarRoot) renderCanvasToolbar(canvasToolbarRoot);
    scheduleFullPanelRefresh();
  });

  unsubStore = store.subscribe((_project, change) => {
    if (change?.projectSwitch) clearTileGraftImageCache();
    refreshPanels(change);
  });
  lastEditorPanelState = editorState.get();
  unsubEditor = editorState.subscribe((state) => {
    const previous = lastEditorPanelState;
    lastEditorPanelState = state;
    if (editorStateChangedOnlyCanvasOverlay(previous, state)) return;
    scheduleFullPanelRefresh(state.currentMapId === previous.currentMapId);
  });
  // 미리보기 토글도 눌린 상태(aria-pressed/색)를 그대로 보여야 한다 — 툴바만 다시 그린다.
  unsubMapBackgroundPreview = subscribeMapBackgroundPreview(() => {
    if (canvasToolbarRoot) renderCanvasToolbar(canvasToolbarRoot);
  });
  unsubMapLocks = subscribeMapEditLocks(() => scheduleFullPanelRefresh());
  unsubUiMode = subscribeEditorUiMode(() => {
    syncLeftDock();
    applyEditorUiModeLayout();
    if (!getEditorChrome().coachMarks || !getEditorChrome().standardWelcome) dismissCoachMarks();
  });
  // 패널 이동·열기/닫기(프리셋 전환 포함)는 도크를 다시 짓는다. syncLeftDock 은 멱등이라
  // 프리셋 전환처럼 uiMode 구독자와 겹쳐 두 번 불려도 한 번만 조립한다.
  unsubWorkspace = subscribeWorkspace(() => syncLeftDock());
  // 맵 섹션 접기/펴기 — 헤더 토글(mapList.ts)이 상태를 바꾸면 도크 행 높이를 따라 바꾼다.
  unsubMapPanel = subscribeMapPanel(() => {
    applyLayout();
    scheduleFitCanvas();
    scheduleMapTreeFit();
  });
  installSelectionChipHint();
  installToolCursor();
  // 하단 연결 칩은 제거됐으므로 그 옛 렌더 경로가 더는 인증 캐시를 데우지 않는다. 부팅에서 한 번
  // 조회해 구조 키트·클러스터·타일셋 게이트가 실제 연결 상태를 보게 한다. 완료 전 checking은
  // 각 게이트가 허용하므로 느린 companion 조회가 사용자를 잠그지는 않는다.
  void refreshAiConnectionStatus();
  scheduleEditorAssetWarmup();
}

/** 좌측 도크에 마운트할 패널. 규칙은 `workspace/leftDockPanels.ts` 가 소유한다(패널 메뉴와 공유). */
function leftDockPanels(): readonly PanelId[] {
  return resolveLeftDockPanels({
    left: getWorkspaceLayout().docks.left,
    paletteRail: getEditorChrome().paletteRail,
    mapTree: getEditorChrome().mapTree,
  }).filter(id => id !== "maps");
}

/**
 * 좌측 도크 조립. **어떤 패널이 어느 순서로** 들어가는지는 워크스페이스 레이아웃이 정하고
 * 이 함수는 그 데이터를 DOM 으로 옮긴다(이전에는 renderEditor 가 자식 3개를 손으로 붙였다).
 *
 * 팔레트 호스트를 가리키는 모듈 변수는 이 리팩터로 **사라졌다** — 렌더 경로가 레지스트리를
 * 지나므로 아무도 그 노드를 이름으로 찾지 않는다. `leftMapRoot`/`mapTreeResizer` 는 남는데,
 * 맵 트리 표시 여부가 아직 `chrome.mapTree` 밀도 플래그와 CSS `.is-ui-hidden` 게이트에
 * 걸려 있어서다(그 게이트를 도크 구성으로 합치는 일은 다음 라운드).
 */
function mountLeftDock(container: HTMLElement): void {
  closeSidebarSurface();
  leftDock = mountDock({
    container,
    zone: "left",
    panels: leftDockPanels(),
    makeSplitter: () => makeMapTreeResizer(),
  });
  leftMapRoot = leftDock.hosts.get("maps") ?? null;
  mapTreeResizer = leftDock.splitters[0] ?? null;
  bindMapTreeResizer();
  observeMapTreeHost(leftMapRoot);
}

/**
 * 맵 패널 내용이 바뀌면(맵 추가·삭제, 가지 접기, 필터 펼치기) 자동 높이를 다시 잰다.
 * mapList 는 자기 안에서 `rerenderMapList` 로 다시 그리므로 editor.ts 의 renderLeftDockPanels
 * 를 거치지 않는 경로가 많다 — 호스트의 자식 변화를 보는 것이 그 전부를 한 번에 잡는다.
 */
function observeMapTreeHost(host: HTMLElement | null): void {
  mapTreeObserver?.disconnect();
  mapTreeObserver = null;
  if (!host || typeof MutationObserver === "undefined") return;
  mapTreeObserver = new MutationObserver(() => scheduleMapTreeFit());
  mapTreeObserver.observe(host, { attributeFilter: ["hidden"], attributes: true, childList: true, subtree: true });
}

function makeMapTreeResizer(): HTMLElement {
  return el("div", {
    class: "resizer resizer-map-tree",
    attrs: {
      "aria-label": "맵 트리 높이 조절",
      role: "separator",
      tabindex: "0",
      title: "드래그로 맵 트리 높이 조절 · 더블클릭하면 내용에 맞춤",
    },
    dataset: { testid: "map-tree-height-resizer", uiDensity: "expert" },
  });
}

/**
 * 워크스페이스 구성이 바뀌었을 때 도크를 맞춘다. **멱등** — 구성 서명이 같으면 다시 짓지
 * 않는다. 프리셋 전환은 밀도까지 바꿔 editorUiMode 구독자도 깨우므로 이 함수가 한 번의
 * 전환에 두 번 불릴 수 있다.
 */
function syncLeftDock(): void {
  if (!leftRoot) return;
  if (leftDock && leftDock.signature === dockSignature("left", leftDockPanels())) return;
  mountLeftDock(leftRoot);
  applyEditorUiModeLayout();
}

/**
 * 좌측 도크 패널 렌더. 맵 도크 표시는 도크 구성(사용자 선택) 단일 원천이다 —
 * 예전 `chrome.mapTree` 밀도 게이트는 표준/전문가 통합으로 걷었다.
 * 초보는 `resolveLeftDockPanels`에서 타일만 남기므로 여기서 걸러진다.
 */
function renderLeftDockPanels(): void {
  if (!leftDock) return;
  const allowed = new Set(leftDockPanels());
  const ids = [...leftDock.hosts.keys()].filter((id) => allowed.has(id));
  renderDockPanels(leftDock, ids);
  scheduleMapTreeFit();
}

export function applyEditorUiModeLayout(): void {
  const inDock = new Set(leftDockPanels());
  applyEditorUiModeClasses(getEditorUiMode());

  if (leftMapRoot) {
    const show = inDock.has("maps");
    leftMapRoot.hidden = !show;
    if (show) leftMapRoot.classList.remove("is-ui-hidden");
    else leftMapRoot.classList.add("is-ui-hidden");
  }
  if (mapTreeResizer) {
    const show = inDock.has("maps");
    mapTreeResizer.hidden = !show;
    if (show) mapTreeResizer.classList.remove("is-ui-hidden");
    else mapTreeResizer.classList.add("is-ui-hidden");
  }
  // 모드 전환(초보 레일 ↔ 표준 컬럼)은 폭·툴바를 다시 잰다.
  // 이 호출을 빼면 인라인 width/--editor-left-safe 가 이전 모드에 남는다.
  if (canvasToolbarRoot) {
    renderLeftDockPanels();
    renderCanvasToolbar(canvasToolbarRoot);
  }
  applyLayout();
  scheduleFitCanvas();
}

export function teardownEditor(): void {
  aiSidebarWorkspace?.dispose();
  aiSidebarWorkspace = null;
  teardownSidebarSurfaces();
  teardownAiChatPanel();
  registerAiBootIntentTarget(null);
  clearPendingAiBootIntent();
  cleanupProjectE2EBridge();

  unsubStore?.();
  unsubEditor?.();
  unsubMapLocks?.();
  unsubUiMode?.();
  unsubLayoutBbox?.();
  unsubLocationLayer?.();
  unsubLocationToggle?.();
  unsubMapBackgroundPreview?.();
  unsubLocationDrawGuard?.();
  unsubWorkspace?.();
  unsubMapPanel?.();
  unsubMapPanel = null;
  mapTreeObserver?.disconnect();
  mapTreeObserver = null;
  if (mapTreeFitRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(mapTreeFitRaf);
  mapTreeFitRaf = 0;
  unsubStore = null;
  unsubEditor = null;
  unsubMapLocks = null;
  unsubUiMode = null;
  unsubLayoutBbox = null;
  unsubLocationLayer = null;
  unsubLocationToggle = null;
  unsubMapBackgroundPreview = null;
  unsubLocationDrawGuard = null;
  unsubWorkspace = null;
  leftDock = null;
  const ro2 = (window as unknown as Record<string, unknown>)["__oprnLayoutRO"] as ResizeObserver | undefined;
  ro2?.disconnect?.();
  window.removeEventListener("resize", onWindowResize);
  window.removeEventListener("oprn:test-play-window", onTestPlayWindowRequest);
  window.removeEventListener(AUTHORING_TEST_BOOT_SUCCESS_EVENT, onAuthoringTestBootSuccess);
  closeTestPlayModal();
  destroyGame();
  leftRoot = null;
  leftMapRoot = null;
  leftResizer = null;
  mapTreeResizer = null;
  phaserHost = null;
  canvasToolbarRoot = null;
  chatFloatRoot = null;
  aiChatPanelRoot = null;
  mapLockBannerRoot = null;
  authoringJourneyRoot = null;
  persistenceBannerHost = null;
  authoringJourneyOpen = false;
  authoringJourneyReferenceIssues = null;
  projectExportNode = null;
  if (projectExportTimer) clearTimeout(projectExportTimer);
  projectExportTimer = null;
  projectExportMirror.clear();
  document.body.classList.remove("ai-chat-dock-float", "editor-ui-beginner", "editor-ui-standard", "editor-ui-expert");
}

export function setAssistantTemperature(next: AssistantTemperature): void {
  assistantTemperature = parseAssistantTemperature(next, assistantTemperature);
  editorState.set({ assistantTemperature });
  if (aiChatPanelRoot) aiChatPanelRoot.dataset.temperature = assistantTemperature;
  saveEditorLayout();
}

/**
 * 조수 패널을 캔버스 위 float 호스트에 붙인다.
 *
 * 예전 이름은 `applyChatDockLayout` 이고 3개 도크 × (레이아웃·패널·body) 9번의
 * classList.toggle 로 클래스를 갈랐다. 도크가 하나면 고정 클래스 하나로 끝난다.
 */
function mountAssistantOverlay(): void {
  if (!chatFloatRoot || !aiChatPanelRoot) return;
  editorState.set({ assistantTemperature });
  aiChatPanelRoot.dataset.temperature = assistantTemperature;
  aiChatPanelRoot.classList.add("is-left-sidebar");
  if (aiChatPanelRoot.classList.contains("is-history-open")) {
    aiChatPanelRoot.classList.add("is-docked");
  }
  if (aiChatPanelRoot.parentElement !== chatFloatRoot) {
    aiChatPanelRoot.remove();
    chatFloatRoot.append(aiChatPanelRoot);
  }
}

// 저장 스킵/로컬 저장 모드 배너: 임시 URL 모드 등에서
// 저장이 조용히 스킵되어 세션 작업물이 통째로 증발하던 문제 — 모드를 화면에 명시한다.
// 임시 세션 배너는 오류가 아니라 정보 — 인라인 '내보내기' + 닫기(세션 동안 유지)를 제공한다.
let persistenceBannerDismissed = false;

function paintPersistenceBanner(): void {
  if (!persistenceBannerHost) return;
  clearChildren(persistenceBannerHost);
  const banner = renderPersistenceModeBanner();
  if (banner) persistenceBannerHost.append(banner);
}

function renderPersistenceModeBanner(): HTMLElement | null {
  const status = store.getDbPersistenceStatus();
  if (status.kind !== "disabled") return null;
  if (status.reason === "shared-demo") {
    // 공용 데모: 원본 보호를 상시 표면에 남기고 사본 만들기로 이어준다 — 토스트는 사라져도 배너는 남는다.
    const banner = el("div", {
      class: "persistence-mode-banner is-shared-demo",
      dataset: { testid: "shared-demo-banner" },
    });
    banner.append(
      el("span", {
        class: "persistence-mode-banner-text",
        text: "공용 예제를 보고 있습니다 — 원본은 바뀌지 않습니다.",
      }),
      el("button", {
        class: "persistence-mode-banner-action",
        text: "편집용 사본 만들기",
        attrs: { type: "button", title: "현재 화면을 새 온라인 프로젝트로 복사해 편집을 시작합니다" },
        dataset: { testid: "shared-demo-banner-fork" },
        on: {
          click: () => void import("@/editor/sharedDemoIntro").then((m) => m.forkSharedDemoToEditableCopy()),
        },
      }),
    );
    return banner;
  }
  if (status.reason === "dev-showcase") {
    const saveSkipped = isSaveSkippedLocation();
    if (saveSkipped && persistenceBannerDismissed) return null;
    const banner = el("div", {
      class: `persistence-mode-banner ${saveSkipped ? "is-save-skipped" : "is-local-only"}`,
      dataset: { testid: "save-skip-banner" },
    });
    banner.append(el("span", { class: "persistence-mode-banner-text", text: persistenceModeBannerText(status.reason, saveSkipped) }));
    if (saveSkipped) {
      banner.append(
        el("button", {
          class: "persistence-mode-banner-action",
          text: "내보내기",
          attrs: { type: "button", title: "프로젝트를 파일로 내보내 보존합니다" },
          dataset: { testid: "save-skip-banner-export" },
          on: {
            click: () => void import("@/editor/panels/menu").then((menu) => menu.exportProjectPackage()),
          },
        }),
        el("button", {
          class: "persistence-mode-banner-close",
          text: "✕",
          attrs: { type: "button", title: "이 세션 동안 배너 숨기기", "aria-label": "임시 세션 배너 닫기" },
          dataset: { testid: "save-skip-banner-close" },
          on: {
            click: () => {
              persistenceBannerDismissed = true;
              banner.remove();
            },
          },
        }),
      );
    }
    return banner;
  }
  // load-failed(복구 모드): 원격 저장이 꺼진 채 편집 중임을 알린다.
  return el("div", {
    class: "persistence-mode-banner is-recovery",
    dataset: { testid: "save-skip-banner" },
    text: "복구 모드 — 온라인 저장을 잠시 사용할 수 없습니다. 작업을 다시 열어 연결을 복구하거나 '내보내기'로 백업하세요.",
  });
}

export function persistenceModeBannerText(reason: string, saveSkipped: boolean): string {
  if (reason === "dev-showcase" && saveSkipped) {
    return "임시 세션 — 작업이 이 탭에만 있습니다. 보존하려면 내보내기를 누르세요.";
  }
  if (reason === "dev-showcase") return "개발 모드 — 이 브라우저에만 저장됩니다.";
  return "복구 모드 — 온라인 저장을 잠시 사용할 수 없습니다. 작업을 다시 열어 연결을 복구하거나 '내보내기'로 백업하세요.";
}

function projectExportNodeElement(): HTMLElement {
  projectExportNode = el("pre", {
    attrs: { hidden: "true" },
    dataset: { testid: "project-export-json" },
  });
  return projectExportNode;
}

function onWindowResize(): void {
  applyLayout();
  scheduleFitCanvas();
  scheduleMapTreeFit();
}

function applyLayout(): void {
  if (!leftRoot || !leftResizer) return;
  const chrome = getEditorChrome();
  const layoutEl = leftRoot.closest<HTMLElement>(".editor-layout") ?? leftRoot.parentElement;
  let usableWidth = window.innerWidth;
  if (layoutEl) {
    const cs =
      typeof getComputedStyle === "function"
        ? getComputedStyle(layoutEl)
        : typeof window.getComputedStyle === "function"
          ? window.getComputedStyle(layoutEl)
          : null;
    const padL = cs ? parseFloat(cs.paddingLeft) || 0 : 0;
    const padR = cs ? parseFloat(cs.paddingRight) || 0 : 0;
    const layoutWidth = Number.isFinite(layoutEl.clientWidth) && layoutEl.clientWidth > 0 ? layoutEl.clientWidth : window.innerWidth;
    usableWidth = layoutWidth - padL - padR;
  }
  const resizerWidth = leftResizer.offsetWidth || 6;
  if (aiSidebarWorkspace) {
    const collapsed = aiSidebarWorkspace.isCollapsed();
    const width = collapsed ? 48 : Math.max(280, Math.min(340, leftWidth, Math.max(280, usableWidth - 420)));
    aiSidebarWorkspace.root.style.width = `${width}px`;
    leftRoot.style.width = "100%";
    leftRoot.style.setProperty("--map-tree-height", `${effectiveMapTreeHeight()}px`);
    leftResizer.style.display = collapsed ? "none" : "";
    syncMapTreeCollapsedChrome();
    setEditorLeftSafe(`${width + (collapsed ? 0 : resizerWidth)}px`);
    return;
  }
  // 조수는 캔버스 위에 떠 있으므로 레이아웃 폭 예산을 먹지 않는다. side 도크가 있던
  // 시절에는 여기서 1/3 을 잘라 갔다 — 이제 캔버스가 그 폭을 되돌려 받는다.
  layoutEl?.style?.setProperty?.("--ai-chat-side-width", "0px");

  // 좌측 사이드바(타일+맵 트리)는 편집 모드에서 항상 보인다. 프리셋·접힘 토글·좁은
  // 뷰포트가 열을 display:none 으로 지울 수 없다.
  if (chrome.paletteRail) {
    leftRoot.style.display = "";
    // Standard/expert leave an inline width. min-width in the rail stylesheet
    // cannot override it: clear it before measuring the CSS-owned beginner panel.
    leftRoot.style.width = "";
    leftResizer.style.display = "none";
    // `--editor-left-safe` 는 실폭에서 파생한다. 리사이저 여유는 비-레일 분기와 같은 계산이고
    // 여긴 숨겼으니 0 이다 → 어시스턴트 오버레이의 12px 여백이 마침내 12px 이 된다.
    setEditorLeftSafe(`${measuredWidth(leftRoot, BASIC_RAIL_FALLBACK_WIDTH) + visibleWidth(leftResizer)}px`);
    return;
  }
  leftRoot.style.display = "";
  // 실제 사용 가능한 폭 = 레이아웃 콘텐츠폭 − 좌우 패딩. 캔버스 최소폭을 먼저 확보한 뒤 좌패널 상한을 잡는다.
  const maxLeftForCanvas = Math.max(LEFT_PANEL_MIN_WIDTH, usableWidth - MIN_CANVAS_WIDTH - resizerWidth);
  const preferredLeftWidth = chrome.leftPanelMaxWidthPx ? Math.min(leftWidth, chrome.leftPanelMaxWidthPx) : leftWidth;
  const effectiveLeftWidth = Math.min(preferredLeftWidth, maxLeftForCanvas);
  leftRoot.style.width = `${effectiveLeftWidth}px`;
  // 접힘 클래스를 먼저 발행한다 — 접힌 헤더의 margin-bottom:0 이 적용된 뒤에 재야 첫 계산과
  // 이후 재계산(창 크기 변경 등)의 값이 같다.
  syncMapTreeCollapsedChrome();
  leftRoot.style.setProperty("--map-tree-height", `${effectiveMapTreeHeight()}px`);
  leftResizer.style.display = "";
  // AI 미니 스트림/제안 오버레이가 좌패널을 덮지 않도록 실제 패널 폭을 전역 변수로 발행.
  setEditorLeftSafe(`${effectiveLeftWidth + resizerWidth}px`);
}

/** 렌더된 폭(px). 아직 레이아웃되지 않았거나 fake DOM 이면 폴백. */
function measuredWidth(node: HTMLElement, fallback: number): number {
  const rect = node.getBoundingClientRect?.();
  if (rect && Number.isFinite(rect.width) && rect.width > 0) return Math.round(rect.width);
  const offset = node.offsetWidth;
  if (Number.isFinite(offset) && offset > 0) return offset;
  return fallback;
}

/** `display:none` 인 노드는 자리를 안 차지한다 — 여유폭도 0. */
function visibleWidth(node: HTMLElement): number {
  return node.style.display === "none" ? 0 : measuredWidth(node, 0);
}

// fakeDom(단위 테스트)에는 documentElement가 없으므로 옵셔널 체이닝으로 가드.
function setEditorLeftSafe(px: string): void {
  document.documentElement?.style?.setProperty?.("--editor-left-safe", px);
}

/** 도크 3행의 높이 — 접힘 > 자동 > 수동 순으로 결정한다. */
function effectiveMapTreeHeight(): number {
  if (isMapPanelCollapsed()) return mapTreeCollapsedHeight();
  return mapTreeAuto ? mapTreeAutoHeight : mapTreeHeight;
}

/** 접힌 섹션은 헤더 한 줄만 남는다. 헤더가 아직 없으면(첫 페인트) 폴백 상수. */
function mapTreeCollapsedHeight(): number {
  const header = leftMapRoot?.querySelector<HTMLElement>(".map-tree-header");
  if (!header || !leftMapRoot) return MAP_TREE_COLLAPSED_FALLBACK_HEIGHT;
  const headerHeight = measuredHeight(header, 0);
  if (headerHeight <= 0) return MAP_TREE_COLLAPSED_FALLBACK_HEIGHT;
  return Math.round(headerHeight + verticalPadding(leftMapRoot) + verticalMargin(header));
}

/** 접힘 상태를 호스트·리사이저 클래스로 발행한다 — CSS 가 목록을 숨기고 리사이저를 잠근다. */
function syncMapTreeCollapsedChrome(): void {
  const collapsed = isMapPanelCollapsed();
  leftMapRoot?.classList?.toggle?.("is-collapsed", collapsed);
  if (mapTreeResizer) {
    mapTreeResizer.classList?.toggle?.("is-disabled", collapsed);
    mapTreeResizer.setAttribute("aria-disabled", String(collapsed));
  }
}

function scheduleMapTreeFit(): void {
  if (!mapTreeAuto || isMapPanelCollapsed()) return;
  if (typeof requestAnimationFrame !== "function") {
    fitMapTreeHeight();
    return;
  }
  if (mapTreeFitRaf) return;
  mapTreeFitRaf = requestAnimationFrame(() => {
    mapTreeFitRaf = 0;
    fitMapTreeHeight();
  });
}

/** 자동 모드: 맵 패널 내용 높이를 재서 도크 3행을 맞춘다. 측정이 불가하면 그대로 둔다. */
function fitMapTreeHeight(): void {
  if (!leftRoot || !leftMapRoot || !mapTreeAuto || isMapPanelCollapsed()) return;
  if (getEditorChrome().paletteRail || !getEditorChrome().mapTree) return;
  const desired = measureMapTreeContentHeight(leftMapRoot);
  if (desired === null) return;
  const panelHeight = measuredHeight(leftRoot, 0);
  const ratioCap = panelHeight > 0 ? Math.floor(panelHeight * MAP_TREE_AUTO_MAX_RATIO) : MAP_TREE_AUTO_MAX_HEIGHT;
  const sheetCap = paletteSheetReserveCap(panelHeight);
  // Keep the existing three-row list viewport usable when expert tools consume
  // more palette chrome; the sheet's preferred reserve must not starve maps.
  const list = leftMapRoot.querySelector<HTMLElement>(".map-tree-list");
  const minimum = Math.max(MAP_TREE_AUTO_MIN_HEIGHT, list
    ? Math.ceil(measuredHeight(leftMapRoot, 0) - measuredHeight(list, 0) + Math.min(108, listContentHeight(list)))
    : 0);
  const max = Math.max(minimum, Math.min(MAP_TREE_AUTO_MAX_HEIGHT, ratioCap, sheetCap));
  const next = clamp(desired + MAP_TREE_AUTO_SLACK, minimum, max);
  if (next === mapTreeAutoHeight) return;
  mapTreeAutoHeight = next;
  applyLayout();
  scheduleFitCanvas();
}

/**
 * 타일 시트에 PALETTE_SHEET_RESERVE_HEIGHT 를 남기고 맵 도크가 가져갈 수 있는 최대 높이.
 * 팔레트 크롬(칩·도구·레이어·검색·분류·붓 보조·킷 = 호스트 높이 − 시트 높이)은 flex 0 0 auto 라
 * 시트가 얼마나 눌려 있든 같은 값이 나온다. 시트가 없으면(이벤트 레이어 = 이벤트 편집기가 그 자리,
 * 타일 도크를 뺀 구성) 제한하지 않는다.
 */
function paletteSheetReserveCap(panelHeight: number): number {
  if (!leftRoot || panelHeight <= 0) return Number.POSITIVE_INFINITY;
  const paletteHost = leftRoot.querySelector?.<HTMLElement>('[data-testid="left-palette-root"]');
  const sheet = paletteHost?.querySelector<HTMLElement>('[data-testid="tile-palette"]');
  if (!paletteHost || !sheet) return Number.POSITIVE_INFINITY;
  const hostHeight = measuredHeight(paletteHost, 0);
  const sheetHeight = measuredHeight(sheet, 0);
  if (hostHeight <= 0 || sheetHeight <= 0) return Number.POSITIVE_INFINITY;
  const chrome = Math.max(0, hostHeight - sheetHeight);
  const resizerHeight = mapTreeResizer ? measuredHeight(mapTreeResizer, 6) : 6;
  // On short desktops, reserving 280px left only one map row below the
  // filter (48px at 1024×768). Keep roughly five tile rows and three map rows.
  const reserve = panelHeight < 800 ? 200 : PALETTE_SHEET_RESERVE_HEIGHT;
  return Math.floor(panelHeight - resizerHeight - chrome - reserve);
}

/**
 * 맵 패널의 자연 높이 = 호스트 세로 패딩 + 패널 자식(헤더·필터·목록)의 내용 높이.
 * 목록은 `flex: 1` 로 도크 행을 채우는 스크롤 컨테이너라 자기 상자 높이(scrollHeight 도 상자를
 * 따라간다)가 아니라 **자식 행들의 합**을 읽어야 한다 — 그렇지 않으면 "지금 높이"를 되받아
 * 자동 맞춤이 한 번도 줄어들지 않는다(실측: 1행인데 305px). fake DOM 처럼 치수가 없으면
 * null 을 돌려 자동 맞춤을 건너뛴다.
 */
function measureMapTreeContentHeight(host: HTMLElement): number | null {
  const panel = host.querySelector?.<HTMLElement>(".map-tree-panel");
  if (!panel) return null;
  const list = panel.querySelector<HTMLElement>(".map-tree-list");
  let total = verticalPadding(host);
  let measuredAny = false;
  for (const child of Array.from(panel.children)) {
    if (!(child instanceof HTMLElement) || child.hidden) continue;
    const content = child === list ? listContentHeight(child) : measuredHeight(child, 0);
    if (!Number.isFinite(content) || content <= 0) continue;
    measuredAny = true;
    total += content + verticalMargin(child);
  }
  return measuredAny ? Math.ceil(total) : null;
}

/** 목록 자식(행 + 하위 그룹)의 높이 합 + 목록 자체의 세로 패딩. 하위 그룹은 안의 행을 포함한다. */
function listContentHeight(list: HTMLElement): number {
  let total = verticalPadding(list);
  for (const child of Array.from(list.children)) {
    if (!(child instanceof HTMLElement)) continue;
    total += measuredHeight(child, 0) + verticalMargin(child);
  }
  return total;
}

function measuredHeight(node: HTMLElement, fallback: number): number {
  const rect = node.getBoundingClientRect?.();
  if (rect && Number.isFinite(rect.height) && rect.height > 0) return rect.height;
  const offset = node.offsetHeight;
  if (Number.isFinite(offset) && offset > 0) return offset;
  return fallback;
}

function verticalPadding(node: HTMLElement): number {
  const cs = typeof getComputedStyle === "function" ? getComputedStyle(node) : null;
  if (!cs) return 0;
  return (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
}

function verticalMargin(node: HTMLElement): number {
  const cs = typeof getComputedStyle === "function" ? getComputedStyle(node) : null;
  if (!cs) return 0;
  return (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
}

// editorState 통지 하나가 좌측 독 전체 + 캔버스 툴바 재구축이다. 우클릭 영역 드래그는
// 지나간 칸마다 통지를 내므로, 한 틱 안의 여러 통지를 한 번으로 접는다. 최종 상태만
// 반영하면 되므로 정합성 손실은 없다 — mapHistoryPanel 의 scheduleMapHistoryPanelMount 와 같은 모양.
let fullPanelRefreshQueued = false;
let fullPanelRefreshNeedsProject = false;
function scheduleFullPanelRefresh(editorStateOnly = false): void {
  fullPanelRefreshNeedsProject ||= !editorStateOnly;
  if (fullPanelRefreshQueued) return;
  fullPanelRefreshQueued = true;
  const run = (): void => {
    fullPanelRefreshQueued = false;
    const stateOnly = !fullPanelRefreshNeedsProject;
    fullPanelRefreshNeedsProject = false;
    refreshPanels(undefined, stateOnly);
  };
  if (typeof queueMicrotask === "function") queueMicrotask(run);
  else setTimeout(run, 0);
}

function refreshPanels(change?: ProjectChangeDescriptor, editorStateOnly = false): void {
  if (!editorStateOnly) refreshAuthoringJourney(change);
  // 프로젝트 단위 변화(포크 커밋·재연결·복구)는 persistence 상태를 바꾼다 — 배너를 다시 그린다.
  if (!editorStateOnly && (!change || change.scope === "project" || change.projectSwitch)) paintPersistenceBanner();
  // 좌측 패널 호스트는 프리셋에 따라 없을 수 있다 — 캔버스 크롬만 있으면 갱신을 진행한다.
  if (!canvasToolbarRoot || !mapLockBannerRoot) return;
  if (change?.scope === "map" && change.cells?.length) {
    renderCanvasToolbar(canvasToolbarRoot);
    renderMapEditLockBanner(mapLockBannerRoot);
    // Tile painting can emit once per pointer sample. The hidden export is an
    // automation oracle, not a live UI surface; give a stroke time to settle
    // so a large project is serialized once after the burst.
    updateProjectExport(500);
    return;
  }
  if (change?.scope === "database" || change?.scope === "system") {
    renderMapEditLockBanner(mapLockBannerRoot);
    updateProjectExport();
    return;
  }
  renderLeftDockPanels();
  renderCanvasToolbar(canvasToolbarRoot);
  renderMapEditLockBanner(mapLockBannerRoot);
  if (!editorStateOnly) updateProjectExport();
  scheduleFitCanvas();
}

function authoringJourneyScope(): string {
  const identity = store.getProjectIdentity();
  return `${identity.kind}:${identity.id}`;
}

function refreshAuthoringJourney(change?: ProjectChangeDescriptor): void {
  if (!authoringJourneyRoot) return;
  const project = store.getCurrent();
  const scope = authoringJourneyScope();
  let progress = loadAuthoringJourneyProgress(scope);
  if (change) {
    const next = recordAuthoringJourneyChange(progress, change);
    if (next !== progress) {
      progress = next;
      saveAuthoringJourneyProgress(scope, progress);
    }
  }
  if (
    authoringJourneyReferenceIssues === null ||
    !change ||
    change.scope === "database" ||
    change.scope === "system" ||
    change.scope === "project" ||
    (change.scope === "map" && !change.cells?.length)
  ) {
    authoringJourneyReferenceIssues = collectProjectReferenceIssues(project);
  }
  clearChildren(authoringJourneyRoot);
  authoringJourneyRoot.append(renderAuthoringJourney(project, progress, {
    referenceIssues: authoringJourneyReferenceIssues,
    open: authoringJourneyOpen,
    onOpenChange: (open) => {
      authoringJourneyOpen = open;
    },
    onManualToggle: (stage, complete) => {
      const current = loadAuthoringJourneyProgress(scope);
      saveAuthoringJourneyProgress(scope, setManualJourneyStage(current, stage, complete));
      refreshAuthoringJourney();
    },
  }));
}

function onAuthoringTestBootSuccess(event: Event): void {
  if (!(event instanceof CustomEvent)) return;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null || !("projectFingerprint" in detail)) return;
  const projectFingerprint = detail.projectFingerprint;
  if (typeof projectFingerprint !== "string" || projectFingerprint.length === 0) return;
  const project = store.getCurrent();
  authoringJourneyReferenceIssues = collectProjectReferenceIssues(project);
  const scope = authoringJourneyScope();
  const progress = loadAuthoringJourneyProgress(scope);
  const next = recordSuccessfulTestBoot(
    progress,
    projectFingerprint,
    authoringProjectFingerprint(project),
  );
  if (next !== progress) saveAuthoringJourneyProgress(scope, next);
  refreshAuthoringJourney();
}

function renderMapEditLockBanner(container: HTMLElement): void {
  clearChildren(container);
  const status = getMapEditLockStatus();
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  container.className = "map-lock-banner is-hidden";
  if (status.kind !== "locked" || status.mapId !== mapId) return;
  container.className = "map-lock-banner locked";
  container.append(
    el("span", {
      class: "map-lock-banner-text",
      text: `${lockOwnerPhrase(status.ownerLabel)}님이 편집 중입니다.`,
      dataset: { testid: "map-lock-banner-text" },
    }),
    el("button", {
      class: "map-lock-takeover-button",
      text: "편집 권한 가져오기",
      attrs: { type: "button", title: status.canTakeover === false ? "본인의 다른 탭 또는 팀 소유자만 편집 권한을 가져올 수 있습니다" : "현재 맵 편집 권한 가져오기", ...(status.canTakeover === false ? { disabled: "" } : {}) },
      dataset: { testid: "map-lock-banner-takeover" },
      on: {
        click: () => void requestMapLockTakeover(status),
      },
    }),
  );
}


async function requestMapLockTakeover(status: Extract<MapEditLockStatus, { readonly kind: "locked" }>): Promise<void> {
  const immediate = isMapEditLockTakeoverImmediate(status);
  if (!immediate) {
    // 커스텀 인앱 모달(§2.4) — 네이티브 confirm 대체.
    const confirmed = await showConfirm({
      title: "편집 권한 가져오기",
      message: `${lockOwnerPhrase(status.ownerLabel)}님이 편집 중입니다. 이 탭으로 편집 권한을 가져올까요? 다른 탭의 미저장 변경은 자동으로 합쳐지지 않습니다.`,
      confirmLabel: "가져오기",
    });
    if (!confirmed) return;
  }
  void takeoverMapLock(status.mapId, status.mapName).then(() => refreshPanels());
}

export function normalizeAiDockButtonChrome(panel: HTMLElement): void {
  const button = panel.querySelector<HTMLElement>('[data-testid="ai-dock-toggle"]');
  if (!button) return;
  const update = (): void => {
    if (panel.classList.contains("is-docked")) {
      button.setAttribute("title", "패널 분리");
      button.setAttribute("aria-label", "패널 분리");
    } else {
      button.setAttribute("title", "오른쪽 사이드바에 고정");
      button.setAttribute("aria-label", "오른쪽 사이드바에 고정");
    }
  };
  button.addEventListener("click", update);
  update();
}

function onTestPlayWindowRequest(event: Event): void {
  const detail = event instanceof CustomEvent ? event.detail : undefined;
  if (isMapTestRequest(detail)) {
    selectEditorMap(detail.mapId);
    void openTestPlayModal();
    return;
  }
  if (isSelectedEventTestRequest(detail)) {
    void openSelectedEventTestModal(detail.mapId, detail.eventId);
    return;
  }
  if (isTroopBattleTestRequest(detail)) {
    void openTroopBattleTestModal(detail.troopId);
    return;
  }
  if (isRandomBattleTestRequest(detail)) {
    void openRandomTroopBattleTestModal();
    return;
  }
  void openTestPlayModal();
}

function isMapTestRequest(value: unknown): value is { readonly kind: "map"; readonly mapId: string } {
  if (typeof value !== "object" || value === null) return false;
  return "kind" in value &&
    value.kind === "map" &&
    "mapId" in value &&
    typeof value.mapId === "string" &&
    value.mapId.length > 0;
}

function isSelectedEventTestRequest(value: unknown): value is { readonly mapId: string; readonly eventId: string } {
  if (typeof value !== "object" || value === null) return false;
  return "kind" in value &&
    value.kind === "selected-event" &&
    "mapId" in value &&
    typeof value.mapId === "string" &&
    "eventId" in value &&
    typeof value.eventId === "string";
}

function isTroopBattleTestRequest(value: unknown): value is { readonly troopId: string } {
  if (typeof value !== "object" || value === null) return false;
  return "kind" in value &&
    value.kind === "troop-battle" &&
    "troopId" in value &&
    typeof value.troopId === "string" &&
    value.troopId.length > 0;
}

function isRandomBattleTestRequest(value: unknown): value is { readonly kind: "random-battle" } {
  if (typeof value !== "object" || value === null) return false;
  return "kind" in value && value.kind === "random-battle";
}
// 콘텐츠 변경의 clone+stringify는 trailing 디바운스로 합친다. UI 상태만 바뀌면
// ProjectExportMirror가 내용 버전별 JSON을 재사용하고 editor/history만 다시 직렬화한다.
// 맵 타일 버스트는 500ms, 그 밖의 콘텐츠는 150ms로 숨은 <pre> 관측 비용을 묶는다.
let projectExportTimer: ReturnType<typeof setTimeout> | null = null;
const projectExportMirror = new ProjectExportMirror();

// 숨은 `project-export-json` 미러는 프로젝트 전체를 JSON.stringify 한다. 선행 잠금
// (`if (timer) return`)이면 버스트 중 150ms 마다 타이머가 재무장되어 반복 직렬화됐다 —
// 우클릭 드래그 2초에 열 번 넘게 돌았다. 후행 엣지로 바꿔 버스트가 끝난 뒤 한 번만 돈다.
function updateProjectExport(delayOverride?: number): void {
  if (projectExportTimer) clearTimeout(projectExportTimer);
  // The first export is a full JSON stringify of the loaded project. Let the canvas and map
  // shell get a paint opportunity before doing that hidden automation work; ordinary edits keep
  // the shorter debounce while tile bursts pass an explicit longer delay.
  const delay = delayOverride ?? (projectExportNode?.textContent ? 150 : 500);
  projectExportTimer = setTimeout(() => {
    projectExportTimer = null;
    if (!projectExportNode) return;
    projectExportNode.textContent = projectExportMirror.serialize(
      store.getCurrent(), store.getVersionToken(), editorState.get(), getMapEditHistoryState(),
    );
  }, delay);
}

function bindLeftResizer(): void {
  if (!leftResizer) return;
  leftResizer.addEventListener("mousedown", (event: MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = leftWidth;
    const onDrag = (moveEvent: MouseEvent): void => {
      leftWidth = Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(LEFT_PANEL_MAX_WIDTH, startWidth + moveEvent.clientX - startX));
      applyLayout();
      scheduleFitCanvas();
    };
    const onUp = (): void => {
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("resizing");
      saveEditorLayout();
    };
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", onUp);
    document.body.classList.add("resizing");
  });
  leftResizer.addEventListener("keydown", (event: KeyboardEvent) => {
    const step = event.shiftKey ? 40 : 16;
    if (event.key === "ArrowLeft") { leftWidth = Math.max(LEFT_PANEL_MIN_WIDTH, leftWidth - step); applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "ArrowRight") { leftWidth = Math.min(LEFT_PANEL_MAX_WIDTH, leftWidth + step); applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "Home") { leftWidth = LEFT_PANEL_MAX_WIDTH; applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "End") { leftWidth = LEFT_PANEL_MIN_WIDTH; applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
  });
}

// leftRoot 를 전제하지 않는다 — mountLeftDock 은 renderEditor 가 leftRoot 를 대입하기
// **전에** 불린다(도크가 좌패널의 자식을 만드는 쪽이므로 순서가 그렇다). 본문도 leftRoot 를
// 쓰지 않는다.
function bindMapTreeResizer(): void {
  if (!mapTreeResizer) return;
  mapTreeResizer.addEventListener("mousedown", (event: MouseEvent) => {
    if (isMapPanelCollapsed()) return;
    event.preventDefault();
    const startY = event.clientY;
    // 자동 모드에서 끌기 시작하면 지금 보이는 높이에서 이어간다 — 저장된 옛 수동값으로 튀지 않게.
    const startHeight = mapTreeAuto ? mapTreeAutoHeight : mapTreeHeight;
    mapTreeAuto = false;
    mapTreeHeight = clamp(startHeight, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT);
    const onDrag = (moveEvent: MouseEvent): void => {
      const nextHeight = startHeight - (moveEvent.clientY - startY);
      mapTreeHeight = clamp(nextHeight, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT);
      applyLayout();
      scheduleFitCanvas();
    };
    const onUp = (): void => {
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("resizing");
      saveEditorLayout();
    };
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", onUp);
    document.body.classList.add("resizing");
  });
  // 더블클릭 = 다시 자동(내용에 맞춤). 끌어서 만든 수동 높이에서 되돌아오는 유일한 길이다.
  mapTreeResizer.addEventListener("dblclick", (event: MouseEvent) => {
    if (isMapPanelCollapsed()) return;
    event.preventDefault();
    mapTreeAuto = true;
    saveEditorLayout();
    fitMapTreeHeight();
    applyLayout();
    scheduleFitCanvas();
  });
  mapTreeResizer.addEventListener("keydown", (event: KeyboardEvent) => {
    if (isMapPanelCollapsed()) return;
    const step = event.shiftKey ? 32 : 12;
    const current = mapTreeAuto ? mapTreeAutoHeight : mapTreeHeight;
    const manual = (next: number): void => {
      mapTreeAuto = false;
      mapTreeHeight = clamp(next, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT);
      applyLayout();
      scheduleFitCanvas();
      saveEditorLayout();
      event.preventDefault();
    };
    if (event.key === "ArrowUp") manual(current + step);
    else if (event.key === "ArrowDown") manual(current - step);
    else if (event.key === "Home") manual(MAP_TREE_MAX_HEIGHT);
    else if (event.key === "End") manual(MAP_TREE_MIN_HEIGHT);
  });
}

/** 맵 캔버스를 scroll-shell / 가용 영역에 맞게 리사이즈. 레이아웃 직후 0 크기면 다음 프레임에 재시도. */
function fitCanvas(): void {
  if (!phaserHost) return;
  const game = getGame();
  if (!game) return;
  // 컨테이너가 캔버스 고유 크기에 묶이지 않도록 부모 셸(absolute fill) 기준으로 잰다.
  const shell = phaserHost.closest(".editor-canvas-scroll-shell") as HTMLElement | null;
  const measureEl = shell && shell.clientWidth > 0 ? shell : phaserHost;
  const w = Math.max(200, Math.floor(measureEl.clientWidth || measureEl.getBoundingClientRect().width));
  const h = Math.max(200, Math.floor(measureEl.clientHeight || measureEl.getBoundingClientRect().height));
  if (w < 32 || h < 32) {
    scheduleFitCanvas();
    return;
  }
  const prev = game.scale.gameSize;
  if (prev && Math.abs(prev.width - w) < 1 && Math.abs(prev.height - h) < 1) {
    syncCanvasCssSize(game, w, h);
    return;
  }
  game.scale.resize(w, h);
  syncCanvasCssSize(game, w, h);
}

function syncCanvasCssSize(game: { canvas?: HTMLCanvasElement | null }, w: number, h: number): void {
  const canvas = game.canvas;
  if (!canvas) return;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.display = "block";
  // 호스트는 %로 셸을 채우고, 버퍼 크기만 w×h로 맞춘다(고정 px는 다음 리사이즈를 막음).
  if (phaserHost) {
    phaserHost.style.width = "100%";
    phaserHost.style.height = "100%";
  }
}

let fitCanvasRaf = 0;
function scheduleFitCanvas(): void {
  if (typeof requestAnimationFrame !== "function") {
    fitCanvas();
    return;
  }
  if (fitCanvasRaf) cancelAnimationFrame(fitCanvasRaf);
  fitCanvasRaf = requestAnimationFrame(() => {
    fitCanvasRaf = 0;
    fitCanvas();
    requestAnimationFrame(() => fitCanvas());
  });
}

function loadEditorLayout(): LoadedEditorLayout {
  // Version-stamped migration: force-reset layout cache when defaults change
  const LAYOUT_CACHE_VERSION = "2026-07-24-maptree-300";
  const ls = browserLocalStorage();
  if (ls) {
    const storedVersion = ls.getItem("oprn:editor-layout-version");
    if (storedVersion !== LAYOUT_CACHE_VERSION) {
      for (const k of ["oprn:editor-layout", "oprn:editor-layout:v2", "oprn:editor-layout:v3", "oprn:editor-layout:v4"]) {
        ls.removeItem(k);
      }
      ls.setItem("oprn:editor-layout-version", LAYOUT_CACHE_VERSION);
    }
  }
  const fallback = defaultEditorLayout();
  const raw = browserLocalStorage()?.getItem(EDITOR_LAYOUT_KEY);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    return {
      leftWidth: typeof parsed.leftWidth === "number" ? clamp(parsed.leftWidth, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH) : fallback.leftWidth,
      mapTreeHeight:
        typeof parsed.mapTreeHeight === "number" ? clamp(parsed.mapTreeHeight, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT) : fallback.mapTreeHeight,
      // 키가 없는 옛 저장본: 높이가 기본값(300) 그대로면 손대지 않은 것이므로 자동으로 승격하고,
      // 다른 값이면 리사이저를 끌어 만든 선택이므로 수동으로 남긴다.
      mapTreeAuto: typeof parsed.mapTreeAuto === "boolean"
        ? parsed.mapTreeAuto
        : typeof parsed.mapTreeHeight !== "number" || parsed.mapTreeHeight === MAP_TREE_DEFAULT_HEIGHT,
      // 저장된 `chatDock` 은 읽지 않는다 — 도크가 하나뿐이라 복원할 것이 없다.
      // 낡은 키는 다음 저장에서 자연히 사라진다(마이그레이션 불필요).
      assistantTemperature: parseAssistantTemperature(parsed.assistantTemperature, fallback.assistantTemperature),
    };
  } catch (error) {
    if (error instanceof SyntaxError) return fallback;
    return fallback;
  }
}

function defaultEditorLayout(): LoadedEditorLayout {
  return {
    leftWidth: LEFT_PANEL_DEFAULT_WIDTH,
    mapTreeHeight: MAP_TREE_DEFAULT_HEIGHT,
    mapTreeAuto: true,
    assistantTemperature: DEFAULT_ASSISTANT_TEMPERATURE,
  };
}

function saveEditorLayout(): void {
  browserLocalStorage()?.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({
    leftWidth,
    mapTreeHeight,
    mapTreeAuto,
    assistantTemperature,
  }));
}

function browserLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    if (error instanceof Error) return null;
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
