import { describe, expect, it } from "vitest";
import { BATTLE_SKINS, DEFAULT_BATTLE_SKIN_ID, battleSkinFamily, getBattleSkin, listActiveBattleSkinIds, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

describe("battle skin registry", () => {
  it("정확히 12개 스킨을 노출한다(2026-09-03: 정면 rm2000 개명 + 측면 rm2003 되살림, deprecated 감청 rm2000 흡수)", () => {
    expect(listBattleSkinIds()).toHaveLength(12);
    expect(new Set(listBattleSkinIds()).size).toBe(12);
  });

  it("활성 스킨은 셋 — 몬스터 대치(pokemon) · 정면(rm2000) · 측면(rm2003)", () => {
    expect(listActiveBattleSkinIds()).toEqual(["pokemon", "rm2000", "rm2003"]);
    expect(getBattleSkin("rm2000").layout).toBe("frontview");
    expect(getBattleSkin("rm2003").layout).toBe("sideview");
    expect(getBattleSkin("rm2003").showAllySprites).toBe(true);
    // 두 턴제 스킨은 유리 HUD 한 파일(_rm2000.css)을 나눠 쓴다 — 루트 data-battle-skin-family 로 스코프.
    expect(battleSkinFamily("rm2000")).toBe("glass");
    expect(battleSkinFamily("rm2003")).toBe("glass");
    expect(battleSkinFamily("pokemon")).toBe("pokemon");
  });

  it("mv 스킨이 등록되어 있고 기존 9종은 그대로 유지된다", () => {
    const ids = listBattleSkinIds();
    const legacy = [
      "pokemon", "rm2000", "octopath", "chrono",
      "bravely", "dragonquest", "ff", "mother", "goldensun",
    ] as const;
    for (const id of legacy) expect(ids).toContain(id);
    expect(ids).toContain("mv");
    expect(resolveSkinId("mv")).toBe("mv");
  });

  it("rm2000 이 기본 스킨이다", () => {
    expect(DEFAULT_BATTLE_SKIN_ID).toBe("rm2000");
    expect(resolveSkinId(undefined)).toBe("rm2000");
    expect(getBattleSkin("rm2000").showAllySprites).toBe(false);
  });

  it("rm2003 은 측면 스킨 자기 자신으로 풀리고, 옛 별칭 classic 만 rm2000 으로 간다", () => {
    expect(resolveSkinId("rm2003")).toBe("rm2003");
    expect(resolveSkinId("classic")).toBe("rm2000");
    expect(listBattleSkinIds()).toContain("rm2003");
  });

  it("vxace 스킨이 등록되어 있다", () => {
    expect(listBattleSkinIds()).toContain("vxace");
    expect(resolveSkinId("vxace")).toBe("vxace");
    expect(getBattleSkin("vxace").layout).toBe("frontview");
    expect(getBattleSkin("vxace").showAllySprites).toBe(false);
    expect(getBattleSkin("rm2000").showAllySprites).toBe(false);
    expect(getBattleSkin("rm2000").layout).toBe("frontview");
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
    // 미설정/미지의 값 → 기본 스킨(rm2000). legacy "classic" 은 rm2000 으로 풀리고, rm2003 은 측면 스킨 자신이다.
    expect(resolveSkinId(undefined)).toBe("rm2000");
    expect(resolveSkinId("classic")).toBe("rm2000");
    expect(resolveSkinId("rm2003")).toBe("rm2003");
    expect(resolveSkinId("pokemon")).toBe("pokemon");
    expect(resolveSkinId("octopath")).toBe("octopath");
    expect(resolveSkinId("bogus")).toBe("rm2000");
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

  it("기본 스킨(rm2000)만 생략하고, 명시적 vxace 선택은 보존한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "rm2000";
    expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBeUndefined();
    project.system.battleUiStyle = "vxace";
    expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBe("vxace");
  });
});
