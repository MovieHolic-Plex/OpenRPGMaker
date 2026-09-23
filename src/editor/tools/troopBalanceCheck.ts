// 트룹 저작 직후의 결정적 밸런스 확인 — 「적이 한 번도 때리지 못한다」 를 쓰기 결과에 싣는다.
//
// 왜: 2026-09-23 도그푸딩 「등대지기의 겨울」 보스(HP 280·공 22·방 12·민 8)는 Lv1 시작 파티
// (루미아 HP 514·공 45·방 59·민 43 — 액터 기본 성장 곡선)에게 4타 만에 쓰러졌고, 게이지 전투에서
// 민첩 차이로 행동 차례가 한 번도 오지 않았다. 모델은 upsert_enemy 스키마 예시(HP 40·공 12)
// 척도로 적을 짓고 파티 스탯을 보지 않는다. 게이트가 아니라 **수치가 붙은 경고**로 돌려준다.

import { actorBattlers } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import type { Project } from "@/project/types";

const SAMPLES = 3;
/** 모의전에서 파티가 이 비율보다 적게 잃으면 「위협이 없다」로 본다. */
const TRIVIAL_PARTY_LOSS = 0.1;

export function troopBalanceWarnings(project: Project, troopId: string): string[] {
  const troop = project.database.troops.find(entry => entry.id === troopId);
  const partyActorIds = project.session.partyActorIds ?? [];
  if (!troop || partyActorIds.length === 0) return [];
  const actors = project.database.actors.filter(actor => partyActorIds.includes(actor.id));
  if (actors.length === 0) return [];
  const heroLevel = Math.max(1, Math.min(...actors.map(actor => actor.initialLevel ?? 1)));
  try {
    const levels = Object.fromEntries(partyActorIds.map(id => [id, heroLevel]));
    const party = actorBattlers(project, { levels, partyActorIds: [...partyActorIds] });
    const partyHp = party.reduce((sum, battler) => sum + battler.maxHp, 0);
    if (partyHp <= 0) return [];
    const result = simulateBattle({ project, troopId, heroLevel, n: SAMPLES, seed: 1 });
    // 「0 피해」만 보면 514 HP 중 4 를 깎는 보스(3차 재시험)가 빠진다 — 파티 HP 의 10% 미만이면 같은 부류다.
    const lossShare = 1 - result.avgHpRemaining / partyHp;
    if (result.winRate < 1 || lossShare >= TRIVIAL_PARTY_LOSS) return [];
    const damageText = lossShare <= 0
      ? "파티 피해 0 — 한 번도 피해를 주지 못합니다"
      : `파티 HP 손실 평균 ${(lossShare * 100).toFixed(1)}% — 거의 위협이 되지 못합니다`;
    const enemies = troop.enemyIds
      .map(id => project.database.enemies.find(enemy => enemy.id === id))
      .filter((enemy): enemy is NonNullable<typeof enemy> => enemy !== undefined);
    const enemyText = enemies.map(enemy => `${enemy.id}(HP ${enemy.stats.maxHp}·공 ${enemy.stats.attack}·방 ${enemy.stats.defense}·민 ${enemy.stats.agility})`).join(", ");
    const partyText = party.map(battler => `${battler.name} Lv${heroLevel}(HP ${battler.maxHp}·공 ${battler.attackPower}·방 ${battler.defense}·민 ${battler.agility})`).join(", ");
    const first = enemies[0];
    return [
      `밸런스: 시작 파티 기준 모의전 ${SAMPLES}판 모두 평균 ${result.avgTurns.toFixed(1)}타 만에 이기고 ${damageText} — ${troop.name}(${troopId}). ` +
      `적 ${enemyText} / 파티 ${partyText}. 적의 민첩이 파티보다 크게 낮으면 게이지 전투에서 차례가 오기 전에 쓰러지고, 공격이 방어의 절반 아래면 피해가 거의 없습니다. ` +
      (first ? `tune_enemy {enemyId:"${first.id}", targetHitsToKill:(보스 8~12, 잡몹 2~4), targetDamageToHeroPerHit:(파티 HP의 10~20%)} 로 맞추고 agility 를 파티 민첩 가까이 올린 뒤 simulate_battle 로 확인하세요.` : ""),
    ];
  } catch {
    return [];
  }
}
