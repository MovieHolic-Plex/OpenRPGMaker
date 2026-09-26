// editor/tools/village/fenceRepair.ts
// 이미 깔린 울타리를 "새로 짓지 않고" 손보는 순수 로직(2026-09-26).
//
// 왜: 「담장이 엉망으로 깔렸어. 새로 만들지는 말고 지금 있는 것만 손봐줘」 요청에 쓸 도구가 없었다.
// build_wall/author_house 는 시공기라 필지를 다시 잡고, paint_tiles 로는 모델이 조각 번호를 칸마다 맞춰야 한다.
// 계약: 울타리 칸 집합은 보존(외톨이만 빠진다)하고 조각 번호만 이웃 연결로 다시 고른다.
//
// 조각 규칙은 fences.ts 의 둘레 세트 정본(2026-07-16 사용자 교정)과 같다:
//   가로 연결 = 379, 세로 연결 = 408, 위 모서리 378/380, 아래 모서리 438/410,
//   가로 끝 = 409(오른쪽으로만 이어짐)/439(왼쪽으로만 이어짐). 이웃이 없는 외톨이 조각은 울타리로 안 보여서 걷어낸다.

import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";
import { protectedHouseCells } from "../houseProtection";
import {
  FENCE_BOTTOM_LEFT,
  FENCE_BOTTOM_RIGHT,
  FENCE_END_LEFT,
  FENCE_END_RIGHT,
  FENCE_SIDE_RAIL,
  FENCE_TILES,
  FENCE_TOP_LEFT,
  FENCE_TOP_RAIL,
  FENCE_TOP_RIGHT,
  ROAD_TILES,
  type Rect,
} from "./constants";

export type FenceRepairOptions = {
  /** 이 사각형 안의 울타리만 손본다. 생략 = 맵 전체. */
  readonly area?: Rect;
  /** true 면 같은 줄 두 조각 사이의 1칸 구멍을 메운다(문 게이트는 3칸이라 막히지 않는다). 기본 false. */
  readonly fillGaps?: boolean;
};

export type FenceRepairReport = {
  readonly fenceCellsBefore: number;
  readonly fenceCellsAfter: number;
  readonly retiled: number;
  readonly orphansRemoved: number;
  readonly gapsFilled: number;
  readonly badJointsBefore: number;
  readonly badJointsAfter: number;
};

type Neighbors = { readonly n: boolean; readonly s: boolean; readonly e: boolean; readonly w: boolean };

/** 이웃 연결에 맞는 정본 조각. 이웃이 없으면 null(외톨이). */
export function canonicalFenceTile({ n, s, e, w }: Neighbors): number | null {
  const horizontal = e || w;
  const vertical = n || s;
  if (!horizontal && !vertical) return null;
  if (e && w) return FENCE_TOP_RAIL; // 가로 한가운데. T자·십자도 가로대로 둔다(세트에 T 조각이 없다).
  if (!horizontal) return FENCE_SIDE_RAIL;
  if (!vertical) return e ? FENCE_END_LEFT : FENCE_END_RIGHT;
  // 가로 한쪽 + 세로 한쪽 이상 = 모서리. 세로가 양쪽이면 세로가 이긴다(꺾임 없이 지나가는 기둥).
  if (n && s) return FENCE_SIDE_RAIL;
  if (s) return e ? FENCE_TOP_LEFT : FENCE_TOP_RIGHT;
  return e ? FENCE_BOTTOM_LEFT : FENCE_BOTTOM_RIGHT;
}

function inArea(map: GameMap, x: number, y: number, area: Rect | undefined): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return !area || (x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h);
}

function isFence(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return FENCE_TILES.has(map.upperTiles[y * map.width + x] ?? TILE.EMPTY);
}

function neighborsOf(map: GameMap, x: number, y: number): Neighbors {
  return { n: isFence(map, x, y - 1), s: isFence(map, x, y + 1), e: isFence(map, x + 1, y), w: isFence(map, x - 1, y) };
}

/** 정본과 다른 조각 + 외톨이 조각 수. 수리 전후 비교용 지표. */
export function countBadFenceJoints(map: GameMap, area?: Rect): number {
  let bad = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!inArea(map, x, y, area) || !isFence(map, x, y)) continue;
      if (canonicalFenceTile(neighborsOf(map, x, y)) !== map.upperTiles[y * map.width + x]) bad += 1;
    }
  }
  return bad;
}

function fenceCellCount(map: GameMap, area?: Rect): number {
  let count = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) if (inArea(map, x, y, area) && isFence(map, x, y)) count += 1;
  }
  return count;
}

export function repairFences(map: GameMap, options: FenceRepairOptions = {}): FenceRepairReport {
  const { area } = options;
  const fenceCellsBefore = fenceCellCount(map, area);
  const badJointsBefore = countBadFenceJoints(map, area);
  const protectedCells = new Set(protectedHouseCells(map).map((cell) => cell.y * map.width + cell.x));

  // 1) 1칸 구멍 메우기(옵트인). 같은 줄 양옆(또는 위아래)이 울타리이고, 빈 upper·길 아님·집 소유 아님일 때만.
  let gapsFilled = 0;
  if (options.fillGaps === true) {
    const fills: number[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!inArea(map, x, y, area)) continue;
        const index = y * map.width + x;
        if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
        if (protectedCells.has(index) || ROAD_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY)) continue;
        const bridgesRow = isFence(map, x - 1, y) && isFence(map, x + 1, y);
        const bridgesColumn = isFence(map, x, y - 1) && isFence(map, x, y + 1);
        if (bridgesRow || bridgesColumn) fills.push(index);
      }
    }
    // 판정은 원래 배치 기준 — 메운 칸이 옆 칸 판정을 연쇄로 부르지 않게 모아서 한 번에 쓴다.
    for (const index of fills) map.upperTiles[index] = bridgesRowAt(map, index) ? FENCE_TOP_RAIL : FENCE_SIDE_RAIL;
    gapsFilled = fills.length;
  }

  // 2) 외톨이 걷어내기 → 3) 조각 다시 고르기. 외톨이를 먼저 걷어야 옆 조각이 끝 조각으로 제대로 마감된다.
  let orphansRemoved = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    let removed = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!inArea(map, x, y, area) || !isFence(map, x, y)) continue;
        if (canonicalFenceTile(neighborsOf(map, x, y)) === null) {
          map.upperTiles[y * map.width + x] = TILE.EMPTY;
          removed += 1;
        }
      }
    }
    orphansRemoved += removed;
    if (removed === 0) break;
  }

  const next: Array<[number, number]> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!inArea(map, x, y, area) || !isFence(map, x, y)) continue;
      const index = y * map.width + x;
      const tile = canonicalFenceTile(neighborsOf(map, x, y));
      if (tile !== null && tile !== map.upperTiles[index]) next.push([index, tile]);
    }
  }
  for (const [index, tile] of next) map.upperTiles[index] = tile;

  return {
    fenceCellsBefore,
    fenceCellsAfter: fenceCellCount(map, area),
    retiled: next.length,
    orphansRemoved,
    gapsFilled,
    badJointsBefore,
    badJointsAfter: countBadFenceJoints(map, area),
  };
}

function bridgesRowAt(map: GameMap, index: number): boolean {
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  return isFence(map, x - 1, y) && isFence(map, x + 1, y);
}
