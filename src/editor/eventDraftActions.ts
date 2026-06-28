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
  store.update((project) => {
    const map = project.maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const event = createDefaultGameEvent(x, y, trigger);
    event.draft = { kind: "new" };
    map.events.push(event);
    newId = event.id;
  });
  return newId;
}

export function beginExistingEventDraft(mapId: MapId, eventId: string): boolean {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event || event.draft?.kind === "new") return false;
  if (event.draft?.kind === "edit") return true;
  let opened = false;
  store.update((project) => {
    opened = beginEventEditDraft(project, mapId, eventId);
  });
  return opened;
}

export function saveEventDraft(mapId: MapId, eventId: string): EventDiff | null {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event?.draft) return null;
  recordProjectSnapshot();
  let diff: EventDiff | null = null;
  store.update((project) => {
    diff = commitEventDraft(project, mapId, eventId);
  });
  selectCommittedEvent(mapId, eventId);
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
  selectCommittedEvent(mapId, eventId);
  return discarded;
}

function selectCommittedEvent(mapId: MapId, eventId: string): void {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  editorState.set({
    selectedEventId: event ? eventId : null,
    selectedEventPageId: event ? latestPageId(event) : null,
  });
}

function latestPageId(event: GameEvent): string | null {
  const pages = event.pages ?? [];
  return pages[pages.length - 1]?.id ?? null;
}
