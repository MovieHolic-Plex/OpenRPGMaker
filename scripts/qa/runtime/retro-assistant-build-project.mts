/**
 * 조수 도구만으로 새 직업 「화염 검투사」와 스킬 8개를 만드는 헤드리스 시퀀스.
 * 실제 모델 없이 도구 레지스트리를 직접 부른다(list_retro_choreographies → upsert_state/skill/class/actor).
 * 결과 행과 녹화 계약을 JSON 으로 쓰면 retro2003-skills-gif.mjs --set custom --custom <파일> 이 그 스킬을 재생한다.
 *
 *   npx vite-node scripts/qa/runtime/retro-assistant-build-project.mts [출력.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import { retroClassSkill } from "@/assets/retroSkillCatalog";
import { defaultBattleAnimationRecords, defaultSkillRecords, defaultStateRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { defaultClassRecords } from "@/project/defaults/defaultDatabaseClassRecords";
import { defaultPartyRecords } from "@/project/defaults/defaultDatabasePartyRecords";

const outPath = resolve(process.argv[2] ?? ".omo/retro-assistant/custom-project.json");
const fixture = JSON.parse(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
const project = fixture.project ?? fixture;
// 기본 DB(상태·스킬·직업·배우)를 데모에 합친다 — 앱에서 새 프로젝트가 처음부터 갖는 상태.
const party = defaultPartyRecords();
const mergeById = <T extends { id: string }>(base: T[], extra: readonly T[]) => [...base.filter((row) => !extra.some((e) => e.id === row.id)), ...structuredClone(extra as T[])];
project.database.battleAnimations = mergeById(project.database.battleAnimations ?? [], defaultBattleAnimationRecords());
project.database.states = mergeById(project.database.states ?? [], defaultStateRecords());
project.database.skills = mergeById(project.database.skills ?? [], defaultSkillRecords());
project.database.classes = mergeById(project.database.classes ?? [], defaultClassRecords());
project.database.actors = mergeById(project.database.actors ?? [], party.actors);
project.database.equipment = mergeById(project.database.equipment ?? [], party.equipment);

const ctx = { project };
const log: string[] = [];
function call(name: string, args: Record<string, unknown>) {
  const r: any = runTool(ctx, name, args);
  log.push(`${r.ok ? "OK  " : "FAIL"} ${name} ${r.summary}`);
  if (!r.ok) throw new Error(`${name} 실패: ${r.summary}\n${JSON.stringify(r.issues ?? [], null, 1)}`);
  if (r.issues?.length) for (const i of r.issues.filter((x: { message: string }) => /ember|flame_gladiator/.test(x.message))) log.push(`     ${i.severity} ${i.code}: ${i.message}`);
  return r;
}

// 1) 조수가 하는 순서: 먼저 빌릴 연출을 찾는다. 후보에 실제로 들어 있는지 확인한다.
const lookups: Array<[string, Record<string, unknown>]> = [
  ["dash-strike/fire", { motion: "dash-strike", element: "fire", limit: 12 }],
  ["flurry", { motion: "flurry", limit: 12 }],
  ["buff", { motion: "buff", limit: 20 }],
  ["finisher", { motion: "finisher", limit: 30 }],
  ["fire/allTargets", { element: "fire", anchor: "allTargets", limit: 12 }],
  ["dark/cast", { motion: "cast", element: "dark", limit: 12 }],
];
const candidates = new Map<string, Set<string>>();
for (const [label, args] of lookups) {
  const r = call("list_retro_choreographies", args);
  candidates.set(label, new Set((r.data.items as Array<{ id: string }>).map((item) => item.id)));
}

// 2) 새 상태: 불씨 표식(불 약점). 기존 기름/젖음 상태와 같은 방식.
call("upsert_state", { state: { id: "state_ember_mark", name: "불씨 표식", restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: 3, recoverNaturallyChance: 35, runtimeEffects: { elementRates: { fire: "A" }, removeOnBattleEnd: true } } });

// 3) 스킬 8개. 모두 retroChoreographyId 로 기존 연출을 빌린다. mp/공식/대가/흡수/상태/범위/다단을 섞는다.
type Spec = { key: string; label: string; borrow: string; skill: Record<string, unknown> };
const mp = (flat: number) => ({ flat, percentMax: 0 });
const damage = (statistic: "attack" | "mind") => ({ kind: "damage", statistic, affects: "hp" });
const specs: Spec[] = [
  { key: "dash-strike/fire", label: "단일 불꽃 + 약점 연쇄 상태", borrow: "skill_hero_flame_sword", skill: {
    id: "skill_ember_slash", name: "불꽃 베기", scope: "enemy", power: 95, mpCost: mp(8), effect: damage("attack"), elementId: "fire", hitRate: 95, variance: 15, successRate: 100,
    description: "불꽃 궤적으로 베고, 상대를 기름에 젖거나 불씨 표식이 남게 한다.",
    stateEffects: [{ stateId: "state_oiled", chance: 40, operation: "add" }, { stateId: "state_ember_mark", chance: 60, operation: "add" }] } },
  { key: "flurry", label: "3연타 (hitSequence)", borrow: "skill_samurai_twin_moon", skill: {
    id: "skill_ember_triple", name: "화염 삼연격", scope: "enemy", power: 100, mpCost: mp(12), effect: damage("attack"), elementId: "fire", hitRate: 95, variance: 15, successRate: 100,
    hitSequence: [0.6, 0.6, 0.9], description: "불붙은 검을 세 번 휘두른다. 뒤로 갈수록 강하다." } },
  { key: "buff", label: "HP 대가 + 자가 강화 (hpCostPercent)", borrow: "skill_hero_war_cry", skill: {
    id: "skill_ember_oath", name: "불사의 서약", scope: "self", power: 0, mpCost: mp(0), effect: { kind: "support" }, hitRate: 100, variance: 0, successRate: 100,
    hpCostPercent: 20, description: "최대 HP의 20%를 바쳐 공격과 방어를 함께 끌어올린다.",
    stateEffects: [{ stateId: "state_attack_up", chance: 100, operation: "add" }, { stateId: "state_protect", chance: 100, operation: "add" }] } },
  { key: "dark/cast", label: "흡수 (drainPercent)", borrow: "skill_dark_knight_gravity", skill: {
    id: "skill_ember_chalice", name: "피의 잔", scope: "enemy", power: 80, mpCost: mp(10), effect: damage("mind"), elementId: "dark", hitRate: 100, variance: 15, successRate: 100,
    drainPercent: 50, description: "준 피해의 절반을 되마신다." } },
  { key: "fire/allTargets", label: "전체 불 피해 + 상태", borrow: "skill_mage_meteor", skill: {
    id: "skill_ember_tide", name: "작열 파도", scope: "allEnemies", power: 70, mpCost: mp(20), effect: damage("mind"), elementId: "fire", hitRate: 100, variance: 15, successRate: 100,
    description: "뜨거운 파도가 적 전체를 훑는다.",
    stateEffects: [{ stateId: "state_ember_mark", chance: 50, operation: "add" }] } },
  { key: "buff", label: "방어 강화 (도발 연출)", borrow: "skill_guard_taunt", skill: {
    id: "skill_ember_roar", name: "도발의 함성", scope: "self", power: 0, mpCost: mp(6), effect: { kind: "support" }, hitRate: 100, variance: 0, successRate: 100,
    description: "큰 소리로 시선을 끌며 방어를 굳힌다.",
    stateEffects: [{ stateId: "state_defense_up", chance: 100, operation: "add" }] } },
  { key: "finisher", label: "필살 + 대가 + 상태 (버서크·스톱)", borrow: "skill_samurai_final_cut", skill: {
    id: "skill_ember_wrath", name: "분노의 일격", scope: "enemy", power: 180, mpCost: mp(24), effect: damage("attack"), elementId: "fire", hitRate: 95, variance: 15, successRate: 100,
    criticalRate: 30, hpCostPercent: 10, description: "체력을 깎아 내리치는 일격. 상대가 광분하거나 굳는다.",
    stateEffects: [{ stateId: "state_berserk", chance: 50, operation: "add" }, { stateId: "state_stop", chance: 30, operation: "add" }] } },
  { key: "finisher", label: "필살 + 범위 (area)", borrow: "skill_red_mage_catastrophe", skill: {
    id: "skill_ember_fall", name: "폭염 낙하", scope: "enemy", power: 210, mpCost: mp(32), effect: damage("mind"), elementId: "fire", hitRate: 100, variance: 15, successRate: 100,
    area: { shape: "circle", radius: 1 }, movePriority: -1, cooldownTurns: 2, description: "하늘에서 불덩이를 떨어뜨려 주변까지 태운다." } },
];

const contract: Array<Record<string, unknown>> = [];
for (const spec of specs) {
  const pool = candidates.get(spec.key);
  if (!pool?.has(spec.borrow)) throw new Error(`${spec.borrow} 이 조회 결과(${spec.key})에 없다`);
  const skill = { ...spec.skill, retroChoreographyId: spec.borrow };
  call("upsert_skill", { skill });
}

// 잘못된 연출 id 는 후보와 함께 거부되어야 한다(거부 문구를 증거로 남긴다).
{
  const r: any = runTool(ctx, "upsert_skill", { skill: { id: "skill_ember_bad", name: "잘못", retroChoreographyId: "skill_no_such_thing" } });
  log.push(`${r.ok ? "FAIL(받아들임)" : "OK  (거부)"} upsert_skill(잘못된 id) ${r.summary} :: ${JSON.stringify(r.issues?.[0]?.message ?? "").slice(0, 200)}`);
  if (r.ok) throw new Error("잘못된 retroChoreographyId 가 받아들여졌다");
}

// 4) 직업 + 배우. 배우는 사무라이 자원을 빌린다.
const learned = [1, 3, 5, 7, 9, 11, 14, 18].map((level, index) => ({ level, skillId: specs[index].skill.id as string }));
const samurai = ctx.project.database.classes.find((row: { id: string }) => row.id === "class_samurai");
call("upsert_class", { class: { ...structuredClone(samurai), id: "class_flame_gladiator", name: "화염 검투사", learnedSkills: learned, skillIds: [] } });
const samuraiActor = ctx.project.database.actors.find((row: { id: string }) => row.id === "actor_samurai");
call("upsert_actor", { actor: { ...structuredClone(samuraiActor), id: "actor_flame_gladiator", name: "이그니스", classId: "class_flame_gladiator", initialLevel: 18 } });

// 5) 산출: 추가·변경된 행 + 녹화 계약(연출 id 에서 모션·층을 읽는다).
const db = ctx.project.database;
for (const spec of specs) {
  const borrowed = retroClassSkill(spec.borrow)!;
  contract.push({ id: spec.skill.id, actorId: "actor_flame_gladiator", motion: borrowed.motion, layers: borrowed.layers.map((layer: { key: string }) => layer.key), borrow: spec.borrow, label: spec.label });
}
const pick = (rows: Array<{ id: string }>, ids: string[]) => rows.filter((row) => ids.includes(row.id));
const spec = {
  builtWith: "runTool: list_retro_choreographies, upsert_state, upsert_skill x8, upsert_class, upsert_actor",
  log,
  contract,
  skills: pick(db.skills, specs.map((s) => s.skill.id as string)),
  states: pick(db.states, ["state_ember_mark"]),
  classes: pick(db.classes, ["class_flame_gladiator"]),
  actors: pick(db.actors, ["actor_flame_gladiator"]),
  equipment: [],
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(spec, null, 1));
console.log(log.join("\n"));
console.log(`\n-> ${outPath}: 스킬 ${spec.skills.length}, 계약 ${contract.length}`);
