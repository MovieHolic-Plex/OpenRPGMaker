import { describe, expect, it } from "vitest";
import { createTownCityShowcaseMap, createTownHouseShowcaseMap, TILE, type TownHouseShowcaseStyle } from "@/project/defaults";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import type { GameMap } from "@/project/types";

const DB_DOOR_TOP = 329;
const DB_DOOR_BOTTOM = 359;
const OLD_LOCAL_DOOR_TOP = 116;
const OLD_LOCAL_DOOR_BOTTOM = 146;
const OLD_LOCAL_ROOF_CAP_LEFT = 374;
const HOUSE_SHAPE_TILES = new Set([
  12, 13, 14, 15, 16, 17, 42, 43, 44, 45, 46, 47, 72, 73, 74, 75, 76, 77,
  85, 87, 102, 103, 104, 132, 133, 134, 162, 163, 164, 329, 354, 355, 359,
  375, 376, 377, 384, 385, 404, 405,
]);
const WINDOW_TILES = new Set([85, 87]);

type TemplateExpectation = {
  readonly style: TownHouseShowcaseStyle;
};

const TEMPLATE_EXPECTATIONS = [
  { style: "l" },
  { style: "courtyard" },
  { style: "multi" },
  { style: "road" },
] as const satisfies readonly TemplateExpectation[];

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function countLowerDoorPairs(map: GameMap): number {
  let count = 0;
  for (let index = 0; index < map.lowerTiles.length - map.width; index += 1) {
    if (map.lowerTiles[index] === DB_DOOR_TOP && map.lowerTiles[index + map.width] === DB_DOOR_BOTTOM) count += 1;
  }
  return count;
}

function countUpperWindows(map: GameMap): number {
  return map.upperTiles.filter((tile) => WINDOW_TILES.has(tile)).length;
}

function countUpperTile(map: GameMap, tile: number): number {
  return map.upperTiles.filter((candidate) => candidate === tile).length;
}

function countTownPathTiles(map: GameMap): number {
  const townPathTiles = new Set<number>(Object.values(SAND_TILE));
  return map.lowerTiles.filter((tile) => townPathTiles.has(tile)).length;
}

function houseShapeSignature(map: GameMap): string {
  const points: string[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = at(map, x, y);
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      if (HOUSE_SHAPE_TILES.has(lower) || HOUSE_SHAPE_TILES.has(upper)) points.push(`${x},${y}:${lower}/${upper}`);
    }
  }
  return points.join("|");
}

describe("town showcase maps", () => {
  it("builds focused 16x16 house variants from the DB template with shaped paths", () => {
    const townPathTiles = new Set<number>(Object.values(SAND_TILE));

    for (const expected of TEMPLATE_EXPECTATIONS) {
      const map = createTownHouseShowcaseMap(expected.style);

      expect(map.width).toBe(16);
      expect(map.height).toBe(16);
      expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");
      expect(countLowerDoorPairs(map)).toBe(1);
      expect(countUpperWindows(map)).toBeGreaterThan(0);
      expect(map.lowerTiles.some((tile) => townPathTiles.has(tile))).toBe(true);
      expect(map.upperTiles).not.toContain(OLD_LOCAL_DOOR_TOP);
      expect(map.upperTiles).not.toContain(OLD_LOCAL_DOOR_BOTTOM);
      expect(map.upperTiles).not.toContain(OLD_LOCAL_ROOF_CAP_LEFT);
    }

    const road = createTownHouseShowcaseMap("road");
    expect(townPathTiles.has(road.lowerTiles[at(road, 8, 14)] ?? TILE.EMPTY)).toBe(true);
    expect(road.upperTiles[at(road, 8, 14)]).toBe(TILE.EMPTY);

    const styleSignatures = TEMPLATE_EXPECTATIONS.map((expected) => {
      const map = createTownHouseShowcaseMap(expected.style);
      return [
        map.lowerTiles[at(map, 9, 6)] ?? TILE.EMPTY,
        countUpperTile(map, 260),
        countUpperTile(map, 288),
        countUpperTile(map, 411),
        countUpperTile(map, 327),
        countTownPathTiles(map),
      ].join(":");
    });
    expect(new Set(styleSignatures).size).toBe(TEMPLATE_EXPECTATIONS.length);
    expect(new Set(TEMPLATE_EXPECTATIONS.map((expected) => houseShapeSignature(createTownHouseShowcaseMap(expected.style)))).size).toBe(
      TEMPLATE_EXPECTATIONS.length
    );
  });

  it("builds a 100x100 city with DB-template-backed plots and combined tileset roads", () => {
    const map = createTownCityShowcaseMap();
    const townPathTiles = new Set<number>(Object.values(SAND_TILE));

    expect(map.width).toBe(100);
    expect(map.height).toBe(100);
    expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");
    expect(map.lowerTiles[at(map, 10, 18)]).toBe(SAND_TILE.EDGE_NORTH);
    expect(map.lowerTiles[at(map, 50, 41)]).toBe(SAND_TILE.BODY);
    expect(map.lowerTiles[at(map, 18, 10)]).toBe(SAND_TILE.EDGE_WEST);
    expect(map.upperTiles[at(map, 10, 18)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(map, 50, 41)]).toBe(TILE.EMPTY);
    expect(countLowerDoorPairs(map)).toBeGreaterThan(8);
    expect(countUpperWindows(map)).toBeGreaterThan(20);
    expect(map.upperTiles.filter((tile) => tile === OLD_LOCAL_DOOR_TOP).length).toBe(0);
    expect(map.upperTiles.filter((tile) => tile === OLD_LOCAL_DOOR_BOTTOM).length).toBe(0);
    expect(map.upperTiles).not.toContain(OLD_LOCAL_ROOF_CAP_LEFT);
    expect(map.lowerTiles.filter((tile) => townPathTiles.has(tile)).length).toBeGreaterThan(1200);
  });
});
