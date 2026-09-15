import { editorState, type EditorState } from "@/editor/editorState";
import { checkoutMapForEditing } from "@/editor/mapEditLocks";
import { exceedsMapDimensionLimit, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";

export interface SelectEditorMapOptions {
  readonly clearEventSelection?: boolean;
}

/**
 * `selectEditorMap` 이 실제로 이 맵을 열 수 있는가.
 *
 * 화면 전환(크로스페이드)을 깔기 전에 먼저 묻는다 — 열 수 없는 맵에 베일부터 씌우면
 * 아무 일도 안 일어나는 전환이 한 번 깜빡이고, 호출부는 성공/실패를 동기로 못 받는다.
 */
export function canOpenEditorMap(mapId: MapId): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map) return false;
  return !exceedsMapDimensionLimit(map.width, map.height);
}

export function selectEditorMap(mapId: MapId, options: SelectEditorMapOptions = {}): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return false;
  // 지원 상한 밖 맵은 캔버스를 열지 않는다. 구/외부 데이터로 들어온 초대형 맵은 목록·lint 로
  // 식별하고 삭제할 수 있어야 하는데, 행을 누르거나 우클릭만 해도 이 함수를 타서 전체 맵
  // 렌더·선택 처리가 먼저 걸렸다. 데이터 조작(이름/삭제)은 그대로 되므로 회복 경로는 남는다.
  if (exceedsMapDimensionLimit(map.width, map.height)) {
    toast(`${mapSizeLimitMessage()} '${map.name || mapId}' (${map.width}×${map.height})은 열 수 없습니다 — 맵 목록에서 삭제하세요.`, "error");
    return false;
  }

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
  // 시작 맵이 지원 상한 밖이면(외부/구 데이터) 열 수 있는 맵으로 넘어간다 — 안 그러면
  // 프로젝트 교체 직후 캔버스가 계속 비어 삭제할 목록조차 못 보게 된다.
  const openable = Object.values(project.maps).filter((map) => !exceedsMapDimensionLimit(map.width, map.height));
  const preferred = openable.find((map) => map.id === project.startMapId) ?? openable[0];
  if (!preferred) {
    editorState.set({ currentMapId: null, selectedEventId: null, selectedEventPageId: null });
    return false;
  }
  return selectEditorMap(preferred.id);
}

/** 현재 선택 맵이 프로젝트에 없으면 start 맵(또는 첫 맵) id를 돌려준다. */
export function resolveCurrentMapId(): MapId | null {
  const project = store.getCurrent();
  const preferred = editorState.get().currentMapId;
  if (preferred && project.maps[preferred]) return preferred;
  if (project.maps[project.startMapId]) return project.startMapId;
  return Object.keys(project.maps)[0] ?? null;
}
