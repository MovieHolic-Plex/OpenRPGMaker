import { describe, expect, it } from "vitest";
import { BATTLE_SKINS, DEFAULT_BATTLE_SKIN_ID, battleSkinFamily, getBattleSkin, isRetiredBattleSkinId, listActiveBattleSkinIds, listBattleSkinIds, resolveSkinId, retiredSkinLookWindow } from "@/battle/skins/registry";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { BATTLER_PLACEMENTS } from "@/battle/battlerPlacements";
import { defaultSystem } from "@/project/defaults/defaultDatabase";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

describe("battle skin registry", () => {
  it("도트 측면(retro2003)과 포켓몬, 정확히 2개 스킨만 남는다(2026-10-02 RM2003 식만 남기는 정리)", () => {
    expect([...listBattleSkinIds()].sort()).toEqual(["pokemon", "retro2003"]);
    expect(listActiveBattleSkinIds()).toEqual(["retro2003", "pokemon"]);
  });

  it("남은 스킨의 구도·묶음 계약", () => {
    for (const id of listBattleSkinIds()) {
      if (id === "pokemon") {
        expect(battleSkinFamily(id)).toBe("pokemon");
        expect(getBattleSkin(id).layout).toBe("frontview");
        continue;
      }
      const skin = getBattleSkin(id);
      expect(battleSkinFamily(id), id).toBe("glass");
      expect(skin.layout, id).toBe("sideview");
      expect(skin.showAllySprites, id).toBe(true);
      expect(skin.hudTemplate, id).toBe("rows");
    }
  });

  it("측면 스킨은 모두 도트 측면 뼈대(retro2003)의 배치를 공유한다", () => {
    for (const id of listBattleSkinIds()) {
      if (id === "pokemon") continue;
      expect(BATTLER_PLACEMENTS[id], id).toBe(BATTLER_PLACEMENTS.retro2003);
    }
    expect(Object.keys(BATTLER_PLACEMENTS).sort()).toEqual([...listBattleSkinIds()].sort());
  });

  it("측면 스킨은 모두 도트 측면 전투 뼈대 위의 창 모양이다(2026-10-01)", () => {
    for (const id of listBattleSkinIds()) {
      const skin = getBattleSkin(id);
      if (skin.layout !== "sideview") continue;
      expect(skin, id).toMatchObject({ motionStyle: "retro", scenery: "layered", hudTemplate: "rows" });
    }
  });

  it("retro2003은 측면 아군·유리 계열·레트로 모션·겹 배경 계약을 가진다", () => {
    expect(resolveSkinId("retro2003")).toBe("retro2003");
    expect(battleSkinFamily("retro2003")).toBe("glass");
    expect(getBattleSkin("retro2003")).toMatchObject({
      layout: "sideview", showAllySprites: true, motionStyle: "retro", scenery: "layered",
    });
  });

  it("HUD 변형: 측면 스킨은 줄(rows)만, 박스는 포켓몬만 쓴다", () => {
    const huds = new Set(listBattleSkinIds().filter((id) => id !== "pokemon").map((id) => getBattleSkin(id).hudTemplate));
    expect([...huds]).toEqual(["rows"]);
    expect(getBattleSkin("pokemon").hudTemplate).toBe("boxes");
  });

  it("지운 정면 스킨 다섯은 등록되어 있지 않고 저장값은 retro2003 으로 풀린다", () => {
    const ids = listBattleSkinIds() as string[];
    for (const id of ["rm2000", "dragonquest", "mother", "mv", "vxace", "classic"]) {
      expect(ids, id).not.toContain(id);
      expect(resolveSkinId(id), id).toBe("retro2003");
      expect(isRetiredBattleSkinId(id), id).toBe(true);
    }
    expect(isRetiredBattleSkinId("retro2003")).toBe(false);
    expect(isRetiredBattleSkinId("pokemon")).toBe(false);
  });

  it("창 색만 다르던 측면 스킨 여섯도 지웠다 — 저장값은 retro2003 으로 풀리고 창 색은 꾸밈 창으로 옮길 곳을 준다", () => {
    const ids = listBattleSkinIds() as string[];
    for (const id of ["rm2003", "octopath", "chrono", "bravely", "ff", "goldensun"]) {
      expect(ids, id).not.toContain(id);
      expect(resolveSkinId(id), id).toBe("retro2003");
      expect(isRetiredBattleSkinId(id), id).toBe(true);
    }
    expect(retiredSkinLookWindow("octopath")).toBe("ink");
    expect(retiredSkinLookWindow("chrono")).toBe("teal");
    expect(retiredSkinLookWindow("bravely")).toBe("parch");
    expect(retiredSkinLookWindow("goldensun")).toBe("gold");
    expect(retiredSkinLookWindow("rm2003")).toBe("veil");
    expect(retiredSkinLookWindow("ff")).toBeUndefined();
    expect(retiredSkinLookWindow("retro2003")).toBeUndefined();
  });

  it("새 프로젝트는 retro2003 으로 열리고, 기본값이라 직렬화에서는 생략된다", () => {
    const project = createBlankProject();
    expect(project.system.battleUiStyle).toBe("retro2003");
    expect(normalizeSystemRecords(project.system).battleUiStyle).toBeUndefined();
  });

  it("미설정 기존 프로젝트는 retro2003 으로 열린다", () => {
    expect(DEFAULT_BATTLE_SKIN_ID).toBe("retro2003");
    expect(resolveSkinId(undefined)).toBe("retro2003");
    expect(defaultSystem().battleUiStyle).toBeUndefined();
    expect(getBattleSkin("retro2003").showAllySprites).toBe(true);
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
    // 미설정/미지의 값·지운 스킨 → 기본 스킨(retro2003).
    expect(resolveSkinId(undefined)).toBe("retro2003");
    expect(resolveSkinId("classic")).toBe("retro2003");
    expect(resolveSkinId("rm2000")).toBe("retro2003");
    expect(resolveSkinId("rm2003")).toBe("retro2003");
    expect(resolveSkinId("pokemon")).toBe("pokemon");
    expect(resolveSkinId("octopath")).toBe("retro2003");
    expect(resolveSkinId("bogus")).toBe("retro2003");
  });

  it("BATTLE_SKINS 키와 id가 일치한다", () => {
    for (const [key, skin] of Object.entries(BATTLE_SKINS)) expect(skin.id).toBe(key);
  });

  it("측면 스킨은 모두 같은 themeVars 키 집합을 쓴다", () => {
    const baseKeys = Object.keys(getBattleSkin("retro2003").themeVars).sort();
    for (const id of listBattleSkinIds()) {
      if (id === "pokemon") continue;
      expect(Object.keys(getBattleSkin(id).themeVars).sort(), id).toEqual(baseKeys);
    }
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
  it("비-기본 스킨 pokemon 은 그대로 보존한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "pokemon";
    const out = normalizeSystemRecords(project.system) as { battleUiStyle?: string };
    expect(out.battleUiStyle).toBe("pokemon");
  });

  it("기본 스킨(retro2003)과 지운 스킨은 생략한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "retro2003";
    expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBeUndefined();
    for (const id of ["vxace", "rm2003", "octopath"]) {
      (project.system as { battleUiStyle?: string }).battleUiStyle = id;
      expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle, id).toBeUndefined();
    }
  });

  it("지운 측면 스킨의 창 색은 꾸밈을 안 건드린 프로젝트에서만 꾸밈 창으로 옮긴다", () => {
    const project = createBlankProject();
    const system = project.system as { battleUiStyle?: string; battleLook?: unknown };
    system.battleUiStyle = "octopath";
    delete system.battleLook;
    expect(normalizeSystemRecords(project.system).battleLook).toEqual({ window: "ink" });
    system.battleUiStyle = "chrono";
    system.battleLook = { accent: "#ff0000" };
    expect(normalizeSystemRecords(project.system).battleLook).toEqual({ window: "teal", accent: "#ff0000" });
    // 꾸밈 프리셋·창을 이미 고른 프로젝트는 그 꾸밈이 보이고 있었다 — 그대로 둔다.
    system.battleUiStyle = "goldensun";
    system.battleLook = { preset: "parch" };
    expect(normalizeSystemRecords(project.system).battleLook).toEqual({ preset: "parch" });
    system.battleUiStyle = "ff";
    delete system.battleLook;
    expect(normalizeSystemRecords(project.system).battleLook).toBeUndefined();
  });
});
