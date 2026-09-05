import type { ItemRecord } from "@/project/types";

/** Saved settings survive type changes; only the current type's effects can execute. */
export function activeItemEffects(item: ItemRecord): ItemRecord {
  const medicine = item.type === "medicine";
  const special = item.type === "special";
  const skillItem = special && !item.captureProfile && !item.careProfile;
  return {
    ...item,
    animationId: medicine || skillItem ? item.animationId : undefined,
    hpRecovery: medicine ? item.hpRecovery : { flat: 0, percentMax: 0 },
    mpRecovery: medicine ? item.mpRecovery : { flat: 0, percentMax: 0 },
    healStateIds: medicine ? item.healStateIds : [],
    stateEffects: medicine || (special && !item.activateSkillId && !item.skillId && !item.captureProfile && !item.careProfile) ? item.stateEffects : [],
    onlyEffectiveOnDeadActors: medicine && item.onlyEffectiveOnDeadActors,
    learnedSkillId: item.type === "book" ? item.learnedSkillId ?? item.skillId : undefined,
    activateSkillId: skillItem ? item.activateSkillId ?? item.skillId : undefined,
    skillId: skillItem || item.type === "book" ? item.skillId : undefined,
    seedParameterBonuses: item.type === "seed" ? item.seedParameterBonuses : { attack: 0, defense: 0, mind: 0, agility: 0 },
    switchId: item.type === "switch" ? item.switchId : undefined,
    careProfile: special ? item.careProfile : undefined,
    captureProfile: special && !item.careProfile ? item.captureProfile : undefined,
  };
}

export function itemAllowsMenu(item: ItemRecord): boolean {
  if (item.occasion !== "always" && item.occasion !== "field") return false;
  return item.type === "medicine" || item.type === "book" || item.type === "seed" || item.type === "switch"
    || (item.type === "special" && (Boolean(item.careProfile) || (!item.captureProfile && !item.activateSkillId && !item.skillId && item.stateEffects.length > 0)));
}

export function itemAllowsBattle(item: ItemRecord): boolean {
  if (item.occasion !== "always" && item.occasion !== "battle") return false;
  if (item.type === "medicine") return !item.onlyEffectiveOnDeadActors;
  return item.type === "special" && !item.careProfile;
}
