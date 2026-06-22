import { describe, expect, it } from "vitest";
import {
  BUNDLED_EASYRPG_CHARSET_ASSETS,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  bundledEasyRpgTilesetId,
} from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults";

describe("bundled EasyRPG RTP assets", () => {
  it("exposes vendored chipsets and object charsets as AI-addressable resource profiles", () => {
    const p = createBlankProject();
    const bundledAssetIds = new Set(p.resourceProfiles.map((profile) => profile.assetId));

    for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
      expect(bundledAssetIds.has(asset.textureKey)).toBe(true);
    }
    for (const asset of BUNDLED_EASYRPG_CHARSET_ASSETS) {
      expect(bundledAssetIds.has(asset.textureKey)).toBe(true);
    }
  });

  it("registers vendored chipsets as usable project tilesets", () => {
    const p = createBlankProject();

    for (const asset of BUNDLED_EASYRPG_CHIPSET_ASSETS) {
      const tileset = p.tilesets[bundledEasyRpgTilesetId(asset.textureKey)];
      expect(tileset).toMatchObject({
        name: asset.name,
        image: { type: "bundled", id: asset.textureKey },
        tileSize: 16,
        tilesPerRow: 30,
        count: 480,
      });
      expect(tileset.tileMeta?.[0]?.source).toBe("unknown");
    }
  });
});
