import { describe, expect, it } from "vitest";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import {
  clampShopReputation,
  generateShopkeeperCustomers,
  reputationAfterVerdict,
} from "@/project/shopkeeper";

describe("shopkeeper inverted haggle", () => {
  it("Given / When / Then the same day key yields the same customer queue", () => {
    const input = { shopKey: "shop_a", dayKey: "1:spring:2", itemIds: ["item_potion", "item_sword"] };
    expect(generateShopkeeperCustomers(input)).toEqual(generateShopkeeperCustomers(input));
    expect(generateShopkeeperCustomers({ ...input, itemIds: [] })).toEqual([]);
  });

  it("Given / When / Then a customer buy uses playerSells and never pays at or above list", () => {
    const reserve = resolveHaggleReserve({
      role: "playerSells",
      reference: 100,
      buyPrice: 200,
      maxDiscount: 0.25,
      itemId: "item_potion",
      merchantKey: "shop_a",
      dayKey: "1:spring:2",
      attemptIndex: 0,
    });
    expect(reserve).toBeGreaterThanOrEqual(100);
    expect(reserve).toBeLessThan(200);
    const accepted = proposeHaggle(
      {
        role: "playerSells",
        reference: 100,
        reserve,
        patience: 3,
        insultRatio: 0.6,
        buyPrice: 200,
      },
      Math.min(reserve, 199),
    );
    expect(accepted.kind).toBe("accept");
    if (accepted.kind !== "accept") return;
    expect(accepted.price).toBeLessThan(200);
  });

  it("Given / When / Then walkout lowers reputation and a sale raises it", () => {
    expect(clampShopReputation(200)).toBe(100);
    expect(reputationAfterVerdict(10, "accept")).toBe(12);
    expect(reputationAfterVerdict(10, "broken")).toBe(5);
  });
});
