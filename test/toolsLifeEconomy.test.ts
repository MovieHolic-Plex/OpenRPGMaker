// 생활·경제 저작 파사드(LIFE_ECONOMY_TOOLS)가 실제로 어떤 Project 필드를 쓰는지 고정한다.
// 2026-08-27 커버리지 감사: 에디터 UI 는 쓰는데 어떤 툴도 못 쓰던 필드들.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import type { Project } from "@/project/types";

function project(): Project {
  const created = createEmptyToolProject("생활 경제");
  created.database.items = [
    normalizeItemRecord({ id: "wood", name: "목재", price: 20 }),
    normalizeItemRecord({ id: "plank", name: "판자", price: 60 }),
    normalizeItemRecord({ id: "hoe_basic", name: "낡은 괭이", farmTool: "hoe" }),
    normalizeItemRecord({ id: "hoe_gold", name: "황금 괭이", farmTool: "hoe" }),
  ];
  created.switches.push({ id: "sw_town", name: "마을 해금" });
  created.session.switches.sw_town = false;
  return created;
}

describe("upsert_craft_recipe → system.craftRecipes", () => {
  it("writes and then updates the recipe by id", () => {
    const ctx = { project: project() };
    const added = runTool(ctx, "upsert_craft_recipe", {
      recipe: { id: "r_plank", name: "판자 제작", ingredients: [{ itemId: "wood", count: 2 }], outputItemId: "plank", outputCount: 1, goldCost: 5, requiresUnlock: true },
    });
    expect(added.ok, added.summary).toBe(true);
    expect(ctx.project.system.craftRecipes).toEqual([
      { id: "r_plank", name: "판자 제작", ingredients: [{ itemId: "wood", count: 2 }], outputItemId: "plank", outputCount: 1, goldCost: 5, requiresUnlock: true },
    ]);

    const updated = runTool(ctx, "upsert_craft_recipe", {
      recipe: { id: "r_plank", ingredients: [{ itemId: "wood", count: 4 }], outputItemId: "plank", outputCount: 2 },
    });
    expect(updated.ok, updated.summary).toBe(true);
    expect(ctx.project.system.craftRecipes).toHaveLength(1);
    expect(ctx.project.system.craftRecipes?.[0]?.ingredients).toEqual([{ itemId: "wood", count: 4 }]);
    expect(ctx.project.system.craftRecipes?.[0]?.outputCount).toBe(2);
  });

  it("rejects an unknown itemId and names valid item ids", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "upsert_craft_recipe", {
      recipe: { id: "r_bad", ingredients: [{ itemId: "ghost", count: 1 }], outputItemId: "plank" },
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("wood");
    expect(result.summary).toContain("plank");
    expect(ctx.project.system.craftRecipes ?? []).toEqual([]);
  });
});

describe("delete_craft_recipe → system.craftRecipes", () => {
  it("removes exactly the requested recipe", () => {
    const ctx = { project: project() };
    ctx.project.system.craftRecipes = [
      { id: "r_a", ingredients: [{ itemId: "wood", count: 1 }], outputItemId: "plank" },
      { id: "r_b", ingredients: [{ itemId: "wood", count: 2 }], outputItemId: "plank" },
    ];
    const result = runTool(ctx, "delete_craft_recipe", { id: "r_a" });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.system.craftRecipes?.map((recipe) => recipe.id)).toEqual(["r_b"]);
  });

  it("reports a missing id with the existing recipe ids", () => {
    const ctx = { project: project() };
    ctx.project.system.craftRecipes = [{ id: "r_b", ingredients: [], outputItemId: "plank" }];
    const result = runTool(ctx, "delete_craft_recipe", { id: "r_missing" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("r_b");
    expect(ctx.project.system.craftRecipes).toHaveLength(1);
  });
});

describe("upsert_item_upgrade → system.itemUpgrades", () => {
  it("writes the upgrade row with tool capability", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "upsert_item_upgrade", {
      upgrade: {
        id: "u_hoe",
        fromItemId: "hoe_basic",
        toItemId: "hoe_gold",
        goldCost: 300,
        ingredients: [{ itemId: "wood", count: 3 }],
        capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 0.5 },
      },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.system.itemUpgrades).toEqual([
      {
        id: "u_hoe",
        fromItemId: "hoe_basic",
        toItemId: "hoe_gold",
        goldCost: 300,
        ingredients: [{ itemId: "wood", count: 3 }],
        capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 0.5 },
      },
    ]);
  });

  it("rejects an unknown toItemId and names valid item ids", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "upsert_item_upgrade", { upgrade: { id: "u_bad", fromItemId: "hoe_basic", toItemId: "ghost" } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("hoe_gold");
    expect(ctx.project.system.itemUpgrades ?? []).toEqual([]);
  });

  it("rejects an out-of-range capability", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "upsert_item_upgrade", {
      upgrade: { id: "u_big", fromItemId: "hoe_basic", toItemId: "hoe_gold", capability: { areaWidth: 20, areaHeight: 20, energyMultiplier: 1 } },
    });
    expect(result.ok).toBe(false);
    expect(ctx.project.system.itemUpgrades ?? []).toEqual([]);
  });
});

describe("set_sell_prices → system.sellPrices", () => {
  it("upserts entries and removes by removeItemIds", () => {
    const ctx = { project: project() };
    const written = runTool(ctx, "set_sell_prices", { entries: [{ itemId: "wood", price: 12 }, { itemId: "plank", price: 40 }] });
    expect(written.ok, written.summary).toBe(true);
    expect(ctx.project.system.sellPrices).toEqual([{ itemId: "wood", price: 12 }, { itemId: "plank", price: 40 }]);

    const changed = runTool(ctx, "set_sell_prices", { entries: [{ itemId: "wood", price: 30 }], removeItemIds: ["plank"] });
    expect(changed.ok, changed.summary).toBe(true);
    expect(ctx.project.system.sellPrices).toEqual([{ itemId: "wood", price: 30 }]);
  });

  it("rejects an unknown itemId and names valid item ids", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "set_sell_prices", { entries: [{ itemId: "ghost", price: 1 }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("wood");
    expect(ctx.project.system.sellPrices ?? []).toEqual([]);
  });
});

describe("upsert_tool_action → system.toolActions", () => {
  it("writes the rule row", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "upsert_tool_action", {
      rule: { id: "ta_chop", farmTool: "axe", itemId: "hoe_gold", requiresFarmable: false, targetPlaceableKind: "tree", action: "chop" },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.system.toolActions).toEqual([
      { id: "ta_chop", farmTool: "axe", itemId: "hoe_gold", requiresFarmable: false, targetPlaceableKind: "tree", action: "chop" },
    ]);
  });

  it("rejects an unknown itemId and names valid item ids", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "upsert_tool_action", { rule: { id: "ta_bad", itemId: "ghost", action: "till" } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("hoe_basic");
    expect(ctx.project.system.toolActions ?? []).toEqual([]);
  });
});

describe("configure_life_economy → energy/shipping/bundles/worldUnlocks/makers", () => {
  it("writes only the sections passed and preserves the others", () => {
    const ctx = { project: project() };
    const energy = runTool(ctx, "configure_life_economy", { energy: { max: 100, initial: 80, restorePerDay: 90 } });
    expect(energy.ok, energy.summary).toBe(true);
    expect(ctx.project.system.energy).toEqual({ max: 100, initial: 80, restorePerDay: 90 });

    const shipping = runTool(ctx, "configure_life_economy", { shipping: { enabled: true, historyLimit: 30, allowedItemIds: ["wood"] } });
    expect(shipping.ok, shipping.summary).toBe(true);
    expect(ctx.project.system.shipping).toEqual({ enabled: true, historyLimit: 30, allowedItemIds: ["wood"] });
    expect(ctx.project.system.energy).toEqual({ max: 100, initial: 80, restorePerDay: 90 });

    const rest = runTool(ctx, "configure_life_economy", {
      worldUnlocks: [{ id: "wu_beach", name: "해변", switchId: "sw_town" }],
      bundles: [{ id: "b_wood", name: "목재 꾸러미", requirements: [{ itemId: "wood", count: 5 }], reward: { gold: 100, itemRewards: [{ itemId: "plank", count: 1 }], switchId: "sw_town", worldUnlockIds: ["wu_beach"] } }],
      makers: [{ id: "m_saw", name: "제재기", inputs: [{ itemId: "wood", count: 2 }], outputs: [{ itemId: "plank", count: 1 }], durationMinutes: 120 }],
    });
    expect(rest.ok, rest.summary).toBe(true);
    expect(ctx.project.system.worldUnlocks).toEqual([{ id: "wu_beach", name: "해변", switchId: "sw_town" }]);
    expect(ctx.project.system.bundles?.[0]?.requirements).toEqual([{ itemId: "wood", count: 5 }]);
    expect(ctx.project.system.bundles?.[0]?.reward).toEqual({ gold: 100, itemRewards: [{ itemId: "plank", count: 1 }], switchId: "sw_town", worldUnlockIds: ["wu_beach"] });
    expect(ctx.project.system.makers).toEqual([
      { id: "m_saw", name: "제재기", inputs: [{ itemId: "wood", count: 2 }], outputs: [{ itemId: "plank", count: 1 }], durationMinutes: 120 },
    ]);
    expect(ctx.project.system.energy?.max).toBe(100);
    expect(ctx.project.system.shipping?.enabled).toBe(true);
  });

  it("rejects an unknown switchId and names valid switch ids", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "configure_life_economy", { worldUnlocks: [{ id: "wu_bad", switchId: "sw_ghost" }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("sw_town");
    expect(ctx.project.system.worldUnlocks).toBeUndefined();
  });

  it("rejects a bundle recipeId that no craft recipe defines", () => {
    const ctx = { project: project() };
    ctx.project.system.craftRecipes = [{ id: "r_known", ingredients: [], outputItemId: "plank" }];
    const result = runTool(ctx, "configure_life_economy", {
      bundles: [{ id: "b_bad", requirements: [{ itemId: "wood", count: 1 }], reward: { recipeIds: ["r_ghost"] } }],
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("r_known");
    expect(ctx.project.system.bundles).toBeUndefined();
  });

  it("rejects an empty call so the model cannot silently no-op", () => {
    const ctx = { project: project() };
    const result = runTool(ctx, "configure_life_economy", {});
    expect(result.ok).toBe(false);
  });
});
