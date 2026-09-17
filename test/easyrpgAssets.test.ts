import { describe, expect, it } from "vitest";
import {
  BUNDLED_EASYRPG_CHARSET_ASSETS,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  bundledChipsetFrameCount,
  bundledEasyRpgTilesetId,
} from "@/assets/bundled";
import { isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";
import { EASYRPG_CHIPSET_ASSETS } from "@/assets/easyrpgRtp";
import { inspectPngBytes } from "@/assets/pngInspection";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledResourceProfiles } from "@/project/defaults/defaultAssets";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

type BinaryFsReader = {
  readonly existsSync: (path: URL) => boolean;
  readonly readFileSync: (path: URL) => Uint8Array;
};

const loadBinaryFs = async (): Promise<BinaryFsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as BinaryFsReader;
};

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
      // 확장 시트(Tibo 실내 확장 1980칸·합본 마을+레트로 월드맵 960칸)는 480 이 아니다 —
      // 번들 목록이 말하는 칸 수와 타일셋 정의가 같아야 한다.
      expect(tileset).toMatchObject({
        name: asset.name,
        image: { type: "bundled", id: asset.textureKey },
        tileSize: 16,
        tilesPerRow: 30,
        count: bundledChipsetFrameCount(asset.textureKey),
      });
      // combined_town은 harness가 메타데이터를 채운 공식 디폴트 칩셋(bundled-default).
      // 테마 팩(interior/dungeon/scarloxy)이 있는 칩셋은 팩이 덮는 타일만 bundled-default,
      // 그 외 vendored 칩셋 타일은 AI 분류 대기 상태(unknown)이다.
      const source = tileset.tileMeta?.[0]?.source;
      if (id === DEFAULT_TILESET_ID) {
        expect(source).toBe("bundled-default");
      } else {
        expect(["bundled-default", "unknown"]).toContain(source);
      }
    }
  });

  it("exposes synced EasyRPG RTP ChipSet package entries as resource profiles", () => {
    const p = createBlankProject();
    const exterior = EASYRPG_CHIPSET_ASSETS.find((asset) => asset.id === "easyrpg-chipset-exterior");
    const profile = p.resourceProfiles.find((resourceProfile) => resourceProfile.assetId === "easyrpg-chipset-exterior");

    expect(exterior).toMatchObject({
      path: "assets/easyrpg/chipset/Exterior.png",
      sourcePath: "ChipSet/Exterior.png",
    });
    expect(profile).toMatchObject({
      kind: "chipset",
      name: "Exterior · 타일 그림판 · EasyRPG",
      tileWidth: 16,
      tileHeight: 16,
      imageWidth: 480,
      imageHeight: 256,
      assetId: "easyrpg-chipset-exterior",
    });
  });

  it("adds synced EasyRPG RTP package profiles to saved projects that predate them", () => {
    const p = createBlankProject();
    p.resourceProfiles = p.resourceProfiles.filter((profile) => profile.assetId !== "easyrpg-chipset-exterior");

    expect(ensureBundledResourceProfiles(p)).toBe(true);
    expect(p.resourceProfiles.find((profile) => profile.assetId === "easyrpg-chipset-exterior")).toMatchObject({
      kind: "chipset",
      imageWidth: 480,
      imageHeight: 256,
    });
  });

  it("ships color-keyed EasyRPG chipsets with baked transparency for DOM previews", async () => {
    const { existsSync, readFileSync } = await loadBinaryFs();
    const colorKeyedAssets = BUNDLED_EASYRPG_CHIPSET_ASSETS.filter((asset) =>
      isColorKeyedChipsetTextureKey(asset.textureKey),
    );

    expect(colorKeyedAssets.map((asset) => asset.textureKey)).toEqual([
      "tex_easyrpg_chipset_dungeon",
      "tex_easyrpg_chipset_interior",
      "tex_easyrpg_chipset_retro_dungeon",
    ]);

    for (const asset of colorKeyedAssets) {
      const imageUrl = new URL(`../public/${asset.path}`, import.meta.url);

      expect(existsSync(imageUrl), `${asset.name} PNG is missing at ${asset.path}`).toBe(true);
      const inspection = await inspectPngBytes(readFileSync(imageUrl));
      expect(inspection.ok ? inspection.inspection.transparentPixels : 0, `${asset.name} has no transparent pixels`).toBeGreaterThan(
        0,
      );
      expect(inspection.ok ? inspection.inspection.opaqueColorKeyPixels : -1, `${asset.name} still has opaque color-key pixels`).toBe(0);
    }
  });
});
