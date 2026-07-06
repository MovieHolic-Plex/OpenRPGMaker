import { genId } from "@/util/id";
import type { GameMap } from "../types";
import { SAND_TILE } from "./chipsetMapping";
import { DEFAULT_TILE_SIZE, TILE } from "./constants";
import { dbHouseVariantDoorBottomOffset, stampDbHouseVariant, type DbHouseShapeVariant } from "./dbExtractedHouseVariants";
import type { SmallHouseMaterial, TilePoint } from "./dbExtractedHouseTemplate";
import type { RoadRect } from "./roadAutotile";
import { addTownArchitectureCityNpcs } from "./townArchitectureCityNpcs";
import { clearUpperTilesOnTownPath, paintTownPathNetwork, shapeAllTownPaths } from "./townPathAutotile";

const CITY_SIZE = 50;
const COMBINED_TOWN_TILESET_ID = "easyrpg_chipset_combined_town";
const TOWN_GRASS = 270;
const TREE = 260;
const TREE_BOTTOM = 290;
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
const TOWN_PATH_TILES = new Set<number>(Object.values(SAND_TILE));

type CityHouse = TilePoint & {
  readonly material: SmallHouseMaterial;
  readonly approachHeight: number;
  readonly decor: "garden" | "market" | "bench" | "trees";
  readonly variant: DbHouseShapeVariant;
};

const CITY_HOUSES = [
  { material: "wood", x: 1, y: 1, approachHeight: 1, decor: "garden", variant: "l" },
  { material: "stone", x: 19, y: 1, approachHeight: 2, decor: "market", variant: "wide" },
  { material: "plaster", x: 36, y: 0, approachHeight: 2, decor: "bench", variant: "compact" },
  { material: "wood", x: 1, y: 17, approachHeight: 2, decor: "trees", variant: "compact" },
  { material: "plaster", x: 19, y: 16, approachHeight: 2, decor: "garden", variant: "compact" },
  { material: "stone", x: 34, y: 16, approachHeight: 2, decor: "market", variant: "wide" },
  { material: "wood", x: 2, y: 32, approachHeight: 3, decor: "bench", variant: "l" },
  { material: "plaster", x: 35, y: 33, approachHeight: 5, decor: "trees", variant: "compact" },
] as const satisfies readonly CityHouse[];

const CITY_ROADS = [
  { x: 0, y: 14, width: 20, height: 3 },
  { x: 19, y: 12, width: 16, height: 3 },
  { x: 34, y: 10, width: 16, height: 3 },
  { x: 18, y: 14, width: 3, height: 16 },
  { x: 32, y: 12, width: 3, height: 20 },
  { x: 0, y: 27, width: 22, height: 3 },
  { x: 20, y: 29, width: 15, height: 3 },
  { x: 33, y: 27, width: 17, height: 3 },
  { x: 18, y: 37, width: 3, height: 11 },
  { x: 33, y: 31, width: 3, height: 17 },
  { x: 0, y: 47, width: CITY_SIZE, height: 2 },
] as const satisfies readonly RoadRect[];

export function createTownArchitectureCityMap(): GameMap {
  const map = createBlankCityMap();
  paintCityRoads(map);
  for (const house of CITY_HOUSES) {
    stampHouse(map, house);
    stampHouseDecor(map, house);
  }
  paintDoorApproaches(map);
  stampTownDetails(map);
  addTownArchitectureCityNpcs(map);
  return map;
}

function paintCityRoads(map: GameMap): void {
  paintTownPathNetwork(map, CITY_ROADS);
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
}

function stampHouse(map: GameMap, house: CityHouse): void {
  stampDbHouseVariant(map, {
    includeFence: false,
    material: house.material,
    origin: house,
    variant: house.variant,
  });
}

function stampHouseDecor(map: GameMap, house: CityHouse): void {
  switch (house.decor) {
    case "garden":
      stampConifer(map, { x: house.x + 1, y: house.y + 12 });
      stampUpperPattern(map, { x: house.x + 2, y: house.y + 13 }, [[FLOWER, -1, FLOWER], [-1, FLOWER, -1]]);
      return;
    case "market":
      stampUpperPattern(map, { x: house.x + 1, y: house.y + 13 }, [
        [MARKET_TOP_LEFT, MARKET_TOP_MID, MARKET_TOP_RIGHT],
        [MARKET_BOTTOM_LEFT, MARKET_BOTTOM_MID, MARKET_BOTTOM_RIGHT],
      ]);
      return;
    case "bench":
      stampUpperPattern(map, { x: house.x + 2, y: house.y + 13 }, [[BENCH_LEFT, BENCH_RIGHT], [FLOWER, -1]]);
      return;
    case "trees":
      stampConifer(map, { x: house.x + 1, y: house.y + 13 });
      stampUpperPattern(map, { x: house.x + 4, y: house.y + 14 }, [[FLOWER, FLOWER]]);
      return;
  }
}

function paintDoorApproaches(map: GameMap): void {
  paintTownPathNetwork(map, CITY_HOUSES.map(doorApproachRect));
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
}

function doorApproachRect(house: CityHouse): RoadRect {
  const door = doorBottomPoint(house);
  return { x: door.x, y: door.y + 1, width: 1, height: house.approachHeight };
}

function doorBottomPoint(house: CityHouse): TilePoint {
  const offset = dbHouseVariantDoorBottomOffset(house.variant);
  return {
    x: house.x + offset.x,
    y: house.y + offset.y,
  };
}

function createBlankCityMap(): GameMap {
  const tileCount = CITY_SIZE * CITY_SIZE;
  return {
    id: genId("map"),
    name: "50x50 DB template town city",
    width: CITY_SIZE,
    height: CITY_SIZE,
    tilesetId: COMBINED_TOWN_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(tileCount).fill(TOWN_GRASS),
    upperTiles: new Array<number>(tileCount).fill(TILE.EMPTY),
    events: [],
  };
}

function stampTownDetails(map: GameMap): void {
  stampLowerRect(map, { x: 23, y: 33 }, 3, 3, WATER);
  stampUpperPattern(map, { x: 12, y: 18 }, [[BENCH_LEFT, BENCH_RIGHT], [FLOWER, -1], [-1, FLOWER]]);
  stampUpperPattern(map, { x: 27, y: 17 }, [[BENCH_LEFT, BENCH_RIGHT], [-1, FLOWER], [FLOWER, -1]]);
  stampUpperPattern(map, { x: 41, y: 31 }, [[MARKET_TOP_LEFT, MARKET_TOP_MID, MARKET_TOP_RIGHT], [MARKET_BOTTOM_LEFT, MARKET_BOTTOM_MID, MARKET_BOTTOM_RIGHT]]);
  stampUpperPattern(map, { x: 24, y: 39 }, [[MARKET_TOP_LEFT, MARKET_TOP_MID, MARKET_TOP_RIGHT], [MARKET_BOTTOM_LEFT, MARKET_BOTTOM_MID, MARKET_BOTTOM_RIGHT]]);
  stampUpperPattern(map, { x: 4, y: 31 }, [[FLOWER, -1, FLOWER]]);
  stampUpperPattern(map, { x: 29, y: 36 }, [[FLOWER, FLOWER]]);
  stampUpperPattern(map, { x: 44, y: 43 }, [[FLOWER], [FLOWER]]);
  stampUpperPattern(map, { x: 6, y: 45 }, [[FLOWER, -1, FLOWER], [-1, BENCH_LEFT, BENCH_RIGHT], [FLOWER, -1, FLOWER]]);
  stampUpperPattern(map, { x: 22, y: 24 }, [[FLOWER, FLOWER], [FLOWER, FLOWER]]);
  for (const point of [
    { x: 16, y: 11 }, { x: 28, y: 11 }, { x: 15, y: 19 }, { x: 37, y: 14 },
    { x: 17, y: 34 }, { x: 28, y: 43 }, { x: 30, y: 36 }, { x: 49, y: 33 },
  ]) {
    stampConifer(map, point);
  }
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

function stampUpper(map: GameMap, point: TilePoint, tile: number): void {
  if (isInside(map, point) && !isTownPath(map, point)) map.upperTiles[point.y * map.width + point.x] = tile;
}

function stampConifer(map: GameMap, point: TilePoint): void {
  const bottom = { x: point.x, y: point.y + 1 };
  if (!isInside(map, point) || !isInside(map, bottom)) return;
  if (isTownPath(map, point) || isTownPath(map, bottom)) return;
  const topIndex = point.y * map.width + point.x;
  const bottomIndex = bottom.y * map.width + bottom.x;
  if (map.upperTiles[topIndex] !== TILE.EMPTY || map.upperTiles[bottomIndex] !== TILE.EMPTY) return;
  map.upperTiles[topIndex] = TREE;
  map.upperTiles[bottomIndex] = TREE_BOTTOM;
}

function stampLower(map: GameMap, point: TilePoint, tile: number): void {
  if (isInside(map, point) && !isTownPath(map, point)) map.lowerTiles[point.y * map.width + point.x] = tile;
}

function isInside(map: GameMap, point: TilePoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function isTownPath(map: GameMap, point: TilePoint): boolean {
  const tile = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
  return TOWN_PATH_TILES.has(tile);
}
