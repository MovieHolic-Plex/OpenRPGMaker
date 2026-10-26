import { describe, expect, it } from "vitest";
import {
  BUNDLED_EASYRPG_CHARSET_ASSETS,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  bundledChipsetFrameCount,
  bundledChipsetTileSize,
  bundledChipsetTilesPerRow,
  bundledEasyRpgTilesetId,
} from "@/assets/bundled";
import { isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";
import { EASYRPG_CHIPSET_ASSETS } from "@/assets/easyrpgRtp";
import { inspectPngBytes } from "@/assets/pngInspection";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledResourceProfiles } from "@/project/defaults/defaultAssets";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";

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
        tileSize: bundledChipsetTileSize(asset.textureKey),
        tilesPerRow: bundledChipsetTilesPerRow(asset.textureKey),
        count: bundledChipsetFrameCount(asset.textureKey),
      });
      // 2026-10-07 저작권 정리 뒤 이 목록은 손 도트 번들 시트다(합본 마을은 빠졌다 — expect 아래).
      // 칸 메타가 있는 시트는 bundled-default/unknown 으로 시작한다. 버들항 덧그림 시트(warm_trees·door·ground…)는
      // 칸 메타 없이 kit/조각 정의만 들고 다니므로 tileMeta 가 비어 있다 — 그때는 출처 칸이 없다.
      expect(id).not.toBe(COMBINED_TOWN_TILESET_ID);
      if (Object.keys(tileset.tileMeta ?? {}).length === 0) continue;
      const source = tileset.tileMeta?.[0]?.source;
      expect(["bundled-default", "unknown"], id).toContain(source);
    }
  });

  // 2026-10-07 저작권 정리(#2335): EasyRPG ChipSet 패키지 항목을 비웠고 Exterior 시트·프로필도 지웠다 — 되살아나지 않아야 한다.
  it("no longer exposes the purged EasyRPG RTP ChipSet entries as resource profiles", () => {
    const p = createBlankProject();
    expect(EASYRPG_CHIPSET_ASSETS).toEqual([]);
    expect(p.resourceProfiles.find((resourceProfile) => resourceProfile.assetId === "easyrpg-chipset-exterior")).toBeUndefined();
  });

  it("does not re-add the purged Exterior profile to saved projects", () => {
    const p = createBlankProject();
    p.resourceProfiles = p.resourceProfiles.filter((profile) => profile.assetId !== "easyrpg-chipset-exterior");
    ensureBundledResourceProfiles(p);
    expect(p.resourceProfiles.find((profile) => profile.assetId === "easyrpg-chipset-exterior")).toBeUndefined();
  });

  it("ships color-keyed EasyRPG chipsets with baked transparency for DOM previews", async () => {
    const { existsSync, readFileSync } = await loadBinaryFs();
    const colorKeyedAssets = BUNDLED_EASYRPG_CHIPSET_ASSETS.filter((asset) =>
      isColorKeyedChipsetTextureKey(asset.textureKey),
    );

    // 색 키 시트 셋(EasyRPG 던전·실내·레트로 던전)은 2026-10-07 저작권 정리로 번들에서 빠졌다 — 지금 번들 시트는 모두 진짜 투명이다.
    // 색 키 시트가 다시 들어오면 아래 반복이 구운 투명을 검사한다.
    expect(colorKeyedAssets.map((asset) => asset.textureKey)).toEqual([]);

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
