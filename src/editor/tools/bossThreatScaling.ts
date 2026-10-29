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

/** 역할별 맞춤 목표: 영웅 평타 몇 대에 한 마리가 쓰러지나 · 적 평타 한 대가 영웅 최대 HP 의 몇 할인가 · 모의전 하한/상한 · 파티 대비 민첩. */
const FIT_TARGETS = {
  field: { hits: 2, perExtraMember: 1, share: 0.05, minWin: 0.95, maxLoss: 0.35, minLoss: 0, agility: 0.8, levelOffset: 0 },
  midBoss: { hits: 6, perExtraMember: 3, share: 0.07, minWin: 0.95, maxLoss: 0.6, minLoss: 0.2, agility: 0.9, levelOffset: 1 },
  boss: { hits: BOSS_HITS_TO_KILL, perExtraMember: 4, share: BOSS_HIT_SHARE, minWin: BOSS_MIN_WIN_RATE, maxLoss: BOSS_MAX_PARTY_LOSS, minLoss: BOSS_MIN_PARTY_LOSS, agility: 0.9, levelOffset: 2 },
} as const;
const FIT_PROBE_TROOP_ID = "__fit_probe";

export type EnemyFitRole = keyof typeof FIT_TARGETS;
export type EnemyFit = {
  readonly stats: EnemyStats; readonly level: number; readonly winRate: number; readonly loss: number; readonly note: string;
  /** 기술을 갈아 끼웠으면 새 행동·기술 목록(아니면 undefined — 원래 것을 둔다). */
  readonly actions?: EnemyRecord["actions"]; readonly skillIds?: readonly string[];
};

/** 역할별 기술 한 방의 상한(영웅 최대 HP 비율) — 단일 대상 / 전체 대상. */
const SKILL_HIT_CAP = { field: [0.1, 0.07], midBoss: [0.18, 0.12], boss: [0.24, 0.16] } as const;

/**
 * 빌더가 **새로 만든** 적(던전 주제 적·조수 v2 적 그룹)을 시작 파티에 맞춘 능력치를 돌려준다 — 올리기·내리기 모두(저자가 준 값이 아니다).
 *
 * 왜(2026-10-29 VM 측정 판 vm1-1029/flash/jrpg 판정 「전투 못 이김」): 던전 주제 적은 데이터베이스에서 「같은 역할로 원래 고르던 그룹」
 * (보스 = 가장 센 그룹)의 세기를 비례로 옮겼다. 시작 파티(아린 Lv1, HP 514·공 45)에게 임프 무리 Lv35(HP 150·공 71 ×2·회복 기술)와
 * 마왕 Lv42(HP 1180·공 196)가 붙었고, 모의전 승률은 임프 0~15%, 마왕 0%(한 턴에 쓰러짐)였다. 파티 레벨을 보지 않았다.
 *
 * 순수 함수 — project 는 얕은 복사본 위에서 모의전을 돌리고 바꾸지 않는다. count 는 무리 안 같은 적의 마리 수.
 * 시작 파티가 없으면 undefined(호출자는 예전 비례 옮기기를 그대로 쓴다).
 */
export function fitEnemyToStartParty(project: Project, enemy: EnemyRecord, role: EnemyFitRole, count = 1): EnemyFit | undefined {
  const partyActorIds = (project.session.partyActorIds?.length ? project.session.partyActorIds : project.system.startActorIds) ?? [];
  const actors = project.database.actors.filter(actor => partyActorIds.includes(actor.id));
  if (actors.length === 0) return undefined;
  const heroLevel = Math.max(1, Math.min(...actors.map(actor => actor.initialLevel ?? 1)));
  const levels = Object.fromEntries(partyActorIds.map(id => [id, heroLevel]));
  const party = actorBattlers(project, { levels, partyActorIds: [...partyActorIds] });
  const hero = party[0];
  if (!hero || hero.maxHp <= 0) return undefined;
  const target = FIT_TARGETS[role];
  const partyHp = party.reduce((sum, battler) => sum + battler.maxHp, 0);
  const partyAgility = party.reduce((sum, battler) => sum + battler.agility, 0) / party.length;
  // 방어가 영웅 공격보다 크게 높으면 평타가 1 만 들어간다 — 공격력의 8할로 묶는다.
  const defense = Math.max(1, Math.min(enemy.stats.defense, Math.round(hero.attackPower * 0.8)));
  const tuning = computeEnemyTuning({
    project, heroLevel, partyActorIds: [...partyActorIds], enemyDefense: defense,
    targetHitsToKill: target.hits + target.perExtraMember * (party.length - 1),
    targetDamageToHeroPerHit: Math.max(1, Math.round(hero.maxHp * target.share)),
  });
  let stats: EnemyStats = { ...enemy.stats, defense, maxHp: tuning.maxHp, attack: tuning.attack, mind: tuning.attack, agility: Math.max(1, Math.round(partyAgility * target.agility)) };
  // 능력치만 낮춰서는 안 되는 적이 있다 — 끝판 기술(마왕의 심판 위력 220·전체)은 위력이 공격력보다 커서 Lv1 파티를 한두 턴에 지운다.
  // 이 적 사본의 기술만, 같은 대상 범위·같은 능력치(·되도록 같은 속성)의 더 약한 몬스터 기술로 바꾼다(데이터베이스 기술은 그대로).
  const swapped = swapOverpoweredSkills(project, enemy, role, hero, stats);
  const measure = (): { winRate: number; loss: number } => {
    const probeEnemy = { ...enemy, stats, ...(swapped ? { actions: swapped.actions, skillIds: swapped.skillIds } : {}) } as EnemyRecord;
    const probe = normalizeTroopRecord({ id: FIT_PROBE_TROOP_ID, name: enemy.name, enemyIds: Array.from({ length: Math.max(1, count) }, () => enemy.id) });
    const probeProject = {
      ...project,
      database: { ...project.database, enemies: [...project.database.enemies.filter(e => e.id !== enemy.id), probeEnemy], troops: [...project.database.troops.filter(t => t.id !== FIT_PROBE_TROOP_ID), probe] },
    } as Project;
    const result = simulateBattle({ project: probeProject, troopId: FIT_PROBE_TROOP_ID, heroLevel, partyActorIds: [...partyActorIds], n: SIM_SAMPLES, seed: 1 });
    return { winRate: result.winRate, loss: 1 - result.avgHpRemaining / partyHp };
  };
  let outcome = { winRate: 1, loss: 0 };
  try {
    outcome = measure();
    // 너무 세면 공격·마력을 15%씩 내리고, 바닥에 닿으면 HP 도 내린다(기술 위력·회복 기술·여러 마리가 산식보다 세다).
    for (let round = 0; round < 12 && (outcome.winRate < target.minWin || outcome.loss > target.maxLoss); round += 1) {
      const attack = Math.max(1, Math.floor(stats.attack * 0.85));
      const mind = Math.max(1, Math.floor(stats.mind * 0.85));
      const maxHp = attack === stats.attack ? Math.max(1, Math.floor(stats.maxHp * 0.85)) : stats.maxHp;
      if (attack === stats.attack && maxHp === stats.maxHp) break;
      stats = { ...stats, attack, mind, maxHp };
      outcome = measure();
    }
    // 거의 안 아프면(보스·수문장) 공격만 20%씩 올린다. 파티가 지기 시작하면 한 단계 되돌린다.
    for (let round = 0; round < MAX_ROUNDS && target.minLoss > 0 && outcome.winRate >= target.minWin && outcome.loss < target.minLoss; round += 1) {
      const previous = stats;
      stats = { ...stats, attack: Math.ceil(stats.attack * 1.2), mind: Math.ceil(stats.mind * 1.2) };
      const next = measure();
      if (next.winRate < target.minWin || next.loss > target.maxLoss) { stats = previous; break; }
      outcome = next;
    }
  } catch {
    // 모의전 실패: 산식 값 그대로 쓴다.
  }
  const level = heroLevel + target.levelOffset;
  return {
    stats, level, winRate: outcome.winRate, loss: outcome.loss,
    ...(swapped ? { actions: swapped.actions, skillIds: swapped.skillIds } : {}),
    note: `${enemy.name}: 시작 파티 Lv${heroLevel}(HP ${partyHp}) 기준 ${role} 맞춤 — HP ${stats.maxHp}·공 ${stats.attack}·방 ${stats.defense}·민 ${stats.agility}×${count}, 모의 ${SIM_SAMPLES}판 승률 ${Math.round(outcome.winRate * 100)}%·HP 손실 ${Math.round(outcome.loss * 100)}%`,
  };
}

type SkillRecord = Project["database"]["skills"][number];

function swapOverpoweredSkills(
  project: Project, enemy: EnemyRecord, role: EnemyFitRole,
  hero: { readonly maxHp: number; readonly defense: number; readonly mind: number }, stats: EnemyStats,
): { actions: EnemyRecord["actions"]; skillIds: string[] } | undefined {
  const skills = new Map(project.database.skills.map(skill => [skill.id, skill]));
  const element = (skill: SkillRecord) => skill.elementId;
  const statistic = (skill: SkillRecord) => (skill.effect?.kind === "damage" ? skill.effect.statistic : undefined);
  const expected = (skill: SkillRecord): number => {
    if (skill.effect?.kind !== "damage" || skill.effect.affects !== "hp" || skill.damageFormula) return 0;
    const mind = skill.effect.statistic === "mind";
    const hits = skill.hitSequence?.length ? skill.hitSequence.reduce((a, b) => a + b, 0) : 1;
    return Math.max(1, skill.power + Math.floor((mind ? stats.mind : stats.attack) / 2) - Math.floor((mind ? hero.mind : hero.defense) / 2)) * hits;
  };
  const cap = (skill: SkillRecord) => hero.maxHp * SKILL_HIT_CAP[role][skill.scope === "allEnemies" ? 1 : 0];
  const pool = project.database.skills.filter(skill => skill.id.startsWith("skill_mon_") && skill.effect?.kind === "damage" && !skill.damageFormula);
  const replace = (skill: SkillRecord): string | null => {
    if (expected(skill) <= cap(skill)) return skill.id;
    const fits = pool.filter(other => other.scope === skill.scope && statistic(other) === statistic(skill) && expected(other) <= cap(skill));
    const best = [...fits].sort((a, b) => Number(element(b) === element(skill)) - Number(element(a) === element(skill)) || b.power - a.power)[0];
    return best?.id ?? null;
  };
  let changed = false;
  const map = new Map<string, string | null>();
  const pick = (id: string): string | null => {
    if (!map.has(id)) {
      const skill = skills.get(id);
      const next = skill ? replace(skill) : id;
      if (next !== id) changed = true;
      map.set(id, next);
    }
    return map.get(id)!;
  };
  const actions = (enemy.actions ?? []).flatMap(action => {
    const next = pick(action.skillId);
    return next ? [{ ...action, skillId: next }] : [];
  });
  const skillIds = [...new Set(((enemy as unknown as { skillIds?: string[] }).skillIds ?? []).map(pick).filter((id): id is string => !!id))];
  return changed ? { actions, skillIds } : undefined;
}

/** 맞춘 사본 적 그룹 id 접두 — pickTroops 가 다시 고르지 않는다. */
export const FITTED_TROOP_PREFIX = "troop_fit_";

/**
 * DB 적 그룹 하나를 시작 파티에 맞춘 사본으로 — 원본 적·그룹은 그대로 두고(다른 이벤트가 부를 수 있다)
 * `troop_fit_<role>_<원본>` / `enemy_fit_<role>_<원본>` 을 만들어 그 id 를 돌려준다. 이미 있으면 그대로 쓴다(결정적).
 * 파티가 없으면 원본 id.
 * 왜(2026-10-29 vm1 flash jrpg): 일반 JRPG 경로(pickTroops)도 DB 적 그룹을 세기 순으로 고르기만 해, 가장 센 그룹(드래곤)이
 * Lv1 혼자인 파티의 보스로 그대로 나왔다.
 */
export function fitTroopCopy(project: Project, troopId: string | undefined, role: EnemyFitRole): string | undefined {
  if (!troopId || troopId.startsWith(FITTED_TROOP_PREFIX)) return troopId;
  const source = project.database.troops.find(troop => troop.id === troopId);
  if (!source) return troopId;
  const id = `${FITTED_TROOP_PREFIX}${role}_${troopId.replace(/^troop_/u, "")}`;
  if (project.database.troops.some(troop => troop.id === id)) return id;
  const memberIds = (source.members?.length ? source.members.map(member => member.enemyId) : source.enemyIds) ?? [];
  if (!memberIds.length) return troopId;
  const count = memberIds.length;
  const copies = new Map<string, string>();
  for (const enemyId of new Set(memberIds)) {
    const enemy = project.database.enemies.find(e => e.id === enemyId);
    if (!enemy) return troopId;
    const copyId = `enemy_fit_${role}_${enemyId.replace(/^enemy_/u, "")}`;
    if (!project.database.enemies.some(e => e.id === copyId)) {
      const fit = fitEnemyToStartParty(project, enemy, role, count);
      if (!fit) return troopId;
      const copy = structuredClone(enemy) as EnemyRecord;
      (copy as { id: string }).id = copyId;
      copy.stats = fit.stats;
      (copy as { level?: number }).level = fit.level;
      if (fit.actions) copy.actions = fit.actions;
      if (fit.skillIds) (copy as { skillIds?: readonly string[] }).skillIds = fit.skillIds;
      project.database.enemies.push(copy);
    }
    copies.set(enemyId, copyId);
  }
  const clone = structuredClone(source) as typeof source;
  (clone as { id: string }).id = id;
  (clone as { enemyIds: string[] }).enemyIds = (source.enemyIds ?? memberIds).map(e => copies.get(e) ?? e);
  if (source.members?.length) (clone as { members: unknown[] }).members = source.members.map(member => ({ ...member, enemyId: copies.get(member.enemyId) ?? member.enemyId }));
  project.database.troops.push(clone);
  return id;
}
