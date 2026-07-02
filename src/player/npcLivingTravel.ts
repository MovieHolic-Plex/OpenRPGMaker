import { canMove } from "@/project/collision";
import type { Dir, GameMap, MapConnection, MapId, MoveCommand, Project } from "@/project/types";
import type { RuntimeEventView } from "@/player/runtimeEventState";
import type { PlaySessionLike } from "@/player/types";

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
    const path = pathTo(context.project, context.map, current, destinationPoint);
    if (path.length === 0) return null;
    return livingRoute(context.view, path, destination.mapId, destinationPoint);
  }

  const connectionPath = firstConnectionToward(context.project.mapConnections ?? [], context.map.id, destination.mapId);
  if (!connectionPath) return null;
  const connection = connectionPath.first;
  const departure = clampPoint(context.map, connection.from);
  if (samePoint(current, departure)) {
    return livingRoute(
      context.view,
      [{ kind: "npcTransfer", mapId: connection.to.mapId, x: connection.to.x, y: connection.to.y, direction: connection.to.direction }],
      connection.to.mapId,
      connection.to
    );
  }
  const path = pathTo(context.project, context.map, current, departure);
  if (path.length === 0) return null;
  return livingRoute(
    context.view,
    [...path, { kind: "npcTransfer", mapId: connection.to.mapId, x: connection.to.x, y: connection.to.y, direction: connection.to.direction }],
    connection.to.mapId,
    connection.to
  );
}

function activeDestination(context: RouteContext): NonNullable<RuntimeEventView["movement"]["living"]>["destinations"][number] | null {
  const living = context.view.movement.living;
  if (!living || living.destinations.length === 0) return null;
  const startIndex = context.session.npcTravelStates?.[context.view.event.id]?.destinationIndex ?? 0;
  for (let offset = 0; offset < living.destinations.length; offset += 1) {
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

function firstConnectionToward(
  connections: readonly MapConnection[],
  fromMapId: MapId,
  toMapId: MapId
): ConnectionPath | null {
  const enabled = connections.filter((connection) => connection.npcEnabled);
  const queue: { readonly mapId: MapId; readonly first: MapConnection | null }[] = [{ mapId: fromMapId, first: null }];
  const visited = new Set<MapId>([fromMapId]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    for (const connection of enabled) {
      if (connection.from.mapId !== current.mapId || visited.has(connection.to.mapId)) continue;
      const first = current.first ?? connection;
      if (connection.to.mapId === toMapId) return { first };
      visited.add(connection.to.mapId);
      queue.push({ mapId: connection.to.mapId, first });
    }
  }
  return null;
}

function pathTo(project: Project, map: GameMap, from: Point, to: Point): MoveCommand[] {
  if (samePoint(from, to)) return [];
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
      if (visited.has(key) || !canMove(project, map, current.x, current.y, next.x, next.y)) continue;
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
