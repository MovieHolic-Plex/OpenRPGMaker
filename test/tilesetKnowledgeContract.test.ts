import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { compileTilesetKnowledge } from "@/project/tilesetKnowledge";
import type { TileGroupMetadata } from "@/project/types";

const open = { down: true, left: true, right: true, up: true };

describe("tileset knowledge persistence contract", () => {
  it("round-trips repeatable block dimensions and per-cell layers", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[project.maps[project.startMapId].tilesetId];
    const result = compileTilesetKnowledge({
      groupId: "cliff-2x3",
      name: "반복 절벽",
      passage: open,
      template: "repeatable-cliff-2x3",
      tileCount: tileset.count,
      tileIds: [1, 2, 31, 32, 61, 62],
      tilesPerRow: tileset.tilesPerRow,
    });
    expect(result.kind).toBe("valid");
    if (result.kind !== "valid") return;
    tileset.tileGroups = [...(tileset.tileGroups ?? []), result.value.group];

    const loaded = deserialize(serialize(project));
    const restored = loaded.tilesets[tileset.id].tileGroups?.find((group) => group.id === "cliff-2x3");
    expect(restored?.patternGrammar?.kind).toBe("repeatable_block");
    expect(restored?.patternGrammar?.blockWidth).toBe(2);
    expect(restored?.patternGrammar?.blockHeight).toBe(3);
    expect(restored?.cellLayers).toEqual(["lower", "lower", "lower", "lower", "lower", "lower"]);
  });

  it("rejects duplicate water-atlas block coordinates", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[project.maps[project.startMapId].tilesetId];
    const group: TileGroupMetadata = {
      defaultLayer: "lower",
      description: "",
      id: "bad-atlas",
      name: "bad",
      placementRules: "",
      role: "water",
      sourceBlocks: [sourceBlock(0, 0), sourceBlock(0, 0)],
      tileIds: [1, 2, 3, 31, 32, 33, 61, 62, 63],
    };
    tileset.tileGroups = [...(tileset.tileGroups ?? []), group];

    expect(() => deserialize(serialize(project))).toThrow(/sourceBlocks.*duplicate/u);
  });
});

function sourceBlock(row: number, column: number) {
  return {
    column,
    row,
    sourceRect: { height: 3, width: 3, x: 0, y: 0 },
    tileIds: [1, 2, 3, 31, 32, 33, 61, 62, 63],
  };
}
