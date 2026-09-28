import { DEFAULT_ACTOR_ID, DEFAULT_CLASS_ID, DEFAULT_EQUIPMENT_ID } from "./constants";

export const ACTOR_GUARDIAN_ID = "actor_guardian";
export const ACTOR_MAGE_ID = "actor_mage";
export const ACTOR_SCOUT_ID = "actor_scout";
export const ACTOR_CLERIC_ID = "actor_cleric";
export const ACTOR_RANGER_ID = "actor_ranger";
// retro2003 확장 주인공 6명(2026-09-28, 계약 src/assets/retroClassSkills.ts). 시작 파티가 아닌 예비 배우다.
export const ACTOR_SAMURAI_ID = "actor_samurai";
export const ACTOR_NINJA_ID = "actor_ninja";
export const ACTOR_MONK_ID = "actor_monk";
export const ACTOR_BARD_ID = "actor_bard";
export const ACTOR_DRUID_ID = "actor_druid";
export const ACTOR_WITCH_ID = "actor_witch";

export const CLASS_GUARDIAN_ID = "class_guardian";
export const CLASS_MAGE_ID = "class_mage";
export const CLASS_SCOUT_ID = "class_scout";
export const CLASS_CLERIC_ID = "class_cleric";
export const CLASS_RANGER_ID = "class_ranger";
export const CLASS_SAMURAI_ID = "class_samurai";
export const CLASS_NINJA_ID = "class_ninja";
export const CLASS_MONK_ID = "class_monk";
export const CLASS_BARD_ID = "class_bard";
export const CLASS_DRUID_ID = "class_druid";
export const CLASS_WITCH_ID = "class_witch";

export const EQUIPMENT_MAGE_STAFF_ID = "equip_mage_staff";
export const EQUIPMENT_SCOUT_DAGGER_ID = "equip_scout_dagger";
export const EQUIPMENT_OAK_SHIELD_ID = "equip_oak_shield";
export const EQUIPMENT_LEATHER_ARMOR_ID = "equip_leather_armor";
export const EQUIPMENT_MYSTIC_ROBE_ID = "equip_mystic_robe";
export const EQUIPMENT_TRAVELER_HAT_ID = "equip_traveler_hat";
export const EQUIPMENT_FOCUS_CHARM_ID = "equip_focus_charm";

export const STARTER_ACTOR_IDS = [DEFAULT_ACTOR_ID, ACTOR_GUARDIAN_ID, ACTOR_MAGE_ID, ACTOR_SCOUT_ID] as const;
export const ALL_ACTOR_IDS = [
  DEFAULT_ACTOR_ID,
  ACTOR_GUARDIAN_ID,
  ACTOR_MAGE_ID,
  ACTOR_SCOUT_ID,
  ACTOR_CLERIC_ID,
  ACTOR_RANGER_ID,
  ACTOR_SAMURAI_ID,
  ACTOR_NINJA_ID,
  ACTOR_MONK_ID,
  ACTOR_BARD_ID,
  ACTOR_DRUID_ID,
  ACTOR_WITCH_ID,
] as const;
export const ALL_CLASS_IDS = [
  DEFAULT_CLASS_ID,
  CLASS_GUARDIAN_ID,
  CLASS_MAGE_ID,
  CLASS_SCOUT_ID,
  CLASS_CLERIC_ID,
  CLASS_RANGER_ID,
  CLASS_SAMURAI_ID,
  CLASS_NINJA_ID,
  CLASS_MONK_ID,
  CLASS_BARD_ID,
  CLASS_DRUID_ID,
  CLASS_WITCH_ID,
] as const;
export const HERO_EQUIPMENT_IDS = [
  DEFAULT_EQUIPMENT_ID,
  EQUIPMENT_SCOUT_DAGGER_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const GUARDIAN_EQUIPMENT_IDS = [
  DEFAULT_EQUIPMENT_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const MAGE_EQUIPMENT_IDS = [
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const SCOUT_EQUIPMENT_IDS = [
  EQUIPMENT_SCOUT_DAGGER_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const CLERIC_EQUIPMENT_IDS = [
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const RANGER_EQUIPMENT_IDS = [
  EQUIPMENT_SCOUT_DAGGER_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
// 새 직업 장비 허용(직업 equipmentPermissions). 무기 레코드의 equippable 목록은 건드리지 않고 직업 쪽에서 연다.
export const SAMURAI_EQUIPMENT_IDS = [
  DEFAULT_EQUIPMENT_ID,
  "equip_iron_sword",
  "equip_steel_sword",
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const NINJA_EQUIPMENT_IDS = [
  EQUIPMENT_SCOUT_DAGGER_ID,
  "equip_short_sword",
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const MONK_EQUIPMENT_IDS = [
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const BARD_EQUIPMENT_IDS = [
  EQUIPMENT_SCOUT_DAGGER_ID,
  "equip_short_sword",
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const DRUID_EQUIPMENT_IDS = [
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
export const WITCH_EQUIPMENT_IDS = [
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  EQUIPMENT_FOCUS_CHARM_ID,
] as const;
