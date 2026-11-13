// ai/v2/story/pathBattleTension.ts
// 길 위 전투의 긴장 — 끝맺음 path-battles(pathBattleBudget.fitPathBattlesIn)가 쓰는 재료. 결정적(모의 시드 고정)·되풀이 안전.
//
// 왜(2026-11-12 오너가 해 본 판): 길 적은 두 대에 쓰러지며 한 번도 못 쳤고, 보스는 «공격» 만 눌러 HP 514 중 123 을 잃고 이겼다(받은 회복약 넷은 안 썼다).
// 레벨이 올라도 최대 HP 가 514 그대로였다 — 기본 능력치 곡선은 99레벨까지의 2차 곡선이라 처음 몇 레벨은 값이 안 바뀐다.
//
// 규칙:
//  - 시작 파티의 능력치 곡선은 레벨마다 눈에 보이게 오른다(바닥: 시작 레벨 값의 몇 % 씩). 원래 곡선이 더 가파른 구간은 그대로.
//  - 보스는 싸움의 길이가 아니라 차례마다 하는 일로 위협한다(2026-11-13 감독 교정 둘).
//    «쉬고 온 풀 HP» 가 여느 도착이다 — 빌더는 보스마다 그 앞에 쉼터 결정을 둔다. 보스는 쉬고 온 기준 파티(길 위 전투를 반쯤 치른 레벨)로 맞춘다.
//    여느 플레이(기술·공격, HP 45% 아래에서 약)로 6~10턴(12턴 상한), 약은 앞 보스 1~3개 · 마지막 보스 2~4개. 시작 회복약은 늘리지 않는다.
//    «공격만·회복 없음»(같은 기준 파티) 은 마지막 보스에게만 못 이기고(승률 ≤ 10%), 앞 보스에게는 이기되(≥ 50%) HP 절반 아래로 끝난다.
//    쉬지 않고 낮게 도착한 판은 질 수 있다(지면 그 방 입구의 결정 곁에서 다시 선다) — 재는 탐침(자동·정직한 플레이)이 쉼터를 쓰고 여느 플레이처럼 싸운다(기술·약).
//    올리기는 한 대(공격·마력·길 사본 피해 기술의 위력) — HP 는 올리지 않고, 길어지면 내린다. 한 대의 상한에 닿은 기술은 그 자리에 두고 약한 한 대를 마저 올린다
//    (차례마다 고르게 아프다 — 평타 50·기술 130 이 섞인 보스는 운 좋은 «공격만» 이 이긴다).
//    마지막 보스는 한 대만으로 «공격만» 을 못 막는다(주인공의 기술과 평타의 차이가 작아, 평타로 못 이기게 올리면 기술로도 약 4개 안에 못 이긴다) —
//    그때는 껍질을 두껍게 한다: 방어를 올리고 그만큼 HP 를 내린다. 평타는 덜 먹히고 기술은 먹힌다 — 여느 플레이의 싸움 길이는 그대로다.
import { SENSIBLE_POTION_HP_RATIO, simulateBattle } from "@/battle/simulate";
import { actorBattlers } from "@/battle/battleBattlers";
import { ACTOR_LEVEL_MAX, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import type { EnemyRecord, Project } from "@/project/types";

/** 마지막 단계의 보스전 몫으로 시작 소지품에 넣는 회복약 수(그 밖의 전투는 하나씩) — pathBattleBudget 의 시작 회복약. 가장 높게 도착한 판은 밴드의 약 하한만 든 채로 잰다. */
export const BOSS_POTIONS = 2;
/**
 * 보스 밴드 — 싸우는 단계의 상대는 모두 이 안에 선다. 재는 파티는 **쉬고 온 기준 파티**(풀 HP · 그 보스 앞에 가장 낮게·가장 높게 도착하는 레벨의 가운데 ·
 * 시작 약에서 앞 보스전이 쓴 만큼을 뺀 약). 위협은 차례마다 하는 일에서 온다 — 싸움의 길이에서가 아니다.
 *  여느 플레이(기술·공격, HP potionAt 아래에서 약)가 minWin 이상 이기고 targetTurns 안에 끝난다(turns 는 넘으면 안 되는 상한 — 길면 HP 를 내린다. 짧아도 HP 는 올리지 않는다).
 *  약: 여느 플레이가 쓰는 수가 앞 보스 midPotions · 마지막 보스 finalPotions 안. 위쪽 끝은 든 약의 수다.
 *  «공격만·회복 없음»(같은 기준 파티): 마지막 보스는 이기는 판이 attackOnlyMaxWin 이하, 앞 보스는 남는 HP 가 평균 attackOnlyMaxLeft 아래이되 이기는 판이 midAttackOnlyMinWin 이상.
 *  가장 낮게 도착한 판의 여느 플레이 · 가장 높게 도착한 판의 «공격만» 은 기준이 아니다 — 줄에 값만 적는다.
 */
export const BOSS_BAND = { minWin: 0.95, turns: 12, targetTurns: [6, 10], midPotions: [1, 3], finalPotions: [2, 4], attackOnlyMaxWin: 0.1, attackOnlyMaxLeft: 0.5, midAttackOnlyMinWin: 0.5, potionAt: SENSIBLE_POTION_HP_RATIO } as const;
const RAISE_ROUNDS = 24;
/**
 * 보스의 가장 센 한 대의 상한 — 기준 레벨의 선두 영웅 최대 HP 의 BOSS_HIT_CAP(두 대를 맞고도 서 있다)과 회복약 하나가 채우는 양의 몫 가운데 작은 쪽.
 * 약의 몫은 세 단: 먼저 2/3(약을 마신 차례에 맞고도 1/3 이 남고, 치명타가 나도 약을 마시는 문턱 위에서 쓰러지지 않는다 — 약을 쓰는 플레이가 운으로 지지 않는다),
 * 그 안에서 밴드의 위협에 못 닿으면 약 하나까지, 그래도 못 닿으면 HP 의 몫만(2026-11-13 r2t-fun 서리 정령: 약 하나 150 안에서는 «공격만» 을 못 막았고 159 에서 막았다 —
 * 여느 플레이는 그대로 100% 였다). 어느 단에서든 걸음은 여느 플레이의 기준(승률·턴 상한)을 지킬 때만 받는다.
 * 한 대는 그 적의 행동표로 잰다(평타 = 공격력이 위력, 기술 = 제 위력) — 평타만 보면 기술로 치는 보스가 빠진다.
 */
const BOSS_HIT_CAP = 0.4;
const BOSS_HIT_PER_POTION = [2 / 3, 1, Infinity] as const;
/** 올리는 걸음이 HP 를 내릴 때의 바닥(올리기 전 값 대비). */
const HP_FLOOR = 0.5;
const SAMPLES = 24;

/** 레벨 하나에 오르는 바닥(시작 레벨 값 대비). */
const GROWTH_PER_LEVEL = { maxHp: 0.06, maxMp: 0.05, attack: 0.04, defense: 0.04, mind: 0.04, agility: 0.03 } as const;

/**
 * 시작 파티 배우의 능력치 곡선에 «레벨마다 오르는» 바닥을 준다 — 시작 레벨 값 × (1 + 몫 × 오른 레벨 수). 원래 곡선이 더 높은 레벨은 그대로.
 * 전투 능력치의 정본은 배우 parameterCurves 다(직업 곡선이 아니다). 되풀이 안전(이미 바닥 위면 그대로).
 */
export function growStartPartyCurves(project: Project, ids: readonly string[]): string[] {
  const notes: string[] = [];
  for (const actor of project.database.actors) {
    if (!ids.includes(actor.id)) continue;
    const normal = normalizeActorRecord(actor);
    const start = Math.max(1, normal.initialLevel);
    let changed = false;
    const next = { ...normal.parameterCurves };
    for (const key of Object.keys(GROWTH_PER_LEVEL) as (keyof typeof GROWTH_PER_LEVEL)[]) {
      const curve = [...normal.parameterCurves[key]];
      const base = curve[start - 1] ?? curve[0] ?? 1;
      for (let level = start + 1; level <= ACTOR_LEVEL_MAX; level += 1) {
        const floor = Math.round(base * (1 + GROWTH_PER_LEVEL[key] * (level - start)));
        if ((curve[level - 1] ?? 0) >= floor) continue;
        curve[level - 1] = floor;
        changed = true;
      }
      next[key] = curve;
    }
    if (!changed) continue;
    actor.parameterCurves = next;
    const hp = next.maxHp;
    notes.push(`${actor.name} 능력치 곡선 — 레벨마다 오르게(최대 HP Lv${start} ${hp[start - 1]} → Lv${start + 1} ${hp[start]} → Lv${Math.min(ACTOR_LEVEL_MAX, start + 4)} ${hp[Math.min(ACTOR_LEVEL_MAX, start + 4) - 1]})`);
  }
  return notes;
}

/** 시작 레벨에서 그 경험치로 닿는 레벨(선두 배우의 곡선). */
export function levelAfter(project: Project, leadId: string | undefined, startLevel: number, exp: number): number {
  const lead = project.database.actors.find((a) => a.id === leadId);
  if (!lead || exp <= 0) return startLevel;
  const curve = normalizeActorRecord(lead).expCurve;
  let level = startLevel;
  while (level < ACTOR_LEVEL_MAX && totalExpForLevel(curve, level + 1) - totalExpForLevel(curve, startLevel) <= exp) level += 1;
  return level;
}

/**
 * 보스 앞에 쉬고 온 파티. level = 기준 레벨(= minLevel — 곧장 온 판. 2026-11-13 키보드 플레이 다섯 보스: 도착 레벨이 넷은 minLevel, 하나는 그보다 하나 아래였다), potions = 그때 든 약.
 * minLevel = 피할 수 있는 전투를 다 피한 판 · maxLevel = 길 위 전투를 다 이긴 판. final = 그 게임의 마지막 보스(밴드의 약 범위와 «공격만» 기준이 다르다).
 */
export interface BossParty {
  readonly ids: readonly string[]; readonly minLevel: number; readonly maxLevel: number; readonly level: number; readonly potion?: string;
  readonly final: boolean; readonly potions: number;
}

/** 그 보스의 약 범위 [적어도, 많아야]. */
export const bossPotionBand = (final: boolean): readonly [number, number] => final ? BOSS_BAND.finalPotions : BOSS_BAND.midPotions;

const hpAt = (project: Project, ids: readonly string[], level: number): number =>
  actorBattlers(project, { levels: Object.fromEntries(ids.map((id) => [id, level])), partyActorIds: [...ids] }).reduce((sum, b) => sum + b.maxHp, 0);

export interface BossPlay {
  /** 여느 플레이(쉬고 온 기준 파티 · 기술+약)의 승률. */
  readonly win: number;
  /** 그 턴(약 쓰는 차례 포함). */
  readonly turns: number;
  /** 잃는 HP. */
  readonly loss: number;
  /** 쓰는 약. */
  readonly potions: number;
}
const NO_PLAY: BossPlay = { win: 0, loss: 1, turns: 99, potions: 0 };

const stock = (party: BossParty) => (party.potion ? { inventory: { [party.potion]: party.potions }, potionItemId: party.potion } : {});

/**
 * 보스를 «여느 플레이» 로 잰다 — 쉬고 온 그 레벨(기본은 기준 레벨)의 파티가 기술·공격을 쓰고 HP 45% 아래에서 약을 쓴다.
 * 자동 플레이·정직한 플레이도 이렇게 싸운다(testing/sceneTestRunner 의 전투 수: 약 → 가장 센 기술 → 공격).
 */
export function measureBossSensible(project: Project, troopId: string, party: BossParty, level = party.level): BossPlay {
  const r = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true, potionHpRatio: BOSS_BAND.potionAt, ...stock(party) });
  return { win: r.winRate, turns: r.avgTurns, potions: r.avgPotionsUsed ?? 0, loss: Math.max(0, 1 - r.avgHpRemaining / Math.max(1, hpAt(project, party.ids, level))) };
}

/** 그 보스전에서 여느 플레이가 쓰는 약(못 재면 0) — 다음 보스 앞의 약을 셀 때 쓴다. */
export function bossPotionsSpent(project: Project, troopId: string, party: BossParty): number {
  try { return measureBossSensible(project, troopId, party).potions; } catch { return 0; }
}

type AttackOnly = { readonly win: number; readonly turns: number; readonly left: number };
/** 보스를 «공격만·회복 없음» 으로 잰다 — 쉬고 온 그 레벨의 파티가 약 없이 공격만(기본은 기준 레벨). left = 끝났을 때 남는 HP 의 평균(진 판은 0) / 최대 HP. */
export function measureBossAttackOnly(project: Project, troopId: string, party: BossParty, level = party.level): AttackOnly {
  const r = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party.ids, n: SAMPLES, seed: 11 });
  return { win: r.winRate, turns: r.avgTurns, left: Math.max(0, r.avgHpRemaining) / Math.max(1, hpAt(project, party.ids, level)) };
}

export const bossSensibleFits = (m: { win: number; turns: number }): boolean => m.win >= BOSS_BAND.minWin && m.turns <= BOSS_BAND.turns;

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 그 보스가 아직 못 닿은 위협 — «공격만» 기준과 약의 아래쪽 끝. 비면 올릴 것이 없다. */
function threatGaps(party: BossParty, sensible: BossPlay, attackOnly: AttackOnly): string[] {
  const least = bossPotionBand(party.final)[0];
  return [
    ...(party.final && attackOnly.win > BOSS_BAND.attackOnlyMaxWin ? [`공격만 승률 ${pct(attackOnly.win)} > ${pct(BOSS_BAND.attackOnlyMaxWin)}`] : []),
    ...(!party.final && attackOnly.left >= BOSS_BAND.attackOnlyMaxLeft ? [`공격만으로 남는 HP ${pct(attackOnly.left)} ≥ ${pct(BOSS_BAND.attackOnlyMaxLeft)}`] : []),
    ...(party.potion && sensible.potions < least - 0.05 ? [`약 ${sensible.potions.toFixed(1)}개 < ${least}개`] : []),
  ];
}

/**
 * 보스 하나가 밴드 안인가 — 쉬고 온 기준 파티로 잰 값과 함께 한 줄. 밖이면 무엇이 밖인지 적는다.
 * 올리기가 멈춘 보스(더 올리면 여느 플레이로 못 이기거나 한 대가 상한을 넘는다)는 위협이 밴드 밖으로 남는다 — 그 사실이 이 줄에 남는다.
 * 기준이 아닌 두 값도 적는다: 가장 낮게 도착한 판의 여느 플레이 승률 · 가장 높게 도착한 판의 «공격만» 승률.
 */
export function bossBandLine(project: Project, troopId: string, party: BossParty): string | undefined {
  let sensible: BossPlay, attackOnly: AttackOnly, high: AttackOnly, lowWin: number;
  try {
    sensible = measureBossSensible(project, troopId, party); attackOnly = measureBossAttackOnly(project, troopId, party);
    high = party.maxLevel === party.level ? attackOnly : measureBossAttackOnly(project, troopId, party, party.maxLevel);
    lowWin = party.minLevel === party.level ? sensible.win : measureBossSensible(project, troopId, party, party.minLevel).win;
  } catch { return undefined; }
  const most = bossPotionBand(party.final)[1], [shortest, longest] = BOSS_BAND.targetTurns;
  const out = [
    ...(sensible.win < BOSS_BAND.minWin ? [`여느 플레이 승률 ${pct(sensible.win)} < ${pct(BOSS_BAND.minWin)}`] : []),
    ...(sensible.turns > longest ? [`${sensible.turns.toFixed(1)}턴 > ${longest}턴`] : []),
    ...(sensible.turns < shortest ? [`${sensible.turns.toFixed(1)}턴 < ${shortest}턴(짧다 — HP 는 올리지 않는다)`] : []),
    ...threatGaps(party, sensible, attackOnly),
    ...(party.potion && sensible.potions > most + 0.05 ? [`약 ${sensible.potions.toFixed(1)}개 > ${most}개`] : []),
    ...(!party.final && attackOnly.win < BOSS_BAND.midAttackOnlyMinWin ? [`공격만 승률 ${pct(attackOnly.win)} < ${pct(BOSS_BAND.midAttackOnlyMinWin)}(앞 보스가 벽이다)`] : []),
  ];
  const troop = project.database.troops.find((t) => t.id === troopId);
  const hp = project.database.enemies.filter((e) => troop?.enemyIds.includes(e.id)).reduce((sum, e) => sum + e.stats.maxHp, 0);
  const arrive = `쉬고 온 Lv${party.level}(도착 Lv${party.minLevel}${party.maxLevel !== party.minLevel ? `~${party.maxLevel}` : ""})${party.potion ? `·약 ${party.potions}개` : ""}`;
  const aside = [
    ...(party.minLevel !== party.level ? [`쉬고 온 Lv${party.minLevel} 의 여느 플레이 승률 ${pct(lowWin)}`] : []),
    ...(party.maxLevel !== party.level ? [`쉬고 온 Lv${party.maxLevel} 의 공격만 승률 ${pct(high.win)}·남는 HP ${pct(high.left)}`] : []),
  ];
  return `보스 밴드 ${out.length ? "밖" : "안"} — 「${troop?.name ?? troopId}」(${party.final ? "마지막 보스" : "앞 보스"} · HP ${hp}) ${arrive}: 여느 플레이(기술·공격, HP ${pct(BOSS_BAND.potionAt)} 아래에서 약) 승률 ${pct(sensible.win)}·${sensible.turns.toFixed(1)}턴·약 ${sensible.potions.toFixed(1)}개 · 공격만·회복 없음 승률 ${pct(attackOnly.win)}·남는 HP ${pct(attackOnly.left)}${aside.length ? ` [기준 밖의 값: ${aside.join(" · ")}]` : ""}${out.length ? ` (밖: ${out.join(" · ")})` : ""}`;
}

type Stats = EnemyRecord["stats"];
const harder = (by: number) => (s: Stats): Stats => ({ ...s, attack: Math.max(1, Math.ceil(s.attack * by)), mind: Math.max(1, Math.ceil(s.mind * by)) });
/**
 * 한 바퀴에 해 보는 걸음 — hits: 공격·마력과 길 사본 피해 기술의 위력에 곱한다(skillsOnly 면 기술의 위력만) · hp: HP 에 곱한다(1 이하 — 올리지 않는다).
 * 바퀴마다 여느 플레이의 기준을 지키는 걸음 가운데 위협을 가장 많이 올리는 것을 받는다.
 */
const RAISE_STEPS: readonly { readonly hits: number; readonly hp: number; readonly skillsOnly?: boolean }[] = [
  { hits: 1.12, hp: 1 }, { hits: 1.25, hp: 1 },
  // 제 위력으로 치는 기술만 — 평타가 상한에 닿았는데 주로 쓰는 기술은 약할 때(모았다 쏘는 숨결).
  { hits: 1.25, hp: 1, skillsOnly: true },
  { hits: 1.12, hp: 0.9 }, { hits: 1.25, hp: 0.85 },
];
/**
 * 마지막 보스의 껍질 — [평타가 먹히는 몫(원래 방어일 때 대비), HP 에 곱하는 값]. 덜 바꾸는 것부터 해 본다: 한 대만 → 방어를 한 단 올리고 HP 를 차례로 내린다 → 방어를 한 단 더.
 * 평타가 덜 먹히는 만큼 기술과 평타의 차이가 벌어진다 — «공격만» 은 싸움이 길어져 지고, 기술로 싸우는 판은 HP 를 내린 만큼 길이가 그대로다.
 * 평타는 원래의 38% 아래로는 내리지 않는다(평타가 0 이 되는 벽은 세우지 않는다). HP 는 올리지 않는다.
 */
const SHELLS: readonly (readonly [number, number])[] = [[1, 1], ...[0.75, 0.55, 0.38].flatMap((plainShare) => [1, 0.85, 0.7, 0.6, 0.5].map((hp) => [plainShare, hp] as const))];
/** 껍질마다 해 보는 한 대의 배율(처음 값 대비) — 작은 것부터, «공격만» 을 막는 가장 작은 한 대를 고른다(약을 가장 덜 쓰는 싸움). */
const HIT_LEVELS = [1, 1.12, 1.25, 1.4, 1.57, 1.76, 1.97, 2.2, 2.5, 2.8] as const;
/** 이미 껍질을 찾아 본 보스(능력치·파티가 같은 것) — 끝맺음이 여러 번 돌아도 같은 탐색을 되풀이하지 않는다. */
const shellTried = new Set<string>();
/** 길 사본의 피해 기술(`skill_path_*`) — 한 대를 올리고 내릴 때 위력도 같은 비율로 움직인다(능력치만 올리면 제 위력으로 치는 기술은 절반만 따라온다). */
const PATH_SKILL = /^skill_path_/u;

/** 그 능력치의 적이 영웅에게 주는 가장 센 한 대 — 행동표의 피해 기술마다 (위력 + 능력/2 − 방어/2) × 타수, 평타(skill_attack)는 공격력이 위력이다. 식을 가진 기술은 세지 않는다. */
function hardestHit(project: Project, enemy: EnemyRecord, stats: Stats, hero: { readonly defense: number; readonly mind: number }): number {
  const ids = new Set([...(enemy.actions ?? []).map((a) => a.skillId), ...(enemy.skillIds ?? [])]);
  if (!ids.size) ids.add(DEFAULT_SKILL_ID);
  let most = 0;
  for (const id of ids) {
    const skill = project.database.skills.find((k) => k.id === id);
    if (!skill || skill.effect.kind !== "damage" || skill.effect.affects === "mp" || skill.damageFormula) continue;
    const mind = skill.effect.statistic === "mind";
    const power = id === DEFAULT_SKILL_ID ? stats.attack : skill.power;
    const hits = skill.hitSequence?.length ? skill.hitSequence.reduce((sum, n) => sum + n, 0) : 1;
    most = Math.max(most, (power + Math.floor((mind ? stats.mind : stats.attack) / 2) - Math.floor((mind ? hero.mind : hero.defense) / 2)) * hits);
  }
  return most;
}

/**
 * 보스 무리(길 사본 — 적은 `enemy_path_*`)의 한 대(마지막 보스는 껍질도)를 밴드의 위협에 닿을 때까지 올린다(마지막 보스: «공격만» 으로 못 이긴다 · 앞 보스: «공격만» 이 이기되 HP 절반 아래로 끝난다 · 약을 적어도 쓰게 한다).
 * 바퀴마다 걸음을 모두 해 보고 여느 플레이의 기준(승률·바라는 길이·약의 위쪽 끝)을 지키는 것 가운데 위협을 가장 많이 올리는 걸음을 받는다. 위협에 닿거나 나아지는 걸음이 없으면 멈춘다 — 그래서 다시 돌려도 더 오르지 않는다.
 * HP 는 올리지 않는다. 바꾼 것 한 줄(없으면 undefined).
 */
export function raiseBossTension(project: Project, troopId: string, party: BossParty): string | undefined {
  const enemyIds = new Set(project.database.troops.find((t) => t.id === troopId)?.enemyIds ?? []);
  const enemies = project.database.enemies.filter((e) => enemyIds.has(e.id));
  if (!enemies.length) return undefined;
  let attackOnly: AttackOnly;
  let sensible: BossPlay;
  try { attackOnly = measureBossAttackOnly(project, troopId, party); sensible = measureBossSensible(project, troopId, party); } catch { return undefined; }
  if (!bossSensibleFits(sensible) || !threatGaps(party, sensible, attackOnly).length) return undefined;
  const hero = actorBattlers(project, { levels: Object.fromEntries(party.ids.map((id) => [id, party.level])), partyActorIds: [...party.ids] })[0];
  const potion = project.database.items.find((item) => item.id === party.potion);
  const heal = potion && hero ? potion.hpRecovery.flat + hero.maxHp * potion.hpRecovery.percentMax / 100 : 0;
  let hitCap = Infinity;
  const skillIds = new Set(enemies.flatMap((e) => [...(e.actions ?? []).map((a) => a.skillId), ...(e.skillIds ?? [])]));
  const skills = project.database.skills.filter((k) => skillIds.has(k.id) && PATH_SKILL.test(k.id) && k.effect.kind === "damage" && k.power > 0);
  const before = { attackOnly, sensible, stats: enemies.map((e) => ({ ...e.stats })), powers: skills.map((k) => k.power) };
  // 평타(기준 파티 선두)가 그 방어에 주는 피해 — 껍질의 방어를 잰다.
  const plain = (defense: number) => hero ? Math.max(1, hero.attackPower + Math.floor(hero.attackPower / 2) - Math.floor(defense / 2)) : 1;
  /** 상한을 넘는 기술은 상한에 둔다(위력을 깎는다) — 약한 한 대(평타)는 마저 오른다. */
  const clampSkills = (cap: number): void => {
    if (!hero || !Number.isFinite(cap)) return;
    for (const k of skills) {
      const mind = k.effect.kind === "damage" && k.effect.statistic === "mind", hits = k.hitSequence?.length ? k.hitSequence.reduce((sum, n) => sum + n, 0) : 1;
      const stat = Math.max(...enemies.filter((e) => (e.actions ?? []).some((a) => a.skillId === k.id) || (e.skillIds ?? []).includes(k.id)).map((e) => mind ? e.stats.mind : e.stats.attack), 0);
      const most = Math.floor(cap / hits) - Math.floor(stat / 2) + Math.floor((mind ? hero.mind : hero.defense) / 2);
      if (!k.damageFormula && k.power > most) k.power = Math.max(1, most);
    }
  };
  /**
   * 마지막 보스의 껍질 찾기 — 껍질(방어·HP)마다 «공격만» 을 막는 가장 작은 한 대를 찾고, 그때 여느 플레이가 밴드 안이면 그것으로 둔다. 못 찾으면 처음 값으로 되돌린다.
   * 한 대가 세질수록 «공격만» 은 덜 이기고 여느 플레이는 약을 더 쓴다 — 그래서 한 대는 작은 것부터 훑고, 여느 플레이가 밴드를 넘으면 그 껍질은 접는다.
   */
  const shell = (): boolean => {
    const cap = hero ? hero.maxHp * BOSS_HIT_CAP : Infinity;
    const [least, most] = bossPotionBand(true);
    const put = (hits: number, plainShare: number, hp: number): boolean => {
      enemies.forEach((e, i) => {
        const o = before.stats[i]!;
        const defense = plainShare < 1 ? o.defense + Math.floor(plain(o.defense) * (1 - plainShare)) * 2 : o.defense;
        e.stats = { ...o, attack: Math.max(1, Math.ceil(o.attack * hits)), mind: Math.max(1, Math.ceil(o.mind * hits)), defense, maxHp: Math.max(Math.ceil(o.maxHp * HP_FLOOR), Math.floor(o.maxHp * hp)) };
      });
      skills.forEach((k, i) => { k.power = Math.max(1, Math.round(before.powers[i]! * hits)); });
      clampSkills(cap);
      return !hero || !enemies.some((e) => hardestHit(project, e, e.stats, hero) > cap);
    };
    for (const [plainShare, hp] of SHELLS) for (const hits of HIT_LEVELS) {
      if (!put(hits, plainShare, hp)) break;
      let ao: AttackOnly, play: BossPlay;
      try { ao = measureBossAttackOnly(project, troopId, party); if (ao.win > BOSS_BAND.attackOnlyMaxWin) continue; play = measureBossSensible(project, troopId, party); } catch { break; }
      if (!bossSensibleFits(play) || play.turns > BOSS_BAND.targetTurns[1] || (party.potion && play.potions > most + 0.05)) break;
      if (party.potion && play.potions < least - 0.05) continue;
      sensible = play; attackOnly = ao;
      return true;
    }
    enemies.forEach((e, i) => { e.stats = before.stats[i]!; });
    skills.forEach((k, i) => { k.power = before.powers[i]!; });
    return false;
  };
  /** 아직 못 닿은 위협의 크기 — 작을수록 밴드에 가깝다. 마지막 보스 = «공격만» 이 이기는 몫, 앞 보스 = «공격만» 으로 남는 HP. 약의 아래쪽 끝에 모자란 만큼을 더한다. */
  const threat = (play: BossPlay, ao: AttackOnly) => (party.final ? ao.win : ao.left) + (party.potion ? Math.max(0, bossPotionBand(party.final)[0] - play.potions) * 0.1 : 0);
  type Tried = { readonly stats: Stats[]; readonly powers: number[]; readonly play: BossPlay; readonly ao: AttackOnly };
  /** 걸음 하나를 해 보고 되돌린다 — 여느 플레이의 기준을 지키면 그 결과, 아니면 undefined. */
  const attempt = (candidate: (typeof RAISE_STEPS)[number]): Tried | undefined => {
    const saved = enemies.map((e) => e.stats), powers = skills.map((k) => k.power);
    const undo = () => { enemies.forEach((e, i) => { e.stats = saved[i]!; }); skills.forEach((k, i) => { k.power = powers[i]!; }); return undefined; };
    enemies.forEach((e, i) => {
      const up = candidate.skillsOnly ? e.stats : harder(candidate.hits)(e.stats);
      e.stats = { ...up, maxHp: Math.max(Math.ceil(before.stats[i]!.maxHp * HP_FLOOR), Math.floor(up.maxHp * candidate.hp)) };
    });
    for (const k of skills) k.power = Math.max(1, Math.round(k.power * candidate.hits));
    clampSkills(hitCap);
    const moved = enemies.some((e, i) => e.stats.attack !== saved[i]!.attack || e.stats.mind !== saved[i]!.mind) || skills.some((k, i) => k.power !== powers[i]);
    if (!moved || (hero && enemies.some((e) => hardestHit(project, e, e.stats, hero) > hitCap))) return undo();
    let next: BossPlay;
    try { next = measureBossSensible(project, troopId, party); } catch { next = NO_PLAY; }
    // 한 대가 세지면 약 쓰는 차례가 늘어 싸움이 길어진다 — 바라는 길이(targetTurns 의 위쪽 끝)와 약의 위쪽 끝을 넘기는 걸음은 받지 않는다.
    if (!bossSensibleFits(next) || next.turns > Math.max(BOSS_BAND.targetTurns[1], sensible.turns)) return undo();
    if (party.potion && next.potions > Math.max(bossPotionBand(party.final)[1] + 0.05, sensible.potions)) return undo();
    let ao: AttackOnly;
    try { ao = measureBossAttackOnly(project, troopId, party); } catch { return undo(); }
    // 앞 보스는 벽이 되지 않는다 — «공격만» 이 이기지 못하게 되는 걸음은 받지 않는다.
    if (!party.final && ao.win < BOSS_BAND.midAttackOnlyMinWin) return undo();
    const tried = { stats: enemies.map((e) => e.stats), powers: skills.map((k) => k.power), play: next, ao };
    undo();
    return tried;
  };
  /** 한 바퀴 — 받을 수 있는 걸음 가운데 위협을 가장 많이 올리는 것을 받는다(같으면 약을 덜 쓰는 것). 나아지는 걸음이 없으면 false. */
  const step = (): boolean => {
    let best: Tried | undefined;
    for (const candidate of RAISE_STEPS) {
      const tried = attempt(candidate);
      if (!tried || threat(tried.play, tried.ao) >= threat(sensible, attackOnly) - 1e-6) continue;
      if (!best || threat(tried.play, tried.ao) < threat(best.play, best.ao) - 1e-6 || (Math.abs(threat(tried.play, tried.ao) - threat(best.play, best.ao)) <= 1e-6 && tried.play.potions < best.play.potions)) best = tried;
    }
    if (!best) return false;
    enemies.forEach((e, i) => { e.stats = best!.stats[i]!; });
    skills.forEach((k, i) => { k.power = best!.powers[i]!; });
    sensible = best.play; attackOnly = best.ao;
    return true;
  };
  let gaps = threatGaps(party, sensible, attackOnly);
  // 마지막 보스는 먼저 밴드 안의 껍질을 찾는다 — 찾으면 그것으로 끝, 못 찾으면 아래의 한 대 올리기로 닿는 데까지.
  const shellKey = party.final ? JSON.stringify([troopId, before.stats, before.powers, party]) : "";
  if (party.final && !shellTried.has(shellKey)) {
    if (shell()) gaps = threatGaps(party, sensible, attackOnly);
    else shellTried.add(shellKey);
  }
  // 앞 보스의 한 대는 첫 단(약 하나의 2/3)을 넘지 않는다 — 한 대가 약 하나에 가까우면 약만 마시는 싸움이 된다
  // (2026-11-13 r2s-fun 키보드 플레이: 한 대 112 의 인형에게 45% 에서 약을 쓰는 플레이가 약 4개·11번의 명령을 썼다).
  for (const share of heal > 0 ? (party.final ? BOSS_HIT_PER_POTION : BOSS_HIT_PER_POTION.slice(0, 1)) : [Infinity]) {
    hitCap = hero ? Math.min(hero.maxHp * BOSS_HIT_CAP, Number.isFinite(share) ? heal * share : Infinity) : Infinity;
    for (let round = 0; round < RAISE_ROUNDS && gaps.length; round += 1) {
      if (!step()) break;
      gaps = threatGaps(party, sensible, attackOnly);
    }
  }
  const lead = enemies[0]!;
  if (enemies.every((e, i) => e.stats.attack === before.stats[i]!.attack && e.stats.maxHp === before.stats[i]!.maxHp && e.stats.defense === before.stats[i]!.defense) && skills.every((k, i) => k.power === before.powers[i])) return undefined;
  const power = skills.length ? ` · 기술 위력 ${skills.map((k, i) => `${before.powers[i]}→${k.power}`).join("·")}` : "";
  return `${troopId}(보스) 쉬고 온 Lv${party.level} 의 공격만·회복 없음 승률 ${pct(before.attackOnly.win)} → ${pct(attackOnly.win)}·남는 HP ${pct(before.attackOnly.left)} → ${pct(attackOnly.left)} · 여느 플레이 승률 ${pct(before.sensible.win)} → ${pct(sensible.win)}·${sensible.turns.toFixed(1)}턴·약 ${before.sensible.potions.toFixed(1)} → ${sensible.potions.toFixed(1)}개 — ${lead.name} 공 ${before.stats[0]!.attack}→${lead.stats.attack}${lead.stats.defense !== before.stats[0]!.defense ? `·방 ${before.stats[0]!.defense}→${lead.stats.defense}` : ""}·HP ${before.stats[0]!.maxHp}→${lead.stats.maxHp}${power}${gaps.length ? ` (더 올리면 여느 플레이의 기준이 깨져 여기서 멈춤: ${gaps.join(" · ")})` : ""}`;
}

/**
 * 밴드의 위협에 닿은 보스의 여느 플레이가 바라는 길이(targetTurns 의 위쪽 끝)를 넘으면 HP 를 내린다(걸음마다 −7%, 시작 값의 HP_FLOOR 까지) — 위협을 잃지 않는 데까지만.
 * 위협에 못 닿은 보스는 건드리지 않는다(짧게 하면 «공격만» 으로 더 쉽게 이긴다 — 상한 안에서 조금 긴 것은 둔다). 바꾼 것 한 줄(없으면 undefined).
 */
export function trimBossLength(project: Project, troopId: string, party: BossParty): string | undefined {
  const enemyIds = new Set(project.database.troops.find((t) => t.id === troopId)?.enemyIds ?? []);
  const enemies = project.database.enemies.filter((e) => enemyIds.has(e.id));
  const goal = BOSS_BAND.targetTurns[1];
  let sensible: BossPlay, gaps: number;
  try { sensible = measureBossSensible(project, troopId, party); gaps = threatGaps(party, sensible, measureBossAttackOnly(project, troopId, party)).length; } catch { return undefined; }
  if (!enemies.length || !bossSensibleFits(sensible) || sensible.turns <= goal || gaps > 0) return undefined;
  const start = { turns: sensible.turns, hp: enemies.map((e) => e.stats.maxHp) };
  for (let round = 0; round < RAISE_ROUNDS && sensible.turns > goal; round += 1) {
    const saved = enemies.map((e) => e.stats);
    enemies.forEach((e, i) => { e.stats = { ...e.stats, maxHp: Math.max(Math.ceil(start.hp[i]! * HP_FLOOR), Math.floor(e.stats.maxHp * 0.93)) }; });
    let next: BossPlay = NO_PLAY, nextGaps = Infinity;
    if (enemies.some((e, i) => e.stats.maxHp !== saved[i]!.maxHp)) try { next = measureBossSensible(project, troopId, party); nextGaps = threatGaps(party, next, measureBossAttackOnly(project, troopId, party)).length; } catch { /* 못 재면 되돌린다 */ }
    if (!bossSensibleFits(next) || nextGaps > 0) { enemies.forEach((e, i) => { e.stats = saved[i]!; }); break; }
    sensible = next;
  }
  if (enemies.every((e, i) => e.stats.maxHp === start.hp[i])) return undefined;
  return `${troopId}(보스) 싸움 길이 ${start.turns.toFixed(1)} → ${sensible.turns.toFixed(1)}턴 — ${enemies[0]!.name} HP ${start.hp[0]}→${enemies[0]!.stats.maxHp}`;
}
