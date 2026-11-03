// 폴른 스타 장비 판 탐침 — 한 무리의 배수 × 적 민첩 격자를 base/armor 로(NOSPEAR=1: 1막 = 로한의 창 없이, ELITE=1, FORMULA/FSKILL, ARMOR_ONLY=배우).
import { readFileSync } from "node:fs";
import { simulateBattle } from "../../../src/battle/simulate";
import { deserialize } from "../../../src/project/io";
import { ARMOR, PARTY, detach, overlayDecisions, scaleStats } from "./fs-gear-lib.mts";
const [file, troopId, lvl, n] = process.argv.slice(2);
const project = deserialize(readFileSync(file!, "utf8"));
const db = project.database;
overlayDecisions(project);
if (process.env.FORMULA) for (const sk of db.skills as unknown as { id: string; damageFormula?: string }[]) if (sk.id.endsWith("_fs_pierce") || sk.id === process.env.FSKILL) sk.damageFormula = process.env.FORMULA;
if (process.env.NOAGI) for (const id of ["equip_gen_armor_plate", "equip_mage_hat"]) { const e = db.equipment.find((x) => x.id === id)!; e.statBonuses = { ...e.statBonuses, agility: 0 }; }
if (process.env.NODEF) for (const id of ["equip_gen_armor_plate", "equip_gen_helm_iron", "equip_gen_shield_iron"]) { const e = db.equipment.find((x) => x.id === id)!; e.statBonuses = { ...e.statBonuses, defense: 4 }; }
const party = (process.env.PARTY ?? "actor_hero,actor_fs_elena").split(",");
const actor = (id: string) => db.actors.find((a) => a.id === id)!;
const baseEq = Object.fromEntries(PARTY.map((id) => [id, { ...actor(id).initialEquipment }]));
const story = process.env.NOSPEAR ? {} : { actor_hero: { weapon: "equip_fs2_rohan_spear" } };
const elite = !!process.env.ELITE;
const ids = detach(project, troopId!, elite);
const snap = new Map(ids.map((id) => [id, { ...db.enemies.find((e) => e.id === id)!.stats }]));
for (const agi of (process.env.AGI ?? "0").split(",").map(Number)) for (const p of (process.env.P ?? "1").split(",").map(Number)) {
  for (const id of ids) { const s = scaleStats(snap.get(id)!, p, elite); db.enemies.find((e) => e.id === id)!.stats = agi && (!process.env.AGI_ONLY || id.includes(process.env.AGI_ONLY)) ? { ...s, agility: agi } : s; }
  const w: string[] = [];
  for (const prof of ["base", "armor"]) {
    for (const id of PARTY) actor(id).initialEquipment = { ...baseEq[id] } as never;
    const add = (g: Record<string, Record<string, string>>) => { for (const [id, eq] of Object.entries(g)) actor(id).initialEquipment = { ...actor(id).initialEquipment, ...eq } as never; };
    if (prof === "armor") add(process.env.ARMOR_ONLY ? { [process.env.ARMOR_ONLY]: ARMOR[process.env.ARMOR_ONLY]! } : ARMOR);
    add(story);
    w.push(`${prof} ${(simulateBattle({ project, troopId: troopId!, heroLevel: Number(lvl), partyActorIds: party, n: Number(n ?? 100), seed: Number(process.env.SEED ?? 7) }).winRate * 100).toFixed(0)}%`);
  }
  console.log(`agi ${agi || "-"} p ${p}: ${w.join("  ")}  ${JSON.stringify(db.enemies.find((e) => e.id === ids[0])!.stats)}`);
}
