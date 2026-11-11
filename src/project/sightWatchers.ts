// 시선 조건(eventSeesPlayer)의 선택 칸 — 「누가 보나」 고르기(watchers)와 닫힌 문 막기(doorsBlock).
// 둘 다 생략하면 이 파일은 쓰이지 않는다(예전 동작 그대로).
import type { SightBlocker, SightLocation, SightPoint } from "@/project/conditionEventSight";
import type { EventSightWatchers } from "@/project/types";

/** 판정에 필요한 이벤트 조각. GameEvent 가 구조적으로 만족한다. */
export interface SightMapEvent {
  readonly id: string;
  readonly name?: string;
  readonly characterId?: string;
  readonly x: number;
  readonly y: number;
  readonly commands?: readonly unknown[];
  readonly pages?: readonly { readonly commands?: readonly unknown[] }[];
}

/** watchers 의 칸이 하나라도 채워졌는가. 빈 고르기는 아무도 고르지 않는다(편집기 lint 가 잡는다). */
export function watchersHaveSelector(watchers: EventSightWatchers | undefined): boolean {
  return Boolean(watchers?.characterId?.trim() || watchers?.name?.trim() || watchers?.locationId?.trim());
}

function inside(room: SightLocation, p: { x: number; y: number }): boolean {
  return p.x >= room.x && p.y >= room.y && p.x < room.x + Math.max(0, room.w) && p.y < room.y + Math.max(0, room.h);
}

/** 이 맵에서 고르기에 맞는 이벤트 id. 위치는 실시간 칸(pointOf)이 있으면 그것, 없으면 저작 칸. */
export function sightWatcherIds(
  events: readonly SightMapEvent[] | undefined,
  watchers: EventSightWatchers,
  locations: readonly SightLocation[] | undefined,
  pointOf?: (eventId: string) => SightPoint | undefined,
): string[] {
  if (!watchersHaveSelector(watchers)) return [];
  const characterId = watchers.characterId?.trim();
  const name = watchers.name?.trim();
  const room = watchers.locationId?.trim() ? locations?.find((entry) => entry.id === watchers.locationId) : undefined;
  if (watchers.locationId?.trim() && !room) return [];
  return (events ?? []).filter((event) => {
    if (characterId && event.characterId !== characterId) return false;
    if (name && !(event.name ?? "").includes(name)) return false;
    if (room && !inside(room, pointOf?.(event.id) ?? event)) return false;
    return true;
  }).map((event) => event.id);
}

const DOOR_KINDS = new Set(["transfer", "callMapEvent"]);

function hasDoorCommand(commands: readonly unknown[] | undefined): boolean {
  return (commands ?? []).some((raw) => typeof raw === "object" && raw !== null && DOOR_KINDS.has(String((raw as { kind?: unknown }).kind)));
}

/** 문 이벤트 — 장소 이동·맵 이벤트 호출을 가진 이벤트(eventPassageBlock 의 문 판정과 같은 규칙). */
export function isSightDoorEvent(event: SightMapEvent): boolean {
  return hasDoorCommand(event.commands) || (event.pages ?? []).some((page) => hasDoorCommand(page.commands));
}

/** 벽 판정에 문 이벤트 칸을 더한다. 문이 없으면 원래 판정을 그대로 돌려준다. */
export function withDoorBlocker(
  base: SightBlocker | undefined,
  events: readonly SightMapEvent[] | undefined,
  pointOf?: (eventId: string) => SightPoint | undefined,
): SightBlocker | undefined {
  const doors = new Set((events ?? []).filter(isSightDoorEvent).map((event) => {
    const at = pointOf?.(event.id) ?? event;
    return `${at.x},${at.y}`;
  }));
  if (doors.size === 0) return base;
  return (x, y) => doors.has(`${x},${y}`) || (base?.(x, y) ?? false);
}
