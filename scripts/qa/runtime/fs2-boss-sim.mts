// 폴른 스타 2막 B13 재의 회수자 모의전 — 구운 project.json 위에서 simulate_battle.
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs2-boss-sim.mts <project.json> [n]
import { readFileSync } from "node:fs";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize } from "../../../src/project/io";

const file = process.argv[2]!;
const n = Number(process.argv[3] ?? 40);
const project = deserialize(readFileSync(file, "utf8"));
const ctx = { project };
// 튜닝 시험: FS_HP=4600 FS_BREAK=450 FS_SCATTER=40
const boss = project.database.enemies.find((e) => e.id === "enemy_fs2_ash_collector")!;
if (process.env.FS_HP) boss.stats.maxHp = Number(process.env.FS_HP);
if (process.env.FS_ATK) boss.stats.attack = Number(process.env.FS_ATK);
const recall = project.database.skills.find((s) => s.id === "skill_fs2_ash_recall") as unknown as { chargeBreak: { damage: number }; power: number };
if (process.env.FS_BREAK) recall.chargeBreak.damage = Number(process.env.FS_BREAK);
if (process.env.FS_RECALL) recall.power = Number(process.env.FS_RECALL);
const scatter = project.database.skills.find((s) => s.id === "skill_fs2_ash_scatter") as unknown as { power: number };
if (process.env.FS_SCATTER) scatter.power = Number(process.env.FS_SCATTER);
const party = ["actor_hero", "actor_fs_elena", "actor_fs2_sarah", "actor_fs_iris"];
const out: Record<string, unknown> = {};
for (const [name, extra] of [
  ["attackOnly_noValen", { useSkills: false, switchesOn: [] }],
  ["attackOnly_valen", { useSkills: false, switchesOn: ["sw_fs2_b13_valen_guest"] }],
  ["skills_noValen", { useSkills: true, switchesOn: [] }],
  ["skills_valen", { useSkills: true, switchesOn: ["sw_fs2_b13_valen_guest"] }],
] as const) {
  const r = runTool(ctx, "simulate_battle", { troopId: "troop_fs2_ash_collector", heroLevel: Number(process.env.FS_LV ?? 14), partyActorIds: party, inventory: { item_potion: 6, item_hi_potion: 1, item_ether: 2 }, potionItemId: "item_potion", n, seed: 11, ...extra });
  if (process.env.FS_DUMP) console.log(name, JSON.stringify(r.data).slice(0, 1500));
  out[name] = r.ok ? { summary: r.summary, winRate: (r.data as { winRate?: number })?.winRate, avgTurns: (r.data as { avgTurns?: number })?.avgTurns } : { error: r.summary };
}
console.log(JSON.stringify(out, null, 1));
