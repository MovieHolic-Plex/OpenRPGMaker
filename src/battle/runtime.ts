import { BattleGimmickLedger, type BattleGimmick, type GimmickStatus } from "@/battle/battleGimmickRules";
import { formationDamage, formationStartRow, rollBattleFormation, type BattleRow, type BattleStartFormation } from "@/battle/battleFormation";
import { applyDifficultyToEnemyBattlers, difficultyRate, scaleByDifficulty } from "@/project/difficulty";
import { applySkillLoadoutsToBattlers } from "@/project/skillLoadout";
import { evaluateDamageFormula, formulaBattlerContext } from "@/battle/damageFormula";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { combatConditionMet } from "@/battle/combatConditions";
import { advanceBattleSkillCooldowns, startBattleSkillCooldown } from "@/battle/battleSkillUse";
import { damageEffectKind, firstLearnableSkill, pickRandomSkill, rollStealItem, scanMessage, weaknessElementNames } from "@/battle/battleSpecialEffects";
import { permanentActorSkillIds } from "@/project/growth/runtime";
import { inputSequencePowerMultiplier } from "@/battle/battleInputSequence";
import { battleElementMultiplier } from "@/battle/battleElementModifiers";
import { restoreSkillDrain, spendSkillHp } from "@/battle/battleSkillVitals";
import { effectiveActorClassId } from '@/project/sessionClass';
import { battleTroopError } from '@/project/battleAdmission';
import { activeItemEffects, isCaptureTool, itemAllowsBattle } from "@/project/itemUsage";
// SIZE_OK: Battle runtime keeps turn state, troop-event callbacks, and snapshot
// assembly together so battle-event regressions can verify one state machine.
import type { ActorId, EnemyId, ItemId, ItemRecord, Project, SkillId } from "@/project/types";
import { startStateOf } from "@/project/session";
import { transitionItemState } from "@/project/itemTransitions";
import { isBattleItemUserEligible } from "@/battle/battleItemEligibility";
import { DEFAULT_ANIMATION_ID, DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import { withJosa } from "@/util/josa";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { actorBattlers, average, battlerSnapshot, enemyBattlers, monsterPartyBattlers, moveBattler, refreshActorBattlerDerivedStats, type MutableBattler } from "@/battle/battleBattlers";
import {
  accuracyByteFromPercent,
  applySkillLike,
  createGen1ByteRng,
  resolveGen1DamagingMove,
  usesGen1Damage,
  usesMagicalDefense,
} from "@/battle/battleDamage";
import { createBattleEventRuntime, type BattleEventRuntimeResult, type BattleEventRuntimeState } from "@/battle/battleEvents";
import { collectBattleRewards } from "@/battle/battleRewards";
import { computeActorLevelUp, computeTechPointLearning } from "@/battle/battleLevelUp";
import { battlerTypes, gen1CanonicalTypeForId, gen1ElementIdForCanonical, gen1TypeModifiersForTypes } from "@/battle/typeChart";
import type { BattleLevelUpResult } from "@/battle/battleLevelUp";
import { expForRewardActor, rewardActorIds } from "@/battle/rewardPolicy";
import { captureItemMultiplier, captureStatusMultiplier, captureSuccessRate, monsterSpeciesForEnemy, previewMonsterExperience, rollMonsterIvs, type MonsterLevelUpPreview } from "@/project/monsterCollection";
import {
  applyStateEffects,
  agilityMultiplierForStates,
  attackMultiplierForStates,
  canBattlerAct as stateAllowsAction,
  clearBattleEndStates,
  defenseMultiplierForStates,
  defenseMultiplierForStatesByKind,
  forcedActionForStates,
  counterChanceForStates,
  evasionChanceForStates,
  reraiseForStates,
  stateFlag,
  transformResourceForStates,
  gaugeFrozenByStates,
  recoverStatesWhenHit,
  runStateUpkeep,
  stateBehavior,
  stateElementRateOverride,
} from "@/battle/battleStates";
import { chargeBattlers, nextReadyBattler } from "@/battle/battleTurnGauge";
import { resolveSkinId } from "@/battle/skins/registry";
import type { BattleSkinId } from "@/battle/skins/types";
import type {
  ActorCommand,
  ActorCommandDraft,
  BattleActionResultSnapshot,
  BattleAnimationSnapshot,
  BattleCapturedMonsterSnapshot,
  BattleCaptureResultSnapshot,
  BattleBattlerSnapshot,
  BattleFlow,
  BattleEventChoiceSnapshot,
  BattleEventPauseSnapshot,
  BattleEventPauseResponse,
  BattlePhase,
  BattleRoundActionLogSnapshot,
  BattleRoundLogSnapshot,
  BattleResult,
  BattleRuntime,
  BattleRuntimeOptions,
  BattleSessionState,
  BattleSnapshot,
  BattleTargetSelectionSnapshot,
  BattleTimelineEntrySnapshot,
  EquipmentUseResult,
  EquipmentUseTarget,
  TargetedActorCommand,
} from "@/battle/types";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { hitFeelFromActionResult } from "@/battle/battlePose";
import {
  DEFAULT_BATTLE_FIELD_BACKGROUND_ID,
  normalizeBattleFieldBackgroundId,
} from "@/project/databaseEnemyTroopRecordModel";
import { mulberry32, type Rng } from "@/util/rng";
import { battleActorSkillFailure, battleSkillMpCostFor, battleSkillPartyGaugeCost, battleSkillUseFailure, comboActorIdsOf, consumeBattleSkillResource, type BattleComboParticipant } from "@/battle/battleSkillUse";
import { applyBattleHitGauges, clampPartyGauge, initialPartyGauge, seedBattleGauges } from "@/battle/battleGauges";
import { applyStateEffectsWithEmotion, createWeaknessTracker, emotionDamageMultiplier } from "@/battle/battleEmotion";
import {
  areaTargets,
  requestedTargetId,
  resolveBattleTargets,
  targetIdFor,
  targetScopeForCommand,
  type BattleTargetScope,
} from "@/battle/battleTargetResolver";
import { actorAutoTactic, actorFightsAutomatically, chooseAutoBattleCommand } from "@/battle/battleAuto";
import { predictSkillDamage } from "@/battle/battlePredict";
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { orderGen1TurnActions, type Gen1TurnOrderEntry } from "@/battle/battleStrictOrder";
import { attemptGen1Capture } from "@/battle/gen1/capture";
import {
  applyGen1MajorStatus,
  applyGen1PostActionResidual,
  gen1EffectChanceSucceeds,
  gen1MajorStatusBlockedByType,
  gen1ParalyzedSpeed,
  readGen1MajorStatus,
  stepGen1MajorStatus,
} from "@/battle/gen1/status";

export type {
  ActorCommand,
  ActorCommandDraft,
  BattleActionResultSnapshot,
  BattleBattlerSnapshot,
  BattlePhase,
  BattleResult,
  BattleRuntime,
  BattleRuntimeOptions,
  BattleSnapshot,
  BattleTargetSelectionSnapshot,
  TargetedActorCommand,
  EquipmentUseResult,
  EquipmentUseTarget,
} from "@/battle/types";

/** Synchronous simulations cannot invent player input. */
export class BattleEventInputRequiredError extends Error {
  readonly code = "BATTLE_EVENT_INPUT_REQUIRED";
  constructor(readonly choice: BattleEventChoiceSnapshot | Extract<BattleEventPauseSnapshot, { kind: "inputWait" }>) {
    super(`BATTLE_EVENT_INPUT_REQUIRED: ${"pageId" in choice ? choice.pageId : choice.kind}/${choice.id}`);
    this.name = "BattleEventInputRequiredError";
  }
}

/** Headless policy skips presentation only, including consecutive nested requests. */
export function headlessBattleSnapshot(runtime: BattleRuntime): BattleSnapshot {
  let snapshot = runtime.snapshot();
  while (snapshot.eventPause && snapshot.eventPause.kind !== "inputWait") {
    const request = snapshot.eventPause;
    if (!runtime.resumeEventPause(request.id, { kind: request.kind })) throw new Error("Invalid headless battle continuation");
    snapshot = runtime.snapshot();
  }
  if (snapshot.eventChoice) throw new BattleEventInputRequiredError(snapshot.eventChoice);
  if (snapshot.eventPause?.kind === "inputWait") throw new BattleEventInputRequiredError(snapshot.eventPause);
  return snapshot;
}

const FALLBACK_SKILL_POWER = 12;
// SC1 (C1): strict flow round cap. Prevents unbounded recursion when neither
// side can end the battle (e.g. all actors asleep with no auto-recovery and a
// neutered enemy). Exceeding the cap resolves the battle as a stalemate escape.
const STRICT_MAX_ROUNDS = 200;
// Only a battle with every living gauge frozen uses this simulation-time clock.
const FROZEN_GAUGE_CYCLE_MS = 1000;
// m2-108 actionTimes 로 한 라운드에 부여할 수 있는 추가 행동 상한. 라운드 카드밀리(STRICT_MAX_ROUNDS)와
// 같은 이유의 가드다: 행동마다 다시 발화하는 배틀 이벤트 페이지(라운드 중복 제거 밖 조건)가
// 매번 +1 을 주면 한 라운드 루프가 끝나지 않는다.
const STRICT_MAX_EXTRA_ACTIONS_PER_ROUND = 20;
// 행동 moveTo 의 기본 이동 시간. m2 moveEnemy 는 durationMs 로 직접 준다.
const ENEMY_MOVE_DEFAULT_MS = 400;

type EnemyActionChoice = {
  readonly skillId: SkillId;
  readonly switchOnAfterAction: { readonly enabled: boolean; readonly switchId?: string };
  readonly switchOffAfterAction: { readonly enabled: boolean; readonly switchId?: string };
  readonly targetIds?: readonly string[];
  readonly moveTo?: { readonly x: number; readonly y: number };
  readonly requiresPart?: string;
};

/** ATB 속도 1~8 → 충전 배율. Chrono Trigger 처럼 숫자가 작을수록 빠르다(4 = 1.0, 1 = 1.45, 8 = 0.4). */
export function atbSpeedMultiplier(speed: number | undefined): number {
  if (typeof speed !== "number" || !Number.isFinite(speed)) return 1;
  const clamped = Math.max(1, Math.min(8, Math.round(speed)));
  return Math.round((1 + (4 - clamped) * 0.15) * 100) / 100;
}

/** 반격·부활 확률 판정. 100 이상은 rng 를 소비하지 않는다(시드 고정 밸런스가 바뀌지 않게). */
function rollChance(chance: number, rng: Rng): boolean {
  if (chance >= 100) return true;
  if (chance <= 0) return false;
  return rng() * 100 < chance;
}

/** 자동 부활 HP: 최대 HP 의 percent%, 최소 1. */
export function autoReviveHp(maxHp: number, percent: number): number {
  return Math.max(1, Math.floor((maxHp * Math.max(1, Math.min(100, percent))) / 100));
}

/** 도주 실패 1회당 가산 %p. 옵트인 — 생략 = 0 이라 필드가 없는 옛 프로젝트의 도주 확률은 그대로다(명작 공백 #34). */
export const DEFAULT_ESCAPE_BONUS_PERCENT = 0;

/**
 * 도주 확률(0~1). 기존 민첩 식(상한 95%)에 실패 횟수 × 가산을 더한다. 실패 0회면 예전 값 그대로.
 */
export function escapeChance(actorAgility: number, enemyAgility: number, failedAttempts: number, bonusPercent: number | undefined): number {
  const base = Math.min(0.95, 0.5 + (actorAgility - enemyAgility) / Math.max(1, enemyAgility) * 0.25);
  const bonus = Math.max(0, Number.isFinite(bonusPercent) ? bonusPercent! : DEFAULT_ESCAPE_BONUS_PERCENT);
  if (failedAttempts <= 0 || bonus === 0) return base;
  return Math.min(1, base + (failedAttempts * bonus) / 100);
}

/** 석화처럼 전투 불능으로 치는 상태(runtimeEffects.incapacitates)에 걸렸는가. */
export function isBattlerIncapacitated(project: Pick<Project, "database">, battler: { readonly stateIds: readonly string[] }): boolean {
  return battler.stateIds.some((stateId) =>
    project.database.states.find((state) => state.id === stateId)?.runtimeEffects?.incapacitates === true);
}

/** 전투 불능 상태는 행동도 막는다. 그 밖은 상태 규칙(battleStates.canBattlerAct) 그대로. */
function canBattlerAct(project: Project, battler: { readonly stateIds: readonly string[] }): boolean {
  return stateAllowsAction(project, battler) && !isBattlerIncapacitated(project, battler);
}

/** 받는 HP 피해 중 MP 로 돌리는 비율(0~1). 여러 상태면 합산 후 1 로 자른다. */
export function damageToMpRateForStates(project: Pick<Project, "database">, battler: { readonly stateIds: readonly string[] }): number {
  let rate = 0;
  for (const stateId of battler.stateIds) {
    const value = project.database.states.find((state) => state.id === stateId)?.runtimeEffects?.damageToMpRate;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) rate += value;
  }
  return Math.min(1, rate);
}

type StrictQueuedActorCommand = {
  readonly actorId: ActorId;
  readonly command: ActorCommand;
};

// priority: 기술 우선도(SkillRecord.movePriority, 기본 0) — 속도보다 먼저 비교.
// tieBreak: gen1 전용 동속 랜덤 롤. rm2k3 은 0 고정이라 기존 결정적 정렬(아군 우선 →
// index 순)이 그대로 유지된다 — battleStrictRuntime "without RNG" 계약의 근거.
type StrictQueuedAction =
  | ({ readonly side: "actor"; readonly index: number; readonly actor: MutableBattler; readonly command: ActorCommand } & Gen1TurnOrderEntry)
  | ({ readonly side: "enemy"; readonly index: number; readonly enemy: MutableBattler; readonly action?: EnemyActionChoice } & Gen1TurnOrderEntry);

export function createBattleRuntime(options: BattleRuntimeOptions): BattleRuntime {
  const admissionError = battleTroopError(options.project, options.troopId);
  if (admissionError) throw admissionError;
  const troop = options.project.database.troops.find((record) => record.id === options.troopId);
  if (!troop) throw new Error(`Missing troop: ${options.troopId}`);
  const troopRecord = troop;
  // SC5 (H4): rng is strongly recommended. If omitted, warn eagerly at construction
  // and fall back to a deterministic test seed (mulberry32(0)) — NOT the old fixed
  // mulberry32(1) which silently gave every rng-less battle the same sequence.
  if (!options.rng && typeof console !== "undefined" && console.warn) {
    console.warn("[battle] createBattleRuntime called without rng; using deterministic fallback. Pass nextSessionRandom(session, \"battle\") for save/load determinism.");
  }
  const rng: Rng = options.rng ?? mulberry32(0);
  const gen1 = options.project.system.battleModel === "gen1";
  const rawGen1Byte = createGen1ByteRng(rng);
  let repeatedGen1Byte: number | undefined;
  let repeatedGen1ByteCount = 0;
  const nextGen1Byte = (): number => {
    const value = rawGen1Byte();
    repeatedGen1ByteCount = value === repeatedGen1Byte ? repeatedGen1ByteCount + 1 : 1;
    repeatedGen1Byte = value;
    // Rejection sampling is exact for a real RNG, but a deliberately constant
    // injected test RNG must not hang the battle forever. Eight identical
    // rejected bytes are astronomically unlikely in a uniform byte stream.
    if (value !== 255 && repeatedGen1ByteCount >= 8) {
      repeatedGen1ByteCount = 0;
      repeatedGen1Byte = 255;
      return 255;
    }
    return value;
  };
  const battleFlow: BattleFlow = options.battleFlow ?? troopRecord.battleFlow ?? options.project.system.battleFlow ?? "strict";
  // B: skin-driven ATB haste — chrono fast, dq/mother slow, octopath subtle
  const skinHasteMultiplier = (() => {
    try {
      const skinId = resolveSkinId((options.project as unknown as { system?: { battleUiStyle?: string } }).system?.battleUiStyle) as BattleSkinId;
      const map: Record<string, number> = { chrono: 1.18, bravely: 1.08, octopath: 1.06, ff: 1.04, rm2000: 1.02, dragonquest: 0.92, mother: 0.88 };
      return (map[skinId] ?? 1) * atbSpeedMultiplier(options.project.system.atbSpeed);
    } catch { return 1; }
  })();
  // Active ATB: gauge 흐름에서만 의미가 있다. strict 는 라운드제라 메뉴가 시간을 멈추지 않는다.
  const activeAtb = battleFlow === "gauge" && options.project.system.atbMode === "active";

  /* 포켓몬 스킨은 1:1 대치 문법이다 — 상대가 하나뿐인데 「슬라임 / 뒤로」 목록을 띄우고 확인키를
     한 번 더 받는 것이 이 스킨에서 가장 눈에 띄던 군더더기였다(감독 지적, 실측 A-03-target).
     본가는 기술을 고르는 순간 실행된다. 스킨 스코프로만 켠다 — rm2000/rm2003 은 명령 확정 뒤
     「뒤로」로 물러나는 경로가 계약이라(openwiki/runtime-battle.md) 건드리면 안 된다.
     후보가 둘 이상이면 포켓몬에서도 목록이 뜬다(다수 적 트룹). */
  const autoConfirmSingleTarget = (() => {
    try {
      const skinId = resolveSkinId(
        (options.project as unknown as { system?: { battleUiStyle?: string } }).system?.battleUiStyle,
      ) as BattleSkinId;
      return skinId === "pokemon";
    } catch {
      return false;
    }
  })();

  // Runtime-only growth fields are optional on the authored ProjectSession fallback.
  const rawSessionState = options.sessionState ?? startStateOf(options.project);
  const sessionState = rawSessionState as BattleSessionState;
  const actorEquipment = new Map(
    options.project.database.actors.map((actor) => [
      actor.id,
      effectiveActorEquipment(
        options.project,
        actor,
        sessionState.actorEquipment?.[actor.id] ?? options.party?.equipment?.[actor.id],
        effectiveActorClassId(options.project, {classOverrides:sessionState.classOverrides ?? options.party?.classOverrides}, actor.id)
      ),
    ])
  );
  // 아군측 소스: battleParty==="monsters" 또는 레거시 monsterBattleParty, 그리고 파티 몬스터가 있으면 몬스터가 필드에 나선다.
  // 그 외에는 기존대로 파티 액터가 직접 싸운다.
  const usePartyMonsters =
    (options.project.system.battleParty === "monsters" || options.project.system.monsterBattleParty === true)
    && (options.partyMonsters?.length ?? 0) > 0;
  const actors = usePartyMonsters
    ? monsterPartyBattlers(options.project, options.partyMonsters ?? [])
    : actorBattlers(options.project, {
        names: options.party?.names,
        faceResourceIds: options.party?.faceResourceIds,
        levels: sessionState.actorLevels ?? options.party?.levels,
        vitals: options.party?.vitals,
        paramBonuses: options.party?.paramBonuses,
        equipment: Object.fromEntries(actorEquipment),
        skillIds: sessionState.actorSkillIds ?? options.party?.skillIds,
        skillPp: options.party?.skillPp,
        rows: options.party?.rows,
        classOverrides: sessionState.classOverrides ?? options.party?.classOverrides,
        growthProgress: sessionState.growthProgress ?? options.party?.growthProgress,
        promotionLineage: sessionState.promotionLineage ?? options.party?.promotionLineage,
        stateIds: options.party?.stateIds,
        partyActorIds: options.party?.partyActorIds,
      });
  if (!usePartyMonsters) applySkillLoadoutsToBattlers(options.project, actors, sessionState.actorSkillLoadouts);
  const enemies = enemyBattlers(options.project, troopRecord);
  // 리미트·기력·파티 게이지(battleGauges). 끈 프로젝트는 필드를 만들지 않는다.
  seedBattleGauges(options.project, actors);
  let partyGauge = initialPartyGauge(options.project);
  const weakness = createWeaknessTracker(options.project);
  applyDifficultyToEnemyBattlers(options.project.system, sessionState, enemies);
  const gen1EnemyOrderIds = options.project.system.battleModel === "gen1"
    ? enemies.filter((enemy) => !enemy.hidden).map((enemy) => enemy.id)
    : [];
  let activeGen1EnemyId = gen1EnemyOrderIds[0];
  const requestedActiveSlots = options.activeSlots
    ?? troopRecord.activeSlots
    ?? options.project.system.activeSlots
    ?? (gen1 ? 1 : undefined);
  const activeSlots = normalizeActiveSlots(requestedActiveSlots, actors.length);
  let activeActorIds: ActorId[] = actors.slice(0, activeSlots).map((actor) => actor.recordId);
  // 전투 개시 진형: 명시(명령·심볼 접촉) > 시스템 굴림 > 보통. 굴림이 꺼져 있으면 rng 를 쓰지 않아 기존 시드 흐름이 그대로다.
  const formation: BattleStartFormation = options.formation
    ?? (options.project.system.battleFormationRoll === true && !gen1
      ? rollBattleFormation({
          partyAgility: average(actors.slice(0, activeSlots).filter((actor) => actor.hp > 0).map((actor) => actor.agility)),
          enemyAgility: average(enemies.filter((enemy) => !enemy.hidden && enemy.hp > 0).map((enemy) => enemy.agility)),
          preemptiveEquipment: actors.slice(0, activeSlots).some((actor) => actorHasPreemptiveEquipment(actor.recordId)),
        }, rng)
      : "normal");
  if (formation === "backAttack" || formation === "pincer") {
    for (const actor of actors) (actor as { row?: BattleRow }).row = formationStartRow(actor.row, formation);
  }
  // strict 첫 라운드: 선제면 적이, 기습이면 아군이 쉰다. gauge 는 시작 게이지로 같은 뜻을 낸다.
  let formationRoundPending = formation === "preemptive" || formation === "surprise";
  if (battleFlow !== "strict" && formationRoundPending) {
    for (const actor of actors) actor.gauge = formation === "preemptive" ? 100 : 0;
    for (const enemy of enemies) enemy.gauge = formation === "surprise" ? 100 : 0;
    formationRoundPending = false;
  }
  let failedEscapeAttempts = 0;
  // 이번 strict 라운드에서 쉬는 쪽(진형 첫 라운드 전용).
  let strictFormationSkipSide: "actor" | "enemy" | undefined;

  function actorHasPreemptiveEquipment(actorId: string): boolean {
    const equipment = actorEquipment.get(actorId as ActorId);
    if (!equipment) return false;
    return Object.values(equipment).some((equipmentId) =>
      Boolean(equipmentId) && options.project.database.equipment.find((record) => record.id === equipmentId)?.effectFlags.preemptive === true);
  }
  // override → troop → terrain(at location) → forest. Never System2 gauge sheets.
  let backdropResourceId = resolveBattleBackdrop({
    project: options.project,
    troopId: options.troopId,
    overrideResourceId: options.backdropResourceId,
    location: options.captureLocation
      ? { mapId: options.captureLocation.mapId, x: options.captureLocation.x, y: options.captureLocation.y }
      : undefined,
  });

  let phase: BattlePhase = battleFlow === "strict" ? "actorCommand" : "charging";
  let activeActorId: ActorId | undefined;
  let lastAnimation: BattleAnimationSnapshot | undefined;
  let lastActionResult: BattleActionResultSnapshot | undefined;
  // Compatibility action log plus the canonical ordered append-only timeline.
  const actionLog: BattleActionResultSnapshot[] = [];
  const timeline: BattleTimelineEntrySnapshot[] = [];
  const gimmicks = new BattleGimmickLedger();
  // 지금 실행 중인 명령의 번호. 명령이 시작될 때 올리고, 그동안 기록되는 엔트리에 찍는다(연출 묶음의 열쇠).
  let actionCounter = 0;
  let currentActionId: number | undefined;
  function beginTimelineAction(): void {
    actionCounter += 1;
    currentActionId = actionCounter;
  }
  function recordTimeline(entry: Omit<BattleTimelineEntrySnapshot, "sequence">): void {
    const stamped = currentActionId !== undefined && entry.actionId === undefined ? { ...entry, actionId: currentActionId } : entry;
    timeline.push({ ...stamped, sequence: timeline.length });
  }
  /** 방금 기록된 타임라인 엔트리에 애니메이션을 붙인다. 스킬/아이템 실행부가
   *  recordAction 직후 lastAnimation 을 세팅하므로, 그 시점에 호출해 엔트리와 짝을 맞춘다. */
  function attachAnimationToLatestTimeline(animation: BattleAnimationSnapshot): void {
    const latest = timeline[timeline.length - 1];
    if (latest) (latest as { animation?: BattleAnimationSnapshot }).animation = animation;
  }

  function recordAction(
    entry: BattleActionResultSnapshot,
    kind: BattleTimelineEntrySnapshot["kind"] = entry.hit ? "damage" : "miss",
    commandKind?: BattleTimelineEntrySnapshot["commandKind"],
    resource?: "hp" | "mp",
  ): void {
    lastActionResult = entry;
    actionLog.push(entry);
    recordTimeline({
      kind,
      side: actors.some((actor) => actor.recordId === entry.userRecordId || actor.id === entry.userRecordId) ? "actor" : "enemy",
      userRecordId: entry.userRecordId,
      targetId: entry.targetId,
      commandKind,
      hit: entry.hit,
      amount: entry.amount,
      critical: entry.critical,
      skillName: entry.skillName,
      ...(entry.skillId ? { skillId: entry.skillId } : {}),
      ...(resource ? { resource } : {}),
    });
  }
  let result: BattleResult | undefined;
  let cancelled = false;
  let eventChoice: BattleEventChoiceSnapshot | undefined;
  let eventPause: BattleEventPauseSnapshot | undefined;
  let afterBattleEvents: (() => void) | undefined;
  let strictResolution: { readonly round: number; readonly actions: StrictQueuedAction[]; index: number; grantedExtraActions: number } | undefined;
  let drainingStrictActions = false;
  let escaped = false;
  // turn 의 의미를 두 플로우에서 통일한다: **완료된 행동 사이클 수**.
  // strict 는 라운드 완료 시 +1. gauge 에서는 생존 배틀러 전원이 한 번씩 행동(또는
  // 행동 불가로 스킵)할 때마다 사이클이 닫히며 +1 — 예전에는 적 행동 1회마다 +1 이라
  // 트룹 이벤트의 turn/everyRound 조건과 적 행동 패턴(turn)이 모델마다 다른 케이던스로
  // 발화했다(적대 리뷰: 적 3체 기준 gauge 의 "3턴"은 사실상 1라운드였다).
  let turn = 0;
  // The cycle containing the current action, before a gauge completion increments turn.
  let rewardTurn = 1;
  // 현재 gauge 사이클에서 이미 행동 슬롯을 소비한 배틀러 id(행동 불가 스킵 포함).
  const gaugeCycleActed = new Set<string>();
  let frozenGaugeElapsedMs = 0;
  let currentActorCommandKind: ActorCommand["kind"] | undefined;
  let lastCaptureResult: BattleCaptureResultSnapshot | undefined;
  let targetSelection: BattleTargetSelectionSnapshot | undefined;
  let strictActorCommands: StrictQueuedActorCommand[] = [];
  let strictPendingActorIds: ActorId[] = [];
  let strictCurrentRoundActions: BattleRoundActionLogSnapshot[] = [];
  let strictCurrentRoundParticipantIds = new Set<ActorId>();
  let strictRoundTimelineStart = 0;
  let strictRoundCount = 0;
  const roundLogs: BattleRoundLogSnapshot[] = [];
  const capturedMonsters: BattleCapturedMonsterSnapshot[] = [];
  // 훔치기에 성공한 적(적마다 한 번). 부위 파괴를 이미 알린 배틀러.
  const stolenFrom = new Set<string>();
  const brokenPartIds = new Set<string>();
  const participatingActorIds = new Set<ActorId>();
  const rewards: {
    exp: number;
    gold: number;
    items: ItemId[];
    enemyLevel?: number;
    levelUps: BattleLevelUpResult[];
    monsterLevelUps: MonsterLevelUpPreview[];
    tp?: number;
    techLearned?: { actorId: string; actorName: string; skillIds: SkillId[] }[];
  } = { exp: 0, gold: 0, items: [], levelUps: [], monsterLevelUps: [] };
  // Mutable battle authority is detached from the live session seed.
  const battleEventState: BattleEventRuntimeState = {
    messageWindowSettings: sessionState.messageWindowSettings ? { ...sessionState.messageWindowSettings } : undefined,
    switches: { ...sessionState.switches },
    variables: { ...sessionState.variables },
    // 세션 셀프 스위치 스냅샷 사본(깊은 복사). setSelfSwitch 가 여기 기록하고
    // 전투 종료 시 applyBattleRewardsToSession 이 세션에 되돌려 쓴다.
    selfSwitches: Object.fromEntries(
      Object.entries(sessionState.selfSwitches ?? {}).map(([eventId, keys]) => [eventId, { ...keys }])
    ),
    // 직전 전투 처리 결과(세션 SSOT 스냅샷). battleResult 조건 평가 기준.
    battleResult: sessionState.battleResult,
    roguelikeRun: sessionState.roguelikeRun ? structuredClone(sessionState.roguelikeRun) : undefined,
    difficultyId: sessionState.difficultyId,
    monsterInstances: structuredClone(sessionState.monsterInstances ?? {}),
    monsterParty: [...(sessionState.monsterParty ?? [])],
    monsterBox: [...(sessionState.monsterBox ?? [])],
    inventory: { ...sessionState.inventory },
    itemUseCharges: { ...(sessionState.itemUseCharges ?? {}) },
    gold: typeof sessionState.gold === "number" ? sessionState.gold : 0,
    // null 칸(배우가 아닌 changeParty 가 남긴 것)은 보상·조건 판정에서도 뺀다.
    partyActorIds: [...(sessionState.partyActorIds ?? options.party?.partyActorIds ?? options.project.system.startActorIds)]
      .filter((id): id is string => typeof id === "string" && id !== ""),
    actorSkillIds: Object.fromEntries(
      Object.entries(sessionState.actorSkillIds ?? options.party?.skillIds ?? {}).map(([id, skills]) => [id, [...skills]])
    ),
    actorExperience: { ...(sessionState.actorExperience ?? options.party?.experience ?? {}) },
    actorLevels: {
      // Default-state battles still have authored levels on their actor battlers.
      // Seed the shared preview/write-back authority, never monster instance levels.
      ...Object.fromEntries(usePartyMonsters ? [] : actors.map(actor => [actor.recordId, actor.level!])),
      ...(sessionState.actorLevels ?? options.party?.levels ?? {}),
    },
    actorBattleCommands: Object.fromEntries(
      Object.entries(
        sessionState.actorBattleCommands
          ?? (options.party?.battleCommands as Record<string, readonly string[]> | undefined)
          ?? {}
      ).map(([id, cmds]) => [id, [...cmds]])
    ),
    // 레거시 호환 flags / 타이머 잔여 초: setFlag·timer 커맨드가 쓰고 timer 조건이 읽는
    // 세션 스냅샷 사본. 전투 종료 시 applyBattleRewardsToSession 이 세션에 되돌려 쓴다.
    flags: { ...(sessionState.flags ?? {}) },
    timers: { ...(sessionState.timers ?? {}) },
    // 세션 장비/직업 오버라이드 스냅샷 사본(Step 3d): changeEquipment/promoteActor 가 여기 기록하고
    // 전투 종료 시 applyBattleRewardsToSession 이 세션에 되돌려 쓴다(canLose=false 패배는 미반영).
    actorEquipment: Object.fromEntries(
      Object.entries(sessionState.actorEquipment ?? options.party?.equipment ?? {}).map(([actorId, equipment]) => [actorId, { ...equipment }])
    ),
    classOverrides: { ...(sessionState.classOverrides ?? options.party?.classOverrides ?? {}) },
    promotionLineage: structuredClone(sessionState.promotionLineage ?? options.party?.promotionLineage),
    growthProgress: structuredClone(sessionState.growthProgress ?? options.party?.growthProgress),
    gameTime: "gameTime" in sessionState ? sessionState.gameTime : undefined,
    // 명작 공백 G1 — 페이지 조건 스냅샷(읽기 전용, write-back 없음).
    actorVitals: "actorVitals" in sessionState ? structuredClone(sessionState.actorVitals) : undefined,
    actorStateIds: "actorStateIds" in sessionState ? structuredClone(sessionState.actorStateIds) : undefined,
    playerFacing: "playerFacing" in sessionState ? sessionState.playerFacing : undefined,
    eventLocations: "eventLocations" in sessionState ? structuredClone(sessionState.eventLocations) : undefined,
    horror: "horror" in sessionState ? structuredClone(sessionState.horror) : undefined,
    stringVariables: "stringVariables" in sessionState ? { ...(sessionState.stringVariables ?? {}) } : undefined,
    clearHistory: "clearHistory" in sessionState ? structuredClone(sessionState.clearHistory) : undefined,
    npcActivities: "npcActivities" in sessionState ? { ...(sessionState.npcActivities ?? {}) } : undefined,
    friendship: "friendship" in sessionState ? { ...(sessionState.friendship ?? {}) } : undefined,
    relationships: "relationships" in sessionState ? { ...(sessionState.relationships ?? {}) } : undefined,
  };
  // 부위 손실(#8): 필드에서 이미 지니고 들어온 상태도 그 슬롯 보너스를 뺄다 — 전투 중 부여만 보면 영구 부상이 무기 보너스를 그대로 둔다.
  if (!usePartyMonsters) {
    for (const actor of actors) if (lostEquipSlots(actor).size > 0) refreshActorStats(actor);
  }
  const battleEvents = createBattleEventRuntime({
    project: options.project,
    troopRecord,
    ownerEventId: options.ownerEventId,
    ownerEvent: findProjectEvent(options.project, options.ownerEventId),
    actors,
    enemies,
    stateIds: options.project.database.states.map((state) => state.id),
    state: battleEventState,
    revealEnemy: revealEnemyTarget,
    changeBattleback: (resourceId) => {
      backdropResourceId =
        normalizeBattleFieldBackgroundId(resourceId)
        ?? resolveBattleBackdrop({
          project: options.project,
          troopId: options.troopId,
          location: options.captureLocation
            ? { mapId: options.captureLocation.mapId, x: options.captureLocation.x, y: options.captureLocation.y }
            : undefined,
        })
        ?? DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
    },
    showBattleAnimation: (target, animationId) => {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, animationId, target);
    },
    // changeEquipment/promoteActor 후 파생 스탯 재계산 — battleBattlers 생성 산식과 공유.
    // HP/MP/게이지/상태이상은 refreshActorBattlerDerivedStats 가 보존(새 최대치 클램프만).
    // 부위 손실 상태가 있으면 그 슬롯을 비운 장비로 계산한다(refreshActorStats). 스킬을 새로 고치면 장착 칸도 다시 건다.
    refreshActorDerivedStats: (battler, refreshOptions) => {
      refreshActorStats(battler, refreshOptions?.refreshSkills === true);
      if (refreshOptions?.refreshSkills) applySkillLoadoutsToBattlers(options.project, [battler], sessionState.actorSkillLoadouts);
    },
    playAudio: options.playAudio,
    stopAudio: options.stopAudio,
    moveEnemy: moveEnemyByTarget,
  });
  markActiveParticipants();

  function battlerSide(battler: MutableBattler): "actor" | "enemy" {
    return actors.some((entry) => entry.id === battler.id) ? "actor" : "enemy";
  }

  function applyUpkeep(battler: MutableBattler): void {
    advanceGimmicks(battler);
    const upkeep = runStateUpkeep(options.project, battler, rng);
    if (upkeep.doomedStateId) {
      // 선고가 다 찼다: 남은 HP 를 지속 피해로 깎는 엔트리 하나(쓰러지는 연출이 따라온다). stateId·message 가 있으면
      // 시퀀서는 「상태 이상으로 N 피해」 대신 이 문장을 읽고, 숫자 대신 상태 이름을 띄운다.
      const name = options.project.database.states.find((state) => state.id === upkeep.doomedStateId)?.name ?? "선고";
      recordTimeline({
        kind: "stateUpkeep", side: battlerSide(battler), targetId: battler.id, amount: upkeep.doomedHp ?? 0,
        stateId: upkeep.doomedStateId, message: `${name}의 시간이 다했다 — ${withJosa(battler.name, "이/가")} 쓰러졌다!`,
      });
      battler.gauge = 0;
    }
    if (upkeep.hpDamage > 0) {
      recordTimeline({ kind: "stateUpkeep", side: battlerSide(battler), targetId: battler.id, amount: upkeep.hpDamage });
    }
    if (upkeep.hpHealing > 0) {
      recordTimeline({ kind: "stateRecovery", side: battlerSide(battler), targetId: battler.id, amount: upkeep.hpHealing });
    }
    for (const stateId of upkeep.removedStateIds) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "natural" });
    }
    refreshAfterStateChange(battler, upkeep.removedStateIds);
  }

  function recoverHitStates(battler: MutableBattler): void {
    const removed = recoverStatesWhenHit(options.project, battler, rng);
    for (const stateId of removed) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "hit" });
    }
    refreshAfterStateChange(battler, removed);
  }

  function applyStates(
    user: MutableBattler,
    target: MutableBattler,
    effects: Parameters<typeof applyStateEffects>[2],
    gen1Move?: { readonly type?: string; readonly kind: "damage" | "status" },
  ): void {
    if (gen1) {
      applyGen1States(user, target, effects ?? [], gen1Move);
      return;
    }
    const result = applyStateEffectsWithEmotion(options.project, target, effects, rng);
    for (const stateId of result.added) {
      recordTimeline({ kind: "stateAdded", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, stateId, reason: "effect" });
    }
    for (const stateId of result.removed) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, stateId, reason: "effect" });
    }
    refreshAfterStateChange(target, [...result.added, ...result.removed]);
  }

  function gen1StateRecords() {
    return options.project.database.states.map((state) => ({
      id: state.id,
      gen1MajorStatus: state.gen1MajorStatus,
    }));
  }

  function applyGen1States(
    user: MutableBattler,
    target: MutableBattler,
    effects: readonly { readonly stateId: string; readonly chance: number; readonly operation: "add" | "remove" }[],
    move: { readonly type?: string; readonly kind: "damage" | "status" } | undefined,
  ): void {
    const stateRecords = gen1StateRecords();
    for (const effect of effects) {
      const stateRecord = stateRecords.find((state) => state.id === effect.stateId);
      if (
        effect.operation === "add"
        && stateRecord?.gen1MajorStatus
        && move
        && gen1MajorStatusBlockedByType(
          stateRecord.gen1MajorStatus,
          gen1CanonicalTypeForId(options.project, move.type),
          battlerTypes(options.project, target).flatMap((typeId) => {
            const canonical = gen1CanonicalTypeForId(options.project, typeId);
            return canonical ? [canonical] : [];
          }),
          move.kind,
        )
      ) continue;
      if (!gen1EffectChanceSucceeds(effect.chance, nextGen1Byte)) continue;
      if (effect.operation === "remove") {
        if (!target.stateIds.includes(effect.stateId)) continue;
        target.stateIds = target.stateIds.filter((stateId) => stateId !== effect.stateId);
        delete target.stateTurns[effect.stateId];
        recordTimeline({
          kind: "stateRemoved",
          side: battlerSide(user),
          userRecordId: user.recordId,
          targetId: target.id,
          stateId: effect.stateId,
          reason: "effect",
        });
        continue;
      }

      if (stateRecord?.gen1MajorStatus) {
        const applied = applyGen1MajorStatus({
          stateIds: target.stateIds,
          stateTurns: target.stateTurns,
          stateRecords,
          incomingStateId: effect.stateId,
        }, nextGen1Byte);
        target.stateIds = [...applied.stateIds];
        target.stateTurns = { ...applied.stateTurns };
        if (!applied.applied) continue;
      } else {
        if (target.stateIds.includes(effect.stateId)) continue;
        target.stateIds = [...target.stateIds, effect.stateId];
        target.stateTurns[effect.stateId] = 0;
      }
      recordTimeline({
        kind: "stateAdded",
        side: battlerSide(user),
        userRecordId: user.recordId,
        targetId: target.id,
        stateId: effect.stateId,
        reason: "effect",
      });
    }
  }

  function gen1MajorStatusOf(battler: MutableBattler) {
    return readGen1MajorStatus(battler.stateIds, battler.stateTurns, gen1StateRecords());
  }

  function prepareGen1CombatAction(battler: MutableBattler): boolean {
    if (!gen1) return true;
    const beforeStatus = gen1MajorStatusOf(battler);
    const stepped = stepGen1MajorStatus({
      stateIds: battler.stateIds,
      stateTurns: battler.stateTurns,
      stateRecords: gen1StateRecords(),
    }, nextGen1Byte);
    battler.stateIds = [...stepped.stateIds];
    battler.stateTurns = { ...stepped.stateTurns };
    if (beforeStatus && !battler.stateIds.includes(beforeStatus.stateId)) {
      recordTimeline({
        kind: "stateRemoved",
        side: battlerSide(battler),
        targetId: battler.id,
        stateId: beforeStatus.stateId,
        reason: "natural",
      });
    }
    if (stepped.canAct) return true;
    recordIncapacitated(battler);
    applyGen1Residual(battler);
    return false;
  }

  function applyGen1Residual(battler: MutableBattler): void {
    if (!gen1 || battler.hp <= 0) return;
    const status = gen1MajorStatusOf(battler);
    const residual = applyGen1PostActionResidual({
      kind: status?.kind,
      maxHp: battler.maxHp,
      currentHp: battler.hp,
    });
    battler.hp = residual.currentHp;
    if (residual.damage > 0) {
      recordTimeline({
        kind: "stateUpkeep",
        side: battlerSide(battler),
        targetId: battler.id,
        amount: residual.damage,
        stateId: status?.stateId,
      });
    }
  }

  function gen1ModifiedStat(
    battler: MutableBattler,
    kind: "attack" | "defense",
    value: number,
  ): number {
    const withoutBurn = {
      ...battler,
      stateIds: battler.stateIds.filter((stateId) => {
        const state = options.project.database.states.find((record) => record.id === stateId);
        return state?.gen1MajorStatus !== "burn";
      }),
    };
    const multiplier = kind === "attack"
      ? attackMultiplierForStates(options.project, withoutBurn)
      : defenseMultiplierForStates(options.project, battler);
    return Math.max(1, Math.trunc(value * multiplier));
  }

  function gen1BaseSpeed(battler: MutableBattler): number {
    const species = battler.speciesId
      ? options.project.database.monsterSpecies?.find((record) => record.id === battler.speciesId)
      : undefined;
    return species?.baseStats.agility ?? battler.agility;
  }

  function applyExactGen1Damage(
    user: MutableBattler,
    target: MutableBattler,
    move: {
      readonly power: number;
      readonly elementId?: string;
      readonly hitRate?: number;
      readonly criticalRate?: "normal" | "high";
      readonly criticalChancePercent?: number;
      readonly criticalMultiplier?: number;
      readonly hitMultiplier?: number;
      readonly damageFormula?: string;
      readonly affects?: "hp" | "mp";
    },
  ): { readonly hit: boolean; readonly amount: number; readonly critical: boolean } {
    const magical = usesMagicalDefense(options.project, move.elementId);
    const unmodifiedOffense = magical ? user.mind : user.attackPower;
    const unmodifiedDefense = magical ? target.mind : target.defense;
    const types = gen1TypeModifiersForTypes(
      options.project,
      move.elementId,
      battlerTypes(options.project, user),
      battlerTypes(options.project, target),
    );
    const formula = move.damageFormula ? evaluateDamageFormula(move.damageFormula, formulaBattlerContext(
      { ...user, attackPower: Math.round(user.attackPower * attackMultiplierForStates(options.project, user)), mind: Math.round(user.mind * attackMultiplierForStates(options.project, user)) },
      { ...target, defense: target.defense * defenseMultiplierForStates(options.project, target), mind: target.mind * defenseMultiplierForStates(options.project, target) }, move.power)) : undefined;
    const resolved = resolveGen1DamagingMove({
      level: user.level ?? 1,
      power: move.power,
      damageClass: magical ? "special" : "physical",
      baseSpeed: gen1BaseSpeed(user),
      criticalRate: move.criticalRate ?? "normal",
      criticalChancePercent: move.criticalChancePercent,
      criticalMultiplier: move.criticalMultiplier,
      baseDamageOverride: formula?.ok ? formula.value : undefined,
      offense: {
        unmodified: unmodifiedOffense,
        modified: magical
          ? unmodifiedOffense
          : gen1ModifiedStat(user, "attack", unmodifiedOffense),
      },
      defense: {
        unmodified: unmodifiedDefense,
        modified: magical
          ? unmodifiedDefense
          : gen1ModifiedStat(target, "defense", unmodifiedDefense),
      },
      burned: gen1MajorStatusOf(user)?.kind === "burn",
      stab: types.stab,
      typeFactors: types.typeFactors,
      baseAccuracyByte: accuracyByteFromPercent(move.hitRate ?? 100),
    }, nextGen1Byte);
    if (!resolved.hit) return { hit: false, amount: 0, critical: resolved.critical };
    const resource = move.affects ?? "hp";
    const before = target[resource];
    target[resource] = Math.max(0, before - formationDamage(Math.round(resolved.damage * (move.hitMultiplier ?? 1)), user.row, target.row, magical ? "mind" : "attack", "damage"));
    return { hit: true, amount: before - target[resource], critical: resolved.critical };
  }

  function recordIncapacitated(battler: MutableBattler): void {
    recordTimeline({ kind: "incapacitated", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id });
  }

  /**
   * gauge 모드에서 배틀러의 행동 슬롯 1회 소비를 기록하고, 생존 배틀러 전원이 소비했으면
   * 사이클을 닫아 turn 을 올린다. 반환값은 이 행동이 속한 1-based 사이클 번호 —
   * 트룹 이벤트의 turn 조건(eventTurn)과 strict 의 queue.round 에 대응한다.
   * 사망한 배틀러는 대기 목록에서 빠지므로 쓰러진 적이 사이클 완료를 막지 않는다.
   */
  function markGaugeActionCycle(battler: MutableBattler): number {
    rewardTurn = turn + 1;
    gaugeCycleActed.add(battler.id);
    // 스톱(게이지 정지)은 차례가 오지 않으므로 사이클 대기에서 뺀다 — 안 빼면 turn 이 영원히 멈춘다.
    const pending = [...activeActors(), ...visibleEnemies()].some(
      (candidate) => candidate.hp > 0 && !gaugeCycleActed.has(candidate.id) && !gaugeFrozenByStates(options.project, candidate)
    );
    if (pending) return turn + 1;
    gaugeCycleActed.clear();
    frozenGaugeElapsedMs = 0;
    turn += 1;
    advanceBattleSkillCooldowns([...actors, ...enemies]);
    // 멈춘 배틀러는 자기 차례의 상태 처리를 못 받는다. 사이클이 닫힐 때 한 번 돌려 스톱이 자연 회복할 수 있게 한다.
    if (!gen1) {
      for (const frozen of [...activeActors(), ...visibleEnemies()]) {
        if (frozen.hp > 0 && gaugeFrozenByStates(options.project, frozen)) applyUpkeep(frozen);
      }
    }
    return turn;
  }

  /** Advance finite stops even when nobody can consume a gauge action slot. */
  function advanceFrozenGaugeClock(deltaMs: number): number {
    if (gen1) return deltaMs;
    let remainingMs = Math.max(0, deltaMs);
    const cycleMs = FROZEN_GAUGE_CYCLE_MS / skinHasteMultiplier;
    while (!result && phase === "charging") {
      const living = [...activeActors(), ...visibleEnemies()].filter(battler => battler.hp > 0);
      if (living.length === 0 || living.some(battler => !gaugeFrozenByStates(options.project, battler))) {
        frozenGaugeElapsedMs = 0;
        return remainingMs;
      }
      const untilCycleMs = Math.max(0, cycleMs - frozenGaugeElapsedMs);
      if (remainingMs < untilCycleMs) {
        frozenGaugeElapsedMs += remainingMs;
        return 0;
      }
      remainingMs -= untilCycleMs;
      frozenGaugeElapsedMs = 0;
      gaugeCycleActed.clear();
      rewardTurn = ++turn;
      advanceBattleSkillCooldowns([...actors, ...enemies]);
      for (const battler of living) applyUpkeep(battler);
      resolveOutcome();
      if (result) return 0;
      if (turn >= STRICT_MAX_ROUNDS) {
        recordTimeline({ kind: "stalemate", reason: "strictCap", side: "actor" });
        escaped = true;
        result = "escape";
        phase = "resolved";
        return 0;
      }
      applyTroopEvents(finishGaugeTurnSlot, turn);
      if (remainingMs <= 0) return 0;
    }
    return 0;
  }

  /** 버서크 대상: 살아 있는 상대 중 무작위 하나. */
  function randomOpponent(battler: MutableBattler): MutableBattler | undefined {
    const pool = (battlerSide(battler) === "actor" ? visibleEnemies() : activeActors()).filter((entry) => entry.hp > 0);
    if (pool.length === 0) return undefined;
    return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  }

  function berserkAttackCommand(actor: MutableBattler): ActorCommand | undefined {
    if (gen1 || !forcedActionForStates(options.project, actor)) return undefined;
    const target = randomOpponent(actor);
    return target ? { kind: "attack", targetEnemyId: target.id } : undefined;
  }

  // Active ATB 메뉴가 열려 있는 동안의 시간 진행: 적만 차례를 받고, 다른 아군은 게이지만 찬다.
  function tickDuringMenu(deltaMs: number): void {
    const menuActor = actors.find((entry) => entry.recordId === activeActorId);
    const enemiesInBattle = visibleEnemies();
    const others = activeActors().filter((entry) => entry !== menuActor);
    const rate = (battler: MutableBattler): number => gaugeFrozenByStates(options.project, battler) ? 0 : agilityMultiplierForStates(options.project, battler);
    const ready = nextReadyBattler([], enemiesInBattle, deltaMs, skinHasteMultiplier, rate);
    const elapsed = ready ? ready.timeMs : deltaMs;
    chargeBattlers(others, enemiesInBattle, elapsed, skinHasteMultiplier, rate);
    if (!ready) return;
    ready.battler.gauge = 100;
    const menuPhase = phase;
    const menuTargets = targetSelection;
    performEnemyTurn(ready.battler, () => restoreMenuAfterEnemy(menuActor, menuPhase, menuTargets));
  }

  /** 메뉴 도중 행동한 적의 뒤처리. 메뉴 주인이 쓰러졌거나 멈췄으면 명령을 거둔다. */
  function restoreMenuAfterEnemy(
    menuActor: MutableBattler | undefined,
    menuPhase: BattlePhase,
    menuTargets: BattleTargetSelectionSnapshot | undefined,
  ): void {
    resolveOutcome();
    if (result) { phase = "resolved"; return; }
    if (beginForcedSwitchIfNeeded()) return;
    if (!menuActor || menuActor.hp <= 0 || !canBattlerAct(options.project, menuActor)) {
      if (menuActor) menuActor.gauge = 0;
      activeActorId = undefined;
      targetSelection = undefined;
      phase = "charging";
      return;
    }
    // 메뉴가 열린 사이 적이 버서크를 걸었다: 메뉴를 거두고 곧바로 무작위 통상 공격(게이지 경로와 같은 처리).
    const forced = berserkAttackCommand(menuActor);
    if (forced) {
      targetSelection = undefined;
      phase = "charging";
      activeActorId = menuActor.recordId;
      applyActorCommandEffect(menuActor, forced);
      applyTroopEvents(() => finishGaugeActorCommand(menuActor), markGaugeActionCycle(menuActor));
      return;
    }
    activeActorId = menuActor.recordId;
    if (menuPhase === "targetSelect" && menuTargets) {
      const alive = new Set([...activeActors(), ...visibleEnemies(), ...actors].filter((entry) => entry.hp > 0 || menuTargets.side === "actor").map(targetIdFor));
      const targetIds = menuTargets.targetIds.filter((id) => alive.has(id));
      if (targetIds.length > 0) {
        const selectedTargetId = targetIds.includes(menuTargets.selectedTargetId ?? "") ? menuTargets.selectedTargetId : targetIds[0];
        targetSelection = {
          ...menuTargets,
          targetIds,
          selectedTargetId,
          targetEnemyIds: menuTargets.side === "enemy" ? targetIds : [],
          selectedEnemyId: menuTargets.side === "enemy" ? selectedTargetId : undefined,
        };
        phase = "targetSelect";
        return;
      }
    }
    targetSelection = undefined;
    phase = "actorCommand";
  }

  function tick(deltaMs: number): void {
    if (battleFlow === "strict") return;
    if (result) return;
    const menuOpen = activeAtb && (phase === "actorCommand" || phase === "targetSelect") && Boolean(activeActorId) && !forcedSwitchActor();
    if (menuOpen) {
      tickDuringMenu(deltaMs);
      return;
    }
    if (phase !== "charging") return;
    if (turn >= STRICT_MAX_ROUNDS) {
      recordTimeline({ kind: "stalemate", reason: "strictCap", side: "actor" });
      escaped = true;
      result = "escape";
      phase = "resolved";
      return;
    }
    if (beginForcedSwitchIfNeeded()) return;
    deltaMs = advanceFrozenGaugeClock(deltaMs);
    if (result || phase !== "charging") return;
    const enemiesInBattle = visibleEnemies();
    const battlerAgilityMultiplier = (battler: MutableBattler): number =>
      gaugeFrozenByStates(options.project, battler) ? 0 : agilityMultiplierForStates(options.project, battler);
    const ready = nextReadyBattler(activeActors(), enemiesInBattle, deltaMs, skinHasteMultiplier, battlerAgilityMultiplier);
    if (!ready) {
      chargeBattlers(activeActors(), enemiesInBattle, deltaMs, skinHasteMultiplier, battlerAgilityMultiplier);
      return;
    }
    chargeBattlers(activeActors(), enemiesInBattle, ready.timeMs, skinHasteMultiplier, battlerAgilityMultiplier);
    ready.battler.gauge = 100;
    if (ready.kind === "actor") {
      // 턴 시작 상태 처리(지속 피해/자연 회복). 행동 불가(수면 등)면 명령 없이 턴을 넘긴다.
      if (!gen1) {
        rewardTurn = turn + 1;
        applyUpkeep(ready.battler);
        resolveOutcome();
        if (result) return;
        // 선고로 방금 쓰러졌으면 차례만 소비한다.
        if (ready.battler.hp <= 0) {
          ready.battler.gauge = 0;
          applyTroopEvents(finishGaugeTurnSlot, markGaugeActionCycle(ready.battler));
          return;
        }
        if (!canBattlerAct(options.project, ready.battler)) {
          recordIncapacitated(ready.battler);
          ready.battler.gauge = 0;
          // 행동 불가 스킵도 행동 슬롯을 소비한다 — 적 스킵(performEnemyTurn)과 같은
          // 사이클 계수·트룹 이벤트 발화를 적용한다.
          applyTroopEvents(finishGaugeTurnSlot, markGaugeActionCycle(ready.battler));
          return;
        }
        // 힘 모으기 중이면 메뉴 없이 모은 기술을 이어 간다(예고 → 발동).
        const charging = pendingCharges.get(ready.battler.id)?.command;
        if (charging) {
          activeActorId = ready.battler.recordId;
          applyActorCommandEffect(ready.battler, charging);
          applyTroopEvents(() => finishGaugeActorCommand(ready.battler), markGaugeActionCycle(ready.battler));
          return;
        }
        // 버서크: 명령 메뉴 없이 무작위 적을 통상 공격한다.
        const forced = berserkAttackCommand(ready.battler);
        if (forced) {
          activeActorId = ready.battler.recordId;
          applyActorCommandEffect(ready.battler, forced);
          applyTroopEvents(() => finishGaugeActorCommand(ready.battler), markGaugeActionCycle(ready.battler));
          return;
        }
        // 자동 전투 배우(ActorOptions.autoBattle · 작전): 명령 메뉴 없이 작전대로 고른 명령을 그대로 실행한다.
        const auto = autoActorCommand(ready.battler);
        if (auto) {
          phase = "actorCommand";
          activeActorId = ready.battler.recordId;
          performActorCommand(auto);
          return;
        }
      }
      phase = "actorCommand";
      activeActorId = ready.battler.recordId;
      // Clear prior resolve pose so command select shows idle/defend only.
      lastActionResult = undefined;
      lastAnimation = undefined;
      return;
    }
    performEnemyTurn(ready.battler);
  }

  function performActorCommand(command: ActorCommand): void {
    if (cancelled || eventChoice || eventPause || result) return;
    const forcedActor = forcedSwitchActor();
    if (forcedActor) {
      if (command.kind !== "switch") return;
      if (!switchActiveActor(forcedActor.recordId, command.targetActorId)) {
        if (switchCandidateActors().length === 0) {
          activeActorId = undefined;
          phase = battleFlow === "strict" ? "roundResolve" : "charging";
        }
        return;
      }
      activeActorId = undefined;
      currentActorCommandKind = undefined;
      if (battleFlow === "strict") {
        // A forced replacement continues the round whose upkeep caused it.
        // Starting a new round here would reset strictRoundTimelineStart and
        // orphan the upkeep/switch facts from roundLogs[].timeline.
        if (!beginForcedSwitchIfNeeded()) prepareStrictActorCommands();
      } else {
        phase = "charging";
      }
      return;
    }
    if (phase !== "actorCommand" || !activeActorId || result) return;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor || !isValidActorCommand(actor, command)) return;
    if (battleFlow === "strict") {
      collectStrictActorCommand(command);
      return;
    }

    applyActorCommandEffect(actor, command);
    if (escaped) {
      actor.gauge = 0;
      activeActorId = undefined;
      currentActorCommandKind = undefined;
      result = "escape";
      phase = "resolved";
      return;
    }
    // 연계기는 동료의 행동 슬롯도 소비한다 — 게이지를 비우고 이번 사이클에 행동한 것으로 센다.
    for (const partner of comboPartners(actor, command)) {
      partner.gauge = 0;
      gaugeCycleActed.add(partner.id);
    }
    // 사이클 계수는 효과 적용 뒤에 — 이번 행동으로 쓰러진 배틀러는 대기 목록에서 빠진다.
    applyTroopEvents(() => finishGaugeActorCommand(actor), markGaugeActionCycle(actor));
  }

  function finishGaugeActorCommand(actor: MutableBattler): void {
    resolveOutcome();
    if (result) {
      actor.gauge = 0;
      activeActorId = undefined;
      currentActorCommandKind = undefined;
      phase = "resolved";
      return;
    }
    if (beginForcedSwitchIfNeeded()) {
      actor.gauge = 0;
      currentActorCommandKind = undefined;
      return;
    }
    if (battleEvents.consumeExtraActorAction(actor.recordId) || weakness.consume(actor.recordId)) {
      actor.gauge = 100;
      activeActorId = actor.recordId;
      currentActorCommandKind = undefined;
      phase = "actorCommand";
      return;
    }
    actor.gauge = 0;
    activeActorId = undefined;
    currentActorCommandKind = undefined;
    phase = "charging";
  }

  function commandScope(user: MutableBattler, command: TargetedActorCommand): BattleTargetScope {
    if (command.kind === "attack" && user.equipmentEffects?.attackAll) return "allEnemies";
    return targetScopeForCommand(options.project, command);
  }

  function commandRevives(command: TargetedActorCommand): boolean {
    if (command.kind === "item") return options.project.database.items.find(item => item.id === command.itemId)?.onlyEffectiveOnDeadActors === true;
    if (command.kind !== "skill") return false;
    const skill = lookupSkill(command.skillId);
    return skill?.effect.kind === "healing" && (skill.stateEffects ?? []).some(effect => effect.operation === "remove" && effect.stateId === "state_death");
  }

  function resolvedCommandTargets(user: MutableBattler, command: TargetedActorCommand & { readonly targetEnemyId?: string; readonly targetActorId?: string }) {
    const resolution = resolveBattleTargets({
      scope: commandScope(user, command),
      includeDefeatedAllies: commandRevives(command),
      user,
      actors: activeActors(),
      enemies: visibleEnemies(),
      requestedTargetId: requestedTargetId(command),
      area: command.kind === "skill" ? lookupSkill(command.skillId)?.area : undefined,
    });
    // 직접 실행 경로(테스트/헤드리스)에서 ally 계열 대상이 명시되지 않으면
    // 가장 아픈 생존 동료를 자동 선택한다(전투 UI 의 beginTargetSelection 은 그대로).
    if (resolution.targets.length === 0 && (resolution.scope === "ally" || resolution.scope === "allAllies" || resolution.scope === "self")) {
      const ally = resolution.candidates
        .filter((entry) => entry.hp > 0)
        .sort((a, b) => (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)))[0];
      if (ally) return { ...resolution, targets: [ally] };
    }
    return resolution;
  }

  // 커맨드 자체의 적법성(대상 해결 전). isValidActorCommand 와 beginActorCommand 가
  // 공유한다 — 예전에는 beginActorCommand 가 attack/capture 를 검사 없이 대상 선택으로
  // 보내, gen1 에서 스킬이 남은 액터의 공격이 대상 확정 후 조용히 무시됐다.
  function actorCommandLegality(actor: MutableBattler, command: ActorCommandDraft): boolean {
    switch (command.kind) {
      case "attack":
        return !(gen1 && actor.skillIds.some((skillId) => battleSkillUseFailure(options.project, actor, skillId) === undefined));
      case "defend":
        return true;
      case "escape":
        return options.canEscape;
      case "switch":
        return canSwitchActor(actor.recordId, command.targetActorId);
      case "skill":
        return battleActorSkillFailure(options.project, actor, command.skillId, comboParticipants(), partyGauge) === undefined;
      case "item": {
        const item = options.project.database.items.find((record) => record.id === command.itemId);
        // actor/class 제한 체크 — 불일치 시 커맨드 자체를 거부한다 (무효 턴으로 소모 안 함)
        return Boolean(item && (battleEventState.inventory[command.itemId] ?? 0) > 0 && itemIsBattleUsable(item)
          && isBattleItemUserEligible(options.project, item, actor));
      }
      case "capture": {
        const item = options.project.database.items.find((record) => record.id === command.captureItemId);
        // 포획 여부는 captureProfile 이 정한다. 종류(type)까지 special 로 묶으면 조수가 몬스터볼을
        // normalGoods 로 저장한 게임에서 전투 메뉴엔 공이 뜨는데 던지면 missingItem 으로 실패했다(2026-09-24).
        return Boolean(item && isCaptureTool(item) && itemAllowsBattle(item)
          && (battleEventState.inventory[command.captureItemId] ?? 0) > 0);
      }
    }
  }

  function isValidActorCommand(actor: MutableBattler, command: ActorCommand): boolean {
    if (!actorCommandLegality(actor, command)) return false;
    // 대상 해결 검사는 대상을 쓰는 명령에만 — defend/escape/switch 는 적법성만으로 결정된다.
    switch (command.kind) {
      case "defend":
      case "escape":
      case "switch":
        return true;
      default: {
        const resolution = resolvedCommandTargets(actor, command);
        return resolution.targets.length > 0;
      }
    }
  }

  function applyActorCommandEffect(actor: MutableBattler, command: ActorCommand): void {
    const charged = actorChargeStep(actor, command);
    if (!charged) return;
    applyActorCommandEffectCore(actor, charged);
    // 반격은 행동의 모든 타격이 끝난 뒤에 온다(다단히트 사이에 끼어들지 않는다).
    drainCounters();
  }

  function applyActorCommandEffectCore(actor: MutableBattler, command: ActorCommand): void {
    currentActorCommandKind = command.kind;
    lastCaptureResult = undefined;
    // 방어 자세는 "다음 행동까지"다 — 액터가 새 명령을 실행하면 해제된다.
    // (defend 명령이면 아래 switch 에서 곧바로 다시 true 가 된다.)
    actor.defending = false;
    weakness.beginAction(actor.recordId);
    beginTimelineAction();
    switch (command.kind) {
      case "attack":
        if (!prepareGen1CombatAction(actor)) break;
        applyActorAttack(actor, command);
        applyGen1Residual(actor);
        break;
      case "skill": {
        if (!prepareGen1CombatAction(actor)) break;
        const targets = resolvedCommandTargets(actor, command).targets;
        consumeBattleSkillResource(options.project, actor, command.skillId);
        spendPartyGauge(command.skillId);
        // 연계기: 참가 배우 각자의 MP 를 똑같이 소비한다(위력은 시전자 능력치).
        for (const partner of comboPartners(actor, command)) consumeSkillMp(partner, command.skillId);
        // 입력 커맨드: 성공은 보너스, 실패는 약화. 판정이 없으면(자동전투 등) 1배.
        const inputMultiplier = inputSequencePowerMultiplier(lookupSkill(command.skillId)?.inputSequence, command.inputResult);
        paySkillHpCost(actor, command.skillId, "skill");
        applySkillCast(actor, targets, command.skillId, "skill", inputMultiplier);
        applyGen1Residual(actor);
        break;
      }
      case "item": {
        const item = options.project.database.items.find((record) => record.id === command.itemId);
        if (!item) return;
        const targets = resolvedCommandTargets(actor, command).targets;
        applyItemCast(command.itemId, targets, actor);
        // 소모는 커맨드당 정확히 1회 — 전체 아군(allAllies) 아이템이 대상 수만큼
        // 소모되던 결함(계약: "consume one inventory unit per command"). applyItem 은
        // 효과 적용만 담당하고, finite-use 전환(transitionItemState)은 여기서 1회 돈다.
        if (targets.length > 0) consumeItemUse(command.itemId);
        break;
      }
      case "capture":
        applyCapture(actor, command.captureItemId, command.targetEnemyId);
        break;
      case "defend":
        actor.defending = true;
        recordTimeline({ kind: "action", side: "actor", userRecordId: actor.recordId, targetId: actor.id, commandKind: "defend" });
        break;
      case "escape":
        attemptEscape();
        recordTimeline({ kind: "action", side: "actor", userRecordId: actor.recordId, targetId: actor.id, commandKind: "escape", success: escaped });
        break;
      case "switch":
        switchActiveActor(actor.recordId, command.targetActorId);
        break;
    }
  }

  function applyActorAttack(actor: MutableBattler, command: Extract<ActorCommand, { kind: "attack" }>): void {
    const targets = resolvedCommandTargets(actor, command).targets;
    const attackCount = actor.equipmentEffects?.doubleAttack ? 2 : 1;
    for (let index = 0; index < attackCount; index += 1) {
      for (const target of targets) {
        if (target.hp > 0) applySingleActorAttack(actor, target);
      }
    }
  }

  function applySingleActorAttack(actor: MutableBattler, aimed: MutableBattler): void {
    if (gen1) {
      applyGen1Struggle(actor, aimed, "attack");
      return;
    }
    const target = coverTarget(actor, aimed);
    const hpBefore = target.hp;
    const targetMaxHpBefore = target.maxHp;
    const result = redirectDamageToMp(target, hpBefore, applySkillLike(actor, target, {
      power: actor.attackPower,
      hitMultiplier:gimmickDamageMultiplier(actor,target),
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(actor),
      hitRate: withEvasion(normalAttackHitRate(actor, target), actor, target),
      // RM2K3 통상공격 분산(±20%) — 없으면 매 타격이 완전히 같은 숫자라 도박성이 0이다.
      variance: 20,
      elementMultiplier: normalAttackElementMultiplier(actor, target) * emotionDamageMultiplier(options.project, actor, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, actor),
      targetDefenseMultiplier: defenseMultiplierForStatesByKind(options.project, target, "attack"),
      gen1AttackerLevel: gen1AttackerLevel(actor),
      rng,
    }));
    noteDamageHit(actor, target, result, targetMaxHpBefore, normalAttackElementMultiplier(actor, target));
    if (result.hit && result.amount > 0) recoverHitStates(target);
    if (result.hit) applyNormalAttackEquipmentStates(actor, target);
    recordAction(
      { userRecordId: actor.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical },
      result.hit ? "damage" : "miss",
      "attack",
    );
    const animationId = normalAttackAnimationId(actor);
    if (animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    }
    if (result.hit) queueCounter(actor, target, "attack", actor.equipmentEffects?.attackElementIds?.[0]);
    if (result.hit) queueStateCounter(actor, target);
  }

  function normalAttackAnimationId(actor: MutableBattler): string | undefined {
    const actorRecord = options.project.database.actors.find((record) => record.id === actor.recordId);
    const equipment = actorEquipment.get(actor.recordId as ActorId);
    if (!equipment?.weapon && actorRecord?.unarmedAnimationId) return actorRecord.unarmedAnimationId;
    const classAnimationId = options.project.database.classes.find((record) => record.id === actor.classId)?.animationId;
    return classAnimationId
      ?? actorRecord?.unarmedAnimationId
      ?? lookupSkill(DEFAULT_SKILL_ID)?.animationId
      ?? fallbackHitAnimationId();
  }

  /**
   * 통상공격 애니메이션의 **최후 폴백**.
   *
   * 액터에 unarmedAnimationId 도, 클래스 animationId 도 없고 기본 스킬 레코드까지
   * 없는 프로젝트에서는 통상공격이 아무 그림도 없이 지나갔다(실측: 필름스트립 전
   * 구간 animation=null). 가장 많이 쓰는 행동에 시각 피드백이 숫자와 밀림뿐이었다.
   * 표준 타격 애니메이션이 있으면 그것, 없으면 DB 의 첫 애니메이션을 쓴다.
   */
  function fallbackHitAnimationId(): string | undefined {
    const records = options.project.database.battleAnimations;
    if (records.length === 0) return undefined;
    return records.find((record) => record.id === DEFAULT_ANIMATION_ID)?.id ?? records[0].id;
  }

  function applyGen1Struggle(
    user: MutableBattler,
    target: MutableBattler,
    commandKind: "attack" | "enemyAttack",
  ): void {
    const result = applyExactGen1Damage(user, target, {
      power: 50,
      elementId: gen1ElementIdForCanonical(options.project, "normal"),
      hitRate: 100,
      criticalRate: "normal",
    });
    recordAction(
      {
        userRecordId: user.recordId,
        targetId: target.id,
        hit: result.hit,
        amount: result.amount,
        critical: result.critical,
        skillName: "Struggle",
      },
      result.hit ? "damage" : "miss",
      commandKind,
    );
    if (!result.hit || result.amount <= 0 || user.hp <= 0) return;
    const recoil = Math.max(1, Math.floor(result.amount / 2));
    const beforeHp = user.hp;
    user.hp = Math.max(0, user.hp - recoil);
    recordTimeline({
      kind: "damage",
      side: battlerSide(user),
      userRecordId: user.recordId,
      targetId: user.id,
      commandKind,
      hit: true,
      amount: beforeHp - user.hp,
      critical: false,
      skillName: "Struggle recoil",
    });
  }

  function applyNormalAttackEquipmentStates(actor: MutableBattler, target: MutableBattler): void {
    const equipment = actorEquipment.get(actor.recordId as ActorId);
    if (!equipment) return;
    const chances = new Map<string, number>();
    for (const equipmentId of new Set(Object.values(equipment).filter((id): id is string => Boolean(id)))) {
      const record = options.project.database.equipment.find((entry) => entry.id === equipmentId);
      if (!record) continue;
      const chance = Math.max(0, Math.min(100, record.stateInflictionChance));
      for (const stateId of new Set(record.stateInflictIds)) {
        chances.set(stateId, Math.max(chances.get(stateId) ?? 0, chance));
      }
    }
    for (const [stateId, chance] of chances) {
      applyStateEffectsWithEmotion(options.project, target, [{ stateId, chance, operation: "add" }], rng);
    }
  }

  function executeEquipmentUse(actorId: ActorId, equipmentId: string, target: EquipmentUseTarget): EquipmentUseResult {
    if (phase !== "actorCommand" || activeActorId !== actorId || result) return { kind: "rejected", reason: "notActorTurn" };
    const actor = actors.find((entry) => entry.recordId === actorId);
    if (!actor) return { kind: "rejected", reason: "missingActor" };
    const equipped = actorEquipment.get(actorId);
    if (!equipped || !Object.values(equipped).includes(equipmentId)) return { kind: "rejected", reason: "sourceNotEquipped" };
    const source = options.project.database.equipment.find((record) => record.id === equipmentId);
    if (!source?.usableAsItemSkillId) return { kind: "rejected", reason: "sourceHasNoSkill" };
    const skill = lookupSkill(source.usableAsItemSkillId);
    if (!skill) return { kind: "rejected", reason: "missingSkill" };
    if (actor.mp < battleSkillMpCostFor(skill, actor)) return { kind: "rejected", reason: "insufficientMp" };

    let targets: readonly MutableBattler[];
    switch (skill.scope) {
      case "self":
        if (target.kind !== "none" && (target.kind !== "actor" || target.actorId !== actorId)) return { kind: "rejected", reason: "invalidTarget" };
        targets = [actor];
        break;
      case "ally": {
        if (target.kind !== "actor") return { kind: "rejected", reason: "invalidTarget" };
        const ally = activeActors().find((entry) => entry.recordId === target.actorId && entry.hp > 0);
        if (!ally) return { kind: "rejected", reason: "invalidTarget" };
        targets = [ally];
        break;
      }
      case "enemy": {
        if (target.kind !== "enemy") return { kind: "rejected", reason: "invalidTarget" };
        const enemy = visibleEnemies().find((entry) => entry.id === target.enemyId && entry.hp > 0);
        if (!enemy) return { kind: "rejected", reason: "invalidTarget" };
        targets = [enemy];
        break;
      }
      case "allEnemies":
        if (target.kind !== "none") return { kind: "rejected", reason: "invalidTarget" };
        targets = visibleEnemies().filter((entry) => entry.hp > 0);
        if (targets.length === 0) return { kind: "rejected", reason: "invalidTarget" };
        break;
      case "allAllies":
        if (target.kind !== "none" && (target.kind !== "actor" || target.actorId !== actorId)) return { kind: "rejected", reason: "invalidTarget" };
        targets = activeActors().filter((entry) => entry.hp > 0);
        if (targets.length === 0) return { kind: "rejected", reason: "invalidTarget" };
        break;
      default:
        return { kind: "rejected", reason: "invalidTarget" };
    }

    consumeSkillMp(actor, skill.id);
    currentActorCommandKind = "skill";
    // 장비 사용도 액터의 행동 슬롯을 소비한다 — 방어 해제·사이클 계수를 명령 경로와 맞춘다.
    // 사이클 계수는 gauge 전용 — strict 는 라운드 완료 시점의 turn=round 가 정본이다.
    actor.defending = false;
    const actionCycle = battleFlow === "strict" ? undefined : markGaugeActionCycle(actor);
    applySkillCast(actor, targets, skill.id);
    drainCounters();
    applyTroopEvents(() => {
      resolveOutcome();
      actor.gauge = 0;
      activeActorId = undefined;
      currentActorCommandKind = undefined;
      phase = result ? "resolved" : "charging";
    }, actionCycle ?? turn);
    return { kind: "used", skillId: skill.id };
  }
  function attemptEscape(): void {
    if (!options.canEscape) return;
    // RM2K3 도주: 민첩성 기반 확률(파티 평균 vs 적 평균). 단순화해 절반 확률 + 우위 보정.
    // 실패할 때마다 system.escapeBonusPercent(생략 = 0, 가산 없음)%p 씩 쉬워진다.
    const actorAgi = average(activeActors().filter((a) => a.hp > 0).map((a) => a.agility));
    const enemyAgi = average(visibleEnemies().filter((e) => e.hp > 0).map((e) => e.agility));
    const chance = escapeChance(actorAgi, enemyAgi, failedEscapeAttempts, options.project.system.escapeBonusPercent);
    if (rng() < chance) {
      escaped = true;
    } else {
      failedEscapeAttempts += 1;
    }
  }

  function beginActorCommand(command: ActorCommandDraft): void {
    if (phase !== "actorCommand" || !activeActorId || result) return;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor) return;
    // 대상 선택을 열기 전에 performActorCommand 와 같은 적법성 검사를 먼저 돌린다.
    // 없으면 gen1 의 죽은 공격처럼 대상까지 고른 뒤 아무 일 없이 턴이 증발한다.
    if (!actorCommandLegality(actor, command)) return;
    switch (command.kind) {
      case "defend":
      case "escape":
      case "switch":
        performActorCommand(command);
        return;
      case "attack":
      case "capture":
      case "skill":
      case "item":
        beginTargetSelection(command);
        return;
    }
  }

  function selectTarget(targetId: string): void {
    if (phase !== "targetSelect" || !targetSelection || result) return;
    if (!targetSelection.targetIds.includes(targetId)) return;
    const command = concreteTargetCommand(targetSelection.command, targetId, targetSelection.side);
    targetSelection = undefined;
    phase = "actorCommand";
    performActorCommand(command);
  }

  function selectTargetEnemy(enemyId: string): void {
    selectTarget(enemyId);
  }

  function setSelectedTarget(targetId: string): void {
    if (phase !== "targetSelect" || !targetSelection || result) return;
    if (!targetSelection.targetIds.includes(targetId)) return;
    targetSelection = {
      ...targetSelection,
      selectedTargetId: targetId,
      selectedEnemyId: targetSelection.side === "enemy" ? targetId : undefined,
      selectedActorId: targetSelection.side === "actor" ? targetId : undefined,
    };
  }

  function setSelectedTargetEnemy(enemyId: string): void {
    setSelectedTarget(enemyId);
  }

  function cancelTargetSelection(): void {
    if (phase !== "targetSelect") return;
    targetSelection = undefined;
    phase = "actorCommand";
  }

  function startStrictRound(): void {
    rewardTurn = turn + 1;
    if (result) return;
    if (strictRoundCount >= STRICT_MAX_ROUNDS) {
      recordTimeline({ kind: "stalemate", reason: "strictCap", side: "actor" });
      escaped = true;
      result = "escape";
      phase = "resolved";
      return;
    }
    strictRoundCount += 1;
    phase = "roundResolve";
    activeActorId = undefined;
    targetSelection = undefined;
    currentActorCommandKind = undefined;
    strictActorCommands = [];
    strictPendingActorIds = [];
    strictCurrentRoundActions = [];
    strictCurrentRoundParticipantIds = new Set<ActorId>();
    strictRoundTimelineStart = timeline.length;
    markActiveParticipants();
    if (formationRoundPending) {
      strictFormationSkipSide = formation === "preemptive" ? "enemy" : "actor";
      formationRoundPending = false;
    }

    if (!gen1) {
      for (const battler of [...activeActors(), ...visibleEnemies()]) {
        if (battler.hp > 0) applyUpkeep(battler);
      }
    }
    resolveOutcome();
    if (result) {
      // Round setup can detect a terminal state before commands are collected.
      // It is still a completed strict round and must retain its timeline slice.
      completeStrictRound(turn + 1);
      return;
    }
    if (beginForcedSwitchIfNeeded()) return;

    if (!gen1) {
      for (const actor of activeActors()) {
        if (actor.hp > 0 && !canBattlerAct(options.project, actor)) recordIncapacitated(actor);
      }
    }
    strictPendingActorIds = strictFormationSkipSide === "actor" ? [] : activeActors()
      .filter((actor) => actor.hp > 0 && (gen1 || canBattlerAct(options.project, actor)))
      .map((actor) => actor.recordId);
    for (const actor of actors) actor.gauge = strictPendingActorIds.includes(actor.recordId) ? 100 : 0;
    queueBerserkStrictCommands();
    if (strictPendingActorIds.length > 0) {
      activeActorId = strictPendingActorIds[0];
      phase = "actorCommand";
      return;
    }
    // No actor can act this round. Resolve enemy-only actions then loop to the
    // next round instead of recursing (the old resolveStrictRound→startStrictRound
    // mutual recursion had no base case and could stack-overflow).
    resolveStrictRound();
  }

  function prepareStrictActorCommands(): void {
    if (!gen1) {
      for (const actor of activeActors()) {
        if (actor.hp > 0 && !canBattlerAct(options.project, actor)) recordIncapacitated(actor);
      }
    }
    strictPendingActorIds = strictFormationSkipSide === "actor" ? [] : activeActors()
      .filter((actor) => actor.hp > 0 && (gen1 || canBattlerAct(options.project, actor)))
      .map((actor) => actor.recordId);
    for (const actor of actors) actor.gauge = strictPendingActorIds.includes(actor.recordId) ? 100 : 0;
    queueBerserkStrictCommands();
    if (strictPendingActorIds.length > 0) {
      activeActorId = strictPendingActorIds[0];
      phase = "actorCommand";
      return;
    }
    resolveStrictRound();
  }

  // 버서크(strict): 명령을 받지 않고 무작위 적 통상 공격을 이번 라운드 명령으로 넣는다.
  // 자동 전투 배우도 여기서 작전대로 고른 명령을 미리 넣는다(명령 메뉴가 열리지 않는다).
  function queueBerserkStrictCommands(): void {
    for (const actorId of [...strictPendingActorIds]) {
      if (!strictPendingActorIds.includes(actorId)) continue;
      const actor = actors.find((entry) => entry.recordId === actorId);
      const forced = actor ? pendingCharges.get(actor.id)?.command ?? berserkAttackCommand(actor) ?? autoActorCommand(actor) : undefined;
      if (!actor || !forced) continue;
      strictActorCommands = [...strictActorCommands, { actorId: actor.recordId, command: forced }];
      const partnerIds = comboPartners(actor, forced).map((partner) => partner.recordId);
      for (const partner of comboPartners(actor, forced)) partner.gauge = 0;
      strictPendingActorIds = strictPendingActorIds.filter((id) => id !== actorId && !partnerIds.includes(id));
      actor.gauge = 0;
    }
  }

  /** 자동 전투 배우의 이번 차례 명령. 수동 배우·gen1·고를 명령이 없으면 undefined(메뉴를 연다). */
  function autoActorCommand(actor: MutableBattler): ActorCommand | undefined {
    if (gen1 || usePartyMonsters || !actorFightsAutomatically(options.project, actor.recordId, actor.classId)) return undefined;
    const savedPhase = phase;
    const savedActorId = activeActorId;
    phase = "actorCommand";
    activeActorId = actor.recordId;
    try {
      const command = chooseAutoBattleCommand(options.project, snapshot(), rng, actorAutoTactic(options.project, actor.recordId));
      return command && isValidActorCommand(actor, command) ? command : undefined;
    } finally {
      phase = savedPhase;
      activeActorId = savedActorId;
    }
  }

  function collectStrictActorCommand(command: ActorCommand): void {
    if (phase !== "actorCommand" || !activeActorId || result) return;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor || actor.hp <= 0) return;
    if (command.kind === "switch" && !canSwitchActor(actor.recordId, command.targetActorId)) return;
    strictActorCommands = [...strictActorCommands, { actorId: actor.recordId, command }];
    // 연계기는 동료의 이번 라운드 명령을 대신한다 — 동료는 따로 명령하지 않는다.
    const partnerIds = comboPartners(actor, command).map((partner) => partner.recordId);
    for (const partner of comboPartners(actor, command)) partner.gauge = 0;
    strictPendingActorIds = strictPendingActorIds.filter((actorId) => actorId !== actor.recordId && !partnerIds.includes(actorId));
    actor.gauge = 0;
    activeActorId = strictPendingActorIds[0];
    if (activeActorId) return;
    resolveStrictRound();
  }

  function resolveStrictRound(): void {
    if (result || cancelled) return;
    phase = "roundResolve";
    targetSelection = undefined;
    activeActorId = undefined;
    currentActorCommandKind = undefined;
    strictResolution = { round: turn + 1, actions: strictRoundActions(), index: 0, grantedExtraActions: 0 };
    drainStrictActions();
  }

  function drainStrictActions(): void {
    if (drainingStrictActions) return;
    drainingStrictActions = true;
    try {
      while (strictResolution && !eventChoice && !eventPause && !cancelled) {
        const queue = strictResolution;
        if (result || queue.index >= queue.actions.length) {
          strictResolution = undefined;
          completeStrictRound(queue.round);
          if (result) { phase = "resolved"; return; }
          // Enemy-only rounds can create the next queue synchronously. The
          // draining guard keeps that path iterative rather than recursive.
          startStrictRound();
          continue;
        }
        phase = "roundResolve";
        rewardTurn = queue.round;
        const action = queue.actions[queue.index++];
        const beforeResult = lastActionResult;
        if (action.side === "actor") {
          if (action.actor.hp <= 0) continue;
          if (!gen1 && !canBattlerAct(options.project, action.actor)) {
            recordIncapacitated(action.actor);
            continue;
          }
          if (action.command.kind === "skill" && battleActorSkillFailure(options.project, action.actor, action.command.skillId, comboParticipants(true), partyGauge)) continue;
          activeActorId = action.actor.recordId;
          applyActorCommandEffect(action.actor, action.command);
        } else {
          if (action.enemy.hp <= 0 || !visibleEnemies().some(enemy => enemy.id === action.enemy.id)) continue;
          if (!gen1 && !canBattlerAct(options.project, action.enemy)) {
            recordIncapacitated(action.enemy);
            continue;
          }
          activeActorId = undefined;
          currentActorCommandKind = undefined;
          // strict 는 라운드 시작에 행동을 고른다. 그 사이 필요 부위가 파괴됐으면 다시 고른다.
          const planned = action.action?.requiresPart && brokenPartTags(action.enemy).has(action.action.requiresPart)
            ? chooseEnemyAction(action.enemy)
            : action.action;
          executeEnemyTurnAction(action.enemy, planned);
          drainCounters();
        }
        logStrictAction(queue.round, queue.index, action, beforeResult);
        if (escaped) { result = "escape"; continue; }
        applyTroopEvents(() => {
          resolveOutcome();
          if (!result && action.side === "actor" && action.command.kind !== "switch"
            && action.actor.hp > 0 && queue.grantedExtraActions < STRICT_MAX_EXTRA_ACTIONS_PER_ROUND
            && (battleEvents.consumeExtraActorAction(action.actor.recordId) || weakness.consume(action.actor.recordId))) {
            queue.grantedExtraActions += 1;
            insertStrictExtraAction(queue.actions, queue.index, action);
          }
          drainStrictActions();
        }, queue.round);
      }
    } finally {
      drainingStrictActions = false;
    }
  }

  function insertStrictExtraAction(actions: StrictQueuedAction[], from: number, action: StrictQueuedAction): void {
    // 추가 행동은 라운드와 동일한 정렬 기준(compareStrictActions)으로 남은 큐에 삽입한다.
    // 이미 해결된 행동은 건드리지 않고(from 이후만 본다), 더 늦은 행동을 추월하지도 않는다.
    let at = from;
    while (at < actions.length && compareStrictActions(action, actions[at]) > 0) at += 1;
    actions.splice(at, 0, action);
  }

  function completeStrictRound(round: number): void {
    advanceBattleSkillCooldowns([...actors, ...enemies]);
    for (const actor of actors) actor.defending = false;
    for (const battler of [...actors, ...enemies]) battler.gauge = 0;
    activeActorId = undefined;
    currentActorCommandKind = undefined;
    turn = round;
    strictFormationSkipSide = undefined;
    finishStrictRoundLog(round);
  }

  // gen1 에서만 동속을 랜덤으로 가른다. rm2k3 기본값(0)은 rng 를 아예 소비하지 않아
  // 시드 고정 밸런스 테스트(pkmnBalanceB6 등, blank 프로젝트)의 rng 스트림이 안 바뀐다.
  // 기술 우선도 조회. 통상공격/아이템/방어/도주는 0(교체는 정렬 1차 규칙이 이미 최우선).
  // 적의 기본공격 폴백은 skillId="" 라 find 가 undefined → 0 으로 떨어진다.
  function strictActionPriority(skillId: SkillId | undefined): number {
    if (!skillId) return 0;
    return options.project.database.skills.find((record) => record.id === skillId)?.movePriority ?? 0;
  }

  function strictRoundActions(): StrictQueuedAction[] {
    const actorActions: StrictQueuedAction[] = strictActorCommands.flatMap((entry) => {
      const actor = actors.find((candidate) => candidate.recordId === entry.actorId);
      if (!actor) return [];
      const priority = strictActionPriority(entry.command.kind === "skill" ? entry.command.skillId : undefined);
      return [{
        side: "actor",
        index: actors.indexOf(actor),
        speed: gen1
          ? gen1ParalyzedSpeed(actor.agility, gen1MajorStatusOf(actor)?.kind === "paralysis")
          : actor.agility * agilityMultiplierForStates(options.project, actor),
        priority,
        commandClass: strictCommandClass(entry.command),
        actor,
        command: entry.command,
      }];
    });
    const enemyActions: StrictQueuedAction[] = visibleEnemies()
      .flatMap((enemy, index) => {
        if (enemy.hp <= 0 || strictFormationSkipSide === "enemy") return [];
        if (!gen1 && !canBattlerAct(options.project, enemy)) {
          recordIncapacitated(enemy);
          return [];
        }
        const action = chooseEnemyAction(enemy);
        return [{
          side: "enemy",
          index,
          speed: gen1
            ? gen1ParalyzedSpeed(enemy.agility, gen1MajorStatusOf(enemy)?.kind === "paralysis")
            : enemy.agility * agilityMultiplierForStates(options.project, enemy),
          priority: strictActionPriority(action?.skillId),
          commandClass: "combat",
          enemy,
          action,
        }];
      });
    const actions = [...actorActions, ...enemyActions];
    return options.project.system.battleModel === "gen1"
      ? orderGen1TurnActions(actions, rng)
      : actions.sort(compareStrictActions);
  }

  function strictCommandClass(command: ActorCommand): Gen1TurnOrderEntry["commandClass"] {
    if (command.kind === "switch") return "switch";
    if (command.kind === "item" || command.kind === "capture" || command.kind === "escape") return "field";
    return "combat";
  }

  function compareStrictActions(left: StrictQueuedAction, right: StrictQueuedAction): number {
    const leftSwitch = left.side === "actor" && left.command.kind === "switch";
    const rightSwitch = right.side === "actor" && right.command.kind === "switch";
    if (leftSwitch !== rightSwitch) return leftSwitch ? -1 : 1;
    if (left.priority !== right.priority) return right.priority - left.priority;
    if (left.speed !== right.speed) return right.speed - left.speed;
    // gen1: 동속 랜덤(사전 롤 비교 — 비교자 안에서 rng 를 굴리면 정렬이 비일관해진다).
    // 롤까지 같으면(상수 rng 등) 아래 결정적 폴백이 전순서를 보장한다.
    if (left.side !== right.side) return left.side === "actor" ? -1 : 1;
    return left.index - right.index;
  }

  function logStrictAction(
    round: number,
    order: number,
    action: StrictQueuedAction,
    beforeResult: BattleActionResultSnapshot | undefined
  ): void {
    const resultForLog = lastActionResult !== beforeResult ? lastActionResult : undefined;
    const user = action.side === "actor" ? action.actor : action.enemy;
    strictCurrentRoundActions.push({
      round,
      order,
      side: action.side,
      userId: user.id,
      userRecordId: user.recordId,
      commandKind: strictCommandKindForLog(action),
      targetId: resultForLog?.targetId,
      hit: resultForLog?.hit,
      amount: resultForLog?.amount,
      critical: resultForLog?.critical,
      skillName: resultForLog?.skillName,
    });
  }

  function strictCommandKindForLog(action: StrictQueuedAction): BattleRoundActionLogSnapshot["commandKind"] {
    if (action.side === "actor") return action.command.kind;
    return action.action?.skillId ? "enemySkill" : "enemyAttack";
  }

  function finishStrictRoundLog(round: number): void {
    roundLogs.push({
      round,
      actions: [...strictCurrentRoundActions],
      timeline: timeline.slice(strictRoundTimelineStart),
      participatingActorIds: [...strictCurrentRoundParticipantIds],
      actors: activeActors().map((actor) => ({ id: actor.id, hp: actor.hp, mp: actor.mp, stateIds: [...actor.stateIds] })),
      enemies: visibleEnemies().map((enemy) => ({ id: enemy.id, hp: enemy.hp, mp: enemy.mp, stateIds: [...enemy.stateIds] })),
      result,
    });
    strictCurrentRoundActions = [];
  }

  function beginTargetSelection(command: TargetedActorCommand): void {
    if (!activeActorId) return;
    const user = actors.find((entry) => entry.recordId === activeActorId);
    if (!user) return;
    const resolution = resolveBattleTargets({
      scope: commandScope(user, command),
      includeDefeatedAllies: commandRevives(command),
      user,
      actors: activeActors(),
      enemies: visibleEnemies(),
    });
    if (resolution.candidates.length === 0) return;
    if (!resolution.requiresSelection) {
      const targetId = targetIdFor(resolution.targets[0] ?? user);
      performActorCommand(concreteTargetCommand(command, targetId, resolution.side));
      return;
    }
    // 포켓몬: 후보가 하나면 목록을 건너뛰고 바로 실행. `requiresSelection` 은 후보 수와 무관하게
    // 단일 대상 스코프에서 항상 true 인 순수 판정이라(battleTargetResolver) 거기서 고치면 모든
    // 스킨이 함께 바뀐다 — 분기를 여기 둔다. targets 는 이 경로에서 비어 있으므로 candidates 를 쓴다.
    const onlyCandidate = resolution.candidates.length === 1 ? resolution.candidates[0] : undefined;
    if (autoConfirmSingleTarget && onlyCandidate) {
      performActorCommand(concreteTargetCommand(command, targetIdFor(onlyCandidate), resolution.side));
      return;
    }
    const targetIds = resolution.candidates.map(targetIdFor);
    const selectedTargetId = targetIds[0];
    targetSelection = {
      command,
      side: resolution.side,
      targetIds,
      selectedTargetId,
      targetEnemyIds: resolution.side === "enemy" ? targetIds : [],
      selectedEnemyId: resolution.side === "enemy" ? selectedTargetId : undefined,
      targetActorIds: resolution.side === "actor" ? targetIds as ActorId[] : [],
      selectedActorId: resolution.side === "actor" ? selectedTargetId as ActorId : undefined,
    };
    phase = "targetSelect";
  }

  function snapshot(): BattleSnapshot {
    const enemiesInBattle = visibleEnemies();
    const nextReady = battleFlow === "gauge" && phase === "charging" && !result
      ? nextReadyBattler(activeActors(), enemiesInBattle, Infinity, skinHasteMultiplier,
        (battler) => agilityMultiplierForStates(options.project, battler))
      : undefined;
    const forcedActor = forcedSwitchActor();
    // Action poses while lastActionResult is live (cleared when the next command phase begins).
    const showActionPose = Boolean(lastActionResult);
    const poseContext = { lastActionResult, showActionPose };
    // 승리: 살아 있는 아군만 victory 포즈(쓰러진 아군은 resolveBattlerPose 가 dead 를 우선한다).
    const actorPoseContext = result === "victory" ? { ...poseContext, victory: true } : poseContext;
    return {
      nextReadyBattlerId: nextReady?.battler.id,
      phase,
      eventChoice,
      eventPause,
      battleFlow,
      activeActorId,
      activeSlots,
      forcedSwitchActorId: forcedActor?.recordId,
      switchCandidateActorIds: switchCandidateActors().map((actor) => actor.recordId),
      participatingActorIds: [...participatingActorIds],
      actors: activeActors().map((actor, index) => withCharging(actor, battlerSnapshot(actor, activeActorPosition(index), actorPoseContext))),
      reserveActors: reserveActors().map((actor) => battlerSnapshot(actor, undefined, { showActionPose: false })),
      enemies: enemiesInBattle.map((enemy) => withCharging(enemy, battlerSnapshot(enemy, undefined, poseContext))),
      lastAnimation,
      lastActionResult,
      actionLog: [...actionLog],
      timeline: [...timeline],
      hitFeel: hitFeelFromActionResult(lastActionResult),
      lastCaptureResult,
      capturedMonsters,
      result,
      rewards,
      canEscape: options.canEscape,
      formation,
      failedEscapeAttempts,
      canLose: options.canLose,
      troopId: options.troopId,
      backdropResourceId,
      turn,
      strictRound: strictRoundCount,
      strictPendingActorIds: [...strictPendingActorIds],
      strictQueuedActorIds: strictActorCommands.map((entry) => entry.actorId),
      eventState: battleEvents.snapshot(),
      targetSelection,
      roundLogs,
      eventLogs: battleEvents.logs(),
      ...(partyGauge !== undefined ? { partyGauge } : {}),
    };
  }

  function performEnemyTurn(enemy: MutableBattler, finish: () => void = finishGaugeTurnSlot): void {
    rewardTurn = turn + 1;
    // 턴 시작 상태 처리(지속 피해/자연 회복).
    if (!gen1) {
      applyUpkeep(enemy);
    resolveOutcome();
    if (result) {
      phase = "resolved";
      return;
    }
    // 선고로 방금 쓰러졌으면 차례만 소비한다.
    if (enemy.hp <= 0) {
      enemy.gauge = 0;
      applyTroopEvents(finish, markGaugeActionCycle(enemy));
      return;
    }
    // 행동 불가(수면 등)면 적도 턴을 건너뛴다.
    if (!canBattlerAct(options.project, enemy)) {
      recordIncapacitated(enemy);
      enemy.gauge = 0;
      applyTroopEvents(finish, markGaugeActionCycle(enemy));
      return;
    }
    }
    executeEnemyTurnAction(enemy, pendingCharges.has(enemy.id) ? undefined : chooseEnemyAction(enemy));
    // 적의 물리 타격에 아군의 반격 상태가 걸려 있으면 행동이 끝난 뒤 되받아친다.
    drainCounters();
    enemy.gauge = 0;
    // 방어(defending)는 여기서 해제하지 않는다 — RM 의미는 "다음 자기 행동까지"이며
    // 해제 지점은 액터가 새 명령을 실행하는 applyActorCommandEffect 다. 예전에는
    // 적 행동 1회마다 전원의 방어가 풀려, strict(라운드 종료 해제)와 의미가 갈리고
    // 적 3체 기준 방어가 첫 적 공격만 막는 1/3 성능이었다(적대 리뷰).
    applyTroopEvents(finish, markGaugeActionCycle(enemy));
  }

  function finishGaugeTurnSlot(): void {
    resolveOutcome();
    if (!result && beginForcedSwitchIfNeeded()) return;
    phase = result ? "resolved" : "charging";
  }

  // ── 힘 모으기(SkillRecord.chargeTurns, 2026-10-01) ──
  // 쓰겠다고 정한 차례에는 예고만 남기고, 자기 차례가 chargeTurns 번 더 오면 그때 발동한다. 적·아군 같은 규칙이고
  // gauge·strict 흐름 모두 「자기 차례」를 센다. 반격(drainCounters)처럼 차례 밖에서 쓰는 기술은 모으지 않는다.
  const pendingCharges = new Map<string, { readonly skillId: SkillId; turnsLeft: number; readonly command?: ActorCommand; readonly action?: EnemyActionChoice }>();

  function chargeTurnsOf(skillId: SkillId | undefined): number {
    if (gen1 || !skillId) return 0;
    const turns = Math.round(lookupSkill(skillId)?.chargeTurns ?? 0);
    return Math.max(0, Math.min(3, turns));
  }

  function recordCharging(battler: MutableBattler, skillId: SkillId, turnsLeft: number, first: boolean): void {
    beginTimelineAction();
    const name = lookupSkill(skillId)?.name ?? "기술";
    // skillId 를 싣지 않는다 — 실으면 연출 재생기가 이 줄을 기술 시전으로 보고 시전자 위에 착탄 연출을 튼다(녹화 실측).
    recordTimeline({
      kind: "special", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id, charge: true,
      message: first
        ? `${withJosa(battler.name, "이/가")} ${withJosa(name, "을/를")} 준비한다! (${turnsLeft}턴 뒤)`
        : `${withJosa(battler.name, "이/가")} 힘을 모으고 있다… (${name}까지 ${turnsLeft}턴)`,
    });
  }

  /** 아군 명령의 힘 모으기 단계. 이번 차례에 실제로 실행할 명령, 또는 모으느라 차례를 쓴 경우 undefined. */
  function actorChargeStep(actor: MutableBattler, command: ActorCommand): ActorCommand | undefined {
    const pending = pendingCharges.get(actor.id);
    if (pending?.command) {
      pending.turnsLeft -= 1;
      if (pending.turnsLeft > 0) {
        recordCharging(actor, pending.skillId, pending.turnsLeft, false);
        return undefined;
      }
      pendingCharges.delete(actor.id);
      // 모으는 사이 MP·쿨다운·봉인으로 못 쓰게 됐으면 흩어진다.
      if (battleActorSkillFailure(options.project, actor, pending.skillId, comboParticipants(true), partyGauge)) {
        beginTimelineAction();
        recordSpecial(actor, actor, `${withJosa(actor.name, "이/가")} 모은 힘이 흩어졌다.`);
        return undefined;
      }
      return pending.command;
    }
    if (command.kind === "skill") {
      const turns = chargeTurnsOf(command.skillId);
      if (turns > 0) {
        pendingCharges.set(actor.id, { skillId: command.skillId, turnsLeft: turns, command });
        recordCharging(actor, command.skillId, turns, true);
        return undefined;
      }
    }
    return command;
  }

  /** 적의 자기 차례 행동(gauge·strict). 힘 모으기를 거친 뒤 executeEnemyAction 으로 넘긴다. */
  function executeEnemyTurnAction(enemy: MutableBattler, action: EnemyActionChoice | undefined): void {
    const pending = pendingCharges.get(enemy.id);
    if (pending?.action) {
      pending.turnsLeft -= 1;
      if (pending.turnsLeft > 0) {
        weakness.standUp(enemy.id);
        recordCharging(enemy, pending.skillId, pending.turnsLeft, false);
        return;
      }
      pendingCharges.delete(enemy.id);
      executeEnemyAction(enemy, pending.action);
      return;
    }
    const turns = chargeTurnsOf(action?.skillId);
    if (action?.skillId && turns > 0) {
      weakness.standUp(enemy.id);
      pendingCharges.set(enemy.id, { skillId: action.skillId, turnsLeft: turns, action });
      recordCharging(enemy, action.skillId, turns, true);
      return;
    }
    executeEnemyAction(enemy, action);
  }

  /** 쓰러진 배틀러는 모으던 힘을 잃는다(부활해도 이어지지 않는다). */
  function dropDefeatedCharges(): void {
    for (const battler of [...actors, ...enemies]) if (battler.hp <= 0) pendingCharges.delete(battler.id);
  }

  /** 스냅숏에 힘 모으기·변신을 싣는다(배틀러 자체 필드가 아니라 런타임 장부·상태에서 온다). */
  function withCharging(battler: MutableBattler, view: BattleBattlerSnapshot): BattleBattlerSnapshot {
    const pending = pendingCharges.get(battler.id);
    const form = gen1 ? undefined : transformResourceForStates(options.project, battler);
    const gimmickView=gimmicks.snapshot(battler.id);
    const gimmickForm=gimmicks.get(battler.id,"transform")?.config.resourceId;
    if (!pending && !form && !gimmickView.length) return view;
    return {
      ...view,
      ...(pending ? { charging: { skillId: pending.skillId, skillName: lookupSkill(pending.skillId)?.name ?? "", turnsLeft: pending.turnsLeft } } : {}),
      ...(form || gimmickForm ? { transformResourceId: form??gimmickForm } : {}),
      ...(gimmickView.length?{gimmicks:gimmickView}:{}),
    };
  }

  /** 게이지 밀기(SkillRecord.gaugeShift): ATB 흐름에서 대상의 행동 게이지를 옮긴다. */
  let gaugeShiftedTargetId: string | undefined;
  function shiftGauge(target: MutableBattler, amount: number): void {
    if (gen1 || battleFlow !== "gauge" || target.hp <= 0 || !amount) return;
    target.gauge = Math.max(0, Math.min(100, target.gauge + amount));
    gaugeShiftedTargetId = target.id;
  }

  function executeEnemyAction(enemy: MutableBattler, action: EnemyActionChoice | undefined): void {
    weakness.standUp(enemy.id);
    beginTimelineAction();
    if (action?.moveTo && enemy.hp > 0) moveEnemyBattler(enemy, action.moveTo.x, action.moveTo.y, ENEMY_MOVE_DEFAULT_MS);
    const skillId = action?.skillId;
    if (skillId) {
      const skill = lookupSkill(skillId);
      if (!skill || (enemy.skillCooldowns?.[skillId] ?? 0) > 0 || (!gen1 && battleSkillUseFailure(options.project, enemy, skillId, { requireLearned: false }))) return;
      if (!prepareGen1CombatAction(enemy)) return;
      const requestedTargetId = refreshedEnemyTargetId(enemy, action.targetIds?.[0]);
      const resolution = resolveBattleTargets({
        scope: skill.scope,
        user: enemy,
        actors: activeActors(),
        enemies: visibleEnemies(),
        requestedTargetId,
        area: skill.area,
      });
      const targets = resolution.requiresSelection
        ? resolution.targets
        : resolution.targets;
      if (targets.length === 0) return;
      // Red/Blue non-link opponents do not decrement PP. Player-controlled
      // battlers still use the normal finite-PP path above.
      if (!gen1) consumeBattleSkillResource(options.project, enemy, skillId);
      else startBattleSkillCooldown(enemy, skill);
      paySkillHpCost(enemy, skillId, "enemySkill");
      applySkillCast(enemy, targets, skillId, "enemySkill");
      applyEnemyActionSwitchEffects(action);
      applyGen1Residual(enemy);
      return;
    }
    const refreshedTargetId = refreshedEnemyTargetId(enemy, action?.targetIds?.[0]);
    const aimed = refreshedTargetId
      ? activeActors().find((actor) => actor.id === refreshedTargetId)
      : chooseBasicEnemyTarget(enemy);
    if (!aimed) return;
    if (!prepareGen1CombatAction(enemy)) return;
    if (gen1) {
      applyGen1Struggle(enemy, aimed, "enemyAttack");
      applyGen1Residual(enemy);
      return;
    }
    const target = coverTarget(enemy, aimed);
    const hpBefore = target.hp;
    const targetMaxHpBefore = target.maxHp;
    const emotionMultiplier = emotionDamageMultiplier(options.project, enemy, target);
    const result = redirectDamageToMp(target, hpBefore, applySkillLike(enemy, target, {
      power: enemy.attackPower,
      hitMultiplier:gimmickDamageMultiplier(enemy,target),
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(enemy),
      hitRate: withEvasion(normalAttackHitRate(enemy, target), enemy, target),
      // 통상공격 분산 ±20% — 아군 공격(applySingleActorAttack)과 동일 규칙.
      variance: 20,
      ...(emotionMultiplier !== 1 ? { elementMultiplier: emotionMultiplier } : {}),
      attackerStatMultiplier: attackMultiplierForStates(options.project, enemy),
      targetDefenseMultiplier: defenseMultiplierForStatesByKind(options.project, target, "attack"),
      gen1AttackerLevel: gen1AttackerLevel(enemy),
      rng,
    }));
    noteDamageHit(enemy, target, result, targetMaxHpBefore, 1);
    if (result.hit && result.amount > 0) recoverHitStates(target);
    recordAction(
      { userRecordId: enemy.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical },
      result.hit ? "damage" : "miss",
      "enemyAttack",
    );
    if (result.hit) queueStateCounter(enemy, target);
  }

  // ── 반격(EnemyRecord.reactions) ──
  // 아군의 피해 타격이 살아 있는 적에 명중하면 조건이 맞는 첫 반응 하나를 예약한다(타격당 최대 1회).
  // 예약은 행동이 끝난 뒤 drainCounters 가 차례 밖에서 실행한다 — 게이지·행동 사이클은 건드리지 않는다.
  // 최후의 일격(trigger onDeath): 아군의 타격으로 쓰러진 적이 전투당 한 번, 쓰러진 채로 skillId 를 쓴다.
  const pendingCounters: { enemy: MutableBattler; attacker: MutableBattler; skillId: SkillId; lastStand?: boolean }[] = [];
  const lastStandUsedIds = new Set<string>();

  // ── 반격·감싸기·회피·리플렉 상태(StateRuntimeEffects, 2026-10-01) ──
  // 반격 상태는 적의 reactions 와 따로 돈다: 물리 타격에 맞으면 행동이 끝난 뒤 통상 공격으로 되받아친다(타격당이 아니라 행동당 한 번).
  const pendingStateCounters: { holder: MutableBattler; attacker: MutableBattler;skillId?:string }[] = [];
  let resolvingStateCounter = false;

  function queueStateCounter(attacker: MutableBattler, holder: MutableBattler): void {
    if (gen1 || resolvingStateCounter || battlerSide(attacker) === battlerSide(holder) || holder.hp <= 0) return;
    if (pendingStateCounters.some((entry) => entry.holder === holder)) return;
    const armed=gimmicks.get(holder.id,"counter");
    const chance = armed ? 100 : counterChanceForStates(options.project, holder);
    if(armed)gimmicks.remove(armed);
    if (chance <= 0 || !rollChance(chance, rng)) return;
    pendingStateCounters.push({ holder, attacker,...(armed?{skillId:armed.skillId}:{}) });
  }

  function drainStateCounters(): void {
    while (pendingStateCounters.length > 0 && !result) {
      const { holder, attacker,skillId } = pendingStateCounters.shift()!;
      if (holder.hp <= 0 || attacker.hp <= 0 || holder.captured || !canBattlerAct(options.project, holder)) continue;
      const side = battlerSide(holder);
      recordTimeline({ kind: "counter", side, userRecordId: holder.recordId, userId: holder.id, targetId: attacker.id });
      resolvingStateCounter = true;
      try {
        // 아군 반격은 명령 경로를 거치지 않으므로 행동 번호를 직접 새로 뗀다(적 반격은 executeEnemyAction 이 뗀다).
        if(skillId&&lookupSkill(skillId)){beginTimelineAction();gimmickStrike(holder,attacker,lookupSkill(skillId)!,1);}
        else if (side === "actor") { beginTimelineAction(); applySingleActorAttack(holder, attacker); }
        // 적의 통상 공격은 기본 공격 스킬(skill_attack)을 거친다 — 적 행동 전부와 같은 경로.
        else executeEnemyAction(holder, { skillId: DEFAULT_SKILL_ID, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false }, targetIds: [attacker.id] });
      } finally {
        resolvingStateCounter = false;
      }
      resolveOutcome();
    }
    pendingStateCounters.length = 0;
  }

  /** 감싸기: 상대의 단일 물리 공격이 HP 1/4 이하인 동료를 노리면, 감싸기 상태의 다른 동료가 대신 맞는다. */
  function coverTarget(user: MutableBattler, target: MutableBattler): MutableBattler {
    if (gen1 || battlerSide(user) === battlerSide(target) || target.hp <= 0) return target;
    const prepared=gimmicks.get(target.id,"cover");
    const cover=prepared?[...actors,...enemies].find(b=>b.id===prepared.ownerId&&b.hp>0&&canBattlerAct(options.project,b)):undefined;
    if(prepared&&cover){gimmicks.remove(prepared);const skill=lookupSkill(prepared.skillId);if(skill){gimmicks.set(gimmickStatus(cover,cover,skill,"counter"));gimmickAnnouncement(cover,target,skill,true,`${cover.name}의 엄호!`);}return cover;}
    if(target.hp*4>target.maxHp)return target;
    const allies = battlerSide(target) === "actor" ? activeActors() : visibleEnemies();
    const guard = allies.find((ally) => ally !== target && ally.hp > 0 && canBattlerAct(options.project, ally) && stateFlag(options.project, ally, "cover"));
    if (!guard) return target;
    recordSpecial(guard, target, `${withJosa(guard.name, "이/가")} ${withJosa(target.name, "을/를")} 감쌌다!`);
    return guard;
  }

  /** 회피: 상대의 물리 피해 타격 명중률을 대상의 회피 확률만큼 깎는다. */
  function withEvasion(hitRate: number | undefined, user: MutableBattler, target: MutableBattler): number | undefined {
    if (gen1 || battlerSide(user) === battlerSide(target)) return hitRate;
    const evade = evasionChanceForStates(options.project, target);
    return evade > 0 ? Math.round(((hitRate ?? 100) * (100 - evade)) / 100) : hitRate;
  }

  /**
   * 리플렉: 리플렉 상태를 겨눈 단일 대상 마법(정신력 계열 피해·회복, 보조)은 시전자에게 튕긴다.
   * 튕긴 마법은 시전자가 리플렉이어도 다시 튕기지 않는다(한 번만). 자기 자신·물리·전체 마법은 그대로.
   */
  function reflectedTarget(user: MutableBattler, target: MutableBattler, skill: ReturnType<typeof lookupSkill>): MutableBattler {
    if (gen1 || !skill || user === target || (skill.scope !== "enemy" && skill.scope !== "ally") || skill.area) return target;
    const effect = skill.effect;
    const magical = effect.kind === "damage" || effect.kind === "healing" ? effect.statistic === "mind" : effect.kind === "support";
    if (!magical || !stateFlag(options.project, target, "reflect")) return target;
    recordSpecial(target, user, `${target.name}의 리플렉! ${withJosa(skill.name, "이/가")} 튕겨 나갔다!`);
    return user;
  }

  function queueCounter(attacker: MutableBattler, target: MutableBattler, statistic: "attack" | "mind", elementId: string | undefined): void {
    // 반격 상태의 되받아치기에는 적 반응이 다시 붙지 않는다(반격의 반격 금지).
    if (gen1 || resolvingStateCounter || battlerSide(target) !== "enemy" || battlerSide(attacker) !== "actor") return;
    const reactions = options.project.database.enemies.find((record) => record.id === target.recordId)?.reactions;
    if (!reactions?.length) return;
    if (target.hp <= 0) {
      if (lastStandUsedIds.has(target.id)) return;
      const lastStand = reactions.find((entry) => entry.trigger === "onDeath");
      if (!lastStand) return;
      lastStandUsedIds.add(target.id);
      if (rollChance(lastStand.chance, rng)) pendingCounters.push({ enemy: target, attacker, skillId: lastStand.skillId, lastStand: true });
      return;
    }
    const reaction = reactions.find((entry) =>
      entry.trigger === (statistic === "mind" ? "magic" : "physical") || (elementId !== undefined && entry.trigger === elementId));
    if (!reaction || !rollChance(reaction.chance, rng)) return;
    pendingCounters.push({ enemy: target, attacker, skillId: reaction.skillId });
  }

  function drainCounters(): void {
    while (pendingCounters.length > 0 && !result) {
      const { enemy, attacker, skillId, lastStand } = pendingCounters.shift()!;
      if ((!lastStand && enemy.hp <= 0) || enemy.captured || !canBattlerAct(options.project, enemy)) continue;
      const target = attacker.hp > 0 && activeActors().includes(attacker) ? attacker : chooseBasicEnemyTarget(enemy);
      if (!target) continue;
      recordTimeline({
        kind: "counter",
        side: "enemy",
        userRecordId: enemy.recordId,
        userId: enemy.id,
        targetId: target.id,
        skillName: skillId ? lookupSkill(skillId)?.name : undefined,
        ...(skillId ? { skillId } : {}),
      });
      // 쓰러진 적의 최후의 일격은 행동 경로(시전자 HP>0 가드)를 통과하도록 행동하는 동안만 HP 1 로 세운다.
      if (lastStand) enemy.hp = 1;
      try {
        executeEnemyAction(enemy, {
          skillId,
          switchOnAfterAction: { enabled: false },
          switchOffAfterAction: { enabled: false },
          targetIds: [target.id],
        });
      } finally {
        if (lastStand) enemy.hp = 0;
      }
    }
    pendingCounters.length = 0;
    drainStateCounters();
  }

  // ── 피해 MP 전환(StateRuntimeEffects.damageToMpRate) ── HP 피해의 일부를 MP 에서 대신 깎는다.
  // hpBefore 는 타격 직전 HP. 반환 결과의 amount 는 실제로 HP 에서 빠진 양이다.
  function redirectDamageToMp<T extends { readonly hit: boolean; readonly amount: number }>(target: MutableBattler, hpBefore: number, applied: T): T {
    if (gen1 || !applied.hit || applied.amount <= 0) return applied;
    const rate = damageToMpRateForStates(options.project, target);
    if (rate <= 0) return applied;
    const redirected = Math.min(target.mp, Math.floor(applied.amount * rate));
    if (redirected <= 0) return applied;
    target.mp -= redirected;
    target.hp = Math.max(0, hpBefore - (applied.amount - redirected));
    return { ...applied, amount: applied.amount - redirected };
  }

  // ── 장비 자동 부활(effectFlags.autoRevive) ── 전투당 배우 1회. 승패 판정 직전에 돌아 패배를 막는다.
  const autoRevivedIds = new Set<string>();

  /** 이 본체에 붙은 부위 중 쓰러진 것의 태그. */
  function brokenPartTags(core: MutableBattler): Set<string> {
    return new Set(enemies.filter((part) => part.partCoreId === core.id && part.partTag && part.hp <= 0).map((part) => part.partTag!));
  }

  /** 다부위 적: 부위 파괴를 알리고, 본체가 쓰러졌으면 남은 부위도 함께 쓰러뜨린다. */
  function resolveEnemyParts(): void {
    for (const part of enemies) {
      if (!part.partCoreId) continue;
      const core = enemies.find((entry) => entry.id === part.partCoreId);
      if (!core) continue;
      if (core.hp <= 0 && part.hp > 0) {
        part.hp = 0;
        part.gauge = 0;
        brokenPartIds.add(part.id);
        recordSpecial(core, part, `${core.name}이(가) 쓰러져 ${part.name}도 무너졌다.`);
        continue;
      }
      if (part.hp <= 0 && !brokenPartIds.has(part.id)) {
        brokenPartIds.add(part.id);
        recordSpecial(core, part, `${part.name} 파괴! ${core.name}의 일부 행동이 봉인됐다.`);
      }
    }
  }

  /** 부위 손실 상태(StateRecord.disablesEquipSlot)가 가리키는 장비 슬롯. */
  function lostEquipSlots(battler: MutableBattler): Set<string> {
    const slots = new Set<string>();
    for (const stateId of battler.stateIds) {
      const slot = options.project.database.states.find((state) => state.id === stateId)?.disablesEquipSlot;
      if (slot) slots.add(slot);
    }
    return slots;
  }

  /** 이벤트·세션 장비에서 잃은 슬롯만 비운 사본. 잃은 슬롯이 없으면 원본 그대로. */
  function equipmentAfterSlotLoss(battler: MutableBattler) {
    const raw = battleEventState.actorEquipment?.[battler.recordId];
    const lost = lostEquipSlots(battler);
    if (lost.size === 0) return raw;
    const base = { ...(raw ?? options.project.database.actors.find((actor) => actor.id === battler.recordId)?.initialEquipment ?? {}) };
    for (const slot of lost) base[slot] = undefined;
    return base;
  }

  function refreshActorStats(battler: MutableBattler, refreshSkills = false): void {
    refreshActorBattlerDerivedStats(options.project, battler, {
      classOverrides: battleEventState.classOverrides,
      growthProgress: battleEventState.growthProgress,
      promotionLineage: battleEventState.promotionLineage,
      paramBonuses: options.party?.paramBonuses?.[battler.recordId],
      equipment: equipmentAfterSlotLoss(battler),
      skills: refreshSkills
        ? { sessionSkillIds: battleEventState.actorSkillIds?.[battler.recordId] }
        : undefined,
    });
  }

  /** 상태가 바뀐 뒤 부위 손실 상태가 끼어 있으면 배우 능력치를 다시 계산한다. */
  function refreshAfterStateChange(battler: MutableBattler, changedStateIds: readonly string[]): void {
    if (battlerSide(battler) !== "actor" || changedStateIds.length === 0) return;
    const touchesSlot = changedStateIds.some((stateId) => options.project.database.states.find((state) => state.id === stateId)?.disablesEquipSlot);
    if (touchesSlot) refreshActorStats(battler);
  }

  function applyAutoRevives(): void {
    if (gen1) return;
    // 리레이즈 상태(StateRuntimeEffects.reraisePercent): 장비 자동 부활보다 먼저, 상태를 소모하고 일어난다.
    for (const actor of actors) {
      if (actor.hp > 0) continue;
      const reraise = reraiseForStates(options.project, actor);
      if (!reraise) continue;
      actor.stateIds = actor.stateIds.filter((stateId) => stateId !== reraise.stateId);
      delete actor.stateTurns[reraise.stateId];
      actor.hp = autoReviveHp(actor.maxHp, reraise.percent);
      recordTimeline({ kind: "stateRemoved", side: "actor", targetId: actor.id, stateId: reraise.stateId, reason: "effect" });
      recordTimeline({ kind: "revive", side: "actor", userRecordId: actor.recordId, targetId: actor.id, amount: actor.hp });
    }
    for (const actor of actors) {
      const percent = actor.equipmentEffects?.autoRevive;
      if (actor.hp > 0 || !percent || autoRevivedIds.has(actor.id)) continue;
      autoRevivedIds.add(actor.id);
      actor.hp = autoReviveHp(actor.maxHp, percent);
      recordTimeline({ kind: "revive", side: "actor", userRecordId: actor.recordId, targetId: actor.id, amount: actor.hp });
    }
  }

  // ── 적 위치 이동(m2 moveEnemy · 행동 moveTo) ──
  function moveEnemyBattler(enemy: MutableBattler, x: number, y: number, durationMs: number): void {
    moveBattler(enemy, x, y, durationMs);
    recordTimeline({ kind: "move", side: "enemy", userRecordId: enemy.recordId, userId: enemy.id, targetId: enemy.id });
  }

  function moveEnemyByTarget(target: string, x: number, y: number, durationMs: number): boolean {
    const enemy = enemies.find((entry) => entry.id === target || entry.recordId === target);
    if (!enemy || enemy.hidden || enemy.hp <= 0) return false;
    moveEnemyBattler(enemy, x, y, durationMs);
    return true;
  }

  function refreshedEnemyTargetId(enemy: MutableBattler, requestedTargetId: string | undefined): string | undefined {
    if (!requestedTargetId) return undefined;
    if (activeActors().some((actor) => actor.id === requestedTargetId)) return requestedTargetId;
    if (visibleEnemies().some((candidate) => candidate.id === requestedTargetId)) return requestedTargetId;
    if (actors.some((actor) => actor.id === requestedTargetId)) return chooseBasicEnemyTarget(enemy)?.id;
    return requestedTargetId;
  }

  function lookupSkill(skillId: SkillId) {
    return options.project.database.skills.find((record) => record.id === skillId);
  }

  /** 연계 판정용 참전 배우. allReady 는 이미 턴을 소비한 strict 해결 단계용(생존·MP 만 본다). */
  function comboParticipants(allReady = false): BattleComboParticipant[] {
    return activeActors().map((battler) => ({
      recordId: battler.recordId, hp: battler.hp, mp: battler.mp, maxMp: battler.maxMp, stateIds: battler.stateIds,
      ready: allReady || battler.gauge >= 100,
      ...(battler.equipmentEffects?.halfMpCost ? { halfMpCost: true } : {}),
    }));
  }

  /** 연계기 명령이면 시전자를 됼 동료 배틀러, 아니면 빈 배열. */
  function comboPartners(user: MutableBattler, command: ActorCommand): MutableBattler[] {
    if (command.kind !== "skill") return [];
    const combo = comboActorIdsOf(lookupSkill(command.skillId));
    if (!combo) return [];
    return activeActors().filter((battler) => battler !== user && combo.includes(battler.recordId as ActorId));
  }

  function applyItemCast(itemId: ItemId, targets: readonly MutableBattler[], user: MutableBattler): void {
    const authoredItem = options.project.database.items.find((record) => record.id === itemId);
    const item = authoredItem ? activeItemEffects(authoredItem) : undefined;
    if (!item) return;
    const count = battleEventState.inventory[itemId] ?? 0;
    if (count <= 0) return;
    if (!itemIsBattleUsable(item)) return;
    if (!isBattleItemUserEligible(options.project, item, user)) return;

    const skillId = item.activateSkillId ?? item.skillId;
    const usesNativeMedicineEffects = itemUsesNativeBattleEffects(item);
    const attachItemAnimation = (target: MutableBattler): void => {
      if (!item.animationId) return;
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, item.animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    };
    if (!usesNativeMedicineEffects && skillId) {
      applySkillCast(user, targets, skillId, "item", 1, attachItemAnimation);
    } else {
      for (const target of targets) {
        applyItemRecovery(user, target, item);
        applyStates(user, target, itemStateEffectsForBattle(item));
        attachItemAnimation(target);
      }
    }
  }

  function replaceItemTransitionState(next: { inventory: Record<string, number>; itemUseCharges: Record<string, number> }): void {
    Object.assign(battleEventState, next);
  }

  /** 아이템 사용 1회분 소모 — 커맨드당 정확히 1회 호출된다(다중 대상이어도 1개). */
  function consumeItemUse(itemId: ItemId): void {
    const consumed = transitionItemState(battleEventState, options.project.database.items, {
      kind: "successfulUse",
      itemId,
    });
    replaceItemTransitionState(consumed);
  }

  function itemIsBattleUsable(authoredItem: ItemRecord): boolean {
    const item = activeItemEffects(authoredItem);
    if (!itemAllowsBattle(item) || isCaptureTool(authoredItem)) return false;
    return Boolean(
      item.skillId ||
        item.activateSkillId ||
        (item.hpRecovery && (item.hpRecovery.flat > 0 || item.hpRecovery.percentMax > 0)) ||
        (item.mpRecovery && (item.mpRecovery.flat > 0 || item.mpRecovery.percentMax > 0)) ||
        (item.healStateIds && item.healStateIds.length > 0) ||
        (item.stateEffects && item.stateEffects.length > 0)
    );
  }

  function itemUsesNativeBattleEffects(item: {
    readonly type?: string;
    readonly skillId?: string;
    readonly activateSkillId?: string;
    readonly hpRecovery: { flat: number; percentMax: number };
    readonly mpRecovery: { flat: number; percentMax: number };
    readonly healStateIds: readonly string[];
    readonly stateEffects: readonly { operation: string }[];
  }): boolean {
    // 치료형(medicine) 또는 회복/상태 해제 필드가 있으면 아이템 고유 효과를 우선한다.
    // special 등 전투 발동형은 연결된 스킬을 사용한다.
    if (item.type === "special" || item.type === "weapon" || item.type === "shield" || item.type === "body" || item.type === "head" || item.type === "accessory") {
      return false;
    }
    const hasRecovery =
      item.hpRecovery.flat > 0 ||
      item.hpRecovery.percentMax > 0 ||
      item.mpRecovery.flat > 0 ||
      item.mpRecovery.percentMax > 0;
    const hasHeal =
      item.healStateIds.length > 0 ||
      item.stateEffects.some((effect) => effect.operation === "remove");
    return item.type === "medicine" || hasRecovery || hasHeal;
  }

  function applyItemRecovery(
    user: MutableBattler,
    target: MutableBattler,
    item: { readonly hpRecovery: { flat: number; percentMax: number }; readonly mpRecovery: { flat: number; percentMax: number } }
  ): void {
    const hp = Math.max(0, Math.floor((target.maxHp * item.hpRecovery.percentMax) / 100) + item.hpRecovery.flat);
    const mp = Math.max(0, Math.floor((target.maxMp * item.mpRecovery.percentMax) / 100) + item.mpRecovery.flat);
    const beforeHp = target.hp;
    const beforeMp = target.mp;
    if (hp > 0) target.hp = Math.min(target.maxHp, target.hp + hp);
    if (mp > 0) target.mp = Math.min(target.maxMp, target.mp + mp);
    // HP 와 MP 증가분을 하나의 amount 로 합산하지 않는다. 합산하면 화면 원장이 그 합계를
    // HP 변화로 읽어, 마력약(MP+30/HP+0)이 표시 HP 를 250→280 으로 올렸다가 다음 국면에
    // 250 으로 되돌렸다(실측). 자원별로 나누고 어느 자원인지 함께 넘긴다.
    const hpGain = target.hp - beforeHp;
    const mpGain = target.mp - beforeMp;
    const resource: "hp" | "mp" = hpGain > 0 ? "hp" : "mp";
    recordAction({
      userRecordId: user.recordId,
      targetId: target.id,
      hit: true,
      amount: resource === "hp" ? hpGain : mpGain,
      critical: false,
    }, "healing", "item", resource);
  }

  function itemStateEffectsForBattle(item: {
    readonly healStateIds: readonly string[];
    readonly stateEffects: readonly { stateId: string; chance: number; operation: "add" | "remove" }[];
  }) {
    const effects = [...item.stateEffects];
    for (const stateId of item.healStateIds) {
      if (!effects.some((effect) => effect.stateId === stateId && effect.operation === "remove")) {
        effects.push({ stateId, chance: 100, operation: "remove" });
      }
    }
    return effects;
  }

  function applyCapture(user: MutableBattler, captureItemId: ItemId, targetEnemyId: string): void {
    const finish = (next: BattleCaptureResultSnapshot): void => {
      lastCaptureResult = next;
      recordTimeline({
        kind: "capture",
        side: "actor",
        userRecordId: user.recordId,
        targetId: next.targetId,
        commandKind: "capture",
        success: next.success,
      });
    };
    const target = visibleEnemies().find((entry) => entry.id === targetEnemyId && entry.hp > 0);
    if (!target) {
      finish({ targetId: targetEnemyId, captureItemId, success: false, rate: 0, blockedReason: "missingTarget" });
      return;
    }
    if (troopRecord.uncapturable === true) {
      finish({ targetId: target.id, captureItemId, success: false, rate: 0, blockedReason: "uncapturable" });
      return;
    }
    if (troopRecord.trainerBattle === true) {
      finish({ targetId: target.id, captureItemId, success: false, rate: 0, blockedReason: "trainerBattle" });
      return;
    }
    const item = options.project.database.items.find((record) => record.id === captureItemId);
    const count = battleEventState.inventory[captureItemId] ?? 0;
    if (!item?.captureProfile || !isCaptureTool(item) || !itemAllowsBattle(item) || count <= 0) {
      finish({ targetId: target.id, captureItemId, success: false, rate: 0, blockedReason: "missingItem" });
      return;
    }
    const enemyRecord = options.project.database.enemies.find((record) => record.id === target.recordId);
    const species = monsterSpeciesForEnemy(options.project, enemyRecord);
    if (!species) {
      finish({ targetId: target.id, captureItemId, success: false, rate: 0, blockedReason: "missingSpecies" });
      return;
    }
    replaceItemTransitionState(transitionItemState(battleEventState, options.project.database.items, {
      kind: "successfulUse",
      itemId: captureItemId,
    }));
    // gen1 이면 Gen1 계열 공식(만HP 1/3 + 상태 보너스) — "재우고 잡기"가 여기서 성립한다.
    let rate: number;
    let roll: number | undefined;
    let shakes: 0 | 1 | 2 | 3 | undefined;
    if (gen1) {
      const attempt = attemptGen1Capture({
        ballClass: item.captureProfile.ballClass ?? "poke",
        maxHp: target.maxHp,
        currentHp: target.hp,
        catchRate: Math.round(species.captureRate * 255),
        majorStatus: gen1MajorStatusOf(target)?.kind,
      }, nextGen1Byte);
      rate = attempt.probability.value;
      roll = attempt.trace.rand1 === undefined ? undefined : attempt.trace.rand1 / 256;
      shakes = attempt.shakes;
      if (!attempt.caught) {
        finish({ targetId: target.id, captureItemId, success: false, rate, roll, shakes, speciesId: species.id });
        return;
      }
    } else {
      rate = captureSuccessRate(species.captureRate, target.hp, target.maxHp, captureItemMultiplier(item), {
        model: "rm2k3",
        statusMultiplier: captureStatusMultiplier(target.stateIds),
      });
      roll = rng();
      if (roll >= rate) {
        finish({ targetId: target.id, captureItemId, success: false, rate, roll, speciesId: species.id });
        return;
      }
    }
    const caughtAt = options.captureLocation ?? { mapId: options.project.startMapId, x: options.project.startPos.x, y: options.project.startPos.y };
    const persistentStateIds = target.stateIds.filter((stateId) => {
      const record = options.project.database.states.find((state) => state.id === stateId);
      return record !== undefined && !stateBehavior(record).removeOnBattleEnd;
    });
    const persistentStateTurns = Object.fromEntries(
      persistentStateIds.flatMap((stateId) => {
        const turns = target.stateTurns[stateId];
        return typeof turns === "number" ? [[stateId, turns]] : [];
      }),
    );
    const capture: BattleCapturedMonsterSnapshot = {
      targetId: target.id,
      enemyId: target.recordId as EnemyId,
      speciesId: species.id,
      level: Math.max(1, Math.min(99, Math.trunc(enemyRecord?.level ?? 1))),
      caughtAt,
      ivs: rollMonsterIvs(rng),
      captureItemId,
      currentHp: target.hp,
      stateIds: persistentStateIds,
      stateTurns: persistentStateTurns,
      skillIds: [...target.skillIds],
      skillPp: target.skillPp ? { ...target.skillPp } : undefined,
    };
    target.captured = true;
    target.hidden = true;
    target.hp = 0;
    target.gauge = 0;
    capturedMonsters.push(capture);
    actionLog.push({ userRecordId: user.recordId, targetId: target.id, hit: true, amount: 0, critical: false });
    lastActionResult = actionLog[actionLog.length - 1];
    options.onMonsterCaptured?.(capture);
    finish({ targetId: target.id, captureItemId, success: true, rate, roll, shakes, speciesId: species.id });
  }

  /** SkillRecord.hpCostPercent: 시전 대가로 최대 HP 의 N% 를 잃는다(1 밑으로는 안 깎음). 화면에 숫자가 뜨게 타임라인에 남긴다. */
  function paySkillHpCost(user: MutableBattler, skillId: SkillId, commandKind: BattleTimelineEntrySnapshot["commandKind"]): void {
    const skill = lookupSkill(skillId);
    if (!skill) return;
    const spent = spendSkillHp(user, skill);
    if (spent <= 0) return;
    recordTimeline({
      kind: "damage",
      side: battlerSide(user),
      userRecordId: user.recordId,
      targetId: user.id,
      commandKind,
      hit: true,
      amount: spent,
      critical: false,
      skillName: skill.name,
      skillId: skill.id,
      aside: "hpCost",
    });
  }

  /** SkillRecord.drainPercent: 준 피해의 N% 를 시전자가 회복한다(affects mp 면 MP). */
  function applySkillDrain(
    user: MutableBattler,
    skill: ReturnType<typeof lookupSkill>,
    dealt: number,
    affects: "hp" | "mp",
    commandKind: BattleTimelineEntrySnapshot["commandKind"],
  ): void {
    if (!skill) return;
    const healed = restoreSkillDrain(user, skill, dealt, affects);
    if (healed <= 0) return;
    recordTimeline({
      kind: "healing",
      side: battlerSide(user),
      userRecordId: user.recordId,
      targetId: user.id,
      commandKind,
      hit: true,
      amount: healed,
      critical: false,
      skillName: skill.name,
      skillId: skill.id,
      resource: affects,
      aside: "drain",
    });
  }

  function consumeSkillMp(user: MutableBattler, skillId: SkillId): void {
    const skill = lookupSkill(skillId);
    if (!skill) return;
    const cost = battleSkillMpCostFor(skill, user);
    if (cost > 0) user.mp -= cost;
  }

  /** 추격 연계기의 파티 게이지 소모(battleGauges). 끈 전투는 아무것도 안 한다. */
  function spendPartyGauge(skillId: SkillId): void {
    const skill = lookupSkill(skillId);
    if (partyGauge === undefined || !skill) return;
    partyGauge = clampPartyGauge(options.project, partyGauge - battleSkillPartyGaugeCost(options.project, skill));
  }

  /** HP 피해 명중 한 번 — 리미트·기력·파티 게이지 충전과 약점 추가 행동(battleGauges/battleEmotion). */
  function noteDamageHit(
    user: MutableBattler,
    target: MutableBattler,
    hit: { readonly hit: boolean; readonly amount: number },
    targetMaxHp: number,
    elementMultiplier: number,
  ): void {
    if (!hit.hit || hit.amount <= 0) return;
    const summon=gimmicks.get(target.id,"summon");if(summon)gimmicks.remove(summon);
    const userIsActor = battlerSide(user) === "actor";
    const gain = applyBattleHitGauges(options.project, {
      user, target, amount: hit.amount, targetMaxHp, userIsActor, targetIsActor: battlerSide(target) === "actor",
    });
    if (partyGauge !== undefined && gain > 0) partyGauge = clampPartyGauge(options.project, partyGauge + gain);
    if (target.hp > 0 && battlerSide(target) === "enemy") weakness.noteHit(user, target, elementMultiplier, userIsActor);
  }

  function chooseEnemyAction(enemy: MutableBattler): EnemyActionChoice | undefined {
    // 버서크: 저작 행동 대신 무작위 아군을 통상 공격한다.
    if (!gen1 && forcedActionForStates(options.project, enemy)) {
      const target = randomOpponent(enemy);
      return target ? { skillId: "" as SkillId, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false }, targetIds: [target.id] } : undefined;
    }
    const actionTurn = turn + 1;
    const plans = (enemy.enemyActions ?? [])
      .filter((action) => !action.requiresPart || !brokenPartTags(enemy).has(action.requiresPart))
      .filter((action) => combatConditionMet(action.condition, enemy, actionTurn, visibleEnemies().filter(ally => ally.id !== enemy.id && ally.hp > 0).length, battleEventState.switches))
      .filter((action) => !action.skillId || !battleSkillUseFailure(options.project, enemy, action.skillId, { requireLearned: false }))
      .flatMap((action) => {
        if (!action.skillId) {
          const target = chooseBasicEnemyTarget(enemy);
          return target ? [{ action: { ...action, targetIds: [target.id] }, score: Math.max(1, action.priority) * 10 + enemyDamageUtility(enemy, target) }] : [];
        }
        const skill = lookupSkill(action.skillId);
        if (!skill || (!gen1 && battleSkillUseFailure(options.project, enemy, action.skillId, { requireLearned: false }))) return [];
        const resolution = resolveBattleTargets({
          scope: skill.scope,
          user: enemy,
          actors: activeActors(),
          enemies: visibleEnemies(),
        });
        if (resolution.candidates.length === 0) return [];
        // 효용 0(풀피 힐, 기대 데미지 0)인 저작 액션도 버리지 않는다 — 예전에는 여기서
        // 걸러져 제네릭 기본 공격으로 낙하했고, 조건/우선순위/스위치와 아군 힐 대상
        // 계약이 통째로 무시됐다(battleRuntimeDefects 회귀 2건). 대신 "최후 수단" 점수
        // 밴드(-1000+우선순위)로 강등한다: 유익한 대안이 하나라도 있으면 지고(무익 힐
        // 필터 계약 유지), 그것뿐이면 RM2K3 답게 저작된 행동을 그대로 쓴다.
        if (!resolution.requiresSelection) {
          const utility = resolution.targets.reduce((sum, target) => sum + enemySkillUtility(enemy, target, skill), 0);
          const score = utility > 0 ? Math.max(1, action.priority) * 10 + utility : -1000 + Math.max(1, action.priority);
          return [{ action: { ...action, targetIds: resolution.targets.map(targetIdFor) }, score }];
        }
        const target = pickBestByUtility(tauntCandidates(enemy, resolution.candidates), (candidate) => enemySkillUtility(enemy, candidate, skill));
        if (!target) return [];
        const utility = areaTargets(target, resolution.candidates, skill.area).reduce((sum, hit) => sum + enemySkillUtility(enemy, hit, skill), 0);
        const score = utility > 0 ? Math.max(1, action.priority) * 10 + utility : -1000 + Math.max(1, action.priority);
        return [{ action: { ...action, targetIds: [target.id] }, score }];
      });
    if (plans.length === 0) {
      if (gen1) {
        const learnedPlans = enemy.skillIds.flatMap((skillId) => {
          if ((enemy.skillCooldowns?.[skillId] ?? 0) > 0) return [];
          const authoredConditions = (enemy.enemyActions ?? []).filter(action => action.skillId === skillId && action.condition.kind !== "always" && action.condition.kind !== "turn");
          if (authoredConditions.length && !authoredConditions.some(action => combatConditionMet(action.condition, enemy, actionTurn, visibleEnemies().filter(ally => ally.id !== enemy.id && ally.hp > 0).length, battleEventState.switches))) return [];
          const skill = lookupSkill(skillId);
          if (!skill) return [];
          const resolution = resolveBattleTargets({
            scope: skill.scope,
            user: enemy,
            actors: activeActors(),
            enemies: visibleEnemies(),
          });
          if (resolution.candidates.length === 0) return [];
          const targets = resolution.requiresSelection
            ? [pickBestByUtility(resolution.candidates, (candidate) => enemySkillUtility(enemy, candidate, skill))].filter((target): target is MutableBattler => target !== undefined)
            : resolution.targets;
          if (targets.length === 0) return [];
          const utility = targets.reduce((sum, target) => sum + enemySkillUtility(enemy, target, skill), 0);
          return [{
            action: {
              skillId,
              switchOnAfterAction: { enabled: false },
              switchOffAfterAction: { enabled: false },
              targetIds: targets.map(targetIdFor),
            },
            score: utility,
          }];
        });
        if (learnedPlans.length > 0) {
          const bestScore = Math.max(...learnedPlans.map((plan) => plan.score));
          return learnedPlans.find((plan) => plan.score === bestScore)?.action;
        }
      }
      const target = chooseBasicEnemyTarget(enemy);
      return target ? { skillId: "" as SkillId, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false }, targetIds: [target.id] } : undefined;
    }
    const bestScore = Math.max(...plans.map((plan) => plan.score));
    const ties = plans.filter((plan) => plan.score === bestScore);
    if (ties.length === 1) return ties[0]?.action;
    return ties[Math.min(ties.length - 1, Math.floor(rng() * ties.length))]?.action;
  }

  function chooseBasicEnemyTarget(enemy: MutableBattler): MutableBattler | undefined {
    return pickBestByUtility(tauntCandidates(enemy, activeActors().filter((actor) => actor.hp > 0)), (target) => enemyDamageUtility(enemy, target));
  }

  function enemyDamageUtility(
    user: MutableBattler,
    target: MutableBattler,
    power = gen1 ? 50 : user.attackPower,
    statistic: "attack" | "mind" = "attack",
    elementId?: string,
  ): number {
    const source = statistic === "mind" ? user.mind : user.attackPower;
    // gen1 은 코어 공식(랜덤·크리 제외)으로 기댓값을 낸다. 뺄셈식을 남겨두면 방어 높은 대상의
    // 기댓값이 0 으로 뭉개져 타깃 선택이 실제 피해와 어긋난다.
    const expected = usesGen1Damage(options.project)
      ? predictSkillDamage(
          options.project,
          battlerSnapshot(user),
          { power, statistic, effect: "damage", elementId },
          battlerSnapshot(target),
        ).amount
      : Math.max(0, power + Math.floor(source / 2) - Math.floor(target.defense / 2));
    return expected + (expected >= target.hp ? 1000 : 0) + (1 - target.hp / Math.max(1, target.maxHp)) * 20;
  }

  /**
   * 도발: 후보 중 상대편의 도발 상태 배틀러가 있으면 그들로만 좁힌다(단일 대상 고르기 전용).
   * 효용 점수에 가산하지 않는다 — 점수는 행동 고르기에도 쓰여, 가산하면 적이 피해 기술만 쓰게 된다.
   */
  function tauntCandidates<T extends MutableBattler>(user: MutableBattler, candidates: readonly T[]): readonly T[] {
    if (gen1) return candidates;
    const taunting = candidates.filter((candidate) => candidate.hp > 0 && battlerSide(candidate) !== battlerSide(user) && stateFlag(options.project, candidate, "taunt"));
    return taunting.length > 0 ? taunting : candidates;
  }

  function enemySkillUtility(user: MutableBattler, target: MutableBattler, skill: NonNullable<ReturnType<typeof lookupSkill>>): number {
    if (skill.effect.kind === "damage") {
      if (!skill.damageFormula && !skill.hitSequence && skill.criticalRate === undefined && skill.criticalMultiplier === undefined && !skill.cooldownTurns) {
        return enemyDamageUtility(user, target, skill.power, skill.effect.statistic, skill.elementId);
      }
      const expected = predictSkillDamageFor(options.project, battlerSnapshot(user), skill, battlerSnapshot(target)).amount;
      return expected + (expected >= target.hp ? 1000 : 0) + (1 - target.hp / Math.max(1, target.maxHp)) * 20;
    }
    if (skill.effect.kind === "healing") {
      const missing = skill.effect.affects === "mp" ? target.maxMp - target.mp : target.maxHp - target.hp;
      return missing > 0 ? missing + (target.hp / Math.max(1, target.maxHp) < 0.35 ? 500 : 0) : 0;
    }
    let utility = 0;
    for (const effect of skill.stateEffects ?? []) {
      if (effect.operation === "add" && !target.stateIds.includes(effect.stateId)) utility += effect.chance;
      if (effect.operation === "remove" && target.stateIds.includes(effect.stateId)) utility += 200;
    }
    if (skill.effect.kind === "switch" && skill.effect.switchId) utility += 1;
    return utility;
  }

  function pickBestByUtility<T>(values: readonly T[], utility: (value: T) => number): T | undefined {
    if (values.length === 0) return undefined;
    const scored = values.map((value) => ({ value, score: utility(value) }));
    const best = Math.max(...scored.map((entry) => entry.score));
    const ties = scored.filter((entry) => entry.score === best);
    if (ties.length === 1) return ties[0]?.value;
    return ties[Math.min(ties.length - 1, Math.floor(rng() * ties.length))]?.value;
  }



  function applyEnemyActionSwitchEffects(action: { readonly switchOnAfterAction: { readonly enabled: boolean; readonly switchId?: string }; readonly switchOffAfterAction: { readonly enabled: boolean; readonly switchId?: string } }): void {
    if (action.switchOnAfterAction.enabled && action.switchOnAfterAction.switchId) {
      battleEventState.switches[action.switchOnAfterAction.switchId] = true;
    }
    if (action.switchOffAfterAction.enabled && action.switchOffAfterAction.switchId) {
      battleEventState.switches[action.switchOffAfterAction.switchId] = false;
    }
  }

  function gimmickStatus(
    user: MutableBattler,
    target: MutableBattler,
    skill: NonNullable<ReturnType<typeof lookupSkill>>,
    kind: GimmickStatus["kind"],
  ): GimmickStatus {
    return {
      kind,
      ownerId: user.id,
      targetId: target.id,
      skillId: skill.id,
      remaining: Math.round(skill.battleGimmick?.durationTurns ?? 2),
      stacks: 0,
      stored: 0,
      createdAction: actionCounter,
      config: skill.battleGimmick!,
      x: target.battleX ?? target.authoredX,
      y: target.battleY ?? target.authoredY,
    };
  }
  function gimmickAlly(
    user: MutableBattler,
    config: BattleGimmick,
    reserve = false,
  ): MutableBattler | undefined {
    const pool =
      battlerSide(user) === "actor"
        ? reserve
          ? reserveActors()
          : activeActors()
        : visibleEnemies();
    return pool.find(
      (a) =>
        a !== user &&
        a.hp > 0 &&
        canBattlerAct(options.project, a) &&
        (!config.allyActorId || a.recordId === config.allyActorId),
    );
  }
  function gimmickAnnouncement(
    user: MutableBattler,
    target: MutableBattler,
    skill: NonNullable<ReturnType<typeof lookupSkill>>,
    triggered: boolean,
    message: string,
    ally?: MutableBattler,
  ): void {
    recordSpecial(user, target, message, skill.id, "skill");
    const latest = timeline.at(-1);
    if (latest)
      (latest as { gimmick: BattleTimelineEntrySnapshot["gimmick"] }).gimmick =
        {
          pattern: skill.battleGimmick!.pattern,
          triggered,
          ...(ally ? { allyId: ally.id } : {}),
        };
  }
  /** Installation/defensive preparation consumes the existing command cost once. */
  function prepareGimmickCast(
    user: MutableBattler,
    targets: readonly MutableBattler[],
    skill: NonNullable<ReturnType<typeof lookupSkill>>,
  ): boolean {
    const g = skill.battleGimmick;
    if (!g || gen1) return false;
    const p = g.pattern,
      target = targets[0] ?? user;
    const kind =
      p === "mirror-counter" || p === "absorb"
        ? "absorb"
        : p === "counter"
          ? "counter"
          : p === "cover"
            ? "cover"
            : p === "trap"
              ? "trap"
              : p === "transform"
                ? "transform"
                : undefined;
    if (!kind) return false;
    const stored =
      kind === "absorb" ? gimmicks.get(user.id, "absorb") : undefined;
    if (stored && stored.stored > 0) {
      const opponent = target !== user ? target : randomOpponent(user);
      if (opponent) {
        const hits = p === "mirror-counter" ? 3 : 1;
        const amount = Math.min(user.maxHp * 2, stored.stored);
        for (let i = 0; i < hits; i++)
          gimmickStrike(
            user,
            opponent,
            skill,
            1,
            Math.floor(amount / hits) + (i === hits - 1 ? amount % hits : 0),
          );
      }
      gimmicks.remove(stored);
      return true;
    }
    let recipient = kind === "trap" ? target : user;
    if (kind === "cover") recipient = gimmickAlly(user, g) ?? user;
    if (kind === "cover" && recipient === user) {
      gimmickAnnouncement(user, user, skill, false, "엄호할 동료가 없다.");
      return true;
    }
    gimmicks.set(gimmickStatus(user, recipient, skill, kind));
    recordAction(
      {
        userRecordId: user.recordId,
        targetId: recipient.id,
        hit: true,
        amount: 0,
        critical: false,
        skillId: skill.id,
        skillName: skill.name,
      },
      "action",
      "skill",
    );
    const preparation = timeline.at(-1);
    if (preparation)
      (
        preparation as { gimmick: BattleTimelineEntrySnapshot["gimmick"] }
      ).gimmick = { pattern: g.pattern, triggered: false };
    gimmickAnnouncement(
      user,
      recipient,
      skill,
      false,
      `${skill.name}: ${kind === "trap" ? "설치" : kind === "transform" ? "변신" : "준비"}!`,
    );
    return true;
  }
  function gimmickStrike(
    user: MutableBattler,
    target: MutableBattler,
    skill: NonNullable<ReturnType<typeof lookupSkill>>,
    multiplier: number,
    fixed?: number,
    periodic = false,
  ): void {
    if (user.hp <= 0 || target.hp <= 0) return;
    if (periodic) beginTimelineAction();
    const before = target.hp;
    const applied =
      fixed === undefined
        ? applySkillLike(user, target, {
            power: Math.max(1, skill.power),
            statistic:
              skill.effect.kind === "damage"
                ? skill.effect.statistic
                : ["counter", "cover"].includes(skill.battleGimmick!.pattern)
                  ? "attack"
                  : "mind",
            effect: "damage",
            affects: "hp",
            hitMultiplier: multiplier,
            hitRate: combinedSkillHitRate(skill),
            variance: skill.variance,
            criticalRate: 0,
            attackerStatMultiplier: attackMultiplierForStates(
              options.project,
              user,
            ),
            targetDefenseMultiplier: defenseMultiplierForStates(
              options.project,
              target,
            ),
            elementMultiplier: elementMultiplierFor(
              skill.elementId,
              user,
              target,
            ),
            rng,
          })
        : {
            hit: true,
            amount: Math.min(before, Math.max(0, fixed)),
            critical: false,
          };
    if (fixed !== undefined) target.hp = Math.max(0, before - applied.amount);
    recordAction(
      {
        userRecordId: user.recordId,
        targetId: target.id,
        hit: applied.hit,
        amount: applied.amount,
        critical: false,
        skillId: skill.id,
        skillName: skill.name,
      },
      applied.hit ? "damage" : "miss",
      "skill",
      "hp",
    );
    const latest = timeline.at(-1);
    if (latest)
      (latest as { gimmick: BattleTimelineEntrySnapshot["gimmick"] }).gimmick =
        {
          pattern: skill.battleGimmick!.pattern,
          triggered: applied.hit,
          ...(periodic ? { source: "periodic" } : {}),
        };
    if (applied.hit && applied.amount > 0) {
      noteDamageHit(user, target, applied, target.maxHp, 1);
      recoverHitStates(target);
    }
    if (before > 0 && target.hp <= 0) refundGimmickKill(user, skill);
  }
  function refundGimmickKill(
    user: MutableBattler,
    skill: NonNullable<ReturnType<typeof lookupSkill>>,
  ): void {
    const percent = skill.battleGimmick?.killRefundPercent ?? 0;
    if (percent <= 0) return;
    const restored = Math.min(
      user.maxHp - user.hp,
      Math.floor((user.maxHp * percent) / 100),
    );
    if (restored <= 0) return;
    user.hp += restored;
    recordTimeline({
      kind: "healing",
      side: battlerSide(user),
      userRecordId: user.recordId,
      targetId: user.id,
      skillId: skill.id,
      skillName: skill.name,
      amount: -restored,
      resource: "hp",
      aside: "drain",
      hit: true,
    });
  }
  function advanceGimmicks(battler: MutableBattler): void {
    if (gen1) return;
    for (const s of [...gimmicks.all()]) {
      if (s.targetId !== battler.id) continue;
      const user = [...actors, ...enemies].find((b) => b.id === s.ownerId),
        skill = lookupSkill(s.skillId);
      if (!user || user.hp <= 0 || !skill || battler.hp <= 0) {
        gimmicks.remove(s);
        continue;
      }
      if (s.kind === "trap") {
        if (rollChance(s.config.triggerChance ?? 85, rng))
          gimmickStrike(user, battler, skill, 1, undefined, true);
        else
          gimmickAnnouncement(user, battler, skill, false, "설치물을 피했다.");
        gimmicks.remove(s);
        continue;
      }
      if (s.kind === "summon" && canBattlerAct(options.project, user)) {
        const opponent = randomOpponent(user);
        if (opponent)
          gimmickStrike(
            user,
            opponent,
            skill,
            s.config.powerMultiplier ?? 0.45,
            undefined,
            true,
          );
      }
      if (s.kind === "zone") {
        const x = battler.battleX ?? battler.authoredX ?? 0,
          y = battler.battleY ?? battler.authoredY ?? 0;
        if (
          Math.hypot(x - (s.x ?? x), y - (s.y ?? y)) <= (s.config.radius ?? 120)
        )
          gimmickStrike(
            user,
            battler,
            skill,
            s.config.powerMultiplier ?? 0.35,
            undefined,
            true,
          );
      }
      s.remaining--;
      if (s.remaining <= 0) gimmicks.remove(s);
    }
  }
  function gimmickDamageMultiplier(
    user: MutableBattler,
    target: MutableBattler,
  ): number {
    const transform = gimmicks.get(user.id, "transform");
    const vulnerable = pendingCharges.has(target.id) ? 1.25 : 1;
    const counter = gimmicks.get(target.id, "counter") ? 0.65 : 1;
    return (
      vulnerable *
      counter *
      (transform ? 1 + (transform.config.powerMultiplier ?? 0.35) : 1)
    );
  }
  function absorbGimmickDamage(
    user: MutableBattler,
    target: MutableBattler,
    skill: ReturnType<typeof lookupSkill>,
    hpBefore: number,
    mpBefore: number,
    hit: { hit: boolean; amount: number; critical: boolean },
  ): typeof hit {
    const stored = gimmicks.get(target.id, "absorb");
    if (
      !stored ||
      !hit.hit ||
      hit.amount <= 0 ||
      skill?.effect.kind !== "damage" ||
      skill.effect.statistic !== "mind" ||
      (stored.config.elementId && stored.config.elementId !== skill.elementId)
    )
      return hit;
    target.hp = hpBefore;
    target.mp = mpBefore;
    stored.stored = Math.min(target.maxHp * 2, stored.stored + hit.amount);
    recordSpecial(
      target,
      user,
      `${target.name}: ${hit.amount} 흡수 (${stored.stored} 저장)!`,
    );
    return { ...hit, amount: 0 };
  }

  function applySkillCast(
    user: MutableBattler,
    targets: readonly MutableBattler[],
    skillId: SkillId,
    commandKind: BattleTimelineEntrySnapshot["commandKind"] = "skill",
    powerMultiplier = 1,
    afterTarget?: (target: MutableBattler) => void,
  ): void {
    const skill = lookupSkill(skillId);
    if (skill && prepareGimmickCast(user, targets, skill)) return;
    // 흉내·춤·슬롯: 후보 중 하나를 굴려 그 기술로 바꿔 쓴다. 자원은 원래 기술 몫만 소비했다.
    if (skill?.effect.kind === "randomSkillFrom") {
      const picked = pickRandomSkill(
        options.project,
        skill.effect.skillIds,
        rng,
      );
      const primary = targets[0] ?? user;
      recordSpecial(
        user,
        primary,
        picked
          ? `${skill.name}: ${picked.name}!`
          : `${skill.name}: 아무 일도 일어나지 않았다.`,
      );
      if (!picked) return;
      // 뽑힌 기술의 스코프로 다시 겨눈다: 전체기는 그 편 전원, 단일기는 원래 대상(편이 다르면 자신·무작위 상대).
      const resolve = (requestedId: string) =>
        resolveBattleTargets({
          scope: picked.scope,
          user,
          actors: activeActors(),
          enemies: visibleEnemies(),
          requestedTargetId: requestedId,
          area: picked.area,
          includeDefeatedAllies: commandRevives({
            kind: "skill",
            skillId: picked.id,
          }),
        });
      let resolution = resolve(primary.id);
      if (resolution.targets.length === 0) {
        const fallback =
          resolution.side === battlerSide(user) ? user : randomOpponent(user);
        if (fallback) resolution = resolve(fallback.id);
      }
      for (const pickedTarget of resolution.targets) {
        applySkill(user, pickedTarget, picked.id, commandKind, powerMultiplier);
        afterTarget?.(pickedTarget);
      }
      return;
    }
    // 감싸기: 단일 대상 물리 피해 기술도 통상 공격처럼 동료가 대신 맞는다.
    const physical =
      skill?.effect.kind === "damage" && skill.effect.statistic === "attack";
    const bounce = skill?.battleGimmick?.pattern === "bounce";
    const actualTargets = bounce
      ? (battlerSide(user) === "actor" ? visibleEnemies() : activeActors())
          .filter((b) => b.hp > 0)
          .slice(0, 3)
      : targets;
    let bounceIndex = 0;
    for (const aimed of actualTargets) {
      const target =
        physical && targets.length === 1 ? coverTarget(user, aimed) : aimed;
      applySkill(
        user,
        target,
        skillId,
        commandKind,
        powerMultiplier * (bounce ? 0.8 ** bounceIndex : 1),
      );
      afterTarget?.(target);
      if (bounce && lastActionResult?.hit === false) break;
      bounceIndex++;
    }
  }

  function applySkill(
    user: MutableBattler,
    aimed: MutableBattler,
    skillId: SkillId,
    commandKind: BattleTimelineEntrySnapshot["commandKind"] = "skill",
    powerMultiplier = 1,
  ): void {
    const skill = lookupSkill(skillId);
    const target = reflectedTarget(user, aimed, skill);
    if (
      skill &&
      (skill.effect.kind === "steal" ||
        skill.effect.kind === "scan" ||
        skill.effect.kind === "learnEnemySkill")
    ) {
      applySpecialSkill(user, target, skill, commandKind);
      return;
    }
    const g = gen1 ? undefined : skill?.battleGimmick,
      p = g?.pattern,
      marked = gimmicks.get(target.id, "mark", g?.markKey ?? "motion");
    if (g?.requiredMark && !marked) {
      gimmickAnnouncement(
        user,
        target,
        skill!,
        false,
        "표식이 없어 후속 공격을 취소했다.",
      );
      return;
    }
    const candidate =
      g && ["swap", "relay"].includes(g.pattern)
        ? gimmickAlly(user, g, g.pattern === "swap")
        : undefined;
    const relayReady =
      !candidate ||
      p !== "relay" ||
      skill?.comboActorIds?.length ||
      (battleFlow === "gauge"
        ? candidate.gauge >= 100
        : strictResolution?.actions
            .slice(strictResolution.index)
            .some((a) => a.side === "actor" && a.actor.id === candidate.id));
    const ally = relayReady ? candidate : undefined;
    const hpBeforeCast = target.hp;
    let firstHit = true;
    gaugeShiftedTargetId = undefined;
    const sequence = skill?.hitSequence ?? [1];
    for (let index = 0; index < sequence.length; index++) {
      let multiplier = sequence[index]!;
      if (index > 0 && (g?.followOnHit || p === "swap") && !firstHit) break;
      if (index > 0 && ["swap", "relay"].includes(p ?? "") && !ally) break;
      const last = index === sequence.length - 1;
      const mark = gimmicks.get(target.id, "mark", g?.markKey ?? "motion");
      if (last && g?.consumeMarks && mark)
        multiplier *= 1 + Math.min(9, mark.stacks) * 0.18;
      if (index > 0 && ally) {
        if (p === "swap" && !switchActiveActor(user.recordId, ally.recordId))
          break;
        if (p === "relay" && !skill?.comboActorIds?.length) {
          if (ally.mp < battleSkillMpCostFor(skill!, ally)) break;
          consumeSkillMp(ally, skillId);
          ally.gauge = 0;
          if (strictResolution) {
            const at = strictResolution.actions.findIndex(
              (a, i) =>
                i >= strictResolution!.index &&
                a.side === "actor" &&
                a.actor.id === ally.id,
            );
            if (at >= 0) strictResolution.actions.splice(at, 1);
          }
        }
        gimmickStrike(ally, target, skill!, multiplier);
        continue;
      }
      if (user.hp <= 0 || (target.hp <= 0 && skill?.effect.kind === "damage"))
        break;
      applySkillHit(
        user,
        target,
        skillId,
        commandKind,
        multiplier * powerMultiplier,
      );
      if (index === 0) firstHit = lastActionResult?.hit === true;
      if (last && g?.consumeMarks && mark && lastActionResult?.hit)
        gimmicks.remove(mark);
      if (
        lastActionResult?.hit &&
        g &&
        ["mark", "marked-spear"].includes(g.pattern) &&
        !(last && g.consumeMarks)
      ) {
        const status =
          gimmicks.get(target.id, "mark", g.markKey ?? "motion") ??
          gimmickStatus(user, target, skill!, "mark");
        status.stacks = Math.min(g.maxStacks ?? 3, status.stacks + 1);
        gimmicks.set(status);
      }
    }
    if (skill && g) {
      if (
        firstHit &&
        ["air-chase", "sky-crush"].includes(g.pattern) &&
        target.hp > 0
      ) {
        gimmicks.set(gimmickStatus(user, target, skill, "airborne"));
        shiftGauge(target, -20);
      }
      if (
        firstHit &&
        lastActionResult?.hit &&
        ["throw", "sky-crush"].includes(g.pattern)
      ) {
        const other = (
          battlerSide(user) === "actor" ? visibleEnemies() : activeActors()
        ).find((b) => b !== target && b.hp > 0);
        if (other) gimmickStrike(user, other, skill, 0.35);
      }
      if (firstHit && g.pattern === "zone")
        gimmicks.set(gimmickStatus(user, target, skill, "zone"));
      if (firstHit && ["summon", "blood-summon"].includes(g.pattern))
        gimmicks.set(gimmickStatus(user, user, skill, "summon"));
      if (hpBeforeCast > 0 && target.hp <= 0) refundGimmickKill(user, skill);
      const latest = timeline.findLast(
        (e) =>
          e.actionId === currentActionId && e.skillId === skill.id && !e.aside,
      );
      if (latest)
        (
          latest as { gimmick: BattleTimelineEntrySnapshot["gimmick"] }
        ).gimmick = {
          pattern: g.pattern,
          triggered:
            firstHit && (!["swap", "relay"].includes(g.pattern) || !!ally),
          ...(ally ? { allyId: ally.id } : {}),
        };
    }
    // 게이지 밀기는 타마다 옮기고 문장은 대상당 한 줄.
    if (
      skill?.gaugeShift &&
      gaugeShiftedTargetId === target.id &&
      target.hp > 0
    ) {
      recordSpecial(
        user,
        target,
        skill.gaugeShift < 0
          ? `${target.name}의 행동이 늦춰졌다!`
          : `${target.name}의 행동이 빨라졌다!`,
      );
    }
    gaugeShiftedTargetId = undefined;
  }

  function recordSpecial(user: MutableBattler, target: MutableBattler, message: string, skillId?: SkillId, commandKind?: BattleTimelineEntrySnapshot["commandKind"]): void {
    recordTimeline({ kind: "special", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, message, ...(skillId ? { skillId, skillName: lookupSkill(skillId)?.name, commandKind } : {}) });
  }

  /** 배우의 영구 기술 목록과 전투 중 목록에 한 기술을 더한다(이벤트 learnSkill 과 같은 권위). */
  function learnBattleSkill(actor: MutableBattler, skillId: SkillId): void {
    battleEventState.actorSkillIds ??= {};
    const known = new Set(permanentActorSkillIds(options.project, battleEventState, actor.recordId));
    known.add(skillId);
    battleEventState.actorSkillIds[actor.recordId] = [...known];
    if (!actor.skillIds.includes(skillId)) actor.skillIds = [...actor.skillIds, skillId];
  }

  function applySpecialSkill(user: MutableBattler, target: MutableBattler, skill: NonNullable<ReturnType<typeof lookupSkill>>, commandKind: BattleTimelineEntrySnapshot["commandKind"]): void {
    const hitRate = combinedSkillHitRate(skill) ?? 100;
    if (rng() * 100 >= hitRate) {
      recordAction({ userRecordId: user.recordId, targetId: target.id, hit: false, amount: 0, critical: false, skillName: skill.name, skillId: skill.id }, "miss", commandKind);
      return;
    }
    if (skill.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
    }
    const enemyRecord = battlerSide(target) === "enemy"
      ? options.project.database.enemies.find((record) => record.id === target.recordId)
      : undefined;
    if (skill.effect.kind === "steal") {
      if (!enemyRecord || !(enemyRecord.stealItems?.length)) {
        recordSpecial(user, target, "훔칠 것이 없다.", skill.id, commandKind);
      } else if (stolenFrom.has(target.id)) {
        recordSpecial(user, target, "이미 훔쳤다.", skill.id, commandKind);
      } else {
        const itemId = rollStealItem(enemyRecord, rng);
        if (itemId) {
          stolenFrom.add(target.id);
          battleEventState.inventory[itemId] = (battleEventState.inventory[itemId] ?? 0) + 1;
          const name = options.project.database.items.find((item) => item.id === itemId)?.name ?? itemId;
          recordSpecial(user, target, `${name}을(를) 훔쳤다!`, skill.id, commandKind);
        } else {
          recordSpecial(user, target, "훔치지 못했다.", skill.id, commandKind);
        }
      }
    } else if (skill.effect.kind === "scan") {
      target.scanned = true;
      const rates: Record<string, string | undefined> = {};
      for (const element of options.project.database.elements ?? []) {
        const base = enemyRecord?.elementRates?.[element.id]
          ?? options.project.database.actors.find((actor) => actor.id === target.recordId)?.elementRates?.[element.id];
        rates[element.id] = stateElementRateOverride(options.project, target, element.id) ?? base;
      }
      recordSpecial(user, target, scanMessage(target.name, target, weaknessElementNames(options.project, rates)), skill.id, commandKind);
    } else if (skill.effect.kind === "learnEnemySkill") {
      const learned = battlerSide(user) === "actor" && enemyRecord
        ? firstLearnableSkill(options.project, target.skillIds, user.skillIds)
        : undefined;
      if (learned) {
        learnBattleSkill(user, learned.id);
        recordSpecial(user, target, `${learned.name}을(를) 배웠다!`, skill.id, commandKind);
      } else {
        recordSpecial(user, target, "배울 기술이 없다.", skill.id, commandKind);
      }
    }
    applyStates(user, target, skill.stateEffects);
  }


  /** 청마법: learnEnemySkill 기술을 아는 배우가 적의 learnable 기술에 맞으면 그 기술을 배운다. */
  function learnSkillThatHit(user: MutableBattler, target: MutableBattler, skill: ReturnType<typeof lookupSkill>): void {
    if (!skill?.learnable || battlerSide(user) !== "enemy" || battlerSide(target) !== "actor" || target.monsterInstanceId) return;
    if (target.skillIds.includes(skill.id)) return;
    const blueMage = target.skillIds.some((id) => lookupSkill(id)?.effect.kind === "learnEnemySkill");
    if (!blueMage) return;
    learnBattleSkill(target, skill.id);
    recordSpecial(user, target, `${target.name}이(가) ${skill.name}을(를) 배웠다!`);
  }

  function applySkillHit(
    user: MutableBattler,
    target: MutableBattler,
    skillId: SkillId,
    commandKind: BattleTimelineEntrySnapshot["commandKind"] = "skill",
    hitMultiplier = 1,
  ): void {
    const skill = lookupSkill(skillId);
    if (gen1) {
      applyGen1Skill(user, target, skill, commandKind, hitMultiplier);
      return;
    }
    // 기본 "공격" 스킬(skill_attack)은 통상공격을 표현하는 스킬이다. 그 위력은 고정 10 이 아니라
    // 시전자의 공격력에서 나와야 한다 — 플레이어 통상공격 명령은 이미 attackPower 를 쓴다.
    //
    // 이 한 줄이 없으면 적 220종 전부(authored action 이 모두 skill_attack 경유, 폴백 0종)의 피해가
    // `10 + floor(공/2) − floor(방/2)` 로 계산된다. 주인공 방어 72 → −36 이라
    // 공격 33 짜리 적이 정확히 0 을 때리고, 기본 트룹 3종 전부 피해 0 · 승률 1.0 이 된다(실측).
    const power = skillId === DEFAULT_SKILL_ID && !skill?.damageFormula
      ? user.attackPower
      : skill?.power ?? FALLBACK_SKILL_POWER;
    const effect = skill?.effect;
    const effectKind = effect?.kind ?? "damage";
    // statistic 필드는 damage/healing 효과에만 존재한다.
    const statistic: "attack" | "mind" = effect && (effect.kind === "damage" || effect.kind === "healing")
      ? effect.statistic
      : "attack";
    const affects =
      effect && (effect.kind === "damage" || effect.kind === "healing") ? effect.affects : "hp";
    const hpBefore = target.hp;
    const mpBefore = target.mp;
    const targetMaxHpBefore = target.maxHp;
    const rawResult = applySkillLike(user, target, {
      power,
      statistic,
      effect: damageEffectKind(effectKind),
      affects,
      // RM2K3 스킬 성공률: hitRate(명중률)와 successRate(성공률)를 합성한 단일 판정.
      // 두 값 모두 100 이 기본이라 기존 데이터의 기대 명중률은 변하지 않는다.
      // 회피 상태는 물리(공격력 계열) 피해 기술만 피한다.
      hitRate: effectKind === "damage" && statistic === "attack" ? withEvasion(combinedSkillHitRate(skill), user, target) : combinedSkillHitRate(skill),
      damageFormula: skill?.damageFormula,
      hitMultiplier:hitMultiplier*(effectKind==="damage"?gimmickDamageMultiplier(user,target):1),
      criticalMultiplier: skill?.criticalMultiplier,
      variance: skill?.variance,
      criticalRate: skill?.criticalRate ?? criticalRateFor(user),
      elementMultiplier: elementMultiplierFor(skill?.elementId, user, target) * emotionDamageMultiplier(options.project, user, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, user),
      targetDefenseMultiplier: defenseMultiplierForStatesByKind(options.project, target, statistic),
      useMagicalDefense: isMagicalElement(skill?.elementId),
      gen1AttackerLevel: gen1AttackerLevel(user),
      rng,
    });
    const adjusted=effectKind==="damage"?absorbGimmickDamage(user,target,skill,hpBefore,mpBefore,rawResult):rawResult;
    const result = effectKind === "damage" && affects !== "mp" ? redirectDamageToMp(target, hpBefore, adjusted) : adjusted;
    if (effectKind === "damage" && affects === "hp") noteDamageHit(user, target, result, targetMaxHpBefore, elementMultiplierFor(skill?.elementId, user, target));
    const timelineKind: BattleTimelineEntrySnapshot["kind"] = !result.hit
      ? "miss"
      : effectKind === "healing" || result.amount < 0
        ? "healing"
        : effectKind === "damage"
          ? "damage"
          : "action";
    recordAction(
      { userRecordId: user.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical, skillName: skill?.name, skillId: skill?.id },
      timelineKind,
      commandKind,
      effectKind === "healing" || effectKind === "damage" ? affects : undefined,
    );
    if (skill?.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    }
    // MP 흡수는 상대가 실제로 잃은 MP 까지만(HP 흡수는 굴린 피해 그대로 — battleSkillVitals 정책).
    if (result.hit && effectKind === "damage") applySkillDrain(user, skill, affects === "mp" ? Math.min(result.amount, mpBefore - target.mp) : result.amount, affects, commandKind);
    if (result.hit && effectKind === "damage" && statistic === "attack") queueStateCounter(user, target);
    // 피격에 의한 상태 해제(수면 등)를 먼저 처리한 뒤, 스킬의 상태 효과를 적용한다.
    // 이 순서라야 이번 스킬로 새로 부여한 상태가 즉시 해제되지 않는다.
    if (result.hit && effectKind === "damage" && result.amount > 0) {
      recoverHitStates(target);
    }
    if (result.hit) {
      applyStates(user, target, skill?.stateEffects);
    }
    if (result.hit && skill?.gaugeShift) shiftGauge(target, skill.gaugeShift);
    if (result.hit && skill?.effect?.kind === "switch" && skill.effect.switchId) {
      // RM2K3 스위치형 스킬: 명중 시 지정 스위치를 ON으로 만든다.
      battleEventState.switches[skill.effect.switchId] = true;
    }
    if (result.hit && effectKind === "damage") queueCounter(user, target, statistic, skill?.elementId);
    if (result.hit) learnSkillThatHit(user, target, skill);
  }
  // successRate 는 감사 A12 에서 "편집만 되고 전투에 미반영"으로 확인된 필드다.
  function applyGen1Skill(
    user: MutableBattler,
    target: MutableBattler,
    skill: ReturnType<typeof lookupSkill>,
    commandKind: BattleTimelineEntrySnapshot["commandKind"],
    hitMultiplier = 1,
  ): void {
    const effect = skill?.effect;
    const effectKind = effect?.kind ?? "damage";
    const power = skill?.power ?? 50;
    const accuracyHit = effectKind === "damage"
      || nextGen1Byte() < accuracyByteFromPercent(skill?.hitRate ?? 100);
    const statistic: "attack" | "mind" = effect && (effect.kind === "damage" || effect.kind === "healing")
      ? effect.statistic
      : "attack";
    const affects = effect && (effect.kind === "damage" || effect.kind === "healing")
      ? effect.affects
      : "hp";
    const gen1MpBefore = target.mp;
    const applied = effectKind === "damage"
      ? applyExactGen1Damage(user, target, {
          power,
          elementId: skill?.elementId,
          hitRate: skill?.hitRate,
          criticalRate: skill?.gen1CriticalRate,
          criticalChancePercent: skill?.criticalRate,
          criticalMultiplier: skill?.criticalMultiplier,
          hitMultiplier,
          damageFormula: skill?.damageFormula,
          affects,
        })
      : !accuracyHit
        ? { hit: false, amount: 0, critical: false }
        : applySkillLike(user, target, {
            power,
            statistic,
            effect: damageEffectKind(effectKind),
            affects,
            hitRate: 100,
            variance: skill?.variance,
            hitMultiplier,
            damageFormula: skill?.damageFormula,
            rng,
          });
    const timelineKind: BattleTimelineEntrySnapshot["kind"] = !applied.hit
      ? "miss"
      : effectKind === "healing" || applied.amount < 0
        ? "healing"
        : effectKind === "damage"
          ? "damage"
          : "action";
    recordAction({
      userRecordId: user.recordId,
      targetId: target.id,
      hit: applied.hit,
      amount: applied.amount,
      critical: applied.critical,
      skillName: skill?.name,
      skillId: skill?.id,
    }, timelineKind, commandKind, effectKind === "healing" || effectKind === "damage" ? affects : undefined);
    if (skill?.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    }
    // 흡수(drainPercent)는 gen1 규칙에서도 먹는다 — 예전엔 대가만 깎이고 회복은 조용히 빠졌다.
    if (applied.hit && effectKind === "damage") applySkillDrain(user, skill, affects === "mp" ? Math.min(applied.amount, gen1MpBefore - target.mp) : applied.amount, affects, commandKind);
    const defrosted = applied.hit
      && effectKind === "damage"
      && applied.amount > 0
      && defrostTargetWithGen1FireMove(user, target, skill);
    if (applied.hit && (effectKind !== "damage" || applied.amount > 0)) {
      const stateEffects = defrosted
        ? skill?.stateEffects?.filter((stateEffect) => {
            const state = options.project.database.states.find((record) => record.id === stateEffect.stateId);
            return state?.gen1MajorStatus !== "burn";
          })
        : skill?.stateEffects;
      applyStates(user, target, stateEffects, {
        type: skill?.elementId,
        kind: effectKind === "damage" ? "damage" : "status",
      });
    }
    if (applied.hit && skill?.effect?.kind === "switch" && skill.effect.switchId) {
      battleEventState.switches[skill.effect.switchId] = true;
    }
  }

  function defrostTargetWithGen1FireMove(
    user: MutableBattler,
    target: MutableBattler,
    skill: ReturnType<typeof lookupSkill>,
  ): boolean {
    if (!skill || gen1CanonicalTypeForId(options.project, skill.elementId) !== "fire") return false;
    const canBurn = skill.stateEffects?.some((effect) => {
      if (effect.operation !== "add") return false;
      return options.project.database.states.find((state) => state.id === effect.stateId)?.gen1MajorStatus === "burn";
    }) === true;
    const frozen = gen1MajorStatusOf(target);
    if (!canBurn || frozen?.kind !== "freeze") return false;
    target.stateIds = target.stateIds.filter((stateId) => stateId !== frozen.stateId);
    delete target.stateTurns[frozen.stateId];
    recordTimeline({
      kind: "stateRemoved",
      side: battlerSide(user),
      userRecordId: user.recordId,
      targetId: target.id,
      stateId: frozen.stateId,
      reason: "effect",
    });
    return true;
  }

  function combinedSkillHitRate(skill: { hitRate?: number; successRate?: number } | undefined): number | undefined {
    if (!skill) return undefined;
    const hitRate = skill.hitRate ?? 100;
    const successRate = skill.successRate ?? 100;
    return Math.max(0, Math.min(100, Math.round((hitRate * successRate) / 100)));
  }

  // 사용자의 크리티컬 발동 확률(%)을 계산. actor 는 ActorCritical.chanceDenominator(1/N),
  // enemy 는 EnemyCritical.oneIn(1/N). 데이터 없으면 0.
  function criticalRateFor(user: MutableBattler): number {
    const actor = options.project.database.actors.find((entry) => entry.id === user.recordId);
    const actorRate = actor?.critical?.enabled && actor.critical.chanceDenominator > 0
      ? 100 / actor.critical.chanceDenominator
      : 0;
    const enemy = options.project.database.enemies.find((entry) => entry.id === user.recordId);
    const enemyRate = enemy?.criticalHit?.enabled && enemy.criticalHit.oneIn > 0
      ? 100 / enemy.criticalHit.oneIn
      : 0;
    return Math.max(0, Math.min(100, actorRate + enemyRate + (user.equipmentEffects?.criticalRate ?? 0)));
  }

  function normalAttackHitRate(user: MutableBattler, target: MutableBattler): number {
    const enemy = options.project.database.enemies.find((entry) => entry.id === user.recordId);
    let rate = enemy?.attackOptions.normalAttacksMiss ? 90 : 100;
    const equipmentAccuracy = user.equipmentEffects?.accuracy;
    if (equipmentAccuracy !== undefined) rate *= equipmentAccuracy / 100;
    for (const stateId of user.stateIds) {
      const state = options.project.database.states.find((entry) => entry.id === stateId);
      if (typeof state?.accuracyModifier === "number") rate *= state.accuracyModifier / 100;
    }
    rate -= Math.max(-20, Math.min(40, (target.agility - user.agility) * 0.5));
    const minimumRate = equipmentAccuracy === 0 ? 0 : 5;
    return Math.max(minimumRate, Math.min(100, Math.round(rate)));
  }

  function normalAttackElementMultiplier(user: MutableBattler, target: MutableBattler): number {
    const elementId = user.equipmentEffects?.attackElementIds?.[0];
    return elementMultiplierFor(elementId, user, target);
  }

  // 속성 상성 배율을 계산. skill.elementId 가 없거나 데이터가 없으면 1.0.
  // target 의 elementRates(등급 A~E) → DatabaseElementRecord.damageMultipliers(배율) 조회.
  function elementMultiplierFor(elementId: string | undefined, user: MutableBattler, target: MutableBattler): number {
    return battleElementMultiplier(options.project, elementId, user, target);
  }

  // 데미지 감소를 mind(마법 방어력) 로 라우팅할지 — 판정은 battleDamage.usesMagicalDefense 단일
  // 권위자에 위임한다(predict 와 동일 규칙 보장). gen1 모델에서만 활성.
  function isMagicalElement(elementId: string | undefined): boolean {
    return usesMagicalDefense(options.project, elementId);
  }

  // Gen1 코어 공식에 넘길 시전자 레벨. 판정은 battleDamage.usesGen1Damage 단일 권위자에 위임한다.
  // undefined 를 돌려주면 rm2k3 뺄셈식이 그대로 유지된다(기본 프로젝트 회귀 0).
  function gen1AttackerLevel(user: MutableBattler): number | undefined {
    return usesGen1Damage(options.project) ? (user.level ?? 1) : undefined;
  }

  function applyTroopEvents(continuation: () => void, eventTurn: number = turn): void {
    afterBattleEvents = continuation;
    consumeBattleEventStep(battleEvents.applyTroopEvents({ turn: eventTurn, activeActorId, currentActorCommandKind }));
  }

  function consumeBattleEventStep(step: BattleEventRuntimeResult): void {
    eventChoice = undefined;
    eventPause = undefined;
    if (step.kind === "pause") {
      eventPause = step.request;
      phase = "eventPause";
      return;
    }
    if (step.kind === "choice") {
      eventChoice = step.request;
      phase = "eventChoice";
      return;
    }
    eventChoice = undefined;
    if (step.kind === "terminated" && !result) {
      result = step.result;
      escaped = result === "escape";
      phase = "resolved";
      if (result === "defeat") clearEndOfBattleStates();
    }
    const continuation = afterBattleEvents;
    afterBattleEvents = undefined;
    continuation?.();
  }

  function resumeEventChoice(requestId: number, index: number): boolean {
    if (cancelled || result || !eventChoice) return false;
    const step = battleEvents.resumeChoice(requestId, index);
    if (!step) return false;
    consumeBattleEventStep(step);
    return true;
  }

  function resumeEventPause(requestId: number, response: BattleEventPauseResponse): boolean {
    if (cancelled || result || !eventPause) return false;
    const step = battleEvents.resumePause(requestId, response);
    if (!step) return false;
    consumeBattleEventStep(step);
    return true;
  }

  function cancel(): void {
    gimmicks.clear();
    if (cancelled) return;
    cancelled = true;
    battleEvents.cancel();
    eventChoice = undefined;
    eventPause = undefined;
    afterBattleEvents = undefined;
    strictResolution = undefined;
    strictActorCommands = [];
    strictPendingActorIds = [];
    activeActorId = undefined;
    targetSelection = undefined;
    phase = "resolved";
  }

  function revealEnemyTarget(target: string): void {
    if (target === "all") {
      for (const enemy of enemies) {
        if (!enemy.hidden) continue;
        enemy.hidden = false;
        enemy.gauge = 0;
        registerGen1Enemy(enemy);
      }
      return;
    }
    const enemy = enemies.find((entry) => entry.id === target || entry.recordId === target);
    if (!enemy?.hidden) return;
    enemy.hidden = false;
    enemy.gauge = 0;
    registerGen1Enemy(enemy);
  }

  function visibleEnemies(): readonly MutableBattler[] {
    if (options.project.system.battleModel !== "gen1") return enemies.filter((enemy) => !enemy.hidden);
    const active = enemies.find((enemy) => enemy.id === activeGen1EnemyId);
    return active && !active.hidden ? [active] : [];
  }

  function registerGen1Enemy(enemy: MutableBattler): void {
    if (options.project.system.battleModel !== "gen1") return;
    if (!gen1EnemyOrderIds.includes(enemy.id)) gen1EnemyOrderIds.push(enemy.id);
    if (!activeGen1EnemyId) activeGen1EnemyId = enemy.id;
  }

  function promoteNextGen1Enemy(): boolean {
    if (options.project.system.battleModel !== "gen1") return false;
    const current = enemies.find((enemy) => enemy.id === activeGen1EnemyId);
    if (current && current.hp > 0 && !current.hidden) return false;
    const next = gen1EnemyOrderIds
      .map((enemyId) => enemies.find((enemy) => enemy.id === enemyId))
      .find((enemy): enemy is MutableBattler => Boolean(enemy && enemy.hp > 0 && !enemy.hidden));
    if (!next) return false;
    activeGen1EnemyId = next.id;
    next.gauge = 0;
    recordTimeline({
      kind: "switch",
      side: "enemy",
      userRecordId: current?.recordId ?? next.recordId,
      targetId: next.id,
      commandKind: "switch",
      success: true,
    });
    return true;
  }

  function activeActors(): readonly MutableBattler[] {
    return activeActorIds.flatMap((actorId) => {
      const actor = actors.find((entry) => entry.recordId === actorId);
      return actor ? [actor] : [];
    });
  }

  function reserveActors(): readonly MutableBattler[] {
    const active = new Set(activeActorIds);
    return actors.filter((actor) => !active.has(actor.recordId));
  }

  function switchCandidateActors(): readonly MutableBattler[] {
    return reserveActors().filter((actor) => actor.hp > 0);
  }

  function forcedSwitchActor(): MutableBattler | undefined {
    if (switchCandidateActors().length === 0) return undefined;
    return activeActors().find((actor) => actor.hp <= 0);
  }

  function beginForcedSwitchIfNeeded(): boolean {
    const forced = forcedSwitchActor();
    if (!forced || result) return false;
    phase = "actorCommand";
    activeActorId = forced.recordId;
    targetSelection = undefined;
    currentActorCommandKind = undefined;
    return true;
  }

  function switchActiveActor(fromActorId: ActorId, targetActorId: ActorId): boolean {
    const slotIndex = activeActorIds.indexOf(fromActorId);
    if (slotIndex < 0) return false;
    const candidate = switchCandidateActors().find((actor) => actor.recordId === targetActorId);
    const outgoing = actors.find((actor) => actor.recordId === fromActorId);
    if (!candidate) return false;
    activeActorIds = activeActorIds.map((actorId, index) => (index === slotIndex ? candidate.recordId : actorId));
    if (outgoing) {
      outgoing.gauge = 0;
      outgoing.defending = false;
    }
    candidate.gauge = 0;
    candidate.defending = false;
    recordTimeline({
      kind: "switch",
      side: "actor",
      userRecordId: fromActorId,
      targetId: candidate.id,
      commandKind: "switch",
      success: true,
    });
    markActiveParticipants();
    return true;
  }

  function canSwitchActor(fromActorId: ActorId, targetActorId: ActorId): boolean {
    return activeActorIds.includes(fromActorId) && switchCandidateActors().some((actor) => actor.recordId === targetActorId);
  }

  function markActiveParticipants(): void {
    for (const actor of activeActors()) {
      participatingActorIds.add(actor.recordId);
      strictCurrentRoundParticipantIds.add(actor.recordId);
    }
  }

  function activeActorPosition(index: number): { readonly battleX: number; readonly battleY: number } {
    // RM2k3 side-view right column (must match battleBattlers actor slots).
    return { battleX: 252, battleY: 96 + index * 36 };
  }

  function resolveOutcome(): void {
    if (result) return;
    applyAutoRevives();
    resolveEnemyParts();
    dropDefeatedCharges();
    // Recoil and event effects can wipe out both sides in the same resolution.
    // Defeat must win before either the Gen1 or the ordinary victory path pays rewards.
    // 석화처럼 incapacitates 상태인 배우도 쓰러진 것으로 센다 — 전원이 그렇다면 패배.
    if (actors.every((actor) => actor.hp <= 0 || isBattlerIncapacitated(options.project, actor))) {
      result = "defeat";
      phase = "resolved";
      clearEndOfBattleStates();
      return;
    }
    if (options.project.system.battleModel === "gen1") {
      const current = enemies.find((enemy) => enemy.id === activeGen1EnemyId);
      if (!current || current.hp <= 0 || current.hidden) {
        if (promoteNextGen1Enemy()) return;
        if (gen1EnemyOrderIds.length > 0) {
          result = "victory";
          phase = "resolved";
          accumulateRewards();
          clearEndOfBattleStates();
          return;
        }
      }
    }
    const enemiesInBattle = visibleEnemies();
    // Captures hide defeated participants; they still establish that combat occurred.
    // With no visible enemies AND no captures, all members may be unrevealed: do not auto-win.
    if ((enemiesInBattle.length > 0 || capturedMonsters.length > 0) && enemiesInBattle.every((enemy) => enemy.hp <= 0)) {
      result = "victory";
      phase = "resolved";
      accumulateRewards();
      clearEndOfBattleStates();
      return;
    }
  }

  function clearEndOfBattleStates(): void {
    for (const battler of [...actors, ...enemies]) {
      const before = new Set(battler.stateIds);
      clearBattleEndStates(options.project, battler);
      for (const stateId of before) {
        if (!battler.stateIds.includes(stateId)) {
          recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "battleEnd" });
        }
      }
    }
  }

  function accumulateRewards(): void {
    const rawCollected = collectBattleRewards(options.project, enemies, rng, Math.max(1, rewardTurn), battleEventState.switches);
    const collected = {
      ...rawCollected,
      exp: scaleByDifficulty(rawCollected.exp, difficultyRate(options.project.system, sessionState, "expRate")),
      gold: scaleByDifficulty(rawCollected.gold, difficultyRate(options.project.system, sessionState, "goldRate")),
    };
    rewards.exp = collected.exp;
    rewards.gold = collected.gold;
    rewards.enemyLevel = collected.enemyLevel;
    rewards.items = [...collected.items];
    rewards.levelUps = usePartyMonsters ? [] : computeLevelUpPreview(collected.exp, collected.enemyLevel);
    rewards.monsterLevelUps = computeMonsterLevelUpPreview(collected.exp);
    if (collected.tp && !usePartyMonsters) {
      rewards.tp = collected.tp;
      const techLearned = computeTechLearnedPreview(collected.tp, rewards.levelUps);
      if (techLearned.length > 0) rewards.techLearned = techLearned;
    }
  }

  // TP 습득 미리보기 — 세션 적립(applyBattleRewardsToSession)과 같은 대상(살아남은 보상 대상)·같은 함수.
  function computeTechLearnedPreview(earnedTp: number, levelUps: readonly BattleLevelUpResult[]) {
    const learned: { actorId: string; actorName: string; skillIds: SkillId[] }[] = [];
    const actorIds = rewardActorIds(options.project, battleEventState.partyActorIds ?? actors.map((actor) => actor.recordId), [...participatingActorIds]);
    for (const actorId of new Set(actorIds)) {
      const battler = actors.find((entry) => entry.recordId === actorId);
      if (!battler || battler.hp <= 0) continue;
      const levelUp = levelUps.find((entry) => entry.actorId === actorId);
      const level = levelUp?.toLevel ?? battleEventState.actorLevels?.[actorId] ?? battler.level ?? 1;
      const totalTp = (sessionState.actorTechPoints?.[actorId] ?? 0) + earnedTp;
      const known = [...battler.skillIds, ...(levelUp?.learnedSkillIds ?? [])];
      const skillIds = computeTechPointLearning(options.project, actorId, level, totalTp, known);
      if (skillIds.length > 0) learned.push({ actorId, actorName: battler.name, skillIds });
    }
    return learned;
  }

  // 몬스터 배틀은 실제 보상과 같은 참가자 원장을 쓰고, 일반 액터 배틀은 동행 몬스터 전원을 미리 본다.
  // reserveActors는 몬스터 배틀의 결과/교대 표시용 스냅샷일 뿐, 참전 전에는 보상 대상이 아니다.
  function computeMonsterLevelUpPreview(earnedExp: number): MonsterLevelUpPreview[] {
    const instances = options.partyMonsters ?? [];
    if (instances.length === 0) return [];
    const participantIds = usePartyMonsters ? [...participatingActorIds] : undefined;
    return previewMonsterExperience(options.project, instances, earnedExp, participantIds);
  }

  // Preview the same final battle authority that reward write-back applies.
  // 실제 세션 적립/성장은 battleRewardsToSession 이 담당하며 동일 로직으로 일치한다.
  function computeLevelUpPreview(earnedExp: number, enemyLevel: number | undefined): BattleLevelUpResult[] {
    const results: BattleLevelUpResult[] = [];
    const seen = new Set<string>();
    const actorIds = rewardActorIds(options.project, battleEventState.partyActorIds ?? actors.map((actor) => actor.recordId), [...participatingActorIds]);
    for (const actorId of actorIds) {
      if (seen.has(actorId)) continue;
      seen.add(actorId);
      const level = battleEventState.actorLevels?.[actorId] ?? 1;
      const adjustedExp = expForRewardActor(earnedExp, level, enemyLevel, options.project.system.rewardPolicy);
      const totalExp = (battleEventState.actorExperience?.[actorId] ?? 0) + adjustedExp;
      const result = computeActorLevelUp(options.project, actorId, level, totalExp, { classOverrides: battleEventState.classOverrides });
      if (result) results.push(result);
    }
    return results;
  }

  function chooseAutoCommand(): ActorCommand | undefined {
    return chooseAutoBattleCommand(options.project, snapshot(), rng);
  }

  if (battleFlow === "strict") startStrictRound();

  return {
    resumeEventChoice,
    resumeEventPause,
    cancel,
    tick,
    beginActorCommand,
    selectTarget,
    setSelectedTarget,
    selectTargetEnemy,
    setSelectedTargetEnemy,
    cancelTargetSelection,
    performActorCommand,
    chooseAutoCommand,
    executeEquipmentUse,
    snapshot,
  };
}

// targetEnemyId remains populated as a compatibility alias for saved scripts/API callers.
export function concreteTargetCommand(
  command: TargetedActorCommand,
  targetId: string,
  side: "actor" | "enemy" = "enemy",
): ActorCommand {
  switch (command.kind) {
    case "attack":
      return { kind: "attack", targetEnemyId: targetId };
    case "skill":
      return { kind: "skill", skillId: command.skillId, targetEnemyId: targetId, ...(side === "actor" ? { targetActorId: targetId as ActorId } : {}), ...(command.inputResult ? { inputResult: command.inputResult } : {}) };
    case "item":
      return { kind: "item", itemId: command.itemId, targetEnemyId: targetId, ...(side === "actor" ? { targetActorId: targetId as ActorId } : {}) };
    case "capture":
      return { kind: "capture", captureItemId: command.captureItemId, targetEnemyId: targetId };
  }
}

function findProjectEvent(project: BattleRuntimeOptions["project"], eventId: string | undefined) {
  if (!eventId) return undefined;
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return event;
  }
  return undefined;
}

function normalizeActiveSlots(value: number | undefined, partySize: number): number {
  if (partySize <= 0) return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) return partySize;
  return Math.max(1, Math.min(partySize, Math.trunc(value)));
}
