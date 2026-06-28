import { describe, expect, it } from "vitest";
import {
  EASYRPG_CHARSET_ASSETS,
  EASYRPG_RTP_ASSETS,
  charsetFrameIndex,
  decodeCharsetFrameIndex,
} from "@/assets/easyrpgRtp";
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
