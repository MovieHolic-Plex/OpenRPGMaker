import { describe, expect, it } from "vitest";
import { referenceMarkerRect } from "@/editor/aiReferenceView";

describe("referenceMarkerRect", () => {
  it("maps map cells to the same share of the picture", () => {
    expect(referenceMarkerRect({ x: 16, y: 10, w: 16, h: 10 }, { width: 64, height: 40 })).toEqual({ left: 0.25, top: 0.25, width: 0.25, height: 0.25 });
  });

  it("keeps a region at the map edge inside the picture", () => {
    const rect = referenceMarkerRect({ x: 60, y: 38, w: 10, h: 10 }, { width: 64, height: 40 });
    expect(rect.left + rect.width).toBe(1);
    expect(rect.top + rect.height).toBe(1);
  });
});
