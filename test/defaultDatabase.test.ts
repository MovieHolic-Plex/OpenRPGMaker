import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

const DATABASE_ACTOR_IDS = [
  "actor_hero",
  "actor_guardian",
  "actor_mage",
  "actor_scout",
  "actor_cleric",
  "actor_ranger",
] as const;
const STARTER_ACTOR_IDS = ["actor_hero", "actor_guardian", "actor_mage", "actor_scout"] as const;
const STARTER_CLASS_IDS = [
  "class_hero",
  "class_guardian",
  "class_mage",
  "class_scout",
  "class_cleric",
  "class_ranger",
] as const;
const STARTER_EQUIPMENT_IDS = [
  "equip_sword",
  "equip_mage_staff",
  "equip_scout_dagger",
  "equip_iron_sword",
  "equip_steel_sword",
  "equip_short_sword",
  "equip_oak_shield",
  "equip_leather_armor",
  "equip_mystic_robe",
  "equip_traveler_hat",
  "equip_focus_charm",
] as const;

describe("default database starter party", () => {
  it("builds a coherent RTP-backed six actor roster with a four member starting party", () => {
    // Given: the sample adventure factory owns the editor's full default database showcase.
    const project = createSampleAdventureProject();

    // When: default database records are inspected.
    const actors = project.database.actors.map((actor) => actor.id);
    const classes = project.database.classes.map((klass) => klass.id);
    const equipment = project.database.equipment.map((entry) => entry.id);
    const equipmentSlots = new Set(project.database.equipment.map((entry) => entry.slot));
    const battleWeaponSheetFallbacks = project.database.equipment.filter(
      (entry) => entry.imageResourceId === "easyrpg-battle-weapon-weapon" || entry.iconResourceId === "easyrpg-battle-weapon-weapon"
    );

    // Then: the starter party, matching classes, and every equipment slot are present.
    expect(actors).toEqual([...DATABASE_ACTOR_IDS]);
    expect(classes).toEqual([...STARTER_CLASS_IDS]);
    expect(equipment).toEqual([...STARTER_EQUIPMENT_IDS]);
    expect(project.system.startActorIds).toEqual([...STARTER_ACTOR_IDS]);
    expect(project.session.partyActorIds).toEqual([...STARTER_ACTOR_IDS]);
    expect(equipmentSlots).toEqual(new Set(["weapon", "shield", "armor", "helmet", "accessory"]));
    expect(battleWeaponSheetFallbacks).toEqual([]);
  });

  it("round-trips default party actor and equipment resources as valid references", () => {
    // Given: the starter party uses bundled EasyRPG and promoted generated resources.
    const project = createSampleAdventureProject();

    // When: the project is exported and imported through the real IO layer.
    const restored = deserialize(serialize(project));
    const hero = restored.database.actors.find((actor) => actor.id === "actor_hero");
    const guardian = restored.database.actors.find((actor) => actor.id === "actor_guardian");
    const mage = restored.database.actors.find((actor) => actor.id === "actor_mage");
    const scout = restored.database.actors.find((actor) => actor.id === "actor_scout");
    const sword = restored.database.equipment.find((entry) => entry.id === "equip_sword");
    const shield = restored.database.equipment.find((entry) => entry.id === "equip_oak_shield");
    const staff = restored.database.equipment.find((entry) => entry.id === "equip_mage_staff");
    const armor = restored.database.equipment.find((entry) => entry.id === "equip_leather_armor");

    // Then: resource-backed actor and equipment references survive validation.
    expect(hero).toMatchObject({
      faceResourceId: "easyrpg-faceset-actor1-00",
      characterResourceId: "easyrpg-charset-actor1",
      battleCharacterResourceId: "generated-actor-hero-01-battle",
    });
    expect(guardian).toMatchObject({
      faceResourceId: "easyrpg-faceset-actor2-00",
      characterResourceId: "easyrpg-charset-actor2",
      battleCharacterResourceId: "generated-actor-hero-02-battle",
    });
    expect(mage).toMatchObject({
      faceResourceId: "easyrpg-faceset-people1-00",
      characterResourceId: "easyrpg-charset-actor3",
      battleCharacterResourceId: "generated-actor-hero-03-battle",
    });
    expect(scout).toMatchObject({
      faceResourceId: "easyrpg-faceset-people2-00",
      characterResourceId: "easyrpg-charset-actor4",
      battleCharacterResourceId: "generated-actor-hero-04-battle",
    });
    const starterBattleResourceIds = restored.system.startActorIds.map(
      (id) => restored.database.actors.find((actor) => actor.id === id)?.battleCharacterResourceId
    );
    expect(new Set(starterBattleResourceIds).size).toBe(4);
    expect(sword).toMatchObject({
      imageResourceId: "cc0-jetrel-bronze-sword",
      iconResourceId: "cc0-jetrel-bronze-sword",
    });
    expect(shield).toMatchObject({
      imageResourceId: "cc0-jetrel-oak-shield",
      iconResourceId: "cc0-jetrel-oak-shield",
    });
    expect(staff).toMatchObject({
      imageResourceId: "cc0-jetrel-mage-staff",
      iconResourceId: "cc0-jetrel-mage-staff",
    });
    expect(armor).toMatchObject({
      imageResourceId: "cc0-jetrel-leather-armor",
      iconResourceId: "cc0-jetrel-leather-armor",
    });
  });

  it("registers the generated dragon monster image in enemies and troops", () => {
    // Given: the sample adventure keeps the generated battle database content available.
    const project = createSampleAdventureProject();

    // When: generated monster-backed records are inspected.
    const dragon = project.database.enemies.find((enemy) => enemy.id === "enemy_dragon");
    const troop = project.database.troops.find((entry) => entry.id === "troop_dragon");

    // Then: the promoted dragon image is usable from both enemy and troop database sections.
    expect(dragon).toMatchObject({
      name: "붉은 드래곤",
      monsterResourceId: "generated-enemy-dragon-01",
    });
    expect(troop?.members).toEqual([{ enemyId: "enemy_dragon", x: 168, y: 104, hidden: false }]);
    expect(troop?.previewBackgroundResourceId).toBe("generated-battle-reference-forest");
  });
});
