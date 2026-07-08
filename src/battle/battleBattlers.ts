import { clampLevel, normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { startStateOf } from "@/project/session";
import type { ActorId, ActorInitialEquipment, ActorParameterKey, EnemyActionPattern, EnemyId, Project, SkillId } from "@/project/types";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { TroopRecord } from "@/project/types/database";

const CHARGE_PER_AGILITY = 0.1 / 43;
const CHARGE_FLOOR = 0.02;

// 세션에서 온 액터별 오버라이드. 모두 선택적이며, 없으면 DB 기본값으로 폴백한다.
export interface ActorBattlerOverrides {
  // 이름 오버라이드(enterHeroName 등). actorId → 이름.
  readonly names?: Readonly<Record<string, string>>;
  // 레벨 오버라이드(레벨업 반영값). actorId → 레벨. 없으면 DB initialLevel.
  readonly levels?: Readonly<Record<string, number>>;
  // 현재 바이탈(필드에서 이어지는 현재 HP/MP). actorId → {hp, mp}.
  readonly vitals?: Readonly<Record<string, { readonly hp: number; readonly mp: number }>>;
  // 런타임 영구 파라미터 보정(Change Parameters). actorId → parameterKey → delta.
  readonly paramBonuses?: Readonly<Record<string, Partial<Record<ActorParameterKey, number>>>>;
  readonly equipment?: Readonly<Record<string, ActorInitialEquipment>>;
  readonly skillIds?: Readonly<Record<string, readonly SkillId[]>>;
  // 필드에서 이어지는 런타임 상태 이상(Change State).
  readonly stateIds?: Readonly<Record<string, readonly string[]>>;
  // 현재 파티 편성(changeParty/순서변경 반영). 없으면 project.session(에디터 시작 상태).
  // 플레이 중 파티가 바뀌면 반드시 라이브 세션 값을 넘겨야 전투 편성이 일치한다.
  readonly partyActorIds?: readonly ActorId[];
}

export interface MutableBattler {
  readonly id: string;
  readonly recordId: ActorId | EnemyId;
  readonly name: string;
  readonly maxHp: number;
  readonly maxMp: number;
  readonly attackPower: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
  readonly chargeRate: number;
  readonly skillIds: readonly SkillId[];
  readonly enemyActions?: readonly EnemyActionPattern[];
  readonly battleX?: number;
  readonly battleY?: number;
  hidden: boolean;
  hp: number;
  mp: number;
  gauge: number;
  stateIds: string[];
  // 상태별 경과 턴 수(stateId → 턴). 자연 회복/지속 피해 판정용.
  stateTurns: Record<string, number>;
  defending: boolean;
}

export function actorBattlers(
  project: Project,
  overrides?: ActorBattlerOverrides
): MutableBattler[] {
  const partyActorIds = overrides?.partyActorIds ?? startStateOf(project).partyActorIds;
  return partyActorIds.map((actorId, index) => {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`Missing actor: ${actorId}`);
    const normalizedActor = normalizeActorRecord(actor);
    // 세션 레벨(레벨업 반영값)이 있으면 그 레벨로 파라미터 곡선을 조회. 없으면 DB initialLevel.
    const level = clampLevel(overrides?.levels?.[actorId] ?? normalizedActor.initialLevel);
    const bonuses = overrides?.paramBonuses?.[actorId];
    const equipmentBonuses = totalEquipmentBonuses(project, overrides?.equipment?.[actorId] ?? normalizedActor.initialEquipment);
    const maxHp = parameterWithBonus(normalizedActor.parameterCurves.maxHp, level, bonuses?.maxHp, 1);
    const maxMp = parameterWithBonus(normalizedActor.parameterCurves.maxMp, level, bonuses?.maxMp, 0);
    const attack = parameterWithBonus(normalizedActor.parameterCurves.attack, level, (bonuses?.attack ?? 0) + equipmentBonuses.attack, 1);
    const defense = parameterWithBonus(normalizedActor.parameterCurves.defense, level, (bonuses?.defense ?? 0) + equipmentBonuses.defense, 1);
    const mind = parameterWithBonus(normalizedActor.parameterCurves.mind, level, (bonuses?.mind ?? 0) + equipmentBonuses.mind, 1);
    const agility = parameterWithBonus(normalizedActor.parameterCurves.agility, level, (bonuses?.agility ?? 0) + equipmentBonuses.agility, 1);
    // 세션 현재 바이탈이 있으면 그 값을 이어받되(필드에서 이어지는 부상 상태 유지),
    // 이 전투 레벨 기준 최대치로 클램프. 없으면 완충 상태로 시작.
    const sessionVitals = overrides?.vitals?.[actorId];
    const hp = sessionVitals ? clampVital(sessionVitals.hp, maxHp) : maxHp;
    const mp = sessionVitals ? clampVital(sessionVitals.mp, maxMp) : maxMp;
    return {
      id: actor.id,
      recordId: actor.id,
      name: overrides?.names?.[actorId] ?? normalizedActor.name,
      maxHp,
      hp,
      maxMp,
      mp,
      attackPower: attack,
      defense,
      mind,
      agility,
      chargeRate: chargeRateFor(agility),
      battleX: 248 + (index % 2) * 32,
      battleY: 70 + index * 24,
      gauge: 0,
      stateIds: [...(overrides?.stateIds?.[actorId] ?? [])],
      stateTurns: {},
      defending: false,
      skillIds: learnedSkillIds(project, normalizedActor, level, overrides?.skillIds?.[actorId]),
      hidden: false,
    };
  });
}

function learnedSkillIds(project: Project, actor: ReturnType<typeof normalizeActorRecord>, level: number, sessionSkillIds: readonly SkillId[] | undefined): SkillId[] {
  const ids = new Set<SkillId>(sessionSkillIds ?? []);
  for (const entry of actor.learnedSkills) if (entry.level <= level) ids.add(entry.skillId);
  const klass = project.database.classes.find((record) => record.id === actor.classId);
  for (const entry of klass?.learnedSkills ?? []) if (entry.level <= level) ids.add(entry.skillId);
  return [...ids];
}

function totalEquipmentBonuses(project: Project, equipment: ActorInitialEquipment): { attack: number; defense: number; mind: number; agility: number } {
  const total = { attack: 0, defense: 0, mind: 0, agility: 0 };
  for (const equipmentId of Object.values(equipment)) {
    if (!equipmentId) continue;
    const record = project.database.equipment.find((entry) => entry.id === equipmentId);
    if (!record) continue;
    total.attack += record.statBonuses.attack;
    total.defense += record.statBonuses.defense;
    total.mind += record.statBonuses.mind;
    total.agility += record.statBonuses.agility;
  }
  return total;
}

function clampVital(value: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function parameterWithBonus(curve: readonly number[], level: number, bonus: number | undefined, min: number): number {
  const value = parameterValueAtLevel(curve, level) + (Number.isFinite(bonus) ? Math.trunc(bonus ?? 0) : 0);
  return Math.max(min, value);
}

export function enemyBattlers(project: Project, troop: TroopRecord): MutableBattler[] {
  const members = troop.members?.length
    ? troop.members
    : (troop.enemyIds ?? []).map((enemyId, index) => ({ enemyId, x: 104 + index * 56, y: 96, hidden: false }));
  return members.map((member, index) => {
    const enemyId = member.enemyId;
    const enemy = project.database.enemies.find((record) => record.id === enemyId);
    if (!enemy) throw new Error(`Missing enemy: ${enemyId}`);
    const normalizedEnemy = normalizeEnemyRecord(enemy);
    const stats = normalizedEnemy.stats;
    return {
      id: `enemy-${index + 1}`,
      recordId: enemy.id,
      name: normalizedEnemy.name,
      maxHp: stats.maxHp,
      hp: stats.maxHp,
      maxMp: stats.maxMp,
      mp: stats.maxMp,
      attackPower: stats.attack,
      defense: stats.defense,
      mind: stats.mind,
      agility: stats.agility,
      chargeRate: chargeRateFor(stats.agility),
      battleX: member.x,
      battleY: member.y,
      gauge: 0,
      stateIds: [],
      stateTurns: {},
      defending: false,
      skillIds: normalizedEnemy.skillIds,
      enemyActions: normalizedEnemy.actions,
      hidden: member.hidden ?? false,
    };
  });
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function battlerSnapshot(
  battler: MutableBattler,
  position?: { readonly battleX?: number; readonly battleY?: number }
): BattleBattlerSnapshot {
  return {
    id: battler.id,
    recordId: battler.recordId,
    name: battler.name,
    hp: battler.hp,
    maxHp: battler.maxHp,
    mp: battler.mp,
    maxMp: battler.maxMp,
    gauge: battler.gauge,
    battleX: position?.battleX ?? battler.battleX,
    battleY: position?.battleY ?? battler.battleY,
    defeated: battler.hp <= 0,
    defending: battler.defending,
    stateIds: battler.stateIds,
    skillIds: battler.skillIds,
  };
}

function chargeRateFor(agility: number): number {
  return Math.max(CHARGE_FLOOR, agility * CHARGE_PER_AGILITY);
}
