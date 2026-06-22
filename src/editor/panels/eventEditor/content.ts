import { newCommand } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import {
  addEventPageCommand,
  addEventPageCommandAt,
  deleteEventPageCommandAt,
  ensureEventPages,
  moveEventPageCommandAt,
  replaceEventPageCommandAt,
  setEventPageTextCommand,
  updateEventPage,
} from "@/editor/eventPages";
import { DEFAULT_SPRITE_NPC } from "@/project/defaults";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderCommandList } from "./commandList";
import { openEventCommandPicker } from "./commandPicker";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { renderEventProps } from "./eventProps";
import { COMMAND_KIND_OPTIONS } from "./options";
import { renderEventPageProps, renderPageCommandCatalog, renderPageTabs } from "./pageProps";
import type { CommandListActions } from "./types";

export function renderEventEditorContent(container: HTMLElement, mapId: MapId, eventId: string): void {
  const section = el("div", { class: "panel-section event-editor", dataset: { testid: "event-editor-content" } });
  section.append(el("h3", { text: "Event Editor" }));

  const map = store.getCurrent().maps[mapId];
  if (!map) {
    section.append(el("div", { class: "empty-hint", text: "Map not found." }));
    container.append(section);
    return;
  }

  const ev = map.events.find((event) => event.id === eventId);
  if (!ev) {
    section.append(el("div", { class: "empty-hint", text: "Event not found." }));
    container.append(section);
    return;
  }

  if (!ev.pages?.length) {
    ensureEventPages(mapId, ev.id);
  }
  const pages = ev.pages ?? [];
  const selectedPageId = editorState.get().selectedEventPageId;
  const activePage = pages.find((page) => page.id === selectedPageId) ?? pages[pages.length - 1];

  if (activePage) {
    const actions = pageCommandActions(mapId, ev.id, activePage.id);
    const settingsColumn = el("div", { class: "event-editor-settings-column" });
    const commandsColumn = el("div", { class: "event-editor-commands-column" });
    const cmdList = el("div", { class: "cmd-list" });
    renderCommandList(cmdList, activePage.commands, [], actions);
    settingsColumn.append(
      renderEventPageProps(mapId, ev.id, activePage),
      renderNpcQuickAuthor(mapId, ev.id, activePage.id),
      renderEventProps(mapId, ev)
    );
    commandsColumn.append(renderPageCommandCatalog(mapId, ev.id, activePage), el("h3", { text: "Contents" }), cmdList, rootCommandAddRow(actions));
    section.append(
      el("div", {
        class: "event-editor-page-header",
        children: [
          el("div", { class: "event-editor-event-id", text: `ID ${ev.id} (${ev.x},${ev.y})` }),
          renderPageTabs(mapId, ev, activePage),
        ],
      }),
      el("div", { class: "event-editor-workbench", children: [settingsColumn, commandsColumn] })
    );
  }
  container.append(section);
}

function renderNpcQuickAuthor(mapId: MapId, eventId: string, pageId: string): HTMLElement {
  const wrap = el("div", {
    class: "npc-quick-author",
    dataset: { testid: "event-npc-quick-author" },
  });
  const nameInput = el("input", {
    attrs: { type: "text", placeholder: "NPC name" },
    value: "Village Resident",
    dataset: { testid: "event-npc-name-input" },
  });
  const dialogueInput = el("textarea", {
    attrs: { rows: "3", placeholder: "Dialogue" },
    value: "Welcome.",
    dataset: { testid: "event-npc-dialogue-input" },
  });
  wrap.append(
    el("h3", { text: "NPC Quick Author" }),
    el("label", { text: "Name" }),
    nameInput,
    el("label", { text: "Dialogue" }),
    dialogueInput,
    el("button", {
      class: "btn primary",
      text: "Apply NPC",
      dataset: { testid: "event-npc-quick-create" },
      on: {
        click: () => {
          const speaker = nameInput.value.trim() || "NPC";
          const body = dialogueInput.value.trim() || "Hello.";
          setEventPageTextCommand(mapId, eventId, pageId, speaker, body);
          updateEventPage(mapId, eventId, pageId, {
            name: speaker,
            trigger: { kind: "action" },
            priority: "same",
            graphic: { sprite: { type: "bundled", id: DEFAULT_SPRITE_NPC } },
          });
        },
      },
    }),
    el("button", {
      class: "btn",
      text: "Add Monster Encounter",
      attrs: { title: "Add a default battle processing command." },
      dataset: { testid: "event-monster-encounter-create" },
      on: {
        click: () => addDefaultMonsterEncounter(mapId, eventId, pageId),
      },
    })
  );
  return wrap;
}

function addDefaultMonsterEncounter(mapId: MapId, eventId: string, pageId: string): void {
  const troopId = store.getCurrent().database.troops[0]?.id;
  if (!troopId) return;
  addEventPageCommand(mapId, eventId, pageId, {
    kind: "battleProcessing",
    troopId,
    canEscape: true,
    canLose: false,
  });
}

function pageCommandActions(mapId: MapId, eventId: string, pageId: string): CommandListActions {
  return {
    addCommand: (containerPath, command) =>
      addEventPageCommandAt(mapId, eventId, pageId, containerPath, command),
    replaceCommand: (path, command) => replaceEventPageCommandAt(mapId, eventId, pageId, path, command),
    deleteCommand: (path) => deleteEventPageCommandAt(mapId, eventId, pageId, path),
    moveCommand: (path, dir) => moveEventPageCommandAt(mapId, eventId, pageId, path, dir),
  };
}

function rootCommandAddRow(actions: CommandListActions): HTMLElement {
  const addRow = el("div", { class: "field event-command-insert-row" });
  const sel = commandKindSelect("text", "event-command-kind-select");
  addRow.append(
    el("label", { text: "Insert Command" }),
    el("button", {
      class: "btn primary",
      text: "Insert...",
      dataset: { testid: "event-command-picker-open" },
      on: {
        click: () => {
          openEventCommandPicker({
            title: "Insert Command",
            onSelect: (command) => actions.addCommand([], command),
          });
        },
      },
    }),
    sel,
    el("button", {
      class: "btn",
      text: "+ Add",
      dataset: { testid: "event-command-add" },
      on: {
        click: () => {
          actions.addCommand([], newCommand(selectedOptionValue(sel, COMMAND_KIND_OPTIONS, "text")));
        },
      },
    })
  );
  return addRow;
}
