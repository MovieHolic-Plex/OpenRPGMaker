import { deleteEvent } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

export function deleteEditorEvent(mapId: MapId, eventId: string): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map?.events.some((event) => event.id === eventId)) return false;
  deleteEvent(mapId, eventId);
  if (editorState.get().selectedEventId === eventId) {
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
  }
  return true;
}

export function deleteSelectedEditorEvent(): boolean {
  const state = editorState.get();
  const eventId = state.selectedEventId;
  if (!eventId) return false;
  const mapId = state.currentMapId ?? store.getCurrent().startMapId;
  return deleteEditorEvent(mapId, eventId);
}
