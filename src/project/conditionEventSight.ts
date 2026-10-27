// 「이 이벤트가 주인공을 볼 수 있는가」 — 집주인이 도둑을 보는지, 경비가 침입자를 보는지 같은 시선 판정.
//
// 명령으로는 표현할 수 없어서 조건 한 가지로 둔다: 어떤 조건도 호스트가 아닌 이벤트의 위치·방향을 읽지 못한다.
// 위치는 호출측이 넘긴 런타임 위치(`options.eventPositions`, 걷는 NPC 의 실시간 칸)를 먼저 보고,
// 없으면 세션 `eventLocations` 를 본다. 둘 다 없으면 **거짓**이다(안 보이는 것을 보이는 것으로 통과시키지 않는다).
//
// 판정 — 「본다」(모두 만족해야 참):
//  1. 거리: 체비셰프 거리 ≤ range(기본 5).
//  2. 같은 방(sameRoom, 기본 켜짐): 명명 로케이션(`GameMap.locations`)을 방으로 본다. 두 칸이 같은 방에 있어야 한다.
//     어느 방에도 안 든 칸(방 사이 문틀)은 맞닿은 방 모두에 속한다 — 문간에 선 사람은 양쪽 방에서 보인다.
//     맵에 로케이션이 하나도 없으면 방 판정을 건너뛰고 아래 시선 광선만 본다(2026-10-24: 예전엔 늘 거짓이었다).
//  3. 시선 광선(sameRoom 이 꺼지지 않았을 때): 두 칸 사이 칸(슈퍼커버 광선)에 벽이 없다.
//     sameRoom=false 는 「벽과 무관한 가까움」 판정이다(옆방 기척) — 방도 광선도 보지 않는다. 벽 판정은 호출측 `blocksSight`(sightBlockers.ts —
//     벽 타일·방 사이 막힌 칸). 가구는 막지 않는다. 넘기지 않으면 광선 검사를 하지 않는다(예전 동작).
//  4. 바라봄(requireFacing, 기본 켜짐): 이벤트가 보는 방향 90° 부채꼴 안. 바로 옆 칸(체비셰프 1)은 방향과 무관하게 본다.
//
// 「듣는다」(hearRange > 0): 위 판정이 거짓이어도 소리 거리 ≤ hearRange 면 참이다. 소리 거리 = 체비셰프 거리 +
// 광선이 지나는 벽 칸마다 WALL_HEARING_PENALTY. 상자를 부수는 것처럼 시끄러운 행동에만 저작자가 건다.
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
  /** 소리로 알아차리는 거리(칸, 벽 하나당 +WALL_HEARING_PENALTY). 0·생략 = 듣지 않는다. */
  readonly hearRange?: number;
}

/** 칸 (x,y) 가 시선을 막는가(벽·방 사이 막힌 칸). 맵 밖은 호출측이 참으로 답한다. */
export type SightBlocker = (x: number, y: number) => boolean;

export const DEFAULT_SIGHT_RANGE = 5;
/** 벽 한 칸이 소리 거리에 더하는 칸 수. */
export const WALL_HEARING_PENALTY = 3;

const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function contains(room: SightLocation, p: { x: number; y: number }): boolean {
  return p.x >= room.x && p.y >= room.y && p.x < room.x + Math.max(0, room.w) && p.y < room.y + Math.max(0, room.h);
}

/** 칸이 속한 방 id. 어느 방에도 안 들면 상하좌우로 맞닿은 방들(문틀은 양쪽 방에 속한다). */
export function roomsAt(locations: readonly SightLocation[] | undefined, p: { x: number; y: number }): Set<string> {
  const list = locations ?? [];
  const own = list.filter((room) => contains(room, p));
  if (own.length > 0) return new Set(own.map((room) => room.id));
  const out = new Set<string>();
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    for (const room of list) if (contains(room, { x: p.x + dx, y: p.y + dy })) out.add(room.id);
  }
  return out;
}

/** 두 칸이 같은 방인가(문틀 포함). */
export function shareRoom(locations: readonly SightLocation[] | undefined, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const ra = roomsAt(locations, a);
  if (ra.size === 0) return false;
  for (const id of roomsAt(locations, b)) if (ra.has(id)) return true;
  return false;
}

/**
 * from 이 dir 을 볼 때 to 가 정면 부채꼴 안에 있는가. 기본 90°(옆으로 벌어진 폭 ≤ 앞으로 간 거리).
 * degrees 를 주면 그 각(30~180)으로 — 180° 는 앞쪽 반평면 전부(바로 옆 줄 포함).
 */
export function inViewCone(from: { x: number; y: number }, dir: Dir, to: { x: number; y: number }, degrees = 90): boolean {
  const d = DELTA[dir];
  const forward = (to.x - from.x) * d.dx + (to.y - from.y) * d.dy;
  const lateral = Math.abs((to.x - from.x) * d.dy - (to.y - from.y) * d.dx);
  if (forward === 0 && lateral === 0) return true;
  const deg = Number.isFinite(degrees) ? Math.min(180, Math.max(30, degrees)) : 90;
  if (deg >= 180) return forward >= 0;
  if (deg === 90) return forward > 0 && lateral <= forward;
  return forward > 0 && lateral <= forward * Math.tan((deg / 2) * Math.PI / 180) + 1e-9;
}

/** from→to 슈퍼커버 광선이 지나는 칸(양 끝 제외). 대각 모서리를 스치면 두 옆 칸을 모두 넣는다. */
export function sightRayCells(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const dx = to.x - from.x, dy = to.y - from.y;
  const nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  const out: { x: number; y: number }[] = [];
  let x = from.x, y = from.y, ix = 0, iy = 0;
  while (ix < nx || iy < ny) {
    const a = (1 + 2 * ix) * ny, b = (1 + 2 * iy) * nx;
    if (a === b) {
      out.push({ x: x + sx, y }, { x, y: y + sy });
      x += sx; y += sy; ix++; iy++;
    } else if (a < b) { x += sx; ix++; } else { y += sy; iy++; }
    if (x !== to.x || y !== to.y) out.push({ x, y });
  }
  return out.filter((c) => !(c.x === to.x && c.y === to.y) && !(c.x === from.x && c.y === from.y));
}

/** 광선이 지나는 벽 칸 수. */
function wallsOnRay(from: { x: number; y: number }, to: { x: number; y: number }, blocks: SightBlocker): number {
  const cells = sightRayCells(from, to);
  let walls = 0;
  for (const c of cells) if (blocks(c.x, c.y)) walls++;
  return walls;
}

export function hasClearSight(from: { x: number; y: number }, to: { x: number; y: number }, blocks: SightBlocker | undefined): boolean {
  if (!blocks) return true;
  return sightRayCells(from, to).every((c) => !blocks(c.x, c.y));
}

/** 「본다」 판정만(듣기 제외). */
export function eventSightOnly(
  eventPoint: SightPoint,
  player: { x: number; y: number },
  spec: EventSightSpec,
  locations: readonly SightLocation[] | undefined,
  blocks?: SightBlocker,
): boolean {
  const range = Math.max(0, spec.range ?? DEFAULT_SIGHT_RANGE);
  const distance = Math.max(Math.abs(eventPoint.x - player.x), Math.abs(eventPoint.y - player.y));
  if (distance > range) return false;
  if (spec.sameRoom !== false) {
    if ((locations?.length ?? 0) > 0 && !shareRoom(locations, eventPoint, player)) return false;
    if (!hasClearSight(eventPoint, player, blocks)) return false;
  }
  if (spec.requireFacing !== false && distance > 1) return inViewCone(eventPoint, eventPoint.direction ?? "down", player);
  return true;
}

/** 소리 거리: 체비셰프 + 벽 칸 × WALL_HEARING_PENALTY. */
export function hearingDistance(from: { x: number; y: number }, to: { x: number; y: number }, blocks?: SightBlocker): number {
  const base = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
  return base + (blocks ? wallsOnRay(from, to, blocks) * WALL_HEARING_PENALTY : 0);
}

export function eventSeesPlayer(
  eventPoint: SightPoint | undefined,
  player: { x: number; y: number },
  spec: EventSightSpec,
  locations: readonly SightLocation[] | undefined,
  blocks?: SightBlocker,
): boolean {
  if (!eventPoint) return false;
  if (eventSightOnly(eventPoint, player, spec, locations, blocks)) return true;
  const hear = Math.max(0, spec.hearRange ?? 0);
  return hear > 0 && hearingDistance(eventPoint, player, blocks) <= hear;
}
