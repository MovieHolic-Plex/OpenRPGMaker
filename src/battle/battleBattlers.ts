import { clampLevel, normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { startStateOf } from "@/project/session";
import type { MonsterInstance } from "@/project/session";
import { monsterBattleStats, monsterCurrentHp, monsterDisplayName, monsterSkillIds } from "@/project/monsterCollection";
import { classLearnedSkillIdsUpToLevel, effectiveActorClassId, hasActorClassOverride } from "@/project/sessionClass";
import type { ActorId, ActorInitialEquipment, ActorParameterKey, EnemyActionPattern, EnemyId, Project, SkillId } from "@/project/types";
import { resolveBattlerPose } from "@/battle/battlePose";
import type { BattleActionResultSnapshot, BattleBattlerSnapshot } from "@/battle/types";
import type { TroopRecord } from "@/project/types/database";
import { logicalEquipmentIds } from "@/player/playerEquipmentRules";

const CHARGE_PER_AGILITY = 0.1 / 43;
const CHARGE_FLOOR = 0.02;

// 세션에서 온 액터별 오버라이드. 모두 선택적이며, 없으면 DB 기본값으로 폴백한다.
export interface ActorBattlerOverrides {
  // 이름 오버라이드(enterHeroName 등). actorId → 이름.
  readonly names?: Readonly<Record<string, string>>;
  // 현재 faceset(Change Actor Faceset 포함). 전투 HUD가 DB 기본 얼굴로 되돌아가지 않게 한다.
  readonly faceResourceIds?: Readonly<Record<string, string>>;
  readonly faceIndices?: Readonly<Record<string, number>>;
  // 레벨 오버라이드(레벨업 반영값). actorId → 레벨. 없으면 DB initialLevel.
  readonly levels?: Readonly<Record<string, number>>;
  // 현재 바이탈(필드에서 이어지는 현재 HP/MP). actorId → {hp, mp}.
  readonly vitals?: Readonly<Record<string, { readonly hp: number; readonly mp: number }>>;
  // 런타임 영구 파라미터 보정(Change Parameters). actorId → parameterKey → delta.
  readonly paramBonuses?: Readonly<Record<string, Partial<Record<ActorParameterKey, number>>>>;
  readonly equipment?: Readonly<Record<string, ActorInitialEquipment>>;
  readonly skillIds?: Readonly<Record<string, readonly SkillId[]>>;
  readonly classOverrides?: Readonly<Record<string, string>>;
  // 필드에서 이어지는 런타임 상태 이상(Change State).
  readonly stateIds?: Readonly<Record<string, readonly string[]>>;
  // 현재 파티 편성(changeParty/순서변경 반영). 없으면 project.session(에디터 시작 상태).
  // 플레이 중 파티가 바뀌면 반드시 라이브 세션 값을 넘겨야 전투 편성이 일치한다.
  readonly partyActorIds?: readonly ActorId[];
}

export interface MutableBattler {
  readonly id: string;
  readonly recordId: ActorId | EnemyId;
  readonly classId?: string;
  readonly level?: number;
  readonly faceResourceId?: string;
  readonly faceIndex?: number;
  readonly battleCharacterResourceId?: string;
  // 아군측 배틀러가 파티 몬스터에서 합성된 경우 원 인스턴스/종족 식별자.
  // 스프라이트 해석과 전투 후 HP/EXP 되돌려쓰기의 키가 된다.
  readonly monsterInstanceId?: string;
  readonly speciesId?: string;
  readonly name: string;
  readonly maxHp: number;
  readonly maxMp: number;
  readonly attackPower: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
  readonly chargeRate: number;
  skillIds: SkillId[];
  readonly enemyActions?: readonly EnemyActionPattern[];
  readonly battleX?: number;
  readonly battleY?: number;
  hidden: boolean;
  captured?: boolean;
  hp: number;
  mp: number;
  gauge: number;
  stateIds: string[];
  equipmentEffects?: EquipmentRuntimeEffects;
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
    const effectiveClassId = effectiveActorClassId(project, { classOverrides: overrides?.classOverrides ? { ...overrides.classOverrides } : undefined }, actorId);
    const effectiveClass = project.database.classes.find((record) => record.id === effectiveClassId);
    const usesOverrideCurves = hasActorClassOverride({ classOverrides: overrides?.classOverrides ? { ...overrides.classOverrides } : undefined }, actorId) && effectiveClass !== undefined;
    const curves = usesOverrideCurves && effectiveClass ? effectiveClass.parameterCurves : normalizedActor.parameterCurves;
    // 세션 레벨(레벨업 반영값)이 있으면 그 레벨로 파라미터 곡선을 조회. 없으면 DB initialLevel.
    const level = clampLevel(overrides?.levels?.[actorId] ?? normalizedActor.initialLevel);
    const bonuses = overrides?.paramBonuses?.[actorId];
    const actorEquipment = overrides?.equipment?.[actorId] ?? normalizedActor.initialEquipment;
    const equipmentBonuses = totalEquipmentBonuses(project, actorEquipment);
    const maxHp = parameterWithBonus(curves.maxHp, level, bonuses?.maxHp, 1);
    const maxMp = parameterWithBonus(curves.maxMp, level, bonuses?.maxMp, 0);
    const attack = parameterWithBonus(curves.attack, level, (bonuses?.attack ?? 0) + equipmentBonuses.attack, 1);
    const defense = parameterWithBonus(curves.defense, level, (bonuses?.defense ?? 0) + equipmentBonuses.defense, 1);
    const mind = parameterWithBonus(curves.mind, level, (bonuses?.mind ?? 0) + equipmentBonuses.mind, 1);
    const agility = parameterWithBonus(curves.agility, level, (bonuses?.agility ?? 0) + equipmentBonuses.agility, 1);
    // 세션 현재 바이탈이 있으면 그 값을 이어받되(필드에서 이어지는 부상 상태 유지),
    // 이 전투 레벨 기준 최대치로 클램프. 없으면 완충 상태로 시작.
    const sessionVitals = overrides?.vitals?.[actorId];
    const hp = sessionVitals ? clampVital(sessionVitals.hp, maxHp) : maxHp;
    const mp = sessionVitals ? clampVital(sessionVitals.mp, maxMp) : maxMp;
    return {
      id: actor.id,
      recordId: actor.id,
      classId: effectiveClassId,
      level,
      faceResourceId: overrides?.faceResourceIds?.[actorId] ?? normalizedActor.faceResourceId,
      faceIndex: overrides?.faceIndices?.[actorId] ?? normalizedActor.faceIndex ?? 0,
      battleCharacterResourceId: normalizedActor.battleCharacterResourceId,
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
      // RM2k3 side-view: party stacks on the RIGHT, facing left into the field.
      battleX: 252,
      battleY: 96 + index * 36,
      gauge: 0,
      stateIds: [...(overrides?.stateIds?.[actorId] ?? [])],
      equipmentEffects: equipmentRuntimeEffects(project, actorEquipment),
      stateTurns: {},
      defending: false,
      skillIds: learnedSkillIds(project, normalizedActor, level, overrides?.skillIds?.[actorId], effectiveClassId, usesOverrideCurves),
      hidden: false,
    };
  });
}

export function learnedSkillIds(
  project: Project,
  actor: ReturnType<typeof normalizeActorRecord>,
  level: number,
  sessionSkillIds: readonly SkillId[] | undefined,
  effectiveClassId: string | undefined,
  overrideClassSkills: boolean
): SkillId[] {
  const ids = new Set<SkillId>(sessionSkillIds ?? []);
  for (const entry of actor.learnedSkills) if (entry.level <= level) ids.add(entry.skillId);
  const classId = overrideClassSkills ? effectiveClassId : actor.classId;
  for (const skillId of classLearnedSkillIdsUpToLevel(project, classId ?? actor.classId, level)) ids.add(skillId);
  return [...ids];
}

export interface EquipmentRuntimeEffects {
  readonly doubleAttack: boolean;
  readonly attackAll?: boolean;
  readonly elementalDefenseIds: readonly string[];
  readonly stateDefenseIds: readonly string[];
  readonly stateDefenseMode: "resist" | "inflict";
  readonly stateResistanceChance: number;
}

function totalEquipmentBonuses(project: Project, equipment: ActorInitialEquipment): { attack: number; defense: number; mind: number; agility: number } {
  const total = { attack: 0, defense: 0, mind: 0, agility: 0 };
  for (const equipmentId of logicalEquipmentIds(project, equipment)) {
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

function equipmentRuntimeEffects(project: Project, equipment: ActorInitialEquipment): EquipmentRuntimeEffects {
  const elementalDefenseIds = new Set<string>();
  const stateDefenseIds = new Set<string>();
  let doubleAttack = false;
  let attackAll = false;
  let stateResistanceChance = 0;
  let stateDefenseMode: "resist" | "inflict" = "resist";
  for (const equipmentId of logicalEquipmentIds(project, equipment)) {
    if (!equipmentId) continue;
    const record = project.database.equipment.find((entry) => entry.id === equipmentId);
    if (!record) continue;
    if (record.effectFlags.doubleAttack) doubleAttack = true;
    if (record.effectFlags.attackAll) attackAll = true;
    for (const elementId of record.elementalDefenseIds) elementalDefenseIds.add(elementId);
    for (const stateId of record.stateDefenseIds) stateDefenseIds.add(stateId);
    if (record.stateDefenseMode === "inflict") stateDefenseMode = "inflict";
    stateResistanceChance = Math.max(stateResistanceChance, record.stateResistanceChance);
  }
  return {
    doubleAttack,
    attackAll,
    elementalDefenseIds: [...elementalDefenseIds],
    stateDefenseIds: [...stateDefenseIds],
    stateDefenseMode,
    stateResistanceChance,
  };
}


function clampVital(value: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function parameterWithBonus(curve: readonly number[], level: number, bonus: number | undefined, min: number): number {
  const value = parameterValueAtLevel(curve, level) + (Number.isFinite(bonus) ? Math.trunc(bonus ?? 0) : 0);
  return Math.max(min, value);
}

// 파티 몬스터(MonsterInstance 배열, 필드 순서대로)를 아군측 배틀러로 합성한다.
// 액터 파이프라인 대신 이 배틀러들이 필드에 나서면 "내 포켓몬이 싸운다"가 성립한다.
export function monsterPartyBattlers(project: Project, instances: readonly MonsterInstance[]): MutableBattler[] {
  return instances.map((instance, index) => {
    const stats = monsterBattleStats(project, instance);
    const hp = monsterCurrentHp(project, instance);
    return {
      // id is the DOM/runtime node key; recordId is the script/command key (instanceId).
      id: `mon:${instance.instanceId}`,
      recordId: instance.instanceId as ActorId,
      monsterInstanceId: instance.instanceId,
      speciesId: instance.speciesId,
      level: instance.level,
      name: monsterDisplayName(project, instance),
      maxHp: stats.maxHp,
      hp,
      maxMp: stats.maxMp,
      mp: stats.maxMp,
      attackPower: stats.attack,
      defense: stats.defense,
      mind: stats.mind,
      agility: stats.agility,
      chargeRate: chargeRateFor(stats.agility),
      // RM2k3 side-view: monster party also stacks on the RIGHT.
      battleX: 252,
      battleY: 96 + index * 36,
      gauge: 0,
      stateIds: [],
      stateTurns: {},
      defending: false,
      skillIds: monsterSkillIds(project, instance),
      hidden: false,
    } satisfies MutableBattler;
  });
}

/** Alias kept for tests/docs that still say monsterBattlers. */
export const monsterBattlers = monsterPartyBattlers;

export function enemyBattlers(project: Project, troop: TroopRecord): MutableBattler[] {
  const members = troop.members?.length
    ? troop.members
    : (troop.enemyIds ?? []).map((enemyId, index) => ({
        enemyId,
        // RM2k3 side-view: enemies form on the LEFT.
        x: 84 + (index % 2) * 44,
        y: 52 + index * 36,
        hidden: false,
      }));
  return members.map((member, index) => {
    const enemyId = member.enemyId;
    const enemy = project.database.enemies.find((record) => record.id === enemyId);
    if (!enemy) throw new Error(`Missing enemy: ${enemyId}`);
    const normalizedEnemy = normalizeEnemyRecord(enemy);
    const stats = normalizedEnemy.stats;
    const authoredX = member.x;
    const authoredY = member.y;
    const formationX = 84 + (index % 2) * 44;
    const formationY = 52 + index * 36;
    // SC12 (M4): enemy troop coords that sit too far center (x>150) are
    // recentered into a left-side formation so they don't overlap the party.
    const recenteredX = authoredX != null && authoredX > 150 ? formationX : authoredX;
    const needsClassicFormation = recenteredX == null || authoredY == null;
    return {
      id: `enemy-${index + 1}`,
      recordId: enemy.id,
      level: normalizedEnemy.level,
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
      battleX: needsClassicFormation ? formationX : recenteredX!,
      battleY: needsClassicFormation ? formationY : authoredY!,
      gauge: 0,
      stateIds: [],
      stateTurns: {},
      defending: false,
      skillIds: normalizedEnemy.skillIds,
      enemyActions: normalizedEnemy.actions,
      // 몬스터 종 트룹 판별(인트로 "야생의 ○○" 분기)과 포획 UI가 스냅샷에서 읽는다.
      speciesId: normalizedEnemy.speciesId,
      hidden: member.hidden ?? false,
      captured: false,
    };
  });
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function battlerSnapshot(
  battler: MutableBattler,
  position?: { readonly battleX?: number; readonly battleY?: number },
  poseContext?: {
    readonly lastActionResult?: BattleActionResultSnapshot;
    readonly showActionPose?: boolean;
  }
): BattleBattlerSnapshot {
  const base = {
    id: battler.id,
    recordId: battler.recordId,
    name: battler.name,
    classId: battler.classId,
    level: battler.level,
    faceResourceId: battler.faceResourceId,
    faceIndex: battler.faceIndex,
    battleCharacterResourceId: battler.battleCharacterResourceId,
    monsterInstanceId: battler.monsterInstanceId,
    speciesId: battler.speciesId,
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
    equipmentEffects: battler.equipmentEffects,
    captured: battler.captured === true ? true : undefined,
  };
  return {
    ...base,
    pose: resolveBattlerPose({
      battler: base,
      lastActionResult: poseContext?.lastActionResult,
      showActionPose: poseContext?.showActionPose,
    }),
  };
}

function chargeRateFor(agility: number): number {
  return Math.max(CHARGE_FLOOR, agility * CHARGE_PER_AGILITY);
}
