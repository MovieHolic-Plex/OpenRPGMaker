import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { ActorId, EnemyId, Project, SkillId } from "@/project/types";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { TroopRecord } from "@/project/types/database";

const CHARGE_PER_AGILITY = 0.1 / 43;
const CHARGE_FLOOR = 0.02;

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
  hidden: boolean;
  hp: number;
  mp: number;
  gauge: number;
  stateIds: string[];
  defending: boolean;
}

export function actorBattlers(project: Project): MutableBattler[] {
  return project.session.partyActorIds.map((actorId) => {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`Missing actor: ${actorId}`);
    const normalizedActor = normalizeActorRecord(actor);
    const level = normalizedActor.initialLevel;
    const maxHp = parameterValueAtLevel(normalizedActor.parameterCurves.maxHp, level);
    const maxMp = parameterValueAtLevel(normalizedActor.parameterCurves.maxMp, level);
    const attack = parameterValueAtLevel(normalizedActor.parameterCurves.attack, level);
    const defense = parameterValueAtLevel(normalizedActor.parameterCurves.defense, level);
    const mind = parameterValueAtLevel(normalizedActor.parameterCurves.mind, level);
    const agility = parameterValueAtLevel(normalizedActor.parameterCurves.agility, level);
    return {
      id: actor.id,
      recordId: actor.id,
      name: normalizedActor.name,
      maxHp,
      hp: maxHp,
      maxMp,
      mp: maxMp,
      attackPower: attack,
      defense,
      mind,
      agility,
      chargeRate: chargeRateFor(agility),
      gauge: 0,
      stateIds: [],
      defending: false,
      skillIds: normalizedActor.learnedSkills.map((entry) => entry.skillId),
      hidden: false,
    };
  });
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
      gauge: 0,
      stateIds: [],
      defending: false,
      skillIds: normalizedEnemy.skillIds,
      hidden: member.hidden ?? false,
    };
  });
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function battlerSnapshot(battler: MutableBattler): BattleBattlerSnapshot {
  return {
    id: battler.id,
    recordId: battler.recordId,
    name: battler.name,
    hp: battler.hp,
    maxHp: battler.maxHp,
    mp: battler.mp,
    maxMp: battler.maxMp,
    gauge: battler.gauge,
    defeated: battler.hp <= 0,
    stateIds: battler.stateIds,
    skillIds: battler.skillIds,
  };
}

function chargeRateFor(agility: number): number {
  return Math.max(CHARGE_FLOOR, agility * CHARGE_PER_AGILITY);
}
