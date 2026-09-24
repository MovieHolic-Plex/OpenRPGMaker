import { finalizeSkillCombatPatch, validateEnemyCombatPatch, validateSkillCombatPatch } from "./combatAuthoringValidation";
import { actionSkillClearProperties, authoredSkillProperties, combatConditionSchema, conditionalDropsSchema } from "./combatAuthoringSchemas";
import { hasEquipmentSlot } from "@/project/equipmentSlots";
import { mergeRecordPatch } from "./mergeRecordPatch";
import { projectDatabaseReferenceMessage } from "@/editor/databaseRecordReferences";
// editor/tools/dbTools.ts
// DB 쓰기 툴: upsert_item / upsert_enemy / upsert_troop / upsert_actor / upsert_skill
//            / upsert_equipment / upsert_class / define_promotion / upsert_state / upsert_common_event
//            / set_session_start / set_title_screen.
// 모든 레코드는 기존 레코드와 병합한 뒤 normalize* 계열을 거쳐 id로 upsert한다.

import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { normalizeActorRecord } from "@/project/actorModel";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { MAX_TITLE_BACKGROUND_LAYERS, normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord, normalizeStateRecord, normalizeTypeChart } from "@/project/databaseRecordModel";
import { normalizeCropRecord } from "@/project/farmModel";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { countLimitedRuntimeSupportCommands } from "@/project/lint/projectLint";
import { ensureMonsterGraphic } from "./monsterGraphicAssignment";
import type {
  ActorRecord,
  BattleAnimationRecord,
  ClassRecord,
  Command,
  CommonEvent,
  CropRecord,
  EnemyRecord,
  EquipmentRecord,
  GameEvent,
  ItemRecord,
  MonsterSpeciesRecord,
  Project,
  SkillRecord,
  StateRecord,
  TitleBackgroundLayer,
  TitleIntroSettings,
  TitleParticleSettings,
  TroopRecord,
} from "@/project/types";
import { normalizeLowLevelCommandArray, validateLowLevelCommandArray } from "./commandArgs";
import { assertPartyActorReferences } from "./partyActorReferences";
import { resolveEventPlacement } from "./eventTools";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { troopBalanceWarnings } from "./troopBalanceCheck";
import { expandShortParameterCurves } from "./parameterCurveInput";
import { isBossEnemy, scaleBossToStartParty } from "./bossThreatScaling";
import { COMMAND_SCHEMA } from "./schemaShapes";

const DATABASE_RECORD_COLLECTIONS = [
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "troops",
  "states",
  "battleAnimations",
  "monsterSpecies",
  "crops",
  "lifeSkills",
  "farmAnimalSpecies",
  "fishSpecies",
  "farmBuildingTypes",
  "homeDecorationTypes",
] as const;
type DatabaseRecordCollection = (typeof DATABASE_RECORD_COLLECTIONS)[number];
const DATABASE_UTILITY_COLLECTIONS = ["elements", "terrains", "battleCommands"] as const;

// id 기준으로 배열에 upsert.
// Serialize concurrent DB writes to prevent lost update (read-modify-write race).
export let dbWriteQueue: Promise<void> = Promise.resolve();
export function serializeDbWrite<T>(task: () => T | Promise<T>): Promise<T> {
  const next = dbWriteQueue.then(task, task) as Promise<T>;
  dbWriteQueue = (next as Promise<unknown>).then(() => {}, () => {}) as Promise<void>;
  return next;
}

function upsertById<T extends { id: string }>(list: T[], record: T): "added" | "modified" {
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index >= 0) {
    list[index] = record;
    return "modified";
  }
  list.push(record);
  return "added";
}

function parseDatabaseRecordCollection(value: unknown): DatabaseRecordCollection {
  switch (value) {
    case "actors":
    case "classes":
    case "skills":
    case "items":
    case "equipment":
    case "enemies":
    case "troops":
    case "states":
    case "battleAnimations":
    case "monsterSpecies":
    case "crops":
    case "lifeSkills":
    case "farmAnimalSpecies":
    case "fishSpecies":
    case "farmBuildingTypes":
    case "homeDecorationTypes":
      return value;
    default:
      throw new ToolError(
        `지원하지 않는 DB collection입니다: ${String(value)}. 사용 가능한 값: ${DATABASE_RECORD_COLLECTIONS.join(", ")}`,
        { code: "invalid-args" },
      );
  }
}

function duplicateRecord<T extends { id: string; name: string }>(records: T[], id: string, newId: string, requestedName?: string): T {
  const source = records.find((record) => record.id === id);
  if (!source) throw new ToolError(`복제할 DB 레코드를 찾을 수 없습니다: ${id}`, { code: "database-record-not-found" });
  if (records.some((record) => record.id === newId)) throw new ToolError(`이미 존재하는 DB 레코드 id입니다: ${newId}`, { code: "database-record-exists" });
  const copy = structuredClone(source);
  copy.id = newId;
  copy.name = requestedName?.trim() || `${source.name} 사본`;
  records.push(copy);
  return copy;
}

function deleteRecord<T extends { id: string; name: string }>(records: T[], id: string): T {
  const index = records.findIndex((record) => record.id === id);
  const record = records[index];
  if (!record) throw new ToolError(`삭제할 DB 레코드를 찾을 수 없습니다: ${id}`, { code: "database-record-not-found" });
  records.splice(index, 1);
  return record;
}

function duplicateFromCollection(draft: Project, collection: DatabaseRecordCollection, id: string, newId: string, name?: string): { id: string; name: string } {
  switch (collection) {
    case "actors": return duplicateRecord(draft.database.actors, id, newId, name);
    case "classes": return duplicateRecord(draft.database.classes, id, newId, name);
    case "skills": return duplicateRecord(draft.database.skills, id, newId, name);
    case "items": return duplicateRecord(draft.database.items, id, newId, name);
    case "equipment": return duplicateRecord(draft.database.equipment, id, newId, name);
    case "enemies": return duplicateRecord(draft.database.enemies, id, newId, name);
    case "troops": return duplicateRecord(draft.database.troops, id, newId, name);
    case "states": return duplicateRecord(draft.database.states, id, newId, name);
    case "battleAnimations": return duplicateRecord(draft.database.battleAnimations, id, newId, name);
    case "monsterSpecies": return duplicateRecord(draft.database.monsterSpecies ??= [], id, newId, name);
    case "crops": return duplicateRecord(draft.database.crops ??= [], id, newId, name);
    case "lifeSkills": return duplicateRecord(draft.database.lifeSkills ??= [], id, newId, name);
    case "farmAnimalSpecies": return duplicateRecord(draft.database.farmAnimalSpecies ??= [], id, newId, name);
    case "fishSpecies": return duplicateRecord(draft.database.fishSpecies ??= [], id, newId, name);
    case "farmBuildingTypes": return duplicateRecord(draft.database.farmBuildingTypes ??= [], id, newId, name);
    case "homeDecorationTypes": return duplicateRecord(draft.database.homeDecorationTypes ??= [], id, newId, name);
  }
}

function deleteFromCollection(draft: Project, collection: DatabaseRecordCollection, id: string): { id: string; name: string } {
  if (collection === "actors" || collection === "classes" || collection === "skills" || collection === "items"
    || collection === "equipment" || collection === "enemies" || collection === "troops" || collection === "states" || collection === "battleAnimations") {
    const reference = projectDatabaseReferenceMessage(draft, collection, id);
    if (reference) throw new ToolError(reference, { code: "database-record-in-use" });
  }
  switch (collection) {
    case "actors": return deleteRecord(draft.database.actors, id);
    case "classes": return deleteRecord(draft.database.classes, id);
    case "skills": return deleteRecord(draft.database.skills, id);
    case "items": return deleteRecord(draft.database.items, id);
    case "equipment": return deleteRecord(draft.database.equipment, id);
    case "enemies": return deleteRecord(draft.database.enemies, id);
    case "troops": return deleteRecord(draft.database.troops, id);
    case "states": return deleteRecord(draft.database.states, id);
    case "battleAnimations": return deleteRecord(draft.database.battleAnimations, id);
    case "monsterSpecies": return deleteRecord(draft.database.monsterSpecies ??= [], id);
    case "crops": return deleteRecord(draft.database.crops ??= [], id);
    case "lifeSkills": return deleteRecord(draft.database.lifeSkills ??= [], id);
    case "farmAnimalSpecies": return deleteRecord(draft.database.farmAnimalSpecies ??= [], id);
    case "fishSpecies": return deleteRecord(draft.database.fishSpecies ??= [], id);
    case "farmBuildingTypes": return deleteRecord(draft.database.farmBuildingTypes ??= [], id);
    case "homeDecorationTypes": return deleteRecord(draft.database.homeDecorationTypes ??= [], id);
  }
}

const duplicateDatabaseRecordTool: ToolDefinition = {
  name: "duplicate_database_record",
  description: "에디터 DB 레코드를 모든 필드와 함께 복제한다. 참조를 보존하기 위해 새 id를 명시한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      collection: { type: "string", enum: DATABASE_RECORD_COLLECTIONS },
      id: { type: "string" },
      newId: { type: "string" },
      name: { type: "string" },
    },
    required: ["collection", "id", "newId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const collection = parseDatabaseRecordCollection(args.collection);
    const copy = duplicateFromCollection(draft, collection, args.id as string, args.newId as string, typeof args.name === "string" ? args.name : undefined);
    return { summary: `${collection} '${copy.name}' 복제 — id ${copy.id}`, data: { collection, record: copy } };
  },
};

const deleteDatabaseRecordTool: ToolDefinition = {
  name: "delete_database_record",
  description: "에디터 DB 레코드를 삭제한다(파괴적). 참조가 남아 프로젝트 무결성이 깨지면 커밋 게이트가 거부한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { collection: { type: "string", enum: DATABASE_RECORD_COLLECTIONS }, id: { type: "string" } },
    required: ["collection", "id"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const collection = parseDatabaseRecordCollection(args.collection);
    const removed = deleteFromCollection(draft, collection, args.id as string);
    return { summary: `${collection} '${removed.name}'(${removed.id}) 삭제`, data: { collection, id: removed.id } };
  },
};

const utilityRecordSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    kind: { type: "string", enum: ["physical", "magical", "attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event"] },
    rateLabels: { type: "array", items: { type: "string", enum: ["A", "B", "C", "D", "E"] } },
    damageMultipliers: { type: "object", properties: { A: { type: "number" }, B: { type: "number" }, C: { type: "number" }, D: { type: "number" }, E: { type: "number" } }, additionalProperties: false },
    damage: { type: "integer" },
    encounterRatePercent: { type: "integer" },
    battleBackgroundResourceId: { type: "string" },
    footstepSoundResourceId: { type: "string" },
    characterDisplay: { type: "string", enum: ["normal", "transparent"] },
    vehiclePassage: { type: "object", properties: { boat: { type: "boolean" }, ship: { type: "boolean" }, airshipLand: { type: "boolean" } }, additionalProperties: false },
    skillSubsetName: { type: "string" },
    skillId: { type: "string" },
  },
  required: ["id", "name"],
  additionalProperties: false,
};

const upsertDatabaseUtility: ToolDefinition = {
  name: "upsert_database_utility",
  description: "데이터베이스의 속성(elements), 지형 효과(terrains), 전투 명령(battleCommands) 레코드를 id 기준으로 등록·교체한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      collection: { type: "string", enum: DATABASE_UTILITY_COLLECTIONS },
      record: utilityRecordSchema,
    },
    required: ["collection", "record"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const collection = args.collection;
    const record = structuredClone(args.record) as Record<string, unknown>;
    const base = requireRecordId(record, "record");
    if (collection === "elements") {
      if (record.kind !== "physical" && record.kind !== "magical") throw new ToolError("elements.record.kind는 physical 또는 magical이어야 합니다.", { code: "invalid-args" });
      const labels = Array.isArray(record.rateLabels) ? record.rateLabels : ["A", "B", "C", "D", "E"];
      const multipliers = record.damageMultipliers;
      if (typeof multipliers !== "object" || multipliers === null || Array.isArray(multipliers)) throw new ToolError("elements.record.damageMultipliers가 필요합니다.", { code: "invalid-args" });
      const next = { id: base.id, name: base.name ?? base.id, kind: record.kind, rateLabels: labels, damageMultipliers: multipliers } as NonNullable<Project["database"]["elements"]>[number];
      draft.database.elements ??= [];
      const outcome = upsertById(draft.database.elements, next);
      return { summary: `속성 '${next.name}' ${outcome === "added" ? "추가" : "수정"}`, data: next };
    }
    if (collection === "terrains") {
      const passage = record.vehiclePassage;
      if (typeof passage !== "object" || passage === null || Array.isArray(passage)) throw new ToolError("terrains.record.vehiclePassage가 필요합니다.", { code: "invalid-args" });
      const next = {
        id: base.id,
        name: base.name ?? base.id,
        damage: typeof record.damage === "number" ? Math.trunc(record.damage) : 0,
        encounterRatePercent: typeof record.encounterRatePercent === "number" ? Math.trunc(record.encounterRatePercent) : 100,
        ...(typeof record.battleBackgroundResourceId === "string" ? { battleBackgroundResourceId: record.battleBackgroundResourceId } : {}),
        ...(typeof record.footstepSoundResourceId === "string" ? { footstepSoundResourceId: record.footstepSoundResourceId } : {}),
        characterDisplay: record.characterDisplay === "transparent" ? "transparent" as const : "normal" as const,
        vehiclePassage: {
          boat: (passage as Record<string, unknown>).boat === true,
          ship: (passage as Record<string, unknown>).ship === true,
          airshipLand: (passage as Record<string, unknown>).airshipLand === true,
        },
      };
      draft.database.terrains ??= [];
      const outcome = upsertById(draft.database.terrains, next);
      return { summary: `지형 효과 '${next.name}' ${outcome === "added" ? "추가" : "수정"}`, data: next };
    }
    if (collection === "battleCommands") {
      const allowed = new Set(["attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event"]);
      if (typeof record.kind !== "string" || !allowed.has(record.kind)) throw new ToolError("battleCommands.record.kind가 올바르지 않습니다.", { code: "invalid-args" });
      const next = {
        id: base.id,
        name: base.name ?? base.id,
        kind: record.kind,
        ...(typeof record.skillSubsetName === "string" ? { skillSubsetName: record.skillSubsetName } : {}),
        ...(typeof record.skillId === "string" ? { skillId: record.skillId } : {}),
      } as NonNullable<Project["database"]["battleCommands"]>[number];
      draft.database.battleCommands ??= [];
      const outcome = upsertById(draft.database.battleCommands, next);
      return { summary: `전투 명령 '${next.name}' ${outcome === "added" ? "추가" : "수정"}`, data: next };
    }
    throw new ToolError(`지원하지 않는 utility collection입니다: ${String(collection)}`, { code: "invalid-args" });
  },
};

function requireRecordId(record: unknown, label: string): { id: string; name?: string } {
  if (typeof record !== "object" || record === null) throw new ToolError(`${label}는 객체여야 합니다.`);
  const value = record as { id?: unknown; name?: unknown };
  if (typeof value.id !== "string" || value.id.length === 0) throw new ToolError(`${label}.id(문자열)가 필요합니다.`);
  if (value.name !== undefined && (typeof value.name !== "string" || value.name.length === 0)) {
    throw new ToolError(`${label}.name은 비어 있지 않은 문자열이어야 합니다.`);
  }
  return value as { id: string; name?: string };
}

function knownIds(records: readonly { readonly id: string }[], limit = 8): string {
  return records.slice(0, limit).map((record) => record.id).join(", ") || "(없음)";
}

type RecordSchema = JsonSchema & { readonly properties: Record<string, JsonSchema> };

const stringSchema = (description?: string): JsonSchema => ({ type: "string", description });
const numberSchema = (description?: string): JsonSchema => ({ type: "number", description });
const integerSchema = (description?: string): JsonSchema => ({ type: "integer", description });
const booleanSchema = (description?: string): JsonSchema => ({ type: "boolean", description });
const stringArraySchema = (description?: string): JsonSchema => ({ type: "array", description, items: { type: "string" } });
const objectSchema = (properties: Record<string, JsonSchema>, description?: string): JsonSchema => ({
  type: "object",
  description,
  properties,
  additionalProperties: false,
});
const arrayOf = (items: JsonSchema, description?: string): JsonSchema => ({ type: "array", description, items });

const recoverySchema = objectSchema({ flat: integerSchema(), percentMax: integerSchema() });
const statBonusesSchema = objectSchema({ attack: integerSchema(), defense: integerSchema(), mind: integerSchema(), agility: integerSchema() });
const stateEffectSchema = objectSchema({
  stateId: stringSchema(),
  chance: integerSchema(),
  operation: { type: "string", enum: ["add", "remove"] },
});
const rateMapSchema: JsonSchema = { type: "object", description: "{ id: A|B|C|D|E }", additionalProperties: true };
const parameterCurvesSchema = objectSchema({
  maxHp: { type: "array", items: integerSchema() },
  maxMp: { type: "array", items: integerSchema() },
  attack: { type: "array", items: integerSchema() },
  defense: { type: "array", items: integerSchema() },
  mind: { type: "array", items: integerSchema() },
  agility: { type: "array", items: integerSchema() },
}, "레벨 1~99 능력치 곡선. 99칸 배열 대신 [Lv1값] 또는 [Lv1값, Lv99값] 으로 줘도 곡선을 채운다. 배우의 곡선이 전투 능력치의 정본이다(직업 곡선은 직업 변경 뒤에만).");
const expCurveSchema = objectSchema({ base: integerSchema(), extra: integerSchema(), acceleration: integerSchema() });
const actorInitialEquipmentSchema: JsonSchema = {
  type: "object", description: "{ equipment slot id: equipment id }; includes project-authored slots",
  additionalProperties: true,
};
const actorOptionsSchema = objectSchema({ dualWield: booleanSchema(), autoBattle: booleanSchema(), fixedEquipment: booleanSchema(), mightyGuard: booleanSchema() });
const learnedSkillSchema = objectSchema({ level: integerSchema(), skillId: stringSchema() });
const promotionRequiresSchema = objectSchema({
  level: integerSchema(),
  switchId: stringSchema(),
  itemId: stringSchema(),
  variableId: stringSchema(),
  atLeast: integerSchema(),
});
const classPromotionSchema = objectSchema({
  toClassId: stringSchema(),
  requires: promotionRequiresSchema,
});
const monsterEvolutionRequiresSchema = objectSchema({
  level: integerSchema(),
  itemId: stringSchema(),
  friendshipAtLeast: integerSchema(),
});
const monsterEvolutionSchema = objectSchema({
  toSpeciesId: stringSchema(),
  requires: monsterEvolutionRequiresSchema,
});
const itemEquipmentProfileSchema = objectSchema({
  statBonuses: statBonusesSchema,
  equippableActorIds: stringArraySchema(),
  equippableClassIds: stringArraySchema(),
  twoHanded: booleanSchema(),
  mpCost: integerSchema(),
  accuracy: integerSchema(),
  criticalRate: integerSchema(),
  attackElementIds: stringArraySchema(),
  stateInflictIds: stringArraySchema(),
  stateInflictionChance: integerSchema(),
  effectFlags: objectSchema({
    preemptive: booleanSchema(),
    doubleAttack: booleanSchema(),
    attackAll: booleanSchema(),
    ignoreDodge: booleanSchema(),
    preventCriticalHits: booleanSchema(),
    increasePhysicalDodge: booleanSchema(),
    halfMpCost: booleanSchema(),
    negateTerrainDamage: booleanSchema(),
    fixedEquipment: booleanSchema(),
  }),
  elementalDefenseIds: stringArraySchema(),
  stateDefenseIds: stringArraySchema(),
  stateDefenseMode: { type: "string", enum: ["resist", "inflict"] },
  stateResistanceChance: integerSchema(),
});
const captureProfileSchema = objectSchema({
  multiplier: numberSchema("포획 확률 배율. 생략 시 1"),
  ballClass: { type: "string", enum: ["poke", "great", "ultra", "master"] },
});
const enemyStatsSchema = objectSchema({ maxHp: integerSchema(), maxMp: integerSchema(), attack: integerSchema(), defense: integerSchema(), mind: integerSchema(), agility: integerSchema() });
const enemyRewardsSchema = objectSchema({ exp: integerSchema(), gold: integerSchema(), dropItemId: stringSchema(), dropRatePercent: integerSchema(), drops: conditionalDropsSchema });
const enemyActionSwitchSchema = objectSchema({ enabled: booleanSchema(), switchId: stringSchema() });
const enemyActionSchema = objectSchema({
  skillId: stringSchema(),
  priority: integerSchema(),
  condition: combatConditionSchema,
  switchOnAfterAction: enemyActionSwitchSchema,
  switchOffAfterAction: enemyActionSwitchSchema,
});
const troopMemberSchema = objectSchema({ enemyId: stringSchema(), x: integerSchema(), y: integerSchema(), hidden: booleanSchema() });
const stateRuntimeEffectsSchema = objectSchema({
  restrictsAction: booleanSchema(),
  blocksSkillUse: booleanSchema(),
  hpDamagePercentPerTurn: numberSchema(),
  hpHealPercentPerTurn: numberSchema(),
  attackMultiplier: numberSchema(),
  defenseMultiplier: numberSchema(),
  agilityMultiplier: numberSchema(),
  removeOnBattleEnd: booleanSchema(),
});

const itemRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  imageResourceId: stringSchema(),
  iconResourceId: stringSchema(),
  scope: { type: "string", enum: ["none", "ally", "allAllies", "enemy"] },
  price: integerSchema(),
  skillId: stringSchema(),
  description: stringSchema(),
  type: { type: "string", enum: ["normalGoods", "weapon", "shield", "body", "head", "accessory", "medicine", "book", "seed", "special", "switch"] },
  occasion: { type: "string", enum: ["always", "battle", "field", "never"] },
  consumable: booleanSchema(),
  animationId: stringSchema(),
  stateEffects: arrayOf(stateEffectSchema),
  consumptionLimit: integerSchema("1..5 or omitted for noLimit"),
  usableActorIds: stringArraySchema(),
  usableClassIds: stringArraySchema(),
  healStateIds: stringArraySchema(),
  hpRecovery: recoverySchema,
  mpRecovery: recoverySchema,
  onlyUsableInMenu: booleanSchema(),
  onlyEffectiveOnDeadActors: booleanSchema(),
  learnedSkillId: stringSchema(),
  activateSkillId: stringSchema(),
  usageMessage: { type: "string", enum: ["normal", "skill"] },
  switchId: stringSchema(),
  occasionField: booleanSchema(),
  occasionBattle: booleanSchema(),
  seedParameterBonuses: statBonusesSchema,
  equipmentProfile: itemEquipmentProfileSchema,
  farmTool: { type: "string", enum: ["hoe", "wateringCan"] },
  captureProfile: captureProfileSchema,
}) as RecordSchema;

const enemyRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  speciesId: stringSchema(),
  monsterResourceId: stringSchema(),
  battleScalePercent: integerSchema("전투 표시 크기(%). 10~300으로 제한, 기본 100."),
  graphicHue: integerSchema(),
  transparent: booleanSchema(),
  flying: booleanSchema(),
  criticalHit: objectSchema({ enabled: booleanSchema(), oneIn: integerSchema() }),
  attackOptions: objectSchema({ normalAttacksMiss: booleanSchema() }),
  skillIds: stringArraySchema(),
  level: integerSchema(),
  stats: enemyStatsSchema,
  rewards: enemyRewardsSchema,
  actions: arrayOf(enemyActionSchema),
  stateRates: rateMapSchema,
  elementRates: rateMapSchema,
}) as RecordSchema;

const troopRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  enemyIds: stringArraySchema(),
  members: arrayOf(troopMemberSchema),
  autoAlign: booleanSchema(),
  uncapturable: booleanSchema(),
  trainerBattle: booleanSchema(),
  previewBackgroundResourceId: stringSchema(),
  battleFlow: { type: "string", enum: ["gauge", "strict"] },
  activeSlots: integerSchema(),
  // battleEventPages 는 여기서 받지 않는다 — 자유 객체(additionalProperties:true)로 통과시키면
  // 조건 kind 오타·빈 commands·무한 반복이 무검증으로 저장된다. upsert_troop_battle_page /
  // author_boss_phases 가 페이지 단위로 검증해서 쓴다(아래 run 의 리다이렉트 참고).
}) as RecordSchema;

const monsterSpeciesGraphicSchema = objectSchema({
  monsterResourceId: stringSchema(),
  backResourceId: stringSchema("후면 전투용 몬스터 리소스. 생략하면 정면 그림을 사용합니다."),
  graphicHue: integerSchema(),
  transparent: booleanSchema(),
  flying: booleanSchema(),
});

const monsterSpeciesRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  graphic: monsterSpeciesGraphicSchema,
  types: stringArraySchema("최대 2개. system.typeChart.types 값과 매칭"),
  baseStats: enemyStatsSchema,
  expCurve: expCurveSchema,
  captureRate: numberSchema("0~1"),
  skillsByLevel: arrayOf(learnedSkillSchema),
  evolutions: arrayOf(monsterEvolutionSchema),
}) as RecordSchema;

const cropStageSchema = objectSchema({ days: integerSchema("단계 소요일") });
const cropGraphicStageSchema = objectSchema({
  resourceId: stringSchema(),
  frame: stringSchema("스프라이트 프레임 이름/번호"),
  label: stringSchema("리소스 없을 때 단계 배지 라벨"),
});
const cropRegrowSchema = objectSchema({ days: integerSchema("재수확 대기일") });
const cropRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  seedItemId: stringSchema(),
  harvestItemId: stringSchema(),
  harvestCount: integerSchema("수확 수량. 기본 1"),
  stages: arrayOf(cropStageSchema),
  seasons: stringArraySchema("spring/summer/fall/winter"),
  regrow: cropRegrowSchema,
  graphicStages: arrayOf(cropGraphicStageSchema),
}) as RecordSchema;

const actorRecordSchema = objectSchema({
  id: stringSchema(),
  appearanceId: stringSchema("공유 캐릭터 외형 레코드 id"),
  name: stringSchema(),
  nickname: stringSchema(),
  classId: stringSchema(),
  initialLevel: integerSchema(),
  maxLevel: integerSchema(),
  faceResourceId: stringSchema(),
  characterResourceId: stringSchema(),
  characterIndex: { type: "integer", minimum: 0, maximum: 7, description: "캐릭터셋 안의 칸(0~7). 0은 기본값" },
  characterTransparent: booleanSchema(),
  battleCharacterResourceId: stringSchema(),
  critical: objectSchema({ enabled: booleanSchema(), chanceDenominator: integerSchema() }),
  parameterCurves: parameterCurvesSchema,
  expCurve: expCurveSchema,
  initialEquipment: actorInitialEquipmentSchema,
  unarmedAnimationId: stringSchema(),
  options: actorOptionsSchema,
  learnedSkills: arrayOf(learnedSkillSchema),
  skillIds: stringArraySchema("legacy alias for learnedSkills"),
  stateRates: rateMapSchema,
  elementRates: rateMapSchema,
}) as RecordSchema;

const skillRecordSchema = objectSchema({
  ...authoredSkillProperties,
  id: stringSchema(),
  name: stringSchema(),
  scope: { type: "string", enum: ["self", "ally", "allAllies", "enemy", "allEnemies"] },
  power: integerSchema(),
  animationId: stringSchema(),
  description: stringSchema(),
  type: { type: "string", enum: ["normal", "teleport", "escape", "switch"] },
  mpCost: recoverySchema,
  successRate: integerSchema(),
  variance: integerSchema(),
  hitRate: integerSchema(),
  effect: objectSchema({ kind: stringSchema(), statistic: stringSchema(), affects: stringSchema(), switchId: stringSchema() }),
  elementId: stringSchema(),
  stateEffects: arrayOf(stateEffectSchema),
  maxPp: integerSchema("Gen1 기술별 최대 PP. 1~99"),
  gen1CriticalRate: { type: "string", enum: ["normal", "high"] },
  movePriority: numberSchema("기술 우선도 -7~7 (strict 턴제에서 속도보다 먼저 비교, 퀵어택=+1)"),
}) as RecordSchema;

const equipmentRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  imageResourceId: stringSchema(),
  iconResourceId: stringSchema(),
  slot: stringSchema("database.equipmentSlots id or built-in weapon/shield/armor/helmet/accessory"),
  price: integerSchema(),
  skillId: stringSchema(),
  description: stringSchema(),
  statBonuses: statBonusesSchema,
  equippableActorIds: stringArraySchema(),
  equippableClassIds: stringArraySchema(),
  cursed: booleanSchema(),
  twoHanded: booleanSchema(),
  accuracy: integerSchema("일반 공격 명중률 보정 0~100%"),
  criticalRate: integerSchema("치명타율 가산 0~100%p"),
  usableAsItemSkillId: stringSchema(),
  stateInflictIds: stringArraySchema(),
  attackElementIds: stringArraySchema(),
  stateInflictionChance: integerSchema(),
  effectFlags: objectSchema({
    preemptive: booleanSchema(),
    doubleAttack: booleanSchema(),
    attackAll: booleanSchema(),
    ignoreDodge: booleanSchema(),
    preventCriticalHits: booleanSchema(),
    increasePhysicalDodge: booleanSchema(),
    halfMpCost: booleanSchema(),
    negateTerrainDamage: booleanSchema(),
    fixedEquipment: booleanSchema(),
  }),
  elementalDefenseIds: stringArraySchema(),
  stateDefenseIds: stringArraySchema(),
  stateDefenseMode: { type: "string", enum: ["resist", "inflict"] },
  stateResistanceChance: integerSchema(),
}) as RecordSchema;

const classRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  options: actorOptionsSchema,
  animationId: stringSchema(),
  skillIds: stringArraySchema(),
  battleCommands: arrayOf(objectSchema({ id: stringSchema(), name: stringSchema(), kind: stringSchema(), skillSubsetName: stringSchema(), skillId: stringSchema() })),
  learnedSkills: arrayOf(learnedSkillSchema),
  equipmentPermissions: objectSchema({ actorIds: stringArraySchema(), classIds: stringArraySchema(), equipmentIds: stringArraySchema() }),
  parameterCurves: parameterCurvesSchema,
  expCurve: expCurveSchema,
  stateRates: rateMapSchema,
  elementRates: rateMapSchema,
  promotions: arrayOf(classPromotionSchema),
}) as RecordSchema;

const stateRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  gen1MajorStatus: { type: "string", enum: ["poison", "burn", "sleep", "freeze", "paralysis"] },
  removalCondition: stringSchema(),
  restriction: stringSchema(),
  priority: integerSchema(),
  accuracyModifier: integerSchema(),
  animationIndex: integerSchema(),
  recoverNaturallyFromTurn: integerSchema(),
  recoverNaturallyChance: integerSchema(),
  recoverWhenHitChance: integerSchema(),
  hpReleaseTurn: integerSchema(),
  hpReleaseStep: integerSchema(),
  mpReleaseTurn: integerSchema(),
  mpReleaseStep: integerSchema(),
  specialFlags: stringArraySchema(),
  lockedParameters: stringArraySchema(),
  runtimeEffects: stateRuntimeEffectsSchema,
}) as RecordSchema;

function parametersForRecord(key: string, schema: RecordSchema, example: Record<string, unknown>, extraProperties: Record<string, JsonSchema> = {}): JsonSchema {
  return {
    type: "object",
    properties: { [key]: { ...schema, description: `${key} 부분 레코드. 기존 id 수정은 id와 바꿀 필드만 보내면 됩니다.` }, ...extraProperties },
    required: [key],
    additionalProperties: false,
    description: `허용 예시: ${JSON.stringify({ [key]: example })}`,
  };
}

function rejectUnknownFields(value: unknown, schema: JsonSchema, label: string, example: unknown): void {
  if (schema.type !== "object" || schema.additionalProperties !== false || typeof value !== "object" || value === null || Array.isArray(value)) return;
  const allowed = Object.keys(schema.properties ?? {});
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childSchema = schema.properties?.[key];
    if (!childSchema) {
      throw new ToolError(
        `${label}.${key}는 허용되지 않는 필드입니다. 허용 필드: ${allowed.join(", ")}. 최소 예시: ${JSON.stringify(example)}`,
        { code: "unknown-db-field" }
      );
    }
    if (childSchema.type === "object") rejectUnknownFields(child, childSchema, `${label}.${key}`, example);
    if (childSchema.type === "array" && childSchema.items && Array.isArray(child)) {
      child.forEach((entry, index) => rejectUnknownFields(entry, childSchema.items as JsonSchema, `${label}.${key}[${index}]`, example));
    }
  }
}

function mergeRecord<T extends { id: string; name: string }>(
  list: readonly T[],
  patch: unknown,
  label: string,
  schema: RecordSchema,
  example: Record<string, unknown>,
  requiredForNew: readonly string[] = ["name"],
): T | (Partial<T> & Pick<T, "id" | "name">) {
  const base = requireRecordId(patch, label);
  rejectUnknownFields(patch, schema, label, { [label]: example });
  const existing = list.find((entry) => entry.id === base.id);
  if (!existing) {
    for (const key of requiredForNew) {
      if ((patch as Record<string, unknown>)[key] === undefined) {
        throw new ToolError(`${label}.${key}가 신규 레코드에 필요합니다. 최소 예시: ${JSON.stringify({ [label]: example })}`, { code: "missing-db-field" });
      }
    }
  }
  return mergeRecordPatch(existing, patch as Record<string, unknown>) as Partial<T> & Pick<T, "id" | "name">;
}

/** items 의 레거시 장비 종류 → 실제 착용 장비 슬롯. */
const LEGACY_ITEM_EQUIPMENT_SLOT: Readonly<Record<string, string>> = {
  weapon: "weapon", shield: "shield", body: "armor", head: "helmet", accessory: "accessory",
};

function upsertLegacyEquipmentItemAsEquipment(draft: Project, itemPatch: Record<string, unknown>): ToolExecResult {
  const profile = itemPatch.equipmentProfile && typeof itemPatch.equipmentProfile === "object" && !Array.isArray(itemPatch.equipmentProfile)
    ? itemPatch.equipmentProfile as Record<string, unknown>
    : {};
  const equipment: Record<string, unknown> = {};
  for (const key of Object.keys(equipmentRecordSchema.properties ?? {})) {
    if (profile[key] !== undefined) equipment[key] = profile[key];
    if (itemPatch[key] !== undefined) equipment[key] = itemPatch[key];
  }
  equipment.slot = LEGACY_ITEM_EQUIPMENT_SLOT[String(itemPatch.type)];
  const result = upsertEquipment.run(draft, { equipment }) as ToolExecResult;
  return {
    ...result,
    warnings: [
      ...(result.warnings ?? []),
      `upsert_item 의 type:"${String(itemPatch.type)}" 는 착용 장비라 upsert_equipment(slot:"${String(equipment.slot)}") 로 옮겨 database.equipment 에 저장했습니다 — 이 id 는 상점 재고(itemIds/stock)·changeItem·initialEquipment 에 그대로 쓰세요.`,
    ],
  };
}

/**
 * 없는 전투 애니메이션 id 를 지우고 가까운 후보와 함께 경고한다. 애니메이션은 연출이라 거부할 이유가 없다 —
 * 2026-09-24 JRPG 도그푸딩: upsert_skill animationId:"anim_slash" 가 후보 없는 「animationId does not exist.」 로
 * 커밋 거부되고, 그 스킬을 배우는 upsert_class 까지 연쇄로 거부됐다.
 */
function dropUnknownAnimationId(project: Project, record: { animationId?: string }, label: string, warnings: string[]): void {
  const id = record.animationId;
  if (!id || project.database.battleAnimations.some((animation) => animation.id === id)) return;
  delete record.animationId;
  const word = id.replace(/^anim_(gen_)?/u, "").split(/[_-]/u)[0] ?? "";
  const close = word ? project.database.battleAnimations.filter((animation) => animation.id.includes(word) || animation.name?.includes(word)).map((animation) => animation.id) : [];
  const hints = (close.length ? close : project.database.battleAnimations.map((animation) => animation.id)).slice(0, 8);
  warnings.push(`${label}.animationId "${id}" 는 전투 애니메이션에 없어 비웠습니다(기본 연출). 쓸 수 있는 id: ${hints.join(", ")}`);
}

const upsertItem: ToolDefinition = {
  name: "upsert_item",
  description: "아이템 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("item", itemRecordSchema, { id: "item_potion", name: "회복약", price: 120, hpRecovery: { flat: 80, percentMax: 0 } }),
  run(draft, args): ToolExecResult {
    const itemPatch: Record<string, unknown> | undefined = args.item && typeof args.item === "object" && !Array.isArray(args.item)
      ? args.item as Record<string, unknown>
      : undefined;
    const existing = typeof itemPatch?.id === "string"
      ? draft.database.items.find((item) => item.id === itemPatch.id)
      : undefined;
    if (!existing && itemPatch && String(itemPatch.type) in LEGACY_ITEM_EQUIPMENT_SLOT) {
      // 거부 대신 upsert_equipment 로 옮겨 저장한다 — 2026-09-24 도그푸딩: 무기·방어구 7개를 upsert_item 으로
      // 넣으려다 7번 연속 같은 거부를 받고 장비 상점이 「돈만 받고 아무것도 안 주는」 선택지로 끝났다.
      return upsertLegacyEquipmentItemAsEquipment(draft, itemPatch);
    }
    const capturePatch = itemPatch?.captureProfile;
    const nestedPatch = existing?.captureProfile && capturePatch && typeof capturePatch === "object" && !Array.isArray(capturePatch)
      ? { ...itemPatch, captureProfile: { ...existing.captureProfile, ...capturePatch as Record<string, unknown> } }
      : args.item;
    const merged = mergeRecord(draft.database.items, nestedPatch, "item", itemRecordSchema, { id: "item_potion", name: "회복약" });
    const record = normalizeItemRecord(merged as Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">);
    const warnings: string[] = [];
    dropUnknownAnimationId(draft, record, "item", warnings);
    const outcome = upsertById(draft.database.items, record);
    return { summary: `아이템 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record, ...(warnings.length ? { warnings } : {}) };
  },
};

/**
 * 존재하지 않는 `elementRates` 키를 버리고 경고한다.
 *
 * 전체 거부는 사용자 의도를 통째로 날린다 — 2026-08-23 실측: `elementRates:{fire:"C",water:"A",grass:"D"}`
 * 에서 `grass` 만 DB 속성이 아니었는데 커밋이 거부되고, 모델의 재시도는 elementRates 를 아예 빼서
 * "불에 강하고 물에 약한" 의도가 조용히 사라졌다(전 속성 기본값 C). `fill_region` 이 보호 셀만 건너뛰고
 * 경고를 돌려주는 것과 같은 방침으로, 유효한 키는 살린다.
 */
function dropUnknownElementRates(
  project: Project,
  record: { elementRates?: Record<string, unknown> },
  label: string,
  warnings: string[],
): void {
  const rates = record.elementRates;
  if (!rates) return;
  const known = new Set((project.database.elements ?? []).map((element) => element.id));
  const unknown = Object.keys(rates).filter((id) => !known.has(id));
  if (unknown.length === 0) return;
  for (const id of unknown) delete rates[id];
  const sample = [...known].slice(0, 12).join(", ");
  warnings.push(
    `${label}.elementRates에서 DB 속성이 아닌 키를 제외했습니다: ${unknown.join(", ")}. ` +
      `사용 가능한 속성 id(${known.size}개): ${sample}${known.size > 12 ? " …" : ""} — 몬스터 타입 상성은 set_type_chart를 쓰세요.`,
  );
}

/** 잘못된 speciesId 하나 때문에 신규 적 전체를 버리지 않는다. 기존 적 수정이면 유효한 종 참조를 보존한다. */
function dropUnknownSpeciesId(
  project: Project,
  record: { id: string; speciesId?: string },
  label: string,
  warnings: string[],
): void {
  const requested = record.speciesId;
  if (!requested) return;
  const species = project.database.monsterSpecies ?? [];
  if (species.some((entry) => entry.id === requested)) return;

  const folded = requested.trim().toLocaleLowerCase();
  const exactName = species.find((entry) => entry.name.trim().toLocaleLowerCase() === folded);
  if (exactName) {
    record.speciesId = exactName.id;
    warnings.push(`${label}.speciesId 자동 해석: "${requested}" → "${exactName.id}" (${exactName.name})`);
    return;
  }

  const previous = project.database.enemies.find((enemy) => enemy.id === record.id)?.speciesId;
  if (previous && species.some((entry) => entry.id === previous)) record.speciesId = previous;
  else delete record.speciesId;
  const sample = species.slice(0, 12).map((entry) => entry.id).join(", ");
  warnings.push(
    `${label}.speciesId가 monsterSpecies id가 아니어서 ${previous ? `기존 값 "${previous}"을 유지했습니다` : "필드를 제외했습니다"}: ${requested}. ` +
      `사용 가능한 종 id(${species.length}개): ${sample}${species.length > 12 ? " …" : ""}. ` +
      `불/얼음 같은 속성 타입은 speciesId가 아니며 set_type_chart 또는 elementRates를 사용하세요.`,
  );
}

/**
 * 이 호출이 **새로 가리키는** 참조(스킬·드롭 아이템·스위치)를 먼저 검사한다.
 *
 * 실측(2026-09-03, DB AI 바 턴): 모델이 조회 없이 `skill_0001`·`item_0001` 같은 자리표시 id 를 넣었고,
 * 일반 무결성 게이트가 쓰기 전체를 `'upsert_enemy' 커밋 거부(무결성 오류)` 한 줄로 반려했다 —
 * 함께 보낸 스탯·보상 수정까지 버려지고 모델은 사유를 모른 채 재시도했다. upsert_troop(enemyIds)·
 * define_monster_species(skillId) 처럼 여기서 정확한 사유와 허용 예시를 돌려준다.
 *
 * 기존 레코드에 이미 있던(이 호출이 넘기지 않은) 깨진 참조는 보지 않는다 — 그것은 커밋 게이트가
 * 기준선으로 용인하는 선재 오류이고, 그것 때문에 스탯 한 줄 고치기가 막히면 안 된다.
 */
function rejectUnknownEnemyReferences(draft: Project, patch: unknown): void {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  const record = patch as Record<string, unknown>;
  const problems: string[] = [];

  const requestedSkillIds = new Set<string>();
  if (Array.isArray(record.skillIds)) {
    for (const skillId of record.skillIds) if (typeof skillId === "string" && skillId) requestedSkillIds.add(skillId);
  }
  const actions = Array.isArray(record.actions) ? record.actions : [];
  const requestedSwitchIds = new Set<string>();
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    const entry = action as Record<string, unknown>;
    if (typeof entry.skillId === "string" && entry.skillId) requestedSkillIds.add(entry.skillId);
    for (const key of ["switchOnAfterAction", "switchOffAfterAction"] as const) {
      const effect = entry[key];
      if (!effect || typeof effect !== "object") continue;
      const { enabled, switchId } = effect as { enabled?: unknown; switchId?: unknown };
      if (enabled === true && typeof switchId === "string" && switchId) requestedSwitchIds.add(switchId);
    }
  }
  const skillIds = new Set(draft.database.skills.map((skill) => skill.id));
  const missingSkills = [...requestedSkillIds].filter((skillId) => !skillIds.has(skillId));
  const hints: string[] = [];
  if (missingSkills.length > 0) {
    problems.push(`skillId: ${missingSkills.join(", ")}`);
    hints.push(`skills: ${knownIds(draft.database.skills, 5)}`);
  }
  const rewards = record.rewards;
  const dropItemId = rewards && typeof rewards === "object" ? (rewards as { dropItemId?: unknown }).dropItemId : undefined;
  if (typeof dropItemId === "string" && dropItemId && !draft.database.items.some((item) => item.id === dropItemId)) {
    problems.push(`rewards.dropItemId: ${dropItemId}`);
    hints.push(`items: ${knownIds(draft.database.items, 5)} (드롭이 없으면 rewards.dropItemId 를 빼세요)`);
  }
  const switchIds = new Set(draft.switches.map((entry) => entry.id));
  const missingSwitches = [...requestedSwitchIds].filter((switchId) => !switchIds.has(switchId));
  if (missingSwitches.length > 0) {
    problems.push(`action switchId: ${missingSwitches.join(", ")}`);
    hints.push(`switches: ${knownIds(draft.switches, 5)}`);
  }
  // 위반 목록을 앞에 — toolRunner 가 요약을 200자에서 자르므로 사유가 먼저, 예시는 뒤에 온다(issues 에는 전문이 실린다).
  if (problems.length > 0) {
    throw new ToolError(
      `존재하지 않는 참조 — ${problems.join(" · ")}. 허용 예시 — ${hints.join(" · ")}. ` +
        "전체 목록은 get_database_records(collection: \"skills\" / \"items\")로 확인하세요.",
      { code: "enemy-reference-not-found" },
    );
  }
}

const upsertEnemy: ToolDefinition = {
  name: "upsert_enemy",
  description:
    "적 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. " +
    "elementRates의 키는 database.elements의 속성 id다(get_database_records collection:\"elements\"). " +
    "몬스터 타입 상성(set_type_chart)의 types와는 다른 체계이며, speciesId는 monsterSpecies를 가리킨다. " +
    "보스는 role:\"boss\" 를 준다(id·이름에 boss/보스가 있어도 같다) — 시작 파티를 기준으로 체력·공격·마력·민첩의 하한을 맞추고(주신 값보다 낮추지 않음) 모의전 결과를 경고로 돌려준다. " +
    "시작 파티는 Lv1 에도 HP 수백·공 50 안팎이다(get_database_records actors 또는 simulate_battle 로 확인).",
  mode: "write",
  parameters: parametersForRecord("enemy", enemyRecordSchema, { id: "enemy_slime", name: "슬라임", stats: { maxHp: 40, attack: 12 }, rewards: { exp: 3, gold: 2 } }, {
    role: { type: "string", enum: ["boss", "normal"], description: "boss 면 시작 파티 기준 위협 하한을 맞춘다. 생략 시 id·이름의 boss/보스로 판정." },
  }),
  run(draft, args): ToolExecResult {
    validateEnemyCombatPatch(args.enemy);
    const merged = mergeRecord(draft.database.enemies, args.enemy, "enemy", enemyRecordSchema, { id: "enemy_slime", name: "슬라임" });
    rejectUnknownEnemyReferences(draft, args.enemy);
    const record = normalizeEnemyRecord(merged as Partial<EnemyRecord> & Pick<EnemyRecord, "id" | "name">);
    const warnings: string[] = [];
    dropUnknownElementRates(draft, record, "enemy", warnings);
    dropUnknownSpeciesId(draft, record, "enemy", warnings);
    ensureMonsterGraphic(draft, record, record, "enemy.monsterResourceId", warnings, args.appearanceTags as unknown[] | undefined);
    const outcome = upsertById(draft.database.enemies, record);
    const bossNote = isBossEnemy(record, args.role) ? scaleBossToStartParty(draft, record).note : undefined;
    if (bossNote) warnings.push(bossNote);
    // 이 적이 든 첫 트룹 하나만 본다 — 경고 한 줄이면 고칠 방향이 선다.
    const firstTroop = draft.database.troops.find(troop => troop.enemyIds.includes(record.id));
    if (firstTroop) warnings.push(...troopBalanceWarnings(draft, firstTroop.id));
    return {
      summary: `적 '${record.name}' ${outcome === "added" ? "추가" : "수정"}${bossNote ? " — 보스 위협 하한 적용(경고 참고)" : ""}`,
      data: record,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const upsertTroop: ToolDefinition = {
  name: "upsert_troop",
  description: "적 그룹(트룹) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("troop", troopRecordSchema, { id: "troop_slime", name: "슬라임 무리", enemyIds: ["enemy_slime"] }),
  run(draft, args): ToolExecResult {
    // 전투 이벤트 페이지는 이 툴의 계약이 아니다. 일반 unknown-field 오류로 떨어지면 모델은 필드를
    // 그냥 빼버리고 "보스 연출을 넣었다"고 보고한다 — 어디로 가야 하는지 명시적으로 알려준다.
    if (args.troop && typeof args.troop === "object" && !Array.isArray(args.troop)
      && (args.troop as Record<string, unknown>).battleEventPages !== undefined) {
      throw new ToolError(
        "troop.battleEventPages 는 upsert_troop 으로 쓸 수 없습니다(무검증 저장을 막았습니다). " +
          "보스 페이즈는 author_boss_phases, 개별 페이지는 upsert_troop_battle_page 를 쓰세요 — 조건·커맨드·무한반복을 검증합니다.",
        { code: "use-battle-page-tool" },
      );
    }
    const merged = mergeRecord(draft.database.troops, args.troop, "troop", troopRecordSchema, { id: "troop_slime", name: "슬라임 무리", enemyIds: ["enemy_slime"] }, ["name", "enemyIds"]);
    const patch = args.troop as Partial<TroopRecord>;
    // An explicit legacy roster replaces the roster. Do not let inherited members
    // silently override it; unrelated patches still preserve authored placements.
    if (patch.enemyIds !== undefined && patch.members === undefined) delete merged.members;
    const record = normalizeTroopRecord(merged as Partial<TroopRecord> & Pick<TroopRecord, "id" | "name">);
    const memberCount = record.members?.length ?? record.enemyIds.length;
    if (memberCount === 0) throw new ToolError("트룹에는 최소 1마리의 적(enemyIds/members)이 필요합니다.", { code: "troop-empty" });
    const enemyIds = new Set(draft.database.enemies.map((enemy) => enemy.id));
    const missing = [...new Set(record.enemyIds.filter((enemyId) => !enemyIds.has(enemyId)))];
    if (missing.length > 0) {
      throw new ToolError(`존재하지 않는 enemyId: ${missing.join(", ")} — 허용 예시: ${knownIds(draft.database.enemies)}`, { code: "enemy-not-found" });
    }
    const outcome = upsertById(draft.database.troops, record);
    const warnings = troopBalanceWarnings(draft, record.id);
    return {
      summary: `트룹 '${record.name}'(${memberCount}마리) ${outcome === "added" ? "추가" : "수정"}${warnings.length ? (warnings.some(w => w.includes("전멸")) ? " — 밸런스 경고: 파티가 레벨을 올려도 전멸함" : " — 밸런스 경고: 적이 시작 파티에게 거의 피해를 주지 못함") : ""}`,
      data: record,
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

const defineMonsterSpecies: ToolDefinition = {
  name: "define_monster_species",
  description: "몬스터 species 레코드를 등록/수정한다. EnemyRecord와 별개이며 enemy.speciesId가 포획 시 이 레코드를 가리킨다."
    + " 진화(evolutions.toSpeciesId)는 이미 있는 종만 가리킬 수 있다 — 진화 계통은 **최종 진화형부터** 정의하고 그다음 기본형을 evolutions 와 함께 정의한다.",
  mode: "write",
  parameters: parametersForRecord("species", monsterSpeciesRecordSchema, {
    id: "species_wild_slime",
    name: "야생 슬라임",
    baseStats: { maxHp: 18, maxMp: 4, attack: 10, defense: 7, mind: 6, agility: 16 },
    captureRate: 0.7,
  }),
  run(draft, args): ToolExecResult {
    draft.database.monsterSpecies ??= [];
    const merged = mergeRecord(draft.database.monsterSpecies, args.species, "species", monsterSpeciesRecordSchema, {
      id: "species_wild_slime",
      name: "야생 슬라임",
    });
    const existing = draft.database.monsterSpecies.find((species) => species.id === merged.id);
    const record = normalizeMonsterSpeciesRecord({
      ...merged,
      graphic: { ...existing?.graphic, ...merged.graphic },
    } as Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">);
    const skillIds = new Set(draft.database.skills.map((skill) => skill.id));
    const missingSkills = (record.skillsByLevel ?? []).filter((entry) => !skillIds.has(entry.skillId)).map((entry) => entry.skillId);
    if (missingSkills.length > 0) {
      throw new ToolError(`존재하지 않는 species skillId: ${[...new Set(missingSkills)].join(", ")} — 허용 예시: ${knownIds(draft.database.skills)}`, { code: "skill-not-found" });
    }
    const speciesIds = new Set(draft.database.monsterSpecies.map((species) => species.id));
    // 자기 자신 진화는 레벨업마다 무한 재적용되므로 tool 경로에서도 거부한다(UI 드롭다운엔 옵션이 없어 복구 불가).
    if ((record.evolutions ?? []).some((evolution) => evolution.toSpeciesId === record.id)) {
      throw new ToolError(`종족 ${record.id}: 자기 자신으로 진화할 수 없습니다`, { code: "species-self-evolution" });
    }
    const missingEvolutionSpecies = (record.evolutions ?? []).filter((evolution) => !speciesIds.has(evolution.toSpeciesId)).map((evolution) => evolution.toSpeciesId);
    if (missingEvolutionSpecies.length > 0) {
      const missingIds = [...new Set(missingEvolutionSpecies)].join(", ");
      throw new ToolError(`존재하지 않는 진화 toSpeciesId: ${missingIds} — 진화형(${missingIds})을 먼저 define_monster_species 로 정의한 뒤 이 종을 다시 저장하세요(같은 응답에서 병렬로 부르면 순서가 보장되지 않습니다). 허용 예시: ${knownIds(draft.database.monsterSpecies)}`, { code: "species-not-found" });
    }
    const itemIds = new Set(draft.database.items.map((item) => item.id));
    const missingItems = (record.evolutions ?? []).flatMap((evolution) => evolution.requires.itemId && !itemIds.has(evolution.requires.itemId) ? [evolution.requires.itemId] : []);
    if (missingItems.length > 0) {
      throw new ToolError(`존재하지 않는 진화 itemId: ${[...new Set(missingItems)].join(", ")} — 허용 예시: ${knownIds(draft.database.items)}`, { code: "item-not-found" });
    }
    const warnings: string[] = [];
    ensureMonsterGraphic(draft, record, record.graphic, "species.graphic.monsterResourceId", warnings, args.appearanceTags as unknown[] | undefined);
    const outcome = upsertById(draft.database.monsterSpecies, record);
    return {
      summary: `몬스터 species '${record.name}' ${outcome === "added" ? "추가" : "수정"}`,
      data: record,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const defineCrop: ToolDefinition = {
  name: "define_crop",
  description: "작물 레코드를 등록/수정한다. seedItemId는 심을 때 1개 소모되고 harvestItemId는 수확 시 지급된다.",
  mode: "write",
  parameters: parametersForRecord("crop", cropRecordSchema, {
    id: "crop_potato",
    name: "감자",
    seedItemId: "item_potato_seed",
    harvestItemId: "item_potato",
    stages: [{ days: 1 }, { days: 2 }],
    seasons: ["spring"],
  }),
  run(draft, args): ToolExecResult {
    draft.database.crops ??= [];
    const example = {
      id: "crop_potato",
      name: "감자",
      seedItemId: "item_potato_seed",
      harvestItemId: "item_potato",
      stages: [{ days: 1 }, { days: 2 }],
      seasons: ["spring"],
    };
    const merged = mergeRecord(draft.database.crops, args.crop, "crop", cropRecordSchema, example, ["name", "seedItemId", "harvestItemId", "stages", "seasons"]);
    const record = normalizeCropRecord(merged as Partial<CropRecord> & Pick<CropRecord, "id" | "name">);
    const itemIds = new Set(draft.database.items.map((item) => item.id));
    const missing = [record.seedItemId, record.harvestItemId].filter((itemId) => !itemIds.has(itemId));
    if (missing.length > 0) {
      throw new ToolError(`존재하지 않는 crop itemId: ${[...new Set(missing)].join(", ")} — 허용 예시: ${knownIds(draft.database.items)}`, { code: "item-not-found" });
    }
    const outcome = upsertById(draft.database.crops, record);
    return { summary: `작물 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const setTypeChart: ToolDefinition = {
  name: "set_type_chart",
  description: "포켓몬식 타입 상성표를 설정한다. types는 타입 id 배열이고 multipliers[공격][방어]는 데미지 배율이다.",
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      types: stringArraySchema("예: ['fire','water','grass']"),
      multipliers: { type: "object", description: "{ attackerType: { defenderType: multiplier } }", additionalProperties: true },
    },
    required: ["types", "multipliers"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    types: ["fire", "water", "grass"],
    multipliers: { fire: { grass: 2, water: 0.5, fire: 0.5 }, water: { fire: 2, grass: 0.5, water: 0.5 }, grass: { water: 2, fire: 0.5, grass: 0.5 } },
  },
  run(draft, args): ToolExecResult {
    const chart = normalizeTypeChart({
      types: Array.isArray(args.types) ? args.types as string[] : [],
      multipliers: args.multipliers && typeof args.multipliers === "object" && !Array.isArray(args.multipliers)
        ? args.multipliers as Record<string, Record<string, number>>
        : {},
    });
    if (!chart) throw new ToolError("types에 최소 1개 타입 id가 필요합니다.", { code: "missing-type-chart-types" });

    // 상성표 교체로 기존 참조가 새로 고아가 되면, 무관한 선재 오류처럼 보이며 커밋 전체가 거부된다.
    // 새 차트와 DB 전투 속성 어느 쪽에도 없는 값만 제거하고 어떤 레코드를 고쳤는지 경고한다.
    const validElementIds = new Set([
      ...(draft.database.elements ?? []).map((element) => element.id),
      ...chart.types,
    ]);
    const repaired: string[] = [];
    for (const skill of draft.database.skills) {
      if (skill.elementId && !validElementIds.has(skill.elementId)) {
        repaired.push(`skill ${skill.id}.elementId=${skill.elementId}`);
        delete skill.elementId;
      }
    }
    const prune = (ids: string[], label: string): string[] => ids.filter((id) => {
      if (validElementIds.has(id)) return true;
      repaired.push(`${label}=${id}`);
      return false;
    });
    for (const item of draft.database.items) {
      item.equipmentProfile.attackElementIds = prune(item.equipmentProfile.attackElementIds, `item ${item.id}.attackElementIds`);
      item.equipmentProfile.elementalDefenseIds = prune(item.equipmentProfile.elementalDefenseIds, `item ${item.id}.elementalDefenseIds`);
    }
    for (const equipment of draft.database.equipment) {
      equipment.attackElementIds = prune(equipment.attackElementIds, `equipment ${equipment.id}.attackElementIds`);
      equipment.elementalDefenseIds = prune(equipment.elementalDefenseIds, `equipment ${equipment.id}.elementalDefenseIds`);
    }
    draft.system.typeChart = chart;
    return {
      summary: `타입 상성표 설정(${chart.types.length}종)`,
      data: chart,
      ...(repaired.length > 0
        ? { warnings: [`새 상성표에 없는 기존 속성 참조 ${repaired.length}건을 정리했습니다: ${repaired.slice(0, 8).join(", ")}${repaired.length > 8 ? " …" : ""}`] }
        : {}),
    };
  },
};

const giveStarterMonsters: ToolDefinition = {
  name: "give_starter_monsters",
  description: "스타팅 몬스터 3종 선택 이벤트를 생성한다. 각 선택지는 giveMonster를 실행하고 셀프스위치 A로 재지급을 막는다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      speciesIds: { type: "array", items: { type: "string" }, description: "선택지로 제공할 species id 목록" },
      actorEvent: objectSchema({
        mapId: stringSchema("생성/수정할 맵 id. 생략 시 시작 맵"),
        eventId: stringSchema("생성/수정할 이벤트 id. 생략 시 ev_starter_monsters"),
        x: integerSchema(),
        y: integerSchema(),
        name: stringSchema(),
      }),
    },
    required: ["speciesIds"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const speciesIds = Array.isArray(args.speciesIds) ? (args.speciesIds as string[]).filter((id) => id.trim().length > 0) : [];
    if (speciesIds.length === 0) throw new ToolError("speciesIds가 필요합니다.", { code: "missing-species" });
    const speciesRecords = draft.database.monsterSpecies ?? [];
    const missing = speciesIds.filter((id) => !speciesRecords.some((species) => species.id === id));
    if (missing.length > 0) {
      throw new ToolError(`존재하지 않는 speciesId: ${missing.join(", ")} — 허용 예시: ${knownIds(speciesRecords)}`, { code: "species-not-found" });
    }
    const eventArgs = parseStarterEventArgs(args.actorEvent);
    const mapId = eventArgs.mapId ?? draft.startMapId;
    const map = draft.maps[mapId];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found" });
    const eventId = eventArgs.eventId ?? uniqueEventId(map.events, "ev_starter_monsters");
    const requestedX = eventArgs.x ?? Math.min(map.width - 1, draft.startPos.x + 1);
    const requestedY = eventArgs.y ?? draft.startPos.y;
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: "interaction",
      ignoreEventId: eventId,
      label: "스타팅 몬스터 선택 이벤트",
      code: "starter-monsters-impassable",
    });
    const event = starterMonsterEvent(draft, {
      mapId,
      eventId,
      x: placement.x,
      y: placement.y,
      name: eventArgs.name ?? "스타팅 몬스터",
      speciesIds,
    });
    const index = map.events.findIndex((entry) => entry.id === eventId);
    if (index >= 0) map.events[index] = event;
    else map.events.push(event);
    const warnings: string[] = [];
    if (placement.adjusted) {
      warnings.push(`스타팅 몬스터 선택 이벤트 위치 자동 조정: (${requestedX}, ${requestedY}) → (${placement.x}, ${placement.y})`);
    }
    if (draft.system.monsterCollection !== true) {
      warnings.push("system.monsterCollection 이 꺼져 있어 전투에 '포획' 커맨드가 뜨지 않습니다. configure_monster_system(enabled:true) 를 먼저 실행하세요.");
    }
    return {
      summary: `스타팅 몬스터 선택 이벤트 '${event.id}' 생성(${speciesIds.length}종)`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: { mapId, eventId: event.id, speciesIds },
    };
  },
};

const upsertActor: ToolDefinition = {
  name: "upsert_actor",
  description: "아군 액터 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("actor", actorRecordSchema, { id: "actor_hero", name: "주인공", classId: "class_hero", maxLevel: 99 }),
  run(draft, args): ToolExecResult {
    const warnings: string[] = [];
    expandShortParameterCurves(args.actor, "actor", warnings);
    const merged = mergeRecord(draft.database.actors, args.actor, "actor", actorRecordSchema, { id: "actor_hero", name: "주인공", classId: "class_hero" }, ["name", "classId"]);
    const actorPatch = args.actor as Record<string, unknown>;
    if (typeof actorPatch.appearanceId === "string"
      && !draft.database.characterAppearances?.some((appearance) => appearance.id === actorPatch.appearanceId)) {
      throw new ToolError(`공유 캐릭터 외형을 찾을 수 없습니다: ${actorPatch.appearanceId}`, { code: "appearance-not-found" });
    }
    const record = normalizeActorRecord(merged as Parameters<typeof normalizeActorRecord>[0]);
    dropUnknownElementRates(draft, record, "actor", warnings);
    const outcome = upsertById(draft.database.actors, record satisfies ActorRecord);
    return {
      summary: `액터 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`,
      data: record,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const upsertSkill: ToolDefinition = {
  name: "upsert_skill",
  description: "스킬 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("skill", skillRecordSchema, { id: "skill_fire", name: "화염", power: 35, elementId: "fire" }, actionSkillClearProperties),
  run(draft, args): ToolExecResult {
    validateSkillCombatPatch(args.skill);
    const merged = mergeRecord(draft.database.skills, args.skill, "skill", skillRecordSchema, { id: "skill_fire", name: "화염" });
    finalizeSkillCombatPatch(merged as unknown as Record<string, unknown>, args.skill, args);
    const record = normalizeSkillRecord(merged as Partial<SkillRecord> & Pick<SkillRecord, "id" | "name">);
    const warnings: string[] = [];
    dropUnknownAnimationId(draft, record, "skill", warnings);
    const outcome = upsertById(draft.database.skills, record);
    return { summary: `스킬 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record, ...(warnings.length ? { warnings } : {}) };
  },
};

const upsertEquipment: ToolDefinition = {
  name: "upsert_equipment",
  description: "장비(무기/방어구) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("equipment", equipmentRecordSchema, { id: "equip_sword", name: "철검", slot: "weapon", statBonuses: { attack: 8 } }),
  run(draft, args): ToolExecResult {
    const merged = mergeRecord(draft.database.equipment, args.equipment, "equipment", equipmentRecordSchema, { id: "equip_sword", name: "철검", slot: "weapon" });
    const record = normalizeEquipmentRecord(merged as Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">);
    if (!hasEquipmentSlot(draft, record.slot)) throw new Error(`Unknown equipment slot: ${record.slot}`);
    const outcome = upsertById(draft.database.equipment, record);
    return { summary: `장비 '${record.name}'(${record.slot}) ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const upsertClass: ToolDefinition = {
  name: "upsert_class",
  description: "직업(클래스) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("class", classRecordSchema, { id: "class_mage", name: "마법사", learnedSkills: [{ level: 1, skillId: "skill_fire" }] }),
  run(draft, args): ToolExecResult {
    const warnings: string[] = [];
    expandShortParameterCurves(args.class, "class", warnings);
    const merged = mergeRecord(draft.database.classes, args.class, "class", classRecordSchema, { id: "class_mage", name: "마법사" });
    const record = normalizeClassRecord(merged as Partial<ClassRecord> & Pick<ClassRecord, "id" | "name">);
    const classCurvesPatched = Boolean((args.class as { parameterCurves?: unknown } | undefined)?.parameterCurves);
    if (classCurvesPatched) {
      const users = draft.database.actors.filter((actor) => actor.classId === record.id).map((actor) => actor.id);
      warnings.push(`직업 parameterCurves 는 직업 변경(changeClass·승급) 뒤에만 능력치로 쓰입니다 — 이 직업으로 시작하는 배우${users.length ? `(${users.join(", ")})` : ""}의 전투 능력치는 배우 parameterCurves 가 정합니다. 역할별 능력치는 upsert_actor parameterCurves 에 [Lv1, Lv99] 로 주세요.`);
    }
    dropUnknownElementRates(draft, record, "class", warnings);
    dropUnknownAnimationId(draft, record, "class", warnings);
    const outcome = upsertById(draft.database.classes, record);
    return {
      summary: `클래스 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`,
      data: record,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const definePromotion: ToolDefinition = {
  name: "define_promotion",
  description: "직업 승급 조건을 정의한다. 같은 toClassId 승급은 덮어쓰며 레벨/스위치/아이템 소모/변수 조건을 지원한다.",
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      classId: stringSchema("승급 출발 직업 id"),
      toClassId: stringSchema("승급 도착 직업 id"),
      requires: promotionRequiresSchema,
    },
    required: ["classId", "toClassId", "requires"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    classId: "class_apprentice_warrior",
    toClassId: "class_warrior",
    requires: { level: 5, itemId: "item_warrior_badge" },
  },
  run(draft, args): ToolExecResult {
    const classId = typeof args.classId === "string" ? args.classId.trim() : "";
    const toClassId = typeof args.toClassId === "string" ? args.toClassId.trim() : "";
    if (!classId) throw new ToolError("classId(문자열)가 필요합니다.", { code: "missing-class-id" });
    if (!toClassId) throw new ToolError("toClassId(문자열)가 필요합니다.", { code: "missing-to-class-id" });
    const source = draft.database.classes.find((record) => record.id === classId);
    if (!source) {
      throw new ToolError(`존재하지 않는 classId: ${classId} — 허용 예시: ${knownIds(draft.database.classes)}`, { code: "class-not-found" });
    }
    if (!draft.database.classes.some((record) => record.id === toClassId)) {
      throw new ToolError(`존재하지 않는 toClassId: ${toClassId} — 허용 예시: ${knownIds(draft.database.classes)}`, { code: "class-not-found" });
    }
    const requires = args.requires && typeof args.requires === "object" && !Array.isArray(args.requires)
      ? (args.requires as Record<string, unknown>)
      : {};
    const record = normalizeClassRecord({
      ...source,
      promotions: [
        ...(source.promotions ?? []).filter((promotion) => promotion.toClassId !== toClassId),
        { toClassId, requires },
      ],
    });
    upsertById(draft.database.classes, record);
    const targetName = draft.database.classes.find((entry) => entry.id === toClassId)?.name ?? toClassId;
    return {
      summary: `승급 '${source.name}' → '${targetName}' 정의`,
      data: (record.promotions ?? []).find((promotion) => promotion.toClassId === toClassId),
    };
  },
};

const upsertState: ToolDefinition = {
  name: "upsert_state",
  description: "상태이상(State) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 임의 필드는 거부한다.",
  mode: "write",
  parameters: parametersForRecord("state", stateRecordSchema, { id: "state_poison", name: "독", runtimeEffects: { hpDamagePercentPerTurn: 5 } }),
  run(draft, args): ToolExecResult {
    const record = normalizeStateRecord(mergeRecord(draft.database.states, args.state, "state", stateRecordSchema, { id: "state_poison", name: "독" }) as Partial<StateRecord> & Pick<StateRecord, "id" | "name">);
    const outcome = upsertById(draft.database.states, record);
    return { summary: `상태 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const COMMON_EVENT_TRIGGERS = new Set<CommonEvent["trigger"]>(["none", "auto", "parallel"]);
const LOW_LEVEL_TOOL_DESCRIPTION_PREFIX = "먼저 위 고수준 툴이 목적에 맞는지 확인하라(트랩=place_trap, 퍼즐=compile_puzzle, 컷신=script_cutscene 등). 이 툴은 커스텀 로직 전용.";

const upsertCommonEvent: ToolDefinition = {
  name: "upsert_common_event",
  description: `${LOW_LEVEL_TOOL_DESCRIPTION_PREFIX} 커먼 이벤트를 등록/수정한다. trigger: none(호출 전용)/auto/parallel, 조건 스위치 지정 가능.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      trigger: { type: "string", enum: ["none", "auto", "parallel"] },
      conditionSwitchId: { type: "string" },
      commands: { type: "array", description: "Command[] 또는 단일 Command object", items: COMMAND_SCHEMA },
    },
    required: ["id", "name", "commands"],
  },
  run(draft, args): ToolExecResult {
    const base = requireRecordId(args, "common_event");
    if (!base.name) throw new ToolError("common_event.name(문자열)가 필요합니다.");
    const warnings: string[] = [];
    const trigger = COMMON_EVENT_TRIGGERS.has(args.trigger as CommonEvent["trigger"])
      ? (args.trigger as CommonEvent["trigger"])
      : "none";
    const commands = normalizeLowLevelCommandArray(args.commands, `common_event.${args.id}.commands`, warnings);
    validateLowLevelCommandArray(`common_event.${args.id}.commands`, commands);
    assertPartyActorReferences(draft, commands, `common_event.${args.id}.commands`);
    const record: CommonEvent = {
      id: args.id as string,
      name: args.name as string,
      trigger,
      ...(typeof args.conditionSwitchId === "string" && args.conditionSwitchId ? { conditionSwitchId: args.conditionSwitchId } : {}),
      commands: [...commands],
    };
    const outcome = upsertById(draft.commonEvents, record);
    const unsupportedCommands = countLimitedRuntimeSupportCommands(record.commands, "common");
    return {
      summary: `커먼 이벤트 '${record.name}'(${trigger}) ${outcome === "added" ? "추가" : "수정"} — 미지원 커맨드 ${unsupportedCommands}건`,
      data: { id: record.id, unsupportedCommands },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setSessionStart: ToolDefinition = {
  name: "set_session_start",
  description: "게임 시작 상태(골드/인벤토리/파티)를 설정한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      gold: { type: "integer" },
      inventory: {
        type: "object",
        description: "{ itemId: 수량 } — 키가 아이템 id 인 동적 맵",
        additionalProperties: true,
      },
      partyActorIds: { type: "array", description: "시작 파티 액터 id", items: { type: "string" } },
    },
  },
  run(draft, args): ToolExecResult {
    if (typeof args.gold === "number") draft.session.gold = Math.max(0, Math.trunc(args.gold));
    if (args.inventory && typeof args.inventory === "object") {
      draft.session.inventory = { ...(args.inventory as Record<string, number>) };
    }
    if (Array.isArray(args.partyActorIds)) {
      draft.session.partyActorIds = [...(args.partyActorIds as string[])];
    }
    return { summary: `시작 상태 설정(gold=${draft.session.gold ?? 0}, party=${draft.session.partyActorIds.length}명)` };
  },
};

function parseTitleBackgroundLayers(value: unknown): TitleBackgroundLayer[] {
  if (!Array.isArray(value)) throw new ToolError("backgroundLayers는 배열이어야 합니다.", { code: "invalid-args" });
  if (value.length > MAX_TITLE_BACKGROUND_LAYERS) {
    throw new ToolError(`backgroundLayers는 최대 ${MAX_TITLE_BACKGROUND_LAYERS}개까지 설정할 수 있습니다.`, { code: "invalid-args" });
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ToolError(`backgroundLayers[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
    }
    const layer = entry as Record<string, unknown>;
    const resourceId = typeof layer.resourceId === "string" ? layer.resourceId.trim() : "";
    if (!resourceId) throw new ToolError(`backgroundLayers[${index}].resourceId가 필요합니다.`, { code: "invalid-args" });
    const optionalNumber = (key: "scrollXPerSec" | "scrollYPerSec" | "parallax" | "opacity"): number | undefined => {
      const candidate = layer[key];
      if (candidate === undefined) return undefined;
      if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
        throw new ToolError(`backgroundLayers[${index}].${key}는 유한한 숫자여야 합니다.`, { code: "invalid-args" });
      }
      return candidate;
    };
    const scrollXPerSec = optionalNumber("scrollXPerSec");
    const scrollYPerSec = optionalNumber("scrollYPerSec");
    const parallax = optionalNumber("parallax");
    const opacity = optionalNumber("opacity");
    return {
      resourceId,
      ...(scrollXPerSec !== undefined ? { scrollXPerSec: Math.max(-480, Math.min(480, scrollXPerSec)) } : {}),
      ...(scrollYPerSec !== undefined ? { scrollYPerSec: Math.max(-480, Math.min(480, scrollYPerSec)) } : {}),
      ...(parallax !== undefined ? { parallax: Math.max(0, Math.min(4, parallax)) } : {}),
      ...(opacity !== undefined ? { opacity: Math.max(0, Math.min(1, opacity)) } : {}),
    };
  });
}

function registerTitleLayerResourceIds(draft: Project, layers: readonly TitleBackgroundLayer[]): void {
  const known = collectResourceIds(draft);
  for (const resourceId of new Set(layers.map((layer) => layer.resourceId))) {
    if (known.has(resourceId)) continue;
    // resourceProfiles is the project's registry for externally supplied resource ids. Tool calls
    // carry the id, not an upload payload, so register that opaque id just as the title picker does.
    draft.resourceProfiles.push({ kind: "title", name: resourceId, assetId: resourceId });
    known.add(resourceId);
  }
}

const TITLE_PARTICLE_PRESETS = ["snow", "rain", "fireflies"] as const;

function parseTitleParticles(value: unknown): TitleParticleSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError("particles는 객체여야 합니다.", { code: "invalid-args" });
  }
  const particles = value as Record<string, unknown>;
  const preset = particles.preset;
  if (preset !== "snow" && preset !== "rain" && preset !== "fireflies") {
    throw new ToolError(`particles.preset은 ${TITLE_PARTICLE_PRESETS.join(", ")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  const density = particles.density;
  if (density !== undefined && (typeof density !== "number" || !Number.isFinite(density))) {
    throw new ToolError("particles.density는 0..100의 유한한 숫자여야 합니다.", { code: "invalid-args" });
  }
  return {
    preset,
    ...(typeof density === "number" ? { density: Math.max(0, Math.min(100, density)) } : {}),
  };
}

const TITLE_INTRO_LOGO_ANIMATIONS = ["none", "fadeIn", "riseIn"] as const;
const TITLE_INTRO_MENU_ANIMATIONS = ["none", "fadeIn", "slideUp"] as const;

function parseTitleIntro(value: unknown): TitleIntroSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError("intro는 객체여야 합니다.", { code: "invalid-args" });
  }
  const intro = value as Record<string, unknown>;
  const logo = intro.logo;
  if (logo !== undefined && logo !== "none" && logo !== "fadeIn" && logo !== "riseIn") {
    throw new ToolError(`intro.logo는 ${TITLE_INTRO_LOGO_ANIMATIONS.join(", ")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  const menu = intro.menu;
  if (menu !== undefined && menu !== "none" && menu !== "fadeIn" && menu !== "slideUp") {
    throw new ToolError(`intro.menu는 ${TITLE_INTRO_MENU_ANIMATIONS.join(", ")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  const integerInRange = (key: "delayMs" | "staggerMs", maximum: number): number | undefined => {
    const candidate = intro[key];
    if (candidate === undefined) return undefined;
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
      throw new ToolError(`intro.${key}는 0..${maximum}의 유한한 숫자여야 합니다.`, { code: "invalid-args" });
    }
    return Math.max(0, Math.min(maximum, Math.trunc(candidate)));
  };
  const delayMs = integerInRange("delayMs", 10000);
  const staggerMs = integerInRange("staggerMs", 2000);
  return {
    ...(logo !== undefined ? { logo } : {}),
    ...(menu !== undefined ? { menu } : {}),
    ...(delayMs !== undefined ? { delayMs } : {}),
    ...(staggerMs !== undefined ? { staggerMs } : {}),
  };
}


/**
 * 없는 리소스 id 는 호출 시점에 거부하고 비슷한 실제 id 를 준다. 예전에는 저장 뒤 커밋 게이트가
 * 「참조 검증 실패 … backgroundResourceId 가 존재하지 않습니다」 로 **변경 전체**를 되돌려 제목·음악까지 날아갔다
 * (추리 도그푸딩 gen: 지어낸 easyrpg-backdrop-room-1).
 */
function requireTitleResource(draft: Project, field: string, id: string, kind: "picture" | "bgm"): string {
  const known = collectResourceIds(draft);
  if (known.has(id)) return id;
  const stem = id.split(/[-_]/u).slice(0, 2).join("-");
  const near = [...known].filter((candidate) => stem && candidate.startsWith(stem)).slice(0, 6);
  throw new ToolError(
    `${field} '${id}' 는 없는 리소스입니다.${near.length > 0 ? ` 비슷한 실제 id: ${near.join(", ")}.` : ""} list_resources(kind:"${kind}") 로 실제 id 를 찾아 넣거나 이 필드를 빼세요.`,
    { code: "invalid-args" },
  );
}

const setTitleScreen: ToolDefinition = {
  name: "set_title_screen",
  description: "타이틀 화면 제목/메뉴/표시/오디오와 배경 레이어/파티클/등장 연출을 갱신한다. titleScreen이 없으면 생성한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      menuLabels: {
        type: "object",
        description: "{ newGame, continueGame, quit }",
        properties: {
          newGame: { type: "string" },
          continueGame: { type: "string" },
          quit: { type: "string" },
        },
      },
      menuVisibility: {
        type: "object",
        description: "{ newGame, continueGame, quit } — newGame always true",
        properties: {
          newGame: { type: "boolean" },
          continueGame: { type: "boolean" },
          quit: { type: "boolean" },
        },
      },
      sounds: {
        type: "object",
        description: "{ cursorSeResourceId, confirmSeResourceId, cancelSeResourceId } nested merge",
        properties: {
          cursorSeResourceId: { type: "string" },
          confirmSeResourceId: { type: "string" },
          cancelSeResourceId: { type: "string" },
        },
      },
      titleGraphic: {
        type: "object",
        description: "{ mode: text|graphic|both, resourceId, x, y } nested merge",
        properties: {
          mode: { type: "string", enum: ["text", "graphic", "both"] },
          resourceId: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
        },
      },
      layout: {
        type: "object",
        description: "{ titleX, titleY, menuX, menuY } nested merge",
        properties: {
          titleX: { type: "integer" },
          titleY: { type: "integer" },
          menuX: { type: "integer" },
          menuY: { type: "integer" },
        },
      },
      backgroundResourceId: { type: "string", description: "titleScreen.background only; does not clear system.titleResourceId" },
      musicResourceId: { type: "string" },
      showInputHint: { type: "boolean" },
      backgroundLayers: {
        type: "array",
        description: `무한 스크롤 배경 레이어. 최대 ${MAX_TITLE_BACKGROUND_LAYERS}개`,
        items: {
          type: "object",
          properties: {
            resourceId: { type: "string" },
            scrollXPerSec: { type: "number", minimum: -480, maximum: 480 },
            scrollYPerSec: { type: "number", minimum: -480, maximum: 480 },
            parallax: { type: "number", minimum: 0, maximum: 4 },
            opacity: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["resourceId"],
          additionalProperties: false,
        },
      },
      particles: {
        type: "object",
        properties: {
          preset: { type: "string", enum: TITLE_PARTICLE_PRESETS },
          density: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["preset"],
        additionalProperties: false,
      },
      intro: {
        type: "object",
        properties: {
          logo: { type: "string", enum: TITLE_INTRO_LOGO_ANIMATIONS },
          menu: { type: "string", enum: TITLE_INTRO_MENU_ANIMATIONS },
          delayMs: { type: "integer", minimum: 0, maximum: 10000 },
          staggerMs: { type: "integer", minimum: 0, maximum: 2000 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const requestedTitle = typeof args.title === "string" ? args.title : undefined;
    if (requestedTitle !== undefined) draft.meta = { ...draft.meta, title: requestedTitle };
    draft.system.titleScreen ??= defaultTitleScreenSettings();
    const current = draft.system.titleScreen;
    if (requestedTitle !== undefined) current.title = requestedTitle;

    const labels = args.menuLabels as Partial<typeof current.menuLabels> | undefined;
    if (labels) current.menuLabels = { ...current.menuLabels, ...labels };

    const visibility = args.menuVisibility as Partial<{ newGame: boolean; continueGame: boolean; quit: boolean }> | undefined;
    if (visibility) {
      current.menuVisibility = {
        newGame: true,
        continueGame: visibility.continueGame === false ? false : visibility.continueGame === true ? true : current.menuVisibility?.continueGame !== false,
        quit: visibility.quit === false ? false : visibility.quit === true ? true : current.menuVisibility?.quit !== false,
      };
    }

    if (typeof args.backgroundResourceId === "string") {
      const background = args.backgroundResourceId.trim();
      if (background) current.backgroundResourceId = requireTitleResource(draft, "backgroundResourceId", background, "picture");
      else delete current.backgroundResourceId;
    }

    if (typeof args.musicResourceId === "string") {
      const music = args.musicResourceId.trim();
      if (music) current.musicResourceId = requireTitleResource(draft, "musicResourceId", music, "bgm");
      else delete current.musicResourceId;
    }

    if (typeof args.showInputHint === "boolean") {
      current.showInputHint = args.showInputHint;
    }

    const layout = args.layout as Partial<typeof current.layout> | undefined;
    if (layout && typeof layout === "object") {
      current.layout = {
        titleX: typeof layout.titleX === "number" && Number.isFinite(layout.titleX) ? Math.trunc(layout.titleX) : current.layout.titleX,
        titleY: typeof layout.titleY === "number" && Number.isFinite(layout.titleY) ? Math.trunc(layout.titleY) : current.layout.titleY,
        menuX: typeof layout.menuX === "number" && Number.isFinite(layout.menuX) ? Math.trunc(layout.menuX) : current.layout.menuX,
        menuY: typeof layout.menuY === "number" && Number.isFinite(layout.menuY) ? Math.trunc(layout.menuY) : current.layout.menuY,
      };
    }

    const sounds = args.sounds as Record<string, unknown> | undefined;
    if (sounds && typeof sounds === "object" && !Array.isArray(sounds)) {
      const next = { ...(current.sounds ?? {}) };
      for (const key of ["cursorSeResourceId", "confirmSeResourceId", "cancelSeResourceId"] as const) {
        if (!(key in sounds)) continue;
        const value = sounds[key];
        if (typeof value === "string" && value.trim()) next[key] = value.trim();
        else delete next[key];
      }
      if (Object.keys(next).length === 0) delete current.sounds;
      else current.sounds = next;
    }

    const graphic = args.titleGraphic as Record<string, unknown> | undefined;
    if (graphic && typeof graphic === "object" && !Array.isArray(graphic)) {
      const base = current.titleGraphic ?? {
        mode: "text" as const,
        x: current.layout.titleX,
        y: current.layout.titleY,
      };
      const mode =
        graphic.mode === "graphic" || graphic.mode === "both" || graphic.mode === "text"
          ? graphic.mode
          : base.mode;
      const resourceId =
        "resourceId" in graphic
          ? typeof graphic.resourceId === "string" && graphic.resourceId.trim()
            ? graphic.resourceId.trim()
            : undefined
          : base.resourceId;
      const x =
        typeof graphic.x === "number" && Number.isFinite(graphic.x) ? Math.trunc(graphic.x) : base.x;
      const y =
        typeof graphic.y === "number" && Number.isFinite(graphic.y) ? Math.trunc(graphic.y) : base.y;
      if (mode === "text" && !resourceId) delete current.titleGraphic;
      else {
        current.titleGraphic = {
          mode,
          ...(resourceId ? { resourceId } : {}),
          x,
          y,
        };
      }
    }

    if ("backgroundLayers" in args) {
      const layers = parseTitleBackgroundLayers(args.backgroundLayers);
      if (layers.length === 0) delete current.backgroundLayers;
      else {
        registerTitleLayerResourceIds(draft, layers);
        current.backgroundLayers = layers;
      }
    }

    if ("particles" in args) current.particles = parseTitleParticles(args.particles);
    if ("intro" in args) {
      const intro = parseTitleIntro(args.intro);
      if (Object.keys(intro).length === 0) delete current.intro;
      else current.intro = intro;
    }

    return { summary: `타이틀 화면 설정: "${current.title}"` };
  },
};

function parseStarterEventArgs(value: unknown): { mapId?: string; eventId?: string; x?: number; y?: number; name?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    mapId: typeof record.mapId === "string" && record.mapId.trim() ? record.mapId.trim() : undefined,
    eventId: typeof record.eventId === "string" && record.eventId.trim() ? record.eventId.trim() : undefined,
    x: typeof record.x === "number" && Number.isFinite(record.x) ? Math.trunc(record.x) : undefined,
    y: typeof record.y === "number" && Number.isFinite(record.y) ? Math.trunc(record.y) : undefined,
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : undefined,
  };
}

function starterMonsterEvent(
  project: Project,
  input: { readonly mapId: string; readonly eventId: string; readonly x: number; readonly y: number; readonly name: string; readonly speciesIds: readonly string[] }
): GameEvent {
  const options = input.speciesIds.map((speciesId) => {
    const species = project.database.monsterSpecies?.find((entry) => entry.id === speciesId);
    return {
      text: species?.name ?? speciesId,
      branch: [
        { kind: "giveMonster", speciesId, level: 5, nickname: species?.name },
        { kind: "text", body: `${species?.name ?? speciesId}와 함께 여행을 시작합니다.` },
        { kind: "setSelfSwitch", key: "A", value: true },
      ] satisfies Command[],
    };
  });
  return {
    id: input.eventId,
    x: Math.max(0, input.x),
    y: Math.max(0, input.y),
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${input.eventId}_choose`,
        name: input.name,
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          {
            kind: "choices",
            prompt: "처음 함께할 몬스터를 고르세요.",
            options,
            cancelBehavior: "disallow",
          },
        ],
      },
      {
        id: `${input.eventId}_claimed`,
        name: `${input.name} 완료`,
        conditions: [{ kind: "selfSwitch", key: "A", value: true }],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  };
}

function uniqueEventId(events: readonly GameEvent[], baseId: string): string {
  if (!events.some((event) => event.id === baseId)) return baseId;
  let index = 2;
  while (events.some((event) => event.id === `${baseId}_${index}`)) index += 1;
  return `${baseId}_${index}`;
}

// (프로그램 소비용) 세션 시작에 아이템을 병합하는 헬퍼.
export function mergeSessionInventory(project: Project, inventory: Record<string, number>): void {
  project.session.inventory = { ...project.session.inventory, ...inventory };
}

const upsertBattleAnimation: ToolDefinition = {
  name: "upsert_battle_animation",
  description: "전투 애니메이션 레코드를 등록/수정한다. Database 애니메이션 탭과 같은 저작 데이터.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      animation: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          resourceId: { type: "string" },
          scope: { type: "string", enum: ["singleTarget", "allTargets", "screen"] },
          position: { type: "string", enum: ["head", "center", "feet", "screen"] },
          large: { type: "boolean" },
        },
        required: ["id", "name"],
        additionalProperties: false,
      },
    },
    required: ["animation"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const input = args.animation;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new ToolError("animation 객체가 필요합니다.", { code: "invalid-args" });
    }
    const record = input as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!id || !name) throw new ToolError("animation.id와 animation.name이 필요합니다.", { code: "invalid-args" });
    const existing = draft.database.battleAnimations.find((animation) => animation.id === id);
    const animation: BattleAnimationRecord = {
      ...(existing ?? { id, name }),
      id,
      name,
      ...(typeof record.resourceId === "string" ? { resourceId: record.resourceId } : {}),
      ...(record.scope === "singleTarget" || record.scope === "allTargets" || record.scope === "screen"
        ? { scope: record.scope }
        : {}),
      ...(record.position === "head" || record.position === "center" || record.position === "feet" || record.position === "screen"
        ? { position: record.position }
        : {}),
      ...(typeof record.large === "boolean" ? { large: record.large } : {}),
    };
    const outcome = upsertById(draft.database.battleAnimations, animation);
    return { summary: `전투 애니메이션 '${name}' ${outcome === "added" ? "추가" : "수정"}`, data: animation };
  },
};

export const DB_TOOLS: readonly ToolDefinition[] = [
  duplicateDatabaseRecordTool,
  deleteDatabaseRecordTool,
  upsertDatabaseUtility,
  upsertItem,
  upsertEnemy,
  upsertTroop,
  defineMonsterSpecies,
  defineCrop,
  setTypeChart,
  giveStarterMonsters,
  upsertActor,
  upsertSkill,
  upsertEquipment,
  upsertClass,
  definePromotion,
  upsertState,
  upsertCommonEvent,
  upsertBattleAnimation,
  setSessionStart,
  setTitleScreen,
];
