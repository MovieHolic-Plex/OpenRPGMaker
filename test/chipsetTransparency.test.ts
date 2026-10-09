import { describe, expect, it } from "vitest";
import { applyTransparentColorKeys } from "@/assets/transparentColorKey";

describe("chipset transparency", () => {
  it("makes only the EasyRPG interior object background transparent", () => {
    const pixels = new Uint8ClampedArray([
      60, 143, 75, 255,
      255, 103, 139, 255,
      0, 0, 0, 255,
      255, 103, 139, 128,
    ]);

    applyTransparentColorKeys(pixels, [{ r: 255, g: 103, b: 139 }]);

    expect(Array.from(pixels.slice(0, 4))).toEqual([60, 143, 75, 255]);
    expect(Array.from(pixels.slice(4, 8))).toEqual([255, 103, 139, 0]);
    expect(Array.from(pixels.slice(8, 12))).toEqual([0, 0, 0, 255]);
    expect(Array.from(pixels.slice(12, 16))).toEqual([255, 103, 139, 0]);
  });
});
