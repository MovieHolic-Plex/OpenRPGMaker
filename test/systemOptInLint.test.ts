import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import type { Project } from "@/project/types";

/** Helper: opt-in issues from projectLint with the "opt-in:" code prefix. */
function optInIssues(project: Project): ReturnType<typeof projectLint> {
  return projectLint(project).filter((issue) => issue.code.startsWith("opt-in:"));
}

describe("system opt-in consistency lint", () => {
  it("warns when monsterCollection is on but species is empty", () => {
    const project = createBlankProject();
    project.database.monsterSpecies = [];
    project.system.monsterCollection = true;
    expect(optInIssues(project).some((i) => i.code === "opt-in:monster-collection-empty")).toBe(true);
  });

  it("does not warn when monsterCollection is on and species exist", () => {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    expect(optInIssues(project).filter((i) => i.code === "opt-in:monster-collection-empty")).toHaveLength(0);
  });

  it("warns when monsterBattleParty is on but species is empty", () => {
    const project = createBlankProject();
    project.database.monsterSpecies = [];
    project.system.monsterBattleParty = true;
    expect(optInIssues(project).some((i) => i.code === "opt-in:monster-battle-party-empty")).toBe(true);
  });

  it("warns when monsterCare is set but monsterCollection is off", () => {
    const project = createBlankProject();
    project.system.monsterCare = { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
    expect(optInIssues(project).some((i) => i.code === "opt-in:monster-care-without-collection")).toBe(true);
  });

  it("warns when typeChart is set but no skills have elementId", () => {
    const project = createBlankProject();
    for (const skill of project.database.skills ?? []) {
      delete skill.elementId;
    }
    project.system.typeChart = { entries: [] } as never;
    expect(optInIssues(project).some((i) => i.code === "opt-in:type-chart-no-elements")).toBe(true);
  });

  it("warns when season crops exist but time system is off", () => {
    const project = createBlankProject();
    project.database.crops = [{
      id: "wheat", name: "밀", seedItemId: "seed_wheat", harvestItemId: "item_wheat",
      harvestCount: 1, stages: [{ days: 3 }], seasons: ["spring"],
    }] as never;
    expect(optInIssues(project).some((i) => i.code === "opt-in:season-crops-without-time")).toBe(true);
  });

  it("warns when crops exist but no farmable area maps", () => {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true, minutesPerRealSecond: 1, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
    project.database.crops = [{
      id: "wheat", name: "밀", seedItemId: "seed_wheat", harvestItemId: "item_wheat",
      harvestCount: 1, stages: [{ days: 3 }], seasons: [],
    }] as never;
    expect(optInIssues(project).some((i) => i.code === "opt-in:crops-without-farmable")).toBe(true);
  });

  it("warns when actionCombat enabled but no maps opt in", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true };
    expect(optInIssues(project).some((i) => i.code === "opt-in:action-combat-no-map")).toBe(true);
  });

  it("warns when map opts into actionCombat but system switch is off", () => {
    const project = createBlankProject();
    const map = Object.values(project.maps)[0];
    if (map) map.actionCombat = true;
    expect(optInIssues(project).some((i) => i.code === "opt-in:action-combat-map-without-system")).toBe(true);
  });

  it("warns when craftRecipes exist but no calling commands", () => {
    const project = createBlankProject();
    project.system.craftRecipes = [{ id: "bread", name: "빵", inputs: [], outputs: [] }] as never;
    expect(optInIssues(project).some((i) => i.code === "opt-in:craft-recipes-no-call")).toBe(true);
  });

  it("warns when itemUpgrades exist but no calling commands", () => {
    const project = createBlankProject();
    project.system.itemUpgrades = [{ id: "sword_up", name: "검 강화", baseItemId: "sword", outputs: [] }] as never;
    expect(optInIssues(project).some((i) => i.code === "opt-in:item-upgrades-no-call")).toBe(true);
  });

  it("warns when genre is monster-collect but monsterCollection is off", () => {
    const project = createBlankProject();
    project.system.genre = "monster-collect";
    expect(optInIssues(project).some((i) => i.code === "opt-in:genre-monster-collect-no-collection")).toBe(true);
  });

  it("warns when genre is farm-life but time system is off", () => {
    const project = createBlankProject();
    project.system.genre = "farm-life";
    expect(optInIssues(project).some((i) => i.code === "opt-in:genre-farm-life-no-time")).toBe(true);
  });

  it("blank project with no opt-ins produces zero opt-in warnings", () => {
    const project = createBlankProject();
    expect(optInIssues(project)).toHaveLength(0);
  });
});
