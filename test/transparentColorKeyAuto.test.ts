import { describe, expect, it } from "vitest";
import {
  applyAutoTransparencyKey,
  resolveBackgroundColor,
  STANDARD_COLOR_KEYS,
  type RgbColor,
} from "../src/assets/transparentColorKey";

function makePixels(
  width: number,
  height: number,
  fill: (x: number, y: number, out: Uint8ClampedArray, offset: number) => void
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      fill(x, y, pixels, (y * width + x) * 4);
    }
  }
  return pixels;
}

function solidBackground(width: number, height: number, bg: RgbColor): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let off = 0; off < pixels.length; off += 4) {
    pixels[off] = bg.r;
    pixels[off + 1] = bg.g;
    pixels[off + 2] = bg.b;
    pixels[off + 3] = 255;
  }
  return pixels;
}

describe("STANDARD_COLOR_KEYS", () => {
  it("마젠타(#FF00FF) 와 연보라(#FF678B) 를 포함한다", () => {
    expect(STANDARD_COLOR_KEYS).toContainEqual({ r: 255, g: 0, b: 255 });
    expect(STANDARD_COLOR_KEYS).toContainEqual({ r: 255, g: 103, b: 139 });
  });
});

describe("resolveBackgroundColor", () => {
  it("테두리가 이미 투명(alpha=0) 이면 null", () => {
    const pixels = makePixels(8, 8, (_x, _y, out, off) => {
      out[off + 3] = 0;
    });
    expect(resolveBackgroundColor(pixels, 8, 8)).toBeNull();
  });
  it("균일한 마젠타 배경이면 마젠타 반환", () => {
    expect(resolveBackgroundColor(solidBackground(8, 8, { r: 255, g: 0, b: 255 }), 8, 8)).toEqual({ r: 255, g: 0, b: 255 });
  });
  it("균일한 녹색 배경이면 녹색 반환", () => {
    expect(resolveBackgroundColor(solidBackground(8, 8, { r: 0, g: 255, b: 0 }), 8, 8)).toEqual({ r: 0, g: 255, b: 0 });
  });
  it("균일한 검은 배경이면 검은색 반환 (RM2K3)", () => {
    expect(resolveBackgroundColor(solidBackground(8, 8, { r: 0, g: 0, b: 0 }), 8, 8)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("테두리 색이 섞여 있으면 null", () => {
    const pixels = makePixels(8, 8, (x, y, out, off) => {
      const isTopOrBottom = y === 0 || y === 7;
      const bg: RgbColor = isTopOrBottom ? { r: 255, g: 0, b: 255 } : { r: 0, g: 255, b: 0 };
      out[off] = bg.r; out[off + 1] = bg.g; out[off + 2] = bg.b; out[off + 3] = 255;
    });
    expect(resolveBackgroundColor(pixels, 8, 8)).toBeNull();
  });
});

describe("applyAutoTransparencyKey", () => {
  it("투명 PNG(테두리 alpha=0) 에는 손대지 않는다", () => {
    const pixels = makePixels(8, 8, (x, y, out, off) => {
      const isBorder = x === 0 || x === 7 || y === 0 || y === 7;
      if (isBorder) { out[off + 3] = 0; }
      else { out[off] = 200; out[off + 1] = 100; out[off + 2] = 50; out[off + 3] = 255; }
    });
    const contentAlpha = pixels[(4 * 8 + 4) * 4 + 3];
    applyAutoTransparencyKey(pixels, 8, 8);
    expect(pixels[(4 * 8 + 4) * 4 + 3]).toBe(contentAlpha);
    expect(pixels[3]).toBe(0);
  });
  it("마젠타 배경을 키아웃", () => {
    const px = solidBackground(8, 8, { r: 255, g: 0, b: 255 });
    applyAutoTransparencyKey(px, 8, 8);
    expect(px[3]).toBe(0);
  });
  it("녹색 배경을 키아웃", () => {
    const px = solidBackground(8, 8, { r: 0, g: 255, b: 0 });
    applyAutoTransparencyKey(px, 8, 8);
    expect(px[3]).toBe(0);
  });
  it("검은 배경을 키아웃 (RM2K3 RTP)", () => {
    const px = solidBackground(8, 8, { r: 0, g: 0, b: 0 });
    applyAutoTransparencyKey(px, 8, 8);
    expect(px[3]).toBe(0);
  });
  it("콘텐츠 색(배경과 다른)은 보존", () => {
    const px = makePixels(8, 8, (x, y, out, off) => {
      const isContent = x >= 3 && x <= 4 && y >= 3 && y <= 4;
      const c: RgbColor = isContent ? { r: 220, g: 20, b: 20 } : { r: 255, g: 0, b: 255 };
      out[off] = c.r; out[off + 1] = c.g; out[off + 2] = c.b; out[off + 3] = 255;
    });
    applyAutoTransparencyKey(px, 8, 8);
    expect(px[(4 * 8 + 4) * 4 + 3]).toBe(255);
    expect(px[(4 * 8 + 4) * 4]).toBe(220);
    expect(px[3]).toBe(0);
  });
  it("흰 배경에서도 표준 마젠타 키가 적용된다", () => {
    const px = makePixels(8, 8, (x, y, out, off) => {
      const isMagenta = x === 3 && y === 4;
      const c: RgbColor = isMagenta ? { r: 255, g: 0, b: 255 } : { r: 255, g: 255, b: 255 };
      out[off] = c.r; out[off + 1] = c.g; out[off + 2] = c.b; out[off + 3] = 255;
    });
    applyAutoTransparencyKey(px, 8, 8);
    expect(px[3]).toBe(0);
    expect(px[(4 * 8 + 3) * 4 + 3]).toBe(0);
  });
});
