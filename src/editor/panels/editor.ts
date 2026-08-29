import { destroyGame, getGame, startEditGame } from "@/app/mode";
import { editorState } from "@/editor/editorState";
import { registerAiBootIntentTarget, clearPendingAiBootIntent } from "@/editor/aiBootIntent";
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
import { installLayoutBboxOverlay } from "@/editor/layoutBboxOverlay";
import { getMapEditHistoryState } from "@/editor/mapEditHistory";
import { bindMapSurfaceFocusHandoff } from "@/editor/mapSurfaceFocus";
import { installEditorToolHook } from "@/editor/editorToolHook";
import { cleanupProjectE2EBridge } from "@/editor/editorToolHook";
import { selectEditorMap } from "@/editor/mapSelection";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
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
import type { PanelId } from "@/editor/workspace/panelRegistry";
import { getWorkspaceLayout, subscribeWorkspace } from "@/editor/workspace/workspaceStore";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { isSaveSkippedLocation } from "@/project/devProjectPersistence";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import {
  AUTHORING_TEST_BOOT_SUCCESS_EVENT,
  AUTHORING_TEST_GATE_BLOCKED_EVENT,
  authoringProjectFingerprint,
  evaluateAuthoringTestGate,
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
const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";

type LoadedEditorLayout = {
  readonly leftWidth: number;
  readonly mapTreeHeight: number;
  readonly leftCollapsed: boolean;
  readonly leftCollapsedStored: boolean;
};

const initialLayout = loadEditorLayout();
let leftWidth = initialLayout.leftWidth;
let leftCollapsed = initialLayout.leftCollapsed;
let leftRoot: HTMLElement | null = null;
let leftMapRoot: HTMLElement | null = null;
let leftResizer: HTMLElement | null = null;
let mapTreeResizer: HTMLElement | null = null;
let phaserHost: HTMLElement | null = null;
let canvasToolbarRoot: HTMLElement | null = null;
let mapLockBannerRoot: HTMLElement | null = null;
let authoringJourneyRoot: HTMLElement | null = null;
let authoringJourneyOpen = false;
let authoringJourneyReferenceIssues: readonly string[] | null = null;
let projectExportNode: HTMLElement | null = null;
let unsubStore: (() => void) | null = null;
let unsubEditor: (() => void) | null = null;
let unsubMapLocks: (() => void) | null = null;
let mapTreeHeight = initialLayout.mapTreeHeight;
let unsubUiMode: (() => void) | null = null;
let unsubLayoutBbox: (() => void) | null = null;
let unsubWorkspace: (() => void) | null = null;
// 좌측 도크 마운트 — 패널 호스트를 레이아웃 데이터에서 만든 결과. 구성이 바뀔 때만 다시 짓는다.
let leftDock: DockMount | null = null;

export function renderEditor(main: HTMLElement): void {
  clearChildren(main);
  installEditorToolHook(); // 헤드리스(Playwright) 에디터 조작용 window.__oprnEditorTool.
  applyEditorUiModeClasses(getEditorUiMode());

  // 도크 모드 클래스는 없다 (2026-08-29). 조수는 캔버스 안 우하단에 부유하는 단일 띠이며
  // 레이아웃 열을 차지하지 않으므로, 첫 페인트에 폭을 예약할 것이 없다.
  const layout = el("div", {
    class: "editor-layout",
    dataset: { testid: "editor-layout" },
  });
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
    class: "ai-chat-float-host",
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
  const persistenceBanner = renderPersistenceModeBanner();
  if (persistenceBanner) canvasArea.append(persistenceBanner);
  canvasArea.append(canvasScrollShell, mapLockBanner, canvasToolbar, authoringJourney, cursorDiagnostics, chatFloatHost);
  // 조수는 `canvasArea` 안 `chatFloatHost` 에만 산다. 예전에는 `chatSidePanel` 이 layout 의
  // flex 형제로 붙어 있어서 사이드 도크가 캔버스를 밀어냈고(줌/스크롤 튐), 도크를 바꿀 때마다
  // 패널 노드를 두 호스트 사이로 재부모화했다. 호스트가 하나면 그 이동 자체가 없다.
  const aiPanel = renderAiChatPanel();
  chatFloatHost.append(aiPanel);
  layout.append(left, leftResizer, canvasArea);
  main.append(layout, projectExportNodeElement());

  leftRoot = left;
  phaserHost = phaserContainer;
  canvasToolbarRoot = canvasToolbar;
  mapLockBannerRoot = mapLockBanner;
  authoringJourneyRoot = authoringJourney;

  applyLayout();
  applyEditorUiModeLayout();
  refreshPanels();
  ensureCurrentMapLock();
  bindLeftResizer();
  // 맵 트리 리사이저는 도크가 만들 때(mountLeftDock) 함께 묶인다 — 재마운트마다 새 노드다.
  // (구 사이드 폭 ResizeObserver 삭제 — 조수가 열을 차지하지 않으므로 재계산할 폭이 없다.)
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("oprn:test-play-window", onTestPlayWindowRequest);
  window.addEventListener(AUTHORING_TEST_BOOT_SUCCESS_EVENT, onAuthoringTestBootSuccess);
  window.addEventListener(AUTHORING_TEST_GATE_BLOCKED_EVENT, onAuthoringTestGateBlocked);
  bindMapSurfaceFocusHandoff(phaserContainer);
  void startEditGame(phaserContainer).then(() => scheduleFitCanvas());
  unsubLayoutBbox = installLayoutBboxOverlay();

  unsubStore = store.subscribe((_project, change) => refreshPanels(change));
  unsubEditor = editorState.subscribe(() => refreshPanels());
  unsubMapLocks = subscribeMapEditLocks(() => refreshPanels());
  unsubUiMode = subscribeEditorUiMode(() => {
    syncLeftDock();
    applyEditorUiModeLayout();
    if (!getEditorChrome().coachMarks || !getEditorChrome().standardWelcome) dismissCoachMarks();
  });
  // 패널 이동·열기/닫기(프리셋 전환 포함)는 도크를 다시 짓는다. syncLeftDock 은 멱등이라
  // 프리셋 전환처럼 uiMode 구독자와 겹쳐 두 번 불려도 한 번만 조립한다.
  unsubWorkspace = subscribeWorkspace(() => syncLeftDock());
  installSelectionChipHint();
  installToolCursor();
  maybeStartBasicCoachMarks();
  maybeStartStandardWelcomeCard();
}

/** 조수는 `canvasArea` 안 `chatFloatHost` 에 산다 — 좌측 도크가 만들지 않는다. */
const LEFT_DOCK_EXTERNAL: readonly PanelId[] = ["assistant"];

function leftDockPanels(): readonly PanelId[] {
  const fromLayout = getWorkspaceLayout().docks.left.filter((id) => !LEFT_DOCK_EXTERNAL.includes(id));
  const extras = fromLayout.filter((id) => id !== "tiles" && id !== "maps");
  return ["tiles", "maps", ...extras];
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
  leftDock = mountDock({
    container,
    zone: "left",
    panels: leftDockPanels(),
    makeSplitter: () => makeMapTreeResizer(),
  });
  leftMapRoot = leftDock.hosts.get("maps") ?? null;
  mapTreeResizer = leftDock.splitters[0] ?? null;
  bindMapTreeResizer();
}

function makeMapTreeResizer(): HTMLElement {
  return el("div", {
    class: "resizer resizer-map-tree",
    attrs: {
      "aria-label": "맵 트리 높이 조절",
      role: "separator",
      title: "드래그로 맵 트리 높이 조절",
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
 * 좌측 도크 패널 렌더. 맵 패널은 아직 `chrome.mapTree` 밀도 게이트를 따른다 —
 * 도크 구성(사용자 선택)과 밀도 게이팅(모드 파생)을 합치는 일은 CSS 게이트 38곳을
 * 같이 고쳐야 하므로 다음 라운드다.
 */
function renderLeftDockPanels(): void {
  if (!leftDock) return;
  const mapTreeAllowed = getEditorChrome().mapTree;
  const ids = [...leftDock.hosts.keys()].filter((id) => id !== "maps" || mapTreeAllowed);
  renderDockPanels(leftDock, ids);
  if (!mapTreeAllowed && leftMapRoot) clearChildren(leftMapRoot);
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
  // 좌측 도크는 비어 있을 수 있다(「자료 밸런싱」 프리셋) — 팔레트 호스트 존재를 전제하지 않는다.
  if (canvasToolbarRoot) {
    renderLeftDockPanels();
    renderCanvasToolbar(canvasToolbarRoot);
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
  cleanupProjectE2EBridge();

  unsubStore?.();
  unsubEditor?.();
  unsubMapLocks?.();
  unsubUiMode?.();
  unsubLayoutBbox?.();
  unsubWorkspace?.();
  unsubStore = null;
  unsubEditor = null;
  unsubMapLocks = null;
  unsubUiMode = null;
  unsubLayoutBbox = null;
  unsubWorkspace = null;
  leftDock = null;
  const ro2 = (window as unknown as Record<string, unknown>)["__oprnLayoutRO"] as ResizeObserver | undefined;
  ro2?.disconnect?.();
  window.removeEventListener("resize", onWindowResize);
  window.removeEventListener("oprn:test-play-window", onTestPlayWindowRequest);
  window.removeEventListener(AUTHORING_TEST_BOOT_SUCCESS_EVENT, onAuthoringTestBootSuccess);
  window.removeEventListener(AUTHORING_TEST_GATE_BLOCKED_EVENT, onAuthoringTestGateBlocked);
  closeTestPlayModal();
  destroyGame();
  leftRoot = null;
  leftMapRoot = null;
  leftResizer = null;
  mapTreeResizer = null;
  phaserHost = null;
  canvasToolbarRoot = null;
  mapLockBannerRoot = null;
  authoringJourneyRoot = null;
  authoringJourneyOpen = false;
  authoringJourneyReferenceIssues = null;
  projectExportNode = null;
  document.body.classList.remove("editor-ui-beginner", "editor-ui-standard", "editor-ui-expert");
}

export function toggleLeftPanel(): void {
  leftCollapsed = !leftCollapsed;
  applyLayout();
  saveEditorLayout();
  scheduleFitCanvas();
}


export function isLeftCollapsed(): boolean {
  return leftCollapsed;
}

// (구 toggleChatDock · setChatDock · setAssistantTemperature · layoutDockClass ·
//  applyChatDockLayout 삭제 — 도크 3종과 대기 화면 선택기를 폐기했다. 2026-08-29.
//  조수 위치를 바꾸는 API 가 없으므로 커맨드 팔레트 4개와 작업공간 바 3개 진입점도 함께 걷혔다.)

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
}

function applyLayout(): void {
  if (!leftRoot || !leftResizer) return;
  const chrome = getEditorChrome();
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
  // 조수가 열을 차지하지 않으므로 캔버스 예산에서 뺄 사이드 폭이 없다(구 sideWidth 삭제).

  // 좌측 사이드바(타일+맵 트리)는 편집 모드에서 항상 보인다. 프리셋·접힘 토글·좁은
  // 뷰포트가 열을 display:none 으로 지울 수 없다.
  if (chrome.paletteRail) {
    leftRoot.style.display = "";
    leftRoot.style.width = "48px";
    leftResizer.style.display = "none";
    setEditorLeftSafe("60px");
    return;
  }
  leftRoot.style.display = "";
  // 실제 사용 가능한 폭 = 레이아웃 콘텐츠폭 − 좌우 패딩. 캔버스 최소폭을 먼저 확보한 뒤 좌패널 상한을 잡는다.
  const maxLeftForCanvas = Math.max(LEFT_PANEL_MIN_WIDTH, usableWidth - MIN_CANVAS_WIDTH - resizerWidth);
  const preferredLeftWidth = chrome.leftPanelMaxWidthPx ? Math.min(leftWidth, chrome.leftPanelMaxWidthPx) : leftWidth;
  const effectiveLeftWidth = Math.min(preferredLeftWidth, maxLeftForCanvas);
  leftRoot.style.width = `${effectiveLeftWidth}px`;
  leftRoot.style.setProperty("--map-tree-height", `${mapTreeHeight}px`);
  leftResizer.style.display = "";
  // AI 미니 스트림/제안 오버레이가 좌패널을 덮지 않도록 실제 패널 폭을 전역 변수로 발행.
  setEditorLeftSafe(`${effectiveLeftWidth + resizerWidth}px`);
}

// fakeDom(단위 테스트)에는 documentElement가 없으므로 옵셔널 체이닝으로 가드.
function setEditorLeftSafe(px: string): void {
  document.documentElement?.style?.setProperty?.("--editor-left-safe", px);
}

function refreshPanels(change?: ProjectChangeDescriptor): void {
  refreshAuthoringJourney(change);
  // 좌측 패널 호스트는 프리셋에 따라 없을 수 있다 — 캔버스 크롬만 있으면 갱신을 진행한다.
  if (!canvasToolbarRoot || !mapLockBannerRoot) return;
  if (change?.scope === "map" && change.cells?.length) {
    renderCanvasToolbar(canvasToolbarRoot);
    renderMapEditLockBanner(mapLockBannerRoot);
    updateProjectExport();
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
  updateProjectExport();
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
    authoringJourneyReferenceIssues = evaluateAuthoringTestGate(project).referenceIssues;
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
  const gate = evaluateAuthoringTestGate(project);
  authoringJourneyReferenceIssues = gate.referenceIssues;
  const scope = authoringJourneyScope();
  const progress = loadAuthoringJourneyProgress(scope);
  const next = recordSuccessfulTestBoot(
    progress,
    projectFingerprint,
    authoringProjectFingerprint(project),
    gate.referenceIssues,
  );
  if (next !== progress) saveAuthoringJourneyProgress(scope, next);
  refreshAuthoringJourney();
}

function onAuthoringTestGateBlocked(): void {
  authoringJourneyReferenceIssues = evaluateAuthoringTestGate(store.getCurrent()).referenceIssues;
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

// leftRoot 를 전제하지 않는다 — mountLeftDock 은 renderEditor 가 leftRoot 를 대입하기
// **전에** 불린다(도크가 좌패널의 자식을 만드는 쪽이므로 순서가 그렇다). 본문도 leftRoot 를
// 쓰지 않는다.
function bindMapTreeResizer(): void {
  if (!mapTreeResizer) return;
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
    const leftCollapsedStored = typeof parsed.leftCollapsed === "boolean";
    return {
      leftWidth: typeof parsed.leftWidth === "number" ? clamp(parsed.leftWidth, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH) : fallback.leftWidth,
      mapTreeHeight:
        typeof parsed.mapTreeHeight === "number" ? clamp(parsed.mapTreeHeight, MAP_TREE_MIN_HEIGHT, MAP_TREE_MAX_HEIGHT) : fallback.mapTreeHeight,
      leftCollapsed: leftCollapsedStored ? parsed.leftCollapsed === true : fallback.leftCollapsed,
      leftCollapsedStored,
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
  };
}

function saveEditorLayout(): void {
  browserLocalStorage()?.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({
    leftWidth,
    mapTreeHeight,
    leftCollapsed,
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
