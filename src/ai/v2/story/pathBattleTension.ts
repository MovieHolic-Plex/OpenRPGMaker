// ai/v2/story/pathBattleTension.ts
// 길 위 전투의 긴장 — 끝맺음 path-battles(pathBattleBudget.fitPathBattlesIn)가 쓰는 재료. 결정적(모의 시드 고정)·되풀이 안전.
//
// 왜(2026-11-12 오너가 해 본 판): 길 적은 두 대에 쓰러지며 한 번도 못 쳤고, 보스는 «공격» 만 눌러 HP 514 중 123 을 잃고 이겼다(받은 회복약 넷은 안 썼다).
// 레벨이 올라도 최대 HP 가 514 그대로였다 — 기본 능력치 곡선은 99레벨까지의 2차 곡선이라 처음 몇 레벨은 값이 안 바뀐다.
//
// 규칙:
//  - 시작 파티의 능력치 곡선은 레벨마다 눈에 보이게 오른다(바닥: 시작 레벨 값의 몇 % 씩). 원래 곡선이 더 가파른 구간은 그대로.
//  - 보스는 «가진 회복약(BOSS_POTIONS)과 기술을 쓰는 플레이» 로 재고(가장 낮게 도착하는 레벨), «공격만·회복 없음» 으로는 못 이기게 올린다(가장 높게 도착하는 레벨).
//    올리기는 공격·마력(평타 한 대가 영웅 최대 HP 의 3분의 1 을 넘지 않는 데까지)과 HP. 기술·약을 쓰는 플레이의 기준(승률·턴)을 깨는 걸음은 되돌린다 —
//    그래서 두 플레이의 차이가 작은 보스(쉬는 차례가 많은 행동표, 레벨 차가 큰 길)는 «공격만» 승률이 상한까지 내려가지 않고 멈춘다(그 사실을 줄에 적는다).
import { simulateBattle } from "@/battle/simulate";
import { actorBattlers } from "@/battle/battleBattlers";
import { ACTOR_LEVEL_MAX, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import type { EnemyRecord, Project } from "@/project/types";

/** 보스전 몫으로 시작 소지품에 더 넣는 회복약 수 — 보스 맞추기도 이만큼 가진 플레이로 잰다. */
export const BOSS_POTIONS = 2;
/** «공격만·회복 없음» 으로 보스를 이기는 판의 비율 상한. */
const ATTACK_ONLY_MAX_WIN = 0.1;
/** 기술·회복약을 쓰는 플레이가 보스를 이겨야 하는 비율과 턴 상한(회복약 쓰는 차례 포함). */
export const BOSS_SENSIBLE = { minWin: 0.95, turns: 12 } as const;
const RAISE_ROUNDS = 40;
/** 보스 평타 한 대의 상한(선두 영웅 최대 HP 비율) — 평타 세 대를 맞고도 서 있어야 한다. 그 위로는 공격을 올리지 않고 HP 를 올린다(두 대에 눕는 보스는 긴장이 아니라 운이다). */
const BOSS_PLAIN_HIT_CAP = 1 / 3;
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

export interface BossParty { readonly ids: readonly string[]; readonly minLevel: number; readonly maxLevel: number; readonly potion?: string }

const hpAt = (project: Project, ids: readonly string[], level: number): number =>
  actorBattlers(project, { levels: Object.fromEntries(ids.map((id) => [id, level])), partyActorIds: [...ids] }).reduce((sum, b) => sum + b.maxHp, 0);

/** 보스를 «기술 + 가진 회복약» 으로 잰다 — 가장 낮게 도착하는 레벨, 쉼터 뒤 풀 HP. */
export function measureBossSensible(project: Project, troopId: string, party: BossParty): { win: number; loss: number; turns: number; potions: number } {
  const r = simulateBattle({
    project, troopId, heroLevel: party.minLevel, partyActorIds: party.ids, n: SAMPLES, seed: 11, useSkills: true,
    ...(party.potion ? { inventory: { [party.potion]: BOSS_POTIONS }, potionItemId: party.potion } : {}),
  });
  return { win: r.winRate, loss: Math.max(0, 1 - r.avgHpRemaining / Math.max(1, hpAt(project, party.ids, party.minLevel))), turns: r.avgTurns, potions: r.avgPotionsUsed };
}

/** 보스를 «공격만·회복 없음» 으로 잰다 — 기본은 길 위 전투를 다 이기고 가장 높게 도착하는 레벨. */
export function measureBossAttackOnly(project: Project, troopId: string, party: BossParty, level = party.maxLevel): { win: number; turns: number } {
  const r = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party.ids, n: SAMPLES, seed: 11 });
  return { win: r.winRate, turns: r.avgTurns };
}

export const bossSensibleFits = (m: { win: number; turns: number }): boolean => m.win >= BOSS_SENSIBLE.minWin && m.turns <= BOSS_SENSIBLE.turns;

type Stats = EnemyRecord["stats"];
const harder = (by: number) => (s: Stats): Stats => ({ ...s, attack: Math.ceil(s.attack * by), mind: Math.ceil(s.mind * by) });
const tougher = (by: number) => (s: Stats): Stats => ({ ...s, maxHp: Math.ceil(s.maxHp * by) });
/** 한 바퀴에 차례로 해 보는 걸음 — 작은 걸음이 기준을 깨도 큰 걸음은 맞을 수 있다(회복약을 쓰는 차례가 바뀌어 턴 수가 고르게 늘지 않는다). */
const RAISE_STEPS: readonly { readonly hits: number; readonly scale: (s: Stats) => Stats }[] = [
  { hits: 1.12, scale: harder(1.12) }, { hits: 1.25, scale: harder(1.25) },
  { hits: 1, scale: tougher(1.1) }, { hits: 1, scale: tougher(1.2) },
  { hits: 1.12, scale: (s) => tougher(1.1)(harder(1.12)(s)) },
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
    try { next = measureBossSensible(project, troopId, party); } catch { next = { win: 0, loss: 1, turns: 99, potions: 0 }; }
    if (!bossSensibleFits(next)) { enemies.forEach((e, i) => { e.stats = saved[i]!; }); return false; }
    sensible = next;
    return true;
  };
  for (let round = 0; round < RAISE_ROUNDS && attackOnly.win > ATTACK_ONLY_MAX_WIN; round += 1) {
    if (!RAISE_STEPS.some((candidate) => (candidate.hits === 1 || !hitsTooHard(candidate.hits)) && step(candidate.scale))) break;
    try { attackOnly = measureBossAttackOnly(project, troopId, party); } catch { break; }
  }
  const lead = enemies[0]!;
  if (enemies.every((e, i) => e.stats.attack === before.stats[i]!.attack && e.stats.maxHp === before.stats[i]!.maxHp)) return undefined;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  // 가장 낮게 도착하는 레벨의 «공격만» 도 같이 적는다 — 길 위 전투를 피해 온 판과 다 이기고 온 판이 다르다.
  let weakest = attackOnly;
  if (party.minLevel !== party.maxLevel) try { weakest = measureBossAttackOnly(project, troopId, party, party.minLevel); } catch { /* 모의 실패는 높은 레벨 값으로 */ }
  return `${troopId}(보스) 공격만·회복 없음 승률 Lv${party.maxLevel} ${pct(before.attackOnly.win)} → ${pct(attackOnly.win)}${party.minLevel !== party.maxLevel ? ` · Lv${party.minLevel} ${pct(weakest.win)}` : ""} · 기술+회복약 ${BOSS_POTIONS}개(Lv${party.minLevel}) 승률 ${pct(before.sensible.win)} → ${pct(sensible.win)}·${sensible.turns.toFixed(1)}턴·약 ${sensible.potions.toFixed(1)}개 — ${lead.name} 공 ${before.stats[0]!.attack}→${lead.stats.attack}·HP ${before.stats[0]!.maxHp}→${lead.stats.maxHp}${attackOnly.win > ATTACK_ONLY_MAX_WIN ? " (더 올리면 기술·약으로도 못 이겨 여기서 멈춤)" : ""}`;
}
