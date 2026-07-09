import { getMode, toggleMode } from "@/app/mode";
import { addMap, setStartMap } from "@/editor/actions";
import { confirmAndDeleteMap } from "@/editor/mapDeleteConfirm";
import { showConfirm } from "@/editor/ui/modal";
import { editorState, type EditorZoom, type Layer, type Tool } from "@/editor/editorState";
import {
  EDITOR_PRODUCT_BRAND,
  getEditorChrome,
  getEditorUiMode,
  setEditorUiMode,
  type EditorUiMode,
} from "@/editor/editorUiMode";
import { getMapEditHistoryState, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { openDbConnectionSettings } from "@/editor/panels/dbConnectionSettings";
import { openMapEventSearchModal } from "@/editor/panels/mapEventSearchModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { openWorldPanel } from "@/editor/panels/worldPanel";
import { deserialize, ProjectFormatError } from "@/project/io";
import { createSampleAdventureProject, createTrainingExamplesProject } from "@/project/defaults";
import {
  createProjectPackage,
  ProjectPackageError,
  projectPackageFileName,
  readProjectPackage,
  RPGZZU_MIME,
} from "@/project/package";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { createWebPlayerExportPackage, webExportFileName } from "@/project/webExport";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { saveProjectNow } from "@/editor/saveActions";
import { separator, toolbarButton } from "./menuToolbar";
import { renderCommitHistoryButton, renderIdentityTopbarControl } from "@/editor/teamWorkflowUi";

const MENU_ITEMS = [
  { id: "project", label: "프로젝트" },
  { id: "map", label: "맵" },
  { id: "tools", label: "도구" },
  { id: "game", label: "게임" },
  { id: "help", label: "도움말" },
] as const;

const TOOLBAR_COLLAPSED_KEY = "rpg-zzu:toolbar-collapsed";

type MenuId = (typeof MENU_ITEMS)[number]["id"];

type MenuCommand =
  | { readonly kind: "item"; readonly disabled?: boolean; readonly label: string; readonly onClick: () => void; readonly testId: string }
  | { readonly kind: "separator" };

let activeMenuPopup: HTMLElement | null = null;
let popupOutsideListener: (() => void) | null = null;

export function renderTopbar(topbar: HTMLElement): void {
  while (topbar.firstChild) topbar.removeChild(topbar.firstChild);
  applyToolbarCollapsed(readToolbarCollapsed());
  const mode = getMode();
  const uiMode = getEditorUiMode();
  const chrome = getEditorChrome();
  const state = editorState.get();
  const history = getMapEditHistoryState();
  const menuBar = el("div", {
    class: "rm2k3-menu-bar editor-studio-menubar",
    dataset: { testid: "rm2k3-menu-bar", editorUiMode: uiMode },
  });
  menuBar.append(renderProductBrand());
  for (const item of MENU_ITEMS) {
    if (item.id === "help" && !chrome.helpMenu) continue;
    const label = item.id === "game" ? chrome.gameMenuLabel : item.label;
    menuBar.append(renderMenu(item.id, label, menuCommands(item.id, state, history, topbar)));
  }
  menuBar.append(renderEditorUiModeToggle(topbar));
  menuBar.append(renderCommitHistoryButton(), renderTopbarIdentityControl(topbar));
  menuBar.append(renderWindowControls());

  // Classic toolbar: expert edit surface only — gradual deprecation (not default in basic).
  const showClassic = mode !== "edit" || chrome.classicToolbar;
  topbar.append(menuBar);
  if (showClassic) {
    const toolbar = el("div", {
      class: "rm2k3-toolbar classic-toolbar is-legacy-surface",
      dataset: { testid: "rm2k3-toolbar", uiDensity: chrome.classicToolbar ? "expert" : "play" },
    });
    toolbar.append(mode === "edit" ? classicToolbarRow(state, topbar) : classicPlayToolbarRow(mode));
    topbar.append(toolbar);
  }
}

function renderProductBrand(): HTMLElement {
  return el("div", {
    class: "editor-product-brand",
    dataset: { testid: "editor-product-brand" },
    attrs: { title: EDITOR_PRODUCT_BRAND },
    children: [
      el("span", { class: "editor-product-brand-mark", attrs: { "aria-hidden": "true" }, text: "✦" }),
      el("span", { class: "editor-product-brand-text", text: EDITOR_PRODUCT_BRAND }),
    ],
  });
}

function renderEditorUiModeToggle(topbar: HTMLElement): HTMLElement {
  const current = getEditorUiMode();
  const group = el("div", {
    class: "editor-ui-mode-toggle",
    attrs: { role: "group", "aria-label": "에디터 UI 모드" },
    dataset: { testid: "editor-ui-mode-toggle" },
  });
  const makeButton = (mode: EditorUiMode, label: string, testId: string): HTMLElement =>
    el("button", {
      class: `editor-ui-mode-btn${current === mode ? " is-active" : ""}`,
      text: label,
      attrs: {
        type: "button",
        "aria-pressed": current === mode ? "true" : "false",
        title: mode === "basic" ? "기본 모드 — 간결한 편집 셸" : "전문가 모드 — 전체 도구·맵 트리",
      },
      dataset: { testid: testId, editorUiMode: mode },
      on: {
        click: (event) => {
          event.stopPropagation();
          setEditorUiMode(mode);
          // Layout subscribe in editor.ts also reacts; this import covers late mounts.
          void import("@/editor/panels/editor")
            .then((mod) => {
              mod.applyEditorUiModeLayout?.();
            })
            .catch(() => {
              /* editor not loaded (boot/landing) */
            });
          renderTopbar(topbar);
        },
      },
    });
  group.append(
    makeButton("basic", "기본 모드", "editor-ui-mode-basic"),
    makeButton("expert", "전문가 모드", "editor-ui-mode-expert"),
  );
  return group;
}

export function readableTopbarIdentityLabel(label: string): string {
  const browserSession = label.trim().match(/^브라우저\s+(.+)$/u)?.[1];
  return browserSession ? `게스트 세션 ${browserSession}` : label.trim();
}

function renderTopbarIdentityControl(topbar: HTMLElement): HTMLElement {
  const control = renderIdentityTopbarControl(() => renderTopbar(topbar));
  const label = control.querySelector<HTMLElement>("[data-testid='topbar-identity-label']");
  if (label) label.textContent = readableTopbarIdentityLabel(label.textContent ?? "");
  control.querySelector(".team-identity-kind")?.remove();
  control.querySelector(".team-identity-kind-text")?.remove();
  return control;
}

function renderMenu(id: MenuId, label: string, commands: readonly MenuCommand[]): HTMLElement {
  return el("button", {
    class: "rm2k3-menu-item",
    text: label,
    attrs: { "aria-haspopup": "menu", "aria-expanded": "false" },
    dataset: { testid: `menu-${id}` },
    on: {
      click: (event) => {
        event.stopPropagation();
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        openMenuPopup(id, target, commands);
      },
    },
  });
}

function renderWindowControls(): HTMLElement {
  const controls = el("div", { class: "rm2k3-window-controls" });
  const collapsed = document.body.classList.contains("toolbar-collapsed");
  const collapse = el("button", {
    class: "rm2k3-window-control",
    text: collapsed ? "▾" : "─",
    attrs: { type: "button", title: "툴바 접기/펼치기", "aria-pressed": collapsed ? "true" : "false" },
    dataset: { testid: "window-toolbar-collapse" },
    on: {
      click: (event) => {
        event.stopPropagation();
        const nextCollapsed = !document.body.classList.contains("toolbar-collapsed");
        applyToolbarCollapsed(nextCollapsed);
        writeToolbarCollapsed(nextCollapsed);
        collapse.textContent = nextCollapsed ? "▾" : "─";
        collapse.setAttribute("aria-pressed", nextCollapsed ? "true" : "false");
      },
    },
  });
  const fullscreen = el("button", {
    class: "rm2k3-window-control",
    text: document.fullscreenElement ? "◱" : "□",
    attrs: { type: "button", title: "전체화면 전환" },
    dataset: { testid: "window-fullscreen" },
    on: {
      click: (event) => {
        event.stopPropagation();
        void toggleFullscreen();
      },
    },
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement ? "◱" : "□";
  });
  // 브라우저 탭은 스크립트로 안정적으로 닫을 수 없어 닫기 컨트롤은 렌더하지 않는다.
  controls.append(collapse, fullscreen);
  return controls;
}

function applyToolbarCollapsed(collapsed: boolean): void {
  document.body.classList[collapsed ? "add" : "remove"]("toolbar-collapsed");
}

function readToolbarCollapsed(): boolean {
  return browserLocalStorage()?.getItem(TOOLBAR_COLLAPSED_KEY) === "1";
}

function writeToolbarCollapsed(collapsed: boolean): void {
  browserLocalStorage()?.setItem(TOOLBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
}

function browserLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    if (error instanceof Error) return null;
    return null;
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen !== "function") {
        toast("이 브라우저에서는 전체화면을 지원하지 않습니다", "error");
        return;
      }
      await document.exitFullscreen();
      return;
    }
    if (typeof document.documentElement.requestFullscreen !== "function") {
      toast("이 브라우저에서는 전체화면을 지원하지 않습니다", "error");
      return;
    }
    await document.documentElement.requestFullscreen();
  } catch (error) {
    toast(error instanceof Error ? `전체화면 전환 실패: ${error.message}` : "전체화면 전환 실패", "error");
  }
}

function openMenuPopup(id: MenuId, button: HTMLElement, commands: readonly MenuCommand[]): void {
  const alreadyOpen = activeMenuPopup?.dataset.testid === `menu-popup-${id}`;
  closeMenuPopup();
  if (alreadyOpen) return;
  button.setAttribute("aria-expanded", "true");
  const popup = el("div", { class: "rm2k3-menu-popup open", attrs: { role: "menu" }, dataset: { testid: `menu-popup-${id}` } });
  for (const command of commands) {
    if (command.kind === "separator") {
      popup.append(el("div", { class: "rm2k3-menu-separator", attrs: { role: "separator" } }));
      continue;
    }
    const item = el("button", {
      class: "rm2k3-menu-command",
      text: command.label,
      attrs: { role: "menuitem" },
      dataset: { testid: command.testId },
      on: {
        click: () => {
          command.onClick();
          closeMenuPopup();
        },
      },
    });
    item.disabled = Boolean(command.disabled);
    popup.append(item);
  }
  const box = button.getBoundingClientRect();
  popup.style.left = `${Math.round(box.left)}px`;
  popup.style.top = `${Math.round(box.bottom)}px`;
  document.body.append(popup);
  activeMenuPopup = popup;
  // 바깥 클릭 시 닫기 — 단, 팝업 '안'을 누른 pointerdown은 닫지 않는다(도그푸딩 결함 ⑪ 근본 원인).
  // 기존에는 무조건 닫아서, 항목의 pointerdown이 팝업을 제거 → 이어질 click이 분리된 항목에
  // 도달하지 못해 내보내기 등 메뉴 항목 onClick이 실행되지 않았다(내보내기 무반응).
  const onOutsidePointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Node && popup.contains(event.target)) return;
    closeMenuPopup();
    document.removeEventListener("pointerdown", onOutsidePointerDown);
  };
  window.setTimeout(() => {
    document.addEventListener("pointerdown", onOutsidePointerDown);
  }, 0);
  popupOutsideListener = () => document.removeEventListener("pointerdown", onOutsidePointerDown);
}

function closeMenuPopup(): void {
  popupOutsideListener?.();
  popupOutsideListener = null;
  activeMenuPopup?.remove();
  activeMenuPopup = null;
  document.querySelectorAll<HTMLElement>(".rm2k3-menu-item[aria-expanded='true']").forEach((node) => {
    node.setAttribute("aria-expanded", "false");
  });
}

function menuCommands(
  id: MenuId,
  state: ReturnType<typeof editorState.get>,
  history: ReturnType<typeof getMapEditHistoryState>,
  topbar: HTMLElement
): readonly MenuCommand[] {
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  switch (id) {
    case "project":
      return [
        item("새 프로젝트", "menu-project-new", () => void newProject()),
        item("예제로 시작", "menu-project-sample-adventure", () => void newSampleAdventureProject()),
        item("학습 예시 12맵", "menu-project-training-examples", () => void newTrainingExamplesProject()),
        item("열기", "menu-project-load", () => doLoad(topbar)),
        item("저장", "menu-project-save", () => void saveProjectNow()),
        { kind: "separator" },
        item("내보내기...", "menu-project-export", () => void doExport()),
        item("가져오기...", "menu-project-import", () => doImport()),
      ];
    case "map":
      return [
        item("새 맵", "menu-map-new", () => newMap()),
        item("현재 맵을 시작 맵으로", "menu-map-start", () => setStartMap(mapId)),
        item("현재 맵 삭제", "menu-map-delete", () => deleteCurrentMap(mapId)),
      ];
    case "tools":
      return [
        item("실행 취소", "menu-tools-undo", () => applyHistory(undoMapEdit, topbar), !history.canUndo),
        item("다시 실행", "menu-tools-redo", () => applyHistory(redoMapEdit, topbar), !history.canRedo),
        { kind: "separator" },
        item("하위 레이어", "menu-tools-layer-lower", () => setEditorLayer("lower", topbar)),
        item("상위 레이어", "menu-tools-layer-upper", () => setEditorLayer("upper", topbar)),
        item("이벤트 레이어", "menu-tools-layer-event", () => setEditorLayer("event", topbar)),
        { kind: "separator" },
        item("데이터베이스...", "menu-tools-database", () => openDatabaseModal()),
        item("리소스 관리자...", "menu-tools-resources", () => openResourceModal()),
        item("세계관...", "menu-tools-world", () => openWorldPanel()),
      ];
    case "game":
      return [
        item(state.layer === "event" ? "편집 계속" : "테스트 플레이", "menu-game-play", () => void togglePlayMode()),
        item("테스트 플레이 창", "menu-game-test-window", () => void openTestPlayWindow()),
        { kind: "separator" },
        item("내보내기...", "menu-game-export", () => void doExportWebGame()),
      ];
    case "help":
      return [
        item("단축키", "menu-help-shortcuts", () => toast(SHORTCUT_HELP, "ok")),
        item("정보", "menu-help-about", () => toast("RPG 쯔꾸르 - RM2000/2003 스타일 웹 에디터", "ok")),
      ];
  }
}

function item(label: string, testId: string, onClick: () => void, disabled = false): MenuCommand {
  return { kind: "item", label, testId, onClick, disabled };
}

const SHORTCUT_HELP =
  "F5/F6/F7: 하위/상위/이벤트 레이어  •  1~7: 도구(연필/채우기/스포이트/이동/선택/통행/이벤트)  •  +/-: 줌  •  Ctrl+S: 저장  •  Ctrl+Z/Y: 실행취소/다시실행  •  Ctrl+C/V: 복사/붙여넣기  •  Space: 임시 이동  •  가운데 드래그: 맵 이동";

function classicToolbarRow(state: ReturnType<typeof editorState.get>, topbar: HTMLElement): HTMLElement {
  const row = el("div", { class: "rm2k3-toolbar-row classic-row", dataset: { testid: "rm2k3-toolbar-row-edit" } });
  const selectedEvent = selectedEventForState(state);
  row.append(
    el("span", { class: "visually-hidden", text: `3단 레이어: ${layerShortLabel(state.layer)} / ${toolShortLabel(state.tool)}`, dataset: { testid: "layer-selector" } }),
    toolbarButton({ testId: "toolbar-new", label: "새 프로젝트", title: "새 프로젝트", icon: "disabled-diamond", disabled: true, onClick: () => void newProject() }),
    toolbarButton({ testId: "toolbar-map-copy", label: "맵 복사", title: "맵 복사", icon: "disabled-blocks", disabled: true, onClick: () => toast("맵 트리에서 복사할 맵을 선택하세요.", "ok") }),
    toolbarButton({
      testId: "toolbar-event-test",
      label: "이벤트 테스트",
      title: selectedEvent ? "선택 이벤트 테스트" : "이벤트를 선택하면 테스트할 수 있습니다.",
      icon: "event-test",
      disabled: !selectedEvent,
      onClick: () => void openSelectedEventTestWindow(),
    }),
    separator(),
    playModeButton("edit"),
    separator(),
    toolbarButton({ testId: "toolbar-save", label: "저장", title: "프로젝트 저장 (Ctrl+S)", icon: "save", onClick: () => void saveProjectNow() }),
    separator(),
    toolbarButton({ testId: "toolbar-load", label: "열기", title: "Supabase 프로젝트 열기", icon: "open", onClick: () => doLoad(topbar) }),
    toolbarButton({ testId: "toolbar-import", label: "가져오기", title: "RPGZZU/JSON 가져오기", icon: "import", onClick: () => doImport() }),
    separator(),
    toolbarButton({ testId: "layer-lower", label: "하위", title: "하위 레이어 편집", icon: "lower", active: state.layer === "lower", onClick: () => setEditorLayer("lower", topbar) }),
    toolbarButton({ testId: "layer-upper", label: "상위", title: "상위 레이어 편집", icon: "upper", active: state.layer === "upper", onClick: () => setEditorLayer("upper", topbar) }),
    toolbarButton({ testId: "layer-event", label: "이벤트", title: "이벤트 레이어 편집", icon: "event", active: state.layer === "event", onClick: () => setEditorLayer("event", topbar) }),
    separator(),
    toolbarButton({ testId: "toolbar-zoom-1", label: "x1", title: "줌 x1", icon: "zoom-1", active: state.zoom === 1, onClick: () => setEditorZoom(1, topbar) }),
    toolbarButton({ testId: "toolbar-zoom-2", label: "x2", title: "줌 x2", icon: "zoom-2", active: state.zoom === 2, onClick: () => setEditorZoom(2, topbar) }),
    toolbarButton({ testId: "toolbar-zoom-4", label: "x4", title: "줌 x4", icon: "zoom-4", active: state.zoom === 4, onClick: () => setEditorZoom(4, topbar) }),
    toolbarButton({ testId: "toolbar-zoom-8", label: "x8", title: "줌 x8", icon: "zoom-8", active: state.zoom === 8, onClick: () => setEditorZoom(8, topbar) }),
    separator(),
    toolbarButton({ testId: "toolbar-database", label: "DB", title: "데이터베이스", icon: "database", onClick: () => openDatabaseModal() }),
    toolbarButton({ testId: "toolbar-resource-manager", label: "소재", title: "소재 관리자", icon: "resources", onClick: () => openResourceModal() }),
    toolbarButton({ testId: "toolbar-world", label: "세계관", title: "세계관", icon: "grid", onClick: () => openWorldPanel() }),
    toolbarButton({ testId: "toolbar-sound-test", label: "음악", title: "음악/효과음", icon: "sound", onClick: () => openAudioTestDialog() }),
    toolbarButton({ testId: "toolbar-search", label: "찾기", title: "맵/이벤트 찾기", icon: "search", onClick: () => openMapEventSearchModal() }),
    separator(),
    toolbarButton({ testId: "toolbar-left-panel", label: "왼쪽 패널", title: "칩셋/맵 트리 패널 접기", icon: "window", active: isVisiblePanel(".left-panel"), onClick: () => void toggleLeftPanel(topbar) }),
    toolbarButton({ testId: "toolbar-help", label: "도움말", title: "도움말", icon: "manual", onClick: () => toast(SHORTCUT_HELP, "ok") })
  );
  return row;
}

function selectedEventForState(state: ReturnType<typeof editorState.get>): { readonly mapId: string; readonly eventId: string } | null {
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const eventId = state.selectedEventId;
  if (!eventId) return null;
  const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
  return event ? { mapId, eventId } : null;
}

async function openSelectedEventTestWindow(): Promise<void> {
  const selectedEvent = selectedEventForState(editorState.get());
  if (!selectedEvent) {
    toast("이벤트를 선택하면 테스트할 수 있습니다.", "ok");
    return;
  }
  await store.flush();
  window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window", {
    detail: { kind: "selected-event", ...selectedEvent },
  }));
}

function classicPlayToolbarRow(mode: string): HTMLElement {
  const row = el("div", { class: "rm2k3-toolbar-row classic-row", dataset: { testid: "rm2k3-toolbar-row-primary" } });
  row.append(playModeButton(mode));
  return row;
}

function playModeButton(mode: string): HTMLButtonElement {
  return toolbarButton({
    testId: mode === "edit" ? "mode-play" : "mode-edit",
    label: mode === "edit" ? "실행" : "편집",
    title: mode === "edit" ? "테스트 플레이" : "편집기로 돌아가기",
    icon: mode === "edit" ? "play" : "pencil",
    primary: true,
    onClick: () => {
      if (mode === "edit") void openTestPlayWindow();
      else toggleMode();
    },
  });
}

function isVisiblePanel(selector: string): boolean {
  const panel = document.querySelector<HTMLElement>(selector);
  return panel !== null && panel.getBoundingClientRect().width > 0;
}

function layerShortLabel(layer: Layer): string {
  switch (layer) {
    case "lower":
      return "하위";
    case "upper":
      return "상위";
    case "event":
      return "이벤트";
  }
}

function toolShortLabel(tool: Tool): string {
  switch (tool) {
    case "paint":
      return "펜";
    case "fill":
      return "채우기";
    case "collision":
      return "통행";
    case "event":
      return "이벤트";
    case "erase":
      return "지우개";
    case "select":
      return "선택";
    case "eyedropper":
      return "스포이드";
    case "pan":
      return "이동";
  }
}

async function toggleLeftPanel(topbar: HTMLElement): Promise<void> {
  const editor = await import("@/editor/panels/editor");
  editor.toggleLeftPanel();
  renderTopbar(topbar);
}

function setEditorLayer(layer: Layer, topbar: HTMLElement): void {
  const state = editorState.get();
  const tool = layer === "event" ? "event" : state.tool === "event" ? "paint" : state.tool;
  editorState.set({ layer, tool });
  renderTopbar(topbar);
}

function setEditorZoom(zoom: EditorZoom, topbar: HTMLElement): void {
  editorState.set({ zoom });
  renderTopbar(topbar);
}

function applyHistory(action: () => boolean, topbar: HTMLElement): void {
  if (action()) renderTopbar(topbar);
}

async function newProject(): Promise<void> {
  if (!(await showConfirm({ title: "새 프로젝트", message: "현재 작업을 지우고 새 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  await store.clearAll();
  const project = store.getCurrent();
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  toast("새 프로젝트를 만들었습니다", "ok");
}

async function newTrainingExamplesProject(): Promise<void> {
  if (!(await showConfirm({ title: "학습 예시 12맵", message: "현재 작업을 지우고 학습 예시 12맵 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replace(createTrainingExamplesProject());
  const project = store.getCurrent();
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  toast("학습 예시 12맵을 불러왔습니다 — 각 맵 이름의 주제대로 예시를 채워넣으세요", "ok");
}

async function newSampleAdventureProject(): Promise<void> {
  if (!(await showConfirm({ title: "예제 프로젝트", message: "현재 작업을 지우고 예제 프로젝트를 시작할까요?", confirmLabel: "시작", danger: true }))) return;
  store.replace(createSampleAdventureProject());
  const project = store.getCurrent();
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  toast("예제 프로젝트를 불러왔습니다", "ok");
}

function newMap(): void {
  const id = addMap("새 맵");
  editorState.set({ currentMapId: id, selectedEventId: null, selectedEventPageId: null });
  toast("새 맵을 추가했습니다", "ok");
}

function deleteCurrentMap(mapId: string): void {
  const project = store.getCurrent();
  if (Object.keys(project.maps).length <= 1) {
    toast("마지막 맵은 삭제할 수 없습니다", "error");
    return;
  }
  // 확인 다이얼로그(임팩트 요약, 커스텀 모달) + 무결성 가드 경유 삭제(도그푸딩 결함 ①·⑦).
  void confirmAndDeleteMap(mapId).then((result) => {
    if (!result.ok) return;
    const next = store.getCurrent();
    editorState.set({ currentMapId: next.startMapId, selectedEventId: null, selectedEventPageId: null });
    toast("맵을 삭제했습니다", "ok");
  });
}

async function togglePlayMode(): Promise<void> {
  if (getMode() === "edit") {
    await openTestPlayWindow();
    return;
  }
  toggleMode();
}

async function openTestPlayWindow(): Promise<void> {
  await store.flush();
  window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window"));
}

function doLoad(topbar: HTMLElement): void {
  openDbConnectionSettings(() => renderTopbar(topbar), {
    autoLoadProjects: true,
  });
}

// 프로젝트 내보내기(도그푸딩 결함 ⑪ 수리). 기존 미동작 원인 3가지:
// 1) `await store.flush()`가 저장 오류 시 reject → 함수 전체가 무반응으로 중단(다운로드 없음).
// 2) anchor가 DOM에 붙지 않은 채 click() — 일부 환경에서 다운로드가 시작되지 않음.
// 3) click() 직후 동기 revokeObjectURL — 브라우저가 fetch를 시작하기 전에 URL이 무효화될 수 있음.
async function doExport(): Promise<void> {
  try {
    // 최신 상태 저장 시도는 유지하되, 실패해도 내보내기는 진행한다(메모리의 현재 상태를 내보냄).
    await store.flush().catch((error) => {
      console.error("[export] flush before export failed:", error);
      toast("저장은 실패했지만 현재 상태를 내보냅니다", "info");
    });
    const project = projectWithoutEventDrafts(store.getCurrent());
    const blob = createProjectPackage(project);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = projectPackageFileName(project);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast("내보냈습니다", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`내보내기 실패: ${message}`, "error");
  }
}

async function doExportWebGame(): Promise<void> {
  try {
    await store.flush().catch((error) => {
      console.error("[web-export] flush before export failed:", error);
      toast("저장은 실패했지만 현재 상태를 게임 번들로 내보냅니다", "info");
    });
    toast("게임 번들을 만드는 중...", "info");
    const project = store.getCurrent();
    const result = await createWebPlayerExportPackage(project);
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = webExportFileName(project);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast(`게임 내보내기 완료: 맵 ${result.summary.mapCount}개, 에셋 ${result.summary.assetCount}개`, "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`게임 내보내기 실패: ${message}`, "error");
  }
}

function doImport(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = `${RPGZZU_MIME},application/zip,.rpgzzu,application/json,.json`;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (isProjectPackageFile(file)) {
      void replaceProjectFromPackage(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => replaceProjectFromJson(String(reader.result));
    reader.onerror = () => toast("파일 읽기 실패", "error");
    reader.readAsText(file);
  });
  input.click();
}

function isProjectPackageFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".rpgzzu") || file.type === RPGZZU_MIME;
}

async function replaceProjectFromPackage(file: File): Promise<void> {
  try {
    replaceProject(await readProjectPackage(file));
  } catch (error) {
    const message = error instanceof ProjectPackageError ? `가져오기 실패: ${error.message}` : "가져오기 실패";
    toast(message, "error");
  }
}

function replaceProjectFromJson(json: string): void {
  try {
    replaceProject(deserialize(json));
  } catch (error) {
    const message = error instanceof ProjectFormatError ? `가져오기 실패: ${error.message}` : "가져오기 실패";
    toast(message, "error");
  }
}

function replaceProject(project: Project): void {
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null });
  toast("가져오기 완료", "ok");
}
