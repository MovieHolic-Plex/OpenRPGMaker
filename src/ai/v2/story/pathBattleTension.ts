// ai/v2/story/pathBattleTension.ts
// 길 위 전투의 긴장 — 끝맺음 path-battles(pathBattleBudget.fitPathBattlesIn)가 쓰는 재료. 결정적(모의 시드 고정)·되풀이 안전.
//
// 왜(2026-11-12 오너가 해 본 판): 길 적은 두 대에 쓰러지며 한 번도 못 쳤고, 보스는 «공격» 만 눌러 HP 514 중 123 을 잃고 이겼다(받은 회복약 넷은 안 썼다).
// 레벨이 올라도 최대 HP 가 514 그대로였다 — 기본 능력치 곡선은 99레벨까지의 2차 곡선이라 처음 몇 레벨은 값이 안 바뀐다.
//
// 규칙:
//  - 시작 파티의 능력치 곡선은 레벨마다 눈에 보이게 오른다(바닥: 시작 레벨 값의 몇 % 씩). 원래 곡선이 더 가파른 구간은 그대로.
//  - 보스는 «회복약을 쓰는 플레이» 로 잰다 — 가장 낮게 도착한 판(기술을 쓰는 플레이 · 기술 없이 공격과 약만 쓰는 플레이, 약은 쓰는 만큼)과
//    가장 높게 도착해 보스전 몫 BOSS_POTIONS 만 든 판(기술을 쓰는 플레이). 낮게 도착한 판이 쓴 약은 시작 소지품이 댄다(pathBattleBudget 의 시작 회복약).
//    «공격만·회복 없음» 으로는 못 이기게 올린다(가장 높게 도착하는 레벨). 올리기는 HP 와 공격·마력의 짝(평타 한 대가 영웅 최대 HP 의 40% 를 넘지 않는 데까지 — HP 를 올리며 공격을 내리는 짝도 있다).
//    기술·약을 쓰는 플레이의 기준(승률·턴)을 깨는 걸음은 받지 않는다 —
//    그래서 두 플레이의 차이가 작은 보스(쉬는 차례가 많은 행동표, 레벨 차가 큰 길)는 «공격만» 승률이 상한까지 내려가지 않고 멈춘다(그 사실을 줄에 적는다).
import { simulateBattle } from "@/battle/simulate";
import { actorBattlers } from "@/battle/battleBattlers";
import { ACTOR_LEVEL_MAX, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import type { EnemyRecord, Project } from "@/project/types";

/** 보스전 몫으로 시작 소지품에 적어도 넣는 회복약 수 — 길 위 전투를 다 이기고 가장 높게 도착한 판은 이만큼만 든 채로 잰다. */
export const BOSS_POTIONS = 2;
/** 가장 낮게 도착한 판이 드는 약 — 쓰는 만큼(쓴 수를 재어 시작 소지품이 그만큼을 댄다). */
const AMPLE_POTIONS = 99;
/**
 * 보스 밴드 — 싸우는 단계의 상대는 모두 이 안에 선다(그 보스 앞에 도착하는 파티로 잰다):
 *  회복약을 쓰는 플레이가 이기는 비율 minWin 이상 — 기술을 쓰는 플레이(가장 낮게·가장 높게 도착하는 두 판)도, 기술 없이 공격과 약만 쓰는 플레이(가장 낮게 도착한 판)도.
 *  기술을 쓰는 플레이는 turns 턴 안(회복약 쓰는 차례 포함, 가장 높게 도착한 판).
 *  «공격만·회복 없음» 으로 이기는 판은 attackOnlyMaxWin 이하(가장 높게 도착하는 레벨).
 */
export const BOSS_BAND = { minWin: 0.95, turns: 14, attackOnlyMaxWin: 0.1 } as const;
const ATTACK_ONLY_MAX_WIN = BOSS_BAND.attackOnlyMaxWin;
const RAISE_ROUNDS = 24;
const LANDING_HP = [1.04, 1.08, 1.12, 1.16, 1.2, 1.25, 1.3, 1.4, 1.5] as const;
/** 보스 평타 한 대의 상한(가장 낮게 도착한 선두 영웅 최대 HP 비율) — 평타 두 대를 맞고도 서 있어야 한다. 그 위로는 공격을 올리지 않고 HP 를 올린다. */
const BOSS_PLAIN_HIT_CAP = 0.4;
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

/** 보스 앞에 도착하는 파티 — 가장 낮게(피할 수 있는 전투를 다 피하고) · 가장 높게(길 위 전투를 다 이기고). */
export interface BossParty { readonly ids: readonly string[]; readonly minLevel: number; readonly maxLevel: number; readonly potion?: string }

const hpAt = (project: Project, ids: readonly string[], level: number): number =>
  actorBattlers(project, { levels: Object.fromEntries(ids.map((id) => [id, level])), partyActorIds: [...ids] }).reduce((sum, b) => sum + b.maxHp, 0);

export interface BossPlay {
  /** 약을 쓰는 세 플레이 가운데 가장 낮은 승률. */
  readonly win: number;
  /** 기술을 쓰는 플레이의 턴(가장 높게 도착한 판 — 길 위 전투를 치른 여느 플레이의 길이). */
  readonly turns: number;
  /** 가장 낮게 도착한 판이 잃는 HP(기술을 쓰는 플레이). */
  readonly loss: number;
  /** 가장 낮게 도착한 판이 쓰는 약 — 기술을 쓰는 플레이와 안 쓰는 플레이 가운데 많은 쪽(시작 소지품이 대는 수). */
  readonly potions: number;
  /** 기술 없이 공격과 약만 쓰는 플레이(가장 낮게 도착한 판)의 승률. */
  readonly plainWin: number;
}
const NO_PLAY: BossPlay = { win: 0, loss: 1, turns: 99, potions: 0, plainWin: 0 };

/**
 * 보스를 «회복약을 쓰는 플레이» 로 잰다(쉼터 뒤 풀 HP) — 가장 낮은 레벨로 도착한 판은 기술을 쓰는 플레이와 기술 없이 공격·약만 쓰는 플레이 둘 다(약은 쓰는 만큼),
 * 가장 높은 레벨로 도착한 판은 보스전 몫만 든 채 기술을 쓰는 플레이. 승률은 셋 가운데 낮은 쪽.
 * 왜 «기술 없이» 도 재는가(2026-11-13 r2s-fun): 기술을 쓰는 플레이만 재면 공격과 약만 누르는 사람(자동 플레이가 그렇게 한다)은 첫 보스에서 약을 다 쓰고 마지막 보스에서 졌다.
 */
export function measureBossSensible(project: Project, troopId: string, party: BossParty): BossPlay {
  const play = (level: number, potions: number, useSkills: boolean) => simulateBattle({
    project, troopId, heroLevel: level, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills,
    ...(party.potion ? { inventory: { [party.potion]: potions }, potionItemId: party.potion } : {}),
  });
  const weakest = play(party.minLevel, AMPLE_POTIONS, true);
  const strongest = play(party.maxLevel, BOSS_POTIONS, true);
  // 회복약이 없는 게임에서 기술 없는 플레이는 «공격만» 과 같다(그쪽은 못 이기는 것이 기준이다) — 재지 않는다.
  const plain = party.potion ? play(party.minLevel, AMPLE_POTIONS, false) : weakest;
  return {
    win: Math.min(weakest.winRate, strongest.winRate, plain.winRate), turns: strongest.avgTurns, plainWin: plain.winRate,
    potions: Math.max(weakest.avgPotionsUsed, plain.avgPotionsUsed),
    loss: Math.max(0, 1 - weakest.avgHpRemaining / Math.max(1, hpAt(project, party.ids, party.minLevel))),
  };
}

/** 그 보스전 몫의 회복약 — 가장 낮게 도착한 판이 쓰는 수를 올림(적어도 BOSS_POTIONS). */
export function bossPotionShare(project: Project, troopId: string, party: BossParty): number {
  try { return Math.max(BOSS_POTIONS, Math.ceil(measureBossSensible(project, troopId, party).potions - 1e-9)); } catch { return BOSS_POTIONS; }
}

/** 보스를 «공격만·회복 없음» 으로 잰다 — 기본은 길 위 전투를 다 이기고 가장 높게 도착하는 레벨. */
export function measureBossAttackOnly(project: Project, troopId: string, party: BossParty, level = party.maxLevel): { win: number; turns: number } {
  const r = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party.ids, n: SAMPLES, seed: 11 });
  return { win: r.winRate, turns: r.avgTurns };
}

export const bossSensibleFits = (m: { win: number; turns: number }): boolean => m.win >= BOSS_BAND.minWin && m.turns <= BOSS_BAND.turns;

/**
 * 보스 하나가 밴드 안인가 — 그 보스 앞에 도착하는 파티로 잰 값과 함께 한 줄. 밖이면 무엇이 밖인지 적는다.
 * 올리기가 멈춘 보스(더 올리면 기술·약으로도 못 이기거나 평타 한 대가 상한을 넘는다)는 «공격만» 승률이 밴드 밖으로 남는다 — 그 사실이 이 줄에 남는다.
 */
export function bossBandLine(project: Project, troopId: string, party: BossParty): string | undefined {
  let sensible: ReturnType<typeof measureBossSensible>, attackOnly: ReturnType<typeof measureBossAttackOnly>;
  try { sensible = measureBossSensible(project, troopId, party); attackOnly = measureBossAttackOnly(project, troopId, party); } catch { return undefined; }
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const out = [
    ...(sensible.win < BOSS_BAND.minWin ? [`회복약을 쓰는 플레이 승률 ${pct(sensible.win)} < ${pct(BOSS_BAND.minWin)}`] : []),
    ...(sensible.turns > BOSS_BAND.turns ? [`${sensible.turns.toFixed(1)}턴 > ${BOSS_BAND.turns}턴`] : []),
    ...(attackOnly.win > BOSS_BAND.attackOnlyMaxWin ? [`공격만 승률 ${pct(attackOnly.win)} > ${pct(BOSS_BAND.attackOnlyMaxWin)}`] : []),
  ];
  const name = project.database.troops.find((t) => t.id === troopId)?.name ?? troopId;
  const arrive = `도착 Lv${party.minLevel}${party.maxLevel !== party.minLevel ? `~${party.maxLevel}` : ""}`;
  return `보스 밴드 ${out.length ? "밖" : "안"} — 「${name}」 ${arrive}: 회복약을 쓰는 플레이 승률 ${pct(sensible.win)}(기술 없이 공격+약 ${pct(sensible.plainWin)})·${sensible.turns.toFixed(1)}턴·잃는 HP ${pct(sensible.loss)}·약 ${sensible.potions.toFixed(1)}개 · 공격만·회복 없음 승률 ${pct(attackOnly.win)}${out.length ? ` (밖: ${out.join(" · ")})` : ""}`;
}

type Stats = EnemyRecord["stats"];
const harder = (by: number) => (s: Stats): Stats => ({ ...s, attack: Math.max(1, Math.ceil(s.attack * by)), mind: Math.max(1, Math.ceil(s.mind * by)) });
const tougher = (by: number) => (s: Stats): Stats => ({ ...s, maxHp: Math.ceil(s.maxHp * by) });
/** 한 바퀴에 차례로 해 보는 걸음 — 작은 걸음이 기준을 깨도 큰 걸음은 맞을 수 있다(회복약을 쓰는 차례가 바뀌어 턴 수가 고르게 늘지 않는다). */
const RAISE_STEPS: readonly { readonly hits: number; readonly scale: (s: Stats) => Stats }[] = [
  { hits: 1.12, scale: harder(1.12) }, { hits: 1.25, scale: harder(1.25) },
  { hits: 1, scale: tougher(1.1) }, { hits: 1, scale: tougher(1.2) },
  { hits: 1.12, scale: (s) => tougher(1.1)(harder(1.12)(s)) },
  // 한 대를 줄이고 싸움을 늘리는 걸음 — 한 대가 상한에 닿았거나 한두 대에 쓰러지는 판 때문에 위 걸음이 다 깨질 때(약을 쓰면 버티고 안 쓰면 진다).
  { hits: 1, scale: (s) => tougher(1.35)(harder(0.85)(s)) }, { hits: 1, scale: tougher(1.35) },
];

/**
 * 보스 무리(길 사본 — 적은 `enemy_path_*`)를 «공격만으로는 못 이기게» 올린다. 바퀴마다 걸음(공격·마력 +12%·+25%, HP +10%·+20%, 둘 다)을 차례로 해 보고
 * 기술·약 플레이(가장 낮게 도착하는 레벨)의 기준을 지키는 첫 걸음을 받는다. 가장 높게 도착하는 레벨의 «공격만» 승률이 상한 아래로 내려가거나
 * 받을 걸음이 없으면 멈춘다 — 그래서 다시 돌려도 더 오르지 않는다. 바꾼 것 한 줄(없으면 undefined).
 */
export function raiseBossTension(project: Project, troopId: string, party: BossParty): string | undefined {
  const enemyIds = new Set(project.database.troops.find((t) => t.id === troopId)?.enemyIds ?? []);
  const enemies = project.database.enemies.filter((e) => enemyIds.has(e.id));
  if (!enemies.length) return undefined;
  let attackOnly: ReturnType<typeof measureBossAttackOnly>;
  let sensible: ReturnType<typeof measureBossSensible>;
  try { attackOnly = measureBossAttackOnly(project, troopId, party); sensible = measureBossSensible(project, troopId, party); } catch { return undefined; }
  const before = { attackOnly, sensible, stats: enemies.map((e) => ({ ...e.stats })) };
  if (attackOnly.win <= ATTACK_ONLY_MAX_WIN || !bossSensibleFits(sensible)) return undefined;
  const hero = actorBattlers(project, { levels: Object.fromEntries(party.ids.map((id) => [id, party.minLevel])), partyActorIds: [...party.ids] })[0];
  const plainHit = (attack: number) => attack + Math.floor(attack / 2) - Math.floor((hero?.defense ?? 0) / 2);
  const hitsTooHard = (by: number) => !!hero && enemies.some((e) => plainHit(Math.ceil(e.stats.attack * by)) > hero.maxHp * BOSS_PLAIN_HIT_CAP);
  const step = (scale: (s: Stats) => Stats): boolean => {
    const saved = enemies.map((e) => e.stats);
    for (const e of enemies) e.stats = scale(e.stats);
    let next: ReturnType<typeof measureBossSensible>;
    try { next = measureBossSensible(project, troopId, party); } catch { next = NO_PLAY; }
    if (!bossSensibleFits(next)) { enemies.forEach((e, i) => { e.stats = saved[i]!; }); return false; }
    sensible = next;
    return true;
  };
  for (let round = 0; round < RAISE_ROUNDS && attackOnly.win > ATTACK_ONLY_MAX_WIN; round += 1) {
    if (!RAISE_STEPS.some((candidate) => (candidate.hits === 1 || !hitsTooHard(candidate.hits)) && step(candidate.scale))) break;
    try { attackOnly = measureBossAttackOnly(project, troopId, party); } catch { break; }
  }
  // 걸음이 다 깨져 밴드 밖에서 멈췄으면 밴드에 드는 HP 를 한 번 훑는다 — 작은 걸음이 모의 판의 요철(승률 92%)에 걸려도 그 너머에 맞는 값이 있다.
  if (attackOnly.win > ATTACK_ONLY_MAX_WIN) for (const by of LANDING_HP) {
    const saved = enemies.map((e) => e.stats);
    for (const e of enemies) e.stats = tougher(by)(e.stats);
    try {
      const next = measureBossSensible(project, troopId, party);
      const hit = bossSensibleFits(next) ? measureBossAttackOnly(project, troopId, party) : undefined;
      if (hit && hit.win <= ATTACK_ONLY_MAX_WIN) { sensible = next; attackOnly = hit; break; }
    } catch { /* 모의 실패한 값은 건너뛴다 */ }
    enemies.forEach((e, i) => { e.stats = saved[i]!; });
  }
  const lead = enemies[0]!;
  if (enemies.every((e, i) => e.stats.attack === before.stats[i]!.attack && e.stats.maxHp === before.stats[i]!.maxHp)) return undefined;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  // 가장 낮게 도착하는 레벨의 «공격만» 도 같이 적는다 — 길 위 전투를 피해 온 판과 다 이기고 온 판이 다르다.
  let weakest = attackOnly;
  if (party.minLevel !== party.maxLevel) try { weakest = measureBossAttackOnly(project, troopId, party, party.minLevel); } catch { /* 모의 실패는 높은 레벨 값으로 */ }
  return `${troopId}(보스) 공격만·회복 없음 승률 Lv${party.maxLevel} ${pct(before.attackOnly.win)} → ${pct(attackOnly.win)}${party.minLevel !== party.maxLevel ? ` · Lv${party.minLevel} ${pct(weakest.win)}` : ""} · 회복약을 쓰는 플레이(Lv${party.minLevel} 약 쓰는 만큼 · Lv${party.maxLevel} 약 ${BOSS_POTIONS}개) 승률 ${pct(before.sensible.win)} → ${pct(sensible.win)}·${sensible.turns.toFixed(1)}턴·약 ${sensible.potions.toFixed(1)}개 — ${lead.name} 공 ${before.stats[0]!.attack}→${lead.stats.attack}·HP ${before.stats[0]!.maxHp}→${lead.stats.maxHp}${attackOnly.win > ATTACK_ONLY_MAX_WIN ? " (더 올리면 기술·약으로도 못 이겨 여기서 멈춤)" : ""}`;
}
