import { effectivePromotionLineage, validActorClassOverride } from '@/project/growth/lineage';
import { growthEffects } from "@/project/growth/runtime";
import type { GrowthProgress, PromotionLineage } from "@/project/growth/types";
import { clampLevel, normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { startStateOf } from "@/project/session";
import type { MonsterInstance } from "@/project/session";
import { monsterBattleStats, monsterCurrentHp, monsterDisplayName, monsterSkillIds, normalizeMonsterInstanceBattleState } from "@/project/monsterCollection";
import { classLearnedSkillIdsUpToLevel, effectiveActorClassId } from "@/project/sessionClass";
import type { ActorId, ActorInitialEquipment, ActorParameterKey, EnemyActionPattern, EnemyId, Project, SkillId } from "@/project/types";
import { resolveBattlerPose } from "@/battle/battlePose";
import type { BattleActionResultSnapshot, BattleBattlerSnapshot } from "@/battle/types";
import { classicEnemyFormation } from "@/battle/battlerPlacements";
import type { TroopRecord } from "@/project/types/database";
import { effectiveActorEquipment, logicalEquipmentIds } from "@/project/equipmentRules";

const CHARGE_PER_AGILITY = 0.1 / 43;
const CHARGE_FLOOR = 0.02;
// Haste-aware charge: 상태 배율이 0.4~2.5 clamp, 둔화/가속 버프 설계 공간 확보.
// chargeRateFor는 기본 민첩만 계산; 상태 배율은 battleTurnGauge에서 haste 보정으로 적용.
// FLOOR는 유지하되, agi 8 이하는 0.02로 뭉개지던 문제를 완화하기 위해
// agi 기반 선형 + FLOOR 중 큰 값으로 유지 — 상태 둔화 시에도 최소 전진 보장.

// 세션에서 온 액터별 오버라이드. 모두 선택적이며, 없으면 DB 기본값으로 폴백한다.
export interface ActorBattlerOverrides {
  // 이름 오버라이드(enterHeroName 등). actorId → 이름.
  readonly names?: Readonly<Record<string, string>>;
  // 현재 faceset(Change Actor Faceset 포함). 전투 HUD가 DB 기본 얼굴로 되돌아가지 않게 한다.
  readonly faceResourceIds?: Readonly<Record<string, string>>;
  // 레벨 오버라이드(레벨업 반영값). actorId → 레벨. 없으면 DB initialLevel.
  readonly levels?: Readonly<Record<string, number>>;
  // 현재 바이탈(필드에서 이어지는 현재 HP/MP). actorId → {hp, mp}.
  readonly vitals?: Readonly<Record<string, { readonly hp: number; readonly mp: number }>>;
  // 런타임 영구 파라미터 보정(Change Parameters). actorId → parameterKey → delta.
  readonly paramBonuses?: Readonly<Record<string, Partial<Record<ActorParameterKey, number>>>>;
  readonly equipment?: Readonly<Record<string, ActorInitialEquipment>>;
  readonly skillIds?: Readonly<Record<string, readonly SkillId[]>>;
  readonly skillPp?: Readonly<Record<string, Readonly<Record<SkillId, number>>>>;
  readonly classOverrides?: Readonly<Record<string, string>>;
  readonly growthProgress?: GrowthProgress;
  readonly promotionLineage?: PromotionLineage;
  // 필드에서 이어지는 런타임 상태 이상(Change State).
  readonly stateIds?: Readonly<Record<string, readonly string[]>>;
  // 현재 파티 편성(changeParty/순서변경 반영). 없으면 project.session(에디터 시작 상태).
  // 플레이 중 파티가 바뀌면 반드시 라이브 세션 값을 넘겨야 전투 편성이 일치한다.
  readonly partyActorIds?: readonly ActorId[];
}

export interface MutableBattler {
  readonly id: string;
  readonly recordId: ActorId | EnemyId;
  // 전투 중 전직(promoteActor)이 클래스를 갱신할 수 있어 mutable.
  classId?: string;
  readonly level?: number;
  readonly faceResourceId?: string;
  readonly battleCharacterResourceId?: string;
  // 아군측 배틀러가 파티 몬스터에서 합성된 경우 원 인스턴스/종족 식별자.
  // 스프라이트 해석과 전투 후 HP/EXP 되돌려쓰기의 키가 된다.
  readonly monsterInstanceId?: string;
  readonly speciesId?: string;
  readonly name: string;
  // 파생 스탯: 전투 중 changeEquipment/promoteActor 가 refreshActorBattlerDerivedStats 로
  // 재계산할 수 있어 mutable. 생성 산식과 같은 actorDerivedStats 를 공유한다.
  maxHp: number;
  maxMp: number;
  attackPower: number;
  defense: number;
  mind: number;
  agility: number;
  chargeRate: number;
  skillIds: SkillId[];
  /** Remaining PP for authored monster moves. Missing means the legacy MP path. */
  skillPp?: Record<SkillId, number>;
  readonly enemyActions?: readonly EnemyActionPattern[];
  readonly battleX?: number;
  readonly battleY?: number;
  readonly authoredX?: number;
  readonly authoredY?: number;
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
    // 세션 레벨(레벨업 반영값)이 있으면 그 레벨로 파라미터 곡선을 조회. 없으면 DB initialLevel.
    const level = clampLevel(overrides?.levels?.[actorId] ?? normalizedActor.initialLevel);
    const actorEquipment = effectiveActorEquipment(project, normalizedActor, overrides?.equipment?.[actorId], effectiveActorClassId(project, overrides, actorId));
    const derived = actorDerivedStats(project, normalizedActor, {
      level,
      classOverrides: overrides?.classOverrides,
      growthProgress: overrides?.growthProgress,
      promotionLineage: overrides?.promotionLineage,
      paramBonuses: overrides?.paramBonuses?.[actorId],
      equipment: actorEquipment,
    });
    // 세션 현재 바이탈이 있으면 그 값을 이어받되(필드에서 이어지는 부상 상태 유지),
    // 이 전투 레벨 기준 최대치로 클램프. 없으면 완충 상태로 시작.
    const sessionVitals = overrides?.vitals?.[actorId];
    const hp = sessionVitals ? clampVital(sessionVitals.hp, derived.maxHp) : derived.maxHp;
    const mp = sessionVitals ? clampVital(sessionVitals.mp, derived.maxMp) : derived.maxMp;
    return {
      id: actor.id,
      recordId: actor.id,
      classId: derived.effectiveClassId,
      level,
      faceResourceId: overrides?.faceResourceIds?.[actorId] ?? normalizedActor.faceResourceId,
      battleCharacterResourceId: normalizedActor.battleCharacterResourceId,
      name: overrides?.names?.[actorId] ?? normalizedActor.name,
      maxHp: derived.maxHp,
      hp,
      maxMp: derived.maxMp,
      mp,
      attackPower: derived.attack,
      defense: derived.defense,
      mind: derived.mind,
      agility: derived.agility,
      chargeRate: derived.chargeRate,
      // RM2k3 side-view: party stacks on the RIGHT, facing left into the field.
      battleX: 252,
      battleY: 96 + index * 36,
      gauge: 0,
      stateIds: [...(overrides?.stateIds?.[actorId] ?? [])],
      equipmentEffects: derived.equipmentEffects,
      stateTurns: {},
      defending: false,
      skillIds: learnedSkillIds(project, normalizedActor, level, overrides?.skillIds?.[actorId], derived.effectiveClassId, derived.usesOverrideCurves, overrides?.growthProgress, { [actorId]: effectivePromotionLineage(project, overrides ?? {}, actorId) }),
      skillPp: overrides?.skillPp?.[actorId] ? { ...overrides.skillPp[actorId] } : undefined,
      hidden: false,
    };
  });
}

// 액터 배틀러의 파생 스탯 단일 산식(장비/클래스/영구 보정 기여 포함).
// actorBattlers 생성과 전투 중 재계산(refreshActorBattlerDerivedStats)이 이 함수를 공유해
// 이중 구현을 막는다 — 산식 변경은 반드시 여기서만 한다.
export interface ActorDerivedStats {
  readonly effectiveClassId?: string;
  readonly usesOverrideCurves: boolean;
  readonly maxHp: number;
  readonly maxMp: number;
  readonly attack: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
  readonly chargeRate: number;
  readonly equipmentEffects: EquipmentRuntimeEffects;
}

export function actorDerivedStats(
  project: Project,
  normalizedActor: ReturnType<typeof normalizeActorRecord>,
  input: {
    readonly level: number;
    readonly classOverrides?: Readonly<Record<string, string>>;
    readonly growthProgress?: GrowthProgress;
    readonly promotionLineage?: PromotionLineage;
    readonly paramBonuses?: Readonly<Partial<Record<ActorParameterKey, number>>>;
    // 유효 장비 프로젝션(effectiveActorEquipment 통과 값 또는 initialEquipment).
    readonly equipment: ActorInitialEquipment;
  }
): ActorDerivedStats {
  const session = { classOverrides: input.classOverrides ? { ...input.classOverrides } : undefined };
  const effectiveClassId = effectiveActorClassId(project, session, normalizedActor.id);
  const effectiveClass = project.database.classes.find((record) => record.id === effectiveClassId);
  const usesOverrideCurves = validActorClassOverride(project, session, normalizedActor.id) && effectiveClass !== undefined;
  const curves = usesOverrideCurves && effectiveClass ? effectiveClass.parameterCurves : normalizedActor.parameterCurves;
  const growth = growthEffects(project, { variables: {}, classOverrides: input.classOverrides ? { ...input.classOverrides } : undefined, growthProgress: input.growthProgress, promotionLineage: input.promotionLineage }, normalizedActor.id).bonuses;
  const bonuses = Object.fromEntries(Object.entries(growth).map(([k, v]) => [k, v + (input.paramBonuses?.[k as ActorParameterKey] ?? 0)])) as Record<ActorParameterKey, number>;
  const equipmentBonuses = totalEquipmentBonuses(project, input.equipment);
  const agility = parameterWithBonus(curves.agility, input.level, (bonuses?.agility ?? 0) + equipmentBonuses.agility, 1);
  return {
    effectiveClassId,
    usesOverrideCurves,
    maxHp: parameterWithBonus(curves.maxHp, input.level, bonuses?.maxHp, 1),
    maxMp: parameterWithBonus(curves.maxMp, input.level, bonuses?.maxMp, 0),
    attack: parameterWithBonus(curves.attack, input.level, (bonuses?.attack ?? 0) + equipmentBonuses.attack, 1),
    defense: parameterWithBonus(curves.defense, input.level, (bonuses?.defense ?? 0) + equipmentBonuses.defense, 1),
    mind: parameterWithBonus(curves.mind, input.level, (bonuses?.mind ?? 0) + equipmentBonuses.mind, 1),
    agility,
    chargeRate: chargeRateFor(agility),
    equipmentEffects: equipmentRuntimeEffects(project, input.equipment),
  };
}

// 전투 중 장비 변경(changeEquipment)/전직(promoteActor) 후 해당 액터 배틀러의
// 파생 스탯 필드만 갱신한다 — 재생성이 아니라서 현재 HP/MP·게이지·상태이상·상태턴을 보존하고,
// 새 최대치로만 클램프한다. 산식은 생성 로직(actorDerivedStats)과 100% 공유.
export function refreshActorBattlerDerivedStats(
  project: Project,
  battler: MutableBattler,
  input: {
    readonly classOverrides?: Readonly<Record<string, string>>;
    readonly growthProgress?: GrowthProgress;
    readonly promotionLineage?: PromotionLineage;
    readonly paramBonuses?: Readonly<Partial<Record<ActorParameterKey, number>>>;
    // 세션형(raw) 장비 스냅샷. 유효 프로젝션은 이 함수가 생성 경로와 동일하게 계산한다.
    readonly equipment?: ActorInitialEquipment;
    // 전직처럼 클래스 스킬 셋이 바뀔 때만 지정: 생성 로직(learnedSkillIds)으로 skillIds 재계산.
    readonly skills?: { readonly sessionSkillIds?: readonly SkillId[] };
  }
): void {
  const actor = project.database.actors.find((record) => record.id === battler.recordId);
  if (!actor) return;
  const normalizedActor = normalizeActorRecord(actor);
  const level = clampLevel(battler.level ?? normalizedActor.initialLevel);
  const classOverrideSession = { classOverrides: input.classOverrides ? { ...input.classOverrides } : undefined };
  const effectiveClassId = effectiveActorClassId(project, classOverrideSession, actor.id);
  // 생성 경로(runtime.ts)와 동일: raw 세션 장비를 유효 프로젝션으로 통과시킨 뒤 산식에 넣는다.
  const effectiveEquipment = effectiveActorEquipment(project, actor, input.equipment, effectiveClassId ?? actor.classId);
  const derived = actorDerivedStats(project, normalizedActor, {
    level,
    classOverrides: input.classOverrides,
    growthProgress: input.growthProgress,
    promotionLineage: input.promotionLineage,
    paramBonuses: input.paramBonuses,
    equipment: effectiveEquipment,
  });
  battler.classId = derived.effectiveClassId;
  battler.maxHp = derived.maxHp;
  battler.maxMp = derived.maxMp;
  battler.hp = clampVital(battler.hp, derived.maxHp);
  battler.mp = clampVital(battler.mp, derived.maxMp);
  battler.attackPower = derived.attack;
  battler.defense = derived.defense;
  battler.mind = derived.mind;
  battler.agility = derived.agility;
  battler.chargeRate = derived.chargeRate;
  battler.equipmentEffects = derived.equipmentEffects;
  if (input.skills) {
    battler.skillIds = learnedSkillIds(
      project,
      normalizedActor,
      level,
      input.skills.sessionSkillIds,
      derived.effectiveClassId,
      derived.usesOverrideCurves,
      input.growthProgress,
      { [actor.id]: effectivePromotionLineage(project, input, actor.id) }
    );
  }
}

export function learnedSkillIds(
  project: Project,
  actor: ReturnType<typeof normalizeActorRecord>,
  level: number,
  sessionSkillIds: readonly SkillId[] | undefined,
  effectiveClassId: string | undefined,
  overrideClassSkills: boolean,
  growthProgress?: GrowthProgress,
  promotionLineage?: PromotionLineage
): SkillId[] {
  const growth = growthEffects(project, { variables: {}, classOverrides: effectiveClassId ? { [actor.id]: effectiveClassId } : undefined, growthProgress, promotionLineage }, actor.id);
  const ids = new Set<SkillId>([...(sessionSkillIds ?? []), ...growth.skillIds]);
  for (const entry of actor.learnedSkills) if (entry.level <= level) ids.add(entry.skillId);
  const classId = overrideClassSkills ? effectiveClassId : actor.classId;
  for (const skillId of classLearnedSkillIdsUpToLevel(project, classId ?? actor.classId, level)) ids.add(skillId);
  return [...ids];
}

export interface EquipmentRuntimeEffects {
  readonly doubleAttack: boolean;
  readonly attackAll?: boolean;
  readonly accuracy?: number;
  readonly criticalRate?: number;
  readonly attackElementIds?: readonly string[];
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
  const attackElementIds = new Set<string>();
  const elementalDefenseIds = new Set<string>();
  const stateDefenseIds = new Set<string>();
  let doubleAttack = false;
  let attackAll = false;
  let accuracy = 100;
  let criticalRate = 0;
  let stateResistanceChance = 0;
  const stateDefenseMode = "resist" as const;
  for (const equipmentId of logicalEquipmentIds(project, equipment)) {
    if (!equipmentId) continue;
    const record = project.database.equipment.find((entry) => entry.id === equipmentId);
    if (!record) continue;
    if (record.effectFlags.doubleAttack) doubleAttack = true;
    if (record.effectFlags.attackAll) attackAll = true;
    accuracy = Math.round((accuracy * record.accuracy) / 100);
    criticalRate += record.criticalRate;
    for (const elementId of record.attackElementIds) attackElementIds.add(elementId);
    for (const elementId of record.elementalDefenseIds) elementalDefenseIds.add(elementId);
    if (record.stateDefenseMode === "resist") {
      for (const stateId of record.stateDefenseIds) stateDefenseIds.add(stateId);
      stateResistanceChance = Math.max(stateResistanceChance, record.stateResistanceChance);
    }
  }
  return {
    doubleAttack,
    attackAll,
    accuracy: Math.max(0, Math.min(100, accuracy)),
    criticalRate: Math.max(0, Math.min(100, criticalRate)),
    attackElementIds: [...attackElementIds],
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
    const hydrated = normalizeMonsterInstanceBattleState(project, instance);
    const stats = monsterBattleStats(project, hydrated);
    const hp = monsterCurrentHp(project, hydrated);
    return {
      // id is the DOM/runtime node key; recordId is the script/command key (instanceId).
      id: `mon:${hydrated.instanceId}`,
      recordId: hydrated.instanceId as ActorId,
      monsterInstanceId: hydrated.instanceId,
      speciesId: hydrated.speciesId,
      level: hydrated.level,
      name: monsterDisplayName(project, hydrated),
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
      stateIds: [...(hydrated.stateIds ?? [])],
      stateTurns: { ...(hydrated.stateTurns ?? {}) },
      defending: false,
      skillIds: monsterSkillIds(project, hydrated),
      skillPp: hydrated.skillPp ? { ...hydrated.skillPp } : undefined,
      hidden: false,
    } satisfies MutableBattler;
  });
}

/** Alias kept for tests/docs that still say monsterBattlers. */
export const monsterBattlers = monsterPartyBattlers;

/**
 * RM2k3 side-view 적 진형 좌표. 에디터 미리보기·기본 멤버 좌표와 런타임이
 * 같은 식을 쓰도록 여기서만 정의한다(중복 정의 금지).
 */
export { classicEnemyFormation } from "@/battle/battlerPlacements";

export function enemyBattlers(project: Project, troop: TroopRecord): MutableBattler[] {
  const members = troop.members?.length
    ? troop.members
    : (troop.enemyIds ?? []).map((enemyId, index) => ({
        enemyId,
        // RM2k3 side-view: enemies form on the LEFT.
        ...classicEnemyFormation(index),
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
    const { x: formationX, y: formationY } = classicEnemyFormation(index);
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
      authoredX,
      authoredY,
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
  const base: BattleBattlerSnapshot = {
    id: battler.id,
    recordId: battler.recordId,
    name: battler.name,
    classId: battler.classId,
    level: battler.level,
    faceResourceId: battler.faceResourceId,
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
    authoredX: battler.authoredX,
    authoredY: battler.authoredY,
    defeated: battler.hp <= 0,
    defending: battler.defending,
    stateIds: [...battler.stateIds],
    stateTurns: { ...battler.stateTurns },
    skillIds: [...battler.skillIds],
    skillPp: battler.skillPp ? { ...battler.skillPp } : undefined,
    equipmentEffects: battler.equipmentEffects,
    captured: battler.captured === true ? true : undefined,
    effectiveStats: { attack: battler.attackPower, defense: battler.defense, mind: battler.mind, agility: battler.agility },
    pose: "idle" as unknown as BattleBattlerSnapshot["pose"],
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
