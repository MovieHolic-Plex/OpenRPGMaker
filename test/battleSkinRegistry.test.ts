import { describe, expect, it } from "vitest";
import { BATTLE_SKINS, getBattleSkin, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";

describe("battle skin registry", () => {
  it("정확히 10개 스킨을 노출한다", () => {
    expect(listBattleSkinIds()).toHaveLength(10);
    expect(new Set(listBattleSkinIds()).size).toBe(10);
  });

  it("모든 스킨은 label·layout·themeVars를 갖는다", () => {
    for (const id of listBattleSkinIds()) {
      const skin = getBattleSkin(id);
      expect(skin.id).toBe(id);
      expect(skin.label.length).toBeGreaterThan(0);
      expect(["sideview", "frontview", "active", "firstperson"]).toContain(skin.layout);
      expect(Object.keys(skin.themeVars).length).toBeGreaterThan(0);
    }
  });

  it("legacy 값을 매핑한다(back-compat)", () => {
    expect(resolveSkinId(undefined)).toBe("rm2003");
    expect(resolveSkinId("classic")).toBe("rm2003");
    expect(resolveSkinId("pokemon")).toBe("pokemon");
    expect(resolveSkinId("octopath")).toBe("octopath");
    expect(resolveSkinId("bogus")).toBe("rm2003");
  });

  it("BATTLE_SKINS 키와 id가 일치한다", () => {
    for (const [key, skin] of Object.entries(BATTLE_SKINS)) expect(skin.id).toBe(key);
  });
});
