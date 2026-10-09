import { describe, expect, it } from "vitest";
import { tileCellsForPaintShape, tileRectFromDrag } from "@/editor/tileShapeTools";

describe("tile shape tools", () => {
  it("normalizes a dragged tile rectangle in any direction", () => {
    const rect = tileRectFromDrag({ x: 5, y: 4 }, { x: 2, y: 1 });

    expect(rect).toEqual({ x: 2, y: 1, width: 4, height: 4 });
  });

  it("returns every bounded cell for a rectangle paint drag", () => {
    const cells = tileCellsForPaintShape("rect", { x: 1, y: 1 }, { x: 3, y: 2 }, { width: 10, height: 10 });

    expect(cells).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
  });

  it("clips rectangle paint cells to the map bounds", () => {
    const cells = tileCellsForPaintShape("rect", { x: -1, y: -1 }, { x: 1, y: 1 }, { width: 3, height: 3 });

    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it("returns a filled ellipse footprint for round terrain drags", () => {
    const cells = tileCellsForPaintShape("round", { x: 1, y: 1 }, { x: 5, y: 3 }, { width: 10, height: 10 });

    expect(cells).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]);
  });
});
