// battle/simulate.ts
// 전투 런타임(createBattleRuntime — 순수 TS)을 DOM 없이 N회 구동하는 헤드리스 시뮬레이터.
// 간단 AI: 평타 + HP 30% 이하일 때 회복 아이템 사용. 시드 고정 시 재현 가능.
//
import { actorBattlers } from "@/battle/battleBattlers";
import { createBattleRuntime } from "@/battle/runtime";
import type { BattleRuntimeOptions } from "@/battle/types";
import type { Project } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";

export interface SimulateBattleInput {
  readonly project: Project;
  readonly troopId: string;
  readonly heroLevel: number;
  readonly inventory?: Record<string, number>;
  readonly partyActorIds?: readonly string[];
  // 저HP(≤30%) 시 AI가 사용할 회복 아이템 id. 없으면 아이템을 쓰지 않는다.
  readonly potionItemId?: string;
  readonly n?: number;
  readonly seed?: number;
  readonly maxSteps?: number; // 무한 루프 방지 tick 상한(기본 4000)
}

export interface SimulateBattleResult {
  readonly winRate: number;
  readonly avgTurns: number; // 아군 행동 결정 횟수 평균(≈ 처치까지 걸린 타)
  readonly avgPotionsUsed: number;
  readonly avgHpRemaining: number; // 종료 시 파티 총 HP 평균
  readonly samples: number;
}

interface SingleRunResult {
  readonly victory: boolean;
  readonly turns: number;
  readonly potionsUsed: number;
  readonly hpRemaining: number;
}

// 회복 아이템을 가진 저HP 액터가 아이템을 쓰도록 하는 간단 AI로 한 판을 구동한다.
function runSingleBattle(input: SimulateBattleInput, rng: Rng): SingleRunResult {
  const inventory: Record<string, number> = { ...(input.inventory ?? {}) };
  const partyActorIds = input.partyActorIds ?? input.project.session.partyActorIds;
  const levels: Record<string, number> = {};
  for (const actorId of partyActorIds) levels[actorId] = input.heroLevel;

  const options: BattleRuntimeOptions = {
    project: input.project,
    troopId: input.troopId,
    canEscape: false,
    canLose: true,
    party: { levels, experience: {}, partyActorIds: [...partyActorIds] },
    sessionState: { switches: {}, variables: {}, inventory },
    rng,
  };

  const rt = createBattleRuntime(options);
  const maxSteps = input.maxSteps ?? 4000;
  let turns = 0;
  let potionsUsed = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const snap = rt.snapshot();
    if (snap.result) break;
    if (snap.phase === "actorCommand") {
      const actor = snap.actors.find((entry) => entry.recordId === snap.activeActorId);
      const enemy = snap.enemies.find((entry) => !entry.defeated && entry.hp > 0);
      if (!enemy) {
        rt.tick(1000);
        continue;
      }
      turns += 1;
      const lowHp = actor !== undefined && actor.hp <= actor.maxHp * 0.3;
      const hasPotion = input.potionItemId !== undefined && (snap.eventState.inventory[input.potionItemId] ?? 0) > 0;
      if (lowHp && hasPotion && input.potionItemId) {
        rt.performActorCommand({ kind: "item", itemId: input.potionItemId, targetEnemyId: enemy.id });
        potionsUsed += 1;
      } else {
        rt.performActorCommand({ kind: "attack", targetEnemyId: enemy.id });
      }
    } else {
      rt.tick(1000);
    }
  }

  const final = rt.snapshot();
  const hpRemaining = final.actors.reduce((sum, entry) => sum + Math.max(0, entry.hp), 0);
  return { victory: final.result === "victory", turns, potionsUsed, hpRemaining };
}

// N회 시뮬레이션 후 승률/평균 지표를 반환한다.
export function simulateBattle(input: SimulateBattleInput): SimulateBattleResult {
  const n = Math.max(1, input.n ?? 50);
  const rng = mulberry32(input.seed ?? 1);
  let wins = 0;
  let totalTurns = 0;
  let totalPotions = 0;
  let totalHp = 0;
  for (let i = 0; i < n; i += 1) {
    const run = runSingleBattle(input, rng);
    if (run.victory) wins += 1;
    totalTurns += run.turns;
    totalPotions += run.potionsUsed;
    totalHp += run.hpRemaining;
  }
  return {
    winRate: wins / n,
    avgTurns: totalTurns / n,
    avgPotionsUsed: totalPotions / n,
    avgHpRemaining: totalHp / n,
    samples: n,
  };
}

// tune_enemy 근거 계산: 데미지 공식(power + stat/2 - def/2, 최소 1) 역산.
export interface EnemyTuningInput {
  readonly project: Project;
  readonly heroLevel: number;
  readonly partyActorIds?: readonly string[];
  readonly enemyDefense: number; // 목표 적 방어력(유지값)
  readonly targetHitsToKill: number; // 영웅 평타 몇 대에 죽나
  readonly targetDamageToHeroPerHit: number; // 적 평타가 영웅에게 주는 데미지
}

export interface EnemyTuningResult {
  readonly maxHp: number;
  readonly attack: number;
  readonly rationale: {
    readonly heroAttack: number;
    readonly heroDefense: number;
    readonly heroHitDamage: number; // 영웅 평타 1대 데미지(적 방어 반영)
    readonly formula: string;
  };
}

// 영웅 능력치를 지정 레벨에서 도출하고, 데미지 공식을 역산해 maxHp/attack을 산출한다.
export function computeEnemyTuning(input: EnemyTuningInput): EnemyTuningResult {
  const partyActorIds = input.partyActorIds ?? input.project.session.partyActorIds;
  const levels: Record<string, number> = {};
  for (const actorId of partyActorIds) levels[actorId] = input.heroLevel;
  const battlers = actorBattlers(input.project, { levels, partyActorIds: [...partyActorIds] });
  const hero = battlers[0];
  const heroAttack = hero?.attackPower ?? 45;
  const heroDefense = hero?.defense ?? 59;

  // 영웅 평타 1대: attackPower + floor(attackPower/2) - floor(enemyDefense/2), 최소 1.
  const heroHitDamage = Math.max(1, heroAttack + Math.floor(heroAttack / 2) - Math.floor(input.enemyDefense / 2));
  const maxHp = Math.max(1, Math.round(input.targetHitsToKill * heroHitDamage));

  // 적 평타가 영웅에게 targetDamageToHeroPerHit를 주려면:
  // A + floor(A/2) - floor(heroDefense/2) = target  →  1.5A ≈ target + heroDefense/2.
  const attack = Math.max(1, Math.round((input.targetDamageToHeroPerHit + Math.floor(heroDefense / 2)) / 1.5));

  return {
    maxHp,
    attack,
    rationale: {
      heroAttack,
      heroDefense,
      heroHitDamage,
      formula: `maxHp = round(${input.targetHitsToKill} × ${heroHitDamage}); attack = round((${input.targetDamageToHeroPerHit} + floor(${heroDefense}/2)) / 1.5)`,
    },
  };
}
