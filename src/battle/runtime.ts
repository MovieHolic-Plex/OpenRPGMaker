import type { ActorId, EnemyId, ItemId, SkillId } from "@/project/types";
import type {
  ActorCommand,
  BattleAnimationSnapshot,
  BattleBattlerSnapshot,
  BattlePhase,
  BattleResult,
  BattleRewardsSnapshot,
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
  readonly attackPower: number;
  readonly chargeRate: number;
  readonly skillIds: readonly SkillId[];
  hp: number;
  gauge: number;
  stateIds: string[];
}

type ReadyBattler =
  | { readonly kind: "actor"; readonly battler: MutableBattler; readonly timeMs: number }
  | { readonly kind: "enemy"; readonly battler: MutableBattler; readonly timeMs: number };

const ACTOR_HP = 40;
const ACTOR_ATTACK = 8;
const ACTOR_CHARGE_RATE = 0.1;
const SLIME_HP = 20;
const ENEMY_ATTACK = 10;
const ENEMY_CHARGE_RATE = 0.09;
const DRAGON_HP = 70;
const DRAGON_ATTACK = 80;
const DRAGON_CHARGE_RATE = 0.112;
const FALLBACK_SKILL_POWER = 12;

export function createBattleRuntime(options: BattleRuntimeOptions): BattleRuntime {
  const troop = options.project.database.troops.find((record) => record.id === options.troopId);
  if (!troop) throw new Error(`Missing troop: ${options.troopId}`);
  const troopRecord = troop;

  const actors = options.project.session.partyActorIds.map((actorId) => {
    const actor = options.project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`Missing actor: ${actorId}`);
    return {
      id: actor.id,
      recordId: actor.id,
      name: actor.name,
      maxHp: ACTOR_HP,
      hp: ACTOR_HP,
      attackPower: ACTOR_ATTACK,
      chargeRate: ACTOR_CHARGE_RATE,
      gauge: 0,
      stateIds: [],
      skillIds: (actor.learnedSkills ?? []).map((entry) => entry.skillId),
    };
  });

  // troop는 enemyIds(플랫) 또는 members(위치/숨김 포함) 중 하나로 적을 지정한다.
  // RM2K3 에디터는 members를 사용하지만, 일부 레거시/fixture는 enemyIds를 쓴다.
  const enemyIds = troopRecord.enemyIds ?? (troopRecord.members ?? []).map((member) => member.enemyId);
  const enemies = enemyIds.map((enemyId, index) => {
    const enemy = options.project.database.enemies.find((record) => record.id === enemyId);
    if (!enemy) throw new Error(`Missing enemy: ${enemyId}`);
    const isDragon = enemy.id.includes("dragon");
    return {
      id: `enemy-${index + 1}`,
      recordId: enemy.id,
      name: enemy.name,
      maxHp: isDragon ? DRAGON_HP : SLIME_HP,
      hp: isDragon ? DRAGON_HP : SLIME_HP,
      attackPower: isDragon ? DRAGON_ATTACK : ENEMY_ATTACK,
      chargeRate: isDragon ? DRAGON_CHARGE_RATE : ENEMY_CHARGE_RATE,
      gauge: 0,
      stateIds: [],
      skillIds: enemy.skillIds,
    };
  });

  const inventory = { ...options.project.session.inventory };
  let phase: BattlePhase = "charging";
  let activeActorId: ActorId | undefined;
  let lastAnimation: BattleAnimationSnapshot | undefined;
  let result: BattleResult | undefined;
  const rewards: BattleRewardsSnapshot = { exp: 0, gold: 0, items: [] };

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
    const target = enemies.find((entry) => entry.id === command.targetEnemyId);
    if (!actor || !target || target.hp <= 0) return;
    switch (command.kind) {
      case "attack":
        applyDamage(target, actor.attackPower);
        break;
      case "skill":
        applySkill(command.skillId, target);
        break;
      case "item":
        applyItem(command.itemId, target);
        break;
    }
    applyTroopEvents(target);
    actor.gauge = 0;
    activeActorId = undefined;
    phase = result ? "resolved" : "charging";
    resolveOutcome();
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
      applySkill(skillId, target);
    } else {
      applyDamage(target, enemy.attackPower);
    }
    enemy.gauge = 0;
    resolveOutcome();
    phase = result ? "resolved" : "charging";
  }

  function applyItem(itemId: ItemId, target: MutableBattler): void {
    const item = options.project.database.items.find((record) => record.id === itemId);
    if (!item?.skillId) return;
    const count = inventory[itemId] ?? 0;
    if (count <= 0) return;
    inventory[itemId] = count - 1;
    applySkill(item.skillId, target);
  }

  function applySkill(skillId: SkillId, target: MutableBattler): void {
    const skill = options.project.database.skills.find((record) => record.id === skillId);
    const power = skill?.power ?? FALLBACK_SKILL_POWER;
    applyDamage(target, power);
    if (skill?.animationId) {
      lastAnimation = { animationId: skill.animationId, targetId: target.id };
    }
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
      return;
    }
    if (actors.every((actor) => actor.hp <= 0) && options.canLose) {
      result = "defeat";
      phase = "resolved";
    }
  }

  return { tick, performActorCommand, snapshot };
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
