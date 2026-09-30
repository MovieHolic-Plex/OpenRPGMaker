/** 자동 추천 결과 표(증거 e). 사용: npx vite-node scripts/qa/runtime/retro-choreo-b-recommend-table.mts */
import { writeFileSync } from "node:fs";
import { recommendRetroChoreography } from "../../../src/assets/retroChoreographyRecommend";

const dmg = (statistic: "attack" | "mind", affects = "enemy") => ({ kind: "damage", statistic, affects }) as never;
const cases: [string, Record<string, unknown>][] = [
  ["화염 3연타 (불+hitSequence 3)", { id: "t_fire3", name: "화염 연타", scope: "enemy", effect: dmg("mind"), elementId: "fire", hitSequence: [40, 30, 30] }],
  ["전체 회복 (heal+allAllies)", { id: "t_massheal", name: "생명의 비", scope: "allAllies", effect: { kind: "healing" } }],
  ["단일 회복", { id: "t_heal", name: "치유의 손길", scope: "ally", effect: { kind: "healing" } }],
  ["버프 (자신)", { id: "t_buff", name: "기합", scope: "self", effect: { kind: "support" }, stateEffects: [{ stateId: "state_attack", chance: 1, operation: "add" }] }],
  ["수면 부여 (전체 적)", { id: "t_sleep", name: "꿈결", scope: "allEnemies", effect: { kind: "support" }, stateEffects: [{ stateId: "state_sleep", chance: 1, operation: "add" }] }],
  ["번개 전체 마법", { id: "t_thunder_all", name: "뇌진", scope: "allEnemies", effect: dmg("mind"), elementId: "thunder" }],
  ["얼음 단일 마법", { id: "t_ice", name: "서리 창", scope: "enemy", effect: dmg("mind"), elementId: "ice" }],
  ["물리 전체 (베기)", { id: "t_sweep", name: "휩쓸기", scope: "allEnemies", effect: dmg("attack") }],
  ["물리 5연타", { id: "t_fist", name: "난타", scope: "enemy", effect: dmg("attack"), hitSequence: [20, 20, 20, 20, 20] }],
  ["독 단일 물리", { id: "t_poison", name: "독칼", scope: "enemy", effect: dmg("attack"), elementId: "poison" }],
  ["훔치기", { id: "t_steal", name: "슬쩍", scope: "enemy", effect: { kind: "steal" } }],
];
const rows = cases.map(([title, skill]) => {
  const r = recommendRetroChoreography(skill as never);
  return { title, id: skill.id, baseId: r?.baseId, label: r?.label, tint: r?.tint, each: r?.each, reason: r?.reason, layers: r?.skill.layers.map((l) => `${l.key}@${l.anchor}${l.tint ? `/${l.tint}` : ""}${l.onHit ? `/${l.onHit}` : ""}`) };
});
writeFileSync("verify-shots/retro-choreo-b/e-recommend-table.json", JSON.stringify(rows, null, 2));
for (const r of rows) console.log(`${r.title} => ${r.label} [${r.baseId}] tint=${r.tint ?? "-"} each=${r.each} | ${r.reason}`);
