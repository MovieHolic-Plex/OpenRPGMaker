import { describe, expect, it } from "vitest";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { RM_TYPE_GRAMMAR_PROFILE } from "@/editor/tools/v3/grammarProfiles";
import { expandWall } from "@/editor/tools/v3/rmTypeExpander";
import { TILE } from "@/project/defaults/constants";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

function tileset(): TilesetDef {
  return {
    count: 512,
    id: "repeatable-test",
    image: { type: "bundled", id: "test" },
    name: "Repeatable test",
    passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
    priority: Array.from({ length: 512 }, () => "lower" as const),
    terrain: Array.from({ length: 512 }, () => 0),
    tileSize: 16,
    tilesPerRow: 16,
  };
}

function repeatableGroup(): TileGroupMetadata {
  return {
    cellLayers: ["upper", "upper", "lower", "lower", "lower", "lower"],
    defaultLayer: "mixed",
    description: "2x3 repeatable cliff",
    id: "cliff-2x3",
    layerHome: "perCell",
    name: "2x3 cliff",
    origin: "user",
    patternGrammar: {
      axis: "both",
      blockHeight: 3,
      blockWidth: 2,
      kind: "repeatable_block",
      minHeight: 3,
      minWidth: 2,
      parts: [{ role: "repeatBody", tileIds: [1, 2, 3, 4, 5, 6] }],
      preserveCaps: false,
      repeat: "source_order",
    },
    placementRules: "Repeat the authored 2x3 block on both axes.",
    role: "wall",
    tileIds: [1, 2, 3, 4, 5, 6],
  };
}

describe("repeatable_block grammar", () => {
  it("expands a 2x3 authored block by two-dimensional modulo", () => {
    const expansion = expandWall(
      tileset(),
      repeatableGroup(),
      { h: 7, w: 5, x: 2, y: 3 },
      RM_TYPE_GRAMMAR_PROFILE,
      { material: "2x3 cliff" }
    );

    expect(expansion.edits).toHaveLength(35);
    expect(expansion.edits.map((edit) => edit.tile)).toEqual([
      1, 2, 1, 2, 1,
      3, 4, 3, 4, 3,
      5, 6, 5, 6, 5,
      1, 2, 1, 2, 1,
      3, 4, 3, 4, 3,
      5, 6, 5, 6, 5,
      1, 2, 1, 2, 1,
    ]);
    expect(expansion.edits.slice(0, 5).every((edit) => edit.layer === "upper")).toBe(true);
    expect(expansion.edits.slice(5, 15).every((edit) => edit.layer === "lower")).toBe(true);
  });

  it("previews the exact authored block and its per-cell layers", () => {
    const group = repeatableGroup();
    const sample = buildGroupSample(tileset(), {
      cellLayers: group.cellLayers,
      patternGrammar: group.patternGrammar,
      role: group.role,
      tileIds: group.tileIds,
    });

    expect(sample).toEqual({
      h: 3,
      lower: [TILE.EMPTY, TILE.EMPTY, 3, 4, 5, 6],
      upper: [1, 2, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
      w: 2,
    });
  });
});
