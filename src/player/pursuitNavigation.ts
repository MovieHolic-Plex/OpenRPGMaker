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
  return states[view.event.id] ??= { home: { mapId: world.map.id, x: view.x, y: view.y }, active: false, searchMs: 0, doors: [] };
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

export function searchTarget(world: PursuitWorld, view: RuntimeEventView, state: PursuitState): ChasePoint | undefined {
  const origin = state.lastSeen;
  if (!origin) return undefined;
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
  return undefined;
}
