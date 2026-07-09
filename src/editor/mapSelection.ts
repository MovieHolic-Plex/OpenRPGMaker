import { editorState, type EditorState } from "@/editor/editorState";
import { checkoutMapForEditing } from "@/editor/mapEditLocks";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

export interface SelectEditorMapOptions {
  readonly clearEventSelection?: boolean;
}

export function selectEditorMap(mapId: MapId, options: SelectEditorMapOptions = {}): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return false;

  const clearEventSelection = options.clearEventSelection ?? true;
  const state = editorState.get();
  const patch: Partial<EditorState> = {};
  if (state.currentMapId !== mapId) patch.currentMapId = mapId;
  if (clearEventSelection) {
    patch.selectedEventId = null;
    patch.selectedEventPageId = null;
  }
  if (Object.keys(patch).length > 0) editorState.set(patch);

  void checkoutMapForEditing(mapId, map.name || mapId);
  return true;
}
