import type { Rng } from "@/util/rng";
import { mulberry32 } from "@/util/rng";
import type {
  ActorExperienceCurve,
  ActorLearnedSkill,
  EnemyRecord,
  EnemyStats,
  ItemRecord,
  MonsterSpeciesGraphic,
  MonsterSpeciesId,
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

export function normalizeMonsterSpeciesRecord(
  record: Partial<MonsterSpeciesRecord> & Pick<MonsterSpeciesRecord, "id" | "name">
): MonsterSpeciesRecord {
  const skillsByLevel = normalizeSkillsByLevel(record.skillsByLevel);
  return {
    id: record.id,
    name: textOrDefault(record.name, "몬스터"),
    graphic: normalizeSpeciesGraphic(record.graphic),
    baseStats: normalizeSpeciesStats(record.baseStats),
    expCurve: normalizeExpCurve(record.expCurve),
    captureRate: clampNumber(record.captureRate ?? 0.3, 0, 1),
    skillsByLevel: skillsByLevel.length > 0 ? skillsByLevel : undefined,
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
  session.monsterInstances[instanceId] = instance;
  if (session.monsterParty.length < MONSTER_PARTY_MAX) {
    session.monsterParty.push(instanceId);
    return { ok: true, instance, location: "party" };
  }
  session.monsterBox.push(instanceId);
  return { ok: true, instance, location: "box" };
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
  const stats = monsterSpeciesById(project, instance.speciesId)?.baseStats;
  return Math.max(1, (stats?.maxHp ?? 1) + (instance.ivs?.hp ?? 0));
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
