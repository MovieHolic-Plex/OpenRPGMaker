import { describe, expect, it } from "vitest";
import {
  LAKE_AUTOTILE_TILE,
  lakeAutotileQuarterSources,
} from "@/project/defaults/lakeAutotile";
import { TILE } from "@/project/defaults";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { roadAutotileTileForCell } from "@/project/defaults/roadAutotile";
import type { GameMap } from "@/project/types/project";

const WATER = LAKE_AUTOTILE_TILE.BODY;
const LAND = 240;

type TileGrid = readonly (readonly number[])[];

function mapFromRows(rows: TileGrid): GameMap {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  return {
    id: "test_map",
    name: "Test Map",
    width,
    height,
    tilesetId: "default",
    tileSize: 32,
    lowerTiles: rows.flat(),
    upperTiles: Array.from({ length: width * height }, () => 0),
    events: [],
  };
}

describe("lakeAutotileQuarterSources", () => {
  it("uses animated water body quarters when the water tile is surrounded", () => {
    const map = mapFromRows([
      [WATER, WATER, WATER],
      [WATER, WATER, WATER],
      [WATER, WATER, WATER],
    ]);

    expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
    ]);
  });

  it("uses outer corner quarter sources when two adjacent sides are land", () => {
    const map = mapFromRows([
      [LAND, LAND, LAND],
      [LAND, WATER, WATER],
      [LAND, WATER, WATER],
    ]);

    expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
      LAKE_AUTOTILE_TILE.OUTER_CORNER,
      LAKE_AUTOTILE_TILE.EDGE_NORTH,
      LAKE_AUTOTILE_TILE.EDGE_WEST,
      LAKE_AUTOTILE_TILE.BODY,
    ]);
  });

  it("uses inner corner quarter sources when the diagonal alone is land", () => {
    const map = mapFromRows([
      [LAND, WATER, WATER],
      [WATER, WATER, WATER],
      [WATER, WATER, WATER],
    ]);

    expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
      LAKE_AUTOTILE_TILE.INNER_CORNER,
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
    ]);
  });
});

describe("roadAutotileTileForCell", () => {
  it("treats tile 360 as the editable road center and resolves it to shaped road pieces", () => {
    const map = mapFromRows([
      [LAND, LAND, LAND],
      [LAND, TILE.PATH, TILE.PATH],
      [LAND, TILE.PATH, TILE.PATH],
    ]);

    expect(roadAutotileTileForCell(map, { x: 1, y: 1 })).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
    expect(roadAutotileTileForCell(map, { x: 2, y: 2 })).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
  });
});
