// 폴른 스타 잡몹 승률표 공용 — fs-mob-balance-sim.mts(표)·fs-mob-balance-tune.mts(조율)가 같이 쓴다.
// 도착 레벨 = 그 막의 시작 레벨에서 앞선 싸움(맵에 놓인 적을 한 번씩 다 잡았다고 본다)의 경험치를 누적한 레벨.
// 「공격만」 = 통상 공격만·아이템 없음, 「회복약」 = 같은 AI 에 회복약 3개(HP 30% 아래에서 마신다).
import { simulateBattle } from "../../../src/battle/simulate";
import { parameterValueAtLevel, totalExpForLevel } from "../../../src/project/actorModel";
import { FS_ELITE_PLACEMENTS, FS_TROOP_SPLITS } from "../../../src/project/flagship/fallen/mobBalance";
import type { Command, Project } from "../../../src/project/types";

export interface Row { act: string; map: string; troop: string; name: string; enemies: string; enemyIds: string[]; placements: number; kind: string; note: string;
  level: number; party: number; atkWin: number; atkHpPct: number; atkTurns: number; potWin: number; potUsed: number }

type Kind = "mob" | "elite" | "boss" | "duel";
interface Step { troop: string; map: string; party: string[]; kind?: Kind; note?: string; gear?: Record<string, Record<string, string>> }
const HE = ["actor_hero", "actor_fs_elena"];
const HEI = [...HE, "actor_fs_iris"];
const HES = [...HE, "actor_fs2_sarah"];
/**
 * 2막 시작 — "continue" = 1막을 다 싸우고 끝난 경험치를 그대로 잇는다(실제 이어 하기). 2026-11-01 이전 표는 2막을 Lv6 에서 새로 셌다
 * (2막만 따로 시작하는 판). 이어 하면 1막 끝이 Lv13 이라 2막 잡몹이 너무 쉬웠다 — 지금 표는 이어 하기 기준이다.
 */
export const ACTS: { act: string; startLevel: number | "continue"; steps: Step[] }[] = [
  {
    act: "1막", startLevel: 6, steps: [
      { troop: "troop_fs_wolves", map: "fs_forest_edge", party: HE },
      { troop: "troop_fs_edge_boar", map: "fs_forest_edge", party: HE },
      { troop: "troop_fs_stream_crabs", map: "fs_forest_stream", party: HE },
      { troop: "troop_fs_stream_eels", map: "fs_forest_stream", party: HE },
      { troop: "troop_fs_spiders", map: "fs_forest_thicket", party: HE },
      { troop: "troop_fs_thicket_moths", map: "fs_forest_thicket", party: HE },
      { troop: "troop_fs_glade_poachers", map: "fs_forest_glade", party: HE },
      { troop: "troop_fs_edge_hornets", map: "fs_forest_glade", party: HE },
      { troop: "troop_fs_elite_thornback", map: "fs_forest_glade", party: HE },
      { troop: "troop_fs_wisps", map: "fs_forest", party: HE },
      { troop: "troop_fs_valen_squad", map: "fs_forest", party: HEI, kind: "boss", note: "발렌 1차(병사 넷) — 보스 연전" },
      { troop: "troop_fs_valen_crash", map: "fs_forest", party: HEI, kind: "boss" },
      { troop: "troop_fs_inq_zeal", map: "fs_vault", party: HEI },
      { troop: "troop_fs_inq_shieldwall", map: "fs_vault", party: HEI },
      { troop: "troop_fs_inq_bolts", map: "fs_vault", party: HEI },
      { troop: "troop_fs_inq_false_prisoner", map: "fs_vault", party: HEI },
      { troop: "troop_fs_inq_alarm", map: "fs_vault_b3", party: HEI },
      { troop: "troop_fs_inq_phalanx", map: "fs_vault_b3", party: HEI },
      { troop: "troop_fs_inq_vigil", map: "fs_vault_b3", party: HEI },
      { troop: "troop_fs_inq_kennel", map: "fs_vault_b3", party: HEI },
      { troop: "troop_fs_inq_penance", map: "fs_vault_b3", party: HEI },
      { troop: "troop_fs_inq_patrol", map: "fs_vault_b3", party: HEI },
      { troop: "troop_fs_inq_ledge", map: "fs_vault_b3", party: HEI },
      { troop: "troop_fs_dragon", map: "fs_vault_b4", party: HEI, kind: "boss" },
    ],
  },
  {
    act: "2막", startLevel: "continue", steps: [
      { troop: "troop_fs2_curfew_patrol", map: "fs2_hub_night", party: HE },
      { troop: "troop_fs2_starved_dogs", map: "map_field_north_1", party: HE },
      { troop: "troop_fs2_ash_crows", map: "map_field_north_1", party: HE },
      { troop: "troop_fs2_ash_wisps", map: "map_field_north_2", party: HE },
      { troop: "troop_fs2_ash_snakes", map: "map_field_north_2", party: HE },
      { troop: "troop_fs2_cinder_golem", map: "map_field_north_2", party: HE },
      { troop: "troop_fs2_ash_wisps_pair", map: "fs2_dawnwell", party: HE },
      { troop: "troop_fs2_fort_dogs_out", map: "fs2_fort_court", party: HE },
      { troop: "troop_fs2_fort_knights_out", map: "fs2_fort_court", party: HE },
      { troop: "troop_fs2_fort_dogs", map: "fs2_fortress", party: HE },
      { troop: "troop_fs2_fort_knights", map: "fs2_fortress", party: HE },
      { troop: "troop_fs2_elite_warden", map: "fs2_fortress", party: HE },
      { troop: "troop_fs2_fort_crossbows", map: "fs2_fortress_f2", party: HE },
      { troop: "troop_fs2_sarah", map: "fs2_fort_court", party: HE, kind: "duel", note: "새라 결투(지면 감방, 게임 오버 아님)" },
      { troop: "troop_fs2_frost_wolves", map: "map_snow_north_1", party: HES },
      { troop: "troop_fs2_frost_bats", map: "map_snow_north_1", party: HES },
      { troop: "troop_fs2_frost_wolves", map: "map_snow_north_2", party: HES },
      { troop: "troop_fs2_frost_mixed", map: "map_snow_north_2", party: HES },
      { troop: "troop_fs2_elite_frost", map: "map_snow_north_2", party: HES },
      { troop: "troop_fs2_frost_wolves_lake", map: "fs2_ice_lake", party: HES },
      { troop: "troop_fs2_frost_bats_lake", map: "fs2_ice_lake", party: HES },
      { troop: "troop_fs2_frost_mixed", map: "fs2_ice_lake", party: HES },
      { troop: "troop_fs2_tower_sentinel", map: "fs2_sky_tower", party: HES },
      { troop: "troop_fs2_tower_moths", map: "fs2_sky_tower", party: HES },
      { troop: "troop_fs2_tower_bats", map: "fs2_sky_tower_f2", party: HES },
      { troop: "troop_fs2_tower_spiders", map: "fs2_sky_tower_f3", party: HES },
      { troop: "troop_fs2_tower_snakes", map: "fs2_sky_tower_f3", party: HES },
      { troop: "troop_fs2_ash_collector", map: "fs2_sky_tower_top", party: [...HES, "actor_fs_iris"], kind: "boss" },
    ],
  },
];

/**
 * 이야기가 쥐여 주는 장비 — B4 대장간에서 로한이 카엘에게 「로한의 별쇠 창」(공격 +40)을 준다(act2Opening, 피할 수 없다).
 * 그 뒤 2막 싸움은 모두 그 창을 든 카엘로 잰다(새라에게 돌려주는 선택지를 골라도 일행 공격 합은 비슷하다 — 더 센 「맡아 둔다」 쪽으로 잰다).
 * 2026-11-01 이전 표는 처음 장비(청동 검 +8)로 재서 B5 부터가 실제보다 쉬웠다.
 */
{
  const act2 = ACTS.find((a) => a.act === "2막")!;
  const from = act2.steps.findIndex((s) => s.troop === "troop_fs2_starved_dogs");
  for (const s of act2.steps.slice(from)) s.gear = { actor_hero: { weapon: "equip_fs2_rohan_spear" } };
}

function walk(commands: readonly Command[] | undefined, visit: (c: Command) => void): void {
  for (const c of commands ?? []) {
    visit(c);
    for (const v of Object.values(c as unknown as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] && "kind" in (v[0] as object)) walk(v as Command[], visit);
      if (Array.isArray(v) && v.length && Array.isArray(v[0])) for (const vv of v) walk(vv as Command[], visit);
    }
  }
}
/**
 * 그 맵에서 이 부대로 싸우는 이벤트 수(같은 이벤트의 여러 쪽은 하나). 매복·보스 자리는 칸이 여럿이어도 한 번.
 * 굽기 전 판(mobBalance 의 우두머리 자리·무리 나누기가 아직 맵에 없는 판)에서도 구운 판과 같은 수가 나오게 맞춘다.
 */
export function placements(project: Project, mapId: string, troopId: string, kind: string): number {
  if (kind === "boss" || kind === "duel" || /_inq_(patrol|ledge|alarm)$/.test(troopId)) return 1;
  const count = (tid: string): number => {
    const ids = new Set<string>();
    for (const ev of project.maps[mapId]?.events ?? []) for (const pg of ev.pages ?? []) walk(pg.commands, (c) => {
      const r = c as unknown as { kind: string; troopId?: string };
      if (r.kind === "battleProcessing" && r.troopId === tid) ids.add(ev.id);
    });
    return ids.size;
  };
  let n = count(troopId);
  const split = FS_TROOP_SPLITS.find((x) => x.id === troopId && x.mapId === mapId);
  if (split && n === 0) n = count(split.fromTroop);
  if (FS_TROOP_SPLITS.some((x) => x.fromTroop === troopId && x.mapId === mapId) && count(FS_TROOP_SPLITS.find((x) => x.fromTroop === troopId && x.mapId === mapId)!.id) === 0) n = 0;
  const swapTo = FS_ELITE_PLACEMENTS.find((x) => x.toTroop === troopId && x.mapId === mapId);
  if (swapTo && n === 0) n = 1;
  const swapFrom = FS_ELITE_PLACEMENTS.find((x) => x.fromTroop === troopId && x.mapId === mapId);
  if (swapFrom && count(swapFrom.toTroop) === 0) n = Math.max(0, n - 1);
  return n;
}

export interface TableOptions { n: number; only?: (troopId: string) => boolean; potions?: boolean; log?: boolean;
  /** 막 시작 레벨 덮어쓰기(예: { "2막": 6 } = 옛 설계 — 2막을 Lv6 에서 새로 센다). */
  startLevels?: Record<string, number>; useSkills?: boolean }

export function runTable(project: Project, opts: TableOptions): Row[] {
  const db = project.database;
  const hero = db.actors.find((a) => a.id === "actor_hero")!;
  const levelFor = (exp: number): number => { let l = 1; while (l < 99 && totalExpForLevel(hero.expCurve!, l + 1) <= exp) l += 1; return l; };
  const troopExp = (troopId: string): number => (db.troops.find((t) => t.id === troopId)?.enemyIds ?? []).reduce((s, id) => s + (db.enemies.find((e) => e.id === id)?.rewards?.exp ?? 0), 0);
  const partyMaxHp = (party: string[], level: number): number => party.reduce((s, id) => {
    const a = db.actors.find((x) => x.id === id);
    return s + (a?.parameterCurves ? parameterValueAtLevel(a.parameterCurves.maxHp, level) : 0);
  }, 0);
  const rows: Row[] = [];
  let exp = 0;
  for (const act of ACTS) {
    const start = opts.startLevels?.[act.act] ?? act.startLevel;
    if (start !== "continue") exp = totalExpForLevel(hero.expCurve!, start);
    for (const step of act.steps) {
      const troop = db.troops.find((t) => t.id === step.troop);
      if (!troop) { if (opts.log) console.error("missing troop", step.troop); continue; }
      const elite = troop.enemyIds.some((id) => /elite/.test(id)) || ["troop_fs2_cinder_golem", "troop_fs2_tower_sentinel", "troop_fs_inq_penance"].includes(step.troop);
      const kind = step.kind ?? (elite ? "elite" : "mob");
      const count = placements(project, step.map, step.troop, kind);
      if (count === 0) { if (opts.log) console.log(`(${step.map} 에 ${step.troop} 자리 없음 — 건너뜀)`); continue; }
      const level = levelFor(exp);
      exp += troopExp(step.troop) * count;
      if (opts.only && !opts.only(step.troop)) continue;
      const saved = new Map<string, unknown>();
      for (const [actorId, eq] of Object.entries(step.gear ?? {})) {
        const a = db.actors.find((x) => x.id === actorId);
        if (!a) continue;
        saved.set(actorId, a.initialEquipment);
        a.initialEquipment = { ...(a.initialEquipment ?? {}), ...eq } as typeof a.initialEquipment;
      }
      const base = { project, troopId: step.troop, heroLevel: level, partyActorIds: step.party, n: opts.n, seed: 7, useSkills: opts.useSkills };
      const atk = simulateBattle(base);
      const pot = opts.potions === false ? undefined : simulateBattle({ ...base, inventory: { item_potion: 3 }, potionItemId: "item_potion" });
      const maxHp = partyMaxHp(step.party, level);
      const enemies = troop.enemyIds.map((id) => db.enemies.find((e) => e.id === id)!).map((e) => `${e.name}(HP${e.stats.maxHp})`).join("+");
      const row: Row = {
        act: act.act, map: step.map, troop: step.troop, name: troop.name, enemies, enemyIds: [...troop.enemyIds], placements: count,
        kind, note: step.note ?? "", level, party: step.party.length,
        atkWin: Math.round(atk.winRate * 1000) / 10, atkHpPct: Math.round((atk.avgHpRemaining / maxHp) * 100), atkTurns: Math.round(atk.avgTurns * 10) / 10,
        potWin: pot ? Math.round(pot.winRate * 1000) / 10 : -1, potUsed: pot ? Math.round(pot.avgPotionsUsed * 10) / 10 : -1,
      };
      for (const [actorId, eq] of saved) db.actors.find((x) => x.id === actorId)!.initialEquipment = eq as never;
      rows.push(row);
      if (opts.log) console.log(`${act.act} Lv${level} ${step.map.padEnd(18)} ${step.troop.padEnd(30)} ×${count} ${kind.padEnd(5)} 공격만 ${String(row.atkWin).padStart(5)}% HP${String(row.atkHpPct).padStart(3)}%  회복약 ${String(row.potWin).padStart(5)}% (${row.potUsed})  ${enemies}`);
    }
    if (opts.log) console.log(`${act.act} 끝 Lv${levelFor(exp)} (exp ${exp})`);
  }
  return rows;
}
