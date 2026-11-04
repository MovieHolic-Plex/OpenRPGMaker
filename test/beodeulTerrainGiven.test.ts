import { describe, expect, it } from "vitest";
import { generateCodeTerrain } from "@/editor/tools/beodeulTerrainGen";
import { villageArgsFromRead } from "@/ai/imagePlan";

const ROWS = [
  "000000011110000000000000",
  "000000111110~~0000000000",
  "000011111100|~0000000000",
  "000011221100|~~000000000",
  "000001222110~~~000000000",
  "000001122100~~0000000000",
  "000000111000~~0000000000",
  "00000000000~~00000000000",
];

describe("village terrain from an image-plan cell map", () => {
  const t = generateCodeTerrain({ W: 56, H: 44, seed: 7, water: "river", given: { rows: ROWS } });
  const cellOf = (col: number, row: number) => Math.floor((row + 0.5) * 44 / ROWS.length) * 56 + Math.floor((col + 0.5) * 56 / 24);

  it("puts the given tiers and water where the map says (one tier step = two levels)", () => {
    expect(t.water[cellOf(13, 3)]).toBe(1);
    expect(t.water[cellOf(2, 1)]).toBe(0);
    expect(t.levels[cellOf(6, 3)]).toBe(2 * 2);
    expect(t.levels[cellOf(8, 3)]).toBe(2 * 1);
    expect(t.levels[cellOf(1, 1)]).toBe(0);
    expect(t.maxLevel).toBeGreaterThanOrEqual(4);
  });

  it("keeps every neighbour step at most one tier (two levels) apart", () => {
    for (let y = 0; y < 44; y += 1) for (let x = 0; x < 56; x += 1) {
      const c = y * 56 + x;
      if (x + 1 < 56) expect(Math.abs(t.levels[c]! - t.levels[c + 1]!)).toBeLessThanOrEqual(2);
      if (y + 1 < 44) expect(Math.abs(t.levels[c]! - t.levels[c + 56]!)).toBeLessThanOrEqual(2);
    }
  });

  it("passes the read terrain rows to the builder as terrainMap and keeps river water", () => {
    const read = { subject: "village" as const, cols: 24, rows: 8, data: { terrain: ROWS, water: "none", houses: [] } };
    const args = villageArgsFromRead(read, 56, 44);
    expect(args.terrainMap).toEqual(ROWS);
    expect(args.water).toBeUndefined();
  });
});
