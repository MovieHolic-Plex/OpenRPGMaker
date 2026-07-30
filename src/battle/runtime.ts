// SIZE_OK: Battle runtime keeps turn state, troop-event callbacks, and snapshot
// assembly together so battle-event regressions can verify one state machine.
import type { ActorId, EnemyId, ItemId, SkillId } from "@/project/types";
import { startStateOf } from "@/project/session";
import { DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { actorBattlers, average, battlerSnapshot, enemyBattlers, monsterPartyBattlers, type MutableBattler } from "@/battle/battleBattlers";
import { applySkillLike, usesMagicalDefense } from "@/battle/battleDamage";
import { createBattleEventRuntime, type BattleEventRuntimeState } from "@/battle/battleEvents";
import { collectBattleRewards } from "@/battle/battleRewards";
import { computeActorLevelUp } from "@/battle/battleLevelUp";
import { battlerTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import type { BattleLevelUpResult } from "@/battle/battleLevelUp";
import { expForRewardActor, rewardActorIds } from "@/battle/rewardPolicy";
import { captureItemMultiplier, captureSuccessRate, monsterSpeciesForEnemy, rollMonsterIvs } from "@/project/monsterCollection";
import {
  applyStateEffects,
  attackMultiplierForStates,
  canBattlerAct,
  clearBattleEndStates,
  defenseMultiplierForStates,
  recoverStatesWhenHit,
  runStateUpkeep,
} from "@/battle/battleStates";
import { chargeBattlers, nextReadyBattler } from "@/battle/battleTurnGauge";
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
  TargetedActorCommand,
} from "@/battle/types";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { hitFeelFromActionResult } from "@/battle/battlePose";
import {
  DEFAULT_BATTLE_FIELD_BACKGROUND_ID,
  normalizeBattleFieldBackgroundId,
} from "@/project/databaseEnemyTroopRecordModel";
import { mulberry32, type Rng } from "@/util/rng";
import { battleSkillMpCost, battleSkillUseFailure } from "@/battle/battleSkillUse";
import {
  requestedTargetId,
  resolveBattleTargets,
  targetIdFor,
  targetScopeForCommand,
  type BattleTargetScope,
} from "@/battle/battleTargetResolver";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";

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
} from "@/battle/types";

const FALLBACK_SKILL_POWER = 12;
// SC1 (C1): strict flow round cap. Prevents unbounded recursion when neither
// side can end the battle (e.g. all actors asleep with no auto-recovery and a
// neutered enemy). Exceeding the cap resolves the battle as a stalemate escape.
const STRICT_MAX_ROUNDS = 200;

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

type StrictQueuedAction =
  | { readonly side: "actor"; readonly index: number; readonly speed: number; readonly actor: MutableBattler; readonly command: ActorCommand }
  | { readonly side: "enemy"; readonly index: number; readonly speed: number; readonly enemy: MutableBattler; readonly action?: EnemyActionChoice };

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
  const battleFlow: BattleFlow = options.battleFlow ?? troopRecord.battleFlow ?? options.project.system.battleFlow ?? "gauge";

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
        faceIndices: options.party?.faceIndices,
        levels: options.party?.levels,
        vitals: options.party?.vitals,
        paramBonuses: options.party?.paramBonuses,
        equipment: options.party?.equipment,
        skillIds: options.party?.skillIds,
        classOverrides: options.party?.classOverrides,
        stateIds: options.party?.stateIds,
        partyActorIds: options.party?.partyActorIds,
      });
  const enemies = enemyBattlers(options.project, troopRecord);
  const activeSlots = normalizeActiveSlots(options.activeSlots ?? troopRecord.activeSlots ?? options.project.system.activeSlots, actors.length);
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
  const rewards: { exp: number; gold: number; items: ItemId[]; enemyLevel?: number; levelUps: BattleLevelUpResult[] } = { exp: 0, gold: 0, items: [], levelUps: [] };
  // 플레이 중에는 현재 세션 상태를 기준으로 한다(에디터 시작 상태가 아니라).
  // sessionState 는 BattleSessionState(런타임) 또는 ProjectSession(에디터 시작 상태).
  // ProjectSession 에는 actorSkillIds 등 런타임 전용 필드가 없으므로 BattleSessionState 로 좁혀 읽는다.
  const rawSessionState = options.sessionState ?? startStateOf(options.project);
  const sessionState = rawSessionState as BattleSessionState;
  const battleEventState: BattleEventRuntimeState = {
    switches: { ...sessionState.switches },
    variables: { ...sessionState.variables },
    inventory: { ...sessionState.inventory },
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
    gameTime: "gameTime" in sessionState ? sessionState.gameTime : undefined,
    friendship: "friendship" in sessionState ? { ...(sessionState.friendship ?? {}) } : undefined,
  };
  const battleEvents = createBattleEventRuntime({
    project: options.project,
    troopRecord,
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
    wait: (ms) => {
      // 배틀 이벤트 wait: 전투 흐름을 ms 동안 일시정지. 동기식 실행이라 명령 자체는 계속되지만,
      // tick 이 pendingWaitMs 를 소진하기 전까지 게이지 충전/턴 진행이 멈춘다.
      pendingWaitMs = Math.max(pendingWaitMs, Math.max(0, Math.trunc(ms)));
    },
    canGrantExtraAction: () => battleFlow !== "strict",
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
    for (const stateId of upkeep.removedStateIds) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "natural" });
    }
  }

  function recoverHitStates(battler: MutableBattler): void {
    for (const stateId of recoverStatesWhenHit(options.project, battler, rng)) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(battler), targetId: battler.id, stateId, reason: "hit" });
    }
  }

  function applyStates(user: MutableBattler, target: MutableBattler, effects: Parameters<typeof applyStateEffects>[2]): void {
    const result = applyStateEffects(options.project, target, effects, rng);
    for (const stateId of result.added) {
      recordTimeline({ kind: "stateAdded", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, stateId, reason: "effect" });
    }
    for (const stateId of result.removed) {
      recordTimeline({ kind: "stateRemoved", side: battlerSide(user), userRecordId: user.recordId, targetId: target.id, stateId, reason: "effect" });
    }
  }

  function recordIncapacitated(battler: MutableBattler): void {
    recordTimeline({ kind: "incapacitated", side: battlerSide(battler), userRecordId: battler.recordId, targetId: battler.id });
  }

  function tick(deltaMs: number): void {
    if (battleFlow === "strict") return;
    if (phase !== "charging" || result) return;
    // 배틀 이벤트 wait 가 적립한 일시정지 시간을 먼저 소비한다.
    // 한 번의 tick 이 wait 시간을 전부 소진하면 남은 시간으로 게이지 충전을 이어간다.
    if (pendingWaitMs > 0) {
      const consumed = Math.min(pendingWaitMs, deltaMs);
      pendingWaitMs -= consumed;
      deltaMs -= consumed;
      if (deltaMs <= 0) return;
    }
    if (beginForcedSwitchIfNeeded()) return;
    const enemiesInBattle = visibleEnemies();
    const ready = nextReadyBattler(activeActors(), enemiesInBattle, deltaMs);
    if (!ready) {
      chargeBattlers(activeActors(), enemiesInBattle, deltaMs);
      return;
    }
    chargeBattlers(activeActors(), enemiesInBattle, ready.timeMs);
    ready.battler.gauge = 100;
    if (ready.kind === "actor") {
      // 턴 시작 상태 처리(지속 피해/자연 회복). 행동 불가(수면 등)면 명령 없이 턴을 넘긴다.
      applyUpkeep(ready.battler);
      resolveOutcome();
      if (result) return;
      if (!canBattlerAct(options.project, ready.battler)) {
        recordIncapacitated(ready.battler);
        ready.battler.gauge = 0;
        phase = "charging";
        return;
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
    return resolveBattleTargets({
      scope: commandScope(user, command),
      user,
      actors: activeActors(),
      enemies: visibleEnemies(),
      requestedTargetId: requestedTargetId(command),
    });
  }

  function isValidActorCommand(actor: MutableBattler, command: ActorCommand): boolean {
    switch (command.kind) {
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
        break;
      }
      case "capture": {
        const item = options.project.database.items.find((record) => record.id === command.captureItemId);
        if (!item?.captureProfile || (battleEventState.inventory[command.captureItemId] ?? 0) <= 0) return false;
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
        applyActorAttack(actor, command);
        break;
      case "skill": {
        const targets = resolvedCommandTargets(actor, command).targets;
        consumeSkillMp(actor, command.skillId);
        for (const target of targets) applySkill(actor, target, command.skillId, "skill");
        break;
      }
      case "item": {
        const item = options.project.database.items.find((record) => record.id === command.itemId);
        if (!item) return;
        const targets = resolvedCommandTargets(actor, command).targets;
        for (const target of targets) applyItem(command.itemId, target, actor);
        if (item.consumable !== false) {
          battleEventState.inventory[command.itemId] = Math.max(0, (battleEventState.inventory[command.itemId] ?? 0) - 1);
        }
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
    const result = applySkillLike(actor, target, {
      power: actor.attackPower,
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(actor),
      hitRate: normalAttackHitRate(actor, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, actor),
      targetDefenseMultiplier: defenseMultiplierForStates(options.project, target),
      rng,
    });
    if (result.hit && result.amount > 0) recoverHitStates(target);
    recordAction(
      { userRecordId: actor.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical },
      result.hit ? "damage" : "miss",
      "attack",
    );
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
    // SC1 (C1): round cap — a strict battle that cannot terminate (e.g. all
    // actors permanently incapacitated and the enemy unable to kill or die)
    // is resolved as a stalemate escape instead of recursing without bound.
    if (strictRoundCount >= STRICT_MAX_ROUNDS) {
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

    for (const battler of [...activeActors(), ...visibleEnemies()]) {
      if (battler.hp > 0) applyUpkeep(battler);
    }
    resolveOutcome();
    if (result) {
      // Round setup can detect a terminal state before commands are collected.
      // It is still a completed strict round and must retain its timeline slice.
      completeStrictRound(turn + 1);
      return;
    }
    if (beginForcedSwitchIfNeeded()) return;

    for (const actor of activeActors()) {
      if (actor.hp > 0 && !canBattlerAct(options.project, actor)) recordIncapacitated(actor);
    }
    strictPendingActorIds = activeActors()
      .filter((actor) => actor.hp > 0 && canBattlerAct(options.project, actor))
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
    for (const actor of activeActors()) {
      if (actor.hp > 0 && !canBattlerAct(options.project, actor)) recordIncapacitated(actor);
    }
    strictPendingActorIds = activeActors()
      .filter((actor) => actor.hp > 0 && canBattlerAct(options.project, actor))
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
    const actions = strictRoundActions();
    for (const [index, action] of actions.entries()) {
      if (result) break;
      if (action.side === "actor") {
        if (action.actor.hp <= 0) continue;
        activeActorId = action.actor.recordId;
        const beforeResult = lastActionResult;
        applyActorCommandEffect(action.actor, action.command);
        logStrictAction(round, index + 1, action, beforeResult);
        if (escaped) {
          result = "escape";
          phase = "resolved";
          break;
        }
        applyTroopEvents(round);
        resolveOutcome();
        continue;
      }
      if (action.enemy.hp <= 0 || !visibleEnemies().some((enemy) => enemy.id === action.enemy.id)) continue;
      activeActorId = undefined;
      currentActorCommandKind = undefined;
      const beforeResult = lastActionResult;
      executeEnemyAction(action.enemy, action.action);
      logStrictAction(round, index + 1, action, beforeResult);
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

  function completeStrictRound(round: number): void {
    for (const actor of actors) actor.defending = false;
    for (const battler of [...actors, ...enemies]) battler.gauge = 0;
    activeActorId = undefined;
    currentActorCommandKind = undefined;
    turn = round;
    finishStrictRoundLog(round);
  }

  function strictRoundActions(): StrictQueuedAction[] {
    const actorActions: StrictQueuedAction[] = strictActorCommands.flatMap((entry) => {
      const actor = actors.find((candidate) => candidate.recordId === entry.actorId);
      if (!actor) return [];
      return [{ side: "actor", index: actors.indexOf(actor), speed: actor.agility, actor, command: entry.command }];
    });
    const enemyActions: StrictQueuedAction[] = visibleEnemies()
      .flatMap((enemy, index) => {
        if (enemy.hp <= 0) return [];
        if (!canBattlerAct(options.project, enemy)) {
          recordIncapacitated(enemy);
          return [];
        }
        return [{ side: "enemy", index, speed: enemy.agility, enemy, action: chooseEnemyAction(enemy) }];
      });
    return [...actorActions, ...enemyActions].sort(compareStrictActions);
  }

  function compareStrictActions(left: StrictQueuedAction, right: StrictQueuedAction): number {
    const leftSwitch = left.side === "actor" && left.command.kind === "switch";
    const rightSwitch = right.side === "actor" && right.command.kind === "switch";
    if (leftSwitch !== rightSwitch) return leftSwitch ? -1 : 1;
    if (left.speed !== right.speed) return right.speed - left.speed;
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
      if (!skill || battleSkillUseFailure(options.project, enemy, skillId, { requireLearned: false })) return;
      const resolution = resolveBattleTargets({
        scope: skill.scope,
        user: enemy,
        actors: activeActors(),
        enemies: visibleEnemies(),
        requestedTargetId: action.targetIds?.[0],
      });
      const targets = resolution.requiresSelection
        ? resolution.targets
        : resolution.targets;
      if (targets.length === 0) return;
      consumeSkillMp(enemy, skillId);
      for (const target of targets) applySkill(enemy, target, skillId, "enemySkill");
      applyEnemyActionSwitchEffects(action);
      return;
    }
    const target = action?.targetIds?.length
      ? activeActors().find((actor) => action.targetIds?.includes(actor.id))
      : chooseBasicEnemyTarget(enemy);
    if (!target) return;
    const result = applySkillLike(enemy, target, {
      power: enemy.attackPower,
      statistic: "attack",
      effect: "damage",
      criticalRate: criticalRateFor(enemy),
      hitRate: normalAttackHitRate(enemy, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, enemy),
      targetDefenseMultiplier: defenseMultiplierForStates(options.project, target),
      rng,
    });
    if (result.hit && result.amount > 0) recoverHitStates(target);
    recordAction(
      { userRecordId: enemy.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical },
      result.hit ? "damage" : "miss",
      "enemyAttack",
    );
  }

  function lookupSkill(skillId: SkillId) {
    return options.project.database.skills.find((record) => record.id === skillId);
  }

  function applyItem(itemId: ItemId, target: MutableBattler, user: MutableBattler): void {
    const item = options.project.database.items.find((record) => record.id === itemId);
    if (!item) return;
    const count = battleEventState.inventory[itemId] ?? 0;
    if (count <= 0) return;
    if (!itemIsBattleUsable(item)) return;

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
    } else if (skillId && !usesNativeMedicineEffects) {
      // skill path already sets lastAnimation when the skill has animationId
    }
  }

  function itemIsBattleUsable(item: {
    readonly occasion?: string;
    readonly occasionBattle?: boolean;
    readonly skillId?: string;
    readonly activateSkillId?: string;
    readonly captureProfile?: unknown;
    readonly hpRecovery?: { flat: number; percentMax: number };
    readonly mpRecovery?: { flat: number; percentMax: number };
    readonly healStateIds?: readonly string[];
    readonly stateEffects?: readonly { operation: string }[];
  }): boolean {
    if (item.occasion === "never" || item.occasion === "field") return false;
    if (item.occasionBattle === false && item.occasion !== "battle" && item.occasion !== "always") return false;
    if (item.captureProfile) return false;
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
    const item = options.project.database.items.find((record) => record.id === captureItemId);
    const count = battleEventState.inventory[captureItemId] ?? 0;
    if (!item?.captureProfile || count <= 0) {
      finish({ targetId: target.id, captureItemId, success: false, rate: 0, blockedReason: "missingItem" });
      return;
    }
    const enemyRecord = options.project.database.enemies.find((record) => record.id === target.recordId);
    const species = monsterSpeciesForEnemy(options.project, enemyRecord);
    if (!species) {
      finish({ targetId: target.id, captureItemId, success: false, rate: 0, blockedReason: "missingSpecies" });
      return;
    }
    battleEventState.inventory[captureItemId] = count - 1;
    const rate = captureSuccessRate(species.captureRate, target.hp, target.maxHp, captureItemMultiplier(item));
    const roll = rng();
    if (roll >= rate) {
      finish({ targetId: target.id, captureItemId, success: false, rate, roll, speciesId: species.id });
      return;
    }
    const caughtAt = options.captureLocation ?? { mapId: options.project.startMapId, x: options.project.startPos.x, y: options.project.startPos.y };
    const capture: BattleCapturedMonsterSnapshot = {
      targetId: target.id,
      enemyId: target.recordId as EnemyId,
      speciesId: species.id,
      level: Math.max(1, Math.min(99, Math.trunc(enemyRecord?.level ?? 1))),
      caughtAt,
      ivs: rollMonsterIvs(rng),
      captureItemId,
    };
    target.captured = true;
    target.hidden = true;
    target.hp = 0;
    target.gauge = 0;
    capturedMonsters.push(capture);
    actionLog.push({ userRecordId: user.recordId, targetId: target.id, hit: true, amount: 0, critical: false });
    lastActionResult = actionLog[actionLog.length - 1];
    options.onMonsterCaptured?.(capture);
    finish({ targetId: target.id, captureItemId, success: true, rate, roll, speciesId: species.id });
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
      .flatMap((action) => {
        if (!action.skillId) {
          const target = chooseBasicEnemyTarget(enemy);
          return target ? [{ action: { ...action, targetIds: [target.id] }, score: Math.max(1, action.priority) * 10 + enemyDamageUtility(enemy, target) }] : [];
        }
        const skill = lookupSkill(action.skillId);
        if (!skill || battleSkillUseFailure(options.project, enemy, action.skillId, { requireLearned: false })) return [];
        const resolution = resolveBattleTargets({
          scope: skill.scope,
          user: enemy,
          actors: activeActors(),
          enemies: visibleEnemies(),
        });
        if (resolution.candidates.length === 0) return [];
        if (!resolution.requiresSelection) {
          const utility = resolution.targets.reduce((sum, target) => sum + enemySkillUtility(enemy, target, skill), 0);
          if (utility <= 0) return [];
          return [{ action: { ...action, targetIds: resolution.targets.map(targetIdFor) }, score: Math.max(1, action.priority) * 10 + utility }];
        }
        const target = pickBestByUtility(resolution.candidates, (candidate) => enemySkillUtility(enemy, candidate, skill));
        if (!target || enemySkillUtility(enemy, target, skill) <= 0) return [];
        return [{ action: { ...action, targetIds: [target.id] }, score: Math.max(1, action.priority) * 10 + enemySkillUtility(enemy, target, skill) }];
      });
    if (plans.length === 0) {
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

  function enemyDamageUtility(user: MutableBattler, target: MutableBattler, power = user.attackPower, statistic: "attack" | "mind" = "attack"): number {
    const source = statistic === "mind" ? user.mind : user.attackPower;
    const expected = Math.max(0, power + Math.floor(source / 2) - Math.floor(target.defense / 2));
    return expected + (expected >= target.hp ? 1000 : 0) + (1 - target.hp / Math.max(1, target.maxHp)) * 20;
  }

  function enemySkillUtility(user: MutableBattler, target: MutableBattler, skill: NonNullable<ReturnType<typeof lookupSkill>>): number {
    if (skill.effect.kind === "damage") return enemyDamageUtility(user, target, skill.id === DEFAULT_SKILL_ID ? user.attackPower : skill.power, skill.effect.statistic);
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
    if (actor?.critical?.enabled && actor.critical.chanceDenominator > 0) {
      return 100 / actor.critical.chanceDenominator;
    }
    const enemy = options.project.database.enemies.find((entry) => entry.id === user.recordId);
    if (enemy?.criticalHit?.enabled && enemy.criticalHit.oneIn > 0) {
      return 100 / enemy.criticalHit.oneIn;
    }
    return 0;
  }

  function normalAttackHitRate(user: MutableBattler, target: MutableBattler): number {
    const enemy = options.project.database.enemies.find((entry) => entry.id === user.recordId);
    let rate = enemy?.attackOptions.normalAttacksMiss ? 90 : 100;
    for (const stateId of user.stateIds) {
      const state = options.project.database.states.find((entry) => entry.id === stateId);
      if (typeof state?.accuracyModifier === "number") rate *= state.accuracyModifier / 100;
    }
    rate -= Math.max(-20, Math.min(40, (target.agility - user.agility) * 0.5));
    return Math.max(5, Math.min(100, Math.round(rate)));
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
      }
      return;
    }
    const enemy = enemies.find((entry) => entry.id === target || entry.recordId === target);
    if (!enemy?.hidden) return;
    enemy.hidden = false;
    enemy.gauge = 0;
  }

  function visibleEnemies(): readonly MutableBattler[] {
    return enemies.filter((enemy) => !enemy.hidden);
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
    rewards.levelUps = computeLevelUpPreview(collected.exp, collected.enemyLevel);
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

function normalizeActiveSlots(value: number | undefined, partySize: number): number {
  if (partySize <= 0) return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) return partySize;
  return Math.max(1, Math.min(partySize, Math.trunc(value)));
}
