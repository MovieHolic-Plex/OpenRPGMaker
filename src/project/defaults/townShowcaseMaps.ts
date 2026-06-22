import { genId } from "@/util/id";
import type { GameMap } from "../types";
import { DEFAULT_TILE_SIZE, TILE } from "./constants";
import {
  stampTownCityPlot,
  stampTownHouseStyle,
  stampTownMarket,
  townHouseShowcaseName,
  type TownCityPlotStyle,
  type TownHouseShowcaseStyle,
} from "./townHousePatterns";
import { clearUpperTilesOnTownPath, paintTownPathNetwork, shapeAllTownPaths } from "./townPathAutotile";
export { createTownArchitectureCityMap } from "./townArchitectureCityMap";
export { createTownArchitectureTestMap } from "./townArchitectureTestMap";
export {
  createDbExtractedHouseTemplateMap,
  createSmallHouseVariantMap,
  createSmallHouseVariantMaps,
  type SmallHouseVariantIndex,
} from "./dbExtractedHouseTemplate";

const TOWN_HOUSE_SHOWCASE_SIZE = 16;
const TOWN_CITY_SIZE = 100;
const COMBINED_TOWN_TILESET_ID = "easyrpg_chipset_combined_town";
const TOWN_GRASS = 270;

export type { TownHouseShowcaseStyle };

export function createTownHouseShowcaseMap(style: TownHouseShowcaseStyle = "l"): GameMap {
  const map = createTownBlankMap(townHouseShowcaseName(style), TOWN_HOUSE_SHOWCASE_SIZE);
  stampTownHouseStyle(map, style, 0, 0);
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
  return map;
}

export function createTownCityShowcaseMap(): GameMap {
  const map = createTownBlankMap("EasyRPG 100x100 도시 쇼케이스", TOWN_CITY_SIZE);
  paintTownPathNetwork(map, [
    { x: 0, y: 18, width: TOWN_CITY_SIZE, height: 3 },
    { x: 0, y: 40, width: TOWN_CITY_SIZE, height: 3 },
    { x: 0, y: 62, width: TOWN_CITY_SIZE, height: 3 },
    { x: 0, y: 84, width: TOWN_CITY_SIZE, height: 3 },
    { x: 18, y: 0, width: 3, height: TOWN_CITY_SIZE },
    { x: 40, y: 0, width: 3, height: TOWN_CITY_SIZE },
    { x: 62, y: 0, width: 3, height: TOWN_CITY_SIZE },
    { x: 84, y: 0, width: 3, height: TOWN_CITY_SIZE },
    { x: 51, y: 40, width: 3, height: 24 },
    { x: 40, y: 51, width: 24, height: 3 },
    { x: 48, y: 48, width: 8, height: 8 },
  ]);
  for (const plot of TOWN_CITY_PLOTS) stampTownCityPlot(map, plot.style, plot.x, plot.y);
  shapeAllTownPaths(map);
  clearUpperTilesOnTownPath(map);
  stampTownMarket(map, 47, 47);
  stampTownMarket(map, 51, 55);
  return map;
}

const TOWN_CITY_PLOTS = [
  { style: "l", x: 1, y: 1 },
  { style: "courtyard", x: 22, y: 1 },
  { style: "multi", x: 44, y: 1 },
  { style: "road", x: 66, y: 1 },
  { style: "plaster", x: 1, y: 22 },
  { style: "l", x: 22, y: 22 },
  { style: "courtyard", x: 66, y: 22 },
  { style: "multi", x: 1, y: 44 },
  { style: "l", x: 22, y: 44 },
  { style: "stone", x: 66, y: 44 },
  { style: "courtyard", x: 1, y: 66 },
  { style: "multi", x: 22, y: 66 },
  { style: "l", x: 44, y: 66 },
  { style: "plaster", x: 66, y: 66 },
] as const satisfies readonly { readonly style: TownCityPlotStyle; readonly x: number; readonly y: number }[];

function createTownBlankMap(name: string, size: number): GameMap {
  const n = size * size;
  return {
    id: genId("map"),
    name,
    width: size,
    height: size,
    tilesetId: COMBINED_TOWN_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(n).fill(TOWN_GRASS),
    upperTiles: new Array<number>(n).fill(TILE.EMPTY),
    events: [],
  };
}
