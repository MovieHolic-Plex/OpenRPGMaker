import { editorState } from "@/editor/editorState";
import {
  addEventPageCommand,
  addEventPageCommandAt,
  deleteEventPageCommandAt,
  ensureEventPages,
  insertEventPageCommandAt,
  moveEventPageCommandAcross,
  moveEventPageCommandAt,
  moveEventPageCommandToIndex,
  replaceEventPageCommandAt,
} from "@/editor/eventPages";
import { eventDraftDiffById, type EventDiff } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderEventAiAssist } from "./aiAssist";
import { renderEventScriptModernViews } from "./eventScriptModernViews";
import { openNewEventCommandDialog, openNewEventCommandKindDialog } from "./commandEditDialog";
import { renderCommandList } from "./commandList";
import { openEventCommandPicker } from "./commandPicker";
import { applyStoredSettingsColumnWidth, attachColumnResize } from "./layoutResize";
import {
  renderClassicPageTabStrip,
  renderEventNameControl,
  renderEventPageProps,
  renderPageCommandCatalog,
  renderPageTabs,
} from "./pageProps";
import type { CommandListActions } from "./types";

export function renderEventEditorContent(container: HTMLElement, mapId: MapId, eventId: string): void {
  renderEventEditorDynamic(container, mapId, eventId);
}

export function renderEventEditorStable(container: HTMLElement, mapId: MapId, eventId: string): void {
  const section = el("div", { class: "panel-section event-editor-stable" });
  const stub: EventPage = {
    id: "",
    name: "",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
  const catalog = renderPageCommandCatalog(mapId, eventId, stub);
  catalog.querySelector("[data-testid='page-command-summary']")?.remove();
  const buttons = catalog.querySelectorAll<HTMLElement>("[data-testid^='command-add-']");
  for (const btn of buttons) {
    const testId = btn.dataset.testid ?? "";
    const kind = commandKindForTestId(testId);
    if (!kind) continue;
    const fresh = btn.cloneNode(true) as HTMLElement;
    fresh.addEventListener("click", () => {
      const pageId = activePageIdOf(mapId, eventId);
      if (!pageId) return;
      openNewEventCommandKindDialog(kind, (command) => addEventPageCommand(mapId, eventId, pageId, command));
    });
    btn.replaceWith(fresh);
  }
  section.append(catalog);
  container.append(section);
}

export function renderEventEditorDynamic(container: HTMLElement, mapId: MapId, eventId: string): void {
  const section = el("div", { class: "panel-section event-editor", dataset: { testid: "event-editor-content" } });
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    section.append(el("div", { class: "empty-hint", text: "맵을 찾을 수 없습니다." }));
    container.append(section);
    return;
  }

  const ev = map.events.find((event) => event.id === eventId);
  if (!ev) {
    section.append(el("div", { class: "empty-hint", text: "이벤트를 찾을 수 없습니다." }));
    container.append(section);
    return;
  }

  if (!ev.pages?.length) {
    ensureEventPages(mapId, ev.id);
  }
  const pages = ev.pages ?? [];
  const selectedPageId = editorState.get().selectedEventPageId;
  const activePage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  if (!activePage) {
    section.append(el("div", { class: "empty-hint", text: "이벤트 페이지가 없습니다." }));
    container.append(section);
    return;
  }

  const actions = pageCommandActions(mapId, ev.id, activePage.id);
  const settingsColumn = el("div", { class: "event-editor-settings-column" });
  const commandsColumn = el("div", { class: "event-editor-commands-column" });
  const columnResizer = el("div", {
    class: "event-editor-column-resizer",
    attrs: {
      role: "separator",
      "aria-label": "설정과 실행 내용 사이즈 조절",
      "aria-orientation": "vertical",
      tabindex: "0",
    },
    dataset: { testid: "event-editor-column-resizer" },
  });
  const cmdList = el("div", { class: "cmd-list" });
  renderCommandList(cmdList, activePage.commands, [], actions);
  cmdList.querySelector(".empty-hint")?.remove();
  cmdList.append(renderEmptyCommandLine(actions));
  cmdList.addEventListener("dblclick", (event) => {
    if (event.target === cmdList) {
      cmdList.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    }
  });
  settingsColumn.append(renderClassicPageTabStrip(ev, activePage), renderEventPageProps(mapId, ev.id, activePage));
  commandsColumn.append(
    renderCommandToolbar(cmdList, actions),
    el("fieldset", {
      class: "event-rm2k3-fieldset event-contents-fieldset",
      dataset: { testid: "event-classic-contents" },
      children: [
        el("legend", { text: "실행 내용" }),
        cmdList,
      ],
    }),
    // 커맨드 리스트 하단 AI Assist(자연어 → 커맨드 JSON 생성/프리뷰/삽입).
    renderEventAiAssist({ mapId, eventId: ev.id, page: activePage, actions, cmdList }),
    // [P2] 모던 전용 파생 뷰(라이브 미리보기/플로우차트) — 기본 접힘, RM2003 화면 옆에 선다.
    renderEventScriptModernViews(activePage)
  );

  const workbench = el("div", {
    class: "event-editor-workbench",
    children: [settingsColumn, columnResizer, commandsColumn],
  });
  applyStoredSettingsColumnWidth(workbench);
  attachColumnResize(columnResizer, workbench);

  section.append(
    el("div", {
      class: "event-editor-top-strip",
      children: [
        renderEventNameControl(mapId, ev.id, activePage),
        renderPageTabs(mapId, ev, activePage),
      ],
    }),
    el("div", {
      class: "event-editor-id-row",
      text: `ID ${displayEventNumber(mapId, eventId)} (${ev.x}, ${ev.y})`,
    }),
    renderEventDiffSummary(mapId, eventId),
    workbench
  );
  container.append(section);
}

function renderEventDiffSummary(mapId: MapId, eventId: string): HTMLElement {
  const diff = eventDraftDiffById(store.getCurrent(), mapId, eventId);
  const clean = !diff || diff.changes.length === 0;
  return el("div", {
    class: "event-editor-diff" + (clean ? " clean" : ""),
    text: clean ? "변경 없음" : eventDiffLabel(diff),
    dataset: { testid: "event-editor-diff" },
  });
}

function eventDiffLabel(diff: EventDiff): string {
  const label = diff.kind === "created" ? "생성 예정" : "변경 예정";
  const paths = diff.kind === "created" ? ["event"] : diff.changes.map((change) => trimEventPath(change.path));
  const preview = paths.slice(0, 4).join(", ");
  const more = paths.length > 4 ? ` +${paths.length - 4}` : "";
  return `${label}: ${diff.changes.length} diff - ${preview}${more}`;
}

function trimEventPath(path: string): string {
  return path.startsWith("event.") ? path.slice("event.".length) : path;
}

function activePageIdOf(mapId: MapId, eventId: string): string | null {
  const ev = store.getCurrent().maps[mapId]?.events.find((e) => e.id === eventId);
  if (!ev) return null;
  const pages = ev.pages ?? [];
  if (!pages.length) return null;
  const selectedPageId = editorState.get().selectedEventPageId;
  const active = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  return active.id;
}

function renderCommandToolbar(cmdList: HTMLElement, actions: CommandListActions): HTMLElement {
  const selectedPath = (): number[] | null => {
    const selected = cmdList.querySelector<HTMLElement>(".cmd-item.selected");
    if (!selected?.dataset.cmdPath) return null;
    try {
      const path = JSON.parse(selected.dataset.cmdPath);
      return Array.isArray(path) && path.every((part) => Number.isInteger(part)) ? path : null;
    } catch {
      return null;
    }
  };
  const runForSelected = (run: (path: number[]) => void): void => {
    const path = selectedPath();
    if (path) run(path);
  };
  return el("div", {
    class: "event-editor-command-toolbar",
    attrs: { "aria-label": "실행 내용 도구" },
    children: [
      toolbarButton("↶", "되돌리기", undefined, true),
      toolbarButton("↷", "다시 실행", undefined, true),
      toolbarButton("↑", "위로 이동", () => runForSelected((path) => actions.moveCommand(path, -1))),
      toolbarButton("↓", "아래로 이동", () => runForSelected((path) => actions.moveCommand(path, 1))),
      toolbarButton("▣", "복사", undefined, true),
      toolbarButton("✂", "잘라내기", () => runForSelected((path) => actions.deleteCommand(path))),
      toolbarButton("+", "명령 추가", () =>
        cmdList.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')?.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true })
        )
      ),
    ],
  });
}

function toolbarButton(text: string, title: string, onClick?: () => void, disabled = false): HTMLButtonElement {
  return el("button", {
    class: "event-editor-command-tool",
    text,
    attrs: disabled ? { type: "button", title, disabled: "" } : { type: "button", title },
    on: onClick ? { click: onClick } : undefined,
  }) as HTMLButtonElement;
}

function commandKindForTestId(testId: string): Command["kind"] | null {
  const map: Record<string, Command["kind"]> = {
    "command-add-text": "text",
    "command-add-choice": "choices",
    "command-add-switch": "setSwitch",
    "command-add-variable": "setVariable",
    "command-add-branch": "fork",
    "command-add-timer": "timer",
    "command-add-move-route": "moveEvent",
    "command-add-picture": "showPicture",
    "command-add-audio": "playAudio",
    "command-add-battle": "battleProcessing",
    "command-add-gold": "changeGold",
    "command-add-item": "changeItem",
    "command-add-party": "changeParty",
    "command-add-game-over": "gameOver",
    "command-add-ending": "ending",
  };
  return map[testId] ?? null;
}

function pageCommandActions(mapId: MapId, eventId: string, pageId: string): CommandListActions {
  return {
    addCommand: (containerPath, command) =>
      addEventPageCommandAt(mapId, eventId, pageId, containerPath, command),
    insertCommand: (path, command) => insertEventPageCommandAt(mapId, eventId, pageId, path, command),
    replaceCommand: (path, command) => replaceEventPageCommandAt(mapId, eventId, pageId, path, command),
    deleteCommand: (path) => deleteEventPageCommandAt(mapId, eventId, pageId, path),
    moveCommand: (path, dir) => moveEventPageCommandAt(mapId, eventId, pageId, path, dir),
    moveCommandTo: (sourcePath, toIndex) => moveEventPageCommandToIndex(mapId, eventId, pageId, sourcePath, toIndex),
    moveCommandAcross: (sourcePath, targetContainerPath, toIndex) =>
      moveEventPageCommandAcross(mapId, eventId, pageId, sourcePath, targetContainerPath, toIndex),
  };
}

function renderEmptyCommandLine(actions: CommandListActions): HTMLElement {
  const openPicker = () => {
    if (document.querySelector('[data-testid="event-command-picker"]')) return;
    openEventCommandPicker({
      title: "이벤트 명령",
      onSelect: (command, closePicker) => {
        openNewEventCommandDialog(command, (editedCommand) => {
          actions.addCommand([], editedCommand);
          closePicker();
        });
        return { closePicker: false };
      },
    });
  };
  return el("button", {
    class: "cmd-empty-line",
    text: "◆",
    attrs: { type: "button", title: "더블클릭해서 이벤트 명령을 추가" },
    dataset: { testid: "event-command-empty-line" },
    on: {
      dblclick: openPicker,
      keydown: (event) => {
        if (event instanceof KeyboardEvent && event.key === "Enter") {
          event.preventDefault();
          openPicker();
        }
      },
    },
  });
}

function displayEventNumber(mapId: MapId, eventId: string): string {
  const events = store.getCurrent().maps[mapId]?.events ?? [];
  const index = events.findIndex((event) => event.id === eventId);
  return String(index >= 0 ? index + 1 : 1).padStart(4, "0");
}
