import { editorState } from "@/editor/editorState";
import { ensureEventPages } from "@/editor/eventPages";
import { store } from "@/project/store";
import type { GameEvent, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { isEventEditorModalOpenFor, openEventEditorModal } from "./eventEditor/modal";

export { renderEventEditorInline } from "./eventEditor/inline";

let lastAutoOpenedEventKey = "";

export function renderEventEditor(container: HTMLElement): void {
  const section = el("div", { class: "panel-section event-editor event-editor-sidebar" });
  section.append(el("h3", { text: "Event" }));

  const state = editorState.get();
  const mapId: MapId = state.currentMapId ?? store.getCurrent().startMapId;
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    section.append(el("div", { class: "empty-hint", text: "Map not found." }));
    container.append(section);
    return;
  }

  const selectedEvent = state.selectedEventId
    ? map.events.find((event) => event.id === state.selectedEventId)
    : undefined;

  section.append(renderMapEventList(mapId, map.events, state.selectedEventId));

  if (!selectedEvent) {
    lastAutoOpenedEventKey = "";
    section.append(
      el("div", {
        class: "empty-hint",
        text: "Use the Event tool, then click a map tile to create or edit an event.",
      })
    );
    container.append(section);
    return;
  }

  if (!selectedEvent.pages?.length) ensureEventPages(mapId, selectedEvent.id);
  maybeAutoOpenEventEditor(mapId, selectedEvent);
  section.append(renderSelectedEventSummary(mapId, selectedEvent));
  container.append(section);
}

function renderSelectedEventSummary(mapId: MapId, event: GameEvent): HTMLElement {
  const pageCount = event.pages?.length ?? 0;
  const summary = el("div", {
    class: "event-editor-launch",
    dataset: { testid: "event-editor-launch" },
  });
  summary.append(
    el("div", { class: "event-editor-launch-title", text: event.id }),
    el("div", { class: "event-editor-launch-meta", text: `Position ${event.x},${event.y} / ${pageCount} page(s)` }),
    el("button", {
      class: "btn primary",
      text: "Open Event Editor",
      dataset: { testid: "event-editor-open" },
      on: { click: () => openEventEditorModal(mapId, event.id) },
    })
  );
  return summary;
}

function renderMapEventList(mapId: MapId, events: readonly GameEvent[], selectedEventId: string | null): HTMLElement {
  const list = el("div", { class: "event-list", dataset: { testid: "event-list" } });
  list.append(el("div", { class: "event-list-title", text: "Map Event List" }));
  if (events.length === 0) {
    list.append(el("div", { class: "event-list-empty", text: "No events on this map." }));
    return list;
  }
  for (const event of events) {
    const row = el("button", {
      class: "event-list-row" + (event.id === selectedEventId ? " active" : ""),
      attrs: { type: "button", title: "Select event. Double-click to edit." },
      dataset: { testid: `event-list-row-${event.id}` },
      on: {
        click: () => selectEvent(event),
        dblclick: () => openEventEditorModal(mapId, event.id),
      },
    });
    row.append(
      el("span", { class: "event-list-id", text: event.id }),
      el("span", { class: "event-list-meta", text: `${event.x},${event.y} / ${event.pages?.length ?? 0}p` })
    );
    list.append(row);
  }
  return list;
}

function selectEvent(event: GameEvent): void {
  editorState.set({
    tool: "event",
    layer: "event",
    selectedEventId: event.id,
    selectedEventPageId: latestPageId(event),
  });
}

function latestPageId(event: GameEvent): string | null {
  const pages = event.pages ?? [];
  return pages[pages.length - 1]?.id ?? null;
}

function maybeAutoOpenEventEditor(mapId: MapId, event: GameEvent): void {
  const eventKey = `${mapId}:${event.id}`;
  if (lastAutoOpenedEventKey === eventKey || isEventEditorModalOpenFor(mapId, event.id)) return;
  lastAutoOpenedEventKey = eventKey;
  queueMicrotask(() => {
    const state = editorState.get();
    const currentMapId = state.currentMapId ?? store.getCurrent().startMapId;
    if (currentMapId === mapId && state.selectedEventId === event.id) {
      openEventEditorModal(mapId, event.id);
    }
  });
}
