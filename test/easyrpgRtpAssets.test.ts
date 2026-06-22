import { describe, expect, it } from "vitest";
import {
  EASYRPG_CHARSET_ASSETS,
  EASYRPG_RTP_ASSETS,
  charsetFrameIndex,
  decodeCharsetFrameIndex,
} from "@/assets/easyrpgRtp";

describe("EasyRPG RTP asset manifest", () => {
  it("lists the inspected non-tileset EasyRPG RTP asset categories when the scoped RTP import is generated", () => {
    const categories = new Set(EASYRPG_RTP_ASSETS.map((asset) => asset.category));

    expect(categories).toEqual(
      new Set([
        "backdrop",
        "battle",
        "battleWeapon",
        "charset",
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
    expect(EASYRPG_CHARSET_ASSETS.length).toBeGreaterThanOrEqual(17);
  });

  it("maps RPG Maker 2000 CharSet character selections to 24x32 spritesheet frame indexes", () => {
    expect(charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 })).toBe(1);
    expect(charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 })).toBe(4);
    expect(charsetFrameIndex({ characterIndex: 4, direction: "up", pattern: 2 })).toBe(86);
  });

  it("decodes frame indexes back into NPC picker selections", () => {
    expect(decodeCharsetFrameIndex(86)).toEqual({
      characterIndex: 4,
      direction: "up",
      pattern: 2,
    });
  });
});
