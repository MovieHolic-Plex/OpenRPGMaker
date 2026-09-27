import { describe, expect, it } from "vitest";
import { BATTLE_SKINS, DEFAULT_BATTLE_SKIN_ID, battleSkinFamily, getBattleSkin, listActiveBattleSkinIds, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { BATTLER_PLACEMENTS } from "@/battle/battlerPlacements";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

describe("battle skin registry", () => {
  it("기존 12종과 retro2003을 합쳐 정확히 13개 스킨을 노출한다", () => {
    expect(listBattleSkinIds()).toHaveLength(13);
    expect(new Set(listBattleSkinIds()).size).toBe(13);
  });

  it("13종 전부 활성 — 몬스터 대치를 뺀 12종은 유리 뼈대(정면·측면)의 변형이다(2026-09-25)", () => {
    expect(listActiveBattleSkinIds()).toHaveLength(13);
    expect(listActiveBattleSkinIds().slice(0, 4)).toEqual(["rm2000", "rm2003", "pokemon", "retro2003"]);
    expect(getBattleSkin("rm2000").layout).toBe("frontview");
    expect(getBattleSkin("rm2003").layout).toBe("sideview");
    expect(getBattleSkin("rm2003").showAllySprites).toBe(true);
    for (const id of listBattleSkinIds()) {
      if (id === "pokemon") {
        expect(battleSkinFamily(id)).toBe("pokemon");
        continue;
      }
      const skin = getBattleSkin(id);
      expect(battleSkinFamily(id), id).toBe("glass");
      // 구도는 뼈대가 가진 둘뿐이고, 아군 스프라이트 노출은 구도가 정한다.
      expect(["frontview", "sideview"], id).toContain(skin.layout);
      expect(skin.showAllySprites, id).toBe(skin.layout === "sideview");
      expect(["rows", "boxes", "ring", "minimal"], id).toContain(skin.hudTemplate);
    }
  });

  it("전용 배치를 가진 retro2003 외에는 같은 구도의 배치를 공유한다", () => {
    for (const id of listBattleSkinIds()) {
      if (id === "pokemon" || id === "retro2003") continue;
      const base = getBattleSkin(id).layout === "sideview" ? "rm2003" : "rm2000";
      expect(BATTLER_PLACEMENTS[id], id).toBe(BATTLER_PLACEMENTS[base]);
    }
  });

  it("retro2003은 측면 아군·유리 계열·레트로 모션·겹 배경 계약을 가진다", () => {
    expect(resolveSkinId("retro2003")).toBe("retro2003");
    expect(battleSkinFamily("retro2003")).toBe("glass");
    expect(getBattleSkin("retro2003")).toMatchObject({
      layout: "sideview", showAllySprites: true, motionStyle: "retro", scenery: "layered",
    });
    // 전용 RETRO_SIDEVIEW는 스킨 구현에서 제공한다. 기존 측면 배치와 공유하면 안 된다.
    expect(BATTLER_PLACEMENTS.retro2003).not.toBe(BATTLER_PLACEMENTS.rm2003);
  });

  it("얼굴 카드·링·얇은 HUD 변형이 한 번씩은 쓰인다", () => {
    const huds = new Set(listBattleSkinIds().filter((id) => id !== "pokemon").map((id) => getBattleSkin(id).hudTemplate));
    expect([...huds].sort()).toEqual(["boxes", "minimal", "ring", "rows"]);
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
  it.each(["octopath", "retro2003"] as const)("비-기본 스킨 %s는 그대로 보존한다", (id) => {
    const project = createBlankProject();
    project.system.battleUiStyle = id;
    const out = normalizeSystemRecords(project.system) as { battleUiStyle?: string };
    expect(out.battleUiStyle).toBe(id);
  });

  it("기본 스킨(rm2000)만 생략하고, 명시적 vxace 선택은 보존한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "rm2000";
    expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBeUndefined();
    project.system.battleUiStyle = "vxace";
    expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBe("vxace");
  });
});
