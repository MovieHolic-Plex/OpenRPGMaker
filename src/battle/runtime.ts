// SIZE_OK: Battle runtime keeps turn state, troop-event callbacks, and snapshot
// assembly together so battle-event regressions can verify one state machine.
import type { ActorId, ItemId, SkillId } from "@/project/types";
import { startStateOf } from "@/project/session";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { actorBattlers, average, battlerSnapshot, enemyBattlers, type MutableBattler } from "@/battle/battleBattlers";
import { applySkillLike } from "@/battle/battleDamage";
import { createBattleEventRuntime, type BattleEventRuntimeState } from "@/battle/battleEvents";
import { collectBattleRewards } from "@/battle/battleRewards";
import { computeActorLevelUp } from "@/battle/battleLevelUp";
import type { BattleLevelUpResult } from "@/battle/battleLevelUp";
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
  BattlePhase,
  BattleResult,
  BattleRuntime,
  BattleRuntimeOptions,
  BattleSnapshot,
  BattleTargetSelectionSnapshot,
  TargetedActorCommand,
} from "@/battle/types";
import { mulberry32, type Rng } from "@/util/rng";

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

export function createBattleRuntime(options: BattleRuntimeOptions): BattleRuntime {
  const troop = options.project.database.troops.find((record) => record.id === options.troopId);
  if (!troop) throw new Error(`Missing troop: ${options.troopId}`);
  const troopRecord = troop;
  const rng: Rng = options.rng ?? mulberry32(1);

  const actors = actorBattlers(options.project, {
    names: options.party?.names,
    levels: options.party?.levels,
    vitals: options.party?.vitals,
    paramBonuses: options.party?.paramBonuses,
    equipment: options.party?.equipment,
    skillIds: options.party?.skillIds,
    stateIds: options.party?.stateIds,
    partyActorIds: options.party?.partyActorIds,
  });
  const enemies = enemyBattlers(options.project, troopRecord);
  let backdropResourceId = options.backdropResourceId ?? troopRecord.previewBackgroundResourceId ?? options.project.system.battleSystemResourceId;

  let phase: BattlePhase = "charging";
  let activeActorId: ActorId | undefined;
  let lastAnimation: BattleAnimationSnapshot | undefined;
  let lastActionResult: BattleActionResultSnapshot | undefined;
  let result: BattleResult | undefined;
  let escaped = false;
  let turn = 0;
  let currentActorCommandKind: ActorCommand["kind"] | undefined;
  let targetSelection: BattleTargetSelectionSnapshot | undefined;
  const rewards: { exp: number; gold: number; items: ItemId[]; levelUps: BattleLevelUpResult[] } = { exp: 0, gold: 0, items: [], levelUps: [] };
  // 플레이 중에는 현재 세션 상태를 기준으로 한다(에디터 시작 상태가 아니라).
  const sessionState = options.sessionState ?? startStateOf(options.project);
  const battleEventState: BattleEventRuntimeState = {
    switches: { ...sessionState.switches },
    variables: { ...sessionState.variables },
    inventory: { ...sessionState.inventory },
  };
  const battleEvents = createBattleEventRuntime({
    troopRecord,
    actors,
    enemies,
    stateIds: options.project.database.states.map((state) => state.id),
    state: battleEventState,
    revealEnemy: revealEnemyTarget,
    changeBattleback: (resourceId) => {
      backdropResourceId = resourceId;
    },
  });

  function tick(deltaMs: number): void {
    if (phase !== "charging" || result) return;
    const enemiesInBattle = visibleEnemies();
    const ready = nextReadyBattler(actors, enemiesInBattle, deltaMs);
    if (!ready) {
      chargeBattlers(actors, enemiesInBattle, deltaMs);
      return;
    }
    chargeBattlers(actors, enemiesInBattle, ready.timeMs);
    ready.battler.gauge = 100;
    if (ready.kind === "actor") {
      // 턴 시작 상태 처리(지속 피해/자연 회복). 행동 불가(수면 등)면 명령 없이 턴을 넘긴다.
      runStateUpkeep(options.project, ready.battler, rng);
      resolveOutcome();
      if (result) return;
      if (!canBattlerAct(options.project, ready.battler)) {
        ready.battler.gauge = 0;
        phase = "charging";
        return;
      }
      phase = "actorCommand";
      activeActorId = ready.battler.recordId;
      return;
    }
    performEnemyTurn(ready.battler);
  }

  function performActorCommand(command: ActorCommand): void {
    if (phase !== "actorCommand" || !activeActorId || result) return;
    const actor = actors.find((entry) => entry.recordId === activeActorId);
    if (!actor) return;

    currentActorCommandKind = command.kind;
    switch (command.kind) {
      case "attack": {
        const target = visibleEnemies().find((entry) => entry.id === command.targetEnemyId);
        if (!target || target.hp <= 0) {
          currentActorCommandKind = undefined;
          return;
        }
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
        if (result.hit && result.amount > 0) recoverStatesWhenHit(options.project, target, rng);
        lastActionResult = { userRecordId: actor.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical };
        break;
      }
      case "skill": {
        const skill = lookupSkill(command.skillId);
        if (!canUseSkill(actor, command.skillId)) {
          performFallbackAttack(actor, command.targetEnemyId);
          break;
        }
        consumeSkillMp(actor, command.skillId);
        if (skill?.scope === "allEnemies") {
          for (const target of visibleEnemies().filter((entry) => entry.hp > 0)) {
            applySkill(actor, target, command.skillId);
          }
          break;
        }
        const target = resolveSkillTarget(command.skillId, command.targetEnemyId, actor);
        applySkill(actor, target, command.skillId);
        break;
      }
      case "item": {
        const target = resolveSkillTarget(command.itemId, command.targetEnemyId, actor);
        applyItem(command.itemId, target, actor);
        break;
      }
      case "defend": {
        actor.defending = true;
        break;
      }
      case "escape": {
        if (!options.canEscape) break;
        // RM2K3 도주: 민첩성 기반 확률(파티 평균 vs 적 평균). 단순화해 절반 확률 + 우위 보정.
        const actorAgi = average(actors.filter((a) => a.hp > 0).map((a) => a.agility));
        const enemyAgi = average(visibleEnemies().filter((e) => e.hp > 0).map((e) => e.agility));
        const chance = Math.min(0.95, 0.5 + (actorAgi - enemyAgi) / Math.max(1, enemyAgi) * 0.25);
        if (rng() < chance) {
          escaped = true;
        }
        break;
      }
    }
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

  function beginActorCommand(command: ActorCommandDraft): void {
    if (phase !== "actorCommand" || !activeActorId || result) return;
    switch (command.kind) {
      case "defend":
      case "escape":
        performActorCommand(command);
        return;
      case "attack":
      case "skill":
      case "item":
        beginTargetSelection(command);
        return;
    }
  }

  function selectTargetEnemy(enemyId: string): void {
    if (phase !== "targetSelect" || !targetSelection || result) return;
    if (!targetSelection.targetEnemyIds.includes(enemyId)) return;
    const command = concreteTargetCommand(targetSelection.command, enemyId);
    targetSelection = undefined;
    phase = "actorCommand";
    performActorCommand(command);
  }

  // 대상을 "선택만" 변경(커서 이동). 확정하지 않는다. 키보드 X 등 커서 이동용.
  function setSelectedTargetEnemy(enemyId: string): void {
    if (phase !== "targetSelect" || !targetSelection || result) return;
    if (!targetSelection.targetEnemyIds.includes(enemyId)) return;
    targetSelection = { ...targetSelection, selectedEnemyId: enemyId };
  }

  function cancelTargetSelection(): void {
    if (phase !== "targetSelect") return;
    targetSelection = undefined;
    phase = "actorCommand";
  }

  function beginTargetSelection(command: TargetedActorCommand): void {
    if (!needsEnemyTarget(command)) {
      const fallbackTargetId = visibleEnemies().find((entry) => entry.hp > 0)?.id ?? activeActorId ?? "";
      performActorCommand(concreteTargetCommand(command, fallbackTargetId));
      return;
    }
    const targetEnemyIds = selectableEnemyIds(command);
    if (targetEnemyIds.length === 0) return;
    targetSelection = {
      command,
      targetEnemyIds,
      selectedEnemyId: targetEnemyIds[0],
    };
    phase = "targetSelect";
  }

  function selectableEnemyIds(command: TargetedActorCommand): readonly string[] {
    if (!needsEnemyTarget(command)) return [];
    return visibleEnemies()
      .filter((entry) => entry.hp > 0)
      .map((entry) => entry.id);
  }

  function needsEnemyTarget(command: TargetedActorCommand): boolean {
    switch (command.kind) {
      case "attack":
        return true;
      case "skill": {
        const skill = lookupSkill(command.skillId);
        return skill?.scope !== "self" && skill?.scope !== "ally";
      }
      case "item": {
        const skill = lookupItemSkill(command.itemId);
        return skill?.scope !== "self" && skill?.scope !== "ally";
      }
    }
  }

  function resolveSkillTarget(skillOrItemId: string, requestedEnemyId: string, user: MutableBattler): MutableBattler {
    // 힐/서포트 스킬은 시전자 진영의 생존자를 대상으로 삼는다.
    const record = lookupSkill(skillOrItemId) ?? lookupItemSkill(skillOrItemId);
    const effect = record?.effect;
    const scope = record?.scope;
    if (effect && (effect.kind === "healing" || effect.kind === "support")) return supportTargetFor(user);
    if (scope === "self" || scope === "ally") return supportTargetFor(user);
    return visibleEnemies().find((entry) => entry.id === requestedEnemyId && entry.hp > 0)
      ?? visibleEnemies().find((entry) => entry.hp > 0)
      ?? user;
  }

  function supportTargetFor(user: MutableBattler): MutableBattler {
    const side = actors.some((entry) => entry.id === user.id) ? actors : visibleEnemies();
    return side
      .filter((entry) => entry.hp > 0)
      .sort((a, b) => (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)))[0]
      ?? user;
  }

  function snapshot(): BattleSnapshot {
    const enemiesInBattle = visibleEnemies();
    return {
      phase,
      activeActorId,
      actors: actors.map(battlerSnapshot),
      enemies: enemiesInBattle.map(battlerSnapshot),
      lastAnimation,
      lastActionResult,
      result,
      rewards,
      canEscape: options.canEscape,
      canLose: options.canLose,
      troopId: options.troopId,
      backdropResourceId,
      turn,
      eventState: battleEvents.snapshot(),
      targetSelection,
    };
  }

  function performEnemyTurn(enemy: MutableBattler): void {
    // 턴 시작 상태 처리(지속 피해/자연 회복).
    runStateUpkeep(options.project, enemy, rng);
    resolveOutcome();
    if (result) {
      phase = "resolved";
      return;
    }
    // 행동 불가(수면 등)면 적도 턴을 건너뛴다.
    if (!canBattlerAct(options.project, enemy)) {
      enemy.gauge = 0;
      for (const actor of actors) actor.defending = false;
      turn += 1;
      applyTroopEvents();
      resolveOutcome();
      phase = result ? "resolved" : "charging";
      return;
    }
    const action = chooseEnemyAction(enemy);
    const skillId = action?.skillId;
    if (skillId) {
      const target = resolveEnemySkillTarget(enemy, skillId);
      if (!target) return;
      consumeSkillMp(enemy, skillId);
      applySkill(enemy, target, skillId);
      applyEnemyActionSwitchEffects(action);
    } else {
      const target = actors.find((actor) => actor.hp > 0);
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
      if (result.hit && result.amount > 0) recoverStatesWhenHit(options.project, target, rng);
      lastActionResult = { userRecordId: enemy.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical };
    }
    enemy.gauge = 0;
    // 적 턴이 끝나면 아군의 방어(defending) 상태를 해제한다.
    // RM2K3: 방어는 다음 적 턴까지만 유효(1턴 가드).
    for (const actor of actors) actor.defending = false;
    turn += 1;
    applyTroopEvents();
    resolveOutcome();
    phase = result ? "resolved" : "charging";
  }

  function lookupSkill(skillId: SkillId) {
    return options.project.database.skills.find((record) => record.id === skillId);
  }

  function lookupItemSkill(itemId: ItemId) {
    const item = options.project.database.items.find((record) => record.id === itemId);
    if (!item?.skillId) return undefined;
    return options.project.database.skills.find((record) => record.id === item.skillId);
  }

  function performFallbackAttack(actor: MutableBattler, requestedEnemyId: string): void {
    const target = visibleEnemies().find((entry) => entry.id === requestedEnemyId && entry.hp > 0)
      ?? visibleEnemies().find((entry) => entry.hp > 0);
    if (!target) return;
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
    if (result.hit && result.amount > 0) recoverStatesWhenHit(options.project, target, rng);
    lastActionResult = { userRecordId: actor.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical };
  }

  function applyItem(itemId: ItemId, target: MutableBattler, user: MutableBattler): void {
    const item = options.project.database.items.find((record) => record.id === itemId);
    if (!item?.skillId) return;
    const count = battleEventState.inventory[itemId] ?? 0;
    if (count <= 0) return;
    battleEventState.inventory[itemId] = count - 1;
    applySkill(user, target, item.skillId);
    if (item.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, item.animationId, target.id);
    }
  }

  // 스킬 MP 소비. flat + percentMax(최대 MP 기준 비율). 부족해도 일단 차감(최소 0).
  // 호출부에서 applySkill(allEnemies 루프 등)과 분리해 1회만 차감하도록 직접 호출한다.
  function consumeSkillMp(user: MutableBattler, skillId: SkillId): void {
    const skill = lookupSkill(skillId);
    if (!skill?.mpCost) return;
    const flat = skill.mpCost.flat ?? 0;
    const pct = skill.mpCost.percentMax ?? 0;
    const cost = flat + Math.floor((user.maxMp * pct) / 100);
    if (cost > 0) user.mp = Math.max(0, user.mp - cost);
  }

  function skillMpCost(user: MutableBattler, skillId: SkillId): number {
    const skill = lookupSkill(skillId);
    if (!skill?.mpCost) return 0;
    const flat = skill.mpCost.flat ?? 0;
    const pct = skill.mpCost.percentMax ?? 0;
    return Math.max(0, flat + Math.floor((user.maxMp * pct) / 100));
  }

  function canUseSkill(user: MutableBattler, skillId: SkillId): boolean {
    if (!lookupSkill(skillId)) return false;
    if (actors.some((actor) => actor.id === user.id) && !user.skillIds.includes(skillId)) return false;
    return user.mp >= skillMpCost(user, skillId);
  }

  function chooseEnemyAction(enemy: MutableBattler): { readonly skillId: SkillId; readonly switchOnAfterAction: { readonly enabled: boolean; readonly switchId?: string }; readonly switchOffAfterAction: { readonly enabled: boolean; readonly switchId?: string } } | undefined {
    const actionTurn = turn + 1;
    const candidates = (enemy.enemyActions ?? [])
      .filter((action) => enemyActionConditionMet(action.condition, actionTurn))
      .filter((action) => canUseSkill(enemy, action.skillId));
    if (candidates.length === 0) return undefined;
    const total = candidates.reduce((sum, action) => sum + Math.max(1, action.priority), 0);
    let roll = rng() * total;
    for (const action of candidates) {
      roll -= Math.max(1, action.priority);
      if (roll < 0) return action;
    }
    return candidates[candidates.length - 1];
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

  function resolveEnemySkillTarget(enemy: MutableBattler, skillId: SkillId): MutableBattler | undefined {
    const skill = lookupSkill(skillId);
    if (skill?.effect.kind === "healing" || skill?.effect.kind === "support" || skill?.scope === "self" || skill?.scope === "ally") {
      return supportTargetFor(enemy);
    }
    return actors.find((actor) => actor.hp > 0);
  }

  function applySkill(user: MutableBattler, target: MutableBattler, skillId: SkillId): void {
    const skill = lookupSkill(skillId);
    const power = skill?.power ?? FALLBACK_SKILL_POWER;
    const effect = skill?.effect;
    const effectKind = effect?.kind ?? "damage";
    // statistic 필드는 damage/healing 효과에만 존재한다.
    const statistic: "attack" | "mind" = effect && (effect.kind === "damage" || effect.kind === "healing")
      ? effect.statistic
      : "attack";
    const result = applySkillLike(user, target, {
      power,
      statistic,
      effect: effectKind,
      // RM2K3 스킬 성공률: hitRate(명중률)와 successRate(성공률)를 합성한 단일 판정.
      // 두 값 모두 100 이 기본이라 기존 데이터의 기대 명중률은 변하지 않는다.
      hitRate: combinedSkillHitRate(skill),
      variance: skill?.variance,
      criticalRate: criticalRateFor(user),
      elementMultiplier: elementMultiplierFor(skill?.elementId, target),
      attackerStatMultiplier: attackMultiplierForStates(options.project, user),
      targetDefenseMultiplier: defenseMultiplierForStates(options.project, target),
      rng,
    });
    lastActionResult = { userRecordId: user.recordId, targetId: target.id, hit: result.hit, amount: result.amount, critical: result.critical, skillName: skill?.name };
    if (skill?.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
    }
    // 피격에 의한 상태 해제(수면 등)를 먼저 처리한 뒤, 스킬의 상태 효과를 적용한다.
    // 이 순서라야 이번 스킬로 새로 부여한 상태가 즉시 해제되지 않는다.
    if (result.hit && effectKind === "damage" && result.amount > 0) {
      recoverStatesWhenHit(options.project, target, rng);
    }
    if (result.hit) {
      applyStateEffects(options.project, target, skill?.stateEffects, rng);
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
  function elementMultiplierFor(elementId: string | undefined, target: MutableBattler): number {
    if (!elementId) return 1;
    const element = options.project.database.elements?.find((entry) => entry.id === elementId);
    if (!element?.damageMultipliers) return 1;
    // target 이 enemy 인지 actor 인지 원본 레코드에서 elementRates 를 찾는다.
    const enemy = options.project.database.enemies.find((entry) => entry.id === target.recordId);
    const actor = options.project.database.actors.find((entry) => entry.id === target.recordId);
    const rates = enemy?.elementRates ?? actor?.elementRates;
    if (!rates) return 1;
    const grade = rates[elementId];
    if (!grade) return 1;
    const multiplier = element.damageMultipliers[grade];
    if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) return 1;
    // damageMultipliers 는 퍼센트 스케일(A=200,B=150,C=100,D=50,E=0)로 저장된다.
    // 데미지 배율로 쓰려면 100으로 나눈다: C=1.0(중립), A=2.0(약점), D=0.5(내성), E=0(무효),
    // 음수(-100 등)는 흡수(-1.0 = 회복)를 의미한다.
    return multiplier / 100;
  }

  function applyTroopEvents(): void {
    const eventResult = battleEvents.applyTroopEvents({ turn, activeActorId, currentActorCommandKind });
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

  function resolveOutcome(): void {
    if (result) return;
    if (visibleEnemies().every((enemy) => enemy.hp <= 0)) {
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
    for (const actor of actors) clearBattleEndStates(options.project, actor);
    for (const enemy of enemies) clearBattleEndStates(options.project, enemy);
  }

  function accumulateRewards(): void {
    const collected = collectBattleRewards(options.project, enemies, rng);
    rewards.exp = collected.exp;
    rewards.gold = collected.gold;
    rewards.items = [...collected.items];
    rewards.levelUps = computeLevelUpPreview(collected.exp);
  }

  // 세션 파티 정보가 주어졌으면 승리 획득 exp 기준 레벨업 미리보기를 계산(결과 화면 표시용).
  // 실제 세션 적립/성장은 battleRewardsToSession 이 담당하며 동일 로직으로 일치한다.
  function computeLevelUpPreview(earnedExp: number): BattleLevelUpResult[] {
    const party = options.party;
    if (!party) return [];
    const results: BattleLevelUpResult[] = [];
    const seen = new Set<string>();
    for (const actor of actors) {
      const actorId = actor.recordId;
      if (seen.has(actorId)) continue;
      seen.add(actorId);
      const level = party.levels[actorId] ?? 1;
      const totalExp = (party.experience[actorId] ?? 0) + earnedExp;
      const result = computeActorLevelUp(options.project, actorId, level, totalExp);
      if (result) results.push(result);
    }
    return results;
  }

  return { tick, beginActorCommand, selectTargetEnemy, setSelectedTargetEnemy, cancelTargetSelection, performActorCommand, snapshot };
}

// 대상 선택 초안(TargetedActorCommand)과 선택된 적 id 를 확정된 명령(ActorCommand)으로 조립.
// 모듈 스코프 순수 함수 — runtime 내부와 DOM(battleDom.ts 의 메시지 조립) 양쪽에서 공유.
export function concreteTargetCommand(command: TargetedActorCommand, targetEnemyId: string): ActorCommand {
  switch (command.kind) {
    case "attack":
      return { kind: "attack", targetEnemyId };
    case "skill":
      return { kind: "skill", skillId: command.skillId, targetEnemyId };
    case "item":
      return { kind: "item", itemId: command.itemId, targetEnemyId };
  }
}
