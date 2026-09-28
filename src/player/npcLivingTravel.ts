import { passageBounds } from "@/project/footprint";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import { canMoveFootprint, canMove } from "@/project/collision";
import { armTerrainComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import type { Dir, GameMap, MapConnection, MapId, MoveCommand, Project } from "@/project/types";
import type { RuntimeEventView } from "@/project/runtimeEventState"
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

export type LivingRoute = {
  readonly moves: MoveCommand[];
  readonly repeat: boolean;
  readonly strategy: "sequence";
  readonly key: string;
};

type Point = {
  readonly x: number;
  readonly y: number;
};

type RouteContext = {
  readonly project: Project;
  readonly map: GameMap;
  readonly session: PlaySessionLike;
  readonly view: RuntimeEventView;
  /** 막힘 사건에서만 제공하는 현재 점유/통행 판정. 탐색 밖으로 보관하지 않는다. */
  readonly canStep?: (fromX: number, fromY: number, toX: number, toY: number) => boolean;
};

type ConnectionPath = {
  readonly first: MapConnection;
};

const DIRECTIONS: readonly { readonly dir: Dir; readonly dx: number; readonly dy: number }[] = [
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
  { dir: "up", dx: 0, dy: -1 },
];

export function routeForLivingMovement(context: RouteContext): LivingRoute | null {
  const movement = context.view.movement;
  if (movement.type !== "living") return null;
  const living = movement.living;
  if (!living || living.destinations.length === 0) return null;

  const destination = activeDestination(context);
  if (!destination) return null;

  const current = { x: context.view.x, y: context.view.y };
  if (context.map.id === destination.mapId) {
    const destinationPoint = clampPoint(context.map, destination);
    if (samePoint(current, destinationPoint)) {
      advanceDestination(context.session, context.view.event.id, living.destinations.length, living.repeat);
      return null;
    }
    const path = livingPath(context, current, destinationPoint);
    if (path.length === 0) return null;
    return livingRoute(context.view, path, destination.mapId, destinationPoint);
  }

  const connections = context.project.mapConnections ?? [];
  const preferred = firstConnectionToward(connections, context.map.id, destination.mapId)?.first;
  const exits = connectionsByFromMap(connections).get(context.map.id) ?? [];
  for (const connection of preferred ? [preferred, ...exits.filter(item => item !== preferred)] : exits) {
    if (connection.to.mapId === context.map.id) continue;
    if (connection.to.mapId !== destination.mapId
      && !firstConnectionToward(connections, connection.to.mapId, destination.mapId, context.map.id)) continue;
    const departure = clampPoint(context.map, connection.from);
    const path = samePoint(current, departure) ? [] : livingPath(context, current, departure);
    if (!samePoint(current, departure) && path.length === 0) continue;
    return livingRoute(context.view,
      [...path, { kind: "npcTransfer", mapId: connection.to.mapId, x: connection.to.x, y: connection.to.y, direction: connection.to.direction }],
      connection.to.mapId, connection.to);
  }
  return null;
}

/**
 * 경로 탐색 없이 지금 향하는 목표만 문자열로 낸다(`livingRoute` 키의 `->` 뒤와 같은 모양).
 * 이미 그 목표로 걷고 있는 무버가 있으면 호출부가 BFS 를 건너뛸 수 있게 하려는 것이다 —
 * registerPageMoveRoutes 는 표면 갱신마다 불리고, 그때마다 생활 NPC 전원이 맵 전체 BFS 를 돌았다.
 * 목표에 이미 도착했으면(목적지 전진이 필요한 경우) null 을 내서 전체 경로 계산으로 넘긴다.
 */
export function livingRouteTargetKey(context: RouteContext, previousTarget?: string | null): string | null {
  const movement = context.view.movement;
  if (movement.type !== "living" || !movement.living || movement.living.destinations.length === 0) return null;
  const destination = activeDestination(context);
  if (!destination) return null;
  const current = { x: context.view.x, y: context.view.y };
  if (context.map.id === destination.mapId) {
    const point = clampPoint(context.map, destination);
    return samePoint(current, point) ? null : `${destination.mapId}:${point.x},${point.y}`;
  }
  if (previousTarget) {
    const connections = context.project.mapConnections ?? [];
    const retained = (connectionsByFromMap(connections).get(context.map.id) ?? []).some(connection =>
      `${connection.to.mapId}:${connection.to.x},${connection.to.y}` === previousTarget
      && (connection.to.mapId === destination.mapId || firstConnectionToward(connections, connection.to.mapId, destination.mapId, context.map.id)));
    if (retained) return previousTarget;
  }
  const connectionPath = firstConnectionToward(context.project.mapConnections ?? [], context.map.id, destination.mapId);
  if (!connectionPath) return null;
  const to = connectionPath.first.to;
  return `${to.mapId}:${to.x},${to.y}`;
}

/** `livingRoute` 키에서 목표 부분을 떼어 낸다. 생활 경로 키가 아니면 null. */
export function livingRouteKeyTarget(key: string): string | null {
  if (!key.startsWith("living:")) return null;
  const arrow = key.indexOf("->");
  const lengthSeparator = key.lastIndexOf(":");
  if (arrow < 0 || lengthSeparator <= arrow) return null;
  return key.slice(arrow + 2, lengthSeparator);
}

function activeDestination(context: RouteContext): NonNullable<RuntimeEventView["movement"]["living"]>["destinations"][number] | null {
  const living = context.view.movement.living;
  if (!living || living.destinations.length === 0) return null;
  const startIndex = context.session.npcTravelStates?.[context.view.event.id]?.destinationIndex ?? 0;
  for (let offset = 0; offset < living.destinations.length; offset += 1) {
    if (!living.repeat && startIndex + offset >= living.destinations.length) break;
    const index = (startIndex + offset) % living.destinations.length;
    const destination = living.destinations[index];
    if (!context.project.maps[destination.mapId]) continue;
    if (destination.switchId && context.session.switches[destination.switchId] !== true) continue;
    if (offset > 0) {
      const states = context.session.npcTravelStates ??= {};
      states[context.view.event.id] = { destinationIndex: index };
    }
    return destination;
  }
  return null;
}

function advanceDestination(session: PlaySessionLike, eventId: string, destinationCount: number, repeat: boolean): void {
  const current = session.npcTravelStates?.[eventId]?.destinationIndex ?? 0;
  if (current >= destinationCount - 1 && !repeat) return;
  const next = (current + 1) % destinationCount;
  session.npcTravelStates ??= {};
  session.npcTravelStates[eventId] = { destinationIndex: next };
}

/** @internal 테스트용으로 내보낸다(연결 기억의 제자리 편집 반례). */
export function firstConnectionToward(
  connections: readonly MapConnection[],
  fromMapId: MapId,
  toMapId: MapId,
  excludedMapId?: MapId
): ConnectionPath | null {
  // 출발 맵별 연결 목록(원본 순서 유지). 예전에는 큐의 맵마다 모든 연결을 훑어 O(맵×연결)이었다 —
  // 연결 512개 사슬에서 NPC 10명 조회가 약 21ms, 경로 재사용 분기에서도 표면 갱신마다 불린다.
  const byFrom = connectionsByFromMap(connections);
  const queue: { readonly mapId: MapId; readonly first: MapConnection | null }[] = [{ mapId: fromMapId, first: null }];
  const visited = new Set<MapId>([fromMapId]);
  if (excludedMapId) visited.add(excludedMapId);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    for (const connection of byFrom.get(current.mapId) ?? []) {
      if (visited.has(connection.to.mapId)) continue;
      const first = current.first ?? connection;
      if (connection.to.mapId === toMapId) return { first };
      visited.add(connection.to.mapId);
      queue.push({ mapId: connection.to.mapId, first });
    }
  }
  return null;
}

/**
 * npcEnabled 연결을 출발 맵별로 묶는다. 연결 배열 정체성으로 기억하되, 제자리 편집을 잡으려고 매번
 * 연결마다 정체성·npcEnabled·출발 맵·도착 맵을 확인한다(연결 수에 선형 — 예전 비용은 맵×연결이었다).
 */
type ConnectionIndex = {
  readonly items: readonly MapConnection[];
  readonly keys: readonly string[];
  readonly byFrom: Map<MapId, MapConnection[]>;
};
const connectionIndexes = new WeakMap<readonly MapConnection[], ConnectionIndex>();
// 구분자 충돌이 없게 JSON 배열로 만든다(맵 id 에 "|" 가 들어가도 섞이지 않는다).
const connectionKey = (item: MapConnection) => JSON.stringify([Boolean(item.npcEnabled), item.from.mapId, item.to.mapId]);
function connectionsByFromMap(connections: readonly MapConnection[]): Map<MapId, MapConnection[]> {
  const cached = connectionIndexes.get(connections);
  if (cached && cached.items.length === connections.length
    && cached.items.every((item, index) => item === connections[index] && cached.keys[index] === connectionKey(item))) {
    return cached.byFrom;
  }
  const byFrom = new Map<MapId, MapConnection[]>();
  for (const connection of connections) {
    if (!connection.npcEnabled) continue;
    const list = byFrom.get(connection.from.mapId);
    if (list) list.push(connection);
    else byFrom.set(connection.from.mapId, [connection]);
  }
  connectionIndexes.set(connections, { items: [...connections], keys: connections.map(connectionKey), byFrom });
  return byFrom;
}

function livingPath(context: RouteContext, from: Point, to: Point): MoveCommand[] {
  const { project, map, session, view } = context;
  const unit = view.footprint.width === 1 && view.footprint.height === 1 && view.passRows === 1;
  // 공간 판정은 Like에도 있는 두 placement 컬렉션만 읽는다(actorRows는 읽지 않는다).
  const canStep = context.canStep ?? ((fx: number, fy: number, tx: number, ty: number) =>
    canMoveFootprint(project, map, fx, fy, view.footprint, tx, ty, view.passRows)
    && !isSpatialPlacementBlocking(project, session as Parameters<typeof isSpatialPlacementBlocking>[1], map.id, passageBounds(tx, ty, view.footprint, view.passRows)));
  return pathTo(project, map, from, to, canStep, unit && !context.canStep);
}

function pathTo(project: Project, map: GameMap, from: Point, to: Point, canStep?: RouteContext["canStep"], useTerrainIndex = !canStep): MoveCommand[] {
  if (samePoint(from, to)) return [];
  // 기본 1×1만 성분 색인으로 거른다. 몸/사용자 판정은 다른 통행 그래프일 수 있다.
  // 예전에는 목적지가 벽 안이면 표면 갱신마다 생활 NPC 마다 맵 전체 BFS 를 다시 돌렸다(NPC 10명 약 90ms).
  // 한 방향 턱은 색인이 보수적으로 잇는다(tilePassabilityComponents §buildLabels).
  if (useTerrainIndex && !terrainMayReach(project, map, from.x, from.y, to.x, to.y)) return [];
  // 방문 순서·방향 순서는 예전 문자열 키 BFS 와 같다. 칸을 정수 번호로, 방문·직전 칸을 typed array 로 둬
  // 문자열·Map·Set·좌표 객체를 칸마다 만들지 않는다 — 생활 NPC 50명 맵 진입이 약 290ms 였다(브라우저 실측).
  // 맵 밖 칸은 canMove 가 막으므로(inBounds) 큐에 들어가지 않는다. 출발점이 맵 밖이면 예전 경로로 간다.
  const width = map.width;
  const height = map.height;
  if (!inside(map, from) || !inside(map, to)) return pathToSlow(project, map, from, to, canStep);
  const cells = width * height;
  const startKey = from.y * width + from.x;
  const targetKey = to.y * width + to.x;
  const previousCell = new Int32Array(cells).fill(-1);
  const previousDir = new Int8Array(cells);
  const visited = new Uint8Array(cells);
  const queue = new Int32Array(cells);
  let head = 0;
  let tail = 0;
  let visitedCount = 1;
  visited[startKey] = 1;
  queue[tail++] = startKey;
  while (head < tail) {
    const current = queue[head++]!;
    const cx = current % width;
    const cy = (current - cx) / width;
    for (let d = 0; d < DIRECTIONS.length; d += 1) {
      const step = DIRECTIONS[d]!;
      const nx = cx + step.dx;
      const ny = cy + step.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const key = ny * width + nx;
      if (visited[key] || !(canStep ? canStep(cx, cy, nx, ny) : canMove(project, map, cx, cy, nx, ny))) continue;
      visited[key] = 1;
      visitedCount += 1;
      previousCell[key] = current;
      previousDir[key] = d;
      if (key === targetKey) return unwindCells(previousCell, previousDir, startKey, targetKey);
      queue[tail++] = key;
    }
  }
  // 성분 전체를 훑고도 못 만났다. 같은 질의가 다시 오면 색인이 바로 답하게 남긴다(훑은 칸이 적으면 안 만든다).
  if (useTerrainIndex) armTerrainComponents(project, map, visitedCount);
  return [];
}

function inside(map: GameMap, point: Point): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y)
    && point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function unwindCells(previousCell: Int32Array, previousDir: Int8Array, startKey: number, targetKey: number): MoveCommand[] {
  const reversed: MoveCommand[] = [];
  let current = targetKey;
  while (current !== startKey) {
    const prev = previousCell[current]!;
    if (prev < 0) return [];
    reversed.push({ kind: "move", dir: DIRECTIONS[previousDir[current]!]!.dir });
    current = prev;
  }
  return reversed.reverse();
}

/** 맵 밖 좌표가 들어온 경우의 예전 구현(문자열 키). 정상 입력은 위 정수 경로를 탄다. */
function pathToSlow(project: Project, map: GameMap, from: Point, to: Point, canStep?: RouteContext["canStep"]): MoveCommand[] {
  const startKey = pointKey(from);
  const targetKey = pointKey(to);
  const queue: Point[] = [from];
  const previous = new Map<string, { readonly point: Point; readonly dir: Dir }>();
  const visited = new Set<string>([startKey]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    for (const step of DIRECTIONS) {
      const next = { x: current.x + step.dx, y: current.y + step.dy };
      const key = pointKey(next);
      if (visited.has(key) || !(canStep ? canStep(current.x, current.y, next.x, next.y) : canMove(project, map, current.x, current.y, next.x, next.y))) continue;
      visited.add(key);
      previous.set(key, { point: current, dir: step.dir });
      if (key === targetKey) return unwindPath(previous, from, to);
      queue.push(next);
    }
  }
  return [];
}

function unwindPath(previous: ReadonlyMap<string, { readonly point: Point; readonly dir: Dir }>, from: Point, to: Point): MoveCommand[] {
  const reversed: MoveCommand[] = [];
  let current = to;
  while (!samePoint(current, from)) {
    const step = previous.get(pointKey(current));
    if (!step) return [];
    reversed.push({ kind: "move", dir: step.dir });
    current = step.point;
  }
  return reversed.reverse();
}

function livingRoute(view: RuntimeEventView, moves: MoveCommand[], targetMapId: MapId, target: Point): LivingRoute {
  return {
    moves,
    repeat: false,
    strategy: "sequence",
    key: `living:${view.event.id}:${view.pageId ?? "legacy"}:${view.x},${view.y}->${targetMapId}:${target.x},${target.y}:${moves.length}`,
  };
}

function clampPoint(map: GameMap, point: Point): Point {
  return {
    x: Math.max(0, Math.min(map.width - 1, Math.trunc(point.x))),
    y: Math.max(0, Math.min(map.height - 1, Math.trunc(point.y))),
  };
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

/** 임시 양보 경로는 표면 갱신이 덮어쓰지 않는다. 무버 수명에 묶인다. */
export const yieldingLivingMovers = new WeakSet<object>();
