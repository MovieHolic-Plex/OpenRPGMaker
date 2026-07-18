import { describe, expect, it } from "vitest";
import { shouldShowPaintHoverPreview } from "@/editor/editSceneHoverPreview";

describe("shouldShowPaintHoverPreview", () => {
  it("hides hover while painting so raw palette tiles do not flash over shaped results", () => {
    expect(shouldShowPaintHoverPreview({ isPainting: true, dragActive: false })).toBe(false);
  });

  it("hides hover while a shape/structure drag is active", () => {
    expect(shouldShowPaintHoverPreview({ isPainting: false, dragActive: true })).toBe(false);
  });

  it("shows hover when idle", () => {
    expect(shouldShowPaintHoverPreview({ isPainting: false, dragActive: false })).toBe(true);
  });
});
