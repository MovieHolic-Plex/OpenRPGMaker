// project/lint/reachability.ts
// 이벤트를 무시한 타일 통행성 BFS 도달성 판정. 순수 함수(Phaser/DOM 무관).
// test/emberQuestGame.test.ts의 BFS 로직을 라이브러리로 승격한 것.
// canMove(collision.ts) 기반 4방향 탐색. "인접 도달(adjacentOrOn)" 의미 보존:
// 타겟 칸 자체 또는 상하좌우 인접 칸에 도달하면 도달로 간주(NPC/블로커는 그 칸에 서 있어
// 직접 진입은 불가하지만 인접해서 조사 가능하기 때문).

import { canMove } from "../collision";
import type { GameMap, Project } from "../types";

export type Point = { readonly x: number; readonly y: number };

export interface ReachabilitySpec {
  readonly mapId: string;
  readonly from: Point;
  readonly targets: readonly Point[];
}

export interface ReachabilityResult {
  readonly reachable: boolean;
  readonly unreachable: readonly Point[];
}

// (sx,sy)에서 통행 가능한 모든 칸의 "x,y" 키 집합을 반환한다.
export function computeReachableCells(
  project: Project,
  map: GameMap,
  sx: number,
  sy: number
): Set<string> {
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: Array<[number, number]> = [[sx, sy]];
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (!canMove(project, map, x, y, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

// 타겟 칸 자체 또는 상하좌우 인접 칸이 도달 집합에 포함되는가?
export function isAdjacentOrOn(seen: ReadonlySet<string>, x: number, y: number): boolean {
  return (
    seen.has(`${x},${y}`) ||
    seen.has(`${x + 1},${y}`) ||
    seen.has(`${x - 1},${y}`) ||
    seen.has(`${x},${y + 1}`) ||
    seen.has(`${x},${y - 1}`)
  );
}

// mapId 맵에서 from 지점으로부터 targets 각각에 인접 도달 가능한지 검사한다.
export function checkReachability(
  project: Project,
  mapId: string,
  from: Point,
  targets: readonly Point[]
): ReachabilityResult {
  const map = project.maps[mapId];
  if (!map) {
    return { reachable: targets.length === 0, unreachable: [...targets] };
  }
  const seen = computeReachableCells(project, map, from.x, from.y);
  const unreachable = targets.filter((target) => !isAdjacentOrOn(seen, target.x, target.y));
  return { reachable: unreachable.length === 0, unreachable };
}
