import type { Rng } from "@/util/rng";
import { mulberry32 } from "@/util/rng";
import { ACTOR_LEVEL_MAX, totalExpForLevel } from "@/project/actorModel";
import type {
  ActorExperienceCurve,
  ActorLearnedSkill,
  EnemyRecord,
  EnemyStats,
  ItemRecord,
  ItemId,
  SkillId,
  MonsterSpeciesGraphic,
  MonsterSpeciesId,
  MonsterEvolutionRecord,
  MonsterEvolutionRequirement,
  MonsterSpeciesRecord,
  Project,
} from "@/project/types";
import type { MonsterCaughtAt, MonsterInstance, MonsterInstanceIvs, PlaySession } from "@/project/session";

export const MONSTER_PARTY_MAX = 6;

export type GiveMonsterInput = {
  readonly speciesId: MonsterSpeciesId;
  readonly level: number;
  readonly nickname?: string;
  readonly exp?: number;
  readonly ivs?: MonsterInstanceIvs;
  readonly friendship?: number;
  readonly caughtAt?: MonsterCaughtAt;
};

export type GiveMonsterResult =
  | { readonly ok: true; readonly instance: MonsterInstance; readonly location: "party" | "box" }
  | { readonly ok: false; readonly reason: "missingSpecies" };

export type MoveMonsterResult =
  | { readonly ok: true; readonly from: "party" | "box" | "none"; readonly to: "party" | "box" }
  | { readonly ok: false; readonly reason: "missingInstance" | "partyFull" };

export type EvolveMonsterInput = {
  readonly instanceId: string;
  readonly toSpeciesId?: MonsterSpeciesId;
  readonly allowItemEvolution?: boolean;
};

export type EvolveMonsterResult =
  | {
      readonly ok: true;
      readonly instance: MonsterInstance;
      readonly fromSpeciesId: MonsterSpeciesId;
      readonly toSpeciesId: MonsterSpeciesId;
      readonly consumedItemId?: ItemId;
      readonly learnedSkillIds: readonly SkillId[];
      readonly previousMaxHp: number;
      readonly nextMaxHp: number;
    }
  | {
      readonly ok: false;
      readonly reason: "missingInstance" | "missingSpecies" | "noEvolution" | "requirementsNotMet" | "missingItem";
      readonly instanceId: string;
      readonly toSpeciesId?: MonsterSpeciesId;
    };

export type MonsterExperienceResult = {
  readonly instanceId: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly learnedSkillIds: readonly SkillId[];
  readonly evolution?: EvolveMonsterResult;
};

const DEFAULT_MONSTER_EXP_CURVE: ActorExperienceCurve = { base: 30, extra: 20, acceleration: 30 };

export function normalizeMonsterSpeciesRecord(
  record: Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">
): MonsterSpeciesRecord {
  const skillsByLevel = normalizeSkillsByLevel(record.skillsByLevel);
  const types = normalizeSpeciesTypes(record.types);
  const evolutions = normalizeEvolutions(record.evolutions);
  return {
    id: record.id,
    name: textOrDefault(record.name, "몬스터"),
    graphic: normalizeSpeciesGraphic(record.graphic),
    types: types.length > 0 ? types : undefined,
    baseStats: normalizeSpeciesStats(record.baseStats),
    expCurve: normalizeExpCurve(record.expCurve),
    captureRate: clampNumber(record.captureRate ?? 0.3, 0, 1),
    skillsByLevel: skillsByLevel.length > 0 ? skillsByLevel : undefined,
    evolutions: evolutions.length > 0 ? evolutions : undefined,
  };
}

export function captureSuccessRate(
  captureRate: number,
  currentHp: number,
  maxHp: number,
  itemMultiplier = 1
): number {
  const hpRatio = maxHp > 0 ? clampNumber(currentHp / maxHp, 0, 1) : 1;
  return clampNumber(captureRate * (1 - hpRatio * 0.7) * itemMultiplier, 0, 1);
}

export function captureItemMultiplier(item: ItemRecord | undefined): number {
  const multiplier = item?.captureProfile?.multiplier;
  return typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

export function rollMonsterIvs(rng: Rng): MonsterInstanceIvs {
  return {
    hp: rollIv(rng),
    atk: rollIv(rng),
    def: rollIv(rng),
    spd: rollIv(rng),
  };
}

export function deterministicMonsterIvs(seed: string | number): MonsterInstanceIvs {
  return rollMonsterIvs(mulberry32(typeof seed === "number" ? seed : hashString(seed)));
}

export function monsterSpeciesForEnemy(project: Project, enemy: EnemyRecord | undefined): MonsterSpeciesRecord | undefined {
  if (!enemy) return undefined;
  const species = project.database.monsterSpecies ?? [];
  if (enemy.speciesId) return species.find((record) => record.id === enemy.speciesId);
  return species.find((record) => record.id === enemy.id);
}

export function monsterSpeciesById(project: Project, speciesId: MonsterSpeciesId): MonsterSpeciesRecord | undefined {
  return (project.database.monsterSpecies ?? []).find((record) => record.id === speciesId);
}

export function giveMonster(project: Project, session: PlaySession, input: GiveMonsterInput): GiveMonsterResult {
  ensureMonsterSessionFields(session);
  const species = monsterSpeciesById(project, input.speciesId);
  if (!species) return { ok: false, reason: "missingSpecies" };
  const instanceId = nextMonsterInstanceId(session);
  const instance: MonsterInstance = {
    instanceId,
    speciesId: species.id,
    nickname: cleanOptionalText(input.nickname),
    level: clampInteger(input.level, 1, 99),
    exp: Math.max(0, Math.trunc(input.exp ?? 0)),
    ivs: input.ivs ?? deterministicMonsterIvs(`${session.rng?.seed ?? 1}:${instanceId}:${species.id}`),
    friendship: clampInteger(input.friendship ?? 70, 0, 255),
    caughtAt: input.caughtAt ?? { mapId: session.currentMapId, x: session.x, y: session.y },
  };
  const maxHp = monsterMaxHpFor(project, species, instance);
  const skills = monsterSkillIdsForSpecies(species, instance.level);
  const hydrated: MonsterInstance = {
    ...instance,
    currentHp: maxHp,
    skillIds: skills.length > 0 ? skills : undefined,
  };
  session.monsterInstances[instanceId] = hydrated;
  if (session.monsterParty.length < MONSTER_PARTY_MAX) {
    session.monsterParty.push(instanceId);
    return { ok: true, instance: hydrated, location: "party" };
  }
  session.monsterBox.push(instanceId);
  return { ok: true, instance: hydrated, location: "box" };
}

export function moveMonster(session: PlaySession, instanceId: string, to: "party" | "box"): MoveMonsterResult {
  ensureMonsterSessionFields(session);
  if (!session.monsterInstances[instanceId]) return { ok: false, reason: "missingInstance" };
  const from: "party" | "box" | "none" = session.monsterParty.includes(instanceId)
    ? "party"
    : session.monsterBox.includes(instanceId)
      ? "box"
      : "none";
  if (to === "party" && from !== "party" && session.monsterParty.length >= MONSTER_PARTY_MAX) {
    return { ok: false, reason: "partyFull" };
  }
  session.monsterParty = session.monsterParty.filter((id) => id !== instanceId);
  session.monsterBox = session.monsterBox.filter((id) => id !== instanceId);
  if (to === "party") session.monsterParty.push(instanceId);
  else session.monsterBox.push(instanceId);
  return { ok: true, from, to };
}

export function monsterDisplayName(project: Project, instance: MonsterInstance | undefined): string {
  if (!instance) return "몬스터";
  if (instance.nickname) return instance.nickname;
  return monsterSpeciesById(project, instance.speciesId)?.name ?? instance.speciesId;
}

export function monsterMaxHp(project: Project, instance: MonsterInstance | undefined): number {
  if (!instance) return 1;
  const species = monsterSpeciesById(project, instance.speciesId);
  return monsterMaxHpFor(project, species, instance);
}

export function monsterCurrentHp(project: Project, instance: MonsterInstance | undefined): number {
  if (!instance) return 0;
  return clampInteger(instance.currentHp ?? monsterMaxHp(project, instance), 0, monsterMaxHp(project, instance));
}

export function monsterSkillIds(project: Project, instance: MonsterInstance | undefined): SkillId[] {
  if (!instance) return [];
  const species = monsterSpeciesById(project, instance.speciesId);
  return mergeSkillIds(instance.skillIds ?? [], species ? monsterSkillIdsForSpecies(species, instance.level) : []);
}

export function applyMonsterExperienceAndEvolution(project: Project, session: PlaySession, earnedExp: number): MonsterExperienceResult[] {
  ensureMonsterSessionFields(session);
  const exp = Math.max(0, Math.trunc(earnedExp));
  if (exp <= 0) return [];
  const results: MonsterExperienceResult[] = [];
  for (const instanceId of session.monsterParty) {
    const before = session.monsterInstances[instanceId];
    if (!before) continue;
    const species = monsterSpeciesById(project, before.speciesId);
    if (!species) continue;
    const fromLevel = before.level;
    const nextExp = Math.max(0, Math.trunc(before.exp ?? 0)) + exp;
    const toLevel = monsterLevelForExp(species, fromLevel, nextExp);
    const learned = newSkillsForLevelRange(species, fromLevel, toLevel, before.skillIds ?? []);
    session.monsterInstances[instanceId] = {
      ...before,
      exp: nextExp,
      level: toLevel,
      skillIds: mergeSkillIds(before.skillIds ?? [], learned),
      currentHp: monsterCurrentHp(project, before),
    };
    const evolution = toLevel > fromLevel ? evolveMonster(project, session, { instanceId, allowItemEvolution: false }) : undefined;
    results.push({ instanceId, fromLevel, toLevel, learnedSkillIds: learned, evolution });
  }
  return results;
}

export function evolveMonster(project: Project, session: PlaySession, input: EvolveMonsterInput): EvolveMonsterResult {
  ensureMonsterSessionFields(session);
  const instance = session.monsterInstances[input.instanceId];
  if (!instance) return { ok: false, reason: "missingInstance", instanceId: input.instanceId, toSpeciesId: input.toSpeciesId };
  const fromSpecies = monsterSpeciesById(project, instance.speciesId);
  if (!fromSpecies) return { ok: false, reason: "missingSpecies", instanceId: input.instanceId, toSpeciesId: input.toSpeciesId };
  const evolution = selectEvolution(project, session, instance, fromSpecies, input);
  if (!evolution) {
    const hasTarget = input.toSpeciesId
      ? (fromSpecies.evolutions ?? []).some((entry) => entry.toSpeciesId === input.toSpeciesId)
      : (fromSpecies.evolutions ?? []).length > 0;
    const missingItem = failedOnlyBecauseOfMissingItem(session, instance, fromSpecies, input);
    return { ok: false, reason: missingItem ? "missingItem" : hasTarget ? "requirementsNotMet" : "noEvolution", instanceId: input.instanceId, toSpeciesId: input.toSpeciesId };
  }
  const toSpecies = monsterSpeciesById(project, evolution.toSpeciesId);
  if (!toSpecies) return { ok: false, reason: "missingSpecies", instanceId: input.instanceId, toSpeciesId: evolution.toSpeciesId };
  const previousMaxHp = monsterMaxHpFor(project, fromSpecies, instance);
  const currentHp = monsterCurrentHp(project, instance);
  const hpRatio = previousMaxHp > 0 ? currentHp / previousMaxHp : 1;
  const nextMaxHp = monsterMaxHpFor(project, toSpecies, instance);
  const nextCurrentHp = currentHp <= 0 ? 0 : clampInteger(Math.round(nextMaxHp * hpRatio), 1, nextMaxHp);
  const learnedSkillIds = newSkillsForLevelRange(toSpecies, 0, instance.level, instance.skillIds ?? []);
  const evolved: MonsterInstance = {
    ...instance,
    speciesId: toSpecies.id,
    currentHp: nextCurrentHp,
    skillIds: mergeSkillIds(instance.skillIds ?? [], learnedSkillIds),
  };
  session.monsterInstances[input.instanceId] = evolved;
  const consumedItemId = evolution.requires.itemId;
  if (consumedItemId) session.inventory[consumedItemId] = Math.max(0, (session.inventory[consumedItemId] ?? 0) - 1);
  return {
    ok: true,
    instance: evolved,
    fromSpeciesId: fromSpecies.id,
    toSpeciesId: toSpecies.id,
    consumedItemId,
    learnedSkillIds,
    previousMaxHp,
    nextMaxHp,
  };
}

export function ensureMonsterSessionFields(session: PlaySession): void {
  session.monsterInstances ??= {};
  session.monsterParty ??= [];
  session.monsterBox ??= [];
}

function nextMonsterInstanceId(session: PlaySession): string {
  let index = Object.keys(session.monsterInstances).length + 1;
  while (session.monsterInstances[`monster_${index}`]) index += 1;
  return `monster_${index}`;
}

function rollIv(rng: Rng): number {
  return clampInteger(Math.floor(rng() * 16), 0, 15);
}

function normalizeSpeciesGraphic(graphic: Partial<MonsterSpeciesGraphic> | undefined): MonsterSpeciesGraphic {
  return {
    monsterResourceId: cleanOptionalText(graphic?.monsterResourceId),
    graphicHue: clampInteger(graphic?.graphicHue ?? 0, 0, 360),
    transparent: graphic?.transparent === true,
    flying: graphic?.flying === true,
  };
}

function normalizeSpeciesStats(stats: Partial<EnemyStats> | undefined): EnemyStats {
  return {
    maxHp: clampInteger(stats?.maxHp ?? 10, 1, 99999),
    maxMp: clampInteger(stats?.maxMp ?? 0, 0, 9999),
    attack: clampInteger(stats?.attack ?? 10, 1, 999),
    defense: clampInteger(stats?.defense ?? 10, 1, 999),
    mind: clampInteger(stats?.mind ?? 10, 1, 999),
    agility: clampInteger(stats?.agility ?? 10, 1, 999),
  };
}

function normalizeSpeciesTypes(types: readonly string[] | undefined): string[] {
  return [...new Set((types ?? []).flatMap((type) => {
    const trimmed = type.trim();
    return trimmed ? [trimmed] : [];
  }))].slice(0, 2);
}

function normalizeEvolutions(evolutions: readonly Partial<MonsterEvolutionRecord>[] | undefined): MonsterEvolutionRecord[] {
  return (evolutions ?? [])
    .flatMap((evolution): MonsterEvolutionRecord[] => {
      const toSpeciesId = cleanOptionalText(evolution.toSpeciesId);
      if (!toSpeciesId) return [];
      return [{ toSpeciesId, requires: normalizeEvolutionRequirement(evolution.requires) }];
    })
    .sort((left, right) => left.toSpeciesId.localeCompare(right.toSpeciesId));
}

function normalizeEvolutionRequirement(requires: Partial<MonsterEvolutionRequirement> | undefined): MonsterEvolutionRequirement {
  return {
    level: typeof requires?.level === "number" ? clampInteger(requires.level, 1, ACTOR_LEVEL_MAX) : undefined,
    itemId: cleanOptionalText(requires?.itemId),
    friendshipAtLeast: typeof requires?.friendshipAtLeast === "number" ? clampInteger(requires.friendshipAtLeast, 0, 255) : undefined,
  };
}

function normalizeExpCurve(curve: Partial<ActorExperienceCurve> | undefined): ActorExperienceCurve | undefined {
  if (!curve) return undefined;
  return {
    base: clampInteger(curve.base ?? 30, 0, 99999),
    extra: clampInteger(curve.extra ?? 20, 0, 99999),
    acceleration: clampInteger(curve.acceleration ?? 30, 0, 999),
  };
}

function normalizeSkillsByLevel(skills: readonly Partial<ActorLearnedSkill>[] | undefined): ActorLearnedSkill[] {
  return (skills ?? [])
    .filter((skill): skill is ActorLearnedSkill => typeof skill.skillId === "string" && skill.skillId.length > 0)
    .map((skill) => ({ level: clampInteger(skill.level ?? 1, 1, 99), skillId: skill.skillId }))
    .sort((left, right) => left.level - right.level || left.skillId.localeCompare(right.skillId));
}

function monsterMaxHpFor(_project: Project, species: MonsterSpeciesRecord | undefined, instance: MonsterInstance): number {
  return Math.max(1, (species?.baseStats.maxHp ?? 1) + (instance.ivs?.hp ?? 0));
}

function monsterSkillIdsForSpecies(species: MonsterSpeciesRecord, level: number): SkillId[] {
  return (species.skillsByLevel ?? [])
    .filter((entry) => entry.level <= level)
    .map((entry) => entry.skillId);
}

function newSkillsForLevelRange(
  species: MonsterSpeciesRecord,
  fromLevel: number,
  toLevel: number,
  knownSkillIds: readonly SkillId[]
): SkillId[] {
  const known = new Set(knownSkillIds);
  return (species.skillsByLevel ?? [])
    .filter((entry) => entry.level > fromLevel && entry.level <= toLevel && !known.has(entry.skillId))
    .map((entry) => entry.skillId);
}

function mergeSkillIds(first: readonly SkillId[], second: readonly SkillId[]): SkillId[] {
  const result: SkillId[] = [];
  for (const skillId of [...first, ...second]) {
    if (!result.includes(skillId)) result.push(skillId);
  }
  return result;
}

function monsterLevelForExp(species: MonsterSpeciesRecord, currentLevel: number, exp: number): number {
  const curve = species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE;
  let level = clampInteger(currentLevel, 1, ACTOR_LEVEL_MAX);
  while (level < ACTOR_LEVEL_MAX && exp >= totalExpForLevel(curve, level + 1)) level += 1;
  return level;
}

function selectEvolution(
  project: Project,
  session: PlaySession,
  instance: MonsterInstance,
  species: MonsterSpeciesRecord,
  input: EvolveMonsterInput
): MonsterEvolutionRecord | undefined {
  const evolutions = (species.evolutions ?? [])
    .filter((evolution) => !input.toSpeciesId || evolution.toSpeciesId === input.toSpeciesId)
    .filter((evolution) => monsterSpeciesById(project, evolution.toSpeciesId));
  return evolutions.find((evolution) => evolutionRequirementMet(session, instance, evolution.requires, input.allowItemEvolution === true));
}

function evolutionRequirementMet(
  session: PlaySession,
  instance: MonsterInstance,
  requires: MonsterEvolutionRequirement,
  allowItemEvolution: boolean
): boolean {
  if (requires.level !== undefined && instance.level < requires.level) return false;
  if (requires.friendshipAtLeast !== undefined && instance.friendship < requires.friendshipAtLeast) return false;
  if (!requires.itemId) return true;
  if (!allowItemEvolution) return false;
  return (session.inventory[requires.itemId] ?? 0) > 0;
}

function failedOnlyBecauseOfMissingItem(
  session: PlaySession,
  instance: MonsterInstance,
  species: MonsterSpeciesRecord,
  input: EvolveMonsterInput
): boolean {
  if (input.allowItemEvolution !== true) return false;
  return (species.evolutions ?? [])
    .filter((evolution) => !input.toSpeciesId || evolution.toSpeciesId === input.toSpeciesId)
    .some((evolution) => {
      const requires = evolution.requires;
      if (!requires.itemId || (session.inventory[requires.itemId] ?? 0) > 0) return false;
      const { itemId: _itemId, ...withoutItem } = requires;
      return evolutionRequirementMet(session, instance, withoutItem, true);
    });
}

function textOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = cleanOptionalText(value);
  return trimmed ?? fallback;
}

function cleanOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 1;
}
