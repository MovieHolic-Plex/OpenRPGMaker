import { describe, expect, it } from "vitest";
import { chipsetAnimationKey, TEX_TILESET } from "@/assets/bundled";
import {
  animationFrameForTile,
  animationKeyForTile,
  animationStripForTile,
  CHIPSET_ANIMATION_FPS,
} from "@/project/defaults/chipsetAnimation";

describe("chipset water animation mapping", () => {
  it("treats horizontal water triplets as one 3fps terrain animation", () => {
    expect(CHIPSET_ANIMATION_FPS).toBe(3);
    expect(animationStripForTile(0)).toMatchObject({ baseTile: 0, frames: [0, 1, 2] });
    expect(animationStripForTile(1)).toMatchObject({ baseTile: 0, frames: [0, 1, 2] });
    expect(animationStripForTile(90)).toMatchObject({ baseTile: 90, frames: [90, 91, 92] });
    expect(animationStripForTile(92)).toMatchObject({ baseTile: 90, frames: [90, 91, 92] });
    expect(animationStripForTile(120)).toMatchObject({ baseTile: 120, frames: [120, 121, 122] });
    expect(animationKeyForTile(91)).toBe(animationKeyForTile(90));
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
      `tex_easyrpg_chipset_combined_town:${key}`
    );
  });
});
