import { describe, expect, it } from "vitest";
import {
  BUNDLED_EASYRPG_CHARSET_ASSETS,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  bundledEasyRpgTilesetId,
} from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

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
      const id = bundledEasyRpgTilesetId(asset.textureKey);
      expect(tileset).toMatchObject({
        name: asset.name,
        image: { type: "bundled", id: asset.textureKey },
        tileSize: 16,
        tilesPerRow: 30,
        count: 480,
      });
      // combined_town은 harness가 메타데이터를 채운 공식 디폴트 칩셋(bundled-default).
      // 나머지 vendored 칩셋은 AI 분류 대기 상태(unknown)이다.
      const expectedSource = id === DEFAULT_TILESET_ID ? "bundled-default" : "unknown";
      expect(tileset.tileMeta?.[0]?.source).toBe(expectedSource);
    }
  });
});
