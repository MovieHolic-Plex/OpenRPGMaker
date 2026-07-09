import { describe, expect, it } from "vitest";
import {
  LAKE_AUTOTILE_TILE,
  lakeAutotileQuarterSources,
  sourceQuarterForLakeChip,
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

  it("uses INNER_CORNER(90) only when orthogonal are water and diagonal is land", () => {
    const map = mapFromRows([
      [LAND, WATER, WATER],
      [WATER, WATER, WATER],
      [WATER, WATER, WATER],
    ]);

    expect(lakeAutotileQuarterSources(map, 1, 1).map((part) => part.tile)).toEqual([
      LAKE_AUTOTILE_TILE.INNER_CORNER, // 90 — 오목 모서리만
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
      LAKE_AUTOTILE_TILE.BODY,
    ]);
    expect(LAKE_AUTOTILE_TILE.INNER_CORNER).toBe(90);
  });

  it("straight south edge uses 60 strip NOT 90 — (24,30) 타입: 아래만 땅", () => {
    // N/W/E 물, S 땅 → 남쪽 직선 가장자리. inner corner 아님.
    const map = mapFromRows([
      [WATER, WATER, WATER],
      [WATER, WATER, WATER],
      [LAND, LAND, LAND],
    ]);
    const parts = lakeAutotileQuarterSources(map, 1, 1);
    const se = parts.find((part) => part.quarter === "se");
    const sw = parts.find((part) => part.quarter === "sw");
    const ne = parts.find((part) => part.quarter === "ne");
    const nw = parts.find((part) => part.quarter === "nw");

    // 아래 쿼터 = 가로 가장자리 60 (90 금지)
    expect(se?.tile).toBe(60);
    expect(sw?.tile).toBe(60);
    expect(se?.tile).not.toBe(90);
    expect(se?.sourceQuarter).toBe("se"); // 60 하단
    expect(sw?.sourceQuarter).toBe("sw");

    // 위 쿼터 = 사방이 물이므로 BODY (북쪽도 물)
    expect(ne?.tile).toBe(LAKE_AUTOTILE_TILE.BODY);
    expect(nw?.tile).toBe(LAKE_AUTOTILE_TILE.BODY);
  });

  it("90 is never selected for straight edges (N/S/E/W)", () => {
    const southEdge = mapFromRows([
      [WATER, WATER, WATER],
      [WATER, WATER, WATER],
      [LAND, LAND, LAND],
    ]);
    const northEdge = mapFromRows([
      [LAND, LAND, LAND],
      [WATER, WATER, WATER],
      [WATER, WATER, WATER],
    ]);
    const eastEdge = mapFromRows([
      [WATER, WATER, LAND],
      [WATER, WATER, LAND],
      [WATER, WATER, LAND],
    ]);
    const westEdge = mapFromRows([
      [LAND, WATER, WATER],
      [LAND, WATER, WATER],
      [LAND, WATER, WATER],
    ]);
    for (const map of [southEdge, northEdge, eastEdge, westEdge]) {
      const tiles = lakeAutotileQuarterSources(map, 1, 1).map((p) => p.tile);
      expect(tiles.includes(90)).toBe(false);
    }
  });

  it("east straight edge (30,25 type): tile 30 with matching side source, not 90", () => {
    const map = mapFromRows([
      [WATER, WATER, LAND],
      [WATER, WATER, LAND],
      [WATER, WATER, LAND],
    ]);
    const parts = lakeAutotileQuarterSources(map, 1, 1);
    const ne = parts.find((p) => p.quarter === "ne");
    const se = parts.find((p) => p.quarter === "se");
    expect(ne?.tile).toBe(30);
    expect(se?.tile).toBe(30);
    expect(ne?.sourceQuarter).toBe("ne");
    expect(se?.sourceQuarter).toBe("se");
  });
});

describe("sourceQuarterForLakeChip", () => {
  it("INNER 90: dest se uses se source (not confused with south edge)", () => {
    expect(sourceQuarterForLakeChip(90, "se")).toBe("se");
    expect(sourceQuarterForLakeChip(91, "se")).toBe("se");
    expect(sourceQuarterForLakeChip(92, "nw")).toBe("nw");
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
