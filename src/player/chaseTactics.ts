// player/chaseTactics.ts
// 추격자가 «어디로» 갈지 — 주인공 진행 방향 예측(앞질러 막기)과 여럿일 때 갈라져 감싸기(협공).
// 경로 자체는 chaseAi.nextChaseDecision 의 A* 가 찾는다. 여기서는 그 A* 의 목표 칸만 고른다.
//
// 2026-10-29 「스마트하게」: 예전 추격자는 늘 주인공이 지금 서 있는 칸을 향했다 — 기둥을 돌면 꼬리만 쫓았고,
// 여럿이면 같은 칸으로 줄을 서 한 줄로 따라왔다.
import { canMove } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { chasePassableStep, type ChasePassSize, type ChasePoint } from "./chaseAi";

/** 주인공의 지금 칸·걸어 들어가는 칸·최근 진행 방향. */
export type PlayerMotion = {
  readonly at: ChasePoint;
  /** 걸음 중이면 도착할 칸(이미 예약됨). */
  readonly next?: ChasePoint;
  /** 마지막으로 움직인 방향(한 칸 단위). 한 번도 안 움직였으면 없다. */
  readonly heading?: ChasePoint;
  /** 마지막으로 꺾은 쪽(+1 = 시계 방향, -1 = 반시계). 기둥을 도는 주인공은 같은 쪽으로 계속 꺾는다. */
  readonly turn?: 1 | -1;
  /** 같은 흐름(같은 방향, 또는 같은 쪽으로 거듭 꺾기)으로 이어 걸은 칸 수. 0 = 서 있다. */
  readonly run?: number;
};

type MotionMemory = { at: ChasePoint; stepTo?: ChasePoint; heading?: ChasePoint; turn?: 1 | -1; run: number; idleFrames: number };
const motionMemory = new WeakMap<object, MotionMemory>();
/** 이만큼(프레임) 서 있으면 진행 방향을 믿지 않는다(약 0.33초). */
const STALE_IDLE_FRAMES = 20;

/**
 * 장면마다 주인공 진행 방향을 기억한다 — 프레임마다 한 번 부른다. 걸음을 새로 뗄 때마다 방향·꺾은 쪽·같은 방향으로
 * 이어 걸은 칸 수(run)를 갱신한다. 지그재그로 흔드는 주인공(run 1)은 예측하지 않는다(앞질러 막기가 좌우로 떨린다).
 */
export function trackPlayerMotion(scene: object, at: ChasePoint, moving: boolean, movingTo: ChasePoint | undefined): PlayerMotion {
  let memory = motionMemory.get(scene);
  if (!memory) {
    memory = { at: { ...at }, run: 0, idleFrames: 0 };
    motionMemory.set(scene, memory);
  }
  const next = moving && movingTo && (movingTo.x !== at.x || movingTo.y !== at.y) ? movingTo : undefined;
  if (next && (memory.stepTo?.x !== next.x || memory.stepTo?.y !== next.y)) {
    const heading = { x: Math.sign(next.x - at.x), y: Math.sign(next.y - at.y) };
    const before = memory.heading;
    if (before && before.x === heading.x && before.y === heading.y) memory.run += 1;
    else if (before && before.x === -heading.x && before.y === -heading.y) { memory.run = 1; delete memory.turn; }
    else {
      if (before) {
        const cross = before.x * heading.y - before.y * heading.x;
        const turn: 1 | -1 = cross > 0 ? 1 : -1;
        // 같은 쪽으로 거듭 꺾는(기둥을 도는) 주인공은 꺾어도 흐름이 이어진다.
        memory.run = memory.turn === turn ? Math.max(memory.run, 2) : 1;
        memory.turn = turn;
      } else memory.run = 1;
    }
    memory.heading = heading;
    memory.stepTo = { ...next };
  }
  memory.idleFrames = next ? 0 : memory.idleFrames + 1;
  if (memory.idleFrames > STALE_IDLE_FRAMES) memory.run = 0;
  memory.at = { ...at };
  return {
    at, ...(next ? { next } : {}), run: memory.run,
    ...(memory.heading ? { heading: memory.heading } : {}), ...(memory.turn ? { turn: memory.turn } : {}),
  };
}

/** 예측 지평(칸). 기둥 한 바퀴의 절반쯤까지 내다봐야 반대편으로 돌아 마주 막는다. */
const PROJECTION_CELLS = 14;
/** 이만큼(칸) 같은 흐름으로 달린 주인공만 앞질러 막는다. */
const MIN_RUN_FOR_INTERCEPT = 2;
/** 직전에 고른 앞질러 막기 칸은 이만큼(칸) 늦어도 유지한다 — 앞뒤로 갈팡질팡하지 않게. */
const INTERCEPT_HYSTERESIS_CELLS = 2;
/** 거리 지도 탐색 상한(칸). 추격 판정마다 한 번 — 큰 맵에서도 프레임을 잡아먹지 않게. */
const DISTANCE_CAP = 1600;
/** 이 거리(칸) 안이면 꾀부리지 않고 곧장 덮친다. */
const DIRECT_RANGE = 2;
/** 협공 자리: 앞선 추격자의 반대편, 주인공에서 이만큼(칸). */
const FLANK_OFFSET = 2;

export type ChaseGoalInput = {
  readonly project: Project;
  readonly map: GameMap;
  readonly from: ChasePoint;
  readonly pass?: ChasePassSize;
  /** 이 추격자의 한 칸(ms). */
  readonly cellMs: number;
  /** 주인공 한 칸(ms). */
  readonly playerStepMs: number;
  readonly player: PlayerMotion;
  /** 같은 주인공을 쫓는 다른 추격자들의 칸. */
  readonly allies: readonly ChasePoint[];
  /** 직전 결정의 목표(있으면 앞질러 막기에 여유를 준다). */
  readonly previous?: ChasePoint;
};

export type ChaseGoal = { readonly x: number; readonly y: number; readonly reason: "direct" | "intercept" | "flank" };

/**
 * 이번 결정의 목표 칸. 가까우면 주인공(걸음 중이면 도착 칸), 아니면
 * 1) 앞선 동료가 있으면 그 반대편 자리(감싸기), 2) 진행 방향을 따라 내다본 칸 중 내가 먼저 닿는 칸(앞질러 막기),
 * 3) 둘 다 없으면 주인공.
 */
export function chooseChaseGoal(input: ChaseGoalInput): ChaseGoal {
  const { player } = input;
  const base = player.next ?? player.at;
  const direct: ChaseGoal = { x: base.x, y: base.y, reason: "direct" };
  const gap = manhattan(input.from, player.at);
  if (gap <= DIRECT_RANGE) return direct;
  const dist = distanceField(input, gap + PROJECTION_CELLS + 6);
  const mine = (p: ChasePoint): number | undefined => dist.get(p.y * input.map.width + p.x);

  // 1) 감싸기 — 나보다 주인공에 가까운 동료가 있으면 그 반대편으로 돈다.
  const leader = closest(input.allies, player.at);
  if (leader && manhattan(leader, player.at) < gap) {
    const vx = Math.sign(player.at.x - leader.x), vy = Math.sign(player.at.y - leader.y);
    const ideal = { x: player.at.x + vx * FLANK_OFFSET, y: player.at.y + vy * FLANK_OFFSET };
    let best: { p: ChasePoint; score: number } | undefined;
    const direct = mine(base);
    for (const [key, d] of dist) {
      const p = { x: key % input.map.width, y: Math.floor(key / input.map.width) };
      const near = manhattan(p, player.at);
      if (near === 0 || near > FLANK_OFFSET + 1) continue;
      // 앞선 동료와 같은 쪽 자리는 줄 서기다 — 동료보다 주인공 반대편에 있어야 한다.
      if (manhattan(p, leader) <= manhattan(player.at, leader)) continue;
      if (direct !== undefined && d > direct + 6) continue;
      const score = manhattan(p, ideal) * 4 + d;
      if (!best || score < best.score) best = { p, score };
    }
    if (best) return { ...best.p, reason: "flank" };
  }

  // 2) 앞질러 막기 — 진행 방향(복도는 꺾임을 따라)으로 내다본 칸 중, 내가 주인공보다 먼저(같아도) 닿는 첫 칸.
  if (player.heading && (player.run ?? 0) >= MIN_RUN_FOR_INTERCEPT) {
    const path = projectAhead(input.project, input.map, base, player.heading, PROJECTION_CELLS, player.turn);
    // 이미 그 길 위에 서 있으면 마주 오는 주인공을 곧장 막는다.
    if (path.some((p) => p.x === input.from.x && p.y === input.from.y)) return direct;
    for (const [index, cell] of path.entries()) {
      const d = mine(cell);
      if (d === undefined || d === 0) continue;
      const playerEta = (index + 1) * input.playerStepMs;
      const keep = input.previous && manhattan(input.previous, cell) <= 1 ? INTERCEPT_HYSTERESIS_CELLS * input.cellMs : 0;
      if (d * input.cellMs <= playerEta + keep) return { x: cell.x, y: cell.y, reason: "intercept" };
    }
  }
  return direct;
}

/**
 * 진행 방향으로 한 칸씩 — 막히면 뚫린 옆길로 꺾는다. 양쪽이 다 뚫렸으면 주인공이 마지막으로 꺾은 쪽(turn)으로,
 * 그것도 모르면 멈춘다.
 */
export function projectAhead(project: Project, map: GameMap, from: ChasePoint, heading: ChasePoint, cells: number, turn?: 1 | -1): ChasePoint[] {
  const out: ChasePoint[] = [];
  let at = from;
  let dir = heading;
  const seen = new Set<number>([from.y * map.width + from.x]);
  for (let i = 0; i < cells; i += 1) {
    let next = { x: at.x + dir.x, y: at.y + dir.y };
    if (!canMove(project, map, at.x, at.y, next.x, next.y)) {
      const sides = [{ x: dir.y, y: dir.x }, { x: -dir.y, y: -dir.x }]
        .filter((d) => canMove(project, map, at.x, at.y, at.x + d.x, at.y + d.y));
      const pick = sides.length === 1 ? sides[0]
        : sides.length === 2 && turn ? sides.find((d) => Math.sign(dir.x * d.y - dir.y * d.x) === turn) : undefined;
      if (!pick) break;
      dir = pick;
      next = { x: at.x + dir.x, y: at.y + dir.y };
    }
    const key = next.y * map.width + next.x;
    if (seen.has(key)) break;
    seen.add(key);
    out.push(next);
    at = next;
  }
  return out;
}

/** from 에서 추격자 통행으로 닿는 칸까지의 걸음 수(너비 우선, 상한 있음). 키는 y*width+x. */
function distanceField(input: ChaseGoalInput, maxDepth: number): Map<number, number> {
  const width = input.map.width;
  const dist = new Map<number, number>([[input.from.y * width + input.from.x, 0]]);
  let frontier: ChasePoint[] = [input.from];
  let depth = 0;
  while (frontier.length > 0 && dist.size < DISTANCE_CAP && depth < maxDepth) {
    depth += 1;
    const next: ChasePoint[] = [];
    for (const p of frontier) {
      for (const d of STEPS) {
        const n = { x: p.x + d.x, y: p.y + d.y };
        if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= input.map.height) continue;
        const key = n.y * width + n.x;
        if (dist.has(key)) continue;
        if (!chasePassableStep(input.project, input.map, p, n, input.pass)) continue;
        dist.set(key, depth);
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}

const STEPS: readonly ChasePoint[] = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }];

function closest(points: readonly ChasePoint[], to: ChasePoint): ChasePoint | undefined {
  let best: ChasePoint | undefined;
  for (const p of points) if (!best || manhattan(p, to) < manhattan(best, to)) best = p;
  return best;
}

function manhattan(a: ChasePoint, b: ChasePoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
