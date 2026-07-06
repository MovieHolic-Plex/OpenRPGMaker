import { destroyGame, getGame, startEditGame } from "@/app/mode";
import { editorState, type Layer } from "@/editor/editorState";
import { ensureCurrentMapLock, getMapEditLockStatus, subscribeMapEditLocks, takeoverMapLock, type MapEditLockStatus } from "@/editor/mapEditLocks";
import { getMapEditHistoryState } from "@/editor/mapEditHistory";
import { installEditorToolHook } from "@/editor/editorToolHook";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { renderMapList } from "@/editor/panels/mapList";
import { closeTestPlayModal, openTestPlayModal } from "@/editor/panels/testPlayModal";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { isSaveSkippedLocation } from "@/project/devProjectPersistence";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

const LEFT_PANEL_DEFAULT_WIDTH = 526;
const LEFT_PANEL_MIN_WIDTH = 184;
const LEFT_PANEL_MAX_WIDTH = 640;
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
let statusBarRoot: HTMLElement | null = null;
let projectExportNode: HTMLElement | null = null;
let unsubStore: (() => void) | null = null;
let unsubAutoSave: (() => void) | null = null;
let unsubEditor: (() => void) | null = null;
let unsubMapLocks: (() => void) | null = null;
let mapTreeHeight = initialLayout.mapTreeHeight;

export function renderEditor(main: HTMLElement): void {
  clearChildren(main);
  installEditorToolHook(); // 헤드리스(Playwright) 에디터 조작용 window.__rpgzzuEditorTool.

  const layout = el("div", { class: "editor-layout" });
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
  const statusBar = el("div", {
    class: "editor-statusbar",
    dataset: { testid: "editor-statusbar" },
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
    dataset: { testid: "map-tree-height-resizer" },
  });
  leftMapRoot = el("div", { class: "left-panel-stack", dataset: { testid: "left-map-root" } });
  left.append(leftPaletteRoot, mapTreeResizer, leftMapRoot);
  canvasScrollShell.append(phaserContainer);
  // 저장 모드 배너(결함 ⑩)는 캔버스 열 상단에 넣는다 — .main(flex row)의 형제로 넣으면
  // 좌측 열처럼 배치되어 레이아웃이 깨진다.
  const persistenceBanner = renderPersistenceModeBanner();
  if (persistenceBanner) canvasArea.append(persistenceBanner);
  canvasArea.append(canvasScrollShell, canvasToolbar, statusBar);
  layout.append(left, leftResizer, canvasArea);
  main.append(layout, projectExportNodeElement(), renderAiChatPanel());

  leftRoot = left;
  phaserHost = phaserContainer;
  canvasToolbarRoot = canvasToolbar;
  statusBarRoot = statusBar;

  applyLayout();
  refreshPanels();
  ensureCurrentMapLock();
  bindLeftResizer();
  bindMapTreeResizer();
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("rpgzzu:test-play-window", onTestPlayWindowRequest);
  void startEditGame(phaserContainer).then(() => fitCanvas());

  unsubStore = store.subscribe((_project, change) => refreshPanels(change));
  unsubAutoSave = store.subscribeAutoSave(() => refreshStatusbar());
  unsubEditor = editorState.subscribe(() => refreshPanels());
  unsubMapLocks = subscribeMapEditLocks(() => refreshPanels());
}

export function teardownEditor(): void {
  unsubStore?.();
  unsubAutoSave?.();
  unsubEditor?.();
  unsubMapLocks?.();
  unsubStore = null;
  unsubAutoSave = null;
  unsubEditor = null;
  unsubMapLocks = null;
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
  statusBarRoot = null;
  projectExportNode = null;
}

export function toggleLeftPanel(): void {
  leftCollapsed = !leftCollapsed;
  leftUserOverride = true;
  applyLayout();
  saveEditorLayout();
  fitCanvas();
}

function refreshStatusbar(): void {
  if (!statusBarRoot) return;
  renderEditorStatusbar(statusBarRoot);
}

export function isLeftCollapsed(): boolean {
  return leftCollapsed;
}

// 저장 스킵/로컬 저장 모드 배너(도그푸딩 결함 ⑩): blankProject/freshProject 등에서
// 저장이 조용히 스킵되어 세션 작업물이 통째로 증발하던 문제 — 모드를 화면에 명시한다.
function renderPersistenceModeBanner(): HTMLElement | null {
  const status = store.getDbPersistenceStatus();
  if (status.kind !== "disabled") return null;
  if (status.reason === "dev-showcase") {
    const saveSkipped = isSaveSkippedLocation();
    return el("div", {
      class: `persistence-mode-banner ${saveSkipped ? "is-save-skipped" : "is-local-only"}`,
      dataset: { testid: "save-skip-banner" },
      text: saveSkipped
        ? "⚠ 이 모드(blankProject/freshProject)에서는 저장되지 않습니다 — 새로고침하면 작업물이 사라집니다. 보존하려면 '내보내기'를 사용하세요."
        : "개발 모드 — 원격 DB 대신 이 브라우저에만 저장됩니다.",
    });
  }
  // load-failed(복구 모드): 원격 저장이 꺼진 채 편집 중임을 알린다.
  return el("div", {
    class: "persistence-mode-banner is-recovery",
    dataset: { testid: "save-skip-banner" },
    text: "복구 모드 — 원격 DB 저장이 꺼져 있습니다. 상태바의 'DB 연동'에서 다시 연결하거나 '내보내기'로 백업하세요.",
  });
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
  fitCanvas();
}

function applyLayout(): void {
  if (!leftRoot || !leftResizer) return;
  const autoCollapse = window.innerWidth < RESPONSIVE_BREAKPOINT;
  const leftFolded = leftUserOverride ? leftCollapsed : autoCollapse;
  if (leftFolded) {
    leftRoot.style.display = "none";
    leftResizer.style.display = "none";
    return;
  }
  leftRoot.style.display = "";
  const effectiveLeftWidth = Math.min(leftWidth, Math.max(LEFT_PANEL_MIN_WIDTH, window.innerWidth - 420));
  leftRoot.style.width = `${effectiveLeftWidth}px`;
  leftRoot.style.setProperty("--map-tree-height", `${mapTreeHeight}px`);
  leftResizer.style.display = "";
}

function refreshPanels(change?: ProjectChangeDescriptor): void {
  if (!leftPaletteRoot || !leftMapRoot || !canvasToolbarRoot || !statusBarRoot) return;
  if (change?.scope === "map" && change.cells?.length) {
    renderCanvasToolbar(canvasToolbarRoot);
    renderEditorStatusbar(statusBarRoot);
    updateProjectExport();
    return;
  }
  if (change?.scope === "database" || change?.scope === "system") {
    renderEditorStatusbar(statusBarRoot);
    updateProjectExport();
    return;
  }
  renderTilePalette(leftPaletteRoot);
  renderMapList(leftMapRoot);
  renderCanvasToolbar(canvasToolbarRoot);
  renderEditorStatusbar(statusBarRoot);
  updateProjectExport();
  fitCanvas();
}

function renderEditorStatusbar(container: HTMLElement): void {
  clearChildren(container);
  const project = store.getCurrent();
  const state = editorState.get();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  container.append(
    el("span", { class: "editor-statusbar-cell strong", text: `${layerStatusLabel(state.layer)} 편집 모드` }),
    el("span", { class: "editor-statusbar-cell", text: `맵: ${map?.name ?? mapId}` }),
    el("span", { class: "editor-statusbar-cell", text: `타일: ${tileDisplayLabelForIndex(state.selectedTile)}` }),
    el("span", { class: "editor-statusbar-cell", text: `도구: ${toolStatusLabel(state.tool)}` }),
    el("span", { class: "editor-statusbar-cell", text: `줌: ${state.zoom}x` }),
    renderMapEditLockStatus(getMapEditLockStatus(), mapId),
    renderDbConnectionStatus(store.getDbPersistenceStatus(), refreshStatusbar)
  );
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
        text: "가져오기",
        attrs: { type: "button", title: "맵 편집 권한 가져오기" },
        dataset: { testid: "map-lock-takeover" },
        on: {
          click: (event) => {
            event.stopPropagation();
            const confirmed = window.confirm(
              `${status.ownerLabel} 세션이 편집 중입니다. 편집 권한을 강제로 가져올까요? (상대 세션은 읽기 전용이 됩니다)`,
            );
            if (!confirmed) return;
            void takeoverMapLock(status.mapId, status.mapName).then(() => refreshPanels());
          },
        },
      }),
    );
  }
  return cell;
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
      return `${status.mapName} 맵은 ${status.ownerLabel} 세션이 편집 중입니다.`;
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

function onTestPlayWindowRequest(): void {
  void openTestPlayModal();
}

function updateProjectExport(): void {
  if (!projectExportNode) return;
  projectExportNode.textContent = JSON.stringify({
    project: projectWithoutEventDrafts(store.getCurrent()),
    editor: editorState.get(),
    history: getMapEditHistoryState(),
  });
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
      fitCanvas();
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
      fitCanvas();
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

function fitCanvas(): void {
  if (!phaserHost) return;
  const game = getGame();
  if (!game) return;
  const rect = phaserHost.getBoundingClientRect();
  game.scale.resize(Math.max(200, Math.floor(rect.width)), Math.max(200, Math.floor(rect.height)));
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
  browserLocalStorage()?.setItem(EDITOR_LAYOUT_KEY, JSON.stringify({ leftWidth, mapTreeHeight, leftCollapsed }));
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
