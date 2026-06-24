import { describe, expect, it } from "vitest";
import {
  createLogCabinShowcaseMap,
  createStarterMap,
  TILE,
} from "@/project/defaults";
import { DIRT_ROAD_TILE, dirtLikeTiles } from "@/project/defaults/chipsetMapping";

type LayerPatternSubject = {
  readonly tiles: readonly number[];
  readonly mapWidth: number;
  readonly origin: { readonly x: number; readonly y: number };
};

describe("starter map chipset showcase", () => {
  it("builds a compact default 마을 with three small houses and visible roads", () => {
    const map = createStarterMap();
    const smallHouse = [
      [374, 375, 374, 375, 374],
      [404, 405, 404, 405, 404],
      [102, 103, 103, 103, 104],
      [132, 133, 329, 133, 134],
      [162, 163, 359, 163, 164],
    ];

    expect(map.width).toBe(30);
    expect(map.height).toBe(30);
    expectHousePattern(map, { x: 5, y: 5 }, smallHouse);
    expectHousePattern(map, { x: 19, y: 5 }, smallHouse);
    expectHousePattern(map, { x: 5, y: 17 }, smallHouse);
    expect(new Set(dirtLikeTiles()).has(map.lowerTiles[10 * map.width + 8] ?? TILE.EMPTY)).toBe(true);
    expect(new Set(dirtLikeTiles()).has(map.lowerTiles[22 * map.width + 7] ?? TILE.EMPTY)).toBe(true);
    expectUpperLayerEmptyOnRoad(map);
  });

  it("builds a focused 32x32 log cabin showcase map with three cabins", () => {
    const map = createLogCabinShowcaseMap();
    const diagonalHouseOrigin = { x: 4, y: 1 };
    const smallCabinOrigin = { x: 20, y: 4 };
    const porchCabinOrigin = { x: 10, y: 19 };
    const diagonalHouseLower = [
      [-1, -1, -1, -1, 374, 375, 374, 375, 374, -1, -1, -1, -1],
      [-1, -1, -1, 374, 375, 374, 375, 374, 375, 374, -1, -1, -1],
      [-1, -1, 374, 375, 374, 375, 374, 375, 374, 375, 374, -1, -1],
      [-1, 374, 375, 374, 375, 374, 375, 374, 375, 374, 375, 374, -1],
      [374, 375, 374, 375, 374, 375, 374, 375, 374, 375, 374, 375, 374],
      [404, 405, 404, 405, 404, 405, 404, 405, 404, 405, 404, 405, 404],
    ];
    const diagonalHouseUpper = [
      [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      [-1, -1, 404, 405, 404, 405, 404, 405, 404, 405, 404, -1, -1],
      [-1, -1, 15, 16, 16, 16, 16, 16, 16, 16, 17, -1, -1],
      [-1, -1, 45, 46, 46, 46, 329, 46, 46, 46, 47, -1, -1],
      [-1, -1, 75, 76, 76, 76, 359, 76, 76, 76, 77, -1, -1],
    ];
    const smallCabin = [
      [374, 375, 374, 375, 374],
      [404, 405, 404, 405, 404],
      [102, 103, 103, 103, 104],
      [132, 133, 329, 133, 134],
      [162, 163, 359, 163, 164],
    ];
    const porchCabin = [
      [374, 375, 374, 375, 374, 375, 374],
      [404, 405, 404, 405, 404, 405, 404],
      [102, 103, 103, 103, 103, 103, 104],
      [132, 133, 133, 329, 133, 133, 134],
      [162, 163, 163, 359, 163, 163, 164],
      [-1, 438, 379, 379, 379, 410, -1],
      [-1, 408, -1, 327, 328, 408, -1],
    ];

    expect(map.width).toBe(32);
    expect(map.height).toBe(32);
    expectLayerPattern({ tiles: map.lowerTiles, mapWidth: map.width, origin: diagonalHouseOrigin }, diagonalHouseLower);
    expectLayerPattern({ tiles: map.upperTiles, mapWidth: map.width, origin: diagonalHouseOrigin }, diagonalHouseUpper);
    expectHousePattern(map, smallCabinOrigin, smallCabin);
    expectHousePattern(map, porchCabinOrigin, porchCabin);
    expect(map.lowerTiles[10 * map.width + 2]).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
    expect(map.lowerTiles[11 * map.width + 15]).toBe(DIRT_ROAD_TILE.BODY);
    expect(map.lowerTiles[18 * map.width + 14]).toBe(DIRT_ROAD_TILE.EDGE_SOUTH);
    expect(map.lowerTiles[20 * map.width + 14]).toBe(404);
    expect(map.lowerTiles[24 * map.width + 14]).toBe(379);
    expect(map.lowerTiles[26 * map.width + 14]).toBe(DIRT_ROAD_TILE.EDGE_NORTH);
    expect(map.lowerTiles[16 * map.width + 21]).toBe(DIRT_ROAD_TILE.EDGE_SOUTH);
    const expectedDecorations = [
      [2, 13, 378],
      [3, 13, 379],
      [6, 13, 439],
      [24, 13, 409],
      [25, 13, 379],
      [28, 13, 380],
      [2, 14, 408],
      [2, 15, 408],
      [2, 16, 438],
      [28, 14, 408],
      [28, 15, 408],
      [28, 16, 410],
      [5, 27, 327],
      [6, 27, 328],
      [23, 25, 327],
      [24, 25, 328],
    ] as const;
    for (const [x, y, tile] of expectedDecorations) {
      expect(map.upperTiles[y * map.width + x]).toBe(tile);
    }
    expect(map.upperTiles[13 * map.width + 14]).toBe(TILE.EMPTY);
    expect(map.upperTiles[18 * map.width + 14]).toBe(TILE.EMPTY);
    expect(map.upperTiles[25 * map.width + 10]).toBe(TILE.EMPTY);
    expect(map.upperTiles[14 * map.width + 18]).toBe(TILE.EMPTY);
    expect(map.upperTiles[15 * map.width + 7]).toBe(TILE.EMPTY);
    expect(map.upperTiles[18 * map.width + 26]).toBe(TILE.EMPTY);
    expectUpperLayerEmptyOnRoad(map);
  });

});

function expectHousePattern(
  map: ReturnType<typeof createStarterMap>,
  origin: { readonly x: number; readonly y: number },
  expected: readonly (readonly number[])[]
): void {
  for (let y = 0; y < expected.length; y += 1) {
    const row = expected[y];
    expect(row).toBeDefined();
    for (let x = 0; row && x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== -1) expect(map.lowerTiles[(origin.y + y) * map.width + origin.x + x]).toBe(tile);
    }
  }
}

function expectLayerPattern(
  subject: LayerPatternSubject,
  expected: readonly (readonly number[])[]
): void {
  for (let y = 0; y < expected.length; y += 1) {
    const row = expected[y];
    expect(row).toBeDefined();
    for (let x = 0; row && x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== -1) expect(subject.tiles[(subject.origin.y + y) * subject.mapWidth + subject.origin.x + x]).toBe(tile);
    }
  }
}

function expectUpperLayerEmptyOnRoad(map: ReturnType<typeof createStarterMap>): void {
  const roadTiles = new Set<number>(dirtLikeTiles());
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    const lower = map.lowerTiles[index];
    if (lower !== undefined && roadTiles.has(lower)) expect(map.upperTiles[index]).toBe(TILE.EMPTY);
  }
}
