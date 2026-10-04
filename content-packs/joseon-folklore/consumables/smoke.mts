import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { startSession } from "@/project/session";
import { useItemFromMenu, previewMenuItemTarget } from "@/player/playerItemUse";
import { createBattleRuntime } from "@/battle/runtime";
import { activeItemEffects, itemAllowsBattle, itemAllowsMenu } from "@/project/itemUsage";
import type { ItemRecord, ProjectDatabaseRecords } from "@/project/types";

const root = new URL("./", import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, root));
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const prototypePath = process.argv[2] ?? "/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json";
const prototypeBytes = readFileSync(prototypePath);
const prototype = JSON.parse(prototypeBytes.toString()) as ProjectDatabaseRecords;
const input = JSON.parse(read("data.json").toString());
const ids = JSON.parse(read("../ids.json").toString());
const manifest = JSON.parse(read("art-manifest.json").toString());
const items: ItemRecord[] = input.items.map(normalizeItemRecord);
assert.equal(items.length, 6);
assert.equal(input.skills.length, 0);
assert.equal(new Set(items.map(item => item.id)).size, items.length);
const allowedIds = new Set([...Object.values(ids.items), ...Object.values(ids.materials)]);
const checks: unknown[] = [];
for (const item of items) {
  assert(allowedIds.has(item.id));
  const icon = manifest.icons.find((icon: { resourceId: string }) => icon.resourceId === item.iconResourceId);
  assert(icon);
  assert.equal(sha(read(icon.sourceFile)), icon.sha256);
  assert.equal(icon.path, `assets/joseon-folklore/consumables/${icon.slug}.png`);
  if (item.animationId) assert(prototype.battleAnimations.some(anim => anim.id === item.animationId));
  for (const stateId of item.healStateIds) assert(prototype.states.some(state => state.id === stateId));
  for (const effect of item.stateEffects) assert(prototype.states.some(state => state.id === effect.stateId));
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeItemRecord(JSON.parse(JSON.stringify(item))))), JSON.parse(JSON.stringify(item)));
  checks.push({ kind: "normalize-and-reload", id: item.id, iconSha256: icon.sha256,
    type: item.type, hpRecovery: item.hpRecovery, mpRecovery: item.mpRecovery,
    healStateIds: item.healStateIds, menu: itemAllowsMenu(activeItemEffects(item)), battle: itemAllowsBattle(activeItemEffects(item)) });
}

// In-memory fixture only: the supplied prototype DB is READ, never written.
const project = createBlankProject();
project.database = { ...prototype, items };
const userId = "actor_scout";
const targetId = "actor_mage";
project.system.startActorIds = [userId, targetId];
const itemFor = (slug: string) => {
  const id = ids.items[slug] ?? ids.materials[slug];
  const item = items.find(item => item.id === id);
  assert(item);
  return item;
};
function menu(slug: string, beforeHp: number, beforeMp: number, stateIds: string[], expectedHp: number, expectedMp: number, expectedStates: string[], expectedKind = "used", maxHp = 120) {
  const item = itemFor(slug);
  const session = startSession(project, 20261004);
  session.partyActorIds = [userId, targetId];
  session.inventory = { [item.id]: 2 };
  session.actorVitals[targetId] = { hp: beforeHp, mp: beforeMp, maxHp, maxMp: 36 };
  session.actorStateIds = { [targetId]: [...stateIds] };
  const preview = previewMenuItemTarget(project, session, item, targetId);
  const result = useItemFromMenu(project, session, item.id, targetId);
  assert.equal(result.kind, expectedKind, slug);
  assert.equal(session.actorVitals[targetId].hp, expectedHp, slug);
  assert.equal(session.actorVitals[targetId].mp, expectedMp, slug);
  assert.deepEqual(session.actorStateIds[targetId], expectedStates, slug);
  assert.equal(session.inventory[item.id], expectedKind === "used" ? 1 : 2, slug);
  checks.push({ kind: "real-menu-use", slug, before: { hp: beforeHp, mp: beforeMp, stateIds, maxHp },
    after: { ...session.actorVitals[targetId], stateIds: session.actorStateIds[targetId] },
    preview, result: result.kind, remaining: session.inventory[item.id] });
}
menu("mugwort-pill", 10, 0, [], 60, 0, []);
menu("mugwort-pill", 110, 0, [], 120, 0, []);
menu("mugwort-pill", 0, 0, [], 0, 0, [], "unusable");
menu("mugwort-pill", 120, 36, [], 120, 36, [], "unusable");
menu("ginseng-tea", 120, 0, [], 120, 16, []);
menu("ginseng-tea", 120, 30, [], 120, 36, []);
menu("purification-charm", 120, 0, ["state_poison", "state_sleep", "state_deep_poison"], 120, 0, ["state_sleep", "state_deep_poison"]);
menu("purification-charm", 120, 0, ["state_deep_poison"], 120, 0, ["state_deep_poison"], "unusable");
menu("revival-charm", 0, 7, ["state_poison"], 31, 7, ["state_poison"]);
menu("revival-charm", 0, 0, [], 32, 0, [], "used", 127);
menu("revival-charm", 0, 0, [], 1, 0, [], "used", 1);
menu("revival-charm", 10, 7, [], 10, 7, [], "unusable");
for (const slug of ["boar-tusk", "straw-knot"]) menu(slug, 10, 0, ["state_poison"], 10, 0, ["state_poison"], "unusable");

for (const slug of ["mugwort-pill", "ginseng-tea", "purification-charm"]) {
  const item = itemFor(slug);
  const runtime = createBattleRuntime({
    project, troopId: prototype.troops[0].id, battleFlow: "gauge", canEscape: true, canLose: true, rng: () => 0,
    sessionState: { switches: {}, variables: {}, inventory: { [item.id]: 2 } },
    party: { levels: { [userId]: 1, [targetId]: 1 }, experience: {}, partyActorIds: [userId, targetId],
      vitals: { [userId]: { hp: 120, mp: 36 }, [targetId]: { hp: 1, mp: 0 } },
      stateIds: { [targetId]: ["state_poison", "state_deep_poison"] } },
  });
  for (let tick = 0; tick < 20 && runtime.snapshot().phase === "charging"; tick++) runtime.tick(500);
  const before = runtime.snapshot();
  assert.equal(before.phase, "actorCommand", slug);
  const previous = before.actors.find(actor => actor.recordId === targetId)!;
  runtime.performActorCommand({ kind: "item", itemId: item.id, targetEnemyId: "", targetActorId: targetId });
  const after = runtime.snapshot();
  const next = after.actors.find(actor => actor.recordId === targetId)!;
  assert.equal(next.hp - previous.hp, slug === "mugwort-pill" ? 50 : 0, slug);
  assert.equal(next.mp - previous.mp, slug === "ginseng-tea" ? 16 : 0, slug);
  assert.deepEqual(next.stateIds, slug === "purification-charm" ? ["state_deep_poison"] : previous.stateIds, slug);
  assert.equal(after.eventState.inventory[item.id], 1, slug);
  checks.push({ kind: "real-battle-use", slug, before: { hp: previous.hp, mp: previous.mp, stateIds: previous.stateIds },
    after: { hp: next.hp, mp: next.mp, stateIds: next.stateIds }, remaining: after.eventState.inventory[item.id] });
}
assert.equal(itemAllowsBattle(activeItemEffects(itemFor("revival-charm"))), false);
checks.push({ kind: "engine-limitation", slug: "revival-charm", battleAllowed: false,
  reason: "itemAllowsBattle rejects medicine.onlyEffectiveOnDeadActors; SkillRecord has no dead-ally scope. Field revival is implemented." });
const evidence = {
  scope: "local content pack only; no canonical SQLite save or public registration",
  prototypePath, prototypeSha256: sha(prototypeBytes), dataSha256: sha(read("data.json")),
  engineFiles: ["src/project/databaseRecordModel.ts", "src/project/itemUsage.ts", "src/player/playerItemUse.ts", "src/battle/runtime.ts"].map(path => ({ path,
    sha256: sha(readFileSync(fileURLToPath(new URL(`../../../${path}`, root)))) })),
  passed: true, checkCount: checks.length, checks,
};
writeFileSync(new URL("review/smoke.json", root), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, checkCount: checks.length, report: "review/smoke.json" }));
