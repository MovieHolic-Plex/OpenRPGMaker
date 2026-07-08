import type { MutableBattler } from "@/battle/battleBattlers";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { BattleRewardsSnapshot } from "@/battle/types";
import type { Project } from "@/project/types";
import type { Rng } from "@/util/rng";

export function collectBattleRewards(project: Project, enemies: readonly MutableBattler[], rng: Rng = () => 0.5): BattleRewardsSnapshot {
  const rewardedEnemies = enemies.filter((enemy) => !enemy.hidden && enemy.captured !== true);
  return {
    exp: rewardedEnemies.reduce((sum, enemy) => sum + enemyReward(project, enemy).exp, 0),
    gold: rewardedEnemies.reduce((sum, enemy) => sum + enemyReward(project, enemy).gold, 0),
    enemyLevel: rewardedEnemies.reduce((level, enemy) => Math.max(level, enemyLevel(project, enemy)), 1),
    items: rewardedEnemies.flatMap((enemy) => {
      const reward = enemyReward(project, enemy);
      if (reward.dropItemId && reward.dropRatePercent > 0 && rng() * 100 < reward.dropRatePercent) {
        return [reward.dropItemId];
      }
      return [];
    }),
  };
}

function enemyReward(project: Project, enemy: MutableBattler) {
  const record = project.database.enemies.find((item) => item.id === enemy.recordId);
  return record ? normalizeEnemyRecord(record).rewards : { exp: 0, gold: 0, dropRatePercent: 0 };
}

function enemyLevel(project: Project, enemy: MutableBattler): number {
  const record = project.database.enemies.find((item) => item.id === enemy.recordId);
  return Math.max(1, Math.min(99, Math.trunc(record?.level ?? 1)));
}
