import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { seedHomeDungeonComplexTroops } from "@/project/defaults/complexMonsterAuthoring";

describe("database image matching", () => {
  it("assigns unique matching monster graphics for default enemies and species", () => {
    const project = createBlankProject();
    // 몬스터 다이어트(2026-08-30) 뒤의 실측 로스터: 적 106종이 전부 생성 배틀러 아트를 쓰고,
    // 그중 한 쌍만 의도적으로 아트를 공유한다(species_king_slime → slime). 예전 계약은 종족 9종과
    // `generated-enemy-leafling-01` 같은 지금 없는 아트를 요구해 데이터가 줄어든 뒤에도 남아 있었다.
    const monsterIds = project.database.enemies.map((enemy) => enemy.monsterResourceId);
    const generatedIds = monsterIds.filter((id) => id?.startsWith("generated-enemy-"));
    expect(generatedIds.length).toBe(monsterIds.length);
    expect(generatedIds.length).toBeGreaterThanOrEqual(100);
    // 아트 공유는 «이름이 다른 친척» 한 계열만 허용한다 — 그 외 중복은 매칭 실패로 본다.
    expect(generatedIds.length - new Set(generatedIds).size).toBeLessThanOrEqual(1);
    for (const id of monsterIds) {
      expect(resolveAssetResourceUrl(id), id).toBeTruthy();
    }

    const bySpecies = Object.fromEntries(
      (project.database.monsterSpecies ?? []).map((species) => [species.id, species.graphic.monsterResourceId]),
    );
    expect(Object.keys(bySpecies).sort()).toEqual([
      "species_cave_bat", "species_ember_drake", "species_king_slime", "species_stone_golem", "species_wild_slime",
    ]);
    expect(bySpecies.species_wild_slime).toBe("generated-enemy-slime-01");
    expect(bySpecies.species_king_slime).toBe("generated-enemy-slime-01");
    expect(bySpecies.species_cave_bat).toBe("generated-enemy-bat-01");
    expect(bySpecies.species_stone_golem).toBe("generated-enemy-golem-01");
    expect(bySpecies.species_ember_drake).toBe("generated-enemy-dragon-01");
    for (const id of Object.values(bySpecies)) {
      expect(resolveAssetResourceUrl(id), id).toBeTruthy();
    }
  });

  it("uses distinct item and equipment icons for similar gear tiers", () => {
    const project = createBlankProject();
    const iron = project.database.equipment.find((entry) => entry.id === "equip_iron_sword");
    const steel = project.database.equipment.find((entry) => entry.id === "equip_steel_sword");
    const bronze = project.database.equipment.find((entry) => entry.id === "equip_sword");
    expect(bronze?.iconResourceId).toBe("cc0-jetrel-bronze-sword");
    expect(iron?.iconResourceId).toBe("cc0-jetrel-iron-sword");
    expect(steel?.iconResourceId).toBe("cc0-jetrel-steel-sword");

    const capture = project.database.items.find((item) => item.id === "item_capture_orb");
    const hiPotion = project.database.items.find((item) => item.id === "item_hi_potion");
    const elixir = project.database.items.find((item) => item.id === "item_elixir");
    const panacea = project.database.items.find((item) => item.id === "item_panacea");
    expect(capture?.iconResourceId).toBe("cc0-jetrel-capture-orb");
    expect(hiPotion?.iconResourceId).toBe("cc0-jetrel-hi-potion");
    expect(elixir?.iconResourceId).toBe("cc0-jetrel-elixir");
    expect(panacea?.iconResourceId).toBe("cc0-jetrel-panacea");

    for (const id of [
      bronze?.iconResourceId,
      iron?.iconResourceId,
      steel?.iconResourceId,
      capture?.iconResourceId,
      hiPotion?.iconResourceId,
      elixir?.iconResourceId,
      panacea?.iconResourceId,
    ]) {
      expect(resolveAssetResourceUrl(id), String(id)).toBeTruthy();
    }
  });

  it("seeds dungeon bone guards with skeleton art instead of bat art", () => {
    const project = createBlankProject();
    const { enemies } = seedHomeDungeonComplexTroops(project);
    const bone = enemies.find((enemy) => enemy.id === "enemy_stone_bone_guard");
    expect(bone?.monsterResourceId).toBe("generated-enemy-skeleton-01");
    expect(resolveAssetResourceUrl("generated-enemy-skeleton-01")).toBe(
      "/assets/generated/starter/monster-skeleton-01.png",
    );
  });
});
