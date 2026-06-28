// SIZE_OK: default actor/class/equipment seed tables are kept together so blank-project database snapshots stay reviewable.
import type { ActorRecord, ClassBattleCommand, ClassRecord, EquipmentRecord } from "../types";
import { createActorRecord } from "../actorModel";
import { normalizeClassRecord } from "../databaseRecordModel";
import {
  DEFAULT_ACTOR_ID,
  DEFAULT_ANIMATION_ID,
  DEFAULT_CLASS_ID,
  DEFAULT_EQUIPMENT_ID,
  DEFAULT_SKILL_ID,
} from "./constants";
import { defaultEquipmentRecords } from "./defaultDatabaseEquipmentRecords";
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
  EQUIPMENT_FOCUS_CHARM_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_SCOUT_DAGGER_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  GUARDIAN_EQUIPMENT_IDS,
  HERO_EQUIPMENT_IDS,
  MAGE_EQUIPMENT_IDS,
  RANGER_EQUIPMENT_IDS,
  SCOUT_EQUIPMENT_IDS,
  STARTER_ACTOR_IDS,
} from "./defaultDatabaseRecordIds";

const STANDARD_BATTLE_COMMANDS = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "기술", kind: "skill" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
  { id: "cmd_change", name: "교체", kind: "event" },
] as const satisfies readonly ClassBattleCommand[];

type PartyRecords = {
  readonly actors: ActorRecord[];
  readonly classes: ClassRecord[];
  readonly equipment: EquipmentRecord[];
};

export function defaultStarterActorIds(): string[] {
  return [...STARTER_ACTOR_IDS];
}

export function defaultPartyRecords(): PartyRecords {
  return {
    actors: defaultActorRecords(),
    classes: defaultClassRecords(),
    equipment: defaultEquipmentRecords(),
  };
}

function defaultActorRecords(): ActorRecord[] {
  return [
    {
      ...createActorRecord(DEFAULT_ACTOR_ID, DEFAULT_CLASS_ID, {
        characterResourceId: "easyrpg-charset-actor1",
        battleCharacterResourceId: "generated-actor-hero-01-battle",
        defaultEquipmentId: DEFAULT_EQUIPMENT_ID,
        defaultSkillId: DEFAULT_SKILL_ID,
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "주인공",
      nickname: "없음",
      faceResourceId: "easyrpg-faceset-actor1",
      characterResourceId: "easyrpg-charset-actor1",
      battleCharacterResourceId: "generated-actor-hero-01-battle",
      initialEquipment: {
        weapon: DEFAULT_EQUIPMENT_ID,
        shield: EQUIPMENT_OAK_SHIELD_ID,
        armor: EQUIPMENT_LEATHER_ARMOR_ID,
        helmet: EQUIPMENT_TRAVELER_HAT_ID,
        accessory: EQUIPMENT_FOCUS_CHARM_ID,
      },
    },
    {
      ...createActorRecord(ACTOR_GUARDIAN_ID, CLASS_GUARDIAN_ID, {
        characterResourceId: "easyrpg-charset-actor2",
        battleCharacterResourceId: "generated-actor-hero-02-battle",
        defaultSkillId: DEFAULT_SKILL_ID,
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "수호자",
      nickname: "방패",
      faceResourceId: "easyrpg-faceset-actor2",
      characterResourceId: "easyrpg-charset-actor2",
      battleCharacterResourceId: "generated-actor-hero-02-battle",
      initialEquipment: {
        weapon: DEFAULT_EQUIPMENT_ID,
        shield: EQUIPMENT_OAK_SHIELD_ID,
        armor: EQUIPMENT_LEATHER_ARMOR_ID,
        helmet: EQUIPMENT_TRAVELER_HAT_ID,
        accessory: EQUIPMENT_FOCUS_CHARM_ID,
      },
    },
    {
      ...createActorRecord(ACTOR_MAGE_ID, CLASS_MAGE_ID, {
        characterResourceId: "easyrpg-charset-actor3",
        battleCharacterResourceId: "generated-actor-hero-03-battle",
        defaultSkillId: "skill_arcane_bolt",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "마도사",
      nickname: "별빛",
      faceResourceId: "easyrpg-faceset-people1",
      characterResourceId: "easyrpg-charset-actor3",
      battleCharacterResourceId: "generated-actor-hero-03-battle",
      initialEquipment: {
        weapon: EQUIPMENT_MAGE_STAFF_ID,
        armor: EQUIPMENT_MYSTIC_ROBE_ID,
        helmet: EQUIPMENT_TRAVELER_HAT_ID,
        accessory: EQUIPMENT_FOCUS_CHARM_ID,
      },
    },
    {
      ...createActorRecord(ACTOR_SCOUT_ID, CLASS_SCOUT_ID, {
        characterResourceId: "easyrpg-charset-actor4",
        battleCharacterResourceId: "generated-actor-hero-04-battle",
        defaultSkillId: "skill_poison_sting",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "정찰병",
      nickname: "바람",
      faceResourceId: "easyrpg-faceset-people2",
      characterResourceId: "easyrpg-charset-actor4",
      battleCharacterResourceId: "generated-actor-hero-04-battle",
      initialEquipment: {
        weapon: EQUIPMENT_SCOUT_DAGGER_ID,
        armor: EQUIPMENT_LEATHER_ARMOR_ID,
        helmet: EQUIPMENT_TRAVELER_HAT_ID,
        accessory: EQUIPMENT_FOCUS_CHARM_ID,
      },
    },
    {
      ...createActorRecord(ACTOR_CLERIC_ID, CLASS_CLERIC_ID, {
        characterResourceId: "easyrpg-charset-actor1",
        battleCharacterResourceId: "generated-actor-hero-02-battle",
        defaultSkillId: "skill_heal",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "성직자",
      nickname: "치유",
      faceResourceId: "easyrpg-faceset-people1",
      characterResourceId: "easyrpg-charset-actor1",
      battleCharacterResourceId: "generated-actor-hero-02-battle",
      initialEquipment: {
        weapon: EQUIPMENT_MAGE_STAFF_ID,
        shield: EQUIPMENT_OAK_SHIELD_ID,
        armor: EQUIPMENT_MYSTIC_ROBE_ID,
        helmet: EQUIPMENT_TRAVELER_HAT_ID,
        accessory: EQUIPMENT_FOCUS_CHARM_ID,
      },
    },
    {
      ...createActorRecord(ACTOR_RANGER_ID, CLASS_RANGER_ID, {
        characterResourceId: "easyrpg-charset-actor2",
        battleCharacterResourceId: "generated-actor-hero-01-battle",
        defaultSkillId: "skill_sword_slash",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "궁수",
      nickname: "초원",
      faceResourceId: "easyrpg-faceset-people2",
      characterResourceId: "easyrpg-charset-actor2",
      battleCharacterResourceId: "generated-actor-hero-01-battle",
      initialEquipment: {
        weapon: EQUIPMENT_SCOUT_DAGGER_ID,
        armor: EQUIPMENT_LEATHER_ARMOR_ID,
        helmet: EQUIPMENT_TRAVELER_HAT_ID,
        accessory: EQUIPMENT_FOCUS_CHARM_ID,
      },
    },
  ];
}

function defaultClassRecords(): ClassRecord[] {
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
