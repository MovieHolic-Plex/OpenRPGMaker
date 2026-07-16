// editor/tools/village/fences.ts
// 집 필지 울타리 — 둘레 정본 문법 시공, 모서리 강등, 울타리 존재/개수 검사.

import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";
import {
  expandRect,
  FENCE_BOTTOM_LEFT,
  FENCE_BOTTOM_RIGHT,
  FENCE_END_LEFT,
  FENCE_END_RIGHT,
  FENCE_GATE_HALF_WIDTH,
  FENCE_LOT_MARGIN,
  FENCE_SIDE_RAIL,
  FENCE_TILES,
  FENCE_TOP_RAIL,
  pointInMap,
  ROAD_TILES,
  type BuiltHouse,
  type Rect,
} from "./constants";

export function placeHouseLotFences(map: GameMap, houses: readonly BuiltHouse[], seed: number): void {
  for (let index = 0; index < houses.length; index += 1) {
    placeLotFence(map, houses[index]!, index, seed);
  }
}

function placeLotFence(map: GameMap, house: BuiltHouse, houseIndex: number, seed: number): void {
  const lot = expandRect(house.bbox, FENCE_LOT_MARGIN);
  if (lot.w < 2 || lot.h < 2) return;
  const lastX = lot.x + lot.w - 1;
  const lastY = lot.y + lot.h - 1;
  const hash = Math.abs(Math.imul(seed + 31, 1103515245) ^ Math.imul(houseIndex + 7, 12345));
  const setFence = (x: number, y: number, tile: number): boolean => {
    if (!pointInMap(map, { x, y })) return false;
    if (ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) return false;
    // 이미 뭔가 얹힌 칸(용마루·나무·소품)은 덮지 않는다 — 울타리가 지붕 장식을 지우던 회귀 방지.
    if ((map.upperTiles[y * map.width + x] ?? TILE.EMPTY) !== TILE.EMPTY) return false;
    map.upperTiles[y * map.width + x] = tile;
    return true;
  };
  const paintRow = (x0: number, x1: number, y: number, leftTile: number, rightTile: number): number => {
    let count = 0;
    for (let x = x0; x <= x1; x += 1) {
      const tile = x === x0 ? leftTile : x === x1 ? rightTile : FENCE_TOP_RAIL;
      if (setFence(x, y, tile)) count += 1;
    }
    return count;
  };

  // 앞마당 하변 울타리 + 문 게이트 (둘레 세트 정본 문법).
  // 마감 원칙(2026-07-16): 울타리는 이어지거나, 좌/우 끝 조각(409/439)으로 끝나야 한다.
  // 모서리(438/410)는 세로 변(408)이 실제로 이어질 때만 쓴다 — 홀로 꺾이면 "만들다 만" 느낌.
  // 예전엔 위 모서리(378/380)를 끝캡으로 오용해 아치 조각처럼 보였다 — 되살리지 말 것.
  // 북쪽 lot.y는 용마루 행(bbox.y-1)이라 "지붕 위 울타리"로 보인다 — 절대 치지 않는다.
  const gateL = house.doorAt.x - FENCE_GATE_HALF_WIDTH;
  const gateR = house.doorAt.x + FENCE_GATE_HALF_WIDTH;
  // 절반의 집은 바깥 끝을 모서리+세로 기둥으로 꺾어 마당 느낌 — 나머지는 끝 조각 마감.
  const withSidePosts = hash % 2 === 0;
  let placed = 0;
  // 런이 2칸 미만이면 치지 않는다 — 끝 조각 하나만 남으면 울타리로 안 보인다.
  if (gateL - 1 >= lot.x + 1) {
    const count = paintRow(lot.x, gateL - 1, lastY, withSidePosts ? FENCE_BOTTOM_LEFT : FENCE_END_LEFT, FENCE_END_RIGHT);
    // 모서리를 썼으면 세로 기둥으로 반드시 이어 준다 — 못 이으면 끝 조각으로 강등 (모서리 홀로 금지).
    if (count > 0 && withSidePosts) {
      const linked = setFence(lot.x, lastY - 1, FENCE_SIDE_RAIL) && setFence(lot.x, lastY - 2, FENCE_SIDE_RAIL);
      if (!linked) demoteCornerToEnd(map, lot.x, lastY, FENCE_BOTTOM_LEFT, FENCE_END_LEFT);
    }
    placed += count;
  }
  if (gateR + 1 <= lastX - 1) {
    const count = paintRow(gateR + 1, lastX, lastY, FENCE_END_LEFT, withSidePosts ? FENCE_BOTTOM_RIGHT : FENCE_END_RIGHT);
    if (count > 0 && withSidePosts) {
      const linked = setFence(lastX, lastY - 1, FENCE_SIDE_RAIL) && setFence(lastX, lastY - 2, FENCE_SIDE_RAIL);
      if (!linked) demoteCornerToEnd(map, lastX, lastY, FENCE_BOTTOM_RIGHT, FENCE_END_RIGHT);
    }
    placed += count;
  }
  if (placed === 0) {
    // 앞줄 지정 구간이 길/소품으로 막혔으면 게이트를 피해 빈 런(≥2칸)을 찾아 친다.
    let runStart = -1;
    for (let x = lot.x; x <= lastX + 1; x += 1) {
      const inGate = Math.abs(x - house.doorAt.x) <= FENCE_GATE_HALF_WIDTH;
      const index = lastY * map.width + x;
      const free = x <= lastX && !inGate && pointInMap(map, { x, y: lastY })
        && !ROAD_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY)
        && (map.upperTiles[index] ?? TILE.EMPTY) === TILE.EMPTY;
      if (free && runStart < 0) runStart = x;
      if (!free && runStart >= 0) {
        if (x - runStart >= 2) {
          // 떠 있는 런 — 양끝을 끝 가로대(409/439)로 마감.
          placed = paintRow(runStart, x - 1, lastY, FENCE_END_LEFT, FENCE_END_RIGHT);
          break;
        }
        runStart = -1;
      }
    }
  }
  if (placed === 0) {
    // 최후 수단: 벽 옆 세로 울타리 — 3면이 길로 감싸인 집의 유일한 자리.
    // 바닥(마당) 쪽에 붙인 최대 3칸 연속 구간만 — 길게 세우면 깃대처럼 보인다.
    for (const x of [lot.x, lastX]) {
      let count = 0;
      for (let y = lastY - 1; y > lot.y && count < 3; y -= 1) {
        if (setFence(x, y, FENCE_SIDE_RAIL)) count += 1;
        else if (count > 0) break; // 연속 구간이 끊기면 중단 — 점선 기둥 방지
      }
      if (count > 0) {
        placed = count;
        break;
      }
    }
  }
}

/** 세로 기둥과 못 이어진 모서리를 좌/우 끝 조각으로 강등 + 고아 기둥 정리. */
function demoteCornerToEnd(map: GameMap, x: number, y: number, cornerTile: number, endTile: number): void {
  const index = y * map.width + x;
  if (map.upperTiles[index] === cornerTile) map.upperTiles[index] = endTile;
  const midIndex = (y - 1) * map.width + x;
  if (map.upperTiles[midIndex] === FENCE_SIDE_RAIL) map.upperTiles[midIndex] = TILE.EMPTY;
}

export function houseHasFence(map: GameMap, house: BuiltHouse): boolean {
  const lot = expandRect(house.bbox, FENCE_LOT_MARGIN);
  const lastX = lot.x + lot.w - 1;
  const lastY = lot.y + lot.h - 1;
  // 필지 둘레 어디든 울타리 타일이 있으면 OK (길 폭 때문에 모서리만 보면 놓침)
  for (let x = lot.x; x <= lastX; x += 1) {
    for (const y of [lot.y, lastY]) {
      if (pointInMap(map, { x, y }) && FENCE_TILES.has(map.upperTiles[y * map.width + x] ?? TILE.EMPTY)) return true;
    }
  }
  for (let y = lot.y; y <= lastY; y += 1) {
    for (const x of [lot.x, lastX]) {
      if (pointInMap(map, { x, y }) && FENCE_TILES.has(map.upperTiles[y * map.width + x] ?? TILE.EMPTY)) return true;
    }
  }
  return false;
}

export function countFenceTiles(map: GameMap, area: Rect): number {
  let count = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (FENCE_TILES.has(map.upperTiles[y * map.width + x] ?? TILE.EMPTY)) count += 1;
    }
  }
  return count;
}
