import { npcSeesPoint } from './npcPerception';
import { isSpatialPlacementBlocking } from '@/project/spatialOccupancy';
import { resolvePlayerBody } from '@/project/playerFootprint';
import { canMoveFootprint } from '@/project/collision';
import { footprintBounds, rectsOverlap } from '@/project/footprint';
import { runtimeEventViewById, runtimeEventViewsForMap, findBlockingEventOverlappingRect, type RuntimeEventView } from '@/project/runtimeEventState';
import type { Dir } from '@/project/types';
import type { AutonomousMover } from './playSceneTypes';
import { isInSafeZone } from './chaseAi';
import { pursuitState, searchTarget, type PursuitWorld as World } from './pursuitNavigation';
export { carryPursuitThroughDoor, advancePursuitDoors } from './pursuitDoors';

const directions: Record<Dir, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** Furniture is an event, never a mutation of the authored tiles. No diagonal or chain pushes. */
export function pushObject(world: World, view: RuntimeEventView, dir: Dir): boolean {
  const interaction = view.page?.interaction;
  if (interaction?.kind !== 'pushable' || view.movement.type !== 'fixed') return false;
  if (view.priority !== 'same' || !view.overlapForbidden) return false;
  if (interaction.directions && !interaction.directions.includes(dir)) return false;
  const d = directions[dir];
  const x = view.x + d.x, y = view.y + d.y;
  if (!canMoveFootprint(world.project, world.map, view.x, view.y, view.footprint, x, y, view.passRows)) return false;
  const bounds = footprintBounds(x, y, view.footprint);
  if (rectsOverlap(bounds, footprintBounds(world.session.x, world.session.y, resolvePlayerBody(world.project, world.session).footprint))) return false;
  if (isSpatialPlacementBlocking(world.project, world.session, world.map.id, bounds)) return false;
  if (findBlockingEventOverlappingRect(world.project, world.map, world.session, world.positions, bounds, view.event.id)) return false;
  world.session.eventLocations[view.event.id] = { mapId: world.map.id, x, y, direction: view.direction };
  world.positions[view.event.id] = { x, y, direction: view.direction };
  return true;
}

export function toggleHiding(world: World, view?: RuntimeEventView): boolean {
  if (world.session.horror?.hiding) {
    delete world.session.horror.hiding;
    return true;
  }
  if (view?.page?.interaction?.kind !== 'hiding') return false;
  const state = world.session.horror ??= { pursuits: {} };
  const witnessedBy = runtimeEventViewsForMap(world.project, world.map, world.session, world.positions)
    .filter(v => v.movement.type === 'chase' && seesPlayer(world, v)).map(v => v.event.id);
  state.hiding = { mapId: world.map.id, eventId: view.event.id, witnessedBy };
  return true;
}

export function isPlayerHiding(world: World): boolean {
  const hiding = world.session.horror?.hiding;
  if (!hiding) return false;
  const view = hiding.mapId === world.map.id
    ? runtimeEventViewById(world.project, world.map, world.session, world.positions, hiding.eventId) : undefined;
  if (view?.page?.interaction?.kind === 'hiding') return true;
  delete world.session.horror!.hiding;
  return false;
}

export function seesPlayer(world: World, view: RuntimeEventView): boolean {
  return npcSeesPoint(world, view, world.session,
    view.movement.sight ?? { range: view.movement.sightRange ?? 8, lineOfSight: true, facing: 'any' });
}

type PursuitTarget = { x: number; y: number; searching: boolean } | null | undefined;

/** Invalidate cached paths when acquisition, search, return or the actual target changes. */
export function pursuitTarget(world: World, view: RuntimeEventView, mover: AutonomousMover, deltaMs: number): PursuitTarget {
  const target = trackedPursuitTarget(world, view, mover, deltaMs);
  if (target === undefined) return target; // No pursuit policy: preserve base chase.
  const key = target ? `${target.x}:${target.y}:${target.searching}` : 'lost';
  if (mover.pursuitTargetKey !== key) {
    mover.pursuitTargetKey = key;
    mover.chasePath = [];
    mover.chasePathBlocked = false;
  }
  return target;
}

/** A hidden player is never a fresh target. Witnessed entry can still lead to capture. */
function trackedPursuitTarget(world: World, view: RuntimeEventView, mover: AutonomousMover, deltaMs: number): PursuitTarget {
  const config = view.movement.pursuit;
  const hiding = isPlayerHiding(world) ? world.session.horror?.hiding : undefined;
  if (!config && !hiding && !view.movement.sight) return undefined;
  const state = pursuitState(world, view);
  if (state.doors.length) return null; // Transit, not an independently walking duplicate.
  if (config) world.session.eventLocations[view.event.id] = { mapId: world.map.id, x: view.x, y: view.y, direction: view.direction };
  const visible = (!hiding || hiding.witnessedBy.includes(view.event.id)) && seesPlayer(world, view);
  const persistent = config?.tracking === 'persistent' && (state.active || mover.chaseActive)
    && !hiding && !isInSafeZone(world.map.safeZones, world.session);
  if (visible || persistent) {
    state.active = true;
    state.searchMs = 0;
    state.lastSeen = { x: world.session.x, y: world.session.y };
    delete state.searchTarget; delete state.searchCursor;
    mover.chaseActive = true;
    return { ...state.lastSeen, searching: false };
  }
  if (!state.active && mover.chaseActive) state.active = true;
  if (!state.active) return null;
  state.searchMs += Math.max(0, deltaMs);
  if (state.searchMs <= (config?.searchMs ?? 3000) && state.lastSeen) {
    // Positions reserve tween destinations immediately. Do not rotate the search until landing.
    const target = mover.activeMove ? state.searchTarget ?? state.lastSeen : searchTarget(world, view, state);
    return target ? { ...target, searching: true } : null;
  }
  mover.chaseActive = false;
  if (config?.onLost === 'return' && state.home.mapId === world.map.id
    && (view.x !== state.home.x || view.y !== state.home.y)) return { ...state.home, searching: true };
  state.active = false;
  return null;
}
