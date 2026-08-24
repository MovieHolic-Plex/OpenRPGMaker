import { beforeEach, describe, expect, it } from "vitest";
import { databaseReferenceMessage, switchVariableReferenceMessage } from "@/editor/databaseReferences";
import { createBlankProject } from "@/project/defaults";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { store } from "@/project/store";

describe("life authoring reference integrity", () => {
  beforeEach(() => store.replace(createBlankProject()));

  // Break caught: records created by the life UI can point at missing switches, recipes, or items without lint errors.
  it("reports every switch, recipe, and item reference exposed by the structured forms", () => {
    const project = createBlankProject();
    project.database.lifeSkills = [{
      id: "life_farming",
      name: "농사",
      skillType: "farming",
      maxLevel: 10,
      levelUpRewards: [{ level: 2, switchId: "missing_switch", recipeId: "missing_recipe" }],
    }];
    project.system.craftRecipes = [{
      id: "recipe_broken",
      ingredients: [{ itemId: "missing_ingredient", count: 1 }],
      outputItemId: "missing_output",
    }];
    project.system.itemUpgrades = [{
      id: "upgrade_broken",
      fromItemId: "missing_from",
      toItemId: "missing_to",
      ingredients: [{ itemId: "missing_upgrade_material", count: 1 }],
    }];
    project.system.sellPrices = [{ itemId: "missing_sell", price: 10 }];
    project.system.toolActions = [{ id: "tool_broken", itemId: "missing_tool", action: "till" }];

    const issues = collectProjectReferenceIssues(project).join("\n");

    for (const id of [
      "missing_switch", "missing_recipe", "missing_ingredient", "missing_output", "missing_from",
      "missing_to", "missing_upgrade_material", "missing_sell", "missing_tool",
    ]) expect(issues).toContain(id);
  });

  // Break caught: the separately developed P0 and editor validators both report
  // the same life-skill reward reference after integration.
  it("reports each missing life-skill reward reference once", () => {
    const project = createBlankProject();
    project.database.lifeSkills = [{
      id: "life_farming",
      name: "농사",
      skillType: "farming",
      maxLevel: 10,
      levelUpRewards: [{ level: 2, switchId: "missing_switch", recipeId: "missing_recipe" }],
    }];
    project.system.skillSystem = { enabled: true };

    const issues = collectProjectReferenceIssues(project);

    expect(issues.filter((issue) => issue.includes("missing_switch"))).toHaveLength(1);
    expect(issues.filter((issue) => issue.includes("missing_recipe"))).toHaveLength(1);
  });

  // Break caught: deleting an item or switch used by life authoring is allowed by the editor guard.
  it("blocks item and switch deletion when life records still reference them", () => {
    const project = store.getCurrent();
    const itemId = project.database.items[0]?.id;
    const switchId = project.switches[0]?.id;
    if (!itemId || !switchId) throw new Error("missing default ids");
    project.system.craftRecipes = [{ id: "recipe", ingredients: [], outputItemId: itemId }];
    project.database.lifeSkills = [{
      id: "life_farming",
      name: "농사",
      skillType: "farming",
      maxLevel: 10,
      levelUpRewards: [{ level: 2, switchId }],
    }];
    store.replace(project);

    expect(databaseReferenceMessage("items", itemId)).toContain("제작");
    expect(switchVariableReferenceMessage("switch", switchId)).toContain("생활 기술");
  });

  // Break caught: ambiguous sell-price keys and duplicate tool rule ids are accepted silently.
  it("reports duplicate sell-price item keys and tool-action ids", () => {
    const project = createBlankProject();
    const itemId = project.database.items[0]?.id;
    if (!itemId) throw new Error("missing default item");
    project.system.sellPrices = [{ itemId, price: 10 }, { itemId, price: 20 }];
    project.system.toolActions = [
      { id: "same-tool-rule", itemId, action: "till" },
      { id: "same-tool-rule", itemId, action: "water" },
    ];

    const issues = collectProjectReferenceIssues(project).join("\n");

    expect(issues).toContain(`sellPrices: duplicate itemId: ${itemId}`);
    expect(issues).toContain("toolAction same-tool-rule: duplicate id");
  });
});
