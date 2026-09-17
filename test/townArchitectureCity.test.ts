import { describe, expect, it } from "vitest";
import { TILE } from "@/project/defaults";
import { createTownArchitectureCityMap } from "@/editor/content/townShowcaseMaps";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { TOWN_ARCHITECTURE_CITY_NPC_COUNT } from "@/project/defaults/townArchitectureCityNpcs";
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
const FENCE_TILES = new Set([378, 379, 380, 408, 410, 438]);
const WINDOW_TILES = new Set([85, 87]);

type HouseExpectation = {
  readonly x: number;
  readonly y: number;
};

const HOUSE_EXPECTATIONS = [
  { x: 1, y: 1 },
  { x: 19, y: 1 },
  { x: 36, y: 0 },
  { x: 1, y: 17 },
  { x: 19, y: 16 },
  { x: 34, y: 16 },
  { x: 2, y: 32 },
  { x: 35, y: 33 },
] as const satisfies readonly HouseExpectation[];

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

function houseShapeSignature(map: GameMap, origin: HouseExpectation): string {
  const points: string[] = [];
  for (let y = origin.y; y < origin.y + 16; y += 1) {
    for (let x = origin.x; x < origin.x + 18; x += 1) {
      const index = at(map, x, y);
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      if (HOUSE_SHAPE_TILES.has(lower) || HOUSE_SHAPE_TILES.has(upper)) points.push(`${x - origin.x},${y - origin.y}:${lower}/${upper}`);
    }
  }
  return points.join("|");
}

function expectHouseShapeOffRoad(map: GameMap, origin: HouseExpectation, townPathTiles: ReadonlySet<number>): void {
  for (let y = origin.y; y < origin.y + 16; y += 1) {
    for (let x = origin.x; x < origin.x + 18; x += 1) {
      const index = at(map, x, y);
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      if (HOUSE_SHAPE_TILES.has(lower) || HOUSE_SHAPE_TILES.has(upper)) expect(townPathTiles.has(lower)).toBe(false);
    }
  }
}

function expectRoadsClear(map: GameMap, townPathTiles: ReadonlySet<number>): void {
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    const lower = map.lowerTiles[index] ?? TILE.EMPTY;
    if (townPathTiles.has(lower)) expect(map.upperTiles[index]).toBe(TILE.EMPTY);
  }
}

describe("town architecture city map", () => {
  it("builds a 50x50 road-first city from the canonical DB house template", () => {
    const map = createTownArchitectureCityMap();
    const townPathTiles = new Set<number>(Object.values(SAND_TILE));

    expect(map.name).toBe("50x50 DB template town city");
    expect(map.width).toBe(50);
    expect(map.height).toBe(50);
    expect(map.tilesetId).toBe("easyrpg_chipset_combined_town");
    expect(countLowerDoorPairs(map)).toBe(8);
    expect(map.upperTiles.filter((tile) => WINDOW_TILES.has(tile)).length).toBeGreaterThanOrEqual(16);
    expect(map.upperTiles.some((tile) => FENCE_TILES.has(tile))).toBe(false);
    expect(map.upperTiles).not.toContain(OLD_LOCAL_DOOR_TOP);
    expect(map.upperTiles).not.toContain(OLD_LOCAL_DOOR_BOTTOM);
    expect(map.upperTiles).not.toContain(OLD_LOCAL_ROOF_CAP_LEFT);
    expectRoadsClear(map, townPathTiles);

    for (const house of HOUSE_EXPECTATIONS) {
      expect(houseShapeSignature(map, house).length).toBeGreaterThan(0);
      expectHouseShapeOffRoad(map, house, townPathTiles);
    }
    expect(new Set(HOUSE_EXPECTATIONS.map((house) => houseShapeSignature(map, house))).size).toBeGreaterThanOrEqual(3);

    expect(townPathTiles.has(map.lowerTiles[at(map, 18, 15)] ?? TILE.EMPTY)).toBe(true);
    expect(townPathTiles.has(map.lowerTiles[at(map, 34, 11)] ?? TILE.EMPTY)).toBe(true);
    expect(townPathTiles.has(map.lowerTiles[at(map, 21, 30)] ?? TILE.EMPTY)).toBe(true);
    expect(townPathTiles.has(map.lowerTiles[at(map, 34, 31)] ?? TILE.EMPTY)).toBe(true);
    expect(townPathTiles.has(map.lowerTiles[at(map, 10, 47)] ?? TILE.EMPTY)).toBe(true);

    const cityNpcs = map.events.filter((event) => event.id.startsWith("event_city_walker_"));
    expect(cityNpcs).toHaveLength(TOWN_ARCHITECTURE_CITY_NPC_COUNT);
    for (const npc of cityNpcs) {
      const page = npc.pages?.[0];
      if (!page) throw new Error(`missing event page for ${npc.id}`);
      expect(page.movement).toEqual({ type: "random", speed: 3, frequency: 4 });
      expect(page.trigger).toEqual({ kind: "action" });
      expect(page.priority).toBe("same");
      expect(page.overlapForbidden).toBe(true);
      expect(page.graphic.sprite?.type).toBe("bundled");
      expect(page.graphic.sprite?.id).toContain("tex_easyrpg_charset_");
      expect(page.commands.some((command) => command.kind === "text" && Boolean(command.body))).toBe(true);
    }
  });
});
