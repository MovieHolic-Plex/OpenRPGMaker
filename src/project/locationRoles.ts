// project/locationRoles.ts
// 로케이션에 **역할**을 붙여 이미 있는 맵 시스템의 저작 표면이 되게 한다 (2026-09-12).
//
// 왜 필요한가: `map.safeZones`(추격자 안전지대)와 `map.farmableArea`(경작지)는 오래전부터
// 런타임에서 동작하는 사각형 배열인데 **사람이 그릴 수 있는 표면이 없었다**. 조수 툴과 코드가
// 좌표를 찍어 넣고, 검사기(`mapInspection`)는 개수만 칩으로 보여 줬다. 로케이션은 같은
// 모양(맵 안에서만 유효한 사각형)이라 그리는 표면을 그대로 쓸 수 있다.
//
// ## 어느 쪽이 정본인가 (한 방향만)
//
// 로케이션이 정본이고 `safeZones`/`farmableArea` 는 **투영**이다. 반대로 하지 않는 이유는
// 추격자 툴(`make_chase_scene`)과 경작 툴이 이미 그 배열을 직접 쓰기 때문이다 — 그 툴들이
// 로케이션을 만들도록 바꾸면 기존 프로젝트의 도구 계약이 조용히 달라진다.
//
// ## 유령 사각형을 남기지 않는 방법
//
// 역할 구역을 **옮기면** 옛 자리의 사각형을 지워야 한다. 현재 좌표만 보고 «우리 것» 을
// 고르면 옮긴 뒤에는 옛 자리가 식별되지 않아 유령이 남는다(2026-09-12 테스트가 잡은 결함).
// 그래서 출처(`origin.rect`)가 **마지막으로 투영한 사각형**을 기억하고, 재투영이 그것부터 지운다.
//
// 출처 없는 배열 항목은 손 저작·조수 툴의 것으로 보고 건드리지 않는다.

import type { GameMap, MapNamedLocation, Rect } from "./types";

export const LOCATION_ROLES = ["safeZone", "farmable"] as const;
export type LocationRole = (typeof LOCATION_ROLES)[number];

export function isLocationRole(value: unknown): value is LocationRole {
  return typeof value === "string" && (LOCATION_ROLES as readonly string[]).includes(value);
}

export const LOCATION_ROLE_LABELS: Record<LocationRole, string> = {
  safeZone: "안전지대",
  farmable: "경작지",
};

/** 구역이 그 역할을 갖는가. `tags` 는 이미 있는 자유 낱말 칸이라 새 필드를 만들지 않는다. */
export function hasLocationRole(location: Pick<MapNamedLocation, "tags">, role: LocationRole): boolean {
  return locationRoleTag(location) === role;
}

/** 그 구역의 역할 태그. 역할은 하나만 갖는다 — 둘이면 어느 배열의 정본인지 흐려진다. */
export function locationRoleTag(location: Pick<MapNamedLocation, "tags">): LocationRole | undefined {
  return location.tags?.find(isLocationRole);
}

function targetKeyFor(role: LocationRole): "safeZones" | "farmableArea" {
  return role === "safeZone" ? "safeZones" : "farmableArea";
}

function rectKey(rect: Rect): string {
  return `${rect.x},${rect.y},${rect.w},${rect.h}`;
}

function sameRect(a: Rect, b: Rect): boolean {
  return rectKey(a) === rectKey(b);
}

export function locationRoleRects(map: GameMap, role: LocationRole): Rect[] {
  return (map.locations ?? [])
    .filter((location) => hasLocationRole(location, role))
    .map((location) => ({ x: location.x, y: location.y, w: location.w, h: location.h }));
}

/**
 * 로케이션 역할을 `safeZones`/`farmableArea` 에 **투영**한다. 제자리 수정.
 *
 * 매 호출이 (1) 지난 투영분을 **맵 기록**으로 지우고 (2) 지금 역할 구역의 사각형을 넣고
 * (3) 기록을 새로 쓴다. 그래서 구역을 옮기거나 지워도 유령이 남지 않는다 — 로케이션 쪽에
 * 표시를 두면 구역 삭제와 함께 사라져 옛 사각형을 식별할 수 없다.
 *
 * @returns 바뀐 것(배열 + 기록)의 수. 0 이면 호출측은 스냅샷을 밀지 않는다 —
 *          무변경 실행이 되돌리기 칸을 먹으면 안 된다(일괄 이관 창에서 실측된 함정).
 */
export function projectLocationRoles(map: GameMap): number {
  let changed = 0;
  const previous = map.locationRoleProjection ?? {};
  const nextProjection: Record<string, Record<string, Rect>> = {};

  for (const role of LOCATION_ROLES) {
    const key = targetKeyFor(role);
    const current = map[key] ?? [];
    const recorded = previous[role] ?? {};

    // 1. 지난 투영분을 걷어낸다. 기록에 없는 항목은 손 저작·조수 툴의 것이다.
    const recordedRects = new Set(Object.values(recorded).map(rectKey));
    const kept = current.filter((rect) => !recordedRects.has(rectKey(rect)));

    // 2. 지금 역할 구역의 사각형을 넣는다(같은 사각형이 이미 있으면 중복으로 넣지 않는다).
    const roleLocations = (map.locations ?? []).filter((location) => hasLocationRole(location, role));
    const next = [...kept];
    for (const location of roleLocations) {
      const rect = { x: location.x, y: location.y, w: location.w, h: location.h };
      if (!next.some((existing) => sameRect(existing, rect))) next.push(rect);
    }

    const sameArray = next.length === current.length && next.every((rect, index) => sameRect(rect, current[index]!));
    if (!sameArray) {
      changed += 1;
      if (next.length > 0) map[key] = next;
      else delete map[key];
    }

    // 3. 기록을 새로 쓴다 — 다음 호출이 이것으로 이번 사각형을 지운다.
    if (roleLocations.length > 0) {
      nextProjection[role] = Object.fromEntries(
        roleLocations.map((location) => [location.id, { x: location.x, y: location.y, w: location.w, h: location.h }]),
      );
    }
  }

  if (JSON.stringify(previous) !== JSON.stringify(nextProjection)) {
    changed += 1;
    if (Object.keys(nextProjection).length > 0) map.locationRoleProjection = nextProjection;
    else delete map.locationRoleProjection;
  }
  return changed;
}
