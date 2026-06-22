import { genId } from "@/util/id";
import type { GameMap } from "../types";
import { DEFAULT_TILE_SIZE, TILE } from "./constants";
import { clearUpperTilesOnTownPath, paintTownPathNetwork, shapeAllTownPaths } from "./townPathAutotile";

const CITY_SIZE = 50;
const COMBINED_TOWN_TILESET_ID = "easyrpg_chipset_combined_town";
const TOWN_GRASS = 270;
const ROOF_CAP_LEFT = 374;
const ROOF_CAP_RIGHT = 377;
const ROOF_BODY = 375;
const ROOF_FACE_LEFT = 404;
const ROOF_FACE_MID = 405;
const WOOD_ROOF_FACE_LEFT = 102;
const WOOD_ROOF_FACE_MID = 103;
const WOOD_ROOF_FACE_RIGHT = 104;
const WOOD_LEFT = 132;
const WOOD_MID = 133;
const WOOD_RIGHT = 134;
const WOOD_BOTTOM_LEFT = 162;
const WOOD_BOTTOM_MID = 163;
const WOOD_BOTTOM_RIGHT = 164;
const PLASTER_LEFT = 45;
const PLASTER_MID = 46;
const PLASTER_RIGHT = 47;
const PLASTER_BOTTOM_LEFT = 75;
const PLASTER_BOTTOM_MID = 76;
const PLASTER_BOTTOM_RIGHT = 77;
const WINDOW_WOOD = 85;
const WINDOW_PLASTER = 87;
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const TREE = 260;
const FLOWER = 288;
const BENCH_LEFT = 327;
const BENCH_RIGHT = 328;
const WATER = 120;
const MARKET_TOP_LEFT = 411;
const MARKET_TOP_MID = 412;
const MARKET_TOP_RIGHT = 413;
const MARKET_BOTTOM_LEFT = 441;
const MARKET_BOTTOM_MID = 442;
const MARKET_BOTTOM_RIGHT = 443;

type TilePoint = {
  readonly x: number;
  readonly y: number;
};

type HousePoint = TilePoint & {
  readonly kind: "reference" | "wideShop" | "smallWood" | "woodL";
};

const CITY_HOUSES = [
  { kind: "reference", x: 1, y: 3 },
  { kind: "wideShop", x: 14, y: 4 },
  { kind: "smallWood", x: 31, y: 5 },
  { kind: "reference", x: 42, y: 3 },
  { kind: "woodL", x: 1, y: 26 },
  { kind: "wideShop", x: 14, y: 28 },
  { kind: "reference", x: 30, y: 27 },
  { kind: "smallWood", x: 43, y: 30 },
] as const satisfies readonly HousePoint[];

export function createTownArchitectureCityMap(): GameMap {
  const map = createBlankCityMap();
  for (const house of CITY_HOUSES) stampHouse(map, house);
  paintTownPathNetwork(map, [
    { x: 0, y: 23, width: CITY_SIZE, height: 3 },
    { x: 0, y: 40, width: CITY_SIZE, height: 2 },
    { x: 8, y: 0, width: 2, height: CITY_SIZE },
    { x: 23, y: 0, width: 3, height: CITY_SIZE },
    { x: 40, y: 0, width: 2, height: CITY_SIZE },
    { x: 19, y: 19, width: 12, height: 12 },
    { x: 4, y: 13, width: 6, height: 2 },
    { x: 17, y: 13, width: 9, height: 2 },
    { x: 33, y: 13, width: 9, height: 2 },
    { x: 40, y: 13, width: 7, height: 2 },
    { x: 3, y: 39, width: 4, height: 3 },
    { x: 17, y: 37, width: 9, height: 4 },
    { x: 33, y: 37, width: 3, height: 5 },
    { x: 40, y: 37, width: 7, height: 4 },
  ]);
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
  for (const house of CITY_HOUSES) stampOpenings(map, house);
  stampTownDetails(map);
  return map;
}

function createBlankCityMap(): GameMap {
  const tileCount = CITY_SIZE * CITY_SIZE;
  return {
    id: genId("map"),
    name: "50x50 검증 기반 도시",
    width: CITY_SIZE,
    height: CITY_SIZE,
    tilesetId: COMBINED_TOWN_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(tileCount).fill(TOWN_GRASS),
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    events: [],
  };
}

function stampHouse(map: GameMap, house: HousePoint): void {
  switch (house.kind) {
    case "reference":
      stampReferenceHouse(map, house);
      return;
    case "wideShop":
      stampWideShopHouse(map, house);
      return;
    case "smallWood":
      stampSmallWoodHouse(map, house);
      return;
    case "woodL":
      stampWoodLHouse(map, house);
      return;
  }
}

function stampReferenceHouse(map: GameMap, origin: TilePoint): void {
  stampRoofBand(map, origin, 7, 4);
  stampUpperRun(map, { x: origin.x, y: origin.y + 4 }, 7, [ROOF_FACE_LEFT, ROOF_FACE_MID, ROOF_FACE_MID]);
  for (let y = origin.y + 5; y <= origin.y + 11; y += 1) {
    stampPlasterRun(map, { x: origin.x, y }, 7, y === origin.y + 11 ? "bottom" : "body");
  }
  stampReferenceOpenings(map, origin);
}

function stampWoodLHouse(map: GameMap, origin: TilePoint): void {
  stampRoofBand(map, origin, 10, 3);
  stampWoodRoofFaceRun(map, { x: origin.x, y: origin.y + 3 }, 10);
  for (let y = origin.y + 4; y <= origin.y + 7; y += 1) {
    stampWoodRun(map, { x: origin.x, y }, 10, y === origin.y + 7 ? "bottom" : "body");
  }
  stampRoofBand(map, { x: origin.x, y: origin.y + 8 }, 7, 3);
  stampWoodRoofFaceRun(map, { x: origin.x, y: origin.y + 11 }, 7);
  for (let y = origin.y + 12; y <= origin.y + 15; y += 1) {
    stampWoodRun(map, { x: origin.x, y }, 7, y === origin.y + 15 ? "bottom" : "body");
  }
  stampWoodLOpenings(map, origin);
}

function stampWideShopHouse(map: GameMap, origin: TilePoint): void {
  stampRoofBand(map, origin, 9, 3);
  stampUpperRun(map, { x: origin.x, y: origin.y + 3 }, 9, [ROOF_FACE_LEFT, ROOF_FACE_MID, ROOF_FACE_MID]);
  for (let y = origin.y + 4; y <= origin.y + 9; y += 1) {
    stampPlasterRun(map, { x: origin.x, y }, 9, y === origin.y + 9 ? "bottom" : "body");
  }
  stampWideShopOpenings(map, origin);
}

function stampSmallWoodHouse(map: GameMap, origin: TilePoint): void {
  stampRoofBand(map, origin, 6, 3);
  stampWoodRoofFaceRun(map, { x: origin.x, y: origin.y + 3 }, 6);
  for (let y = origin.y + 4; y <= origin.y + 8; y += 1) {
    stampWoodRun(map, { x: origin.x, y }, 6, y === origin.y + 8 ? "bottom" : "body");
  }
  stampSmallWoodOpenings(map, origin);
}

function stampOpenings(map: GameMap, house: HousePoint): void {
  switch (house.kind) {
    case "reference":
      stampReferenceOpenings(map, house);
      return;
    case "wideShop":
      stampWideShopOpenings(map, house);
      return;
    case "smallWood":
      stampSmallWoodOpenings(map, house);
      return;
    case "woodL":
      stampWoodLOpenings(map, house);
      return;
  }
}

function stampReferenceOpenings(map: GameMap, origin: TilePoint): void {
  stampUpper(map, { x: origin.x + 2, y: origin.y + 7 }, WINDOW_PLASTER);
  stampUpper(map, { x: origin.x + 4, y: origin.y + 7 }, WINDOW_PLASTER);
  stampUpper(map, { x: origin.x + 1, y: origin.y + 9 }, WINDOW_PLASTER);
  stampUpper(map, { x: origin.x + 5, y: origin.y + 9 }, WINDOW_PLASTER);
  stampUpper(map, { x: origin.x + 3, y: origin.y + 9 }, DOOR_TOP);
  stampUpper(map, { x: origin.x + 3, y: origin.y + 10 }, DOOR_BOTTOM);
}

function stampWideShopOpenings(map: GameMap, origin: TilePoint): void {
  stampUpper(map, { x: origin.x + 2, y: origin.y + 6 }, WINDOW_PLASTER);
  stampUpper(map, { x: origin.x + 6, y: origin.y + 6 }, WINDOW_PLASTER);
  stampUpper(map, { x: origin.x + 4, y: origin.y + 8 }, DOOR_TOP);
  stampUpper(map, { x: origin.x + 4, y: origin.y + 9 }, DOOR_BOTTOM);
}

function stampSmallWoodOpenings(map: GameMap, origin: TilePoint): void {
  stampUpper(map, { x: origin.x + 1, y: origin.y + 6 }, WINDOW_WOOD);
  stampUpper(map, { x: origin.x + 4, y: origin.y + 6 }, WINDOW_WOOD);
  stampUpper(map, { x: origin.x + 3, y: origin.y + 7 }, DOOR_TOP);
  stampUpper(map, { x: origin.x + 3, y: origin.y + 8 }, DOOR_BOTTOM);
}

function stampWoodLOpenings(map: GameMap, origin: TilePoint): void {
  stampUpper(map, { x: origin.x + 3, y: origin.y + 5 }, WINDOW_WOOD);
  stampUpper(map, { x: origin.x + 6, y: origin.y + 5 }, WINDOW_WOOD);
  stampUpper(map, { x: origin.x + 1, y: origin.y + 13 }, WINDOW_WOOD);
  stampUpper(map, { x: origin.x + 5, y: origin.y + 13 }, WINDOW_WOOD);
  stampUpper(map, { x: origin.x + 3, y: origin.y + 14 }, DOOR_TOP);
  stampUpper(map, { x: origin.x + 3, y: origin.y + 15 }, DOOR_BOTTOM);
}

function stampTownDetails(map: GameMap): void {
  stampLowerRect(map, { x: 16, y: 43 }, 6, 4, WATER);
  stampUpperPattern(map, { x: 20, y: 21 }, [[BENCH_LEFT, BENCH_RIGHT], [FLOWER, -1], [-1, FLOWER]]);
  stampUpperPattern(map, { x: 27, y: 21 }, [[BENCH_LEFT, BENCH_RIGHT], [-1, FLOWER], [FLOWER, -1]]);
  stampUpperPattern(map, { x: 21, y: 27 }, [[MARKET_TOP_LEFT, MARKET_TOP_MID, MARKET_TOP_RIGHT], [MARKET_BOTTOM_LEFT, MARKET_BOTTOM_MID, MARKET_BOTTOM_RIGHT]]);
  stampUpperPattern(map, { x: 27, y: 27 }, [[MARKET_TOP_LEFT, MARKET_TOP_MID, MARKET_TOP_RIGHT], [MARKET_BOTTOM_LEFT, MARKET_BOTTOM_MID, MARKET_BOTTOM_RIGHT]]);
  stampUpperPattern(map, { x: 12, y: 15 }, [[FLOWER, -1, FLOWER]]);
  stampUpperPattern(map, { x: 28, y: 15 }, [[FLOWER, FLOWER]]);
  stampUpperPattern(map, { x: 38, y: 35 }, [[FLOWER], [FLOWER]]);
  stampUpperPattern(map, { x: 14, y: 42 }, [[FLOWER, -1, FLOWER], [-1, BENCH_LEFT, BENCH_RIGHT], [FLOWER, -1, FLOWER]]);
  stampUpperPattern(map, { x: 22, y: 43 }, [[FLOWER, FLOWER], [FLOWER, FLOWER]]);
  for (const point of [
    { x: 12, y: 18 }, { x: 14, y: 18 }, { x: 33, y: 18 }, { x: 35, y: 18 },
    { x: 12, y: 43 }, { x: 23, y: 43 }, { x: 37, y: 18 }, { x: 43, y: 33 }, { x: 45, y: 43 },
  ]) {
    stampUpper(map, point, TREE);
  }
}

function stampRoofBand(map: GameMap, origin: TilePoint, width: number, height: number): void {
  for (let y = 0; y < height; y += 1) stampUpperRun(map, { x: origin.x, y: origin.y + y }, width, [ROOF_CAP_LEFT, ROOF_BODY, ROOF_CAP_RIGHT]);
}

function stampWoodRoofFaceRun(map: GameMap, origin: TilePoint, width: number): void {
  stampLowerRun(map, origin, width, [WOOD_ROOF_FACE_LEFT, WOOD_ROOF_FACE_MID, WOOD_ROOF_FACE_RIGHT]);
}

function stampWoodRun(map: GameMap, origin: TilePoint, width: number, row: "body" | "bottom"): void {
  stampLowerRun(map, origin, width, row === "bottom" ? [WOOD_BOTTOM_LEFT, WOOD_BOTTOM_MID, WOOD_BOTTOM_RIGHT] : [WOOD_LEFT, WOOD_MID, WOOD_RIGHT]);
}

function stampPlasterRun(map: GameMap, origin: TilePoint, width: number, row: "body" | "bottom"): void {
  stampLowerRun(map, origin, width, row === "bottom" ? [PLASTER_BOTTOM_LEFT, PLASTER_BOTTOM_MID, PLASTER_BOTTOM_RIGHT] : [PLASTER_LEFT, PLASTER_MID, PLASTER_RIGHT]);
}

function stampUpperPattern(map: GameMap, origin: TilePoint, pattern: readonly (readonly number[])[]): void {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) stampUpper(map, { x: origin.x + x, y: origin.y + y }, tile);
    }
  }
}

function stampLowerRect(map: GameMap, origin: TilePoint, width: number, height: number, tile: number): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) stampLower(map, { x: origin.x + x, y: origin.y + y }, tile);
  }
}

function stampUpperRun(map: GameMap, origin: TilePoint, width: number, tiles: readonly [number, number, number]): void {
  for (let offset = 0; offset < width; offset += 1) stampUpper(map, { x: origin.x + offset, y: origin.y }, tiles[columnIndex(offset, width)]);
}

function stampLowerRun(map: GameMap, origin: TilePoint, width: number, tiles: readonly [number, number, number]): void {
  for (let offset = 0; offset < width; offset += 1) stampLower(map, { x: origin.x + offset, y: origin.y }, tiles[columnIndex(offset, width)]);
}

function columnIndex(offset: number, width: number): 0 | 1 | 2 {
  if (offset === 0) return 0;
  if (offset === width - 1) return 2;
  return 1;
}

function stampUpper(map: GameMap, point: TilePoint, tile: number): void {
  if (isInside(map, point)) map.upperTiles[point.y * map.width + point.x] = tile;
}

function stampLower(map: GameMap, point: TilePoint, tile: number): void {
  if (isInside(map, point)) map.lowerTiles[point.y * map.width + point.x] = tile;
}

function isInside(map: GameMap, point: TilePoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}
