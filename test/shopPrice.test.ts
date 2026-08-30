import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { resolveShopBuyUnitPrice, resolveShopSellUnitPrice } from "@/project/shopPrice";
import { shouldRestock } from "@/project/shopStock";
import type { Command } from "@/project/types";

function shop(overrides: Partial<Extract<Command, { kind: "shop" }>> = {}): Extract<Command, { kind: "shop" }> {
  return {
    kind: "shop",
    itemIds: ["item_potion"],
    ...overrides,
  };
}

describe("shop price unification", () => {
  it("Given / When / Then loyalty and closing sale never break sell < buy", () => {
    const project = createBlankProject();
    project.database.items = [{
      ...(project.database.items[0] ?? {
        id: "item_potion",
        name: "회복약",
        description: "",
        type: "medicine",
        scope: "ally",
        occasion: "always",
        consumable: true,
        stateEffects: [],
        consumptionLimit: "noLimit",
        usableActorIds: [],
        usableClassIds: [],
        healStateIds: [],
        hpRecovery: { flat: 0, percentMax: 0 },
        mpRecovery: { flat: 0, percentMax: 0 },
        onlyUsableInMenu: false,
        onlyEffectiveOnDeadActors: false,
        usageMessage: "normal",
        occasionField: true,
        occasionBattle: true,
        seedParameterBonuses: { maxHp: 0, maxMp: 0, attack: 0, defense: 0, spirit: 0, agility: 0 },
        equipmentProfile: { equipable: false },
      }),
      id: "item_potion",
      price: 200,
    }];
    const buy = resolveShopBuyUnitPrice(
      project,
      {
        shopLoyaltySpend: { global: 60000 },
        gameTime: { minute: 0, hour: 21, day: 1, season: "spring", year: 1 },
      },
      shop({ economy: { closingSaleEnabled: true } }),
      "item_potion",
      200,
    );
    const sell = resolveShopSellUnitPrice(project, "item_potion", 200);
    expect(buy).toBeGreaterThanOrEqual(100);
    expect(sell).toBeLessThan(buy);
  });

  it("Given / When / Then weekly restock ignores same-week day changes", () => {
    expect(shouldRestock("daily", "1:spring:1", "1:spring:2")).toBe(true);
    expect(shouldRestock("weekly", "1:spring:1", "1:spring:6")).toBe(false);
    expect(shouldRestock("weekly", "1:spring:1", "1:spring:8")).toBe(true);
    expect(shouldRestock("onDemand", undefined, "1:spring:1")).toBe(false);
  });
});
