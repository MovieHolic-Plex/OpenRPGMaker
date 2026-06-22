import { describe, expect, it } from "vitest";

import { shouldApplyTempDragPaint } from "@/editor/panels/tilesetAiTerrainExample";

describe("tileset AI terrain example editor", () => {
  it("does not keep erasing on hover after the primary pointer is released", () => {
    expect(shouldApplyTempDragPaint(true, "erase", false)).toBe(false);
  });

  it("only drag-paints while the primary pointer remains down", () => {
    expect(shouldApplyTempDragPaint(true, "paint", true)).toBe(true);
    expect(shouldApplyTempDragPaint(false, "paint", true)).toBe(false);
    expect(shouldApplyTempDragPaint(true, "stamp", true)).toBe(false);
  });
});
