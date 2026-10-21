// 아스트라 호라이즌 스타터 3종 × 주요 승부 모의전(브라우저 없이). 실행: node scripts/qa/astra-horizon/balance-sim.mjs [n] [overrides.json]
// 파티는 정직 여정(journey.mjs) 실측 레벨에 맞춘다. 동료는 실제로 잡히는 셋(포포비·피오르·루미링)을 고루 돌린다.
import { simulateBattle } from "@/battle/simulate";
import { createEmeraldCrownFlagshipDemo } from "@/project/flagship/emeraldCrown";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

export const STARTERS = ["mx_species_spriglet", "mx_species_coalbit", "mx_species_rivulet"] as const;
const PARTNERS = ["mx_species_pipbug", "mx_species_gustchick", "mx_species_wickworm"] as const;

export type Fight = {
  readonly id: string;
  readonly label: string;
  readonly troopId: string;
  readonly level: number;
  /** 동료 레벨. 없으면 혼자. */
  readonly partnerLevel?: number;
};

/** 실제 경로 레벨(r27~r33 정직 여정 실측 중앙값). */
export const ROUTE: readonly Fight[] = [
  { id: "rival", label: "라이벌(연구소) · 스타터 Lv5 혼자", troopId: "mx_troop_mx_map_lab_rival", level: 5 },
  { id: "gym", label: "관장 유림 · Lv9 + 동료 Lv6", troopId: "mx_troop_mx_map_grove_gym_leader", level: 9, partnerLevel: 6 },
  { id: "temple", label: "신전 무영 · Lv11 + 동료 Lv8", troopId: "mx_troop_mx_map_observatory_boss", level: 11, partnerLevel: 8 },
  { id: "champion", label: "챔피언 나루 · Lv12 + 동료 Lv9", troopId: "mx_troop_mx_map_league_0_league_challenge", level: 12, partnerLevel: 9 },
];

/** 적 레벨·기술 덮어쓰기(탐색용). 값은 enemyId → { level?, skills? (기술 이름) }. */
export type Overrides = Readonly<Record<string, { readonly level?: number; readonly skills?: readonly string[]; readonly statScale?: number; readonly statDelta?: Readonly<Record<string, number>>; readonly cloneOf?: string; readonly troop?: string }>>;

function mon(project: Project, speciesId: string, level: number, tag: string): MonsterInstance {
  const species = monsterSpeciesById(project, speciesId)!;
  return { instanceId: `sim_${tag}`, speciesId, level, exp: 0, skillIds: monsterSkillIdsAtLevel(species, level), friendship: 0, caughtAt: { mapId: project.startMapId, x: 0, y: 0 } } as MonsterInstance;
}

function maxHp(project: Project, m: MonsterInstance): number {
  return monsterBattleStatsForSpecies(monsterSpeciesById(project, m.speciesId), m.level, undefined).maxHp;
}

function applyOverrides(project: Project, overrides: Overrides): void {
  for (const [enemyId, o] of Object.entries(overrides)) {
    // cloneOf: 다른 적을 복사해 새 적으로 만들고 troop 에 덧붙인다(멤버 추가 탐색).
    if (o.cloneOf && !project.database.enemies.some((e) => e.id === enemyId)) {
      const source = project.database.enemies.find((e) => e.id === o.cloneOf);
      if (source) project.database.enemies.push({ ...structuredClone(source), id: enemyId });
    }
    const enemy = project.database.enemies.find((e) => e.id === enemyId);
    if (!enemy) continue;
    if (o.troop) {
      const troop = project.database.troops.find((t) => t.id === o.troop);
      if (troop?.members && !troop.members.some((m) => m.enemyId === enemyId)) {
        troop.members = [{ ...structuredClone(troop.members[0]!), enemyId }, ...troop.members];
        troop.enemyIds = troop.members.map((m) => m.enemyId);
      }
    }
    if (o.statScale) {
      const stats = { ...enemy.stats };
      for (const key of Object.keys(stats) as (keyof typeof stats)[]) stats[key] = Math.max(1, Math.round(stats[key] * o.statScale));
      enemy.stats = stats;
    }
    if (o.level && enemy.level) {
      const ratio = o.level / enemy.level;
      enemy.level = o.level;
      const stats = { ...enemy.stats };
      for (const key of Object.keys(stats) as (keyof typeof stats)[]) stats[key] = Math.max(1, Math.round(stats[key] * ratio));
      enemy.stats = stats;
    }
    if (o.statDelta) {
      const stats = { ...enemy.stats } as Record<string, number>;
      for (const [key, d] of Object.entries(o.statDelta)) if (key in stats) stats[key] = Math.max(1, stats[key]! + d);
      enemy.stats = stats as typeof enemy.stats;
    }
    if (o.skills) {
      const base = enemy.actions.find((a) => a.skillId) ?? enemy.actions[0];
      const ids = o.skills.map((name) => project.database.skills.find((s) => s.name === name)?.id).filter((id): id is string => Boolean(id));
      if (base && ids.length) enemy.actions = ids.map((skillId) => ({ ...structuredClone(base), skillId }));
    }
  }
}

export type Cell = {
  readonly fight: string; readonly starter: string; readonly win: number; readonly turns: number; readonly medianTurns: number;
  readonly hpPct: number; readonly enemyTop: number; readonly playerLevel: number;
  /** 동료별 승률 — 가장 낮은 동료(예: 물 + 비행 동료가 둘 다 전기 에이스에 두 배로 맞는다). */
  readonly byPartner: Readonly<Record<string, number>>; readonly worstPartner: number;
};

const median = (xs: number[]): number => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length ? (a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2) : 0; };

/** 한 칸: 판마다 따로 돌려(n=1) 턴 중앙값과 동료별 승률을 낸다. */
function cellFor(project: Project, fight: Fight, starter: string, n: number): Cell {
  const troop = project.database.troops.find((t) => t.id === fight.troopId);
  const enemyTop = Math.max(...(troop?.members ?? []).map((m) => project.database.enemies.find((e) => e.id === m.enemyId)?.level ?? 0));
  let wins = 0, hp = 0, max = 0;
  const turns: number[] = [];
  const byPartner: Record<string, number> = {};
  const partners = fight.partnerLevel ? PARTNERS : [undefined];
  const per = Math.max(1, Math.round(n / partners.length));
  partners.forEach((partner, k) => {
    const party = [mon(project, starter, fight.level, "a")];
    if (partner && fight.partnerLevel) party.push(mon(project, partner, fight.partnerLevel, "b"));
    const partyMax = party.reduce((sum, m) => sum + maxHp(project, m), 0);
    let pw = 0;
    for (let i = 0; i < per; i++) {
      const r = simulateBattle({ project, troopId: fight.troopId, heroLevel: fight.level, monsterParty: party, n: 1, seed: 11 + k * 1000 + i, useSkills: true });
      wins += r.winRate; pw += r.winRate; hp += r.avgHpRemaining; max += partyMax; turns.push(r.avgTurns);
    }
    byPartner[(partner ?? "solo").replace("mx_species_", "")] = pw / per;
  });
  const runs = turns.length;
  return {
    fight: fight.id, starter: starter.replace("mx_species_", ""), win: wins / runs, turns: turns.reduce((a, b) => a + b, 0) / runs, medianTurns: median(turns),
    hpPct: max ? hp / max : 0, enemyTop, playerLevel: fight.level, byPartner, worstPartner: Math.min(...Object.values(byPartner)),
  };
}

export function sweep(n = 30, overrides: Overrides = {}): Cell[] {
  const { project } = createEmeraldCrownFlagshipDemo();
  applyOverrides(project, overrides);
  return ROUTE.flatMap((fight) => STARTERS.map((starter) => cellFor(project, fight, starter, n)));
}

/**
 * 관장: 승률 70~90%, 턴 중앙값 5~9, 남은 체력 70% 이하, 스타터 사이 턴 중앙값 차 3 이하(spread, 표 아래 줄).
 * 신전·챔피언: 승률 55~80%, 가장 불리한 동료와도 40% 이상. 챔피언 최고 레벨 ≥ 플레이어.
 */
export function verdict(cell: Cell): string {
  const bad: string[] = [];
  if (cell.fight === "gym") {
    if (cell.win < 0.7 || cell.win > 0.9) bad.push("win");
    if (cell.medianTurns < 5 || cell.medianTurns > 9) bad.push("turns");
    if (cell.hpPct > 0.7) bad.push("hp");
  }
  if (cell.fight === "temple" || cell.fight === "champion") {
    if (cell.win < 0.55 || cell.win > 0.8) bad.push("win");
    if (cell.worstPartner < 0.4) bad.push("partner");
  }
  if (cell.fight === "champion" && cell.enemyTop < cell.playerLevel) bad.push("level");
  return bad.length ? `✗ ${bad.join(",")}` : "✓";
}

/** 관장 턴 중앙값의 스타터 사이 차(≤3). */
export function gymSpread(cells: readonly Cell[]): number {
  const gym = cells.filter((c) => c.fight === "gym").map((c) => c.medianTurns);
  return gym.length ? Math.max(...gym) - Math.min(...gym) : 0;
}

export function table(cells: readonly Cell[]): string {
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const rows = cells.map((c) => `| ${c.fight} | ${c.starter} | ${pct(c.win)} | ${c.medianTurns.toFixed(1)} (평균 ${c.turns.toFixed(1)}) | ${pct(c.hpPct)} | ${Object.entries(c.byPartner).map(([p, w]) => `${p} ${pct(w)}`).join(" · ")} | Lv${c.playerLevel} vs ${c.enemyTop} | ${verdict(c)} |`);
  const spread = gymSpread(cells);
  return ["| 승부 | 스타터 | 승률 | 턴 중앙값 | 남은 체력 | 동료별 승률 | 레벨 | 목표 |", "|---|---|---|---|---|---|---|---|", ...rows, "", `관장 턴 중앙값 스타터 간 차: ${spread.toFixed(1)} ${spread <= 3 ? "✓" : "✗ (≤3)"}`].join("\n");
}

let cached: Project | undefined;
/** 승부 하나만 덮어쓰기로 잰다(탐색용). 적 목록만 복사해 되돌린다. */
export function evalFight(fightId: string, overrides: Overrides, n = 30): Cell[] {
  cached ??= createEmeraldCrownFlagshipDemo().project;
  const project = cached;
  const saved = project.database.enemies, savedTroops = project.database.troops;
  project.database.enemies = structuredClone(saved);
  project.database.troops = structuredClone(savedTroops);
  try {
    applyOverrides(project, overrides);
    const fight = ROUTE.find((f) => f.id === fightId)!;
    return STARTERS.map((starter) => cellFor(project, fight, starter, n));
  } finally {
    project.database.enemies = saved;
    project.database.troops = savedTroops;
  }
}
