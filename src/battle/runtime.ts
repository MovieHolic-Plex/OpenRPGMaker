import type { ActorId, EnemyId, ItemId, SkillId } from "@/project/types";
import { parameterValueAtLevel } from "@/project/actorModel";
import type {
  ActorCommand,
  BattleAnimationSnapshot,
  BattleBattlerSnapshot,
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

interface MutableBattler {
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
  hp: number;
  mp: number;
  gauge: number;
  stateIds: string[];
  defending: boolean;
}

type ReadyBattler =
  | { readonly kind: "actor"; readonly battler: MutableBattler; readonly timeMs: number }
  | { readonly kind: "enemy"; readonly battler: MutableBattler; readonly timeMs: number };

const FALLBACK_SKILL_POWER = 12;
// ATB 게이지 충전 계수. agility 가 높을수록 게이지가 빨리 찬다(RM2K3 민첩성 기반 턴 순서).
// 기본 주인공(레벨1 민첩성 43)이 초당 게이지 약 10%(=1초에 한 번 행동)가 되도록 맞췄다.
const CHARGE_PER_AGILITY = 0.1 / 43;
const CHARGE_FLOOR = 0.02;

export function createBattleRuntime(options: BattleRuntimeOptions): BattleRuntime {
  const troop = options.project.database.troops.find((record) => record.id === options.troopId);
  if (!troop) throw new Error(`Missing troop: ${options.troopId}`);
  const troopRecord = troop;

  const actors = options.project.session.partyActorIds.map((actorId) => {
    const actor = options.project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`Missing actor: ${actorId}`);
    const level = actor.initialLevel;
    const maxHp = parameterValueAtLevel(actor.parameterCurves.maxHp, level);
    const maxMp = parameterValueAtLevel(actor.parameterCurves.maxMp, level);
    const attack = parameterValueAtLevel(actor.parameterCurves.attack, level);
    const defense = parameterValueAtLevel(actor.parameterCurves.defense, level);
    const mind = parameterValueAtLevel(actor.parameterCurves.mind, level);
    const agility = parameterValueAtLevel(actor.parameterCurves.agility, level);
    return {
      id: actor.id,
      recordId: actor.id,
      name: actor.name,
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
      skillIds: (actor.learnedSkills ?? []).map((entry) => entry.skillId),
    };
  });

  // troop는 enemyIds(플랫) 또는 members(위치/숨김 포함) 중 하나로 적을 지정한다.
  // RM2K3 에디터는 members를 사용하지만, 일부 레거시/fixture는 enemyIds를 쓴다.
  const enemyIds = troopRecord.enemyIds ?? (troopRecord.members ?? []).map((member) => member.enemyId);
  const enemies = enemyIds.map((enemyId, index) => {
    const enemy = options.project.database.enemies.find((record) => record.id === enemyId);
    if (!enemy) throw new Error(`Missing enemy: ${enemyId}`);
    const stats = enemy.stats;
    return {
      id: `enemy-${index + 1}`,
      recordId: enemy.id,
      name: enemy.name,
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
      skillIds: enemy.skillIds,
    };
  });

  const inventory = { ...options.project.session.inventory };
  let phase: BattlePhase = "charging";
  let activeActorId: ActorId | undefined;
  let lastAnimation: BattleAnimationSnapshot | undefined;
  let result: BattleResult | undefined;
  let escaped = false;
  const rewards: { exp: number; gold: number; items: ItemId[] } = { exp: 0, gold: 0, items: [] };

  function tick(deltaMs: number): void {
    if (phase !== "charging" || result) return;
    const ready = nextReadyBattler(deltaMs);
    if (!ready) {
      chargeAll(deltaMs);
      return;
    }
    chargeAll(ready.timeMs);
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

    switch (command.kind) {
      case "attack": {
        const target = enemies.find((entry) => entry.id === command.targetEnemyId);
        if (!target || target.hp <= 0) return;
        applySkillLike(actor, target, { power: actor.attackPower, statistic: "attack", effect: "damage" });
        break;
      }
      case "skill": {
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
        const enemyAgi = average(enemies.filter((e) => e.hp > 0).map((e) => e.agility));
        const chance = Math.min(0.95, 0.5 + (actorAgi - enemyAgi) / Math.max(1, enemyAgi) * 0.25);
        if (Math.random() < chance) {
          escaped = true;
        }
        break;
      }
    }
    actor.gauge = 0;
    activeActorId = undefined;
    if (escaped) {
      result = "escape";
      phase = "resolved";
      return;
    }
    phase = result ? "resolved" : "charging";
    resolveOutcome();
  }

  function resolveSkillTarget(skillOrItemId: string, requestedEnemyId: string, actor: MutableBattler): MutableBattler {
    // 힐/서포트 스킬은 아군(자신)을, 공격 스킬은 지정 적을 대상으로 삼는다.
    const record = lookupSkill(skillOrItemId) ?? lookupItemSkill(skillOrItemId);
    const effect = record?.effect;
    const scope = record?.scope;
    if (effect && (effect.kind === "healing" || effect.kind === "support")) return actor;
    if (scope === "self" || scope === "ally") return actor;
    return enemies.find((entry) => entry.id === requestedEnemyId && entry.hp > 0)
      ?? enemies.find((entry) => entry.hp > 0)
      ?? actor;
  }

  function snapshot(): BattleSnapshot {
    return {
      phase,
      activeActorId,
      actors: actors.map(toSnapshot),
      enemies: enemies.map(toSnapshot),
      lastAnimation,
      result,
      rewards,
      canEscape: options.canEscape,
      canLose: options.canLose,
      troopId: options.troopId,
    };
  }

  function nextReadyBattler(deltaMs: number): ReadyBattler | undefined {
    const readyActors = actors.filter((entry) => entry.hp > 0).map((battler) => readyActor(battler));
    const readyEnemies = enemies.filter((entry) => entry.hp > 0).map((battler) => readyEnemy(battler));
    const ordered = [...readyActors, ...readyEnemies].sort((left, right) => {
      const delta = left.timeMs - right.timeMs;
      if (delta !== 0) return delta;
      if (left.kind === right.kind) return 0;
      return left.kind === "actor" ? -1 : 1;
    });
    const first = ordered[0];
    return first && first.timeMs <= deltaMs ? first : undefined;
  }

  function readyActor(battler: MutableBattler): ReadyBattler {
    return { kind: "actor", battler, timeMs: timeToReady(battler) };
  }

  function readyEnemy(battler: MutableBattler): ReadyBattler {
    return { kind: "enemy", battler, timeMs: timeToReady(battler) };
  }

  function timeToReady(battler: MutableBattler): number {
    return Math.max(0, (100 - battler.gauge) / battler.chargeRate);
  }

  function chargeAll(deltaMs: number): void {
    for (const actor of actors) charge(actor, deltaMs);
    for (const enemy of enemies) charge(enemy, deltaMs);
  }

  function charge(battler: MutableBattler, deltaMs: number): void {
    if (battler.hp <= 0) return;
    battler.gauge = Math.min(100, battler.gauge + battler.chargeRate * deltaMs);
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
    const count = inventory[itemId] ?? 0;
    if (count <= 0) return;
    inventory[itemId] = count - 1;
    applySkill(user, target, item.skillId);
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
      lastAnimation = { animationId: skill.animationId, targetId: target.id };
    }
    if (skill?.effect?.kind === "switch" && skill.effect.switchId) {
      // 전투 내 스위치 토글은 플레이 세션으로 전파하지 않고 배틀 stateIds 에 기록만.
      // (런타임-세션 연동은 별도 작업)
    }
  }

  function applySkillLike(
    user: MutableBattler,
    target: MutableBattler,
    spec: { power: number; statistic: "attack" | "mind"; effect: "damage" | "healing" | "support" | "switch" }
  ): void {
    const stat = spec.statistic === "mind" ? user.mind : user.attackPower;
    if (spec.effect === "healing") {
      const amount = computeMagnitude(spec.power, user, target, "heal");
      target.hp = Math.min(target.maxHp, target.hp + amount);
      return;
    }
    if (spec.effect === "support" || spec.effect === "switch") {
      return; // 순수 서포트: 데미지 없음.
    }
    // damage
    const amount = computeMagnitude(spec.power, user, target, "damage", stat);
    applyDamage(target, amount);
    applyTroopEvents(target);
  }

  /** 공격/스킬 위력 → 실제 수치. 방어력/방어 상태/분산 반영. */
  function computeMagnitude(
    power: number,
    user: MutableBattler,
    target: MutableBattler,
    mode: "damage" | "heal",
    sourceStat = user.attackPower
  ): number {
    // RM2K3 근사: 데미지 = power + sourceStat/2 − target.defense/2 (최소 1).
    let magnitude = power + Math.floor(sourceStat / 2);
    if (mode === "damage") {
      magnitude -= Math.floor(target.defense / 2);
      if (target.defending) magnitude = Math.floor(magnitude / 2);
    }
    return Math.max(1, magnitude);
  }

  function applyDamage(target: MutableBattler, amount: number): void {
    target.hp = Math.max(0, target.hp - amount);
  }

  function applyTroopEvents(target: MutableBattler): void {
    if (troopRecord.battleEventPages.length === 0) return;
    const state = options.project.database.states[0];
    if (state && !target.stateIds.includes(state.id)) {
      target.stateIds = [...target.stateIds, state.id];
    }
  }

  function resolveOutcome(): void {
    if (enemies.every((enemy) => enemy.hp <= 0)) {
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
    rewards.exp = enemies.reduce((sum, enemy) => {
      const record = options.project.database.enemies.find((item) => item.id === enemy.recordId);
      return sum + (record?.rewards.exp ?? 0);
    }, 0);
    rewards.gold = enemies.reduce((sum, enemy) => {
      const record = options.project.database.enemies.find((item) => item.id === enemy.recordId);
      return sum + (record?.rewards.gold ?? 0);
    }, 0);
    rewards.items = enemies.flatMap((enemy) => {
      const record = options.project.database.enemies.find((item) => item.id === enemy.recordId);
      if (record?.rewards.dropItemId && record.rewards.dropRatePercent > 0 && Math.random() * 100 < record.rewards.dropRatePercent) {
        return [record.rewards.dropItemId];
      }
      return [];
    });
  }

  return { tick, performActorCommand, snapshot };
}

function chargeRateFor(agility: number): number {
  // agility 43(기본 주인공 레벨1) ≈ 0.1, agility 10(기본 적) ≈ 0.0233.
  return Math.max(CHARGE_FLOOR, agility * CHARGE_PER_AGILITY);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toSnapshot(battler: MutableBattler): BattleBattlerSnapshot {
  return {
    id: battler.id,
    recordId: battler.recordId,
    name: battler.name,
    hp: battler.hp,
    maxHp: battler.maxHp,
    gauge: battler.gauge,
    defeated: battler.hp <= 0,
    stateIds: battler.stateIds,
    skillIds: battler.skillIds,
  };
}
