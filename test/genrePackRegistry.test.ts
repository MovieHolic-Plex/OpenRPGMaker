import { describe, expect, it } from "vitest";
import {
  GENRE_PACK_IDS,
  createGenreBlankProjectSystemPresetPlan,
  createProjectFromGenreBlankProjectSystemPreset,
  genrePackById,
  materializeGenreBlankProjectSystemPreset,
} from "@/editor/genrePacks";
import {
  WELCOME_GENRE_PRESETS,
  welcomeGenrePresetById,
  welcomeGenreSystemPresetPlanById,
} from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";
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
      // 몬스터 수집만 손대지 않은 빈 시작 맵을 몬스터 칩셋 풀밭으로 옮긴다(칩셋 계열을 첫 맵에서 정한다).
      if (project.system.genre === "monster-collect") {
        const start = project.maps.map_blank_start!;
        expect(start.tilesetId).toBe("monster_overworld");
        expect(start.lowerTiles.every((tile) => tile === 0)).toBe(true);
        expect({ ...start, tilesetId: blank.maps.map_blank_start!.tilesetId, tileSize: blank.maps.map_blank_start!.tileSize, lowerTiles: blank.maps.map_blank_start!.lowerTiles })
          .toEqual(blank.maps.map_blank_start);
      } else expect(project.maps).toEqual(blank.maps);
      expect(project.database.crops).toEqual(blank.database.crops);
    }
  });

  it("BREAK: Phase 4 imports the five canonical ids; welcome recipe ids are not genre aliases", () => {
    expect(isGenrePackId("horror-chase")).toBe(true);
    expect(isGenrePackId("horror-gallery")).toBe(false);
    expect(isGenrePackId("school-horror")).toBe(false);
    expect(welcomeGenrePresetById("horror-gallery")?.packId).toBe("horror-chase");
    expect(welcomeGenrePresetById("school-horror")?.packId).toBe("horror-chase");
  });
});
