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
import { LOCATION_ROLES, hasLocationRole, locationRoleTag, projectLocationRoles, type LocationRole } from "@/project/locationRoles";
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
      // 편집이 성공했으면 역할 투영을 다시 맞춘다. 구역을 옮기거나 지우면
      // safeZones/farmableArea 가 옛 자리에 남기 때문이다(2026-09-12 브라우저 QA 실측).
      // 편집마다 여기 한 곳에서 부르는 이유: 옮기기·크기·삭제·역할 토글이 모두 이 함수를 지난다.
      if (result.ok) projectLocationRoles(map);
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
      repaired = repairMapLocationReferences(project, missingLocationId, plan, mapId).repaired;
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
  const project = store.getCurrent();
  const map = currentLocationMap();
  return countLocationReferences(project, locationId, map?.id);
}

// ───────────────────────────────────────────── 로케이션 역할 (2026-09-12)

const LOCATION_ROLE_LABELS_KO: Record<LocationRole, string> = { safeZone: "안전지대", farmable: "경작지" };

/**
 * 그 구역의 역할을 켜고 끈다. 역할은 하나만 갖고, 켜면 `safeZones`/`farmableArea` 로 **투영**된다.
 *
 * 무변경이면 스냅샷을 밀지 않는다 — 같은 역할을 두 번 켠 사람의 Ctrl+Z 가 빈 스냅샷으로 가면
 * 안 된다(일괄 이관 창에서 실측으로 잡힌 함정과 같은 규칙).
 */
export function setLocationRole(locationId: string, role: LocationRole | null): LocationActionResult {
  const map = currentLocationMap();
  if (!map) return { ok: false, error: "맵이 선택되지 않았습니다." };
  const current = (map.locations ?? []).find((entry) => entry.id === locationId);
  if (!current) return { ok: false, error: "구역을 찾을 수 없습니다." };
  const previous = locationRoleTag(current);
  const next = role ?? undefined;
  if (previous === next) {
    // 역할은 그대로지만 투영이 어긋나 있을 수 있다(옛 저장본·코드가 넣은 사각형).
    // 그 경우만 다시 맞춘다 — 무변경이면 스냅샷도 밀지 않는다.
    return projectRolesIfNeeded(map);
  }
  return editMap("역할", (draft) => {
    const target = (draft.locations ?? []).find((entry) => entry.id === locationId);
    if (!target) return { ok: false, error: "구역을 찾을 수 없습니다." };
    const kept = (target.tags ?? []).filter((tag) => !(LOCATION_ROLES as readonly string[]).includes(tag));
    const tags = next === undefined ? kept : [...kept, next];
    const updated = updateMapLocationFields(draft, locationId, {
      tags: tags.length > 0 ? tags : undefined,
    });
    if (!updated.ok) return { ok: false, error: updated.error };
    projectLocationRoles(draft);
    return {
      ok: true,
      message:
        next === undefined
          ? "구역 역할을 뗐습니다."
          : '구역을 ' + LOCATION_ROLE_LABELS_KO[next] + '(으)로 표시했습니다.',
    };
  });
}

/** 이미 켜 둔 역할의 투영이 어긋나 있으면 맞춘다. 아니면 아무 일도 하지 않는다. */
function projectRolesIfNeeded(map: ReturnType<typeof currentLocationMap>): LocationActionResult {
  if (!map) return { ok: false, error: "맵이 선택되지 않았습니다." };
  const hasRole = (map.locations ?? []).some((entry) => hasLocationRole(entry, "safeZone") || hasLocationRole(entry, "farmable"));
  if (!hasRole) return { ok: true };
  return editMap("역할 투영", (draft) => {
    const changed = projectLocationRoles(draft);
    return changed === 0 ? { ok: true } : { ok: true, message: "맵의 역할 사각형을 다시 맞췄습니다." };
  });
}
