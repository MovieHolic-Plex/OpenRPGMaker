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
    ...(item.ppRecovery ? { ppRecovery: medicine ? item.ppRecovery : undefined } : {}),
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

// 자기 효과가 있는 종류. 이 종류로 바꾼 아이템에 예전 captureProfile 이 남아 있어도 공이 아니다
// — 자료집은 종류를 약으로 바꿔도 포획 프로필을 지우지 않는다(되돌릴 때 값을 잃지 않게).
const OWN_USE_ITEM_TYPES: ReadonlySet<string> = new Set(["medicine", "book", "skillBook", "seed", "switch"]);

/** 전투에서 던지는 포획 도구인가. captureProfile 이 계약이지만 약·책·씨앗·스위치 종류는 제외한다. */
export function isCaptureTool(item: { readonly type: string; readonly captureProfile?: unknown; readonly careProfile?: unknown }): boolean {
  return Boolean(item.captureProfile) && !item.careProfile && !OWN_USE_ITEM_TYPES.has(item.type);
}

export function itemAllowsBattle(item: ItemRecord): boolean {
  if (item.occasion !== "always" && item.occasion !== "battle") return false;
  // 포획 도구는 captureProfile 이 계약이다 — 종류가 special 이 아니어도(조수가 normalGoods 로 저장) 전투에서 던진다.
  if (isCaptureTool(item)) return true;
  if (item.type === "medicine") return !item.onlyEffectiveOnDeadActors;
  return item.type === "special" && !item.careProfile;
}
