// editor/tools/village/plaza.ts
// 광장 — 위치·크기 산출, 장터 데크/소품, 정원 울타리, 꽃밭.

import { RM2K3_WOOD_FLOOR_PASSABILITY } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";
import type { Rng } from "@/util/rng";
import { inMapBounds } from "../mapHelpers";
import type { PlazaLayout } from "../villagePlan";
import {
  clamp,
  FENCE_END_LEFT,
  FENCE_END_RIGHT,
  HOUSE_MARGIN,
  PLAZA_HEIGHT,
  PLAZA_WIDTH,
  pointInMap,
  type Plaza,
  type Point,
  type Rect,
  type SettlementLayout,
} from "./constants";

export function villagePlaza(
  area: Rect,
  layout: PlazaLayout = "center",
  settlement: SettlementLayout = "plaza-ring",
  rng?: Rng,
): Plaza {
  // 광장 크기: settlement에 따라 가변 (고정 8×6만 쓰지 않음)
  let pw = PLAZA_WIDTH;
  let ph = PLAZA_HEIGHT;
  if (settlement === "street-grid") {
    pw = 6;
    ph = 6;
  } else if (settlement === "clusters") {
    pw = 10 + (rng ? Math.floor(rng() * 3) : 1);
    ph = 7 + (rng ? Math.floor(rng() * 2) : 1);
  } else if (rng) {
    pw = 7 + Math.floor(rng() * 4); // 7~10
    ph = 5 + Math.floor(rng() * 3); // 5~7
  }
  // 대형 맵(72+)은 광장도 면적에 맞게 키운다 — 100×100에 8×6 광장은 존재감이 없다 (2026-07-17).
  if (area.w >= 72 && area.h >= 72) {
    pw = 12 + (rng ? Math.floor(rng() * 3) : 1);
    ph = 8 + (rng ? Math.floor(rng() * 2) : 1);
  }
  pw = Math.min(pw, Math.max(4, area.w - 10));
  ph = Math.min(ph, Math.max(4, area.h - 10));

  let x = area.x + Math.floor(area.w / 2) - Math.floor(pw / 2);
  let y = area.y + Math.floor(area.h / 2) - Math.floor(ph / 2);
  const margin = HOUSE_MARGIN + 2;
  if (layout === "north") y = area.y + margin + Math.floor(area.h * 0.22);
  if (layout === "south") y = area.y + area.h - margin - ph - Math.floor(area.h * 0.18);
  if (layout === "west") x = area.x + margin + Math.floor(area.w * 0.18);
  if (layout === "east") x = area.x + area.w - margin - pw - Math.floor(area.w * 0.18);
  // clusters: 광장을 약간 비틀어 대칭 깨기
  if (settlement === "clusters" && rng) {
    x += Math.floor((rng() - 0.5) * 4);
    y += Math.floor((rng() - 0.5) * 3);
  }
  x = clamp(x, area.x + margin, area.x + area.w - margin - pw);
  y = clamp(y, area.y + margin, area.y + area.h - margin - ph);
  return {
    rect: { x, y, w: pw, h: ph },
    centerRow: y + Math.floor(ph / 2),
    centerX: x + Math.floor(pw / 2),
  };
}

export function paintMarketDeck(map: GameMap, rect: Rect): void {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      let tile: number = RM2K3_WOOD_FLOOR_PASSABILITY.body;
      if (x === rect.x) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeWest;
      else if (x === rect.x + rect.w - 1) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeEast;
      else if (y === rect.y) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeNorth;
      else if (y === rect.y + rect.h - 1) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeSouth;
      const index = y * map.width + x;
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
  let placed = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (!inMapBounds(map, x, y)) continue;
      const index = y * map.width + x;
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
    if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
    if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) continue;
    map.upperTiles[index] = tile;
    placed += 1;
  }
  return placed;
}

export function placeMarketDeckProps(map: GameMap, area: Rect): number {
  const placements: readonly (Point & { readonly tile: number })[] = [
    { x: area.x, y: area.y, tile: 234 },
    { x: area.x + 1, y: area.y, tile: 235 },
    { x: area.x + 2, y: area.y, tile: 236 },
    { x: area.x + area.w - 2, y: area.y + 1, tile: 202 },
    { x: area.x + area.w - 1, y: area.y + 1, tile: 203 },
    { x: area.x + 1, y: area.y + area.h - 2, tile: 327 },
    { x: area.x + 2, y: area.y + area.h - 2, tile: 328 },
    { x: area.x + area.w - 2, y: area.y + area.h - 2, tile: 237 },
    { x: area.x + Math.floor(area.w / 2), y: area.y + Math.floor(area.h / 2), tile: 320 },
  ];
  let placed = 0;
  for (const placement of placements) {
    if (!pointInMap(map, placement)) continue;
    const index = placement.y * map.width + placement.x;
    if (map.upperTiles[index] !== TILE.EMPTY) continue;
    map.upperTiles[index] = placement.tile;
    placed += 1;
  }
  return placed;
}
