// Deterministic life-systems fixture for the 51-row completion matrix (plan task 17).
//
// Authorability contract: this fixture starts from the ORDINARY authorable starter
// (createFarmingDemoProject), which already authors the life economy — gated craft
// recipes, tool upgrades, makers, bundles with real world-unlock/switch rewards, and
// life skills. This module therefore PINS determinism and adds only what the matrix
// still needs. It never re-authors what the starter owns, and it never injects runtime
// results: no pre-set maker outputs, no pre-harvested goods, no pre-granted refunds,
// no pre-unlocked recipes. Those must be earned by actually playing a scenario.
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import type { Project } from "@/project/types";

/** Fixed calendar/time so every run is reproducible. */
export const LIFE_FULL_DETERMINISM = {
  startPos: { x: 4, y: 4 },
  dayStartHour: 6,
  dayEndHour: 26,
  energyMax: 100,
  energyInitial: 100,
} as const;

/**
 * Scenario ids are the contract between the 51 coverage rows and the harness.
 * Every coverage row must map to exactly one of these.
 */
export const LIFE_FULL_SCENARIOS = {
  authoring: "life-full-authoring",
  farming: "life-full-farming",
  gathering: "life-full-gathering",
  shipping: "life-full-shipping",
  crafting: "life-full-crafting",
  craftingFailure: "life-full-crafting-failure",
  upgrade: "life-full-upgrade",
  bundle: "life-full-bundle-unlock",
  residents: "life-full-residents",
  animals: "life-full-animals",
  buildings: "life-full-buildings",
  dayCycle: "life-full-day-cycle",
  saveResume: "life-full-save-resume",
  recovery: "life-full-recovery",
  treeChop: "life-full-tree-chop",
} as const;

export type LifeFullScenarioId = (typeof LIFE_FULL_SCENARIOS)[keyof typeof LIFE_FULL_SCENARIOS];

/**
 * C6/L5/F06 are the choppable-tree rows. Task 81 is now integrated and was proven on the
 * shipped player, so the ordinary starter authors the tree and these rows are backed by a
 * real resource. The tree still must come from the starter, never from runtime injection.
 */
export const LIFE_FULL_PENDING_STARTER_ROWS = ["C6", "L5", "F06"] as const;

/** Item ids the fixture depends on; asserted to exist rather than assumed. */
export const LIFE_FULL_REQUIRED_ITEM_IDS = [
  "item_hoe",
  "item_watering_can",
  "item_pickaxe",
  "item_potato_seed",
  "item_potato",
  "item_strawberry_seed",
  "item_strawberry",
  "item_stone",
  "item_iron_ore",
  "item_iron_bar",
] as const;

export const LIFE_FULL_REQUIRED_MAP_IDS = ["map_farming_demo"] as const;

export function createLifeFullFixture(): Project {
  const project = createFarmingDemoProject();
  project.meta = { ...project.meta, title: "생활 시스템 완주 픽스처" };

  // Pin only the determinism knobs. Everything else stays exactly as authored by the
  // ordinary starter path, so the fixture keeps its provenance.
  project.startPos = { ...LIFE_FULL_DETERMINISM.startPos };
  project.system = {
    ...project.system,
    timeSystem: {
      ...(project.system.timeSystem ?? { enabled: true, forceSleep: false }),
      enabled: true,
      dayStartHour: LIFE_FULL_DETERMINISM.dayStartHour,
      dayEndHour: LIFE_FULL_DETERMINISM.dayEndHour,
    },
    energy: {
      ...(project.system.energy ?? { restorePerDay: LIFE_FULL_DETERMINISM.energyMax }),
      max: LIFE_FULL_DETERMINISM.energyMax,
      initial: LIFE_FULL_DETERMINISM.energyInitial,
    },
  };

  return project;
}
