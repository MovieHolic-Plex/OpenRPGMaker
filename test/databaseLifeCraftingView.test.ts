import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderTab(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderLifeCraftingTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

function setValue(host: FakeElement, testid: string, value: string): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing ${testid}`);
  control.value = value;
  control.dispatchEvent(new Event("change"));
}

describe("database life skill and crafting view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  afterEach(() => cleanupDom?.());

  // Break caught: life skill records have no list/detail editor or reward controls.
  it("authors a life skill and level reward, then undo restores the prior record", () => {
    const host = renderTab();
    findByTestId(host, "db-life-section-skills")?.click();
    findByTestId(host, "db-life-add")?.click();
    setValue(host, "db-life-skill-name", "농사");
    setValue(host, "db-life-skill-type", "farming");
    setValue(host, "db-life-skill-max-level", "10");
    findByTestId(host, "db-life-skill-reward-add")?.click();
    setValue(host, "db-life-skill-reward-level-0", "5");
    setValue(host, "db-life-skill-reward-switch-0", store.getCurrent().switches[0]?.id ?? "");

    expect(store.getCurrent().database.lifeSkills?.[0]).toMatchObject({
      name: "농사",
      skillType: "farming",
      maxLevel: 10,
      levelUpRewards: [{ level: 5 }],
    });
    expect(undoMapEdit()).toBe(true);
  });

  // Break caught: recipe ingredients and output only appear as a count in System.
  it("authors a recipe with ingredient and output item references", () => {
    const host = renderTab();
    findByTestId(host, "db-life-section-recipes")?.click();
    findByTestId(host, "db-life-add")?.click();
    const itemId = store.getCurrent().database.items[0]?.id ?? "";
    setValue(host, "db-life-recipe-name", "간식 만들기");
    setValue(host, "db-life-recipe-output-item", itemId);
    setValue(host, "db-life-recipe-output-count", "2");
    findByTestId(host, "db-life-recipe-ingredient-add")?.click();
    setValue(host, "db-life-recipe-ingredient-item-0", itemId);
    setValue(host, "db-life-recipe-ingredient-count-0", "3");

    expect(store.getCurrent().system.craftRecipes?.[0]).toMatchObject({
      name: "간식 만들기",
      outputItemId: itemId,
      outputCount: 2,
      ingredients: [{ itemId, count: 3 }],
    });
  });

  // Break caught: upgrades, prices, and tool actions have no structured record editor.
  it("authors upgrade, sell-price, and tool-action records through their detail forms", () => {
    const host = renderTab();
    const itemId = store.getCurrent().database.items[0]?.id ?? "";

    findByTestId(host, "db-life-section-upgrades")?.click();
    findByTestId(host, "db-life-add")?.click();
    setValue(host, "db-life-upgrade-from-item", itemId);
    setValue(host, "db-life-upgrade-to-item", itemId);
    setValue(host, "db-life-upgrade-gold-cost", "250");

    findByTestId(host, "db-life-section-sell-prices")?.click();
    findByTestId(host, "db-life-add")?.click();
    setValue(host, "db-life-sell-item", itemId);
    setValue(host, "db-life-sell-price", "80");

    findByTestId(host, "db-life-section-tool-actions")?.click();
    findByTestId(host, "db-life-add")?.click();
    setValue(host, "db-life-tool-item", itemId);
    setValue(host, "db-life-tool-farm-tool", "hoe");
    setValue(host, "db-life-tool-action", "till");

    expect(store.getCurrent().system.itemUpgrades?.[0]).toMatchObject({ fromItemId: itemId, toItemId: itemId, goldCost: 250 });
    expect(store.getCurrent().system.sellPrices?.[0]).toEqual({ itemId, price: 80 });
    expect(store.getCurrent().system.toolActions?.[0]).toMatchObject({ itemId, farmTool: "hoe", action: "till" });

    const restored = deserialize(serialize(store.getCurrent()));
    expect(restored.system.itemUpgrades?.[0]).toMatchObject({ fromItemId: itemId, toItemId: itemId, goldCost: 250 });
    expect(restored.system.sellPrices?.[0]).toEqual({ itemId, price: 80 });
    expect(restored.system.toolActions?.[0]).toMatchObject({ itemId, farmTool: "hoe", action: "till" });
  });

  // Break caught: editing an id or adding another sell row can create ambiguous duplicate keys.
  it("rejects duplicate record ids and chooses an unused sell-price item", () => {
    const host = renderTab();
    for (const section of ["skills", "recipes", "upgrades", "tool-actions"] as const) {
      findByTestId(host, `db-life-section-${section}`)?.click();
      findByTestId(host, "db-life-add")?.click();
      findByTestId(host, "db-life-add")?.click();
      const records = section === "skills"
        ? store.getCurrent().database.lifeSkills ?? []
        : section === "recipes"
          ? store.getCurrent().system.craftRecipes ?? []
          : section === "upgrades"
            ? store.getCurrent().system.itemUpgrades ?? []
            : store.getCurrent().system.toolActions ?? [];
      const firstId = records[0]?.id;
      const secondId = records[1]?.id;
      if (!firstId || !secondId) throw new Error(`missing ${section} ids`);
      const prefix = section === "skills" ? "skill" : section === "recipes" ? "recipe" : section === "upgrades" ? "upgrade" : "tool";
      setValue(host, `db-life-${prefix}-id`, firstId);
      const after = section === "skills"
        ? store.getCurrent().database.lifeSkills ?? []
        : section === "recipes"
          ? store.getCurrent().system.craftRecipes ?? []
          : section === "upgrades"
            ? store.getCurrent().system.itemUpgrades ?? []
            : store.getCurrent().system.toolActions ?? [];
      expect(after[1]?.id).toBe(secondId);
    }

    findByTestId(host, "db-life-section-sell-prices")?.click();
    findByTestId(host, "db-life-add")?.click();
    findByTestId(host, "db-life-add")?.click();
    const prices = store.getCurrent().system.sellPrices ?? [];
    expect(prices).toHaveLength(2);
    expect(prices[0]?.itemId).not.toBe(prices[1]?.itemId);
  });

  // Break caught: deleting records leaves craftRecipe/applyItemUpgrade/changeLifeSkillExp commands dangling.
  it("blocks deletion while event commands reference the selected life records", () => {
    const project = createBlankProject();
    const itemId = project.database.items[0]?.id ?? "";
    project.database.lifeSkills = [{ id: "life_ref", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] }];
    project.system.craftRecipes = [{ id: "recipe_ref", ingredients: [], outputItemId: itemId }];
    project.system.itemUpgrades = [{ id: "upgrade_ref", fromItemId: itemId, toItemId: itemId }];
    project.maps[project.startMapId]?.events.push({
      id: "life_commands",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [
        { kind: "changeLifeSkillExp", skillId: "life_ref", op: "+=", amount: 1 },
        { kind: "craftRecipe", recipeId: "recipe_ref" },
        { kind: "applyItemUpgrade", upgradeId: "upgrade_ref" },
      ],
    });
    store.replace(project);
    const host = renderTab();

    for (const section of ["skills", "recipes", "upgrades"] as const) {
      findByTestId(host, `db-life-section-${section}`)?.click();
      findByTestId(host, "db-life-delete")?.click();
    }

    expect(store.getCurrent().database.lifeSkills).toHaveLength(1);
    expect(store.getCurrent().system.craftRecipes).toHaveLength(1);
    expect(store.getCurrent().system.itemUpgrades).toHaveLength(1);
  });
});
