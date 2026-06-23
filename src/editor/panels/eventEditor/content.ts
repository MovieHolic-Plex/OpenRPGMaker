import { newCommand } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import {
  addEventPageCommand,
  addEventPageCommandAt,
  deleteEventPageCommandAt,
  ensureEventPages,
  moveEventPageCommandAt,
  moveEventPageCommandToIndex,
  replaceEventPageCommandAt,
  setEventPageTextCommand,
  updateEventPage,
} from "@/editor/eventPages";
import { DEFAULT_SPRITE_NPC } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderCommandList } from "./commandList";
import { openEventCommandPicker } from "./commandPicker";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { renderEventProps } from "./eventProps";
import { COMMAND_KIND_OPTIONS } from "./options";
import { renderEventPageProps, renderPageCommandCatalog, renderPageCommandSummary, renderPageTabs } from "./pageProps";
import type { CommandListActions } from "./types";

export function renderEventEditorContent(container: HTMLElement, mapId: MapId, eventId: string): void {
  // 레거시 단일 컨테이너 진입(인라인 편집기 등). 모달은 stable/dynamic 분리 함수를 쓴다.
  renderEventEditorDynamic(container, mapId, eventId);
}

// 정적 영역 — 카탈로그(명령 추가 버튼). 최초 1회만 렌더링한다.
// store 변경에도 버튼을 재생성하지 않아, 빠른 연속 클릭(명령 연타) 중
// 버튼이 detach되어 클릭이 빈 곳에 떨어지는 것을 막는다.
// 클릭 핸들러는 매번 현재 활성 페이지를 store에서 lazy 조회한다.
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
  // 카탈로그 안의 stub summary 노드는 dynamic 영역에서 최신값으로 따로 렌더링하므로 제거.
  catalog.querySelector("[data-testid='page-command-summary']")?.remove();
  // 카탈로그 버튼의 클릭 핸들러를 lazy pageId 기반으로 교체.
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

// 동적 영역 — 페이지 탭/설정/명령 리스트. store 변경 시마다 갱신된다.
export function renderEventEditorDynamic(container: HTMLElement, mapId: MapId, eventId: string): void {
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
      renderPageCommandSummary(activePage),
      renderNpcQuickAuthor(mapId, ev.id, activePage.id),
      renderEventProps(mapId, ev)
    );
    commandsColumn.append(el("h3", { text: "Contents" }), cmdList, rootCommandAddRow(actions));
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

// 현재 활성 페이지 id를 매 호출마다 store/editorState에서 최신값으로 조회한다.
// 카탈로그 클릭 핸들러가 렌더링 시점의 stale 페이지 참조 대신 이것을 쓴다.
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
    "command-add-game-over": "gameOver",
  };
  return map[testId] ?? null;
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
    moveCommandTo: (sourcePath, toIndex) => moveEventPageCommandToIndex(mapId, eventId, pageId, sourcePath, toIndex),
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
