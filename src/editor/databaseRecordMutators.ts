import { isItemScope, isSkillScope } from "@/editor/databaseReferences";
import {
  normalizeClassRecord,
  normalizeEnemyRecord,
  normalizeEquipmentRecord,
  normalizeItemRecord,
  normalizeSkillRecord,
  normalizeTroopRecord,
} from "@/project/databaseRecordModel";
import type {
  ClassRecord,
  DatabaseRecords,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  SkillRecord,
  TroopRecord,
} from "@/project/types";

export function updateClassRecord(database: DatabaseRecords, id: string, patch: Partial<ClassRecord>): void {
  const index = database.classes.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`레코드를 찾을 수 없습니다: ${id}`);
  const record = { ...database.classes[index] };
  if ("name" in patch && patch.name !== undefined) record.name = patch.name;
  if ("options" in patch && patch.options !== undefined) record.options = patch.options;
  if ("animationId" in patch) record.animationId = patch.animationId;
  if ("skillIds" in patch && patch.skillIds !== undefined) record.skillIds = patch.skillIds;
  if ("battleCommands" in patch && patch.battleCommands !== undefined) record.battleCommands = patch.battleCommands;
  if ("learnedSkills" in patch && patch.learnedSkills !== undefined) record.learnedSkills = patch.learnedSkills;
  if ("promotions" in patch && patch.promotions !== undefined) record.promotions = patch.promotions;
  if ("equipmentPermissions" in patch && patch.equipmentPermissions !== undefined) record.equipmentPermissions = patch.equipmentPermissions;
  if ("parameterCurves" in patch && patch.parameterCurves !== undefined) record.parameterCurves = patch.parameterCurves;
  if ("expCurve" in patch && patch.expCurve !== undefined) record.expCurve = patch.expCurve;
  if ("stateRates" in patch && patch.stateRates !== undefined) record.stateRates = patch.stateRates;
  if ("elementRates" in patch && patch.elementRates !== undefined) record.elementRates = patch.elementRates;
  database.classes[index] = normalizeClassRecord(record);
}

export function updateSkillRecord(database: DatabaseRecords, id: string, patch: Partial<SkillRecord>): void {
  const index = database.skills.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`레코드를 찾을 수 없습니다: ${id}`);
  const record = { ...database.skills[index] };
  if ("name" in patch && patch.name !== undefined) record.name = patch.name;
  if ("scope" in patch && isSkillScope(patch.scope)) record.scope = patch.scope;
  if ("power" in patch && patch.power !== undefined) record.power = patch.power;
  if ("animationId" in patch) record.animationId = patch.animationId;
  if ("description" in patch && patch.description !== undefined) record.description = patch.description;
  if ("type" in patch && isSkillType(patch.type)) record.type = patch.type;
  if ("mpCost" in patch && patch.mpCost !== undefined) record.mpCost = patch.mpCost;
  if ("successRate" in patch && patch.successRate !== undefined) record.successRate = patch.successRate;
  if ("variance" in patch && patch.variance !== undefined) record.variance = patch.variance;
  if ("hitRate" in patch && patch.hitRate !== undefined) record.hitRate = patch.hitRate;
  if ("effect" in patch && patch.effect !== undefined) record.effect = patch.effect;
  // 속성/상태 변화는 런타임이 소비하는 필드(runtime.ts elementMultiplierFor/applyStateEffects) — 편집 반영 필수.
  if ("elementId" in patch) record.elementId = patch.elementId;
  if ("stateEffects" in patch && patch.stateEffects !== undefined) record.stateEffects = patch.stateEffects;
  if ("actionSkill" in patch) record.actionSkill = patch.actionSkill;
  if ("movePriority" in patch) record.movePriority = patch.movePriority;
  database.skills[index] = normalizeSkillRecord(record);
}

export function updateItemRecord(database: DatabaseRecords, id: string, patch: Partial<ItemRecord>): void {
  const index = database.items.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`레코드를 찾을 수 없습니다: ${id}`);
  const record = { ...database.items[index] };
  if ("name" in patch && patch.name !== undefined) record.name = patch.name;
  if ("imageResourceId" in patch) record.imageResourceId = patch.imageResourceId;
  if ("iconResourceId" in patch) record.iconResourceId = patch.iconResourceId;
  if ("scope" in patch && isItemScope(patch.scope)) record.scope = patch.scope;
  if ("price" in patch && patch.price !== undefined) record.price = patch.price;
  if ("skillId" in patch) record.skillId = patch.skillId;
  if ("description" in patch && patch.description !== undefined) record.description = patch.description;
  if ("type" in patch && isItemType(patch.type)) record.type = patch.type;
  if ("occasion" in patch && patch.occasion !== undefined) record.occasion = patch.occasion;
  if ("consumable" in patch && patch.consumable !== undefined) record.consumable = patch.consumable;
  if ("animationId" in patch) record.animationId = patch.animationId;
  if ("stateEffects" in patch && patch.stateEffects !== undefined) record.stateEffects = patch.stateEffects;
  if ("consumptionLimit" in patch && patch.consumptionLimit !== undefined) record.consumptionLimit = patch.consumptionLimit;
  if ("usableActorIds" in patch && patch.usableActorIds !== undefined) record.usableActorIds = patch.usableActorIds;
  if ("usableClassIds" in patch && patch.usableClassIds !== undefined) record.usableClassIds = patch.usableClassIds;
  if ("healStateIds" in patch && patch.healStateIds !== undefined) record.healStateIds = patch.healStateIds;
  if ("hpRecovery" in patch && patch.hpRecovery !== undefined) record.hpRecovery = patch.hpRecovery;
  if ("mpRecovery" in patch && patch.mpRecovery !== undefined) record.mpRecovery = patch.mpRecovery;
  if ("onlyUsableInMenu" in patch && patch.onlyUsableInMenu !== undefined) record.onlyUsableInMenu = patch.onlyUsableInMenu;
  if ("onlyEffectiveOnDeadActors" in patch && patch.onlyEffectiveOnDeadActors !== undefined) record.onlyEffectiveOnDeadActors = patch.onlyEffectiveOnDeadActors;
  if ("learnedSkillId" in patch) record.learnedSkillId = patch.learnedSkillId;
  if ("activateSkillId" in patch) record.activateSkillId = patch.activateSkillId;
  if ("usageMessage" in patch && patch.usageMessage !== undefined) record.usageMessage = patch.usageMessage;
  if ("switchId" in patch) record.switchId = patch.switchId;
  if ("occasionField" in patch && patch.occasionField !== undefined) record.occasionField = patch.occasionField;
  if ("occasionBattle" in patch && patch.occasionBattle !== undefined) record.occasionBattle = patch.occasionBattle;
  if ("seedParameterBonuses" in patch && patch.seedParameterBonuses !== undefined) record.seedParameterBonuses = patch.seedParameterBonuses;
  if ("equipmentProfile" in patch && patch.equipmentProfile !== undefined) record.equipmentProfile = patch.equipmentProfile;
  if ("farmTool" in patch) record.farmTool = patch.farmTool;
  if ("captureProfile" in patch) record.captureProfile = patch.captureProfile;
  database.items[index] = normalizeItemRecord(record);
}

export function updateEquipmentRecord(database: DatabaseRecords, id: string, patch: Partial<EquipmentRecord>): void {
  const index = database.equipment.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`레코드를 찾을 수 없습니다: ${id}`);
  const record = { ...database.equipment[index] };
  if ("name" in patch && patch.name !== undefined) record.name = patch.name;
  if ("imageResourceId" in patch) record.imageResourceId = patch.imageResourceId;
  if ("iconResourceId" in patch) record.iconResourceId = patch.iconResourceId;
  if ("slot" in patch && patch.slot !== undefined) record.slot = patch.slot;
  if ("price" in patch && patch.price !== undefined) record.price = patch.price;
  if ("skillId" in patch) record.skillId = patch.skillId;
  if ("description" in patch && patch.description !== undefined) record.description = patch.description;
  if ("statBonuses" in patch && patch.statBonuses !== undefined) record.statBonuses = patch.statBonuses;
  if ("equippableActorIds" in patch && patch.equippableActorIds !== undefined) record.equippableActorIds = patch.equippableActorIds;
  if ("equippableClassIds" in patch && patch.equippableClassIds !== undefined) record.equippableClassIds = patch.equippableClassIds;
  if ("cursed" in patch && patch.cursed !== undefined) record.cursed = patch.cursed;
  if ("twoHanded" in patch && patch.twoHanded !== undefined) record.twoHanded = patch.twoHanded;
  if ("usableAsItemSkillId" in patch) record.usableAsItemSkillId = patch.usableAsItemSkillId;
  if ("attackElementIds" in patch && patch.attackElementIds !== undefined) record.attackElementIds = patch.attackElementIds;
  if ("stateInflictIds" in patch && patch.stateInflictIds !== undefined) record.stateInflictIds = patch.stateInflictIds;
  if ("stateInflictionChance" in patch && patch.stateInflictionChance !== undefined) record.stateInflictionChance = patch.stateInflictionChance;
  if ("effectFlags" in patch && patch.effectFlags !== undefined) record.effectFlags = patch.effectFlags;
  if ("elementalDefenseIds" in patch && patch.elementalDefenseIds !== undefined) record.elementalDefenseIds = patch.elementalDefenseIds;
  if ("stateDefenseIds" in patch && patch.stateDefenseIds !== undefined) record.stateDefenseIds = patch.stateDefenseIds;
  if ("stateDefenseMode" in patch && patch.stateDefenseMode !== undefined) record.stateDefenseMode = patch.stateDefenseMode;
  if ("stateResistanceChance" in patch && patch.stateResistanceChance !== undefined) record.stateResistanceChance = patch.stateResistanceChance;
  if ("actionWeapon" in patch) record.actionWeapon = patch.actionWeapon;
  database.equipment[index] = normalizeEquipmentRecord(record);
}

export function updateEnemyRecord(database: DatabaseRecords, id: string, patch: Partial<EnemyRecord>): void {
  const index = database.enemies.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`레코드를 찾을 수 없습니다: ${id}`);
  const record = { ...database.enemies[index] };
  if ("name" in patch && patch.name !== undefined) record.name = patch.name;
  if ("speciesId" in patch) record.speciesId = patch.speciesId;
  // level 은 보상 레벨갭(battleRewards)과 포획 몬스터 시작 레벨에 쓰인다 — 패치를 흘리면 안 된다.
  if ("level" in patch) record.level = patch.level;
  if ("skillIds" in patch && patch.skillIds !== undefined) record.skillIds = patch.skillIds;
  if ("monsterResourceId" in patch) record.monsterResourceId = patch.monsterResourceId;
  if ("graphicHue" in patch && patch.graphicHue !== undefined) record.graphicHue = patch.graphicHue;
  if ("transparent" in patch && patch.transparent !== undefined) record.transparent = patch.transparent;
  if ("flying" in patch && patch.flying !== undefined) record.flying = patch.flying;
  if ("criticalHit" in patch && patch.criticalHit !== undefined) {
    record.criticalHit = patch.criticalHit;
  }
  if ("attackOptions" in patch && patch.attackOptions !== undefined) {
    record.attackOptions = patch.attackOptions;
  }
  if ("stats" in patch && patch.stats !== undefined) record.stats = patch.stats;
  if ("rewards" in patch && patch.rewards !== undefined) record.rewards = patch.rewards;
  if ("actions" in patch && patch.actions !== undefined) record.actions = patch.actions;
  if ("stateRates" in patch && patch.stateRates !== undefined) record.stateRates = patch.stateRates;
  if ("elementRates" in patch && patch.elementRates !== undefined) record.elementRates = patch.elementRates;
  if ("actionProfile" in patch) record.actionProfile = patch.actionProfile;
  database.enemies[index] = normalizeEnemyRecord(record);
}

export function updateTroopRecord(database: DatabaseRecords, id: string, patch: Partial<TroopRecord>): void {
  const index = database.troops.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`레코드를 찾을 수 없습니다: ${id}`);
  const record = { ...database.troops[index] };
  if ("name" in patch && patch.name !== undefined) record.name = patch.name;
  if ("enemyIds" in patch && patch.enemyIds !== undefined) record.enemyIds = patch.enemyIds;
  if ("members" in patch && patch.members !== undefined) record.members = patch.members;
  if ("autoAlign" in patch && patch.autoAlign !== undefined) record.autoAlign = patch.autoAlign;
  if ("uncapturable" in patch && patch.uncapturable !== undefined) record.uncapturable = patch.uncapturable;
  if ("previewBackgroundResourceId" in patch) record.previewBackgroundResourceId = patch.previewBackgroundResourceId;
  if ("battleFlow" in patch) record.battleFlow = patch.battleFlow;
  if ("activeSlots" in patch) record.activeSlots = patch.activeSlots;
  if ("battleEventPages" in patch && patch.battleEventPages !== undefined) record.battleEventPages = patch.battleEventPages;
  database.troops[index] = normalizeTroopRecord(record);
}

function isSkillType(value: unknown): value is SkillRecord["type"] {
  return value === "normal" || value === "teleport" || value === "escape" || value === "switch";
}

function isItemType(value: unknown): value is ItemRecord["type"] {
  return (
    value === "normalGoods" ||
    value === "weapon" ||
    value === "shield" ||
    value === "body" ||
    value === "head" ||
    value === "accessory" ||
    value === "medicine" ||
    value === "book" ||
    value === "seed" ||
    value === "special" ||
    value === "switch"
  );
}
