/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { loadBundledAssets, rawCharsetTextureKey } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults";

describe("play boot asset selection", () => {
  it("does not preload catalog chipsets and charsets the starting map never uses", () => {
    // Given a blank project whose tileset catalog and resource profiles list unused art.
    const project = createBlankProject();
    project.resourceProfiles = [
      ...project.resourceProfiles,
      { kind: "chipset", name: "배", assetId: "tex_easyrpg_chipset_ship" },
      { kind: "charset", name: "탈것", assetId: "tex_easyrpg_charset_vehicles" },
    ];
    const keys = new Set<string>();

    // When the play preloader queues images.
    loadBundledAssets({
      load: {
        image(key: string) {
          keys.add(key);
        },
        on() {
          return undefined;
        },
      },
    }, project);

    // Then the start map's chipset and the hero charset load, and catalog-only art does not.
    expect(keys.has("tex_easyrpg_chipset_combined_town")).toBe(true);
    expect(keys.has(rawCharsetTextureKey("tex_easyrpg_charset_actor1"))).toBe(true);
    expect(keys.has("tex_easyrpg_chipset_ship")).toBe(false);
    expect(keys.has("tex_forest_harmony")).toBe(false);
    expect(keys.has(rawCharsetTextureKey("tex_easyrpg_charset_vehicles"))).toBe(false);
  });
});
