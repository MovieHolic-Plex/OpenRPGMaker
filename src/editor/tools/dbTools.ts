import { MULTI_HIT_LIMIT, normalizeFixedDamage } from "@/project/skillBattleRules";
import { withJosa } from "@/util/josa";
import { starterChoiceCommands } from "@/project/starterChoice";
import { resolveGraphic } from "./eventCompile";
import { withNpcGraphicCatalogFilter } from "@/assets/charsetQuery";
import { genreLockCharsetCatalogFilter } from "@/project/genreLockCharsets";
import { ensureNamedSwitch } from "./flagHelpers";
import { CHARACTER_MOTION_STYLES } from "@/battle/characterMotion";
import { CAPTURE_CONDITION_KINDS, CAPTURE_CONDITION_MAX_MULTIPLIER, CAPTURE_CONDITION_MIN_MULTIPLIER } from "@/battle/captureBalls";
import { SKILL_WEATHER_KINDS, SKILL_WEATHER_MAX_TURNS, SKILL_WEATHER_MIN_TURNS } from "@/battle/weather";
import { BATTLE_MOTION_PATTERNS } from "@/battle/battleMotionProgram";
import { normalizeBattleGimmick } from "@/battle/battleGimmickRules";
import { HELD_ITEM_KINDS, HELD_ITEM_STATUSES } from "@/battle/heldItems";
import { MONSTER_ABILITY_KINDS, MONSTER_ABILITY_STATS, MONSTER_ABILITY_STATUSES } from "@/battle/abilities";
import { isStatStageKey, STAT_STAGE_KEYS, STAT_STAGE_MAX } from "@/battle/statStages";
import { isBlendModeName, normalizeBlendMode } from "@/project/blendMode";
import { finalizeSkillCombatPatch, validateEnemyCombatPatch, validateSkillCombatPatch } from "./combatAuthoringValidation";
import { PARTY_PIXEL_SHEETS, partyPixelSheet } from "@/assets/partyPixelSheets";
import { actionSkillClearProperties, authoredSkillProperties, combatConditionSchema, conditionalDropsSchema } from "./combatAuthoringSchemas";
import { equipmentSlots, equipmentSlotRemovalBlocker, hasEquipmentSlot, removeEquipmentSlot, upsertEquipmentSlot } from "@/project/equipmentSlots";
import { mergeRecordPatch } from "./mergeRecordPatch";
import { projectDatabaseReferenceMessage } from "@/editor/databaseRecordReferences";
import { BUNDLED_BATTLE_MOTIONS } from "@/assets/battleMotionCatalog";
import { nearbyRetroChoreographies, resolveSkillChoreography, retroChoreographyIdForClone, retroChoreographyKind } from "@/assets/retroSkillCatalog";
import { BATTLE_AURA_IDS, normalizeBattleAura } from "@/assets/battleStateAuras";
import { recommendRetroChoreography } from "@/assets/retroChoreographyRecommend";
import { RETRO_SKILL_RECIPES } from "@/player/retroSkillChoreography";
// editor/tools/dbTools.ts
// DB 쓰기 툴: upsert_item / upsert_enemy / upsert_troop / upsert_actor / upsert_skill
//            / upsert_equipment / upsert_class / define_promotion / upsert_state / upsert_common_event
//            / set_session_start / set_title_screen.
// 모든 레코드는 기존 레코드와 병합한 뒤 normalize* 계열을 거쳐 id로 upsert한다.

import { typeChartForPreset } from "@/project/typeCharts";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { retitlePlaceholderOpening } from "@/project/defaults/defaultOpeningSequence";
import { normalizeActorRecord } from "@/project/actorModel";
import { reconcileSharedFaceWithCharset as reconcileFaceWithCharset } from "@/project/sharedCharacterFaceResolver";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { COMBO_MAX_ACTORS, MAX_TITLE_BACKGROUND_LAYERS, MAX_TITLE_RUNNERS, normalizeTitlePressStart, normalizeTitleRunners, normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord, normalizeStateRecord, normalizeTypeChart } from "@/project/databaseRecordModel";
import { normalizeCropRecord } from "@/project/farmModel";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel, monsterSpeciesById, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { findOpeningStillScene, parseOpeningStill } from "@/project/openingStill";
import { countLimitedRuntimeSupportCommands } from "@/project/lint/projectLint";
import { ensureMonsterGraphic } from "./monsterGraphicAssignment";
import { CHARACTER_SCALE_MIN, CHARACTER_SCALE_MAX } from "@/project/footprint";
import type {
  ActorRecord,
  BattleAnimationRecord,
  ClassRecord,
  CommonEvent,
  CropRecord,
  EnemyRecord,
  EquipmentRecord,
  EventPageGraphic,
  GameEvent,
  ItemRecord,
  MonsterSpeciesRecord,
  Project,
  SkillRecord,
  StateRecord,
  TitleBackgroundLayer,
  TitleIntroSettings,
  TitleParticleSettings,
  TitleScreenSettings,
  TroopRecord,
} from "@/project/types";
import {
  MAX_TITLE_EFFECT_REGION_POINTS,
  MAX_TITLE_EFFECTS,
  MAX_TITLE_MOTES,
  TITLE_BACKGROUND_FITS,
  TITLE_BACKGROUND_RENDERINGS,
  TITLE_EFFECT_KINDS,
  TITLE_LOGO_STYLES,
  TITLE_MENU_STYLES,
  TITLE_LOGO_SHINES,
  TITLE_OPENING_PRESETS,
  TITLE_SEQUENCE_LOGO_REVEALS,
  TITLE_TRANSITION_KINDS,
  findTitleOpeningPreset,
  normalizeTitleLogoShine,
  normalizeTitleOpeningSequence,
  normalizeTitleTransition,
  normalizeTitleBackgroundFit,
  normalizeTitleBackgroundRendering,
  normalizeTitleEffects,
  normalizeTitleLogoStyle,
  normalizeTitleLogoSubtitle,
  normalizeTitleMenuStyle,
  titleOpeningPresetEffects,
} from "@/project/titleEffects";
import { normalizeLowLevelCommandArray, validateLowLevelCommandArray } from "./commandArgs";
import { assertPartyActorReferences } from "./partyActorReferences";
import { resolveEventPlacement } from "./eventTools";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { unsuitableOpeningStillMessage } from "@/assets/openingStillMoods";
import { pickBlueprintTitleArt } from "@/project/blueprintAssembly";
import { troopBalanceWarnings } from "./troopBalanceCheck";
import { expandShortParameterCurves } from "./parameterCurveInput";
import { BATTLE_BACKDROP_ID_HINT } from "@/assets/battleSceneryCatalog";
import { BOSS_FLOOR_STATS, type BossFloorStat, isBossEnemy, scaleBossToStartParty } from "./bossThreatScaling";
import { COMMAND_SCHEMA } from "./schemaShapes";
import { closestDeclaredKey } from "./argRepair";
import { DB_FIELD_REJECT_HINTS, repairRecordArgs } from "./dbRecordAliases";

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
    case "skills": {
      const source = draft.database.skills.find((record) => record.id === id);
      const borrowed = source ? retroChoreographyIdForClone(source) : undefined;
      const copy = duplicateRecord(draft.database.skills, id, newId, name);
      if (borrowed) copy.retroChoreographyId = borrowed;
      return copy;
    }
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
    kind: { type: "string", enum: ["physical", "magical", "attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event", "commonEvent"] },
    rateLabels: { type: "array", items: { type: "string", enum: ["A", "B", "C", "D", "E"] } },
    damageMultipliers: { type: "object", properties: { A: { type: "number" }, B: { type: "number" }, C: { type: "number" }, D: { type: "number" }, E: { type: "number" } }, additionalProperties: false },
    damage: { type: "integer" },
    encounterRatePercent: { type: "integer" },
    battleBackgroundResourceId: { type: "string", description: BATTLE_BACKDROP_ID_HINT },
    footstepSoundResourceId: { type: "string" },
    characterDisplay: { type: "string", enum: ["normal", "transparent"] },
    vehiclePassage: { type: "object", properties: { boat: { type: "boolean" }, ship: { type: "boolean" }, airshipLand: { type: "boolean" }, chocobo: { type: "boolean", description: "초코보가 걸을 수 없는 칸(숲 등)도 지난다" }, cart: { type: "boolean", description: "광산 수레가 다니는 칸(레일)" }, raft: { type: "boolean", description: "뗏목이 다니는 칸(강·얕은 물). false 면 소형선만 다니는 물(호수 폴백)에서도 못 간다. 빼면 그 폴백" } }, additionalProperties: false },
    skillSubsetName: { type: "string" },
    skillId: { type: "string" },
    commonEventId: { type: "string", description: "battleCommands kind:commonEvent — 고르면 전투 중에 실행할 공통 이벤트 id(메시지·선택지·변수 조작을 그대로 쓴다)" },
  },
  required: ["id", "name"],
  additionalProperties: false,
};

const upsertDatabaseUtility: ToolDefinition = {
  name: "upsert_database_utility",
  description: "데이터베이스의 속성(elements), 지형 효과(terrains), 전투 명령(battleCommands) 레코드를 id 기준으로 등록·교체한다. 전투 명령 kind: skill+skillId = 스킬 하나를 바로 쓰는 명령, commonEvent+commonEventId = 고르면 공통 이벤트를 실행하는 명령(RM2003 「이벤트 연결」). 명령을 고를 때 대사·문장(\"토마는 기도했다…\")을 띄우거나 여러 효과를 차례로 내야 하면 commonEvent 를 쓴다 — 스킬에는 사용 문장 칸이 없다. 공통 이벤트를 upsert_common_event 로 먼저 만든다. 특정 배우에게만 붙이려면 upsert_actor.battleCommandIds.",
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
          ...((passage as Record<string, unknown>).chocobo === true ? { chocobo: true } : {}),
          ...((passage as Record<string, unknown>).cart === true ? { cart: true } : {}),
          ...((passage as Record<string, unknown>).raft === true || (passage as Record<string, unknown>).raft === false
            ? { raft: (passage as Record<string, unknown>).raft === true }
            : {}),
        },
      };
      draft.database.terrains ??= [];
      const outcome = upsertById(draft.database.terrains, next);
      return { summary: `지형 효과 '${next.name}' ${outcome === "added" ? "추가" : "수정"}`, data: next };
    }
    if (collection === "battleCommands") {
      const allowed = new Set(["attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event", "commonEvent"]);
      if (typeof record.kind !== "string" || !allowed.has(record.kind)) throw new ToolError("battleCommands.record.kind가 올바르지 않습니다.", { code: "invalid-args" });
      const next = {
        id: base.id,
        name: base.name ?? base.id,
        kind: record.kind,
        ...(typeof record.skillSubsetName === "string" ? { skillSubsetName: record.skillSubsetName } : {}),
        ...(typeof record.skillId === "string" ? { skillId: record.skillId } : {}),
        ...(typeof record.commonEventId === "string" ? { commonEventId: record.commonEventId } : {}),
      } as NonNullable<Project["database"]["battleCommands"]>[number];
      if (next.kind === "commonEvent" && !draft.commonEvents.some((entry) => entry.id === next.commonEventId)) {
        throw new ToolError("battleCommands kind:commonEvent 는 있는 공통 이벤트 id(commonEventId)가 필요합니다.", { code: "invalid-args" });
      }
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
const statStageEffectSchema = objectSchema({
  stat: { type: "string", enum: [...STAT_STAGE_KEYS], description: "attack 공격 · defense 방어 · spAttack 특수공격 · spDefense 특수방어 · speed 스피드 · accuracy 명중률 · evasion 회피율" },
  stages: integerSchema("능력치 단계 변화 −6~+6, 0 제외. 울음=attack −1, 칼춤=attack +2, 몸을 단단히=defense +1, 연막=accuracy −1"),
  chance: integerSchema("발동 확률 0~100(생략 = 100). 피해 기술의 부가 효과(예: 20% 방어 하락)에 쓴다"),
  target: { type: "string", enum: ["target", "self"], description: "생략/target = 기술 대상의 단계, self = 시전자 자신(오버히트로 자신의 특수공격이 떨어짐)" },
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
const actorOptionsSchema = objectSchema({
  dualWield: booleanSchema(),
  autoBattle: booleanSchema(),
  fixedEquipment: booleanSchema(),
  mightyGuard: booleanSchema(),
  autoTactic: { type: "string", enum: ["attackAll", "healFirst", "conserveMp", "followOrders"], description: "autoBattle 배우의 작전: attackAll(전원 공격) · healFirst(회복 우선) · conserveMp(MP 아끼기) · followOrders(자동 전투여도 직접 조작). 생략 = 균형" },
});
const learnedSkillSchema = objectSchema({ level: integerSchema(), skillId: stringSchema() });
// 배우 전용: tp 는 배우 learnedSkills 에만 있다(직업·종족 습득표는 레벨만).
const actorLearnedSkillSchema = objectSchema({
  level: integerSchema(),
  skillId: stringSchema(),
  tp: integerSchema("기술 포인트 문턱(1 이상). 있으면 누적 TP 와 level 을 모두 채운 승리 뒤에 배운다. 생략하면 레벨만"),
});
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
  condition: objectSchema({
    kind: { type: "string", enum: [...CAPTURE_CONDITION_KINDS], description: "type=대상이 types 중 하나일 때 · firstTurn=전투 첫 차례에만 · turns=차례가 지날수록(차례마다 step 만큼, 상한 multiplier) · repeat=이미 도감에 있는 종에게" },
    multiplier: numberSchema(`조건이 맞을 때 포획 확률에 곱하는 배율 ${CAPTURE_CONDITION_MIN_MULTIPLIER}~${CAPTURE_CONDITION_MAX_MULTIPLIER}. 생략: type·repeat 3.5, firstTurn 5, turns 상한 4`),
    types: stringArraySchema("kind=type 필수. system.typeChart.types 값(최대 6개)"),
    step: numberSchema("kind=turns: 차례마다 늘어나는 배율(0.05~2, 기본 0.3)"),
  }, "조건부 볼(그물·퀵·타이머·리피트 볼). 볼 등급과 겹친다. gen1 전투 모델과 기본 모델 모두 적용."),
});
const enemyStatsSchema = objectSchema({ maxHp: integerSchema(), maxMp: integerSchema(), attack: integerSchema(), defense: integerSchema(), mind: integerSchema(), agility: integerSchema() });
const enemyRewardsSchema = objectSchema({ exp: integerSchema(), gold: integerSchema(), tp: integerSchema("기술 포인트. 승리 시 살아남은 파티원 전원이 트룹 합계를 받는다"), ap: integerSchema("마석 AP(FF6). 승리 시 살아남은 파티원 전원이 트룹 합계를 받아 장착한 마석의 apGrants 에 쌓는다. 1 이상"), dropItemId: stringSchema(), dropRatePercent: integerSchema(), drops: conditionalDropsSchema });
const enemyActionSwitchSchema = objectSchema({ enabled: booleanSchema(), switchId: stringSchema() });
const enemyActionSchema = objectSchema({
  skillId: stringSchema(),
  priority: integerSchema(),
  condition: combatConditionSchema,
  switchOnAfterAction: enemyActionSwitchSchema,
  switchOffAfterAction: enemyActionSwitchSchema,
  moveTo: objectSchema({ x: integerSchema("전투장 X 0~320"), y: integerSchema("전투장 Y 0~240") }, "이 행동 전에 이 좌표(트룹 members 좌표계)로 이동한다. 위치 범위기가 새 위치를 본다"),
  requiresPart: stringSchema("부위 행동: 이 태그의 부위(troop member partTag)가 쓰러지면 쓰지 않는다"),
});
const troopMemberSchema = objectSchema({
  enemyId: stringSchema(), x: integerSchema(), y: integerSchema(), hidden: booleanSchema(),
  partOf: integerSchema("다부위 적: 본체 멤버의 인덱스(0부터). 본체가 쓰러지면 이 부위도 쓰러진다"),
  partTag: stringSchema("부위 태그. 이 부위가 쓰러지면 본체 행동 중 requiresPart 가 같은 것이 막힌다"),
});
const damageTypeRatesSchema = objectSchema({
  physical: integerSchema("받는 물리(공격력 계열) 피해 % 0~1000. 100 보통, 0 무효"),
  magic: integerSchema("받는 마법(마력 계열) 피해 % 0~1000. 100 보통, 0 무효"),
  elements: { type: "object", description: "속성 예외 { 속성 id: % } — 맞은 기술의 속성이 여기 있으면 physical/magic 대신 이 값. 예 { thunder: 200 } = 번개는 물리든 마법이든 2배", additionalProperties: true },
}, "받는 피해 계열 %. 예: 마법 무효 용 { magic: 0 } · 기계 형태 { physical: 0, magic: 25, elements: { thunder: 200 } }");
const stateRuntimeEffectsSchema = objectSchema({
  restrictsAction: booleanSchema(),
  blocksSkillUse: booleanSchema(),
  hpDamagePercentPerTurn: numberSchema(),
  hpHealPercentPerTurn: numberSchema(),
  attackMultiplier: numberSchema(),
  defenseMultiplier: numberSchema(),
  agilityMultiplier: numberSchema(),
  removeOnBattleEnd: booleanSchema(),
  freezesGauge: booleanSchema("스톱 — ATB 게이지가 멈추고 행동하지 못한다"),
  physicalDefenseMultiplier: numberSchema("프로텍트 — 공격(attack) 계열 피해에만 곱하는 방어 배율(예 2 = 반감보다 단단)"),
  magicDefenseMultiplier: numberSchema("실드 — 마력(mind) 계열 피해에만 곱하는 방어 배율"),
  forcedAction: { type: "string", enum: ["attackRandom", "rage"], description: "attackRandom=버서크(명령 없이 무작위 상대 통상 공격), rage=폭주(폭주 기술이 정한 몬스터의 행동 표대로 자동 행동). 폭주 기본 상태 id state_rage" },
  grantSkillIds: stringArraySchema("트랜스·변신 — 이 상태인 동안만 전투 명령 목록에 더해지는 기술 id(최대 12). 리미트 기술(limitSkill)로 이 상태를 걸면 FF6 트랜스"),
  elementRates: { ...rateMapSchema, description: "이 상태인 동안 덮어쓸 속성 등급(속성 id → A~E)" },
  incapacitates: booleanSchema("석화처럼 전투 불능으로 친다 — 아군 전원이 쓰러졌거나 이 상태면 패배. 이 상태로는 행동하지 못한다"),
  damageToMpRate: numberSchema("받는 HP 피해 중 MP 에서 대신 깎는 비율 0~1(예 0.5 = 절반을 MP 로)"),
  counterChance: numberSchema("반격 % 0~100 — 물리 공격(통상·attack 계열)에 맞으면 이 확률로 통상 공격을 되돌린다. 반격끼리는 이어지지 않는다"),
  taunt: booleanSchema("도발 — 상대가 단일 대상을 고를 때 이 상태인 쪽을 먼저 노린다"),
  cover: booleanSchema("감싸기 — HP 1/4 이하인 아군을 노린 단일 물리 공격을 대신 맞는다"),
  evasionChance: numberSchema("회피 % 0~95 — 물리 공격(통상·attack 계열)의 명중을 이만큼 깎는다"),
  reflect: booleanSchema("리플렉 — 나를 노린 단일 대상 마법(mind 계열 피해·회복, 상태만 거는 support)을 시전자에게 한 번 튕긴다"),
  reraisePercent: numberSchema("리레이즈 % 1~100 — 쓰러지면 최대 HP 의 이 비율로 한 번 일어나고 상태는 사라진다(아군만)"),
  transformResourceId: stringSchema("변신 — 이 상태인 동안 전투 그림을 이 리소스 id 로 바꾼다. 아군은 9칸 시트 \"party-pixel-<칩>\"(예 party-pixel-monster4-5 이끼 골렘) 또는 전투 시트 id, 적은 몬스터 그림 id. 능력치는 같은 상태의 공격·방어·민첩 배율로. 풀리면 원래 그림. 빈 문자열이면 해제"),
  doomTurns: numberSchema("선고 1~9 — 걸린 뒤 자기 차례가 이만큼 오면 전투 불능. 상태를 풀면 멈춘다"),
  damageTypeRates: { ...damageTypeRatesSchema, description: "이 상태인 동안 받는 피해 계열 %를 적의 기본 damageTypeRates 대신 쓴다(갈아 끼움, 여러 상태면 큰 값). 예: 「관통상」 { magic: 300 } · 변신 기계 형태 { physical: 0, magic: 25, elements: { thunder: 200 } }(transformResourceId 와 함께)" },
  invertHealing: booleanSchema("좀비 — 이 상태인 동안 받는 HP 회복(회복 스킬·회복 아이템·재생)이 같은 양의 피해가 된다. 기본 상태 id state_zombie"),
  maxTurns: integerSchema("최대 지속 1~9 — 걸린 뒤 자기 턴이 이만큼 지나면 회복 굴림과 상관없이 풀린다(「독은 최대 3턴」)"),
});

const heldEffectSchema = objectSchema({
  kind: { type: "string", enum: [...HELD_ITEM_KINDS], description: "healBelow=HP 가 thresholdPercent% 이하가 되면 먹고 회복(1회용) · cureStatus=주요 상태이상이 되면 먹고 치료(1회용) · boostType=같은 type 기술 피해 percent% · endureOnce=가득 찬 HP 에서 쓰러질 피해를 HP 1 로 버팀(1회용) · regen=매 차례 말 최대 HP 의 percent% 회복" },
  thresholdPercent: integerSchema("healBelow: 1~100(기본 50)"),
  healPercent: integerSchema("healBelow: 최대 HP 의 이 %(0~100, 기본 30)"),
  healFlat: integerSchema("healBelow: 고정 회복량(0~999)"),
  status: { type: "string", enum: [...HELD_ITEM_STATUSES], description: "cureStatus: 고칠 상태(기본 any)" },
  type: stringSchema("boostType 필수. system.typeChart.types 값"),
  percent: integerSchema("boostType 101~200(기본 120) · regen 1~25(기본 6)"),
}, "지닌 도구 효과(포켓몬식). 파티 몬스터가 지니고 전투에서 발동한다. gen1 전투 모델에서만 작동. 이 필드를 주면 플레이어가 메뉴의 「도구」에서 몬스터에게 지닐 수 있다.");

const careProfileSchema = objectSchema({
  kind: { type: "string", enum: ["feed", "toy"], description: "feed=먹이 · toy=장난감. 둘 다 친밀도를 올린다(이상한 사탕·경험 사탕도 kind:\"feed\")" },
  friendshipDelta: integerSchema("친밀도 증감(음수 가능, 0 가능)"),
  expDelta: integerSchema("고정 경험치 +N(0 이상, 생략 가능)"),
  levelUp: integerSchema("이상한 사탕: 레벨을 이만큼(1~10) 즉시 올린다. 레벨 문턱까지 경험치가 채워지고 새 기술·진화가 이어진다. 상한 레벨 개체에는 쓸 수 없다"),
}, "몬스터 돌봄 아이템(파티 몬스터 1마리에게 메뉴에서 쓴다). type:\"special\" 일 때만 효과가 난다 — 다른 종류로 주면 special 로 바꾼다. 예: 이상한 사탕 {kind:\"feed\",friendshipDelta:0,levelUp:1}, 경험 사탕 {kind:\"feed\",friendshipDelta:1,expDelta:800}");

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
  ppRecovery: objectSchema({ flat: integerSchema(), percentMax: integerSchema() }, "몬스터가 배운 기술 각각의 PP 를 flat + 최대 PP×percentMax% 만큼 회복한다(에테르·엘릭서류). MP 회복과 별개. type:\"medicine\" 일 때만 효과가 난다"),
  onlyUsableInMenu: booleanSchema(),
  onlyEffectiveOnDeadActors: booleanSchema("true 면 쓰러진 대상에게만 쓴다 = 부활약(몬스터 게임: 쓰러진 파티 몬스터를 hpRecovery 만큼 되살린다). type:\"medicine\""),
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
  careProfile: careProfileSchema,
  heldEffect: heldEffectSchema,
  pocket: { type: "string", enum: ["items", "balls", "machines", "held", "key"], description: "몬스터 게임 가방 포켓을 직접 정한다(도구·볼·기술머신·지닌 도구·중요한 물건). 생략하면 captureProfile→볼, learnedSkillId→기술머신, heldEffect→지닌 도구, 쓸 곳 없는 아이템→중요한 물건, 나머지→도구로 자동 분류된다. 진화의 돌은 아이템을 만들고 종의 evolutions[].requires.itemId 로 가리키기만 하면 필드 메뉴에서 바로 쓴다(별도 필드 없음)" },
  repelSteps: integerSchema("벌레퇴치류: 쓰면 이 걸음 수(1~9999) 동안 야생 조우가 나오지 않는다. 필드 메뉴(가방)에서 쓰고 occasion 은 field, scope 는 none. 쓸 때 문장이 뜨고 걸음이 다하면 「효과가 사라졌다」 문장이 뜬다. 몬스터 수집(포켓몬류) 게임용"),
  repelBelowLead: booleanSchema("repelSteps 와 함께: true 면 파티 선두 몬스터보다 레벨이 낮은 야생만 막는다(포켓몬식). 생략 = 전부 막는다"),
  escapeTo: { type: "string", enum: ["entrance"], description: "탈출 로프류: entrance = 던전·동굴(맵 mapRole dungeon)에서 쓰면 마지막으로 들어온 입구 밖(없으면 시작 지점)으로 나간다. occasion 은 field, scope 는 none. 던전 밖에서는 「효과가 없다」, 전투 중에는 못 쓴다" },
}) as RecordSchema;

const enemyRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  speciesId: stringSchema(),
  monsterResourceId: stringSchema(),
  // Enemy.transparent 를 런타임·ensureMonsterGraphic 이 지킨다 — 스키마만 막고 있었다.
  transparent: booleanSchema("의도적으로 외형을 숨길 때만 true(그림 없이 저장). false 로 되돌리면 그림이 다시 필요하다."),
  battleScalePercent: integerSchema("전투 표시 크기(%). 10~300으로 제한, 기본 100."),
  lungeSpeedPercent: integerSchema("도트 측면 전투에서 아군에게 달려드는 속도(%). 25~300, 기본 100. 늑대·맹수처럼 날랜 적 120~160, 굼뜬 거인 70~90. 전역 기본 세기는 set_project_settings battle.staging.enemyLunge"),
  collapseEffect: {
    type: "string",
    enum: ["dissolve", "pixelBreak", "bossSink", "flash", "instant"],
    description: "쓰러지는 연출. dissolve 기본 소멸 · pixelBreak FF6 식 보랏빛 픽셀 분해(잡몹) · bossSink 떨며 땅속으로 가라앉음(보스) · flash 하얀 세 번 점멸 · instant 즉시 사라짐(환영·소환수).",
  },
  hideHp: booleanSchema("보스 HP 숨김 — true 면 전투에서 이 적의 HP 막대·숫자를 보이지 않는다(대상 선택 목록은 「HP ???」). 보스·중간 보스에"),
  damageTypeRates: damageTypeRatesSchema,
  criticalHit: objectSchema({ enabled: booleanSchema(), oneIn: integerSchema() }),
  attackOptions: objectSchema({ normalAttacksMiss: booleanSchema() }),
  skillIds: stringArraySchema(),
  level: integerSchema(),
  stats: enemyStatsSchema,
  rewards: enemyRewardsSchema,
  actions: arrayOf(enemyActionSchema),
  reactions: arrayOf(objectSchema({
    trigger: stringSchema("physical(공격 계열) | magic(마력 계열) | onDeath(쓰러질 때 최후의 일격, 전투당 1회) | 속성 id"),
    skillId: stringSchema("반격 스킬 id. 빈 문자열이면 통상 공격"),
    chance: integerSchema("발동 확률 0~100(생략 100)"),
  }), "반격: 피격 후 살아 있으면 차례 밖에서 skillId 를 쓴다(타격당 최대 1회, 게이지 유지). 빈 배열이면 해제"),
  stealItems: arrayOf(objectSchema({ itemId: stringSchema(), rate: integerSchema("훔치기 확률 0~100") }), "훔치기 표. 위에서부터 굴려 첫 성공 하나. 빈 배열이면 해제"),
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
  trainerSprite: objectSchema({
    front: stringSchema("트레이너 전투 그림(상대 앞모습): 번들 역할 id(boy·girl·fisher·hiker·bug_catcher·gym_rock·gym_water·scientist·punk·elder) 또는 업로드 그림 id"),
    back: stringSchema("내 뒷모습: 번들 역할 id(hero_m·hero_f) 또는 업로드 그림 id. 생략하면 기본 주인공 뒷모습"),
    throw: stringSchema("상대 볼 던지기 시트(업로드 그림 id, 선택)"),
    backThrow: stringSchema("내 볼 던지기 시트(업로드 그림 id, 선택)"),
  }, "트레이너 전투 인물 그림(몬스터 대치 전투의 소개·볼 던지기 연출). trainerBattle:true 일 때만 쓰인다. 생략하면 연출 없이 시작한다 — 몬스터 수집 장르 잠금이 켜져 있으면 이름·걷기 칩으로 근거가 확실한 번들 그림을 채운다."),
  previewBackgroundResourceId: stringSchema(BATTLE_BACKDROP_ID_HINT),
  backdropAnimation: objectSchema({
    scrollX: { type: "number", minimum: -400, maximum: 400, description: "가로 스크롤 px/초(양수 = 오른쪽)" },
    scrollY: { type: "number", minimum: -400, maximum: 400, description: "세로 스크롤 px/초(양수 = 아래)" },
    waveAmplitude: { type: "number", minimum: 0, maximum: 24, description: "물결 왜곡 진폭 px" },
    waveFrequency: { type: "number", minimum: 0, maximum: 8, description: "물결 흔들림 횟수/초" },
    paletteCycleSeconds: { type: "number", minimum: 0, maximum: 60, description: "색 순환 한 바퀴 초(0 = 끔)" },
  }, "움직이는 전투 배경(마더식) — 배경 그림 한 장을 움직인다. 0/생략 = 그 효과 끔. 도트 측면 전투(기본)에서는 겹 배경에 가려 보이지 않는다 — 몬스터 대치에서만 보인다. 도트 측면 분위기는 backdropLayers 를 쓴다"),
  backdropLayers: arrayOf(objectSchema({
    preset: { type: "string", enum: ["fog", "clouds", "mist", "rain", "snow", "embers", "stars", "lightRays", "glow", "night", "smoke"], description: "그림 없이 그리는 겹. fog 안개 · clouds 흐르는 구름 · mist 땅안개 · rain 비 · snow 눈 · embers 불티(더하기) · stars 별 · lightRays 빛줄기 · glow 중앙 빛무리(정지·화면 가운데 청백색 빛, 수정·마법진 뒤) · night 밤(정지·곱하기로 남색, 밤 맵의 전투) · smoke 잿빛 연기(곱하기로 어둡게, 불탄 땅)" },
    resourceId: stringSchema("바둑판으로 깔 그림 리소스(투명 PNG). 주면 preset 보다 먼저"),
    front: booleanSchema("true = 배틀러·이펙트 앞(앞 덤불·안개 장막, 불투명도 50 이하 권장). 생략 = 배경 바로 위"),
    scrollX: { type: "number", minimum: -1200, maximum: 1200, description: "가로 흐름 px/초. 생략 = 프리셋 기본(구름 22·비 -180)" },
    scrollY: { type: "number", minimum: -1200, maximum: 1200, description: "세로 흐름 px/초(양수 = 아래). 생략 = 프리셋 기본(비 900·눈 60·불티 -50)" },
    opacity: { type: "number", minimum: 0, maximum: 100, description: "불투명도 %. 생략 = 프리셋 기본" },
    blendMode: { type: "string", enum: ["normal", "add", "screen", "multiply"], description: "겹치기. 생략 = 프리셋 기본(불티 add·별/빛줄기 screen)" },
  }, "배경 겹 하나")),
  battleFlow: { type: "string", enum: ["gauge", "strict"] },
  activeSlots: integerSchema(),
  teamSwapCost: { type: "string", enum: ["free", "gauge", "turn"], description: "이 적 그룹 전투만의 팀 교대 비용(set_project_settings battle.teams 가 있을 때). free = 들어온 팀 바로 행동 · gauge = 게이지 0(기본) · turn = 적이 한 번 행동할 때까지 쉼. 생략 = 시스템 설정" },
  // battleEventPages 는 여기서 받지 않는다 — 자유 객체(additionalProperties:true)로 통과시키면
  // 조건 kind 오타·빈 commands·무한 반복이 무검증으로 저장된다. upsert_troop_battle_page /
  // author_boss_phases 가 페이지 단위로 검증해서 쓴다(아래 run 의 리다이렉트 참고).
}) as RecordSchema;

const monsterSpeciesGraphicSchema = objectSchema({
  monsterResourceId: stringSchema(),
  // MonsterSpeciesGraphic.transparent 도 ensureMonsterGraphic 이 지킨다(의도적 숨김).
  transparent: booleanSchema("의도적으로 외형을 숨길 때만 true(그림 없이 저장)."),
  backResourceId: stringSchema("후면 전투용 몬스터 리소스. 생략하면 정면 그림을 사용합니다."),
  fieldCharsetId: stringSchema("동행 캐릭터셋 리소스. fieldGraphic이 있으면 그 설정을 우선합니다."),
  fieldGraphic: objectSchema({
    appearanceId: stringSchema(),
    sprite: objectSchema({
      type: { type: "string", enum: ["bundled", "uploaded"] },
      id: stringSchema("등록된 필드 그림 리소스 ID"),
    }),
    direction: { type: "string", enum: ["down", "left", "right", "up"] },
    pattern: integerSchema(),
    transparent: booleanSchema(),
    scale: { type: "number", minimum: CHARACTER_SCALE_MIN, maximum: CHARACTER_SCALE_MAX },
    scaleMode: { type: "string", enum: ["auto", "manual"] },
  }, "동행용 EventPageGraphic. 기존 종은 {scale:0.5}처럼 부분 수정해도 sprite와 나머지 설정을 보존합니다. 전투 그림에는 영향을 주지 않습니다."),
});

export const monsterAbilitySchema = objectSchema({
  name: stringSchema("특성 이름(최대 20자). 원작 특성 이름을 그대로 쓰지 말고 게임 고유 이름으로"),
  description: stringSchema("한 줄 설명. 생략하면 효과에서 자동 생성"),
  kind: { type: "string", enum: [...MONSTER_ABILITY_KINDS], description: "immuneType=타입 기술 무효(healPercent 있으면 흡수 회복) · resistType=타입 피해 percent% · boostLowHp=HP 1/3 이하에서 같은 타입 기술 percent% · immuneStatus=상태 면역 · contactStatus=물리 피해를 받으면 percent% 확률로 공격자에게 status · statMultiplier=능력 percent% · endure=가득 찬 HP 에서 한 번 버티기" },
  type: stringSchema("immuneType/resistType/boostLowHp 필수. system.typeChart.types 값"),
  status: { type: "string", enum: [...MONSTER_ABILITY_STATUSES], description: "immuneStatus/contactStatus 필수" },
  stat: { type: "string", enum: [...MONSTER_ABILITY_STATS], description: "statMultiplier 필수. attack=물리 공격, defense=물리 방어, mind=특수 공격·방어" },
  percent: integerSchema("resistType 0~99(기본 50) · boostLowHp 101~400(기본 150) · contactStatus 확률 1~100(기본 30) · statMultiplier 25~400(기본 150)"),
  healPercent: integerSchema("immuneType 전용: 막으면서 최대 HP 의 이 %(1~100)를 회복. 0/생략=그냥 무효"),
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
  machineSkillIds: stringArraySchema("기술머신·비전머신(learnedSkillId 아이템)으로 가르칠 수 있는 기술 id. 비우면 제한 없음(모든 종이 배운다). 값이 있으면 이 기술만 — 예: 파도타기는 물 종만"),
  evolutions: arrayOf(monsterEvolutionSchema),
  ability: monsterAbilitySchema,
  evYield: objectSchema({
    hp: integerSchema("0~3"), atk: integerSchema("0~3"), def: integerSchema("0~3"), spd: integerSchema("0~3 (스피드)"),
  }, "노력치 보상(system.monsterStatRules.evs 가 켜진 게임에서만 쓰인다): 이 종을 쓰러뜨리면 승리한 참전 몬스터가 받는 노력치. 종목당 0~3, 합계 3 이하로 잘린다. 비우면 없음. 원작처럼 약한 종이 낮은 값을 주는 정도로만 — 능력치는 +floor(EV/4)라 255 가 한계다."),
  dexNote: stringSchema("도감 설명 한두 문장(200자 이내). 원정 정의(monsterCampaign) 없는 수집 게임의 도감에 나온다 — 있으면 원정 노트가 우선"),
  genderRatio: numberSchema("암컷 비율 0~1(0=수컷만, 0.5=반반, 1=암컷만). 생략하면 무성 — 성별 표시 없음. 받는 순간 개체 번호에서 결정적으로 정해진다"),
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
  battleCharacterResourceId: stringSchema("측면 전투 도트 시트 id(charset-battler-* · party-pixel-* 등). 빈 문자열 \"\" 이면 지운다 — 전투 시트가 없는 배우는 자기 걷기 칩(characterResourceId·characterIndex) 한 칸으로 측면 전투에 선다. 기본 주인공(actor_hero)을 현대 교복 칩 같은 다른 걷기 칩으로 바꿨다면 물려받은 전투 시트(Actor1 검사)를 \"\" 로 지워야 전투에서도 같은 인물이 보인다."),
  battleScalePercent: integerSchema("측면 전투 표시 크기(%). 50~300, 기본 100. 파티원 몬스터 도트 시트(party-pixel-*)에 적용 — 마왕처럼 사람보다 큰 파티원."),
  loadoutSlots: { type: "integer", minimum: 0, maximum: 12, description: "스킬 장착 칸 수(0~12). 0 = 장착 제한 없음(배운 스킬 전부 사용). 1 이상이면 ESC 메뉴 스킬 장착 화면에서 고른 스킬만 전투에서 쓴다. 이벤트에서 m2 「메뉴 화면 열기」 screen:\"skills\" 로 그 화면을 바로 열 수 있다." },
  critical: objectSchema({ enabled: booleanSchema(), chanceDenominator: integerSchema() }),
  parameterCurves: parameterCurvesSchema,
  expCurve: expCurveSchema,
  initialEquipment: actorInitialEquipmentSchema,
  unarmedAnimationId: stringSchema(),
  battleMotion: objectSchema({style:{type:"string",enum:[...CHARACTER_MOTION_STYLES]},anticipation:{type:"number",minimum:0.4,maximum:2},travel:{type:"number",minimum:0.4,maximum:2},recovery:{type:"number",minimum:0.4,maximum:2},jump:{type:"number",minimum:0.4,maximum:2},reach:{type:"number",minimum:-20,maximum:24},recoil:{type:"number",minimum:0,maximum:2}}),
  options: actorOptionsSchema,
  learnedSkills: arrayOf(actorLearnedSkillSchema),
  skillIds: stringArraySchema("legacy alias for learnedSkills"),
  stateRates: rateMapSchema,
  elementRates: rateMapSchema,
  battleCommandIds: stringArraySchema("이 배우만 쓰는 전투 명령 메뉴(RM2003 배우별 명령). database.battleCommands 또는 직업 battleCommands 의 id 를 메뉴 순서대로, 7개까지. 빈 배열 = 직업 명령을 그대로"),
}) as RecordSchema;

const skillRecordSchema = objectSchema({
  ...authoredSkillProperties,
  id: stringSchema(),
  name: stringSchema(),
  scope: {
    type: "string",
    enum: ["self", "ally", "allAllies", "enemy", "allEnemies"],
  },
  power: integerSchema(),
  animationId: stringSchema(),
  description: stringSchema(),
  type: { type: "string", enum: ["normal", "teleport", "escape", "switch"] },
  mpCost: recoverySchema,
  successRate: integerSchema(),
  variance: integerSchema(),
  hitRate: integerSchema(),
  effect: objectSchema({
    kind: {
      type: "string",
      enum: [
        "damage",
        "healing",
        "support",
        "switch",
        "steal",
        "scan",
        "learnEnemySkill",
        "randomSkillFrom",
        "sketch",
        "rage",
        "shuffleParty",
        "forceSwitch",
      ],
      description:
        "steal=적 stealItems 훔치기, scan=라이브라, learnEnemySkill=청마법 습득, randomSkillFrom=skillIds 중 무작위, sketch=대상 적의 기술 하나를 그려 쓰기(렐름), rage=몬스터 모습으로 폭주해 전투 끝까지 자동 행동(가우; 승리 때 쓰러뜨린 몬스터가 목록에 쌓이고 enemyIds 로 고정도 가능), shuffleParty=대상 편 활성 배우의 자리·열 섞기(적 기술용), forceSwitch=대상 활성 배우를 살아 있는 예비 배우와 강제 교대(적 기술용)",
    },
    statistic: stringSchema(),
    affects: stringSchema(),
    switchId: stringSchema(),
    skillIds: stringArraySchema("randomSkillFrom 후보 기술 id"),
    enemyIds: stringArraySchema("rage 로 고정할 몬스터(적) id. 비우면 승리 때 모은 목록에서 무작위"),
  }),
  elementId: stringSchema(),
  stateEffects: arrayOf(stateEffectSchema),
  statStageEffects: arrayOf(statStageEffectSchema),
  weather: objectSchema({
    kind: { type: "string", enum: [...SKILL_WEATHER_KINDS], description: "sun=쾌청(불 기술 ×1.5·물 ×0.5) · rain=비(물 ×1.5·불 ×0.5) · sandstorm=모래바람(차례 말 바위·땅·강철 외 최대 HP 1/16 피해) · hail=싸라기눈(차례 말 얼음 외 1/16 피해)" },
    turns: integerSchema(`지속 차례 ${SKILL_WEATHER_MIN_TURNS}~${SKILL_WEATHER_MAX_TURNS}. 생략 = 5`),
  }, "날씨 기술(포켓몬식, gen1 전투 모델만): 명중하면 전투 날씨를 바꾼다. 이미 같은 날씨면 실패. 전투 한 번 동안만 유지. 보통 scope self 의 support 기술(effect {kind:\"support\"})에 붙인다."),
  maxPp: integerSchema("Gen1 기술별 최대 PP. 1~99"),
  gen1CriticalRate: { type: "string", enum: ["normal", "high"] },
  movePriority: numberSchema(
    "기술 우선도 -7~7 (strict 턴제에서 속도보다 먼저 비교, 퀵어택=+1)",
  ),
  fieldCommonEventId: {
    type: "string",
    description:
      "필드 능력: 메뉴에서 쓰면 이 공통 이벤트를 실행(정면 이벤트 id 는 문자열 변수 fieldAbilityTarget, 좌표는 변수 fieldAbilityX/Y). 빈 문자열이면 해제",
  },
  unforgettable: { type: "boolean", description: "잊을 수 없는 기술(비전머신 HM): 몬스터의 기술 교체 후보에서 빠진다. false 면 해제. 필드 기술(절단·파도타기)에 쓴다" },
  comboActorIds: stringArraySchema(
    "연계기(듀얼·트리플·4인 테크) 참가 배우 2~4명. 전원이 참전·생존·준비 상태여야 메뉴에 열리고, 각자 mpCost 와 턴을 소비한다. 멤버는 따로 배우지 않아도 된다. 빈 배열이면 해제",
  ),
  comboRequires: {
    type: "array",
    description:
      "연계기 해금 조건: [{actorId, skillId}] — 그 배우가 그 기술을 배워야 연계기가 메뉴에 열린다(CT 식: 개구리가 베기·마법사가 불꽃을 알아야 합체기). actorId 는 comboActorIds 안의 배우여야 한다. 빈 배열이면 조건 해제",
    items: objectSchema({ actorId: { type: "string" }, skillId: { type: "string" } }, "{actorId, skillId} 두 키만"),
  },
  comboCombinedStats: {
    type: "boolean",
    description: "true 면 피해·치유의 공격력·마력이 연계 참가자 전원의 합이다(합체기는 power 를 낮게). 기본 false = 시전자 능력치",
  },
  comboSwitchId: {
    type: "string",
    description: "연계기가 발동하면 켜지는 스위치 id(전투 이벤트 페이지 조건·이후 이야기 분기). 없는 스위치는 자동 등록된다. 빈 문자열이면 해제",
  },
  comboStaging: objectSchema(
    {
      tint: { type: "string", description: "번쩍임·오라·제목 색 #rrggbb(생략 = 속성 색)" },
      shake: { type: "string", enum: ["none", "light", "heavy"], description: "착탄 흔들림(생략 = 셋 이상 heavy · 듀얼 light)" },
      slowMo: booleanSchema("착탄 순간 느린 화면(생략 = 켜기)"),
      kicker: { type: "string", description: "제목 카드 위 작은 글(예: 「듀얼 테크」). 생략 = 인원수로" },
      partners: { type: "string", enum: ["auto", "rush", "cast", "ranged"], description: "시전자 말고 다른 참가자 동작: rush 달려가 베기 · cast 반 걸음 나와 시전 · ranged 쏘기 · auto(기본) 요구 기술로" },
    },
    "연계기 연출(컷인 얼굴 교차 → 참가자별 빛 → 합쳐진 마무리 → 제목 카드). 전역 세기는 set_project_settings battle.staging. 해제 = null",
  ),
  comboMpCosts: {
    type: "array",
    description: "연계기 비용 나누기: [{actorId, mp}] — 참가자별 MP 고정 몫(주 시전자 4·보조 8 처럼). 목록에 없는 참가자는 mpCost 를 낸다. actorId 는 comboActorIds 안의 배우. 빈 배열이면 해제",
    items: objectSchema({ actorId: { type: "string" }, mp: integerSchema("0~9999") }, "{actorId, mp} 두 키만"),
  },
  exploitStates: objectSchema(
    {
      stateIds: stringArraySchema("노리는 상태 id(1~8). 대상이 이 중 하나에 걸려 있으면 보너스"),
      bonusPercent: integerSchema("피해 +N% (1~300)"),
      consume: booleanSchema("true 면 맞힌 순간 그 상태를 풀어 버린다(얼어붙은 적을 깨뜨림·잠든 적을 깨움)"),
    },
    "약점 공략(준비 → 마무리 콤보): 대상이 stateIds 중 하나에 걸려 있으면 피해 +bonusPercent%. 숫자 아래 「공략!」 꼬리표. 둔화를 거는 기술 + 둔화 대상 +50% 기술처럼 동료끼리 짝을 만든다. 해제 = null",
  ),
  area: objectSchema(
    {
      shape: { type: "string", enum: ["circle", "line"] },
      radius: numberSchema(
        "전투장 픽셀(>0). circle=주 대상에서 거리, line=주 대상과 세로 차 ≤ radius/2 인 가로 띠",
      ),
    },
    "위치 범위기. scope enemy/ally 에서 주 대상 둘레의 같은 편도 맞힌다",
  ),
  resource2Cost: integerSchema(
    "제2 자원 「기력」 소모량(system.resource2.enabled 일 때만). 0 이면 없음",
  ),
  limitSkill: booleanSchema(
    "리미트 기술 — 리미트 게이지가 가득 찼을 때만 쓰고 쓰면 비운다(system.limitGauge.enabled 일 때만)",
  ),
  partyGaugeCost: integerSchema(
    "추격 연계기 — 파티 공용 게이지 소모량(system.partyGauge.enabled 일 때만). 0 이면 없음",
  ),
  hpCostPercent: integerSchema(
    "시전 대가로 시전자가 최대 HP 의 N% 를 잃는다(0~100, 0=없음, HP 는 1 밑으로 안 내려감). 희생·폭발계 기술의 대가",
  ),
  weaponAffinity: objectSchema({ elementIds: stringArraySchema("무기 계열(장비 attackElementIds — sword·spear·bow·gun·hit 등). 비우면 기술 자신의 elementId"), bonusPercent: integerSchema("그 계열 무기를 들고 쓰면 피해·회복 +%") }, "무기 공명: 「검을 들고 쓰면 위력 +20%」"),
  drainPercent: integerSchema(
    "준 피해의 N% 만큼 시전자가 회복(0~100, 0=없음, affects mp 면 MP). 흡수·흡혈계 기술. 피해를 주는 기술에만 의미가 있다",
  ),
  recoilPercent: integerSchema(
    "반동 0~100(0=없음): 준 피해의 N% 를 시전자도 입는다(피해가 1 이상일 때만, 최소 1, 타마다). 몸통박치기·이판사판처럼 센 기술의 대가. 피해를 주는 기술에만 의미가 있다",
  ),
  fixedDamage: objectSchema(
    { mode: { type: "string", enum: ["level", "amount"] }, amount: integerSchema("mode=amount 일 때의 고정 피해(1~999)") },
    "고정 피해(gen1 전투 모델): 능력치·급소·날씨와 상관없이 정해진 양만 준다. {mode:'level'} = 시전자 레벨만큼(지구던지기·나이트헤드), {mode:'amount', amount:40} = 고정값(용의분노). 명중 판정과 타입 무효(상성 0 배)는 그대로. 해제 = null",
  ),
  multiHit: objectSchema(
    { min: integerSchema("최소 타수 2~5"), max: integerSchema("최대 타수 min~5") },
    "연속 기술: 한 번 쓰면 min~max 번 무작위로 맞힌다(2~5 면 2·3번 각 3/8, 4·5번 각 1/8). hitSequence 를 이미 줬으면 그쪽이 이긴다. 대상이 쓰러지면 멈추고 끝에 「N번 맞았다!」. 해제 = null",
  ),
  flinchChance: integerSchema(
    "풀죽음 0~100(0=없음): 피해를 주면 이 확률로 대상이 이번 라운드의 자기 차례를 잃는다(대상이 아직 움직이지 않았을 때만, strict 턴제). 선공 기술(movePriority)과 짝으로 쓴다",
  ),
  gaugeShift: integerSchema(
    "게이지 밀기 -100~100(0=없음). 명중한 대상의 ATB 행동 게이지를 옮긴다 — 음수 = 늦추기(시간 화살·발 묶기), 양수 = 아군을 앞당기기(재촉). 타마다 적용. ATB(gauge) 전투 전용",
  ),
  battleGimmick: {
    type: "object",
    description:
      "턴 전투 기믹. pattern은 list_retro_choreographies에서 고른 32 동작 id. durationTurns(1~6), markKey, maxStacks(1~9), consumeMarks, requiredMark, followOnHit, allyActorId, elementId, resourceId, radius(16~800), triggerChance(0~100), powerMultiplier(.1~3), killRefundPercent(0~100). 피해는 전투 규칙만 계산한다.",
    properties: {
      pattern: { type: "string", enum: [...BATTLE_MOTION_PATTERNS] },
      durationTurns: { type: "number" },
      markKey: { type: "string" },
      maxStacks: { type: "number" },
      consumeMarks: { type: "boolean" },
      requiredMark: { type: "boolean" },
      followOnHit: { type: "boolean" },
      allyActorId: { type: "string" },
      elementId: { type: "string" },
      resourceId: { type: "string" },
      radius: { type: "number" },
      triggerChance: { type: "number" },
      powerMultiplier: { type: "number" },
      killRefundPercent: { type: "number" },
    },
    required: ["pattern"],
  },
  chargeTurns: integerSchema(
    "힘 모으기 1~3(0=바로 발동). 고른 차례엔 「…을 준비한다!」 예고만 하고 자기 차례가 N 번 더 오면 발동한다. 적이 쓰면 보스 대기술 예고. 한 차례를 버리므로 위력을 1.6~1.8배로",
  ),
  chargeBreak: objectSchema(
    {
      damage: integerSchema("모으는 동안 받은 HP 피해 누계가 이 값 이상이면 끊긴다(예 300)"),
      elementIds: stringArraySchema("이 속성 id 기술에 맞으면 끊긴다(database.elements id, 1~8)"),
      stateIds: stringArraySchema("이 상태가 걸리면 끊긴다(상태 id 1~8, 예 기절·침묵)"),
      message: stringSchema("끊겼을 때 시전자가 하는 한 줄(예 「송신 실패」). 생략 = 「…이 끊겼다!」 시스템 문장만"),
      stagger: booleanSchema("끊긴 뒤 다음 자기 차례 하나를 휘청거려 쉰다(적만, 기본 true). false = 바로 다시 행동"),
    },
    "충전 끊기(chargeTurns 가 있을 때만): 모으는 동안 damage 이상 맞거나 elementIds 속성·stateIds 상태를 맞으면 모으던 기술이 취소된다(조건은 「또는」). 모으는 중엔 머리 위 「기술 · 남은 차례」 표식, 끊기면 「끊김!」 글자 + 시스템 문장 + message. simulate_battle 의 chargeBreaks 로 끊긴 횟수를 확인한다. 해제 = null",
  ),
  summonResourceId: stringSchema(
    '소환 그림(retro2003 도트 연출): 파티원 도트 시트 id "party-pixel-<칩>"(예 party-pixel-monster2-4 흙 골렘, party-pixel-monster3-6 업화, party-pixel-animal-7 사자). 시전하면 그 몬스터가 시전자 앞에 나타나 대상에게 달려가 첫 타에 맞춰 친다. 그림만 — 위력·타수·상태는 이 스킬 값. 시전자 motion 은 cast 가 어울린다. 빈 문자열이면 해제',
  ),
  retroChoreographyId: stringSchema(
    "retro2003 측면 전투에서 이 스킬이 보여 줄 도트 연출을 계약 id 로 빌린다(예: skill_knight_slash). 새·복제 스킬은 이걸 안 주면 기본 베기/불꽃으로 보인다. 후보는 list_retro_choreographies 로 찾는다. 빈 문자열이면 해제",
  ),
}) as RecordSchema;

const equipmentRecordSchema = objectSchema({
  battleMotionStyle: {type:"string",enum:[...CHARACTER_MOTION_STYLES]},
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
    autoRevive: integerSchema("전투 불능 시 최대 HP 의 이 %(1~100)로 한 번 부활(전투당 1회). 0 이면 해제"),
  }),
  elementalDefenseIds: stringArraySchema(),
  stateDefenseIds: stringArraySchema(),
  stateDefenseMode: { type: "string", enum: ["resist", "inflict"] },
  stateResistanceChance: integerSchema(),
  damageDealtPercent: integerSchema("주는 피해 ±% (-90~300, 물리·마법 공통). 30 = 피해 +30%. 여러 장비면 더한다"),
  damageTakenPercent: integerSchema("받는 피해 ±% (-90~300). -20 = 받는 피해 20% 감소"),
  grantsSkillIds: stringArraySchema("장착 중에만 쓸 수 있는 스킬 id. 배우지 않아도 전투 스킬 목록에 뜬다"),
  apGrants: arrayOf(objectSchema({
    skillId: stringSchema("영구 습득할 스킬 id(먼저 upsert_skill 로 만든다)"),
    ap: integerSchema("필요 AP 1~99999"),
  }), "마석 AP 영구 습득(FF6): 장착한 배우가 전투 승리마다 적 rewards.ap 합계×apRate% 를 이 항목들에 쌓고, 필요 AP 를 채운 스킬을 장비를 벗어도 남도록 배운다(PlaySession.actorSkillIds·learnedViaAp). grantsSkillIds(장착 중에만 사용)와 따로다. 빈 배열이면 해제"),
  apRate: integerSchema("AP 습득률 %(1~1000, 기본 100). 이 마석의 apGrants 에만 곱한다. 100 이면 해제"),
  levelUpBonus: objectSchema({
    maxHpPercent: integerSchema("레벨업마다 곡선 최대 HP 의 N%(1~100) 영구 가산"),
    maxMpPercent: integerSchema("레벨업마다 곡선 최대 MP 의 N%(1~100) 영구 가산"),
    attack: integerSchema("레벨업마다 공격 ±(-99~99)"),
    defense: integerSchema("레벨업마다 방어 ±"),
    mind: integerSchema("레벨업마다 마력 ±"),
    agility: integerSchema("레벨업마다 민첩 ±"),
  }, "마석 레벨업 보너스(FF6): 장착한 배우가 레벨이 오를 때마다 영구 능력치 보너스를 받는다(actorParamBonuses). 해제는 각 칸을 0 으로"),
  grantsCommand: objectSchema({
    id: stringSchema("명령 id(클래스 명령과 겹치지 않게)"),
    name: stringSchema("메뉴에 보일 이름"),
    kind: { type: "string", enum: ["attack", "skill", "skillSubset", "defend", "item", "escape"] },
    skillSubsetName: stringSchema(),
    skillId: stringSchema("kind:skill 이면 이 스킬 하나를 바로 쓰는 명령"),
  }, "장착 중에만 전투 명령 메뉴에 붙는 명령"),
}) as RecordSchema;

const classRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  options: actorOptionsSchema,
  animationId: stringSchema(),
  skillIds: stringArraySchema(),
  battleCommands: arrayOf(objectSchema({ id: stringSchema(), name: stringSchema(), kind: stringSchema("attack·skill·skillSubset·defend·item·capture·escape·switch·commonEvent"), skillSubsetName: stringSchema(), skillId: stringSchema(), commonEventId: stringSchema("kind:commonEvent 일 때 실행할 공통 이벤트 id") })),
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
  gen1MajorStatus: { type: "string", enum: ["poison", "toxic", "burn", "sleep", "freeze", "paralysis"] },
  volatileStatus: { type: "string", enum: ["confusion"] },
  removalCondition: stringSchema(),
  clearOnBattleEnd: booleanSchema("true = 전투가 끝나면 풀린다(독·수면을 전투 밖으로 끌고 가지 않는 게임), false = 남는다. 생략 = set_project_settings battle.clearStatesAfterBattle 을 따른다"),
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
  emotion: objectSchema({
    family: stringSchema("감정 계열 이름(예: 기쁨·분노·슬픔). 같은 계열을 다시 걸면 단계가 오른다"),
    tier: integerSchema("단계 1~9"),
  }, "감정 상태. 배틀러는 감정을 하나만 가진다. 계열 상성은 set_battle_settings 의 emotionCycle"),
  fieldStepInterval: integerSchema(),
  releaseAfterSteps: integerSchema(),
  fieldStepCanKill: { type: "boolean" },
  specialFlags: stringArraySchema(),
  lockedParameters: stringArraySchema(),
  runtimeEffects: stateRuntimeEffectsSchema,
  disablesEquipSlot: stringSchema("부위 손실: 이 상태인 동안 이 장비 슬롯(weapon/shield/armor/helmet/accessory)의 능력치 보너스를 잃는다"),
  battleAura: stringSchema("전투 지속 오라: 상태가 걸려 있는 동안 몸 위에 남는 표시. freeze-grey|berserk-pulse|shield-shimmer|wet-drip|poison-bubble|dark-fog|petrify-still|regen-sparkle|sleep-zzz(Z 가 떠오름)|paralyze-spark(전기 불꽃)|silence-mute(말풍선 …)|confuse-stars(머리 위 별)|charm-heart(하트)|burn-ember(불티), none=끔. 비우면 기본 상태(독·스톱·버서크·프로텍트·실드·젖음·암흑·석화·재생·수면·마비·침묵·혼란·매혹·화상)와 몬스터 주 상태는 자동"),
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
      const recordLabel = label.split(/[.[]/u)[0]!;
      const near = closestDeclaredKey(key, allowed);
      const why = DB_FIELD_REJECT_HINTS[recordLabel]?.[key];
      throw new ToolError(
        `${label}.${key}는 허용되지 않는 필드입니다.${near ? ` '${key}' 는 '${label.includes(".") ? label.slice(0, label.lastIndexOf(".") + 1) : `${label}.`}${near}' 입니다.` : ""}${why ? ` ${why}.` : ""} 허용 필드: ${allowed.join(", ")}. 최소 예시: ${JSON.stringify(example)}`,
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
  missingHint?: (key: string) => string | undefined,
): T | (Partial<T> & Pick<T, "id" | "name">) {
  const base = requireRecordId(patch, label);
  rejectUnknownFields(patch, schema, label, { [label]: example });
  const existing = list.find((entry) => entry.id === base.id);
  if (!existing) {
    for (const key of requiredForNew) {
      if ((patch as Record<string, unknown>)[key] === undefined) {
        const hint = missingHint?.(key);
        throw new ToolError(`${label}.${key}가 신규 레코드에 필요합니다.${hint ? ` ${hint}` : ""} 최소 예시: ${JSON.stringify({ [label]: example })}`, { code: "missing-db-field" });
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
 * 아직 없는 배우·직업 id 때문에 장비 커밋 전체가 거부되지 않게 한다.
 *
 * 2026-09-24 JRPG 도그푸딩: 사제 지팡이·실크 로브가 equippableActorIds 에 곧 만들 actor_toma·actor_mira 를
 * 넣어 「actor does not exist」로 거부됐다. 스탯·가격·직업 제한은 저장하고, 없는 id 만 뺀 뒤 경고한다.
 */
function dropUnknownEquipmentRestrictions(
  project: Project,
  record: { id: string; equippableActorIds: string[]; equippableClassIds: string[] },
  warnings: string[],
): void {
  const actorIds = new Set(project.database.actors.map((actor) => actor.id));
  const classIds = new Set(project.database.classes.map((entry) => entry.id));
  const droppedActors = record.equippableActorIds.filter((id) => !actorIds.has(id));
  const droppedClasses = record.equippableClassIds.filter((id) => !classIds.has(id));
  if (droppedActors.length === 0 && droppedClasses.length === 0) return;
  record.equippableActorIds = record.equippableActorIds.filter((id) => actorIds.has(id));
  record.equippableClassIds = record.equippableClassIds.filter((id) => classIds.has(id));
  const dropped = [
    droppedActors.length ? `equippableActorIds ${droppedActors.join(", ")}` : "",
    droppedClasses.length ? `equippableClassIds ${droppedClasses.join(", ")}` : "",
  ].filter(Boolean).join(", ");
  const kept = [
    record.equippableActorIds.length ? `배우 ${record.equippableActorIds.join(", ")}` : "",
    record.equippableClassIds.length ? `직업 ${record.equippableClassIds.join(", ")}` : "",
  ].filter(Boolean).join(" · ");
  const actorHint = [...actorIds].slice(0, 6).join(", ") || "(없음)";
  const classHint = [...classIds].slice(0, 6).join(", ") || "(없음)";
  warnings.push(
    `equipment ${record.id}: 아직 없는 착용 제한을 빼고 저장했습니다 (${dropped}). ` +
      (kept
        ? `남은 제한: ${kept}.`
        : "남은 제한이 없어 지금은 아무도 착용할 수 없습니다. 배우·직업을 만든 뒤 equippableActorIds·equippableClassIds 를 다시 지정하세요.") +
      ` 있는 id 예: 배우 ${actorHint}, 직업 ${classHint}.`,
  );
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

/**
 * 없는 iconResourceId 하나로 아이템·장비 커밋 전체가 거부되지 않게 한다.
 *
 * 2026-09-24 꿈 세계 도그푸딩: 모델이 그림 id 대신 비슷한 기본 아이템 id(item_candle·item_quill·item_bell)를
 * iconResourceId 로 보내 upsert_item/upsert_equipment 6건이 연속 「참조 검증 실패」로 거부됐다.
 * 같은 id 의 기존 아이템·장비가 있으면 그 레코드의 그림을 쓰고, 아니면 그림만 비우고 저장한다.
 */
/**
 * switchId 가 있는데 종류가 switch 가 아니면 메뉴에서 스위치가 켜지지 않는다.
 *
 * 2026-09-24 꿈 세계 도그푸딩: 볼 꼬집기를 type:"special" + switchId 로 저장했다.
 * 사용해도 스위치가 안 켜져, 출구 없는 꿈 맵에서 깨어나지 못했다.
 * 포획·돌봄·스킬이 있는 특수 아이템은 종류를 바꾸지 않고 경고만 남긴다.
 */
function coerceSwitchItem(record: { type?: string; switchId?: string; captureProfile?: unknown; careProfile?: unknown; skillId?: string; activateSkillId?: string }, warnings: string[]): void {
  const switchId = record.switchId?.trim();
  if (!switchId || record.type === "switch") return;
  if (record.captureProfile || record.careProfile || record.skillId || record.activateSkillId) {
    warnings.push(`switchId "${switchId}" 는 종류가 ${record.type} 이라 사용해도 켜지지 않습니다. 스위치만 켜는 아이템은 type:"switch" 로 두세요.`);
    return;
  }
  record.type = "switch";
  warnings.push(`종류를 switch 로 바꿨습니다 — switchId "${switchId}" 는 type:"switch" 일 때만 메뉴에서 켜집니다.`);
}

/** careProfile 을 줬는데 정규화가 버렸으면(kind 가 feed/toy 가 아님) 거절한다 — 조용히 효과 없는 사탕이 되지 않게. */
function validateItemCareProfile(raw: unknown, record: ItemRecord): void {
  if (raw === undefined || raw === null || record.careProfile) return;
  throw new ToolError(`careProfile 이 올바르지 않아 저장하지 않았습니다 — kind(feed|toy)가 필요합니다. 이상한 사탕은 {kind:"feed",friendshipDelta:0,levelUp:1}.`, { code: "invalid-care-profile" });
}

/**
 * 몬스터 필드 아이템이 효과 없는 종류로 저장되지 않게 한다. careProfile 은 special, ppRecovery 는 medicine 일 때만 실행된다
 * (activeItemEffects). 쓸 수 없는 때(battle/never)로 저장된 돌봄 아이템도 필드에서 쓰도록 맞춘다.
 */
function coerceMonsterFieldItem(record: ItemRecord, warnings: string[]): void {
  if (record.careProfile) {
    if (record.type !== "special") {
      warnings.push(`careProfile 은 type:"special" 에서만 효과가 나서 종류를 ${record.type} → special 로 바꿨습니다.`);
      record.type = "special";
    }
    if (record.occasion !== "field" && record.occasion !== "always") {
      warnings.push(`돌봄 아이템은 메뉴(필드)에서 쓰므로 occasion 을 ${record.occasion} → field 로 바꿨습니다.`);
      record.occasion = "field";
      record.occasionField = true;
      record.occasionBattle = false;
    }
  }
  if (record.ppRecovery && record.type !== "medicine") {
    warnings.push(`ppRecovery 는 type:"medicine" 에서만 효과가 나서 종류를 ${record.type} → medicine 으로 바꿨습니다.`);
    record.type = "medicine";
  }
}

function resolveIconResourceId(project: Project, record: { iconResourceId?: string }, label: string, warnings: string[]): void {
  const requested = record.iconResourceId;
  if (!requested) return;
  const resourceIds = collectResourceIds(project);
  if (resourceIds.has(requested)) return;
  const sibling = [...project.database.items, ...project.database.equipment]
    .find((entry) => entry.id === requested && entry.iconResourceId && resourceIds.has(entry.iconResourceId));
  if (sibling?.iconResourceId) {
    record.iconResourceId = sibling.iconResourceId;
    warnings.push(`${label}.iconResourceId "${requested}" 는 그림 id 가 아니라 레코드 id 라 그 레코드의 그림 "${sibling.iconResourceId}" 로 바꿨습니다.`);
    return;
  }
  delete record.iconResourceId;
  const word = requested.replace(/^(item|equip|icon)_/u, "").split(/[_-]/u)[0] ?? "";
  const close = word ? [...resourceIds].filter((id) => id.includes(word)).slice(0, 6) : [];
  warnings.push(
    `${label}.iconResourceId "${requested}" 는 없는 그림이라 비우고 저장했습니다. ` +
      (close.length ? `비슷한 그림 id: ${close.join(", ")}` : "list_resources 로 그림 id 를 찾아 다시 지정하세요."),
  );
}

/** captureProfile.condition 을 줬는데 정규화가 버렸으면(모르는 종류·필수 매개변수 누락) 허용 값을 담아 거절한다. */
function validateItemCaptureCondition(draft: Project, raw: unknown, record: ItemRecord): void {
  if (raw === undefined || raw === null) return;
  const code = "invalid-capture-condition";
  if (!record.captureProfile?.condition) {
    throw new ToolError(`captureProfile.condition 이 올바르지 않아 저장하지 않았습니다 — kind(${CAPTURE_CONDITION_KINDS.join("|")}) 가 필요하고 kind=type 은 types(system.typeChart.types 값 배열)도 필요합니다.`, { code });
  }
  const known = draft.system.typeChart?.types ?? [];
  const unknown = (record.captureProfile.condition.types ?? []).filter((type) => known.length > 0 && !known.includes(type));
  if (unknown.length > 0) throw new ToolError(`captureProfile.condition.types '${unknown.join(", ")}' 는 타입 상성표에 없습니다 — 허용: ${known.join(", ")}`, { code });
}

/** heldEffect 를 줬는데 정규화가 버렸으면(모르는 종류·필수 매개변수 누락) 거절한다. 조용히 효과 없는 도구가 되지 않게. */
function validateItemHeldEffect(draft: Project, raw: unknown, record: ItemRecord): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const code = "invalid-held-effect";
  if (!record.heldEffect) {
    throw new ToolError(`heldEffect 가 올바르지 않아 저장하지 않았습니다 — kind(${HELD_ITEM_KINDS.join("|")}) 가 필요하고, boostType 은 type(system.typeChart.types) 도 필요합니다. cureStatus 의 status 는 ${HELD_ITEM_STATUSES.join("|")}.`, { code });
  }
  const types = draft.system.typeChart?.types ?? [];
  if (record.heldEffect.type && types.length > 0 && !types.includes(record.heldEffect.type)) {
    throw new ToolError(`heldEffect.type '${record.heldEffect.type}' 는 타입 상성표에 없습니다 — 허용: ${types.join(", ")}`, { code });
  }
  return draft.system.battleModel === "gen1"
    ? undefined
    : `지닌 도구는 전투 모델이 gen1 인 프로젝트(몬스터 수집 게임)에서만 작동합니다. 지금 battleModel 은 ${draft.system.battleModel ?? "기본(RM2K3)"} 이라 저장은 했지만 전투에서는 아무 효과가 없습니다.`;
}

/** repelSteps/escapeTo 를 줬는데 정규화가 버렸으면 거절하고, 쓸 수 없는 occasion·scope 는 경고한다. */
function validateFieldUtilityItem(raw: { repelSteps?: unknown; escapeTo?: unknown; repelBelowLead?: unknown }, record: ItemRecord, warnings: string[]): void {
  if (raw.repelSteps !== undefined && record.repelSteps === undefined) {
    throw new ToolError("repelSteps 는 1 이상의 걸음 수(정수, 최대 9999)여야 합니다.", { code: "invalid-repel-steps" });
  }
  if (raw.escapeTo !== undefined && record.escapeTo === undefined) {
    throw new ToolError("escapeTo 는 \"entrance\" 만 허용됩니다(던전 마지막 입구로 탈출).", { code: "invalid-escape-to" });
  }
  if (raw.repelBelowLead === true && record.repelSteps === undefined) warnings.push("repelBelowLead 는 repelSteps 와 함께일 때만 쓰입니다.");
  if (record.repelSteps === undefined && record.escapeTo === undefined) return;
  if (record.occasion !== "field" && record.occasion !== "always") warnings.push(`occasion 이 ${record.occasion} 라 필드 메뉴에서 쓸 수 없습니다 — 벌레퇴치·탈출 로프는 occasion:"field" 로 두세요.`);
  if (record.scope !== "none") warnings.push(`scope 가 ${record.scope} 라 대상을 고르게 됩니다 — 벌레퇴치·탈출 로프는 scope:"none" 이 맞습니다.`);
  if (record.escapeTo !== undefined && record.repelSteps !== undefined) warnings.push("repelSteps 와 escapeTo 를 한 아이템에 같이 쓰면 벌레퇴치가 먼저 적용됩니다 — 아이템을 나누세요.");
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
    validateItemCaptureCondition(draft, (merged as { captureProfile?: { condition?: unknown } }).captureProfile?.condition, record);
    const heldWarning = validateItemHeldEffect(draft, (merged as { heldEffect?: unknown }).heldEffect, record);
    if (heldWarning) warnings.push(heldWarning);
    validateItemCareProfile((merged as { careProfile?: unknown }).careProfile, record);
    validateFieldUtilityItem(merged as { repelSteps?: unknown; escapeTo?: unknown; repelBelowLead?: unknown }, record, warnings);
    coerceSwitchItem(record, warnings);
    coerceMonsterFieldItem(record, warnings);
    dropUnknownAnimationId(draft, record, "item", warnings);
    resolveIconResourceId(draft, record, "item", warnings);
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
  const reactions = Array.isArray(record.reactions) ? record.reactions : [];
  for (const reaction of reactions) {
    const skillId = reaction && typeof reaction === "object" ? (reaction as { skillId?: unknown }).skillId : undefined;
    if (typeof skillId === "string" && skillId) requestedSkillIds.add(skillId);
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

/**
 * 능력치 단계 효과 검사. 정규화가 모르는 stat·0 단계를 조용히 버리면 모델은 「울음을 만들었다」고 보고하고
 * 실제로는 아무 일도 안 하는 기술이 된다 — 모르는 키·범위 밖 값은 허용 값을 담아 거부한다(빈 배열 = 해제).
 */
function validateStatStageEffects(value: unknown): void {
  if (!Array.isArray(value)) throw new ToolError("skill.statStageEffects 는 [{stat, stages, chance?, target?}] 배열이어야 합니다(해제 = 빈 배열).", { code: "invalid-stat-stage-effects" });
  if (value.length > 4) throw new ToolError(`skill.statStageEffects 는 최대 4개입니다(받은 ${value.length}개).`, { code: "invalid-stat-stage-effects" });
  for (const [index, row] of value.entries()) {
    const entry = row as Record<string, unknown> | null;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ToolError(`skill.statStageEffects[${index}] 는 {stat, stages} 객체여야 합니다.`, { code: "invalid-stat-stage-effects" });
    }
    const unknownKeys = Object.keys(entry).filter((key) => !["stat", "stages", "chance", "target"].includes(key));
    if (unknownKeys.length > 0) throw new ToolError(`skill.statStageEffects[${index}] 의 모르는 키: ${unknownKeys.join(", ")} — 허용 키: stat, stages, chance, target.`, { code: "invalid-stat-stage-effects" });
    if (!isStatStageKey(entry.stat)) {
      throw new ToolError(`skill.statStageEffects[${index}].stat '${String(entry.stat)}' 은 능력치 단계 이름이 아닙니다 — 허용 값: ${STAT_STAGE_KEYS.join(", ")}.`, { code: "invalid-stat-stage-effects" });
    }
    if (typeof entry.stages !== "number" || !Number.isInteger(entry.stages) || entry.stages === 0 || Math.abs(entry.stages) > STAT_STAGE_MAX) {
      throw new ToolError(`skill.statStageEffects[${index}].stages 는 0 이 아닌 −${STAT_STAGE_MAX}~+${STAT_STAGE_MAX} 정수입니다(양수 = 올림, 음수 = 내림). 받은 값: ${JSON.stringify(entry.stages)}.`, { code: "invalid-stat-stage-effects" });
    }
    if (entry.chance !== undefined && (typeof entry.chance !== "number" || entry.chance < 0 || entry.chance > 100)) {
      throw new ToolError(`skill.statStageEffects[${index}].chance 는 0~100 입니다.`, { code: "invalid-stat-stage-effects" });
    }
    if (entry.target !== undefined && entry.target !== "target" && entry.target !== "self") {
      throw new ToolError(`skill.statStageEffects[${index}].target 은 "target"(기술 대상, 기본) 또는 "self"(시전자) 입니다.`, { code: "invalid-stat-stage-effects" });
    }
  }
}

/** 반동·고정 피해·연속 타수·풀죽음 검사 — 정규화가 조용히 버리면 「넣었다」고 보고하고 일반 기술이 된다. */
function validateSkillBattleRules(record: Record<string, unknown>): void {
  const percent = (key: "recoilPercent" | "flinchChance") => {
    const value = record[key];
    if (value === undefined || value === null) return;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) throw new ToolError(`skill.${key} 는 0~100 정수입니다(받은 값: ${JSON.stringify(value)}).`, { code: "invalid-skill-battle-rules" });
  };
  percent("recoilPercent");
  percent("flinchChance");
  const fixed = record.fixedDamage;
  if (fixed !== undefined && fixed !== null) {
    const ok = normalizeFixedDamage(fixed) !== undefined;
    if (!ok) throw new ToolError(`skill.fixedDamage 는 {mode:"level"} 또는 {mode:"amount", amount:1~999} 입니다(받은 값: ${JSON.stringify(fixed)}). 해제 = null.`, { code: "invalid-skill-battle-rules" });
  }
  const multi = record.multiHit;
  if (multi !== undefined && multi !== null) {
    const raw = multi as { min?: unknown; max?: unknown };
    const inRange = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 2 && value <= MULTI_HIT_LIMIT;
    if (!inRange(raw.min) || !inRange(raw.max) || (raw.min as number) > (raw.max as number)) throw new ToolError(`skill.multiHit 는 {min, max} 이고 2 ≤ min ≤ max ≤ ${MULTI_HIT_LIMIT} 입니다(받은 값: ${JSON.stringify(multi)}). 해제 = null.`, { code: "invalid-skill-battle-rules" });
  }
}

/**
 * 연계기·위치 범위기 패치 검사. 정규화가 조용히 버리면 모델은 「연계기를 넣었다」고 보고하고 실제로는 일반 기술이 된다 —
 * 없는 배우·인원 수·반경은 사유와 허용 예시를 담아 거부한다.
 */
function validateSkillTechPatch(draft: Project, patch: unknown): void {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  const record = patch as Record<string, unknown>;
  if (record.statStageEffects !== undefined) validateStatStageEffects(record.statStageEffects);
  validateSkillBattleRules(record);
  if (record.comboActorIds !== undefined) {
    const ids = Array.isArray(record.comboActorIds) ? record.comboActorIds : null;
    if (!ids || ids.some((id) => typeof id !== "string" || !id.trim())) {
      throw new ToolError("skill.comboActorIds 는 배우 id 문자열 배열이어야 합니다. 예: [\"actor_hero\", \"actor_mage\"]", { code: "invalid-combo-actors" });
    }
    const unique = [...new Set((ids as string[]).map((id) => id.trim()))];
    if (unique.length > 0 && (unique.length < 2 || unique.length > COMBO_MAX_ACTORS)) {
      throw new ToolError(`skill.comboActorIds 는 서로 다른 배우 2~${COMBO_MAX_ACTORS}명이어야 합니다(받은 ${unique.length}명). 해제하려면 빈 배열을 주세요.`, { code: "invalid-combo-actors" });
    }
    const missing = unique.filter((id) => !draft.database.actors.some((actor) => actor.id === id));
    if (missing.length > 0) {
      throw new ToolError(`존재하지 않는 comboActorIds: ${missing.join(", ")} — 허용 예시: ${knownIds(draft.database.actors)}`, { code: "actor-not-found" });
    }
  }
  if (record.comboRequires !== undefined) {
    const rows = Array.isArray(record.comboRequires) ? record.comboRequires : null;
    if (!rows) throw new ToolError("skill.comboRequires 는 [{actorId, skillId}] 배열이어야 합니다.", { code: "invalid-combo-requires" });
    const comboIds = Array.isArray(record.comboActorIds) ? (record.comboActorIds as string[]).map((id) => String(id).trim()) : undefined;
    for (const [index, row] of rows.entries()) {
      const entry = row as Record<string, unknown> | null;
      const unknownKeys = entry && typeof entry === "object" ? Object.keys(entry).filter((key) => key !== "actorId" && key !== "skillId") : [];
      if (!entry || typeof entry !== "object" || typeof entry.actorId !== "string" || typeof entry.skillId !== "string" || unknownKeys.length > 0) {
        throw new ToolError(`skill.comboRequires[${index}] 는 {actorId, skillId} 두 키만 가진 객체여야 합니다${unknownKeys.length ? `(모르는 키: ${unknownKeys.join(", ")})` : ""}.`, { code: "invalid-combo-requires" });
      }
      if (!draft.database.actors.some((actor) => actor.id === entry.actorId)) {
        throw new ToolError(`comboRequires[${index}].actorId 가 없는 배우: ${entry.actorId} — 허용 예시: ${knownIds(draft.database.actors)}`, { code: "actor-not-found" });
      }
      if (comboIds && !comboIds.includes(entry.actorId as string)) {
        throw new ToolError(`comboRequires[${index}].actorId ${entry.actorId} 는 comboActorIds(${comboIds.join(", ")}) 에 없습니다. 연계 참가자만 조건을 가질 수 있습니다.`, { code: "invalid-combo-requires" });
      }
      if (!draft.database.skills.some((skill) => skill.id === entry.skillId)) {
        throw new ToolError(`comboRequires[${index}].skillId 가 없는 기술: ${entry.skillId} — 먼저 upsert_skill 로 만드세요.`, { code: "skill-not-found" });
      }
    }
  }
  if (record.comboMpCosts !== undefined && record.comboMpCosts !== null) {
    const rows = Array.isArray(record.comboMpCosts) ? record.comboMpCosts : null;
    if (!rows) throw new ToolError("skill.comboMpCosts 는 [{actorId, mp}] 배열이어야 합니다. 예: [{actorId:\"actor_hero\", mp:4}, {actorId:\"actor_mage\", mp:8}]", { code: "invalid-combo-costs" });
    const comboIds = Array.isArray(record.comboActorIds)
      ? (record.comboActorIds as string[]).map((id) => String(id).trim())
      : typeof record.id === "string" ? [...(draft.database.skills.find((skill) => skill.id === record.id)?.comboActorIds ?? [])] : [];
    for (const [index, row] of rows.entries()) {
      const entry = row as Record<string, unknown> | null;
      const unknownKeys = entry && typeof entry === "object" ? Object.keys(entry).filter((key) => key !== "actorId" && key !== "mp") : [];
      if (!entry || typeof entry !== "object" || typeof entry.actorId !== "string" || typeof entry.mp !== "number" || !Number.isFinite(entry.mp) || entry.mp < 0 || unknownKeys.length > 0) {
        throw new ToolError(`skill.comboMpCosts[${index}] 는 {actorId, mp(0 이상 정수)} 두 키만 가진 객체여야 합니다${unknownKeys.length ? `(모르는 키: ${unknownKeys.join(", ")})` : ""}.`, { code: "invalid-combo-costs" });
      }
      if (!comboIds.includes(entry.actorId)) {
        throw new ToolError(`comboMpCosts[${index}].actorId ${entry.actorId} 는 연계 참가자(${comboIds.join(", ") || "없음 — comboActorIds 를 먼저 주세요"})가 아닙니다.`, { code: "invalid-combo-costs" });
      }
    }
  }
  if (record.exploitStates !== undefined && record.exploitStates !== null) {
    const exploit = record.exploitStates as Record<string, unknown>;
    const unknownKeys = exploit && typeof exploit === "object" && !Array.isArray(exploit) ? Object.keys(exploit).filter((key) => !["stateIds", "bonusPercent", "consume"].includes(key)) : ["(객체 아님)"];
    if (unknownKeys.length > 0 || !Array.isArray(exploit.stateIds) || exploit.stateIds.length === 0 || typeof exploit.bonusPercent !== "number" || exploit.bonusPercent < 1 || exploit.bonusPercent > 300) {
      throw new ToolError(`skill.exploitStates 는 {stateIds:[상태 id 1~8개], bonusPercent:1~300, consume?:boolean} 입니다${unknownKeys.length ? `(모르는 키: ${unknownKeys.join(", ")})` : ""}. 예: {stateIds:["state_agility_down"], bonusPercent:50}`, { code: "invalid-exploit-states" });
    }
    const missing = (exploit.stateIds as unknown[]).filter((id) => typeof id !== "string" || !draft.database.states.some((state) => state.id === id));
    if (missing.length > 0) {
      throw new ToolError(`exploitStates.stateIds 에 없는 상태: ${missing.map(String).join(", ")} — 허용 예시: ${knownIds(draft.database.states)}`, { code: "state-not-found" });
    }
  }
  if (record.chargeBreak !== undefined && record.chargeBreak !== null) {
    const rule = record.chargeBreak as Record<string, unknown>;
    const allowed = ["damage", "elementIds", "stateIds", "message", "stagger"];
    const unknownKeys = rule && typeof rule === "object" && !Array.isArray(rule) ? Object.keys(rule).filter((key) => !allowed.includes(key)) : ["(객체 아님)"];
    const hasCondition = unknownKeys.length === 0 && ((typeof rule.damage === "number" && rule.damage >= 1)
      || (Array.isArray(rule.elementIds) && rule.elementIds.length > 0) || (Array.isArray(rule.stateIds) && rule.stateIds.length > 0));
    if (!hasCondition) {
      throw new ToolError(`skill.chargeBreak 는 {damage?:1 이상, elementIds?:[속성 id], stateIds?:[상태 id], message?, stagger?} 이고 조건(damage·elementIds·stateIds) 하나 이상이 필요합니다${unknownKeys.length ? `(모르는 키: ${unknownKeys.join(", ")})` : ""}. 예: {damage:300, message:"송신 실패"}`, { code: "invalid-charge-break" });
    }
    const chargeTurns = typeof record.chargeTurns === "number" ? record.chargeTurns
      : typeof record.id === "string" ? draft.database.skills.find((skill) => skill.id === record.id)?.chargeTurns : undefined;
    if (!chargeTurns || chargeTurns < 1) {
      throw new ToolError("skill.chargeBreak 는 힘 모으기 기술에만 붙습니다 — chargeTurns(1~3)를 같이 주세요. 예: {chargeTurns:3, chargeBreak:{damage:300}}", { code: "invalid-charge-break" });
    }
    const missingStates = (Array.isArray(rule.stateIds) ? rule.stateIds : []).filter((id) => typeof id !== "string" || !draft.database.states.some((state) => state.id === id));
    if (missingStates.length > 0) {
      throw new ToolError(`chargeBreak.stateIds 에 없는 상태: ${missingStates.map(String).join(", ")} — 허용 예시: ${knownIds(draft.database.states)}`, { code: "state-not-found" });
    }
    const elements = draft.database.elements ?? [];
    const missingElements = (Array.isArray(rule.elementIds) ? rule.elementIds : []).filter((id) => typeof id !== "string" || !elements.some((element) => element.id === id));
    if (missingElements.length > 0) {
      throw new ToolError(`chargeBreak.elementIds 에 없는 속성: ${missingElements.map(String).join(", ")} — 있는 속성: ${elements.map((element) => element.id).slice(0, 12).join(", ") || "없음"}`, { code: "element-not-found" });
    }
  }
  if (typeof record.comboSwitchId === "string" && record.comboSwitchId.trim()) {
    ensureNamedSwitch(draft, record.comboSwitchId.trim(), `연계기 발동: ${typeof record.name === "string" ? record.name : record.comboSwitchId.trim()}`);
  }
  if (record.area !== undefined) {
    const area = record.area as { shape?: unknown; radius?: unknown } | null;
    if (!area || typeof area !== "object" || (area.shape !== "circle" && area.shape !== "line")) {
      throw new ToolError("skill.area.shape 는 circle 또는 line 이어야 합니다. 예: {shape:\"circle\", radius:48}", { code: "invalid-skill-area" });
    }
    if (typeof area.radius !== "number" || !Number.isFinite(area.radius) || area.radius <= 0) {
      throw new ToolError(`skill.area.radius 는 0보다 큰 전투장 픽셀이어야 합니다(받은 값 ${String(area.radius)}). 예: 48`, { code: "invalid-skill-area" });
    }
  }
}

/**
 * retroChoreographyId 검사. 존재하지 않는 id 는 정규화가 그대로 두어 전투에서 조용히 기본 연출이 되므로,
 * 여기서 거부하고 비슷한 계약 후보를 돌려준다. 빈 문자열은 해제.
 */
function validateSkillRetroPatch(draft: Project, patch: unknown): void {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
  const gimmick=(patch as Record<string,unknown>).battleGimmick;
  if(gimmick!==undefined&&!normalizeBattleGimmick(gimmick))throw new ToolError("battleGimmick.pattern 은 32종 동작 중 하나여야 합니다.",{code:"invalid-battle-gimmick"});
  const gimmickResource=normalizeBattleGimmick(gimmick)?.resourceId;
  if(gimmickResource&&!partyPixelSheet(gimmickResource))throw new ToolError(`존재하지 않는 기믹 그림: ${gimmickResource}`,{code:"summon-sheet-not-found"});
  const summon = (patch as Record<string, unknown>).summonResourceId;
  if (typeof summon === "string" && summon.trim() && !partyPixelSheet(summon.trim())) {
    const chip = summon.trim().replace(/^party-pixel-/, "");
    const near = PARTY_PIXEL_SHEETS.filter((sheet) => sheet.chip.startsWith(chip.split("-")[0] ?? chip)).slice(0, 8).map((sheet) => sheet.resourceId);
    throw new ToolError(`존재하지 않는 summonResourceId: ${summon} — "party-pixel-<칩>" 형식이어야 합니다${near.length ? `. 후보: ${near.join(", ")}` : ""}`, { code: "summon-sheet-not-found" });
  }
  const value = (patch as Record<string, unknown>).retroChoreographyId;
  if (value === undefined || value === null) return;
  if (typeof value !== "string") {
    throw new ToolError("skill.retroChoreographyId 는 문자열이어야 합니다. 예: \"skill_knight_slash\" (list_retro_choreographies 로 조회)", { code: "invalid-retro-choreography" });
  }
  const id = value.trim();
  if (!id || retroChoreographyKind(id)) return;
  // 공용 동작 32종(chor_builtin_*)은 프로젝트 레코드가 아니라 번들 — 전투가 그대로 풀어 쓴다(resolveSkillChoreography).
  if (BUNDLED_BATTLE_MOTIONS.some((motion) => motion.id === id)) return;
  const records = draft.database.skillChoreographies ?? [];
  if (records.some((record) => record.id === id)) return;
  const near = nearbyRetroChoreographies(id, 5, records).map((entry) => `${entry.id}(${entry.name}, ${entry.motion})`);
  throw new ToolError(
    `존재하지 않는 retroChoreographyId: ${id}${near.length ? ` — 비슷한 후보: ${near.join(", ")}` : ""}. list_retro_choreographies 로 motion/element/query 를 좁혀 정확한 id 를 고르거나, 새 연출은 upsert_choreography·duplicate_choreography 로 chor_ 레코드를 먼저 만드세요.`,
    { code: "retro-choreography-not-found" },
  );
}

/** 배우 learnedSkills[].tp 와 적 rewards.tp 는 양의 정수만 받는다. 음수·0 은 정규화가 조용히 버린다. */
function requirePositiveTp(value: unknown, label: string): void {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ToolError(`${label} 는 1 이상의 정수여야 합니다(받은 값 ${JSON.stringify(value)}). TP 없이 레벨로만 배우려면 필드를 빼세요.`, { code: "invalid-tech-points" });
  }
}

/** 적 rewards.ap(마석 AP)도 양의 정수만 받는다. */
function requirePositiveAp(value: unknown, label: string): void {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ToolError(`${label} 는 1 이상의 정수여야 합니다(받은 값 ${JSON.stringify(value)}). AP 를 주지 않으려면 필드를 빼세요.`, { code: "invalid-ap" });
  }
}

/** 반격 패치 검사. trigger 는 physical/magic/실재 속성 id, chance 는 0~100. 정규화가 조용히 버리지 않게 거부한다. */
function validateEnemyReactions(draft: Project, patch: unknown): void {
  const reactions = patch && typeof patch === "object" ? (patch as { reactions?: unknown }).reactions : undefined;
  if (reactions === undefined) return;
  if (!Array.isArray(reactions)) throw new ToolError("enemy.reactions 는 배열이어야 합니다. 예: [{trigger:\"physical\", skillId:\"skill_attack\", chance:100}]", { code: "invalid-enemy-reactions" });
  const elementIds = (draft.database.elements ?? []).map((element) => element.id);
  reactions.forEach((raw, index) => {
    const entry = (raw && typeof raw === "object" ? raw : {}) as { trigger?: unknown; skillId?: unknown; chance?: unknown };
    const label = `enemy.reactions[${index}]`;
    if (typeof entry.trigger !== "string" || !(entry.trigger === "physical" || entry.trigger === "magic" || entry.trigger === "onDeath" || elementIds.includes(entry.trigger))) {
      throw new ToolError(`${label}.trigger 는 physical · magic · onDeath · 속성 id 중 하나여야 합니다(받은 값 ${JSON.stringify(entry.trigger)}). 속성: ${elementIds.slice(0, 8).join(", ") || "없음"}`, { code: "invalid-enemy-reactions" });
    }
    if (typeof entry.skillId !== "string") throw new ToolError(`${label}.skillId(문자열, 통상 공격은 "")가 필요합니다.`, { code: "invalid-enemy-reactions" });
    if (entry.chance !== undefined && (typeof entry.chance !== "number" || entry.chance < 0 || entry.chance > 100)) {
      throw new ToolError(`${label}.chance 는 0~100 이어야 합니다(받은 값 ${JSON.stringify(entry.chance)}).`, { code: "invalid-enemy-reactions" });
    }
  });
}

/** 자동 부활은 1~100% (0 은 해제). 범위 밖은 거부한다. */
/** 마석 성장 필드(apGrants·apRate·levelUpBonus)는 조용히 버리지 않고 거절한다. 오류는 다음에 부를 도구를 안내한다. */
function validateEquipmentEsperPatch(draft: Project, patch: unknown): void {
  const equipment = (patch && typeof patch === "object" ? patch : {}) as { apGrants?: unknown; apRate?: unknown; levelUpBonus?: unknown };
  if (equipment.apGrants !== undefined) {
    if (!Array.isArray(equipment.apGrants)) throw new ToolError('equipment.apGrants 는 배열이어야 합니다. 예: [{"skillId":"skill_fire","ap":40}]', { code: "invalid-ap-grants" });
    equipment.apGrants.forEach((entry, index) => {
      const grant = (entry && typeof entry === "object" ? entry : {}) as { skillId?: unknown; ap?: unknown };
      const label = `equipment.apGrants[${index}]`;
      if (typeof grant.skillId !== "string" || !grant.skillId.trim()) throw new ToolError(`${label}.skillId 가 필요합니다.`, { code: "invalid-ap-grants" });
      if (!draft.database.skills.some((skill) => skill.id === grant.skillId)) {
        throw new ToolError(`${label}.skillId '${grant.skillId}' 스킬이 없습니다. upsert_skill 로 먼저 만들거나 get_database_records(skills)로 id 를 확인하세요.`, { code: "unknown-skill" });
      }
      if (typeof grant.ap !== "number" || !Number.isInteger(grant.ap) || grant.ap < 1 || grant.ap > 99999) {
        throw new ToolError(`${label}.ap 는 1~99999 정수(필요 AP)여야 합니다(받은 값 ${JSON.stringify(grant.ap)}).`, { code: "invalid-ap-grants" });
      }
    });
  }
  if (equipment.apRate !== undefined && (typeof equipment.apRate !== "number" || !Number.isInteger(equipment.apRate) || equipment.apRate < 1 || equipment.apRate > 1000)) {
    throw new ToolError(`equipment.apRate 는 1~1000 정수(%)여야 합니다(받은 값 ${JSON.stringify(equipment.apRate)}). 100 은 기본 습득률입니다.`, { code: "invalid-ap-rate" });
  }
  const bonus = equipment.levelUpBonus;
  if (bonus !== undefined) {
    if (!bonus || typeof bonus !== "object" || Array.isArray(bonus)) throw new ToolError('equipment.levelUpBonus 는 객체여야 합니다. 예: {"maxHpPercent":10,"mind":1}', { code: "invalid-level-up-bonus" });
    for (const [key, value] of Object.entries(bonus as Record<string, unknown>)) {
      const percent = key === "maxHpPercent" || key === "maxMpPercent";
      const [min, max] = percent ? [0, 100] : [-99, 99];
      if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
        throw new ToolError(`equipment.levelUpBonus.${key} 는 ${min}~${max} 정수여야 합니다(받은 값 ${JSON.stringify(value)}).`, { code: "invalid-level-up-bonus" });
      }
    }
  }
}

function validateAutoRevive(patch: unknown): void {
  const flags = patch && typeof patch === "object" ? (patch as { effectFlags?: { autoRevive?: unknown } }).effectFlags : undefined;
  const value = flags?.autoRevive;
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new ToolError(`equipment.effectFlags.autoRevive 는 0~100 정수(최대 HP %, 0=해제)여야 합니다(받은 값 ${JSON.stringify(value)}).`, { code: "invalid-auto-revive" });
  }
}

function validateActorTechPoints(patch: unknown): void {
  const learned = patch && typeof patch === "object" ? (patch as { learnedSkills?: unknown }).learnedSkills : undefined;
  if (!Array.isArray(learned)) return;
  learned.forEach((entry, index) => requirePositiveTp((entry as { tp?: unknown } | null)?.tp, `actor.learnedSkills[${index}].tp`));
}

function skillDamagesFoe(project: Project, skillId: string): boolean {
  const skill = project.database.skills.find((entry) => entry.id === skillId);
  return skill?.effect?.kind === "damage" && (skill.scope === "enemy" || skill.scope === "allEnemies");
}

/** upsert_enemy.clearFields 로 지울 수 있는 선택 필드. id·name·stats·actions·그림(monsterResourceId)은 적의 뼈대라 뺀다. */
const ENEMY_CLEARABLE_FIELDS = [
  "speciesId", "level", "battleScalePercent", "lungeSpeedPercent", "collapseEffect", "hideHp", "criticalHit", "attackOptions",
  "reactions", "stealItems", "stateRates", "elementRates", "damageTypeRates",
] as const;

/** 병합된 적에서 clearFields 를 지운다. 실제로 지운 필드 이름을 돌려준다(없던 필드는 조용히 넘어간다). */
function clearEnemyFields(merged: Record<string, unknown>, patch: unknown, clearFields: unknown): string[] {
  if (clearFields === undefined) return [];
  if (!Array.isArray(clearFields)) throw new ToolError("clearFields 는 필드 이름 배열이어야 합니다.", { code: "invalid-clear-fields" });
  const allowed = new Set<string>(ENEMY_CLEARABLE_FIELDS);
  const given = patch && typeof patch === "object" ? patch as Record<string, unknown> : {};
  const removed: string[] = [];
  for (const field of clearFields) {
    if (typeof field !== "string" || !allowed.has(field)) {
      throw new ToolError(`clearFields '${String(field)}' 는 지울 수 없는 필드입니다. 지울 수 있는 필드: ${ENEMY_CLEARABLE_FIELDS.join(", ")}`, { code: "invalid-clear-fields" });
    }
    if (field in given) throw new ToolError(`'${field}' 를 enemy 에 주면서 clearFields 로 지우라고 했습니다 — 한쪽만 주세요.`, { code: "invalid-clear-fields" });
    if (field in merged) { delete merged[field]; removed.push(field); }
  }
  return removed;
}

/** upsert_enemy 호출이 직접 준 능력치 — 보스 하한이 덮지 않는다. */
function explicitBossStats(enemy: unknown): ReadonlySet<BossFloorStat> {
  const stats = enemy && typeof enemy === "object" ? (enemy as { stats?: unknown }).stats : undefined;
  if (!stats || typeof stats !== "object") return new Set();
  return new Set(BOSS_FLOOR_STATS.filter(key => typeof (stats as Record<string, unknown>)[key] === "number"));
}

const upsertEnemy: ToolDefinition = {
  name: "upsert_enemy",
  description:
    "적 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. " +
    "elementRates의 키는 database.elements의 속성 id다(get_database_records collection:\"elements\"). " +
    "몬스터 타입 상성(set_type_chart)의 types와는 다른 체계이며, speciesId는 monsterSpecies를 가리킨다. " +
    "보스는 role:\"boss\" 를 준다(id·이름에 boss/보스가 있어도 같다) — 시작 파티를 기준으로 체력·공격·마력·민첩 중 **stats 에 주지 않은 값**에만 하한(기본값)을 채우고 모의전 결과를 경고로 돌려준다. stats 에 직접 준 값은 하한보다 낮아도 그대로 둔다(경고에 권장값을 적는다). " +
    "시작 파티는 Lv1 에도 HP 수백·공 50 안팎이다(get_database_records actors 또는 simulate_battle 로 확인). " +
    "몬스터 파티 게임에서 speciesId 가 있는 적은 stats 대신 종족+level 공식으로 싸운다 — 강도는 level 로 정한다(관장은 도로 야생보다 3~5 레벨 위). " +
    "피해 행동이 없으면 그 레벨의 종족 습득 기술을 actions 에 넣는다.",
  mode: "write",
  parameters: parametersForRecord("enemy", enemyRecordSchema, { id: "enemy_slime", name: "슬라임", stats: { maxHp: 40, attack: 12 }, rewards: { exp: 3, gold: 2 } }, {
    role: { type: "string", enum: ["boss", "normal"], description: "boss 면 stats 에 주지 않은 능력치에 시작 파티 기준 위협 하한(기본값)을 채운다(직접 준 값은 그대로). 생략 시 id·이름의 boss/보스로 판정." },
    clearFields: {
      type: "array",
      items: { type: "string", enum: [...ENEMY_CLEARABLE_FIELDS] },
      description: "기존 적에서 지울 필드(병합은 필드를 지우지 못한다). 예: 몬스터 종에서 복제한 사람 적이 「야생의 ○○」로 나오면 [\"speciesId\"]. 같은 호출의 enemy 에 같은 필드를 함께 주지 않는다.",
    },
  }),
  run(draft, rawArgs): ToolExecResult {
    const repaired = repairRecordArgs("enemy", "enemy", rawArgs, enemyRecordSchema, upsertEnemy.parameters);
    const args = repaired.args;
    validateEnemyCombatPatch(args.enemy);
    validateEnemyReactions(draft, args.enemy);
    requirePositiveTp((args.enemy as { rewards?: { tp?: unknown } } | undefined)?.rewards?.tp, "enemy.rewards.tp");
    requirePositiveAp((args.enemy as { rewards?: { ap?: unknown } } | undefined)?.rewards?.ap, "enemy.rewards.ap");
    const merged = mergeRecord(draft.database.enemies, args.enemy, "enemy", enemyRecordSchema, { id: "enemy_slime", name: "슬라임" });
    const cleared = clearEnemyFields(merged as Record<string, unknown>, args.enemy, args.clearFields);
    rejectUnknownEnemyReferences(draft, args.enemy);
    const record = normalizeEnemyRecord(merged as Partial<EnemyRecord> & Pick<EnemyRecord, "id" | "name">);
    const warnings: string[] = [...repaired.notes];
    if (cleared.length > 0) warnings.push(`지운 필드: ${cleared.join(", ")}`);
    dropUnknownElementRates(draft, record, "enemy", warnings);
    dropUnknownSpeciesId(draft, record, "enemy", warnings);
    ensureMonsterGraphic(draft, record, record, "enemy.monsterResourceId", warnings, args.appearanceTags as unknown[] | undefined, { pendingWhenLocked: true });
    // 몬스터 파티 게임: 플레이어 몬스터는 종족+레벨 공식으로 싸운다. 종이 있는 적도 같은 공식이어야 레벨이 곧 강함이다.
    // 2026-09-24 몬스터 수집 gen5: 모델이 적 stats 를 공식의 약 2배(Lv4 박쥐 HP 30·공 12 ↔ 공식 HP 15·공 8)로 적어
    // Lv5 스타터가 첫 동굴 박쥐에게 졌고, 보스 하한은 액터 파티(HP 514) 기준으로 관장 공격을 18→266 으로 올렸다.
    const monsterParty = draft.system.battleParty === "monsters" || draft.system.monsterBattleParty === true;
    const species = monsterParty && record.speciesId ? monsterSpeciesById(draft, record.speciesId) : undefined;
    if (species) {
      const level = record.level ?? 1;
      const formula = monsterBattleStatsForSpecies(species, level, undefined);
      const keys = ["maxHp", "maxMp", "attack", "defense", "mind", "agility"] as const;
      const changed = keys.filter((key) => record.stats[key] !== formula[key]);
      if (changed.length > 0) {
        record.stats = { ...record.stats, ...formula };
        warnings.push(`몬스터 파티 게임이라 종 ${species.name} Lv${level} 공식 능력치로 맞췄습니다(${changed.map((key) => `${key} ${formula[key]}`).join(", ")}). 강하게 하려면 stats 대신 level 을 올리세요.`);
      }
      if (record.level === undefined) warnings.push(`level 이 없어 Lv1 로 계산했습니다 — 야생·트레이너 몬스터는 level 을 주세요.`);
      // 행동이 비면 gen1 은 Struggle(반동)만 쓰고, 포획은 skillIds 빈 배열을 복사해 파티 몬스터가 기술을 잃는다.
      const learned = monsterSkillIdsAtLevel(species, level).filter((skillId) => draft.database.skills.some((skill) => skill.id === skillId));
      const hasDamage = (record.actions ?? []).some((action) => skillDamagesFoe(draft, action.skillId));
      if (!hasDamage && learned.length > 0) {
        const have = new Set((record.actions ?? []).map((action) => action.skillId));
        const added = learned.filter((skillId) => !have.has(skillId));
        if (added.length > 0) {
          const filled = normalizeEnemyRecord({
            ...record,
            actions: [
              ...(record.actions ?? []),
              ...added.map((skillId) => ({
                skillId,
                priority: 5,
                condition: { kind: "always" as const },
                switchOnAfterAction: { enabled: false },
                switchOffAfterAction: { enabled: false },
              })),
            ],
          });
          record.actions = filled.actions;
          record.skillIds = filled.skillIds;
          warnings.push(`피해 행동이 없어 종 ${species.name} Lv${level} 습득 기술을 넣었습니다(${added.join(", ")}). 다른 기술을 쓰려면 actions 에 피해 기술을 지정하세요.`);
        }
      }
    }
    const existed = draft.database.enemies.some(entry => entry.id === record.id);
    const outcome = upsertById(draft.database.enemies, record);
    // 보스 하한은 액터 파티 척도라 몬스터 파티 게임에서는 쓰지 않는다 — 관장 강도는 level 로 정한다.
    // 하한은 기본값이다: 저자가 이번 호출에 준 능력치는 그대로 둔다(2026-10-30 이세계 고딩: maxHp 400 이 590 으로 덮였다).
    // 이미 있는 적을 고칠 때는 role:"boss" 를 이번에 다시 준 경우에만 빠진 값에 하한을 건다 — 예전 호출의 명시값을 덮지 않는다.
    const bossScaling = isBossEnemy(record, args.role) && !species && (!existed || args.role === "boss")
      ? scaleBossToStartParty(draft, record, explicitBossStats(args.enemy))
      : undefined;
    const bossNote = bossScaling?.note;
    const bossApplied = (bossScaling?.applied?.length ?? 0) > 0;
    if (bossNote) warnings.push(bossNote);
    // 이 적이 든 첫 트룹 하나만 본다 — 경고 한 줄이면 고칠 방향이 선다.
    const firstTroop = draft.database.troops.find(troop => troop.enemyIds.includes(record.id));
    if (firstTroop) warnings.push(...troopBalanceWarnings(draft, firstTroop.id));
    return {
      summary: `적 '${record.name}' ${outcome === "added" ? "추가" : "수정"}${bossApplied ? ` — 보스 위협 하한을 기본값으로 적용: ${bossScaling!.applied!.join("·")}(경고 참고)` : bossNote ? " — 보스 능력치는 저자 값 유지(권장 하한은 경고 참고)" : ""}`,
      data: record,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

/**
 * members(배치 좌표)만 준 새 트룹은 enemyIds 를 members 에서 채운다 — 정규화도 members 를 정본으로 enemyIds 를 다시 만든다.
 * 실측(2026-10-02 조수 시험): 모델이 members 만 보내 「enemyIds 필요」로 세 번 연달아 실패했다.
 */
function withEnemyIdsFromMembers(troop: unknown): unknown {
  if (!troop || typeof troop !== "object" || Array.isArray(troop)) return troop;
  const record = troop as Record<string, unknown>;
  if (record.enemyIds !== undefined || !Array.isArray(record.members)) return troop;
  const enemyIds = record.members
    .map((member) => (member && typeof member === "object" ? (member as { enemyId?: unknown }).enemyId : undefined))
    .filter((enemyId): enemyId is string => typeof enemyId === "string" && enemyId.length > 0);
  return enemyIds.length > 0 ? { ...record, enemyIds } : troop;
}

/**
 * 트룹 쓰기 요약의 밸런스 한 줄. 「레벨을 올려도 전멸」은 올린 파티도 질 때만 쓴다 — 몬스터 게임 경고는 «스타터보다 Lv4 높으면 이긴다»여도
 * 「전멸」 낱말을 담아, 요약이 «레벨을 올려도 전멸»이라 거짓말하자 모델이 관장·챔피언을 한 마리 Lv7 로 깎았다(2026-10-29 standin monster).
 */
function troopWarningSummary(warnings: readonly string[]): string {
  if (!warnings.length) return "";
  if (warnings.some(w => /올려도 (?:전멸|이길 수 없)|지나갈 수 없는 잡몹/u.test(w))) return " — 밸런스 경고: 파티가 레벨을 올려도 전멸함";
  if (warnings.some(w => w.includes("전멸"))) return " — 밸런스 경고: 지금 기준 파티로는 지고, 레벨을 올리면 이김(경고 참고)";
  return " — 밸런스 경고: 적이 시작 파티에게 거의 피해를 주지 못함";
}

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
    const troopArg = withEnemyIdsFromMembers(args.troop);
    const merged = mergeRecord(draft.database.troops, troopArg, "troop", troopRecordSchema, { id: "troop_slime", name: "슬라임 무리", enemyIds: ["enemy_slime"] }, ["name", "enemyIds"]);
    const patch = troopArg as Partial<TroopRecord>;
    // An explicit legacy roster replaces the roster. Do not let inherited members
    // silently override it; unrelated patches still preserve authored placements.
    if (patch.enemyIds !== undefined && patch.members === undefined) delete merged.members;
    const record = normalizeTroopRecord(merged as Partial<TroopRecord> & Pick<TroopRecord, "id" | "name">);
    const memberCount = record.members?.length ?? record.enemyIds.length;
    if (memberCount === 0) throw new ToolError("트룹에는 최소 1마리의 적(enemyIds/members)이 필요합니다.", { code: "troop-empty" });
    const enemyIds = new Set(draft.database.enemies.map((enemy) => enemy.id));
    const missing = [...new Set(record.enemyIds.filter((enemyId) => !enemyIds.has(enemyId)))];
    if (missing.length > 0) {
      throw new ToolError(`존재하지 않는 enemyId: ${missing.join(", ")} — 허용 예시: ${knownIds(draft.database.enemies)}. 없는 적은 upsert_enemy 로 먼저 만든 뒤(성공 결과를 확인) 트룹에 넣으세요.`, { code: "enemy-not-found" });
    }
    const outcome = upsertById(draft.database.troops, record);
    const warnings = troopBalanceWarnings(draft, record.id);
    return {
      summary: `트룹 '${record.name}'(${memberCount}마리) ${outcome === "added" ? "추가" : "수정"}${troopWarningSummary(warnings)}`,
      data: record,
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

/** ability 를 줬는데 정규화가 버렸으면(필수 매개변수 누락·모르는 종류) 이유와 허용 값을 담아 거절한다. 조용히 특성 없는 종이 되지 않게. */
export function validateSpeciesAbility(draft: Project, raw: unknown, record: MonsterSpeciesRecord): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const code = "invalid-species-ability";
  if (!record.ability) {
    throw new ToolError(`ability 가 올바르지 않아 저장하지 않았습니다 — name(문자열)과 kind(${MONSTER_ABILITY_KINDS.join("|")}) 가 필요하고, kind 별 필수: immuneType/resistType/boostLowHp → type(system.typeChart.types), immuneStatus/contactStatus → status(${MONSTER_ABILITY_STATUSES.join("|")}), statMultiplier → stat(${MONSTER_ABILITY_STATS.join("|")}), endure → 없음.`, { code });
  }
  const types = draft.system.typeChart?.types ?? [];
  if (record.ability.type && types.length > 0 && !types.includes(record.ability.type)) {
    throw new ToolError(`ability.type '${record.ability.type}' 는 타입 상성표에 없습니다 — 허용: ${types.join(", ")}`, { code });
  }
  return draft.system.battleModel === "gen1"
    ? undefined
    : `특성은 전투 모델이 gen1 인 프로젝트(몬스터 수집 게임)에서만 작동합니다. 지금 battleModel 은 ${draft.system.battleModel ?? "기본(RM2K3)"} 이라 저장은 했지만 전투에서는 아무 효과가 없습니다.`;
}

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
    const abilityWarning = validateSpeciesAbility(draft, (merged as { ability?: unknown }).ability, record);
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
    if (abilityWarning) warnings.push(abilityWarning);
    ensureMonsterGraphic(draft, record, record.graphic, "species.graphic.monsterResourceId", warnings, args.appearanceTags as unknown[] | undefined, { pendingWhenLocked: true });
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
  description: "포켓몬식 타입 상성표를 설정한다. preset 으로 표준 표를 한 번에 깔 수 있다 — 'gen3'(15타입+악·강철, 에메랄드 상성), 'gen6'(+페어리, 강철의 고스트·악 반감 제거). 직접 만들려면 types 배열과 multipliers[공격][방어](데미지 배율)를 준다. preset 과 함께 multipliers 를 주면 그 칸만 덮어쓴다. 1세대 15타입은 몬스터 프로젝트 기본이라 preset 이 필요 없다. 악·강철·페어리 타입 몬스터를 정의하기 전에 먼저 부른다.",
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      preset: { type: "string", enum: ["gen3", "gen6"], description: "표준 상성표: gen3=17타입(15+악·강철), gen6=18타입(+페어리). 생략하면 types·multipliers 를 직접 준다." },
      types: stringArraySchema("예: ['fire','water','grass'] (preset 을 쓰면 생략)"),
      multipliers: { type: "object", description: "{ attackerType: { defenderType: multiplier } } (preset 과 같이 주면 그 칸만 덮어씀)", additionalProperties: true },
    },
    additionalProperties: false,
  },
  invalidArgsHint: "preset('gen3'|'gen6') 하나만 주거나, types 와 multipliers 를 둘 다 주세요.",
  invalidArgsExample: {
    types: ["fire", "water", "grass"],
    multipliers: { fire: { grass: 2, water: 0.5, fire: 0.5 }, water: { fire: 2, grass: 0.5, water: 0.5 }, grass: { water: 2, fire: 0.5, grass: 0.5 } },
  },
  run(draft, args): ToolExecResult {
    const presetName = typeof args.preset === "string" ? args.preset : undefined;
    if (args.preset !== undefined && presetName !== "gen3" && presetName !== "gen6") {
      throw new ToolError(`preset 은 'gen3' 또는 'gen6' 입니다(받은 값: ${JSON.stringify(args.preset)}). 1세대 15타입은 기본이라 preset 이 없습니다.`, { code: "invalid-args" });
    }
    const presetChart = presetName === "gen3" || presetName === "gen6" ? typeChartForPreset(presetName) : null;
    const given = args.multipliers && typeof args.multipliers === "object" && !Array.isArray(args.multipliers)
      ? args.multipliers as Record<string, Record<string, number>>
      : {};
    if (!presetChart && (!Array.isArray(args.types) || args.types.length === 0)) {
      throw new ToolError("types 배열 또는 preset('gen3'|'gen6') 이 필요합니다.", { code: "missing-type-chart-types" });
    }
    const merged = presetChart
      ? { types: presetChart.types, multipliers: Object.fromEntries(Object.entries(presetChart.multipliers).map(([attacker, row]) => [attacker, { ...row, ...(given[attacker] ?? {}) }])) as Record<string, Record<string, number>> }
      : { types: args.types as string[], multipliers: given };
    const chart = normalizeTypeChart(merged);
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
  description: "스타팅 몬스터 3종 선택 이벤트를 생성한다. 고르면 앞모습 그림·이름·속성·도감 설명을 보여 주고 「정할까요?」 예/아니오를 거친 뒤(아니오면 처음 목록으로) giveMonster를 실행하며, 셀프스위치 A로 재지급을 막는다.",
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

/** 같은 능력치 곡선(여섯 항목의 Lv1·Lv99 값)을 가진 다른 배우 — 기본 곡선 그대로 만든 파티원을 즉시 알려 준다(jrpg-loop-1 D7). */
function actorCurveTwin(actors: readonly ActorRecord[], record: ActorRecord): ActorRecord | undefined {
  const keys = ["maxHp", "maxMp", "attack", "defense", "mind", "agility"] as const;
  const signature = (actor: ActorRecord): string => JSON.stringify(keys.map((key) => { const curve = actor.parameterCurves?.[key]; return curve ? [curve[0], curve[curve.length - 1]] : null; }));
  const mine = signature(record);
  return actors.find((other) => other.id !== record.id && signature(other) === mine);
}

const upsertActor: ToolDefinition = {
  name: "upsert_actor",
  description: "아군 액터 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("actor", actorRecordSchema, { id: "actor_hero", name: "주인공", classId: "class_hero", maxLevel: 99 }),
  run(draft, rawArgs): ToolExecResult {
    const repaired = repairRecordArgs("actor", "actor", rawArgs, actorRecordSchema, upsertActor.parameters);
    const args = repaired.args;
    const warnings: string[] = [...repaired.notes];
    expandShortParameterCurves(args.actor, "actor", warnings);
    const merged = mergeRecord(draft.database.actors, args.actor, "actor", actorRecordSchema, { id: "actor_hero", name: "주인공", classId: "class_hero" }, ["name", "classId"],
      (key) => key === "classId"
        ? `classId 는 직업 id 입니다 — 지금 있는 직업: ${knownIds(draft.database.classes, 12)}. 새 직업이 필요하면 upsert_class 로 먼저 만드세요(직업이 곧 능력치 곡선·전투 명령).`
        : undefined);
    const actorPatch = args.actor as Record<string, unknown>;
    if (typeof actorPatch.appearanceId === "string"
      && !draft.database.characterAppearances?.some((appearance) => appearance.id === actorPatch.appearanceId)) {
      throw new ToolError(`공유 캐릭터 외형을 찾을 수 없습니다: ${actorPatch.appearanceId}`, { code: "appearance-not-found" });
    }
    const record = normalizeActorRecord(merged as Parameters<typeof normalizeActorRecord>[0]);
    reconcileActorFace(record, actorPatch, warnings);
    validateActorTechPoints(args.actor);
    dropUnknownElementRates(draft, record, "actor", warnings);
    if (record.battleCommandIds) {
      const klass = draft.database.classes.find((entry) => entry.id === record.classId);
      const unknown = record.battleCommandIds.filter((id) =>
        !draft.database.battleCommands?.some((entry) => entry.id === id) && !klass?.battleCommands.some((entry) => entry.id === id));
      if (unknown.length > 0) warnings.push(`battleCommandIds 중 전역·직업 명령에 없는 id 는 전투 메뉴에서 빠집니다: ${unknown.join(", ")}`);
    }
    // 쌍둥이 곡선 갈아끼우기는 새 배우에만 — 이미 있는 배우의 이름만 고치는 부분 수정이 곡선을 바꾸면 안 된다
    // (2026-10-24 비교: {id,name} 만 보낸 개명이 주인공 maxHp 514→560 으로 바꿨다).
    const existed = draft.database.actors.some((entry) => entry.id === record.id);
    const twin = existed ? undefined : actorCurveTwin(draft.database.actors, record);
    if (twin && !("parameterCurves" in actorPatch)) {
      const roleHint = `${record.id} ${record.classId} ${record.name} ${record.nickname ?? ""}`;
      const preset = record.id === "actor_hero" || record.classId === "class_hero"
        ? { maxHp: [560, 5500], maxMp: [54, 480], attack: [84, 520], defense: [72, 460], mind: [64, 410], agility: [68, 430] }
        : /mage|cleric|wizard|sorcer|archmage|priest|shrine|마도|마법|성직|무녀|현자|치유/iu.test(roleHint)
          ? { maxHp: [410, 4000], maxMp: [96, 860], attack: [46, 300], defense: [50, 320], mind: [96, 600], agility: [62, 400] }
          : /guard|knight|paladin|tank|heavy|수호|기사|방패|중갑|기병/iu.test(roleHint)
            ? { maxHp: [640, 6200], maxMp: [28, 280], attack: [88, 540], defense: [92, 560], mind: [38, 260], agility: [44, 280] }
            : /scout|thief|ranger|ninja|archer|hunter|정찰|도적|궁수|닌자|사냥/iu.test(roleHint)
              ? { maxHp: [470, 4600], maxMp: [45, 420], attack: [76, 500], defense: [58, 380], mind: [52, 340], agility: [90, 580] }
              : { maxHp: [530, 5200], maxMp: [62, 540], attack: [74, 490], defense: [66, 430], mind: [70, 450], agility: [72, 460] };
      const expanded: Record<string, unknown> = { id: record.id, parameterCurves: preset };
      expandShortParameterCurves(expanded, "actor", warnings);
      if (expanded.parameterCurves) record.parameterCurves = expanded.parameterCurves as ActorRecord["parameterCurves"];
    }
    const outcome = upsertById(draft.database.actors, record satisfies ActorRecord);
    return {
      summary: `액터 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`,
      data: record,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

/**
 * 배우 얼굴을 걷기 그림의 짝과 맞춘다(reconcileFaceWithCharset). 두 경우를 본다:
 * - 조수가 faceResourceId 를 넘겼다 → 그 얼굴이 이 그림의 다른 인물이면 짝으로 바꾼다.
 * - 그림만 바꿨다 → 예전 그림의 짝 얼굴(또는 짝이 아닌 번들 얼굴)이 남아 있으면 새 그림의 짝으로 따라간다.
 *   업로드·생성 얼굴처럼 대응표 밖 얼굴은 작가가 고른 것이므로 둔다.
 */
function reconcileActorFace(record: ActorRecord, patch: Record<string, unknown>, warnings: string[]): void {
  if (!record.characterResourceId || !record.faceResourceId) return;
  const index = record.characterIndex ?? 0;
  const lookChanged = "characterResourceId" in patch || "characterIndex" in patch;
  if (!("faceResourceId" in patch) && !lookChanged) return;
  const reconciled = reconcileFaceWithCharset(record.faceResourceId, record.characterResourceId, index);
  if (!("faceResourceId" in patch) && reconciled.faceResourceId !== record.faceResourceId) {
    const next = reconciled.faceResourceId;
    warnings.push(`액터 '${record.name}': 걷기 그림을 바꿔 얼굴을 ${next ? `새 짝 ${next}` : "비움(이 그림에 맞는 얼굴 없음)"} 으로 맞췄습니다(이전 ${record.faceResourceId}).`);
    if (next) record.faceResourceId = next; else delete record.faceResourceId;
    return;
  }
  if (reconciled.warning) warnings.push(`액터 '${record.name}': ${reconciled.warning}`);
  if (reconciled.faceResourceId === null) delete record.faceResourceId;
  else record.faceResourceId = reconciled.faceResourceId;
}

const upsertSkill: ToolDefinition = {
  name: "upsert_skill",
  description: "스킬 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다. retro2003 전투에서는 새·복제 스킬에 retroChoreographyId 로 도트 연출을 빌려야 기본 베기로 안 보인다(list_retro_choreographies). 기믹 어휘·직업 설계 규칙은 read_retro_skill_guide.",
  mode: "write",
  parameters: parametersForRecord("skill", skillRecordSchema, { id: "skill_fire", name: "화염", power: 35, elementId: "fire" }, actionSkillClearProperties),
  run(draft, args): ToolExecResult {
    validateSkillCombatPatch(args.skill);
    validateSkillTechPatch(draft, args.skill);
    validateSkillRetroPatch(draft, args.skill);
    const weatherPatch = (args.skill as { weather?: unknown } | undefined)?.weather;
    if (weatherPatch !== undefined) validateSkillWeather(weatherPatch);
    const merged = mergeRecord(draft.database.skills, args.skill, "skill", skillRecordSchema, { id: "skill_fire", name: "화염" });
    finalizeSkillCombatPatch(merged as unknown as Record<string, unknown>, args.skill, args);
    const record = normalizeSkillRecord(merged as Partial<SkillRecord> & Pick<SkillRecord, "id" | "name">);
    const warnings: string[] = [];
    if (weatherPatch !== undefined && draft.system.battleModel !== "gen1") {
      warnings.push(`날씨는 전투 모델이 gen1 인 프로젝트(몬스터 수집 게임)에서만 작동합니다. 지금 battleModel 은 ${draft.system.battleModel ?? "기본(RM2K3)"} 이라 저장은 했지만 전투에서는 아무 효과가 없습니다.`);
    }
    validateSkillSpecialEffect(draft, record, warnings);
    dropUnknownAnimationId(draft, record, "skill", warnings);
    const outcome = upsertById(draft.database.skills, record);
    const auto = autoChoreographyNote(draft, record);
    return { summary: `스킬 '${record.name}' ${outcome === "added" ? "추가" : "수정"}${auto ? ` — ${auto}` : ""}`, data: record, ...(warnings.length ? { warnings } : {}) };
  },
};

/** weather 를 줬는데 모양이 틀리면 허용 값을 담아 거절한다(조용히 날씨 없는 기술이 되지 않게). */
function validateSkillWeather(value: unknown): void {
  const code = "invalid-skill-weather";
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError(`skill.weather 는 {kind, turns?} 객체여야 합니다 — kind 허용 값: ${SKILL_WEATHER_KINDS.join(", ")}.`, { code });
  }
  const entry = value as Record<string, unknown>;
  const unknownKeys = Object.keys(entry).filter((key) => key !== "kind" && key !== "turns");
  if (unknownKeys.length > 0) throw new ToolError(`skill.weather 의 모르는 키: ${unknownKeys.join(", ")} — 허용 키: kind, turns.`, { code });
  if (!SKILL_WEATHER_KINDS.includes(entry.kind as never)) {
    throw new ToolError(`skill.weather.kind '${String(entry.kind)}' 는 날씨 이름이 아닙니다 — 허용 값: ${SKILL_WEATHER_KINDS.join(", ")}.`, { code });
  }
  if (entry.turns !== undefined && !(typeof entry.turns === "number" && Number.isInteger(entry.turns) && entry.turns >= SKILL_WEATHER_MIN_TURNS && entry.turns <= SKILL_WEATHER_MAX_TURNS)) {
    throw new ToolError(`skill.weather.turns 는 ${SKILL_WEATHER_MIN_TURNS}~${SKILL_WEATHER_MAX_TURNS} 정수입니다. 받은 값: ${JSON.stringify(entry.turns)}.`, { code });
  }
}

/** FF6 특수 효과(스케치·폭주·대열 섞기·강제 교대)의 저작 오류는 거부하고 흔한 빠짐은 알린다. */
function validateSkillSpecialEffect(draft: Project, record: SkillRecord, warnings: string[]): void {
  const effect = record.effect;
  if (effect.kind === "rage") {
    for (const enemyId of effect.enemyIds ?? []) {
      if (!draft.database.enemies.some((enemy) => enemy.id === enemyId)) {
        throw new ToolError(`effect.enemyIds '${enemyId}' 는 없는 적입니다 — 먼저 upsert_enemy 로 만들거나 list_database(enemies) 로 id 를 확인하세요. 비우면 승리 때 모은 목록에서 고릅니다.`);
      }
    }
    if (!draft.database.states.some((state) => state.id === "state_rage")) {
      warnings.push("state_rage(폭주) 상태가 프로젝트에 없어 폭주가 상태 없이 전투 끝까지 이어집니다. 해제·표시가 필요하면 upsert_state({id:\"state_rage\", runtimeEffects:{forcedAction:\"rage\"}}) 로 만드세요.");
    }
    if (record.scope !== "self") warnings.push("폭주 기술은 scope \"self\" 가 자연스럽습니다(시전자가 몬스터 모습이 됨).");
  }
  if (effect.kind === "sketch" && record.scope !== "enemy") warnings.push("스케치 기술은 그릴 적을 고르므로 scope \"enemy\"(단일 적) 가 자연스럽습니다.");
  if ((effect.kind === "shuffleParty" || effect.kind === "forceSwitch") && record.scope === "self") {
    warnings.push(`${effect.kind} 는 적이 플레이어 파티를 흔드는 기술입니다 — scope 를 \"enemy\"/\"allEnemies\"(상대편) 로 하고 적의 행동(upsert_enemy.actions)에 넣으세요.`);
  }
}

/** 계약·연출 레코드·고정 레시피가 없는 스킬은 기전·속성·범위로 자동 배정된 연출을 쓴다. 그 결과를 알려 준다(바꾸려면 retroChoreographyId). */
function autoChoreographyNote(draft: Project, record: SkillRecord): string | undefined {
  if (record.retroChoreographyId || resolveSkillChoreography(record, draft.database.skillChoreographies) || RETRO_SKILL_RECIPES[record.id]) return undefined;
  const auto = recommendRetroChoreography(record);
  return auto ? `연출 자동 배정: ${auto.label} — 바꾸려면 retroChoreographyId` : undefined;
}

const upsertEquipment: ToolDefinition = {
  name: "upsert_equipment",
  description: "장비(무기/방어구) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("equipment", equipmentRecordSchema, { id: "equip_sword", name: "철검", slot: "weapon", statBonuses: { attack: 8 } }),
  run(draft, args): ToolExecResult {
    validateAutoRevive(args.equipment);
    validateEquipmentEsperPatch(draft, args.equipment);
    const merged = mergeRecord(draft.database.equipment, args.equipment, "equipment", equipmentRecordSchema, { id: "equip_sword", name: "철검", slot: "weapon" });
    const record = normalizeEquipmentRecord(merged as Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">);
    if (!hasEquipmentSlot(draft, record.slot)) {
      const slots = equipmentSlots(draft).map((slot) => slot.id).join("·");
      throw new ToolError(`Unknown equipment slot: ${record.slot} — 장비 부위가 없습니다. 먼저 upsert_equipment_slot({slots:[{id:"${record.slot}",label:"이름"}]}) 로 부위를 만든 뒤 다시 부르세요(유물 2칸은 id 둘 + 두 번째 칸의 equipsAs). 지금 있는 부위: ${slots}.`, { code: "unknown-equipment-slot" });
    }
    const warnings: string[] = [];
    if ((record.apGrants?.length ?? 0) > 0 && !draft.database.enemies.some((enemy) => (normalizeEnemyRecord(enemy).rewards.ap ?? 0) > 0)) {
      warnings.push("apGrants 는 설정했지만 AP 를 주는 적이 없습니다 — upsert_enemy 의 rewards.ap 를 정해야 마석이 자랍니다(승리 시 트룹 합계를 받음).");
    }
    resolveIconResourceId(draft, record, "equipment", warnings);
    dropUnknownEquipmentRestrictions(draft, record, warnings);
    const outcome = upsertById(draft.database.equipment, record);
    return { summary: `장비 '${record.name}'(${record.slot}) ${outcome === "added" ? "추가" : "수정"}`, data: record, ...(warnings.length ? { warnings } : {}) };
  },
};

const upsertEquipmentSlotTool: ToolDefinition = {
  name: "upsert_equipment_slot",
  description:
    "장비 부위(칸)를 만들거나 이름을 고치거나 지운다 — FF6 유물 2칸·마석 칸·신발 같은 부위. 기본 5칸(weapon·shield·helmet·armor·accessory)은 이름만 바꿀 수 있고 지울 수 없다. " +
    "이 도구로 부위를 만든 뒤에야 upsert_equipment(slot:<id>) 와 upsert_actor.initialEquipment 에 그 id 를 쓸 수 있다. " +
    "유물을 두 칸 어디에나 끼우게 하려면 slots:[{id:\"relic\",label:\"유물\"},{id:\"relic_2\",label:\"유물 2\",equipsAs:\"relic\"}] — equipsAs 칸에는 그 부위로 만든 장비도 들어간다. " +
    "장비 쪽은 upsert_equipment 로 slot:\"relic\" 인 장비를 만든다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      slots: arrayOf(objectSchema({
        id: stringSchema("부위 id(영문으로 시작, 영문·숫자·_-). 기본 5칸 id 는 이름만 바꾼다"),
        label: stringSchema("메뉴에 보일 이름"),
        equipsAs: stringSchema("이 칸이 대신 받아 줄 부위 id(이미 있는 부위). 빈 문자열이면 해제. 기본 5칸에는 못 건다"),
      }), "만들거나 고칠 부위 목록(순서대로 처리하므로 equipsAs 가 가리키는 부위를 앞에 둔다)"),
      removeIds: stringArraySchema("지울 부위 id. 장비·배우 초기장비·이벤트가 쓰는 칸은 지워지지 않는다(upsert_equipment 로 장비를 옮기거나 지운 뒤)"),
    },
    additionalProperties: false,
    description: '허용 예시: {"slots":[{"id":"relic","label":"유물"},{"id":"relic_2","label":"유물 2","equipsAs":"relic"}]}',
  },
  run(draft, args): ToolExecResult {
    const slots = Array.isArray(args.slots) ? args.slots as { id?: unknown; label?: unknown; equipsAs?: unknown }[] : [];
    const removeIds = Array.isArray(args.removeIds) ? args.removeIds as string[] : [];
    if (slots.length === 0 && removeIds.length === 0) {
      throw new ToolError('slots 또는 removeIds 가 필요합니다. 예: {"slots":[{"id":"relic","label":"유물"}]}', { code: "missing-db-field" });
    }
    const added: string[] = [];
    const updated: string[] = [];
    slots.forEach((entry, index) => {
      if (typeof entry?.id !== "string" || typeof entry?.label !== "string") {
        throw new ToolError(`slots[${index}] 는 {id, label} 문자열이 필요합니다.`, { code: "invalid-equipment-slot" });
      }
      for (const key of Object.keys(entry)) {
        if (!["id", "label", "equipsAs"].includes(key)) throw new ToolError(`slots[${index}].${key} 는 알 수 없는 칸입니다. 허용: id·label·equipsAs.`, { code: "unknown-field" });
      }
      try {
        const equipsAs = entry.equipsAs === undefined ? undefined : entry.equipsAs === "" ? null : String(entry.equipsAs);
        const outcome = upsertEquipmentSlot(draft, { id: entry.id, label: entry.label, equipsAs });
        (outcome === "added" ? added : updated).push(entry.id);
      } catch (error) {
        throw new ToolError(`slots[${index}] '${entry.id}': ${(error as Error).message}`, { code: "invalid-equipment-slot" });
      }
    });
    const removed: string[] = [];
    for (const id of removeIds) {
      const blocker = equipmentSlotRemovalBlocker(draft, id);
      if (blocker) {
        const why = blocker === "builtin" ? "기본 부위라 지울 수 없습니다" : blocker === "missing" ? "없는 부위입니다" : "장비·배우 초기장비·이벤트가 쓰고 있어 지울 수 없습니다(upsert_equipment 로 그 장비의 slot 을 바꾸거나 delete_database_record 로 지운 뒤 다시)";
        throw new ToolError(`removeIds '${id}': ${why}.`, { code: "equipment-slot-in-use" });
      }
      removeEquipmentSlot(draft, id);
      removed.push(id);
    }
    const all = equipmentSlots(draft).map((slot) => `${slot.id}(${slot.label}${slot.equipsAs ? `→${slot.equipsAs}` : ""})`);
    const parts = [added.length ? `추가 ${added.join(", ")}` : "", updated.length ? `수정 ${updated.join(", ")}` : "", removed.length ? `삭제 ${removed.join(", ")}` : ""].filter(Boolean);
    return { summary: `장비 부위 ${parts.join(" · ")} — 현재 ${all.join(" ")}`, data: { slots: equipmentSlots(draft) } };
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
    const rawAura = (args.state as { battleAura?: unknown } | undefined)?.battleAura;
    if (rawAura !== undefined && rawAura !== "" && !normalizeBattleAura(rawAura)) {
      throw new ToolError(`state.battleAura '${String(rawAura)}' 는 없는 오라입니다. 가능: ${BATTLE_AURA_IDS.join(", ")}, none`);
    }
    const record = normalizeStateRecord(mergeRecord(draft.database.states, args.state, "state", stateRecordSchema, { id: "state_poison", name: "독" }) as Partial<StateRecord> & Pick<StateRecord, "id" | "name">);
    const warnings: string[] = [];
    for (const skillId of record.runtimeEffects?.grantSkillIds ?? []) {
      if (!draft.database.skills.some((skill) => skill.id === skillId)) {
        throw new ToolError(`runtimeEffects.grantSkillIds '${skillId}' 는 없는 기술입니다 — 먼저 upsert_skill 로 만든 뒤 다시 부르세요.`);
      }
    }
    if ((record.volatileStatus || record.gen1MajorStatus) && draft.system.battleModel !== "gen1") {
      warnings.push(`${record.volatileStatus ? "volatileStatus(혼란)" : "gen1MajorStatus"} 는 전투 모델이 gen1 인 프로젝트(몬스터 수집 게임)에서만 작동합니다 — 지금 battleModel 은 ${draft.system.battleModel ?? "기본(RM2K3)"} 이라 이 상태는 일반 상태처럼만 동작합니다.`);
    }
    if (record.gen1MajorStatus === "toxic") warnings.push("맹독(toxic)은 차례 말마다 1/16 × (1,2,3…15) 피해가 커지고 교체하면 처음부터 셉니다. runtimeEffects.hpDamagePercentPerTurn 을 따로 주지 마세요(이중 피해). 보통 독은 gen1MajorStatus:\"poison\"(고정 1/16).");
    if (record.volatileStatus === "confusion") warnings.push("혼란(volatileStatus:\"confusion\")은 주요 상태와 겹쳐 걸리고 2~5 행동 지속, 행동마다 절반이 위력 40 자해로 행동을 잃으며 교체·전투 종료로 풀립니다. removalCondition 은 '전투 종료' 로 두세요.");
    if (record.runtimeEffects?.forcedAction === "rage") warnings.push("forcedAction rage 는 폭주(rage) 기술이 몬스터를 정한 배틀러에게만 작동합니다 — upsert_skill 로 effect.kind \"rage\" 기술을 만들어 이 상태를 걸게 하세요(기본 id state_rage 는 자동으로 걸림).");
    const outcome = upsertById(draft.database.states, record);
    return { summary: `상태 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record, ...(warnings.length ? { warnings } : {}) };
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
      summary: `커먼 이벤트 '${record.name}'(${trigger}) ${outcome === "added" ? "추가" : "수정"} — 런타임 제한 커맨드 ${unsupportedCommands}건`,
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
    const banned = unsuitableOpeningStillMessage(resourceId, `backgroundLayers[${index}].resourceId`);
    if (banned) throw new ToolError(banned, { code: "invalid-args" });
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
    if (layer.fit !== undefined && layer.fit !== "tile" && layer.fit !== "cover") {
      throw new ToolError(`backgroundLayers[${index}].fit 은 "tile" 또는 "cover" 입니다.`, { code: "invalid-args" });
    }
    return {
      resourceId,
      ...(layer.fit === "cover" ? { fit: "cover" as const } : {}),
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

const TITLE_PARTICLE_PRESETS = ["snow", "rain", "fireflies", "stars"] as const;

function parseTitleParticles(value: unknown): TitleParticleSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError("particles는 객체여야 합니다.", { code: "invalid-args" });
  }
  const particles = value as Record<string, unknown>;
  const preset = particles.preset;
  if (preset !== "snow" && preset !== "rain" && preset !== "fireflies" && preset !== "stars") {
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
/** 「bgm:easyrpg-music-…」「picture:…」처럼 종류 머리를 붙여 보낸 id 에서 머리를 뗀다(2026-10-28 deepseek 방탈출). */
function stripResourceKindPrefix(raw: string): string {
  return raw.trim().replace(/^(?:bgm|music|se|sound|picture|pictures|image|backdrop|title|resource|charset)\s*[:/]\s*/iu, "");
}

function requireTitleResource(draft: Project, field: string, id: string, kind: "picture" | "bgm" | "charset", hint = ""): string {
  const known = collectResourceIds(draft);
  if (known.has(id)) return id;
  const lower = id.toLowerCase();
  const sameIgnoringCase = [...known].find((candidate) => candidate.toLowerCase() === lower);
  if (sameIgnoringCase) return sameIgnoringCase;
  const stem = id.split(/[-_]/u).slice(0, 2).join("-");
  const near = [...known].filter((candidate) => stem && candidate.startsWith(stem)).slice(0, 6);
  throw new ToolError(
    `${field} '${id}' 는 없는 리소스입니다.${hint}${near.length > 0 ? ` 비슷한 실제 id: ${near.join(", ")}.` : ""} list_resources(kind:"${kind}") 로 실제 id 를 찾아 넣거나 이 필드를 빼세요.`,
    { code: "invalid-args" },
  );
}

const setTitleScreen: ToolDefinition = {
  name: "set_title_screen",
  description: "타이틀 화면 제목/메뉴/표시/오디오와 배경 레이어/파티클(별 stars 포함)/달리는 캐릭터 runners/PRESS START 관문/등장 연출, 오프닝 효과(빛내림·빛 알갱이·칼날 반사광·물결·안개)와 로고/메뉴 질감을 갱신한다. titleScreen이 없으면 생성한다. 새 키아트까지 한 번에 만들려면 generate_title_art 를 써라.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      menuLabels: {
        type: "object",
        description: "{ newGame, continueGame, resume, credits, quit } — credits 는 저작자 표기 창을 여는 항목(항상 보임). continueGame=저장 슬롯에서 불러오기, resume=자동 저장에서 바로 이어하기(자동 저장이 있을 때만 보임) — 둘은 함께, 서로 다른 말로 바꾼다(한쪽만 「…이어하기」로 바꾸면 타이틀에 「이어하기」가 두 줄 뜬다).",
        properties: {
          newGame: { type: "string" },
          continueGame: { type: "string" },
          resume: { type: "string" },
          credits: { type: "string" },
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
      backgroundResourceId: { type: "string", description: "titleScreen.background only; does not clear system.titleResourceId. 게임 맵·걷기 칩으로 지은 오프닝 애니메틱 컷의 한 순간을 타이틀 그림으로 쓰려면 \"opening-still:<컷 id>@<ms>\"(예: opening-still:shot_throne@2400) — 그림 파일 없이 플레이어가 그 컷을 그 시각으로 그려 쓴다. 타이틀 전용 컷이 필요하면 오프닝 도구로 컷을 만들고 그 id 를 준다" },
      musicResourceId: { type: "string" },
      backgroundLayers: {
        type: "array",
        description: `배경 레이어(뒤에서 앞 순서). 최대 ${MAX_TITLE_BACKGROUND_LAYERS}개. 별·구름은 scroll 로 흐르는 tile, 하늘을 오린 땅·전경 그림은 fit:"cover"(화면을 한 장으로 덮고 아래에 붙음).`,
        items: {
          type: "object",
          properties: {
            resourceId: { type: "string" },
            fit: { type: "string", enum: ["tile", "cover"], description: "tile(기본)=320×240 반복·스크롤, cover=한 장 전경(스크롤 무시)" },
            scrollXPerSec: { type: "number", minimum: -480, maximum: 480 },
            scrollYPerSec: { type: "number", minimum: -480, maximum: 480 },
            parallax: { type: "number", minimum: 0, maximum: 4 },
            opacity: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["resourceId"],
          additionalProperties: false,
        },
      },
      runners: {
        type: "array",
        description: `화면을 가로질러 달리는 캐릭터 칩(최대 ${MAX_TITLE_RUNNERS}) — 포켓몬 타이틀의 스타터 셋처럼. resourceId 는 24×32 캐릭터 시트(list_resources kind:"charset"; 몬스터 동료는 그 종의 필드 칩 시트), y 는 발끝(320×240 논리 px). 셋이 줄지어 달리게 하려면 같은 speed·everyMs 에 delayMs 를 400~700ms 씩 벌린다. 빈 배열이면 지운다.`,
        items: {
          type: "object",
          properties: {
            resourceId: { type: "string" },
            characterIndex: { type: "integer", minimum: 0, maximum: 7 },
            direction: { type: "string", enum: ["left", "right"] },
            y: { type: "integer", minimum: 0, maximum: 240 },
            speed: { type: "number", minimum: 10, maximum: 400 },
            scale: { type: "integer", minimum: 1, maximum: 3 },
            delayMs: { type: "integer", minimum: 0, maximum: 60000 },
            everyMs: { type: "integer", minimum: 2000, maximum: 120000 },
            hop: { type: "boolean" },
          },
          required: ["resourceId", "y"],
          additionalProperties: false,
        },
      },
      pressStart: {
        type: ["object", "null"],
        description: "「PRESS START」 관문: 메뉴를 숨기고 글자를 깜빡이다 첫 키·탭에 반짝이며 메뉴를 연다(첫 입력은 메뉴를 고르지 않는다). {} = 기본(PRESS START, 1초). null 이면 끈다.",
        properties: {
          text: { type: "string", maxLength: 24 },
          blinkMs: { type: "integer", minimum: 300, maximum: 3000 },
          y: { type: "integer", minimum: 0, maximum: 240 },
        },
        additionalProperties: false,
      },
      particles: {
        type: "object",
        description: "타이틀 입자. stars = 깜빡이며 천천히 흐르는 밤하늘 별 + 가끔 별똥별.",
        properties: {
          preset: { type: "string", enum: TITLE_PARTICLE_PRESETS },
          density: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["preset"],
        additionalProperties: false,
      },
      openingPreset: {
        type: "string",
        enum: TITLE_OPENING_PRESETS.map((preset) => preset.id),
        description: "오프닝 프리셋. effects·logoStyle·menuStyle·sequence·logoShine·transition 을 프리셋 값으로 채운다(같은 호출의 명시 인자가 이긴다). 좌표는 프리셋 구도 기준이라 배경 그림이 다르면 effects 를 직접 맞춰라.",
      },
      effects: {
        type: "array",
        description:
          `배경 그림 위 영역 효과(WebGL). 최대 ${MAX_TITLE_EFFECTS}개, 목록 순서대로 칠한다. 좌표는 배경 그림 기준 0..1 (화면 밖 광원은 -0.5..1.5). `
          + "godRays/motes: source(광원)+toward(빛 방향), spread(반폭 각). motes 는 region 으로도 된다. glint: line [[x,y],[x,y]] 칼날 따라 반사광, periodSec. "
          + "water/mist/dapple: region 다각형(3~8점). glow: source 한 점 깜빡임, spread 반지름. camera: 전체 화면 느린 흔들림. "
          + "parallax: 깊이 시차 — depthResourceId(흑백 깊이 지도, 흰색=가까움)로 가까운 것과 먼 것을 다르게 움직인다. 없으면 아래쪽을 가깝게 본다. 빈 배열이면 효과를 지운다.",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: TITLE_EFFECT_KINDS },
            enabled: { type: "boolean" },
            intensity: { type: "number", minimum: 0, maximum: 2 },
            speed: { type: "number", minimum: 0, maximum: 4 },
            color: { type: "string", description: "#rrggbb" },
            source: { type: "array", items: { type: "number" }, description: "[x, y] 그림 기준 0..1(빛 근원은 -0.5..1.5)" },
            toward: { type: "array", items: { type: "number" }, description: "[x, y]" },
            spread: { type: "number", minimum: 0.02, maximum: 1 },
            line: { type: "array", items: { type: "array", items: { type: "number" } }, description: "[[x, y], [x, y]] 칼날 두 끝" },
            periodSec: { type: "number", minimum: 1, maximum: 60 },
            region: { type: "array", items: { type: "array", items: { type: "number" } }, description: `[[x, y], ...] 꼭짓점 3~${MAX_TITLE_EFFECT_REGION_POINTS}개` },
            count: { type: "integer", minimum: 0, maximum: MAX_TITLE_MOTES },
            depthResourceId: { type: "string", description: "parallax 전용: 깊이 지도 리소스 id(흰색=가까움)" },
          },
          required: ["kind"],
          additionalProperties: false,
        },
      },
      backgroundFit: { type: "string", enum: TITLE_BACKGROUND_FITS, description: "배경 맞춤. 기본 cover(비율 유지해 채움). stretch 는 레거시." },
      backgroundRendering: { type: "string", enum: TITLE_BACKGROUND_RENDERINGS, description: "smooth(그린 키아트) | pixelated(도트 배경)" },
      logoStyle: { type: "string", enum: TITLE_LOGO_STYLES, description: "제목 글자 질감. 지정하면 기본 편집 문구(A NEW ADVENTURE)를 숨긴다." },
      logoSubtitle: { type: "string", description: "제목 아래 부제. 적으면 기본 문구(A NEW ADVENTURE)를 대신해 제목 아래에 나온다. 로고 질감이 없어도 보인다. 빈 문자열이면 해제." },
      menuStyle: { type: "string", enum: TITLE_MENU_STYLES, description: "window(창) | plain(키아트 위 글자 메뉴)" },
      menuFontPx: { type: "integer", minimum: 10, maximum: 24, description: "타이틀 메뉴 글자 크기(논리 px 10~24). 생략·0 = 스킨 기본(11px). 넓은 화면(480 폭 이상)이나 큰 키아트 위 글자 메뉴는 14~18 이 읽기 좋다. CSS 를 고치지 말고 이 값으로." },
      sequence: {
        type: ["object", "null"],
        description:
          "첫 진입 입장 시퀀스: 검은 화면이 fadeMs 에 걸쳐 걷히고, 배경이 (1+push)배에서 1배로 밀려 들어오고, 로고 직전 빛 띠(sweep)가 훑고, logoAtMs 에 로고(logoReveal), menuAtMs 에 메뉴. "
          + "아무 키·클릭이면 건너뛴다. {} = 전부 기본값(1600ms·0.08·bloom·로고 1100ms·메뉴 2200ms). null 이면 끈다(레거시 intro 만).",
        properties: {
          fadeMs: { type: "integer", minimum: 0, maximum: 6000 },
          push: { type: "number", minimum: 0, maximum: 0.3 },
          sweep: { type: "boolean" },
          logoAtMs: { type: "integer", minimum: 0, maximum: 10000 },
          logoReveal: { type: "string", enum: TITLE_SEQUENCE_LOGO_REVEALS },
          menuAtMs: { type: "integer", minimum: 0, maximum: 12000 },
        },
        additionalProperties: false,
      },
      logoShine: { type: "string", enum: TITLE_LOGO_SHINES, description: "로고 표면 반사광. once = 등장 직후 한 번, loop = 6초마다, none = 끔." },
      transition: {
        type: ["object", "null"],
        description: "「새 게임」을 고른 뒤 게임으로 넘어가는 전환. flash(흰 섬광) | fade(검게) | zoom(화면 속으로 빨려 듦) | mist(안개). null 이면 끈다.",
        properties: {
          kind: { type: "string", enum: TITLE_TRANSITION_KINDS },
          durationMs: { type: "integer", minimum: 200, maximum: 3000 },
        },
        required: ["kind"],
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
    const previousTitles = [draft.meta.title, draft.system.titleScreen?.title ?? ""];
    if (requestedTitle !== undefined) draft.meta = { ...draft.meta, title: requestedTitle };
    draft.system.titleScreen ??= defaultTitleScreenSettings();
    const current = draft.system.titleScreen;
    if (requestedTitle !== undefined) {
      current.title = requestedTitle;
      // 씨앗이 남긴 제목 카드 한 장(「— 새 게임 —」)이면 오프닝 글자도 새 제목으로 옮긴다 — 저작된 오프닝은 그대로.
      const retitled = retitlePlaceholderOpening(draft.system.opening, previousTitles, requestedTitle);
      if (retitled) draft.system.opening = retitled;
    }

    const labels = args.menuLabels as Partial<typeof current.menuLabels> | undefined;
    if (labels) current.menuLabels = { ...current.menuLabels, ...labels };
    // 불러오기(continueGame)만 「…이어하기」로 바꾸면 자동 저장 재개(resume, 기본 「이어하기」)와 두 줄이 같은 말이 된다(2026-10-25 J34
    // 「이어하기」·「기억 이어하기」). resume 을 따로 주지 않았으면 겹치지 않는 말로 채운다.
    const labelNotes: string[] = [];
    if (labels?.continueGame && !labels.resume && !current.menuLabels.resume?.trim() && /이어/u.test(labels.continueGame)) {
      current.menuLabels = { ...current.menuLabels, resume: "방금 하던 곳부터" };
      labelNotes.push("불러오기 이름이 「이어하기」와 겹쳐 자동 저장 재개 이름을 「방금 하던 곳부터」로 정했다 — 바꾸려면 menuLabels.resume 을 함께 준다");
    }

    const visibility = args.menuVisibility as Partial<{ newGame: boolean; continueGame: boolean; quit: boolean }> | undefined;
    if (visibility) {
      current.menuVisibility = {
        newGame: true,
        continueGame: visibility.continueGame === false ? false : visibility.continueGame === true ? true : current.menuVisibility?.continueGame !== false,
        quit: visibility.quit === false ? false : visibility.quit === true ? true : current.menuVisibility?.quit !== false,
      };
    }

    // 청사진(게임 장르·장소)에 맞는 번들 그림 — 빈 배경·못 쓰는 그림·없는 id 를 받았을 때 고칠 방법 한 줄로 쓴다.
    const blueprintArt = pickBlueprintTitleArt(draft);
    const artHint = blueprintArt ? ` 이 게임(청사진)에는 backgroundResourceId:'${blueprintArt.id}'(${blueprintArt.name})가 맞다.` : "";
    if (typeof args.backgroundResourceId === "string") {
      const background = stripResourceKindPrefix(args.backgroundResourceId);
      if (background) {
        const still = parseOpeningStill(background);
        if (still) {
          const scene = findOpeningStillScene(draft, still.sceneId);
          if (!scene) {
            const shots = [...(draft.system.opening?.scenes ?? []), ...(draft.system.titleIntro?.scenes ?? [])].filter((entry) => entry.kind === "animatic").map((entry) => entry.id);
            throw new ToolError(`backgroundResourceId '${background}': 애니메틱 컷 '${still.sceneId}' 가 오프닝·타이틀 인트로에 없습니다.${shots.length ? ` 있는 컷: ${shots.join(", ")}` : " 오프닝 애니메틱 컷을 먼저 만드세요."}`, { code: "invalid-args" });
          }
          if (still.atMs > scene.durationMs) throw new ToolError(`backgroundResourceId '${background}': @${still.atMs}ms 가 컷 길이 ${scene.durationMs}ms 를 넘습니다.`, { code: "invalid-args" });
          current.backgroundResourceId = background;
        } else {
          const banned = unsuitableOpeningStillMessage(background, "backgroundResourceId");
          if (banned) throw new ToolError(blueprintArt ? `backgroundResourceId '${background}' 는 타이틀에 못 쓰는 그림이다 —${artHint}` : banned, { code: "invalid-args" });
          current.backgroundResourceId = requireTitleResource(draft, "backgroundResourceId", background, "picture", artHint);
        }
      } else if (blueprintArt) {
        // 빈 값 = «지금 그림을 치워 달라». 지우기만 하면 시스템 기본 그림(눈 덮인 산촌)이 다시 나온다(2026-10-28 argon 방탈출) — 청사진 그림으로 바꾼다.
        current.backgroundResourceId = blueprintArt.id;
        current.backgroundFit ??= "cover";
        labelNotes.push(`배경을 비우면 기본 눈 마을 그림이 나와 청사진에 맞는 「${blueprintArt.name}」(${blueprintArt.id})로 바꿨다`);
      } else {
        delete current.backgroundResourceId;
        if (draft.system.titleResourceId) labelNotes.push(`배경을 비워 시스템 기본 그림(${draft.system.titleResourceId})이 나온다 — 다른 그림은 list_resources{kind:'backdrop'} 에서 골라 backgroundResourceId 로 준다`);
      }
    }

    if (typeof args.musicResourceId === "string") {
      const music = stripResourceKindPrefix(args.musicResourceId);
      if (music) current.musicResourceId = requireTitleResource(draft, "musicResourceId", music, "bgm");
      else delete current.musicResourceId;
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
      const backgroundId = typeof args.backgroundResourceId === "string" ? args.backgroundResourceId : current.backgroundResourceId;
      if (resourceId && (resourceId === backgroundId || /^title_art_/u.test(resourceId))) {
        throw new ToolError("titleGraphic.resourceId는 투명 배경의 로고 그림 전용입니다. 배경 키아트(title_art_*)를 로고로 한 번 더 얹으면 왼쪽 위에 배경이 작게 중복됩니다. 로고 그림이 없으면 mode:\"text\"로 두세요.", { code: "invalid-args" });
      }
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

    // 키아트(title_art_*)는 배경 전용 — 이전 판이 로고 그림으로 남아 있으면 배경이 왼쪽 위에 작게 중복된다.
    if (current.titleGraphic?.resourceId && /^title_art_/u.test(current.titleGraphic.resourceId)) delete current.titleGraphic;

    if ("backgroundLayers" in args) {
      const layers = parseTitleBackgroundLayers(args.backgroundLayers);
      if (layers.length === 0) delete current.backgroundLayers;
      else {
        registerTitleLayerResourceIds(draft, layers);
        current.backgroundLayers = layers;
      }
    }

    if ("particles" in args) current.particles = parseTitleParticles(args.particles);
    if ("runners" in args) {
      if (!Array.isArray(args.runners)) throw new ToolError("runners 는 배열이어야 합니다.", { code: "invalid-args" });
      const runners = normalizeTitleRunners(args.runners as never) ?? [];
      for (const [index, runner] of runners.entries()) requireTitleResource(draft, `runners[${index}].resourceId`, runner.resourceId, "charset");
      if (runners.length < args.runners.length) throw new ToolError(`runners 중 ${args.runners.length - runners.length}개가 버려졌습니다(resourceId·y 필수, 최대 ${MAX_TITLE_RUNNERS}).`, { code: "invalid-args" });
      if (runners.length === 0) delete current.runners;
      else current.runners = runners;
    }
    if ("pressStart" in args) {
      if (args.pressStart === null) delete current.pressStart;
      else current.pressStart = normalizeTitlePressStart(args.pressStart as never) ?? {};
    }
    if ("intro" in args) {
      const intro = parseTitleIntro(args.intro);
      if (Object.keys(intro).length === 0) delete current.intro;
      else current.intro = intro;
    }

    const opening = applyTitleOpeningArgs(current, args, draft);

    return { summary: `타이틀 화면 설정: "${current.title}"${opening}${labelNotes.length ? ` · ${labelNotes.join(" · ")}` : ""}` };
  },
};

/** set_title_screen 의 오프닝 인자(프리셋·효과·로고/메뉴 질감·배경 맞춤). 요약 꼬리 문자열을 돌려준다. */
function applyTitleOpeningArgs(current: TitleScreenSettings, args: Record<string, unknown>, project?: Project): string {
  const notes: string[] = [];
  if (typeof args.openingPreset === "string") {
    const preset = findTitleOpeningPreset(args.openingPreset);
    if (!preset) {
      throw new ToolError(
        `openingPreset '${args.openingPreset}' 는 없습니다. 가능: ${TITLE_OPENING_PRESETS.map((item) => item.id).join(", ")}`,
        { code: "invalid-args" },
      );
    }
    // 프리셋 효과(물·안개·빛내림 자리)는 그 프리셋으로 그린 키아트의 구도 좌표다. 배경이 다른 그림이면 엉뚱한 곳에 물결·안개가 뜬다
    // (2026-10-25 G41: 장난감 가게 게임에 「달밤 성」 해자 물결이 기본 들판 그림 위에 깔렸다) — 그때는 자리 없는 효과만 남긴다.
    const bg = current.backgroundResourceId;
    const bgName = bg ? String(project?.assets.uploaded[bg]?.name ?? "") : "";
    const drawnForPreset = bgName.includes(preset.label) || bgName.includes(preset.id);
    const presetEffects = titleOpeningPresetEffects(preset);
    current.effects = drawnForPreset ? presetEffects : presetEffects.filter((effect) => effect.kind === "camera" || effect.kind === "parallax");
    if (!drawnForPreset) notes.push(`배경이 「${preset.label}」 프리셋 그림이 아니라 물결·안개·빛내림 자리를 뺐다(구도가 다르다) — 게임 주제에 맞는 배경을 깔고, 효과는 그 그림을 보고 effects 로 직접 준다. 주제와 다른 프리셋(성·항구·사막…)을 고르지 않는다`);
    current.logoStyle = preset.logoStyle;
    current.menuStyle = preset.menuStyle;
    current.sequence = { ...preset.sequence };
    if (preset.logoShine === "none") delete current.logoShine;
    else current.logoShine = preset.logoShine;
    current.transition = { ...preset.transition };
    notes.push(`프리셋 ${preset.label}`);
  }
  if ("effects" in args) {
    if (!Array.isArray(args.effects)) throw new ToolError("effects 는 배열이어야 합니다.", { code: "invalid-args" });
    const effects = normalizeTitleEffects(args.effects) ?? [];
    const dropped = args.effects.length - effects.length;
    if (dropped > 0 && effects.length === 0 && args.effects.length > 0) {
      throw new ToolError(
        "effects 가 모두 버려졌습니다. kind 와 그 kind 에 필요한 좌표(godRays·motes: source+toward, glint: line, water·mist·dapple: region 3점 이상, glow: source)를 확인하세요.",
        { code: "invalid-args" },
      );
    }
    if (effects.length === 0) delete current.effects;
    else current.effects = effects;
    notes.push(`효과 ${effects.length}개${dropped > 0 ? `(형식이 틀린 ${dropped}개 버림)` : ""}`);
  }
  const fit = normalizeTitleBackgroundFit(args.backgroundFit);
  if (fit) current.backgroundFit = fit;
  const rendering = normalizeTitleBackgroundRendering(args.backgroundRendering);
  if (rendering) current.backgroundRendering = rendering;
  if ("logoStyle" in args) {
    const style = normalizeTitleLogoStyle(args.logoStyle);
    if (style) current.logoStyle = style;
    else delete current.logoStyle;
  }
  if ("logoSubtitle" in args) {
    const subtitle = normalizeTitleLogoSubtitle(args.logoSubtitle);
    if (subtitle) current.logoSubtitle = subtitle;
    else delete current.logoSubtitle;
  }
  if ("menuStyle" in args) {
    const style = normalizeTitleMenuStyle(args.menuStyle);
    if (style) current.menuStyle = style;
    else delete current.menuStyle;
  }
  if ("menuFontPx" in args) {
    // 정본 범위는 titleEffects normalize(10..24) — 저장 직후 읽어도 같은 값이 되도록 여기서도 같은 규칙으로 자른다.
    const px = typeof args.menuFontPx === "number" && Number.isFinite(args.menuFontPx) && args.menuFontPx > 0 ? Math.min(24, Math.max(10, Math.round(args.menuFontPx))) : undefined;
    if (px) current.menuFontPx = px;
    else delete current.menuFontPx;
    notes.push(px ? `메뉴 글자 ${px}px` : "메뉴 글자 기본 크기");
  }
  if ("sequence" in args) {
    const sequence = normalizeTitleOpeningSequence(args.sequence);
    if (sequence) current.sequence = sequence;
    else delete current.sequence;
    notes.push(sequence ? "입장 시퀀스 켬" : "입장 시퀀스 끔");
  }
  if ("logoShine" in args) {
    const shine = normalizeTitleLogoShine(args.logoShine);
    if (shine) current.logoShine = shine;
    else delete current.logoShine;
  }
  if ("transition" in args) {
    const transition = normalizeTitleTransition(args.transition);
    if (transition) current.transition = transition;
    else delete current.transition;
    notes.push(transition ? `새 게임 전환 ${transition.kind}` : "새 게임 전환 끔");
  }
  if (current.effects?.length && !current.backgroundResourceId) {
    notes.push("주의: 배경 그림이 없으면 효과는 보이지 않는다");
  }
  return notes.length ? ` · ${notes.join(" · ")}` : "";
}

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
  // 한 마리씩 앞모습·속성·설명을 보여 주고 「정할까요?」 확인을 거친다(starterChoice.ts).
  const chooseCommands = starterChoiceCommands(project, {
    speciesIds: input.speciesIds,
    prompt: "처음 함께할 몬스터를 고르세요.",
    afterGive: (_speciesId, name) => [
      { kind: "text", body: `${withJosa(name, "와/과")} 함께 여행을 시작합니다.` },
      { kind: "setSelfSwitch", key: "A", value: true },
    ],
  });
  // 첫 파트너를 주는 사람은 화면에 보여야 한다 — 예전에는 두 페이지 모두 transparent 라 마을에
  // 아무도 서 있지 않았고, 플레이어는 빈 타일을 조사해야 대화를 찾았다(2026-10-23 필드 QA F2).
  const graphic = starterNpcGraphic(project, input.name);
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
        graphic,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: chooseCommands,
      },
      {
        id: `${input.eventId}_claimed`,
        name: `${input.name} 완료`,
        conditions: [{ kind: "selfSwitch", key: "A", value: true }],
        graphic,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  };
}

/**
 * 스타팅 NPC 의 걷기 그림. 이름으로 먼저 찾고(「박사」·「간호사」), 못 찾으면 주민 칩으로 물러선다.
 * 장르 잠금이 켜져 있으면 허용 칩 안에서만 고른다 — 잠금 밖 칩을 넣으면 커밋이 거부된다.
 * 아무것도 못 고르면 투명으로 물러선다(도구를 실패시키지 않는다 — 예전 동작과 같다).
 */
function starterNpcGraphic(project: Project, name: string): EventPageGraphic {
  const filter = genreLockCharsetCatalogFilter(project);
  for (const query of [name, "villager"]) {
    try {
      const graphic = withNpcGraphicCatalogFilter(filter, () => resolveGraphic({ query }, { overrides: project.charsetLabels, seed: `starter:${name}` }));
      if (graphic.sprite) return graphic;
    } catch { /* 다음 후보 */ }
  }
  return { transparent: true };
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
  description: "전투 애니메이션 레코드를 등록/수정한다. Database 애니메이션 탭과 같은 저작 데이터. 기존 이펙트의 겹치기(blendMode)만 바꿀 때도 id·name 과 함께 부른다.",
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
          blendMode: {
            type: "string",
            enum: ["normal", "add", "screen", "multiply"],
            description: "겹치기. 마법 빛·불꽃·번개는 add(아래 배틀러·배경을 밝힌다), 부드러운 빛은 screen, 어둠·저주는 multiply.",
          },
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
    if (isBlendModeName(record.blendMode)) {
      const blendMode = normalizeBlendMode(record.blendMode);
      if (blendMode) animation.blendMode = blendMode;
      else delete animation.blendMode;
    }
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
  upsertEquipmentSlotTool,
  upsertClass,
  definePromotion,
  upsertState,
  upsertCommonEvent,
  upsertBattleAnimation,
  setSessionStart,
  setTitleScreen,
];
