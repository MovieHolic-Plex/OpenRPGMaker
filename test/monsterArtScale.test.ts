import { describe, expect, it } from "vitest";
import { integerArtBox } from "@/player/monsterArtScale";

describe("integerArtBox (pixel grid contract)", () => {
  it("draws a 64 canvas at exactly 2x inside the 128 box", () => {
    expect(integerArtBox(64, 64)).toEqual({ scale: 2, width: 128, height: 128 });
  });
  it("draws a 112 canvas at 1x, never the old 1.14x", () => {
    expect(integerArtBox(112, 112)).toEqual({ scale: 1, width: 112, height: 112 });
  });
  it("keeps non-square art integral and falls back to the 128 box for unknown sizes", () => {
    expect(integerArtBox(48, 32)).toEqual({ scale: 2, width: 96, height: 64 });
    expect(integerArtBox(0, 0)).toEqual({ scale: 2, width: 128, height: 128 });
  });
  it("never scales below 1x", () => {
    expect(integerArtBox(200, 200).scale).toBe(1);
  });
});
