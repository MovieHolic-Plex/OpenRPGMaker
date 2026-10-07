import { describe, expect, it } from "vitest";
import {
  createStarterMap,
  TILE,
} from "@/project/defaults";
import { dirtLikeTiles } from "@/project/defaults/chipsetMapping";

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

function expectUpperLayerEmptyOnRoad(map: ReturnType<typeof createStarterMap>): void {
  const roadTiles = new Set<number>(dirtLikeTiles());
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    const lower = map.lowerTiles[index];
    if (lower !== undefined && roadTiles.has(lower)) expect(map.upperTiles[index]).toBe(TILE.EMPTY);
  }
}
