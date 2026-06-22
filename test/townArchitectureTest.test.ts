import { describe, expect, it } from "vitest";
import { createTownArchitectureTestMap, TILE } from "@/project/defaults";
import { describeChipsetTile, SAND_TILE } from "@/project/defaults/chipsetMapping";

describe("town architecture vision test map", () => {
  it("builds a 20x20 city test map with a real L-shaped house and a two-story house", () => {
    const map = createTownArchitectureTestMap();
    const at = (x: number, y: number): number => y * map.width + x;

    expect(map.name).toBe("20x20 도시 건축 테스트맵");
    expect(map.width).toBe(20);
    expect(map.height).toBe(20);
    expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");

    expect(map.upperTiles[at(2, 2)]).not.toBe(TILE.EMPTY);
    expect(map.upperTiles[at(8, 2)]).not.toBe(TILE.EMPTY);
    expect(map.lowerTiles[at(2, 11)]).not.toBe(SAND_TILE.BODY);
    expect(map.upperTiles[at(2, 11)]).toBe(375);
    expect(map.upperTiles[at(8, 11)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(1, 1)]).toBe(374);
    expect(map.upperTiles[at(2, 1)]).toBe(375);
    expect(map.upperTiles[at(3, 1)]).toBe(375);
    expect(map.upperTiles[at(10, 1)]).toBe(377);
    expect(map.upperTiles[at(1, 2)]).toBe(374);
    expect(map.upperTiles[at(10, 2)]).toBe(377);
    expect(map.lowerTiles[at(1, 4)]).toBe(102);
    expect(map.lowerTiles[at(7, 4)]).toBe(103);
    expect(map.lowerTiles[at(10, 4)]).toBe(104);
    expect(map.lowerTiles[at(1, 5)]).not.toBe(SAND_TILE.BODY);
    expect(map.lowerTiles[at(10, 8)]).toBe(164);
    expect(map.upperTiles[at(11, 6)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(1, 9)]).toBe(374);
    expect(map.upperTiles[at(7, 11)]).toBe(377);
    expect(map.lowerTiles[at(1, 12)]).toBe(102);
    expect(map.lowerTiles[at(7, 12)]).toBe(104);
    expect(map.lowerTiles[at(2, 13)]).not.toBe(SAND_TILE.BODY);
    expect(map.upperTiles[at(4, 15)]).toBe(116);
    expect(map.lowerTiles[at(4, 15)]).not.toBe(SAND_TILE.BODY);
    expect(map.upperTiles[at(4, 16)]).toBe(146);
    expect([SAND_TILE.BODY, SAND_TILE.EDGE_NORTH, SAND_TILE.EDGE_WEST, SAND_TILE.CORNER_NORTH_WEST]).toContain(map.lowerTiles[at(4, 16)]);
    expect([SAND_TILE.BODY, SAND_TILE.EDGE_NORTH, SAND_TILE.EDGE_SOUTH, SAND_TILE.EDGE_WEST, SAND_TILE.CORNER_NORTH_WEST]).toContain(
      map.lowerTiles[at(4, 17)]
    );

    expect(map.upperTiles[at(12, 1)]).toBe(374);
    expect(map.upperTiles[at(12, 4)]).toBe(374);
    expect(map.upperTiles[at(18, 4)]).toBe(377);
    expect(map.upperTiles[at(12, 5)]).toBe(404);
    expect(map.upperTiles[at(18, 5)]).toBe(405);
    expect(map.upperTiles[at(14, 8)]).toBe(87);
    expect(map.lowerTiles[at(14, 8)]).not.toBe(SAND_TILE.BODY);
    expect(map.upperTiles[at(16, 8)]).toBe(87);
    expect(map.upperTiles[at(13, 10)]).toBe(87);
    expect(map.upperTiles[at(17, 10)]).toBe(87);
    expect(map.lowerTiles[at(12, 12)]).toBe(75);
    expect(map.lowerTiles[at(18, 12)]).toBe(77);
    expect(map.upperTiles[at(15, 10)]).toBe(116);
    expect(map.upperTiles[at(15, 11)]).toBe(146);
    expect([SAND_TILE.BODY, SAND_TILE.EDGE_NORTH, SAND_TILE.EDGE_WEST, SAND_TILE.CORNER_NORTH_WEST]).toContain(
      map.lowerTiles[at(15, 12)]
    );

    expect([SAND_TILE.EDGE_NORTH, SAND_TILE.EDGE_SOUTH]).toContain(map.lowerTiles[at(10, 17)]);
    expect(map.upperTiles[at(10, 17)]).toBe(TILE.EMPTY);
    expect(describeChipsetTile(85).layer).toBe("upper");
    expect(describeChipsetTile(87).layer).toBe("upper");
  });
});
