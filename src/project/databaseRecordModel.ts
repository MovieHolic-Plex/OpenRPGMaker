import {
  ACTOR_LEVEL_MAX,
  ACTOR_RATE_GRADES,
  DEFAULT_ELEMENT_RATE_LABELS,
  clampLevel,
  normalizeActorRecord,
} from "@/project/actorModel";
import type { ActorExperienceCurve, ActorLearnedSkill, ActorParameterCurves, ActorParameterKey, ActorRateGrade, ClassBattleCommand, ClassRecord, DatabaseRecords, DatabaseStateEffect, EnemyActionCondition, EnemyActionPattern, EnemyRecord, EnemyRewards, EnemyStats, EquipmentRecord, EquipmentStatBonuses, ItemRecord, SkillEffect, SkillMpCost, SkillRecord, TroopMemberRecord, TroopRecord } from "@/project/types";

const PARAMETER_KEYS: readonly ActorParameterKey[] = ["maxHp", "maxMp", "attack", "defense", "mind", "agility"] as const;

export function normalizeDatabaseRecords(database: DatabaseRecords): DatabaseRecords {
  return {
    ...database,
    actors: database.actors.map((actor) => normalizeActorRecord(actor)),
    classes: database.classes.map(normalizeClassRecord),
    skills: database.skills.map(normalizeSkillRecord),
    items: database.items.map(normalizeItemRecord),
    equipment: database.equipment.map(normalizeEquipmentRecord),
    enemies: database.enemies.map(normalizeEnemyRecord),
    troops: database.troops.map(normalizeTroopRecord),
  };
}

export function normalizeClassRecord(record: Partial<ClassRecord> & Pick<ClassRecord, "id" | "name">): ClassRecord {
  const learnedSkills = normalizeLearnedSkills(record.learnedSkills, record.skillIds);
  return {
    id: record.id,
    name: record.name,
    skillIds: learnedSkills.map((skill) => skill.skillId),
    battleCommands: normalizeBattleCommands(record.battleCommands),
    learnedSkills,
    equipmentPermissions: {
      actorIds: cleanIds(record.equipmentPermissions?.actorIds),
      classIds: cleanIds(record.equipmentPermissions?.classIds),
      equipmentIds: cleanIds(record.equipmentPermissions?.equipmentIds),
    },
    parameterCurves: normalizeParameterCurves(record.parameterCurves),
    expCurve: normalizeExpCurve(record.expCurve),
    stateRates: normalizeRates(record.stateRates),
    elementRates: defaultElementRates(record.elementRates),
  };
}

export function normalizeSkillRecord(record: Partial<SkillRecord> & Pick<SkillRecord, "id" | "name">): SkillRecord {
  return {
    id: record.id,
    name: record.name,
    scope: isSkillScope(record.scope) ? record.scope : "enemy",
    power: clampInteger(record.power ?? 10, -9999, 9999),
    animationId: cleanOptionalId(record.animationId),
    description: record.description ?? "",
    type: record.type ?? "normal",
    mpCost: normalizeMpCost(record.mpCost),
    successRate: clampInteger(record.successRate ?? 100, 0, 100),
    variance: clampInteger(record.variance ?? 0, 0, 100),
    hitRate: clampInteger(record.hitRate ?? 100, 0, 100),
    effect: normalizeSkillEffect(record.effect),
  };
}

export function normalizeItemRecord(record: Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">): ItemRecord {
  return {
    id: record.id,
    name: record.name,
    imageResourceId: cleanOptionalId(record.imageResourceId),
    iconResourceId: cleanOptionalId(record.iconResourceId),
    scope: isItemScope(record.scope) ? record.scope : "ally",
    price: clampInteger(record.price ?? 0, 0, 999999),
    skillId: cleanOptionalId(record.skillId),
    description: record.description ?? "",
    type: record.type ?? "normal",
    occasion: record.occasion ?? "always",
    consumable: record.consumable ?? true,
    animationId: cleanOptionalId(record.animationId),
    stateEffects: normalizeStateEffects(record.stateEffects),
  };
}

export function normalizeEquipmentRecord(record: Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">): EquipmentRecord {
  return {
    id: record.id,
    name: record.name,
    imageResourceId: cleanOptionalId(record.imageResourceId),
    iconResourceId: cleanOptionalId(record.iconResourceId),
    slot: record.slot ?? "weapon",
    price: clampInteger(record.price ?? 0, 0, 999999),
    skillId: cleanOptionalId(record.skillId),
    description: record.description ?? "",
    statBonuses: normalizeStatBonuses(record.statBonuses),
    equippableActorIds: cleanIds(record.equippableActorIds),
    equippableClassIds: cleanIds(record.equippableClassIds),
    cursed: record.cursed ?? false,
    twoHanded: record.twoHanded ?? false,
    usableAsItemSkillId: cleanOptionalId(record.usableAsItemSkillId),
    stateInflictIds: cleanIds(record.stateInflictIds),
  };
}

export function normalizeEnemyRecord(record: Partial<EnemyRecord> & Pick<EnemyRecord, "id" | "name">): EnemyRecord {
  const actions = normalizeEnemyActions(record.actions, record.skillIds);
  return {
    id: record.id,
    name: record.name,
    monsterResourceId: cleanOptionalId(record.monsterResourceId),
    skillIds: actions.map((action) => action.skillId),
    stats: normalizeEnemyStats(record.stats),
    rewards: normalizeRewards(record.rewards),
    actions,
    stateRates: normalizeRates(record.stateRates),
    elementRates: defaultElementRates(record.elementRates),
  };
}

export function normalizeTroopRecord(record: Partial<TroopRecord> & Pick<TroopRecord, "id" | "name">): TroopRecord {
  const members = normalizeMembers(record.members, record.enemyIds);
  return {
    id: record.id,
    name: record.name,
    enemyIds: members.map((member) => member.enemyId),
    members,
    autoAlign: record.autoAlign ?? true,
    previewBackgroundResourceId: cleanOptionalId(record.previewBackgroundResourceId),
    battleEventPages: record.battleEventPages ?? [],
  };
}

function normalizeBattleCommands(commands: readonly Partial<ClassBattleCommand>[] | undefined): ClassBattleCommand[] {
  const source: readonly Partial<ClassBattleCommand>[] = commands?.length
    ? commands
    : [{ id: "cmd_attack", name: "Attack", kind: "attack" }];
  return source.map((command, index) => ({
    id: cleanOptionalId(command.id) ?? `cmd_${index + 1}`,
    name: command.name ?? "Command",
    kind: command.kind ?? "attack",
    skillSubsetName: cleanOptionalId(command.skillSubsetName),
  }));
}

function normalizeLearnedSkills(skills: readonly Partial<ActorLearnedSkill>[] | undefined, legacy: readonly string[] = []): ActorLearnedSkill[] {
  const source = skills ?? legacy.map((skillId) => ({ level: 1, skillId }));
  return source
    .filter((skill): skill is ActorLearnedSkill => typeof skill.skillId === "string" && skill.skillId.length > 0)
    .map((skill) => ({ level: clampLevel(skill.level ?? 1), skillId: skill.skillId }))
    .sort((left, right) => left.level - right.level || left.skillId.localeCompare(right.skillId));
}

function normalizeParameterCurves(curves: Partial<ActorParameterCurves> | undefined): ActorParameterCurves {
  const normalized = {} as ActorParameterCurves;
  for (const key of PARAMETER_KEYS) normalized[key] = normalizeCurve(curves?.[key]);
  return normalized;
}

function normalizeCurve(curve: readonly number[] | undefined): number[] {
  if (curve && curve.length >= ACTOR_LEVEL_MAX) return curve.slice(0, ACTOR_LEVEL_MAX).map((value) => clampInteger(value, 1, 99999));
  return Array.from({ length: ACTOR_LEVEL_MAX }, (_, index) => 20 + index * 4);
}

function normalizeExpCurve(curve: Partial<ActorExperienceCurve> | undefined): ActorExperienceCurve {
  return {
    base: clampInteger(curve?.base ?? 1, 0, 999999),
    extra: clampInteger(curve?.extra ?? 677, 0, 999999),
    acceleration: clampInteger(curve?.acceleration ?? 40, 0, 999999),
  };
}

function normalizeMpCost(cost: Partial<SkillMpCost> | undefined): SkillMpCost {
  return { flat: clampInteger(cost?.flat ?? 0, 0, 9999), percentMax: clampInteger(cost?.percentMax ?? 0, 0, 100) };
}

function normalizeSkillEffect(effect: SkillEffect | undefined): SkillEffect {
  return effect ?? { kind: "damage", statistic: "attack", affects: "hp" };
}

function normalizeStateEffects(effects: readonly Partial<DatabaseStateEffect>[] | undefined): DatabaseStateEffect[] {
  return (effects ?? [])
    .filter((effect): effect is DatabaseStateEffect => typeof effect.stateId === "string" && effect.stateId.length > 0)
    .map((effect) => ({ stateId: effect.stateId, chance: clampInteger(effect.chance ?? 100, 0, 100), operation: effect.operation ?? "add" }));
}

function normalizeStatBonuses(bonuses: Partial<EquipmentStatBonuses> | undefined): EquipmentStatBonuses {
  return {
    attack: clampInteger(bonuses?.attack ?? 0, 0, 9999),
    defense: clampInteger(bonuses?.defense ?? 0, 0, 9999),
    mind: clampInteger(bonuses?.mind ?? 0, 0, 9999),
    agility: clampInteger(bonuses?.agility ?? 0, 0, 9999),
  };
}

function normalizeEnemyStats(stats: Partial<EnemyStats> | undefined): EnemyStats {
  return {
    maxHp: clampInteger(stats?.maxHp ?? 10, 1, 99999),
    maxMp: clampInteger(stats?.maxMp ?? 1, 1, 9999),
    attack: clampInteger(stats?.attack ?? 10, 1, 9999),
    defense: clampInteger(stats?.defense ?? 10, 1, 9999),
    mind: clampInteger(stats?.mind ?? 10, 1, 9999),
    agility: clampInteger(stats?.agility ?? 10, 1, 9999),
  };
}

function normalizeRewards(rewards: Partial<EnemyRewards> | undefined): EnemyRewards {
  return {
    exp: clampInteger(rewards?.exp ?? 0, 0, 999999),
    gold: clampInteger(rewards?.gold ?? 0, 0, 999999),
    dropItemId: cleanOptionalId(rewards?.dropItemId),
    dropRatePercent: clampInteger(rewards?.dropRatePercent ?? 0, 0, 100),
  };
}

function normalizeEnemyActions(actions: readonly Partial<EnemyActionPattern>[] | undefined, legacy: readonly string[] = []): EnemyActionPattern[] {
  const source = actions ?? legacy.map((skillId) => ({ skillId, priority: 5, condition: { kind: "always" } as EnemyActionCondition }));
  return source
    .filter((action): action is EnemyActionPattern => typeof action.skillId === "string" && action.skillId.length > 0)
    .map((action) => ({
      skillId: action.skillId,
      priority: clampInteger(action.priority ?? 5, 1, 10),
      condition: normalizeActionCondition(action.condition),
    }));
}

function normalizeActionCondition(condition: EnemyActionCondition | undefined): EnemyActionCondition {
  if (condition?.kind === "turn") {
    return { kind: "turn", start: clampInteger(condition.start, 1, 999), interval: clampInteger(condition.interval, 1, 999) };
  }
  return { kind: "always" };
}

function normalizeMembers(members: readonly Partial<TroopMemberRecord>[] | undefined, legacy: readonly string[] = []): TroopMemberRecord[] {
  const source = members ?? legacy.map((enemyId, index) => ({ enemyId, x: 104 + index * 56, y: 96 }));
  return source
    .filter((member): member is TroopMemberRecord => typeof member.enemyId === "string" && member.enemyId.length > 0)
    .map((member) => ({
      enemyId: member.enemyId,
      x: clampInteger(member.x ?? 160, 0, 320),
      y: clampInteger(member.y ?? 120, 0, 240),
      hidden: member.hidden ?? false,
    }));
}

function defaultElementRates(overrides: Record<string, ActorRateGrade> | undefined): Record<string, ActorRateGrade> {
  const rates: Record<string, ActorRateGrade> = {};
  for (const element of DEFAULT_ELEMENT_RATE_LABELS) rates[element.id] = "C";
  return { ...rates, ...normalizeRates(overrides) };
}

function normalizeRates(rates: Record<string, ActorRateGrade> | undefined): Record<string, ActorRateGrade> {
  const normalized: Record<string, ActorRateGrade> = { state_death: "C" };
  for (const [id, grade] of Object.entries(rates ?? {})) normalized[id] = ACTOR_RATE_GRADES.includes(grade) ? grade : "C";
  return normalized;
}

function cleanIds(ids: readonly string[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((id) => id.trim().length > 0))];
}

function cleanOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isSkillScope(value: unknown): value is SkillRecord["scope"] {
  return value === "self" || value === "ally" || value === "enemy" || value === "allEnemies";
}

function isItemScope(value: unknown): value is ItemRecord["scope"] {
  return value === "none" || value === "ally" || value === "enemy";
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
