import { canMove, canMoveFootprint, inBounds } from "@/project/collision";
import { passageBounds } from "@/project/footprint";
import {
  armTerrainComponents,
  terrainMayReach,
  terrainReachFilter,
} from "@/project/tilePassabilityComponents";
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
  /**
   * 직전 재탐색이 빈 경로를 냈는가. 도달 불가한 표적은 A* 전체 탐색을 매 프레임 반복하게
   * 만들었다(실측 100×100 도달불가 174ms/프레임/NPC). 이 표시가 있으면 다음 재탐색은
   * REPATH_INTERVAL_MS 를 기다린다. 경로가 **소진돼서** 빈 경우는 표시가 없으므로
   * 예전처럼 즉시 재탐색한다 — 추격 반응성은 그대로다.
   */
  chasePathBlocked?: boolean;
};

export type ChaseDecision =
  | { readonly kind: "wait" }
  | { readonly kind: "move"; readonly x: number; readonly y: number; readonly dir: Dir }
  | { readonly kind: "touch"; readonly dir: Dir };

export function nextChaseDecision(input: {
  readonly project: Project;
  readonly map: GameMap;
  readonly from: ChasePoint;
  /**
   * 추겁 대상 칸. 거의 항상 플레이어지만, 진영 전투에서는 AutonomousMover.chaseTarget 로
   * 다른 NPC 좌표가 들어온다. 그 때 touch 는 이벤트 트리거가 아니라 "닿았다"만 의무한다.
   */
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

  const pathExhausted = !mover.chasePath || mover.chasePath.length === 0;
  if (mover.chaseRepathTimerMs >= REPATH_INTERVAL_MS || (pathExhausted && mover.chasePathBlocked !== true)) {
    mover.chasePath = input.pathfind === false
      ? directStepPath(input.project, input.map, input.from, input.player, input.pass)
      : findChasePath(input.project, input.map, input.from, input.player, input.pass);
    mover.chaseRepathTimerMs = 0;
    mover.chasePathBlocked = mover.chasePath.length === 0;
  }

  const path = mover.chasePath ?? [];
  const next = path[0];
  if (!next) return { kind: "wait" };
  const dir = directionForDelta(next.x - input.from.x, next.y - input.from.y);
  if (!dir) {
    mover.chasePath = path.slice(1);
    return { kind: "wait" };
  }
  mover.timer = 0;
  // 거리를 지키는 적은 플레이어 칸을 밟지 않는다 — 접촉으로 끝내는 게 목적이 아니다.
  if (next.x === input.player.x && next.y === input.player.y) {
    return input.kite ? { kind: "wait" } : { kind: "touch", dir };
  }
  mover.chasePath = path.slice(1);
  return { kind: "move", x: next.x, y: next.y, dir };
}

/**
 * 추격자 자신의 통행 사각 크기. 생략하면 1x1 이고, 그 경우 `chasePassable` 은
 * `canMove` 1회로 환원된다 — 기존 추격 동작이 그대로다.
 */
export type ChasePassSize = {
  readonly blocked?: (x: number, y: number) => boolean;
  readonly footprint: CharacterFootprint;
  readonly passRows: number;
};

/**
 * 통행 사각이 한 칸인가 — 성분 색인을 쓸 수 있는 조건.
 *
 * `pass` 의 **유무**로 갈라서는 안 된다. 런타임 추격은 1x1 NPC 에도
 * `pass: { footprint: view.footprint, passRows: view.passRows }` 를 객체로 항상 넘기므로
 * (playSceneAutonomous.ts §updateChaseNpc) 유무로 가르면 모든 추격 NPC 에서 색인이 죽는다.
 * 1x1 사각은 canMoveFootprint 가 canMove 1회로 환원돼 대칭 전제가 그대로 성립한다.
 * 그 환원을 규칙을 베껴 판정하지 않고 passageBounds 에 직접 물어 한 칸인지 본다.
 */
function passIsUnitRect(pass: ChasePassSize | undefined): boolean {
  if (!pass) return true;
  const rect = passageBounds(0, 0, pass.footprint, pass.passRows);
  return rect.left === rect.right && rect.top === rect.bottom;
}

/** 추격자의 통행 사각으로 한 칸 이동 가능한가. pass 생략 시 canMove 와 같다. */
function chasePassable(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  to: ChasePoint,
  pass: ChasePassSize | undefined
): boolean {
  if (pass?.blocked?.(to.x, to.y)) return false;
  if (!pass) return canMove(project, map, from.x, from.y, to.x, to.y);
  return canMoveFootprint(project, map, from.x, from.y, pass.footprint, to.x, to.y, pass.passRows);
}

/**
 * A* 한 칸 경로. 결과는 예전 구현과 **바이트 단위로 같다** — 자료구조만 바꿨다.
 *
 * 왜: 예전에는 while 반복마다 open 을 정렬하고(O(n log n)) 개선된 노드를 findIndex 로
 * 훑었다(O(n)). 문자열 키 `"x,y"` 도 반복마다 새 문자열을 만들었다. 실측 100×100
 * 도달불가 탐색이 174ms/호출 — 프레임 예산 16.7ms 의 10배다. 이진 최소힙 + 정수 키
 * (`y * width + x`) 로 23.6ms 가 된다.
 *
 * 순서가 같은 이유: 비교자(f → h → order)의 order 는 키마다 유일하므로 open 안에서
 * 전순서다. 즉 정렬 후 shift 와 힙 pop 이 같은 노드를 뽑는다. 개선(decrease-key)은
 * 지연 삭제로 둔다 — 개선 노드는 g 가 반드시 더 작아 f 도 작으므로 낡은 항목보다 먼저
 * 나오고, 낡은 항목은 pop 시점에 nodes 최신본과 다르다는 것으로 걸러진다.
 */
export function findChasePath(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  to: ChasePoint,
  pass?: ChasePassSize,
  canEnter?: (point: ChasePoint) => boolean
): ChasePoint[] {
  if (!inBounds(map, from.x, from.y) || !inBounds(map, to.x, to.y)) return [];
  if (from.x === to.x && from.y === to.y) return [];
  // 지형 성분이 다르면 아래 탐색은 맵 절반을 훑고 반드시 빈 경로를 낸다 — 그 결과를
  // 색인에서 바로 읽는다(실측 6.7ms → 25µs). 통행 사각이 1x1 보다 크면 통행 관계가
  // 비대칭이라 색인 대상이 아니다(tilePassabilityComponents 머리 주석).
  const unitPass = passIsUnitRect(pass);
  if (unitPass && !terrainMayReach(project, map, from.x, from.y, to.x, to.y)) return [];
  const width = map.width;
  const start: AStarNode = {
    point: from,
    key: from.y * width + from.x,
    g: 0,
    h: manhattan(from, to),
    order: 0,
  };
  const open = new NodeHeap();
  open.push(start);
  const nodes = new Map<number, AStarNode>([[start.key, start]]);
  const closed = new Set<number>();
  let order = 1;

  while (open.size > 0) {
    const current = open.pop();
    if (!current) break;
    // 지연 삭제된 낡은 항목. 같은 칸의 더 좋은 노드가 이미 처리됐다.
    if (nodes.get(current.key) !== current) continue;
    if (current.point.x === to.x && current.point.y === to.y) return reconstructPath(current);
    closed.add(current.key);

    for (const direction of DIRECTIONS) {
      const nx = current.point.x + direction.x;
      const ny = current.point.y + direction.y;
      // 정수 키는 맵 안에서만 유일하다(x = -1 은 윗줄 마지막 칸과 충돌).
      // 통행 판정도 같은 조건으로 막지만(collision.ts inBounds) 키를 만들기 전에 걸러야 한다.
      if (nx < 0 || ny < 0 || nx >= width || ny >= map.height) continue;
      const key = ny * width + nx;
      // closed 를 통행 판정 앞에 둔다 — 판정의 절반은 이미 처리한 칸에 쓰이고 있었다.
      if (closed.has(key)) continue;
      const next = { x: nx, y: ny };
      if (canEnter && !canEnter(next)) continue;
      if (!chasePassable(project, map, current.point, next, pass)) continue;
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
      open.push(node);
    }
  }
  // 여기 닿았다는 건 from 의 성분 전체를 훑고도 to 를 못 만났다는 뜻이다. 그 탐색 값을
  // 성분 색인으로 남겨 같은 질의가 반복될 때 다시 훑지 않게 한다. 1x1 보다 큰 통행 사각은
  // 색인의 대칭 전제를 만족하지 않으므로 남기지 않는다. closed.size 는 방금 훑은 성분의
  // 크기다 — 그게 면적에 비해 작으면 색인이 손해라 만들지 않는다.
  if (unitPass && !canEnter) armTerrainComponents(project, map, closed.size);
  return [];
}

/**
 * from 에서 4방향으로 도달할 수 있는 후보 중 가장 가까운 것. 동률은 candidates 배열에서
 * 앞선 것을 고른다(예전의 안정 정렬과 같은 규칙).
 *
 * 왜: 후보마다 A* 를 따로 돌리면 100×100 맵 경계 396칸 질의가 150ms/프레임이었다.
 * 너비 우선으로 한 번만 퍼지면 같은 답을 얻는다 — 한 칸 비용이 1 이므로 BFS 깊이가
 * 곧 최단 경로 길이다. accept 는 후보를 실제로 고를 때만 부르므로(닿은 것만) 예전처럼
 * 396칸 전부에 인접 통행 검사를 돌리지 않는다.
 */
export function nearestReachableCandidate(
  project: Project,
  map: GameMap,
  from: ChasePoint,
  candidates: readonly ChasePoint[],
  accept?: (point: ChasePoint) => boolean
): ChasePoint | null {
  if (!inBounds(map, from.x, from.y)) return null;
  const width = map.width;
  const targets = new Map<number, number>();
  // 성분이 다른 후보는 아래 BFS 가 절대 닿지 못한다 — 미리 빼도 답과 동률 규칙이 같다.
  // 집 안에 갇힌 주민처럼 **모든** 후보가 빠지는 경우가 이 걸러내기의 목적이다:
  // 예전에는 그때마다 자기 성분 전체를 훑었다. 판정기를 한 번 만들어 돌려 쓰는 이유는
  // 지문 검증을 후보마다 되풀이하지 않기 위해서다(tilePassabilityComponents 참조).
  const mayReach = terrainReachFilter(project, map, from.x, from.y);
  for (const [index, point] of candidates.entries()) {
    if (!mayReach(point.x, point.y)) continue;
    const key = point.y * width + point.x;
    if (!targets.has(key)) targets.set(key, index);
  }
  if (targets.size === 0) return null;
  const visited = new Set<number>([from.y * width + from.x]);
  let frontier: ChasePoint[] = [from];
  while (frontier.length > 0) {
    let best = -1;
    for (const point of frontier) {
      const index = targets.get(point.y * width + point.x);
      if (index === undefined) continue;
      if (best >= 0 && index > best) continue;
      if (accept && !accept(point)) continue;
      best = index;
    }
    if (best >= 0) return candidates[best] ?? null;
    const next: ChasePoint[] = [];
    for (const point of frontier) {
      for (const direction of DIRECTIONS) {
        const nx = point.x + direction.x;
        const ny = point.y + direction.y;
        if (nx < 0 || ny < 0 || nx >= width || ny >= map.height) continue;
        const key = ny * width + nx;
        if (visited.has(key)) continue;
        if (!canMove(project, map, point.x, point.y, nx, ny)) continue;
        visited.add(key);
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  // findChasePath 와 같은 이유로 색인을 남긴다 — 방금 from 의 성분을 전부 훑었다.
  // visited.size 가 그 성분의 크기다(같은 이유로 작으면 남기지 않는다).
  armTerrainComponents(project, map, visited.size);
  return null;
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
  /** 정수 타일 키 `y * map.width + x`. 맵 안에서만 유일하다. */
  readonly key: number;
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

/** compareNode 기준 이진 최소힙. 지연 삭제를 쓰므로 decrease-key 없이 push 만 한다. */
class NodeHeap {
  private readonly items: AStarNode[] = [];

  get size(): number {
    return this.items.length;
  }

  push(node: AStarNode): void {
    const items = this.items;
    items.push(node);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const above = items[parent] as AStarNode;
      if (compareNode(above, items[index] as AStarNode) <= 0) break;
      items[parent] = items[index] as AStarNode;
      items[index] = above;
      index = parent;
    }
  }

  pop(): AStarNode | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0 || last === undefined) return top;
    items[0] = last;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      if (left >= items.length) break;
      const right = left + 1;
      let smallest = left;
      if (right < items.length && compareNode(items[right] as AStarNode, items[left] as AStarNode) < 0) {
        smallest = right;
      }
      if (compareNode(items[smallest] as AStarNode, items[index] as AStarNode) >= 0) break;
      const swap = items[index] as AStarNode;
      items[index] = items[smallest] as AStarNode;
      items[smallest] = swap;
      index = smallest;
    }
    return top;
  }
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
