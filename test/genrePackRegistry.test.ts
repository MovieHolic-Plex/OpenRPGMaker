import { describe, expect, it } from "vitest";
import {
  GENRE_PACK_IDS,
  adaptGenreStarterPlan,
  createGenreStarterPlan,
  createGenrePackRuntimeReceipt,
  createProjectFromGenreStarterPlan,
  evaluateGenrePackConfiguration,
  evaluateGenrePackPlayableReadiness,
  genrePackById,
} from "@/editor/genrePacks";
import { WELCOME_GENRE_PRESETS, welcomeGenrePresetById, welcomeGenreStarterPlanById } from "@/editor/welcomeGenrePresets";
import { createBlankProject, createFarmingDemoProject } from "@/project/defaults";
import { isGenrePackId } from "@/project/genrePackId";

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
      expect(welcomeGenreStarterPlanById(preset.id)).toMatchObject({
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

  it("BREAK: seven recipes expose distinct pure adapter results without authored seeds", () => {
    const results = WELCOME_GENRE_PRESETS.map((preset) =>
      adaptGenreStarterPlan(welcomeGenreStarterPlanById(preset.id)),
    );
    const blank = createBlankProject();

    expect(new Set(results.map(({ receipt }) => receipt.adapterId)).size).toBe(WELCOME_GENRE_PRESETS.length);
    expect(new Set(results.map(({ project }) => project.meta.title)).size).toBe(WELCOME_GENRE_PRESETS.length);
    for (const { project, receipt } of results) {
      expect(receipt.authoredContentSeeded).toBe(false);
      expect(receipt.appliedSystemGenre).toBe(project.system.genre);
      expect(project.maps).toEqual(blank.maps);
      expect(project.database.crops).toEqual(blank.database.crops);
    }
  });

  it("BREAK: farm configured and playable are separate; runtime/headless proof is mandatory", () => {
    const pilot = createFarmingDemoProject();
    const configuration = evaluateGenrePackConfiguration(pilot, "farm-life");
    expect(configuration.packId).toBe("farm-life");
    expect(configuration.configured).toBe(true);
    for (const id of ["farmable-map", "farmable-bounds", "farm-start-route", "crop-records", "crop-references", "farm-tools", "farm-seeds", "lint-errors", "reference-integrity"]) {
      expect(configuration.checks.find((check) => check.id === id)?.configured).toBe(true);
    }

    expect(evaluateGenrePackPlayableReadiness(pilot, "farm-life")).toMatchObject({
      configured: true,
      playable: false,
      status: "runtime-proof-required",
      receiptAccepted: false,
    });

    const journeyId = genrePackById("farm-life").journeys[0]!.id;
    const receipt = createGenrePackRuntimeReceipt(pilot, {
      packId: "farm-life",
      source: "headless",
      booted: true,
      completedJourneyIds: [journeyId],
    });
    expect(evaluateGenrePackPlayableReadiness(pilot, "farm-life", receipt)).toMatchObject({
      configured: true,
      playable: true,
      status: "playable",
      receiptAccepted: true,
    });

    const unbooted = createGenrePackRuntimeReceipt(pilot, {
      packId: "farm-life",
      source: "runtime",
      booted: false,
      completedJourneyIds: [journeyId],
    });
    expect(evaluateGenrePackPlayableReadiness(pilot, "farm-life", unbooted).playable).toBe(false);

    const missingJourney = createGenrePackRuntimeReceipt(pilot, {
      packId: "farm-life",
      source: "headless",
      booted: true,
      completedJourneyIds: [],
    });
    expect(evaluateGenrePackPlayableReadiness(pilot, "farm-life", missingJourney).playable).toBe(false);
  });

  it("BREAK: farm configuration rejects missing tools/seeds, invalid crop refs/bounds/routes, and lint/reference errors", () => {
    const withoutTools = createFarmingDemoProject();
    for (const item of withoutTools.database.items) {
      if (item.farmTool === "hoe" || item.farmTool === "wateringCan") delete withoutTools.session.inventory[item.id];
    }
    expect(evaluateGenrePackConfiguration(withoutTools, "farm-life").checks.find((check) => check.id === "farm-tools")?.configured).toBe(false);

    const withoutSeeds = createFarmingDemoProject();
    for (const crop of withoutSeeds.database.crops ?? []) delete withoutSeeds.session.inventory[crop.seedItemId];
    expect(evaluateGenrePackConfiguration(withoutSeeds, "farm-life").checks.find((check) => check.id === "farm-seeds")?.configured).toBe(false);

    const invalidCropRef = createFarmingDemoProject();
    invalidCropRef.database.crops![0]!.seedItemId = "missing_seed";
    const cropRefChecks = evaluateGenrePackConfiguration(invalidCropRef, "farm-life").checks;
    expect(cropRefChecks.find((check) => check.id === "crop-references")?.configured).toBe(false);
    expect(cropRefChecks.find((check) => check.id === "reference-integrity")?.configured).toBe(false);
    expect(cropRefChecks.find((check) => check.id === "lint-errors")?.configured).toBe(false);

    const invalidBounds = createFarmingDemoProject();
    const farmMap = invalidBounds.maps[invalidBounds.startMapId]!;
    farmMap.farmableArea = [{ x: farmMap.width, y: 0, w: 1, h: 1 }];
    expect(evaluateGenrePackConfiguration(invalidBounds, "farm-life").checks.find((check) => check.id === "farmable-bounds")?.configured).toBe(false);

    const invalidRoute = createFarmingDemoProject();
    invalidRoute.startPos = { x: -1, y: -1 };
    expect(evaluateGenrePackConfiguration(invalidRoute, "farm-life").checks.find((check) => check.id === "farm-start-route")?.configured).toBe(false);
  });

  it("BREAK: a receipt is rejected after the evaluated project changes", () => {
    const pilot = createFarmingDemoProject();
    const receipt = createGenrePackRuntimeReceipt(pilot, {
      packId: "farm-life",
      source: "runtime",
      booted: true,
      completedJourneyIds: [genrePackById("farm-life").journeys[0]!.id],
    });
    const firstSeedId = pilot.database.crops![0]!.seedItemId;
    delete pilot.session.inventory[firstSeedId];

    expect(evaluateGenrePackPlayableReadiness(pilot, "farm-life", receipt).receiptAccepted).toBe(false);
  });

  it("BREAK: Phase 4 imports the five canonical ids; welcome recipe ids are not genre aliases", () => {
    expect(isGenrePackId("horror-chase")).toBe(true);
    expect(isGenrePackId("horror-gallery")).toBe(false);
    expect(isGenrePackId("school-horror")).toBe(false);
    expect(welcomeGenrePresetById("horror-gallery")?.packId).toBe("horror-chase");
    expect(welcomeGenrePresetById("school-horror")?.packId).toBe("horror-chase");
  });
});
