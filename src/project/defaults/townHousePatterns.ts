import type { GameMap } from "../types";
import { paintTownPathNetwork, offsetTownRect } from "./townPathAutotile";

export type TownHouseShowcaseStyle = "l" | "courtyard" | "multi" | "road";
export type TownCityPlotStyle = TownHouseShowcaseStyle | "plaster" | "stone";

type HouseMaterial = "wood" | "plaster" | "stone";
type HouseWallTileSet = {
  readonly top: readonly [number, number, number];
  readonly body: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
  readonly window: number;
};
type HouseRectSpec = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly wallHeight: number;
  readonly material: HouseMaterial;
  readonly doorOffset?: number | null;
  readonly floors?: 1 | 2;
  readonly windowOffsets?: readonly number[];
};

const TOWN_GRASS = 270;
const HOUSE_WALL_TILES: Record<HouseMaterial, HouseWallTileSet> = {
  stone: { top: [12, 13, 14], body: [42, 43, 44], bottom: [72, 73, 74], window: 85 },
  plaster: { top: [15, 16, 17], body: [45, 46, 47], bottom: [75, 76, 77], window: 87 },
  wood: { top: [102, 103, 104], body: [132, 133, 134], bottom: [162, 163, 164], window: 85 },
};
const TOWN_ROOF_TOP = [374, 375, 377] as const;
const TOWN_ROOF_FACE = [404, 405, 407] as const;
const TOWN_DOOR_TOP = 116;
const TOWN_DOOR_BOTTOM = 146;

export function townHouseShowcaseName(style: TownHouseShowcaseStyle): string {
  if (style === "courtyard") return "16x16 ㅁ자 안마당 집";
  if (style === "multi") return "16x16 여러 층 집";
  if (style === "road") return "16x16 길 연결 시험장";
  return "16x16 ㄱ자 집";
}

export function stampTownHouseStyle(
  map: GameMap,
  style: TownHouseShowcaseStyle,
  originX: number,
  originY: number
): void {
  if (style === "courtyard") stampCourtyardHouse(map, originX, originY);
  else if (style === "multi") stampMultiFloorHouse(map, originX, originY);
  else if (style === "road") stampRoadShowcase(map, originX, originY);
  else stampLShapedHouse(map, originX, originY);
}

export function stampTownCityPlot(map: GameMap, style: TownCityPlotStyle, originX: number, originY: number): void {
  if (style === "plaster" || style === "stone") {
    stampRectHouse(map, {
      x: 2,
      y: 1,
      width: 10,
      wallHeight: 3,
      material: style,
      doorOffset: 5,
      windowOffsets: [2, 7],
    }, originX, originY);
    paintTownPathNetwork(map, [offsetTownRect(originX, originY, { x: 6, y: 7, width: 3, height: 9 })]);
  } else {
    stampTownHouseStyle(map, style, originX, originY);
  }
}

export function stampTownMarket(map: GameMap, x: number, y: number): void {
  stampUpperPattern(map, x, y, [
    [411, 412, 413],
    [441, 442, 443],
  ]);
}

function stampLShapedHouse(map: GameMap, originX: number, originY: number): void {
  stampRectHouse(map, {
    x: 2, y: 1, width: 8, wallHeight: 3, material: "wood", doorOffset: 6, windowOffsets: [2, 4],
  }, originX, originY);
  stampRectHouse(map, {
    x: 2, y: 6, width: 5, wallHeight: 3, material: "wood", doorOffset: null, windowOffsets: [2],
  }, originX, originY);
  paintTownPathNetwork(map, [
    offsetTownRect(originX, originY, { x: 7, y: 6, width: 3, height: 10 }),
    offsetTownRect(originX, originY, { x: 7, y: 13, width: 6, height: 3 }),
  ]);
}

function stampCourtyardHouse(map: GameMap, originX: number, originY: number): void {
  stampRectHouse(map, {
    x: 2, y: 1, width: 12, wallHeight: 3, material: "stone", doorOffset: null, windowOffsets: [3, 8],
  }, originX, originY);
  stampRectHouse(map, {
    x: 2, y: 6, width: 4, wallHeight: 3, material: "stone", doorOffset: null, windowOffsets: [2],
  }, originX, originY);
  stampRectHouse(map, {
    x: 10, y: 6, width: 4, wallHeight: 3, material: "stone", doorOffset: null, windowOffsets: [1],
  }, originX, originY);
  stampRectHouse(map, {
    x: 4, y: 10, width: 8, wallHeight: 3, material: "stone", doorOffset: 4, windowOffsets: [2, 6],
  }, originX, originY);
  for (let y = 7; y <= 9; y += 1) {
    for (let x = 6; x <= 9; x += 1) setLower(map, originX + x, originY + y, TOWN_GRASS);
  }
  paintTownPathNetwork(map, [offsetTownRect(originX, originY, { x: 7, y: 15, width: 3, height: 1 })]);
}

function stampMultiFloorHouse(map: GameMap, originX: number, originY: number): void {
  stampRectHouse(map, {
    x: 3, y: 0, width: 10, wallHeight: 6, material: "plaster", doorOffset: 5, floors: 2, windowOffsets: [2, 7],
  }, originX, originY);
  stampUpperPattern(map, originX + 4, originY + 9, [[411, 412, 413]]);
  paintTownPathNetwork(map, [offsetTownRect(originX, originY, { x: 7, y: 8, width: 3, height: 8 })]);
}

function stampRoadShowcase(map: GameMap, originX: number, originY: number): void {
  stampRectHouse(map, {
    x: 1, y: 1, width: 5, wallHeight: 3, material: "wood", doorOffset: 2, windowOffsets: [],
  }, originX, originY);
  stampRectHouse(map, {
    x: 10, y: 1, width: 5, wallHeight: 3, material: "plaster", doorOffset: 2, windowOffsets: [],
  }, originX, originY);
  stampRectHouse(map, {
    x: 5, y: 10, width: 6, wallHeight: 3, material: "stone", doorOffset: 1, windowOffsets: [4],
  }, originX, originY);
  paintTownPathNetwork(map, [
    offsetTownRect(originX, originY, { x: 0, y: 7, width: 16, height: 3 }),
    offsetTownRect(originX, originY, { x: 7, y: 0, width: 3, height: 10 }),
    offsetTownRect(originX, originY, { x: 6, y: 9, width: 3, height: 1 }),
  ]);
}

function stampRectHouse(map: GameMap, spec: HouseRectSpec, originX: number, originY: number): void {
  const wall = HOUSE_WALL_TILES[spec.material];
  const x0 = originX + spec.x;
  const y0 = originY + spec.y;
  for (let x = 0; x < spec.width; x += 1) {
    const column = houseColumnIndex(x, spec.width);
    setUpper(map, x0 + x, y0, TOWN_ROOF_TOP[column]);
    setUpper(map, x0 + x, y0 + 1, TOWN_ROOF_FACE[column]);
  }
  const wallStartY = y0 + 2;
  for (let y = 0; y < spec.wallHeight; y += 1) {
    const rowTiles = houseWallRow(wall, y, spec.wallHeight);
    for (let x = 0; x < spec.width; x += 1) setUpper(map, x0 + x, wallStartY + y, rowTiles[houseColumnIndex(x, spec.width)]);
  }
  stampHouseWindows(map, spec, wall, x0, wallStartY);
  stampHouseDoor(map, spec, x0, wallStartY);
}

function stampHouseWindows(map: GameMap, spec: HouseRectSpec, wall: HouseWallTileSet, x0: number, wallStartY: number): void {
  const offsets = spec.windowOffsets ?? [2, spec.width - 3];
  const rows = spec.floors === 2 ? [1, 3] : [1];
  const doorOffset = spec.doorOffset ?? Math.floor(spec.width / 2);
  for (const yOffset of rows) {
    if (yOffset >= spec.wallHeight - 1) continue;
    for (const xOffset of offsets) {
      if (xOffset <= 0 || xOffset >= spec.width - 1 || xOffset === doorOffset) continue;
      setUpper(map, x0 + xOffset, wallStartY + yOffset, wall.window);
    }
  }
}

function stampHouseDoor(map: GameMap, spec: HouseRectSpec, x0: number, wallStartY: number): void {
  if (spec.doorOffset === null) return;
  const doorOffset = spec.doorOffset ?? Math.floor(spec.width / 2);
  if (doorOffset <= 0 || doorOffset >= spec.width - 1 || spec.wallHeight < 2) return;
  setUpper(map, x0 + doorOffset, wallStartY + spec.wallHeight - 2, TOWN_DOOR_TOP);
  setUpper(map, x0 + doorOffset, wallStartY + spec.wallHeight - 1, TOWN_DOOR_BOTTOM);
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

function houseWallRow(wall: HouseWallTileSet, row: number, wallHeight: number): readonly [number, number, number] {
  if (row === 0) return wall.top;
  if (row === wallHeight - 1) return wall.bottom;
  return wall.body;
}

function houseColumnIndex(x: number, width: number): 0 | 1 | 2 {
  if (x === 0) return 0;
  if (x === width - 1) return 2;
  return 1;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (isInside(map, x, y)) map.upperTiles[y * map.width + x] = tile;
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (isInside(map, x, y)) map.lowerTiles[y * map.width + x] = tile;
}

function isInside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}
