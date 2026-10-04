import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { normalizeElementRecords } from "@/project/databaseUtilityRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { startSession } from "@/project/session";
import { useItemFromMenu, previewMenuItemTarget } from "@/player/playerItemUse";
import { createBattleRuntime } from "@/battle/runtime";
import { activeItemEffects, itemAllowsBattle, itemAllowsMenu } from "@/project/itemUsage";
import { agilityMultiplierForStates } from "@/battle/battleStates";
import type { ItemRecord, SkillRecord, ProjectDatabaseRecords } from "@/project/types";

const root = new URL("./", import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, root));
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const prototypePath = process.argv[2] ?? "/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json";
const skillsSourcePath = process.argv[3] ?? "/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content-jf-skills/content-packs/joseon-folklore/skills/data.json";
const prototypeBytes = readFileSync(prototypePath);
const skillsSourceBytes = readFileSync(skillsSourcePath);
const prototype = JSON.parse(prototypeBytes.toString()) as ProjectDatabaseRecords;
const skillsSource = JSON.parse(skillsSourceBytes.toString());
const input = JSON.parse(read("data.json").toString());
const design = JSON.parse(read("design.json").toString());
const ids = JSON.parse(read("../ids.json").toString());
const manifest = JSON.parse(read("art-manifest.json").toString());
const items: ItemRecord[] = input.items.map(normalizeItemRecord);
const skills: SkillRecord[] = input.skills.map(normalizeSkillRecord);
const checks: unknown[] = [];
assert.equal(items.length, 32); assert.equal(skills.length, 4);
assert.equal(manifest.icons.length, 32); assert.equal(design.entries.length, 32);
assert.equal(new Set(items.map(item => item.id)).size, 32);
assert.equal(new Set(manifest.icons.map((icon: { sha256: string }) => icon.sha256)).size, 32);
assert.deepEqual(new Set(items.map(item => item.id)), new Set([...Object.values(ids.items), ...Object.values(ids.materials)]));
const externalSkillIds = new Set([
  ...Object.values(ids.classSkills).flat(), ...Object.values(ids.enemySkills),
  ...prototype.skills.map(skill => skill.id), ...skillsSource.skills.map((skill: { id: string }) => skill.id),
]);
const elements = normalizeElementRecords(skillsSource.elements);
for (const skill of skills) {
  assert(skill.id.startsWith("skill_jf_item_")); assert(!externalSkillIds.has(skill.id), `collision: ${skill.id}`);
  assert.deepEqual(skill.mpCost, { flat: 0, percentMax: 0 });
  assert.equal(skill.variance, 0); assert.equal(skill.criticalRate, 0); assert.equal(skill.hitRate, 100);
  if (skill.elementId) assert(elements.some(element => element.id === skill.elementId));
  for (const effect of skill.stateEffects ?? []) assert(prototype.states.some(state => state.id === effect.stateId));
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeSkillRecord(JSON.parse(JSON.stringify(skill))))), JSON.parse(JSON.stringify(skill)));
  checks.push({ kind: "skill-normalize-reload-and-collision", id: skill.id, formula: skill.damageFormula, elementId: skill.elementId, stateEffects: skill.stateEffects });
}
for (const item of items) {
  const icon = manifest.icons.find((icon: { resourceId: string }) => icon.resourceId === item.iconResourceId);
  assert(icon); assert.equal(sha(read(icon.sourceFile)), icon.sha256);
  assert.equal(icon.path, `assets/joseon-folklore/consumables/${icon.slug}.png`);
  if (item.animationId) assert(prototype.battleAnimations.some(anim => anim.id === item.animationId));
  if (item.activateSkillId) assert(skills.some(skill => skill.id === item.activateSkillId));
  for (const stateId of item.healStateIds) assert(prototype.states.some(state => state.id === stateId));
  for (const effect of item.stateEffects) assert(prototype.states.some(state => state.id === effect.stateId));
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeItemRecord(JSON.parse(JSON.stringify(item))))), JSON.parse(JSON.stringify(item)));
  const d = design.entries.find((entry: { id: string }) => entry.id === item.id);
  assert(d); assert.equal(d.buyPrice, item.price); assert.equal(d.baseSellPrice, Math.floor(item.price / 2));
  assert.equal(d.usageDescription, item.description);
  assert.equal(d.actualEffect.hpFlat, item.hpRecovery.flat); assert.equal(d.actualEffect.hpPercentMax, item.hpRecovery.percentMax);
  assert.equal(d.actualEffect.mpFlat, item.mpRecovery.flat); assert.equal(d.actualEffect.mpPercentMax, item.mpRecovery.percentMax);
  assert.deepEqual(d.actualEffect.cures, item.healStateIds); assert.equal(d.actualEffect.occasion, item.occasion);
  assert.equal(d.acquisitionStatus, "proposed-not-installed");
  for (const acq of d.acquisition) if (acq.enemyId) assert(Object.values(ids.enemies).includes(acq.enemyId));
  checks.push({ kind: "item-normalize-reload-art-and-design", id: item.id, iconSha256: icon.sha256,
    price: item.price, hpRecovery: item.hpRecovery, mpRecovery: item.mpRecovery, healStateIds: item.healStateIds,
    menu: itemAllowsMenu(activeItemEffects(item)), battle: itemAllowsBattle(activeItemEffects(item)) });
}

// Independent expected configuration; execution uses actual engine menu and battle authorities.
// tuple: HP flat, MP flat, HP%, MP%, cured states.
const expected: Record<string, [number, number, number, number, string[]]> = {
  "mugwort-pill": [50,0,0,0,[]], "ginseng-tea": [0,16,0,0,[]],
  "purification-charm": [0,0,0,0,["state_poison"]], "revival-charm": [1,0,25,0,[]],
  "rice-ball": [35,0,0,0,[]], "rice-cake": [80,0,0,0,[]], "honey-cake": [35,8,0,0,[]],
  "herbal-decoction": [140,0,0,0,[]], "red-ginseng": [0,40,0,0,[]], "spring-water": [0,12,0,0,[]],
  "jade-water": [0,8,0,25,[]], "antidote": [15,0,0,0,["state_poison"]],
  "clear-mind-pill": [0,0,0,0,["state_sleep","state_silence"]],
  "warming-tea": [40,0,0,0,["state_paralysis"]], "cooling-tea": [0,12,0,0,["state_agility_down"]],
  "vitality-tonic": [50,8,25,20,[]],
};
const allAilments = ["state_poison", "state_deep_poison", "state_sleep", "state_silence", "state_paralysis", "state_agility_down"];
const itemFor = (slug: string) => {
  const item = items.find(item => item.id === (ids.items[slug] ?? ids.materials[slug]));
  assert(item, slug); return item;
};
assert.equal(itemFor("mugwort-pill").price, 16); assert.equal(itemFor("ginseng-tea").price, 32);
const project = createBlankProject();
project.database = { ...prototype, items, skills: [...prototype.skills, ...skills],
  elements: [...prototype.elements.filter(el => !elements.some(e => e.id === el.id)), ...elements] };
project.system.battleModel = "rm2k3";
const userId = "actor_scout", targetId = "actor_mage";
project.system.startActorIds = [userId, targetId];

function menu(slug: string, beforeHp: number, beforeMp: number, stateIds: string[], expectedHp: number, expectedMp: number,
  expectedStates: string[], expectedKind = "used", maxHp = 500, maxMp = 200, quantity = 2) {
  const item = itemFor(slug), session = startSession(project, 20261004);
  session.partyActorIds = [userId, targetId]; session.inventory = { [item.id]: quantity };
  session.actorVitals[targetId] = { hp: beforeHp, mp: beforeMp, maxHp, maxMp };
  session.actorStateIds = { [targetId]: [...stateIds] };
  const preview = previewMenuItemTarget(project, session, item, targetId);
  const result = useItemFromMenu(project, session, item.id, targetId);
  assert.equal(result.kind, expectedKind, slug); assert.equal(session.actorVitals[targetId].hp, expectedHp, slug);
  assert.equal(session.actorVitals[targetId].mp, expectedMp, slug); assert.deepEqual(session.actorStateIds[targetId], expectedStates, slug);
  assert.equal(session.inventory[item.id], expectedKind === "used" ? quantity - 1 : quantity, slug);
  if (result.kind === "used") { assert.equal(preview.hpAfter, expectedHp); assert.equal(preview.mpAfter, expectedMp); }
  checks.push({ kind: "real-menu-use", slug, before: { hp: beforeHp, mp: beforeMp, stateIds, maxHp, maxMp, quantity },
    after: { ...session.actorVitals[targetId], stateIds: session.actorStateIds[targetId] }, result: result.kind, remaining: session.inventory[item.id] });
}
for (const [slug, [hp,mp,hpp,mpp,cures]] of Object.entries(expected)) {
  const item = itemFor(slug); assert.deepEqual(item.hpRecovery, { flat: hp, percentMax: hpp });
  assert.deepEqual(item.mpRecovery, { flat: mp, percentMax: mpp }); assert.deepEqual(item.healStateIds, cures);
  const dead = slug === "revival-charm", beforeHp = dead ? 0 : 10;
  menu(slug, beforeHp, 2, allAilments, beforeHp + hp + hpp * 5, 2 + mp + mpp * 2, allAilments.filter(s => !cures.includes(s)));
  menu(slug, 500, 200, [], 500, 200, [], "unusable");
  if (!dead) menu(slug, 0, 2, allAilments, 0, 2, allAilments, "unusable");
  menu(slug, beforeHp, 2, allAilments, beforeHp, 2, allAilments, "unusable", 500, 200, 0);
}
menu("mugwort-pill", 110, 0, [], 120, 0, [], "used", 120, 36);
menu("ginseng-tea", 120, 30, [], 120, 36, [], "used", 120, 36);
menu("purification-charm", 120, 0, ["state_deep_poison"], 120, 0, ["state_deep_poison"], "unusable", 120, 36);
for (const [maxHp,resultHp] of [[120,31],[127,32],[1,1]]) menu("revival-charm", 0, 7, ["state_poison"], resultHp, 7, ["state_poison"], "used", maxHp, 36);
for (const slug of [...Object.keys(ids.materials), "smoke-powder", "fire-charm", "ice-charm", "thunder-charm"]) {
  menu(slug, 10, 2, allAilments, 10, 2, allAilments, "unusable");
  if (ids.materials[slug]) {
    const item = itemFor(slug); assert.equal(item.type, "normalGoods"); assert.equal(item.consumable, false); assert.equal(item.scope, "none");
    assert.equal(itemAllowsMenu(item), false); assert.equal(itemAllowsBattle(item), false);
  }
}

function battle(slug: string, elementRate: "C" | "D" | "E" = "C", immuneToSlow = false) {
  const item = itemFor(slug), skill = skills.find(skill => skill.id === item.activateSkillId);
  // Copies only in memory; one prototype enemy with fixed rates, no persistence connection.
  const battleProject = { ...project, database: { ...project.database,
    troops: [{ ...prototype.troops[0], battleEventPages: [], afterBattle: undefined,
      enemyIds: [prototype.troops[0].enemyIds[0]], members: [prototype.troops[0].members[0]] }],
    enemies: prototype.enemies.map(enemy => ({ ...enemy,
      elementRates: { ...enemy.elementRates, ...(skill?.elementId ? { [skill.elementId]: elementRate } : {}) },
      stateRates: { ...enemy.stateRates, ...(immuneToSlow ? { state_agility_down: "E" as const } : {}) } })),
  } };
  const runtime = createBattleRuntime({
    project: battleProject, troopId: prototype.troops[0].id, battleFlow: "gauge", canEscape: true, canLose: true, rng: () => 0,
    sessionState: { switches: {}, variables: {}, inventory: { [item.id]: 2 } },
    party: { levels: { [userId]: 1, [targetId]: 1 }, experience: {}, partyActorIds: [userId,targetId],
      vitals: { [userId]: { hp: 120, mp: 36 }, [targetId]: { hp: 10, mp: 2 } }, stateIds: { [targetId]: allAilments } },
  });
  for (let tick = 0; tick < 20 && runtime.snapshot().phase === "charging"; tick++) runtime.tick(500);
  const before = runtime.snapshot(); assert.equal(before.phase, "actorCommand", slug);
  const previous = before.actors.find(actor => actor.recordId === targetId)!;
  const previousUser = before.actors.find(actor => actor.recordId === before.activeActorId)!;
  const enemyBefore = before.enemies[0];
  runtime.performActorCommand({ kind: "item", itemId: item.id, targetEnemyId: item.scope === "enemy" ? enemyBefore.id : "", targetActorId: item.scope === "enemy" ? undefined : targetId });
  const after = runtime.snapshot(), next = after.actors.find(actor => actor.recordId === targetId)!;
  const nextUser = after.actors.find(actor => actor.recordId === previousUser.recordId)!, enemyAfter = after.enemies[0];
  const allowed = itemAllowsBattle(item); assert.equal(after.eventState.inventory[item.id], allowed ? 1 : 2, slug);
  assert.equal(nextUser.mp, previousUser.mp, slug + " must not spend MP");
  if (item.type === "medicine" && allowed) {
    const [hp,mp,hpp,mpp,cures] = expected[slug];
    assert.equal(next.hp, Math.min(previous.maxHp, previous.hp + hp + Math.floor(previous.maxHp * hpp / 100)), slug);
    assert.equal(next.mp, Math.min(previous.maxMp, previous.mp + mp + Math.floor(previous.maxMp * mpp / 100)), slug);
    assert.deepEqual(next.stateIds, previous.stateIds.filter(s => !cures.includes(s)), slug);
  } else if (allowed && slug !== "smoke-powder") {
    const damage = { "fire-charm":32, "ice-charm":30, "thunder-charm":34 }[slug]!;
    assert.equal(enemyBefore.hp - enemyAfter.hp, Math.min(enemyBefore.hp, damage * { C:1, D:0.5, E:0 }[elementRate]), slug);
  } else if (allowed) {
    assert.equal(enemyAfter.hp, enemyBefore.hp); assert.equal(enemyAfter.stateIds.includes("state_agility_down"), !immuneToSlow);
    if (!immuneToSlow) assert.equal(agilityMultiplierForStates(battleProject, enemyAfter), 0.5);
  } else { assert.deepEqual(next, previous); assert.deepEqual(enemyAfter, enemyBefore); }
  if (skill && allowed) assert(after.timeline.some(entry => entry.skillId === skill.id && entry.commandKind === "item"), slug + " skill never executed");
  checks.push({ kind: "real-battle-use", slug, elementRate, immuneToSlow, allowed,
    before: { actor: { hp:previous.hp,mp:previous.mp,maxHp:previous.maxHp,maxMp:previous.maxMp,stateIds:previous.stateIds }, enemy: { hp:enemyBefore.hp,stateIds:enemyBefore.stateIds } },
    after: { actor: { hp:next.hp,mp:next.mp,stateIds:next.stateIds }, enemy: { hp:enemyAfter.hp,stateIds:enemyAfter.stateIds } },
    remaining: after.eventState.inventory[item.id], userMpBefore:previousUser.mp,userMpAfter:nextUser.mp,itemSkillId:skill?.id });
}
for (const slug of Object.keys(ids.items)) battle(slug);
for (const slug of Object.keys(ids.materials)) battle(slug);
for (const slug of ["fire-charm", "ice-charm", "thunder-charm"]) { battle(slug, "D"); battle(slug, "E"); }
battle("smoke-powder", "C", true);
assert.equal(itemAllowsBattle(activeItemEffects(itemFor("revival-charm"))), false);
checks.push({ kind:"engine-limitation",slug:"revival-charm",battleAllowed:false,
  reason:"Native medicine.onlyEffectiveOnDeadActors remains field-only. Taoist healing+state_death skill revival is a separate owner/path." });
const evidence = {
  phase:"full",scope:"local content pack and in-memory fixture only; no canonical SQLite save or public registration",
  prototypePath,prototypeSha256:sha(prototypeBytes),skillsSourcePath,skillsSourceSha256:sha(skillsSourceBytes),
  borrowedElements:elements.map(el=>el.id),dataSha256:sha(read("data.json")),designSha256:sha(read("design.json")),
  scriptSources:["smoke.mts","run-smoke.mjs"].map(file=>({file,sha256:sha(read(file))})),
  engineFiles:["src/project/databaseRecordModel.ts","src/project/itemUsage.ts","src/player/playerItemUse.ts","src/battle/runtime.ts","src/battle/battleStates.ts"].map(path=>({path,
    sha256:sha(readFileSync(fileURLToPath(new URL(`../../../${path}`,root))))})),
  passed:true,checkCount:checks.length,checks,
};
writeFileSync(new URL("review/smoke.json",root),JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify({passed:true,checkCount:checks.length,report:"review/smoke.json",items:32,itemSkills:4}));
