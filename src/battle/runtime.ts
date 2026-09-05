import { activeItemEffects, itemAllowsBattle } from "@/project/itemUsage";
// SIZE_OK: Battle runtime keeps turn state, troop-event callbacks, and snapshot
// assembly together so battle-event regressions can verify one state machine.
import type { ActorId, EnemyId, ItemId, ItemRecord, SkillId } from "@/project/types";
import { startStateOf } from "@/project/session";
import { transitionItemState } from "@/project/itemTransitions";
import { isItemActorEligible } from "@/project/itemEligibility";
import { DEFAULT_ANIMATION_ID, DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { actorBattlers, average, battlerSnapshot, enemyBattlers, monsterPartyBattlers, refreshActorBattlerDerivedStats, type MutableBattler } from "@/battle/battleBattlers";
import {
  accuracyByteFromPercent,
  applySkillLike,
  createGen1ByteRng,
  resolveGen1DamagingMove,
  usesGen1Damage,
  usesMagicalDefense,
} from "@/battle/battleDamage";
import { createBattleEventRuntime, type BattleEventRuntimeState } from "@/battle/battleEvents";
import { collectBattleRewards } from "@/battle/battleRewards";
import { computeActorLevelUp } from "@/battle/battleLevelUp";
import { battlerTypes, gen1CanonicalTypeForId, gen1ElementIdForCanonical, gen1TypeModifiersForTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import type { BattleLevelUpResult } from "@/battle/battleLevelUp";
import { expForRewardActor, rewardActorIds } from "@/battle/rewardPolicy";
import { captureItemMultiplier, captureStatusMultiplier, captureSuccessRate, monsterSpeciesForEnemy, previewMonsterExperience, rollMonsterIvs, type MonsterLevelUpPreview } from "@/project/monsterCollection";
import {
  applyStateEffects,
  agilityMultiplierForStates,
  attackMultiplierForStates,
  canBattlerAct,
  clearBattleEndStates,
  defenseMultiplierForStates,
  recoverStatesWhenHit,
  runStateUpkeep,
  stateBehavior,
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
  BattleFlow,
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
import { battleSkillMpCost, battleSkillUseFailure, consumeBattleSkillResource } from "@/battle/battleSkillUse";
import {
  requestedTargetId,
  resolveBattleTargets,
  targetIdFor,
  targetScopeForCommand,
  type BattleTargetScope,
} from "@/battle/battleTargetResolver";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
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

const FALLBACK_SKILL_POWER = 12;
// SC1 (C1): strict flow round cap. Prevents unbounded recursion when neither
// side can end the battle (e.g. all actors asleep with no auto-recovery and a
// neutered enemy). Exceeding the cap resolves the battle as a stalemate escape.
const STRICT_MAX_ROUNDS = 200;
// m2-108 actionTimes 로 한 라운드에 부여할 수 있는 추가 행동 상한. 라운드 카드밀리(STRICT_MAX_ROUNDS)와
// 같은 이유의 가드다: 행동마다 다시 발화하는 배틀 이벤트 페이지(라운드 중복 제거 밖 조건)가
// 매번 +1 을 주면 한 라운드 루프가 끝나지 않는다.
const STRICT_MAX_EXTRA_ACTIONS_PER_ROUND = 20;

type EnemyActionChoice = {
  readonly skillId: SkillId;
  readonly switchOnAfterAction: { readonly enabled: boolean; readonly switchId?: string };
  readonly switchOffAfterAction: { readonly enabled: boolean; readonly switchId?: string };
  readonly targetIds?: readonly string[];
};

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
      return map[skinId] ?? 1;
    } catch { return 1; }
  })();

  const actorEquipment = new Map(
    options.project.database.actors.map((actor) => [
      actor.id,
      effectiveActorEquipment(
        options.project,
        actor,
        options.party?.equipment?.[actor.id],
        options.party?.classOverrides?.[actor.id] ?? actor.classId
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
        levels: options.party?.levels,
        vitals: options.party?.vitals,
        paramBonuses: options.party?.paramBonuses,
        equipment: Object.fromEntries(actorEquipment),
        skillIds: options.party?.skillIds,
        skillPp: options.party?.skillPp,
        classOverrides: options.party?.classOverrides,
        stateIds: options.party?.stateIds,
        partyActorIds: options.party?.partyActorIds,
      });
  const enemies = enemyBattlers(options.project, troopRecord);
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
  function recordTimeline(entry: Omit<BattleTimelineEntrySnapshot, "sequence">): void {
    timeline.push({ ...entry, sequence: timeline.length });
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
    });
  }
  let result: BattleResult | undefined;
  let escaped = false;
  let turn = 0;
  let currentActorCommandKind: ActorCommand["kind"] | undefined;
  let lastCaptureResult: BattleCaptureResultSnapshot | undefined;
  // 배틀 이벤트 wait 가 적립한 일시정지 시간(ms). tick 이 소진하기 전까지 게이지/턴 진행을 멈춘다.
  let pendingWaitMs = 0;
  let targetSelection: BattleTargetSelectionSnapshot | undefined;
  let strictActorCommands: StrictQueuedActorCommand[] = [];
  let strictPendingActorIds: ActorId[] = [];
  let strictCurrentRoundActions: BattleRoundActionLogSnapshot[] = [];
  let strictCurrentRoundParticipantIds = new Set<ActorId>();
  let strictRoundTimelineStart = 0;
  let strictRoundCount = 0;
  const roundLogs: BattleRoundLogSnapshot[] = [];
  const capturedMonsters: BattleCapturedMonsterSnapshot[] = [];
  const participatingActorIds = new Set<ActorId>();
  const rewards: {
    exp: number;
    gold: number;
    items: ItemId[];
    enemyLevel?: number;
    levelUps: BattleLevelUpResult[];
    monsterLevelUps: MonsterLevelUpPreview[];
  } = { exp: 0, gold: 0, items: [], levelUps: [], monsterLevelUps: [] };
  // 플레이 중에는 현재 세션 상태를 기준으로 한다(에디터 시작 상태가 아니라).
  // sessionState 는 BattleSessionState(런타임) 또는 ProjectSession(에디터 시작 상태).
  // ProjectSession 에는 actorSkillIds 등 런타임 전용 필드가 없으므로 BattleSessionState 로 좁혀 읽는다.
  const rawSessionState = options.sessionState ?? startStateOf(options.project);
  const sessionState = rawSessionState as BattleSessionState;
  const battleEventState: BattleEventRuntimeState = {
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
    inventory: { ...sessionState.inventory },
    itemUseCharges: { ...(sessionState.itemUseCharges ?? {}) },
    gold: typeof sessionState.gold === "number" ? sessionState.gold : 0,
    partyActorIds: [...(sessionState.partyActorIds ?? options.party?.partyActorIds ?? options.project.system.startActorIds)],
    actorSkillIds: Object.fromEntries(
      Object.entries(sessionState.actorSkillIds ?? options.party?.skillIds ?? {}).map(([id, skills]) => [id, [...skills]])
    ),
    actorExperience: { ...(sessionState.actorExperience ?? options.party?.experience ?? {}) },
    actorLevels: { ...(sessionState.actorLevels ?? options.party?.levels ?? {}) },
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
    gameTime: "gameTime" in sessionState ? sessionState.gameTime : undefined,
    npcActivities: "npcActivities" in sessionState ? { ...(sessionState.npcActivities ?? {}) } : undefined,
    friendship: "friendship" in sessionState ? { ...(sessionState.friendship ?? {}) } : undefined,
    relationships: "relationships" in sessionState ? { ...(sessionState.relationships ?? {}) } : undefined,
  };
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
    abortBattle: () => {
      // RM2K3 Abort Battle: 승패 없이 전투 즉시 종료. 런타임은 escape 결과로 매핑한다.
      escaped = true;
      result = "escape";
      phase = "resolved";
    },
    endBattleAsDefeat: () => {
      // 배틀 이벤트 gameOver/killPlayer: 전투를 패배로 즉시 종결(abortBattle 의 defeat 대칭).
      // defeat 이후 처리는 canLose 의미론을 따른다 — canLose=false 면 호스트가 게임 오버 경로,
      // canLose=true 면 패배 복귀(+세션 write-back). 자연 패배(resolveOutcome)와 동일 정리 수행.
      result = "defeat";
      phase = "resolved";
      clearEndOfBattleStates();
    },
    wait: (ms) => {
      // 배틀 이벤트 wait: 전투 흐름을 ms 동안 일시정지. 동기식 실행이라 명령 자체는 계속되지만,
      // gauge: tick 이 pendingWaitMs 를 읽어 소진한다(게이지 흐름은 종전 그대로).
      // strict: 라운드를 동기로 해결하고 tick 이 돌지 않으므로, 일시정지를 타임라인 사실로 남긴다.
      //   시퀀서가 이 엔트리를 만나면 다음 비트를 waitMs 만큼 늦춘다 — JS 스레드를 막지 않고,
      //   이미 해결된 행동 순서도 바꾸지 않는다.
      const waitMs = Math.max(0, Math.trunc(ms));
      if (battleFlow === "strict") {
        if (waitMs > 0) recordTimeline({ kind: "wait", waitMs });
        return;
      }
      pendingWaitMs = Math.max(pendingWaitMs, waitMs);
    },
    // changeEquipment/promoteActor 후 파생 스탯 재계산 — battleBattlers 생성 산식과 공유.
    // HP/MP/게이지/상태이상은 refreshActorBattlerDerivedStats 가 보존(새 최대치 클램프만).
    refreshActorDerivedStats: (battler, refreshOptions) => {
      refreshActorBattlerDerivedStats(options.project, battler, {
        classOverrides: battleEventState.classOverrides,
        paramBonuses: options.party?.paramBonuses?.[battler.recordId],
        equipment: battleEventState.actorEquipment?.[battler.recordId],
        skills: refreshOptions?.refreshSkills
          ? { sessionSkillIds: battleEventState.actorSkillIds?.[battler.recordId] }
          : undefined,
      });
    },
    playAudio: (resourceId, loop) => {
      // 오디오 재생 자체는 호스트가 담당. 런타임은 옵션 콜백으로 위임만 한다.
      options.playAudio?.(resourceId, loop);
    },
    stopAudio: () => {
      options.stopAudio?.();
    },
  });
  markActiveParticipants();

  function battlerSide(battler: MutableBattler): "actor" | "enemy" {
    return actors.some((entry) => entry.id === battler.id) ? "actor" : "enemy";
  }

  function applyUpkeep(battler: MutableBattler): void {
    const upkeep = runStateUpkeep(options.project, battler, rng);
    if (upkeep.hpDamage > 0) {
      recordTimeline({ kind: "stateUpkeep", side: battlerSide(battler), targetId: battler.id, amount: upkeep.hpDamage });
    }
    if (upkeep.hpHealing > 0) {
      recordTimeline({ kind: "stateRecovery", side: battlerSide(battler), targetId: battler.id, amount: upkeep.hpHealing });
    }
    for (const stateId of upkeep.removedStateIds) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "natural" });
    }
  }

  function recoverHitStates(battler: MutableBattler): void {
    for (const stateId of recoverStatesWhenHit(options.project, battler, rng)) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "hit" });
    }
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
    const result = applyStateEffects(options.project, target, effects, rng);
    for (const stateId of result.added) {
      recordTimeline({ kind: "stateAdded", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, stateId, reason: "effect" });
    }
    for (const stateId of result.removed) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, stateId, reason: "effect" });
    }
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
    const resolved = resolveGen1DamagingMove({
      level: user.level ?? 1,
      power: move.power,
      damageClass: magical ? "special" : "physical",
      baseSpeed: gen1BaseSpeed(user),
      criticalRate: move.criticalRate ?? "normal",
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
    const beforeHp = target.hp;
    target.hp = Math.max(0, target.hp - resolved.damage);
    return { hit: true, amount: beforeHp - target.hp, critical: resolved.critical };
  }

  function recordIncapacitated(battler: MutableBattler): void {
    recordTimeline({ kind: "incapacitated", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id });
  }

  function tick(deltaMs: number): void {
    if (battleFlow === "strict") return;
    if (phase !== "charging" || result) return;
    // Visual wait: 배틀 이벤트 연출 대기. 게이지/턴 로직은 그대로 흐르게 하여
    // "연출 때문에 ATB가 멈춘다"는 혼란을 방지. snapshot에 visualWaitMs 노출.
    let visualWaitMs = pendingWaitMs;
    pendingWaitMs = 0;
    void visualWaitMs;
    if (beginForcedSwitchIfNeeded()) return;
    const enemiesInBattle = visibleEnemies();
    const battlerAgilityMultiplier = (battler: MutableBattler): number => agilityMultiplierForStates(options.project, battler);
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
        applyUpkeep(ready.battler);
        resolveOutcome();
        if (result) return;
        if (!canBattlerAct(options.project, ready.battler)) {
          recordIncapacitated(ready.battler);
          ready.battler.gauge = 0;
          phase = "charging";
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
    const forcedActor = forcedSwitchActor();
    if (forcedActor) {
      if (command.kind !== "switch") return;
      if (!switchActiveActor(forcedActor.recordId, command.targetActorId)) return;
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
    applyTroopEvents();
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
    if (battleEvents.consumeExtraActorAction(actor.recordId)) {
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

  function resolvedCommandTargets(user: MutableBattler, command: TargetedActorCommand & { readonly targetEnemyId?: string; readonly targetActorId?: string }) {
    const resolution = resolveBattleTargets({
      scope: commandScope(user, command),
      user,
      actors: activeActors(),
      enemies: visibleEnemies(),
      requestedTargetId: requestedTargetId(command),
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

  function isValidActorCommand(actor: MutableBattler, command: ActorCommand): boolean {
    switch (command.kind) {
      case "attack":
        if (gen1 && actor.skillIds.some((skillId) => battleSkillUseFailure(options.project, actor, skillId) === undefined)) return false;
        break;
      case "defend":
        return true;
      case "escape":
        return options.canEscape;
      case "switch":
        return canSwitchActor(actor.recordId, command.targetActorId);
      case "skill":
        if (battleSkillUseFailure(options.project, actor, command.skillId)) return false;
        break;
      case "item": {
        const item = options.project.database.items.find((record) => record.id === command.itemId);
        if (!item || (battleEventState.inventory[command.itemId] ?? 0) <= 0 || !itemIsBattleUsable(item)) return false;
        // actor/class 제한 체크 — 불일치 시 커맨드 자체를 거부한다 (무효 턴으로 소모 안 함)
        if (!isItemActorEligible(options.project, item, actor.id)) return false;
        break;
      }
      case "capture": {
        const item = options.project.database.items.find((record) => record.id === command.captureItemId);
        if (!item?.captureProfile || item.type !== "special" || !itemAllowsBattle(item) || (battleEventState.inventory[command.captureItemId] ?? 0) <= 0) return false;
        break;
      }
    }
    const resolution = resolvedCommandTargets(actor, command);
    return resolution.targets.length > 0;
  }

  function applyActorCommandEffect(actor: MutableBattler, command: ActorCommand): void {
    currentActorCommandKind = command.kind;
    lastCaptureResult = undefined;
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
        for (const target of targets) applySkill(actor, target, command.skillId, "skill");
        applyGen1Residual(actor);
        break;
      }
      case "item": {
        const item = options.project.database.items.find((record) => record.id === command.itemId);
        if (!item) return;
        const targets = resolvedCommandTargets(actor, command).targets;
        for (const target of targets) applyItem(command.itemId, target, actor);
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

  function applySingleActorAttack(actor: MutableBattler, target: MutableBattler): void {
    if (gen1) {
      applyGen1Struggle(actor, target, "attack");
      return;
    }
    const result = applySkillLike(actor, target, {
      power: actor.attackPower,
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(actor),
      hitRate: normalAttackHitRate(actor, target),
      // RM2K3 통상공격 분산(±20%) — 없으면 매 타격이 완전히 같은 숫자라 도박성이 0이다.
      variance: 20,
      elementMultiplier: normalAttackElementMultiplier(actor, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, actor),
      targetDefenseMultiplier: defenseMultiplierForStates(options.project, target),
      gen1AttackerLevel: gen1AttackerLevel(actor),
      rng,
    });
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
      applyStateEffects(options.project, target, [{ stateId, chance, operation: "add" }], rng);
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
    if (actor.mp < battleSkillMpCost(skill, actor.maxMp)) return { kind: "rejected", reason: "insufficientMp" };

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
    for (const skillTarget of targets) applySkill(actor, skillTarget, skill.id);
    applyTroopEvents();
    resolveOutcome();
    actor.gauge = 0;
    activeActorId = undefined;
    currentActorCommandKind = undefined;
    phase = result ? "resolved" : "charging";
    return { kind: "used", skillId: skill.id };
  }
  function attemptEscape(): void {
    if (!options.canEscape) return;
    // RM2K3 도주: 민첩성 기반 확률(파티 평균 vs 적 평균). 단순화해 절반 확률 + 우위 보정.
    const actorAgi = average(activeActors().filter((a) => a.hp > 0).map((a) => a.agility));
    const enemyAgi = average(visibleEnemies().filter((e) => e.hp > 0).map((e) => e.agility));
    const chance = Math.min(0.95, 0.5 + (actorAgi - enemyAgi) / Math.max(1, enemyAgi) * 0.25);
    if (rng() < chance) {
      escaped = true;
    }
  }

  function beginActorCommand(command: ActorCommandDraft): void {
    if (phase !== "actorCommand" || !activeActorId || result) return;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor) return;
    switch (command.kind) {
      case "defend":
      case "escape":
      case "switch":
        performActorCommand(command);
        return;
      case "skill":
        if (battleSkillUseFailure(options.project, actor, command.skillId)) return;
        beginTargetSelection(command);
        return;
      case "item": {
        const item = options.project.database.items.find((record) => record.id === command.itemId);
        if (!item || (battleEventState.inventory[command.itemId] ?? 0) <= 0 || !itemIsBattleUsable(item)) return;
        beginTargetSelection(command);
        return;
      }
      case "attack":
      case "capture":
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
    strictPendingActorIds = activeActors()
      .filter((actor) => actor.hp > 0 && (gen1 || canBattlerAct(options.project, actor)))
      .map((actor) => actor.recordId);
    for (const actor of actors) actor.gauge = strictPendingActorIds.includes(actor.recordId) ? 100 : 0;
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
    strictPendingActorIds = activeActors()
      .filter((actor) => actor.hp > 0 && (gen1 || canBattlerAct(options.project, actor)))
      .map((actor) => actor.recordId);
    for (const actor of actors) actor.gauge = strictPendingActorIds.includes(actor.recordId) ? 100 : 0;
    if (strictPendingActorIds.length > 0) {
      activeActorId = strictPendingActorIds[0];
      phase = "actorCommand";
      return;
    }
    resolveStrictRound();
  }

  function collectStrictActorCommand(command: ActorCommand): void {
    if (phase !== "actorCommand" || !activeActorId || result) return;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor || actor.hp <= 0) return;
    if (command.kind === "switch" && !canSwitchActor(actor.recordId, command.targetActorId)) return;
    strictActorCommands = [...strictActorCommands, { actorId: actor.recordId, command }];
    strictPendingActorIds = strictPendingActorIds.filter((actorId) => actorId !== actor.recordId);
    actor.gauge = 0;
    activeActorId = strictPendingActorIds[0];
    if (activeActorId) return;
    resolveStrictRound();
  }

  function resolveStrictRound(): void {
    if (result) return;
    phase = "roundResolve";
    targetSelection = undefined;
    activeActorId = undefined;
    currentActorCommandKind = undefined;
    const round = turn + 1;
    // 라운드 큐는 실행 중에도 자란다: m2-108 actionTimes 가 부여한 추가 행동이
    // 같은 라운드의 정렬 규칙에 맞춰 이 배열에 삽입된다(insertStrictExtraAction).
    const actions = strictRoundActions();
    let grantedExtraActions = 0;
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index];
      const order = index + 1;
      if (result) break;
      if (action.side === "actor") {
        if (action.actor.hp <= 0) continue;
        activeActorId = action.actor.recordId;
        const beforeResult = lastActionResult;
        applyActorCommandEffect(action.actor, action.command);
        logStrictAction(round, order, action, beforeResult);
        if (escaped) {
          result = "escape";
          phase = "resolved";
          break;
        }
        applyTroopEvents(round);
        resolveOutcome();
        if (result) continue;
        // m2-108 Action Times+: 같은 라운드 안에서 추가 행동을 준다. 교체는 제외한다 —
        // 교체한 액터는 이미 필드를 떠났고 되돌리는 행동이 되어 버린다.
        if (
          action.command.kind !== "switch"
          && action.actor.hp > 0
          && grantedExtraActions < STRICT_MAX_EXTRA_ACTIONS_PER_ROUND
          && battleEvents.consumeExtraActorAction(action.actor.recordId)
        ) {
          grantedExtraActions += 1;
          insertStrictExtraAction(actions, index + 1, action);
        }
        continue;
      }
      if (action.enemy.hp <= 0 || !visibleEnemies().some((enemy) => enemy.id === action.enemy.id)) continue;
      activeActorId = undefined;
      currentActorCommandKind = undefined;
      const beforeResult = lastActionResult;
      executeEnemyAction(action.enemy, action.action);
      logStrictAction(round, order, action, beforeResult);
      applyTroopEvents(round);
      resolveOutcome();
    }

    completeStrictRound(round);
    if (result) {
      phase = "resolved";
      return;
    }
    // SC1 (C1): iterate to the next round instead of recursing into
    // startStrictRound(). The round cap in startStrictRound bounds the loop.
    startStrictRound();
  }

  function insertStrictExtraAction(actions: StrictQueuedAction[], from: number, action: StrictQueuedAction): void {
    // 추가 행동은 라운드와 동일한 정렬 기준(compareStrictActions)으로 남은 큐에 삽입한다.
    // 이미 해결된 행동은 건드리지 않고(from 이후만 본다), 더 늦은 행동을 추월하지도 않는다.
    let at = from;
    while (at < actions.length && compareStrictActions(action, actions[at]) > 0) at += 1;
    actions.splice(at, 0, action);
  }

  function completeStrictRound(round: number): void {
    for (const actor of actors) actor.defending = false;
    for (const battler of [...actors, ...enemies]) battler.gauge = 0;
    activeActorId = undefined;
    currentActorCommandKind = undefined;
    turn = round;
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
        if (enemy.hp <= 0) return [];
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
    const forcedActor = forcedSwitchActor();
    // Action poses while lastActionResult is live (cleared when the next command phase begins).
    const showActionPose = Boolean(lastActionResult);
    const poseContext = { lastActionResult, showActionPose };
    return {
      phase,
      battleFlow,
      activeActorId,
      activeSlots,
      forcedSwitchActorId: forcedActor?.recordId,
      switchCandidateActorIds: switchCandidateActors().map((actor) => actor.recordId),
      participatingActorIds: [...participatingActorIds],
      actors: activeActors().map((actor, index) => battlerSnapshot(actor, activeActorPosition(index), poseContext)),
      reserveActors: reserveActors().map((actor) => battlerSnapshot(actor, undefined, { showActionPose: false })),
      enemies: enemiesInBattle.map((enemy) => battlerSnapshot(enemy, undefined, poseContext)),
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
    };
  }

  function performEnemyTurn(enemy: MutableBattler): void {
    // 턴 시작 상태 처리(지속 피해/자연 회복).
    if (!gen1) {
      applyUpkeep(enemy);
    resolveOutcome();
    if (result) {
      phase = "resolved";
      return;
    }
    // 행동 불가(수면 등)면 적도 턴을 건너뛴다.
    if (!canBattlerAct(options.project, enemy)) {
      recordIncapacitated(enemy);
      enemy.gauge = 0;
      for (const actor of actors) actor.defending = false;
      turn += 1;
      applyTroopEvents();
      resolveOutcome();
      if (!result && beginForcedSwitchIfNeeded()) return;
      phase = result ? "resolved" : "charging";
      return;
    }
    }
    executeEnemyAction(enemy, chooseEnemyAction(enemy));
    enemy.gauge = 0;
    // 적 턴이 끝나면 아군의 방어(defending) 상태를 해제한다.
    // RM2K3: 방어는 다음 적 턴까지만 유효(1턴 가드).
    for (const actor of actors) actor.defending = false;
    turn += 1;
    applyTroopEvents();
    resolveOutcome();
    if (!result && beginForcedSwitchIfNeeded()) return;
    phase = result ? "resolved" : "charging";
  }

  function executeEnemyAction(enemy: MutableBattler, action: EnemyActionChoice | undefined): void {
    const skillId = action?.skillId;
    if (skillId) {
      const skill = lookupSkill(skillId);
      if (!skill || (!gen1 && battleSkillUseFailure(options.project, enemy, skillId, { requireLearned: false }))) return;
      if (!prepareGen1CombatAction(enemy)) return;
      const requestedTargetId = refreshedEnemyTargetId(enemy, action.targetIds?.[0]);
      const resolution = resolveBattleTargets({
        scope: skill.scope,
        user: enemy,
        actors: activeActors(),
        enemies: visibleEnemies(),
        requestedTargetId,
      });
      const targets = resolution.requiresSelection
        ? resolution.targets
        : resolution.targets;
      if (targets.length === 0) return;
      // Red/Blue non-link opponents do not decrement PP. Player-controlled
      // battlers still use the normal finite-PP path above.
      if (!gen1) consumeBattleSkillResource(options.project, enemy, skillId);
      for (const target of targets) applySkill(enemy, target, skillId, "enemySkill");
      applyEnemyActionSwitchEffects(action);
      applyGen1Residual(enemy);
      return;
    }
    const refreshedTargetId = refreshedEnemyTargetId(enemy, action?.targetIds?.[0]);
    const target = refreshedTargetId
      ? activeActors().find((actor) => actor.id === refreshedTargetId)
      : chooseBasicEnemyTarget(enemy);
    if (!target) return;
    if (!prepareGen1CombatAction(enemy)) return;
    if (gen1) {
      applyGen1Struggle(enemy, target, "enemyAttack");
      applyGen1Residual(enemy);
      return;
    }
    const result = applySkillLike(enemy, target, {
      power: enemy.attackPower,
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(enemy),
      hitRate: normalAttackHitRate(enemy, target),
      // 통상공격 분산 ±20% — 아군 공격(applySingleActorAttack)과 동일 규칙.
      variance: 20,
      attackerStatMultiplier: attackMultiplierForStates(options.project, enemy),
      targetDefenseMultiplier: defenseMultiplierForStates(options.project, target),
      gen1AttackerLevel: gen1AttackerLevel(enemy),
      rng,
    });
    if (result.hit && result.amount > 0) recoverHitStates(target);
    recordAction(
      { userRecordId: enemy.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical },
      result.hit ? "damage" : "miss",
      "enemyAttack",
    );
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

  function applyItem(itemId: ItemId, target: MutableBattler, user: MutableBattler): void {
    const authoredItem = options.project.database.items.find((record) => record.id === itemId);
    const item = authoredItem ? activeItemEffects(authoredItem) : undefined;
    if (!item) return;
    const count = battleEventState.inventory[itemId] ?? 0;
    if (count <= 0) return;
    if (!itemIsBattleUsable(item)) return;
    if (!isItemActorEligible(options.project, item, user.monsterInstanceId ? undefined : user.recordId, user.classId)) return;

    const skillId = item.activateSkillId ?? item.skillId;
    const usesNativeMedicineEffects = itemUsesNativeBattleEffects(item);
    if (usesNativeMedicineEffects) {
      applyItemRecovery(user, target, item);
      applyStates(user, target, itemStateEffectsForBattle(item));
    } else if (skillId) {
      applySkill(user, target, skillId, "item");
    } else {
      applyItemRecovery(user, target, item);
      applyStates(user, target, itemStateEffectsForBattle(item));
    }

    if (item.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, item.animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    } else if (skillId && !usesNativeMedicineEffects) {
      // skill path already sets lastAnimation when the skill has animationId
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
    if (!itemAllowsBattle(item) || item.captureProfile) return false;
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
    recordAction({
      userRecordId: user.recordId,
      targetId: target.id,
      hit: true,
      amount: (target.hp - beforeHp) + (target.mp - beforeMp),
      critical: false,
    }, "healing", "item");
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
    if (!item?.captureProfile || item.type !== "special" || !itemAllowsBattle(item) || count <= 0) {
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

  function consumeSkillMp(user: MutableBattler, skillId: SkillId): void {
    const skill = lookupSkill(skillId);
    if (!skill) return;
    const cost = battleSkillMpCost(skill, user.maxMp);
    if (cost > 0) user.mp -= cost;
  }

  function chooseEnemyAction(enemy: MutableBattler): EnemyActionChoice | undefined {
    const actionTurn = turn + 1;
    const plans = (enemy.enemyActions ?? [])
      .filter((action) => enemyActionConditionMet(action.condition, actionTurn))
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
        const target = pickBestByUtility(resolution.candidates, (candidate) => enemySkillUtility(enemy, candidate, skill));
        if (!target) return [];
        const utility = enemySkillUtility(enemy, target, skill);
        const score = utility > 0 ? Math.max(1, action.priority) * 10 + utility : -1000 + Math.max(1, action.priority);
        return [{ action: { ...action, targetIds: [target.id] }, score }];
      });
    if (plans.length === 0) {
      if (gen1) {
        const learnedPlans = enemy.skillIds.flatMap((skillId) => {
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
    return pickBestByUtility(activeActors().filter((actor) => actor.hp > 0), (target) => enemyDamageUtility(enemy, target));
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

  function enemySkillUtility(user: MutableBattler, target: MutableBattler, skill: NonNullable<ReturnType<typeof lookupSkill>>): number {
    if (skill.effect.kind === "damage") {
      return enemyDamageUtility(user, target, skill.power, skill.effect.statistic, skill.elementId);
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

  function enemyActionConditionMet(condition: { readonly kind: "always" } | { readonly kind: "turn"; readonly start: number; readonly interval: number }, actionTurn: number): boolean {
    if (condition.kind === "always") return true;
    if (actionTurn < condition.start) return false;
    return (actionTurn - condition.start) % condition.interval === 0;
  }

  function applyEnemyActionSwitchEffects(action: { readonly switchOnAfterAction: { readonly enabled: boolean; readonly switchId?: string }; readonly switchOffAfterAction: { readonly enabled: boolean; readonly switchId?: string } }): void {
    if (action.switchOnAfterAction.enabled && action.switchOnAfterAction.switchId) {
      battleEventState.switches[action.switchOnAfterAction.switchId] = true;
    }
    if (action.switchOffAfterAction.enabled && action.switchOffAfterAction.switchId) {
      battleEventState.switches[action.switchOffAfterAction.switchId] = false;
    }
  }

  function applySkill(
    user: MutableBattler,
    target: MutableBattler,
    skillId: SkillId,
    commandKind: BattleTimelineEntrySnapshot["commandKind"] = "skill",
  ): void {
    const skill = lookupSkill(skillId);
    if (gen1) {
      applyGen1Skill(user, target, skill, commandKind);
      return;
    }
    // 기본 "공격" 스킬(skill_attack)은 통상공격을 표현하는 스킬이다. 그 위력은 고정 10 이 아니라
    // 시전자의 공격력에서 나와야 한다 — 플레이어 통상공격 명령은 이미 attackPower 를 쓴다.
    //
    // 이 한 줄이 없으면 적 220종 전부(authored action 이 모두 skill_attack 경유, 폴백 0종)의 피해가
    // `10 + floor(공/2) − floor(방/2)` 로 계산된다. 주인공 방어 72 → −36 이라
    // 공격 33 짜리 적이 정확히 0 을 때리고, 기본 트룹 3종 전부 피해 0 · 승률 1.0 이 된다(실측).
    const power = skillId === DEFAULT_SKILL_ID
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
    const result = applySkillLike(user, target, {
      power,
      statistic,
      effect: effectKind,
      affects,
      // RM2K3 스킬 성공률: hitRate(명중률)와 successRate(성공률)를 합성한 단일 판정.
      // 두 값 모두 100 이 기본이라 기존 데이터의 기대 명중률은 변하지 않는다.
      hitRate: combinedSkillHitRate(skill),
      variance: skill?.variance,
      criticalRate: criticalRateFor(user),
      elementMultiplier: elementMultiplierFor(skill?.elementId, user, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, user),
      targetDefenseMultiplier: defenseMultiplierForStates(options.project, target),
      useMagicalDefense: isMagicalElement(skill?.elementId),
      gen1AttackerLevel: gen1AttackerLevel(user),
      rng,
    });
    const timelineKind: BattleTimelineEntrySnapshot["kind"] = !result.hit
      ? "miss"
      : effectKind === "healing" || result.amount < 0
        ? "healing"
        : effectKind === "damage"
          ? "damage"
          : "action";
    recordAction(
      { userRecordId: user.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical, skillName: skill?.name },
      timelineKind,
      commandKind,
    );
    if (skill?.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    }
    // 피격에 의한 상태 해제(수면 등)를 먼저 처리한 뒤, 스킬의 상태 효과를 적용한다.
    // 이 순서라야 이번 스킬로 새로 부여한 상태가 즉시 해제되지 않는다.
    if (result.hit && effectKind === "damage" && result.amount > 0) {
      recoverHitStates(target);
    }
    if (result.hit) {
      applyStates(user, target, skill?.stateEffects);
    }
    if (result.hit && skill?.effect?.kind === "switch" && skill.effect.switchId) {
      // RM2K3 스위치형 스킬: 명중 시 지정 스위치를 ON으로 만든다.
      battleEventState.switches[skill.effect.switchId] = true;
    }
  }

  // 스킬 명중률(hitRate)과 성공률(successRate)을 곱해 0~100 판정 확률로 합성한다.
  // successRate 는 감사 A12 에서 "편집만 되고 전투에 미반영"으로 확인된 필드다.
  function applyGen1Skill(
    user: MutableBattler,
    target: MutableBattler,
    skill: ReturnType<typeof lookupSkill>,
    commandKind: BattleTimelineEntrySnapshot["commandKind"],
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
    const applied = effectKind === "damage"
      ? applyExactGen1Damage(user, target, {
          power,
          elementId: skill?.elementId,
          hitRate: skill?.hitRate,
          criticalRate: skill?.gen1CriticalRate,
        })
      : !accuracyHit
        ? { hit: false, amount: 0, critical: false }
        : applySkillLike(user, target, {
            power,
            statistic,
            effect: effectKind,
            affects,
            hitRate: 100,
            variance: skill?.variance,
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
    }, timelineKind, commandKind);
    if (skill?.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
      attachAnimationToLatestTimeline(lastAnimation);
    }
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
    if (!elementId) return 1;
    const element = options.project.database.elements?.find((entry) => entry.id === elementId);
    // Prefer battler.speciesId paths so party monsters (recordId=instanceId) still get type chart + STAB.
    const typeMultiplier = typeChartMultiplierForTypes(
      options.project,
      elementId,
      battlerTypes(options.project, user),
      battlerTypes(options.project, target),
    );
    if (!element?.damageMultipliers) return typeMultiplier;
    // target 이 enemy 인지 actor 인지 원본 레코드에서 elementRates 를 찾는다.
    const enemy = options.project.database.enemies.find((entry) => entry.id === target.recordId);
    const actor = options.project.database.actors.find((entry) => entry.id === target.recordId);
    const rates = enemy?.elementRates ?? actor?.elementRates;
    if (!rates) return typeMultiplier;
    const grade = rates[elementId];
    if (!grade) return typeMultiplier;
    const multiplier = element.damageMultipliers[grade];
    if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) return typeMultiplier;
    // damageMultipliers 는 퍼센트 스케일(A=200,B=150,C=100,D=50,E=0)로 저장된다.
    // 데미지 배율로 쓰려면 100으로 나눈다: C=1.0(중립), A=2.0(약점), D=0.5(내성), E=0(무효),
    // 음수(-100 등)는 흡수(-1.0 = 회복)를 의미한다.
    const equipmentReduction = target.equipmentEffects?.elementalDefenseIds.includes(elementId) ? 0.5 : 1;
    return (multiplier / 100) * equipmentReduction * typeMultiplier;
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

  function applyTroopEvents(eventTurn: number = turn): void {
    const eventResult = battleEvents.applyTroopEvents({ turn: eventTurn, activeActorId, currentActorCommandKind });
    if (!eventResult.forceEscape) return;
    escaped = true;
    result = "escape";
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
    if (options.project.system.battleModel === "gen1") {
      const current = enemies.find((enemy) => enemy.id === activeGen1EnemyId);
      if (!current || current.hp <= 0 || current.hidden) {
        if (promoteNextGen1Enemy()) return;
        if (gen1EnemyOrderIds.length > 0) {
          result = "victory";
          phase = "resolved";
          clearEndOfBattleStates();
          accumulateRewards();
          return;
        }
      }
    }
    const enemiesInBattle = visibleEnemies();
    // 가시 적이 한 명도 없으면(전원 hidden 미출현) 승리로 처리하지 않는다.
    // RM2K3: 숨겨진 적은 필드에 없는 것 — 이벤트로 reveal 되기 전까지 전투는 계속된다.
    // 빈 배열에 every() 가 true 를 반환해 즉시 승리 처리되는 함정을 막는 가드다.
    if (enemiesInBattle.length > 0 && enemiesInBattle.every((enemy) => enemy.hp <= 0)) {
      result = "victory";
      phase = "resolved";
      clearEndOfBattleStates();
      accumulateRewards();
      return;
    }
    if (actors.every((actor) => actor.hp <= 0)) {
      result = "defeat";
      phase = "resolved";
      clearEndOfBattleStates();
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
    const collected = collectBattleRewards(options.project, enemies, rng);
    rewards.exp = collected.exp;
    rewards.gold = collected.gold;
    rewards.enemyLevel = collected.enemyLevel;
    rewards.items = [...collected.items];
    rewards.levelUps = usePartyMonsters ? [] : computeLevelUpPreview(collected.exp, collected.enemyLevel);
    rewards.monsterLevelUps = computeMonsterLevelUpPreview(collected.exp);
  }

  // 몬스터 배틀은 실제 보상과 같은 참가자 원장을 쓰고, 일반 액터 배틀은 동행 몬스터 전원을 미리 본다.
  // reserveActors는 몬스터 배틀의 결과/교대 표시용 스냅샷일 뿐, 참전 전에는 보상 대상이 아니다.
  function computeMonsterLevelUpPreview(earnedExp: number): MonsterLevelUpPreview[] {
    const instances = options.partyMonsters ?? [];
    if (instances.length === 0) return [];
    const participantIds = usePartyMonsters ? [...participatingActorIds] : undefined;
    return previewMonsterExperience(options.project, instances, earnedExp, participantIds);
  }

  // 세션 파티 정보가 주어졌으면 승리 획득 exp 기준 레벨업 미리보기를 계산(결과 화면 표시용).
  // 실제 세션 적립/성장은 battleRewardsToSession 이 담당하며 동일 로직으로 일치한다.
  function computeLevelUpPreview(earnedExp: number, enemyLevel: number | undefined): BattleLevelUpResult[] {
    const party = options.party;
    if (!party) return [];
    const results: BattleLevelUpResult[] = [];
    const seen = new Set<string>();
    const actorIds = rewardActorIds(options.project, party.partyActorIds ?? actors.map((actor) => actor.recordId), [...participatingActorIds]);
    for (const actorId of actorIds) {
      if (seen.has(actorId)) continue;
      seen.add(actorId);
      const level = party.levels[actorId] ?? 1;
      const adjustedExp = expForRewardActor(earnedExp, level, enemyLevel, options.project.system.rewardPolicy);
      const totalExp = (party.experience[actorId] ?? 0) + adjustedExp;
      const result = computeActorLevelUp(options.project, actorId, level, totalExp, { classOverrides: party.classOverrides });
      if (result) results.push(result);
    }
    return results;
  }

  function chooseAutoCommand(): ActorCommand | undefined {
    return chooseAutoBattleCommand(options.project, snapshot(), rng);
  }

  if (battleFlow === "strict") startStrictRound();

  return {
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
      return { kind: "skill", skillId: command.skillId, targetEnemyId: targetId, ...(side === "actor" ? { targetActorId: targetId as ActorId } : {}) };
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
