import type {
  ActorRecord,
  BattleAnimationRecord,
  ClassRecord,
  DatabaseRecords,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  ProjectSession,
  SkillRecord,
  StateRecord,
  SystemRecords,
  Terms,
  TroopRecord,
} from "../types";
import { createActorRecord } from "../actorModel";
import {
  normalizeClassRecord,
  normalizeEnemyRecord,
  normalizeEquipmentRecord,
  normalizeItemRecord,
  normalizeSkillRecord,
  normalizeTroopRecord,
} from "../databaseRecordModel";
import {
  DEFAULT_ACTOR_ID,
  DEFAULT_ANIMATION_ID,
  DEFAULT_CLASS_ID,
  DEFAULT_ENEMY_ID,
  DEFAULT_EQUIPMENT_ID,
  DEFAULT_ITEM_ID,
  DEFAULT_SKILL_ID,
  DEFAULT_STATE_ID,
  DEFAULT_TROOP_ID,
} from "./constants";

export function defaultTerms(): Terms {
  return {
    gold: "G",
    level: "레벨",
    hp: "HP",
    mp: "MP",
    attack: "공격",
    skill: "스킬",
    item: "아이템",
  };
}

export function defaultDatabase(): DatabaseRecords {
  const actors: ActorRecord[] = [
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
    },
  ];
  const classes: ClassRecord[] = [normalizeClassRecord({ id: DEFAULT_CLASS_ID, name: "전사", skillIds: [DEFAULT_SKILL_ID] })];
  const skills: SkillRecord[] = [
    normalizeSkillRecord({ id: DEFAULT_SKILL_ID, name: "공격", scope: "enemy", power: 10, animationId: DEFAULT_ANIMATION_ID }),
  ];
  const items: ItemRecord[] = [
    normalizeItemRecord({
      id: DEFAULT_ITEM_ID,
      name: "회복약",
      scope: "ally",
      price: 50,
      imageResourceId: "generated-item-potion-red-image",
      iconResourceId: "generated-item-potion-red-icon",
    }),
  ];
  const equipment: EquipmentRecord[] = [
    normalizeEquipmentRecord({
      id: DEFAULT_EQUIPMENT_ID,
      name: "청동 검",
      slot: "weapon",
      price: 100,
      imageResourceId: "easyrpg-battle-weapon-weapon",
      iconResourceId: "easyrpg-battle-weapon-weapon",
    }),
  ];
  const enemies: EnemyRecord[] = [
    normalizeEnemyRecord({ id: DEFAULT_ENEMY_ID, name: "말벌", monsterResourceId: "easyrpg-monster-hornet", skillIds: [DEFAULT_SKILL_ID] }),
  ];
  const troops: TroopRecord[] = [
    normalizeTroopRecord({ id: DEFAULT_TROOP_ID, name: "말벌 무리", enemyIds: [DEFAULT_ENEMY_ID], battleEventPages: [] }),
  ];
  const states: StateRecord[] = [{ id: DEFAULT_STATE_ID, name: "독" }];
  const battleAnimations: BattleAnimationRecord[] = [
    { id: DEFAULT_ANIMATION_ID, name: "타격", resourceId: "easyrpg-battle-blow" },
  ];
  return {
    actors,
    classes,
    skills,
    items,
    equipment,
    enemies,
    troops,
    states,
    battleAnimations,
  };
}

export function defaultSystem(): SystemRecords {
  return {
    startActorIds: [DEFAULT_ACTOR_ID],
    titleResourceId: "easyrpg-title-title1",
    systemResourceId: "easyrpg-system-system",
    battleSystemResourceId: "easyrpg-system2-system2-c",
    initialTroopId: DEFAULT_TROOP_ID,
  };
}

export function defaultSession(): ProjectSession {
  return {
    switches: {},
    variables: {},
    inventory: {},
    partyActorIds: [DEFAULT_ACTOR_ID],
  };
}
