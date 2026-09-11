// editor/mapLocationLayerState.ts
// 로케이션 레이어의 **상태와 행위**. DOM 을 만들지 않는다 — 오버레이(mapLocationLayer.ts)와
// 패널이 같은 상태기계를 구독한다. 순수 규칙은 `project/mapNamedLocations.ts` 가 갖고,
// 이 모듈은 store 편집(라벨 있는 mutation)과 선택/드래그 상태만 갖는다.
//
// 계약:
//  - 레이어가 꺼져 있으면 포인터 이벤트를 일절 받지 않는다(기존 타일 편집을 방해하지 않는다).
//  - 모든 편집은 `store.update(..., { scope: "map", mapId, label })` 를 지난다 —
//    라벨 없는 mutation 은 편집 감사 로그에 «라벨 없음» 으로 남는다(editor-observability 계약).
//  - 삭제는 참조를 함께 지우지 않는다. 영향 요약을 반환해 UI 가 눈에 보이는 진단을 낸다.

import { editorState } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import {
  addMapLocation,
  deleteMapLocation,
  findLocationById,
  mapLocations,
  overlappingLocations,
  renameMapLocation,
  resizeMapLocation,
  topLocationAtPoint,
  updateMapLocationFields,
  type LocationPoint,
} from "@/project/mapNamedLocations";
import {
  countLocationReferences,
  describeLocationReferenceImpact,
  repairMapLocationReferences,
  type LocationRepairPlan,
} from "@/project/mapLocationReferences";
import type { GameMap, MapNamedLocation, Rect } from "@/project/types";

/** 레이어 표시 여부. `localStorage` 에 남겨 다시 열어도 같은 상태다. */
export const LOCATION_LAYER_STORAGE_KEY = "oprn:map-location-layer";

export type LocationDragState =
  | { readonly kind: "draw"; readonly from: LocationPoint; readonly to: LocationPoint }
  | { readonly kind: "resize"; readonly locationId: string; readonly anchor: LocationPoint; readonly to: LocationPoint }
  | { readonly kind: "move"; readonly locationId: string; readonly grab: LocationPoint; readonly origin: Rect };

export type LocationLayerState = {
  readonly enabled: boolean;
  readonly selectedId: string | null;
  readonly drag: LocationDragState | null;
  /** 빌더 설계 영역(layoutPlan.regions) 참고 표시. 기본 꺼짐 — 사람 레이어와 섞이면 안 된다. */
  readonly showLayoutRegions: boolean;
};

type Listener = (state: LocationLayerState) => void;

let state: LocationLayerState = {
  enabled: readStoredEnabled(),
  selectedId: null,
  drag: null,
  showLayoutRegions: false,
};
const listeners = new Set<Listener>();

function readStoredEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(LOCATION_LAYER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (enabled) localStorage.setItem(LOCATION_LAYER_STORAGE_KEY, "1");
    else localStorage.removeItem(LOCATION_LAYER_STORAGE_KEY);
  } catch {
    // 저장 실패는 세션 상태만으로 계속 동작한다.
  }
}

function writeLocationDrawFlag(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) document.body.dataset.locationDraw = "1";
  else delete document.body.dataset.locationDraw;
}

export function locationLayerState(): LocationLayerState {
  return state;
}

export function subscribeLocationLayer(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<LocationLayerState>): void {
  const next = { ...state, ...patch };
  if (
    next.enabled === state.enabled &&
    next.selectedId === state.selectedId &&
    next.drag === state.drag &&
    next.showLayoutRegions === state.showLayoutRegions
  ) {
    return;
  }
  state = next;
  for (const listener of listeners) listener(state);
}

export function setLocationLayerEnabled(enabled: boolean): void {
  writeStoredEnabled(enabled);
  writeLocationDrawFlag(enabled);
  // 레이어를 끄면 선택과 진행 중 드래그를 반드시 버린다 — 남겨 두면 다시 켤 때
  // 사라진 로케이션을 가리키는 유령 선택이 살아난다.
  set(enabled ? { enabled } : { enabled, selectedId: null, drag: null });
}

export function toggleLocationLayer(): void {
  setLocationLayerEnabled(!state.enabled);
}

export function setShowLayoutRegions(show: boolean): void {
  set({ showLayoutRegions: show });
}

export function selectLocation(locationId: string | null): void {
  set({ selectedId: locationId });
}

export function setLocationDrag(drag: LocationDragState | null): void {
  set({ drag });
}

/** 현재 편집 중인 맵. 레이어의 모든 행위가 이 맵 하나만 본다. */
export function currentLocationMap(): GameMap | undefined {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  return project.maps[mapId];
}

export function currentLocationMapId(): string | undefined {
  return currentLocationMap()?.id;
}

export function currentLocations(): readonly MapNamedLocation[] {
  const map = currentLocationMap();
  return map ? mapLocations(map) : [];
}

export function selectedLocation(): MapNamedLocation | undefined {
  const map = currentLocationMap();
  if (!map || !state.selectedId) return undefined;
  return findLocationById(map, state.selectedId);
}

export type LocationActionResult = { readonly ok: true; readonly message?: string } | { readonly ok: false; readonly error: string };

function editMap(label: string, mutate: (map: GameMap) => LocationActionResult): LocationActionResult {
  const mapId = currentLocationMapId();
  if (!mapId) return { ok: false, error: "맵이 선택되지 않았습니다." };
  if (!canEditMap(mapId)) return { ok: false, error: mapEditLockNotice(mapId) };
  // 로케이션 편집은 타일 획이 아니라 되돌릴 수 있어야 하는 저작 단위다 — 프로젝트 스냅샷 1건.
  recordProjectSnapshot(`로케이션 ${label}`);
  let result: LocationActionResult = { ok: false, error: "맵을 찾을 수 없습니다." };
  store.update(
    (project) => {
      const map = project.maps[mapId];
      if (!map) return;
      result = mutate(map);
    },
    { scope: "map", mapId, label: `로케이션 ${label}` },
  );
  return result;
}

export function createLocationFromRect(rect: Rect, name?: string): LocationActionResult {
  let createdId: string | undefined;
  const result = editMap("추가", (map) => {
    const added = addMapLocation(map, { ...rect, ...(name === undefined ? {} : { name }) });
    if (!added.ok) return { ok: false, error: added.error };
    createdId = added.location.id;
    return { ok: true, message: `'${added.location.name}' 구역을 만들었습니다.` };
  });
  if (result.ok && createdId) selectLocation(createdId);
  return result;
}

export function renameSelectedLocation(locationId: string, name: string): LocationActionResult {
  return editMap("이름 변경", (map) => {
    const renamed = renameMapLocation(map, locationId, name);
    return renamed.ok ? { ok: true } : { ok: false, error: renamed.error };
  });
}

export function resizeLocation(locationId: string, rect: Rect): LocationActionResult {
  return editMap("크기 변경", (map) => {
    const resized = resizeMapLocation(map, locationId, rect);
    return resized.ok ? { ok: true } : { ok: false, error: resized.error };
  });
}

export function updateLocationNote(locationId: string, note: string): LocationActionResult {
  return editMap("메모", (map) => {
    const updated = updateMapLocationFields(map, locationId, { note });
    return updated.ok ? { ok: true } : { ok: false, error: updated.error };
  });
}

export type LocationDeletionImpact = {
  readonly locationId: string;
  readonly name: string;
  readonly rect: Rect;
  /** 이 로케이션을 가리키는 조건·인카운터 전량(사람이 읽을 경로). */
  readonly sites: readonly string[];
};

/** 삭제 전에 무엇이 끊기는지 센다. UI 가 확인 대화창에 그대로 쓴다. */
export function locationDeletionImpact(locationId: string): LocationDeletionImpact | undefined {
  const map = currentLocationMap();
  if (!map) return undefined;
  const location = findLocationById(map, locationId);
  if (!location) return undefined;
  const project = store.getCurrent();
  return {
    locationId,
    name: location.name,
    rect: { x: location.x, y: location.y, w: location.w, h: location.h },
    sites: describeLocationReferenceImpact(project, map, locationId),
  };
}

export function deleteLocation(locationId: string): LocationActionResult {
  const impact = locationDeletionImpact(locationId);
  const result = editMap("삭제", (map) => {
    const removed = deleteMapLocation(map, locationId);
    if (!removed) return { ok: false, error: "이미 삭제된 로케이션입니다." };
    return {
      ok: true,
      message:
        impact && impact.sites.length > 0
          ? `'${impact.name}' 삭제 — 끊긴 참조 ${impact.sites.length}건. 아래 문제 목록에서 다시 지정하거나 조건을 뗄 수 있습니다.`
          : undefined,
    };
  });
  if (result.ok && state.selectedId === locationId) selectLocation(null);
  return result;
}

/** 끊긴 참조 복구. 여기가 유일한 복구 경로다(자동 삭제는 없다). */
export function repairBrokenLocationReferences(missingLocationId: string, plan: LocationRepairPlan): LocationActionResult {
  const mapId = currentLocationMapId();
  if (!mapId) return { ok: false, error: "맵이 선택되지 않았습니다." };
  if (!canEditMap(mapId)) return { ok: false, error: mapEditLockNotice(mapId) };
  recordProjectSnapshot("로케이션 참조 복구");
  let repaired = 0;
  store.update(
    (project) => {
      repaired = repairMapLocationReferences(project, missingLocationId, plan).repaired;
    },
    { scope: "project", label: "로케이션 참조 복구" },
  );
  if (repaired === 0) return { ok: false, error: "고칠 참조를 찾지 못했습니다." };
  return {
    ok: true,
    message:
      plan.kind === "remap"
        ? `참조 ${repaired}건을 다른 구역으로 다시 지정했습니다.`
        : plan.kind === "freezeRect"
          ? `참조 ${repaired}건을 예전 사각형으로 굳혔습니다(이름 없는 좌표로 강등).`
          : `참조 ${repaired}건에서 구역 조건을 떼어냈습니다.`,
  };
}

// 빌더 설계 영역 승격의 **사람 경로는 여기에 없다.** 「설계 영역 이관」 창
// (`editor/panels/mapLocationAdoptionPanel.ts` + `editor/mapLocationAdoptionState.ts`)이 유일하다:
// 조사 → 역할 필터 → 맵 선택 → 실행 → 영수증. 예전에 있던 «이 맵 전부 한 방에» 버튼은
// 무엇이 생기는지 보여 주지 않아 되돌리기 전에는 검토가 불가능했으므로 없앴다.

/** 그 칸에서 선택될 로케이션(겹침 우선순위는 순수 모듈이 정한다). */
export function locationAt(point: LocationPoint): MapNamedLocation | undefined {
  const map = currentLocationMap();
  return map ? topLocationAtPoint(map, point) : undefined;
}

export function selectedOverlaps(): readonly MapNamedLocation[] {
  const map = currentLocationMap();
  if (!map || !state.selectedId) return [];
  return overlappingLocations(map, state.selectedId);
}

export function locationReferenceCount(locationId: string): number {
  return countLocationReferences(store.getCurrent(), locationId);
}
