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
  ACTOR_BARD_ID,
  ACTOR_DRUID_ID,
  ACTOR_GUARDIAN_ID,
  ACTOR_MAGE_ID,
  ACTOR_MONK_ID,
  ACTOR_NINJA_ID,
  ACTOR_RANGER_ID,
  ACTOR_SAMURAI_ID,
  ACTOR_SCOUT_ID,
  ACTOR_WITCH_ID,
  CLASS_BARD_ID,
  CLASS_CLERIC_ID,
  CLASS_DRUID_ID,
  CLASS_GUARDIAN_ID,
  CLASS_MAGE_ID,
  CLASS_MONK_ID,
  CLASS_NINJA_ID,
  CLASS_RANGER_ID,
  CLASS_SAMURAI_ID,
  CLASS_SCOUT_ID,
  CLASS_WITCH_ID,
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
function pairedFace(characterResourceId: string, characterIndex = 0): string {
  const faceId = reviewedFaceIdForCharset(characterResourceId, characterIndex);
  if (!faceId) throw new Error(`기본 파티 얼굴 대응이 없습니다: ${characterResourceId}#${characterIndex}`);
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
        characterResourceId: "easyrpg-charset-actor1",
        battleCharacterResourceId: "charset-battler-actor1-5",
        defaultSkillId: "skill_arcane_bolt",
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: "마도사",
      nickname: "별빛",
      // 2026-09-28 2차 로스터: actor3#0(사무라이와 공유하던 붉은 무사 칩) → actor1#5(마법 모자).
      faceResourceId: pairedFace("easyrpg-charset-actor1", 5),
      characterResourceId: "easyrpg-charset-actor1",
      characterIndex: 5,
      battleCharacterResourceId: "charset-battler-actor1-5",
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
    ...retroExtensionActors(),
  ];
  applyGeneratedBattleEffectActorBindings(records);
  return records;
}

/**
 * retro2003 확장 예비 배우 6명(2026-09-28). 시작 파티(STARTER_ACTOR_IDS)에는 넣지 않는다 — 성직자·궁수와 같은 자리.
 * 걷기 칩 + index 가 얼굴·전투 시트를 정한다. 사무라이만 걷기 칩 actor3#0 이 마도사 전투 시트와 겹쳐 직업 전용 시트를 명시한다.
 */
function retroExtensionActors(): ActorRecord[] {
  const rows = [
    { id: ACTOR_SAMURAI_ID, classId: CLASS_SAMURAI_ID, name: "사무라이", nickname: "일섬", sheet: "actor3", index: 0, battler: "charset-battler-actor3-0-samurai",
      equipment: { weapon: "equip_iron_sword", armor: EQUIPMENT_LEATHER_ARMOR_ID, helmet: EQUIPMENT_TRAVELER_HAT_ID, accessory: EQUIPMENT_FOCUS_CHARM_ID } },
    { id: ACTOR_NINJA_ID, classId: CLASS_NINJA_ID, name: "닌자", nickname: "그림자", sheet: "actor3", index: 2,
      equipment: { weapon: EQUIPMENT_SCOUT_DAGGER_ID, armor: EQUIPMENT_LEATHER_ARMOR_ID, helmet: EQUIPMENT_TRAVELER_HAT_ID, accessory: EQUIPMENT_FOCUS_CHARM_ID } },
    { id: ACTOR_MONK_ID, classId: CLASS_MONK_ID, name: "무도가", nickname: "철권", sheet: "actor3", index: 5,
      equipment: { armor: EQUIPMENT_LEATHER_ARMOR_ID, helmet: EQUIPMENT_TRAVELER_HAT_ID, accessory: EQUIPMENT_FOCUS_CHARM_ID } },
    { id: ACTOR_BARD_ID, classId: CLASS_BARD_ID, name: "음유시인", nickname: "선율", sheet: "actor3", index: 6,
      equipment: { weapon: EQUIPMENT_SCOUT_DAGGER_ID, armor: EQUIPMENT_LEATHER_ARMOR_ID, helmet: EQUIPMENT_TRAVELER_HAT_ID, accessory: EQUIPMENT_FOCUS_CHARM_ID } },
    { id: ACTOR_DRUID_ID, classId: CLASS_DRUID_ID, name: "드루이드", nickname: "숲지기", sheet: "actor3", index: 4,
      equipment: { weapon: EQUIPMENT_MAGE_STAFF_ID, armor: EQUIPMENT_MYSTIC_ROBE_ID, helmet: EQUIPMENT_TRAVELER_HAT_ID, accessory: EQUIPMENT_FOCUS_CHARM_ID } },
    { id: ACTOR_WITCH_ID, classId: CLASS_WITCH_ID, name: "마녀", nickname: "월식", sheet: "actor4", index: 7,
      equipment: { weapon: EQUIPMENT_MAGE_STAFF_ID, armor: EQUIPMENT_MYSTIC_ROBE_ID, helmet: EQUIPMENT_TRAVELER_HAT_ID, accessory: EQUIPMENT_FOCUS_CHARM_ID } },
  ] as const;
  return rows.map((row) => {
    const characterResourceId = `easyrpg-charset-${row.sheet}`;
    const battleCharacterResourceId = "battler" in row ? row.battler : `charset-battler-${row.sheet}-${row.index}`;
    return {
      ...createActorRecord(row.id, row.classId, {
        characterResourceId,
        battleCharacterResourceId,
        defaultSkillId: DEFAULT_SKILL_ID,
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      }),
      name: row.name,
      nickname: row.nickname,
      faceResourceId: pairedFace(characterResourceId, row.index),
      characterResourceId,
      characterIndex: row.index,
      battleCharacterResourceId,
      initialEquipment: { ...row.equipment },
    };
  });
}
