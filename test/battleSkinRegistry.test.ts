import { describe, expect, it } from "vitest";
import { BATTLE_SKINS, getBattleSkin, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

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

describe("skin dataset wiring", () => {
  it("resolveSkinId는 dataset에 넣기 안전한 문자열만 반환한다", () => {
    for (const v of [undefined, "classic", "pokemon", "mother", "zzz"]) {
      expect(resolveSkinId(v)).toMatch(/^[a-z0-9]+$/);
    }
  });
});

describe("battle skin assets", () => {
  it("모든 스킨은 DB에 등록된(해석 가능한) 기본 배경을 가진다", () => {
    const ids = new Set(builtinGeneratedResourceIds());
    for (const id of listBattleSkinIds()) {
      const skin = getBattleSkin(id);
      expect(skin.defaultBackdropResourceId, `${id} missing backdrop`).toBeTruthy();
      expect(ids.has(skin.defaultBackdropResourceId!), `${id} backdrop not in DB feed`).toBe(true);
      expect(resolveAssetResourceUrl(skin.defaultBackdropResourceId)).toMatch(/battle-skins\/.*\.png$/);
    }
  });

  it("데모 배틀러(크로마키 처리본)가 DB에 등록되어 해석된다", () => {
    expect(builtinGeneratedResourceIds()).toContain("battle-skin-demo-battler");
    expect(resolveAssetResourceUrl("battle-skin-demo-battler")).toBe("/assets/generated/battle-skins/demo-battler-alpha.png");
  });
});

describe("battleUiStyle serialization", () => {
  it("비-기본 스킨 id는 그대로 보존한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "octopath";
    const out = normalizeSystemRecords(project.system) as { battleUiStyle?: string };
    expect(out.battleUiStyle).toBe("octopath");
  });

  it("기본(rm2003) 및 미설정은 생략한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "rm2003";
    const out = normalizeSystemRecords(project.system) as { battleUiStyle?: string };
    expect(out.battleUiStyle).toBeUndefined();
  });
});
