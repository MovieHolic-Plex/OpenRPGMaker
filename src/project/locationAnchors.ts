// project/locationAnchors.ts
// 로케이션을 **좌표 대신** 가리키는 자리들의 공용 해석기 (2026-09-12).
//
// 왜 필요한가: 인카운터(`conditions.locationId`)는 이미 이름으로 구역을 가리키는데,
// 필드 스폰·퀘스트는 아직 좌표를 찍는다. 그래서 구역을 옮기면 스폰과 퀘스트 목적지만
// 옛 자리에 남고, 사람은 좌표를 손으로 맞춰야 한다. 인카운터가 이미 증명한 패턴을
// 같은 모양으로 넓힌다.
//
// ## 좌표를 지우지 않는 이유
//
// `locationId` 를 새로 받는 자리는 전부 **추가 필드**다. 좌표는 그대로 남는다:
//   1. 옛 저장본이 그대로 동작한다(마이그레이션 없음).
//   2. 구역을 지우면 lint 가 끊긴 참조를 올리고, 사람이 고를 때까지 옛 좌표로 계속 돈다 —
//      조용히 목적지를 잃는 것보다 낫다.
//   3. 둘 다 있으면 **locationId 가 이긴다**(인카운터와 같은 규칙).
//
// 좌표와 로케이션은 **다른 맵을 가리킬 수 있다**(퀘스트). 그래서 해석기는 맵을 명시로 받는다.

import { findLocationById } from "./mapNamedLocations";
import type { GameMap, Project, Rect } from "./types";

export type LocationAnchor = { readonly locationId?: string };

/** 로케이션 사각형의 중심 칸. 1×1 이면 그 칸이다. */
export function locationCenter(rect: Rect): { readonly x: number; readonly y: number } {
  return { x: rect.x + Math.floor(Math.max(1, rect.w) / 2), y: rect.y + Math.floor(Math.max(1, rect.h) / 2) };
}

/**
 * 앵커가 가리키는 로케이션의 사각형. 없으면 null(호출측은 옛 좌표로 돈다).
 *
 * 맵을 명시로 받는 이유: 퀘스트 목적지는 다른 맵의 구역을 가리킬 수 있고, `findLocationById`
 * 는 그 맵 안에서만 유일하다(`loc1`) — 맵을 안 좁히면 다른 장소를 집는다.
 */
export function resolveLocationAnchorRect(
  project: Pick<Project, "maps">,
  mapId: string | undefined,
  anchor: LocationAnchor,
): Rect | null {
  if (!anchor.locationId || !mapId) return null;
  const map: GameMap | undefined = project.maps[mapId];
  if (!map) return null;
  const location = findLocationById(map, anchor.locationId);
  if (!location) return null;
  return { x: location.x, y: location.y, w: location.w, h: location.h };
}

/** 앵커가 있으면 그 중심, 없거나 끊겼으면 fallback(옛 좌표). */
export function resolveAnchorPoint(
  project: Pick<Project, "maps">,
  mapId: string | undefined,
  anchor: LocationAnchor,
  fallback: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number; readonly fromLocation: boolean } {
  const rect = resolveLocationAnchorRect(project, mapId, anchor);
  if (!rect) return { ...fallback, fromLocation: false };
  return { ...locationCenter(rect), fromLocation: true };
}
