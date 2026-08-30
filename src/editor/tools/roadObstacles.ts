// editor/tools/roadObstacles.ts
// 도로/길 경로가 건물·물 위를 지나가지 않게 보정한다.
//
// 왜 필요한가 (실측): paint_road / lay_path 는 폴리라인을 그대로 칠하면서 lower 를 덮고
// upper 를 지웠다(`setLower` 는 upper 를 EMPTY 로 밀어버린다). 그래서 AI 가 두 지점을 잇는
// 길을 깔면 사이에 있던 집의 벽·지붕이 통째로 지워져 건물이 뚫렸다. 마을 시공기
// (`village/roads.ts`)는 자체 house 마스크로 이미 우회했지만 — 그 파일의 주석이 원인으로
// paint_road 를 명시한다 — AI 가 직접 부르는 두 툴에는 방어가 없었다.
//
// 계약:
//   1. 장애물이 없는 경로는 입력 셀 배열을 **그대로** 돌려준다(기존 결과와 바이트 동일).
//   2. 장애물 칸은 칠하지 않는다. 대신 그 구간을 BFS 최단 우회로로 다시 잇는다.
//   3. 우회로를 못 찾으면 끊긴 채로 두고(gap) 호출부가 경고로 알린다 — 저작물을 뚫는 것보다
//      길이 끊기는 편이 복구 가능하다.
//   4. 결정론: 이웃 탐색 순서가 고정이라 같은 입력이면 같은 우회로다(seed 재현성 유지).

import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { inMapBounds, type Point } from "./mapHelpers";

/** (x,y) 가 도로로 덮으면 안 되는 칸인가. */
export type RoadObstacleMask = (x: number, y: number) => boolean;

export type RoadPathRepair = {
  /** 실제로 칠할 셀 순서. 장애물 칸은 빠지고 우회 셀이 끼워진다. */
  readonly cells: readonly Point[];
  /** 장애물이라 칠하지 않은 칸 수. */
  readonly blocked: number;
  /** 우회로로 다시 이은 구간 수. */
  readonly detours: number;
  /** 우회로를 못 찾아 끊긴 구간 수. */
  readonly gaps: number;
};

// 우회 탐색 창 여유 — 구간 bbox 를 이만큼 넓힌 범위 안에서만 우회로를 찾는다.
const DETOUR_MARGIN = 32;
// 탐색 노드 상한 — 큰 맵에서도 비용을 묶는다.
const DETOUR_NODE_LIMIT = 40000;
// 이웃 순서 고정(위·아래·왼·오) = 결정론.
const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * 통행 불가 + 저작물이 있는 칸을 장애물로 본다.
 *
 * `lower === EMPTY && upper === EMPTY` 인 빈 칸은 장애물이 아니다 — `tilePassability` 가
 * 빈 칸을 "통행 불가"로 답하기 때문에, 빈 칸을 장애물로 세면 갓 만든 빈 맵 전체가 막혀
 * 길이 한 칸도 안 깔리는 퇴행이 난다.
 *
 * 타일셋이 없으면 통행성을 판정할 근거가 없으므로 아무것도 막지 않는다(기존 동작).
 */
export function roadObstacleMaskFor(project: Project, map: GameMap): RoadObstacleMask {
  if (!project.tilesets[map.tilesetId]) return () => false;
  const cache = new Map<number, boolean>();
  return (x: number, y: number): boolean => {
    if (!inMapBounds(map, x, y)) return false;
    const index = y * map.width + x;
    const cached = cache.get(index);
    if (cached !== undefined) return cached;
    const lower = map.lowerTiles[index] ?? TILE.EMPTY;
    const upper = map.upperTiles[index] ?? TILE.EMPTY;
    const authored = lower !== TILE.EMPTY || upper !== TILE.EMPTY;
    const blocked = authored && !isPassable(project, map, x, y);
    cache.set(index, blocked);
    return blocked;
  };
}

// 후보 경로에서 장애물 구간을 빼고 우회로로 다시 잇는다.
// 불변식: 맵 밖 셀도 결과에 남는다 — 호출부가 셀 하나당 타일 선택 RNG 를 한 번 소비하므로
// 여기서 걸러내면 시드가 같아도 타일 배열이 달라진다.

export function repairRoadPath(
  map: GameMap,
  mask: RoadObstacleMask,
  candidate: readonly Point[]
): RoadPathRepair {
  const cells: Point[] = [];
  let blocked = 0;
  let detours = 0;
  let gaps = 0;
  let previous: Point | null = null;
  let skippedSincePrevious = false;

  for (const cell of candidate) {
    if (mask(cell.x, cell.y)) {
      blocked += 1;
      skippedSincePrevious = true;
      continue;
    }
    if (previous && skippedSincePrevious) {
      const detour = detourBetween(map, mask, previous, cell);
      if (detour) {
        for (const step of detour) cells.push(step);
        detours += 1;
      } else {
        gaps += 1;
      }
    }
    cells.push(cell);
    skippedSincePrevious = false;
    if (inMapBounds(map, cell.x, cell.y)) previous = cell;
  }

  return { blocked, cells, detours, gaps };
}

/** from(제외)에서 to(제외)까지 장애물을 피하는 최단 경로. 없으면 null. */
function detourBetween(
  map: GameMap,
  mask: RoadObstacleMask,
  from: Point,
  to: Point
): readonly Point[] | null {
  if (!inMapBounds(map, to.x, to.y)) return null;
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) <= 1) return [];

  const minX = Math.max(0, Math.min(from.x, to.x) - DETOUR_MARGIN);
  const maxX = Math.min(map.width - 1, Math.max(from.x, to.x) + DETOUR_MARGIN);
  const minY = Math.max(0, Math.min(from.y, to.y) - DETOUR_MARGIN);
  const maxY = Math.min(map.height - 1, Math.max(from.y, to.y) + DETOUR_MARGIN);

  const start = from.y * map.width + from.x;
  const goal = to.y * map.width + to.x;
  const cameFrom = new Map<number, number>([[start, -1]]);
  let queue: number[] = [start];
  let visited = 1;

  while (queue.length > 0 && visited < DETOUR_NODE_LIMIT) {
    const next: number[] = [];
    for (const index of queue) {
      const x = index % map.width;
      const y = (index - x) / map.width;
      for (const step of NEIGHBORS) {
        const nx = x + step.x;
        const ny = y + step.y;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const nextIndex = ny * map.width + nx;
        if (cameFrom.has(nextIndex)) continue;
        if (nextIndex !== goal && mask(nx, ny)) continue;
        cameFrom.set(nextIndex, index);
        visited += 1;
        if (nextIndex === goal) return tracePath(map, cameFrom, goal);
        next.push(nextIndex);
      }
    }
    queue = next;
  }
  return null;
}

/** goal 까지의 부모 사슬을 풀어 start·goal 을 뺀 중간 셀만 반환한다. */
function tracePath(map: GameMap, cameFrom: ReadonlyMap<number, number>, goal: number): readonly Point[] {
  const reversed: Point[] = [];
  let cursor = cameFrom.get(goal) ?? -1;
  while (cursor >= 0) {
    const parent = cameFrom.get(cursor) ?? -1;
    if (parent < 0) break;
    const x = cursor % map.width;
    reversed.push({ x, y: (cursor - x) / map.width });
    cursor = parent;
  }
  return reversed.reverse();
}

/** 도구 결과에 붙일 경고 문장. 보정할 것이 없으면 null. */
export function roadRepairWarning(repair: RoadPathRepair): string | null {
  if (repair.blocked === 0) return null;
  const detour = repair.detours > 0 ? ` ${repair.detours}곳은 우회로로 다시 이었습니다.` : "";
  const gap = repair.gaps > 0
    ? ` ${repair.gaps}곳은 우회로가 없어 길이 끊겼습니다 — 경유점을 건물 밖으로 옮기거나 문 앞을 지나게 하세요.`
    : "";
  return `건물·물 등 통행 불가 ${repair.blocked}칸은 덮지 않았습니다(저작물 보호).${detour}${gap}`;
}
