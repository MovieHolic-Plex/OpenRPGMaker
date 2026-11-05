// 폴른 스타 — 1막 대장간 장비를 산 판과 안 산 판의 잡몹 승률을 함께 잰다(2026-11-01).
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs-gear-balance.mts <구운 project.json> [n] [out.json]
// 장비 판 셋:
//   base  = 처음 장비 + 이야기로 받는 장비(B4 로한의 창)
//   armor = 위 + 1막 대장간에서 살 수 있는 가장 센 방어구(카엘 판금·철 투구·철 방패, 엘레나 마법사 로브·수습모, 이리스 사냥꾼 가죽 갑옷)
//   all   = armor + 가장 센 무기(카엘 별꿰기 창, 엘레나 수정 지팡이 — B4 뒤 카엘은 로한의 창이 더 세서 그것을 쥔다)
// 1막은 대장간 장비를 BUY_FROM(기본: 지하 미궁 첫 싸움 — 숲을 지나 마을로 돌아온 뒤) 싸움부터 바꾼다. 2막은 감방에서 짐을 그대로 돌려받는다.
// 환경: OLD=1 = 구운 판 그대로(이번 결정 덧칠 없이 — 고치기 전 표), DELTA=표.json = 무리 배수를 더 곱해 본다, PROFILES=base,armor,all.
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize } from "../../../src/project/io";
import { ARMOR, PARTY, WEAPONS, applyDelta, overlayDecisions } from "./fs-gear-lib.mts";
import { ACTS, runTable, type Row } from "./fs-mob-balance-lib.mts";

const args = process.argv.slice(2);
const n = Number(args[1] ?? 200);
const project = deserialize(readFileSync(args[0]!, "utf8"));
const db = project.database;
if (!process.env.OLD) overlayDecisions(project);
// 실험 손잡이: ARMOR_DEF=판금,투구,방패 방어 수치 · PLATE_AGI=판금 민첩.
if (process.env.ARMOR_DEF) {
  const [plate, helm, shield] = process.env.ARMOR_DEF.split(",").map(Number);
  for (const [id, v] of [["equip_gen_armor_plate", plate], ["equip_gen_helm_iron", helm], ["equip_gen_shield_iron", shield]] as const) {
    const e = db.equipment.find((x) => x.id === id)!;
    e.statBonuses = { ...e.statBonuses, defense: v! };
  }
}
if (process.env.PLATE_AGI) { const e = db.equipment.find((x) => x.id === "equip_gen_armor_plate")!; e.statBonuses = { ...e.statBonuses, agility: Number(process.env.PLATE_AGI) }; }
if (process.env.DELTA) applyDelta(project, JSON.parse(readFileSync(process.env.DELTA, "utf8")));
const actor = (id: string) => db.actors.find((a) => a.id === id)!;
const base = Object.fromEntries(PARTY.map((id) => [id, { ...actor(id).initialEquipment }]));
const BUY_FROM = process.env.BUY_FROM ?? "troop_fs_inq_zeal";
const profiles = (process.env.PROFILES ?? "base,armor,all").split(",");

function gearFor(profile: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (profile === "base") return out;
  for (const [id, eq] of Object.entries(ARMOR)) out[id] = { ...eq };
  if (profile === "all") for (const [id, eq] of Object.entries(WEAPONS)) out[id] = { ...(out[id] ?? {}), ...eq };
  return out;
}

const all: Record<string, Row[]> = {};
for (const profile of profiles) {
  const gear = gearFor(profile);
  const rows: Row[] = [];
  const steps1 = ACTS.find((a) => a.act === "1막")!.steps.map((s) => s.troop);
  const cut = steps1.indexOf(BUY_FROM);
  for (const phase of ["before", "after"] as const) {
    for (const id of PARTY) actor(id).initialEquipment = { ...base[id] } as never;
    if (phase === "after") for (const [id, eq] of Object.entries(gear)) actor(id).initialEquipment = { ...actor(id).initialEquipment, ...eq } as never;
    const r = runTable(project, { n, potions: false, only: (t) => {
      const i = steps1.indexOf(t);
      if (i < 0) return phase === "after"; // 2막
      return phase === "after" ? i >= cut : i < cut;
    } });
    rows.push(...r.filter((x) => x.kind !== "boss" && x.kind !== "duel"));
  }
  for (const id of PARTY) actor(id).initialEquipment = { ...base[id] } as never;
  all[profile] = rows;
}
const key = (r: Row) => `${r.act}|${r.troop}@${r.map}`;
const order = all[profiles[0]!]!.map(key);
console.log(["막", "무리", "맵", "종류", "Lv", ...profiles].join("\t"));
for (const k of order) {
  const rs = profiles.map((p) => all[p]!.find((r) => key(r) === k));
  const r0 = rs[0]!;
  const v = rs.map((r) => (r ? r.atkWin : NaN));
  const [lo, hi] = r0.kind === "elite" ? [50, 70] : [60, 90];
  const bad = v.slice(0, 2).some((x) => x < lo || x > hi) ? "  ←" : "";
  console.log([r0.act, r0.troop, r0.map, r0.kind, `Lv${r0.level}`, ...v.map((x) => `${x}%`)].join("\t") + bad);
}
if (args[2]) writeFileSync(args[2], JSON.stringify(all, null, 1));
