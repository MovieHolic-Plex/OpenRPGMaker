import { passageBounds } from '@/project/footprint';
import { createBlockingEventQuery, type RuntimeEventPositions, type RuntimeEventView } from '@/project/runtimeEventState';
import { isSpatialPlacementBlocking } from '@/project/spatialOccupancy';
import type { PursuitState } from '@/project/horrorState';
import type { PlaySession } from '@/project/session';
import type { Project, GameMap } from '@/project/types';
import { findChasePath, isInSafeZone, type ChasePassSize, type ChasePoint } from './chaseAi';
import { projectAhead } from './chaseTactics';

export type PursuitWorld = { project: Project; map: GameMap; session: PlaySession; positions: RuntimeEventPositions };

export function pursuitState(world: PursuitWorld, view: RuntimeEventView): PursuitState {
  const states = (world.session.horror ??= { pursuits: {} }).pursuits;
  // 스위치가 여는 persistent 추격 페이지는 그 스위치가 곧 「깨어남」이다(「금고를 열자 달려온다」) — 처음부터
  // 쫓는 상태로 시작한다. 안 그러면 벽 너머에서 깨운 추격자는 주인공을 한 번 볼 때까지 서 있었다(2026-09-24).
  const awake = view.movement.pursuit?.tracking === 'persistent' && (view.page?.conditions ?? []).some(c => c.kind === 'switch');
  return states[view.event.id] ??= { home: { mapId: world.map.id, x: view.x, y: view.y }, active: awake, searchMs: 0, doors: [] };
}

/**
 * 추격자가 붙잡은 주인공을 다른 맵으로 끌고 가면(잠입 순찰의 「붙잡히면 감방」) 그 추격자는 제 자리(home)로 돌아가 쫓기를 멈춘다.
 * 추격자 위치는 맵을 떠나도 남으므로(eventLocations), 그대로 두면 다시 들어서자마자 같은 자리에서 또 붙잡혔다
 * (2026-10-27 폴른 막사 독립 플레이 판정: 감방 → 막사 입구 → 즉시 재포획을 여섯 번). 게임 오버 재시작의 resetPursuersForRetry 와 같은 규칙.
 */
export function sendPursuerHome(session: PlaySession, eventId: string): boolean {
  const state = session.horror?.pursuits[eventId];
  if (!state) return false;
  const location = session.eventLocations[eventId];
  session.eventLocations[eventId] = { ...(location ?? {}), mapId: state.home.mapId, x: state.home.x, y: state.home.y, direction: location?.direction ?? "down" };
  delete session.horror!.pursuits[eventId];
  return true;
}

/** All pursuit paths use the same feet/body policy as autonomous movement. */
export function pursuitPass(world: PursuitWorld, view: RuntimeEventView, targetEventId?: string): ChasePassSize {
  // 막는 이벤트 목록은 이 통행 판정기 하나(= 추격 결정 한 번)에서만 공유한다.
  // A faction target is a contact destination, not an obstacle. Only this query excludes it;
  // the real session and the final movement collision remain unchanged.
  const occupancySession = targetEventId
    ? { ...world.session, erasedEventIds: [...(world.session.erasedEventIds ?? []), targetEventId] }
    : world.session;
  const blockingEvent = createBlockingEventQuery(world.project, world.map, occupancySession, world.positions, view.event.id);
  return { footprint: view.footprint, passRows: view.passRows, blocked: (x, y) => {
    const rect = passageBounds(x, y, view.footprint, view.passRows);
    return isSpatialPlacementBlocking(world.project, world.session, world.map.id, rect)
      || blockingEvent(rect);
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
/** 놓친 뒤 진행 방향으로 내다보는 칸 수. */
const SEARCH_AHEAD_CELLS = 6;
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
  if (state.searchCursor === undefined && state.searchCenter === undefined && reachable(origin, true)) return origin;
  // 그다음 주인공이 달아나던 방향으로 내다본 칸(꺾인 복도는 따라 꺾는다)을 먼저 뒤진다 — 예전에는 마지막 목격 자리
  // 둘레 두 칸만 훑어, 벽 뒤로 꺾어 계속 달아난 주인공을 그 자리에서 맴돌며 놓쳤다(2026-10-29).
  if (state.searchCursor === undefined && state.searchCenter === undefined && state.lastHeading) {
    const ahead = projectAhead(world.project, world.map, origin, state.lastHeading, SEARCH_AHEAD_CELLS, state.lastTurn);
    for (let index = ahead.length - 1; index >= 0; index -= 1) {
      const candidate = ahead[index]!;
      if (!reachable(candidate)) continue;
      state.searchCenter = candidate;
      state.searchTarget = candidate;
      return candidate;
    }
  }
  const center = state.searchCenter ?? origin;
  const cursor = state.searchCursor ?? 0;
  for (let step = 0; step < SEARCH_OFFSETS.length; step++) {
    const index = (cursor + step) % SEARCH_OFFSETS.length;
    const offset = SEARCH_OFFSETS[index];
    const candidate = { x: center.x + offset.x, y: center.y + offset.y };
    if (!reachable(candidate)) continue;
    state.searchCursor = (index + 1) % SEARCH_OFFSETS.length;
    state.searchTarget = candidate;
    return candidate;
  }
  delete state.searchTarget;
  searchMisses.set(state, { at: state.searchMs, x: origin.x, y: origin.y });
  return undefined;
}
