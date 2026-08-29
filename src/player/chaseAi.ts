import { canMove, canMoveFootprint, inBounds } from "@/project/collision";
import { resolveKiteIntent, type KiteBand } from "@/battle/action/kiting";
import type { CharacterFootprint, Dir, GameMap, Project, Rect } from "@/project/types";

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
  /** 원거리 적의 거리 유지 밴드. 주면 붙지 않고 선호 거리를 지킨다. */
  readonly kite?: KiteBand;
  /** 추격자 자신의 통행 사각. 생략 시 1x1 — 기존 호출부는 동작이 안 바뀐다. */
  readonly pass?: ChasePassSize;
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

  // 거리 유지: 최소 거리 안으로 붙으면 뒤로 물러나고, 선호 밴드 안이면 버틴다.
  // 밴드보다 멀어졌을 때만 아래의 일반 추격 경로를 탄다.
  if (input.kite) {
    const intent = resolveKiteIntent({ distance: chebyshev(input.from, input.player), band: input.kite });
    if (intent === "hold") {
      mover.chasePath = [];
      return { kind: "wait" };
    }
    if (intent === "retreat") {
      mover.chasePath = [];
      const step = retreatStep(input.project, input.map, input.from, input.player, input.pass);
      if (!step) return { kind: "wait" };
      const away = directionForDelta(step.x - input.from.x, step.y - input.from.y);
      if (!away) return { kind: "wait" };
      mover.timer = 0;
      return { kind: "move", x: step.x, y: step.y, dir: away };
    }
  }

  if (mover.chaseRepathTimerMs >= REPATH_INTERVAL_MS || !mover.chasePath || mover.chasePath.length === 0) {
    mover.chasePath = input.pathfind === false
      ? directStepPath(input.project, input.map, input.from, input.player, input.pass)
      : findChasePath(input.project, input.map, input.from, input.player, input.pass);
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
  // 거리를 지키는 적은 플레이어 칸을 밟지 않는다 — 접촉으로 끝내는 게 목적이 아니다.
  if (next.x === input.player.x && next.y === input.player.y) {
    return input.kite ? { kind: "wait" } : { kind: "touch", dir };
  }
  mover.chasePath = mover.chasePath.slice(1);
  return { kind: "move", x: next.x, y: next.y, dir };
}

/**
 * 추격자 자신의 통행 사각 크기. 생략하면 1x1 이고, 그 경우 `chasePassable` 은
 * `canMove` 1회로 환원된다 — 기존 추격 동작이 그대로다.
 */
export type ChasePassSize = {
  readonly footprint: CharacterFootprint;
  readonly passRows: number;
};

/** 추격자의 통행 사각으로 한 칸 이동 가능한가. pass 생략 시 canMove 와 같다. */
function chasePassable(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  to: ChasePoint,
  pass: ChasePassSize | undefined
): boolean {
  if (!pass) return canMove(project, map, from.x, from.y, to.x, to.y);
  return canMoveFootprint(project, map, from.x, from.y, pass.footprint, to.x, to.y, pass.passRows);
}

export function findChasePath(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  to: ChasePoint,
  pass?: ChasePassSize
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
      if (!chasePassable(project, map, current.point, next, pass)) continue;
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

function directStepPath(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  to: ChasePoint,
  pass: ChasePassSize | undefined
): ChasePoint[] {
  const candidates = [...DIRECTIONS]
    .map((direction) => ({ x: from.x + direction.x, y: from.y + direction.y }))
    .filter((point) => chasePassable(project, map, from, point, pass))
    .sort((a, b) => manhattan(a, to) - manhattan(b, to));
  return candidates[0] ? [candidates[0]] : [];
}

// 후퇴 한 걸음. 플레이어에서 가장 멀어지는 통행 가능 칸을 고른다(체비셰프 우선, 맨해튼 타이브레이크).
// 뒷걸짐이 생기지 않으면(모리 끌입) null — 그럴 땐 그자리에서 버틴다.
function retreatStep(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  player: ChasePoint,
  pass: ChasePassSize | undefined
): ChasePoint | null {
  const candidates = [...DIRECTIONS]
    .map((direction) => ({ x: from.x + direction.x, y: from.y + direction.y }))
    .filter((point) => chasePassable(project, map, from, point, pass))
    .filter((point) => !(point.x === player.x && point.y === player.y))
    .sort((a, b) => (
      (chebyshev(b, player) - chebyshev(a, player)) || (manhattan(b, player) - manhattan(a, player))
    ));
  const best = candidates[0];
  if (!best) return null;
  return chebyshev(best, player) > chebyshev(from, player) ? best : null;
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

function chebyshev(a: ChasePoint, b: ChasePoint): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
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
