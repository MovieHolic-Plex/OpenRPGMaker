import { describe, expect, it } from "vitest";
import { swingArcCells, cellInArc } from "@/battle/action/hitbox";

describe("swingArcCells", () => {
  it("down facing covers front cell and its diagonals at range 1", () => {
    const cells = swingArcCells("down", 5, 5, 1);
    expect(cells).toHaveLength(3);
    expect(cellInArc(cells, 5, 6)).toBe(true);
    expect(cellInArc(cells, 4, 6)).toBe(true);
    expect(cellInArc(cells, 6, 6)).toBe(true);
    expect(cellInArc(cells, 5, 5)).toBe(false);
    expect(cellInArc(cells, 5, 4)).toBe(false);
  });

  it("left facing fans out vertically", () => {
    const cells = swingArcCells("left", 5, 5, 1);
    expect(cellInArc(cells, 4, 5)).toBe(true);
    expect(cellInArc(cells, 4, 4)).toBe(true);
    expect(cellInArc(cells, 4, 6)).toBe(true);
    expect(cellInArc(cells, 3, 5)).toBe(false);
  });

  it("up and right mirror each other", () => {
    const up = swingArcCells("up", 5, 5, 1);
    expect(cellInArc(up, 5, 4)).toBe(true);
    expect(cellInArc(up, 4, 4)).toBe(true);
    expect(cellInArc(up, 6, 4)).toBe(true);
    const right = swingArcCells("right", 5, 5, 1);
    expect(cellInArc(right, 6, 5)).toBe(true);
    expect(cellInArc(right, 6, 4)).toBe(true);
    expect(cellInArc(right, 6, 6)).toBe(true);
  });

  it("range 2 extends only the forward line", () => {
    const cells = swingArcCells("down", 5, 5, 2);
    expect(cells).toHaveLength(4);
    expect(cellInArc(cells, 5, 7)).toBe(true);
    expect(cellInArc(cells, 4, 7)).toBe(false);
  });

  it("produces no duplicate cells", () => {
    const cells = swingArcCells("down", 0, 0, 3);
    const keys = cells.map((c) => `${c.x},${c.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
