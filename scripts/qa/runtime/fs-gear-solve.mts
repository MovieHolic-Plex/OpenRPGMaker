// 폴른 스타 — 「처음+이야기 장비」와 「1막 대장간에서 산 장비」 두 판 모두 승률 띠 안에 들게 무리 힘 배수를 다시 잰다(2026-11-01).
//   ONLY=무리,… START=시작표.json node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs-gear-solve.mts <구운 project.json> [n] [out.json]
// 구운 판 위에서 잰다 — 결과 배수는 지금 힘에 곱할 배수(mobBalance FS_GEAR_TUNE). START 의 값이 있으면 그 둘레를 찾는다.
//   판: base(처음 장비+B4 로한의 창) · armor(+대장간 최고 방어구) · all(+대장간 최고 무기, 참고 — 가중 작게). 1막은 BUY_FROM 부터 산 장비.
//   비용: base·armor 가 띠(잡몹 62~88 · 우두머리 50~70) 밖으로 나간 만큼 + all 이 나간 만큼×0.3 + 평균이 목표(잡몹 75 · 우두머리 60)에서 먼 만큼×0.05.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { simulateBattle } from "../../../src/battle/simulate";
import { deserialize } from "../../../src/project/io";
import type { Project } from "../../../src/project/types";
import { ARMOR, PARTY, WEAPONS, detach, overlayDecisions, scaleStats } from "./fs-gear-lib.mts";
import { ACTS, runTable } from "./fs-mob-balance-lib.mts";

const args = process.argv.slice(2);
const n = Number(args[1] ?? 100);
const outFile = args[2] ?? "/tmp/fs-gear/solve.json";
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : undefined;
const start: Record<string, number> = process.env.START && existsSync(process.env.START) ? JSON.parse(readFileSync(process.env.START, "utf8")) : {};
const GRID = (process.env.GRID ?? "0.86,0.91,0.95,1,1.05,1.1,1.17").split(",").map(Number);
const project: Project = deserialize(readFileSync(args[0]!, "utf8"));
const db = project.database;
overlayDecisions(project);

const actor = (id: string) => db.actors.find((a) => a.id === id)!;
const baseEq = Object.fromEntries(PARTY.map((id) => [id, { ...actor(id).initialEquipment }]));
const BUY_FROM = process.env.BUY_FROM ?? "troop_fs_inq_zeal";
const act1 = ACTS.find((a) => a.act === "1막")!.steps.map((s) => s.troop);
const bought = (troop: string) => { const i = act1.indexOf(troop); return i < 0 || i >= act1.indexOf(BUY_FROM); };
const stepOf = new Map<string, (typeof ACTS)[number]["steps"][number]>();
for (const act of ACTS) for (const s of act.steps) stepOf.set(`${s.troop}@${s.map}`, s);

function setGear(profile: "base" | "armor" | "all", story: Record<string, Record<string, string>> | undefined): void {
  for (const id of PARTY) actor(id).initialEquipment = { ...baseEq[id] } as never;
  const add = (g: Record<string, Record<string, string>>) => { for (const [id, eq] of Object.entries(g)) actor(id).initialEquipment = { ...actor(id).initialEquipment, ...eq } as never; };
  if (profile !== "base") add(ARMOR);
  if (profile === "all") add(WEAPONS);
  if (story) add(story);
}

const rows = runTable(project, { n: 1, potions: false, only: (t) => !only || only.has(t) }).filter((r) => r.kind === "mob" || r.kind === "elite");
const out: Record<string, unknown>[] = [];
const done = new Set<string>();
for (const r of rows) {
  if (done.has(r.troop)) continue; // 같은 무리가 두 곳이면 앞 자리 레벨로 한 번
  done.add(r.troop);
  const elite = r.kind === "elite";
  const step = stepOf.get(`${r.troop}@${r.map}`)!;
  const ids = detach(project, r.troop, elite);
  const snap = new Map(ids.map((id) => [id, { ...db.enemies.find((e) => e.id === id)!.stats }]));
  const scale = (p: number) => { for (const id of ids) db.enemies.find((e) => e.id === id)!.stats = scaleStats(snap.get(id)!, p, elite); };
  const profiles = bought(r.troop) ? (["base", "armor", "all"] as const) : (["base"] as const);
  const win = (p: number, nn: number) => {
    scale(p);
    const w: Record<string, number> = {};
    for (const prof of profiles) {
      setGear(prof, step.gear);
      w[prof] = Math.round(simulateBattle({ project, troopId: r.troop, heroLevel: r.level, partyActorIds: step.party, n: nn, seed: 7 }).winRate * 1000) / 10;
    }
    return w;
  };
  const [lo, hi, target] = elite ? [50, 70, 60] : [62, 88, 75];
  const cost = (w: Record<string, number>) => Object.entries(w).reduce((s, [k, v]) => s + (k === "all" ? 0.3 : 1) * (Math.max(0, lo - v) + Math.max(0, v - hi)), 0)
    + 0.05 * Math.abs(((w.base ?? 0) + (w.armor ?? w.base ?? 0)) / 2 - target);
  const p0 = start[r.troop] ?? 1;
  const tried = GRID.map((g) => Math.round(p0 * g * 1000) / 1000).map((p) => ({ p, w: win(p, n) }));
  tried.sort((a, b) => cost(a.w) - cost(b.w));
  const best = tried[0]!;
  scale(1);
  setGear("base", undefined);
  const line = { troop: r.troop, map: r.map, kind: r.kind, level: r.level, p: best.p, at: best.w, cost: Math.round(cost(best.w) * 10) / 10,
    curve: Object.fromEntries([...tried].sort((a, b) => a.p - b.p).map((t) => [t.p, t.w])) };
  out.push(line);
  console.log(`${r.kind.padEnd(5)} Lv${r.level} ${r.troop.padEnd(30)} ×${best.p} ${JSON.stringify(best.w)} 비용 ${line.cost}`);
  writeFileSync(outFile, JSON.stringify(out, null, 1));
}
