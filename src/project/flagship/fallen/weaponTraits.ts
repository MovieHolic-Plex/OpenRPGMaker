/**
 * 『폴른 스타』 무기 계열 특성(전투 담당, 2026-11-03).
 *
 * 사용자 시연: 「무기별 특징이 전투에 잘 반영이 안 되는 기분」. 검·창·지팡이·사출봉의 차이가 기술 공명(+40%)과 공격 숫자뿐이라
 * 통상 공격에서는 무엇을 들어도 같은 숫자가 떴다. 계열마다 **통상 공격에 보이는 한 가지**를 엔진이 이미 아는 장비 칸으로 준다:
 *   검     — 급소 확률 +10%p(숫자 위 「치명타!」).
 *   창     — 맞히면 30% 확률로 「방어 하락」(다음 타격이 세게 들어간다).
 *   지팡이 — 맞히면 20% 확률로 「스톱」(기절, 최대 2차례 — 보스·돌 몸은 상태 저항으로 버틴다).
 *   사출봉·석궁 — 맞히면 35% 확률로 「민첩 하락」(둔화 — 카엘 십자베기의 공략 대상).
 * 설명에는 「평타: …」 한 줄로 그 계열의 특성만 쓴다. 적 이름이나 적의 약점은 쓰지 않는다(약점은 플레이어가 찾는다).
 * 같은 이유로 2막 연계기 「번개 창」 설명의 「기계에게 특히 잘 듣는다」도 여기서 걷는다.
 *
 * 엔진 장비 효과 「회피 무시(ignoreDodge)」는 타입·편집기에만 있고 전투가 읽지 않는다 — 창 설명에서 그 문장을 뺐다.
 * chronoBell.ts 가 모든 무기 저작(대장간·2막 무기 포함)이 끝난 뒤 `applyFallenWeaponTraits(project)` 를 부른다.
 */
import type { EquipmentRecord, Project } from "@/project/types";

type Family = "sword" | "spear" | "staff" | "bow";

/** 파티가 쥘 수 있는 무기 → 계열. 없는 id 는 건너뛴다(데모 DB 판에 따라 빠질 수 있다). */
export const FS_WEAPON_FAMILIES: Readonly<Record<string, Family>> = {
  equip_sword: "sword",
  equip_gen_sword_bronze: "sword",
  equip_gen_sword_iron: "sword",
  equip_gen_sword_steel: "sword",
  equip_gen_sword_flame: "sword",
  equip_fs_sword_gale: "sword",
  equip_fs_sword_star: "sword",
  equip_fs_judgment_blade: "sword",
  equip_gen_spear_iron: "spear",
  equip_gen_halberd_guard: "spear",
  equip_fs_spear_pike: "spear",
  equip_fs_spear_star: "spear",
  equip_fs2_rohan_spear: "spear",
  equip_mage_staff: "staff",
  equip_gen_wand_spark: "staff",
  equip_gen_staff_crystal: "staff",
  equip_gen_staff_oak: "staff",
  equip_fs_star_rod: "bow",
  equip_gen_crossbow_hand: "bow",
};

export const FS_SWORD_CRIT_BONUS = 10;
export const FS_SPEAR_BREAK_CHANCE = 30;
export const FS_STAFF_STUN_CHANCE = 20;
export const FS_BOW_SLOW_CHANCE = 35;

const TRAIT_LINE: Readonly<Record<Family, string>> = {
  sword: "평타: 급소가 잘 난다.",
  spear: "평타: 맞히면 가끔 방어를 깎는다.",
  staff: "평타: 맞히면 가끔 기절시킨다.",
  bow: "평타: 맞히면 가끔 둔하게 만든다.",
};

/** 엔진 기본 설명 가운데 「약점」을 말하는 문장을 이 게임에서만 바꾼다(속성 이름만 남긴다). */
const DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  equip_gen_sword_flame: "불 속성 마검이다. 순수 강철 무기보다 값이 비싸다.",
  equip_gen_wand_spark: "불 속성 주문 촉매다. 물리 공격은 낮지만 마력이 오른다.",
  // 「상대의 회피를 무시한다」는 전투 엔진이 읽지 않는 장비 효과다(act2Opening.ts 저작, 다른 레인 소유).
  equip_fs2_rohan_spear: "공격 40.\n로한이 「네가 쓸 몫」으로 벼려 둔 별쇠 창.\n자루 무늬가 새라의 창과 같다.",
};

/** 기술 설명에서 적 상성을 말하는 문장을 걷는다(다른 레인 소유 파일의 기술). */
const SKILL_DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  combo_fs2_thunder_lance: "이리스의 광선이 새라의 창끝에 번개를 싣는다.\n적 하나에 번개 피해.",
};

function addState(weapon: EquipmentRecord, stateId: string, chance: number): void {
  if (!weapon.stateInflictIds.includes(stateId)) weapon.stateInflictIds = [...weapon.stateInflictIds, stateId];
  weapon.stateInflictionChance = weapon.stateInflictIds.length > 1 ? Math.min(weapon.stateInflictionChance, chance) : chance;
}

export function applyFallenWeaponTraits(project: Project): void {
  // 2막 연계기 설명의 적 상성 문장을 낸다. 저작 파일(act2Opening.ts)은 다른 레인이 가져 있어 여기서 굽기 끝에 덮는다.
  for (const [skillId, description] of Object.entries(SKILL_DESCRIPTION_OVERRIDES)) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    if (skill) skill.description = description;
  }
  for (const weapon of project.database.equipment) {
    const family = FS_WEAPON_FAMILIES[weapon.id];
    if (!family || weapon.slot !== "weapon") continue;
    if (family === "sword") weapon.criticalRate = Math.min(100, weapon.criticalRate + FS_SWORD_CRIT_BONUS);
    else if (family === "spear") addState(weapon, "state_defense_down", FS_SPEAR_BREAK_CHANCE);
    else if (family === "staff") addState(weapon, "state_stop", FS_STAFF_STUN_CHANCE);
    else addState(weapon, "state_agility_down", FS_BOW_SLOW_CHANCE);
    const base = DESCRIPTION_OVERRIDES[weapon.id] ?? weapon.description;
    const line = TRAIT_LINE[family];
    if (!base.includes(line)) weapon.description = `${base.trim()}\n${line}`;
    else weapon.description = base;
  }
}
