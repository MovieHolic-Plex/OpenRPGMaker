import { describe, expect, it } from "vitest";
import * as authoring from "@/ai/actionArenaAuthoring";
import { getTool } from "@/editor/tools/toolRegistry";

describe("structured action arena recipe selection", () => {
  it("selects the arena recipe only for declared action creation targets", () => {
    expect(authoring.selectActionArenaAuthoringRecipe({
      mode: "create", clarify: null, actionCombat: { targets: [{ mapId: "arena" }] },
    })).toBe(authoring.ACTION_ARENA_AUTHORING_RECIPE);
    expect(authoring.selectActionArenaAuthoringRecipe({
      mode: "create", clarify: null, actionCombat: { targets: [{ newMapName: "Training field" }] },
    })).toBe(authoring.ACTION_ARENA_AUTHORING_RECIPE);
  });

  it("does not route questions, small modifications, undeclared combat, or clarification", () => {
    for (const mode of ["question", "modify", "other"] as const) {
      expect(authoring.selectActionArenaAuthoringRecipe({
        mode, clarify: null, actionCombat: { targets: [{ mapId: "arena" }] },
      })).toBeNull();
    }
    expect(authoring.selectActionArenaAuthoringRecipe({ mode: "create", clarify: null })).toBeNull();
    expect(authoring.selectActionArenaAuthoringRecipe({
      mode: "create", clarify: "Which map?", actionCombat: { targets: [{ mapId: "arena" }] },
    })).toBeNull();
    expect(authoring.selectActionArenaAuthoringRecipe({
      mode: "create", clarify: null, actionCombat: { targets: [] },
    })).toBeNull();
  });

  it("exposes real tool dependencies in prerequisite order without unrelated quotas", () => {
    const recipe = authoring.ACTION_ARENA_AUTHORING_RECIPE;
    const ids = recipe.steps.map((step) => step.id);
    expect(ids.indexOf("inspect")).toBeLessThan(ids.indexOf("terrain-start"));
    expect(ids.indexOf("enemy")).toBeLessThan(ids.indexOf("troop"));
    expect(ids.indexOf("troop")).toBeLessThan(ids.indexOf("spawn"));
    expect(ids.indexOf("combat-proof")).toBeLessThan(ids.indexOf("decoration"));
    expect(recipe.guide).toEqual({ tool: "place_npc", option: "action-controls", count: 1 });
    for (const step of recipe.steps) {
      for (const name of step.tools) {
        expect(getTool(name), name).toBeDefined();
      }
    }
    expect(recipe.steps.find((step) => step.id === "combat-proof")?.tools).toContain("run_action_combat_test");
    expect(recipe.steps.flatMap((step) => step.tools)).not.toEqual(expect.arrayContaining(["define_quest", "author_boss_phases"]));
  });
});
