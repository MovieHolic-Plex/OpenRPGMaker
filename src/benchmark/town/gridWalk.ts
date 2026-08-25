// benchmark/town/gridWalk.ts
// 격자 순회 공용 헬퍼 — 통행 판정 · 플러드필 · 연결 성분.
//
// audit.ts 와 interior/scoringStructure.ts 에 같은 로직이 흩어져 있지만 둘 다
// 자기 트랙의 타입에 묶여 있다. 여기서는 "행 우선 number[] + width/height" 라는
// 최소 표현만 다룬다 — 두 트랙을 리팩터링하지 않고(어제 착륙한 코드다) 이 트랙이
// 쓸 것만 한 곳에 둔다.

import type { PassFlag } from "@/project/types";
import { EMPTY_CELL } from "./types";

export interface GridView {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly number[];
}

export const DIRECTIONS = Object.freeze([
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const);

export function inBounds(view: { readonly width: number; readonly height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < view.width && y < view.height;
}

export function cellAt(view: GridView, x: number, y: number): number {
  if (!inBounds(view, x, y)) return EMPTY_CELL;
  return view.cells[y * view.width + x] ?? EMPTY_CELL;
}

/** 답변 그리드(2차원 배열)를 행 우선 GridView 로 평탄화한다. */
export function flatten(grid: readonly (readonly number[])[]): GridView {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const cells: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) cells.push(grid[y]?.[x] ?? EMPTY_CELL);
  }
  return { width, height, cells };
}

/** 두 레이어를 하나로 겹친다 — 상위가 비어 있으면 하위를 쓴다. */
export function overlay(base: readonly number[], top: readonly number[]): number[] {
  return base.map((tile, index) => {
    const above = top[index] ?? EMPTY_CELL;
    return above === EMPTY_CELL ? tile : above;
  });
}

export function isSolidTile(passFlags: readonly PassFlag[], tile: number): boolean {
  const flag = passFlags[tile];
  if (!flag) return true; // 알 수 없는 타일은 막힌 것으로 본다(관대하게 봐 주지 않는다)
  return !flag.up && !flag.down && !flag.left && !flag.right;
}

/**
 * 캐릭터가 이 칸에 들어갈 수 있는가. 빈 칸은 **맨땅(잔디)** 으로 본다 — 모델에게
 * "바꾸지 않은 칸은 비워라"라고 요구했으므로 빈 칸을 벽으로 세면 모든 답이
 * 도달 불가가 된다.
 */
export function isWalkable(passFlags: readonly PassFlag[], tile: number): boolean {
  if (tile === EMPTY_CELL) return true;
  return !isSolidTile(passFlags, tile);
}

/** start 에서 canEnter 를 따라 4방향으로 닿는 칸 인덱스 집합. */
export function floodFill(
  shape: { readonly width: number; readonly height: number },
  starts: readonly { readonly x: number; readonly y: number }[],
  canEnter: (x: number, y: number) => boolean,
): Set<number> {
  const seen = new Set<number>();
  const queue: { x: number; y: number }[] = [];
  for (const start of starts) {
    if (!inBounds(shape, start.x, start.y) || !canEnter(start.x, start.y)) continue;
    const index = start.y * shape.width + start.x;
    if (seen.has(index)) continue;
    seen.add(index);
    queue.push(start);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [dx, dy] of DIRECTIONS) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (!inBounds(shape, x, y)) continue;
      const index = y * shape.width + x;
      if (seen.has(index) || !canEnter(x, y)) continue;
      seen.add(index);
      queue.push({ x, y });
    }
  }
  return seen;
}

/** 인덱스 집합을 4방향 연결 성분으로 쪼갠다(큰 것부터). */
export function connectedComponents(
  shape: { readonly width: number; readonly height: number },
  members: ReadonlySet<number>,
): number[][] {
  const remaining = new Set<number>(members);
  const components: number[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    const stack = [first];
    remaining.delete(first);
    const component: number[] = [];
    while (stack.length > 0) {
      const index = stack.pop()!;
      component.push(index);
      const x = index % shape.width;
      const y = Math.floor(index / shape.width);
      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(shape, nx, ny)) continue;
        const next = ny * shape.width + nx;
        if (!remaining.has(next)) continue;
        remaining.delete(next);
        stack.push(next);
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 0으로 나누는 경우를 한곳에서 처리한다 — 분모 0 은 "해당 없음"이라 만점이다. */
export function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 1;
  return clamp01(numerator / denominator);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
