import { describe, expect, it } from "vitest";
import { BATTLE_SKINS, getBattleSkin, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

describe("battle skin registry", () => {
  it("정확히 12개 스킨을 노출한다", () => {
    expect(listBattleSkinIds()).toHaveLength(12);
    expect(new Set(listBattleSkinIds()).size).toBe(12);
  });

  it("mv 스킨이 등록되어 있고 기존 10종은 그대로 유지된다", () => {
    const ids = listBattleSkinIds();
    const legacy = [
      "pokemon", "rm2003", "rm2000", "octopath", "chrono",
      "bravely", "dragonquest", "ff", "mother", "goldensun",
    ] as const;
    for (const id of legacy) expect(ids).toContain(id);
    expect(ids).toContain("mv");
    expect(resolveSkinId("mv")).toBe("mv");
  });

  it("vxace 스킨이 등록되어 있고 기본 스킨이다", () => {
    expect(listBattleSkinIds()).toContain("vxace");
    expect(resolveSkinId("vxace")).toBe("vxace");
    expect(getBattleSkin("vxace").layout).toBe("frontview");
    expect(getBattleSkin("vxace").showAllySprites).toBe(false);
    expect(resolveSkinId(undefined)).toBe("vxace");
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
    // 미설정/미지의 값 → 기본 스킨(vxace). legacy "classic" 은 계속 rm2003 으로 남는다.
    expect(resolveSkinId(undefined)).toBe("vxace");
    expect(resolveSkinId("classic")).toBe("rm2003");
    expect(resolveSkinId("pokemon")).toBe("pokemon");
    expect(resolveSkinId("octopath")).toBe("octopath");
    expect(resolveSkinId("bogus")).toBe("vxace");
  });

  it("BATTLE_SKINS 키와 id가 일치한다", () => {
    for (const [key, skin] of Object.entries(BATTLE_SKINS)) expect(skin.id).toBe(key);
  });

  it("mv 스킨은 기존 스킨과 동일한 themeVars 키 집합을 쓴다", () => {
    const mvKeys = Object.keys(getBattleSkin("mv").themeVars).sort();
    const rm2000Keys = Object.keys(getBattleSkin("rm2000").themeVars).sort();
    expect(mvKeys).toEqual(rm2000Keys);
    expect(getBattleSkin("mv").layout).toBe("frontview");
    expect(getBattleSkin("mv").showAllySprites).toBe(false);
    expect(getBattleSkin("mv").hudTemplate).toBe("rows");
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

  it("기본 스킨(vxace)만 생략하고, 명시적 rm2003 선택은 보존한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "vxace";
    expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBeUndefined();
    // 기본이 vxace 로 바뀐 뒤에는 rm2003 을 생략하면 왕복 후 vxace 로 바뀌어버린다.
    project.system.battleUiStyle = "rm2003";
    expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBe("rm2003");
  });
});
