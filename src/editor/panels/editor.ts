import { destroyGame, getGame, startEditGame } from "@/app/mode";
import { cycleChatDock, parseChatDock, type ChatDock } from "@/editor/chatDock";
import { editorState, type Layer } from "@/editor/editorState";
import { registerAiBootIntentTarget, clearPendingAiBootIntent } from "@/editor/aiBootIntent";
import { AI_TRANSPORT_HEALTH_EVENT, scrubStoredAiCredentials } from "@/ai/llmClient";
import { toast } from "@/util/toast";
import { dismissCoachMarks, maybeStartBasicCoachMarks, maybeStartStandardWelcomeCard } from "@/editor/coachMarks";
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
  mapEditLockLastActivityText,
  subscribeMapEditLocks,
  takeoverMapLock,
  type MapEditLockStatus,
} from "@/editor/mapEditLocks";
import { installLayoutBboxOverlay, toggleLayoutBboxes } from "@/editor/layoutBboxOverlay";
import { getMapEditHistoryState } from "@/editor/mapEditHistory";
import { installEditorToolHook } from "@/editor/editorToolHook";
import { cleanupProjectE2EBridge } from "@/editor/editorToolHook";
import { selectEditorMap } from "@/editor/mapSelection";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { refreshAiConnectionStatus, renderAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { computeSideChatWidth } from "@/editor/panels/aiPanelLayout";
import { showConfirm } from "@/editor/ui/modal";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { renderMapList } from "@/editor/panels/mapList";
import {
  closeTestPlayModal,
  openRandomTroopBattleTestModal,
  openSelectedEventTestModal,
  openTestPlayModal,
  openTroopBattleTestModal,
} from "@/editor/panels/testPlayModal";
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
const MAP_TREE_DEFAULT_HEIGHT = 300;
const MAP_TREE_MIN_HEIGHT = 80;
const MAP_TREE_MAX_HEIGHT = 480;
const RESPONSIVE_BREAKPOINT = 720;
const EDITOR_LAYOUT_KEY = "rpg-zzu:editor-layout:v4";
// AI 연동 칩 주기 재조회 — chatgpt OAuth 토큰 만료·companion 장애를 감지해 칩을 다시 그린다.
const AI_CONNECTION_POLL_MS = 60_000;

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
let unsubLayoutBbox: (() => void) | null = null;
// AI 연동 칩 폴링 타이머 — teardownEditor 에서 정리한다.
let aiConnectionPollTimer: ReturnType<typeof setInterval> | null = null;

export function renderEditor(main: HTMLElement): void {
  clearChildren(main);
  installEditorToolHook(); // 헤드리스(Playwright) 에디터 조작용 window.__rpgzzuEditorTool.
  applyEditorUiModeClasses(getEditorUiMode());

  // 첫 페인트부터 dock class를 붙여 0폭→목표폭 애니메이션/리플로우를 막는다.
  const layout = el("div", {
    class: `editor-layout ${layoutDockClass(chatDock)}`,
    dataset: { testid: "editor-layout" },
  });
  // applyLayout 전에도 1/3 폭 폴백을 심어 사이드 컬럼이 420→재계산으로 점프하지 않게 한다.
  if (chatDock === "side") {
    const bootWidth = computeSideChatWidth(
      typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1280,
      MIN_CANVAS_WIDTH + 6 + LEFT_PANEL_MIN_WIDTH,
    );
    layout.style.setProperty("--ai-chat-side-width", `${bootWidth}px`);
    document.documentElement?.style?.setProperty?.("--ai-chat-side-width", `${bootWidth}px`);
    document.body?.classList?.add?.("ai-chat-dock-side");
    document.body?.classList?.remove?.("ai-chat-dock-float", "ai-chat-dock-glass", "ai-panel-docked");
  } else {
    layout.style.setProperty("--ai-chat-side-width", "0px");
    document.body?.classList?.add?.(chatDock === "glass" ? "ai-chat-dock-glass" : "ai-chat-dock-float");
    document.body?.classList?.remove?.("ai-chat-dock-side", chatDock === "glass" ? "ai-chat-dock-float" : "ai-chat-dock-glass");
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

  leftResizer = el("div", {
    class: "resizer resizer-left",
    attrs: { title: "드래그로 크기 조절", role: "separator", "aria-label": "좌측 패널 너비 조절", "aria-orientation": "vertical", tabindex: "0" },
    dataset: { testid: "left-panel-resizer" },
  });
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
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      if (chatDock === "side") {
        const usable = document.querySelector<HTMLElement>(".editor-layout")?.clientWidth ?? window.innerWidth;
        const w = computeSideChatWidth(usable, MIN_CANVAS_WIDTH + 6 + LEFT_PANEL_MIN_WIDTH);
        document.documentElement.style.setProperty("--ai-chat-side-width", `${w}px`);
        const layoutEl = document.querySelector<HTMLElement>(".editor-layout");
        if (layoutEl) layoutEl.style.setProperty("--ai-chat-side-width", `${w}px`);
      }
    });
    const layoutHost = document.querySelector<HTMLElement>(".editor-layout");
    if (layoutHost) ro.observe(layoutHost);
    (window as unknown as Record<string, unknown>)["__rpgzzuLayoutRO"] = ro;
  }
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("rpgzzu:test-play-window", onTestPlayWindowRequest);
  void startEditGame(phaserContainer).then(() => scheduleFitCanvas());
  unsubLayoutBbox = installLayoutBboxOverlay();

  unsubStore = store.subscribe((_project, change) => refreshPanels(change));
  unsubAutoSave = store.subscribeAutoSave(() => refreshStatusbar());
  unsubEditor = editorState.subscribe(() => refreshPanels());
  unsubMapLocks = subscribeMapEditLocks(() => refreshPanels());
  unsubUiMode = subscribeEditorUiMode(() => {
    applyEditorUiModeLayout();
    if (!getEditorChrome().coachMarks || !getEditorChrome().standardWelcome) dismissCoachMarks();
  });
  installSelectionChipHint();
  installToolCursor();
  maybeStartBasicCoachMarks();
  maybeStartStandardWelcomeCard();
  startAiConnectionPolling();
}

export function applyEditorUiModeLayout(): void {
  const game = getGame();
  const scene = game?.scene?.getScene("EditScene") as
    | { cameras?: { main?: { scrollX: number; scrollY: number; width: number; height: number; setScroll: (x: number, y: number) => unknown; setBounds: (x: number, y: number, w: number, h: number) => unknown } } }
    | undefined;
  const cam = scene?.cameras?.main;
  const savedCenter = cam
    ? { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2 }
    : null;
  if (cam && savedCenter) {
    cam.setBounds(savedCenter.x - 10000, savedCenter.y - 10000, 20000, 20000);
  }

  const chrome = getEditorChrome();
  applyEditorUiModeClasses(getEditorUiMode());

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
  if (leftPaletteRoot && leftMapRoot && canvasToolbarRoot && statusBarRoot) {
    renderTilePalette(leftPaletteRoot);
    if (chrome.mapTree) renderMapList(leftMapRoot);
    else clearChildren(leftMapRoot);
    renderCanvasToolbar(canvasToolbarRoot);
    refreshStatusbar();
  }
  applyLayout();
  scheduleFitCanvas();

  if (cam && savedCenter) {
    const reapply = () => {
      const w = cam.width;
      const h = cam.height;
      cam.setBounds(savedCenter.x - w, savedCenter.y - h, w * 2, h * 2);
      cam.setScroll(savedCenter.x - w / 2, savedCenter.y - h / 2);
    };
    let stableFrames = 0;
    let lastW = cam.width;
    let lastH = cam.height;
    const poll = () => {
      reapply();
      if (cam.width === lastW && cam.height === lastH) {
        stableFrames++;
      } else {
        stableFrames = 0;
        lastW = cam.width;
        lastH = cam.height;
      }
      if (stableFrames < 5) {
        requestAnimationFrame(poll);
      }
    };
    requestAnimationFrame(poll);
  }
}

export function teardownEditor(): void {
  teardownAiChatPanel();
  registerAiBootIntentTarget(null);
  clearPendingAiBootIntent();
  stopAiConnectionPolling();
  cleanupProjectE2EBridge();

  unsubStore?.();
  unsubAutoSave?.();
  unsubEditor?.();
  unsubMapLocks?.();
  unsubUiMode?.();
  unsubLayoutBbox?.();
  unsubStore = null;
  unsubAutoSave = null;
  unsubEditor = null;
  unsubMapLocks = null;
  unsubUiMode = null;
  unsubLayoutBbox = null;
  const ro2 = (window as unknown as Record<string, unknown>)["__rpgzzuLayoutRO"] as ResizeObserver | undefined;
  ro2?.disconnect?.();
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
  document.body.classList.remove("ai-chat-dock-float", "ai-chat-dock-glass", "ai-chat-dock-side", "editor-ui-beginner", "editor-ui-standard", "editor-ui-expert");
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

/** AI 연동 칩 폴링 — 부팅 시 1회 즉시 조회하고 이후 주기적으로 캐시를 갱신한다. */
function startAiConnectionPolling(): void {
  stopAiConnectionPolling();
  // 부팅 시 1회: 예전 설정에 남아 있던 평문 API 키와 죽은 게이트웨이 주소를 지운다.
  // loadAiConfig 는 그 값들을 이미 무시하지만 디스크에는 남아 있어서, 인증 패널이 하는
  // "브라우저에는 두지 않습니다" 약속이 과거 키에는 적용되지 않는 상태였다.
  const scrub = scrubStoredAiCredentials();
  if (scrub.hadApiKey) {
    toast("보안을 위해 브라우저에 저장돼 있던 API 키를 지웠습니다. 필요하면 AI 설정에서 다시 연결해 주세요.", "ok");
  }
  void refreshAiConnectionStatus(refreshStatusbar);
  aiConnectionPollTimer = setInterval(() => {
    void refreshAiConnectionStatus(refreshStatusbar);
  }, AI_CONNECTION_POLL_MS);
  // 실제 LLM 요청 성패가 바뀌면 즉시 칩을 다시 그린다(폴링 대기 없이).
  // "AI 연결됨"인데 404 나던 거짓말 수정(적대 평가 P0) — llmClient 가 이벤트를 쏜다.
  if (typeof window !== "undefined") {
    window.removeEventListener(AI_TRANSPORT_HEALTH_EVENT, refreshStatusbar);
    window.addEventListener(AI_TRANSPORT_HEALTH_EVENT, refreshStatusbar);
  }
}

function stopAiConnectionPolling(): void {
  if (aiConnectionPollTimer === null) return;
  clearInterval(aiConnectionPollTimer);
  aiConnectionPollTimer = null;
}

export function isLeftCollapsed(): boolean {
  return leftCollapsed;
}

export function toggleChatDock(): void {
  chatDock = cycleChatDock(chatDock);
  applyChatDockLayout();
  applyLayout();
  saveEditorLayout();
  scheduleFitCanvas();
}

function layoutDockClass(dock: ChatDock): string {
  if (dock === "side") return "chat-dock-side";
  if (dock === "glass") return "chat-dock-glass";
  return "chat-dock-float";
}

function applyChatDockLayout(): void {
  if (!chatFloatRoot || !chatSideRoot || !aiChatPanelRoot) return;
  editorState.set({ chatDock });
  const layoutEl = chatFloatRoot.parentElement?.parentElement ?? null;
  layoutEl?.classList.toggle("chat-dock-side", chatDock === "side");
  layoutEl?.classList.toggle("chat-dock-float", chatDock === "float");
  layoutEl?.classList.toggle("chat-dock-glass", chatDock === "glass");
  aiChatPanelRoot.classList.toggle("chat-dock-side", chatDock === "side");
  aiChatPanelRoot.classList.toggle("chat-dock-float", chatDock === "float");
  aiChatPanelRoot.classList.toggle("chat-dock-glass", chatDock === "glass");
  // side flex 도크는 is-docked(fixed 오버레이)와 섞지 않는다 — body inset 이중 적용/흔들림 방지.
  if (chatDock === "side") {
    aiChatPanelRoot.classList.remove("is-docked");
    document.body.classList.remove("ai-panel-docked");
  } else if (aiChatPanelRoot.classList.contains("is-history-open")) {
    aiChatPanelRoot.classList.add("is-docked");
  }
  document.body.classList.toggle("ai-chat-dock-side", chatDock === "side");
  document.body.classList.toggle("ai-chat-dock-float", chatDock === "float");
  document.body.classList.toggle("ai-chat-dock-glass", chatDock === "glass");
  const target = chatDock === "side" ? chatSideRoot : chatFloatRoot;
  if (aiChatPanelRoot.parentElement !== target) {
    aiChatPanelRoot.remove();
    target.append(aiChatPanelRoot);
  }
}

// 저장 스킵/로컬 저장 모드 배너: 임시 URL 모드 등에서
// 저장이 조용히 스킵되어 세션 작업물이 통째로 증발하던 문제 — 모드를 화면에 명시한다.
// 임시 세션 배너는 오류가 아니라 정보 — 인라인 '내보내기' + 닫기(세션 동안 유지)를 제공한다.
let persistenceBannerDismissed = false;

function renderPersistenceModeBanner(): HTMLElement | null {
  const status = store.getDbPersistenceStatus();
  if (status.kind !== "disabled") return null;
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
    text: "복구 모드 — 온라인 저장을 잠시 사용할 수 없습니다. 상태바의 '온라인 저장'에서 다시 연결하거나 '내보내기'로 백업하세요.",
  });
}

export function persistenceModeBannerText(reason: string, saveSkipped: boolean): string {
  if (reason === "dev-showcase" && saveSkipped) {
    return "임시 세션 — 작업이 이 탭에만 있습니다. 보존하려면 내보내기를 누르세요.";
  }
  if (reason === "dev-showcase") return "개발 모드 — 이 브라우저에만 저장됩니다.";
  return "복구 모드 — 온라인 저장을 잠시 사용할 수 없습니다. 상태바의 '온라인 저장'에서 다시 연결하거나 '내보내기'로 백업하세요.";
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
  const chrome = getEditorChrome();
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

  if (chrome.paletteRail) {
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
  const preferredLeftWidth = chrome.leftPanelMaxWidthPx ? Math.min(leftWidth, chrome.leftPanelMaxWidthPx) : leftWidth;
  const effectiveLeftWidth = Math.min(preferredLeftWidth, maxLeftForCanvas);
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
      text: `${lockOwnerPhrase(status.ownerLabel)} · ${mapEditLockLastActivityText(status)}`,
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
  if (state.tool === "event" && state.layer === "event") {
    cells.push(
      el("button", {
        class: "editor-statusbar-cell editor-statusbar-hint",
        text: "타일 칠하려면: 바닥/장식으로 전환",
        attrs: { type: "button", title: "브러시로 전환해 타일을 칠합니다" },
        dataset: { testid: "paint-hint-switch" },
        on: { click: () => editorState.set({ tool: "paint", layer: "lower" }) },
      })
    );
  }
  // "확보/확인 전"은 소음 — 잠김·확인 중·장애일 때만 표시.
  if (shouldShowMapEditLockStatus(lockStatus, mapId)) {
    cells.push(renderMapEditLockStatus(lockStatus, mapId));
  }
  cells.push(renderDbConnectionStatus(store.getDbPersistenceStatus(), refreshStatusbar));
  // AI 연동 칩 — DB 칩과 동일 패턴. 영역 작업·AI 채팅이 LLM 인증에 의존하므로 상태를 항상 노출한다.
  cells.push(
    el("button", {
      class: "editor-statusbar-cell" + (state.showLayoutBboxes ? " active" : ""),
      text: state.showLayoutBboxes ? "설계도 숨기기" : "설계도 보기",
      attrs: { type: "button", title: "맵 bbox 설계도(P/M/H) 오버레이" },
      dataset: { testid: "toggle-layout-bboxes" },
      on: { click: () => toggleLayoutBboxes() },
    })
  );
  cells.push(renderAiConnectionStatus(refreshStatusbar));
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
      message: `${lockOwnerPhrase(status.ownerLabel)}이고 최근까지 활동했습니다. 편집 권한을 가져올까요? (상대 세션은 읽기 전용이 됩니다)`,
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
      return `${status.mapName} 맵은 지금 ${lockOwnerPhrase(status.ownerLabel)}입니다. ${mapEditLockLastActivityText(status)}.`;
    case "unavailable":
      return `${status.mapName} 잠금 확인 실패: ${status.message}. 편집은 허용하지만 수동 저장 충돌 검사는 유지됩니다.`;
  }
}

function layerStatusLabel(layer: Layer): string {
  const plain = getEditorChrome().layerTermStyle === "plain";
  switch (layer) {
    case "lower":
      return plain ? "바닥 레이어" : "하위 레이어";
    case "upper":
      return plain ? "장식 레이어" : "상위 레이어";
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
  leftResizer.addEventListener("keydown", (event: KeyboardEvent) => {
    const step = event.shiftKey ? 40 : 16;
    if (event.key === "ArrowLeft") { leftWidth = Math.max(LEFT_PANEL_MIN_WIDTH, leftWidth - step); applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "ArrowRight") { leftWidth = Math.min(LEFT_PANEL_MAX_WIDTH, leftWidth + step); applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "Home") { leftWidth = LEFT_PANEL_MAX_WIDTH; applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "End") { leftWidth = LEFT_PANEL_MIN_WIDTH; applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
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
  mapTreeResizer.addEventListener("keydown", (event: KeyboardEvent) => {
    const step = event.shiftKey ? 32 : 12;
    if (event.key === "ArrowUp") { mapTreeHeight = clamp(mapTreeHeight + step, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT); applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "ArrowDown") { mapTreeHeight = clamp(mapTreeHeight - step, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT); applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "Home") { mapTreeHeight = MAP_TREE_MAX_HEIGHT; applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
    else if (event.key === "End") { mapTreeHeight = MAP_TREE_MIN_HEIGHT; applyLayout(); scheduleFitCanvas(); saveEditorLayout(); event.preventDefault(); }
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
    const storedVersion = ls.getItem("rpg-zzu:editor-layout-version");
    if (storedVersion !== LAYOUT_CACHE_VERSION) {
      for (const k of ["rpg-zzu:editor-layout", "rpg-zzu:editor-layout:v2", "rpg-zzu:editor-layout:v3", "rpg-zzu:editor-layout:v4"]) {
        ls.removeItem(k);
      }
      ls.setItem("rpg-zzu:editor-layout-version", LAYOUT_CACHE_VERSION);
    }
  }
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
      chatDock: parseChatDock(parsed.chatDock, fallback.chatDock),
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
    chatDock: "glass",
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
