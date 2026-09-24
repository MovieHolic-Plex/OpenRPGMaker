// 트룹 저작 직후의 결정적 밸런스 확인 — 「적이 한 번도 때리지 못한다」 를 쓰기 결과에 싣는다.
//
// 왜: 2026-09-23 도그푸딩 「등대지기의 겨울」 보스(HP 280·공 22·방 12·민 8)는 Lv1 시작 파티
// (루미아 HP 514·공 45·방 59·민 43 — 액터 기본 성장 곡선)에게 4타 만에 쓰러졌고, 게이지 전투에서
// 민첩 차이로 행동 차례가 한 번도 오지 않았다. 모델은 upsert_enemy 스키마 예시(HP 40·공 12)
// 척도로 적을 짓고 파티 스탯을 보지 않는다. 게이트가 아니라 **수치가 붙은 경고**로 돌려준다.

import { actorBattlers } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import type { Project } from "@/project/types";
import { visitProjectCommands } from "./commandTraversal";

const SAMPLES = 3;
/** 모의전에서 파티가 이 비율보다 적게 잃으면 「위협이 없다」로 본다. */
const TRIVIAL_PARTY_LOSS = 0.1;
/** 반대쪽 검사 — 시작 레벨보다 이만큼 올린 파티도 전멸하면 「이길 수 없다」로 본다(잡몹 / 보스). */
const WIPE_LEVEL_SLACK = 4;
const BOSS_WIPE_LEVEL_SLACK = 9;

/** 시작 파티 + 이미 저작된 changeParty(add) 로 들어오는 배우. */
function eventualPartyActorIds(project: Project, start: readonly string[]): string[] {
  const ids = new Set(start);
  visitProjectCommands(project, ({ command }) => {
    if (command.kind === "changeParty" && command.action === "add" && typeof command.actorId === "string") ids.add(command.actorId);
  });
  return [...ids].filter(id => project.database.actors.some(actor => actor.id === id));
}

/**
 * 「이길 수 없다」 쪽 경고. 2026-09-24 JRPG 도그푸딩 ember-2: 모델이 파티를 HP 60~90 척도로 지은 뒤 2층에
 * 기본 DB 적(코볼트 HP 322·공 49)을 그대로 넣고 보스를 HP 950·광역기로 지었다 — 합류가 끝난 3명 Lv8 도
 * 승률 0% 였는데 「너무 쉬움」 한쪽만 보는 경고는 아무 말도 하지 않았다.
 */
function unwinnableWarnings(project: Project, troopId: string, troopName: string, start: readonly string[], heroLevel: number): string[] {
  const party = eventualPartyActorIds(project, start);
  const troop = project.database.troops.find(entry => entry.id === troopId);
  const boss = (troop?.enemyIds ?? []).some(id => /boss|보스/iu.test(id)) || /boss|보스/iu.test(`${troopId} ${troopName}`);
  const level = heroLevel + (boss ? BOSS_WIPE_LEVEL_SLACK : WIPE_LEVEL_SLACK);
  const result = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party, n: SAMPLES, seed: 1 });
  if (result.winRate > 0) return [];
  const joined = party.length - start.length;
  return [
    `밸런스: ${troopName}(${troopId}) 에 Lv${level} 파티 ${party.length}명(${joined > 0 ? `시작 ${start.length} + 합류 ${joined}` : "시작 파티"})이 모의전 ${SAMPLES}판 모두 평균 ${result.avgTurns.toFixed(1)}타 만에 전멸합니다 — ` +
    `${boss ? "레벨을 올려도 이길 수 없는 보스" : "이 적 그룹이 나오는 곳을 지나갈 수 없는 잡몹"}입니다. 적 수치를 파티 척도(get_database_records actors 의 parameterCurves)에 맞춰 낮추거나 tune_enemy 로 맞추고, ` +
    `동료가 아직 합류 이벤트 없이 나중에 들어온다면 simulate_battle {troopId, heroLevel, partyActorIds:[합류 뒤 파티]} 로 다시 재세요.`,
  ];
}

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
    if (result.winRate < 1) return unwinnableWarnings(project, troopId, troop.name, partyActorIds, heroLevel);
    if (lossShare >= TRIVIAL_PARTY_LOSS) return [];
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
