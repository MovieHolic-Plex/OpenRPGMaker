import { beforeEach, describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { installGeneratedBattleEffectPack } from "@/editor/databaseActions";
import { GENERATED_EFFECT_RESOURCE_IDS } from "@/assets/generatedEffectSheets";
import { createBlankProject } from "@/project/defaults";
import { defaultItemRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { store } from "@/project/store";

const EXPECTED_SKILL_ANIMATIONS = {
  skill_attack: "anim_gen_tackle_impact",
  skill_sword_slash: "anim_gen_slash_steel",
  skill_arcane_bolt: "anim_gen_projectile_shot",
  skill_fire: "anim_gen_fire_burst",
  skill_water: "anim_gen_water_column",
  skill_leaf: "anim_gen_leaf_volley",
  skill_heal: "anim_heal",
  skill_poison_sting: "anim_poison",
  skill_sleep_mist: "anim_gen_sleep_dust",
  skill_focus: "anim_gen_power_aura",
  skill_weaken: "anim_gen_shadow_pulse",
  skill_item_potion: "anim_heal",
  skill_item_hi_potion: "anim_heal",
  skill_item_ether: "anim_gen_psychic_wave",
  skill_item_elixir: "anim_gen_revive_rise",
  skill_throwing_knife: "anim_gen_projectile_shot",
  skill_item_poison_vial: "anim_poison",
  skill_item_antidote: "anim_gen_cleanse_sparkle",
  skill_item_wake: "anim_gen_cleanse_sparkle",
  skill_item_panacea: "anim_gen_cleanse_sparkle",
  skill_item_guard: "anim_gen_guard_barrier",
  skill_item_holy_water: "anim_gen_holy_beam",
  skill_item_thunder_stone: "anim_gen_thunder_strike",
} as const;

const EXPECTED_ITEM_ANIMATIONS = {
  item_capture_orb: "anim_gen_capture_seal",
  item_antidote: "anim_gen_cleanse_sparkle",
  item_wake_herb: "anim_gen_cleanse_sparkle",
  item_elixir: "anim_gen_revive_rise",
  item_panacea: "anim_gen_cleanse_sparkle",
  item_smelling_salts: "anim_gen_cleanse_sparkle",
  item_throwing_knife: "anim_gen_projectile_shot",
  item_guard_talisman: "anim_gen_guard_barrier",
  item_gen_fire_bomb: "anim_gen_fire_burst",
  item_gen_ice_shard: "anim_gen_ice_shatter",
  item_gen_thunder_rod: "anim_gen_thunder_strike",
  item_gen_smoke_ball: "anim_gen_smoke_vanish",
  item_gen_holy_water: "anim_gen_holy_beam",
  item_gen_capture_sphere: "anim_gen_capture_seal",
  item_gen_revive_feather: "anim_gen_revive_rise",
} as const;

const EXPECTED_CLASS_ANIMATIONS = {
  class_hero: "anim_gen_slash_steel",
  class_guardian: "anim_gen_tackle_impact",
  class_mage: "anim_magic",
  class_scout: "anim_gen_slash_steel",
  class_cleric: "anim_gen_holy_beam",
  class_ranger: "anim_gen_projectile_shot",
} as const;

function valuesById(records: readonly { readonly id: string; readonly animationId?: string }[]): Record<string, string | undefined> {
  return Object.fromEntries(records.map((record) => [record.id, record.animationId]));
}

describe("generated battle effect pack installation", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("wires actual starter skills and representative battle items to purpose-specific generated effects", () => {
    const project = createBlankProject();
    const skillAnimations = valuesById(project.database.skills);
    const itemAnimations = valuesById(defaultItemRecords());
    const classAnimations = valuesById(project.database.classes);

    for (const [id, animationId] of Object.entries(EXPECTED_SKILL_ANIMATIONS)) {
      expect(skillAnimations[id], id).toBe(animationId);
    }
    for (const [id, animationId] of Object.entries(EXPECTED_ITEM_ANIMATIONS)) {
      expect(itemAnimations[id], id).toBe(animationId);
    }
    for (const [id, animationId] of Object.entries(EXPECTED_CLASS_ANIMATIONS)) {
      expect(classAnimations[id], id).toBe(animationId);
    }
    expect(project.database.actors.every((actor) => actor.unarmedAnimationId === "anim_gen_tackle_impact")).toBe(true);
  });

  it("exposes the generated weapon animation from an actual default Attack command", () => {
    const project = createBlankProject();
    const runtime = createBattleRuntime({
      project,
      troopId: project.system.initialTroopId,
      canEscape: true,
      canLose: true,
    });

    runtime.tick(10_000);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    runtime.performActorCommand({ kind: "attack", targetEnemyId: runtime.snapshot().enemies[0]!.id });

    expect(runtime.snapshot().lastAnimation).toMatchObject({
      animationId: "anim_gen_slash_steel",
      resourceId: "generated-battle-anim-slash-steel",
      frameCount: 8,
    });
  });

  it("explicitly installs all 34 missing records into an existing project and applies the same bindings", () => {
    const project = createBlankProject();
    project.database.battleAnimations = project.database.battleAnimations.filter(
      (record) => !GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? ""),
    );
    for (const skill of project.database.skills) skill.animationId = undefined;
    for (const item of project.database.items) item.animationId = undefined;
    for (const actor of project.database.actors) actor.unarmedAnimationId = undefined;
    for (const klass of project.database.classes) klass.animationId = undefined;
    project.database.skills.push({
      ...project.database.skills[0]!,
      id: "skill_custom",
      name: "Custom",
      animationId: "anim_custom",
    });
    store.replace(project);

    const result = installGeneratedBattleEffectPack();
    const installed = store.getCurrent();

    expect(result.addedAnimations).toBe(34);
    expect(result.updatedSkills).toBe(Object.keys(EXPECTED_SKILL_ANIMATIONS).length);
    expect(result.updatedActors).toBe(project.database.actors.length);
    expect(result.updatedClasses).toBe(Object.keys(EXPECTED_CLASS_ANIMATIONS).length);
    const installedResourceIds = new Set(installed.database.battleAnimations.map((record) => record.resourceId));
    for (const resourceId of GENERATED_EFFECT_RESOURCE_IDS) {
      expect(installedResourceIds.has(resourceId), resourceId).toBe(true);
    }
    for (const [id, animationId] of Object.entries(EXPECTED_SKILL_ANIMATIONS)) {
      expect(installed.database.skills.find((skill) => skill.id === id)?.animationId, id).toBe(animationId);
    }
    for (const [id, animationId] of Object.entries(EXPECTED_ITEM_ANIMATIONS)) {
      expect(installed.database.items.find((item) => item.id === id)?.animationId, id).toBe(animationId);
    }
    for (const [id, animationId] of Object.entries(EXPECTED_CLASS_ANIMATIONS)) {
      expect(installed.database.classes.find((klass) => klass.id === id)?.animationId, id).toBe(animationId);
    }
    expect(installed.database.actors.every((actor) => actor.unarmedAnimationId === "anim_gen_tackle_impact")).toBe(true);
    expect(installed.database.skills.find((skill) => skill.id === "skill_custom")?.animationId).toBe("anim_custom");

    expect(installGeneratedBattleEffectPack()).toMatchObject({
      addedAnimations: 0,
      updatedAnimations: 0,
      updatedSkills: 0,
      updatedItems: 0,
      updatedActors: 0,
      updatedClasses: 0,
    });
  });

  it("upgrades legacy alias art without overwriting custom animation resources", () => {
    const project = createBlankProject();
    const legacyAlias = project.database.battleAnimations.find((record) => record.id === "anim_magic")!;
    const customizedGenerated = project.database.battleAnimations.find((record) => record.id === "anim_gen_fire_burst")!;
    legacyAlias.resourceId = "easyrpg-battle-blow";
    customizedGenerated.resourceId = "custom-fire-animation";
    store.replace(project);

    const result = installGeneratedBattleEffectPack();
    const installed = store.getCurrent().database.battleAnimations;

    expect(result.updatedAnimations).toBe(1);
    expect(installed.find((record) => record.id === "anim_magic")?.resourceId).toBe("generated-battle-anim-arcane-nova");
    expect(installed.find((record) => record.id === "anim_gen_fire_burst")?.resourceId).toBe("custom-fire-animation");
  });
});
