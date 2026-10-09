import { describe, expect, it } from "vitest";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { TILE } from "@/project/defaults/constants";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;

function tileset(): TilesetDef {
  return {
    count: 512,
    id: "test_tileset",
    image: { type: "bundled", id: "test" },
    name: "Test",
    passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: 512 }, () => "lower"),
    terrain: Array.from({ length: 512 }, () => 0),
    tileSize: 16,
    tilesPerRow: 16,
  };
}

function part(role: PatternGrammar["parts"][number]["role"], tile: number): PatternGrammar["parts"][number] {
  return { role, tileIds: [tile] };
}

function wallGrammar(): PatternGrammar {
  return {
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
}

describe("buildGroupSample junction and overlay rules", () => {
  it("leaves the sample identical when no junction or overlay rules are provided", () => {
    const input = { role: "wall", tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9], patternGrammar: wallGrammar() } satisfies Parameters<typeof buildGroupSample>[1];

    const before = buildGroupSample(tileset(), input);
    const after = buildGroupSample(tileset(), { ...input, junctions: [], overlays: [] });

    expect(after).toEqual(before);
  });

  it("omits the requested junction role cells after assembling the sample", () => {
    const sample = buildGroupSample(tileset(), {
      role: "wall",
      tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      patternGrammar: wallGrammar(),
      junctions: [{ action: "omit", atRoles: ["bottomLeft", "bottom", "bottomRight"], side: "below", withRole: "roof" }],
    });

    expect(sample.lower).toEqual([1, 2, 3, 4, 5, 6, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY]);
    expect(sample.upper).toEqual(Array.from({ length: 9 }, () => TILE.EMPTY));
  });

  it("replaces junction role cells with replacement tiles", () => {
    const sample = buildGroupSample(tileset(), {
      role: "wall",
      tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      patternGrammar: wallGrammar(),
      junctions: [{ action: "replace", atRoles: ["topLeft", "top", "topRight"], replaceWith: [41, 42, 43], side: "above", withRole: "roof" }],
    });

    expect(sample.lower).toEqual([41, 42, 43, 4, 5, 6, 7, 8, 9]);
  });

  it("adds overlay tiles on the representative upper-layer positions deterministically", () => {
    const first = buildGroupSample(tileset(), {
      role: "roof",
      tileIds: [10, 11, 12, 13],
      overlays: [
        { tileIds: [90], when: "ridge" },
        { tileIds: [91, 92], when: "eaveEnd" },
      ],
    });
    const second = buildGroupSample(tileset(), {
      role: "roof",
      tileIds: [10, 11, 12, 13],
      overlays: [
        { tileIds: [90], when: "ridge" },
        { tileIds: [91, 92], when: "eaveEnd" },
      ],
    });

    expect(first.lower).toEqual([10, 11, 12, 13]);
    expect(first.upper).toEqual([91, TILE.EMPTY, 90, 92]);
    expect(second).toEqual(first);
  });
});
