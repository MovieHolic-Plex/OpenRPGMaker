// SIZE_OK: Battle runtime keeps turn state, troop-event callbacks, and snapshot
// assembly together so battle-event regressions can verify one state machine.
import type { ActorId, ItemId, SkillId } from "@/project/types";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { actorBattlers, average, battlerSnapshot, enemyBattlers, type MutableBattler } from "@/battle/battleBattlers";
import { applySkillLike } from "@/battle/battleDamage";
import { createBattleEventRuntime, type BattleEventRuntimeState } from "@/battle/battleEvents";
import { collectBattleRewards } from "@/battle/battleRewards";
import { chargeBattlers, nextReadyBattler } from "@/battle/battleTurnGauge";
import type {
  ActorCommand,
  BattleAnimationSnapshot,
  BattlePhase,
  BattleResult,
  BattleRuntime,
  BattleRuntimeOptions,
  BattleSnapshot,
} from "@/battle/types";

export type {
  ActorCommand,
  BattleBattlerSnapshot,
  BattlePhase,
  BattleResult,
  BattleRuntime,
  BattleRuntimeOptions,
  BattleSnapshot,
} from "@/battle/types";

const FALLBACK_SKILL_POWER = 12;

export function createBattleRuntime(options: BattleRuntimeOptions): BattleRuntime {
  const troop = options.project.database.troops.find((record) => record.id === options.troopId);
  if (!troop) throw new Error(`Missing troop: ${options.troopId}`);
  const troopRecord = troop;

  const actors = actorBattlers(options.project);
  const enemies = enemyBattlers(options.project, troopRecord);
  let backdropResourceId = troopRecord.previewBackgroundResourceId ?? options.project.system.battleSystemResourceId;

  let phase: BattlePhase = "charging";
  let activeActorId: ActorId | undefined;
  let lastAnimation: BattleAnimationSnapshot | undefined;
  let result: BattleResult | undefined;
  let escaped = false;
  let turn = 0;
  let currentActorCommandKind: ActorCommand["kind"] | undefined;
  const rewards: { exp: number; gold: number; items: ItemId[] } = { exp: 0, gold: 0, items: [] };
  const battleEventState: BattleEventRuntimeState = {
    switches: { ...options.project.session.switches },
    variables: { ...options.project.session.variables },
    inventory: { ...options.project.session.inventory },
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
        applySkillLike(actor, target, { power: actor.attackPower, statistic: "attack", effect: "damage" });
        break;
      }
      case "skill": {
        const skill = lookupSkill(command.skillId);
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
        if (Math.random() < chance) {
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

  function resolveSkillTarget(skillOrItemId: string, requestedEnemyId: string, actor: MutableBattler): MutableBattler {
    // 힐/서포트 스킬은 아군(자신)을, 공격 스킬은 지정 적을 대상으로 삼는다.
    const record = lookupSkill(skillOrItemId) ?? lookupItemSkill(skillOrItemId);
    const effect = record?.effect;
    const scope = record?.scope;
    if (effect && (effect.kind === "healing" || effect.kind === "support")) return actor;
    if (scope === "self" || scope === "ally") return actor;
    return visibleEnemies().find((entry) => entry.id === requestedEnemyId && entry.hp > 0)
      ?? visibleEnemies().find((entry) => entry.hp > 0)
      ?? actor;
  }

  function snapshot(): BattleSnapshot {
    const enemiesInBattle = visibleEnemies();
    return {
      phase,
      activeActorId,
      actors: actors.map(battlerSnapshot),
      enemies: enemiesInBattle.map(battlerSnapshot),
      lastAnimation,
      result,
      rewards,
      canEscape: options.canEscape,
      canLose: options.canLose,
      troopId: options.troopId,
      backdropResourceId,
      turn,
      eventState: battleEvents.snapshot(),
    };
  }

  function performEnemyTurn(enemy: MutableBattler): void {
    const target = actors.find((actor) => actor.hp > 0);
    if (!target) return;
    const skillId = enemy.skillIds[0];
    if (skillId) {
      applySkill(enemy, target, skillId);
    } else {
      applySkillLike(enemy, target, { power: enemy.attackPower, statistic: "attack", effect: "damage" });
    }
    enemy.gauge = 0;
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

  function applySkill(user: MutableBattler, target: MutableBattler, skillId: SkillId): void {
    const skill = lookupSkill(skillId);
    const power = skill?.power ?? FALLBACK_SKILL_POWER;
    const effect = skill?.effect;
    const effectKind = effect?.kind ?? "damage";
    // statistic 필드는 damage/healing 효과에만 존재한다.
    const statistic: "attack" | "mind" = effect && (effect.kind === "damage" || effect.kind === "healing")
      ? effect.statistic
      : "attack";
    applySkillLike(user, target, { power, statistic, effect: effectKind });
    if (skill?.animationId) {
      lastAnimation = createBattleAnimationSnapshot(options.project.database.battleAnimations, skill.animationId, target.id);
    }
    if (skill?.effect?.kind === "switch" && skill.effect.switchId) {
      // 전투 내 스위치 토글은 플레이 세션으로 전파하지 않고 배틀 stateIds 에 기록만.
      // (런타임-세션 연동은 별도 작업)
    }
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
      accumulateRewards();
      return;
    }
    if (actors.every((actor) => actor.hp <= 0) && options.canLose) {
      result = "defeat";
      phase = "resolved";
    }
  }

  function accumulateRewards(): void {
    const collected = collectBattleRewards(options.project, enemies);
    rewards.exp = collected.exp;
    rewards.gold = collected.gold;
    rewards.items = [...collected.items];
  }

  return { tick, performActorCommand, snapshot };
}
