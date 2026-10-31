// 폴른 스타 2막 — 1막에서 이어 하는 실제 도착 레벨에 맞춰 2막 무리 힘 배수를 다시 잰다(2026-11-01).
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs-act2-entry-solve.mts <구운 project.json> [n] [out.json]
// 구운 판(mobBalance 가 이미 들어간 판) 위에서 잰다 — 결과 배수는 지금 값에 곱하는 배수다(mobBalance FS_ACT2_ENTRY_TUNE).
//   잡몹·우두머리: 「공격만」 승률 목표(잡몹 0.76 · 우두머리 0.6)를 이어 하기 레벨에서 맞추는 배수.
//   결투·보스: 옛 설계 레벨(2막 Lv6 에서 새로 센 레벨)의 「기술 자동 전투」 승률을 이어 하기 레벨에서도 그대로 내는 배수.
import { readFileSync, writeFileSync } from "node:fs";
import { simulateBattle } from "../../../src/battle/simulate";
import { FS_ELITES } from "../../../src/project/flagship/fallen/mobBalance";
import { deserialize } from "../../../src/project/io";
import type { EnemyRecord, Project } from "../../../src/project/types";
import { ACTS, runTable } from "./fs-mob-balance-lib.mts";

const args = process.argv.slice(2);
const n = Number(args[1] ?? 80);
const outFile = args[2] ?? "/tmp/fs2/ae/entry-solve.json";
const MOB_TARGET = 0.76, ELITE_TARGET = 0.6;
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : undefined;

const project: Project = deserialize(readFileSync(args[0]!, "utf8"));
const db = project.database;
const eliteIds = new Set(FS_ELITES.map((e) => e.id));
/** 보스·결투는 그 무리의 이 적만 키운다(같이 선 졸개는 다른 무리와 같은 적이다). */
const BOSS_ENEMIES: Record<string, string[]> = {
  troop_fs2_sarah: ["enemy_fs2_sarah"],
  troop_fs2_ash_collector: ["enemy_fs2_ash_collector", "enemy_fs2_collector_eye_grab", "enemy_fs2_collector_eye_burn", "enemy_fs2_swallowed_fire"],
};
const act2 = new Set(ACTS.find((a) => a.act === "2막")!.steps.map((s) => s.troop));
const pick = (t: string) => act2.has(t) && (!only || only.has(t));
const now = runTable(project, { n: 1, potions: false, only: pick });
const design = new Map(runTable(project, { n: 1, potions: false, only: pick, startLevels: { "2막": 6 } }).map((r) => [`${r.troop}@${r.map}`, r.level]));
const partyOf = new Map<string, string[]>();
for (const act of ACTS) for (const s of act.steps) partyOf.set(`${s.troop}@${s.map}`, s.party);

const scaleTo = (snap: Map<string, EnemyRecord["stats"]>, ids: string[], p: number, eliteOnly: boolean): void => {
  for (const id of ids) {
    const e = db.enemies.find((x) => x.id === id)!;
    const b = snap.get(id)!;
    const hpMul = eliteOnly ? Math.min(1.2, Math.max(0.9, Math.sqrt(p))) : Math.sqrt(p);
    const atkMul = p / hpMul;
    e.stats = { ...b, attack: Math.round(b.attack * atkMul), mind: Math.round(b.mind * atkMul), maxHp: Math.max(10, Math.round(b.maxHp * hpMul / 10) * 10) };
  }
};
const win = (troopId: string, level: number, party: string[], useSkills: boolean): number =>
  simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party, n, seed: 7, useSkills }).winRate;

const result: { troop: string; map: string; kind: string; designLevel: number; level: number; target: number; base: number; p: number; at: number }[] = [];
for (const r of now) {
  if (r.kind === "boss" && !BOSS_ENEMIES[r.troop]) continue;
  const key = `${r.troop}@${r.map}`;
  const party = partyOf.get(key)!;
  const designLevel = design.get(key) ?? r.level;
  const bossLike = r.kind === "boss" || r.kind === "duel";
  const ids = bossLike ? BOSS_ENEMIES[r.troop]! : [...new Set(r.enemyIds)];
  const elite = r.kind === "elite";
  const snap = new Map(ids.map((id) => [id, { ...db.enemies.find((e) => e.id === id)!.stats }]));
  const target = bossLike ? win(r.troop, designLevel, party, true) : elite ? ELITE_TARGET : MOB_TARGET;
  const base = win(r.troop, r.level, party, bossLike);
  let lo = Math.log(0.5), hi = Math.log(8), at = base;
  for (let i = 0; i < 9; i += 1) {
    const mid = (lo + hi) / 2;
    scaleTo(snap, ids, Math.exp(mid), elite);
    at = win(r.troop, r.level, party, bossLike);
    if (at > target) lo = mid; else hi = mid;
  }
  const p = Math.exp((lo + hi) / 2);
  scaleTo(snap, ids, p, elite);
  at = win(r.troop, r.level, party, bossLike);
  for (const id of ids) db.enemies.find((x) => x.id === id)!.stats = { ...snap.get(id)! };
  result.push({ troop: r.troop, map: r.map, kind: r.kind, designLevel, level: r.level, target: Math.round(target * 100), base: Math.round(base * 100), p: Math.round(p * 100) / 100, at: Math.round(at * 100) });
  console.log(`${r.kind.padEnd(5)} 설계 Lv${designLevel} → 이어 하기 Lv${r.level} ${r.troop.padEnd(30)} ${r.map.padEnd(18)} 목표 ${Math.round(target * 100)}% 지금 ${String(Math.round(base * 100)).padStart(3)}% → ×${p.toFixed(2)} 이면 ${Math.round(at * 100)}%`);
}
writeFileSync(outFile, JSON.stringify(result, null, 1));
