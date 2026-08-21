import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { seedHomeDungeonComplexTroops } from "@/project/defaults/complexMonsterAuthoring";

describe("database image matching", () => {
  it("assigns unique matching monster graphics for extra enemies and species", () => {
    const project = createBlankProject();
    const extras = project.database.enemies.filter((enemy) => enemy.id.startsWith("enemy_extra_"));
    const monsterIds = extras.map((enemy) => enemy.monsterResourceId);
    expect(new Set(monsterIds).size).toBe(monsterIds.length);
    for (const id of monsterIds) {
      expect(resolveAssetResourceUrl(id), id).toBeTruthy();
    }

    const bySpecies = Object.fromEntries(
      (project.database.monsterSpecies ?? []).map((species) => [species.id, species.graphic.monsterResourceId]),
    );
    expect(bySpecies.species_leafling).toBe("generated-enemy-leafling-01");
    expect(bySpecies.species_sparkit).toBe("generated-enemy-sparkit-01");
    expect(bySpecies.species_aqualing).toBe("generated-enemy-aqualing-01");
    expect(bySpecies.species_king_slime).toBe("generated-enemy-king-slime-01");
    expect(bySpecies.species_wild_slime).toBe("generated-enemy-slime-01");
    expect(bySpecies.species_cave_bat).toBe("generated-enemy-bat-01");
    expect(bySpecies.species_forest_hornet).toBe("easyrpg-monster-hornet");
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
