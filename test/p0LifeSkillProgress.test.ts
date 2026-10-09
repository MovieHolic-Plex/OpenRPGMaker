import { describe, expect, it } from "vitest";
import { canCraft } from "@/project/craftRecipes";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { awardLifeSkillXp } from "@/project/lifeSkillProgress";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";

function skillProject() {
  const project = createBlankProject();
  const output = normalizeItemRecord({ id: "item_preserves", name: "Preserves", scope: "none", price: 100 });
  const index = project.database.items.findIndex((item) => item.id === output.id);
  if (index >= 0) project.database.items[index] = output;
  else project.database.items.push(output);
  project.switches.push({ id: "sw_farming_2", name: "Farming 2" });
  project.system.skillSystem = { enabled: true };
  project.system.craftRecipes = [{
    id: "recipe_preserves",
    ingredients: [],
    outputItemId: "item_preserves",
    requiresUnlock: true,
  }];
  project.database.lifeSkills = [{
    id: "skill_farming",
    name: "Farming",
    skillType: "farming",
    maxLevel: 5,
    levelUpRewards: [
      { level: 2, switchId: "sw_farming_2" },
      { level: 3, recipeId: "recipe_preserves" },
      { level: 4, switchId: "sw_farming_2", recipeId: "recipe_preserves" },
    ],
  }];
  return project;
}

describe("P0 life-skill progression", () => {
  it("applies every crossed level reward once and unlocks real crafting", () => {
    // Break caught: a multi-level XP award skips intermediate rewards or duplicates recipe ids.
    const project = skillProject();
    const session = startSession(project, 1);
    expect(canCraft(project, session, "recipe_preserves")).toMatchObject({ ok: false, reason: "locked" });

    expect(awardLifeSkillXp(project, session, "skill_farming", 500)).toMatchObject({
      ok: true,
      previousLevel: 1,
      level: 4,
      levelsGained: [2, 3, 4],
    });
    expect(session.lifeSkills?.skill_farming).toEqual({ xp: 500, level: 4 });
    expect(session.switches.sw_farming_2).toBe(true);
    expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);
    expect(canCraft(project, session, "recipe_preserves").ok).toBe(true);

    expect(awardLifeSkillXp(project, session, "skill_farming", 1)).toMatchObject({ ok: true, levelsGained: [] });
    expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid XP award %s without mutation",
    (amount) => {
      // Break caught: malformed or unsafe XP mutates progress before validation.
      const project = skillProject();
      const session = startSession(project, 2);
      expect(awardLifeSkillXp(project, session, "skill_farming", amount)).toMatchObject({ ok: false, reason: "invalid-amount" });
      expect(session.lifeSkills).toEqual({});
      expect(session.unlockedRecipeIds).toEqual([]);
      expect(session.switches.sw_farming_2).toBe(false);
    },
  );

  it("fails closed for disabled, unknown-skill, and malformed current progress", () => {
    // Break caught: an invalid state is normalized in-place and hides save corruption.
    const project = skillProject();
    const disabled = structuredClone(project);
    delete disabled.system.skillSystem;
    const disabledSession = startSession(disabled, 3);
    expect(awardLifeSkillXp(disabled, disabledSession, "skill_farming", 100)).toMatchObject({ ok: false, reason: "disabled" });

    const session = startSession(project, 4);
    expect(awardLifeSkillXp(project, session, "skill_missing", 100)).toMatchObject({ ok: false, reason: "missing-skill" });
    session.lifeSkills = { skill_farming: { xp: Number.NaN, level: 1 } };
    const before = structuredClone(session);
    expect(awardLifeSkillXp(project, session, "skill_farming", 100)).toMatchObject({ ok: false, reason: "invalid-state" });
    expect(session).toEqual(before);
  });

  it("validates crossed reward references before changing XP", () => {
    // Break caught: XP advances even though its switch/recipe reward cannot be applied.
    const project = skillProject();
    project.database.lifeSkills![0] = {
      ...project.database.lifeSkills![0]!,
      levelUpRewards: [{ level: 2, switchId: "sw_missing", recipeId: "recipe_missing" }],
    };
    const session = startSession(project, 5);
    const before = structuredClone(session);
    expect(awardLifeSkillXp(project, session, "skill_farming", 100)).toMatchObject({ ok: false, reason: "invalid-reward" });
    expect(session).toEqual(before);
  });

  it("routes the existing event command through recipe unlock rewards", () => {
    // Break caught: commandCatalog applies switchId but silently ignores recipeId.
    const project = skillProject();
    const session = startSession(project, 6);
    const interpreter = createInterpreter(
      [{ kind: "changeLifeSkillExp", skillId: "skill_farming", op: "+=", amount: 250 }],
      session,
      project,
    );
    interpreter.start();
    expect(session.lifeSkills?.skill_farming).toEqual({ xp: 250, level: 3 });
    expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);
  });
});
