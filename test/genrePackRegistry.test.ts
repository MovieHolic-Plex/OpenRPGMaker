import { describe, expect, it } from "vitest";
import {
  GENRE_PACK_IDS,
  createGenreStarterPlan,
  createProjectFromGenreStarterPlan,
  evaluateGenrePackReadiness,
  genrePackById,
} from "@/editor/genrePacks";
import { WELCOME_GENRE_PRESETS, welcomeGenreStarterPlanById } from "@/editor/welcomeGenrePresets";
import { createBlankProject, createFarmingDemoProject } from "@/project/defaults";

describe("genre pack registry contract", () => {
  it("BREAK: all five official packs expose executable authoring metadata", () => {
    expect(GENRE_PACK_IDS).toEqual([
      "adventure-jrpg",
      "monster-collect",
      "horror-chase",
      "story-cutscene",
      "farm-life",
    ]);

    for (const packId of GENRE_PACK_IDS) {
      const pack = genrePackById(packId);
      expect(pack.id).toBe(packId);
      expect(pack.starter.defaultRecipeId).toBeTruthy();
      expect(pack.navigation.sections.length).toBeGreaterThan(0);
      expect(Object.keys(pack.vocabulary).length).toBeGreaterThan(0);
      expect(pack.recipes.length).toBeGreaterThan(0);
      expect(pack.lint.length).toBeGreaterThan(0);
      expect(pack.journeys.length).toBeGreaterThan(0);
      expect(pack.runtimeRequirements.length).toBeGreaterThan(0);
      expect(pack.recipes.some((recipe) => recipe.id === pack.starter.defaultRecipeId)).toBe(true);
    }
  });

  it("BREAK: every welcome card resolves to a real pack recipe without AI", () => {
    expect(WELCOME_GENRE_PRESETS).toHaveLength(7);
    for (const preset of WELCOME_GENRE_PRESETS) {
      const pack = genrePackById(preset.packId);
      expect(pack.recipes.some((recipe) => recipe.id === preset.starterRecipeId)).toBe(true);
      expect(welcomeGenreStarterPlanById(preset.id)).toEqual({
        packId: preset.packId,
        recipeId: preset.starterRecipeId,
        projectSchema: "Project",
        replaceOpenProject: false,
        aiRequired: false,
      });
    }
  });

  it("BREAK: planning and materializing a starter is detached from an open project", () => {
    const openProject = createBlankProject();
    openProject.meta.title = "keep me";
    const before = structuredClone(openProject);

    const plan = createGenreStarterPlan("farm-life", "farm-blank");
    const starter = createProjectFromGenreStarterPlan(plan);

    expect(openProject).toEqual(before);
    expect(starter).not.toBe(openProject);
    expect(starter.system.genre).toBe("farm-life");
    expect(starter.system.timeSystem?.enabled).toBe(true);
    expect(starter.database.crops).toHaveLength(createBlankProject().database.crops?.length ?? 0);
    expect(starter.maps).toEqual(createBlankProject().maps);
  });

  it("BREAK: the existing farm pilot is measurable without rewriting its content", () => {
    const readiness = evaluateGenrePackReadiness(createFarmingDemoProject(), "farm-life");
    expect(readiness.packId).toBe("farm-life");
    expect(readiness.ready).toBe(true);
    expect(readiness.checks.find((check) => check.id === "farmable-map")?.ready).toBe(true);
    expect(readiness.checks.find((check) => check.id === "crop-records")?.ready).toBe(true);
    expect(readiness.checks.find((check) => check.id === "farm-tools")?.ready).toBe(true);
  });
});
