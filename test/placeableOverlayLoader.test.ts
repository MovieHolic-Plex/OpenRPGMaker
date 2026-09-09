/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { loadBundledAssets } from "@/assets/bundled";
import { PLACEABLE_OVERLAY_TEXTURE_KEYS, PLACEABLE_TREE_GRAPHIC } from "@/player/placeableOverlayGraphics";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { chipsetLoadTextureKey, rawChipsetTextureKey } from "@/assets/chipsetTransparency";

function fakeScene() {
  const images: Array<{ key: string; url: string }> = [];
  return {
    images,
    load: {
      image(key: string, url: string) {
        images.push({ key, url });
      },
      on() {},
    },
  };
}

describe("placeable overlay asset load path", () => {
  it("always queues rock charset and tree chipset textures for the farming starter", () => {
    const scene = fakeScene();
    loadBundledAssets(scene as never, createFarmingDemoProject());
    const keys = new Set(scene.images.map((entry) => entry.key));
    expect(PLACEABLE_OVERLAY_TEXTURE_KEYS).toContain(PLACEABLE_TREE_GRAPHIC.texture);
    expect(PLACEABLE_OVERLAY_TEXTURE_KEYS).toContain("tex_easyrpg_charset_object2");
    // Charsets load under raw key then get color-keyed; chipsets may use load or direct key.
    expect(
      [...keys].some((key) => key.includes("object2"))
    ).toBe(true);
    expect(
      keys.has(PLACEABLE_TREE_GRAPHIC.texture)
      || keys.has(chipsetLoadTextureKey(PLACEABLE_TREE_GRAPHIC.texture))
      || keys.has(rawChipsetTextureKey(PLACEABLE_TREE_GRAPHIC.texture))
    ).toBe(true);
  });
});
