import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { GENRE_PACK_IDS, isGenrePackId } from "@/project/genrePackId";
import { applyGenrePreset } from "@/project/genrePresets";
import { isActionCombatMap } from "@/project/actionCombat";
import { deserialize, serialize } from "@/project/io/serialize";
import { projectLint } from "@/project/lint/projectLint";
import { evaluateGenrePackConfiguration, genrePackById } from "@/editor/genrePacks";
import { welcomeGenrePresetById, welcomeGenreSystemPresetPlanById } from "@/editor/welcomeGenrePresets";
import { NEW_PROJECT_GENRE_OPTIONS } from "@/editor/ui/newProjectDialog";

describe("supported action genre", () => {
  it("keeps the action genre in the registry and off the new-project start surface", () => {
    expect(isGenrePackId("action-rpg")).toBe(true);
    expect(genrePackById("action-rpg").starter.defaultRecipeId).toBe("action-system");
    expect(welcomeGenrePresetById("action-rpg")?.packId).toBe("action-rpg");
    expect(welcomeGenreSystemPresetPlanById("action-rpg").recipeId).toBe("action-system");
    expect(NEW_PROJECT_GENRE_OPTIONS.some((entry) => entry.id === "action-rpg")).toBe(false);
  });

  it("roundtrips action settings without turning on every map", () => {
    const project = createBlankProject();
    const beforeMaps = structuredClone(project.maps);
    applyGenrePreset(project, "action-rpg");
    const saved = deserialize(serialize(project));
    expect(saved.system.genre).toBe("action-rpg");
    expect(saved.system.actionCombat?.enabled).toBe(true);
    expect(project.maps).toEqual(beforeMaps);
    expect(Object.values(saved.maps).some((map) => isActionCombatMap(saved, map))).toBe(false);
    expect(evaluateGenrePackConfiguration(saved, "action-rpg").configured).toBe(false);
    const codes = projectLint(saved).map((issue) => issue.code);
    expect(codes).not.toContain("deprecated:action-combat");
    expect(codes).toContain("opt-in:action-combat-no-map");
  });

  it("preserves every existing genre and non-action runtime routing", () => {
    for (const genre of GENRE_PACK_IDS.filter((id) => id !== "action-rpg")) {
      const project = createBlankProject();
      applyGenrePreset(project, genre);
      const loaded = deserialize(serialize(project));
      expect(loaded.system.genre).toBe(genre);
      expect(loaded.system.actionCombat?.enabled).not.toBe(true);
      expect(isActionCombatMap(loaded, loaded.maps[loaded.startMapId])).toBe(false);
    }
  });
});
