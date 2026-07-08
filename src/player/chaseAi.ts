import { canMove, inBounds } from "@/project/collision";
import type { Dir, GameMap, Project, Rect } from "@/project/types";

const REPATH_INTERVAL_MS = 500;
const DIRECTIONS: readonly { readonly dir: Dir; readonly x: number; readonly y: number }[] = [
  { dir: "down", x: 0, y: 1 },
  { dir: "left", x: -1, y: 0 },
  { dir: "right", x: 1, y: 0 },
  { dir: "up", x: 0, y: -1 },
];

export type ChasePoint = {
  readonly x: number;
  readonly y: number;
};

export type ChaseRuntimeState = {
  timer: number;
  moveIntervalMs: number;
  chaseRepathTimerMs?: number;
  chasePath?: ChasePoint[];
  chaseActive?: boolean;
  chaseHome?: ChasePoint;
};

export type ChaseDecision =
  | { readonly kind: "wait" }
  | { readonly kind: "move"; readonly x: number; readonly y: number; readonly dir: Dir }
  | { readonly kind: "touch"; readonly dir: Dir };

export function nextChaseDecision(input: {
  readonly project: Project;
  readonly map: GameMap;
  readonly from: ChasePoint;
  readonly player: ChasePoint;
  readonly deltaMs: number;
  readonly mover: ChaseRuntimeState;
  readonly sightRange?: number;
  readonly giveUpRange?: number;
  readonly pathfind?: boolean;
}): ChaseDecision {
  const { mover } = input;
  mover.chaseHome ??= { ...input.from };
  mover.timer += Math.max(0, input.deltaMs);
  mover.chaseRepathTimerMs = (mover.chaseRepathTimerMs ?? REPATH_INTERVAL_MS) + Math.max(0, input.deltaMs);

  if (isInSafeZone(input.map.safeZones, input.player)) {
    mover.chaseActive = false;
    mover.chasePath = [];
    return { kind: "wait" };
  }

  const distance = manhattan(input.from, input.player);
  if (input.giveUpRange !== undefined && distance > input.giveUpRange) {
    mover.chaseActive = false;
    mover.chasePath = [];
    return { kind: "wait" };
  }
  if (input.sightRange !== undefined && mover.chaseActive !== true && distance > input.sightRange) {
    return { kind: "wait" };
  }
  mover.chaseActive = true;
  if (mover.timer < mover.moveIntervalMs) return { kind: "wait" };

  if (mover.chaseRepathTimerMs >= REPATH_INTERVAL_MS || !mover.chasePath || mover.chasePath.length === 0) {
    mover.chasePath = input.pathfind === false
      ? directStepPath(input.project, input.map, input.from, input.player)
      : findChasePath(input.project, input.map, input.from, input.player);
    mover.chaseRepathTimerMs = 0;
  }

  const next = mover.chasePath[0];
  if (!next) return { kind: "wait" };
  const dir = directionForDelta(next.x - input.from.x, next.y - input.from.y);
  if (!dir) {
    mover.chasePath = mover.chasePath.slice(1);
    return { kind: "wait" };
  }
  mover.timer = 0;
  if (next.x === input.player.x && next.y === input.player.y) return { kind: "touch", dir };
  mover.chasePath = mover.chasePath.slice(1);
  return { kind: "move", x: next.x, y: next.y, dir };
}

export function findChasePath(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  to: ChasePoint
): ChasePoint[] {
  if (!inBounds(map, from.x, from.y) || !inBounds(map, to.x, to.y)) return [];
  if (from.x === to.x && from.y === to.y) return [];
  const open: AStarNode[] = [{
    point: from,
    key: pointKey(from),
    g: 0,
    h: manhattan(from, to),
    order: 0,
  }];
  const nodes = new Map<string, AStarNode>([[pointKey(from), open[0] as AStarNode]]);
  const closed = new Set<string>();
  let order = 1;

  while (open.length > 0) {
    open.sort(compareNode);
    const current = open.shift();
    if (!current) break;
    if (current.point.x === to.x && current.point.y === to.y) return reconstructPath(current);
    closed.add(current.key);

    for (const direction of DIRECTIONS) {
      const next = { x: current.point.x + direction.x, y: current.point.y + direction.y };
      if (!canMove(project, map, current.point.x, current.point.y, next.x, next.y)) continue;
      const key = pointKey(next);
      if (closed.has(key)) continue;
      const g = current.g + 1;
      const existing = nodes.get(key);
      if (existing && existing.g <= g) continue;
      const node: AStarNode = {
        point: next,
        key,
        g,
        h: manhattan(next, to),
        order: existing?.order ?? order,
        prev: current,
      };
      if (!existing) order += 1;
      nodes.set(key, node);
      if (!existing) open.push(node);
      else {
        const index = open.findIndex((entry) => entry.key === key);
        if (index >= 0) open[index] = node;
      }
    }
  }
  return [];
}

export function isInSafeZone(safeZones: readonly Rect[] | undefined, point: ChasePoint): boolean {
  return (safeZones ?? []).some((zone) => (
    point.x >= zone.x &&
    point.y >= zone.y &&
    point.x < zone.x + Math.max(0, zone.w) &&
    point.y < zone.y + Math.max(0, zone.h)
  ));
}

function directStepPath(project: Project, map: GameMap, from: ChasePoint, to: ChasePoint): ChasePoint[] {
  const candidates = [...DIRECTIONS]
    .map((direction) => ({ x: from.x + direction.x, y: from.y + direction.y }))
    .filter((point) => canMove(project, map, from.x, from.y, point.x, point.y))
    .sort((a, b) => manhattan(a, to) - manhattan(b, to));
  return candidates[0] ? [candidates[0]] : [];
}

function directionForDelta(dx: number, dy: number): Dir | null {
  if (dx === 0 && dy === 1) return "down";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 1 && dy === 0) return "right";
  if (dx === 0 && dy === -1) return "up";
  return null;
}

function manhattan(a: ChasePoint, b: ChasePoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

type AStarNode = {
  readonly point: ChasePoint;
  readonly key: string;
  readonly g: number;
  readonly h: number;
  readonly order: number;
  readonly prev?: AStarNode;
};

function compareNode(a: AStarNode, b: AStarNode): number {
  const f = (a.g + a.h) - (b.g + b.h);
  if (f !== 0) return f;
  const h = a.h - b.h;
  if (h !== 0) return h;
  return a.order - b.order;
}

function reconstructPath(node: AStarNode): ChasePoint[] {
  const path: ChasePoint[] = [];
  let current: AStarNode | undefined = node;
  while (current?.prev) {
    path.push(current.point);
    current = current.prev;
  }
  return path.reverse();
}

function pointKey(point: ChasePoint): string {
  return `${point.x},${point.y}`;
}
