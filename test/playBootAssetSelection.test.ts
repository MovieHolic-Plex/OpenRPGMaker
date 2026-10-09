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

  it("does not preload field sprites for enemies that are only in the catalog", () => {
    // Given the blank database, whose enemy and species rows name every starter monster.
    const project = createBlankProject();
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

    // Then no generated field sprite is queued. The blank map has no field spawn.
    expect([...keys].some((key) => key.startsWith("generated-enemy-"))).toBe(false);
  });
});
