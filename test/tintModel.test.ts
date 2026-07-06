import { describe, it, expect } from "vitest";
import {
  interpolateRgba,
  isVisibleTint,
  parseTintColor,
  rgbaEqual,
  rgbaToCss,
  TRANSPARENT_TINT,
} from "@/player/screen/tintModel";

describe("parseTintColor", () => {
  it("neutral/none/빈값은 투명", () => {
    expect(parseTintColor("neutral")).toEqual(TRANSPARENT_TINT);
    expect(parseTintColor("none")).toEqual(TRANSPARENT_TINT);
    expect(parseTintColor("")).toEqual(TRANSPARENT_TINT);
    expect(parseTintColor(undefined)).toEqual(TRANSPARENT_TINT);
  });

  it("색 이름은 기본 알파 0.45", () => {
    expect(parseTintColor("red")).toEqual({ r: 255, g: 0, b: 0, a: 0.45 });
  });

  it("r,g,b 형태", () => {
    expect(parseTintColor("128,64,32")).toEqual({ r: 128, g: 64, b: 32, a: 0.45 });
  });

  it("r,g,b,a 형태(알파 지정)", () => {
    expect(parseTintColor("128,64,32,0.8")).toEqual({ r: 128, g: 64, b: 32, a: 0.8 });
  });

  it("값 범위를 클램프", () => {
    expect(parseTintColor("300,-10,50,2")).toEqual({ r: 255, g: 0, b: 50, a: 1 });
  });
});

describe("interpolateRgba", () => {
  const from = TRANSPARENT_TINT;
  const to = { r: 255, g: 0, b: 0, a: 0.45 };

  it("투명→색상 페이드(알파 포함 보간)", () => {
    expect(interpolateRgba(from, to, 0)).toEqual(from);
    expect(interpolateRgba(from, to, 1)).toEqual(to);
    expect(interpolateRgba(from, to, 0.5)).toEqual({ r: 127.5, g: 0, b: 0, a: 0.225 });
  });

  it("t 를 0~1 로 클램프", () => {
    expect(interpolateRgba(from, to, 5)).toEqual(to);
  });
});

describe("rgbaToCss / isVisibleTint / rgbaEqual", () => {
  it("CSS 문자열", () => {
    expect(rgbaToCss({ r: 128, g: 64, b: 32, a: 0.45 })).toBe("rgba(128,64,32,0.45)");
  });

  it("알파 0 은 비가시", () => {
    expect(isVisibleTint(TRANSPARENT_TINT)).toBe(false);
    expect(isVisibleTint({ r: 0, g: 0, b: 0, a: 0.1 })).toBe(true);
  });

  it("근접 색상 동일 판정", () => {
    expect(rgbaEqual({ r: 10, g: 10, b: 10, a: 0.5 }, { r: 10.2, g: 10, b: 10, a: 0.5 })).toBe(true);
    expect(rgbaEqual({ r: 10, g: 10, b: 10, a: 0.5 }, { r: 20, g: 10, b: 10, a: 0.5 })).toBe(false);
  });
});
