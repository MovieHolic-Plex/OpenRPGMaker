/**
 * 프로젝트 연출 레코드(database.skillChoreographies)를 조수 도구만으로 조립하는 헤드리스 시퀀스.
 * ① 도약 내려찍기 + 번개 임팩트 층  ② 3타 스킬 + 타마다 임팩트(onHit:each)  ③ 기본 연출 복제 + 층 하나 2배·지연
 * 산출 JSON 은 retro2003-skills-gif.mjs --set custom --custom <파일> 이 재생한다.
 * expect 는 같은 레코드를 순수 타임라인(retroClassSkillTimeline)에 통과시킨 층 시작 시각·수·소리 — 녹화 결과와 대조한다.
 *
 *   npx vite-node scripts/qa/runtime/retro-choreo-a1-build.mts [출력.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import { resolveRetroClassChoreography, retroClassSkill } from "@/assets/retroSkillCatalog";
import { retroClassSkillTimeline } from "@/battle/retroSkillTimeline";
import { serialize, deserialize } from "@/project/io/serialize";
import { defaultBattleAnimationRecords, defaultSkillRecords, defaultStateRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { defaultClassRecords } from "@/project/defaults/defaultDatabaseClassRecords";
import { defaultPartyRecords } from "@/project/defaults/defaultDatabasePartyRecords";

const outPath = resolve(process.argv[2] ?? "verify-shots/retro-choreo-a1/spec.json");
const fixture = JSON.parse(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
const project = fixture.project ?? fixture;
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
  return r;
}
const chors = () => ctx.project.database.skillChoreographies as Array<any>;
const ENEMY_COUNT = 3; // 기본 전투 편성의 적 수(녹화 팝업 3개로 확인)
const mp = (flat: number) => ({ flat, percentMax: 0 });
const damage = { kind: "damage", statistic: "attack", affects: "hp" };

// 시트 조회(조수가 하는 순서): 번개·임팩트 시트가 실제로 색인에 있는지 본다.
for (const query of ["번개", "chain", "missile", "moon"]) log.push(`     list_fx_sheets("${query}") -> ${(call("list_fx_sheets", { query, limit: 6 }).data.items as Array<{ key: string }>).map((i) => i.key).join(", ")}`);

// ① 도약 내려찍기 + 번개 임팩트 층 (섞기: 영웅 낙하참의 궤적·충격 + 마법사 번개 시트)
const meteor = retroClassSkill("skill_hero_meteor_drop")!;
const leap = call("upsert_choreography", {
  name: "도약 뇌격", description: "뛰어올라 내려찍고, 착지점에 번개가 내리꽂힌다", motion: "leap-strike",
  layers: [...meteor.layers.map((l) => ({ sheet: l.key, anchor: l.anchor })), { sheet: "mage_chain_bolt", anchor: "target" }],
  tags: { family: "시험", element: "lightning" },
}).data as { id: string };

// ② 3타 스킬 + 타마다 임팩트 (flurry 동작, 쌍월참 초승달 + 타마다 미사일 임팩트)
const moon = retroClassSkill("skill_samurai_twin_moon")!;
const triple = call("upsert_choreography", {
  name: "삼연 난타", description: "세 번 벨 때마다 임팩트가 다시 터진다", motion: "flurry",
  layers: [...moon.layers.map((l) => ({ sheet: l.key, anchor: l.anchor })), { sheet: "mage_missile_hit", anchor: "target", onHit: "each" }],
}).data as { id: string };

// ③ 기본 연출 복제 → 층 하나만 2배·200ms 지연
const dup = call("duplicate_choreography", { sourceId: "skill_hero_flame_sword", name: "큰 불꽃 베기" }).data as { id: string; layers: Array<any> };
const flameLayers = structuredClone(chors().find((r) => r.id === dup.id).layers) as Array<any>;
const slashIndex = flameLayers.findIndex((l) => l.sheet === "hero_flame_slash");
flameLayers[slashIndex] = { ...flameLayers[slashIndex], scale: 2, startMs: 200 };
call("upsert_choreography", { id: dup.id, layers: flameLayers });

// ④ 전체 대상 스킬 + 타마다 임팩트(onHit each): 같은 행동의 대상 묶음(그룹) 수만큼 착탄 층이 다시 깔린다.
const sweep = call("upsert_choreography", {
  name: "전체 뇌우", description: "전원을 한 번에 치고, 대상 하나 착탄마다 임팩트가 다시 터진다", motion: "cast",
  layers: [{ sheet: "mage_chain_bolt", anchor: "target" }, { sheet: "mage_missile_hit", anchor: "target", onHit: "each", startMs: 300 }],
}).data as { id: string };

// 스킬 3개 + 시험 직업·배우. 세 스킬 모두 project chor_ 를 retroChoreographyId 로 붙인다.
const skills = [
  { id: "skill_chor_leap_bolt", name: "도약 뇌격", scope: "enemy", power: 110, mpCost: mp(10), effect: damage, hitRate: 95, variance: 15, successRate: 100, description: "연출 ① 도약 + 번개 층.", retroChoreographyId: leap.id },
  { id: "skill_chor_triple", name: "삼연 난타", scope: "enemy", power: 100, mpCost: mp(12), effect: damage, hitRate: 95, variance: 15, successRate: 100, hitSequence: [0.6, 0.6, 0.9], description: "연출 ② 3타, 타마다 임팩트.", retroChoreographyId: triple.id },
  { id: "skill_chor_big_flame", name: "큰 불꽃 베기", scope: "enemy", power: 95, mpCost: mp(8), effect: damage, elementId: "fire", hitRate: 95, variance: 15, successRate: 100, description: "연출 ③ 복제 + 2배·지연.", retroChoreographyId: dup.id },
  { id: "skill_chor_sweep", name: "전체 뇌우", scope: "allEnemies", power: 80, mpCost: mp(14), effect: damage, hitRate: 95, variance: 15, successRate: 100, description: "연출 ④ 전체 대상 + 착탄마다 임팩트.", retroChoreographyId: sweep.id },
];
for (const skill of skills) call("upsert_skill", { skill });
const learned = skills.map((s, i) => ({ level: 1 + i * 2, skillId: s.id }));
const samurai = ctx.project.database.classes.find((row: { id: string }) => row.id === "class_samurai");
call("upsert_class", { class: { ...structuredClone(samurai), id: "class_choreo_tester", name: "연출 시험관", learnedSkills: learned, skillIds: [] } });
const samuraiActor = ctx.project.database.actors.find((row: { id: string }) => row.id === "actor_samurai");
call("upsert_actor", { actor: { ...structuredClone(samuraiActor), id: "actor_choreo_tester", name: "시험관", classId: "class_choreo_tester", initialLevel: 8 } });

// 저장 왕복: serialize → deserialize 뒤에도 레코드와 스킬 연결이 그대로여야 한다.
const roundTrip = deserialize(serialize(ctx.project as never)) as any;
const same = JSON.stringify(roundTrip.database.skillChoreographies) === JSON.stringify(chors());
log.push(`${same ? "OK  " : "FAIL"} serialize→deserialize skillChoreographies ${chors().length}개 ${same ? "동일" : "달라짐"}`);
if (!same) throw new Error("저장 왕복에서 skillChoreographies 가 달라졌다");

// 기대값: 각 스킬을 순수 타임라인에 통과시킨 fx 시작 시각·사운드 수.
const db = ctx.project.database;
const contract: Array<Record<string, unknown>> = [];
for (const skill of skills) {
  const resolved = resolveRetroClassChoreography(skill, db.skillChoreographies)!;
  // 실제 전투는 단일 대상 다단(hitSequence N)을 "행동 N번 = 계획 N개(각 hits 1)"로, 전체 대상은 "대상 수만큼 한 계획(hits = 대상 수)"로 재생한다.
  const sequences = Math.max(1, ((db.skills.find((s: any) => s.id === skill.id) as any).hitSequence ?? [1]).length);
  const cycles = skill.scope === "allEnemies" ? 1 : sequences;
  const hits = skill.scope === "allEnemies" ? ENEMY_COUNT : 1;
  const timeline = retroClassSkillTimeline(resolved, { side: "enemies", hits });
  const fx = timeline.events.filter((e: any) => e.kind === "fx" || e.kind === "projectile").map((e: any) => ({ key: e.key, at: e.at, kind: e.kind, anchor: e.anchor ?? "projectile", scale: e.scale ?? 1 }));
  const scales: Record<string, number> = {};
  for (const e of fx) if (e.scale !== 1) scales[e.key] = e.scale;
  contract.push({
    id: skill.id, actorId: "actor_choreo_tester", motion: resolved.motion, layers: resolved.layers.map((l) => l.key), scales,
    label: skill.description, choreographyId: skill.retroChoreographyId, hits, cycles,
    expect: { fx, sounds: cycles * timeline.events.filter((e: any) => e.kind === "sound").length, layerCount: resolved.layers.length },
  });
}
const pick = (rows: Array<{ id: string }>, ids: string[]) => rows.filter((row) => ids.includes(row.id));
const spec = {
  builtWith: "runTool: list_fx_sheets, upsert_choreography x3, duplicate_choreography, upsert_skill x3, upsert_class, upsert_actor",
  log, contract,
  choreographies: structuredClone(chors()),
  skills: pick(db.skills, skills.map((s) => s.id)),
  states: [], classes: pick(db.classes, ["class_choreo_tester"]), actors: pick(db.actors, ["actor_choreo_tester"]), equipment: [],
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(spec, null, 1));
console.log(log.join("\n"));
console.log(`\n-> ${outPath}: 연출 ${spec.choreographies.length}, 스킬 ${spec.skills.length}`);
