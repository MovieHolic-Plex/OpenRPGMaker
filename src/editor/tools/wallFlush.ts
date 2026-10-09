// editor/tools/wallFlush.ts
// 조수가 벽에서 1칸 띄워 놓는 버릇을 도구가 바로잡는다.
//
// 맵 이동(playerTouch + below)은 통행 가능 칸에 있어야 발동한다 — 벽 칸 위는 영구 미발동
// (openwiki/runtime-sessions.md playerTouch 계약). 그래서 출입구는 벽·맵 가장자리와
// 맞닿은 통행 칸에 붙인다. 1칸 안쪽 좌표는 그 칸으로 당기고, 벽 위 요청은 바로 앞 통행 칸으로 옮긴다.
//
// 타일 채우기는 맵 가장자리가 아니라 **맵 안 벽** 과의 1칸 틈만 메운다.
// 가장자리까지 늘리면 원형 호수가 맵 남쪽으로 새는 회귀가 난다.

import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { inMapBounds, type Point } from "./mapHelpers";

export const CARDINAL: readonly Point[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

function isBlocked(project: Project, map: GameMap, x: number, y: number): boolean {
  if (!inMapBounds(map, x, y)) return true;
  return !isPassable(project, map, x, y);
}

function isInMapWall(project: Project, map: GameMap, x: number, y: number): boolean {
  return inMapBounds(map, x, y) && !isPassable(project, map, x, y);
}

export function isFlushPassable(project: Project, map: GameMap, x: number, y: number): boolean {
  if (!inMapBounds(map, x, y) || !isPassable(project, map, x, y)) return false;
  return CARDINAL.some((dir) => isBlocked(project, map, x + dir.x, y + dir.y));
}

/**
 * 출입구 좌표를 벽·맵 가장자리에 붙인다.
 * 이미 붙어 있거나 방 한가운데면 그대로 둔다.
 */
export function snapFlushToWall(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  occupied?: ReadonlySet<string>,
): Point {
  const free = (px: number, py: number): boolean => occupied?.has(`${px},${py}`) !== true;

  if (isFlushPassable(project, map, x, y) && free(x, y)) return { x, y };

  if (inMapBounds(map, x, y) && isPassable(project, map, x, y) && free(x, y)) {
    for (const dir of CARDINAL) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (isFlushPassable(project, map, nx, ny) && free(nx, ny)) return { x: nx, y: ny };
    }
    return { x, y };
  }

  for (const dir of CARDINAL) {
    const nx = x + dir.x;
    const ny = y + dir.y;
    if (isFlushPassable(project, map, nx, ny) && free(nx, ny)) return { x: nx, y: ny };
  }
  return { x, y };
}

/**
 * 채운 영역과 맵 안 벽 사이의 1칸 틈을 메운다. 맵 가장자리 1칸은 건드리지 않는다.
 */
export function expandCellsAgainstWalls(
  project: Project,
  map: GameMap,
  cells: readonly Point[],
): Point[] {
  const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const extra: Point[] = [];
  for (const cell of cells) {
    for (const dir of CARDINAL) {
      const gx = cell.x + dir.x;
      const gy = cell.y + dir.y;
      const key = `${gx},${gy}`;
      if (keys.has(key)) continue;
      if (!inMapBounds(map, gx, gy) || !isPassable(project, map, gx, gy)) continue;
      if (!isInMapWall(project, map, gx + dir.x, gy + dir.y)) continue;
      keys.add(key);
      extra.push({ x: gx, y: gy });
    }
  }
  return extra.length === 0 ? [...cells] : [...cells, ...extra];
}
