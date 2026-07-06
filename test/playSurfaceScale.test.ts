import { describe, expect, it } from "vitest";
import { calculatePlaySurfaceCropMetrics, calculatePlaySurfaceScale } from "@/player/playSurfaceScale";

describe("calculatePlaySurfaceScale", () => {
  it("uses the minimum integer scale that covers the viewport", () => {
    expect(calculatePlaySurfaceScale(320, 240)).toBe(1);
    expect(calculatePlaySurfaceScale(640, 480)).toBe(2);
    expect(calculatePlaySurfaceScale(1280, 900)).toBe(4);
    expect(calculatePlaySurfaceScale(1720, 960)).toBe(6);
  });

  it("rounds up when either axis exceeds an exact multiple by one pixel", () => {
    expect(calculatePlaySurfaceScale(641, 480)).toBe(3);
    expect(calculatePlaySurfaceScale(640, 481)).toBe(3);
  });

  it("keeps scale 1 for tiny or invalid viewports", () => {
    expect(calculatePlaySurfaceScale(319, 239)).toBe(1);
    expect(calculatePlaySurfaceScale(1, 1)).toBe(1);
    expect(calculatePlaySurfaceScale(0, 0)).toBe(1);
    expect(calculatePlaySurfaceScale(-100, Number.NaN)).toBe(1);
  });

  it("supports custom logical dimensions", () => {
    expect(calculatePlaySurfaceScale(800, 600, 400, 300)).toBe(2);
    expect(calculatePlaySurfaceScale(801, 600, 400, 300)).toBe(3);
  });
});

describe("calculatePlaySurfaceCropMetrics", () => {
  it("reports the centered logical crop caused by cover scaling", () => {
    const crop = calculatePlaySurfaceCropMetrics(1720, 960, 6);
    expect(crop.left).toBeCloseTo(16.667, 3);
    expect(crop.right).toBeCloseTo(16.667, 3);
    expect(crop.top).toBe(40);
    expect(crop.bottom).toBe(40);
    expect(crop.visibleWidth).toBeCloseTo(286.667, 3);
    expect(crop.visibleHeight).toBe(160);
  });

  it("keeps a centered crop for sub-logical viewports", () => {
    const crop = calculatePlaySurfaceCropMetrics(319, 239, 1);
    expect(crop.left).toBe(0.5);
    expect(crop.right).toBe(0.5);
    expect(crop.top).toBe(0.5);
    expect(crop.bottom).toBe(0.5);
    expect(crop.visibleWidth).toBe(319);
    expect(crop.visibleHeight).toBe(239);
  });
});
