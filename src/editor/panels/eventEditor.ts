import { editorState } from "@/editor/editorState";
import {
  eventDisplayName as sharedEventDisplayName,
} from "@/editor/eventMarkerUx";
import { ensureEventPages } from "@/editor/eventPages";
import { handleEditorDeleteKey } from "@/editor/hotkeys";
import { editorWorkingEvents } from "@/project/eventDrafts";
import { store } from "@/project/store";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import type { EventPageGraphic, GameEvent, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderEventGraphicIcon } from "./eventEditor/eventGraphicPreview";
import { renderEventIdReadout } from "./eventEditor/eventIdReadout";
import { scrollIntoNearestScroller } from "./eventEditor/scrollIntoNearestScroller";
import { bindEventListRowHoverTooltip, hideEventListTooltip } from "./eventListHoverTooltip";
import { openEventEditorModal } from "./eventEditor/modal";

export { renderEventEditorInline } from "./eventEditor/inline";

export function renderEventEditor(container: HTMLElement): void {
  hideEventListTooltip();
  const section = el("div", {
    class: "panel-section event-editor event-editor-sidebar",
    dataset: { testid: "palette-event-pane" },
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

  const events = editorWorkingEvents(map.events);
  const selectedEvent = state.selectedEventId
    ? events.find((event) => event.id === state.selectedEventId)
    : undefined;

  section.append(renderMapEventList(mapId, events, state.selectedEventId));

  if (!selectedEvent) {
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
    dataset: { testid: "event-editor-launch", eventId: event.id },
  });
  summary.append(
    el("div", { class: "event-editor-launch-title", text: displayName }),
    el("div", { class: "event-editor-launch-meta", text: `위치 ${event.x},${event.y} / ${pageCount} 페이지` }),
    // 이름·좌표·페이지 수만 있던 자리에 정본 ID 를 세운다. 지금까지 이 값은 목록 호버
    // 카드와 전역 검색에만 있어서 «값을 이미 아는 사람»만 볼 수 있었다(OPRN-OUT-014).
    renderEventIdReadout(event.id, { scope: "event-summary" }),
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
    // 다음 행동을 말한다 — 「없습니다」 만으로는 어떻게 놓는지 알 수 없었다(2026-09-24 visual QA).
    list.append(el("div", { class: "event-list-empty", text: "이 맵에는 이벤트가 없습니다. 맵의 빈 칸을 더블클릭하면 새 이벤트를 만듭니다." }));
    return list;
  }
  for (const event of events) {
    const displayName = eventDisplayName(event);
    const icon = renderEventGraphicIcon(eventListGraphic(event));
    // Custom hover panel already covers details — no native title/alt tooltip.
    const row = el("button", {
      class: "event-list-row" + (event.id === selectedEventId ? " active" : ""),
      attrs: { type: "button" },
      dataset: { testid: `event-list-row-${event.id}` },
      on: {
        click: () => selectEventAndFocus(mapId, event),
        dblclick: () => openEventEditorModal(mapId, event.id),
      },
    });
    row.append(
      el("span", { class: "event-list-icon", children: [icon] }),
      el("span", { class: "event-list-name", text: displayName }),
      el("span", { class: "event-list-meta", text: `${event.x},${event.y} · ${event.pages?.length ?? 0}p` })
    );
    bindEventListRowHoverTooltip(row, event);
    list.append(row);
  }
  return list;
}

function eventDisplayName(event: GameEvent): string {
  return sharedEventDisplayName(event);
}

function eventListGraphic(event: GameEvent): EventPageGraphic {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const graphic = pages[index]?.graphic;
    if (graphic?.sprite) return graphic;
  }
  return event.sprite ? { sprite: event.sprite } : {};
}

/**
 * 이미 떠 있는 맵 이벤트 목록에서 선택 표시와 아래 요약만 옮긴다.
 * 목록이 없거나, 고른 이벤트가 그 목록에 없으면 false — 호출부가 패널을 다시 그린다.
 * 페이지가 없는 옛 이벤트도 다시 그린다. 그 경로는 기본 페이지를 만들어 저장한다.
 */
export function syncMountedEventSelection(): boolean {
  if (typeof document === "undefined") return false;
  const state = editorState.get();
  if (state.layer !== "event") return false;
  const list = document.querySelector<HTMLElement>('[data-testid="event-list"]');
  const sidebar = list?.closest<HTMLElement>(".event-editor-sidebar");
  if (!list || !sidebar) return false;

  const project = store.getCurrent();
  const mapId: MapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) return false;
  const events = editorWorkingEvents(map.events);
  const selectedId = state.selectedEventId;
  const selected = selectedId ? events.find((event) => event.id === selectedId) : undefined;
  if (selectedId && !selected) return false;
  if (selected && !selected.pages?.length) return false;

  const rows = [...list.querySelectorAll<HTMLElement>(".event-list-row")];
  const wanted = selectedId ? `event-list-row-${selectedId}` : "";
  const activeRow = wanted ? rows.find((row) => row.dataset.testid === wanted) ?? null : null;
  if (wanted && !activeRow) return false;

  let reveal = false;
  for (const row of rows) {
    const on = row === activeRow;
    if (on && !row.classList.contains("active")) reveal = true;
    row.classList.toggle("active", on);
  }

  const launch = sidebar.querySelector<HTMLElement>('[data-testid="event-editor-launch"]');
  if (!selected) {
    launch?.remove();
    return true;
  }
  if (launch?.dataset.eventId !== selected.id) {
    const next = renderSelectedEventSummary(mapId, selected);
    if (launch) launch.replaceWith(next);
    else sidebar.append(next);
  }
  // 요약 카드가 목록 아래에 붙으면 목록이 짧아진다. 그 다음에 고른 행을 넣어야
  // 맨 아래 이벤트가 카드 뒤로 숨지 않는다.
  if (activeRow && reveal) scrollIntoNearestScroller(activeRow, "nearest");
  return true;
}

function selectEvent(event: GameEvent): void {
  editorState.set({
    tool: "event",
    layer: "event",
    selectedEventId: event.id,
    selectedEventPageId: firstPageId(event),
  });
}

function selectEventAndFocus(mapId: MapId, event: GameEvent): void {
  selectEvent(event);
  requestEditorCameraFocus({ mapId, tileX: event.x, tileY: event.y });
}

function firstPageId(event: GameEvent): string | null {
  const pages = event.pages ?? [];
  return pages[0]?.id ?? null;
}
