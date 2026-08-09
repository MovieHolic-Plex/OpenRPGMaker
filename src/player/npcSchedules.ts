import { canMove, isPassable } from "@/project/collision";
import { initialGameTime, resolveTimeSystem } from "@/project/gameTime";
import { npcScheduleTargetForEvent, type NpcScheduleTarget } from "@/project/npcSchedule";
import { store } from "@/project/store";
import type { Dir, GameEvent, GameMap, MapId, MoveCommand, Project } from "@/project/types";
import { findChasePath, type ChasePoint } from "@/player/chaseAi";
import { nearestPassableTile } from "@/player/playSceneMapCommands";
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import type { RuntimeEventLocation } from "@/project/sessionRuntimeTypes"

type NpcScheduleSceneContext = Pick<
  PlaySceneContext,
  | "map"
  | "session"
  | "eventPositions"
  | "autonomousNPCs"
  | "commandMoveRouteEventIds"
  | "registerAutonomousMover"
  | "refreshRuntimeSurfaces"
  | "syncRuntimeState"
>;

type EventWithSource = {
  readonly mapId: MapId;
  readonly map: GameMap;
  readonly event: GameEvent;
};

export function updateNpcSchedules(scene: NpcScheduleSceneContext, paused = false): void {
  const project = store.getCurrent();
  const system = resolveTimeSystem(project);
  if (!system) return;
  scene.session.gameTime ??= initialGameTime(system);
  if (paused || !scene.session.gameTime) return;
  scene.session.npcActivities ??= {};
  scene.session.npcScheduleStates ??= {};

  let changed = false;
  const scheduledIds = new Set<string>();
  for (const source of scheduledEvents(project)) {
    scheduledIds.add(source.event.id);
    const target = npcScheduleTargetForEvent(source.mapId, source.event, scene.session.gameTime);
    if (!target) continue;
    changed = applyNpcScheduleTarget(scene, project, source, target) || changed;
  }

  for (const eventId of Object.keys(scene.session.npcActivities)) {
    if (!scheduledIds.has(eventId)) {
      delete scene.session.npcActivities[eventId];
      changed = true;
    }
  }
  for (const eventId of Object.keys(scene.session.npcScheduleStates)) {
    if (!scheduledIds.has(eventId)) {
      delete scene.session.npcScheduleStates[eventId];
      changed = true;
    }
  }
  if (changed) {
    scene.refreshRuntimeSurfaces();
    scene.syncRuntimeState();
  }
}

function applyNpcScheduleTarget(
  scene: NpcScheduleSceneContext,
  project: Project,
  source: EventWithSource,
  target: NpcScheduleTarget
): boolean {
  const targetMap = project.maps[target.mapId];
  if (!targetMap) return false;
  const eventId = source.event.id;
  const state = scene.session.npcScheduleStates ??= {};
  const normalizedTarget = normalizeTarget(project, targetMap, target);
  setActivity(scene, eventId, target.activity);

  const current = currentEventLocation(scene, source);
  if (current.mapId !== scene.map.id) {
    return teleportNpc(scene, eventId, normalizedTarget, target.key);
  }

  if (current.mapId !== normalizedTarget.mapId) {
    return handleVisibleMapExit(scene, project, source.event, current, normalizedTarget, target.key);
  }

  ensureTrackedOnCurrentMap(scene, eventId, current);
  if (current.x === normalizedTarget.x && current.y === normalizedTarget.y) {
    const locationChanged = setNpcFacingAtTarget(scene, eventId, normalizedTarget);
    const previous = state[eventId];
    state[eventId] = { routeKey: target.key };
    return locationChanged || previous?.routeKey !== target.key || previous?.exitTarget !== undefined;
  }

  const route = routeTo(project, scene.map, current, normalizedTarget);
  if (route.length === 0) return false;
  return registerScheduleRoute(scene, eventId, route, target.key);
}

function handleVisibleMapExit(
  scene: NpcScheduleSceneContext,
  project: Project,
  event: GameEvent,
  current: RuntimeEventLocation,
  target: RuntimeEventLocation,
  targetKey: string
): boolean {
  const eventId = event.id;
  const state = scene.session.npcScheduleStates ??= {};
  const existing = state[eventId];
  if (existing?.exitTarget && !scene.autonomousNPCs.has(eventId)) {
    return teleportNpc(scene, eventId, existing.exitTarget, targetKey);
  }
  if (isMapEdge(scene.map, current.x, current.y)) {
    return teleportNpc(scene, eventId, target, targetKey);
  }
  ensureTrackedOnCurrentMap(scene, eventId, current);
  const departure = nearestReachableEdge(project, scene.map, current);
  if (!departure) return teleportNpc(scene, eventId, target, targetKey);
  const route = routeTo(project, scene.map, current, { ...departure, mapId: scene.map.id });
  if (route.length === 0) return teleportNpc(scene, eventId, target, targetKey);
  const routeKey = `exit:${targetKey}:${departure.x},${departure.y}`;
  const changed = registerScheduleRoute(scene, eventId, route, routeKey);
  state[eventId] = { routeKey, exitTarget: target };
  return changed;
}

function registerScheduleRoute(
  scene: NpcScheduleSceneContext,
  eventId: string,
  moves: readonly MoveCommand[],
  routeKey: string
): boolean {
  const state = scene.session.npcScheduleStates ??= {};
  if (state[eventId]?.routeKey === routeKey && scene.autonomousNPCs.has(eventId)) return false;
  scene.registerAutonomousMover(eventId, [...moves], false);
  const mover = scene.autonomousNPCs.get(eventId);
  if (mover) configureScheduleMover(mover);
  scene.commandMoveRouteEventIds.add(eventId);
  state[eventId] = { routeKey, exitTarget: state[eventId]?.exitTarget };
  return true;
}

function configureScheduleMover(mover: AutonomousMover): void {
  mover.strategy = "sequence";
  mover.speedRank = 4;
  mover.frequencyRank = 8;
  mover.moveDurationMs = 320;
  mover.moveIntervalMs = 80;
  mover.pathfind = true;
}

function teleportNpc(
  scene: NpcScheduleSceneContext,
  eventId: string,
  target: RuntimeEventLocation,
  routeKey: string
): boolean {
  const previous = scene.session.eventLocations?.[eventId];
  scene.session.eventLocations ??= {};
  scene.session.eventLocations[eventId] = target;
  scene.session.npcScheduleStates ??= {};
  scene.session.npcScheduleStates[eventId] = { routeKey };
  scene.autonomousNPCs.delete(eventId);
  scene.commandMoveRouteEventIds.delete(eventId);
  if (target.mapId !== scene.map.id) delete scene.eventPositions[eventId];
  return !sameLocation(previous, target);
}

function setNpcFacingAtTarget(
  scene: NpcScheduleSceneContext,
  eventId: string,
  target: RuntimeEventLocation
): boolean {
  if (!target.direction) return false;
  const current = scene.session.eventLocations?.[eventId];
  const next = current ? { ...current, direction: target.direction } : target;
  scene.session.eventLocations ??= {};
  scene.session.eventLocations[eventId] = next;
  return current?.direction !== target.direction;
}

function setActivity(scene: NpcScheduleSceneContext, eventId: string, activity: string | undefined): void {
  scene.session.npcActivities ??= {};
  if (activity) {
    scene.session.npcActivities[eventId] = activity;
    return;
  }
  delete scene.session.npcActivities[eventId];
}

function normalizeTarget(project: Project, map: GameMap, target: NpcScheduleTarget): RuntimeEventLocation {
  const destination = isPassable(project, map, target.x, target.y)
    ? { x: target.x, y: target.y }
    : nearestPassableTile(project, map, target.x, target.y);
  return {
    mapId: map.id,
    x: destination.x,
    y: destination.y,
    direction: target.facing,
  };
}

function currentEventLocation(scene: NpcScheduleSceneContext, source: EventWithSource): RuntimeEventLocation {
  const saved = scene.session.eventLocations?.[source.event.id];
  if (saved) return saved;
  const runtime = source.mapId === scene.map.id ? scene.eventPositions[source.event.id] : undefined;
  return {
    mapId: source.mapId,
    x: runtime?.x ?? source.event.x,
    y: runtime?.y ?? source.event.y,
    direction: runtime?.direction,
  };
}

function ensureTrackedOnCurrentMap(
  scene: NpcScheduleSceneContext,
  eventId: string,
  location: RuntimeEventLocation
): void {
  if (location.mapId !== scene.map.id) return;
  scene.session.eventLocations ??= {};
  scene.session.eventLocations[eventId] = location;
}

function routeTo(
  project: Project,
  map: GameMap,
  from: RuntimeEventLocation,
  to: RuntimeEventLocation
): MoveCommand[] {
  if (from.mapId !== map.id || to.mapId !== map.id) return [];
  const path = findChasePath(project, map, { x: from.x, y: from.y }, { x: to.x, y: to.y });
  return pathToMoves({ x: from.x, y: from.y }, path);
}

function nearestReachableEdge(
  project: Project,
  map: GameMap,
  from: RuntimeEventLocation
): ChasePoint | null {
  const candidates: Array<{ readonly point: ChasePoint; readonly path: ChasePoint[] }> = [];
  for (let x = 0; x < map.width; x += 1) {
    collectEdgeCandidate(project, map, from, { x, y: 0 }, candidates);
    collectEdgeCandidate(project, map, from, { x, y: map.height - 1 }, candidates);
  }
  for (let y = 1; y < map.height - 1; y += 1) {
    collectEdgeCandidate(project, map, from, { x: 0, y }, candidates);
    collectEdgeCandidate(project, map, from, { x: map.width - 1, y }, candidates);
  }
  candidates.sort((a, b) => a.path.length - b.path.length);
  return candidates[0]?.point ?? null;
}

function collectEdgeCandidate(
  project: Project,
  map: GameMap,
  from: RuntimeEventLocation,
  point: ChasePoint,
  candidates: Array<{ readonly point: ChasePoint; readonly path: ChasePoint[] }>
): void {
  if (!isPassable(project, map, point.x, point.y)) return;
  if (from.x === point.x && from.y === point.y) {
    candidates.push({ point, path: [] });
    return;
  }
  if (!hasAdjacentMove(project, map, point)) return;
  const path = findChasePath(project, map, { x: from.x, y: from.y }, point);
  if (path.length > 0) candidates.push({ point, path });
}

function hasAdjacentMove(project: Project, map: GameMap, point: ChasePoint): boolean {
  return (
    canMove(project, map, point.x, point.y, point.x + 1, point.y) ||
    canMove(project, map, point.x, point.y, point.x - 1, point.y) ||
    canMove(project, map, point.x, point.y, point.x, point.y + 1) ||
    canMove(project, map, point.x, point.y, point.x, point.y - 1)
  );
}

function pathToMoves(from: ChasePoint, path: readonly ChasePoint[]): MoveCommand[] {
  const moves: MoveCommand[] = [];
  let current = from;
  for (const point of path) {
    const dir = directionForDelta(point.x - current.x, point.y - current.y);
    if (!dir) return [];
    moves.push({ kind: "move", dir });
    current = point;
  }
  return moves;
}

function scheduledEvents(project: Project): EventWithSource[] {
  const result: EventWithSource[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (event.schedule?.length) result.push({ mapId: map.id, map, event });
    }
  }
  return result;
}

function directionForDelta(dx: number, dy: number): Dir | null {
  if (dx === 0 && dy === 1) return "down";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 1 && dy === 0) return "right";
  if (dx === 0 && dy === -1) return "up";
  return null;
}

function isMapEdge(map: GameMap, x: number, y: number): boolean {
  return x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
}

function sameLocation(left: RuntimeEventLocation | undefined, right: RuntimeEventLocation): boolean {
  return (
    left?.mapId === right.mapId &&
    left.x === right.x &&
    left.y === right.y &&
    left.direction === right.direction
  );
}
