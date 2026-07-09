import { describe, expect, it } from "vitest";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { TILE } from "@/project/defaults/constants";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;

function tileset(priority: "lower" | "upper" = "lower"): TilesetDef {
  return {
    count: 512,
    id: "test_tileset",
    image: { type: "bundled", id: "test" },
    name: "Test",
    passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: 512 }, () => priority),
    terrain: Array.from({ length: 512 }, () => 0),
    tileSize: 16,
    tilesPerRow: 16,
  };
}

function part(role: PatternGrammar["parts"][number]["role"], tile: number): PatternGrammar["parts"][number] {
  return { role, tileIds: [tile] };
}

describe("buildGroupSample", () => {
  it("assembles a wall nine-slice sample into the expected 3x3 cells", () => {
    const grammar: PatternGrammar = {
      axis: "both",
      kind: "nine_slice_expandable",
      minHeight: 3,
      minWidth: 3,
      parts: [
        part("topLeft", 1),
        part("top", 2),
        part("topRight", 3),
        part("left", 4),
        part("center", 5),
        part("right", 6),
        part("bottomLeft", 7),
        part("bottom", 8),
        part("bottomRight", 9),
      ],
      preserveCaps: true,
      repeat: "center",
    };

    const sample = buildGroupSample(tileset(), { role: "wall", tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9], patternGrammar: grammar });

    expect(sample.w).toBe(3);
    expect(sample.h).toBe(3);
    expect(sample.lower).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(sample.upper).toEqual(Array.from({ length: 9 }, () => TILE.EMPTY));
  });

  it("shows vertical props as repeated upper-layer pairs over grass", () => {
    const grammar: PatternGrammar = {
      axis: "vertical",
      kind: "vertical_expandable",
      minHeight: 2,
      minWidth: 1,
      parts: [part("top", 10), part("bottom", 11)],
      preserveCaps: true,
      repeat: "body",
    };

    const sample = buildGroupSample(tileset("upper"), { role: "prop", tileIds: [10, 11], patternGrammar: grammar });

    expect(sample.w).toBe(5);
    expect(sample.h).toBe(2);
    expect(sample.lower).toEqual(Array.from({ length: 10 }, () => TILE.GRASS));
    expect(sample.upper).toEqual([10, TILE.EMPTY, 10, TILE.EMPTY, 10, 11, TILE.EMPTY, 11, TILE.EMPTY, 11]);
  });

  it("shows grammarless two-tile prop samples as vertical pairs with canopy upper and trunk lower", () => {
    const sample = buildGroupSample(tileset("upper"), { role: "prop", tileIds: [260, 290] });

    expect(sample.w).toBe(5);
    expect(sample.h).toBe(2);
    // 수관 upper 행 + 밑동 lower 행 (숲 겹침용)
    expect(sample.upper.slice(0, 5)).toEqual([260, TILE.EMPTY, 260, TILE.EMPTY, 260]);
    expect(sample.lower.slice(5, 10)).toEqual([290, TILE.GRASS, 290, TILE.GRASS, 290]);
  });

  it("falls back to a single row when no structure grammar is known", () => {
    const sample = buildGroupSample(tileset(), { role: "terrain", tileIds: [21, 22, 23] });

    expect(sample).toEqual({
      h: 1,
      lower: [21, 22, 23],
      upper: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
      w: 3,
    });
  });

  it("clamps oversized samples to the 6x6 preview ceiling", () => {
    const sample = buildGroupSample(tileset(), {
      role: "terrain",
      tileIds: Array.from({ length: 80 }, (_, index) => index),
    });

    expect(sample.w).toBeLessThanOrEqual(6);
    expect(sample.h).toBeLessThanOrEqual(6);
    expect(sample.lower).toHaveLength(sample.w * sample.h);
    expect(sample.upper).toHaveLength(sample.w * sample.h);
  });
});
