import { describe, expect, it } from "vitest";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import type { TilePoint } from "@/project/defaults/dbExtractedHouseTemplate";
import { SMALL_HOUSE_01_TERRAIN_TEMPLATE } from "@/project/defaults/smallHouse01TerrainTemplate";
import { stampTerrainTemplateHouse } from "@/project/defaults/terrainTemplateHouseStamp";
import type { GameMap } from "@/project/types";
import { genId } from "@/util/id";

const TOWN_GRASS = 270;
const FRAMED_DOOR_TOP = 116;
const FRAMED_DOOR_BOTTOM = 146;
const SAND_TILES = new Set<number>(Object.values(SAND_TILE));

function createBlankTemplateMap(): GameMap {
  const width = 20;
  const height = 20;
  return {
    events: [],
    height,
    id: genId("map"),
    lowerTiles: new Array<number>(width * height).fill(TOWN_GRASS),
    name: "template api test",
    tileSize: 16,
    tilesetId: DEFAULT_TILESET_ID,
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    width,
  };
}

function at(map: GameMap, point: TilePoint): number {
  return point.y * map.width + point.x;
}

describe("terrain template house stamp", () => {
  it("executes the small_house_01 buildPlan as a real house stamp", () => {
    const map = createBlankTemplateMap();

    stampTerrainTemplateHouse(map, {
      buildPlan: SMALL_HOUSE_01_TERRAIN_TEMPLATE.buildPlan,
      includeFence: false,
      material: "wood",
      origin: { x: 2, y: 1 },
      paintRoads: true,
    });

    expect(map.upperTiles[at(map, { x: 9, y: 5 })]).toBe(354);
    expect(map.upperTiles[at(map, { x: 19, y: 5 })]).toBe(355);
    expect(map.lowerTiles[at(map, { x: 9, y: 9 })]).toBe(102);
    expect(map.lowerTiles[at(map, { x: 19, y: 9 })]).toBe(104);
    expect(map.lowerTiles[at(map, { x: 15, y: 10 })]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, { x: 15, y: 11 })]).toBe(FRAMED_DOOR_BOTTOM);
    expect(map.upperTiles[at(map, { x: 12, y: 10 })]).toBe(85);
    expect(SAND_TILES.has(map.lowerTiles[at(map, { x: 15, y: 12 })] ?? TILE.EMPTY)).toBe(true);
    expect(map.upperTiles[at(map, { x: 15, y: 12 })]).toBe(TILE.EMPTY);
  });
});
