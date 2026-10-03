import { normalizeSkillRecord } from "../databaseRecordModel";
import type { SkillRecord } from "../types";

const elements = [
  ["fire", "화염", "anim_gen_fire_burst", "state_oiled"],
  ["ice", "빙결", "anim_gen_ice_shatter", "state_agility_down"],
  ["thunder", "뇌전", "anim_gen_thunder_strike", "state_wet"],
  ["earth", "암석", "anim_gen_earth_spike", "state_defense_down"],
  ["wind", "질풍", "anim_gen_wind_slice", "state_blind"],
  ["dark", "암흑", "anim_gen_shadow_pulse", "state_silence"],
] as const;

/** Item-only skills: MP-free, finite inventory cost, no alteration of class/enemy skills. */
export function defaultSharedItemBattleSkills(): SkillRecord[] {
  const roles = ["경량탄", "약화탄", "집중탄", "확산탄", "복합탄", "관통탄", "연발 확산탄", "비전 복합탄"];
  const power = [36, 0, 60, 42, 52, 100, 68, 90];
  return elements.flatMap(([element, label, animationId, stateId]) => roles.map((role, index) => {
    const support = index === 1;
    const area = index === 3 || index === 6;
    const chance = support ? 65 : index === 4 ? 35 : index === 7 ? 45 : 0;
    return normalizeSkillRecord({
      id: `skill_shared_item_${element}_${index + 1}`,
      name: `${label} ${role}`,
      description: `${area ? "적 전체" : "적 하나"}에 사용하는 공용 아이템 전용 ${role}입니다.`,
      type: "normal", scope: area ? "allEnemies" : "enemy",
      mpCost: { flat: 0, percentMax: 0 }, power: power[index],
      effect: support ? { kind: "support" } : { kind: "damage", statistic: "mind", affects: "hp" },
      elementId: support ? undefined : element, animationId,
      variance: support ? 0 : 10, hitRate: 100, successRate: 100,
      stateEffects: chance ? [{ stateId, chance, operation: "add" }] : [],
    });
  }));
}
