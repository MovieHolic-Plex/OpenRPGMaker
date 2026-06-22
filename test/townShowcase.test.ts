import { describe, expect, it } from "vitest";
import { createTownCityShowcaseMap, createTownHouseShowcaseMap, TILE, type TownHouseShowcaseStyle } from "@/project/defaults";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";

describe("town showcase maps", () => {
  it("builds focused 16x16 house variants with shaped paths", () => {
    const styles: readonly TownHouseShowcaseStyle[] = ["l", "courtyard", "multi", "road"];
    const townPathTiles = new Set<number>(Object.values(SAND_TILE));
    for (const style of styles) {
      const map = createTownHouseShowcaseMap(style);

      expect(map.width).toBe(16);
      expect(map.height).toBe(16);
      expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");
      expect(map.upperTiles).toContain(116);
      expect(map.upperTiles).toContain(146);
      expect(map.lowerTiles.some((tile) => townPathTiles.has(tile))).toBe(true);
    }

    const courtyard = createTownHouseShowcaseMap("courtyard");
    expect(courtyard.lowerTiles[8 * courtyard.width + 8]).toBe(270);
    expect(courtyard.upperTiles[8 * courtyard.width + 8]).toBe(TILE.EMPTY);

    const multi = createTownHouseShowcaseMap("multi");
    expect(multi.upperTiles[6 * multi.width + 8]).toBe(116);
    expect(multi.upperTiles[7 * multi.width + 8]).toBe(146);

    const road = createTownHouseShowcaseMap("road");
    expect(road.lowerTiles[8 * road.width + 8]).toBe(SAND_TILE.BODY);
    expect(road.upperTiles[12 * road.width + 8]).not.toBe(TILE.EMPTY);
  });

  it("builds a 100x100 city with combined tileset roads and houses", () => {
    const map = createTownCityShowcaseMap();
    const townPathTiles = new Set<number>(Object.values(SAND_TILE));

    expect(map.width).toBe(100);
    expect(map.height).toBe(100);
    expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");
    expect(map.lowerTiles[18 * map.width + 10]).toBe(SAND_TILE.EDGE_NORTH);
    expect(map.lowerTiles[41 * map.width + 50]).toBe(SAND_TILE.BODY);
    expect(map.lowerTiles[10 * map.width + 18]).toBe(SAND_TILE.EDGE_WEST);
    expect(map.upperTiles[18 * map.width + 10]).toBe(TILE.EMPTY);
    expect(map.upperTiles[41 * map.width + 50]).toBe(TILE.EMPTY);
    expect(map.upperTiles.filter((tile) => tile === 116).length).toBeGreaterThan(8);
    expect(map.lowerTiles.filter((tile) => townPathTiles.has(tile)).length).toBeGreaterThan(1200);
  });
});
