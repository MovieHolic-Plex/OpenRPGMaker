import { describe, expect, it } from "vitest";
import { resolveAnimaticCameraAxis, sampleAnimaticTrack, type AnimaticKey } from "@/project/openingAnimatic";

const key = (atMs: number, value: number): AnimaticKey => ({ atMs, value });

function axis(keys: AnimaticKey[] | undefined, atMs: number, fallback: number, span: number): number {
  return resolveAnimaticCameraAxis(sampleAnimaticTrack(keys, atMs, fallback), keys, fallback, span);
}

describe("resolveAnimaticCameraAxis", () => {
  it("keeps a centre-relative pan continuous after it leaves the 25% band", () => {
    const keys = [key(0, 0), key(1000, 80)];
    const height = 270;
    const at = (t: number) => axis(keys, t, height / 2, height);
    expect(at(0)).toBe(135);
    expect(at(800)).toBeCloseTo(64 + 135, 6);
    // 72 is outside the band. The old per-sample recentre left it at 72 and jumped half a stage.
    expect(at(900)).toBeCloseTo(72 + 135, 6);
    expect(at(1000)).toBe(80 + 135);
    for (let t = 0; t < 1000; t += 50) {
      expect(Math.abs(at(t + 50) - at(t))).toBeLessThanOrEqual(4.01);
    }
  });

  it("reads a world pan that starts outside the band as world coordinates the whole way", () => {
    const keys = [key(0, 230), key(5600, 500)];
    const height = 270;
    expect(axis(keys, 0, height / 2, height)).toBe(230);
    expect(axis(keys, 2800, height / 2, height)).toBe(365);
    expect(axis(keys, 5600, height / 2, height)).toBe(500);
    const dipping = [key(0, 100), key(1000, 40)];
    expect(axis(dipping, 0, height / 2, height)).toBe(100);
    expect(axis(dipping, 1000, height / 2, height)).toBe(40);
  });

  it("still recentres a static offset and leaves an omitted camera on the stage centre", () => {
    const height = 270;
    const width = 480;
    expect(axis(undefined, 0, 0, height)).toBe(height / 2);
    expect(axis([key(0, 10)], 0, height / 2, height)).toBe(10 + height / 2);
    expect(axis(undefined, 0, width / 2, width)).toBe(width / 2);
  });
});
