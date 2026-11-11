// 목표 화살표가 직선이 아니라 걸어갈 길을 따라 가리키게 — 목표 칸에서 거꾸로 잰 걸음 수 지도와, 그 길의 «다음 곧은 구간 끝».
// 왜(2026-10-29 vm4 terra jrpg): 동굴 안 (11,10)에서 마왕(22,9)은 오른쪽 위였지만 걸어가는 길은 아래 줄로 돌아가야 했다 —
// 직선 방향만 보고 위·오른쪽 벽에 막혀 시간 초과. 대상이 화면 안에 있어도 곧게 걸어 닿지 못하면 화살표를 띄운다.
// 왜(2026-11-11 fun-x1 눈가림 플레이): «세 걸음 앞 칸»을 가리키던 화살표가 성벽 면·모서리를 향했다 — 길목(성문)을 곧게 가리킨다(openwiki/assistant-v2.md 「목표 화살표는 길목을 가리킨다」).
import { canMove } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

export type Cell = { readonly x: number; readonly y: number };
const STEPS: readonly Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

/**
 * 대상 칸들까지의 걸음 수(-1 = 못 감). 대상 칸 자체는 막힌 그림(보스·상자) 위여도 들어설 수 있다고 본다.
 * blocked = 주인공이 설 수 없는 칸(막는 이벤트: 사람·잠긴 문, 칸 번호 y*width+x) — 길이 그 칸을 돌아간다.
 */
export function routeField(project: Project, map: GameMap, targets: readonly Cell[], blocked?: ReadonlySet<number>): Int32Array {
  const { width, height } = map;
  const dist = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const goal = new Set<number>();
  for (const t of targets) {
    if (t.x < 0 || t.y < 0 || t.x >= width || t.y >= height) continue;
    const k = t.y * width + t.x;
    if (dist[k] === 0) continue;
    dist[k] = 0; goal.add(k); queue[tail++] = k;
  }
  while (head < tail) {
    const c = queue[head++]!;
    const cx = c % width, cy = (c - cx) / width;
    for (const s of STEPS) {
      const nx = cx + s.x, ny = cy + s.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (dist[n] >= 0 || blocked?.has(n)) continue;
      // n → c 로 걸어 들어갈 수 있어야 한다. 대상 칸은 그림(보스·상자)이 막아도 «옆에 서서 닿으면» 된다 — 옆 칸이 서 있을 수 있는 칸이면.
      if (goal.has(c) ? !STEPS.some((o) => canMove(project, map, nx, ny, nx + o.x, ny + o.y)) : !canMove(project, map, nx, ny, cx, cy)) continue;
      dist[n] = dist[c]! + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

/** 길의 다음 곧은 구간: 그 끝 칸, 지금 자리에서 대상까지 걸음 수(steps), 구간 끝에서 남는 걸음 수(left). */
export interface RouteLeg { readonly cell: Cell; readonly steps: number; readonly left: number }

/** 길목을 찾는 범위(칸) — 한 화면 남짓. 그보다 먼 칸은 방향만 조금 달라질 뿐이다. */
const LEG_REACH = 12;

/**
 * from → to 로 곧게 걸을 수 있나 — 두 칸 가운데를 잇는 선이 지나는 칸을 차례로 밟는다. 걸음마다 실제로 걸리고(canMove · 막는 이벤트 없음)
 * 대상에 한 걸음씩 가까워져야 한다. 선이 네 칸 모서리를 지나면 양옆 칸 둘 다 열려 있어야 한다 — 모서리 틈으로는 몸이 못 지나가고,
 * 화살표가 집 모서리를 가리키게 된다. 대상 칸(걸음 수 0)으로 들어서는 마지막 걸음은 묻지 않는다(옆에 서면 닿는다).
 */
function walksStraight(project: Project, map: GameMap, field: Int32Array, blocked: ReadonlySet<number> | undefined, from: Cell, to: Cell): boolean {
  const { width } = map;
  const ax = Math.abs(to.x - from.x), ay = Math.abs(to.y - from.y);
  const sx = Math.sign(to.x - from.x), sy = Math.sign(to.y - from.y);
  const step = (x: number, y: number, nx: number, ny: number): boolean => {
    const next = field[ny * width + nx]!;
    if (next !== field[y * width + x]! - 1) return false;
    return next === 0 || (!blocked?.has(ny * width + nx) && canMove(project, map, x, y, nx, ny));
  };
  let x = from.x, y = from.y, ix = 0, iy = 0;
  while (ix < ax || iy < ay) {
    const side = (1 + 2 * ix) * ay - (1 + 2 * iy) * ax; // 다음에 넘는 칸 경계: < 0 세로 경계(가로 걸음), > 0 가로 경계, 0 모서리
    if (side === 0) {
      if (!step(x, y, x + sx, y) || !step(x + sx, y, x + sx, y + sy) || !step(x, y, x, y + sy) || !step(x, y + sy, x + sx, y + sy)) return false;
      x += sx; y += sy; ix += 1; iy += 1;
    } else if (side < 0) {
      if (!step(x, y, x + sx, y)) return false;
      x += sx; ix += 1;
    } else {
      if (!step(x, y, x, y + sy)) return false;
      y += sy; iy += 1;
    }
  }
  return true;
}

/**
 * from 에서 곧게 걸어 닿는 칸 가운데 대상에 가장 가까운 칸(= 길의 다음 곧은 구간 끝: 성문·모퉁이·대상 자신)과 남은 걸음 수.
 * 화살표는 이 칸을 가리킨다 — 벽면이 아니라 돌아 들어갈 길목을 본다. 길이 없으면 undefined.
 */
export function routeLeg(project: Project, map: GameMap, field: Int32Array, from: Cell, blocked?: ReadonlySet<number>): RouteLeg | undefined {
  const { width, height } = map;
  if (from.x < 0 || from.y < 0 || from.x >= width || from.y >= height) return undefined;
  const steps = field[from.y * width + from.x]!;
  if (steps < 0) return undefined;
  if (steps === 0) return { cell: from, steps, left: 0 };
  const near: { x: number; y: number; d: number }[] = [];
  for (let y = Math.max(0, from.y - LEG_REACH); y <= Math.min(height - 1, from.y + LEG_REACH); y += 1) {
    for (let x = Math.max(0, from.x - LEG_REACH); x <= Math.min(width - 1, from.x + LEG_REACH); x += 1) {
      const d = field[y * width + x]!;
      // 곧은 길 위의 칸은 맨해튼 거리만큼 가까워진다 — 아닌 칸은 걸어 볼 것도 없다.
      if (d >= 0 && steps - d === Math.abs(x - from.x) + Math.abs(y - from.y) && d < steps) near.push({ x, y, d });
    }
  }
  near.sort((a, b) => a.d - b.d);
  for (const c of near) {
    if (walksStraight(project, map, field, blocked, from, c)) return { cell: { x: c.x, y: c.y }, steps, left: c.d };
  }
  return undefined;
}

export interface ObjectiveRoute {
  /** 막는 이벤트를 돌아가는 길. */
  readonly field: Int32Array;
  /** 타일 통행만 본 길 — 사람이 길목을 막고 서 있을 때(말을 걸면 비킨다) 그 사람 앞까지는 데려간다. */
  readonly open: Int32Array;
  readonly blocked: ReadonlySet<number>;
  /** 칸마다 한 번 찾은 다음 곧은 구간 끝 — 화살표는 매 프레임 묻는다. */
  readonly legs: Map<number, RouteLeg | null>;
}

export function objectiveRoute(project: Project, map: GameMap, targets: readonly Cell[], blocked: ReadonlySet<number>): ObjectiveRoute {
  const open = routeField(project, map, targets);
  return { field: blocked.size ? routeField(project, map, targets, blocked) : open, open, blocked, legs: new Map() };
}

function legFrom(project: Project, map: GameMap, route: ObjectiveRoute, from: Cell): RouteLeg | undefined {
  const key = from.y * map.width + from.x;
  let leg = route.legs.get(key);
  if (leg === undefined) {
    leg = routeLeg(project, map, route.field, from, route.blocked) ?? routeLeg(project, map, route.open, from) ?? null;
    route.legs.set(key, leg);
  }
  return leg ?? undefined;
}

export interface ArrowAim {
  /** 가리키는 칸(길목·대상). */
  readonly cell: Cell;
  /** 주인공 칸 가운데에서 본 각도(rad, 화면 좌표 — 아래가 +). */
  readonly angle: number;
  /** route = 걸어갈 길의 다음 곧은 구간 끝, straight = 길을 못 찾아 가장 가까운 대상으로 곧장. */
  readonly kind: "route" | "straight";
}

/**
 * 목표 화살표가 가리킬 곳. 없으면(undefined) 화살표를 숨긴다 — 대상이 화면 안에 있고 곧게 걸어 닿을 때.
 * view = 화면에 보이는 범위(칸 단위, 소수 가능). 각도는 주인공 «칸 가운데»에서 잰다 — 발끝(칸 아래 끝)에서 재면 반 칸 위로 기운다.
 */
export function objectiveArrowAim(
  project: Project, map: GameMap, route: ObjectiveRoute | null, targets: readonly Cell[], from: Cell,
  view: { readonly x: number; readonly y: number; readonly right: number; readonly bottom: number },
): ArrowAim | undefined {
  if (!targets.length) return undefined;
  const span = (t: Cell) => Math.abs(t.x - from.x) + Math.abs(t.y - from.y);
  const nearest = targets.reduce((best, t) => (span(t) < span(best) ? t : best));
  const leg = route ? legFrom(project, map, route, from) : undefined;
  const onScreen = targets.some((t) => t.x + 0.5 >= view.x && t.x + 0.5 <= view.right && t.y + 0.5 >= view.y && t.y + 0.5 <= view.bottom);
  // 화면 안 대상은 곧게 걸어 닿을 때만 화살표를 숨긴다 — 보이는 대상과 주인공 사이에 벽·물건이 있으면 돌아갈 길목을 가리킨다.
  if (onScreen && (!leg || leg.left <= 1)) return undefined;
  const cell = leg && leg.steps > 0 ? leg.cell : nearest;
  if (cell.x === from.x && cell.y === from.y) return undefined;
  return { cell, angle: Math.atan2(cell.y - from.y, cell.x - from.x), kind: leg && leg.steps > 0 ? "route" : "straight" };
}
