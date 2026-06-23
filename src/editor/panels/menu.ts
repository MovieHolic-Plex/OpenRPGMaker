import { getMode, toggleMode } from "@/app/mode";
import { addMap, deleteMap, setStartMap } from "@/editor/actions";
import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { getMapEditHistoryState, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { deserialize, ProjectFormatError } from "@/project/io";
import {
  createProjectPackage,
  ProjectPackageError,
  projectPackageFileName,
  readProjectPackage,
  RPGZZU_MIME,
} from "@/project/package";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { saveProjectNow } from "@/editor/saveActions";
import { separator, toolbarButton } from "./menuToolbar";

const MENU_ITEMS = [
  { id: "project", label: "프로젝트" },
  { id: "map", label: "맵" },
  { id: "tools", label: "도구" },
  { id: "game", label: "게임" },
  { id: "help", label: "도움말" },
] as const;

type MenuId = (typeof MENU_ITEMS)[number]["id"];

type MenuCommand =
  | { readonly kind: "item"; readonly disabled?: boolean; readonly label: string; readonly onClick: () => void; readonly testId: string }
  | { readonly kind: "separator" };

let activeMenuPopup: HTMLElement | null = null;

export function renderTopbar(topbar: HTMLElement): void {
  while (topbar.firstChild) topbar.removeChild(topbar.firstChild);
  const mode = getMode();
  const state = editorState.get();
  const history = getMapEditHistoryState();
  const menuBar = el("div", { class: "rm2k3-menu-bar", dataset: { testid: "rm2k3-menu-bar" } });
  for (const item of MENU_ITEMS) {
    menuBar.append(renderMenu(item.id, item.label, menuCommands(item.id, state, history, topbar)));
  }

  const toolbar = el("div", { class: "rm2k3-toolbar", dataset: { testid: "rm2k3-toolbar" } });
  const primaryRow = el("div", { class: "rm2k3-toolbar-row primary-row", dataset: { testid: "rm2k3-toolbar-row-primary" } });
  primaryRow.append(el("span", { class: "title", text: "RPG 쯔꾸르" }), el("span", { class: "mode-badge", text: mode === "edit" ? "편집" : "실행" }));
  if (mode === "edit") appendFileActions(primaryRow, history, topbar);
  primaryRow.append(separator(), playModeButton(mode));
  toolbar.append(primaryRow);
  if (mode === "edit") toolbar.append(editToolbarRow(state, topbar));
  topbar.append(menuBar, toolbar);
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
  window.setTimeout(() => {
    document.addEventListener("pointerdown", closeMenuPopup, { once: true });
  }, 0);
}

function closeMenuPopup(): void {
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
        item("열기", "menu-project-load", () => void doLoad()),
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
      ];
    case "game":
      return [
        item(state.layer === "event" ? "편집 계속" : "테스트 플레이", "menu-game-play", () => void togglePlayMode()),
        item("테스트 플레이 창", "menu-game-test-window", () => void openTestPlayWindow()),
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

function appendFileActions(row: HTMLElement, history: ReturnType<typeof getMapEditHistoryState>, topbar: HTMLElement): void {
  row.append(
    toolbarButton({ testId: "toolbar-load", label: "열기", title: "저장된 프로젝트 열기", icon: "open", onClick: () => void doLoad() }),
    toolbarButton({ testId: "toolbar-save", label: "저장", title: "프로젝트 저장 (Ctrl+S)", icon: "save", onClick: () => void saveProjectNow() }),
    toolbarButton({ testId: "toolbar-export", label: "내보내기", title: "RPGZZU 패키지로 내보내기", icon: "export", onClick: () => void doExport() }),
    toolbarButton({ testId: "toolbar-import", label: "가져오기", title: "RPGZZU/JSON 가져오기", icon: "import", onClick: () => doImport() }),
    separator(),
    toolbarButton({ testId: "toolbar-undo", label: "되돌리기", title: "되돌리기", icon: "undo", disabled: !history.canUndo, onClick: () => applyHistory(undoMapEdit, topbar) }),
    toolbarButton({ testId: "toolbar-redo", label: "다시 실행", title: "다시 실행", icon: "redo", disabled: !history.canRedo, onClick: () => applyHistory(redoMapEdit, topbar) }),
    separator(),
    toolbarButton({ testId: "toolbar-database", label: "DB", title: "데이터베이스", icon: "database", onClick: () => openDatabaseModal() }),
    toolbarButton({ testId: "toolbar-resource-manager", label: "소재", title: "소재 관리자", icon: "resources", onClick: () => openResourceModal() })
  );
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

function editToolbarRow(state: ReturnType<typeof editorState.get>, topbar: HTMLElement): HTMLElement {
  const row = el("div", { class: "rm2k3-toolbar-row edit-row", dataset: { testid: "rm2k3-toolbar-row-edit" } });
  row.append(
    toolbarButton({
      testId: "toolbar-left-panel",
      label: "왼쪽 패널",
      title: "칩셋/맵 트리 패널 접기",
      icon: "panel-left",
      active: isVisiblePanel(".left-panel"),
      onClick: () => void toggleLeftPanel(topbar),
    }),
    separator(),
    el("span", { class: "rm2k3-toolbar-status", text: `3단 레이어: ${layerShortLabel(state.layer)} / ${toolShortLabel(state.tool)}`, dataset: { testid: "layer-selector" } }),
    separator(),
    toolbarButton({ testId: "layer-lower", label: "하위", title: "하위 레이어 편집", active: state.layer === "lower", onClick: () => setEditorLayer("lower", topbar) }),
    toolbarButton({ testId: "layer-upper", label: "상위", title: "상위 레이어 편집", active: state.layer === "upper", onClick: () => setEditorLayer("upper", topbar) }),
    toolbarButton({ testId: "layer-event", label: "이벤트", title: "이벤트 레이어 편집", active: state.layer === "event", onClick: () => setEditorLayer("event", topbar) }),
    separator(),
    toolbarButton({ testId: "toolbar-zoom-1", label: "x1", title: "줌 x1", active: state.zoom === 1, onClick: () => setEditorZoom(1, topbar) }),
    toolbarButton({ testId: "toolbar-zoom-2", label: "x2", title: "줌 x2", active: state.zoom === 2, onClick: () => setEditorZoom(2, topbar) }),
    toolbarButton({ testId: "toolbar-zoom-4", label: "x4", title: "줌 x4", active: state.zoom === 4, onClick: () => setEditorZoom(4, topbar) }),
    toolbarButton({ testId: "toolbar-zoom-8", label: "x8", title: "줌 x8", active: state.zoom === 8, onClick: () => setEditorZoom(8, topbar) })
  );
  return row;
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

function setEditorZoom(zoom: 1 | 2 | 4 | 8, topbar: HTMLElement): void {
  editorState.set({ zoom });
  renderTopbar(topbar);
}

function applyHistory(action: () => boolean, topbar: HTMLElement): void {
  if (action()) renderTopbar(topbar);
}

async function newProject(): Promise<void> {
  if (!window.confirm("현재 작업을 지우고 새 프로젝트를 시작할까요?")) return;
  await store.clearAll();
  const project = store.getCurrent();
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  toast("새 프로젝트를 만들었습니다", "ok");
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
  const mapName = project.maps[mapId]?.name ?? mapId;
  if (!window.confirm(`'${mapName}' 맵을 삭제할까요?`)) return;
  deleteMap(mapId);
  const next = store.getCurrent();
  editorState.set({ currentMapId: next.startMapId, selectedEventId: null, selectedEventPageId: null });
  toast("맵을 삭제했습니다", "ok");
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

async function doLoad(): Promise<void> {
  try {
    const project = await store.load();
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null });
    toast("불러옴", "ok");
  } catch (error) {
    if (error instanceof Error) {
      toast(`불러오기 실패: ${error.message}`, "error");
      return;
    }
    throw error;
  }
}

async function doExport(): Promise<void> {
  await store.flush();
  const project = store.getCurrent();
  const blob = createProjectPackage(project);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = projectPackageFileName(project);
  anchor.click();
  URL.revokeObjectURL(url);
  toast("내보냈습니다", "ok");
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
