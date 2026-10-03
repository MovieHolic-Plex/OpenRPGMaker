import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { defaultDatabase } from "../../src/project/defaults/defaultDatabase";
import { DEFAULT_ITEM_ECONOMY, defaultItemPrice } from "../../src/project/defaults/defaultItemBalance";
import { activeItemEffects, itemAllowsBattle, itemAllowsMenu } from "../../src/project/itemUsage";
import { parameterValueAtLevel } from "../../src/project/actorModel";
import { targetScopeForCommand } from "../../src/battle/battleTargetResolver";
import { applySkillLike } from "../../src/battle/battleDamage";
import type { MutableBattler } from "../../src/battle/battleBattlers";
import type { ItemRecord, SkillRecord } from "../../src/project/types";

const database = defaultDatabase();
const skills = new Map(database.skills.map(skill => [skill.id, skill]));
const baseline = JSON.parse(await readFile("assets/item-catalog/balance-baseline.json", "utf8"));
function signature(authored: ItemRecord): string {
  const i = activeItemEffects(authored);
  const skill = skills.get(i.activateSkillId ?? i.skillId ?? "");
  const effectSkill = skill ? {
    scope: skill.scope, effect: skill.effect, power: skill.power, mpCost: skill.mpCost,
    elementId: skill.elementId, hitRate: skill.hitRate, successRate: skill.successRate,
    stateEffects: skill.stateEffects, variance: skill.variance,
  } : undefined;
  const cures = [...new Set([...i.healStateIds, ...i.stateEffects.filter(e => e.operation === "remove").map(e => e.stateId)])].sort();
  const added = i.stateEffects.filter(e => e.operation === "add").sort((a, b) => a.stateId.localeCompare(b.stateId));
  return JSON.stringify({
    type: i.type, scope: i.scope, occasion: i.occasion, consumable: i.consumable,
    consumptionLimit: i.consumptionLimit, classes: [...i.usableClassIds].sort(), actors: [...i.usableActorIds].sort(),
    hp: i.hpRecovery, mp: i.mpRecovery, cures, added, revival: i.onlyEffectiveOnDeadActors,
    seed: i.seedParameterBonuses, learned: i.learnedSkillId, skill: effectSkill,
    switch: i.switchId, capture: i.captureProfile, care: i.careProfile, tool: i.farmTool,
  });
}
function hasEffect(item: ItemRecord): boolean {
  return itemAllowsMenu(item) || itemAllowsBattle(item) || Boolean(item.farmTool);
}
function summarize(items: ItemRecord[]) {
  const functional = items.filter(hasEffect);
  return { functionalItems: functional.length, uniqueEffects: new Set(functional.map(signature)).size,
    partyMedicines: items.filter(item => item.type === "medicine" && item.scope === "allAllies").length,
    percentageMedicines: items.filter(item => item.type === "medicine" && (item.hpRecovery.percentMax || item.mpRecovery.percentMax)).length,
    statusMedicines: items.filter(item => item.type === "medicine" && item.stateEffects.length).length };
}
const issues: string[] = [];
const priceGroups = new Map<string, ItemRecord[]>();
for (const item of database.items) {
  if (!Number.isInteger(item.price) || item.price < 0) issues.push(`${item.id}: invalid price`);
  if (hasEffect(item) && item.price !== defaultItemPrice(item, skills)) issues.push(`${item.id}: price policy mismatch`);
  for (const id of item.usableClassIds) if (!database.classes.some(c => c.id === id)) issues.push(`${item.id}: missing class ${id}`);
  if (hasEffect(item)) {
    const key = signature(item);
    priceGroups.set(key, [...priceGroups.get(key) ?? [], item]);
  }
}
const inconsistentEquivalentPrices = [...priceGroups.values()].filter(group => new Set(group.map(i => i.price)).size > 1)
  .map(group => group.map(i => ({ id: i.id, price: i.price })));
if (inconsistentEquivalentPrices.length) issues.push("Equal executable effects have different prices");
const newBattleItems = database.items.filter(i => i.id.startsWith("item_shared_battle_"));
const battleSkills = newBattleItems.map(i => skills.get(i.activateSkillId!)!);
const animations = new Set(database.battleAnimations.map(a => a.id));
const states = new Set(database.states.map(s => s.id));
const elements = new Set(database.elements.map(e => e.id));
for (const item of newBattleItems) {
  const skill = skills.get(item.activateSkillId!);
  if (!skill || skill.mpCost.flat || skill.mpCost.percentMax) issues.push(`${item.id}: non-free or absent item skill`);
  if (skill?.animationId && !animations.has(skill.animationId)) issues.push(`${item.id}: absent skill animation`);
  if (skill?.elementId && !elements.has(skill.elementId)) issues.push(`${item.id}: absent skill element`);
  for (const effect of skill?.stateEffects ?? []) if (!states.has(effect.stateId)) issues.push(`${item.id}: absent skill state`);
  if (targetScopeForCommand({ database } as Parameters<typeof targetScopeForCommand>[0], { kind: "item", itemId: item.id }) !== skill?.scope) issues.push(`${item.id}: incorrect effective target scope`);
}
const pureHeals = database.items.filter(i => i.type === "medicine" && !i.onlyEffectiveOnDeadActors && i.hpRecovery.flat + i.hpRecovery.percentMax > 0
  && !i.mpRecovery.flat && !i.mpRecovery.percentMax && !i.stateEffects.length && !i.healStateIds.length
  && i.consumptionLimit === 1 && !i.usableClassIds.length && !i.usableActorIds.length);
const recovery = (item: ItemRecord, max: number) => Math.min(max, item.hpRecovery.flat + Math.floor(max * item.hpRecovery.percentMax / 100));
const dominatedPureHeals: { expensive: string; cheaper: string }[] = [];
const growthProbeHp = [...new Set([...database.actors, ...database.classes].flatMap(record => record.parameterCurves.maxHp))];
for (const expensive of pureHeals) for (const cheaper of pureHeals) {
  if (cheaper.price >= expensive.price || cheaper.scope !== expensive.scope || cheaper.occasion !== expensive.occasion) continue;
  if (growthProbeHp.every(max => recovery(cheaper, max) >= recovery(expensive, max))) dominatedPureHeals.push({ expensive: expensive.id, cheaper: cheaper.id });
}
if (dominatedPureHeals.length) issues.push("Pure healing items are dominated across the full growth curve");
const phases = [1, 10, 20, 40, 60, 80, 99].map(level => ({ level,
  starterActors: database.actors.filter(a => ["actor_hero", "actor_guardian", "actor_mage", "actor_scout"].includes(a.id))
    .map(a => ({ id: a.id, hp: parameterValueAtLevel(a.parameterCurves.maxHp, level), mp: parameterValueAtLevel(a.parameterCurves.maxMp, level) })) }));
if (phases.some(phase => phase.starterActors.some(actor => actor.hp > DEFAULT_ITEM_ECONOMY.referenceHp || actor.mp > DEFAULT_ITEM_ECONOMY.referenceMp))) issues.push("Economy reference is below shipped starter growth");
function battler(id: string, hp: number, mind: number, defense: number): MutableBattler {
  return { id, recordId: id, name: id, maxHp: hp, maxMp: 0, hp, mp: 0,
    attackPower: mind, mind, defense, agility: 40, chargeRate: 1, skillIds: [],
    hidden: false, gauge: 0, stateIds: [], stateTurns: {}, defending: false };
}
const mage = database.actors.find(a => a.id === "actor_mage")!;
// Data preview only: neutral matchup, no equipment/states/crit/variance, own ephemeral battlers.
const combatBudgets = [[1, "enemy_slime"], [20, "enemy_mine_skel_archer"], [40, "enemy_dragon"]].map(([level, enemyId]) => {
  const enemy = database.enemies.find(e => e.id === enemyId)!;
  const mind = parameterValueAtLevel(mage.parameterCurves.mind, Number(level));
  const previews = [1, 3, 4, 6, 7].map(tier => {
    const item = database.items.find(i => i.id === `item_shared_battle_fire-${tier}`)!;
    const skill = skills.get(item.activateSkillId!)!;
    const target = battler(enemy.id, enemy.stats.maxHp, enemy.stats.mind, enemy.stats.defense);
    const result = applySkillLike(battler(mage.id, 1000, mind, 0), target, {
      power: skill.power, statistic: "mind", effect: "damage", variance: 0, criticalRate: 0, hitRate: 100, rng: () => .5,
    });
    return { itemId: item.id, price: item.price, uses: item.consumptionLimit, scope: skill.scope,
      neutralDamagePerTarget: result.amount, goldPerUse: item.price / Number(item.consumptionLimit) };
  });
  return { level, enemyId, enemyHp: enemy.stats.maxHp, enemyGold: enemy.rewards.gold, previews };
});
const sourceHashes: Record<string, string> = {};
for (const path of ["src/project/defaults/sharedItemCatalog.json", "src/project/defaults/defaultItemBalance.ts", "src/project/defaults/defaultSharedItemSkills.ts", "scripts/content/lib/shared-item-effects.mjs"])
  sourceHashes[path] = createHash("sha256").update(await readFile(path)).digest("hex");
const report = {
  items: database.items.length, economy: DEFAULT_ITEM_ECONOMY, baselineCommit: baseline.sourceCommit, before: baseline.summary, after: summarize(database.items),
  itemOnlySkills: new Set(battleSkills.map(s => s.id)).size,
  battleRoles: { singleDamage: battleSkills.filter(s => s.scope === "enemy" && s.effect.kind === "damage").length,
    allEnemyDamage: battleSkills.filter(s => s.scope === "allEnemies").length, debuffs: battleSkills.filter(s => s.effect.kind === "support").length },
  professionRestrictedManuals: database.items.filter(i => i.id.startsWith("item_shared_manual_") && i.usableClassIds.length === 1).length,
  inconsistentEquivalentPrices, dominatedPureHeals, growthProbeHpCount: growthProbeHp.length, phases, combatBudgets,
  examples: ["item_potion", "item_ether", "item_elixir", "item_shared_healing_rose-1", "item_shared_healing_hibiscus-8", "item_shared_growth_attack-1", "item_shared_growth_attack-8", "item_shared_battle_fire-4", "item_shared_battle_fire-7"]
    .map(id => { const i = database.items.find(i => i.id === id)!; return { id, name: i.name, price: i.price, description: i.description }; }),
  sourceHashes, issues, complete: issues.length === 0 && database.items.length === 1000,
};
await mkdir("output/item-catalog", { recursive: true });
await writeFile("output/item-catalog/balance-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ items: report.items, before: report.before, after: report.after, itemOnlySkills: report.itemOnlySkills,
  battleRoles: report.battleRoles, professionRestrictedManuals: report.professionRestrictedManuals,
  inconsistentEquivalentPrices: inconsistentEquivalentPrices.length, dominatedPureHeals: dominatedPureHeals.length, issues, complete: report.complete }));
if (!report.complete) process.exitCode = 1;
