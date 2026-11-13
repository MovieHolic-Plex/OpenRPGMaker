// ai/v2/story/pathBattleTension.ts
// 길 위 전투의 긴장 — 끝맺음 path-battles(pathBattleBudget.fitPathBattlesIn)가 쓰는 재료. 결정적(모의 시드 고정)·되풀이 안전.
//
// 왜(2026-11-12 오너가 해 본 판): 길 적은 두 대에 쓰러지며 한 번도 못 쳤고, 보스는 «공격» 만 눌러 HP 514 중 123 을 잃고 이겼다(받은 회복약 넷은 안 썼다).
// 레벨이 올라도 최대 HP 가 514 그대로였다 — 기본 능력치 곡선은 99레벨까지의 2차 곡선이라 처음 몇 레벨은 값이 안 바뀐다.
//
// 규칙:
//  - 시작 파티의 능력치 곡선은 레벨마다 눈에 보이게 오른다(바닥: 시작 레벨 값의 몇 % 씩). 원래 곡선이 더 가파른 구간은 그대로.
//  - 보스는 싸움의 길이가 아니라 차례마다 하는 일로 위협한다(2026-11-13 감독 교정: 보스 셋을 15턴·약 4~5개의 싸움으로 만들고 시작 약을 두 배로 준 것은 위협이 아니라 부풀리기였다).
//    여느 플레이(공격·기술, HP 가 낮으면 약)로 12턴 안에 끝나고, 약은 앞 보스 1~3개 · 마지막 보스 2~4개. 시작 회복약은 늘리지 않는다 — 약이 모자라 못 이기면 보스가 센 것이다.
//    «공격만·회복 없음»(가장 낮게 도착한 그 판이 약 없이 공격만) 은 마지막 보스에게만 못 이기고(승률 ≤ 10%), 앞 보스에게는 이기되(승률 ≥ 50% — 첫 보스는 벽이 아니다) HP 절반 아래로 끝난다.
//    올리기는 한 대(공격·마력·길 사본 피해 기술의 위력)만 — HP 는 올리지 않고, 길어지면 내린다.
import { simulateBattle } from "@/battle/simulate";
import { actorBattlers } from "@/battle/battleBattlers";
import { ACTOR_LEVEL_MAX, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import type { EnemyRecord, Project } from "@/project/types";

/** 마지막 단계의 보스전 몫으로 시작 소지품에 넣는 회복약 수(그 밖의 전투는 하나씩) — pathBattleBudget 의 시작 회복약. 가장 높게 도착한 판은 밴드의 약 하한만 든 채로 잰다. */
export const BOSS_POTIONS = 2;
/**
 * 보스 밴드 — 싸우는 단계의 상대는 모두 이 안에 선다(그 보스 앞에 도착하는 파티로 잰다). 위협은 차례마다 하는 일에서 온다 — 싸움의 길이에서가 아니다.
 *  여느 플레이(가진 약을 HP 가 낮을 때 쓰는 플레이 셋: 가장 낮게 도착한 판의 기술을 쓰는 플레이 · 기술 없이 공격만 하는 플레이, 가장 높게 도착한 판의 기술을 쓰는 플레이)가
 *  minWin 이상 이기고, 셋 다 turns 턴 안에 끝난다(넘으면 안 되는 상한). 바라는 길이는 targetTurns — 가장 긴 판이 위쪽 끝을 넘으면 위협을 잃지 않는 데까지 HP 를 내려 줄이고
 *  (trimBossLength), 아래쪽 끝보다 짧으면 «짧다» 고 적되 HP 는 올리지 않는다.
 *  약: 가장 낮게 도착한 판이 쓰는 수가 앞 보스 midPotions · 마지막 보스 finalPotions 안. 위쪽 끝은 그 판이 든 약의 수다(더 필요하면 못 이긴다 — 그러면 보스를 내린다).
 *  «공격만·회복 없음» = 가장 낮게 도착한 그 판이 약 없이 공격만 한다(같은 레벨 · 같은 남겨 온 HP — 이기고 지는 차이가 약이다):
 *  마지막 보스는 이기는 판이 attackOnlyMaxWin 이하, 앞 보스는 끝났을 때 남는 HP 가 평균 attackOnlyMaxLeft 아래이되 이기는 판이 midAttackOnlyMinWin 이상(벽이 아니다).
 *  가장 높게 도착해 쉬고 온 판의 «공격만» 은 밴드의 기준이 아니다 — 줄에 값만 적는다. 두 레벨의 차이가 약 넷보다 커서, 낮게 도착한 판이 12턴·약 4개 안에 이기는 보스는
 *  높게 도착한 판이 공격만으로도 이긴다(2026-11-13 r2t-fun 서리 정령: HP·공격·숨결 위력 48칸을 훑어 둘을 함께 채우는 칸이 없었다).
 */
export const BOSS_BAND = { minWin: 0.95, turns: 12, targetTurns: [6, 10], midPotions: [1, 3], finalPotions: [2, 4], attackOnlyMaxWin: 0.1, attackOnlyMaxLeft: 0.5, midAttackOnlyMinWin: 0.5 } as const;
const RAISE_ROUNDS = 24;
/**
 * 보스의 가장 센 한 대의 상한 — 가장 낮게 도착한 선두 영웅 최대 HP 의 BOSS_HIT_CAP(두 대를 맞고도 서 있다)과 회복약 하나가 채우는 양의 몫 가운데 작은 쪽.
 * 약의 몫은 세 단: 먼저 2/3(약을 마신 차례에 맞고도 1/3 이 남고, 치명타가 나도 약을 마시는 문턱 위에서 쓰러지지 않는다 — 약을 쓰는 플레이가 운으로 지지 않는다),
 * 그 안에서 밴드의 위협에 못 닿으면 약 하나까지, 그래도 못 닿으면 HP 의 몫만(2026-11-13 r2t-fun 서리 정령: 약 하나 150 안에서는 «공격만» 을 못 막았고 159 에서 막았다 —
 * 여느 플레이는 그대로 100% 였다). 어느 단에서든 걸음은 여느 플레이의 기준(승률·턴 상한)을 지킬 때만 받는다.
 * 한 대는 그 적의 행동표로 잰다(평타 = 공격력이 위력, 기술 = 제 위력) — 평타만 보면 기술로 치는 보스가 빠진다.
 */
const BOSS_HIT_CAP = 0.4;
const BOSS_HIT_PER_POTION = [2 / 3, 1, Infinity] as const;
/**
 * 올리는 걸음은 턴 상한보다 이만큼 짧은 싸움까지만 받는다 — 모의는 HP 30% 에서 약을 쓰지만 사람은 더 일찍 쓴다(약 쓰는 차례가 는다).
 * 2026-11-13 r2s-fun 키보드 플레이(45% 에서 약): 모의 11.9턴이던 수호자전이 13번의 명령이었다.
 */
const RAISE_TURN_MARGIN = 1;
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
 * 보스 앞에 도착하는 파티 — 가장 낮게(피할 수 있는 전투를 다 피하고, lowPotions 를 든 채) · 가장 높게(길 위 전투를 다 이기고 쉬고, highPotions 만 든 채).
 * final = 그 게임의 마지막 보스(밴드의 약 범위와 «공격만» 기준이 다르다).
 * lowHp = 가장 낮게 도착한 판이 앞 보스전에서 남겨 온 HP(없으면 풀 HP) — 그 판은 쉬지 않고 온다. 보스 앞 쉼터는 있어도 쓰는 것이 강제가 아니고,
 * 자동 플레이·키보드로 해 본 판은 쓰지 않는다(2026-11-13 r2s-fun: 풀 HP 로 잰 마지막 보스에게 앞 보스전에서 깎인 채 온 자동 플레이가 졌다).
 */
export interface BossParty {
  readonly ids: readonly string[]; readonly minLevel: number; readonly maxLevel: number; readonly potion?: string;
  readonly final: boolean; readonly lowPotions: number; readonly highPotions: number; readonly lowHp?: number;
}

/** 그 보스의 약 범위 [적어도, 많아야]. */
export const bossPotionBand = (final: boolean): readonly [number, number] => final ? BOSS_BAND.finalPotions : BOSS_BAND.midPotions;

const hpAt = (project: Project, ids: readonly string[], level: number): number =>
  actorBattlers(project, { levels: Object.fromEntries(ids.map((id) => [id, level])), partyActorIds: [...ids] }).reduce((sum, b) => sum + b.maxHp, 0);

export interface BossPlay {
  /** 약을 쓰는 세 플레이 가운데 가장 낮은 승률. */
  readonly win: number;
  /** 세 플레이 가운데 가장 긴 판의 턴(회복약 쓰는 차례 포함). */
  readonly turns: number;
  /** 가장 높게 도착해 기술을 쓰는 판의 턴 · 가장 낮게 도착해 공격과 약만 쓰는 판의 턴. */
  readonly skillTurns: number;
  readonly plainTurns: number;
  /** 가장 낮게 도착한 판이 잃는 HP(기술을 쓰는 플레이). */
  readonly loss: number;
  /** 그 보스전에서 쓰는 약 — 가장 낮게 도착한 판의 기술을 쓰는 플레이와 안 쓰는 플레이 가운데 많은 쪽. */
  readonly potions: number;
  /** 기술 없이 공격과 약만 쓰는 플레이(가장 낮게 도착한 판)의 승률. */
  readonly plainWin: number;
}
const NO_PLAY: BossPlay = { win: 0, loss: 1, turns: 99, skillTurns: 99, plainTurns: 99, potions: 0, plainWin: 0 };

/**
 * 보스를 «여느 플레이» 로 잰다(HP 30% 아래에서 가진 약을 쓴다) — 가장 낮은 레벨로 도착한 판(앞 보스전에서 남긴 HP 로)은 기술을 쓰는 플레이와 기술 없이 공격만 하는 플레이 둘 다,
 * 가장 높은 레벨로 도착한 판은 기술을 쓰는 플레이. 승률은 셋 가운데 낮은 쪽, 턴은 긴 쪽.
 * 왜 «기술 없이» 도 재는가(2026-11-13 r2s-fun): 자동 플레이·정직한 플레이·키보드로 해 본 판은 공격과 약만 쓴다 — 기술을 쓰는 플레이만 재면 그 판이 마지막 보스에서 졌다.
 */
export function measureBossSensible(project: Project, troopId: string, party: BossParty): BossPlay {
  const weakest = lowPlay(project, troopId, party, true);
  // 회복약이 없는 게임에서 기술 없는 플레이는 «공격만» 과 같다(그쪽은 못 이기는 것이 기준이다) — 재지 않는다.
  const plain = party.potion ? lowPlay(project, troopId, party, false) : weakest;
  const strongest = simulateBattle({
    project, troopId, heroLevel: party.maxLevel, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true,
    ...(party.potion ? { inventory: { [party.potion]: party.highPotions }, potionItemId: party.potion } : {}),
  });
  return {
    win: Math.min(weakest.winRate, strongest.winRate, plain.winRate), plainWin: plain.winRate,
    turns: Math.max(weakest.avgTurns, strongest.avgTurns, plain.avgTurns), skillTurns: strongest.avgTurns, plainTurns: plain.avgTurns,
    potions: Math.max(weakest.avgPotionsUsed ?? 0, plain.avgPotionsUsed ?? 0),
    loss: Math.max(0, 1 - weakest.avgHpRemaining / Math.max(1, hpAt(project, party.ids, party.minLevel))),
  };
}

/** 가장 낮게 도착한 판 한 가지(기술을 쓰거나 공격만) — 남겨 온 HP 로, lowPotions 를 든 채(potions false 면 약 없이). */
const lowPlay = (project: Project, troopId: string, party: BossParty, useSkills: boolean, potions = true) => simulateBattle({
  project, troopId, heroLevel: party.minLevel, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills,
  ...(party.lowHp !== undefined ? { startHpRatio: Math.min(1, party.lowHp / Math.max(1, hpAt(project, party.ids, party.minLevel))) } : {}),
  ...(party.potion && potions ? { inventory: { [party.potion]: party.lowPotions }, potionItemId: party.potion } : {}),
});

/** 가장 낮게 도착한 판(공격과 약만)이 그 보스전을 끝내고 남기는 HP — 다음 보스 앞에 그대로 지고 선다. 못 재면 undefined(풀 HP 로 친다). */
export function bossCarry(project: Project, troopId: string, party: BossParty): number | undefined {
  try { return Math.max(1, lowPlay(project, troopId, party, false).avgHpRemaining); } catch { return undefined; }
}

type AttackOnly = { readonly win: number; readonly turns: number; readonly left: number };
/** 보스를 «공격만·회복 없음» 으로 잰다 — 가장 낮게 도착한 그 판이 약 없이 공격만. left = 끝났을 때 남는 HP 의 평균(진 판은 0) / 최대 HP. */
export function measureBossAttackOnly(project: Project, troopId: string, party: BossParty): AttackOnly {
  const r = lowPlay(project, troopId, party, false, false);
  return { win: r.winRate, turns: r.avgTurns, left: Math.max(0, r.avgHpRemaining) / Math.max(1, hpAt(project, party.ids, party.minLevel)) };
}
/** 가장 높게 도착해 쉬고 온 판(풀 HP)의 «공격만·회복 없음» — 밴드의 기준이 아니라 줄에 적는 값. */
function attackOnlyRested(project: Project, troopId: string, party: BossParty): AttackOnly {
  const r = simulateBattle({ project, troopId, heroLevel: party.maxLevel, partyActorIds: party.ids, n: SAMPLES, seed: 11 });
  return { win: r.winRate, turns: r.avgTurns, left: Math.max(0, r.avgHpRemaining) / Math.max(1, hpAt(project, party.ids, party.maxLevel)) };
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
 * 보스 하나가 밴드 안인가 — 그 보스 앞에 도착하는 파티로 잰 값과 함께 한 줄. 밖이면 무엇이 밖인지 적는다.
 * 올리기가 멈춘 보스(더 올리면 여느 플레이로 못 이기거나 한 대가 상한을 넘는다)는 위협이 밴드 밖으로 남는다 — 그 사실이 이 줄에 남는다.
 */
export function bossBandLine(project: Project, troopId: string, party: BossParty): string | undefined {
  let sensible: BossPlay, attackOnly: AttackOnly, rested: AttackOnly;
  try { sensible = measureBossSensible(project, troopId, party); attackOnly = measureBossAttackOnly(project, troopId, party); rested = attackOnlyRested(project, troopId, party); } catch { return undefined; }
  const out = [
    ...(sensible.win < BOSS_BAND.minWin ? [`여느 플레이 승률 ${pct(sensible.win)} < ${pct(BOSS_BAND.minWin)}`] : []),
    ...(sensible.turns > BOSS_BAND.turns ? [`${sensible.turns.toFixed(1)}턴 > ${BOSS_BAND.turns}턴`] : []),
    ...(sensible.turns < BOSS_BAND.targetTurns[0] ? [`${sensible.turns.toFixed(1)}턴 < ${BOSS_BAND.targetTurns[0]}턴(짧다 — HP 는 올리지 않는다)`] : []),
    ...threatGaps(party, sensible, attackOnly),
    ...(!party.final && attackOnly.win < BOSS_BAND.midAttackOnlyMinWin ? [`공격만 승률 ${pct(attackOnly.win)} < ${pct(BOSS_BAND.midAttackOnlyMinWin)}(앞 보스가 벽이다)`] : []),
  ];
  const troop = project.database.troops.find((t) => t.id === troopId);
  const hp = project.database.enemies.filter((e) => troop?.enemyIds.includes(e.id)).reduce((sum, e) => sum + e.stats.maxHp, 0);
  const carried = party.lowHp !== undefined ? party.lowHp / Math.max(1, hpAt(project, party.ids, party.minLevel)) : 1;
  const arrive = `도착 Lv${party.minLevel}${party.maxLevel !== party.minLevel ? `~${party.maxLevel}` : ""}${carried < 0.995 ? `(낮게 온 판 HP ${pct(carried)})` : ""}${party.potion ? `·약 ${party.lowPotions}~${party.highPotions}개` : ""}`;
  return `보스 밴드 ${out.length ? "밖" : "안"} — 「${troop?.name ?? troopId}」(${party.final ? "마지막 보스" : "앞 보스"} · HP ${hp}) ${arrive}: 여느 플레이 승률 ${pct(sensible.win)}(기술 없이 공격+약 ${pct(sensible.plainWin)}) · 기술+약 ${sensible.skillTurns.toFixed(1)}턴 · 공격+약 ${sensible.plainTurns.toFixed(1)}턴 · 약 ${sensible.potions.toFixed(1)}개 · 공격만·회복 없음 승률 ${pct(attackOnly.win)}·남는 HP ${pct(attackOnly.left)}(높게 도착해 쉬고 온 Lv${party.maxLevel} 의 공격만: 승률 ${pct(rested.win)}·남는 HP ${pct(rested.left)})${out.length ? ` (밖: ${out.join(" · ")})` : ""}`;
}

type Stats = EnemyRecord["stats"];
const harder = (by: number) => (s: Stats): Stats => ({ ...s, attack: Math.max(1, Math.ceil(s.attack * by)), mind: Math.max(1, Math.ceil(s.mind * by)) });
/**
 * 한 바퀴에 차례로 해 보는 걸음 — 한 대만 올린다(hits: 공격·마력과 길 사본 피해 기술의 위력에 곱한다, skillsOnly 면 기술의 위력만). HP 는 올리지 않는다.
 * 한 대를 올린 걸음이 턴 상한에 걸리면(약 쓰는 차례가 늘어서) HP 를 내리며 올리는 걸음을 해 본다.
 */
const RAISE_STEPS: readonly { readonly hits: number; readonly hp: number; readonly skillsOnly?: boolean }[] = [
  { hits: 1.12, hp: 1 }, { hits: 1.25, hp: 1 },
  // 제 위력으로 치는 기술만 — 평타가 상한에 닿았는데 주로 쓰는 기술은 약할 때(모았다 쏘는 숨결).
  { hits: 1.25, hp: 1, skillsOnly: true },
  { hits: 1.12, hp: 0.9 }, { hits: 1.25, hp: 0.85 },
];
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
 * 보스 무리(길 사본 — 적은 `enemy_path_*`)의 한 대를 밴드의 위협에 닿을 때까지 올린다(마지막 보스: «공격만» 으로 못 이긴다 · 앞 보스: «공격만» 이 이기되 HP 절반 아래로 끝난다 · 약을 적어도 쓰게 한다).
 * 바퀴마다 걸음을 차례로 해 보고 여느 플레이의 기준(승률·턴 상한)을 지키는 첫 걸음을 받는다. 위협에 닿거나 받을 걸음이 없으면 멈춘다 — 그래서 다시 돌려도 더 오르지 않는다.
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
  const hero = actorBattlers(project, { levels: Object.fromEntries(party.ids.map((id) => [id, party.minLevel])), partyActorIds: [...party.ids] })[0];
  const potion = project.database.items.find((item) => item.id === party.potion);
  const heal = potion && hero ? potion.hpRecovery.flat + hero.maxHp * potion.hpRecovery.percentMax / 100 : 0;
  let hitCap = Infinity;
  const skillIds = new Set(enemies.flatMap((e) => [...(e.actions ?? []).map((a) => a.skillId), ...(e.skillIds ?? [])]));
  const skills = project.database.skills.filter((k) => skillIds.has(k.id) && PATH_SKILL.test(k.id) && k.effect.kind === "damage" && k.power > 0);
  const before = { attackOnly, sensible, stats: enemies.map((e) => ({ ...e.stats })), powers: skills.map((k) => k.power) };
  const step = (candidate: (typeof RAISE_STEPS)[number]): boolean => {
    const saved = enemies.map((e) => e.stats), powers = skills.map((k) => k.power);
    const undo = () => { enemies.forEach((e, i) => { e.stats = saved[i]!; }); skills.forEach((k, i) => { k.power = powers[i]!; }); return false; };
    enemies.forEach((e, i) => {
      const up = candidate.skillsOnly ? e.stats : harder(candidate.hits)(e.stats);
      e.stats = { ...up, maxHp: Math.max(Math.ceil(before.stats[i]!.maxHp * HP_FLOOR), Math.floor(up.maxHp * candidate.hp)) };
    });
    for (const k of skills) k.power = Math.max(1, Math.round(k.power * candidate.hits));
    const moved = enemies.some((e, i) => e.stats.attack !== saved[i]!.attack || e.stats.mind !== saved[i]!.mind) || skills.some((k, i) => k.power !== powers[i]);
    if (!moved || (hero && enemies.some((e) => hardestHit(project, e, e.stats, hero) > hitCap))) return undo();
    let next: BossPlay;
    try { next = measureBossSensible(project, troopId, party); } catch { next = NO_PLAY; }
    if (!bossSensibleFits(next) || next.turns > Math.max(BOSS_BAND.turns - RAISE_TURN_MARGIN, sensible.turns)) return undo();
    let ao: AttackOnly;
    try { ao = measureBossAttackOnly(project, troopId, party); } catch { return undo(); }
    // 앞 보스는 벽이 되지 않는다 — «공격만» 이 이기지 못하게 되는 걸음은 받지 않는다.
    if (!party.final && ao.win < BOSS_BAND.midAttackOnlyMinWin) return undo();
    sensible = next; attackOnly = ao;
    return true;
  };
  let gaps = threatGaps(party, sensible, attackOnly);
  // 앞 보스의 한 대는 첫 단(약 하나의 2/3)을 넘지 않는다 — 사람은 모의(HP 30%)보다 일찍 약을 쓰므로, 한 대가 약 하나에 가까우면 약만 마시는 싸움이 된다
  // (2026-11-13 r2s-fun 키보드 플레이: 한 대 112 의 인형에게 45% 에서 약을 쓰는 플레이가 약 4개·11번의 명령을 썼다 — 모의는 1.5개·8.1턴).
  for (const share of heal > 0 ? (party.final ? BOSS_HIT_PER_POTION : BOSS_HIT_PER_POTION.slice(0, 1)) : [Infinity]) {
    hitCap = hero ? Math.min(hero.maxHp * BOSS_HIT_CAP, Number.isFinite(share) ? heal * share : Infinity) : Infinity;
    for (let round = 0; round < RAISE_ROUNDS && gaps.length; round += 1) {
      if (!RAISE_STEPS.some(step)) break;
      gaps = threatGaps(party, sensible, attackOnly);
    }
  }
  const lead = enemies[0]!;
  if (enemies.every((e, i) => e.stats.attack === before.stats[i]!.attack && e.stats.maxHp === before.stats[i]!.maxHp) && skills.every((k, i) => k.power === before.powers[i])) return undefined;
  const power = skills.length ? ` · 기술 위력 ${skills.map((k, i) => `${before.powers[i]}→${k.power}`).join("·")}` : "";
  return `${troopId}(보스) 공격만·회복 없음(Lv${party.minLevel}) 승률 ${pct(before.attackOnly.win)} → ${pct(attackOnly.win)}·남는 HP ${pct(before.attackOnly.left)} → ${pct(attackOnly.left)} · 여느 플레이 승률 ${pct(before.sensible.win)} → ${pct(sensible.win)}·${sensible.turns.toFixed(1)}턴·약 ${before.sensible.potions.toFixed(1)} → ${sensible.potions.toFixed(1)}개 — ${lead.name} 공 ${before.stats[0]!.attack}→${lead.stats.attack}·HP ${before.stats[0]!.maxHp}→${lead.stats.maxHp}${power}${gaps.length ? ` (더 올리면 여느 플레이의 기준이 깨져 여기서 멈춤: ${gaps.join(" · ")})` : ""}`;
}

/**
 * 밴드의 위협에 닿은 보스의 가장 긴 판이 바라는 길이(targetTurns 의 위쪽 끝)를 넘으면 HP 를 내린다(걸음마다 −7%, 시작 값의 HP_FLOOR 까지) — 위협을 잃지 않는 데까지만.
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
