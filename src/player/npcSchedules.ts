import { canMove, isPassable } from "@/project/collision";
import { initialGameTime, resolveTimeSystem } from "@/project/gameTime";
import { npcScheduleTargetForEvent, type NpcScheduleTarget } from "@/project/npcSchedule";
import { store } from "@/project/store";
import type { Dir, GameEvent, GameMap, MapId, MoveCommand, Project } from "@/project/types";
import { findChasePath, nearestReachableCandidate, type ChasePoint } from "@/player/chaseAi";
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
> & Partial<Pick<PlaySceneContext, "refreshRuntimeEntities">>;

type EventWithSource = {
  readonly mapId: MapId;
  readonly map: GameMap;
  readonly event: GameEvent;
};

/** 시간표 점검 주기. 게임 시간은 분 단위라 매 프레임 볼 이유가 없다. */
export const NPC_SCHEDULE_TICK_MS = 100;

const scheduleTickAccumulators = new WeakMap<object, number>();

/**
 * 프레임 루프에서 부르는 진입점. updateNpcSchedules 는 NPC 수 × 맵 면적에 비례하는
 * 경로 탐색을 하므로(실측 100×100·NPC 30명 = 23.0ms) 매 프레임 돌면 예산을 넘긴다.
 * 첫 호출은 즉시 돌고 이후는 NPC_SCHEDULE_TICK_MS 마다 돈다 — 시간표 반응 지연은
 * 최대 0.1초로 게임 시간 1분보다 훨씬 짧다.
 */
export function tickNpcSchedules(
  scene: NpcScheduleSceneContext,
  paused: boolean,
  deltaMs: number
): void {
  const elapsed = (scheduleTickAccumulators.get(scene) ?? NPC_SCHEDULE_TICK_MS) + Math.max(0, deltaMs);
  if (elapsed < NPC_SCHEDULE_TICK_MS) {
    scheduleTickAccumulators.set(scene, elapsed);
    return;
  }
  scheduleTickAccumulators.set(scene, 0);
  updateNpcSchedules(scene, paused);
}

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
  // 예전에는 scheduledEvents(project) 가 매 프레임 배열 + 이벤트마다 래퍼 객체를 새로
  // 만들었다. 순회 자체는 같고 할당만 없앤다.
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (!event.schedule?.length) continue;
      scheduledIds.add(event.id);
      const target = npcScheduleTargetForEvent(map.id, event, scene.session.gameTime);
      if (!target) continue;
      changed = applyNpcScheduleTarget(scene, project, { mapId: map.id, map, event }, target) || changed;
    }
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
    // 시간표 변경은 이벤트(스프라이트·마커)만 건드린다. 타일·농지·설치물은 그대로이므로
    // renderTiles 전체 재생성(100×100 = GameObject 1만~2.1만개, 실측 15.9~26ms)을 피한다.
    if (scene.refreshRuntimeEntities) scene.refreshRuntimeEntities();
    else scene.refreshRuntimeSurfaces();
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

  // 이미 이 목표로 걸어가는 중이면 아무것도 하지 않는다. 예전에는 이 판정이
  // registerScheduleRoute 안(경로 탐색 **뒤**)에 있어서, 걷는 동안에도 A* 를 매 프레임
  // 전부 돌린 뒤 결과를 버렸다 — 렉의 지배 원인이었다(실측 NPC 30명 23.0ms/프레임).
  if (state[eventId]?.routeKey === target.key && scene.autonomousNPCs.has(eventId)) return false;

  // 도달 불가한 목표는 실패를 기억한다. 그러지 않으면 맵 전체 탐색(실측 174ms)이 매
  // 프레임 반복된다. 출발/도착 칸이 바뀌면 즉시, 그대로면 RETRY 프레임 뒤에 다시 본다
  // (이벤트가 비켜서 길이 열릴 수 있으므로 영구 포기는 하지 않는다).
  const failureSignature = `${normalizedTarget.mapId}:${normalizedTarget.x},${normalizedTarget.y}<-${current.x},${current.y}`;
  const failures = scheduleRouteFailures(scene);
  const failure = failures.get(eventId);
  if (failure?.signature === failureSignature && failure.retryIn > 0) {
    failure.retryIn -= 1;
    return false;
  }

  const route = routeTo(project, scene.map, current, normalizedTarget);
  if (route.length === 0) {
    failures.set(eventId, { signature: failureSignature, retryIn: SCHEDULE_ROUTE_RETRY_TICKS });
    return false;
  }
  failures.delete(eventId);
  return registerScheduleRoute(scene, eventId, route, target.key);
}

type ScheduleRouteFailure = { readonly signature: string; retryIn: number };

/** 도달 불가 재시도 간격(시간표 점검 횟수). NPC_SCHEDULE_TICK_MS 기준 약 1초. */
const SCHEDULE_ROUTE_RETRY_TICKS = 10;

/**
 * 씬별 경로 실패 기억. 세션(session.npcScheduleStates)에 두면 세이브 파일로 새어 나가고
 * 저장 포맷이 바뀌므로 런타임 전용으로 씬 객체에 매단다.
 */
const scheduleRouteFailuresByScene = new WeakMap<object, Map<string, ScheduleRouteFailure>>();

function scheduleRouteFailures(scene: NpcScheduleSceneContext): Map<string, ScheduleRouteFailure> {
  const existing = scheduleRouteFailuresByScene.get(scene);
  if (existing) return existing;
  const created = new Map<string, ScheduleRouteFailure>();
  scheduleRouteFailuresByScene.set(scene, created);
  return created;
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
  // 이미 이 목표의 출구로 걸어가는 중이면 출구를 다시 고르지 않는다. 예전에는 걷는 동안
  // 매 프레임 nearestReachableEdge(경계 396칸 × A*, 실측 150ms/프레임/NPC 1명) + routeTo 를
  // 다시 돌리고, 같은 결과라서 registerScheduleRoute 가 false 를 내는 것으로 끝났다.
  // 출구를 고정하는 편이 의도에도 맞다 — 걸어가는 도중에 목표 출구가 흔들리지 않는다.
  if (existing?.exitTarget && existing.routeKey?.startsWith(`exit:${targetKey}:`) === true && scene.autonomousNPCs.has(eventId)) {
    return false;
  }
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

/**
 * 맵을 떠날 때 향할 경계칸. 후보 순서·동률 규칙은 예전과 같고, 후보마다 A* 를 돌리던 것을
 * BFS 한 번으로 바꿨다(경계 396칸 × 최대 174ms → 1회 순회).
 */
function nearestReachableEdge(
  project: Project,
  map: GameMap,
  from: RuntimeEventLocation
): ChasePoint | null {
  const candidates: ChasePoint[] = [];
  for (let x = 0; x < map.width; x += 1) {
    pushEdgeCandidate(project, map, candidates, { x, y: 0 });
    pushEdgeCandidate(project, map, candidates, { x, y: map.height - 1 });
  }
  for (let y = 1; y < map.height - 1; y += 1) {
    pushEdgeCandidate(project, map, candidates, { x: 0, y });
    pushEdgeCandidate(project, map, candidates, { x: map.width - 1, y });
  }
  // 예전 구현은 from 자신이 통행 가능한 경계칸이면 경로 길이 0 으로 무조건 이겼다
  // (인접 통행 검사도 건너뛴다). 호출 지점이 경계칸을 먼저 걸러내지만 규칙은 남긴다.
  const self = candidates.find((point) => point.x === from.x && point.y === from.y);
  if (self) return self;
  return nearestReachableCandidate(
    project,
    map,
    { x: from.x, y: from.y },
    candidates,
    (point) => hasAdjacentMove(project, map, point)
  );
}

function pushEdgeCandidate(
  project: Project,
  map: GameMap,
  candidates: ChasePoint[],
  point: ChasePoint
): void {
  if (!isPassable(project, map, point.x, point.y)) return;
  candidates.push(point);
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
