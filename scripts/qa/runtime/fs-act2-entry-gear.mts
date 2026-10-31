// 폴른 스타 2막 — 1막에서 사 온 장비를 들고 이어 하면 2막 잡몹이 너무 쉬워지는가(2026-11-01).
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs-act2-entry-gear.mts <구운 project.json> [n]
// 기본 장비(처음 장비) 판과 「1막 대장간에서 살 수 있는 가장 센 것」 판의 2막 승률(공격만)을 나란히 찍는다.
// 로한의 창(B4 대장간)은 이야기로 받는 무기라 B5 부터는 두 판 모두 카엘에게 쥐여 준다.
import { readFileSync } from "node:fs";
import { deserialize } from "../../../src/project/io";
import { runTable } from "./fs-mob-balance-lib.mts";

const args = process.argv.slice(2);
const n = Number(args[1] ?? 100);
const project = deserialize(readFileSync(args[0]!, "utf8"));
const db = project.database;
const actor = (id: string) => db.actors.find((a) => a.id === id)!;
const base = Object.fromEntries(["actor_hero", "actor_fs_elena", "actor_fs2_sarah"].map((id) => [id, { ...actor(id).initialEquipment }]));
const BEST: Record<string, Record<string, string>> = {
  actor_hero: { weapon: "equip_fs_spear_star", armor: "equip_gen_armor_plate", helmet: "equip_gen_helm_iron", shield: "equip_gen_shield_iron" },
  actor_fs_elena: { weapon: "equip_gen_staff_crystal", armor: "equip_gen_robe_mage", helmet: "equip_mage_hat" },
};
const EARLY = new Set(["fs2_hub_night", "map_field_north_1"]); // 로한의 창(B4) 전
const run = (gear: "base" | "best") => {
  const out: Record<string, number> = {};
  for (const early of [true, false]) {
    for (const [id, eq] of Object.entries(base)) actor(id).initialEquipment = { ...eq } as never;
    if (gear === "best") for (const [id, eq] of Object.entries(BEST)) actor(id).initialEquipment = { ...actor(id).initialEquipment, ...eq } as never;
    if (!early) actor("actor_hero").initialEquipment = { ...actor("actor_hero").initialEquipment, weapon: "equip_fs2_rohan_spear" } as never;
    for (const r of runTable(project, { n, potions: false, only: (t) => /^troop_fs2_/.test(t) })) {
      if (r.act !== "2막" || EARLY.has(r.map) !== early) continue;
      out[`${r.troop}@${r.map}|${r.kind}|Lv${r.level}`] = r.atkWin;
    }
  }
  return out;
};
const a = run("base"), b = run("best");
for (const k of Object.keys(a)) console.log(`${k.padEnd(60)} 처음 장비 ${String(a[k]).padStart(5)}%  1막 최고 장비 ${String(b[k] ?? "-").padStart(5)}%`);
