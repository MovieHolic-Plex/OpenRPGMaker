import { newCommand } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import {
  addEventPageCommand,
  addEventPageCommandAt,
  deleteEventPageCommandAt,
  ensureEventPages,
  insertEventPageCommandAt,
  moveEventPageCommandAt,
  moveEventPageCommandToIndex,
  replaceEventPageCommandAt,
} from "@/editor/eventPages";
import { eventDraftDiffById, type EventDiff } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderCommandList } from "./commandList";
import { openEventCommandPicker } from "./commandPicker";
import {
  openChoicesDialog,
  openDisplayOptionsDialog,
  openFacesetDialog,
} from "./messageCommandDialogs";
import { openTextCommandDialog } from "./textCommandDialog";
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
      addEventPageCommand(mapId, eventId, pageId, newCommand(kind));
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
  const activePage = pages.find((page) => page.id === selectedPageId) ?? pages[pages.length - 1];
  if (!activePage) {
    section.append(el("div", { class: "empty-hint", text: "이벤트 페이지가 없습니다." }));
    container.append(section);
    return;
  }

  const actions = pageCommandActions(mapId, ev.id, activePage.id);
  const settingsColumn = el("div", { class: "event-editor-settings-column" });
  const commandsColumn = el("div", { class: "event-editor-commands-column" });
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
    el("fieldset", {
      class: "event-rm2k3-fieldset event-contents-fieldset",
      dataset: { testid: "event-classic-contents" },
      children: [
        el("legend", { text: "실행 내용" }),
        cmdList,
      ],
    })
  );

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
    el("div", { class: "event-editor-workbench", children: [settingsColumn, commandsColumn] })
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
  const active = pages.find((page) => page.id === selectedPageId) ?? pages[pages.length - 1];
  return active.id;
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
  };
}

function renderEmptyCommandLine(actions: CommandListActions): HTMLElement {
  const openPicker = () => {
    if (document.querySelector('[data-testid="event-command-picker"]')) return;
    openEventCommandPicker({
      title: "이벤트 명령",
      onSelect: (command, closePicker) => {
        if (command.kind === "text") {
          openTextCommandDialog(command, (textCommand) => {
            actions.addCommand([], textCommand);
            closePicker();
          });
          return { closePicker: false };
        }
        if (command.kind === "displayTextSettings") {
          openDisplayOptionsDialog(command, (settingsCommand) => {
            actions.addCommand([], settingsCommand);
            closePicker();
          });
          return { closePicker: false };
        }
        if (command.kind === "changeFace") {
          openFacesetDialog(command, (faceCommand) => {
            actions.addCommand([], faceCommand);
            closePicker();
          });
          return { closePicker: false };
        }
        if (command.kind === "choices") {
          openChoicesDialog(command, (choicesCommand) => {
            actions.addCommand([], choicesCommand);
            closePicker();
          });
          return { closePicker: false };
        }
        actions.addCommand([], command);
        return undefined;
      },
    });
  };
  return el("button", {
    class: "cmd-empty-line",
    text: "@>",
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
