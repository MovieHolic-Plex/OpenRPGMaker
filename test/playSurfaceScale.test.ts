import { describe, expect, it } from "vitest";
import {
  calculatePlaySurfaceCropMetrics,
  calculatePlaySurfacePlacement,
  calculatePlaySurfaceScale,
} from "@/player/playSurfaceScale";

describe("calculatePlaySurfaceScale", () => {
  it("uses the largest integer contain scale while the logical stage fits at 1x", () => {
    expect(calculatePlaySurfaceScale(1600, 900)).toBe(3);
    expect(calculatePlaySurfaceScale(1280, 800)).toBe(3);
    expect(calculatePlaySurfaceScale(960, 720)).toBe(3);
    expect(calculatePlaySurfaceScale(800, 600)).toBe(2);
    expect(calculatePlaySurfaceScale(640, 480)).toBe(2);
    expect(calculatePlaySurfaceScale(400, 300)).toBe(1);
    expect(calculatePlaySurfaceScale(320, 240)).toBe(1);
  });

  it("rounds down when either axis cannot fit the next exact multiple", () => {
    expect(calculatePlaySurfaceScale(1279, 960)).toBe(3);
    expect(calculatePlaySurfaceScale(1280, 959)).toBe(3);
  });

  it("shrinks oversized logical stages to keep the full game visible", () => {
    // Break named: the current scale floor of 1 crops custom resolutions larger than the host.
    expect(calculatePlaySurfaceScale(300, 200)).toBeCloseTo(5 / 6);
    expect(calculatePlaySurfaceScale(1320, 690, 1920, 1080)).toBeCloseTo(23 / 36);
  });

  it("keeps scale 1 until a viewport has a measurable size", () => {
    expect(calculatePlaySurfaceScale(0, 0)).toBe(1);
    expect(calculatePlaySurfaceScale(-100, Number.NaN)).toBe(1);
  });

  it("supports custom logical dimensions", () => {
    expect(calculatePlaySurfaceScale(800, 600, 400, 300)).toBe(2);
    expect(calculatePlaySurfaceScale(801, 600, 400, 300)).toBe(2);
  });
});

describe("calculatePlaySurfaceScale scale modes", () => {
  // 실측: 테스트 플레이 창 본문 1214x640 CSS px / 논리 320x240 에서 integer 모드는 2.000 이라
  // 640x480 만 그리고 나머지 73% 가 죽은 레터박스였다. 배포/커뮤니티 플레이어는 이 값이 바뀌면 안 된다.
  it("keeps the shipped integer contain scale for the measured test play window body", () => {
    expect(calculatePlaySurfaceScale(1214, 640, 320, 240)).toBe(2);
    expect(calculatePlaySurfaceScale(1214, 640, 320, 240, "integer")).toBe(2);
  });

  it("returns the unfloored contain scale in fit mode so the window is filled", () => {
    expect(calculatePlaySurfaceScale(1214, 640, 320, 240, "fit")).toBeCloseTo(8 / 3);
    expect(calculatePlaySurfaceScale(1600, 900, 320, 240, "fit")).toBeCloseTo(3.75);
  });

  it("treats shrinking and empty viewports identically in both modes", () => {
    expect(calculatePlaySurfaceScale(300, 200, 320, 240, "fit")).toBeCloseTo(5 / 6);
    expect(calculatePlaySurfaceScale(300, 200, 320, 240, "integer")).toBeCloseTo(5 / 6);
    expect(calculatePlaySurfaceScale(0, 0, 320, 240, "fit")).toBe(1);
  });

  it("reports no crop for a fractional fit scale", () => {
    const scale = calculatePlaySurfaceScale(1214, 640, 320, 240, "fit");
    const crop = calculatePlaySurfaceCropMetrics(1214, 640, scale, 320, 240);
    expect(crop.left).toBe(0);
    expect(crop.top).toBe(0);
    expect(crop.visibleWidth).toBe(320);
    expect(crop.visibleHeight).toBe(240);
    const placement = calculatePlaySurfacePlacement(1214, 640, scale, 320, 240);
    expect(placement.top).toBe(0);
    expect(placement.left).toBeCloseTo((1214 - 320 * (8 / 3)) / 2);
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

  it("reports the full logical stage after automatic contain shrinking", () => {
    // Break named: crop metrics currently coerce a fractional fit scale back to 1.
    const scale = calculatePlaySurfaceScale(300, 200);
    const crop = calculatePlaySurfaceCropMetrics(300, 200, scale);
    expect(crop.left).toBe(0);
    expect(crop.right).toBe(0);
    expect(crop.top).toBe(0);
    expect(crop.bottom).toBe(0);
    expect(crop.visibleWidth).toBe(320);
    expect(crop.visibleHeight).toBe(240);
  });
});

describe("calculatePlaySurfacePlacement", () => {
  it("centers a fractionally scaled stage inside the host instead of centering its unscaled box", () => {
    // Break named: CSS grid safely aligns an overflowing unscaled stage to the start edge,
    // so transform-origin center shifts the contained pixels down and right.
    const scale = calculatePlaySurfaceScale(1320, 690, 1920, 1080);
    const placement = calculatePlaySurfacePlacement(1320, 690, scale, 1920, 1080);
    expect(placement.left).toBeCloseTo(140 / 3);
    expect(placement.top).toBe(0);
  });
});
