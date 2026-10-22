// project/staging/approach.ts
// 인물 연출 기본기의 순수 계산 — 「다가가기(approach)」 목적 칸 고르기·길 찾기, 「쪽으로 돌기」 방향.
//
// 왜(2026-10-22 『첫사랑』 영상): 장면이 walk(id, ["left","left",…]) 처럼 걸음을 손으로 늘어놓고 face(id, "right") 로
// 방향을 손으로 골랐다. 그 사이에 누가 비켜 서거나 경로 한 칸이 막히면 걸음이 버려지고, 손으로 고른 방향은 도착 못 한
// 인물에게도 그대로 적용됐다 — 인사 선택지가 상대가 화면 밖에 선 채로 뜨고, 승강장의 두 사람은 서로 다른 데를 보며
// 몇 칸 떨어져서 말했다. 목적 칸과 방향을 «대상과의 관계»(옆에 서서 본다)로 선언하면 실행 순간의 실제 위치에서 계산된다.
//
// 런타임(player/playSceneApproach.ts)과 장면 검사(lint/sceneStagingLint.ts)가 같은 함수를 쓴다 — 검사가 상상한 자리와
// 게임이 고른 자리가 달라지지 않게.
import type { Dir } from "../types";

export type StageCell = { readonly x: number; readonly y: number };

export const DIR_DELTA: Readonly<Record<Dir, StageCell>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIRS: readonly Dir[] = ["left", "right", "down", "up"];

/** 기본 말 거리 — 바로 옆 칸. */
export const DEFAULT_TALK_DISTANCE = 1;
/** 대사 자동 돌아보기가 작동하는 최대 거리(체비쇼프). 이보다 멀면 «같은 대화»가 아니라고 본다. */
export const AUTO_FACE_RANGE = 4;
/** 멀리서 부르는 대사(text.calling)의 돌아보기 거리. */
export const CALLING_FACE_RANGE = 12;
/** 장면 검사가 «너무 멀리서 말한다»고 보는 거리(체비쇼프 초과). */
export const TALK_DISTANCE_LIMIT = 2;

export function clampTalkDistance(distance: number | undefined): number {
  const d = Math.round(Number(distance ?? DEFAULT_TALK_DISTANCE));
  return Number.isFinite(d) ? Math.max(0, Math.min(6, d)) : DEFAULT_TALK_DISTANCE;
}

/** from 에서 to 를 보는 방향(가로·세로 중 더 먼 쪽, 같으면 가로). 같은 칸이면 null. */
export function dirToward(from: StageCell, to: StageCell): Dir | null {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** a 가 dir 을 볼 때 b 가 그 시야(앞쪽 90도 부채꼴, 대각 포함) 안에 있는가. */
export function facesToward(a: StageCell, dir: Dir, b: StageCell): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return true;
  switch (dir) {
    case "right": return dx > 0 && Math.abs(dy) <= dx;
    case "left": return dx < 0 && Math.abs(dy) <= -dx;
    case "down": return dy > 0 && Math.abs(dx) <= dy;
    case "up": return dy < 0 && Math.abs(dx) <= -dy;
  }
}

export function chebyshev(a: StageCell, b: StageCell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export type ApproachWorld = {
  readonly width: number;
  readonly height: number;
  /** 한 칸 걸음이 가능한가(지형 방향 통행). 인물 점유는 canStand 가 본다. */
  readonly canStep: (from: StageCell, to: StageCell) => boolean;
  /** 이 칸에 설 수 있는가(다른 인물·배치물이 없다). 출발 칸은 묻지 않는다. */
  readonly canStand: (cell: StageCell) => boolean;
};

export type ApproachPlan = {
  /** 도착 칸(이미 그 자리면 출발 칸). */
  readonly goal: StageCell;
  /** 걸음(4방향). 빈 배열이면 제자리. */
  readonly steps: readonly Dir[];
  /** 도착해서 볼 방향. */
  readonly face: Dir | null;
  /** 대상과 같은 줄 talk 거리 칸을 못 찾아 가장 가까운 대체 칸으로 갔다. */
  readonly fallback: boolean;
};

/**
 * 다가가기 계획. 후보 칸 순서:
 *  ① 대상과 같은 줄(가로·세로)로 정확히 distance 칸 떨어진 칸(마주 보기가 정확하다),
 *  ② 체비쇼프 distance 안의 모든 칸(대각 포함 — 비좁은 곳),
 *  ③ 거리 distance+1 ~ distance+3 의 칸(대상이 벽에 둘러싸였을 때).
 * distance 0 은 대상 칸 자체(칸 대상 «저기로 걸어가»), 막혔으면 가장 가까운 칸.
 * 같은 단계 안에서는 걸음 수가 적은 칸, 같으면 가로 옆(대화가 3/4 시점에서 잘 읽힌다), 같으면 출발 쪽 칸.
 * 이미 ①·② 칸에 서 있으면 걷지 않는다. 길이 없으면 null.
 */
export function planApproach(world: ApproachWorld, from: StageCell, target: StageCell, distance = DEFAULT_TALK_DISTANCE): ApproachPlan | null {
  const d = clampTalkDistance(distance);
  const reach = bfs(world, from, 4096);
  const key = (c: StageCell) => c.y * world.width + c.x;
  const inBounds = (c: StageCell) => c.x >= 0 && c.y >= 0 && c.x < world.width && c.y < world.height;
  const standable = (c: StageCell) => (c.x === from.x && c.y === from.y) || (inBounds(c) && world.canStand(c));
  // distance 0 = 그 칸 자체로 걸어간다(칸 대상일 때 «저기로 가»). 인물 대상이면 그 칸은 차 있어 바로 옆으로 물러난다.
  const isTarget = (c: StageCell) => d > 0 && c.x === target.x && c.y === target.y;

  const tiers: StageCell[][] = [[], [], []];
  if (d === 0) tiers[0]!.push({ x: target.x, y: target.y });
  else for (const dir of DIRS) {
    const c = { x: target.x + DIR_DELTA[dir].x * d, y: target.y + DIR_DELTA[dir].y * d };
    tiers[0]!.push(c);
  }
  for (let r = 1; r <= Math.max(1, d) + 3; r += 1) {
    for (let y = target.y - r; y <= target.y + r; y += 1) {
      for (let x = target.x - r; x <= target.x + r; x += 1) {
        if (Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) !== r) continue;
        const c = { x, y };
        if (tiers[0]!.some((t) => t.x === x && t.y === y)) continue;
        (r <= Math.max(1, d) ? tiers[1]! : tiers[2]!).push(c);
      }
    }
  }
  // 이미 같은 줄 말 거리에 섰으면 그대로. 대각(말 거리 안)이면 한 걸음으로 같은 줄에 설 수 있을 때만 옮긴다.
  const stay: ApproachPlan = { goal: from, steps: [], face: dirToward(from, target), fallback: false };
  if (tiers[0]!.some((t) => t.x === from.x && t.y === from.y)) return d === 0 ? { ...stay, face: null } : stay;
  const nearAlready = d > 0 && !isTarget(from) && chebyshev(from, target) <= d;
  for (let tier = 0; tier < tiers.length; tier += 1) {
    if (nearAlready && tier > 0) return stay;
    let best: { cell: StageCell; cost: number; rank: number } | null = null;
    for (const c of tiers[tier]!) {
      if (!inBounds(c) || isTarget(c) || !standable(c)) continue;
      const cost = reach.dist.get(key(c));
      if (cost === undefined) continue;
      const side = c.y === target.y ? 0 : 1; // 가로 옆 우선
      const toward = Math.abs(c.x - from.x) + Math.abs(c.y - from.y); // 출발 쪽
      const rank = cost * 1000 + side * 100 + Math.min(99, toward);
      if (!best || rank < best.rank) best = { cell: c, cost, rank };
    }
    if (best && nearAlready && best.cost > 1) return stay;
    if (best) {
      return { goal: best.cell, steps: pathTo(reach, world.width, from, best.cell), face: d === 0 ? null : dirToward(best.cell, target), fallback: tier > 0 };
    }
  }
  return null;
}

type Reach = { dist: Map<number, number>; prev: Map<number, { at: number; dir: Dir }> };

function bfs(world: ApproachWorld, from: StageCell, limit: number): Reach {
  const key = (c: StageCell) => c.y * world.width + c.x;
  const dist = new Map<number, number>([[key(from), 0]]);
  const prev = new Map<number, { at: number; dir: Dir }>();
  const queue: StageCell[] = [from];
  for (let head = 0; head < queue.length && head < limit; head += 1) {
    const cur = queue[head]!;
    const cd = dist.get(key(cur))!;
    for (const dir of DIRS) {
      const n = { x: cur.x + DIR_DELTA[dir].x, y: cur.y + DIR_DELTA[dir].y };
      if (n.x < 0 || n.y < 0 || n.x >= world.width || n.y >= world.height) continue;
      const k = key(n);
      if (dist.has(k)) continue;
      if (!world.canStand(n) || !world.canStep(cur, n)) continue;
      dist.set(k, cd + 1);
      prev.set(k, { at: key(cur), dir });
      queue.push(n);
    }
  }
  return { dist, prev };
}

function pathTo(reach: Reach, width: number, from: StageCell, to: StageCell): Dir[] {
  const out: Dir[] = [];
  const start = from.y * width + from.x;
  for (let k = to.y * width + to.x; k !== start;) {
    const p = reach.prev.get(k);
    if (!p) break;
    out.unshift(p.dir);
    k = p.at;
  }
  return out;
}
