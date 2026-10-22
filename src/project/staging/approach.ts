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
  /**
   * 이 칸에 선 인물이 위에 그려지는 타일(기둥·수관 ★)에 가려지는가. 있으면 가려지지 않는 칸을 먼저 고른다
   * (2026-10-22 막차 승강장: 주인공이 지후 왼쪽 기둥 뒤에 서서 대화 내내 보이지 않았다).
   */
  readonly hidden?: (cell: StageCell) => boolean;
  /**
   * 이 칸을 지나면 다른 인물과 그림이 겹치는가(그 인물 바로 위·아래 칸 — 인물 그림은 두 칸 높이). 있으면 그 칸 걸음 값을
   * 크게 매겨 비켜 돈다(2026-10-22 VQA: 걸어가는 인물이 다른 인물 머리 위를 지나 덮었다). 막지는 않는다.
   */
  readonly crowded?: (cell: StageCell) => boolean;
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
 * 다가가기 계획. 후보 칸을 단계(tier)로 나눠 앞 단계부터 찾는다:
 *  ① 대상과 같은 가로줄로 distance 칸 옆(3/4 시점에서 둘이 나란히 읽힌다),
 *  ② 대각(체비쇼프 distance 안),
 *  ③ (distance 1 만) 같은 가로줄 두 칸 옆, 그다음 바로 위·아래 — 맨 뒤로: 24×32 인물은 두 칸 높이라 바로 위아래에 서면
 *     아래 인물 머리가 위 인물 발·몸을 덮는다(2026-10-22 승강장, 장면 다듬기 SKILL 3장 2),
 *  ④ 거리 distance+1 ~ distance+3 의 칸(대상이 벽에 둘러싸였을 때 — fallback).
 * distance 2 이상이면 ①③ 을 한 단계로 합친다(겹치지 않는다).
 * distance 0 은 대상 칸 자체(칸 대상 «저기로 걸어가»).
 * 같은 단계 안에서는 걸음 수가 적은 칸, 같으면 출발 쪽 칸.
 * 이미 말 거리 안(①~③)에 서 있으면, 더 앞 단계 칸이 두 걸음 안에 있을 때만 옮긴다.
 * world.hidden 이 있으면 가려지는 칸은 다른 칸이 하나도 없을 때만 쓴다. 길이 없으면 null.
 */
export function planApproach(world: ApproachWorld, from: StageCell, target: StageCell, distance = DEFAULT_TALK_DISTANCE): ApproachPlan | null {
  const d = clampTalkDistance(distance);
  const reach = bfs(world, from, 4096, world.crowded);
  const key = (c: StageCell) => c.y * world.width + c.x;
  const inBounds = (c: StageCell) => c.x >= 0 && c.y >= 0 && c.x < world.width && c.y < world.height;
  const same = (a: StageCell, b: StageCell) => a.x === b.x && a.y === b.y;
  const standable = (c: StageCell) => same(c, from) || (inBounds(c) && world.canStand(c));
  // 인물 대상이면 대상 칸은 차 있다. distance 0(칸 대상)만 그 칸으로 간다.
  const isTarget = (c: StageCell) => d > 0 && same(c, target);

  const tiers: StageCell[][] = [];
  if (d === 0) {
    tiers.push([{ x: target.x, y: target.y }]);
  } else {
    const horizontal = [{ x: target.x - d, y: target.y }, { x: target.x + d, y: target.y }];
    const vertical = [{ x: target.x, y: target.y - d }, { x: target.x, y: target.y + d }];
    const inner: StageCell[] = [];
    for (let y = target.y - d; y <= target.y + d; y += 1) {
      for (let x = target.x - d; x <= target.x + d; x += 1) {
        const c = { x, y };
        if (same(c, target) || horizontal.some((h) => same(h, c)) || vertical.some((v) => same(v, c))) continue;
        inner.push(c);
      }
    }
    // 거리 1: 바로 위·아래(겹쳐 보임)보다 같은 줄 두 칸 옆이 낫다(2026-10-22 VQA: 팀장이 의자에 앉은 주인공 바로 위에 서서 한 덩어리로 보였다).
    if (d === 1) tiers.push(horizontal, inner, [{ x: target.x - 2, y: target.y }, { x: target.x + 2, y: target.y }], vertical);
    else tiers.push([...horizontal, ...vertical], inner);
  }
  const talkTiers = tiers.length; // 여기까지가 «말 거리 안»
  // 칸 대상(distance 0)이 막혔으면 가장 가까운 칸부터. 고리마다 한 단계 — 걸음이 적어도 먼 고리를 먼저 고르지 않는다.
  for (let r = d === 0 ? 1 : d + 1; r <= Math.max(1, d) + 3; r += 1) {
    const ring: StageCell[] = [];
    for (let y = target.y - r; y <= target.y + r; y += 1) {
      for (let x = target.x - r; x <= target.x + r; x += 1) {
        if (Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) === r) ring.push({ x, y });
      }
    }
    tiers.push(ring);
  }

  const hiddenAt = (c: StageCell) => d > 0 && Boolean(world.hidden?.(c));
  for (const allowHidden of [false, true]) {
    if (allowHidden && !world.hidden) break;
    const ok = (c: StageCell) => allowHidden || !hiddenAt(c);
    const fromTier = ok(from) && !isTarget(from) ? tiers.slice(0, talkTiers).findIndex((t) => t.some((c) => same(c, from))) : -1;
    const stay: ApproachPlan = { goal: from, steps: [], face: d === 0 ? null : dirToward(from, target), fallback: false };
    if (fromTier === 0) return stay;
    const searchUntil = fromTier > 0 ? fromTier : tiers.length;
    for (let tier = 0; tier < searchUntil; tier += 1) {
      let best: { cell: StageCell; cost: number; rank: number } | null = null;
      for (const c of tiers[tier]!) {
        if (!inBounds(c) || isTarget(c) || !standable(c) || !ok(c)) continue;
        const cost = reach.dist.get(key(c));
        if (cost === undefined) continue;
        const toward = Math.abs(c.x - from.x) + Math.abs(c.y - from.y); // 출발 쪽
        const rank = cost * 1000 + Math.min(999, toward);
        if (!best || rank < best.rank) best = { cell: c, cost, rank };
      }
      if (!best) continue;
      if (fromTier > 0 && best.cost > 2) continue; // 이미 말 거리 안 — 멀리 돌아가며 자리 바꾸지 않는다
      return { goal: best.cell, steps: pathTo(reach, world.width, from, best.cell), face: d === 0 ? null : dirToward(best.cell, target), fallback: tier >= talkTiers || allowHidden };
    }
    if (fromTier > 0) return stay;
  }
  return null;
}

type Reach = { dist: Map<number, number>; prev: Map<number, { at: number; dir: Dir }> };

/** 걸음 값: 보통 1, 겹치는 칸(crowded) 5. 값이 작은 정수라 칸 대기열(bucket)로 최단 경로를 찾는다. */
const CROWDED_STEP_COST = 5;

function bfs(world: ApproachWorld, from: StageCell, limit: number, crowded?: (c: StageCell) => boolean): Reach {
  const key = (c: StageCell) => c.y * world.width + c.x;
  const dist = new Map<number, number>([[key(from), 0]]);
  const prev = new Map<number, { at: number; dir: Dir }>();
  const buckets: StageCell[][] = [[from]];
  let settled = 0;
  for (let cost = 0; cost < buckets.length && settled < limit; cost += 1) {
    for (const cur of buckets[cost] ?? []) {
      if (dist.get(key(cur)) !== cost) continue; // 더 싼 값으로 이미 처리됨
      settled += 1;
      for (const dir of DIRS) {
        const n = { x: cur.x + DIR_DELTA[dir].x, y: cur.y + DIR_DELTA[dir].y };
        if (n.x < 0 || n.y < 0 || n.x >= world.width || n.y >= world.height) continue;
        if (!world.canStand(n) || !world.canStep(cur, n)) continue;
        const nc = cost + (crowded?.(n) ? CROWDED_STEP_COST : 1);
        const k = key(n);
        const old = dist.get(k);
        if (old !== undefined && old <= nc) continue;
        dist.set(k, nc);
        prev.set(k, { at: key(cur), dir });
        (buckets[nc] ??= []).push(n);
      }
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
