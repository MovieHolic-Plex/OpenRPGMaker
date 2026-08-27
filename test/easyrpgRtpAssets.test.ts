import { describe, expect, it } from "vitest";
import {
  CHIPSET_SLICING,
  EASYRPG_CHARSET_ASSETS,
  EASYRPG_RTP_CATEGORY_SLICING,
  EASYRPG_RTP_ASSETS,
  FACESET_FACE_HEIGHT,
  FACESET_FACE_WIDTH,
  FACESET_SLICING,
  LEGACY_FACESET_SHEET_ASSETS,
  charsetFrameIndex,
  decodeCharsetFrameIndex,
} from "@/assets/easyrpgRtp";
import { FACE_IMAGE_SIZE, RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { defaultResourceProfiles } from "@/project/defaults/defaultAssets";

type FsLike = {
  readonly existsSync: (path: string) => boolean;
};

const loadFs = async (): Promise<FsLike> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as FsLike;
};

describe("EasyRPG RTP asset manifest", () => {
  it("lists the inspected EasyRPG RTP asset categories when the scoped RTP import is generated", () => {
    const categories = new Set(EASYRPG_RTP_ASSETS.map((asset) => asset.category));

    expect(categories).toEqual(
      new Set([
        "backdrop",
        "battle",
        "battleWeapon",
        "charset",
        "chipset",
        "faceset",
        "gameOver",
        "monster",
        "music",
        "picture",
        "sound",
        "system",
        "system2",
        "title",
      ])
    );
    expect(EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "chipset")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "easyrpg-chipset-exterior",
          path: "assets/easyrpg/chipset/Exterior.png",
          sourcePath: "ChipSet/Exterior.png",
        }),
      ])
    );
    expect(EASYRPG_CHARSET_ASSETS.length).toBeGreaterThanOrEqual(17);
  });

  it("exports EasyRPG RTP category slicing from the shared resource ontology", () => {
    expect(EASYRPG_RTP_CATEGORY_SLICING.chipset).toBe(RESOURCE_SLICING.chipset);
    expect(EASYRPG_RTP_CATEGORY_SLICING.faceset).toBe(RESOURCE_SLICING.faceset);
    expect(EASYRPG_RTP_CATEGORY_SLICING.title).toBe(RESOURCE_SLICING.title);
    expect(CHIPSET_SLICING).toMatchObject({ cellWidth: 16, cellHeight: 16, columns: 30, rows: 16 });
    expect(FACESET_SLICING).toEqual({ kind: "whole-image", unit: "image" });
    expect(FACESET_FACE_WIDTH).toBe(FACE_IMAGE_SIZE);
    expect(FACESET_FACE_HEIGHT).toBe(FACE_IMAGE_SIZE);
  });

  it("keeps the 5 pre-split faceset sheets registered as legacy resources", () => {
    expect(LEGACY_FACESET_SHEET_ASSETS.map((asset) => asset.id)).toEqual([
      "easyrpg-faceset-actor1",
      "easyrpg-faceset-actor2",
      "easyrpg-faceset-monster",
      "easyrpg-faceset-people1",
      "easyrpg-faceset-people2",
    ]);
  });

  it("keeps every generated EasyRPG RTP manifest entry available as a bundled file and resource profile", async () => {
    const fs = await loadFs();
    expect(EASYRPG_RTP_ASSETS.length).toBe(188);

    const missingFiles = EASYRPG_RTP_ASSETS
      .filter((asset) => !fs.existsSync(`public/${asset.path}`))
      .map((asset) => `${asset.id}:${asset.path}`);

    expect(missingFiles).toEqual([]);

    const profileAssetIds = new Set(defaultResourceProfiles().map((profile) => profile.assetId));
    const missingProfiles = EASYRPG_RTP_ASSETS
      .filter((asset) => !profileAssetIds.has(asset.id))
      .map((asset) => `${asset.id}:${asset.category}`);

    expect(missingProfiles).toEqual([]);
  });

  it("maps RPG Maker 2000 CharSet character selections to 24x32 spritesheet frame indexes", () => {
    expect(charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 })).toBe(25);
    expect(charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 })).toBe(28);
    expect(charsetFrameIndex({ characterIndex: 4, direction: "down", pattern: 1 })).toBe(73);
    expect(charsetFrameIndex({ characterIndex: 4, direction: "up", pattern: 2 })).toBe(50);
  });

  it("decodes frame indexes back into NPC picker selections", () => {
    expect(decodeCharsetFrameIndex(73)).toEqual({
      characterIndex: 4,
      direction: "down",
      pattern: 1,
    });
  });
});
