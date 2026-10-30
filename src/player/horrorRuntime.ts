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
import { CHASE_NOISE_RADIUS, chaseBrainProfile, type ChaseBrainProfile } from '@/project/chaseBrain';
import { emitChaseNoise, hearChaseNoise, playerFootstepAt, playerGait } from './chaseNoise';
import type { NpcSight } from '@/project/types';
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
  // 끄는 소리 — 곁의 추격자가 듣고 와서 뒤진다(@/player/chaseNoise).
  emitChaseNoise(world.session, world.map.id, { x, y }, CHASE_NOISE_RADIUS.push);
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
  const authored: NpcSight = view.movement.sight ?? { range: view.movement.sightRange ?? 8, lineOfSight: true, facing: 'any' };
  if (view.movement.type !== 'chase') return npcSeesPoint(world, view, world.session, authored);
  const brain = chaseBrainProfile(view.movement);
  return npcSeesPoint(world, view, world.session, chaseBrainSight(authored, brain), undefined, brain.seeThroughWalls);
}

/**
 * 성격이 넓힌 시야(@/project/chaseBrain): 거리에 덤을 더하고, 좁은 부채꼴·앞줄 시야는 최소 각까지 벌린다.
 * 옛 방식(classic)은 저작 그대로다.
 */
export function chaseBrainSight(sight: NpcSight, brain: ChaseBrainProfile): NpcSight {
  const range = sight.range + brain.sightBonusCells;
  if (sight.facing === 'any' || brain.minConeDegrees <= 0) return range === sight.range ? sight : { ...sight, range };
  const cone = Math.min(180, Math.max(sight.facing === 'cone' ? sight.coneDegrees ?? 90 : 0, brain.minConeDegrees));
  return { ...sight, range, facing: 'cone', coneDegrees: cone };
}

/**
 * 발소리를 듣는가 — 사방, 시선 무관. 걸으면 hearWalkCells, 달리면 hearRunCells, 서 있으면 senseStillCells 안(맨해튼).
 * 숨은 주인공·안전지대 안의 주인공은 듣지 않는다. chase 페이지만.
 */
export function hearsPlayer(world: World, view: RuntimeEventView): boolean {
  if (view.movement.type !== 'chase') return false;
  if (isPlayerHiding(world) || isInSafeZone(world.map.safeZones, world.session)) return false;
  const brain = chaseBrainProfile(view.movement);
  const gait = playerGait(world.session);
  const reach = gait === 'run' ? brain.hearRunCells : gait === 'walk' ? brain.hearWalkCells : brain.senseStillCells;
  if (reach <= 0) return false;
  const at = playerFootstepAt(world.session) ?? world.session;
  return Math.abs(at.x - view.x) + Math.abs(at.y - view.y) <= reach;
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
  const visible = (!hiding || hiding.witnessedBy.includes(view.event.id)) && (seesPlayer(world, view) || hearsPlayer(world, view));
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
  // 소리(레버·스위치·밀기)를 들었다 — 그 자리로 가서 뒤진다. 지금 쫓는 중이 아니어도 깨어난다.
  const noise = hearChaseNoise(world.session, world.map.id, view.event.id, view, chaseBrainProfile(view.movement).noiseScale);
  if (noise && view.movement.type === 'chase') {
    state.active = true;
    state.lastSeen = { x: noise.x, y: noise.y };
    state.searchMs = LOS_GRACE_MS + 1;
    delete state.searchTarget; delete state.searchCursor; delete state.searchCenter; delete state.lastHeading;
    mover.chaseActive = true;
  }
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
