import { ACTOR_LEVEL_MAX } from "../actorModel";
import type { ActorParameterCurves, ActorParameterKey, ClassBattleCommand, ClassRecord } from "../types";
import { normalizeClassRecord } from "../databaseRecordModel";
import { DEFAULT_ANIMATION_ID, DEFAULT_CLASS_ID, DEFAULT_SKILL_ID } from "./constants";
import {
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
import { applyGeneratedBattleEffectClassBindings } from "./generatedBattleEffectBindings";
import { retroClassLearnedSkills } from "./retroClassSkillRecords";

const STANDARD_BATTLE_COMMANDS = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "기술", kind: "skill" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
  { id: "cmd_change", name: "교체", kind: "switch" },
] as const satisfies readonly ClassBattleCommand[];

type ClassGrowthRole = "striker" | "guardian" | "caster" | "agile";

function interpolateCurve(start: number, end: number): number[] {
  const last = Math.max(1, ACTOR_LEVEL_MAX - 1);
  return Array.from({ length: ACTOR_LEVEL_MAX }, (_, index) =>
    Math.round(start + (end - start) * (index / last)),
  );
}

function roleParameterCurves(role: ClassGrowthRole): ActorParameterCurves {
  const primary: Record<ClassGrowthRole, ActorParameterKey> = {
    striker: "attack",
    guardian: "defense",
    caster: "mind",
    agile: "agility",
  };
  const starts: Record<ActorParameterKey, number> = {
    maxHp: 40,
    maxMp: role === "caster" ? 24 : 12,
    attack: 14,
    defense: 14,
    mind: 14,
    agility: 14,
  };
  const ends: Record<ActorParameterKey, number> = {
    maxHp: role === "guardian" ? 900 : 720,
    maxMp: role === "caster" ? 320 : 160,
    attack: 90,
    defense: 90,
    mind: 90,
    agility: 90,
  };
  starts[primary[role]] = 22;
  ends[primary[role]] = 200;
  return {
    maxHp: interpolateCurve(starts.maxHp, ends.maxHp),
    maxMp: interpolateCurve(starts.maxMp, ends.maxMp),
    attack: interpolateCurve(starts.attack, ends.attack),
    defense: interpolateCurve(starts.defense, ends.defense),
    mind: interpolateCurve(starts.mind, ends.mind),
    agility: interpolateCurve(starts.agility, ends.agility),
  };
}

export function defaultClassRecords(): ClassRecord[] {
  const records = [
    normalizeClassRecord({
      id: DEFAULT_CLASS_ID,
      name: "전사",
      options: { dualWield: false, autoBattle: false, fixedEquipment: false, mightyGuard: false },
      animationId: DEFAULT_ANIMATION_ID,
      skillIds: [DEFAULT_SKILL_ID, "skill_sword_slash", "skill_focus"],
      battleCommands: [...STANDARD_BATTLE_COMMANDS],
      parameterCurves: roleParameterCurves("striker"),
      equipmentPermissions: {
        actorIds: [],
        classIds: [],
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
      parameterCurves: roleParameterCurves("guardian"),
      equipmentPermissions: {
        actorIds: [],
        classIds: [],
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
      parameterCurves: roleParameterCurves("caster"),
      equipmentPermissions: {
        actorIds: [],
        classIds: [],
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
      parameterCurves: roleParameterCurves("agile"),
      equipmentPermissions: {
        actorIds: [],
        classIds: [],
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
      parameterCurves: roleParameterCurves("caster"),
      equipmentPermissions: {
        actorIds: [],
        classIds: [],
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
      parameterCurves: roleParameterCurves("agile"),
      equipmentPermissions: {
        actorIds: [],
        classIds: [],
        equipmentIds: [...RANGER_EQUIPMENT_IDS],
      },
    }),
  ];
  // retro2003 직업 스킬: 계약의 레벨대로 배운다. 기존 스킬(레벨 1)은 그대로 둔다.
  for (const record of records) {
    const known = new Set(record.learnedSkills.map((entry) => entry.skillId));
    const added = retroClassLearnedSkills(record.id).filter((entry) => !known.has(entry.skillId));
    record.learnedSkills = [...record.learnedSkills, ...added];
    record.skillIds = record.learnedSkills.map((entry) => entry.skillId);
  }
  applyGeneratedBattleEffectClassBindings(records);
  return records;
}
