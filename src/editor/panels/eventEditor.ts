import { editorState } from "@/editor/editorState";
import { ensureEventPages } from "@/editor/eventPages";
import { handleEditorDeleteKey } from "@/editor/hotkeys";
import { committedEvents } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { EventPageGraphic, GameEvent, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderEventGraphicIcon } from "./eventEditor/eventGraphicPreview";
import { openEventEditorModal } from "./eventEditor/modal";

export { renderEventEditorInline } from "./eventEditor/inline";

export function renderEventEditor(container: HTMLElement): void {
  const section = el("div", {
    class: "panel-section event-editor event-editor-sidebar",
    on: {
      keydown: (event) => {
        if (event instanceof KeyboardEvent) handleEditorDeleteKey(event);
      },
    },
  });
  section.append(el("h3", { text: "이벤트" }));

  const state = editorState.get();
  const mapId: MapId = state.currentMapId ?? store.getCurrent().startMapId;
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    section.append(el("div", { class: "empty-hint", text: "맵을 찾을 수 없습니다." }));
    container.append(section);
    return;
  }

  const events = committedEvents(map.events);
  const selectedEvent = state.selectedEventId
    ? events.find((event) => event.id === state.selectedEventId)
    : undefined;

  section.append(renderMapEventList(mapId, events, state.selectedEventId));

  if (!selectedEvent) {
    section.append(
      el("div", {
        class: "empty-hint",
        text: "이벤트 도구를 선택한 뒤 맵 타일을 클릭하면 이벤트를 만들거나 편집할 수 있습니다.",
      })
    );
    container.append(section);
    return;
  }

  if (!selectedEvent.pages?.length) ensureEventPages(mapId, selectedEvent.id);
  section.append(renderSelectedEventSummary(mapId, selectedEvent));
  container.append(section);
}

function renderSelectedEventSummary(mapId: MapId, event: GameEvent): HTMLElement {
  const pageCount = event.pages?.length ?? 0;
  const displayName = eventDisplayName(event);
  const summary = el("div", {
    class: "event-editor-launch",
    dataset: { testid: "event-editor-launch" },
  });
  summary.append(
    el("div", { class: "event-editor-launch-title", text: displayName }),
    el("div", { class: "event-editor-launch-meta", text: `위치 ${event.x},${event.y} / ${pageCount} 페이지` }),
    el("button", {
      class: "btn primary",
      text: "이벤트 편집 열기",
      dataset: { testid: "event-editor-open" },
      on: { click: () => openEventEditorModal(mapId, event.id) },
    })
  );
  return summary;
}

function renderMapEventList(mapId: MapId, events: readonly GameEvent[], selectedEventId: string | null): HTMLElement {
  const list = el("div", { class: "event-list", dataset: { testid: "event-list" } });
  list.append(el("div", { class: "event-list-title", text: "맵 이벤트 목록" }));
  if (events.length === 0) {
    list.append(el("div", { class: "event-list-empty", text: "이 맵에는 이벤트가 없습니다." }));
    return list;
  }
  for (const event of events) {
    const displayName = eventDisplayName(event);
    const icon = renderEventGraphicIcon(eventListGraphic(event));
    const row = el("button", {
      class: "event-list-row" + (event.id === selectedEventId ? " active" : ""),
      attrs: { type: "button", title: `${displayName} (${event.id}, ${event.x},${event.y})` },
      dataset: { testid: `event-list-row-${event.id}` },
      on: {
        click: () => selectEvent(event),
        dblclick: () => openEventEditorModal(mapId, event.id),
      },
    });
    row.append(
      el("span", { class: "event-list-icon", children: [icon] }),
      el("span", { class: "event-list-name", text: displayName }),
      el("span", { class: "event-list-meta", text: `${event.x},${event.y} · ${event.pages?.length ?? 0}p` })
    );
    list.append(row);
  }
  return list;
}

function eventDisplayName(event: GameEvent): string {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name.trim();
    if (name) return name;
  }
  return event.id;
}

function eventListGraphic(event: GameEvent): EventPageGraphic {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const graphic = pages[index]?.graphic;
    if (graphic?.sprite) return graphic;
  }
  return event.sprite ? { sprite: event.sprite } : {};
}

function selectEvent(event: GameEvent): void {
  editorState.set({
    tool: "event",
    layer: "event",
    selectedEventId: event.id,
    selectedEventPageId: firstPageId(event),
  });
}

function firstPageId(event: GameEvent): string | null {
  const pages = event.pages ?? [];
  return pages[0]?.id ?? null;
}
