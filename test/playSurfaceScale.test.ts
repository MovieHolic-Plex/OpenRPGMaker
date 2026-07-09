import { describe, expect, it } from "vitest";
import { calculatePlaySurfaceCropMetrics, calculatePlaySurfaceScale } from "@/player/playSurfaceScale";

describe("calculatePlaySurfaceScale", () => {
  it("uses the largest integer contain scale that keeps the full 320x240 stage visible", () => {
    expect(calculatePlaySurfaceScale(1600, 900)).toBe(3);
    expect(calculatePlaySurfaceScale(1280, 800)).toBe(3);
    expect(calculatePlaySurfaceScale(960, 720)).toBe(3);
    expect(calculatePlaySurfaceScale(800, 600)).toBe(2);
    expect(calculatePlaySurfaceScale(640, 480)).toBe(2);
    expect(calculatePlaySurfaceScale(400, 300)).toBe(1);
    expect(calculatePlaySurfaceScale(320, 240)).toBe(1);
    expect(calculatePlaySurfaceScale(300, 200)).toBe(1);
  });

  it("rounds down when either axis cannot fit the next exact multiple", () => {
    expect(calculatePlaySurfaceScale(1279, 960)).toBe(3);
    expect(calculatePlaySurfaceScale(1280, 959)).toBe(3);
  });

  it("keeps scale 1 for tiny or invalid viewports", () => {
    expect(calculatePlaySurfaceScale(319, 239)).toBe(1);
    expect(calculatePlaySurfaceScale(1, 1)).toBe(1);
    expect(calculatePlaySurfaceScale(0, 0)).toBe(1);
    expect(calculatePlaySurfaceScale(-100, Number.NaN)).toBe(1);
  });

  it("supports custom logical dimensions", () => {
    expect(calculatePlaySurfaceScale(800, 600, 400, 300)).toBe(2);
    expect(calculatePlaySurfaceScale(801, 600, 400, 300)).toBe(2);
  });
});

describe("calculatePlaySurfaceCropMetrics", () => {
  it("reports no crop when contain scaling leaves letterbox space", () => {
    const cases: Array<readonly [number, number]> = [
      [1600, 900],
      [1280, 800],
      [960, 720],
      [800, 600],
      [640, 480],
      [400, 300],
      [320, 240],
    ];
    for (const [w, h] of cases) {
      const crop = calculatePlaySurfaceCropMetrics(w, h, calculatePlaySurfaceScale(w, h));
      expect(crop.left).toBe(0);
      expect(crop.right).toBe(0);
      expect(crop.top).toBe(0);
      expect(crop.bottom).toBe(0);
      expect(crop.visibleWidth).toBe(320);
      expect(crop.visibleHeight).toBe(240);
    }
  });

  it("keeps a centered crop for sub-logical viewports", () => {
    const crop = calculatePlaySurfaceCropMetrics(300, 200, 1);
    expect(crop.left).toBe(10);
    expect(crop.right).toBe(10);
    expect(crop.top).toBe(20);
    expect(crop.bottom).toBe(20);
    expect(crop.visibleWidth).toBe(300);
    expect(crop.visibleHeight).toBe(200);
  });
});
