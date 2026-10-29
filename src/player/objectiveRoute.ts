// 목표 화살표가 직선이 아니라 걸어갈 길을 따라 가리키게 — 목표 칸에서 거꾸로 잰 걸음 수 지도(타일 통행만).
// 왜(2026-10-29 vm4 terra jrpg): 동굴 안 (11,10)에서 마왕(22,9)은 오른쪽 위였지만 걸어가는 길은 아래 줄로 돌아가야 했다 —
// 직선 방향만 보고 위·오른쪽 벽에 막혀 시간 초과. 대상이 화면 안에 있어도 길이 크게 돌아가면 화살표를 띄운다.
import { canMove } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

export type Cell = { readonly x: number; readonly y: number };
const STEPS: readonly Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

/** 대상 칸들까지의 걸음 수(-1 = 못 감). 대상 칸 자체는 막힌 그림(보스·상자) 위여도 들어설 수 있다고 본다. */
export function routeField(project: Project, map: GameMap, targets: readonly Cell[]): Int32Array {
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
      if (dist[n] >= 0) continue;
      // n → c 로 걸어 들어갈 수 있어야 한다. 대상 칸은 그림(보스·상자)이 막아도 «옆에 서서 닿으면» 된다 — 옆 칸이 서 있을 수 있는 칸이면.
      if (goal.has(c) ? !STEPS.some((o) => canMove(project, map, nx, ny, nx + o.x, ny + o.y)) : !canMove(project, map, nx, ny, cx, cy)) continue;
      dist[n] = dist[c]! + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

/** from 에서 걸음 수가 줄어드는 쪽으로 ahead 걸음 간 칸과 남은 걸음 수. 못 가면 undefined. */
export function routeWaypoint(field: Int32Array, map: GameMap, from: Cell, ahead = 3): { cell: Cell; steps: number } | undefined {
  const { width, height } = map;
  if (from.x < 0 || from.y < 0 || from.x >= width || from.y >= height) return undefined;
  const steps = field[from.y * width + from.x]!;
  if (steps < 0) return undefined;
  let cur = from;
  for (let i = 0; i < ahead; i += 1) {
    const d = field[cur.y * width + cur.x]!;
    if (d <= 0) break;
    const next = STEPS.map((s) => ({ x: cur.x + s.x, y: cur.y + s.y }))
      .find((c) => c.x >= 0 && c.y >= 0 && c.x < width && c.y < height && field[c.y * width + c.x] === d - 1);
    if (!next) break;
    cur = next;
  }
  return { cell: cur, steps };
}

/** 걸어가는 길이 직선(맨해튼)보다 크게 돌아가나 — 대상이 화면 안이어도 화살표가 필요한 미로. */
export function routeDetours(steps: number, from: Cell, to: Cell): boolean {
  const straight = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
  return steps > straight * 1.5 + 4;
}
