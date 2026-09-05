import { canMoveFootprint, isPassable, isPassableLanding } from '@/project/collision';
import { footprintBounds, pointRect, rectsOverlap } from '@/project/footprint';
import { resolveEventPage } from '@/project/io';
import { runtimeEventViewById, runtimeEventViewsForMap, findBlockingEventOverlappingRect, type RuntimeEventView, type RuntimeEventPositions } from '@/project/runtimeEventState';
import type { PlaySession } from '@/project/session';
import type { Project, GameMap, Dir } from '@/project/types';
import type { PursuitState } from '@/project/horrorState';
import type { AutonomousMover } from './playSceneTypes';
import { findChasePath, isInSafeZone } from './chaseAi';

const directions: Record<Dir, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
type World = { project: Project; map: GameMap; session: PlaySession; positions: RuntimeEventPositions };

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
  if (rectsOverlap(bounds, pointRect(world.session.x, world.session.y))) return false;
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
  const { x, y } = world.session;
  if (isInSafeZone(world.map.safeZones, { x, y })) return false;
  if (Math.abs(view.x - x) + Math.abs(view.y - y) > (view.movement.sightRange ?? 8)) return false;
  // Conservative supercover sampling: walls and movable furniture break sight.
  const count = Math.max(Math.abs(view.x - x), Math.abs(view.y - y)) * 2;
  for (let i = 1; i < count; i++) {
    const px = Math.round(view.x + (x - view.x) * i / count);
    const py = Math.round(view.y + (y - view.y) * i / count);
    if (px === x && py === y) continue;
    if (px === view.x && py === view.y) continue;
    if (!isPassable(world.project, world.map, px, py)
      || findBlockingEventOverlappingRect(world.project, world.map, world.session, world.positions, pointRect(px, py), view.event.id)) return false;
  }
  return true;
}

function pursuitState(world: World, view: RuntimeEventView): PursuitState {
  const states = (world.session.horror ??= { pursuits: {} }).pursuits;
  return states[view.event.id] ??= { home: { mapId: world.map.id, x: view.x, y: view.y }, active: false, searchMs: 0, doors: [] };
}

/** A hidden player is never a fresh target. Witnessed entry can still lead to capture. */
export function pursuitTarget(world: World, view: RuntimeEventView, mover: AutonomousMover, deltaMs: number): { x: number; y: number; searching: boolean } | null | undefined {
  const config = view.movement.pursuit;
  const hiding = isPlayerHiding(world) ? world.session.horror!.hiding : undefined;
  if (!config && !hiding) return undefined; // Preserve legacy chase behavior.
  const state = pursuitState(world, view);
  if (config) world.session.eventLocations[view.event.id] = { mapId: world.map.id, x: view.x, y: view.y, direction: view.direction };
  const visible = (!hiding || hiding.witnessedBy.includes(view.event.id)) && seesPlayer(world, view);
  if (visible) {
    state.active = true;
    state.searchMs = 0;
    state.lastSeen = { x: world.session.x, y: world.session.y };
    mover.chaseActive = true;
    return { ...state.lastSeen, searching: false };
  }
  if (!state.active && mover.chaseActive) state.active = true;
  if (!state.active) return null;
  state.searchMs += deltaMs;
  if (state.searchMs <= (config?.searchMs ?? 3000) && state.lastSeen) {
    return { ...state.lastSeen, searching: true };
  }
  mover.chaseActive = false;
  mover.chasePath = [];
  if (config?.onLost === 'return' && state.home.mapId === world.map.id
    && (view.x !== state.home.x || view.y !== state.home.y)) return { ...state.home, searching: true };
  state.active = false;
  return null;
}

/** Capture at the source door, before loadMap destroys the current movers. */
export function carryPursuitThroughDoor(world: World, movers: Map<string, AutonomousMover>, destination: { mapId: string; x: number; y: number }): void {
  if (destination.mapId === world.map.id) return;
  for (const view of runtimeEventViewsForMap(world.project, world.map, world.session, world.positions)) {
    const config = view.movement.pursuit;
    if (view.movement.type !== 'chase' || config?.scope !== 'connected') continue;
    const state = pursuitState(world, view);
    world.session.eventLocations[view.event.id] = { mapId: world.map.id, x: view.x, y: view.y, direction: view.direction };
    if (!state.active && !movers.get(view.event.id)?.chaseActive) continue;
    if (state.searchMs > 0 || world.session.horror?.hiding) continue;
    const path = findChasePath(world.project, world.map, view, { x: world.session.x, y: world.session.y }, { footprint: view.footprint, passRows: view.passRows, blocked: (x,y) => !!findBlockingEventOverlappingRect(world.project, world.map, world.session, world.positions, footprintBounds(x,y,view.footprint), view.event.id) });
    if (!path.length && (view.x !== world.session.x || view.y !== world.session.y)) continue;
    if (path.some(p => findBlockingEventOverlappingRect(world.project, world.map, world.session, world.positions, footprintBounds(p.x, p.y, view.footprint), view.event.id))) continue;
    state.active = true;
    state.doors.push({ ...destination, remainingMs: config.doorDelayMs + path.length * (movers.get(view.event.id)?.moveDurationMs ?? 320) });
    // Remember each room's entry as the local return point; returning never warps through a wall.
  }
  // Rapid consecutive transfers retain the door trail for pursuers still in transit.
  for (const state of Object.values(world.session.horror?.pursuits ?? {})) {
    const last = state.doors.at(-1);
    if (last?.mapId === world.map.id && state.doors.length < 64) state.doors.push({ ...destination, remainingMs: last.remainingMs > 0 ? 1200 : 0 });
  }
  if (world.session.horror) delete world.session.horror.hiding;
}

/** Advances in game time, including while the pursuer is in an unloaded room. */
export function advancePursuitDoors(world: World, deltaMs: number): boolean {
  let changed = false;
  for (const [id, state] of Object.entries(world.session.horror?.pursuits ?? {})) {
    const door = state.doors[0];
    if (!door) continue;
    const event = Object.values(world.project.maps).flatMap(m => m.events).find(e => e.id === id);
    const page = event ? resolveEventPage(event, world.session) : undefined;
    if (!event || page?.movement.type !== 'chase' || page.movement.pursuit?.scope !== 'connected'
      || world.session.erasedEventIds.includes(id) || Object.values(world.session.removedEventIds ?? {}).some(ids => ids.includes(id))) {
      state.doors = []; state.active = false; continue;
    }
    door.remainingMs = Math.max(0, door.remainingMs - Math.max(0, deltaMs));
    if (door.remainingMs > 0) continue;
    const map = world.project.maps[door.mapId];
    if (!map) { state.doors = []; state.active = false; continue; }
    // Never appear on the player or in furniture. A blocked doorway waits until it clears.
    const pos = { x: door.x, y: door.y };
    const bounds = footprintBounds(pos.x, pos.y, page.footprint ?? { width: 1, height: 1 });
    if (!isPassableLanding(world.project, map, pos.x, pos.y)
      || findBlockingEventOverlappingRect(world.project, map, world.session, world.positions, bounds, id)
      || (map.id === world.map.id && rectsOverlap(bounds, pointRect(world.session.x, world.session.y)))) continue;
    world.session.eventLocations[id] = { mapId: map.id, ...pos };
    world.positions[id] = pos;
    state.doors.shift();
    state.home = { mapId: map.id, ...pos };
    state.lastSeen = { ...pos };
    state.searchMs = 0;
    changed ||= map.id === world.map.id;
  }
  return changed;
}
