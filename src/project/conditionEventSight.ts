// 「이 이벤트가 주인공을 볼 수 있는가」 — 집주인이 도둑을 보는지, 경비가 침입자를 보는지 같은 시선 판정.
//
// 명령으로는 표현할 수 없어서 조건 한 가지로 둔다: 어떤 조건도 호스트가 아닌 이벤트의 위치·방향을 읽지 못한다.
// 위치는 호출측이 넘긴 런타임 위치(`options.eventPositions`, 걷는 NPC 의 실시간 칸)를 먼저 보고,
// 없으면 세션 `eventLocations` 를 본다. 둘 다 없으면 **거짓**이다(안 보이는 것을 보이는 것으로 통과시키지 않는다).
//
// 판정(모두 만족해야 참):
//  1. 거리: 체비셰프 거리 ≤ range(기본 5).
//  2. 같은 방(sameRoom): 명명 로케이션(`GameMap.locations`) 중 두 칸을 함께 담는 사각형이 있다.
//     방 경계가 곧 벽이다 — 칸막이 너머는 시선이 닿지 않는다. 방 사각형이 없으면 거짓.
//  3. 시선(requireFacing, 기본 켜짐): 이벤트가 바라보는 방향의 90° 부채꼴 안에 주인공이 있다. 같은 칸·옆칸 앞은 포함.
import type { Dir } from "@/project/types";

export interface SightLocation {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface SightPoint {
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
}

export interface EventSightSpec {
  readonly range?: number;
  readonly requireFacing?: boolean;
  readonly sameRoom?: boolean;
}

export const DEFAULT_SIGHT_RANGE = 5;

const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function contains(room: SightLocation, p: { x: number; y: number }): boolean {
  return p.x >= room.x && p.y >= room.y && p.x < room.x + Math.max(0, room.w) && p.y < room.y + Math.max(0, room.h);
}

/** 두 칸을 함께 담는 로케이션이 있는가. */
export function shareRoom(locations: readonly SightLocation[] | undefined, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return (locations ?? []).some((room) => contains(room, a) && contains(room, b));
}

/** from 이 dir 을 볼 때 to 가 정면 90° 부채꼴 안에 있는가(옆으로 벌어진 폭 ≤ 앞으로 간 거리). */
export function inViewCone(from: { x: number; y: number }, dir: Dir, to: { x: number; y: number }): boolean {
  const d = DELTA[dir];
  const forward = (to.x - from.x) * d.dx + (to.y - from.y) * d.dy;
  const lateral = Math.abs((to.x - from.x) * d.dy - (to.y - from.y) * d.dx);
  if (forward === 0 && lateral === 0) return true;
  return forward > 0 && lateral <= forward;
}

export function eventSeesPlayer(
  eventPoint: SightPoint | undefined,
  player: { x: number; y: number },
  spec: EventSightSpec,
  locations: readonly SightLocation[] | undefined
): boolean {
  if (!eventPoint) return false;
  const range = Math.max(0, spec.range ?? DEFAULT_SIGHT_RANGE);
  if (Math.max(Math.abs(eventPoint.x - player.x), Math.abs(eventPoint.y - player.y)) > range) return false;
  if (spec.sameRoom !== false && !shareRoom(locations, eventPoint, player)) return false;
  if (spec.requireFacing !== false) return inViewCone(eventPoint, eventPoint.direction ?? "down", player);
  return true;
}
