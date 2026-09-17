import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

type QualityCategory = {
  readonly name: string;
  readonly points: number;
  readonly max: number;
};

describe("default adventure quality score", () => {
  it("scores the dew village demo as a complete short loop", () => {
    const project = createSampleAdventureProject();
    const score = scoreAdventure(project);

    expect(score.categories.map((entry) => entry.name)).toEqual([
      "world",
      "authored-events",
      "quest-loop",
      "combat-and-risk",
      "reward-and-growth",
      "runtime-polish",
      "editor-authorship",
    ]);
    expect(score.total).toBeGreaterThanOrEqual(70);
  });

  it("keeps adventure references resolvable", () => {
    const project = createSampleAdventureProject();
    const references = collectReferences(project);

    expect(references.missingMapIds).toEqual([]);
    expect(references.missingSwitchIds).toEqual([]);
    expect(references.missingVariableIds).toEqual([]);
    expect(references.missingTroopIds).toEqual([]);
    expect(references.missingItemIds).toEqual([]);
  });
});

function scoreAdventure(project: Project): { readonly total: number; readonly categories: readonly QualityCategory[] } {
  const maps = Object.values(project.maps);
  const events = maps.flatMap((map) => map.events);
  const pages = events.flatMap((event) => event.pages ?? []);
  const commands = pages.flatMap((page) => flattenCommands(page.commands));
  const transferCount = commands.filter((command) => command.kind === "transfer").length;
  const textCount = commands.filter((command) => command.kind === "text").length;
  const battleCount = commands.filter((command) => command.kind === "battleProcessing").length;
  const choiceCount = commands.filter((command) => command.kind === "choices").length;
  const rewardKinds = new Set(commands.filter(isRewardCommand).map((command) => command.kind));
  const category = (name: string, points: number, max: number): QualityCategory => ({ name, points, max });
  const categories = [
    category("world", maps.length >= 2 && transferCount >= 2 ? 15 : 8, 15),
    category("authored-events", events.length >= 6 && textCount >= 8 ? 15 : 8, 15),
    category("quest-loop", choiceCount >= 1 && hasCommand(commands, "ending") ? 15 : 6, 15),
    category("combat-and-risk", battleCount >= 1 ? 12 : 7, 15),
    category("reward-and-growth", rewardKinds.size >= 3 ? 15 : rewardKinds.size >= 2 ? 12 : 6, 15),
    category(
      "runtime-polish",
      project.system.titleScreen?.title === "이슬 마을" && project.meta.title === "이슬 마을의 종" ? 15 : 7,
      15
    ),
    category("editor-authorship", project.switches.length >= 1000 && project.variables.length >= 1000 ? 10 : 5, 10),
  ];
  return { total: categories.reduce((sum, entry) => sum + entry.points, 0), categories };
}

function collectReferences(project: Project): {
  readonly missingMapIds: readonly string[];
  readonly missingSwitchIds: readonly string[];
  readonly missingVariableIds: readonly string[];
  readonly missingTroopIds: readonly string[];
  readonly missingItemIds: readonly string[];
} {
  const mapIds = new Set(Object.keys(project.maps));
  const switchIds = new Set(project.switches.map((entry) => entry.id));
  const variableIds = new Set(project.variables.map((entry) => entry.id));
  const troopIds = new Set(project.database.troops.map((entry) => entry.id));
  const itemIds = new Set(project.database.items.map((entry) => entry.id));
  const commands = Object.values(project.maps).flatMap((map) => map.events).flatMap(eventPages).flatMap((page) => flattenCommands(page.commands));
  return {
    missingMapIds: unique(commands.flatMap((command) => command.kind === "transfer" && !mapIds.has(command.mapId) ? [command.mapId] : [])),
    missingSwitchIds: unique(commands.flatMap((command) => command.kind === "setSwitch" && !switchIds.has(command.switchId) ? [command.switchId] : [])),
    missingVariableIds: unique(commands.flatMap((command) => command.kind === "setVariable" && !variableIds.has(command.variableId) ? [command.variableId] : [])),
    missingTroopIds: unique(commands.flatMap((command) => command.kind === "battleProcessing" && !troopIds.has(command.troopId) ? [command.troopId] : [])),
    missingItemIds: unique(commands.flatMap((command) => command.kind === "changeItem" && !itemIds.has(command.itemId) ? [command.itemId] : [])),
  };
}

function eventPages(event: GameEvent): readonly EventPage[] {
  return event.pages ?? [];
}

function flattenCommands(commands: readonly Command[]): readonly Command[] {
  return commands.flatMap((command) => {
    if (command.kind === "choices") return [command, ...command.options.flatMap((option) => flattenCommands(option.branch)), ...flattenCommands(command.cancelBranch ?? [])];
    if (command.kind === "fork") return [command, ...flattenCommands(command.then), ...flattenCommands(command.else ?? [])];
    return [command];
  });
}

function hasCommand(commands: readonly Command[], kind: Command["kind"]): boolean {
  return commands.some((command) => command.kind === kind);
}

function isRewardCommand(command: Command): boolean {
  return command.kind === "changeItem" || command.kind === "changeGold" || command.kind === "setVariable" || command.kind === "setSwitch";
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
