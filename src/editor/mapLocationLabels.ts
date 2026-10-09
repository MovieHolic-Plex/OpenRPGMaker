// editor/mapLocationLabels.ts
// 편집기가 로케이션 참조를 사람 말로 바꾸는 유일한 곳. 요약줄·조건 문장·검증 메시지가
// 같은 낱말을 쓰게 하려고 한 곳에 모았다.
//
// 계약: 참조가 끊겼으면 **그 사실이 보이는 문자열**을 낸다("(삭제된 로케이션 …)").
// 조용히 ID 를 그대로 흘리면 저작자가 무엇이 깨졌는지 못 본다.

import { store } from "@/project/store";
import { findLocationById } from "@/project/mapNamedLocations";
import type { MapNamedLocation, Project } from "@/project/types";

/** 편집기 컨텍스트에서 이 ID 가 가리키는 로케이션. 현재 맵 → 나머지 맵 순으로 찾는다. */
export function lookupLocation(
  locationId: string,
  options: { readonly project?: Project; readonly mapId?: string } = {},
): MapNamedLocation | undefined {
  const project = options.project ?? store.getCurrent();
  const preferred = options.mapId ? project.maps[options.mapId] : undefined;
  if (preferred) {
    const hit = findLocationById(preferred, locationId);
    if (hit) return hit;
  }
  for (const map of Object.values(project.maps)) {
    const hit = findLocationById(map, locationId);
    if (hit) return hit;
  }
  return undefined;
}

/** 조건/요약에 쓰는 표시명. 빈 ID 는 미지정, 없는 ID 는 끊긴 참조로 보인다. */
export function mapLocationLabel(
  locationId: string,
  options: { readonly project?: Project; readonly mapId?: string } = {},
): string {
  const trimmed = locationId.trim();
  if (!trimmed) return "로케이션 선택";
  const location = lookupLocation(trimmed, options);
  if (!location) return `(삭제된 로케이션 ${trimmed})`;
  return location.name;
}

/** 「구역 안/밖」 조건 한 줄. 이벤트 명령 요약과 페이지 조건 문장이 공유한다. */
export function insideLocationSentence(
  locationId: string,
  inside: boolean,
  options: { readonly project?: Project; readonly mapId?: string } = {},
): string {
  return `주인공이 ${mapLocationLabel(locationId, options)} ${inside ? "안" : "밖"}에 있음`;
}
