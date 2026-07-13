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

/**
 * 프로젝트 전체 교체(DB 연결, 새 프로젝트, import) 직후 호출.
 * 이전 프로젝트의 currentMapId가 남아 캔버스가 비는 문제를 막는다.
 */
export function focusProjectStartMap(): boolean {
  const project = store.getCurrent();
  const preferred = project.startMapId;
  if (project.maps[preferred]) return selectEditorMap(preferred);
  const firstId = Object.keys(project.maps)[0];
  if (!firstId) {
    editorState.set({ currentMapId: null, selectedEventId: null, selectedEventPageId: null });
    return false;
  }
  return selectEditorMap(firstId);
}

/** 현재 선택 맵이 프로젝트에 없으면 start 맵(또는 첫 맵) id를 돌려준다. */
export function resolveCurrentMapId(): MapId | null {
  const project = store.getCurrent();
  const preferred = editorState.get().currentMapId;
  if (preferred && project.maps[preferred]) return preferred;
  if (project.maps[project.startMapId]) return project.startMapId;
  return Object.keys(project.maps)[0] ?? null;
}
