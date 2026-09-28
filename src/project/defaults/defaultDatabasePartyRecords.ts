import type { ActorRecord, ClassRecord, EquipmentRecord } from "../types";
import { createActorRecord } from "../actorModel";
import {
  DEFAULT_ACTOR_ID,
  DEFAULT_ANIMATION_ID,
  DEFAULT_CLASS_ID,
  DEFAULT_EQUIPMENT_ID,
  DEFAULT_SKILL_ID,
} from "./constants";
import { defaultClassRecords } from "./defaultDatabaseClassRecords";
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
  EQUIPMENT_FOCUS_CHARM_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_SCOUT_DAGGER_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
  STARTER_ACTOR_IDS,
} from "./defaultDatabaseRecordIds";
import { applyGeneratedBattleEffectActorBindings } from "./generatedBattleEffectBindings";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";

type PartyRecords = {
  readonly actors: ActorRecord[];
  readonly classes: ClassRecord[];
  readonly equipment: EquipmentRecord[];
};

export function defaultStarterActorIds(): string[] {
  return [...STARTER_ACTOR_IDS];
}

/** 걷기 그림 0번 칸의 검토된 짝 얼굴. 이름이 같은 얼굴 시트를 쓰면 틀린다(Actor2 ↔ FaceSet/Actor1 8~15칸). */
function pairedFace(characterResourceId: string): string {
  const faceId = reviewedFaceIdForCharset(characterResourceId, 0);
  if (!faceId) throw new Error(`기본 파티 얼굴 대응이 없습니다: ${characterResourceId}`);
  return faceId;
}

export function defaultPartyRecords(): PartyRecords {
  return {
    actors: defaultActorRecords(),
    classes: defaultClassRecords(),
    equipment: defaultEquipmentRecords(),
  };
}

function defaultActorRecords(): ActorRecord[] {
  const records = [
    {
      ...createActorRecord(DEFAULT_ACTOR_ID, DEFAULT_CLASS_ID, {
        characterResourceId: "easyrpg-charset-actor1",
        battleCharacterResourceId: "charset-battler-actor1-0",
        defaultEquipmentId: DEFAULT_EQUIPMENT_ID,
        defaultSkillId: DEFAULT_SKILL_ID,
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "주인공",
      nickname: "없음",
      faceResourceId: pairedFace("easyrpg-charset-actor1"),
      characterResourceId: "easyrpg-charset-actor1",
      battleCharacterResourceId: "charset-battler-actor1-0",
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
        battleCharacterResourceId: "charset-battler-actor2-0",
        defaultSkillId: DEFAULT_SKILL_ID,
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "수호자",
      nickname: "방패",
      faceResourceId: pairedFace("easyrpg-charset-actor2"),
      characterResourceId: "easyrpg-charset-actor2",
      battleCharacterResourceId: "charset-battler-actor2-0",
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
        battleCharacterResourceId: "charset-battler-actor3-0",
        defaultSkillId: "skill_arcane_bolt",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "마도사",
      nickname: "별빛",
      faceResourceId: pairedFace("easyrpg-charset-actor3"),
      characterResourceId: "easyrpg-charset-actor3",
      battleCharacterResourceId: "charset-battler-actor3-0",
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
        battleCharacterResourceId: "charset-battler-actor4-0",
        defaultSkillId: "skill_poison_sting",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "정찰병",
      nickname: "바람",
      faceResourceId: pairedFace("easyrpg-charset-actor4"),
      characterResourceId: "easyrpg-charset-actor4",
      battleCharacterResourceId: "charset-battler-actor4-0",
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
        battleCharacterResourceId: "charset-battler-actor1-7",
        defaultSkillId: "skill_heal",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "성직자",
      nickname: "치유",
      faceResourceId: pairedFace("easyrpg-charset-actor1"),
      characterResourceId: "easyrpg-charset-actor1",
      characterIndex: 7,
      battleCharacterResourceId: "charset-battler-actor1-7",
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
        battleCharacterResourceId: "charset-battler-actor2-3",
        defaultSkillId: "skill_sword_slash",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "궁수",
      nickname: "초원",
      faceResourceId: pairedFace("easyrpg-charset-actor2"),
      characterResourceId: "easyrpg-charset-actor2",
      characterIndex: 3,
      battleCharacterResourceId: "charset-battler-actor2-3",
      initialEquipment: {
        weapon: EQUIPMENT_SCOUT_DAGGER_ID,
        armor: EQUIPMENT_LEATHER_ARMOR_ID,
        helmet: EQUIPMENT_TRAVELER_HAT_ID,
        accessory: EQUIPMENT_FOCUS_CHARM_ID,
      },
    },
  ];
  applyGeneratedBattleEffectActorBindings(records);
  return records;
}
