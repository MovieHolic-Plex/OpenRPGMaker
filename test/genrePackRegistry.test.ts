import { describe, expect, it } from "vitest";
import {
  GENRE_PACK_IDS,
  createGenreBlankProjectSystemPresetPlan,
  createProjectFromGenreBlankProjectSystemPreset,
  evaluateGenrePackConfiguration,
  evaluateGenrePackPlayableReadiness,
  genrePackById,
  materializeGenreBlankProjectSystemPreset,
} from "@/editor/genrePacks";
import {
  WELCOME_GENRE_PRESETS,
  welcomeGenrePresetById,
  welcomeGenreSystemPresetPlanById,
} from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { isGenrePackId } from "@/project/genrePackId";

describe("genre pack registry contract", () => {
  it("all official packs expose complete machine-readable guidance", () => {
    expect(GENRE_PACK_IDS).toEqual([
      "adventure-jrpg",
      "monster-collect",
      "horror-chase",
      "story-cutscene",
      "farm-life",
      "action-rpg",
    ]);

    for (const packId of GENRE_PACK_IDS) {
      const pack = genrePackById(packId);
      expect(pack.id).toBe(packId);
      expect(pack.starter.defaultRecipeId).toBeTruthy();
      expect(pack.navigation.sections.length).toBeGreaterThan(0);
      expect(Object.keys(pack.vocabulary).length).toBeGreaterThan(0);
      expect(pack.recipes.length).toBeGreaterThan(0);
      expect(pack.recipes.every((recipe) => recipe.appliesSystemFields.length > 0)).toBe(true);
      expect(pack.lint.length).toBeGreaterThan(0);
      expect(pack.journeys.length).toBeGreaterThan(0);
      expect(pack.runtimeRequirements.length).toBeGreaterThan(0);
      expect(pack.recipes.some((recipe) => recipe.id === pack.starter.defaultRecipeId)).toBe(true);
    }
  });

  it("BREAK: every welcome card resolves to a real pack recipe without AI", () => {
    expect(WELCOME_GENRE_PRESETS).toHaveLength(8);
    for (const preset of WELCOME_GENRE_PRESETS) {
      const pack = genrePackById(preset.packId);
      expect(pack.recipes.some((recipe) => recipe.id === preset.systemPresetRecipeId)).toBe(true);
      expect(welcomeGenreSystemPresetPlanById(preset.id)).toMatchObject({
        kind: "blank-project-system-preset",
        packId: preset.packId,
        recipeId: preset.systemPresetRecipeId,
        projectSchema: "Project",
        preservesOpenProjectUntilRemoteVerified: true,
        aiRequired: false,
      });
    }
  });

  it("BREAK: planning and materializing a starter is detached from an open project", () => {
    const openProject = createBlankProject();
    openProject.meta.title = "keep me";
    const before = structuredClone(openProject);

    const plan = createGenreBlankProjectSystemPresetPlan("farm-life", "farm-system");
    const starter = createProjectFromGenreBlankProjectSystemPreset(plan);

    expect(openProject).toEqual(before);
    expect(starter).not.toBe(openProject);
    expect(starter.system.genre).toBe("farm-life");
    expect(starter.system.timeSystem?.enabled).toBe(true);
    expect(starter.database.crops).toHaveLength(createBlankProject().database.crops?.length ?? 0);
    expect(starter.maps).toEqual(createBlankProject().maps);
  });

  it("BREAK: welcome choices are honestly blank-project system presets, not authored starters", () => {
    const results = WELCOME_GENRE_PRESETS.map((preset) =>
      materializeGenreBlankProjectSystemPreset(welcomeGenreSystemPresetPlanById(preset.id)),
    );
    const blank = createBlankProject();

    for (const packId of GENRE_PACK_IDS) {
      for (const recipe of genrePackById(packId).recipes) {
        expect(recipe.starterKind).toBe("blank-project-system-preset");
        expect(recipe).not.toHaveProperty("adapterId");
      }
    }
    for (const { project, receipt } of results) {
      expect(receipt.authoredContentSeeded).toBe(false);
      expect(receipt.appliedSystemGenre).toBe(project.system.genre);
      expect(project.maps).toEqual(blank.maps);
      expect(project.database.crops).toEqual(blank.database.crops);
    }
  });

  it("BREAK: farm configured remains unverified until the Phase 4 runner-backed adapter exists", () => {
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
      status: "unverified",
      receiptAccepted: false,
    });

    const forgedReceipt = {
      contractVersion: 1,
      packId: "farm-life",
      source: "headless",
      booted: true,
      completedJourneyIds: [genrePackById("farm-life").journeys[0]!.id],
      lintErrorCount: 0,
      referenceIssueCount: 0,
      projectSignature: "caller-controlled",
    };
    const evaluateWithForgedThirdArgument = evaluateGenrePackPlayableReadiness as unknown as (
      project: typeof pilot,
      packId: "farm-life",
      receipt: unknown,
    ) => ReturnType<typeof evaluateGenrePackPlayableReadiness>;
    expect(evaluateWithForgedThirdArgument(pilot, "farm-life", forgedReceipt)).toMatchObject({
      configured: true,
      playable: false,
      status: "unverified",
      receiptAccepted: false,
    });
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

  it("BREAK: caller-shaped evidence cannot make readiness playable", () => {
    const pilot = createFarmingDemoProject();
    const forgedReceipt = {
      contractVersion: 1,
      packId: "farm-life",
      source: "runtime",
      booted: true,
      completedJourneyIds: [genrePackById("farm-life").journeys[0]!.id],
    };
    const evaluateWithForgedThirdArgument = evaluateGenrePackPlayableReadiness as unknown as (
      project: typeof pilot,
      packId: "farm-life",
      receipt: unknown,
    ) => ReturnType<typeof evaluateGenrePackPlayableReadiness>;
    expect(evaluateWithForgedThirdArgument(pilot, "farm-life", forgedReceipt)).toMatchObject({
      configured: true,
      playable: false,
      status: "unverified",
      receiptAccepted: false,
    });
  });

  it("BREAK: Phase 4 imports the five canonical ids; welcome recipe ids are not genre aliases", () => {
    expect(isGenrePackId("horror-chase")).toBe(true);
    expect(isGenrePackId("horror-gallery")).toBe(false);
    expect(isGenrePackId("school-horror")).toBe(false);
    expect(welcomeGenrePresetById("horror-gallery")?.packId).toBe("horror-chase");
    expect(welcomeGenrePresetById("school-horror")?.packId).toBe("horror-chase");
  });
});
