import { describe, expect, it } from "vitest";
import { compileTilesetKnowledge, repeatKnowledgeBlock, type TilesetKnowledgeTemplate } from "@/project/tilesetKnowledge";
import type { PassFlag } from "@/project/types";

const open: PassFlag = { down: true, left: true, right: true, up: true };

describe("tileset knowledge templates", () => {
  it.each([
    ["water-autotile-3x3", 3, 3, "autotile_3x3"],
    ["water-atlas-9x9", 9, 9, "source_rect"],
    ["desk", 2, 1, "source_rect"],
    ["tree", 2, 3, "source_rect"],
    ["one-way-path", 3, 3, "autotile_3x3"],
    ["repeatable-cliff-2x3", 2, 3, "repeatable_block"],
  ] as const)("compiles %s from an exact rectangle", (template, width, height, grammarKind) => {
    const tileIds = rectangleTiles(10, 1, 2, width, height);
    const passage = template === "one-way-path" ? { down: false, left: true, right: false, up: true } : open;
    const result = compileTilesetKnowledge({
      groupId: `group-${template}`,
      name: template,
      passage,
      template: template satisfies TilesetKnowledgeTemplate,
      tileCount: 200,
      tileIds,
      tilesPerRow: 10,
    });

    expect(result.kind).toBe("valid");
    if (result.kind !== "valid") return;
    expect(result.value.group.sourceRect).toEqual({ height, width, x: 1, y: 2 });
    expect(result.value.group.patternGrammar?.kind).toBe(grammarKind);
    expect(result.value.group.tileIds).toEqual(tileIds);
    expect(result.value.rules.every((rule) => rule.passage.down === passage.down)).toBe(true);
  });

  it("splits a 9x9 water atlas into nine ordered 3x3 blocks", () => {
    const tileIds = rectangleTiles(12, 1, 1, 9, 9);
    const result = compileTilesetKnowledge({
      groupId: "water-atlas",
      name: "물 지형",
      passage: open,
      template: "water-atlas-9x9",
      tileCount: 200,
      tileIds,
      tilesPerRow: 12,
    });

    expect(result.kind).toBe("valid");
    if (result.kind !== "valid") return;
    expect(result.value.group.sourceBlocks).toHaveLength(9);
    expect(result.value.group.sourceBlocks?.flatMap((block) => block.tileIds).sort((left, right) => left - right)).toEqual(tileIds);
  });

  it("rejects a holey selection for a structural template", () => {
    const tileIds = rectangleTiles(10, 0, 0, 3, 3).filter((tile) => tile !== 11);
    const result = compileTilesetKnowledge({
      groupId: "holey-water",
      name: "물",
      passage: open,
      template: "water-autotile-3x3",
      tileCount: 100,
      tileIds,
      tilesPerRow: 10,
    });

    expect(result).toEqual({
      kind: "invalid",
      issues: [{ code: "selection-not-rectangular", message: "선택에 빈 칸이 있습니다." }],
    });
  });

  it("repeats a 2x3 block across both axes including clipped edges", () => {
    expect(repeatKnowledgeBlock([1, 2, 3, 4, 5, 6], 2, 3, 5, 7)).toEqual([
      1, 2, 1, 2, 1,
      3, 4, 3, 4, 3,
      5, 6, 5, 6, 5,
      1, 2, 1, 2, 1,
      3, 4, 3, 4, 3,
      5, 6, 5, 6, 5,
      1, 2, 1, 2, 1,
    ]);
  });
});

function rectangleTiles(columns: number, x: number, y: number, width: number, height: number): number[] {
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_cell, column) => ((y + row) * columns) + x + column)
  ).flat();
}
