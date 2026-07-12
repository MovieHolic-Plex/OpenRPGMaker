import type { GameMap } from "../types";
import { stampDbHouseVariant, type DbHouseShapeVariant } from "./dbExtractedHouseVariants";
import type { SmallHouseMaterial } from "./dbExtractedHouseTemplate";
import { paintTownPathNetwork, offsetTownRect } from "./townPathAutotile";

export type TownHouseShowcaseStyle = "l" | "courtyard" | "multi" | "road";
export type TownCityPlotStyle = TownHouseShowcaseStyle | "plaster" | "stone";

const ROAD_SHOWCASE_CROSS_PATH = {
  x: 0,
  y: 14,
  width: 16,
  height: 2,
} as const;
const FLOWER = 288;
const TREE = 260;
const TREE_BOTTOM = 290;
const BENCH_LEFT = 327;
const BENCH_RIGHT = 328;

export function townHouseShowcaseName(style: TownHouseShowcaseStyle): string {
  switch (style) {
    case "courtyard":
      return "16x16 DB template courtyard";
    case "multi":
      return "16x16 DB template multi";
    case "road":
      return "16x16 DB template road";
    case "l":
      return "16x16 DB template L";
  }
}

export function stampTownHouseStyle(
  map: GameMap,
  style: TownHouseShowcaseStyle,
  originX: number,
  originY: number
): void {
  switch (style) {
    case "courtyard":
      stampTemplateHouse(map, { approachHeight: 6, material: "stone", originX, originY, variant: "wide" });
      stampTownMarketCounter(map, originX + 1, originY + 12);
      stampUpperPattern(map, originX + 12, originY + 12, [[FLOWER, -1, FLOWER]]);
      return;
    case "multi":
      stampTemplateHouse(map, { approachHeight: 6, material: "plaster", originX, originY, variant: "compact" });
      stampTownMarketCounter(map, originX + 11, originY + 12);
      stampUpperPattern(map, originX + 1, originY + 13, [[BENCH_LEFT, BENCH_RIGHT], [FLOWER, -1]]);
      return;
    case "road":
      // DB 추출 도어(329/359)를 사용하는 variant로 통일 — legacy template(116/146) 도어 사용 중단.
      // "wide" 변형을 써서 l/courtyard/multi와 각기 다른 houseShapeSignature를 만든다.
      stampTemplateHouse(map, { approachHeight: 5, material: "wood", originX, originY, variant: "wide" });
      paintTownPathNetwork(map, [offsetTownRect(originX, originY, ROAD_SHOWCASE_CROSS_PATH)]);
      stampUpperPattern(map, originX + 2, originY + 9, [[TREE, -1, FLOWER], [TREE_BOTTOM, -1, -1]]);
      return;
    case "l":
      stampTemplateHouse(map, { approachHeight: 3, material: "wood", originX, originY, variant: "l" });
      stampUpperPattern(map, originX + 1, originY + 9, [[TREE, -1], [TREE_BOTTOM, FLOWER]]);
      return;
  }
}

export function stampTownCityPlot(map: GameMap, style: TownCityPlotStyle, originX: number, originY: number): void {
  switch (style) {
    case "plaster":
      stampTemplateHouse(map, { approachHeight: 6, material: "plaster", originX, originY, variant: "compact" });
      return;
    case "stone":
      stampTemplateHouse(map, { approachHeight: 6, material: "stone", originX, originY, variant: "wide" });
      return;
    case "courtyard":
    case "multi":
    case "road":
    case "l":
      stampTownHouseStyle(map, style, originX, originY);
      return;
  }
}

const TABLE_L = 234;
const TABLE_M = 235;
const TABLE_R = 236;
const WOOD_BOX = 237;

/**
 * 장터 부스 소품 — 카운터(234–236) + 상자. 천막(411–443) 사용 금지.
 * @deprecated 이름 호환용. 신규 코드는 stampTownMarketCounter 사용.
 */
export function stampTownMarket(map: GameMap, x: number, y: number): void {
  stampTownMarketCounter(map, x, y);
}

/** 카운터 4칸 + 위 상자 (upper only) */
export function stampTownMarketCounter(map: GameMap, x: number, y: number): void {
  stampUpperPattern(map, x, y, [[TABLE_L, TABLE_M, TABLE_M, TABLE_R]]);
  if (y > 0) stampUpperPattern(map, x, y - 1, [[WOOD_BOX, FLOWER, -1, WOOD_BOX]]);
}

function stampTemplateHouse(
  map: GameMap,
  input: {
    readonly approachHeight: number;
    readonly material: SmallHouseMaterial;
    readonly originX: number;
    readonly originY: number;
    readonly variant: DbHouseShapeVariant;
  }
): void {
  stampDbHouseVariant(map, {
    approachHeight: input.approachHeight,
    material: input.material,
    origin: { x: input.originX, y: input.originY },
    variant: input.variant,
  });
}

function stampUpperPattern(map: GameMap, originX: number, originY: number, pattern: readonly (readonly number[])[]): void {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) setUpper(map, originX + x, originY + y, tile);
    }
  }
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (isInside(map, x, y)) map.upperTiles[y * map.width + x] = tile;
}

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}
