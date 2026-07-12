import { deleteEvent } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import { forgetEventDraftVaultEntry, persistEventDraftVaultNow } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

const EVENT_DELETE_CONFIRMATION_MESSAGE = "이 이벤트를 삭제할까요?";

export function deleteEditorEvent(mapId: MapId, eventId: string): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map?.events.some((event) => event.id === eventId)) return false;
  // Drop vault first so preserve-on-replace cannot resurrect a deleted event.
  forgetEventDraftVaultEntry(mapId, eventId);
  persistEventDraftVaultNow();
  deleteEvent(mapId, eventId);
  if (editorState.get().selectedEventId === eventId) {
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
  }
  return true;
}

export function requestEditorEventDeletion(mapId: MapId, eventId: string): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map?.events.some((event) => event.id === eventId)) return false;
  if (!confirmEventDeletion()) return false;
  return deleteEditorEvent(mapId, eventId);
}

export function deleteSelectedEditorEvent(): boolean {
  const state = editorState.get();
  const eventId = state.selectedEventId;
  if (!eventId) return false;
  const mapId = state.currentMapId ?? store.getCurrent().startMapId;
  return requestEditorEventDeletion(mapId, eventId);
}

function confirmEventDeletion(): boolean {
  if (typeof globalThis.confirm !== "function") return false;
  return globalThis.confirm(EVENT_DELETE_CONFIRMATION_MESSAGE);
}
