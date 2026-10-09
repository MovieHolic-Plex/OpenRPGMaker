import { describe, expect, it } from "vitest";
import {
  clampAgreedBuyPrice,
  clampAgreedSellPrice,
  haggleBuyFloor,
  haggleSellCeiling,
  haggleVisitKey,
  hash32,
  normalizeHaggleConfig,
  proposeHaggle,
  resolveHaggleReserve,
  type HaggleSetup,
} from "@/project/haggle";

function buySetup(overrides: Partial<HaggleSetup> = {}): HaggleSetup {
  return {
    role: "playerBuys",
    reference: 200,
    reserve: 160,
    patience: 3,
    insultRatio: 0.6,
    buyPrice: 200,
    ...overrides,
  };
}

describe("haggle core", () => {
  it("Given / When / Then accepts a buy offer at or above reserve inside [floor, reference]", () => {
    const verdict = proposeHaggle(buySetup(), 170);
    expect(verdict).toEqual({ kind: "accept", price: 170 });
  });

  it("Given / When / Then counters then exhausts patience instead of rolling a die", () => {
    const first = proposeHaggle(buySetup({ reserve: 180 }), 165);
    expect(first.kind).toBe("counter");
    if (first.kind !== "counter") return;
    expect(first.patience).toBe(2);
    expect(first.reserve).toBeGreaterThanOrEqual(180);
    const last = proposeHaggle({ ...buySetup({ reserve: first.reserve, patience: 1 }), }, 165);
    expect(last).toEqual({ kind: "broken", reason: "exhausted" });
  });

  it("Given / When / Then breaks immediately when the offer insults the counterparty", () => {
    expect(proposeHaggle(buySetup(), 40)).toEqual({ kind: "broken", reason: "insulted" });
  });

  it("Given / When / Then keeps sell agreements inside [reference, buy-1]", () => {
    expect(haggleBuyFloor(200)).toBe(100);
    expect(haggleSellCeiling(200)).toBe(199);
    expect(clampAgreedBuyPrice(200, 90)).toBe(100);
    expect(clampAgreedSellPrice(100, 200, 250)).toBe(199);
    const sell = proposeHaggle(
      {
        role: "playerSells",
        reference: 100,
        reserve: 140,
        patience: 3,
        insultRatio: 0.6,
        buyPrice: 200,
      },
      130,
    );
    expect(sell).toEqual({ kind: "accept", price: 130 });
  });

  it("Given / When / Then the same seed tuple always yields the same reserve", () => {
    const input = {
      role: "playerBuys" as const,
      reference: 220,
      buyPrice: 220,
      maxDiscount: 0.25,
      itemId: "item_sword",
      merchantKey: "shop_a",
      dayKey: "1:spring:3",
      attemptIndex: 0,
    };
    expect(resolveHaggleReserve(input)).toBe(resolveHaggleReserve(input));
    expect(hash32("a")).toBe(hash32("a"));
    expect(haggleVisitKey("shop_a", "item_sword", "1:spring:3")).toBe("shop_a:item_sword:1:spring:3");
    expect(normalizeHaggleConfig({ patience: 99, insultRatio: 0.1, maxDiscount: 0.9 })).toEqual({
      patience: 5,
      insultRatio: 0.4,
      maxDiscount: 0.4,
    });
  });
});
