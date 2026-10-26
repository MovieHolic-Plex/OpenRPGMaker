import { BattleGimmickLedger, type BattleGimmick, type GimmickStatus } from "@/battle/battleGimmickRules";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { formationDamage, formationStartRow, rollBattleFormation, type BattleRow, type BattleStartFormation } from "@/battle/battleFormation";
import { applyDifficultyToEnemyBattlers, difficultyRate, scaleByDifficulty } from "@/project/difficulty";
import { applySkillLoadoutsToBattlers } from "@/project/skillLoadout";
import { evaluateDamageFormula, formulaBattlerContext } from "@/battle/damageFormula";
import { fixedDamageAmount, recoilDamageFor, rollMultiHitCount } from "@/project/skillBattleRules";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { combatConditionMet } from "@/battle/combatConditions";
import { advanceBattleSkillCooldowns, startBattleSkillCooldown } from "@/battle/battleSkillUse";
import { damageEffectKind, firstLearnableSkill, pickRandomSkill, rageActionSkillIds, rollStealItem, scanMessage, shuffled, sketchableSkills, weaknessElementNames } from "@/battle/battleSpecialEffects";
import { permanentActorSkillIds } from "@/project/growth/runtime";
import { inputSequencePowerMultiplier } from "@/battle/battleInputSequence";
import { battleEffectivenessMultiplier, battleElementMultiplier, damageTypeMultiplier } from "@/battle/battleElementModifiers";
import { effectivenessParts, recordWeaknessDiscovery, type EffectivenessPart, type KnownWeaknesses } from "@/battle/weaknessDiscovery";
import { restoreSkillDrain, spendSkillHp } from "@/battle/battleSkillVitals";
import { effectiveActorClassId } from '@/project/sessionClass';
import { battleTroopError } from '@/project/battleAdmission';
import { activeItemEffects, isCaptureTool, itemAllowsBattle } from "@/project/itemUsage";
// SIZE_OK: Battle runtime keeps turn state, troop-event callbacks, and snapshot
// assembly together so battle-event regressions can verify one state machine.
import type { ActorId, ActorInitialEquipment, EnemyId, ItemId, ItemRecord, Project, SkillId, SkillRecord } from "@/project/types";
import { startStateOf } from "@/project/session";
import { transitionItemState } from "@/project/itemTransitions";
import { isBattleItemUserEligible } from "@/battle/battleItemEligibility";
import { DEFAULT_ANIMATION_ID, DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import { withJosa } from "@/util/josa";
import { currentObedienceCap, obedienceRefusalLine } from "@/project/badgeProgress";
import { captureConditionLine, captureConditionMultiplier } from "@/battle/captureBalls";
import { applyStatStage, scaleByStage, shiftStatStage, statStageMessage, statStageOf } from "@/battle/statStages";
import {
  type BattleWeatherState,
  WEATHER_CONTINUE_LINES,
  WEATHER_END_LINES,
  WEATHER_START_LINES,
  SKILL_WEATHER_DEFAULT_TURNS,
  weatherDamagePercent,
  weatherResidualDamage,
  weatherResidualLine,
} from "@/battle/weather";
import {
  abilityBlocksStatus,
  abilityContactStatus,
  abilityDamagePercent,
  abilityDefensePercent,
  abilityEndureDamage,
  abilityOffensePercent,
  abilityOfBattler,
  abilityTypeImmunity,
  scaleDamageByPercent,
} from "@/battle/abilities";
import {
  heldBoostPercent,
  heldCuresStatus,
  heldEffectOfItem,
  heldEndureDamage,
  heldHealAmount,
  heldRegenAmount,
} from "@/battle/heldItems";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { actorBattlers, average, battlerSnapshot, enemyBattlers, monsterPartyBattlers, moveBattler, refreshActorBattlerDerivedStats, type MutableBattler } from "@/battle/battleBattlers";
import {
  accuracyByteFromPercent,
  scaledGen1Accuracy,
  applySkillLike,
  createGen1ByteRng,
  resolveGen1DamagingMove,
  usesGen1Damage,
  usesMagicalDefense,
} from "@/battle/battleDamage";
import { createBattleEventRuntime, type BattleEventRuntimeResult, type BattleEventRuntimeState } from "@/battle/battleEvents";
import { collectBattleRewards } from "@/battle/battleRewards";
import { computeActorLevelUp, computeTechPointLearning } from "@/battle/battleLevelUp";
import { computeApLearning } from "@/battle/battleEsperAp";
import { battlerTypes, gen1CanonicalTypeForId, gen1ElementIdForCanonical, gen1TypeModifiersForTypes } from "@/battle/typeChart";
import type { BattleLevelUpResult } from "@/battle/battleLevelUp";
import { expForRewardActor, monsterExpPlan, rewardActorIds } from "@/battle/rewardPolicy";
import { captureItemMultiplier, captureStatusMultiplier, captureSuccessRate, monsterSpeciesForEnemy, previewMonsterExperience, rollMonsterIvs, type MonsterLevelUpPreview } from "@/project/monsterCollection";
import { monsterEvYieldOf, monsterStatRulesOf } from "@/project/monsterStatRules";
import type { MonsterInstanceEvs } from "@/project/session";
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
  invertsHealingForStates,
  grantedSkillIdsForStates,
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
  TeamSwapCommand,
  BattleActionResultSnapshot,
  BattleAnimationSnapshot,
  BattleTeamSnapshot,
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
import { battleActorSkillFailure, battleSkillMpCostFor, battleSkillPartyGaugeCost, battleSkillUseFailure, battlerSkillIdsWithGrants, comboActorIdsOf, comboLockedBy, consumeBattleSkillResource, type BattleComboParticipant } from "@/battle/battleSkillUse";
import { applyBattleHitGauges, clampPartyGauge, initialPartyGauge, seedBattleGauges } from "@/battle/battleGauges";
import { applyStateEffectsWithEmotion, createWeaknessTracker, emotionDamageMultiplier } from "@/battle/battleEmotion";
import {
  areaTargets,
  requestedTargetId,
  resolveBattleTargets,
  skillRevivesDefeatedAllies,
  targetIdFor,
  targetScopeForCommand,
  type BattleTargetScope,
} from "@/battle/battleTargetResolver";
import { actorAutoTactic, actorFightsAutomatically, chooseAutoBattleCommand } from "@/battle/battleAuto";
import { predictSkillDamage } from "@/battle/battlePredict";
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { orderGen1TurnActions, type Gen1TurnOrderEntry } from "@/battle/battleStrictOrder";
import { attemptGen1Capture } from "@/battle/gen1/capture";
import { effectiveTeamSwapCost, resolveBattleTeams } from "@/battle/battleTeams";
import type { ActorAutoTactic, TeamSwapCost } from "@/project/types";
import type { TroopBattleGuest } from "@/project/types/database";
import { restoredMovePp } from "@/project/monsterMedicine";
import {
  applyGen1MajorStatus,
  applyGen1PostActionResidual,
  gen1ConfusionSelfDamage,
  gen1ConfusionTurns,
  gen1NextToxicCounter,
  stepGen1Confusion,
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

const RAGE_STATE_ID = "state_rage";

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
  // 스킨별 ATB 가속(청람·세피아·먹빛·코발트 창)은 2026-10-02 그 스킨들과 함께 지웠다 — 속도는 atbSpeed 하나가 정한다.
  const skinHasteMultiplier = atbSpeedMultiplier(options.project.system.atbSpeed);
  // Active ATB: gauge 흐름에서만 의미가 있다. strict 는 라운드제라 메뉴가 시간을 멈추지 않는다.
  const activeAtb = battleFlow === "gauge" && (options.atbMode ?? options.project.system.atbMode) === "active";

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
  // 약점 발견 장부 — 세션이 준 객체에 직접 적는다(playSceneBattle 이 session.knownWeaknesses 를 넘긴다). 없으면 이 전투만의 장부.
  const knownWeaknesses: KnownWeaknesses = (sessionState.knownWeaknesses as KnownWeaknesses | undefined) ?? {};
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
  const actorBattlerInputs = {
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
      };
  const actors = usePartyMonsters
    ? monsterPartyBattlers(options.project, options.partyMonsters ?? [])
    : actorBattlers(options.project, { ...actorBattlerInputs, partyActorIds: options.party?.partyActorIds });
  if (!usePartyMonsters) applySkillLoadoutsToBattlers(options.project, actors, sessionState.actorSkillLoadouts);
  const enemies = enemyBattlers(options.project, troopRecord, options.enemyLevel !== undefined ? { wildLevel: options.enemyLevel } : undefined);
  // 리미트·기력·파티 게이지(battleGauges). 끈 프로젝트는 필드를 만들지 않는다.
  seedBattleGauges(options.project, actors);
  let partyGauge = initialPartyGauge(options.project);
  const weakness = createWeaknessTracker(options.project);
  applyDifficultyToEnemyBattlers(options.project.system, sessionState, enemies);
  // 몬스터 트레이너 전(포켓몬 화면, 상대 몬스터 여럿, 1대1)은 gen1 처럼 한 마리씩 내보낸다.
  // 한꺼번에 세우면 HP 상자 둘·겹친 그림·두 마리가 다 공격하는 RPG 전투가 된다(2026-10-07 사용자 지적).
  const singleFileEnemies = gen1 || (options.project.system.battleUiStyle === "pokemon"
    && (troopRecord.activeSlots ?? 1) <= 1
    && enemies.filter((enemy) => !enemy.hidden).length > 1
    && enemies.every((enemy) => Boolean(enemy.speciesId)));
  const gen1EnemyOrderIds = singleFileEnemies
    ? enemies.filter((enemy) => !enemy.hidden).map((enemy) => enemy.id)
    : [];
  let activeGen1EnemyId = gen1EnemyOrderIds[0];
  const requestedActiveSlots = options.activeSlots
    ?? troopRecord.activeSlots
    ?? options.project.system.activeSlots
    ?? (gen1 ? 1 : undefined);
  const activeSlots = normalizeActiveSlots(requestedActiveSlots, actors.length);
  // 팀 교대 전투(system.battleTeams, 구성원 있는 팀 2개 이상일 때만). 한 번에 한 팀만 싸운다 — 교대 묶음.
  const battleTeams = !gen1 && !usePartyMonsters
    ? resolveBattleTeams(options.project.system.battleTeams, actors.map((actor) => actor.recordId))
    : undefined;
  const teamSwapCost = effectiveTeamSwapCost(options.project.system, troopRecord);
  let activeTeamId: string | undefined = battleTeams?.find((team) => team.actorIds.includes(actors[0]?.recordId as ActorId))?.id ?? battleTeams?.[0]?.id;
  // 한 턴 비용으로 들어온 팀은 적이 한 번 행동할 때까지 쉰다(게이지가 차지 않는다).
  const teamResting = new Set<string>();
  /** 연계 대기 중인 배우(게이지 100 유지·충전 제외). 아군 누군가의 차례가 오면 풀려 resumedFromHold 로 옮긴다. */
  const heldForCombo = new Set<string>();
  /** 전투 중 합류한 트룹 손님(recordId → 작전). 손님은 배우 DB 의 autoBattle 과 상관없이 자동으로 싸운다. */
  const guestTactics = new Map<string, ActorAutoTactic | undefined>();
  /** 연계 대기에서 풀려 다시 차례를 받는 배우 — 차례 시작 처리(지속 피해·턴 수)를 두 번 받지 않는다. */
  const resumedFromHold = new Set<string>();
  let activeActorIds: ActorId[] = battleTeams
    ? (battleTeams.find((team) => team.id === activeTeamId)?.actorIds ?? []).slice(0, activeSlots)
    : actors.slice(0, activeSlots).map((actor) => actor.recordId);
  // 전투 개시 진형: 명시(명령·심볼 접촉) > 시스템 굴림 > 보통. 굴림이 꺼져 있으면 rng 를 쓰지 않아 기존 시드 흐름이 그대로다.
  const formation: BattleStartFormation = options.formation
    ?? (options.project.system.battleFormationRoll === true && !gen1
      ? rollBattleFormation({
          partyAgility: average(activeActors().filter((actor) => actor.hp > 0).map((actor) => actor.agility)),
          enemyAgility: average(enemies.filter((enemy) => !enemy.hidden && enemy.hp > 0).map((enemy) => enemy.agility)),
          preemptiveEquipment: activeActors().some((actor) => actorHasPreemptiveEquipment(actor.recordId)),
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
  // 힘 모으기 장부(SkillRecord.chargeTurns). recordTimeline 이 충전 끊기(chargeBreak)를 판정하므로 그보다 먼저 선언한다.
  // damageTaken = 모으는 동안 받은 HP 피해 누계.
  const pendingCharges = new Map<string, { readonly skillId: SkillId; turnsLeft: number; damageTaken: number; readonly command?: ActorCommand; readonly action?: EnemyActionChoice }>();
  // 끊긴 힘 모으기의 줄. 타격 엔트리 사이에 끼우면 연출 묶음(같은 actionId)을 깨므로, 다음 명령이 시작되거나 스냅숏을 뜰 때 제 actionId 로 내보낸다.
  const pendingChargeBreakLines: Omit<BattleTimelineEntrySnapshot, "sequence">[] = [];
  // 충전이 끊겨 다음 자기 차례 하나를 쉬는 배틀러(SkillChargeBreak.stagger).
  const chargeStaggeredIds = new Set<string>();
  function flushChargeBreaks(): void {
    if (pendingChargeBreakLines.length === 0) return;
    const resumeActionId = currentActionId;
    for (const line of pendingChargeBreakLines.splice(0)) {
      flushHitWakes();
      actionCounter += 1;
      currentActionId = actionCounter;
      recordTimeline(line);
    }
    currentActionId = resumeActionId;
  }
  /** 충전 끊기(SkillRecord.chargeBreak): 모으는 중인 배틀러가 맞은 피해·속성·상태를 규칙과 견준다. */
  function noteChargeBreak(entry: Omit<BattleTimelineEntrySnapshot, "sequence">): void {
    if (!entry.targetId || entry.aside) return;
    const pending = pendingCharges.get(entry.targetId);
    if (!pending) return;
    const rule = lookupSkill(pending.skillId)?.chargeBreak;
    if (!rule) return;
    let broken = false;
    if (entry.kind === "damage" && entry.hit !== false && (entry.resource ?? "hp") === "hp") {
      pending.damageTaken += Math.max(0, entry.amount ?? 0);
      if (rule.damage && rule.damage > 0 && pending.damageTaken >= rule.damage) broken = true;
      const elementId = entry.skillId ? lookupSkill(entry.skillId)?.elementId : undefined;
      if (elementId && rule.elementIds?.includes(elementId)) broken = true;
    } else if (entry.kind === "stateAdded" && entry.stateId && rule.stateIds?.includes(entry.stateId)) {
      broken = true;
    }
    if (!broken) return;
    pendingCharges.delete(entry.targetId);
    const battler = [...actors, ...enemies].find((row) => row.id === entry.targetId);
    if (!battler) return;
    // 휘청거림은 적만 — 아군은 명령을 고른 뒤에 차례를 빼앗으면 고른 명령이 말없이 사라진다.
    if (rule.stagger !== false && battlerSide(battler) === "enemy") chargeStaggeredIds.add(battler.id);
    const skillName = lookupSkill(pending.skillId)?.name ?? "기술";
    const line = rule.message?.trim();
    pendingChargeBreakLines.push({
      kind: "special", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id,
      charge: true, chargeBroken: true, chargeSkillId: pending.skillId,
      message: `${withJosa(battler.name, "이/가")} 모으던 ${withJosa(skillName, "이/가")} 끊겼다!`,
      ...(line ? { chargeBreakLine: line } : {}),
    });
  }
  /** 충전이 끊겨 휘청거리는 차례면 그 줄을 남기고 true(차례를 쓴다). */
  function consumeChargeStagger(battler: MutableBattler): boolean {
    if (!chargeStaggeredIds.delete(battler.id)) return false;
    beginTimelineAction();
    recordTimeline({ kind: "special", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id, charge: true, message: `${withJosa(battler.name, "은/는")} 힘이 끊겨 휘청거린다!` });
    return true;
  }
  function beginTimelineAction(): void {
    flushHitWakes();
    flushChargeBreaks();
    actionCounter += 1;
    currentActionId = actionCounter;
  }
  // 맞아서 깬 상태(수면 등)는 그 타격 엔트리 바로 「뒤」에 기록한다 — 판정은 피해 기록 전에 일어나서
  // 「숲늑대의 수면이 풀렸다」가 「카엘의 공격!」보다 먼저 떴다(2026-10-24 실측). 같은 대상의 피해 엔트리가 오면 그 뒤에,
  // 다른 기록이 먼저 오거나 명령이 바뀌거나 스냅숏을 뜨면 그 앞에 내보낸다.
  const pendingHitWakes: Omit<BattleTimelineEntrySnapshot, "sequence">[] = [];
  function flushHitWakes(): void {
    for (const wake of pendingHitWakes.splice(0)) timeline.push({ ...wake, sequence: timeline.length });
  }
  function recordTimeline(entry: Omit<BattleTimelineEntrySnapshot, "sequence">): void {
    const stamped = currentActionId !== undefined && entry.actionId === undefined ? { ...entry, actionId: currentActionId } : entry;
    const strikesWoken = (stamped.kind === "damage" || stamped.kind === "miss")
      && pendingHitWakes.length > 0 && pendingHitWakes.every((wake) => wake.targetId === stamped.targetId);
    if (!strikesWoken) flushHitWakes();
    timeline.push({ ...stamped, sequence: timeline.length });
    if (strikesWoken) flushHitWakes();
    noteChargeBreak(stamped);
  }
  /** 방금 기록된 타임라인 엔트리에 애니메이션을 붙인다. 스킬/아이템 실행부가
   *  recordAction 직후 lastAnimation 을 세팅하므로, 그 시점에 호출해 엔트리와 짝을 맞춘다. */
  function attachAnimationToLatestTimeline(animation: BattleAnimationSnapshot): void {
    // 타격 뒤에 붙은 「맞아서 깸」 엔트리는 건너뛴다 — 애니메이션은 그 타격의 것이다.
    let at = timeline.length - 1;
    while (at > 0 && timeline[at]!.kind === "stateRemoved" && timeline[at]!.reason === "hit") at -= 1;
    const latest = timeline[at];
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
      ...(() => { const combo = comboActorIdsOf(entry.skillId ? lookupSkill(entry.skillId) : undefined); return combo ? { comboActorIds: [...combo] } : {}; })(),
      ...(entry.effectiveness !== undefined && kind === "damage" ? { effectiveness: entry.effectiveness } : {}),
      ...(entry.weaponAffinity ? { weaponAffinity: true } : {}),
      ...(entry.exploit ? { exploit: true } : {}),
      ...(kind === "damage" && entry.effectivenessParts && noteWeaknessDiscovery(entry) ? { weaknessDiscovered: true } : {}),
      ...(resource ? { resource } : {}),
    });
  }
  /** 아군이 적을 처음 약점·저항으로 맞힌 타격이면 세션 knownWeaknesses 에 적고 true. */
  function noteWeaknessDiscovery(entry: BattleActionResultSnapshot): boolean {
    if (!actors.some((actor) => actor.recordId === entry.userRecordId || actor.id === entry.userRecordId)) return false;
    const enemy = enemies.find((row) => row.id === entry.targetId);
    if (!enemy) return false;
    return recordWeaknessDiscovery(knownWeaknesses, enemy.recordId, entry.effectivenessParts ?? []);
  }
  let result: BattleResult | undefined;
  let cancelled = false;
  let eventChoice: BattleEventChoiceSnapshot | undefined;
  let eventPause: BattleEventPauseSnapshot | undefined;
  let afterBattleEvents: (() => void) | undefined;
  /** 풀죽음(SkillRecord.flinchChance)으로 이번 라운드 자기 차례를 잃은 배틀러 id. 라운드가 끝나면 비운다(저장 안 함). */
  const flinchedBattlerIds = new Set<string>();
  let strictResolution: { readonly round: number; readonly actions: StrictQueuedAction[]; index: number; grantedExtraActions: number } | undefined;
  let drainingStrictActions = false;
  let escaped = false;
  // turn 의 의미를 두 플로우에서 통일한다: **완료된 행동 사이클 수**.
  // strict 는 라운드 완료 시 +1. gauge 에서는 생존 배틀러 전원이 한 번씩 행동(또는
  // 행동 불가로 스킵)할 때마다 사이클이 닫히며 +1 — 예전에는 적 행동 1회마다 +1 이라
  // 트룹 이벤트의 turn/everyRound 조건과 적 행동 패턴(turn)이 모델마다 다른 케이던스로
  // 발화했다(적대 리뷰: 적 3체 기준 gauge 의 "3턴"은 사실상 1라운드였다).
  let turn = 0;
  // 파티가 확정해 실행한 명령 수. 플레이어가 세는 「턴」의 정본이다 — gauge 의 turn 은 생존 배틀러
  // 전원이 한 번씩 행동해야 닫히므로, 적 게이지가 느리면 한 사이클에 파티가 여러 번 명령한다.
  // 실측(2026-10-23, scarloxy-demo): 7행동·15줄짜리 도주 전투와 2회 공격 승리 전투가 모두 turn 1 이었다.
  let partyCommandRounds = 0;
  /** 전투 날씨(쾌청·비·모래바람·싸라기눈). 기술이 켜고 차례 말에 줄어든다. 저장하지 않는다. */
  let weather: BattleWeatherState | undefined;
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
    monsterExp?: number;
    gold: number;
    items: ItemId[];
    enemyLevel?: number;
    levelUps: BattleLevelUpResult[];
    monsterLevelUps: MonsterLevelUpPreview[];
    monsterEvGain?: Partial<MonsterInstanceEvs>;
    tp?: number;
    ap?: number;
    rageEnemyIds?: string[];
    techLearned?: { actorId: string; actorName: string; skillIds: SkillId[]; viaAp?: SkillId[] }[];
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
    joinBattleGuest,
  });
  markActiveParticipants();

  /**
   * 트룹 손님(TroopRecord.battleGuests) 합류. 이 전투의 배틀러 목록·전열에만 넣는다 — 파티 명단(partyActorIds)에는
   * 넣지 않으므로 전투가 끝나면 저절로 빠지고 경험치·전리품 몫(rewardActorIds)도 없다. 손님은 늘 작전대로 자동으로 싸운다.
   * 세션의 상처(vitals)·상태는 물려받지 않는다(가득 찬 몸으로 들어온다). 몬스터 파티·gen1·팀 교대 전투는 받지 않는다.
   */
  function joinBattleGuest(guest: TroopBattleGuest): string | undefined {
    if (gen1 || usePartyMonsters || battleTeams || result) return undefined;
    if (actors.some((actor) => actor.recordId === guest.actorId)) return undefined;
    if (!options.project.database.actors.some((record) => record.id === guest.actorId)) return undefined;
    const [battler] = actorBattlers(options.project, { ...actorBattlerInputs, vitals: undefined, stateIds: undefined, partyActorIds: [guest.actorId] });
    if (!battler) return undefined;
    applySkillLoadoutsToBattlers(options.project, [battler], sessionState.actorSkillLoadouts);
    seedBattleGauges(options.project, [battler]);
    battler.gauge = 0;
    actors.push(battler);
    activeActorIds = [...activeActorIds, battler.recordId as ActorId];
    guestTactics.set(battler.recordId, guest.tactic);
    return battler.name;
  }

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
    // 그 타격에 쓰러졌으면 깸을 말하지 않는다 — 「쓰러뜨렸다!」 뒤 「수면이 풀렸다」가 붙었다.
    if (battler.hp > 0) for (const stateId of removed) {
      pendingHitWakes.push({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "hit", ...(currentActionId !== undefined ? { actionId: currentActionId } : {}) });
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
      ...(state.volatileStatus ? { volatileStatus: state.volatileStatus } : {}),
      ...(state.gen1MajorStatus === "freeze" && state.recoverNaturallyChance ? { thawChance: state.recoverNaturallyChance } : {}),
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

      if (stateRecord?.volatileStatus === "confusion") {
        // 혼란: 주요 상태와 따로 걸린다. 이미 혼란이면 다시 걸리지 않는다. 남는 행동 수는 바이트 하나(2~5).
        if (gen1ConfusionActive(target)) continue;
        target.stateIds = [...target.stateIds, effect.stateId];
        target.stateTurns[effect.stateId] = gen1ConfusionTurns(nextGen1Byte);
      } else if (stateRecord?.gen1MajorStatus) {
        const guard = abilityOfBattler(options.project, target);
        if (guard && abilityBlocksStatus(guard, stateRecord.gen1MajorStatus)) {
          recordSpecial(user, target, `${withJosa(target.name, "은/는")} 특성 ${guard.name} 덕분에 ${stateName(effect.stateId)} 상태에 걸리지 않는다!`);
          continue;
        }
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

  function gen1ConfusionStateId(battler: MutableBattler): string | undefined {
    return battler.stateIds.find((stateId) => options.project.database.states.find((state) => state.id === stateId)?.volatileStatus === "confusion");
  }

  function gen1ConfusionActive(battler: MutableBattler): boolean {
    return gen1ConfusionStateId(battler) !== undefined;
  }

  /** 행동 직전 혼란 판정. 자신을 때리면 true(이번 행동을 잃는다). */
  function stepGen1ConfusionBeforeAction(battler: MutableBattler): boolean {
    const stateId = gen1ConfusionStateId(battler);
    if (!stateId) return false;
    const step = stepGen1Confusion(battler.stateTurns[stateId] ?? 0, nextGen1Byte);
    if (step.outcome === "snappedOut") {
      battler.stateIds = battler.stateIds.filter((id) => id !== stateId);
      delete battler.stateTurns[stateId];
      recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "natural" });
      return false;
    }
    battler.stateTurns[stateId] = step.turnsLeft;
    if (step.outcome !== "selfHit") return false;
    const damage = Math.min(battler.hp, gen1ConfusionSelfDamage(
      battler.level ?? 1,
      gen1ModifiedStat(battler, "attack", battler.attackPower),
      gen1ModifiedStat(battler, "defense", battler.defense),
    ));
    battler.hp -= damage;
    recordTimeline({
      kind: "stateUpkeep", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id, amount: damage, stateId,
      message: `${withJosa(battler.name, "은/는")} 혼란에 빠져 자신을 공격했다!`,
    });
    return true;
  }

  function gen1MajorStatusOf(battler: MutableBattler) {
    return readGen1MajorStatus(battler.stateIds, battler.stateTurns, gen1StateRecords());
  }

  function prepareGen1CombatAction(battler: MutableBattler): boolean {
    if (flinchedBattlerIds.delete(battler.id)) {
      recordTimeline({ kind: "incapacitated", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id, flinch: true });
      if (gen1) applyGen1Residual(battler);
      return false;
    }
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
    if (!stepped.canAct) {
      recordIncapacitated(battler);
      applyGen1Residual(battler);
      return false;
    }
    if (stepGen1ConfusionBeforeAction(battler)) {
      applyGen1Residual(battler);
      return false;
    }
    if (monsterRefusesOrders(battler)) {
      // 원작식 복종: 배지 수에 비해 레벨이 높은 내 몬스터는 기술 명령을 무시한다(아이템·교체·도망·포획은 이 경로를 타지 않는다).
      recordSpecial(battler, battler, obedienceRefusalLine(options.project.system.monsterCampaign?.obedienceLevelCaps, battler.name, turn));
      applyGen1Residual(battler);
      return false;
    }
    return true;
  }

  /** obedienceLevelCaps 가 켜져 있고 이 파티 몬스터의 레벨이 현재 배지 수의 상한을 넘었는가(기본 꺼짐 = 항상 false). */
  function monsterRefusesOrders(battler: MutableBattler): boolean {
    if (battlerSide(battler) !== "actor" || !battler.monsterInstanceId) return false;
    const cap = currentObedienceCap(options.project, sessionState.switches);
    return cap !== undefined && (battler.level ?? 1) > cap;
  }

  function applyGen1Residual(battler: MutableBattler): void {
    if (!gen1 || battler.hp <= 0) return;
    const status = gen1MajorStatusOf(battler);
    // 맹독: 차례 말마다 카운터가 올라 1/16 × 카운터씩 깎인다(교체하면 처음부터).
    const toxicCounter = status?.kind === "toxic" ? gen1NextToxicCounter(battler.stateTurns[status.stateId]) : undefined;
    if (status && toxicCounter !== undefined) battler.stateTurns[status.stateId] = toxicCounter;
    const residual = applyGen1PostActionResidual({
      kind: status?.kind,
      maxHp: battler.maxHp,
      currentHp: battler.hp,
      toxicCounter,
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
    applyHeldRegen(battler);
    triggerHeldItem(battler);
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

  /** 기술 결과 뒤에 흘리는 지닌 도구 줄(버티기). */
  const heldNotes: { message: string }[] = [];

  function consumeHeldItem(battler: MutableBattler): void {
    delete battler.heldItemId;
  }

  function flushHeldNotes(user: MutableBattler, target: MutableBattler): void {
    while (heldNotes.length > 0) recordSpecial(user, target, heldNotes.shift()!.message);
  }

  /**
   * 지닌 도구가 발동할 차례인지 본다: 열매(HP 가 문턱 이하면 회복, 주요 상태가 맞으면 치료). 쓰면 사라진다.
   * 기술 하나가 끝난 뒤와 차례 말 잔여 피해 뒤에 부른다.
   */
  function triggerHeldItem(holder: MutableBattler): void {
    if (!gen1 || holder.hp <= 0 || !holder.heldItemId) return;
    const item = options.project.database.items.find((record) => record.id === holder.heldItemId);
    const effect = item?.heldEffect;
    if (!item || !effect) return;
    const heal = heldHealAmount(effect, holder.hp, holder.maxHp);
    if (heal > 0) {
      consumeHeldItem(holder);
      holder.hp = Math.min(holder.maxHp, holder.hp + heal);
      recordSpecial(holder, holder, `${withJosa(holder.name, "은/는")} ${withJosa(item.name, "을/를")} 먹고 체력을 회복했다!`);
      recordTimeline({ kind: "healing", side: battlerSide(holder), userRecordId: holder.recordId, targetId: holder.id, hit: true, amount: heal, critical: false, resource: "hp", aside: "drain" });
      return;
    }
    const status = gen1MajorStatusOf(holder);
    if (status && heldCuresStatus(effect, status.kind)) {
      consumeHeldItem(holder);
      holder.stateIds = holder.stateIds.filter((stateId) => stateId !== status.stateId);
      delete holder.stateTurns[status.stateId];
      recordSpecial(holder, holder, `${withJosa(holder.name, "은/는")} ${withJosa(item.name, "을/를")} 먹고 상태이상이 나았다!`);
      recordTimeline({ kind: "stateRemoved", side: battlerSide(holder), targetId: holder.id, stateId: status.stateId, reason: "effect" });
    }
  }

  /** 매 차례 회복 도구(먹다 남은 음식 같은): 차례 말 잔여 피해 뒤에 조금씩 회복한다. 사라지지 않는다. */
  function applyHeldRegen(holder: MutableBattler): void {
    if (!gen1 || holder.hp <= 0 || !holder.heldItemId) return;
    const effect = heldEffectOfItem(options.project, holder.heldItemId);
    const heal = heldRegenAmount(effect, holder.hp, holder.maxHp);
    if (heal <= 0) return;
    const name = options.project.database.items.find((record) => record.id === holder.heldItemId)?.name ?? "도구";
    holder.hp += heal;
    recordSpecial(holder, holder, `${withJosa(holder.name, "은/는")} ${name} 덕분에 체력을 회복했다!`);
    recordTimeline({ kind: "healing", side: battlerSide(holder), userRecordId: holder.recordId, targetId: holder.id, hit: true, amount: heal, critical: false, resource: "hp", aside: "drain" });
  }

  /** 기술 결과 뒤에 흘리는 특성 줄(타입 무효·버티기). applyExactGen1Damage 가 쌓고 applyGen1Skill 이 비운다. */
  const abilityNotes: { message: string; heal?: { battler: MutableBattler; amount: number } }[] = [];

  function typeName(typeId: string | undefined): string {
    return options.project.database.elements?.find((element) => element.id === typeId)?.name ?? typeId ?? "해당";
  }

  function stateName(stateId: string): string {
    return options.project.database.states.find((state) => state.id === stateId)?.name ?? stateId;
  }

  function flushAbilityNotes(user: MutableBattler, target: MutableBattler): void {
    while (abilityNotes.length > 0) {
      const note = abilityNotes.shift()!;
      recordSpecial(user, target, note.message);
      if (note.heal) {
        note.heal.battler.hp = Math.min(note.heal.battler.maxHp, note.heal.battler.hp + note.heal.amount);
        recordTimeline({
          kind: "healing", side: battlerSide(note.heal.battler), userRecordId: note.heal.battler.recordId, targetId: note.heal.battler.id,
          hit: true, amount: note.heal.amount, critical: false, resource: "hp", aside: "drain",
        });
      }
    }
  }

  /** 접촉 특성(정전기 등): 물리 피해를 받은 쪽이 확률로 공격자에게 주요 상태를 건다. */
  function applyContactAbility(attacker: MutableBattler, holder: MutableBattler): void {
    const ability = abilityOfBattler(options.project, holder);
    const contact = abilityContactStatus(ability);
    if (!ability || !contact || attacker.hp <= 0 || gen1MajorStatusOf(attacker)) return;
    const state = options.project.database.states.find((record) => record.gen1MajorStatus === contact.status);
    if (!state || !gen1EffectChanceSucceeds(contact.percent, nextGen1Byte)) return;
    recordSpecial(holder, attacker, `${holder.name}의 특성 ${ability.name}!`);
    applyGen1States(holder, attacker, [{ stateId: state.id, chance: 100, operation: "add" }], { kind: "status" });
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
      /** SkillRecord.fixedDamage 를 푼 양. 있으면 피해 식·급소·날씨 대신 이 값(타입 무효면 0). */
      readonly fixedDamage?: number;
    },
  ): { readonly hit: boolean; readonly amount: number; readonly critical: boolean; readonly effectiveness: number } {
    const magical = usesMagicalDefense(options.project, move.elementId);
    const userAbility = abilityOfBattler(options.project, user);
    const targetAbility = abilityOfBattler(options.project, target);
    // 타입 무효·흡수 특성: 기술이 닿기 전에 막는다(난수 바이트를 쓰지 않는다). 설명 줄과 흡수 회복은 기술 결과 뒤에 흘려 보낸다.
    const immunity = (move.affects ?? "hp") === "hp" ? abilityTypeImmunity(targetAbility, move.elementId) : undefined;
    if (immunity && targetAbility) {
      const healed = immunity.healPercent > 0 ? Math.min(target.maxHp - target.hp, Math.max(1, Math.floor(target.maxHp * immunity.healPercent / 100))) : 0;
      abilityNotes.push({
        message: `${withJosa(target.name, "은/는")} 특성 ${targetAbility.name} 덕분에 ${typeName(move.elementId)} 기술이 통하지 않는다!${healed > 0 ? ` 체력을 회복했다!` : ""}`,
        heal: healed > 0 ? { battler: target, amount: healed } : undefined,
      });
      // 빗나감이 아니라 「효과가 없다」(상성 0 배)로 읽히게 hit:true·피해 0 으로 돌려준다.
      return { hit: true, amount: 0, critical: false, effectiveness: 0 };
    }
    const offensePercent = abilityOffensePercent(userAbility, magical);
    const defensePercent = abilityDefensePercent(targetAbility, magical);
    const scaleStat = (value: number, percent: number): number => (percent === 100 ? value : Math.max(1, Math.floor(value * percent / 100)));
    const unmodifiedOffense = scaleStat(magical ? user.mind : user.attackPower, offensePercent);
    const unmodifiedDefense = scaleStat(magical ? target.mind : target.defense, defensePercent);
    const types = gen1TypeModifiersForTypes(
      options.project,
      move.elementId,
      battlerTypes(options.project, user),
      battlerTypes(options.project, target),
    );
    const formula = move.damageFormula ? evaluateDamageFormula(move.damageFormula, formulaBattlerContext(
      { ...user, attackPower: Math.round(user.attackPower * attackMultiplierForStates(options.project, user)), mind: Math.round(user.mind * attackMultiplierForStates(options.project, user, "mind")) },
      { ...target, defense: target.defense * defenseMultiplierForStates(options.project, target), mind: target.mind * defenseMultiplierForStates(options.project, target, "mind") }, move.power)) : undefined;
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
          ? applyStatStage(unmodifiedOffense, user.statStages, "spAttack")
          : gen1ModifiedStat(user, "attack", unmodifiedOffense),
      },
      defense: {
        unmodified: unmodifiedDefense,
        modified: magical
          ? applyStatStage(unmodifiedDefense, target.statStages, "spDefense")
          : gen1ModifiedStat(target, "defense", unmodifiedDefense),
      },
      burned: gen1MajorStatusOf(user)?.kind === "burn",
      stab: types.stab,
      typeFactors: types.typeFactors,
      baseAccuracyByte: accuracyByteFromPercent(move.hitRate ?? 100),
      accuracyStage: statStageOf(user.statStages, "accuracy"),
      evasionStage: statStageOf(target.statStages, "evasion"),
    }, nextGen1Byte);
    // 상성 문장용 배율 — 방어 쪽 타입 배율의 곱(정수 ×10 표기를 되돌린다). 자속 보정(stab)은 넣지 않는다.
    const effectiveness = types.typeFactors.reduce((product, factor) => product * (factor / 10), 1);
    if (!resolved.hit) return { hit: false, amount: 0, critical: resolved.critical, effectiveness };
    const resource = move.affects ?? "hp";
    const before = target[resource];
    // 날씨: 쾌청·비는 불·물 기술의 피해 배율을 바꾼다.
    const weatherPercent = weatherDamagePercent(weather?.kind, gen1CanonicalTypeForId(options.project, move.elementId));
    const weatherDamage = weatherPercent === 100 ? resolved.damage : Math.max(resolved.damage > 0 ? 1 : 0, Math.floor(resolved.damage * weatherPercent / 100));
    const heldBoost = heldBoostPercent(heldEffectOfItem(options.project, user.heldItemId), move.elementId);
    const boostedDamage = heldBoost === 100 ? weatherDamage : Math.max(weatherDamage > 0 ? 1 : 0, Math.floor(weatherDamage * heldBoost / 100));
    const abilityPercent = abilityDamagePercent({ ability: userAbility, hp: user.hp, maxHp: user.maxHp }, { ability: targetAbility }, move.elementId);
    let dealt = formationDamage(Math.round(scaleDamageByPercent(boostedDamage, abilityPercent) * (move.hitMultiplier ?? 1)), user.row, target.row, magical ? "mind" : "attack", "damage");
    // 고정 피해: 난수 바이트는 보통 기술과 똑같이 쓰고(명중·급소 굴림) 양만 바꾼다. 타입 무효(0 배)면 0.
    const fixedHit = move.fixedDamage !== undefined && resource === "hp";
    if (fixedHit) dealt = effectiveness === 0 ? 0 : move.fixedDamage!;
    if (resource === "hp") {
      const endured = abilityEndureDamage(targetAbility, before, target.maxHp, dealt);
      if (endured.endured && targetAbility) {
        dealt = endured.damage;
        abilityNotes.push({ message: `${withJosa(target.name, "은/는")} 특성 ${targetAbility.name} 덕분에 버텼다!` });
      }
    }
    if (resource === "hp") {
      const heldEndured = heldEndureDamage(heldEffectOfItem(options.project, target.heldItemId), before, target.maxHp, dealt);
      if (heldEndured.endured) {
        const itemName = options.project.database.items.find((item) => item.id === target.heldItemId)?.name ?? "도구";
        dealt = heldEndured.damage;
        consumeHeldItem(target);
        heldNotes.push({ message: `${withJosa(target.name, "은/는")} ${itemName} 덕분에 버텼다!` });
      }
    }
    target[resource] = Math.max(0, before - dealt);
    return { hit: true, amount: before - target[resource], critical: fixedHit ? false : resolved.critical, effectiveness };
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
    tickBattleWeather();
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
    if (gen1) return undefined;
    const rage = rageCommand(actor);
    if (rage && forcedActionForStates(options.project, actor) !== "attackRandom") return rage;
    if (!forcedActionForStates(options.project, actor)) return undefined;
    const target = randomOpponent(actor);
    return target ? { kind: "attack", targetEnemyId: target.id } : undefined;
  }

  /** 폭주 중인가: rageEnemyId 가 있고, 프로젝트에 state_rage 가 있으면 그 상태가 아직 붙어 있어야 한다(해제하면 폭주도 끝). */
  function rageActive(actor: MutableBattler): boolean {
    if (!actor.rageEnemyId) return false;
    const hasState = options.project.database.states.some((state) => state.id === RAGE_STATE_ID);
    return !hasState || actor.stateIds.includes(RAGE_STATE_ID);
  }

  /**
   * 폭주: 모습이 된 몬스터의 행동 표에서 무작위 한 줄을 골라 그 기술(또는 통상 공격)을 이번 명령으로 낸다.
   * 대상은 기술 범위대로 굴린다. 쓸 수 없는 줄(대상 없음·행동 표에 없는 기술)은 통상 공격으로 낮춘다.
   * 명령은 MP·PP 를 쓰지 않는다 — 실행 쪽이 rageActive 를 보고 비용을 건너뛴다.
   */
  function rageCommand(actor: MutableBattler): ActorCommand | undefined {
    if (!rageActive(actor)) return undefined;
    const enemy = options.project.database.enemies.find((record) => record.id === actor.rageEnemyId);
    const opponent = randomOpponent(actor);
    if (!enemy || !opponent) return undefined;
    const ids = rageActionSkillIds(enemy);
    const skillId = ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))] ?? "";
    const skill = skillId ? lookupSkill(skillId) : undefined;
    if (!skill) return { kind: "attack", targetEnemyId: opponent.id };
    const resolution = resolveBattleTargets({
      scope: skill.scope,
      user: actor,
      actors: activeActors(),
      enemies: visibleEnemies(),
      includeDefeatedAllies: skillRevivesDefeatedAllies(skill),
    });
    const candidates = resolution.candidates.filter((entry) => entry.hp > 0 || resolution.scope === "ally");
    if (resolution.targets.length === 0 && candidates.length === 0) return { kind: "attack", targetEnemyId: opponent.id };
    const pick = resolution.requiresSelection
      ? candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))]
      : resolution.targets[0];
    if (!pick) return { kind: "attack", targetEnemyId: opponent.id };
    return battlerSide(pick) === "actor"
      ? { kind: "skill", skillId: skill.id, targetEnemyId: pick.id, targetActorId: pick.recordId as ActorId }
      : { kind: "skill", skillId: skill.id, targetEnemyId: pick.id };
  }

  // Active ATB 메뉴가 열려 있는 동안의 시간 진행: 적만 차례를 받고, 다른 아군은 게이지만 찬다.
  function tickDuringMenu(deltaMs: number): void {
    const menuActor = actors.find((entry) => entry.recordId === activeActorId);
    const enemiesInBattle = visibleEnemies();
    const others = chargingActors().filter((entry) => entry !== menuActor);
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
    if (!menuActor || menuActor.hp <= 0 || !canBattlerAct(options.project, menuActor) || !activeActorIds.includes(menuActor.recordId)) {
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
    if (heldForCombo.size > 0 && !chargingActors().some((actor) => actor.hp > 0)) {
      // 기다릴 동료가 없다(쓰러짐 등) — 대기를 풀어 차례를 돌려준다.
      for (const id of heldForCombo) resumedFromHold.add(id);
      heldForCombo.clear();
    }
    const chargers = chargingActors();
    const ready = nextReadyBattler(chargers, enemiesInBattle, deltaMs, skinHasteMultiplier, battlerAgilityMultiplier);
    if (!ready) {
      chargeBattlers(chargers, enemiesInBattle, deltaMs, skinHasteMultiplier, battlerAgilityMultiplier);
      return;
    }
    chargeBattlers(chargers, enemiesInBattle, ready.timeMs, skinHasteMultiplier, battlerAgilityMultiplier);
    ready.battler.gauge = 100;
    if (ready.kind === "actor") {
      // 연계 대기가 풀린다 — 기다리던 배우는 게이지 100 그대로 이 배우 다음 차례를 받는다(그 사이 이 배우는 연계기를 고를 수 있다).
      for (const id of heldForCombo) resumedFromHold.add(id);
      heldForCombo.clear();
      const resumed = resumedFromHold.delete(ready.battler.recordId);
      // 턴 시작 상태 처리(지속 피해/자연 회복). 행동 불가(수면 등)면 명령 없이 턴을 넘긴다.
      if (!gen1 && !resumed) {
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

  /**
   * FF6 식 팀 교대. 지금 명령을 고르는 배우의 차례를 써서 활성 팀을 바꾼다(gauge: 이 행동 슬롯을 소비, strict: 이 라운드 전체를 소비).
   * 물러나는 팀의 이번 라운드 명령은 버린다. ActorCommand 합집합과 분리된 별도 입구다(types.ts TeamSwapCommand).
   */
  function holdForCombo(): boolean {
    if (battleFlow !== "gauge" || cancelled || eventChoice || eventPause || result || phase !== "actorCommand" || !activeActorId) return false;
    if (forcedSwitchActor()) return false;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor || actor.hp <= 0) return false;
    // 기다려서 열릴 연계기가 있어야 한다 — 이 배우가 낀 연계기 중 동료가 모두 참전해 살아 있는 것.
    const party = activeActors().filter((battler) => battler.hp > 0);
    // 연계기는 참가자면 배우지 않아도 열린다(comboSkillIdsFor) — 해금 조건(comboRequires)은 실제 고를 때 battleActorSkillFailure 가 본다.
    const hasCombo = options.project.database.skills.some((skill) => {
      const combo = comboActorIdsOf(skill);
      if (!combo || !combo.includes(actor.recordId as ActorId)) return false;
      if (comboLockedBy(skill, comboParticipants(true)).length > 0) return false;
      return combo.every((id) => party.some((battler) => battler.recordId === id));
    });
    if (!hasCombo) return false;
    if (!party.some((battler) => battler !== actor && !heldForCombo.has(battler.recordId))) return false;
    heldForCombo.add(actor.recordId);
    resumedFromHold.delete(actor.recordId);
    activeActorId = undefined;
    targetSelection = undefined;
    phase = "charging";
    return true;
  }

  function performTeamSwap(command: TeamSwapCommand): void {
    if (cancelled || eventChoice || eventPause || result || phase !== "actorCommand" || !activeActorId) return;
    if (forcedSwitchActor()) return;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor || !canSwapToTeam(command.targetTeamId)) return;
    beginTimelineAction();
    currentActorCommandKind = "switch";
    targetSelection = undefined;
    if (battleFlow === "strict") {
      // 교대가 이 라운드 전체를 쓴다 — 물러나는 팀의 다른 명령은 버리고, 교대 뒤 적만 행동한다.
      swapActiveTeam(command.targetTeamId, actor.recordId);
      strictActorCommands = [];
      strictPendingActorIds = [];
      activeActorId = undefined;
      resolveStrictRound();
      return;
    }
    swapActiveTeam(command.targetTeamId, actor.recordId);
    actor.gauge = 0;
    gaugeCycleActed.add(actor.id);
    applyTroopEvents(() => finishGaugeActorCommand(actor), markGaugeActionCycle(actor));
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
    return skillRevivesDefeatedAllies(lookupSkill(command.skillId));
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
      const downed = commandRevives(command) ? resolution.candidates.filter((entry) => entry.hp <= 0) : [];
      const ally = (downed.length > 0 ? downed : resolution.candidates.filter((entry) => entry.hp > 0))
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
      case "commonEvent":
        return options.project.commonEvents.some((entry) => entry.id === command.commonEventId);
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
    // 대상 해결 검사는 대상을 쓰는 명령에만 — defend/escape/switch/commonEvent 는 적법성만으로 결정된다.
    switch (command.kind) {
      case "defend":
      case "escape":
      case "switch":
      case "commonEvent":
        return true;
      default: {
        const resolution = resolvedCommandTargets(actor, command);
        return resolution.targets.length > 0;
      }
    }
  }

  function applyActorCommandEffect(actor: MutableBattler, command: ActorCommand): void {
    partyCommandRounds += 1;
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
        // 폭주 중에는 몬스터의 기술을 비용 없이 쓴다(가우). 스케치로 그린 기술은 원래 기술 비용만 낸다.
        const raging = rageActive(actor) && !actor.skillIds.includes(command.skillId);
        if (!raging) {
          consumeBattleSkillResource(options.project, actor, command.skillId);
          spendPartyGauge(command.skillId);
          // 연계기: 참가 배우 각자의 MP 를 똑같이 소비한다(위력은 시전자 능력치).
          for (const partner of comboPartners(actor, command)) consumeSkillMp(partner, command.skillId);
        }
        // 입력 커맨드: 성공은 보너스, 실패는 약화. 판정이 없으면(자동전투 등) 1배.
        const inputMultiplier = inputSequencePowerMultiplier(lookupSkill(command.skillId)?.inputSequence, command.inputResult);
        if (!raging) paySkillHpCost(actor, command.skillId, "skill");
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
      case "commonEvent":
        // 실행은 이 행동 뒤 트룹 이벤트 흐름(applyTroopEvents) 앞머리에서 — 문장·선택지가 같은 정지·재개를 탄다.
        battleEvents.queueCommonEvent(command.commonEventId);
        recordTimeline({ kind: "action", side: "actor", userRecordId: actor.recordId, targetId: actor.id, commandKind: "commonEvent" });
        break;
    }
  }

  function applyActorAttack(actor: MutableBattler, command: Extract<ActorCommand, { kind: "attack" }>): void {
    const targets = resolvedCommandTargets(actor, command).targets;
    const swings = actor.equipmentEffects?.attackSwings;
    if (swings?.length) {
      // 이도류: 타격마다 그 무기의 공격력·속성으로 친다. 계산이 끝나면 합산 능력치로 되돌린다.
      const attackPower = actor.attackPower;
      const effects = actor.equipmentEffects;
      try {
        for (const swing of swings) {
          actor.attackPower = Math.max(1, attackPower + swing.attackOffset);
          actor.equipmentEffects = { ...effects!, attackElementIds: swing.attackElementIds };
          for (const target of targets) {
            if (target.hp > 0) applySingleActorAttack(actor, target);
          }
        }
      } finally {
        actor.attackPower = attackPower;
        actor.equipmentEffects = effects;
      }
      return;
    }
    const attackCount = actor.equipmentEffects?.attackHits ?? (actor.equipmentEffects?.doubleAttack ? 2 : 1);
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
      hitMultiplier:gimmickDamageMultiplier(actor,target)*damageTypeMultiplier(options.project,"physical",target,actor.equipmentEffects?.attackElementIds?.[0]),
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(actor),
      hitRate: withAccuracyStages(withEvasion(normalAttackHitRate(actor, target), actor, target), actor, target),
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
      { userRecordId: actor.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical, ...effectivenessField(result.hit ? battleEffectivenessMultiplier(options.project, actor.equipmentEffects?.attackElementIds?.[0], target) * damageTypeMultiplier(options.project, "physical", target, actor.equipmentEffects?.attackElementIds?.[0]) : 1) , ...(result.hit ? partsField(effectivenessParts(options.project, actor.equipmentEffects?.attackElementIds?.[0], "physical", target)) : {}) },
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
      case "commonEvent":
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
    strictPendingActorIds = strictActorsSkipRound() ? [] : activeActors()
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

  /** 이번 strict 라운드에 아군이 쉬는가 — 진형(기습) 첫 라운드, 또는 한 턴 비용으로 막 교대해 들어온 팀. */
  function strictActorsSkipRound(): boolean {
    const resting = teamResting.size > 0;
    teamResting.clear();
    return strictFormationSkipSide === "actor" || resting;
  }

  function prepareStrictActorCommands(): void {
    if (!gen1) {
      for (const actor of activeActors()) {
        if (actor.hp > 0 && !canBattlerAct(options.project, actor)) recordIncapacitated(actor);
      }
    }
    strictPendingActorIds = strictActorsSkipRound() ? [] : activeActors()
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
    const guest = guestTactics.has(actor.recordId);
    if (gen1 || usePartyMonsters || (!guest && !actorFightsAutomatically(options.project, actor.recordId, actor.classId))) return undefined;
    const savedPhase = phase;
    const savedActorId = activeActorId;
    phase = "actorCommand";
    activeActorId = actor.recordId;
    try {
      const command = chooseAutoBattleCommand(options.project, snapshot(), rng, guest ? guestTactics.get(actor.recordId) : actorAutoTactic(options.project, actor.recordId));
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
          // 적의 강제 교대·대열 섞기로 이번 라운드 도중 자리에서 빠진 배우의 명령은 버린다.
          if (!activeActorIds.includes(action.actor.recordId)) continue;
          if (!gen1 && !canBattlerAct(options.project, action.actor)) {
            recordIncapacitated(action.actor);
            continue;
          }
          if (action.command.kind === "skill" && !(rageActive(action.actor) && !action.actor.skillIds.includes(action.command.skillId))
            && battleActorSkillFailure(options.project, action.actor, action.command.skillId, comboParticipants(true), partyGauge)) continue;
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
    flinchedBattlerIds.clear();
    tickBattleWeather();
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
          ? gen1ParalyzedSpeed(applyStatStage(actor.agility, actor.statStages, "speed"), gen1MajorStatusOf(actor)?.kind === "paralysis")
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
            ? gen1ParalyzedSpeed(applyStatStage(enemy.agility, enemy.statStages, "speed"), gen1MajorStatusOf(enemy)?.kind === "paralysis")
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
    flushHitWakes();
    flushChargeBreaks();
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
    flushHitWakes();
    flushChargeBreaks();
    const enemiesInBattle = visibleEnemies();
    const nextReady = battleFlow === "gauge" && phase === "charging" && !result
      ? nextReadyBattler(chargingActors(), enemiesInBattle, Infinity, skinHasteMultiplier,
        (battler) => agilityMultiplierForStates(options.project, battler))
      : undefined;
    const forcedActor = forcedSwitchActor();
    // Action poses while lastActionResult is live (cleared when the next command phase begins).
    const showActionPose = Boolean(lastActionResult);
    const poseContext = { lastActionResult, showActionPose };
    // 승리: 살아 있는 아군만 victory 포즈(쓰러진 아군은 resolveBattlerPose 가 dead 를 우선한다).
    const actorPoseContext = result === "victory" ? { ...poseContext, victory: true } : poseContext;
    return {
      ...(Object.keys(knownWeaknesses).length > 0 ? { knownWeaknesses } : {}),
      nextReadyBattlerId: nextReady?.battler.id,
      phase,
      eventChoice,
      eventPause,
      battleFlow,
      atbMode: activeAtb ? "active" : "wait",
      ...(heldForCombo.size > 0 ? { heldActorIds: [...heldForCombo] } : {}),
      activeActorId,
      activeSlots,
      forcedSwitchActorId: forcedActor?.recordId,
      switchCandidateActorIds: switchCandidateActors().map((actor) => actor.recordId),
      ...(battleTeams ? { teams: teamSnapshots(), activeTeamId, teamSwapCost } : {}),
      participatingActorIds: [...participatingActorIds],
      ...(guestTactics.size > 0 ? { guestActorIds: [...guestTactics.keys()] as ActorId[] } : {}),
      actors: activeActors().map((actor, index) => withCharging(actor, battlerSnapshot(actor, activeActorPosition(index), actorPoseContext))),
      reserveActors: reserveActors().map((actor) => battlerSnapshot(actor, undefined, { showActionPose: false })),
      enemies: enemiesInBattle.map((enemy) => withCharging(enemy, battlerSnapshot(enemy, undefined, poseContext))),
      ...departedEnemiesSnapshot(poseContext),
      lastAnimation,
      lastActionResult,
      actionLog: [...actionLog],
      timeline: [...timeline],
      hitFeel: hitFeelFromActionResult(lastActionResult),
      lastCaptureResult,
      // 스냅샷은 호출 시점의 값이다(#2586): 런타임이 계속 고치는 배열·객체는 복사해 넘긴다.
      // 그래야 이전 스냅샷이 나중 상태로 바뀌지 않고, 스냅샷에 쓴 값이 런타임으로 새지 않는다.
      capturedMonsters: [...capturedMonsters],
      result,
      rewards: structuredClone(rewards),
      canEscape: options.canEscape,
      formation,
      failedEscapeAttempts,
      canLose: options.canLose,
      troopId: options.troopId,
      backdropResourceId,
      turn,
      partyCommandRounds,
      ...(weather ? { weather: { ...weather } } : {}),
      strictRound: strictRoundCount,
      strictPendingActorIds: [...strictPendingActorIds],
      strictQueuedActorIds: strictActorCommands.map((entry) => entry.actorId),
      eventState: {
        ...battleEvents.snapshot(),
        ...(usePartyMonsters && options.partyMonsters?.length ? {
          monsterCollection: {
            instances: Object.fromEntries(options.partyMonsters.map(instance => [instance.instanceId, {
              instanceId: instance.instanceId, speciesId: instance.speciesId, level: instance.level, exp: instance.exp, ...(instance.ivs ? { ivs: instance.ivs } : {}), ...(instance.nature ? { nature: instance.nature } : {}), ...(instance.evs ? { evs: instance.evs } : {}),
            }])),
          },
        } : {}),
      },
      targetSelection,
      roundLogs: [...roundLogs],
      eventLogs: [...battleEvents.logs()],
      ...(partyGauge !== undefined ? { partyGauge } : {}),
    };
  }

  function performEnemyTurn(enemy: MutableBattler, finish: () => void = finishGaugeTurnSlot): void {
    rewardTurn = turn + 1;
    teamResting.clear();
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
      ...(first ? { chargeStart: true as const, chargeSkillId: skillId } : {}),
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
        pendingCharges.set(actor.id, { skillId: command.skillId, turnsLeft: turns, damageTaken: 0, command });
        recordCharging(actor, command.skillId, turns, true);
        return undefined;
      }
    }
    return command;
  }

  /** 적의 자기 차례 행동(gauge·strict). 힘 모으기를 거친 뒤 executeEnemyAction 으로 넘긴다. */
  function executeEnemyTurnAction(enemy: MutableBattler, action: EnemyActionChoice | undefined): void {
    if (consumeChargeStagger(enemy)) {
      weakness.standUp(enemy.id);
      return;
    }
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
      pendingCharges.set(enemy.id, { skillId: action.skillId, turnsLeft: turns, damageTaken: 0, action });
      recordCharging(enemy, action.skillId, turns, true);
      return;
    }
    executeEnemyAction(enemy, action);
  }

  /** 쓰러진 배틀러는 모으던 힘을 잃는다(부활해도 이어지지 않는다). */
  function dropDefeatedCharges(): void {
    for (const battler of [...actors, ...enemies]) if (battler.hp <= 0) {
      pendingCharges.delete(battler.id);
      chargeStaggeredIds.delete(battler.id);
    }
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
        includeDefeatedAllies: skillRevivesDefeatedAllies(skill),
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
      hitMultiplier:gimmickDamageMultiplier(enemy,target)*damageTypeMultiplier(options.project,"physical",target),
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(enemy),
      hitRate: withAccuracyStages(withEvasion(normalAttackHitRate(enemy, target), enemy, target), enemy, target),
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

  /** 능력치 단계의 명중률·회피율을 명중률(%)에 곱한다(상대 편에게 쓸 때만, 최대 100). 단계가 0 이면 그대로. */
  function withAccuracyStages(hitRate: number | undefined, user: MutableBattler, target: MutableBattler): number | undefined {
    if (gen1 || battlerSide(user) === battlerSide(target)) return hitRate;
    const accuracy = statStageOf(user.statStages, "accuracy");
    const evasion = statStageOf(target.statStages, "evasion");
    if (accuracy === 0 && evasion === 0) return hitRate;
    const scaled = scaleByStage(scaleByStage((hitRate ?? 100) * 100, accuracy), -evasion);
    return Math.max(0, Math.min(100, Math.round(scaled / 100)));
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
  /** 트랜스·변신 상태가 준 기술을 전투 기술 목록에 맞춘다. 이 함수가 더한 기술만 걷어 내므로 배운 기술은 건드리지 않는다. */
  const stateGrantedSkills = new Map<string, SkillId[]>();
  function syncStateGrantedSkills(battler: MutableBattler): void {
    if (gen1) return;
    const granted = new Set(grantedSkillIdsForStates(options.project, battler).filter((id) => lookupSkill(id)));
    const previous = stateGrantedSkills.get(battler.id) ?? [];
    if (granted.size === 0 && previous.length === 0) return;
    const keep = battler.skillIds.filter((id) => !previous.includes(id) || granted.has(id));
    const added: SkillId[] = [];
    for (const id of granted) {
      if (!keep.includes(id)) { keep.push(id); added.push(id); }
    }
    const stillOurs = previous.filter((id) => granted.has(id));
    battler.skillIds = keep;
    if (added.length + stillOurs.length > 0) stateGrantedSkills.set(battler.id, [...stillOurs, ...added]);
    else stateGrantedSkills.delete(battler.id);
  }

  function refreshAfterStateChange(battler: MutableBattler, changedStateIds: readonly string[]): void {
    if (changedStateIds.length > 0) syncStateGrantedSkills(battler);
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
      skillIds: battlerSkillIdsWithGrants(battler),
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
        (item.ppRecovery && (item.ppRecovery.flat > 0 || item.ppRecovery.percentMax > 0)) ||
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
    readonly ppRecovery?: { flat: number; percentMax: number };
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
      item.mpRecovery.percentMax > 0 ||
      (item.ppRecovery?.flat ?? 0) > 0 || (item.ppRecovery?.percentMax ?? 0) > 0;
    const hasHeal =
      item.healStateIds.length > 0 ||
      item.stateEffects.some((effect) => effect.operation === "remove");
    return item.type === "medicine" || hasRecovery || hasHeal;
  }

  function applyItemRecovery(
    user: MutableBattler,
    target: MutableBattler,
    item: { readonly hpRecovery: { flat: number; percentMax: number }; readonly mpRecovery: { flat: number; percentMax: number }; readonly ppRecovery?: { flat: number; percentMax: number } }
  ): void {
    const hp = Math.max(0, Math.floor((target.maxHp * item.hpRecovery.percentMax) / 100) + item.hpRecovery.flat);
    const mp = Math.max(0, Math.floor((target.maxMp * item.mpRecovery.percentMax) / 100) + item.mpRecovery.flat);
    const beforeHp = target.hp;
    const beforeMp = target.mp;
    // 좀비: 회복 아이템의 HP 는 피해가 된다(쓰러진 대상은 제외).
    if (hp > 0 && beforeHp > 0 && invertsHealingForStates(options.project, target)) {
      target.hp = Math.max(0, beforeHp - hp);
      if (mp > 0) target.mp = Math.min(target.maxMp, target.mp + mp);
      recordAction({ userRecordId: user.recordId, targetId: target.id, hit: true, amount: beforeHp - target.hp, critical: false }, "damage", "item", "hp");
      return;
    }
    if (hp > 0) target.hp = Math.min(target.maxHp, target.hp + hp);
    if (mp > 0) target.mp = Math.min(target.maxMp, target.mp + mp);
    // HP 와 MP 증가분을 하나의 amount 로 합산하지 않는다. 합산하면 화면 원장이 그 합계를
    // HP 변화로 읽어, 마력약(MP+30/HP+0)이 표시 HP 를 250→280 으로 올렸다가 다음 국면에
    // 250 으로 되돌렸다(실측). 자원별로 나누고 어느 자원인지 함께 넘긴다.
    const hpGain = target.hp - beforeHp;
    const mpGain = target.mp - beforeMp;
    const pp = restoredMovePp(options.project, target.skillIds, target.skillPp, item.ppRecovery);
    if (pp.changed) {
      target.skillPp = pp.skillPp;
      recordTimeline({ kind: "special", side: battlerSide(user), userRecordId: user.recordId,
        targetId: target.id, commandKind: "item", success: true,
        message: `${target.name}의 기술 PP가 ${pp.after - pp.before} 회복되었다!` });
      // PP is its own resource: never send a PP amount to the HP/MP ledger.
      if (hpGain === 0 && mpGain === 0) return;
    }
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

  const dexAnnouncedSpecies = new Set<string>();
  function applyCapture(user: MutableBattler, captureItemId: ItemId, targetEnemyId: string): void {
    const finish = (next: BattleCaptureResultSnapshot): void => {
      lastCaptureResult = next;
      // 흔들린 횟수를 이벤트가 읽게 한다(system.captureShakesVariableId). 잡히면 4, 막힌 던지기(blockedReason)는 0.
      const shakesVariableId = options.project.system.captureShakesVariableId;
      if (shakesVariableId) battleEventState.variables[shakesVariableId] = next.success ? 4 : (next.shakes ?? 0);
      recordTimeline({
        kind: "capture",
        side: "actor",
        userRecordId: user.recordId,
        targetId: next.targetId,
        commandKind: "capture",
        success: next.success,
        ...(next.shakes !== undefined ? { shakes: next.shakes } : {}),
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
    // 조건부 볼: 조건이 맞으면 포획 확률 배율이 더 오른다(그물·퀵·타이머·리피트). 맞으면 문장 하나.
    const ballBonus = captureConditionMultiplier(item.captureProfile.condition, {
      turn,
      targetTypes: battlerTypes(options.project, target),
      speciesCaught: battleEventState.switches[`mx_caught_${species.id}`] === true,
    });
    if (ballBonus > 1 && item.captureProfile.condition) recordSpecial(user, target, captureConditionLine(item.captureProfile.condition, item.name));
    // gen1 이면 Gen1 계열 공식(만HP 1/3 + 상태 보너스) — "재우고 잡기"가 여기서 성립한다.
    let rate: number;
    let roll: number | undefined;
    let shakes: 0 | 1 | 2 | 3 | undefined;
    if (gen1) {
      const attempt = attemptGen1Capture({
        ballClass: item.captureProfile.ballClass ?? "poke",
        maxHp: target.maxHp,
        currentHp: target.hp,
        catchRate: Math.min(255, Math.round(species.captureRate * 255 * ballBonus)),
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
      rate = captureSuccessRate(species.captureRate, target.hp, target.maxHp, captureItemMultiplier(item) * ballBonus, {
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
      level: Math.max(1, Math.min(99, Math.trunc(target.level ?? enemyRecord?.level ?? 1))),
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
    // 도감에 처음 오르는 종이면 등록 문장을 한 줄 남긴다. 영수증(mx_caught_)은 여기서 찍지 않는다 — 캠페인 포획은 승리·도주 커밋 때
    // giveMonster 가 찍는다(패배로 버려지는 포획이 도감에 남지 않게). 같은 전투에서 같은 종을 또 잡아도 문장은 한 번만.
    const campaign = options.project.system.monsterCampaign;
    const newDexEntry = campaign?.speciesIds.includes(species.id) === true
      && battleEventState.switches[`mx_caught_${species.id}`] !== true
      && !(options.partyMonsters ?? []).some((instance) => instance.speciesId === species.id)
      && !dexAnnouncedSpecies.has(species.id);
    if (newDexEntry) dexAnnouncedSpecies.add(species.id);
    finish({ targetId: target.id, captureItemId, success: true, rate, roll, shakes, speciesId: species.id, ...(newDexEntry ? { newDexEntry: true } : {}) });
    if (newDexEntry) {
      const text = campaign?.dexRegisteredText?.trim() || "{name}의 데이터가 도감에 등록되었다!";
      recordTimeline({
        kind: "special", side: "actor", userRecordId: user.recordId, targetId: target.id,
        message: text.replace(/\{name\}/gu, species.name), aside: "dex",
      });
    }
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

  /**
   * SkillRecord.recoilPercent·flinchChance: 명중해서 피해를 줬을 때만. 반동은 시전자 자신 대상 damage 엔트리(aside recoil)로
   * 남겨 HP 바가 줄고, 풀죽음은 대상이 이번 라운드에 아직 움직일 차례가 남아 있을 때만 굴린다(strict 턴제).
   */
  function applySkillRecoilAndFlinch(
    user: MutableBattler,
    target: MutableBattler,
    skill: ReturnType<typeof lookupSkill>,
    dealt: number,
    commandKind: BattleTimelineEntrySnapshot["commandKind"],
  ): void {
    if (!skill || dealt <= 0) return;
    const recoil = user.hp > 0 ? Math.min(user.hp, recoilDamageFor(skill.recoilPercent, dealt)) : 0;
    if (recoil > 0) {
      user.hp -= recoil;
      recordTimeline({
        kind: "damage",
        side: battlerSide(user),
        userRecordId: user.recordId,
        targetId: user.id,
        commandKind,
        hit: true,
        amount: recoil,
        critical: false,
        skillName: skill.name,
        skillId: skill.id,
        resource: "hp",
        aside: "recoil",
      });
      recordTimeline({ kind: "special", side: battlerSide(user), userRecordId: user.recordId, targetId: user.id, message: `${withJosa(user.name, "은/는")} 반동 피해를 입었다!`, recoil: true });
    }
    const chance = skill.flinchChance ?? 0;
    if (chance > 0 && target !== user && target.hp > 0 && !flinchedBattlerIds.has(target.id) && actsLaterThisRound(target)) {
      const passed = chance >= 100 || (gen1 ? gen1EffectChanceSucceeds(chance, nextGen1Byte) : rng() * 100 < chance);
      if (passed) flinchedBattlerIds.add(target.id);
    }
  }

  /** strict 라운드에서 이 배틀러의 행동이 아직 큐에 남아 있는가(풀죽음은 아직 안 움직인 상대에게만 먹는다). */
  function actsLaterThisRound(battler: MutableBattler): boolean {
    return strictResolution?.actions.slice(strictResolution.index).some((queued) =>
      queued.side === "actor" ? queued.actor.id === battler.id : queued.enemy.id === battler.id) === true;
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
          includeDefeatedAllies: skillRevivesDefeatedAllies(skill),
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
            includeDefeatedAllies: skillRevivesDefeatedAllies(skill),
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
      // 쓰러진 동료(HP 0)는 회복량 0이라 풀피 힐과 같이 버려졌다. 부활 기술이면
      // 어떤 피해·생환자 힐보다 우선한다(최대 HP 99999 + 처치 보너스보다 큼).
      if (target.hp <= 0) return skillRevivesDefeatedAllies(skill) ? 100_000_000 : 0;
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
    // 장비 「주는 피해 ±%」·「받는 피해 ±%」 — 통상 공격·기술(물리·마법) 피해가 모두 이 곱을 지난다. 0.1 아래로는 내리지 않는다.
    const dealt = Math.max(0.1, 1 + (user.equipmentEffects?.damageDealtPercent ?? 0) / 100);
    const taken = Math.max(0.1, 1 + (target.equipmentEffects?.damageTakenPercent ?? 0) / 100);
    return (
      dealt *
      taken *
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

  /** 흉내·스케치가 고른 기술을 그 스코프로 다시 겨눠 쓴다. 전체기는 그 편 전원, 단일기는 원래 대상(편이 다르면 자신·무작위 상대). */
  function castPickedSkill(
    user: MutableBattler,
    primary: MutableBattler,
    skill: NonNullable<ReturnType<typeof lookupSkill>>,
    picked: ReturnType<typeof lookupSkill>,
    commandKind: BattleTimelineEntrySnapshot["commandKind"],
    powerMultiplier: number,
    afterTarget?: (target: MutableBattler) => void,
  ): void {
    recordSpecial(user, primary, picked ? `${skill.name}: ${picked.name}!` : `${skill.name}: 아무 일도 일어나지 않았다.`);
    if (!picked) return;
    const resolve = (requestedId: string) =>
      resolveBattleTargets({
        scope: picked.scope,
        user,
        actors: activeActors(),
        enemies: visibleEnemies(),
        requestedTargetId: requestedId,
        area: picked.area,
        includeDefeatedAllies: commandRevives({ kind: "skill", skillId: picked.id }),
      });
    let resolution = resolve(primary.id);
    if (resolution.targets.length === 0) {
      const fallback = resolution.side === battlerSide(user) ? user : randomOpponent(user);
      if (fallback) resolution = resolve(fallback.id);
    }
    // 대열·교대·폭주처럼 대상별 피해가 아닌 효과는 일반 시전 경로가 한 번에 처리한다(재귀는 sketchableSkills 가 막는다).
    if (["shuffleParty", "forceSwitch", "rage"].includes(picked.effect.kind)) {
      applySkillCast(user, resolution.targets, picked.id, commandKind, powerMultiplier, afterTarget);
      return;
    }
    for (const pickedTarget of resolution.targets) {
      applySkill(user, pickedTarget, picked.id, commandKind, powerMultiplier);
      afterTarget?.(pickedTarget);
    }
  }

  /** 폭주 시작: 몬스터를 정해 rageEnemyId 로 새기고 state_rage 를 건다. 후보는 skill.enemyIds, 없으면 승리 때 모은 목록. */
  function beginRage(user: MutableBattler, skill: NonNullable<ReturnType<typeof lookupSkill>>, enemyIds: readonly string[] | undefined, commandKind: BattleTimelineEntrySnapshot["commandKind"]): void {
    const learned = sessionState.actorRageEnemyIds?.[user.recordId] ?? [];
    const pool = (enemyIds && enemyIds.length > 0 ? enemyIds : learned)
      .filter((id) => options.project.database.enemies.some((record) => record.id === id));
    if (pool.length === 0) {
      recordSpecial(user, user, `${skill.name}: 폭주할 몬스터를 아직 모른다.`, skill.id, commandKind);
      return;
    }
    const enemyId = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
    user.rageEnemyId = enemyId;
    const name = options.project.database.enemies.find((record) => record.id === enemyId)?.name ?? enemyId;
    recordSpecial(user, user, `${withJosa(user.name, "이/가")} ${name}의 모습으로 폭주한다!`, skill.id, commandKind);
    applyStates(user, user, [{ stateId: RAGE_STATE_ID, chance: 100, operation: "add" }, ...(skill.stateEffects ?? [])]);
  }

  /** 대열 섞기: 그 편 활성 배우의 자리 순서와 앞/뒤 열을 무작위로 뒤섞는다. 적 편은 자리가 없어 영향이 없다. */
  function shuffleBattleParty(user: MutableBattler, aimed: MutableBattler, skill: NonNullable<ReturnType<typeof lookupSkill>>, commandKind: BattleTimelineEntrySnapshot["commandKind"]): void {
    if (rng() * 100 >= (combinedSkillHitRate(skill) ?? 100)) {
      recordAction({ userRecordId: user.recordId, targetId: aimed.id, hit: false, amount: 0, critical: false, skillName: skill.name, skillId: skill.id }, "miss", commandKind);
      return;
    }
    if (battlerSide(aimed) !== "actor") {
      recordSpecial(user, aimed, `${skill.name}: 아무 일도 일어나지 않았다.`, skill.id, commandKind);
      return;
    }
    const before = [...activeActorIds];
    if (before.length > 1) {
      let next = shuffled(before, rng);
      if (next.every((id, index) => id === before[index])) next = [...next.slice(1), next[0]!];
      activeActorIds = next;
    }
    for (const actor of activeActors()) {
      if (rng() < 0.5) actor.row = actor.row === "back" ? "front" : "back";
    }
    recordSpecial(user, aimed, `${skill.name}: 대열이 흐트러졌다!`, skill.id, commandKind);
    applyStates(user, aimed, skill.stateEffects);
  }

  /** 강제 교대: 대상 활성 배우를 살아 있는 예비 배우 한 명과 바꾼다. */
  function forceSwitchTargets(user: MutableBattler, targets: readonly MutableBattler[], skill: NonNullable<ReturnType<typeof lookupSkill>>, commandKind: BattleTimelineEntrySnapshot["commandKind"]): void {
    for (const aimed of targets) {
      if (battlerSide(aimed) !== "actor" || aimed.hp <= 0) continue;
      if (rng() * 100 >= (combinedSkillHitRate(skill) ?? 100)) {
        recordAction({ userRecordId: user.recordId, targetId: aimed.id, hit: false, amount: 0, critical: false, skillName: skill.name, skillId: skill.id }, "miss", commandKind);
        continue;
      }
      const reserve = switchCandidateActors();
      if (reserve.length === 0) {
        recordSpecial(user, aimed, `${skill.name}: 교대할 동료가 없다.`, skill.id, commandKind);
        continue;
      }
      const incoming = reserve[Math.min(reserve.length - 1, Math.floor(rng() * reserve.length))]!;
      recordSpecial(user, aimed, `${withJosa(aimed.name, "이/가")} 끌려 나가고 ${withJosa(incoming.name, "이/가")} 나왔다!`, skill.id, commandKind);
      switchActiveActor(aimed.recordId, incoming.recordId);
      applyStates(user, incoming, skill.stateEffects);
    }
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
    if (skill?.comboSwitchId && comboActorIdsOf(skill)) battleEventState.switches[skill.comboSwitchId] = true;
    if (skill && prepareGimmickCast(user, targets, skill)) return;
    // 연막·도주 기술(type "escape"): 아군이 쓰면 확률 굴림 없이 전투에서 빠져나간다. 도주 불가 전투는 소모만 하고 막힌다.
    if (skill?.type === "escape" && battlerSide(user) === "actor") {
      if (options.canEscape) {
        recordSpecial(user, user, `${skill.name}! 연기에 몸을 숨기고 무사히 도망쳤다!`, skill.id, commandKind);
        escaped = true;
      } else {
        recordSpecial(user, user, `${skill.name}: 이 싸움에서는 도망칠 수 없다!`, skill.id, commandKind);
      }
      return;
    }
    // 흉내·춤·슬롯: 후보 중 하나를 굴려 그 기술로 바꿔 쓴다. 자원은 원래 기술 몫만 소비했다.
    if (skill?.effect.kind === "randomSkillFrom") {
      const picked = pickRandomSkill(options.project, skill.effect.skillIds, rng);
      castPickedSkill(user, targets[0] ?? user, skill, picked, commandKind, powerMultiplier, afterTarget);
      return;
    }
    // 스케치(렐름): 대상 적의 기술 하나를 그려 그 적에게 쓴다. hitRate 가 성공률.
    if (skill?.effect.kind === "sketch") {
      const primary = targets[0] ?? user;
      if (rng() * 100 >= (combinedSkillHitRate(skill) ?? 100)) {
        recordAction({ userRecordId: user.recordId, targetId: primary.id, hit: false, amount: 0, critical: false, skillName: skill.name, skillId: skill.id }, "miss", commandKind);
        return;
      }
      const pool = sketchableSkills(options.project, [...primary.skillIds, ...(primary.enemyActions ?? []).map((action) => action.skillId).filter(Boolean)]);
      const picked = pool.length > 0 ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : undefined;
      castPickedSkill(user, primary, skill, picked, commandKind, powerMultiplier, afterTarget);
      return;
    }
    // 폭주(가우): 몬스터 하나의 모습이 되어 전투 끝까지 그 몬스터의 행동 표대로 자동 행동한다.
    if (skill?.effect.kind === "rage") {
      beginRage(user, skill, skill.effect.enemyIds, commandKind);
      return;
    }
    if (skill?.effect.kind === "shuffleParty") {
      shuffleBattleParty(user, targets[0] ?? user, skill, commandKind);
      return;
    }
    if (skill?.effect.kind === "forceSwitch") {
      forceSwitchTargets(user, targets, skill, commandKind);
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
    const randomHits = skill?.hitSequence ? undefined : rollMultiHitCount(skill?.multiHit, rng);
    const sequence = skill?.hitSequence ?? (randomHits ? Array.from({ length: randomHits }, () => 1) : [1]);
    let landedHits = 0;
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
      if (lastActionResult?.hit && (lastActionResult.amount ?? 0) > 0) landedHits += 1;
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
    if (randomHits && landedHits > 0) recordSpecial(user, target, `${landedHits}번 맞았다!`);
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
      const latest = [...timeline].reverse().find(
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

  /**
   * 연계기 comboCombinedStats: 피해·치유 계산 동안만 시전자의 공격력·마력을 연계 참가자 전원의 합으로 바꾼다.
   * 시전자 객체를 잠깐 바꿨다 되돌리는 방식이라 계산 안의 모든 경로(수식·상태 배율·예측)가 같은 값을 본다.
   */
  function applySkillHit(
    user: MutableBattler,
    target: MutableBattler,
    skillId: SkillId,
    commandKind: BattleTimelineEntrySnapshot["commandKind"] = "skill",
    hitMultiplier = 1,
  ): void {
    const comboSkill = lookupSkill(skillId);
    const combo = comboSkill?.comboCombinedStats ? comboActorIdsOf(comboSkill) : undefined;
    if (!combo || !combo.includes(user.recordId as ActorId)) {
      applySkillHitCore(user, target, skillId, commandKind, hitMultiplier);
      return;
    }
    const members = activeActors().filter((battler) => combo.includes(battler.recordId as ActorId) && (battler === user || battler.hp > 0));
    const originalAttack = user.attackPower;
    const originalMind = user.mind;
    user.attackPower = members.reduce((sum, member) => sum + (member === user ? originalAttack : member.attackPower), 0);
    user.mind = members.reduce((sum, member) => sum + (member === user ? originalMind : member.mind), 0);
    try {
      applySkillHitCore(user, target, skillId, commandKind, hitMultiplier);
    } finally {
      user.attackPower = originalAttack;
      user.mind = originalMind;
    }
  }

  function applySkillHitCore(
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
    // 능력치 단계의 공격/특수공격·방어/특수방어 칸: 마법 속성 기술이거나 마력 계열 효과면 특수 쪽(gen1 경로와 같은 분류).
    const stageKind: "attack" | "mind" = statistic === "mind" || isMagicalElement(skill?.elementId) ? "mind" : "attack";
    const hpBefore = target.hp;
    const mpBefore = target.mp;
    const targetMaxHpBefore = target.maxHp;
    // 무기 공명(SkillRecord.weaponAffinity): 맞는 계열 무기를 들었으면 피해·회복 배율이 오른다.
    const affinity = weaponAffinityMultiplier(user, skill);
    // 약점 공략(SkillRecord.exploitStates): 대상이 그 상태에 걸려 있으면 피해가 오른다(피해 기술만).
    const exploited = effectKind === "damage" ? exploitedStateIds(skill, target) : [];
    const exploit = exploited.length > 0 ? 1 + (skill!.exploitStates!.bonusPercent / 100) : 1;
    const rawResult = applySkillLike(user, target, {
      power,
      statistic,
      effect: damageEffectKind(effectKind),
      affects,
      // RM2K3 스킬 성공률: hitRate(명중률)와 successRate(성공률)를 합성한 단일 판정.
      // 두 값 모두 100 이 기본이라 기존 데이터의 기대 명중률은 변하지 않는다.
      // 회피 상태는 물리(공격력 계열) 피해 기술만 피한다.
      hitRate: effectKind === "damage" ? withAccuracyStages(statistic === "attack" ? withEvasion(combinedSkillHitRate(skill), user, target) : combinedSkillHitRate(skill), user, target) : combinedSkillHitRate(skill),
      damageFormula: skill?.damageFormula,
      // 피해 계열 받는 피해 %(적 damageTypeRates · 상태 damageTypeRates): 마력 계열 = 마법, 그 밖 = 물리.
      hitMultiplier:hitMultiplier*(effectKind==="damage"?gimmickDamageMultiplier(user,target)*damageTypeMultiplier(options.project,statistic==="mind"?"magic":"physical",target,skill?.elementId):1)*(affinity?affinity:1)*exploit,
      criticalMultiplier: skill?.criticalMultiplier,
      variance: skill?.variance,
      criticalRate: skill?.criticalRate ?? criticalRateFor(user),
      elementMultiplier: elementMultiplierFor(skill?.elementId, user, target) * emotionDamageMultiplier(options.project, user, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, user, stageKind),
      targetDefenseMultiplier: defenseMultiplierForStatesByKind(options.project, target, statistic, stageKind),
      useMagicalDefense: isMagicalElement(skill?.elementId),
      gen1AttackerLevel: gen1AttackerLevel(user),
      rng,
    });
    // 좀비: HP 회복은 같은 양의 피해가 된다(MP 회복·부활 기술은 그대로).
    const zombieHeal = effectKind === "healing" && affects === "hp" && rawResult.hit && rawResult.amount > 0
      && hpBefore > 0 && invertsHealingForStates(options.project, target);
    if (zombieHeal) target.hp = Math.max(0, hpBefore - rawResult.amount);
    const invertedResult = zombieHeal ? { ...rawResult, amount: hpBefore - target.hp } : rawResult;
    const adjusted=effectKind==="damage"?absorbGimmickDamage(user,target,skill,hpBefore,mpBefore,invertedResult):invertedResult;
    const result = effectKind === "damage" && affects !== "mp" ? redirectDamageToMp(target, hpBefore, adjusted) : adjusted;
    if (effectKind === "damage" && affects === "hp") noteDamageHit(user, target, result, targetMaxHpBefore, elementMultiplierFor(skill?.elementId, user, target));
    const timelineKind: BattleTimelineEntrySnapshot["kind"] = !result.hit
      ? "miss"
      : zombieHeal
        ? "damage"
        : effectKind === "healing" || result.amount < 0
          ? "healing"
          : effectKind === "damage"
            ? "damage"
            : "action";
    recordAction(
      {
        userRecordId: user.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical, skillName: skill?.name, skillId: skill?.id,
        ...(effectKind === "damage" && result.hit ? effectivenessField(battleEffectivenessMultiplier(options.project, skill?.elementId, target) * damageTypeMultiplier(options.project, statistic === "mind" ? "magic" : "physical", target, skill?.elementId)) : {}),
        ...(effectKind === "damage" && result.hit ? partsField(effectivenessParts(options.project, skill?.elementId, statistic === "mind" ? "magic" : "physical", target)) : {}),
        ...(affinity > 1 && result.hit && (effectKind === "damage" || effectKind === "healing") ? { weaponAffinity: true } : {}),
        ...(exploit > 1 && result.hit ? { exploit: true } : {}),
      },
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
    if (result.hit && effectKind === "damage" && affects === "hp") applySkillRecoilAndFlinch(user, target, skill, result.amount, commandKind);
    if (result.hit && effectKind === "damage" && statistic === "attack") queueStateCounter(user, target);
    // 피격에 의한 상태 해제(수면 등)를 먼저 처리한 뒤, 스킬의 상태 효과를 적용한다.
    // 이 순서라야 이번 스킬로 새로 부여한 상태가 즉시 해제되지 않는다.
    if (result.hit && effectKind === "damage" && result.amount > 0) {
      recoverHitStates(target);
    }
    // 공략한 상태를 깨뜨린다(consume) — 기술 자신의 상태 효과보다 먼저(같은 상태를 다시 거는 기술이면 새로 건다).
    if (result.hit && exploited.length > 0 && skill?.exploitStates?.consume && target.hp > 0) {
      applyStates(user, target, exploited.map((stateId) => ({ stateId, chance: 100, operation: "remove" as const })));
    }
    // 피해 기술로 쓰러뜨린 대상에게는 상태를 걸지 않는다 — 「쓰러뜨렸다!」 다음 「화상에 걸렸다!」가 떴다(fs-battle-2 녹화).
    if (result.hit && !(effectKind === "damage" && target.hp <= 0)) {
      applyStates(user, target, skill?.stateEffects);
      if (effectKind !== "damage" || result.amount > 0) applyStatStageEffects(user, target, skill);
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
    // 자기에게 거는 능력 변화 기술은 빗나가지 않는다(바이트도 쓰지 않는다 — 단계 기술이 없는 게임의 난수열은 그대로).
    const selfStageMove = user === target && (skill?.statStageEffects?.length ?? 0) > 0;
    const accuracyHit = effectKind === "damage" || selfStageMove
      || nextGen1Byte() < scaledGen1Accuracy(
        accuracyByteFromPercent(skill?.hitRate ?? 100),
        user === target ? 0 : statStageOf(user.statStages, "accuracy"),
        user === target ? 0 : statStageOf(target.statStages, "evasion"),
      );
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
          fixedDamage: fixedDamageAmount(skill?.fixedDamage, user.level),
        })
      : !accuracyHit
        ? { hit: false, amount: 0, critical: false, effectiveness: 1 }
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
      ...(effectKind === "damage" && applied.hit && "effectiveness" in applied ? effectivenessField(applied.effectiveness) : {}),
    }, timelineKind, commandKind, effectKind === "healing" || effectKind === "damage" ? affects : undefined);
    if (skill?.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    }
    flushAbilityNotes(user, target);
    // 흡수(drainPercent)는 gen1 규칙에서도 먹는다 — 예전엔 대가만 깎이고 회복은 조용히 빠졌다.
    if (applied.hit && effectKind === "damage") applySkillDrain(user, skill, affects === "mp" ? Math.min(applied.amount, gen1MpBefore - target.mp) : applied.amount, affects, commandKind);
    if (applied.hit && effectKind === "damage" && affects === "hp") applySkillRecoilAndFlinch(user, target, skill, applied.amount, commandKind);
    const defrosted = applied.hit
      && effectKind === "damage"
      && applied.amount > 0
      && defrostTargetWithGen1FireMove(user, target, skill);
    if (applied.hit && effectKind === "damage" && applied.amount > 0 && !usesMagicalDefense(options.project, skill?.elementId)) {
      applyContactAbility(user, target);
    }
    // 피해로 쓰러뜨린 대상에게는 부가 상태·능력 단계를 걸지 않는다 — rm2k3 경로와 같은 계약.
    // 쓰러진 몬스터에게 「화상에 걸렸다!」가 이어지던 결함(amount 는 0보다 커도 HP 는 이미 0).
    const livingStatusTarget = effectKind !== "damage" || (applied.amount > 0 && target.hp > 0);
    if (applied.hit && livingStatusTarget) {
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
    if (applied.hit && livingStatusTarget) applyStatStageEffects(user, target, skill);
    if (applied.hit && skill?.effect?.kind === "switch" && skill.effect.switchId) {
      battleEventState.switches[skill.effect.switchId] = true;
    }
    if (applied.hit && skill?.weather) setBattleWeather(user, target, skill.weather.kind, skill.weather.turns ?? SKILL_WEATHER_DEFAULT_TURNS);
    flushHeldNotes(user, target);
    triggerHeldItem(target);
    if (user !== target) triggerHeldItem(user);
  }

  /** 날씨 기술이 닿았을 때: 같은 날씨가 이미 있으면 실패, 다르면 바꾼다. */
  function setBattleWeather(user: MutableBattler, target: MutableBattler, kind: BattleWeatherState["kind"], turns: number): void {
    if (weather?.kind === kind) {
      recordSpecial(user, target, "하지만 아무 일도 일어나지 않았다!");
      return;
    }
    weather = { kind, turnsLeft: turns };
    recordTimeline({ kind: "special", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, message: WEATHER_START_LINES[kind], weatherKind: kind, weatherAfter: { ...weather } });
  }

  /**
   * 한 라운드가 끝날 때: 날씨 문장 하나, 모래바람·싸라기눈의 피해(해당 타입 제외), 지속 차례 감소, 끝나면 종료 문장.
   * 피해로 쓰러지는 배틀러가 있어 승패가 갈릴 수 있으므로 부르는 쪽이 resolveOutcome 을 이어서 돈다.
   */
  function tickBattleWeather(): void {
    if (!gen1 || !weather || result) return;
    const current = weather;
    beginTimelineAction();
    const anchor = [...activeActors(), ...visibleEnemies()].find((battler) => battler.hp > 0);
    const side = anchor ? battlerSide(anchor) : "actor";
    const next = current.turnsLeft > 1 ? { kind: current.kind, turnsLeft: current.turnsLeft - 1 } : undefined;
    if (next) recordTimeline({ kind: "special", side, message: WEATHER_CONTINUE_LINES[current.kind], weatherKind: current.kind, weatherAfter: next });
    for (const battler of [...activeActors(), ...visibleEnemies()]) {
      if (battler.hp <= 0) continue;
      const amount = weatherResidualDamage(current.kind, battler.maxHp, battlerTypes(options.project, battler).map((typeId) => gen1CanonicalTypeForId(options.project, typeId)));
      if (amount <= 0) continue;
      const dealt = Math.min(battler.hp, amount);
      battler.hp -= dealt;
      recordTimeline({ kind: "stateUpkeep", side: battlerSide(battler), targetId: battler.id, amount: dealt, message: weatherResidualLine(current.kind, battler.name), weatherKind: current.kind });
    }
    weather = next;
    if (!next) recordTimeline({ kind: "special", side, message: WEATHER_END_LINES[current.kind], weatherKind: current.kind, weatherAfter: null });
    resolveOutcome();
  }

  /**
   * 기술의 능력치 단계 효과(울음 −1 공격, 칼춤 +2 공격 …)를 적용한다. chance 는 gen1 이면 카트리지 경계(100% 는 굴리지 않음),
   * 그 밖은 rng 로 굴린다. 이미 한계(±6)면 「더 이상 오르지 않는다!」 한 줄만 남긴다. 변화는 special 엔트리(statStage 포함)로 기록해
   * 화면이 문장과 같은 박자에 단계 알약을 바꾼다.
   */
  function applyStatStageEffects(
    user: MutableBattler,
    target: MutableBattler,
    skill: ReturnType<typeof lookupSkill>,
  ): void {
    for (const effect of skill?.statStageEffects ?? []) {
      const subject = effect.target === "self" ? user : target;
      if (subject.hp <= 0) continue;
      const chance = effect.chance ?? 100;
      if (chance < 100) {
        const passed = gen1 ? gen1EffectChanceSucceeds(chance, nextGen1Byte) : rng() * 100 < chance;
        if (!passed) continue;
      }
      const shifted = shiftStatStage(subject.statStages, effect.stat, effect.stages);
      subject.statStages = shifted.stages;
      recordTimeline({
        kind: "special",
        side: battlerSide(user),
        userRecordId: user.recordId,
        targetId: subject.id,
        message: statStageMessage(subject.name, shifted.change),
        statStage: { stat: effect.stat, before: shifted.change.before, after: shifted.change.after, requested: shifted.change.requested },
      });
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

  /** 상성 배율을 결과·타임라인에 싣는다 — 1(보통)이면 싣지 않아 기존 결과 모양이 그대로다. */
  /** 무기 공명 배율 — 기술이 요구하는 계열을 시전자의 장비 공격 속성(attackElementIds)이 갖고 있으면 1 + bonus%. */
  /** 약점 공략 — 대상이 지금 걸린 상태 중 기술이 노리는 것(exploitStates.stateIds). 없으면 빈 배열. */
  function exploitedStateIds(skill: SkillRecord | undefined, target: MutableBattler): string[] {
    const exploit = skill?.exploitStates;
    if (!exploit || !(exploit.bonusPercent > 0)) return [];
    return exploit.stateIds.filter((stateId) => target.stateIds.includes(stateId));
  }

  function weaponAffinityMultiplier(user: MutableBattler, skill: SkillRecord | undefined): number {
    const affinity = skill?.weaponAffinity;
    if (!affinity || !(affinity.bonusPercent > 0)) return 1;
    const wanted = affinity.elementIds?.length ? affinity.elementIds : skill?.elementId ? [skill.elementId] : [];
    const held = user.equipmentEffects?.attackElementIds ?? [];
    return wanted.some((id) => held.includes(id)) ? 1 + affinity.bonusPercent / 100 : 1;
  }

  function partsField(parts: readonly EffectivenessPart[]): { effectivenessParts?: readonly EffectivenessPart[] } {
    return parts.length > 0 ? { effectivenessParts: parts } : {};
  }
  function effectivenessField(multiplier: number): { effectiveness?: number } {
    return Number.isFinite(multiplier) && multiplier !== 1 ? { effectiveness: multiplier } : {};
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
    // 슬롯 id 는 그 칸 하나. 적 레코드 id 로 부르면 아직 숨어 있는 같은 적 중 첫 칸을 드러낸다 —
    // 같은 적을 두 번 부르는 「하나 더」 소환이 이미 나온(또는 쓰러진) 첫 칸만 다시 집어 아무도 나오지 않았다.
    const enemy = enemies.find((entry) => entry.id === target)
      ?? enemies.find((entry) => entry.recordId === target && entry.hidden)
      ?? enemies.find((entry) => entry.recordId === target);
    if (!enemy?.hidden) return;
    enemy.hidden = false;
    enemy.gauge = 0;
    registerGen1Enemy(enemy);
  }

  function visibleEnemies(): readonly MutableBattler[] {
    if (!singleFileEnemies) return enemies.filter((enemy) => !enemy.hidden);
    const active = enemies.find((enemy) => enemy.id === activeGen1EnemyId);
    return active && !active.hidden ? [active] : [];
  }

  /** 한 마리씩 싸우는 전투에서 이미 쓰러져 물러난 적. 화면은 그 쓰러짐 비트(「상대 ○○는 쓰러졌다!」·HP 바)를
   *  재생할 때까지 이 적을 들고 있어야 한다 — 없으면 쓰러짐 문장·연출 없이 다음 몬스터 위에 남았다(2026-10-07 관장전). */
  function departedEnemiesSnapshot(poseContext: Parameters<typeof battlerSnapshot>[2]): { departedEnemies?: BattleBattlerSnapshot[] } {
    if (!singleFileEnemies) return {};
    const departed = gen1EnemyOrderIds
      .filter((enemyId) => enemyId !== activeGen1EnemyId)
      .map((enemyId) => enemies.find((enemy) => enemy.id === enemyId))
      .filter((enemy): enemy is MutableBattler => Boolean(enemy && enemy.hp <= 0 && !enemy.hidden));
    return departed.length ? { departedEnemies: departed.map((enemy) => battlerSnapshot(enemy, undefined, poseContext)) } : {};
  }

  function registerGen1Enemy(enemy: MutableBattler): void {
    if (!singleFileEnemies) return;
    if (!gen1EnemyOrderIds.includes(enemy.id)) gen1EnemyOrderIds.push(enemy.id);
    if (!activeGen1EnemyId) activeGen1EnemyId = enemy.id;
  }

  function promoteNextGen1Enemy(): boolean {
    if (!singleFileEnemies) return false;
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

  /** 게이지가 차는 아군 — 한 턴 비용으로 막 들어온 팀은 적이 한 번 행동할 때까지 쉰다. */
  function chargingActors(): readonly MutableBattler[] {
    const rested = teamResting.size === 0 ? activeActors() : activeActors().filter((actor) => !teamResting.has(actor.recordId));
    return heldForCombo.size === 0 ? rested : rested.filter((actor) => !heldForCombo.has(actor.recordId));
  }

  function reserveActors(): readonly MutableBattler[] {
    const active = new Set(activeActorIds);
    return actors.filter((actor) => !active.has(actor.recordId));
  }

  function switchCandidateActors(): readonly MutableBattler[] {
    // 팀 교대 전투의 개별 교체는 같은 팀 안에서만 — 다른 팀은 「팀 교대」 명령으로만 들어온다.
    const sameTeam = activeTeamId ? new Set(battleTeams?.find((team) => team.id === activeTeamId)?.actorIds ?? []) : undefined;
    return reserveActors().filter((actor) => actor.hp > 0 && (!sameTeam || sameTeam.has(actor.recordId as ActorId)));
  }

  function actorFitToFight(actor: MutableBattler): boolean {
    return actor.hp > 0 && !isBattlerIncapacitated(options.project, actor);
  }

  /** 이 팀으로 교대할 수 있는가: 지금 팀이 아니고, 싸울 수 있는 구성원이 있다. */
  function canSwapToTeam(teamId: string): boolean {
    if (!battleTeams || teamId === activeTeamId) return false;
    const team = battleTeams.find((entry) => entry.id === teamId);
    return Boolean(team && team.actorIds.some((id) => {
      const actor = actors.find((entry) => entry.recordId === id);
      return actor !== undefined && actorFitToFight(actor);
    }));
  }

  /**
   * 활성 팀을 바꾼다. 들어오는 팀: 싸울 수 있는 구성원만(앞에서 activeSlots 명). 비용은 teamSwapCost —
   * free 는 게이지 가득(바로 행동), gauge 는 0, turn 은 0 + 적이 한 번 행동할 때까지 쉼. 나가는 팀의 게이지는 유지하지 않는다.
   */
  function swapActiveTeam(toTeamId: string, userRecordId: ActorId | undefined, cost: TeamSwapCost = teamSwapCost): boolean {
    if (!canSwapToTeam(toTeamId)) return false;
    const incoming = battleTeams!.find((team) => team.id === toTeamId)!;
    const incomingFit = incoming.actorIds
      .map((id) => actors.find((entry) => entry.recordId === id))
      .filter((actor): actor is MutableBattler => actor !== undefined && actorFitToFight(actor))
      .slice(0, activeSlots);
    for (const outgoing of activeActors()) {
      outgoing.gauge = 0;
      outgoing.defending = false;
    }
    activeTeamId = toTeamId;
    activeActorIds = incomingFit.map((actor) => actor.recordId);
    teamResting.clear();
    for (const actor of incomingFit) {
      actor.defending = false;
      actor.gauge = cost === "free" ? 100 : 0;
      if (cost === "turn") teamResting.add(actor.recordId);
    }
    recordTimeline({
      kind: "switch",
      side: "actor",
      userRecordId: userRecordId ?? incomingFit[0]!.recordId,
      targetId: incomingFit[0]!.id,
      commandKind: "switch",
      success: true,
    });
    markActiveParticipants();
    return true;
  }

  /** 지금 팀이 전멸(쓰러짐·행동 불가)했고 싸울 수 있는 다른 팀이 있으면 그 팀을 자동으로 들인다. */
  function rotateWipedTeam(): boolean {
    if (!battleTeams || !activeTeamId) return false;
    // 같은 팀 대기 구성원이 남아 있으면 개별 교체(강제 교체)가 먼저다.
    const members = battleTeams.find((team) => team.id === activeTeamId)?.actorIds ?? [];
    if (members.some((id) => { const member = actors.find((entry) => entry.recordId === id); return member !== undefined && actorFitToFight(member); })) return false;
    const next = battleTeams.find((team) => canSwapToTeam(team.id));
    return next ? swapActiveTeam(next.id, undefined, teamSwapCost === "free" ? "free" : "gauge") : false;
  }

  function teamSnapshots(): readonly BattleTeamSnapshot[] | undefined {
    if (!battleTeams) return undefined;
    return battleTeams.map((team) => ({
      id: team.id,
      name: team.name,
      actorIds: team.actorIds,
      active: team.id === activeTeamId,
      canSwapIn: canSwapToTeam(team.id),
      alive: team.actorIds.filter((id) => (actors.find((entry) => entry.recordId === id)?.hp ?? 0) > 0).length,
    }));
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
      resetVolatileStatesOnSwitchOut(outgoing);
      // 교체로 빠지면 능력치 단계가 사라진다(포켓몬 규칙). 다시 나와도 0 단계에서 시작한다.
      delete outgoing.statStages;
    }
    candidate.gauge = 0;
    candidate.defending = false;
    delete candidate.statStages;
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

  /** 교체해서 빠지면 혼란은 풀리고 맹독 카운터는 처음(1/16)부터 다시 센다. */
  function resetVolatileStatesOnSwitchOut(battler: MutableBattler): void {
    if (!gen1) return;
    for (const stateId of [...battler.stateIds]) {
      const record = options.project.database.states.find((state) => state.id === stateId);
      if (record?.volatileStatus) {
        battler.stateIds = battler.stateIds.filter((id) => id !== stateId);
        delete battler.stateTurns[stateId];
      } else if (record?.gen1MajorStatus === "toxic") battler.stateTurns[stateId] = 0;
    }
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
    // 지금 팀이 전멸했지만 다른 팀이 살아 있으면 패배가 아니다 — 다음 팀이 들어온다.
    rotateWipedTeam();
    if (singleFileEnemies) {
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
      syncStateGrantedSkills(battler);
    }
  }

  function battlerAllSkillIds(battler: MutableBattler): readonly SkillId[] {
    return [...battler.skillIds, ...(battler.equipmentEffects?.grantedSkillIds ?? [])];
  }

  function accumulateRewards(): void {
    const rawCollected = collectBattleRewards(options.project, enemies, rng, Math.max(1, rewardTurn), battleEventState.switches);
    const collected = {
      ...rawCollected,
      exp: scaleByDifficulty(rawCollected.exp, difficultyRate(options.project.system, sessionState, "expRate")),
      gold: scaleByDifficulty(rawCollected.gold, difficultyRate(options.project.system, sessionState, "goldRate")),
    };
    // 트레이너 상금 공식(system.rewardPolicy.trainerPrizePerLevel): 상대 마지막 몬스터 레벨 × 값. 난이도 배율(goldRate)은 그대로 곱한다.
    const prizePerLevel = options.project.system.rewardPolicy?.trainerPrizePerLevel ?? 0;
    if (prizePerLevel > 0 && troopRecord.trainerBattle === true) {
      const lastEnemy = [...enemies].reverse().find((enemy) => !enemy.hidden && enemy.captured !== true);
      collected.gold = scaleByDifficulty(Math.max(0, Math.trunc(lastEnemy?.level ?? rawCollected.enemyLevel ?? 1)) * prizePerLevel, difficultyRate(options.project.system, sessionState, "goldRate"));
    }
    rewards.exp = collected.exp;
    rewards.gold = collected.gold;
    rewards.enemyLevel = collected.enemyLevel;
    rewards.items = [...collected.items];
    // 폭주 기술을 아는 배우가 있을 때만 쓰러뜨린 몬스터 목록을 싣는다(없는 프로젝트는 스냅샷 모양 그대로).
    if (!usePartyMonsters && actors.some((actor) => battlerAllSkillIds(actor).some((id) => lookupSkill(id)?.effect.kind === "rage"))) {
      const ids = [...new Set(enemies.filter((enemy) => !enemy.hidden && enemy.captured !== true).map((enemy) => String(enemy.recordId)))];
      if (ids.length > 0) rewards.rageEnemyIds = ids;
    }
    rewards.levelUps = usePartyMonsters ? [] : computeLevelUpPreview(collected.exp, collected.enemyLevel);
    rewards.monsterLevelUps = computeMonsterLevelUpPreview(collected.exp);
    // 노력치(옵트인): 쓰러뜨린 적 종의 evYield 합. 규칙이 꺼져 있거나 얻을 것이 없으면 필드를 두지 않는다(스냅샷 모양 그대로).
    if (usePartyMonsters && monsterStatRulesOf(options.project).evs) {
      const gain = monsterEvYieldOf(enemies.filter((enemy) => !enemy.hidden && enemy.captured !== true && enemy.hp <= 0).map((enemy) => monsterSpeciesForEnemy(options.project, options.project.database.enemies.find((record) => record.id === enemy.recordId))));
      if (gain) rewards.monsterEvGain = gain;
    }
    if (collected.tp && !usePartyMonsters) {
      rewards.tp = collected.tp;
      const techLearned = computeTechLearnedPreview(collected.tp, rewards.levelUps);
      if (techLearned.length > 0) rewards.techLearned = techLearned;
    }
    // 마석 AP: 같은 보상 대상·같은 함수(computeApLearning)로 미리본다. 습득은 결과 화면의 「기술 습득」 행에 합쳐진다.
    if (collected.ap && !usePartyMonsters) {
      rewards.ap = collected.ap;
      const apLearned = computeApLearnedPreview(collected.ap, rewards.levelUps);
      if (apLearned.length > 0) {
        const merged = rewards.techLearned ?? [];
        for (const entry of apLearned) {
          const existing = merged.find((item) => item.actorId === entry.actorId);
          if (existing) {
            for (const skillId of entry.skillIds) if (!existing.skillIds.includes(skillId)) existing.skillIds.push(skillId);
            existing.viaAp = [...(existing.viaAp ?? []), ...entry.viaAp];
          } else merged.push(entry);
        }
        rewards.techLearned = merged;
      }
    }
  }

  function computeApLearnedPreview(earnedAp: number, levelUps: readonly BattleLevelUpResult[]): { actorId: string; actorName: string; skillIds: SkillId[]; viaAp: SkillId[] }[] {
    const learned: { actorId: string; actorName: string; skillIds: SkillId[]; viaAp: SkillId[] }[] = [];
    const actorIds = rewardActorIds(options.project, battleEventState.partyActorIds ?? actors.map((actor) => actor.recordId), [...participatingActorIds]);
    for (const actorId of new Set(actorIds)) {
      const battler = actors.find((entry) => entry.recordId === actorId);
      if (!battler || battler.hp <= 0) continue;
      const levelUp = levelUps.find((entry) => entry.actorId === actorId);
      const known = [...battler.skillIds, ...(levelUp?.learnedSkillIds ?? []), ...(battleEventState.actorSkillIds?.[actorId] ?? [])];
      const result = computeApLearning(options.project, currentEffectiveEquipment(actorId), earnedAp, sessionState.actorApProgress?.[actorId], known);
      const skillIds = result.learned.map((entry) => entry.skillId);
      if (skillIds.length > 0) learned.push({ actorId, actorName: battler.name, skillIds: [...skillIds], viaAp: skillIds });
    }
    return learned;
  }

  /** 지금(전투 중 장비 교체 포함) 이 배우가 끼고 있는 유효 장비. */
  function currentEffectiveEquipment(actorId: string): ActorInitialEquipment | undefined {
    const record = options.project.database.actors.find((actor) => actor.id === actorId);
    const raw = battleEventState.actorEquipment?.[actorId];
    if (!record || !raw) return actorEquipment.get(actorId as ActorId);
    return effectiveActorEquipment(options.project, record, raw, effectiveActorClassId(options.project, { classOverrides: battleEventState.classOverrides }, actorId));
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
    const plan = monsterExpPlan(options.project.system.rewardPolicy, earnedExp, participantIds, new Set(actors.filter((actor) => actor.hp > 0).map((actor) => actor.recordId)));
    if (options.project.system.rewardPolicy?.expSplitAlive === true && participantIds !== undefined) rewards.monsterExp = plan.exp;
    return previewMonsterExperience(options.project, instances, plan.exp, plan.participantIds);
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
      // 경험치 바닥: 시작 레벨 > 1 이거나 중간 합류해 세션 경험치가 현재 레벨 바닥보다 낮으면 바닥에서 센다 —
      // 적립(battleRewardsToSession)·결과 카드와 같은 기준. 안 그러면 큰 보상에도 레벨이 안 오르고 「다음 Lv까지 0」이 떴다(가혹 검수 r6).
      const record = options.project.database.actors.find((entry) => entry.id === actorId);
      const floor = record ? totalExpForLevel(normalizeActorRecord(record).expCurve, level) : 0;
      const totalExp = Math.max(battleEventState.actorExperience?.[actorId] ?? 0, floor) + adjustedExp;
      const result = computeActorLevelUp(options.project, actorId, level, totalExp, { classOverrides: battleEventState.classOverrides, equipment: currentEffectiveEquipment(actorId) });
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
    performTeamSwap,
    holdForCombo,
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
