import { describe, expect, it } from "vitest";
import { chipsetAnimationKey, TEX_TILESET } from "@/assets/bundled";
import {
  animationFrameForTile,
  animationKeyForTile,
  animationStripForTile,
  CHIPSET_ANIMATION_FPS,
  WATERFALL_ANIMATION_FPS,
} from "@/project/defaults/chipsetAnimation";

describe("chipset water animation mapping", () => {
  it("treats horizontal water triplets as one 3fps terrain animation", () => {
    expect(CHIPSET_ANIMATION_FPS).toBe(3);
    expect(animationStripForTile(0)).toMatchObject({ baseTile: 0, frames: [0, 1, 2], fps: 3 });
    expect(animationStripForTile(1)).toMatchObject({ baseTile: 0, frames: [0, 1, 2], fps: 3 });
    expect(animationStripForTile(90)).toMatchObject({ baseTile: 90, frames: [90, 91, 92], fps: 3 });
    expect(animationStripForTile(92)).toMatchObject({ baseTile: 90, frames: [90, 91, 92], fps: 3 });
    expect(animationStripForTile(120)).toMatchObject({ baseTile: 120, frames: [120, 121, 122], fps: 3 });
    expect(animationKeyForTile(91)).toBe(animationKeyForTile(90));
  });

  it("treats waterfall as vertical 4-frame loop at 4fps (123→153→183→213)", () => {
    expect(WATERFALL_ANIMATION_FPS).toBe(4);
    expect(animationStripForTile(123)).toMatchObject({
      baseTile: 123,
      frames: [123, 153, 183, 213],
      fps: 4,
    });
    // 가로 이웃 124/125 는 같은 세로 루프의 다른 열 — 123과 섞이지 않는다.
    expect(animationStripForTile(124)?.frames).toEqual([124, 154, 184, 214]);
    expect(animationStripForTile(125)?.frames).toEqual([125, 155, 185, 215]);
    // 123 한 칸만 저장해도 세로로 프레임이 바뀐다.
    expect(animationFrameForTile(123, 0)).toBe(123);
    expect(animationFrameForTile(123, 250)).toBe(153);
    expect(animationFrameForTile(123, 500)).toBe(183);
    expect(animationFrameForTile(123, 750)).toBe(213);
    expect(animationFrameForTile(123, 1000)).toBe(123);
    // 예전 잘못된 가로 해석: 123→124 가 되면 안 된다.
    expect(animationFrameForTile(123, 250)).not.toBe(124);
  });

  it("selects the visible chipset frame from elapsed time", () => {
    expect(animationFrameForTile(90, 0)).toBe(90);
    expect(animationFrameForTile(90, 334)).toBe(91);
    expect(animationFrameForTile(90, 667)).toBe(92);
    expect(animationFrameForTile(90, 1000)).toBe(90);
    expect(animationFrameForTile(7, 667)).toBe(7);
  });

  it("scopes non-legacy animation keys to the active chipset texture", () => {
    const key = animationKeyForTile(120);
    expect(key).toBeTruthy();
    expect(chipsetAnimationKey(TEX_TILESET, key!)).toBe(key);
    expect(chipsetAnimationKey("tex_easyrpg_chipset_combined_town", key!)).toBe(
      `tex_easyrpg_chipset_combined_town:${key}`,
    );
  });
});
