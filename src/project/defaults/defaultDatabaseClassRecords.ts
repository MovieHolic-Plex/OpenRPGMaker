import type { ClassBattleCommand, ClassRecord } from "../types";
import { normalizeClassRecord } from "../databaseRecordModel";
import { DEFAULT_ACTOR_ID, DEFAULT_ANIMATION_ID, DEFAULT_CLASS_ID, DEFAULT_SKILL_ID } from "./constants";
import {
  ACTOR_CLERIC_ID,
  ACTOR_GUARDIAN_ID,
  ACTOR_MAGE_ID,
  ACTOR_RANGER_ID,
  ACTOR_SCOUT_ID,
  CLASS_CLERIC_ID,
  CLASS_GUARDIAN_ID,
  CLASS_MAGE_ID,
  CLASS_RANGER_ID,
  CLASS_SCOUT_ID,
  CLERIC_EQUIPMENT_IDS,
  GUARDIAN_EQUIPMENT_IDS,
  HERO_EQUIPMENT_IDS,
  MAGE_EQUIPMENT_IDS,
  RANGER_EQUIPMENT_IDS,
  SCOUT_EQUIPMENT_IDS,
} from "./defaultDatabaseRecordIds";

const STANDARD_BATTLE_COMMANDS = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "기술", kind: "skill" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
  { id: "cmd_change", name: "교체", kind: "event" },
] as const satisfies readonly ClassBattleCommand[];

export function defaultClassRecords(): ClassRecord[] {
  return [
    normalizeClassRecord({
      id: DEFAULT_CLASS_ID,
      name: "전사",
      options: { dualWield: false, autoBattle: false, fixedEquipment: false, mightyGuard: false },
      animationId: DEFAULT_ANIMATION_ID,
      skillIds: [DEFAULT_SKILL_ID, "skill_sword_slash", "skill_focus"],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      equipmentPermissions: {
        actorIds: [DEFAULT_ACTOR_ID],
        classIds: [DEFAULT_CLASS_ID],
        equipmentIds: [...HERO_EQUIPMENT_IDS],
      },
    }),
    normalizeClassRecord({
      id: CLASS_GUARDIAN_ID,
      name: "수호자",
      options: { dualWield: false, autoBattle: false, fixedEquipment: true, mightyGuard: true },
      animationId: DEFAULT_ANIMATION_ID,
      skillIds: [DEFAULT_SKILL_ID, "skill_sword_slash", "skill_focus"],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      equipmentPermissions: {
        actorIds: [ACTOR_GUARDIAN_ID],
        classIds: [CLASS_GUARDIAN_ID],
        equipmentIds: [...GUARDIAN_EQUIPMENT_IDS],
      },
    }),
    normalizeClassRecord({
      id: CLASS_MAGE_ID,
      name: "마도사",
      options: { dualWield: false, autoBattle: false, fixedEquipment: false, mightyGuard: false },
      animationId: "anim_magic",
      skillIds: [DEFAULT_SKILL_ID, "skill_arcane_bolt", "skill_heal", "skill_sleep_mist", "skill_weaken"],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      equipmentPermissions: {
        actorIds: [ACTOR_MAGE_ID],
        classIds: [CLASS_MAGE_ID],
        equipmentIds: [...MAGE_EQUIPMENT_IDS],
      },
    }),
    normalizeClassRecord({
      id: CLASS_SCOUT_ID,
      name: "정찰병",
      options: { dualWield: true, autoBattle: false, fixedEquipment: false, mightyGuard: false },
      animationId: "anim_poison",
      skillIds: [DEFAULT_SKILL_ID, "skill_sword_slash", "skill_poison_sting"],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      equipmentPermissions: {
        actorIds: [ACTOR_SCOUT_ID],
        classIds: [CLASS_SCOUT_ID],
        equipmentIds: [...SCOUT_EQUIPMENT_IDS],
      },
    }),
    normalizeClassRecord({
      id: CLASS_CLERIC_ID,
      name: "성직자",
      options: { dualWield: false, autoBattle: false, fixedEquipment: false, mightyGuard: true },
      animationId: "anim_heal",
      skillIds: [DEFAULT_SKILL_ID, "skill_heal", "skill_focus", "skill_sleep_mist"],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      equipmentPermissions: {
        actorIds: [ACTOR_CLERIC_ID],
        classIds: [CLASS_CLERIC_ID],
        equipmentIds: [...CLERIC_EQUIPMENT_IDS],
      },
    }),
    normalizeClassRecord({
      id: CLASS_RANGER_ID,
      name: "궁수",
      options: { dualWield: true, autoBattle: false, fixedEquipment: false, mightyGuard: false },
      animationId: "anim_arrow",
      skillIds: [DEFAULT_SKILL_ID, "skill_sword_slash", "skill_poison_sting", "skill_weaken"],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      equipmentPermissions: {
        actorIds: [ACTOR_RANGER_ID],
        classIds: [CLASS_RANGER_ID],
        equipmentIds: [...RANGER_EQUIPMENT_IDS],
      },
    }),
  ];
}
