import { createBlankProject } from "../src/project/defaults/defaultProject";
import { collectProjectReferenceIssues } from "../src/project/io/references";
import { activeItemEffects, itemAllowsMenu, itemAllowsBattle } from "../src/project/itemUsage";
import type { ItemRecord } from "../src/project/types";

const project = createBlankProject();
const items = project.database.items;
const skills = new Set(project.database.skills.map((s) => s.id));
const states = new Set(project.database.states.map((s) => s.id));
const anims = new Set(project.database.battleAnimations.map((a) => a.id));
const switchIds = new Set(project.switches.map((s) => s.id));
const declaredSwitchNames = new Map(project.switches.map((s) => [s.id, s.name]));

console.log(`items=${items.length} skills=${skills.size} states=${states.size} anims=${anims.size} declaredSwitches=${switchIds.size}`);

// 1) shared reference validator
const refIssues = collectProjectReferenceIssues(project).filter((issue) => /\bitem\b/.test(issue));
console.log(`\n== collectProjectReferenceIssues (item) == ${refIssues.length}`);
for (const i of refIssues) console.log("  " + i);

// 2) per-item coherence after the runtime projection
type Finding = { id: string; name: string; problem: string };
const findings: Finding[] = [];
const say = (item: ItemRecord, problem: string) => findings.push({ id: item.id, name: item.name, problem });

const SEED_KEYS = ["attack", "defense", "mind", "agility"] as const;
const hasSeedBonus = (it: ItemRecord) => SEED_KEYS.some((k) => it.seedParameterBonuses[k] !== 0);
const hasRecovery = (it: ItemRecord) =>
  it.hpRecovery.flat > 0 || it.hpRecovery.percentMax > 0 || it.mpRecovery.flat > 0 || it.mpRecovery.percentMax > 0;

for (const item of items) {
  const active = activeItemEffects(item);

  // references the shared validator does not check
  if (item.switchId && !switchIds.has(item.switchId))
    say(item, `switchId ${item.switchId} 미선언 (project.switches 에 없음)`);
  for (const s of item.stateEffects) if (!states.has(s.stateId)) say(item, `stateEffects.stateId ${s.stateId} 없음`);
  for (const sid of item.healStateIds) if (!states.has(sid)) say(item, `healStateIds ${sid} 없음`);
  for (const key of ["skillId", "learnedSkillId", "activateSkillId"] as const) {
    const v = item[key];
    if (v && !skills.has(v)) say(item, `${key} ${v} 없음`);
  }
  if (item.animationId && !anims.has(item.animationId)) say(item, `animationId ${item.animationId} 없음`);

  // executable effect after type projection
  const executable =
    hasRecovery(active) ||
    active.healStateIds.length > 0 ||
    active.stateEffects.length > 0 ||
    Boolean(active.learnedSkillId) ||
    Boolean(active.activateSkillId) ||
    Boolean(active.switchId) ||
    Boolean(active.careProfile) ||
    Boolean(active.captureProfile) ||
    hasSeedBonus(active) ||
    Boolean(item.farmTool);
  const usable = itemAllowsMenu(active) || itemAllowsBattle(active);
  if (!executable && item.type !== "normalGoods" && item.type !== "weapon" && item.type !== "shield" && item.type !== "body" && item.type !== "head" && item.type !== "accessory")
    say(item, `${item.type} 인데 실행 가능 효과가 전부 비어 있음 (activeItemEffects 후)`);
  if (item.consumable && !usable && item.occasion !== "never")
    say(item, `소비품인데 메뉴/전투 둘 다 사용 불가 (occasion=${item.occasion}, type=${item.type})`);
  if (item.occasion === "never" && item.consumable && item.type !== "seed")
    say(item, `occasion=never + consumable — 어디서도 못 쓰는데 소비품 표시`);

  // stored-but-stripped effects (authoring trap)
  if (item.stateEffects.length > 0 && active.stateEffects.length === 0)
    say(item, `stateEffects ${item.stateEffects.length}건이 유형 규칙에 의해 실행에서 제거됨`);
  if ((item.hpRecovery.flat > 0 || item.hpRecovery.percentMax > 0 || item.mpRecovery.flat > 0 || item.mpRecovery.percentMax > 0) && !hasRecovery(active))
    say(item, `저장된 회복량이 유형(${item.type}) 때문에 실행에서 제거됨`);
  if (item.healStateIds.length > 0 && active.healStateIds.length === 0)
    say(item, `healStateIds 가 유형(${item.type}) 때문에 실행에서 제거됨`);
  if (item.learnedSkillId && !active.learnedSkillId)
    say(item, `learnedSkillId ${item.learnedSkillId} 가 유형(${item.type}) 때문에 무시됨`);
  if (item.switchId && !active.switchId) say(item, `switchId ${item.switchId} 가 유형(${item.type}) 때문에 무시됨`);
  if (hasSeedBonus(item) && !hasSeedBonus(active))
    say(item, `seedParameterBonuses 가 유형(${item.type}) 때문에 무시됨`);

  // specific semantic checks
  if (item.type === "book" && !active.learnedSkillId) say(item, `book 인데 배울 스킬이 없음`);
  if (item.type === "switch" && !item.switchId) say(item, `switch 인데 switchId 없음`);
  if (item.switchId && switchIds.has(item.switchId) && !declaredSwitchNames.get(item.switchId))
    say(item, `switchId ${item.switchId} 는 선언됐으나 이름이 비어 있음`);
  if (item.onlyEffectiveOnDeadActors && !hasRecovery(active))
    say(item, `부활 전용인데 회복량 0 — 되살려도 HP 0 그대로`);
  if (item.captureProfile && !item.captureProfile.ballClass)
    say(item, `captureProfile 에 ballClass 없음`);
  // menu-allowed but scope none → targets list is empty → "효과가 없습니다"
  const menuAllowed = itemAllowsMenu(active);
  const needsTarget =
    hasRecovery(active) || active.healStateIds.length > 0 || active.stateEffects.length > 0;
  if (menuAllowed && active.scope === "none" && needsTarget && !hasSeedBonus(active))
    say(item, `메뉴 사용 가능 + 대상 효과인데 scope=none — 사용하면 항상 "효과가 없습니다"`);
  if (item.skillId && !active.skillId)
    say(item, `skillId ${item.skillId} 가 유형(${item.type}) 규칙으로 실행 경로에서 제거됨 (저장만 유지)`);

  if (item.usableActorIds.length > 0 || item.usableClassIds.length > 0) {
    const actorIds = new Set(project.database.actors.map((a) => a.id));
    const classIds = new Set(project.database.classes.map((c) => c.id));
    for (const id of item.usableActorIds) if (!actorIds.has(id)) say(item, `usableActorIds ${id} 없음`);
    for (const id of item.usableClassIds) if (!classIds.has(id)) say(item, `usableClassIds ${id} 없음`);
  }
}

console.log(`\n== coherence findings == ${findings.length}`);
for (const f of findings) console.log(`  ${f.id} (${f.name}): ${f.problem}`);

// 3) catalog coverage
console.log(`\n== type coverage ==`);
const byType = new Map<string, number>();
for (const it of items) byType.set(it.type, (byType.get(it.type) ?? 0) + 1);
for (const [t, n] of [...byType].sort()) console.log(`  ${t}: ${n}`);

const ballClasses = items.filter((i) => i.captureProfile).map((i) => `${i.id}:${i.captureProfile!.ballClass ?? "legacy"}×${i.captureProfile!.multiplier}`);
console.log(`\ncapture items: ${ballClasses.join(", ")}`);

const careKinds = items.filter((i) => i.careProfile).map((i) => `${i.id}:${i.careProfile!.kind}`);
console.log(`care items: ${careKinds.join(", ")}`);

const farmTools = items.filter((i) => i.farmTool).map((i) => `${i.id}:${i.farmTool}`);
console.log(`farmTools: ${farmTools.join(", ")}`);

// states that exist but no item can heal/inflict
const referencedStates = new Set<string>();
for (const it of items) {
  for (const s of it.stateEffects) referencedStates.add(s.stateId);
  for (const s of it.healStateIds) referencedStates.add(s.stateId);
}
console.log(`\n== states never touched by any item ==`);
for (const s of project.database.states) if (!referencedStates.has(s.id)) console.log(`  ${s.id} (${s.name})`);

// skills referenced by items but missing per-skill sanity (element/scope)
console.log(`\n== item-linked skills check ==`);
for (const it of items) {
  for (const sid of [it.skillId, it.learnedSkillId, it.activateSkillId]) {
    if (!sid) continue;
    const sk = project.database.skills.find((s) => s.id === sid);
    if (!sk) continue;
    if (it.type === "special" && it.scope === "enemy" && sk.scope !== "enemy" && sk.scope !== "allEnemies")
      console.log(`  ${it.id}: 적 대상 아이템이 아군 스킬 ${sid}(scope=${sk.scope})을 가리킴`);
    if (it.type === "special" && (it.scope === "ally" || it.scope === "allAllies") && (sk.scope === "enemy" || sk.scope === "allEnemies"))
      console.log(`  ${it.id}: 아군 대상 아이템이 적 스킬 ${sid}(scope=${sk.scope})을 가리킴`);
  }
}
