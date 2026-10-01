/** 적 스킬 연출 레코드 + 독 자동 추천 프로브. 실행: node_modules/.bin/vite-node --script verify-shots/retro-chor-mon/probe.mts */
import { recommendRetroChoreography } from "../../src/assets/retroChoreographyRecommend";
import { retroTintFilter } from "../../src/assets/retroChoreographyTints";
import { resolveSkillChoreography, retroChoreographyKind, retroClassSkill } from "../../src/assets/retroSkillCatalog";
import { retroMonsterSkillTimeline } from "../../src/battle/retroSkillTimeline";
import { RETRO_MONSTER_SKILLS, retroMonsterSkill } from "../../src/assets/retroMonsterSkills";

const dmg = (statistic: "attack" | "mind") => ({ kind: "damage", statistic, affects: "enemy" }) as never;
const add = (stateId: string) => [{ stateId, chance: 100, operation: "add" }];
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) failures += 1; console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` | ${detail}` : ""}`); };

// ── (1) 적 스킬 + 프로젝트 레코드
console.log("== (1) 적 스킬 + 프로젝트 연출 레코드 ==");
const SHEET = RETRO_MONSTER_SKILLS.flatMap((m) => m.layers).find((l) => l.anchor === "target")!.key;
const records = [{ id: "chor_mon_claw", name: "할퀴기 연출", motion: "lunge", layers: [{ sheet: SHEET, anchor: "target", startMs: 0 }] }] as never;
const enemySkill = { id: "skill_my_enemy_claw", name: "사냥개의 일격", scope: "enemy", effect: dmg("attack"), retroChoreographyId: "chor_mon_claw" } as never;
for (const want of [undefined, "monster", "class"] as const) {
  const r = resolveSkillChoreography(enemySkill, records, want);
  console.log(`  want=${want ?? "-"} -> origin=${r?.origin} kind=${r?.kind} skillId=${r?.skill?.id} record=${r?.record?.id ?? "-"} motion=${(r?.skill as { motion?: string } | undefined)?.motion}`);
}
const asMonster = resolveSkillChoreography(enemySkill, records, "monster");
check("적 스킬 + 레코드 → 레코드로 해석(monster)", asMonster?.origin === "project" && asMonster.kind === "monster" && asMonster.record?.id === "chor_mon_claw");
const noRecord = resolveSkillChoreography(enemySkill, [] as never, "monster");
check("레코드 없으면 해석 안 됨(undefined)", noRecord === undefined);

// ── (2) 기존 몬스터 계약 스킬 불변
console.log("== (2) 기존 몬스터 계약(skill_mon_*) 레코드·id 없을 때 ==");
const monId = "skill_mon_acid_spit";
const monSkill = { id: monId, name: "산성 침", scope: "enemy", effect: dmg("mind") } as never;
const a = resolveSkillChoreography(monSkill, records, "monster");
const b = resolveSkillChoreography(monSkill, undefined, "monster");
const c = resolveSkillChoreography(monSkill, [] as never);
const contract = retroMonsterSkill(monId);
check("몬스터 계약 id 는 레코드가 있어도 계약 그대로", a?.origin === "default" && a.skill === contract && b?.skill === contract && c?.skill === contract);
const tl = (s: typeof contract) => JSON.stringify(s ? retroMonsterSkillTimeline(s as never, { hits: 1 }) : null);
let timelineOk = true; try { timelineOk = tl(a?.skill as never) === tl(contract); } catch (e) { console.log("  (timeline 비교 생략:", (e as Error).message, ")"); }
check("타임라인 직렬화 동일", timelineOk);
check("class 요청은 계약 종류 불일치로 거절", resolveSkillChoreography(monSkill, records, "class") === undefined, `kind=${retroChoreographyKind(monId)}`);
void retroClassSkill;

// ── (3) 독 자동 추천
console.log("== (3) 독 자동 추천 ==");
const poison: [string, Record<string, unknown>][] = [
  ["물리 단일 독칼(name)", { id: "p1", name: "독칼", scope: "enemy", effect: dmg("attack") }],
  ["물리 단일 독 베기(name)", { id: "p2", name: "독 베기", scope: "enemy", effect: dmg("attack") }],
  ["물리 단일 +state_poison", { id: "p3", name: "찌르기", scope: "enemy", effect: dmg("attack"), stateEffects: add("state_poison") }],
  ["물리 단일 +state_deep_poison", { id: "p4", name: "찌르기", scope: "enemy", effect: dmg("attack"), stateEffects: add("state_deep_poison") }],
  ["물리 단일 +커스텀 독 상태", { id: "p5", name: "찌르기", scope: "enemy", effect: dmg("attack"), stateEffects: add("state_my_toxin_poison") }],
  ["물리 단일 elementId=poison", { id: "p6", name: "찌르기", scope: "enemy", effect: dmg("attack"), elementId: "poison" }],
  ["물리 단일 elementId=elem_poison", { id: "p6b", name: "찌르기", scope: "enemy", effect: dmg("attack"), elementId: "elem_poison" }],
  ["물리 3연타 +state_poison", { id: "p7", name: "연속 찌르기", scope: "enemy", effect: dmg("attack"), hitSequence: [30, 30, 40], stateEffects: add("state_poison") }],
  ["물리 전체 +state_poison", { id: "p8", name: "휩쓸기", scope: "allEnemies", effect: dmg("attack"), stateEffects: add("state_poison") }],
  ["마법 단일 독 볼트(name)", { id: "p9", name: "독 볼트", scope: "enemy", effect: dmg("mind") }],
  ["마법 단일 +state_poison", { id: "p10", name: "탄", scope: "enemy", effect: dmg("mind"), stateEffects: add("state_poison") }],
  ["마법 전체 +state_deep_poison", { id: "p11", name: "안개", scope: "allEnemies", effect: dmg("mind"), stateEffects: add("state_deep_poison") }],
  ["마법 전체 독안개(name)", { id: "p12", name: "독안개", scope: "allEnemies", effect: dmg("mind") }],
  ["약화 support +state_poison", { id: "p13", name: "부식 가루", scope: "enemy", effect: { kind: "support" }, stateEffects: add("state_poison") }],
  ["약화 support 전체 +state_deep_poison", { id: "p14", name: "포자", scope: "allEnemies", effect: { kind: "support" }, stateEffects: add("state_deep_poison") }],
  ["(음성) 독 해제 remove", { id: "n1", name: "해독", scope: "ally", effect: { kind: "healing" }, stateEffects: [{ stateId: "state_poison", chance: 100, operation: "remove" }] }],
  ["(음성) 일반 베기", { id: "n2", name: "베기", scope: "enemy", effect: dmg("attack") }],
  ["(음성) 불 속성 + 독 상태", { id: "n3", name: "화염", scope: "enemy", effect: dmg("mind"), elementId: "fire", stateEffects: add("state_poison") }],
];
const greenFilter = retroTintFilter("poison");
for (const [title, skill] of poison) {
  const r = recommendRetroChoreography(skill as never);
  const tinted = r?.skill.layers.filter((l) => l.tint).map((l) => `${l.key}@${l.anchor}/${l.tint}`) ?? [];
  const native = r?.baseId === "skill_scout_venom_blade";
  const green = Boolean(r?.tint === "poison" || native);
  console.log(`  ${title.padEnd(36)} => [${r?.baseId}] tint=${r?.tint ?? "-"} green=${green ? "Y" : "N"} layers=${tinted.join(",") || "-"}`);
  if (title.startsWith("(음성)")) check(`${title} 초록 아님`, !green);
  else check(`${title} 초록`, green);
}
console.log(`  poison filter = ${greenFilter ?? "(없음)"}`);
console.log(failures ? `\nFAILURES: ${failures}` : "\nALL PASS");
process.exitCode = failures ? 1 : 0;
