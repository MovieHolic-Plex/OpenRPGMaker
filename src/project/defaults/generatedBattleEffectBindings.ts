import { generatedEffectDatabaseAnimationId } from "@/assets/generatedEffectSheets";

type AnimationBoundRecord = { readonly id: string; animationId?: string };
type UnarmedAnimationBoundRecord = { readonly id: string; unarmedAnimationId?: string };

const animation = generatedEffectDatabaseAnimationId;

/** Starter skills must point at the generated records, otherwise the pack only exists in the editor library. */
export const GENERATED_BATTLE_EFFECT_SKILL_BINDINGS: Readonly<Record<string, string>> = {
  skill_attack: animation("tackle-impact"),
  skill_sword_slash: animation("slash-steel"),
  skill_arcane_bolt: animation("projectile-shot"),
  skill_fire: animation("fire-burst"),
  skill_water: animation("water-column"),
  skill_leaf: animation("leaf-volley"),
  skill_heal: animation("heal-bloom"),
  skill_poison_sting: animation("poison-mist"),
  skill_sleep_mist: animation("sleep-dust"),
  skill_focus: animation("power-aura"),
  skill_weaken: animation("shadow-pulse"),
  skill_item_potion: animation("heal-bloom"),
  skill_item_hi_potion: animation("heal-bloom"),
  skill_item_ether: animation("psychic-wave"),
  skill_item_elixir: animation("revive-rise"),
  skill_throwing_knife: animation("projectile-shot"),
  skill_item_poison_vial: animation("poison-mist"),
  skill_item_antidote: animation("cleanse-sparkle"),
  skill_item_wake: animation("cleanse-sparkle"),
  skill_item_panacea: animation("cleanse-sparkle"),
  skill_item_guard: animation("guard-barrier"),
};

/** Items override their linked skill animation at runtime, so they need their own bindings too. */
export const GENERATED_BATTLE_EFFECT_ITEM_BINDINGS: Readonly<Record<string, string>> = {
  item_potion: animation("heal-bloom"),
  item_capture_orb: animation("capture-seal"),
  item_ether: animation("psychic-wave"),
  item_antidote: animation("cleanse-sparkle"),
  item_wake_herb: animation("cleanse-sparkle"),
  item_poison_dart: animation("poison-mist"),
  item_hi_potion: animation("heal-bloom"),
  item_elixir: animation("revive-rise"),
  item_panacea: animation("cleanse-sparkle"),
  item_smelling_salts: animation("cleanse-sparkle"),
  item_throwing_knife: animation("projectile-shot"),
  item_poison_vial: animation("poison-mist"),
  item_guard_talisman: animation("guard-barrier"),
  item_ale: animation("heal-bloom"),
  item_antidote_plus: animation("cleanse-sparkle"),
  item_apple: animation("heal-bloom"),
  item_bandages: animation("heal-bloom"),
  item_bread: animation("heal-bloom"),
  item_candy: animation("psychic-wave"),
  item_cheese: animation("heal-bloom"),
  item_coffee: animation("psychic-wave"),
  item_cookie: animation("heal-bloom"),
  item_eye_drops: animation("cleanse-sparkle"),
  item_herb_blue: animation("psychic-wave"),
  item_herb_green: animation("heal-bloom"),
  item_honey: animation("heal-bloom"),
  item_mana_tea: animation("psychic-wave"),
  item_phoenix_down: animation("revive-rise"),
  item_rice_ball: animation("heal-bloom"),
  item_soup: animation("heal-bloom"),
  item_stamina_drink: animation("power-aura"),
  item_stew: animation("heal-bloom"),
  item_tea: animation("psychic-wave"),
  item_water_flask: animation("water-column"),
  item_wine: animation("heal-bloom"),
  item_bomb: animation("tackle-impact"),
  item_fire_bomb: animation("fire-burst"),
  item_holy_water: animation("psychic-wave"),
  item_ice_shard: animation("water-column"),
  item_sleeping_powder: animation("sleep-dust"),
  item_smoke_bomb: animation("shadow-pulse"),
  item_thunder_stone: animation("projectile-shot"),
  item_gen_potion_small: animation("heal-bloom"),
  item_gen_potion_large: animation("heal-bloom"),
  item_gen_ether_vial: animation("psychic-wave"),
  item_gen_ether_grand: animation("psychic-wave"),
  item_gen_elixir_gold: animation("revive-rise"),
  item_gen_panacea_jar: animation("cleanse-sparkle"),
  item_gen_antidote_leaf: animation("cleanse-sparkle"),
  item_gen_eyedrops: animation("cleanse-sparkle"),
  item_gen_echo_bell: animation("cleanse-sparkle"),
  item_gen_revive_feather: animation("revive-rise"),
  item_gen_phoenix_ash: animation("revive-rise"),
  item_gen_bandage_roll: animation("heal-bloom"),
  item_gen_herb_bundle: animation("heal-bloom"),
  item_gen_honey_jar: animation("heal-bloom"),
  item_gen_milk_bottle: animation("heal-bloom"),
  item_gen_fire_bomb: animation("fire-burst"),
  item_gen_ice_shard: animation("ice-shatter"),
  item_gen_thunder_rod: animation("thunder-strike"),
  item_gen_poison_flask: animation("poison-mist"),
  item_gen_smoke_ball: animation("smoke-vanish"),
  item_gen_throwing_knife: animation("projectile-shot"),
  item_gen_shuriken: animation("projectile-shot"),
  item_gen_holy_water: animation("holy-beam"),
  item_gen_net_trap: animation("capture-seal"),
  item_gen_capture_sphere: animation("capture-seal"),
};

/** Class animation is the normal-attack visual while a weapon is equipped. */
export const GENERATED_BATTLE_EFFECT_CLASS_BINDINGS: Readonly<Record<string, string>> = {
  class_hero: animation("slash-steel"),
  class_guardian: animation("tackle-impact"),
  class_mage: animation("arcane-nova"),
  class_scout: animation("slash-steel"),
  class_cleric: animation("holy-beam"),
  class_ranger: animation("projectile-shot"),
};

/** Starter actors share the impact animation when attacking without a weapon. */
export const GENERATED_BATTLE_EFFECT_ACTOR_BINDINGS: Readonly<Record<string, string>> = {
  actor_hero: animation("tackle-impact"),
  actor_guardian: animation("tackle-impact"),
  actor_mage: animation("tackle-impact"),
  actor_scout: animation("tackle-impact"),
  actor_cleric: animation("tackle-impact"),
  actor_ranger: animation("tackle-impact"),
};

export function applyGeneratedBattleEffectSkillBindings(records: AnimationBoundRecord[]): number {
  return applyBindings(records, GENERATED_BATTLE_EFFECT_SKILL_BINDINGS);
}

export function applyGeneratedBattleEffectItemBindings(records: AnimationBoundRecord[]): number {
  return applyBindings(records, GENERATED_BATTLE_EFFECT_ITEM_BINDINGS);
}

export function applyGeneratedBattleEffectClassBindings(records: AnimationBoundRecord[]): number {
  return applyBindings(records, GENERATED_BATTLE_EFFECT_CLASS_BINDINGS);
}

export function applyGeneratedBattleEffectActorBindings(records: UnarmedAnimationBoundRecord[]): number {
  let changed = 0;
  for (const record of records) {
    const expected = GENERATED_BATTLE_EFFECT_ACTOR_BINDINGS[record.id];
    if (expected === undefined || record.unarmedAnimationId === expected) continue;
    record.unarmedAnimationId = expected;
    changed += 1;
  }
  return changed;
}

export function countGeneratedBattleEffectActorBindingChanges(records: readonly UnarmedAnimationBoundRecord[]): number {
  return records.reduce((count, record) => {
    const expected = GENERATED_BATTLE_EFFECT_ACTOR_BINDINGS[record.id];
    return expected !== undefined && record.unarmedAnimationId !== expected ? count + 1 : count;
  }, 0);
}

export function countGeneratedBattleEffectBindingChanges(
  records: readonly AnimationBoundRecord[],
  bindings: Readonly<Record<string, string>>,
): number {
  return records.reduce((count, record) => {
    const expected = bindings[record.id];
    return expected !== undefined && record.animationId !== expected ? count + 1 : count;
  }, 0);
}

function applyBindings(records: AnimationBoundRecord[], bindings: Readonly<Record<string, string>>): number {
  let changed = 0;
  for (const record of records) {
    const expected = bindings[record.id];
    if (expected === undefined || record.animationId === expected) continue;
    record.animationId = expected;
    changed += 1;
  }
  return changed;
}
