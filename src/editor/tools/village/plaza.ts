// editor/tools/village/plaza.ts
// 광장 — 위치·크기 산출, 장터 데크/소품, 정원 울타리, 꽃밭.

import { WOOD_FLOOR_PASSABILITY } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { Rng } from "@/util/rng";
import type { GameMap } from "@/project/types";
import { inMapBounds } from "../mapHelpers";
import { protectedHouseCells, uniqueHouseRegionId } from "../houseProtection";
import { marketAisleCells, placeMarketDisplays } from "./market";
import {
  FENCE_END_LEFT,
  FENCE_END_RIGHT,
  type Rect,
} from "./constants";

export { villagePlaza } from "./plazaLayout";

export function paintMarketDeck(map: GameMap, rect: Rect): void {
  if (![rect.x,rect.y,rect.w,rect.h].every(Number.isSafeInteger) || rect.w<=0 || rect.h<=0) return;
  const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
  const gateways = new Set(marketAisleCells(rect).map(({x,y})=>y*map.width+x));
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (!inMapBounds(map,x,y)) continue;
      let tile: number = WOOD_FLOOR_PASSABILITY.body;
      if (x === rect.x) tile = WOOD_FLOOR_PASSABILITY.edgeWest;
      else if (x === rect.x + rect.w - 1) tile = WOOD_FLOOR_PASSABILITY.edgeEast;
      else if (y === rect.y) tile = WOOD_FLOOR_PASSABILITY.edgeNorth;
      else if (y === rect.y + rect.h - 1) tile = WOOD_FLOOR_PASSABILITY.edgeSouth;
      const index = y * map.width + x;
      if (protectedCells.has(index)) continue;
      // A closed edge in all four directions traps shoppers inside the deck.
      if (gateways.has(index)) tile=WOOD_FLOOR_PASSABILITY.body;
      map.lowerTiles[index] = tile;
      map.upperTiles[index] = TILE.EMPTY;
    }
  }
}

/**
 * 꽃밭 — bbox 영역에 꽃잎(348)을 무작위 다량 배치하고 꽃 덤불(288)·덤불(289)을 섞는다.
 * (사용자 문법: 꽃잎으로 바닥을 채우고 덤불로 볼륨을 준다.) 잔디+빈 upper 칸에만.
 */
export function paintFlowerField(map: GameMap, rect: Rect, rng: Rng): number {
  const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
  let placed = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (!inMapBounds(map, x, y)) continue;
      const index = y * map.width + x;
      if (protectedCells.has(index)) continue;
      if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
      if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
      const roll = rng();
      if (roll < 0.30) map.upperTiles[index] = 348;
      else if (roll < 0.38) map.upperTiles[index] = 288;
      else if (roll < 0.46) map.upperTiles[index] = 289;
      else continue;
      placed += 1;
    }
  }
  return placed;
}

/**
 * 정원 광장 울타리 — 둘레 정본 문법(위 378/379/380, 옆 408, 아래 438/379/410) + 남쪽 중앙 3칸 게이트.
 * 게이트 양끝은 끝 조각(439/409)으로 마감한다. 잔디·빈 upper 칸에만 친다.
 */
export function paintPlazaFence(map: GameMap, rect: Rect): number {
  const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
  if (rect.w < 5 || rect.h < 3) return 0;
  const x1 = rect.x + rect.w - 1;
  const y1 = rect.y + rect.h - 1;
  const gateC = rect.x + Math.floor(rect.w / 2);
  const cells: (readonly [number, number, number])[] = [
    [378, rect.x, rect.y],
    [380, x1, rect.y],
    [438, rect.x, y1],
    [410, x1, y1],
  ];
  for (let x = rect.x + 1; x < x1; x += 1) cells.push([379, x, rect.y]);
  for (let y = rect.y + 1; y < y1; y += 1) {
    cells.push([408, rect.x, y], [408, x1, y]);
  }
  for (let x = rect.x + 1; x < x1; x += 1) {
    if (x >= gateC - 1 && x <= gateC + 1) continue; // 게이트
    const tile = x === gateC - 2 ? FENCE_END_RIGHT : x === gateC + 2 ? FENCE_END_LEFT : 379;
    cells.push([tile, x, y1]);
  }
  let placed = 0;
  for (const [tile, x, y] of cells) {
    if (!inMapBounds(map, x, y)) continue;
    const index = y * map.width + x;
    if (protectedCells.has(index)) continue;
    if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
    if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
    map.upperTiles[index] = tile;
    placed += 1;
  }
  return placed;
}

export function placeMarketDeckProps(map: GameMap, area: Rect): number {
  const result = placeMarketDisplays(map, area);
  if (map.layoutPlan) for (const display of result.displays) {
    const x = Math.min(...display.cells.map(p => p.x)), y = Math.min(...display.cells.map(p => p.y));
    map.layoutPlan.regions.push({ id: uniqueHouseRegionId(map, "market_stall"), role: "market",
      label: ({ produce: "과일 가판", pottery: "그릇 가판", provisions: "식료품 가판" })[display.goods],
      x, y, w: Math.max(...display.cells.map(p => p.x)) - x + 1, h: Math.max(...display.cells.map(p => p.y)) - y + 1,
      front: display.frontage[0], tags: ["market-display", display.goods] });
  }
  return result.placed;
}
