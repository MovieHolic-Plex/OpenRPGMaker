import { editorEventMarkerTexture } from "@/editor/editSceneEventMarkers";
import { createBlankProject } from "@/project/defaults";
import { describe, expect, it } from "vitest";
import { isColorKeyedChipsetTextureKey } from "@/assets/bundled";
import { applyTransparentColorKey } from "@/assets/transparentColorKey";
import { charsetIdleFrameIndex, charsetWalkFrameIndex } from "@/player/charsetMotion";

describe("EasyRPG RTP runtime sprite rendering", () => {
  it("uses the saved facing direction for uploaded charset editor previews", () => {
    const project = createBlankProject();
    project.assets.uploaded.test_charset = { id: "test_charset", name: "test", kind: "charset", dataUrl: "data:image/png;base64,AA==", meta: {} };
    for (const [direction, frame] of [["up", 1], ["right", 13], ["down", 25], ["left", 37]] as const) {
      expect(editorEventMarkerTexture(project, { sprite: { type: "uploaded", id: "test_charset" }, pattern: 1, direction })?.frame).toBe(frame);
    }
  });
  it("preserves opaque artwork that shares RGB with a transparent corner", () => {
    for (const rgb of [[0, 0, 0], [255, 255, 255], [255, 118, 50]]) {
      const pixels = new Uint8ClampedArray([...rgb, 0, ...rgb, 255, 12, 34, 56, 128]);
      const before = pixels.slice();
      applyTransparentColorKey(pixels);
      expect(pixels).toEqual(before);
    }
  });
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

    expect(charsetWalkFrameIndex(baseFrame, "right", 0)).toBe(60);
    expect(charsetWalkFrameIndex(baseFrame, "right", 1)).toBe(61);
    expect(charsetWalkFrameIndex(baseFrame, "right", 2)).toBe(62);
    expect(charsetWalkFrameIndex(baseFrame, "right", 3)).toBe(61);
    expect(charsetWalkFrameIndex(baseFrame, "right", 4)).toBe(60);
    expect(charsetIdleFrameIndex(baseFrame, "left")).toBe(85);
  });

  it("applies transparent color keys only to object-heavy chipset sheets", () => {
    expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_interior")).toBe(true);
    expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_dungeon")).toBe(true);
    expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_retro_dungeon")).toBe(true);
    expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_combined_town")).toBe(false);
    expect(isColorKeyedChipsetTextureKey("tex_easyrpg_chipset_retro_exterior")).toBe(false);
  });
});
