// editor/mapPlanningActions.ts
// 맵의 보존 기획 항목(`GameMap.planningItems`)을 고치는 유일한 저작 경로.
//
// 모든 쓰기는 `store.update(..., { scope: "map", mapId })` 를 지나므로 자동 저장·되돌리기·
// 원격 동기화가 다른 맵 편집과 똑같이 동작한다. 목록이 비면 필드를 지워 옛 저장본과 같은
// 모양으로 되돌아간다(추가 필드가 프로젝트 JSON 을 영구히 늘리지 않는다).

import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import {
  MAP_PLANNING_ITEMS_MAX,
  makeMapPlanningItemId,
  normalizePlanningItemText,
  type MapPlanningItem,
  type MapPlanningItemOrigin,
} from "@/project/mapPlanningItems";
import { toast } from "@/util/toast";

function allowPlanningMutation(mapId: MapId): boolean {
  if (canEditMap(mapId)) return true;
  toast(mapEditLockNotice(mapId), "error");
  return false;
}

function writeItems(mapId: MapId, mutate: (items: MapPlanningItem[]) => void, label: string): void {
  if (!allowPlanningMutation(mapId)) return;
  store.update((project) => {
    const map = project.maps[mapId];
    if (!map) return;
    const items = [...(map.planningItems ?? [])];
    mutate(items);
    if (items.length > 0) map.planningItems = items;
    else delete map.planningItems;
  }, { scope: "map", mapId, label });
}

export function listMapPlanningItems(mapId: MapId | null | undefined): MapPlanningItem[] {
  if (!mapId) return [];
  return [...(store.getCurrent().maps[mapId]?.planningItems ?? [])];
}

/**
 * 새 항목 추가. 같은 본문이 이미 활성으로 있으면 아무 것도 하지 않는다 — 밑그림에서 담기를
 * 여러 번 눌러도 목록이 불어나지 않아야 한다. 만든 항목 id 를 돌려준다(없으면 null).
 */
export function addMapPlanningItem(
  mapId: MapId,
  text: string,
  options: { readonly origin?: MapPlanningItemOrigin; readonly specAssetId?: string } = {},
): string | null {
  const body = normalizePlanningItemText(text);
  if (!body) return null;
  let created: string | null = null;
  writeItems(mapId, (items) => {
    if (items.length >= MAP_PLANNING_ITEMS_MAX) return;
    const duplicate = items.some((item) => item.status === "active" && item.text === body);
    const sameAsset = options.specAssetId !== undefined
      && items.some((item) => item.specAssetId === options.specAssetId);
    if (duplicate || sameAsset) return;
    const id = makeMapPlanningItemId(items);
    items.push({
      id,
      text: body,
      status: "active",
      origin: options.origin ?? "user",
      createdAt: new Date().toISOString(),
      ...(options.specAssetId !== undefined ? { specAssetId: options.specAssetId } : {}),
    });
    created = id;
  }, "보존 기획 추가");
  return created;
}

/** 본문 수정. 빈 본문은 삭제가 아니라 무시다 — 지우려면 `deleteMapPlanningItem` 를 쓴다. */
export function updateMapPlanningItem(mapId: MapId, itemId: string, text: string): void {
  const body = normalizePlanningItemText(text);
  if (!body) return;
  writeItems(mapId, (items) => {
    const index = items.findIndex((item) => item.id === itemId);
    const current = items[index];
    if (!current || current.text === body) return;
    items[index] = { ...current, text: body, updatedAt: new Date().toISOString() };
  }, "보존 기획 수정");
}

/** 은퇴/복귀 — 삭제와 다르다. 은퇴 항목은 목록에 남지만 재사용 후보에서 빠진다. */
export function setMapPlanningItemRetired(mapId: MapId, itemId: string, retired: boolean): void {
  writeItems(mapId, (items) => {
    const index = items.findIndex((item) => item.id === itemId);
    const current = items[index];
    if (!current) return;
    const status = retired ? "retired" : "active";
    if (current.status === status) return;
    items[index] = { ...current, status, updatedAt: new Date().toISOString() };
  }, retired ? "보존 기획 은퇴" : "보존 기획 복귀");
}

export function deleteMapPlanningItem(mapId: MapId, itemId: string): void {
  writeItems(mapId, (items) => {
    const index = items.findIndex((item) => item.id === itemId);
    if (index >= 0) items.splice(index, 1);
  }, "보존 기획 삭제");
}
