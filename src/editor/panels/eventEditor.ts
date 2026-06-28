import { editorState } from "@/editor/editorState";
import { ensureEventPages } from "@/editor/eventPages";
import { committedEvents } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { GameEvent, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { openEventEditorModal } from "./eventEditor/modal";

export { renderEventEditorInline } from "./eventEditor/inline";

export function renderEventEditor(container: HTMLElement): void {
  const section = el("div", { class: "panel-section event-editor event-editor-sidebar" });
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
  const summary = el("div", {
    class: "event-editor-launch",
    dataset: { testid: "event-editor-launch" },
  });
  summary.append(
    el("div", { class: "event-editor-launch-title", text: event.id }),
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
    const row = el("button", {
      class: "event-list-row" + (event.id === selectedEventId ? " active" : ""),
      attrs: { type: "button", title: "이벤트 선택. 두 번 클릭하면 편집합니다." },
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
