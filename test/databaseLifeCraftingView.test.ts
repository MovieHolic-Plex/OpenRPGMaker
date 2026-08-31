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

function setChecked(host: FakeElement, testid: string, checked: boolean): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing ${testid}`);
  control.checked = checked;
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

  // Break caught: the runtime understands locked recipes and upgraded tool reach,
  // but the structured editor drops those fields because it has no controls for them.
  it("authors recipe unlock requirements and tool capability fields", () => {
    const host = renderTab();

    findByTestId(host, "db-life-section-recipes")?.click();
    findByTestId(host, "db-life-add")?.click();
    setChecked(host, "db-life-recipe-requires-unlock", true);

    findByTestId(host, "db-life-section-upgrades")?.click();
    findByTestId(host, "db-life-add")?.click();
    setChecked(host, "db-life-upgrade-capability-enabled", true);
    setValue(host, "db-life-upgrade-area-width", "3");
    setValue(host, "db-life-upgrade-area-height", "2");
    setValue(host, "db-life-upgrade-energy-multiplier", "0.75");

    expect(store.getCurrent().system.craftRecipes?.[0]?.requiresUnlock).toBe(true);
    expect(store.getCurrent().system.itemUpgrades?.[0]?.capability).toEqual({
      areaWidth: 3,
      areaHeight: 2,
      energyMultiplier: 0.75,
    });
    const restored = deserialize(serialize(store.getCurrent()));
    expect(restored.system.craftRecipes?.[0]?.requiresUnlock).toBe(true);
    expect(restored.system.itemUpgrades?.[0]?.capability?.areaWidth).toBe(3);
  });

  it("clamps authored tool capability axes to the runtime-safe 9x9 limit", () => {
    const host = renderTab();
    findByTestId(host, "db-life-section-upgrades")?.click();
    findByTestId(host, "db-life-add")?.click();
    setChecked(host, "db-life-upgrade-capability-enabled", true);

    setValue(host, "db-life-upgrade-area-width", "99");
    setValue(host, "db-life-upgrade-area-height", "999999");

    expect(store.getCurrent().system.itemUpgrades?.[0]?.capability).toMatchObject({ areaWidth: 9, areaHeight: 9 });
  });

  // Break caught: energy and shipping are schema-only packages and shipping's
  // enabled toggle must not erase history/item policy while it is off.
  it("creates energy and shipping settings and preserves disabled shipping values", () => {
    const host = renderTab();

    findByTestId(host, "db-life-section-energy")?.click();
    expect(findByTestId(host, "db-life-package-create")).not.toBeNull();
    findByTestId(host, "db-life-package-create")?.click();
    setValue(host, "db-life-energy-max", "180");
    setValue(host, "db-life-energy-initial", "120");
    setValue(host, "db-life-energy-restore", "90");

    findByTestId(host, "db-life-section-shipping")?.click();
    findByTestId(host, "db-life-package-create")?.click();
    setValue(host, "db-life-shipping-history-limit", "14");
    const itemId = store.getCurrent().database.items[0]?.id;
    if (!itemId) throw new Error("missing default item");
    setChecked(host, "db-life-shipping-all-items", false);
    setChecked(host, `db-life-shipping-item-${itemId}`, true);
    setChecked(host, "db-life-shipping-enabled", false);

    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.getCurrent().system.energy).toEqual({ max: 180, initial: 120, restorePerDay: 90 });
    expect(store.getCurrent().system.shipping).toEqual({
      enabled: false,
      historyLimit: 14,
      allowedItemIds: [itemId],
    });
    expect(findByTestId(host, "db-life-shipping-history-limit")?.value).toBe("14");
  });

  // Break caught: world unlock, bundle, and maker records have no discoverable
  // add/detail/duplicate/delete workflow even though they are persisted by ProjectIO.
  it("authors world unlock, bundle rewards, and maker processing without raw JSON", () => {
    const project = createBlankProject();
    project.switches.push({ id: "sw_unlock", name: "해금" });
    store.replace(project);
    const host = renderTab();
    const itemId = store.getCurrent().database.items[0]?.id;
    if (!itemId) throw new Error("missing default item");

    findByTestId(host, "db-life-section-world-unlocks")?.click();
    findByTestId(host, "db-life-empty-add")?.click();
    setValue(host, "db-life-world-unlock-id", "unlock_bridge");
    setValue(host, "db-life-world-unlock-name", "다리 수리");
    setValue(host, "db-life-world-unlock-switch", "sw_unlock");
    findByTestId(host, "db-life-duplicate")?.click();
    expect(store.getCurrent().system.worldUnlocks).toHaveLength(2);
    expect(store.getCurrent().system.worldUnlocks?.[1]?.id).not.toBe("unlock_bridge");

    findByTestId(host, "db-life-section-recipes")?.click();
    findByTestId(host, "db-life-add")?.click();
    const recipeId = store.getCurrent().system.craftRecipes?.[0]?.id;
    if (!recipeId) throw new Error("missing recipe");

    findByTestId(host, "db-life-section-bundles")?.click();
    findByTestId(host, "db-life-empty-add")?.click();
    setValue(host, "db-life-bundle-name", "봄 채집 꾸러미");
    findByTestId(host, "db-life-bundle-requirement-add")?.click();
    setValue(host, "db-life-bundle-requirement-item-0", itemId);
    setValue(host, "db-life-bundle-requirement-count-0", "5");
    setValue(host, "db-life-bundle-reward-gold", "500");
    findByTestId(host, "db-life-bundle-reward-item-add")?.click();
    setValue(host, "db-life-bundle-reward-item-item-0", itemId);
    setValue(host, "db-life-bundle-reward-item-count-0", "2");
    setValue(host, "db-life-bundle-reward-switch", "sw_unlock");
    setChecked(host, "db-life-bundle-unlock-unlock_bridge", true);
    setChecked(host, `db-life-bundle-recipe-${recipeId}`, true);

    findByTestId(host, "db-life-section-makers")?.click();
    findByTestId(host, "db-life-empty-add")?.click();
    setValue(host, "db-life-maker-name", "치즈 프레스");
    setValue(host, "db-life-maker-duration", "120");
    findByTestId(host, "db-life-maker-input-add")?.click();
    setValue(host, "db-life-maker-input-item-0", itemId);
    setValue(host, "db-life-maker-input-count-0", "1");
    findByTestId(host, "db-life-maker-output-add")?.click();
    setValue(host, "db-life-maker-output-item-0", itemId);
    setValue(host, "db-life-maker-output-count-0", "1");

    expect(store.getCurrent().system.bundles?.[0]).toMatchObject({
      name: "봄 채집 꾸러미",
      requirements: [{ itemId, count: 5 }],
      reward: {
        gold: 500,
        itemRewards: [{ itemId, count: 2 }],
        switchId: "sw_unlock",
        worldUnlockIds: ["unlock_bridge"],
        recipeIds: [recipeId],
      },
    });
    expect(store.getCurrent().system.makers?.[0]).toMatchObject({
      name: "치즈 프레스",
      durationMinutes: 120,
      inputs: [{ itemId, count: 1 }],
      outputs: [{ itemId, count: 1 }],
    });
    expect(deserialize(serialize(store.getCurrent())).system.bundles?.[0]?.reward?.recipeIds).toEqual([recipeId]);
  });

  // Break caught: duplicate ids and deleting a reward target can make package
  // references ambiguous or dangling; undo must also cover collection actions.
  it("rejects duplicate package ids, guards reward targets, and records undo", () => {
    const project = createBlankProject();
    const itemId = project.database.items[0]?.id ?? "";
    project.system.worldUnlocks = [{ id: "unlock_mine", name: "광산" }];
    project.system.craftRecipes = [{ id: "recipe_gate", ingredients: [], outputItemId: itemId }];
    project.system.bundles = [{
      id: "bundle_gate",
      requirements: [{ itemId, count: 1 }],
      reward: { worldUnlockIds: ["unlock_mine"], recipeIds: ["recipe_gate"] },
    }];
    store.replace(project);
    const host = renderTab();

    findByTestId(host, "db-life-section-world-unlocks")?.click();
    findByTestId(host, "db-life-add")?.click();
    const secondId = store.getCurrent().system.worldUnlocks?.[1]?.id;
    if (!secondId) throw new Error("missing second unlock");
    setValue(host, "db-life-world-unlock-id", "unlock_mine");
    expect(store.getCurrent().system.worldUnlocks?.[1]?.id).toBe(secondId);

    findByTestId(host, "db-life-delete")?.click();
    expect(store.getCurrent().system.worldUnlocks).toHaveLength(1);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().system.worldUnlocks).toHaveLength(2);

    findByTestId(host, "db-life-section-world-unlocks")?.click();
    findByTestId(host, "db-life-row-unlock_mine")?.click();
    findByTestId(host, "db-life-delete")?.click();
    expect(store.getCurrent().system.worldUnlocks?.some((entry) => entry.id === "unlock_mine")).toBe(true);

    findByTestId(host, "db-life-section-recipes")?.click();
    findByTestId(host, "db-life-row-recipe_gate")?.click();
    findByTestId(host, "db-life-delete")?.click();
    expect(store.getCurrent().system.craftRecipes).toHaveLength(1);
  });

  it("blocks renaming referenced skill, recipe, upgrade, and world-unlock ids", () => {
    // Break caught: delete guards protect references, but editing the same ID
    // field immediately leaves event and bundle references dangling.
    const project = createBlankProject();
    const itemId = project.database.items[0]?.id ?? "";
    project.database.lifeSkills = [{ id: "life_ref", name: "농사", skillType: "farming", maxLevel: 5, levelUpRewards: [] }];
    project.system.craftRecipes = [{ id: "recipe_ref", ingredients: [], outputItemId: itemId }];
    project.system.itemUpgrades = [{ id: "upgrade_ref", fromItemId: itemId, toItemId: itemId }];
    project.system.worldUnlocks = [{ id: "unlock_ref", name: "다리" }];
    project.system.bundles = [{
      id: "bundle_ref",
      requirements: [{ itemId, count: 1 }],
      reward: { recipeIds: ["recipe_ref"], worldUnlockIds: ["unlock_ref"] },
    }];
    project.maps[project.startMapId]?.events.push({
      id: "rename_refs",
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

    for (const [section, row, field, original] of [
      ["skills", "life_ref", "skill", "life_ref"],
      ["recipes", "recipe_ref", "recipe", "recipe_ref"],
      ["upgrades", "upgrade_ref", "upgrade", "upgrade_ref"],
      ["world-unlocks", "unlock_ref", "world-unlock", "unlock_ref"],
    ] as const) {
      findByTestId(host, `db-life-section-${section}`)?.click();
      findByTestId(host, `db-life-row-${row}`)?.click();
      setValue(host, `db-life-${field}-id`, `${original}_renamed`);
    }

    expect(store.getCurrent().database.lifeSkills?.[0]?.id).toBe("life_ref");
    expect(store.getCurrent().system.craftRecipes?.[0]?.id).toBe("recipe_ref");
    expect(store.getCurrent().system.itemUpgrades?.[0]?.id).toBe("upgrade_ref");
    expect(store.getCurrent().system.worldUnlocks?.[0]?.id).toBe("unlock_ref");
  });

  it("keeps section switching in a tab strip and does not dump every section into the empty detail", () => {
    const host = renderTab();
    findByTestId(host, "db-life-section-skills")?.click();
    const header = findByTestId(host, "db-life-crafting-header");
    expect(header).not.toBeNull();
    expect(header?.querySelector("h2")).toBeNull();
    expect(findByTestId(host, "db-life-section-makers")).not.toBeNull();
    expect(findByTestId(host, "db-life-empty-add")).not.toBeNull();
    expect(findByTestId(host, "db-life-board-makers")).toBeNull();
    expect(findByTestId(host, "db-life-stats")).toBeNull();
    expect(findByTestId(host, "db-life-list-pane-skills")).not.toBeNull();

    findByTestId(host, "db-life-section-energy")?.click();
    expect(findByTestId(host, "db-life-list-pane-energy")).not.toBeNull();
    expect(findByTestId(host, "db-life-package-create")).not.toBeNull();
    expect(findByTestId(host, "db-life-board-skills")).toBeNull();
  });
});
