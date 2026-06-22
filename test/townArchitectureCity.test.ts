import { describe, expect, it } from "vitest";
import { createTownArchitectureCityMap, TILE } from "@/project/defaults";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";

describe("town architecture city map", () => {
  it("builds a 50x50 city from the validated house grammar", () => {
    const map = createTownArchitectureCityMap();
    const at = (x: number, y: number): number => y * map.width + x;
    const townPathTiles = [
      SAND_TILE.BODY,
      SAND_TILE.EDGE_NORTH,
      SAND_TILE.EDGE_SOUTH,
      SAND_TILE.EDGE_WEST,
      SAND_TILE.EDGE_EAST,
      SAND_TILE.CORNER_NORTH_WEST,
      SAND_TILE.CORNER_NORTH_EAST,
      SAND_TILE.CORNER_SOUTH_WEST,
      SAND_TILE.CORNER_SOUTH_EAST,
    ];

    expect(map.name).toBe("50x50 검증 기반 도시");
    expect(map.width).toBe(50);
    expect(map.height).toBe(50);
    expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");

    expect(map.upperTiles[at(1, 3)]).toBe(374);
    expect(map.upperTiles[at(7, 3)]).toBe(377);
    expect(map.lowerTiles[at(1, 8)]).toBe(45);
    expect(map.upperTiles[at(4, 12)]).toBe(116);
    expect(map.upperTiles[at(4, 13)]).toBe(146);
    expect(townPathTiles).toContain(map.lowerTiles[at(4, 13)]);

    expect(map.upperTiles[at(14, 4)]).toBe(374);
    expect(map.upperTiles[at(22, 4)]).toBe(377);
    expect(map.upperTiles[at(18, 12)]).toBe(116);
    expect(map.upperTiles[at(18, 13)]).toBe(146);
    expect(townPathTiles).toContain(map.lowerTiles[at(18, 13)]);
    expect(map.upperTiles[at(31, 5)]).toBe(374);
    expect(map.lowerTiles[at(31, 8)]).toBe(102);
    expect(map.upperTiles[at(34, 12)]).toBe(116);
    expect(map.upperTiles[at(34, 13)]).toBe(146);
    expect(townPathTiles).toContain(map.lowerTiles[at(34, 13)]);
    expect(map.upperTiles[at(42, 3)]).toBe(374);
    expect(map.upperTiles[at(45, 12)]).toBe(116);
    expect(map.upperTiles[at(45, 13)]).toBe(146);
    expect(townPathTiles).toContain(map.lowerTiles[at(45, 13)]);

    expect(map.upperTiles[at(1, 26)]).toBe(374);
    expect(map.lowerTiles[at(1, 29)]).toBe(102);
    expect(map.lowerTiles[at(1, 30)]).toBe(132);
    expect(map.upperTiles[at(4, 40)]).toBe(116);
    expect(map.upperTiles[at(4, 41)]).toBe(146);
    expect(townPathTiles).toContain(map.lowerTiles[at(4, 41)]);
    expect(map.upperTiles[at(14, 28)]).toBe(374);
    expect(map.upperTiles[at(18, 36)]).toBe(116);
    expect(map.upperTiles[at(18, 37)]).toBe(146);
    expect(townPathTiles).toContain(map.lowerTiles[at(18, 37)]);

    expect(townPathTiles).toContain(map.lowerTiles[at(24, 24)]);
    expect(townPathTiles).toContain(map.lowerTiles[at(10, 40)]);
    expect(map.upperTiles[at(10, 40)]).toBe(TILE.EMPTY);
    expect(map.lowerTiles[at(16, 43)]).toBe(120);
    expect(map.upperTiles[at(20, 21)]).toBe(327);
    expect(map.upperTiles[at(43, 33)]).toBe(260);
  });
});
