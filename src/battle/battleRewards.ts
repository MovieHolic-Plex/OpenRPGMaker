import { combatConditionMet } from "@/battle/combatConditions";
import type { MutableBattler } from "@/battle/battleBattlers";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { BattleRewardsSnapshot } from "@/battle/types";
import type { Project } from "@/project/types";
import type { Rng } from "@/util/rng";

export function collectBattleRewards(project: Project, enemies: readonly MutableBattler[], rng?: Rng, turn = 1, switches: Readonly<Record<string, boolean>> = {}): BattleRewardsSnapshot {
  if (!rng) throw new Error("collectBattleRewards requires an rng for deterministic drops.");
  const rewardedEnemies = enemies.filter((enemy) => !enemy.hidden && enemy.captured !== true);
  // Pity: 연속 미드랍 시 확률 가산 — 5회 천장 근접 시 +15%p 보정(최대 100%).
  // battleRewards는 stateless라 pity는 호출 단위에서 enemy 수만큼 누적 보정한다.
  let pityBonus = 0;
  const tp = rewardedEnemies.reduce((sum, enemy) => sum + (enemyReward(project, enemy).tp ?? 0), 0);
  return {
    exp: rewardedEnemies.reduce((sum, enemy) => sum + enemyReward(project, enemy).exp, 0),
    gold: rewardedEnemies.reduce((sum, enemy) => sum + enemyReward(project, enemy).gold, 0),
    // 기술 포인트는 저작된 적이 있을 때만 실는다(없는 옛 프로젝트는 스냅샷 모양 그대로).
    ...(tp > 0 ? { tp } : {}),
    enemyLevel: rewardedEnemies.reduce((level, enemy) => Math.max(level, enemyLevel(project, enemy)), 1),
    items: rewardedEnemies.flatMap((enemy) => {
      const reward = enemyReward(project, enemy);
      if (reward.drops !== undefined) return reward.drops.flatMap(drop => {
        const allies = enemies.filter(ally => ally.id !== enemy.id && !ally.hidden && !ally.captured && ally.hp > 0).length;
        if (!combatConditionMet(drop.condition, enemy, turn, allies, switches) || drop.ratePercent <= 0) return [];
        return rng() * 100 < drop.ratePercent ? Array.from({ length: drop.quantity }, () => drop.itemId) : [];
      });
      if (!reward.dropItemId || reward.dropRatePercent <= 0) return [];
      const effectiveRate = Math.min(100, reward.dropRatePercent + pityBonus);
      const hit = rng() * 100 < effectiveRate;
      if (hit) {
        pityBonus = 0;
        return [reward.dropItemId];
      }
      // 미드랍 시 다음 적에 보정 누적(최대 30%p).
      pityBonus = Math.min(30, pityBonus + 8);
      return [];
    }),
  };
}

function enemyReward(project: Project, enemy: MutableBattler) {
  const record = project.database.enemies.find((item) => item.id === enemy.recordId);
  return record ? normalizeEnemyRecord(record).rewards : { exp: 0, gold: 0, dropRatePercent: 0, drops: undefined, tp: undefined };
}

function enemyLevel(project: Project, enemy: MutableBattler): number {
  const record = project.database.enemies.find((item) => item.id === enemy.recordId);
  return Math.max(1, Math.min(99, Math.trunc(record?.level ?? 1)));
}
