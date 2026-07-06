import { editorState } from "@/editor/editorState";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  beginEventEditDraft,
  commitEventDraft,
  discardEventDraft as discardProjectEventDraft,
  type EventDiff,
} from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { GameEvent, MapId, Trigger } from "@/project/types";

export function createEventDraft(
  mapId: MapId,
  x: number,
  y: number,
  trigger: Trigger = { kind: "action" }
): string {
  let newId = "";
  let selectedPageId: string | null = null;
  store.update((project) => {
    const map = project.maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const event = createDefaultGameEvent(x, y, trigger);
    event.draft = { kind: "new" };
    map.events.push(event);
    newId = event.id;
    selectedPageId = event.pages?.[event.pages.length - 1]?.id ?? null;
  });
  if (newId) {
    editorState.set({ selectedEventId: newId, selectedEventPageId: selectedPageId });
  }
  return newId;
}

export function beginExistingEventDraft(mapId: MapId, eventId: string): boolean {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event || event.draft?.kind === "new") return false;
  if (event.draft?.kind === "edit") {
    selectEventPage(mapId, eventId, editorState.get().selectedEventPageId);
    return true;
  }
  let opened = false;
  store.update((project) => {
    opened = beginEventEditDraft(project, mapId, eventId);
  });
  if (opened) selectEventPage(mapId, eventId, editorState.get().selectedEventPageId);
  return opened;
}

export function saveEventDraft(mapId: MapId, eventId: string): EventDiff | null {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event?.draft) return null;
  const preferredPageId = editorState.get().selectedEventPageId;
  recordProjectSnapshot("이벤트 편집", mapId, { kind: "map" });
  let diff: EventDiff | null = null;
  store.update((project) => {
    diff = commitEventDraft(project, mapId, eventId);
  });
  selectEventPage(mapId, eventId, preferredPageId);
  return diff;
}

export function discardEventDraft(mapId: MapId, eventId: string): boolean {
  const draftKind = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.draft?.kind;
  if (!draftKind) return false;
  let discarded = false;
  store.update((project) => {
    discarded = discardProjectEventDraft(project, mapId, eventId);
  });
  if (draftKind === "new") {
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
    return discarded;
  }
  selectEventPage(mapId, eventId, editorState.get().selectedEventPageId);
  return discarded;
}

function selectEventPage(mapId: MapId, eventId: string, preferredPageId: string | null): void {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  const pageId = event ? selectedPageId(event, preferredPageId) : null;
  editorState.set({
    selectedEventId: event ? eventId : null,
    selectedEventPageId: pageId,
  });
}

function selectedPageId(event: GameEvent, preferredPageId: string | null): string | null {
  const pages = event.pages ?? [];
  if (preferredPageId && pages.some((page) => page.id === preferredPageId)) return preferredPageId;
  return pages[0]?.id ?? null;
}
