import { describe, expect, it } from "vitest";
import {
  LAKE_AUTOTILE_TILE,
  lakeAutotileQuarterSources,
} from "@/project/defaults/lakeAutotile";

const WATER = LAKE_AUTOTILE_TILE.BODY;
const LAND = 240;

type TileGrid = readonly (readonly number[])[];

function mapFromRows(rows: TileGrid): { readonly width: number; readonly height: number; readonly lowerTiles: readonly number[] } {
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    lowerTiles: rows.flat(),
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
