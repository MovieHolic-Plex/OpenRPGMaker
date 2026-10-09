import { describe, expect, it } from "vitest";
import { chromaKeyToAlpha } from "../scripts/assets/chromaKey.mjs";

describe("chromaKeyToAlpha", () => {
  it("#00FF00 픽셀을 투명(alpha=0)으로 만든다", () => {
    const px = new Uint8ClampedArray([0, 255, 0, 255,  10, 20, 30, 255]);
    const out = chromaKeyToAlpha(px);
    expect(out[3]).toBe(0);    // green → transparent
    expect(out[7]).toBe(255);  // other → opaque
  });
  it("허용오차 안의 근접 초록도 제거한다", () => {
    const px = new Uint8ClampedArray([8, 250, 6, 255]);
    expect(chromaKeyToAlpha(px, [0, 255, 0], 24)[3]).toBe(0);
  });
});
