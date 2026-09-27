import { passageBounds } from '@/project/footprint';
import { findBlockingEventOverlappingRect, type RuntimeEventPositions, type RuntimeEventView } from '@/project/runtimeEventState';
import { isSpatialPlacementBlocking } from '@/project/spatialOccupancy';
import type { PursuitState } from '@/project/horrorState';
import type { PlaySession } from '@/project/session';
import type { Project, GameMap } from '@/project/types';
import { findChasePath, isInSafeZone, type ChasePassSize, type ChasePoint } from './chaseAi';

export type PursuitWorld = { project: Project; map: GameMap; session: PlaySession; positions: RuntimeEventPositions };

export function pursuitState(world: PursuitWorld, view: RuntimeEventView): PursuitState {
  const states = (world.session.horror ??= { pursuits: {} }).pursuits;
  // 스위치가 여는 persistent 추격 페이지는 그 스위치가 곧 「깨어남」이다(「금고를 열자 달려온다」) — 처음부터
  // 쫓는 상태로 시작한다. 안 그러면 벽 너머에서 깨운 추격자는 주인공을 한 번 볼 때까지 서 있었다(2026-09-24).
  const awake = view.movement.pursuit?.tracking === 'persistent' && (view.page?.conditions ?? []).some(c => c.kind === 'switch');
  return states[view.event.id] ??= { home: { mapId: world.map.id, x: view.x, y: view.y }, active: awake, searchMs: 0, doors: [] };
}

/** All pursuit paths use the same feet/body policy as autonomous movement. */
export function pursuitPass(world: PursuitWorld, view: RuntimeEventView): ChasePassSize {
  return { footprint: view.footprint, passRows: view.passRows, blocked: (x, y) => {
    const rect = passageBounds(x, y, view.footprint, view.passRows);
    return isSpatialPlacementBlocking(world.project, world.session, world.map.id, rect)
      || !!findBlockingEventOverlappingRect(world.project, world.map, world.session, world.positions, rect, view.event.id);
  } };
}

// Cardinal neighbors, then the second Manhattan ring. Cursor is persisted (0..11).
const SEARCH_OFFSETS: readonly ChasePoint[] = [
  { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 },
  { x: 0, y: 2 }, { x: -1, y: 1 }, { x: -2, y: 0 }, { x: -1, y: -1 },
  { x: 0, y: -2 }, { x: 1, y: -1 }, { x: 2, y: 0 }, { x: 1, y: 1 },
];

/**
 * 도달 가능한 수색 칸이 하나도 없을 때 다시 훑을 때까지 기다리는 시간. 한 번 훑는 데 A* 가 최대
 * 14번 돈다 — 예전에는 막힌 채로 매 프레임(60Hz) 그만큼 돌았다. 일반 추격의 재탐색 주기(500ms)와
 * 같은 결을 맞췄다. 세이브에 들어가지 않는 런타임 기억이라 WeakMap 에 둔다.
 */
export const SEARCH_RETRY_MS = 500;
type SearchMiss = { readonly at: number; readonly x: number; readonly y: number };
const searchMisses = new WeakMap<PursuitState, SearchMiss>();

export function searchTarget(world: PursuitWorld, view: RuntimeEventView, state: PursuitState): ChasePoint | undefined {
  const origin = state.lastSeen;
  if (!origin) return undefined;
  // 막힌 수색의 재시도는 수색 시간(searchMs)으로 잰다 — 그 값이 이 NPC 의 실제 경과 시간이다.
  // 다시 목격하면 searchMs 가 0 으로 돌고 lastSeen 이 바뀌므로, 그때는 기억을 버리고 바로 훑는다.
  const miss = searchMisses.get(state);
  if (miss && !state.searchTarget && miss.x === origin.x && miss.y === origin.y
    && state.searchMs >= miss.at && state.searchMs < miss.at + SEARCH_RETRY_MS) return undefined;
  searchMisses.delete(state);
  const pass = pursuitPass(world, view);
  const reachable = (point: ChasePoint, lastSighting = false): boolean => !isInSafeZone(world.map.safeZones, point)
    && (lastSighting || point.x !== world.session.x || point.y !== world.session.y)
    && findChasePath(world.project, world.map, view, point, pass).length > 0;
  if (state.searchTarget && reachable(state.searchTarget)) return state.searchTarget;
  // First reach the last sighting; only then sweep nearby reachable tiles.
  if (state.searchCursor === undefined && reachable(origin, true)) return origin;
  const cursor = state.searchCursor ?? 0;
  for (let step = 0; step < SEARCH_OFFSETS.length; step++) {
    const index = (cursor + step) % SEARCH_OFFSETS.length;
    const offset = SEARCH_OFFSETS[index];
    const candidate = { x: origin.x + offset.x, y: origin.y + offset.y };
    if (!reachable(candidate)) continue;
    state.searchCursor = (index + 1) % SEARCH_OFFSETS.length;
    state.searchTarget = candidate;
    return candidate;
  }
  delete state.searchTarget;
  searchMisses.set(state, { at: state.searchMs, x: origin.x, y: origin.y });
  return undefined;
}
