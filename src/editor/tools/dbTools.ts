// editor/tools/dbTools.ts
// DB 쓰기 툴: upsert_item / upsert_enemy / upsert_troop / upsert_actor / upsert_skill
//            / upsert_equipment / upsert_class / define_promotion / upsert_state / upsert_common_event
//            / set_session_start / set_title_screen.
// 모든 레코드는 기존 레코드와 병합한 뒤 normalize* 계열을 거쳐 id로 upsert한다.

import { normalizeActorRecord } from "@/project/actorModel";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { countLimitedRuntimeSupportCommands } from "@/project/lint/projectLint";
import type {
  ActorRecord,
  ClassRecord,
  Command,
  CommonEvent,
  EnemyRecord,
  EquipmentRecord,
  GameEvent,
  ItemRecord,
  MonsterSpeciesRecord,
  Project,
  SkillRecord,
  StateRecord,
  TroopRecord,
} from "@/project/types";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

// id 기준으로 배열에 upsert.
function upsertById<T extends { id: string }>(list: T[], record: T): "added" | "modified" {
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index >= 0) {
    list[index] = record;
    return "modified";
  }
  list.push(record);
  return "added";
}

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
});
const expCurveSchema = objectSchema({ base: integerSchema(), extra: integerSchema(), acceleration: integerSchema() });
const actorInitialEquipmentSchema = objectSchema({
  weapon: stringSchema(),
  shield: stringSchema(),
  armor: stringSchema(),
  helmet: stringSchema(),
  accessory: stringSchema(),
});
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
const captureProfileSchema = objectSchema({ multiplier: numberSchema("포획 확률 배율. 생략 시 1") });
const enemyStatsSchema = objectSchema({ maxHp: integerSchema(), maxMp: integerSchema(), attack: integerSchema(), defense: integerSchema(), mind: integerSchema(), agility: integerSchema() });
const enemyRewardsSchema = objectSchema({ exp: integerSchema(), gold: integerSchema(), dropItemId: stringSchema(), dropRatePercent: integerSchema() });
const enemyActionSwitchSchema = objectSchema({ enabled: booleanSchema(), switchId: stringSchema() });
const enemyActionSchema = objectSchema({
  skillId: stringSchema(),
  priority: integerSchema(),
  condition: objectSchema({ kind: stringSchema(), start: integerSchema(), interval: integerSchema() }),
  switchOnAfterAction: enemyActionSwitchSchema,
  switchOffAfterAction: enemyActionSwitchSchema,
});
const troopMemberSchema = objectSchema({ enemyId: stringSchema(), x: integerSchema(), y: integerSchema(), hidden: booleanSchema() });
const stateRuntimeEffectsSchema = objectSchema({
  restrictsAction: booleanSchema(),
  hpDamagePercentPerTurn: numberSchema(),
  attackMultiplier: numberSchema(),
  defenseMultiplier: numberSchema(),
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
  captureProfile: captureProfileSchema,
}) as RecordSchema;

const enemyRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  speciesId: stringSchema(),
  monsterResourceId: stringSchema(),
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
  previewBackgroundResourceId: stringSchema(),
  battleFlow: { type: "string", enum: ["gauge", "strict"] },
  activeSlots: integerSchema(),
  battleEventPages: { type: "array", description: "BattleEventPageRecord[]", items: { type: "object", additionalProperties: true } },
}) as RecordSchema;

const monsterSpeciesGraphicSchema = objectSchema({
  monsterResourceId: stringSchema(),
  graphicHue: integerSchema(),
  transparent: booleanSchema(),
  flying: booleanSchema(),
});

const monsterSpeciesRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  graphic: monsterSpeciesGraphicSchema,
  baseStats: enemyStatsSchema,
  expCurve: expCurveSchema,
  captureRate: numberSchema("0~1"),
  skillsByLevel: arrayOf(learnedSkillSchema),
}) as RecordSchema;

const actorRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  nickname: stringSchema(),
  classId: stringSchema(),
  initialLevel: integerSchema(),
  maxLevel: integerSchema(),
  faceResourceId: stringSchema(),
  characterResourceId: stringSchema(),
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
  id: stringSchema(),
  name: stringSchema(),
  scope: { type: "string", enum: ["self", "ally", "enemy", "allEnemies"] },
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
}) as RecordSchema;

const equipmentRecordSchema = objectSchema({
  id: stringSchema(),
  name: stringSchema(),
  imageResourceId: stringSchema(),
  iconResourceId: stringSchema(),
  slot: { type: "string", enum: ["weapon", "shield", "armor", "helmet", "accessory"] },
  price: integerSchema(),
  skillId: stringSchema(),
  description: stringSchema(),
  statBonuses: statBonusesSchema,
  equippableActorIds: stringArraySchema(),
  equippableClassIds: stringArraySchema(),
  cursed: booleanSchema(),
  twoHanded: booleanSchema(),
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

function parametersForRecord(key: string, schema: RecordSchema, example: Record<string, unknown>): JsonSchema {
  return {
    type: "object",
    properties: { [key]: { ...schema, description: `${key} 부분 레코드. 기존 id 수정은 id와 바꿀 필드만 보내면 됩니다.` } },
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
  return { ...(existing ?? {}), ...(patch as Partial<T> & Pick<T, "id" | "name">) };
}

const upsertItem: ToolDefinition = {
  name: "upsert_item",
  description: "아이템 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("item", itemRecordSchema, { id: "item_potion", name: "회복약", price: 120, hpRecovery: { flat: 80, percentMax: 0 } }),
  run(draft, args): ToolExecResult {
    const merged = mergeRecord(draft.database.items, args.item, "item", itemRecordSchema, { id: "item_potion", name: "회복약" });
    const record = normalizeItemRecord(merged as Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">);
    const outcome = upsertById(draft.database.items, record);
    return { summary: `아이템 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const upsertEnemy: ToolDefinition = {
  name: "upsert_enemy",
  description: "적 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("enemy", enemyRecordSchema, { id: "enemy_slime", name: "슬라임", stats: { maxHp: 40, attack: 12 }, rewards: { exp: 3, gold: 2 } }),
  run(draft, args): ToolExecResult {
    const merged = mergeRecord(draft.database.enemies, args.enemy, "enemy", enemyRecordSchema, { id: "enemy_slime", name: "슬라임" });
    const record = normalizeEnemyRecord(merged as Partial<EnemyRecord> & Pick<EnemyRecord, "id" | "name">);
    const outcome = upsertById(draft.database.enemies, record);
    return { summary: `적 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const upsertTroop: ToolDefinition = {
  name: "upsert_troop",
  description: "적 그룹(트룹) 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("troop", troopRecordSchema, { id: "troop_slime", name: "슬라임 무리", enemyIds: ["enemy_slime"] }),
  run(draft, args): ToolExecResult {
    const merged = mergeRecord(draft.database.troops, args.troop, "troop", troopRecordSchema, { id: "troop_slime", name: "슬라임 무리", enemyIds: ["enemy_slime"] }, ["name", "enemyIds"]);
    const record = normalizeTroopRecord(merged as Partial<TroopRecord> & Pick<TroopRecord, "id" | "name">);
    const memberCount = record.members?.length ?? record.enemyIds.length;
    if (memberCount === 0) throw new ToolError("트룹에는 최소 1마리의 적(enemyIds/members)이 필요합니다.", { code: "troop-empty" });
    const enemyIds = new Set(draft.database.enemies.map((enemy) => enemy.id));
    const missing = [...new Set(record.enemyIds.filter((enemyId) => !enemyIds.has(enemyId)))];
    if (missing.length > 0) {
      throw new ToolError(`존재하지 않는 enemyId: ${missing.join(", ")} — 허용 예시: ${knownIds(draft.database.enemies)}`, { code: "enemy-not-found" });
    }
    const outcome = upsertById(draft.database.troops, record);
    return { summary: `트룹 '${record.name}'(${memberCount}마리) ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const defineMonsterSpecies: ToolDefinition = {
  name: "define_monster_species",
  description: "몬스터 species 레코드를 등록/수정한다. EnemyRecord와 별개이며 enemy.speciesId가 포획 시 이 레코드를 가리킨다.",
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
    const record = normalizeMonsterSpeciesRecord(merged as Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">);
    const skillIds = new Set(draft.database.skills.map((skill) => skill.id));
    const missingSkills = (record.skillsByLevel ?? []).filter((entry) => !skillIds.has(entry.skillId)).map((entry) => entry.skillId);
    if (missingSkills.length > 0) {
      throw new ToolError(`존재하지 않는 species skillId: ${[...new Set(missingSkills)].join(", ")} — 허용 예시: ${knownIds(draft.database.skills)}`, { code: "skill-not-found" });
    }
    const outcome = upsertById(draft.database.monsterSpecies, record);
    return { summary: `몬스터 species '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
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
    const event = starterMonsterEvent(draft, {
      mapId,
      eventId,
      x: eventArgs.x ?? Math.min(map.width - 1, draft.startPos.x + 1),
      y: eventArgs.y ?? draft.startPos.y,
      name: eventArgs.name ?? "스타팅 몬스터",
      speciesIds,
    });
    const index = map.events.findIndex((entry) => entry.id === eventId);
    if (index >= 0) map.events[index] = event;
    else map.events.push(event);
    return {
      summary: `스타팅 몬스터 선택 이벤트 '${event.id}' 생성(${speciesIds.length}종)`,
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
    const merged = mergeRecord(draft.database.actors, args.actor, "actor", actorRecordSchema, { id: "actor_hero", name: "주인공", classId: "class_hero" }, ["name", "classId"]);
    const record = normalizeActorRecord(merged as Parameters<typeof normalizeActorRecord>[0]);
    const outcome = upsertById(draft.database.actors, record satisfies ActorRecord);
    return { summary: `액터 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const upsertSkill: ToolDefinition = {
  name: "upsert_skill",
  description: "스킬 레코드를 등록/수정한다. 기존 id는 전달 필드만 병합하고 나머지를 보존한다.",
  mode: "write",
  parameters: parametersForRecord("skill", skillRecordSchema, { id: "skill_fire", name: "화염", power: 35, elementId: "fire" }),
  run(draft, args): ToolExecResult {
    const merged = mergeRecord(draft.database.skills, args.skill, "skill", skillRecordSchema, { id: "skill_fire", name: "화염" });
    const record = normalizeSkillRecord(merged as Partial<SkillRecord> & Pick<SkillRecord, "id" | "name">);
    const outcome = upsertById(draft.database.skills, record);
    return { summary: `스킬 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
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
    const merged = mergeRecord(draft.database.classes, args.class, "class", classRecordSchema, { id: "class_mage", name: "마법사" });
    const record = normalizeClassRecord(merged as Partial<ClassRecord> & Pick<ClassRecord, "id" | "name">);
    const outcome = upsertById(draft.database.classes, record);
    return { summary: `클래스 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
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
    const record = mergeRecord(draft.database.states, args.state, "state", stateRecordSchema, { id: "state_poison", name: "독" }) as StateRecord;
    const outcome = upsertById(draft.database.states, record);
    return { summary: `상태 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: record };
  },
};

const COMMON_EVENT_TRIGGERS = new Set<CommonEvent["trigger"]>(["none", "auto", "parallel"]);

const upsertCommonEvent: ToolDefinition = {
  name: "upsert_common_event",
  description: "커먼 이벤트를 등록/수정한다. trigger: none(호출 전용)/auto/parallel, 조건 스위치 지정 가능.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      trigger: { type: "string", enum: ["none", "auto", "parallel"] },
      conditionSwitchId: { type: "string" },
      commands: { type: "array", description: "Command[]", items: { type: "object" } },
    },
    required: ["id", "name", "commands"],
  },
  run(draft, args): ToolExecResult {
    const base = requireRecordId(args, "common_event");
    if (!base.name) throw new ToolError("common_event.name(문자열)가 필요합니다.");
    const trigger = COMMON_EVENT_TRIGGERS.has(args.trigger as CommonEvent["trigger"])
      ? (args.trigger as CommonEvent["trigger"])
      : "none";
    validateCommandArray(`common_event.${args.id}.commands`, args.commands);
    const record: CommonEvent = {
      id: args.id as string,
      name: args.name as string,
      trigger,
      ...(typeof args.conditionSwitchId === "string" && args.conditionSwitchId ? { conditionSwitchId: args.conditionSwitchId } : {}),
      commands: [...(args.commands as Command[])],
    };
    const outcome = upsertById(draft.commonEvents, record);
    const unsupportedCommands = countLimitedRuntimeSupportCommands(record.commands);
    return {
      summary: `커먼 이벤트 '${record.name}'(${trigger}) ${outcome === "added" ? "추가" : "수정"} — 미지원 커맨드 ${unsupportedCommands}건`,
      data: { id: record.id, unsupportedCommands },
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
      inventory: { type: "object", description: "{ itemId: 수량 }" },
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

const setTitleScreen: ToolDefinition = {
  name: "set_title_screen",
  description: "타이틀 화면 제목/메뉴 라벨을 설정한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      menuLabels: { type: "object", description: "{ newGame, continueGame, quit }" },
    },
    required: ["title"],
  },
  run(draft, args): ToolExecResult {
    const title = args.title as string;
    draft.meta = { ...draft.meta, title };
    const current = draft.system.titleScreen;
    if (current) {
      current.title = title;
      const labels = args.menuLabels as Partial<typeof current.menuLabels> | undefined;
      if (labels) current.menuLabels = { ...current.menuLabels, ...labels };
    }
    return { summary: `타이틀 화면 제목 설정: "${title}"` };
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

export const DB_TOOLS: readonly ToolDefinition[] = [
  upsertItem,
  upsertEnemy,
  upsertTroop,
  defineMonsterSpecies,
  giveStarterMonsters,
  upsertActor,
  upsertSkill,
  upsertEquipment,
  upsertClass,
  definePromotion,
  upsertState,
  upsertCommonEvent,
  setSessionStart,
  setTitleScreen,
];
