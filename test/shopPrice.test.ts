import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { resolvePricedShopStock, resolveShopBuyUnitPrice, resolveShopSellUnitPrice } from "@/project/shopPrice";
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
  it("uses the equipment database price when stock has no override", () => {
    const project = createBlankProject();
    const equipment = { ...project.database.equipment[0], id: "equipment_price_test", price: 40 };
    project.database.equipment = [equipment];
    expect(resolvePricedShopStock(project, {}, shop({ itemIds: [equipment.id] }))).toEqual([
      { itemId: equipment.id, price: 40 },
    ]);
  });

  it("keeps equipment discount floors and explicit seasonal price priority", () => {
    const project = createBlankProject();
    project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 40 }];
    const id = "equipment_price_test";
    const session = { gameTime: { minute: 0, hour: 21, day: 1, season: "spring" as const, year: 1 }, shopLoyaltySpend: { global: 60000 } };
    expect(resolveShopBuyUnitPrice(project, session, shop({ economy: { closingSaleEnabled: true } }), id, 10)).toBe(20);
    project.system.timeSystem = { ...project.system.timeSystem, enabled: true };
    expect(resolvePricedShopStock(project, {}, shop({ stock: [{ itemId: id, priceOverride: 60 }] }))[0]?.price).toBe(60);
    expect(resolvePricedShopStock(project, { gameTime: session.gameTime }, shop({ stock: [{ itemId: id, priceOverride: 60, priceBySeason: { spring: 80 } }] }))[0]?.price).toBe(80);
    expect(resolveShopBuyUnitPrice(project, session, shop({ economy: { closingSaleEnabled: true } }), id, 40)).toBe(30);
  });

  it("preserves zero prices and item-first lookup for duplicate ids", () => {
    const project = createBlankProject();
    project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 0 }];
    expect(resolvePricedShopStock(project, {}, shop({ itemIds: ["equipment_price_test"] }))[0]?.price).toBe(0);
    project.database.items = [{ ...project.database.items[0], id: "equipment_price_test", price: 0 }];
    project.database.equipment[0].price = 40;
    expect(resolvePricedShopStock(project, {}, shop({ stock: [{ itemId: "equipment_price_test", priceOverride: 0 }] }))[0]?.price).toBe(0);
  });

  it("applies the social discount to equipment without an override", () => {
    const project = createBlankProject();
    project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 40 }];
    expect(resolvePricedShopStock(project, { friendship: { merchant: 100 } }, shop({ itemIds: ["equipment_price_test"] }), {
      id: "merchant", characterId: "merchant", socialShop: { minFriendship: 10, priceMultiplier: 0.75 },
    })).toEqual([{ itemId: "equipment_price_test", price: 30 }]);
  });

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
