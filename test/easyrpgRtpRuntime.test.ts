import { describe, expect, it } from "vitest";
import { applyTransparentColorKey } from "@/assets/transparentColorKey";
import { charsetIdleFrameIndex, charsetWalkFrameIndex } from "@/player/charsetMotion";

describe("EasyRPG RTP runtime sprite rendering", () => {
  it("makes pixels matching the sheet top-left color transparent", () => {
    const pixels = new Uint8ClampedArray([
      0, 147, 146, 255,
      12, 34, 56, 255,
      0, 147, 146, 128,
    ]);

    const key = applyTransparentColorKey(pixels);

    expect(key).toEqual({ r: 0, g: 147, b: 146, a: 255 });
    expect(Array.from(pixels.slice(0, 4))).toEqual([0, 147, 146, 0]);
    expect(Array.from(pixels.slice(4, 8))).toEqual([12, 34, 56, 255]);
    expect(Array.from(pixels.slice(8, 12))).toEqual([0, 147, 146, 0]);
  });

  it("cycles moving NPC frames inside the same RPG Maker 2000 CharSet slot", () => {
    const baseFrame = 86;

    expect(charsetWalkFrameIndex(baseFrame, "right", 0)).toBe(72);
    expect(charsetWalkFrameIndex(baseFrame, "right", 1)).toBe(73);
    expect(charsetWalkFrameIndex(baseFrame, "right", 2)).toBe(74);
    expect(charsetWalkFrameIndex(baseFrame, "right", 3)).toBe(73);
    expect(charsetWalkFrameIndex(baseFrame, "right", 4)).toBe(72);
    expect(charsetIdleFrameIndex(baseFrame, "left")).toBe(61);
  });
});
