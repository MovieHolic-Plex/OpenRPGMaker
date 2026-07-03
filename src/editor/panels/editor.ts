import { destroyGame, getGame, startEditGame } from "@/app/mode";
import { editorState, type Layer } from "@/editor/editorState";
import { ensureCurrentMapLock, getMapEditLockStatus, subscribeMapEditLocks, type MapEditLockStatus } from "@/editor/mapEditLocks";
import { getMapEditHistoryState } from "@/editor/mapEditHistory";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { renderMapList } from "@/editor/panels/mapList";
import { closeTestPlayModal, openSelectedEventTestModal, openTestPlayModal } from "@/editor/panels/testPlayModal";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

const LEFT_PANEL_DEFAULT_WIDTH = 526;
const LEFT_PANEL_MIN_WIDTH = 184;
const LEFT_PANEL_MAX_WIDTH = 640;
const RESPONSIVE_BREAKPOINT = 720;

let leftWidth = LEFT_PANEL_DEFAULT_WIDTH;
let leftCollapsed = false;
let leftUserOverride = false;
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
let unsubEditor: (() => void) | null = null;
let unsubMapLocks: (() => void) | null = null;
let mapTreeHeight = 154;

export function renderEditor(main: HTMLElement): void {
  clearChildren(main);

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
  canvasArea.append(canvasScrollShell, canvasToolbar, statusBar);
  layout.append(left, leftResizer, canvasArea);
  main.append(layout, projectExportNodeElement());

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

  unsubStore = store.subscribe(() => refreshPanels());
  unsubEditor = editorState.subscribe(() => refreshPanels());
  unsubMapLocks = subscribeMapEditLocks(() => refreshPanels());
}

export function teardownEditor(): void {
  unsubStore?.();
  unsubEditor?.();
  unsubMapLocks?.();
  unsubStore = null;
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
  fitCanvas();
}

export function isLeftCollapsed(): boolean {
  return leftCollapsed;
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

function refreshPanels(): void {
  if (!leftPaletteRoot || !leftMapRoot || !canvasToolbarRoot || !statusBarRoot) return;
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
    renderDbConnectionStatus(store.getDbPersistenceStatus(), refreshPanels)
  );
}

function renderMapEditLockStatus(status: MapEditLockStatus, mapId: string): HTMLElement {
  const className = status.kind !== "idle" && status.mapId === mapId ? status.kind : "idle";
  return el("span", {
    class: `editor-statusbar-cell map-edit-lock-status ${className}`,
    text: mapEditLockStatusText(status, mapId),
    attrs: { title: mapEditLockStatusTitle(status, mapId) },
    dataset: { testid: "map-edit-lock-status" },
  });
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
      mapTreeHeight = Math.max(112, Math.min(260, nextHeight));
      applyLayout();
      fitCanvas();
    };
    const onUp = (): void => {
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("resizing");
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
