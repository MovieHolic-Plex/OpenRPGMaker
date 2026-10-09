// editor/tools/roadObstacles.ts
// 도로/길 경로가 건물을 관통해 지워버리지 않게 보정한다.
//
// 왜 필요한가 (실측): paint_road / lay_path 는 폴리라인을 그대로 칠하면서 lower 를 덮고
// upper 를 지웠다(`setLower` 는 upper 를 EMPTY 로 밀어버린다). 그래서 AI 가 두 지점을 잇는
// 길을 깔면 사이에 있던 집의 벽·지붕이 통째로 지워져 건물이 뚫렸다. 마을 시공기
// (`village/roads.ts`)는 자체 house 마스크로 이미 우회했지만 — 그 파일의 주석이 원인으로
// paint_road 를 명시한다 — AI 가 직접 부르는 두 툴에는 방어가 없었다.
//
// 무엇을 막고 무엇을 덮는가 (`classifyRoadCell`):
//   structure(건물) — 벽·지붕·건물 정면. 절대 덮지 않고 우회한다.
//   water(물)       — 우선 우회하고, 마른 우회로가 없을 때만 건너간다(예전처럼 덮음).
//                     길이 강 앞에서 끊기는 것보다 건너가는 편이 쓸 수 있다.
//   그 밖(나무·울타리·말뚝) — 길이 덮는다. 산포물까지 막으면 숲을 가로지르는
//                     길이 나무마다 휘거나 통째로 끊긴다.
//
// 계약:
//   1. 장애물이 없는 경로는 입력 셀 배열을 **그대로** 돌려준다(기존 결과와 바이트 동일).
//   2. 건물 칸은 칠하지 않는다. 대신 그 구간을 BFS 최단 우회로로 다시 잇는다.
//   3. 우회로를 못 찾으면 gap 으로 보고한다 — 호출부는 끊긴 길을 커밋하지 않고 거절한다.
//   4. 결정론: 이웃 탐색 순서가 고정이라 같은 입력이면 같은 우회로다(시드 재현성 유지).

import { isPassable } from "@/project/collision";
import { CHIPSET_TILE_GROUPS, isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { inMapBounds, type Point } from "./mapHelpers";
import { protectedHouseCells } from "./houseProtection";

/** 도로가 이 칸을 어떻게 대해야 하는가. */
export type RoadCellClass = "open" | "structure" | "water";

/** (x,y) 의 분류. `open` 이면 그대로 칠해도 된다. */
export type RoadObstacleMask = (x: number, y: number) => RoadCellClass;

export type RoadPathRepair = {
  /** 실제로 칠할 셀 순서. 장애물 칸은 빠지고 우회 셀이 끼워진다. */
  readonly cells: readonly Point[];
  /** 장애물이라 칠하지 않은 칸 수. */
  readonly blocked: number;
  /** 그중 건물 칸 수. */
  readonly structureCells: number;
  /** 우회로로 다시 이은 구간 수. */
  readonly detours: number;
  /** 우회로를 못 찾아 끊긴 구간 수. */
  readonly gaps: number;
  /** 끊긴 구간이 시작된 좌표 — 경고에 그대로 실어 AI 가 경유점을 고칠 수 있게 한다. */
  readonly gapAt: readonly Point[];
  /** 마른 우회로가 없어 물 위로 건너간 칸. */
  readonly waterCrossings: readonly Point[];
  /** 요청한 경로의 첫 칸이 장애물이라 길이 그 지점에서 시작하지 못했다. */
  readonly startBlocked: boolean;
  /** 요청한 경로의 끝 칸이 장애물이라 길이 목표에 닿지 못했다. */
  readonly endBlocked: boolean;
};

/** 폭 셀(도로 두께)에서 장애물 칸을 걷어낸 결과. */
export type RoadWidthFilter = {
  readonly cells: readonly Point[];
  readonly blocked: number;
  readonly structureCells: number;
};

// 우회 탐색 창 여유 — 구간 bbox 를 이만큼 넓힌 범위 안에서만 우회로를 찾는다.
// 이 창이 곧 탐색 상한이다: 방문 셀은 창 안에서 한 번씩만 큐에 들어가므로
// cameFrom/queue 는 최대 (2*MARGIN+1)^2 개로 묶인다(별도 노드 상한이 필요 없다).
const DETOUR_MARGIN = 32;
// Equal-length detours prefer the south/front side over the protected north ridge.
// Fixed neighbor order keeps shortest-path routing deterministic.
const NEIGHBORS: readonly Point[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

// 길이 밀어도 되는 것: 자연 산포물과 울타리·말뚝. 집 창문·문·마당 같은 건물 부속은
// 여기 없다 — 건물 일부를 소품으로 오해하면 벽에 구멍이 난다.
const ROAD_CLEARABLE_TILES = new Set<number>([
  ...CHIPSET_TILE_GROUPS.treeObjects,
  ...CHIPSET_TILE_GROUPS.fenceObjects,
  ...CHIPSET_TILE_GROUPS.stakeObjects,
]);

/**
 * 통행 불가 칸을 건물 / 물 / 잡동사니로 가른다.
 *
 * `lower === EMPTY && upper === EMPTY` 인 빈 칸은 장애물이 아니다 — `tilePassability` 가
 * 빈 칸을 "통행 불가"로 답하기 때문에, 빈 칸을 장애물로 세면 갓 만든 빈 맵 전체가 막혀
 * 길이 한 칸도 안 깔리는 퇴행이 난다.
 *
 * 막는 타일을 레이어별로 모두 본다: 집 벽(lower) 위에 울타리(upper)가 얹혀 있을 때 위쪽만
 * 보고 "치울 수 있다"고 판정하면 벽까지 깎아버린다. 하나라도 건물이면 그 칸은 건물이다.
 *
 * 칩셋 계열이 아닌 타일셋은 소품 표가 안 맞으므로 통행 불가 칸을 모두 건물로 본다(보수적).
 */
export function roadObstacleMaskFor(project: Project, map: GameMap): RoadObstacleMask {
  const tileset = project.tilesets[map.tilesetId];
  // Completed geometry includes passable doors, bbox gaps, empty ridge cells and deck ladders.
  // Seed before painting so later tile changes cannot make ownership disappear.
  const cache = new Map<number, RoadCellClass>(
    protectedHouseCells(map).map((cell) => [cell.y * map.width + cell.x, "structure"])
  );
  return (x: number, y: number): RoadCellClass => {
    if (!inMapBounds(map, x, y)) return "open";
    const index = y * map.width + x;
    const cached = cache.get(index);
    if (cached !== undefined) return cached;
    const kind = tileset ? classifyRoadCell(project, tileset, map, x, y) : "open";
    cache.set(index, kind);
    return kind;
  };
}

function classifyRoadCell(
  project: Project,
  tileset: TilesetDef,
  map: GameMap,
  x: number,
  y: number
): RoadCellClass {
  const index = y * map.width + x;
  const lower = map.lowerTiles[index] ?? TILE.EMPTY;
  const upper = map.upperTiles[index] ?? TILE.EMPTY;
  if (lower === TILE.EMPTY && upper === TILE.EMPTY) return "open";
  if (isPassable(project, map, x, y)) return "open";
  const blockers = [lower, upper].filter(
    (tile) => tile !== TILE.EMPTY && passageMarkForTile(tileset, tile) === "x"
  );
  if (blockers.some((tile) => !isWaterChipsetTile(tile) && !ROAD_CLEARABLE_TILES.has(tile))) return "structure";
  if (blockers.some((tile) => isWaterChipsetTile(tile))) return "water";
  return "open";
}

/**
 * 후보 경로에서 장애물 구간을 빼고 우회로로 다시 잇는다.
 *
 * 전제: **중심선**(서로 인접한 셀 나열)만 받는다. 흩어진 배열을 넘기면 이웃도 아닌 두
 * 표본 사이를 BFS 로 이어 엉뚱한 들판에 길을 만든다. 폭 셀은 `filterRoadWidthCells` 로.
 *
 * 불변식: 맵 밖 셀도 결과에 남는다 — 호출부가 셀 하나당 타일 선택 RNG 를 한 번 소비하므로
 * 여기서 걸러내면 시드가 같아도 타일 배열이 달라진다.
 */
export function repairRoadPath(
  map: GameMap,
  mask: RoadObstacleMask,
  candidate: readonly Point[]
): RoadPathRepair {
  const cells: Point[] = [];
  const gapAt: Point[] = [];
  const waterCrossings: Point[] = [];
  let blocked = 0;
  let structureCells = 0;
  let detours = 0;
  let previous: Point | null = null;
  let skippedAt: Point | null = null;

  for (const cell of candidate) {
    const kind = mask(cell.x, cell.y);
    if (kind !== "open") {
      blocked += 1;
      if (kind === "structure") structureCells += 1;
      if (!skippedAt) skippedAt = cell;
      continue;
    }
    if (previous && skippedAt) {
      // 마른 우회로가 1순위, 물을 건너는 우회로가 2순위.
      const detour = detourBetween(map, mask, previous, cell, false)
        ?? detourBetween(map, mask, previous, cell, true);
      if (detour) {
        for (const step of detour) {
          cells.push(step);
          if (mask(step.x, step.y) === "water") waterCrossings.push(step);
        }
        if (detour.length > 0) detours += 1;
      } else {
        gapAt.push(skippedAt);
      }
    }
    cells.push(cell);
    skippedAt = null;
    if (inMapBounds(map, cell.x, cell.y)) previous = cell;
  }

  const ends = endpointBlocks(map, mask, candidate);
  return {
    blocked,
    cells,
    detours,
    endBlocked: ends.end,
    gapAt,
    gaps: gapAt.length,
    startBlocked: ends.start,
    structureCells,
    waterCrossings,
  };
}

/**
 * 폭 셀(도로 두께)에서 장애물 칸만 걷어낸다.
 *
 * 폭 셀은 중심선 각 칸의 수직 방향 표본이라 서로 인접하지 않는다. 그래서 경로 복구가
 * 아니라 **필터**가 정답이다 — 빠진 폭 셀은 도로가 그 칸에서 한 칸 얇아질 뿐,
 * 연결성은 중심선이 책임진다.
 */
export function filterRoadWidthCells(
  mask: RoadObstacleMask,
  widthCells: readonly Point[]
): RoadWidthFilter {
  const cells: Point[] = [];
  let blocked = 0;
  let structureCells = 0;
  for (const cell of widthCells) {
    const kind = mask(cell.x, cell.y);
    if (kind === "open") {
      cells.push(cell);
      continue;
    }
    blocked += 1;
    if (kind === "structure") structureCells += 1;
  }
  return { blocked, cells, structureCells };
}

/** 중심선 복구 결과에 폭 셀을 합친다. 연결성·우회 통계는 중심선 것을 그대로 쓴다. */
export function withWidthCells(repair: RoadPathRepair, width: RoadWidthFilter): RoadPathRepair {
  return {
    ...repair,
    blocked: repair.blocked + width.blocked,
    cells: [...repair.cells, ...width.cells],
    structureCells: repair.structureCells + width.structureCells,
  };
}

/** 요청 경로의 양 끝 칸(맵 안)이 장애물인가 — 길이 목표에 못 닿았다는 신호. */
function endpointBlocks(
  map: GameMap,
  mask: RoadObstacleMask,
  candidate: readonly Point[]
): { readonly start: boolean; readonly end: boolean } {
  const inside = candidate.filter((cell) => inMapBounds(map, cell.x, cell.y));
  if (inside.length === 0) return { end: false, start: false };
  const first = inside[0];
  const last = inside[inside.length - 1];
  return {
    end: mask(last.x, last.y) !== "open",
    start: mask(first.x, first.y) !== "open",
  };
}

/**
 * from(제외)에서 to(제외)까지 장애물을 피하는 최단 경로. 없으면 null.
 * `allowWater` 면 물 칸도 밟는다(마른 우회로가 없을 때의 2순위 시도).
 */
function detourBetween(
  map: GameMap,
  mask: RoadObstacleMask,
  from: Point,
  to: Point,
  allowWater: boolean
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

  while (queue.length > 0) {
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
        if (nextIndex !== goal && !walkable(mask(nx, ny), allowWater)) continue;
        cameFrom.set(nextIndex, index);
        if (nextIndex === goal) return tracePath(map, cameFrom, goal);
        next.push(nextIndex);
      }
    }
    queue = next;
  }
  return null;
}

function walkable(kind: RoadCellClass, allowWater: boolean): boolean {
  return kind === "open" || (allowWater && kind === "water");
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

/**
 * 도로 지표면을 깐다. ★(상위 우선) 통행 가능 오버레이는 남긴다 — 다리 판자·벽 사다리를
 * 지우면 걸을 수 있던 지형이 다시 막힌다.
 */
export function paintRoadGround(
  map: GameMap,
  tileset: TilesetDef | undefined,
  x: number,
  y: number,
  tile: number
): void {
  if (!inMapBounds(map, x, y)) return;
  const index = y * map.width + x;
  const upper = map.upperTiles[index] ?? TILE.EMPTY;
  map.lowerTiles[index] = tile;
  const keepsOverlay = tileset !== undefined
    && upper !== TILE.EMPTY
    && passageMarkForTile(tileset, upper) === "star";
  if (!keepsOverlay) map.upperTiles[index] = TILE.EMPTY;
}

/** 도구 결과에 붙일 경고 문장들. 보정할 것이 없으면 빈 배열. */
export function roadRepairWarnings(repair: RoadPathRepair): string[] {
  const warnings: string[] = [];
  if (repair.blocked > 0) {
    const detour = repair.detours > 0 ? ` ${repair.detours}곳은 우회로로 다시 이었습니다.` : "";
    warnings.push(`건물 등 통행 불가 ${repair.blocked}칸은 덮지 않았습니다(저작물 보호).${detour}`);
  }
  if (repair.waterCrossings.length > 0) {
    warnings.push(
      `물 ${repair.waterCrossings.length}칸(${formatPoints(repair.waterCrossings)})은 마른 우회로가 없어 길로 덮었습니다`
      + ` — 물을 살리려면 그 칸에 다리를 놓고 경유점을 다리 위로 지나게 하세요.`
    );
  }
  if (repair.startBlocked || repair.endBlocked) {
    const which = repair.startBlocked && repair.endBlocked ? "시작점과 끝점" : repair.startBlocked ? "시작점" : "끝점";
    warnings.push(`${which}이 통행 불가 칸이라 길이 그 칸에 닿지 못했습니다 — 경유점을 문 앞 통행 가능 칸으로 옮기세요.`);
  }
  return warnings;
}

/** 끊긴 길은 쓸 수 없다 — 호출부가 툴을 실패시킬 때 쓸 사유 문장. 끊긴 곳이 없으면 null. */
export function roadGapFailure(repair: RoadPathRepair): string | null {
  if (repair.gaps === 0) return null;
  return `건물에 막혀 길이 ${repair.gaps}곳(${formatPoints(repair.gapAt)})에서 끊깁니다`
    + ` — 끊긴 길은 걸을 수 없어 칠하지 않았습니다. 경유점을 건물 밖이나 문 앞으로 옮겨 다시 부르세요.`;
}

function formatPoints(points: readonly Point[]): string {
  const head = points.slice(0, 3).map((point) => `${point.x},${point.y}`).join(" / ");
  return points.length > 3 ? `${head} 외 ${points.length - 3}곳` : head;
}
