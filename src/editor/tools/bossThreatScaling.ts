// 보스 적을 시작 파티 척도에 맞춘다 — 「만들어진 보스가 기본으로 위협이 된다」.
//
// 왜: 2026-09-23 도그푸딩 「등대지기의 겨울」 세 판에서 모델은 보스를 upsert_enemy 스키마 예시
// (HP 40·공 12) 척도로 지었다. 시작 파티는 액터 기본 성장 곡선으로 Lv1 에 HP 514·공 54·방 72·민 49 라,
// 보스(HP 280·공 22·민 16)는 4타 만에 쓰러지고 514 HP 중 4~7 을 깎았다(1판은 차례가 한 번도 안 왔다).
// 경고(troopBalanceWarnings)는 모델이 따를 때만 듣는다 — 파티 스탯을 모르는 채 고친 2판째도 민첩은
// 파티의 절반이었다. 보스라고 선언된 적은 쓰기 도구가 **올리기만** 하는 하한을 직접 맞추고 무엇을 바꿨는지
// 경고로 돌려준다(게이트 아님: 쓰기는 늘 성공하고, 저자가 준 값보다 낮추지 않는다).

import { actorBattlers } from "@/battle/battleBattlers";
import { computeEnemyTuning, simulateBattle } from "@/battle/simulate";
import { normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { EnemyRecord, EnemyStats, Project } from "@/project/types";

/** 보스 판정: 명시 role, 또는 id·이름에 boss/보스. */
export function isBossEnemy(record: Pick<EnemyRecord, "id" | "name">, role: unknown): boolean {
  if (role === "boss") return true;
  if (role !== undefined) return false;
  return /boss|보스/iu.test(record.id) || /boss|보스/iu.test(record.name);
}

/** 영웅 평타 몇 대에 쓰러지나(파티 1명 기준, 1명 늘 때마다 +4). */
const BOSS_HITS_TO_KILL = 10;
/** 적 평타 한 대가 영웅 최대 HP 의 몇 할인가. */
const BOSS_HIT_SHARE = 0.08;
/** 모의전에서 파티가 잃어야 하는 HP 비율의 하한과, 이겨야 하는 판 비율의 하한. */
const BOSS_MIN_PARTY_LOSS = 0.3;
const BOSS_MIN_WIN_RATE = 0.95;
const BOSS_MAX_PARTY_LOSS = 0.7;
const SIM_SAMPLES = 20;
const MAX_ROUNDS = 8;
const PROBE_TROOP_ID = "__boss_threat_probe";

export type BossScalingResult = {
  readonly stats: EnemyStats;
  readonly note?: string;
};

/**
 * `enemy` 는 이미 draft.database.enemies 안에 들어간 레코드여야 한다(모의전이 그 레코드를 읽는다).
 * 스탯을 제자리에서 바꾸고 무엇을 바꿨는지 돌려준다. 시작 파티가 없으면 아무것도 하지 않는다.
 */
export function scaleBossToStartParty(project: Project, enemy: EnemyRecord): BossScalingResult {
  const partyActorIds = project.session.partyActorIds ?? [];
  const actors = project.database.actors.filter(actor => partyActorIds.includes(actor.id));
  if (actors.length === 0) return { stats: enemy.stats };
  const heroLevel = Math.max(1, Math.min(...actors.map(actor => actor.initialLevel ?? 1)));
  const levels = Object.fromEntries(partyActorIds.map(id => [id, heroLevel]));
  const party = actorBattlers(project, { levels, partyActorIds: [...partyActorIds] });
  const hero = party[0];
  if (!hero || hero.maxHp <= 0) return { stats: enemy.stats };
  const partyHp = party.reduce((sum, battler) => sum + battler.maxHp, 0);
  const partyAgility = party.reduce((sum, battler) => sum + battler.agility, 0) / party.length;

  const before = { ...enemy.stats };
  const tuning = computeEnemyTuning({
    project,
    heroLevel,
    enemyDefense: enemy.stats.defense,
    targetHitsToKill: BOSS_HITS_TO_KILL + 4 * (party.length - 1),
    targetDamageToHeroPerHit: Math.max(1, Math.round(hero.maxHp * BOSS_HIT_SHARE)),
  });
  // 하한만 올린다. 마법 스킬은 mind 로 때리므로 mind 도 같은 공격 하한을 받는다. 민첩이 크게 낮으면
  // 게이지 전투에서 차례가 오기 전에 쓰러진다(1판째 「보스가 한 번도 공격하지 않았다」).
  const stats: EnemyStats = {
    ...enemy.stats,
    maxHp: Math.max(enemy.stats.maxHp, tuning.maxHp),
    attack: Math.max(enemy.stats.attack, tuning.attack),
    mind: Math.max(enemy.stats.mind, tuning.attack),
    agility: Math.max(enemy.stats.agility, Math.round(partyAgility * 0.9)),
  };
  enemy.stats = stats;

  const probe = normalizeTroopRecord({ id: PROBE_TROOP_ID, name: enemy.name, enemyIds: [enemy.id] });
  project.database.troops.push(probe);
  let outcome: { winRate: number; loss: number } | undefined;
  try {
    const measure = () => {
      const result = simulateBattle({ project, troopId: PROBE_TROOP_ID, heroLevel, n: SIM_SAMPLES, seed: 1 });
      return { winRate: result.winRate, loss: 1 - result.avgHpRemaining / partyHp };
    };
    outcome = measure();
    // 하한이 너무 세면(스킬 위력·다수 행동으로 파티가 진다) 올린 공격·마력만 15%씩 되돌린다 — 저자 값 아래로는 안 간다.
    for (let round = 0; round < MAX_ROUNDS && (outcome.winRate < BOSS_MIN_WIN_RATE || outcome.loss > BOSS_MAX_PARTY_LOSS); round += 1) {
      const attack = Math.max(before.attack, Math.floor(enemy.stats.attack * 0.85));
      const mind = Math.max(before.mind, Math.floor(enemy.stats.mind * 0.85));
      if (attack === enemy.stats.attack && mind === enemy.stats.mind) break;
      enemy.stats = { ...enemy.stats, attack, mind };
      outcome = measure();
    }
    // 모의전이 여전히 「거의 안 맞는다」면 공격만 20%씩 올린다. 파티가 지기 시작하면 한 단계 되돌리고 멈춘다.
    for (let round = 0; round < MAX_ROUNDS && outcome.winRate >= BOSS_MIN_WIN_RATE && outcome.loss < BOSS_MIN_PARTY_LOSS; round += 1) {
      const previous = { attack: enemy.stats.attack, mind: enemy.stats.mind };
      enemy.stats = { ...enemy.stats, attack: Math.ceil(enemy.stats.attack * 1.2), mind: Math.ceil(enemy.stats.mind * 1.2) };
      const next = measure();
      if (next.winRate < BOSS_MIN_WIN_RATE || next.loss > BOSS_MAX_PARTY_LOSS) {
        enemy.stats = { ...enemy.stats, ...previous };
        break;
      }
      outcome = next;
    }
  } catch {
    outcome = undefined;
  } finally {
    const index = project.database.troops.findIndex(troop => troop.id === PROBE_TROOP_ID);
    if (index >= 0) project.database.troops.splice(index, 1);
  }

  const changed = (["maxHp", "attack", "mind", "agility"] as const).filter(key => enemy.stats[key] !== before[key]);
  if (changed.length === 0) return { stats: enemy.stats };
  const diff = changed.map(key => `${key} ${before[key]}→${enemy.stats[key]}`).join(", ");
  const measured = outcome ? ` — 모의전 ${SIM_SAMPLES}판 승률 ${Math.round(outcome.winRate * 100)}%, 파티 HP 손실 평균 ${Math.round(outcome.loss * 100)}%` : "";
  return {
    stats: enemy.stats,
    note: `보스 위협 하한 적용(시작 파티 Lv${heroLevel} HP ${partyHp}·공 ${hero.attackPower}·방 ${hero.defense}·민 ${Math.round(partyAgility)} 기준, 올리기만 함): ${diff}${measured}. ` +
      `더 쉽거나 어렵게 하려면 tune_enemy 로 조정하고 simulate_battle 로 확인하세요.`,
  };
}
