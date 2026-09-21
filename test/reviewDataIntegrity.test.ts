import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { deserialize, serialize } from "@/project/io";
import { normalizeCropRecord } from "@/project/farmModel";
import { projectDatabaseReferenceMessage, projectSwitchVariableReferenceMessage } from "@/editor/databaseRecordReferences";
import { commandsReference } from "@/editor/databaseCommandReferences";
import { findUnused } from "@/editor/tools/refactorTools";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { LIFE_SYSTEM_TOOLS } from "@/editor/tools/lifeSystemTools";
import { LIFE_ECONOMY_TOOLS } from "@/editor/tools/lifeEconomyTools";
import { mergeRecordPatch } from "@/editor/tools/mergeRecordPatch";
import type { Command, Project } from "@/project/types";

const tools = [...DB_TOOLS, ...LIFE_SYSTEM_TOOLS, ...LIFE_ECONOMY_TOOLS];
function run(project: Project, name: string, args: Record<string, unknown>): void {
  tools.find((tool) => tool.name === name)!.run(project, args);
}
function withCommands(project: Project, commands: Command[]): void {
  project.commonEvents = [{ id: "review_common", name: "Review", trigger: "none", commands }];
}

describe("review: deletion and partial-update integrity", () => {
  it("protects crop seed and harvest items in manual and AI deletion and pruning", () => {
    const project = createBlankProject();
    const [seed, harvest] = project.database.items;
    project.database.crops = [normalizeCropRecord({ id: "review_crop", name: "Review crop", seedItemId: seed.id, harvestItemId: harvest.id })];
    for (const item of [seed, harvest]) {
      expect(projectDatabaseReferenceMessage(project, "items", item.id)).toContain("작물");
      expect(findUnused(project).items).not.toContain(item.id);
      expect(() => run(project, "delete_database_record", { collection: "items", id: item.id })).toThrow();
      expect(project.database.items).toContain(item);
    }
  });

  it("protects map encounter troops and troops spawned inside a failure branch", () => {
    const project = createBlankProject();
    const troop = project.database.troops[0];
    project.system.initialTroopId = undefined;
    project.maps[project.startMapId].troopIds = [troop.id];
    expect(projectDatabaseReferenceMessage(project, "troops", troop.id)).toContain("맵");
    project.maps[project.startMapId].troopIds = [];
    withCommands(project, [{ kind: "shop", itemIds: [], failedTransactionBranch: [
      { kind: "spawnFieldEnemy", spawn: { id: "review_spawn", troopId: troop.id, area: { x: 1, y: 1, w: 1, h: 1 } } },
    ] }]);
    expect(findUnused(project).troops).not.toContain(troop.id);
    expect(commandsReference(project, "troops", troop.id)).toBe(true);
  });

  it("checks all battle result branches and preserves directly referenced enemies", () => {
    const project = createBlankProject();
    const enemy = project.database.enemies[0];
    const item = project.database.items[0];
    const troop = project.database.troops[0];
    for (const branch of ["victoryBranch", "defeatBranch", "escapeBranch"] as const) {
      withCommands(project, [{ kind: "battleProcessing", troopId: troop.id, canEscape: true, canLose: true, [branch]: [{ kind: "changeItem", itemId: item.id, op: "+=", amount: 1 }] }]);
      expect(commandsReference(project, "items", item.id)).toBe(true);
    }
    project.system.initialTroopId = troop.id;
    troop.enemyIds = [];
    troop.members = [];
    troop.battleEventPages = [{ id: "review_page", name: "Review", span: "battle", conditions: [{ kind: "enemyHpBelow", enemyId: enemy.id, percent: 50 }], commands: [] }];
    project.database.troops = [troop];
    project.commonEvents = [];
    expect(findUnused(project).enemies).not.toContain(enemy.id);
  });

  it("protects living-route switches when no command uses them", () => {
    const project = createBlankProject();
    const switchId = project.switches[0].id;
    project.switches[0].name = "Route condition";
    const map = project.maps[project.startMapId];
    map.events = [{ id: "review_event", name: "Review", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
      id: "review_page", name: "Route", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", commands: [],
      movement: { type: "living", speed: 3, frequency: 3, living: { repeat: false, destinations: [{ mapId: map.id, x: 1, y: 1, switchId }] } },
    }] }];
    expect(projectSwitchVariableReferenceMessage(project, "switch", switchId)).not.toBeNull();
    expect(findUnused(project).switches).not.toContain(switchId);
  });

  it("uses the same state-rate deletion guard for an AI draft", () => {
    const project = createBlankProject();
    const state = project.database.states[0];
    project.database.actors[0].stateRates[state.id] = "A";
    expect(() => run(project, "delete_database_record", { collection: "states", id: state.id })).toThrow();
    expect(project.database.states).toContain(state);
  });

  it("preserves nested enemy stats and rewards through a partial update and reload", () => {
    const project = createBlankProject();
    const enemy = project.database.enemies[0];
    enemy.stats.defense = 73;
    enemy.rewards.gold = 237;
    run(project, "upsert_enemy", { enemy: { id: enemy.id, stats: { attack: 31 }, rewards: { exp: 47 } } });
    const after = deserialize(serialize(project)).database.enemies.find((entry) => entry.id === enemy.id)!;
    expect(after.stats).toMatchObject({ defense: 73, attack: 31 });
    expect(after.rewards).toMatchObject({ gold: 237, exp: 47 });
  });

  it("preserves equipment bonuses and permissions when patching one nested field", () => {
    const project = createBlankProject();
    const item = project.database.items[0];
    item.equipmentProfile.statBonuses.attack = 23;
    const classes = [...item.equipmentProfile.equippableClassIds];
    run(project, "upsert_item", { item: { id: item.id, equipmentProfile: { statBonuses: { defense: 19 } } } });
    const after = project.database.items.find((entry) => entry.id === item.id)!;
    expect(after.equipmentProfile.statBonuses).toMatchObject({ attack: 23, defense: 19 });
    expect(after.equipmentProfile.equippableClassIds).toEqual(classes);
  });

  it("preserves recipe costs on rename and blocks deletion while rewards refer to it", () => {
    const project = createBlankProject();
    const itemId = project.database.items[0].id;
    project.system.craftRecipes = [{ id: "review_recipe", name: "Before", ingredients: [{ itemId, count: 3 }], outputItemId: itemId, goldCost: 97, requiresUnlock: true }];
    project.database.lifeSkills = [{ id: "review_skill", name: "Farming", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 2, recipeId: "review_recipe" }] }];
    run(project, "upsert_craft_recipe", { recipe: { id: "review_recipe", name: "After" } });
    expect(project.system.craftRecipes[0]).toMatchObject({ name: "After", goldCost: 97, requiresUnlock: true, ingredients: [{ itemId, count: 3 }] });
    expect(() => run(project, "delete_craft_recipe", { id: "review_recipe" })).toThrow();
    run(project, "upsert_life_skill", { skill: { id: "review_skill", name: "Renamed", skillType: "farming" } });
    expect(project.database.lifeSkills[0].levelUpRewards).toEqual([{ level: 2, recipeId: "review_recipe" }]);
  });

  it("keeps other weather seasons and animal graphics on a partial update", () => {
    const project = createBlankProject();
    const itemId = project.database.items[0].id;
    project.system.dailyWeather = { enabled: true, forecastDays: 5, seasons: { spring: [{ kind: "rain", weight: 3 }] } };
    project.database.farmAnimalSpecies = [{ id: "review_animal", name: "Cow", feedItemId: itemId, productItemId: itemId, productCount: 4, productEveryDays: 3, petFriendship: 11, graphic: { direction: "left" } }];
    run(project, "upsert_life_system", { dailyWeather: { enabled: false }, farmAnimalSpecies: { id: "review_animal", name: "Renamed" } });
    expect(project.system.dailyWeather).toMatchObject({ enabled: false, forecastDays: 5, seasons: { spring: [{ kind: "rain", weight: 3 }] } });
    expect(project.database.farmAnimalSpecies[0]).toMatchObject({ name: "Renamed", productCount: 4, productEveryDays: 3, petFriendship: 11, graphic: { direction: "left" } });
  });

  it("replaces explicit arrays and changed union variants without mutating the old object", () => {
    const before = { list: [1, 2], effect: { kind: "switch", switchId: "old" }, nested: { a: 3, b: 4 } };
    expect(mergeRecordPatch(before, { list: [], effect: { kind: "damage", power: 8 }, nested: { a: 0 } }))
      .toEqual({ list: [], effect: { kind: "damage", power: 8 }, nested: { a: 0, b: 4 } });
    expect(before.list).toEqual([1, 2]);
    expect(before.nested.a).toBe(3);
  });
});
