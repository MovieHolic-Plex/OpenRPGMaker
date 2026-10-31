// 폴른 스타 잡몹 — 무리마다 「몇 배 세야 목표 승률인가」를 따로 재고(그 무리 적만 공격·마력·HP 를 같이 키워 이분 탐색),
// 적마다 배수를 최소제곱으로 맞춘다. 같은 적이 여러 무리에 나와 한 배수로 못 맞추는 무리(잔차가 큰 무리)는 구성을 바꿔야 한다.
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs-mob-balance-solve.mts <굽기 전 project.json> [n] [out.json]
// 우두머리 무리는 우두머리 적 하나만 키운다(HP 는 1000 안팎에 묶고 공격·마력으로 맞춘다).
import { readFileSync, writeFileSync } from "node:fs";
import { simulateBattle } from "../../../src/battle/simulate";
import { applyFallenMobStats, FS_ELITES } from "../../../src/project/flagship/fallen/mobBalance";
import { deserialize } from "../../../src/project/io";
import type { EnemyRecord, Project } from "../../../src/project/types";
import { ACTS, runTable } from "./fs-mob-balance-lib.mts";

const args = process.argv.slice(2);
const n = Number(args[1] ?? 80);
const outFile = args[2] ?? "/tmp/fsb/solve.json";
const MOB_TARGET = Number(process.env.MOB_TARGET ?? 0.76);
const ELITE_TARGET = Number(process.env.ELITE_TARGET ?? 0.6);
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : undefined;

const project: Project = deserialize(readFileSync(args[0]!, "utf8"));
applyFallenMobStats(project);
const db = project.database;
const eliteIds = new Set(FS_ELITES.map((e) => e.id));
const rows = runTable(project, { n: 1, potions: false }).filter((r) => r.kind === "mob" || r.kind === "elite");
const partyOf = new Map<string, string[]>();
for (const act of ACTS) for (const s of act.steps) partyOf.set(`${s.troop}@${s.map}`, s.party);

const snapshot = (ids: string[]) => new Map(ids.map((id) => [id, { ...db.enemies.find((e) => e.id === id)!.stats }]));
const scaleTo = (snap: Map<string, EnemyRecord["stats"]>, ids: string[], p: number, eliteOnly: boolean): void => {
  for (const id of ids) {
    const e = db.enemies.find((x) => x.id === id)!;
    const b = snap.get(id)!;
    if (eliteOnly && !eliteIds.has(id)) { e.stats = { ...b }; continue; }
    // 힘 = 공격 × HP 쯤 — 배수 p 를 반씩 나눈다. 우두머리는 HP 를 1000 안팎에 묶고 나머지를 공격으로.
    const hpMul = eliteOnly ? Math.min(1.2, Math.max(0.9, Math.sqrt(p))) : Math.sqrt(p);
    const atkMul = p / hpMul;
    e.stats = { ...b, attack: Math.round(b.attack * atkMul), mind: Math.round(b.mind * atkMul), maxHp: Math.max(10, Math.round(b.maxHp * hpMul / 10) * 10) };
  }
};
const win = (troopId: string, level: number, party: string[]): number =>
  simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party, n, seed: 7 }).winRate;

const result: { troop: string; map: string; kind: string; level: number; base: number; p: number; at: number }[] = [];
for (const r of rows) {
  if (only && !only.has(r.troop)) continue;
  const ids = [...new Set(r.enemyIds)];
  const elite = r.kind === "elite";
  const target = elite ? ELITE_TARGET : MOB_TARGET;
  const party = partyOf.get(`${r.troop}@${r.map}`)!;
  const snap = snapshot(ids);
  const base = win(r.troop, r.level, party);
  // 이분 탐색(로그 공간) — 승률은 p 에 대해 내려간다.
  let lo = Math.log(0.25), hi = Math.log(6), at = base;
  for (let i = 0; i < 9; i += 1) {
    const mid = (lo + hi) / 2;
    scaleTo(snap, ids, Math.exp(mid), elite);
    at = win(r.troop, r.level, party);
    if (at > target) lo = mid; else hi = mid;
  }
  const p = Math.exp((lo + hi) / 2);
  scaleTo(snap, ids, p, elite);
  at = win(r.troop, r.level, party);
  for (const id of ids) db.enemies.find((x) => x.id === id)!.stats = { ...snap.get(id)! };
  result.push({ troop: r.troop, map: r.map, kind: r.kind, level: r.level, base: Math.round(base * 100), p: Math.round(p * 100) / 100, at: Math.round(at * 100) });
  console.log(`${r.kind.padEnd(5)} Lv${r.level} ${r.troop.padEnd(30)} ${r.map.padEnd(18)} 지금 ${String(Math.round(base * 100)).padStart(3)}% → 힘 ×${p.toFixed(2)} 이면 ${Math.round(at * 100)}%   ${r.enemies}`);
}
writeFileSync(outFile, JSON.stringify(result, null, 1));
