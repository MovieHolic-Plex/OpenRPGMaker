import { npcSeesPoint } from './npcPerception';
import { isSpatialPlacementBlocking } from '@/project/spatialOccupancy';
import { resolvePlayerBody } from '@/project/playerFootprint';
import { canMoveFootprint } from '@/project/collision';
import { footprintBounds, rectsOverlap } from '@/project/footprint';
import { runtimeEventViewById, runtimeEventViewsForMap, findBlockingEventOverlappingRect, type RuntimeEventView } from '@/project/runtimeEventState';
import type { Dir } from '@/project/types';
import type { AutonomousMover } from './playSceneTypes';
import { isInSafeZone } from './chaseAi';
import { chaseSearchLimitMs } from '@/project/chaseTempo';
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
/** 시야가 끊긴 뒤 주인공이 간 쪽을 아직 아는 시간(ms). 이 뒤로는 마지막 목격 자리·진행 방향을 뒤진다. */
export const LOS_GRACE_MS = 400;

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
    if (config?.lostSwitchId && world.session.switches[config.lostSwitchId]) world.session.switches[config.lostSwitchId] = false;
    state.active = true;
    state.searchMs = 0;
    const seen = { x: world.session.x, y: world.session.y };
    // 진행 방향 — 놓쳤을 때 마지막 목격 자리 다음으로 그 방향을 뒤진다(한 축만 바뀐 걸음만 센다).
    if (state.lastSeen && (seen.x !== state.lastSeen.x) !== (seen.y !== state.lastSeen.y)) {
      const heading = { x: Math.sign(seen.x - state.lastSeen.x), y: Math.sign(seen.y - state.lastSeen.y) };
      const before = state.lastHeading;
      const cross = before ? before.x * heading.y - before.y * heading.x : 0;
      if (cross !== 0) state.lastTurn = cross > 0 ? 1 : -1;
      state.lastHeading = heading;
    }
    state.lastSeen = seen;
    delete state.searchTarget; delete state.searchCursor; delete state.searchCenter;
    mover.chaseActive = true;
    return { ...state.lastSeen, searching: false };
  }
  if (!state.active && mover.chaseActive) state.active = true;
  if (!state.active) return null;
  state.searchMs += Math.max(0, deltaMs);
  // 시야가 막 끊긴 직후(LOS_GRACE_MS)에는 어느 쪽으로 꺾었는지 발소리로 안다 — 마지막 목격 자리를 그 짧은 동안만 따라 옮긴다.
  // 예전에는 끊긴 그 칸에 멈춰 둘레만 뒤져 모퉁이 하나로 따돌려졌다(2026-10-29). 숨는 곳·안전지대 안이면 따라가지 않는다.
  if (state.searchMs <= LOS_GRACE_MS && !hiding && !isInSafeZone(world.map.safeZones, world.session) && state.lastSeen) {
    const seen = { x: world.session.x, y: world.session.y };
    if ((seen.x !== state.lastSeen.x) !== (seen.y !== state.lastSeen.y)) {
      const heading = { x: Math.sign(seen.x - state.lastSeen.x), y: Math.sign(seen.y - state.lastSeen.y) };
      const before = state.lastHeading;
      const cross = before ? before.x * heading.y - before.y * heading.x : 0;
      if (cross !== 0) state.lastTurn = cross > 0 ? 1 : -1;
      state.lastHeading = heading;
    }
    state.lastSeen = seen;
    return { ...seen, searching: false };
  }
  if (state.searchMs <= chaseSearchLimitMs(view.movement, config?.searchMs ?? 3000) && state.lastSeen) {
    // Positions reserve tween destinations immediately. Do not rotate the search until landing.
    const target = mover.activeMove ? state.searchTarget ?? state.lastSeen : searchTarget(world, view, state);
    return target ? { ...target, searching: true } : null;
  }
  mover.chaseActive = false;
  // 포기 훅 — 추격이 끝나는 순간 한 번(이미 켜져 있으면 그대로).
  if (config?.lostSwitchId && state.active) world.session.switches[config.lostSwitchId] = true;
  if (config?.onLost === 'return' && state.home.mapId === world.map.id
    && (view.x !== state.home.x || view.y !== state.home.y)) return { ...state.home, searching: true };
  state.active = false;
  return null;
}
