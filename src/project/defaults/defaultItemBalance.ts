import type { ItemRecord, SkillRecord } from "../types";
import { activeItemEffects } from "../itemUsage";
import { defaultSkillRecords } from "./defaultDatabaseStarterRecords";

/** Budget at the upper end of the shipped growth curves, so percentage heals stay rare. */
export const DEFAULT_ITEM_ECONOMY = {
  referenceHp: 5200, referenceMp: 450, hpGold: .9, mpGold: 4,
  fieldDiscount: .65, partyMultiplier: 3.5, permanentPointGold: 900,
} as const;

const stateGold: Readonly<Record<string, number>> = {
  state_attack_up: 180, state_defense_up: 180, state_agility_up: 220,
  // Three delayed 8%-HP ticks; cheaper than immediate recovery, never priced as a flat heal.
  state_regen: DEFAULT_ITEM_ECONOMY.referenceHp * .08 * 3 * DEFAULT_ITEM_ECONOMY.hpGold,
  state_protect: 140, state_shell: 160, state_counter: 260, state_cover: 180,
  state_evade: 260, state_reflect: 380, state_reraise: 650,
  state_poison: 65, state_deep_poison: 120, state_sleep: 95, state_paralysis: 130,
  state_silence: 85, state_blind: 70, state_stop: 150, state_petrify: 300,
  state_attack_down: 85, state_defense_down: 85, state_agility_down: 85,
  state_oiled: 55, state_wet: 55,
};
const cureGold: Readonly<Record<string, number>> = {
  state_poison: 25, state_deep_poison: 50, state_sleep: 25, state_paralysis: 40,
  state_silence: 30, state_blind: 25, state_stop: 50, state_petrify: 80,
  state_attack_down: 30, state_defense_down: 30, state_agility_down: 30,
};

function stateValue(effects: ItemRecord["stateEffects"], healIds: readonly string[] = []): number {
  const cures = new Set(healIds);
  let value = 0;
  for (const effect of effects) {
    if (effect.operation === "remove") cures.add(effect.stateId);
    else value += (stateGold[effect.stateId] ?? 120) * effect.chance / 100;
  }
  for (const id of cures) value += cureGold[id] ?? 45;
  return value;
}

function skillValue(skill: SkillRecord): number {
  const area = skill.scope === "allEnemies" || skill.scope === "allAllies" ? 2.6 : 1;
  const power = skill.effect.kind === "damage" || skill.effect.kind === "healing" ? skill.power * 1.7 : 0;
  return (65 + power + stateValue(skill.stateEffects ?? [])) * area;
}

/** New-project seed only. Saved item prices and effects are never converged on load. */
export function balanceDefaultItemCatalog(records: readonly ItemRecord[]): ItemRecord[] {
  const skills = new Map(defaultSkillRecords().map(skill => [skill.id, skill]));
  return records.map(record => ({ ...record, price: defaultItemPrice(record, skills) }));
}

export function defaultItemPrice(record: ItemRecord, skills: ReadonlyMap<string, SkillRecord>): number {
  const item = activeItemEffects(record);
  const policy = DEFAULT_ITEM_ECONOMY;
  let value: number | undefined;
  if (item.farmTool) {
    // The engine has no material-tier farming bonus: equal tool actions have equal prices.
    return { hoe: 70, wateringCan: 100, axe: 95, pickaxe: 110 }[item.farmTool];
  }
  if (item.type === "medicine") {
    const hp = (item.hpRecovery.flat + item.hpRecovery.percentMax * policy.referenceHp / 100) * policy.hpGold;
    const mp = (item.mpRecovery.flat + item.mpRecovery.percentMax * policy.referenceMp / 100) * policy.mpGold;
    value = hp + mp + stateValue(item.stateEffects, item.healStateIds);
    if (hp > 0 && mp > 0) value *= 1.12; // Two resources in one battle action.
    if (item.onlyEffectiveOnDeadActors) value += 250 + item.hpRecovery.percentMax * 2.5;
    if (item.scope === "allAllies") value *= policy.partyMultiplier;
    if (item.occasion === "field") value *= item.onlyEffectiveOnDeadActors ? .9 : policy.fieldDiscount;
  } else if (item.type === "seed") {
    const points = Object.values(item.seedParameterBonuses).reduce((sum, amount) => sum + Math.max(0, amount), 0);
    if (points > 0) value = policy.permanentPointGold * Math.pow(points, 1.2);
  } else if (item.type === "book") {
    const skill = skills.get(item.learnedSkillId ?? item.skillId ?? "");
    if (skill) value = 800 + skillValue(skill) * 5 + skill.mpCost.flat * 65;
  } else if (item.type === "switch") value = 240;
  else if (item.captureProfile) {
    if (item.captureProfile.ballClass === "master") value = 20000;
    else {
      const multiplier = Math.max(1, item.captureProfile.multiplier);
      const classPremium = item.captureProfile.ballClass === "ultra" ? 140 : item.captureProfile.ballClass === "great" ? 60 : 0;
      value = 80 * multiplier * multiplier + classPremium;
    }
  } else if (item.careProfile) {
    value = Math.max(0, item.careProfile.friendshipDelta) * 12 + Math.max(0, item.careProfile.expDelta ?? 0) * 1.8;
  } else if (item.type === "special") {
    const skill = skills.get(item.activateSkillId ?? item.skillId ?? "");
    value = skill ? skillValue(skill) : stateValue(item.stateEffects);
    if (!skill && item.scope === "allAllies") value *= policy.partyMultiplier;
  }
  if (value === undefined || value <= 0) return record.price;
  const uses = item.consumable && typeof item.consumptionLimit === "number" ? item.consumptionLimit : 1;
  // A five-use item pays for five effects; a small bulk discount preserves single-use choices.
  return Math.min(999999, Math.max(5, Math.ceil((15 + value) * uses * (uses > 1 ? .94 : 1) / 5) * 5));
}
