import { destroyGame, getGame, startEditGame } from "@/app/mode";
import { editorState, type ChatDock, type Layer } from "@/editor/editorState";
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
  mapEditLockLastActivityText,
  subscribeMapEditLocks,
  takeoverMapLock,
  type MapEditLockStatus,
} from "@/editor/mapEditLocks";
import { getMapEditHistoryState } from "@/editor/mapEditHistory";
import { installEditorToolHook } from "@/editor/editorToolHook";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { computeSideChatWidth } from "@/editor/panels/aiPanelLayout";
import { showConfirm } from "@/editor/ui/modal";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { renderMapList } from "@/editor/panels/mapList";
import { closeTestPlayModal, openSelectedEventTestModal, openTestPlayModal } from "@/editor/panels/testPlayModal";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { isSaveSkippedLocation } from "@/project/devProjectPersistence";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

const LEFT_PANEL_DEFAULT_WIDTH = 526;
const LEFT_PANEL_MIN_WIDTH = 184;
const LEFT_PANEL_MAX_WIDTH = 640;
const MIN_CANVAS_WIDTH = 520;
const MAP_TREE_DEFAULT_HEIGHT = 154;
const MAP_TREE_MIN_HEIGHT = 112;
const MAP_TREE_MAX_HEIGHT = 260;
const RESPONSIVE_BREAKPOINT = 720;
const EDITOR_LAYOUT_KEY = "rpg-zzu:editor-layout";

type LoadedEditorLayout = {
  readonly leftWidth: number;
  readonly mapTreeHeight: number;
  readonly leftCollapsed: boolean;
  readonly leftCollapsedStored: boolean;
  readonly chatDock: ChatDock;
};

const initialLayout = loadEditorLayout();
let leftWidth = initialLayout.leftWidth;
let leftCollapsed = initialLayout.leftCollapsed;
let leftUserOverride = initialLayout.leftCollapsedStored;
let leftRoot: HTMLElement | null = null;
let leftPaletteRoot: HTMLElement | null = null;
let leftMapRoot: HTMLElement | null = null;
let leftResizer: HTMLElement | null = null;
let mapTreeResizer: HTMLElement | null = null;
let phaserHost: HTMLElement | null = null;
let canvasToolbarRoot: HTMLElement | null = null;
let chatFloatRoot: HTMLElement | null = null;
let chatSideRoot: HTMLElement | null = null;
let aiChatPanelRoot: HTMLElement | null = null;
let mapLockBannerRoot: HTMLElement | null = null;
let statusBarRoot: HTMLElement | null = null;
let projectExportNode: HTMLElement | null = null;
let unsubStore: (() => void) | null = null;
let unsubAutoSave: (() => void) | null = null;
let unsubEditor: (() => void) | null = null;
let unsubMapLocks: (() => void) | null = null;
let mapTreeHeight = initialLayout.mapTreeHeight;
let chatDock = initialLayout.chatDock;
let unsubUiMode: (() => void) | null = null;
let editorLayoutRoot: HTMLElement | null = null;

export function renderEditor(main: HTMLElement): void {
  clearChildren(main);
  installEditorToolHook(); // 헤드리스(Playwright) 에디터 조작용 window.__rpgzzuEditorTool.
  applyEditorUiModeClasses(getEditorUiMode());

  // 첫 페인트부터 dock class를 붙여 0폭→목표폭 애니메이션/리플로우를 막는다.
  const layout = el("div", {
    class: `editor-layout ${chatDock === "side" ? "chat-dock-side" : "chat-dock-float"}`,
    dataset: { testid: "editor-layout", editorUiMode: getEditorUiMode() },
  });
  editorLayoutRoot = layout;
  // applyLayout 전에도 1/3 폭 폴백을 심어 사이드 컬럼이 420→재계산으로 점프하지 않게 한다.
  if (chatDock === "side") {
    const bootWidth = computeSideChatWidth(
      typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1280,
      MIN_CANVAS_WIDTH + 6 + LEFT_PANEL_MIN_WIDTH,
    );
    layout.style.setProperty("--ai-chat-side-width", `${bootWidth}px`);
    document.documentElement?.style?.setProperty?.("--ai-chat-side-width", `${bootWidth}px`);
    document.body?.classList?.add?.("ai-chat-dock-side");
    document.body?.classList?.remove?.("ai-chat-dock-float", "ai-panel-docked");
  } else {
    layout.style.setProperty("--ai-chat-side-width", "0px");
    document.body?.classList?.add?.("ai-chat-dock-float");
    document.body?.classList?.remove?.("ai-chat-dock-side");
  }
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
  const statusBar = el("div", {
    class: "editor-statusbar",
    dataset: { testid: "editor-statusbar" },
  });
  const chatFloatHost = el("div", {
    class: "ai-chat-float-host",
    dataset: { testid: "chat-float-host" },
  });
  const chatSidePanel = el("aside", {
    class: "right-panel ai-chat-side-panel",
    dataset: { testid: "chat-side-panel" },
  });

  leftResizer = el("div", { class: "resizer resizer-left", attrs: { title: "드래그로 크기 조절" } });
  leftPaletteRoot = el("div", { class: "left-panel-stack", dataset: { testid: "left-palette-root" } });
  mapTreeResizer = el("div", {
    class: "resizer resizer-map-tree",
    attrs: {
      "aria-label": "맵 트리 높이 조절",
      role: "separator",
      title: "드래그로 맵 트리 높이 조절",
    },
    dataset: { testid: "map-tree-height-resizer", uiDensity: "expert" },
  });
  leftMapRoot = el("div", {
    class: "left-panel-stack",
    dataset: { testid: "left-map-root", uiDensity: "expert" },
  });
  left.append(leftPaletteRoot, mapTreeResizer, leftMapRoot);
  canvasScrollShell.append(phaserContainer);
  // 저장 모드 배너(결함 ⑩)는 캔버스 열 상단에 넣는다 — .main(flex row)의 형제로 넣으면
  // 좌측 열처럼 배치되어 레이아웃이 깨진다.
  const persistenceBanner = renderPersistenceModeBanner();
  if (persistenceBanner) canvasArea.append(persistenceBanner);
  canvasArea.append(canvasScrollShell, mapLockBanner, canvasToolbar, statusBar, chatFloatHost);
  layout.append(left, leftResizer, canvasArea, chatSidePanel);
  const aiPanel = renderAiChatPanel({
    getChatDock: () => chatDock,
    onChatDockToggle: toggleChatDock,
  });
  main.append(layout, projectExportNodeElement());

  leftRoot = left;
  phaserHost = phaserContainer;
  canvasToolbarRoot = canvasToolbar;
  chatFloatRoot = chatFloatHost;
  chatSideRoot = chatSidePanel;
  aiChatPanelRoot = aiPanel;
  mapLockBannerRoot = mapLockBanner;
  statusBarRoot = statusBar;

  applyChatDockLayout();
  applyLayout();
  applyEditorUiModeLayout();
  refreshPanels();
  ensureCurrentMapLock();
  bindLeftResizer();
  bindMapTreeResizer();
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("rpgzzu:test-play-window", onTestPlayWindowRequest);
  void startEditGame(phaserContainer).then(() => scheduleFitCanvas());

  unsubStore = store.subscribe((_project, change) => refreshPanels(change));
  unsubAutoSave = store.subscribeAutoSave(() => refreshStatusbar());
  unsubEditor = editorState.subscribe(() => refreshPanels());
  unsubMapLocks = subscribeMapEditLocks(() => refreshPanels());
  unsubUiMode = subscribeEditorUiMode(() => applyEditorUiModeLayout());
}

/** Re-apply basic/expert density without tearing down Phaser or AI session. */
export function applyEditorUiModeLayout(): void {
  const mode = getEditorUiMode();
  const chrome = getEditorChrome();
  applyEditorUiModeClasses(mode);
  editorLayoutRoot?.setAttribute("data-editor-ui-mode", mode);
  editorLayoutRoot?.classList.toggle("editor-layout-basic", mode === "basic");
  editorLayoutRoot?.classList.toggle("editor-layout-expert", mode === "expert");

  if (leftMapRoot) {
    leftMapRoot.hidden = !chrome.mapTree;
    if (chrome.mapTree) leftMapRoot.classList.remove("is-ui-hidden");
    else leftMapRoot.classList.add("is-ui-hidden");
  }
  if (mapTreeResizer) {
    mapTreeResizer.hidden = !chrome.mapTree;
    if (chrome.mapTree) mapTreeResizer.classList.remove("is-ui-hidden");
    else mapTreeResizer.classList.add("is-ui-hidden");
  }
  if (canvasToolbarRoot) {
    if (!chrome.canvasChromeDense) {
      canvasToolbarRoot.classList.add("is-basic-chrome");
      canvasToolbarRoot.classList.add("is-expanded");
    } else {
      canvasToolbarRoot.classList.remove("is-basic-chrome");
    }
    canvasToolbarRoot.dataset.uiDensity = chrome.canvasChromeDense ? "expert" : "basic";
  }
  if (aiChatPanelRoot) {
    // AI 표면은 에디터 basic/expert와 무관 — 항상 공유 UI.
    aiChatPanelRoot.dataset.uiDensity = "shared";
    aiChatPanelRoot.classList.remove("ai-density-expert", "ai-density-basic");
  }
  // Re-render left/map chrome so palette tabs match density; keep event layer path live.
  // 맵 트리는 basic에서도 표시(맵 전환) — 숨기지 않는다.
  if (leftPaletteRoot && leftMapRoot && canvasToolbarRoot && statusBarRoot) {
    renderTilePalette(leftPaletteRoot);
    if (chrome.mapTree) renderMapList(leftMapRoot);
    else clearChildren(leftMapRoot);
    renderCanvasToolbar(canvasToolbarRoot);
    refreshStatusbar();
  }
  applyLayout();
  scheduleFitCanvas();
}

export function teardownEditor(): void {
  unsubStore?.();
  unsubAutoSave?.();
  unsubEditor?.();
  unsubMapLocks?.();
  unsubUiMode?.();
  unsubStore = null;
  unsubAutoSave = null;
  unsubEditor = null;
  unsubMapLocks = null;
  unsubUiMode = null;
  window.removeEventListener("resize", onWindowResize);
  window.removeEventListener("rpgzzu:test-play-window", onTestPlayWindowRequest);
  closeTestPlayModal();
  destroyGame();
  leftRoot = null;
  leftPaletteRoot = null;
  leftMapRoot = null;
  leftResizer = null;
  mapTreeResizer = null;
  phaserHost = null;
  canvasToolbarRoot = null;
  chatFloatRoot = null;
  chatSideRoot = null;
  aiChatPanelRoot = null;
  mapLockBannerRoot = null;
  statusBarRoot = null;
  projectExportNode = null;
  editorLayoutRoot = null;
  document.body.classList.remove("ai-chat-dock-float", "ai-chat-dock-side", "editor-ui-basic", "editor-ui-expert");
}

export function toggleLeftPanel(): void {
  leftCollapsed = !leftCollapsed;
  leftUserOverride = true;
  applyLayout();
  saveEditorLayout();
  scheduleFitCanvas();
}

function refreshStatusbar(): void {
  if (!statusBarRoot) return;
  renderEditorStatusbar(statusBarRoot);
}

export function isLeftCollapsed(): boolean {
  return leftCollapsed;
}

export function toggleChatDock(): void {
  chatDock = chatDock === "side" ? "float" : "side";
  applyChatDockLayout();
  applyLayout();
  saveEditorLayout();
  scheduleFitCanvas();
}

function applyChatDockLayout(): void {
  if (!chatFloatRoot || !chatSideRoot || !aiChatPanelRoot) return;
  editorState.set({ chatDock });
  const layoutEl = chatFloatRoot.parentElement?.parentElement ?? null;
  layoutEl?.classList[chatDock === "side" ? "add" : "remove"]("chat-dock-side");
  layoutEl?.classList[chatDock === "float" ? "add" : "remove"]("chat-dock-float");
  aiChatPanelRoot.classList[chatDock === "side" ? "add" : "remove"]("chat-dock-side");
  aiChatPanelRoot.classList[chatDock === "float" ? "add" : "remove"]("chat-dock-float");
  // side flex 도크는 is-docked(fixed 오버레이)와 섞지 않는다 — body inset 이중 적용/흔들림 방지.
  if (chatDock === "side") {
    aiChatPanelRoot.classList.remove("is-docked");
    document.body.classList.remove("ai-panel-docked");
  } else if (aiChatPanelRoot.classList.contains("is-history-open")) {
    aiChatPanelRoot.classList.add("is-docked");
  }
  document.body.classList[chatDock === "side" ? "add" : "remove"]("ai-chat-dock-side");
  document.body.classList[chatDock === "float" ? "add" : "remove"]("ai-chat-dock-float");
  // 패널 생성 직후 첫 적용에서도 side class가 있도록 마운트 전에 반영한다.
  if (chatDock === "side" && !aiChatPanelRoot.classList.contains("chat-dock-side")) {
    aiChatPanelRoot.classList.add("chat-dock-side");
  }
  const target = chatDock === "side" ? chatSideRoot : chatFloatRoot;
  if (aiChatPanelRoot.parentElement !== target) {
    aiChatPanelRoot.remove();
    target.append(aiChatPanelRoot);
  }
}

// 저장 스킵/로컬 저장 모드 배너: 임시 URL 모드 등에서
// 저장이 조용히 스킵되어 세션 작업물이 통째로 증발하던 문제 — 모드를 화면에 명시한다.
function renderPersistenceModeBanner(): HTMLElement | null {
  const status = store.getDbPersistenceStatus();
  if (status.kind !== "disabled") return null;
  if (status.reason === "dev-showcase") {
    const saveSkipped = isSaveSkippedLocation();
    return el("div", {
      class: `persistence-mode-banner ${saveSkipped ? "is-save-skipped" : "is-local-only"}`,
      dataset: { testid: "save-skip-banner" },
      text: persistenceModeBannerText(status.reason, saveSkipped),
    });
  }
  // load-failed(복구 모드): 원격 저장이 꺼진 채 편집 중임을 알린다.
  return el("div", {
    class: "persistence-mode-banner is-recovery",
    dataset: { testid: "save-skip-banner" },
    text: "복구 모드 — 원격 DB 저장이 꺼져 있습니다. 상태바의 'DB 연동'에서 다시 연결하거나 '내보내기'로 백업하세요.",
  });
}

export function persistenceModeBannerText(reason: string, saveSkipped: boolean): string {
  if (reason === "dev-showcase" && saveSkipped) {
    return "임시 세션 — 작업이 저장되지 않습니다. 보존하려면 '내보내기'를 사용하세요.";
  }
  if (reason === "dev-showcase") return "개발 모드 — 원격 DB 대신 이 브라우저에만 저장됩니다.";
  return "복구 모드 — 원격 DB 저장이 꺼져 있습니다. 상태바의 'DB 연동'에서 다시 연결하거나 '내보내기'로 백업하세요.";
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
}

function applyLayout(): void {
  if (!leftRoot || !leftResizer) return;
  const autoCollapse = window.innerWidth < RESPONSIVE_BREAKPOINT;
  const leftFolded = leftUserOverride ? leftCollapsed : autoCollapse;
  const layoutEl = leftRoot.parentElement;
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
  // 사이드 도크는 레이아웃 폭의 1/3. 접힘 레일(CSS 44px)은 :has(.is-collapsed)가 덮어쓴다.
  const sideWidth =
    chatDock === "side"
      ? computeSideChatWidth(usableWidth, MIN_CANVAS_WIDTH + resizerWidth + LEFT_PANEL_MIN_WIDTH)
      : 0;
  publishSideChatWidth(layoutEl, sideWidth);

  // 기본 모드: 아이콘 레일 48px 고정 — 리사이저 없음, 오버레이 안전영역은 레일+여백.
  if (getEditorUiMode() === "basic") {
    if (leftFolded) {
      leftRoot.style.display = "none";
      leftResizer.style.display = "none";
      setEditorLeftSafe("12px");
      return;
    }
    leftRoot.style.display = "";
    leftRoot.style.width = "48px";
    leftResizer.style.display = "none";
    setEditorLeftSafe("60px");
    return;
  }

  if (leftFolded) {
    leftRoot.style.display = "none";
    leftResizer.style.display = "none";
    // 좌패널이 접히면 오버레이 안전 영역도 해제(assistant-rising-overlay.css 참조).
    setEditorLeftSafe("12px");
    return;
  }
  leftRoot.style.display = "";
  // 실제 사용 가능한 폭 = 레이아웃 콘텐츠폭 − 좌우 패딩. 캔버스 최소폭을 먼저 확보한 뒤 좌패널 상한을 잡는다.
  const maxLeftForCanvas = Math.max(LEFT_PANEL_MIN_WIDTH, usableWidth - MIN_CANVAS_WIDTH - resizerWidth - sideWidth);
  const effectiveLeftWidth = Math.min(leftWidth, maxLeftForCanvas);
  leftRoot.style.width = `${effectiveLeftWidth}px`;
  leftRoot.style.setProperty("--map-tree-height", `${mapTreeHeight}px`);
  leftResizer.style.display = "";
  // AI 미니 스트림/제안 오버레이가 좌패널을 덮지 않도록 실제 패널 폭을 전역 변수로 발행.
  setEditorLeftSafe(`${effectiveLeftWidth + resizerWidth}px`);
}

/** CSS `--ai-chat-side-width` 와 TS 좌패널 예산을 동일 값으로 맞춘다. */
function publishSideChatWidth(layoutEl: HTMLElement | null, sideWidth: number): void {
  const px = sideWidth > 0 ? `${sideWidth}px` : "0px";
  layoutEl?.style?.setProperty?.("--ai-chat-side-width", px);
  // float 모드에서도 변수를 0으로 고정해 이전 side 값이 남지 않게 한다.
  if (sideWidth <= 0 && layoutEl) {
    layoutEl.style.setProperty("--ai-chat-side-width", "0px");
  }
  // 폴백 문서 루트(사이드 패널이 layout 밖 선택자를 쓰는 경우 대비) — side일 때만 실제 값.
  if (sideWidth > 0) {
    document.documentElement?.style?.setProperty?.("--ai-chat-side-width", px);
  }
}

// fakeDom(단위 테스트)에는 documentElement가 없으므로 옵셔널 체이닝으로 가드.
function setEditorLeftSafe(px: string): void {
  document.documentElement?.style?.setProperty?.("--editor-left-safe", px);
}

function refreshPanels(change?: ProjectChangeDescriptor): void {
  if (!leftPaletteRoot || !leftMapRoot || !canvasToolbarRoot || !statusBarRoot || !mapLockBannerRoot) return;
  if (change?.scope === "map" && change.cells?.length) {
    renderCanvasToolbar(canvasToolbarRoot);
    renderMapEditLockBanner(mapLockBannerRoot);
    renderEditorStatusbar(statusBarRoot);
    updateProjectExport();
    return;
  }
  if (change?.scope === "database" || change?.scope === "system") {
    renderMapEditLockBanner(mapLockBannerRoot);
    renderEditorStatusbar(statusBarRoot);
    updateProjectExport();
    return;
  }
  renderTilePalette(leftPaletteRoot);
  renderMapList(leftMapRoot);
  renderCanvasToolbar(canvasToolbarRoot);
  renderMapEditLockBanner(mapLockBannerRoot);
  renderEditorStatusbar(statusBarRoot);
  updateProjectExport();
  scheduleFitCanvas();
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
      text: `${status.ownerLabel} 세션이 편집 중 · ${mapEditLockLastActivityText(status)}`,
      dataset: { testid: "map-lock-banner-text" },
    }),
    el("button", {
      class: "map-lock-takeover-button",
      text: "편집 권한 가져오기",
      attrs: { type: "button", title: "현재 맵 편집 권한 가져오기" },
      dataset: { testid: "map-lock-banner-takeover" },
      on: {
        click: () => void requestMapLockTakeover(status),
      },
    }),
  );
}

function renderEditorStatusbar(container: HTMLElement): void {
  clearChildren(container);
  const project = store.getCurrent();
  const state = editorState.get();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const lockStatus = getMapEditLockStatus();
  // 기본 표면: 레이어·맵·도구만 전면. 타일/줌/좌표/칩 번호는 보조(CSS로 basic에서 숨김, expert·좁은 폭 우선순위).
  const cells: HTMLElement[] = [
    el("span", { class: "editor-statusbar-cell strong", text: layerStatusLabel(state.layer) }),
    el("span", { class: "editor-statusbar-cell", text: `맵: ${map?.name ?? mapId}` }),
    el("span", { class: "editor-statusbar-cell sb-secondary", text: `타일: ${tileDisplayLabelForIndex(state.selectedTile)}` }),
    el("span", { class: "editor-statusbar-cell", text: toolStatusLabel(state.tool) }),
    el("span", { class: "editor-statusbar-cell sb-secondary", text: `줌: ${state.zoom}x` }),
    el("span", {
      class: "editor-statusbar-cell sb-detail",
      children: [el("span", { dataset: { testid: "cursor-position" }, text: "outside" })],
    }),
    el("span", {
      class: "editor-statusbar-cell sb-detail",
      children: ["하위: ", el("span", { dataset: { testid: "cursor-lower" }, text: "-" })],
    }),
    el("span", {
      class: "editor-statusbar-cell sb-detail",
      children: ["상위: ", el("span", { dataset: { testid: "cursor-upper" }, text: "-" })],
    }),
  ];
  // "확보/확인 전"은 소음 — 잠김·확인 중·장애일 때만 표시.
  if (shouldShowMapEditLockStatus(lockStatus, mapId)) {
    cells.push(renderMapEditLockStatus(lockStatus, mapId));
  }
  cells.push(renderDbConnectionStatus(store.getDbPersistenceStatus(), refreshStatusbar));
  container.append(...cells);
}

/** 맵 잠금 칩: 평시(idle/held)는 숨기고 사용자 조치가 필요할 때만 노출. */
function shouldShowMapEditLockStatus(status: MapEditLockStatus, mapId: string): boolean {
  if (status.kind === "idle" || status.mapId !== mapId) return false;
  return status.kind === "checking" || status.kind === "locked" || status.kind === "unavailable";
}

function renderMapEditLockStatus(status: MapEditLockStatus, mapId: string): HTMLElement {
  const className = status.kind !== "idle" && status.mapId === mapId ? status.kind : "idle";
  const cell = el("span", {
    class: `editor-statusbar-cell map-edit-lock-status ${className}`,
    text: mapEditLockStatusText(status, mapId),
    attrs: { title: mapEditLockStatusTitle(status, mapId) },
    dataset: { testid: "map-edit-lock-status" },
  });
  if (status.kind === "locked" && status.mapId === mapId) {
    cell.append(
      el("button", {
        class: "map-lock-takeover-button",
        text: "편집 권한 가져오기",
        attrs: { type: "button", title: "맵 편집 권한 가져오기" },
        dataset: { testid: "map-lock-takeover" },
        on: {
          click: (event) => {
            event.stopPropagation();
            void requestMapLockTakeover(status);
          },
        },
      }),
    );
  }
  return cell;
}

async function requestMapLockTakeover(status: Extract<MapEditLockStatus, { readonly kind: "locked" }>): Promise<void> {
  const immediate = isMapEditLockTakeoverImmediate(status);
  if (!immediate) {
    // 커스텀 인앱 모달(§2.4) — 네이티브 confirm 대체.
    const confirmed = await showConfirm({
      title: "편집 권한 가져오기",
      message: `${status.ownerLabel} 세션이 최근 활동했습니다. 편집 권한을 가져올까요? (상대 세션은 읽기 전용이 됩니다)`,
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

function mapEditLockStatusText(status: MapEditLockStatus, mapId: string): string {
  if (status.kind === "idle" || status.mapId !== mapId) return "맵 편집: 확인 전";
  switch (status.kind) {
    case "checking":
      return "맵 편집: 확인 중";
    case "held":
      return "맵 편집: 확보";
    case "locked":
      return "맵 편집: 읽기 전용";
    case "unavailable":
      return `맵 편집: ${status.message}`;
  }
}

function mapEditLockStatusTitle(status: MapEditLockStatus, mapId: string): string {
  if (status.kind === "idle" || status.mapId !== mapId) return "맵 잠금 상태를 아직 확인하지 않았습니다.";
  switch (status.kind) {
    case "checking":
      return `${status.mapName} 편집 권한을 확인하는 중입니다.`;
    case "held":
      return `${status.mapName} 편집 권한을 이 브라우저가 잡고 있습니다.`;
    case "locked":
      return `${status.mapName} 맵은 ${status.ownerLabel} 세션이 편집 중입니다. ${mapEditLockLastActivityText(status)}.`;
    case "unavailable":
      return `${status.mapName} 잠금 확인 실패: ${status.message}. 편집은 허용하지만 수동 저장 충돌 검사는 유지됩니다.`;
  }
}

function layerStatusLabel(layer: Layer): string {
  switch (layer) {
    case "lower":
      return "하위 레이어";
    case "upper":
      return "상위 레이어";
    case "event":
      return "이벤트 레이어";
  }
}

function toolStatusLabel(tool: string): string {
  switch (tool) {
    case "paint":
      return "펜";
    case "fill":
      return "채우기";
    case "pan":
      return "이동";
    case "event":
      return "이벤트";
    case "erase":
      return "지우개";
    case "select":
      return "선택";
    case "eyedropper":
      return "스포이드";
    case "collision":
      return "통행";
    default:
      return tool;
  }
}

function onTestPlayWindowRequest(event: Event): void {
  const detail = event instanceof CustomEvent ? event.detail : undefined;
  if (isSelectedEventTestRequest(detail)) {
    void openSelectedEventTestModal(detail.mapId, detail.eventId);
    return;
  }
  void openTestPlayModal();
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
// 프로젝트 전체 clone+stringify라 비싸다 — 페인트 드래그처럼 연속 변경 시 셀마다 실행하면
// 그 자체가 렉의 주범이 된다(대량 편집 렉 보고의 1순위 원인). trailing 디바운스로 합친다.
// 소비자는 E2E/내보내기 도구(숨은 <pre>)뿐이라 150ms 지연은 관측 불가.
let projectExportTimer: ReturnType<typeof setTimeout> | null = null;

function updateProjectExport(): void {
  if (projectExportTimer) return;
  projectExportTimer = setTimeout(() => {
    projectExportTimer = null;
    if (!projectExportNode) return;
    projectExportNode.textContent = JSON.stringify({
      project: projectWithoutEventDrafts(store.getCurrent()),
      editor: editorState.get(),
      history: getMapEditHistoryState(),
    });
  }, 150);
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
}

function bindMapTreeResizer(): void {
  if (!mapTreeResizer || !leftRoot) return;
  mapTreeResizer.addEventListener("mousedown", (event: MouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = mapTreeHeight;
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
    // 버퍼는 맞아도 CSS가 남아 있으면 강제 맞춤
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
    // 레이아웃이 한 프레임 늦게 잡히는 경우(좌패널/AI 도크) 한 번 더
    requestAnimationFrame(() => fitCanvas());
  });
}

function loadEditorLayout(): LoadedEditorLayout {
  const fallback = defaultEditorLayout();
  const raw = browserLocalStorage()?.getItem(EDITOR_LAYOUT_KEY);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const leftCollapsedStored = typeof parsed.leftCollapsed === "boolean";
    return {
      leftWidth: typeof parsed.leftWidth === "number" ? clamp(parsed.leftWidth, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH) : fallback.leftWidth,
      mapTreeHeight:
        typeof parsed.mapTreeHeight === "number" ? clamp(parsed.mapTreeHeight, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT) : fallback.mapTreeHeight,
      leftCollapsed: leftCollapsedStored ? parsed.leftCollapsed === true : fallback.leftCollapsed,
      leftCollapsedStored,
      chatDock: parsed.chatDock === "side" || parsed.chatDock === "float" ? parsed.chatDock : fallback.chatDock,
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
    leftCollapsed: false,
    leftCollapsedStored: false,
    chatDock: "side",
  };
}

function saveEditorLayout(): void {
  browserLocalStorage()?.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth, mapTreeHeight, leftCollapsed, chatDock }));
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
