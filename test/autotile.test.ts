import { describe, expect, it } from "vitest";
import {
  LAKE_AUTOTILE_TILE,
  lakeAutotileQuarterSources,
} from "@/project/defaults/lakeAutotile";

type TileGrid = readonly (readonly number[])[];

function mapFromRows(rows: TileGrid): { readonly width: number; readonly height: number; readonly lowerTiles: readonly number[] } {
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    lowerTiles: rows.flat(),
  };
}

describe("animated water autotile", () => {
  it("uses animated water body quarters when surrounded", () => {
    const water = LAKE_AUTOTILE_TILE.BODY;
    const map = mapFromRows([
      [water, water, water],
      [water, water, water],
      [water, water, water],
    ]);

    expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
    ]);
  });

  it("treats map bounds as land for water edges", () => {
    const water = LAKE_AUTOTILE_TILE.BODY;
    const map = mapFromRows([[water, water]]);

    expect(lakeAutotileQuarterSources(map, 0, 0).map((part) => part.tile)).toEqual([
      LAKE_AUTOTILE_TILE.OUTER_CORNER,
      LAKE_AUTOTILE_TILE.EDGE_NORTH,
      LAKE_AUTOTILE_TILE.OUTER_CORNER,
      LAKE_AUTOTILE_TILE.EDGE_SOUTH,
    ]);
  });
});
