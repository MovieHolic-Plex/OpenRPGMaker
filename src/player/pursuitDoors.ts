import { isPassableLanding } from '@/project/collision';
import { passageBounds, rectCells, rectsOverlap } from '@/project/footprint';
import { resolvePlayerBody } from '@/project/playerFootprint';
import { runtimeEventView, runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { runtimeMap } from '@/project/runtimeMap';
import type { EventPageMovement } from '@/project/types';
import type { AutonomousMover } from './playSceneTypes';
import { findChasePath, isInSafeZone } from './chaseAi';
import { npcMoveDurationMs, npcPageMoveIntervalMs } from './playScenePageMoveRoutes';
import { pursuitPass, pursuitState, type PursuitWorld } from './pursuitNavigation';

type Destination = { mapId: string; x: number; y: number };

/**
 * 프로젝트 전체 이벤트의 id 색인. 문 이동 대기 추적자마다 매 프레임
 * `Object.values(maps).flatMap(events).find` 로 프로젝트 전체를 새 배열로 펴던 것을 대신한다.
 * 프로젝트 객체가 바뀌면(편집·교체) 새로 만든다 — maps 객체 정체성을 키로 쓴다.
 */
type ProjectEventIndex = {
  readonly sources: readonly (readonly unknown[])[];
  readonly lengths: readonly number[];
  readonly byId: Map<string, import('@/project/types').GameEvent>;
};
const eventIndexByMaps = new WeakMap<object, ProjectEventIndex>();
function projectEventById(project: PursuitWorld['project'], id: string): import('@/project/types').GameEvent | undefined {
  const maps = Object.values(project.maps);
  let index = eventIndexByMaps.get(project.maps);
  // 맵별 이벤트 배열의 정체성과 길이로 낡음을 잡는다 — 맵 수에 비례하는 비교뿐이라 싸다.
  const stale = !index || index.sources.length !== maps.length
    || maps.some((map, i) => index!.sources[i] !== map.events || index!.lengths[i] !== map.events.length);
  if (stale) {
    const byId = new Map<string, import('@/project/types').GameEvent>();
    for (const map of maps) {
      for (const event of map.events) if (!byId.has(event.id)) byId.set(event.id, event);
    }
    index = { sources: maps.map(map => map.events), lengths: maps.map(map => map.events.length), byId };
    eventIndexByMaps.set(project.maps, index);
  }
  return index!.byId.get(id);
}

function travelMs(steps: number, movement: EventPageMovement, mover?: AutonomousMover): number {
  const duration = mover?.moveDurationMs ?? npcMoveDurationMs(movement.speed);
  const interval = mover?.moveIntervalMs ?? npcPageMoveIntervalMs(movement);
  const active = mover?.activeMove;
  const remaining = active ? Math.max(0, (active.durationMs ?? duration) - active.elapsedMs) : 0;
  const credit = !active && steps > 0 ? Math.min(interval, Math.max(0, mover?.timer ?? 0)) : 0;
  return steps * (duration + interval) + remaining - credit;
}

/** Capture before loadMap destroys the source movers; later legs follow the actual door trail. */
export function carryPursuitThroughDoor(world: PursuitWorld, movers: Map<string, AutonomousMover>, destination: Destination): void {
  if (destination.mapId === world.map.id) return;
  const source = { ...world, map: runtimeMap(world.map, world.session) };
  const interrupted = !!world.session.horror?.hiding || isInSafeZone(source.map.safeZones, world.session);
  for (const view of runtimeEventViewsForMap(world.project, source.map, world.session, world.positions)) {
    const config = view.movement.pursuit;
    if (view.movement.type !== 'chase' || config?.scope !== 'connected') continue;
    const state = pursuitState(source, view);
    if (state.doors.length || interrupted || state.searchMs > config.searchMs) continue;
    world.session.eventLocations[view.event.id] = { mapId: world.map.id, x: view.x, y: view.y, direction: view.direction };
    if (!state.active && !movers.get(view.event.id)?.chaseActive) continue;
    const path = findChasePath(world.project, source.map, view, world.session, pursuitPass(source, view));
    if (!path.length && (view.x !== world.session.x || view.y !== world.session.y)) continue;
    state.active = true;
    state.doors.push({ ...destination, remainingMs: config.doorDelayMs + travelMs(path.length, view.movement, movers.get(view.event.id)) });
    if (config.followSwitchId) world.session.switches[config.followSwitchId] = true;
  }
  for (const [id, state] of Object.entries(world.session.horror?.pursuits ?? {})) {
    const last = state.doors.at(-1);
    if (last?.mapId !== world.map.id || state.doors.length >= 64 || interrupted) continue;
    const event = projectEventById(world.project, id);
    if (!event || world.session.erasedEventIds.includes(id)
      || Object.values(world.session.removedEventIds ?? {}).some(ids => ids.includes(id))) continue;
    const view = runtimeEventView(event, world.session, {});
    const config = view.movement.pursuit;
    if (view.movement.type !== 'chase' || config?.scope !== 'connected' || state.searchMs > config.searchMs) continue;
    const path = findChasePath(world.project, source.map, last, world.session, pursuitPass(source, view));
    if (!path.length && (last.x !== world.session.x || last.y !== world.session.y)) continue;
    state.doors.push({ ...destination, remainingMs: config.doorDelayMs + travelMs(path.length, view.movement) });
  }
  if (world.session.horror) delete world.session.horror.hiding;
}

/** Consume eligible game time once; a blocked landing discards that frame's remainder. */
export function advancePursuitDoors(world: PursuitWorld, deltaMs: number): boolean {
  let changed = false;
  for (const [id, state] of Object.entries(world.session.horror?.pursuits ?? {})) {
    if (!state.doors.length) continue;
    const event = projectEventById(world.project, id);
    const view = event ? runtimeEventView(event, world.session, {}) : undefined;
    if (!view || view.movement.type !== 'chase' || view.movement.pursuit?.scope !== 'connected'
      || world.session.erasedEventIds.includes(id) || Object.values(world.session.removedEventIds ?? {}).some(ids => ids.includes(id))) {
      state.doors = []; state.active = false; continue;
    }
    let remaining = Math.max(0, deltaMs);
    while (state.doors.length) {
      const door = state.doors[0];
      const spent = Math.min(remaining, door.remainingMs);
      door.remainingMs -= spent; remaining -= spent;
      if (door.remainingMs > 0) break;
      const authored = world.project.maps[door.mapId];
      if (!authored) { state.doors = []; state.active = false; break; }
      const current = door.mapId === world.map.id;
      const map = runtimeMap(current ? world.map : authored, world.session);
      const landingWorld = { ...world, map, positions: current ? world.positions : {} };
      const pos = { x: door.x, y: door.y };
      const rect = passageBounds(pos.x, pos.y, view.footprint, view.passRows);
      const player = resolvePlayerBody(world.project, world.session);
      if (!rectCells(rect).every(c => isPassableLanding(world.project, map, c.x, c.y))
        || pursuitPass(landingWorld, view).blocked?.(pos.x, pos.y)
        || (current && rectsOverlap(rect, passageBounds(world.session.x, world.session.y, player.footprint, player.passRows)))) break;
      world.session.eventLocations[id] = { mapId: map.id, ...pos };
      if (current) world.positions[id] = pos;
      state.doors.shift();
      state.home = { mapId: map.id, ...pos };
      state.lastSeen = pos;
      state.searchMs = 0;
      delete state.searchTarget; delete state.searchCursor;
      changed ||= current;
    }
  }
  return changed;
}
