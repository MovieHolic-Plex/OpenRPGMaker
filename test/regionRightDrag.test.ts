import { describe, expect, it } from "vitest";
import { isSignificantRegionDrag, regionRectFromDrag } from "@/editor/regionRightDrag";

describe("regionRightDrag", () => {
  const map = { width: 20, height: 15 };

  it("treats single-cell click as insignificant (eyedropper path)", () => {
    const rect = regionRectFromDrag({ x: 3, y: 4 }, { x: 3, y: 4 }, map);
    expect(rect).toEqual({ x: 3, y: 4, width: 1, height: 1 });
    expect(isSignificantRegionDrag(rect)).toBe(false);
  });

  it("treats multi-cell drag as significant (AI region path)", () => {
    const rect = regionRectFromDrag({ x: 2, y: 2 }, { x: 5, y: 4 }, map);
    expect(rect).toEqual({ x: 2, y: 2, width: 4, height: 3 });
    expect(isSignificantRegionDrag(rect)).toBe(true);
  });

  it("normalizes inverted drag corners", () => {
    const rect = regionRectFromDrag({ x: 8, y: 9 }, { x: 5, y: 6 }, map);
    expect(rect).toEqual({ x: 5, y: 6, width: 4, height: 4 });
    expect(isSignificantRegionDrag(rect)).toBe(true);
  });
});
