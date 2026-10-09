import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { seedHomeDungeonComplexTroops } from "@/project/defaults/complexMonsterAuthoring";

describe("database image matching", () => {
  it("assigns unique matching monster graphics for default enemies and species", () => {
    const project = createBlankProject();
    // Only these two role-identical pairs may share art; unrelated duplicates fail.
    const monsterIds = project.database.enemies.map((enemy) => enemy.monsterResourceId);
    const generatedIds = monsterIds.filter((id) => id?.startsWith("generated-enemy-"));
    expect(generatedIds.length).toBe(monsterIds.length);
    expect(generatedIds.length).toBeGreaterThanOrEqual(100);
    const shared = Object.fromEntries([...new Set(monsterIds)].flatMap((resourceId) => {
      const ids = project.database.enemies.filter((enemy) => enemy.monsterResourceId === resourceId).map((enemy) => enemy.id).sort();
      return ids.length > 1 ? [[String(resourceId), ids]] : [];
    }));
    expect(shared).toEqual({
      "generated-enemy-slime-01": ["enemy_meadow_slime", "enemy_slime"],
      "generated-enemy-skeleton-archer": ["enemy_mine_skel_archer", "enemy_skeleton_archer"],
    });
    for (const id of monsterIds) {
      expect(resolveAssetResourceUrl(id), id).toBeTruthy();
    }

    const bySpecies = Object.fromEntries(
      (project.database.monsterSpecies ?? []).map((species) => [species.id, species.graphic.monsterResourceId]),
    );
    expect(Object.keys(bySpecies).sort()).toEqual([
      "species_aqualing", "species_cave_bat", "species_ember_drake", "species_forest_hornet",
      "species_king_slime", "species_leafling", "species_mine_skeleton", "species_sparkit",
      "species_stone_golem", "species_wild_slime",
    ]);
    expect(bySpecies.species_wild_slime).toBe("generated-enemy-slime-01");
    expect(bySpecies.species_king_slime).toBe("generated-enemy-slime-01");
    expect(bySpecies.species_cave_bat).toBe("generated-enemy-bat-01");
    expect(bySpecies.species_stone_golem).toBe("generated-enemy-golem-01");
    expect(bySpecies.species_ember_drake).toBe("generated-enemy-dragon-01");
    expect(bySpecies.species_leafling).toBe("generated-enemy-leafling-01");
    expect(bySpecies.species_forest_hornet).toBe("generated-enemy-sylph-hornet");
    expect(bySpecies.species_sparkit).toBe("generated-enemy-sparkit-fire");
    expect(bySpecies.species_aqualing).toBe("generated-enemy-aqualing-01");
    expect(bySpecies.species_mine_skeleton).toBe("generated-enemy-skeleton-01");
    for (const id of ["species_leafling", "species_sparkit", "species_aqualing"]) {
      expect(project.database.monsterSpecies?.find((species) => species.id === id)?.graphic.graphicHue).toBe(0);
    }
    expect(project.database.monsterSpecies?.find((species) => species.id === "species_sparkit")?.types).toEqual(["fire"]);
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
      "/assets/generated/pixel-enemy-portraits/skeleton-01.png",
    );
  });
});
