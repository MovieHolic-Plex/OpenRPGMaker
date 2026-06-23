import { destroyGame, getGame, startEditGame } from "@/app/mode";
import { editorState, type Layer } from "@/editor/editorState";
import { getMapEditHistoryState } from "@/editor/mapEditHistory";
import { renderAiAssistantPanel } from "@/editor/panels/aiAssistantPanel";
import { renderDatabasePanel } from "@/editor/panels/database";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { renderMapList } from "@/editor/panels/mapList";
import { renderResourceManager } from "@/editor/panels/resourceManager";
import { closeTestPlayModal, openTestPlayModal } from "@/editor/panels/testPlayModal";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

const RESPONSIVE_BREAKPOINT = 1024;

let leftWidth = 268;
let leftCollapsed = false;
let leftUserOverride = false;
let leftRoot: HTMLElement | null = null;
let leftPaletteRoot: HTMLElement | null = null;
let leftMapRoot: HTMLElement | null = null;
let leftResizer: HTMLElement | null = null;
let phaserHost: HTMLElement | null = null;
let canvasToolbarRoot: HTMLElement | null = null;
let statusBarRoot: HTMLElement | null = null;
let projectExportNode: HTMLElement | null = null;
// 우측 패널: 리소스/데이터베이스 탭. RM2K3 에디터의 핵심 작업 영역.
let rightRoot: HTMLElement | null = null;
let rightTabbody: HTMLElement | null = null;
let rightTab: "resources" | "database" = "resources";
let unsubStore: (() => void) | null = null;
let unsubEditor: (() => void) | null = null;

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
  leftMapRoot = el("div", { class: "left-panel-stack", dataset: { testid: "left-map-root" } });
  left.append(leftPaletteRoot, leftMapRoot);
  canvasScrollShell.append(phaserContainer);
  canvasArea.append(canvasScrollShell, canvasToolbar, statusBar);
  // 우측 패널: 리소스 관리자 / 데이터베이스 탭. RM2K3 에디터 작업 영역.
  const right = el("div", { class: "right-panel" });
  const rightTabbar = el("div", { class: "right-tabbar" });
  const resourcesTab = el("button", {
    class: "right-tab" + (rightTab === "resources" ? " active" : ""),
    text: "소재",
    attrs: { type: "button", title: "소재 관리자" },
    dataset: { testid: "right-tab-resources" },
    on: { click: () => { rightTab = "resources"; refreshRightPanel(); } },
  });
  const databaseTab = el("button", {
    class: "right-tab" + (rightTab === "database" ? " active" : ""),
    text: "DB",
    attrs: { type: "button", title: "데이터베이스" },
    dataset: { testid: "right-tab-database" },
    on: { click: () => { rightTab = "database"; refreshRightPanel(); } },
  });
  rightTabbar.append(resourcesTab, databaseTab);
  rightTabbody = el("div", { class: "right-tabbody" });
  right.append(rightTabbar, rightTabbody);
  layout.append(left, leftResizer, canvasArea, right);
  main.append(layout, renderAiAssistantPanel(), projectExportNodeElement());

  leftRoot = left;
  phaserHost = phaserContainer;
  canvasToolbarRoot = canvasToolbar;
  statusBarRoot = statusBar;
  rightRoot = right;

  applyLayout();
  refreshPanels();
  bindLeftResizer();
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("rpgzzu:test-play-window", onTestPlayWindowRequest);
  void startEditGame(phaserContainer).then(() => fitCanvas());

  unsubStore = store.subscribe(() => refreshPanels());
  unsubEditor = editorState.subscribe(() => refreshPanels());
}

export function teardownEditor(): void {
  unsubStore?.();
  unsubEditor?.();
  unsubStore = null;
  unsubEditor = null;
  window.removeEventListener("resize", onWindowResize);
  window.removeEventListener("rpgzzu:test-play-window", onTestPlayWindowRequest);
  closeTestPlayModal();
  destroyGame();
  leftRoot = null;
  leftPaletteRoot = null;
  leftMapRoot = null;
  leftResizer = null;
  phaserHost = null;
  canvasToolbarRoot = null;
  statusBarRoot = null;
  projectExportNode = null;
  rightRoot = null;
  rightTabbody = null;
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

// 모달(리소스/데이터베이스)이 열릴 때 호출 — 우측 패널이 같은 testId
// 컨트롤을 렌더하므로 모달과 충돌(strict mode violation)한다. 모달이 항상
// 우선이도록 우측 패널 내용을 DOM에서 제거한다(display:none 으로는 Playwright
// strict mode가 여전히 두 요소를 잡는다). 모달 닫힘 시 showRightPanel로 복원.
// suppressed 플래그로 store/editorState 구독의 자동 refresh도 막는다.
let rightPanelSuppressed = false;
export function hideRightPanel(): void {
  rightPanelSuppressed = true;
  if (rightTabbody) clearChildren(rightTabbody);
}
export function showRightPanel(): void {
  rightPanelSuppressed = false;
  refreshRightPanel();
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
  leftRoot.style.width = `${leftWidth}px`;
  leftResizer.style.display = "";
}

function refreshPanels(): void {
  if (!leftPaletteRoot || !leftMapRoot || !canvasToolbarRoot || !statusBarRoot) return;
  renderTilePalette(leftPaletteRoot);
  renderMapList(leftMapRoot);
  renderCanvasToolbar(canvasToolbarRoot);
  renderEditorStatusbar(statusBarRoot);
  refreshRightPanel();
  updateProjectExport();
  fitCanvas();
}

// 우측 패널 활성 탭 내용 렌더링 + 탭 활성 상태 동기화.
function refreshRightPanel(): void {
  if (!rightRoot || !rightTabbody) return;
  // 모달 열림 중에는 우측 패널을 비워둔다(testId 충돌 방지).
  if (rightPanelSuppressed) {
    clearChildren(rightTabbody);
    return;
  }
  // 탭 활성 클래스 동기화.
  const tabs = rightRoot.querySelectorAll<HTMLElement>(".right-tab");
  tabs.forEach((tab) => {
    const id = tab.dataset.testid ?? "";
    const active = (id === "right-tab-resources" && rightTab === "resources")
      || (id === "right-tab-database" && rightTab === "database");
    tab.classList.toggle("active", active);
  });
  clearChildren(rightTabbody);
  if (rightTab === "resources") {
    renderResourceManager(rightTabbody);
  } else {
    renderDatabasePanel(rightTabbody);
  }
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
    el("span", { class: "editor-statusbar-cell", text: `줌: ${state.zoom}x` })
  );
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
    project: store.getCurrent(),
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
      leftWidth = Math.max(268, Math.min(380, startWidth + moveEvent.clientX - startX));
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
