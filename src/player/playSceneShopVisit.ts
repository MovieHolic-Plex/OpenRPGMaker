import { isBlackMarketOpen, isFestivalShopOpen, resolveShopMerchantBudget, shouldRestock } from "@/project/shopStock";
import { shopDayKey } from "@/project/shopPrice";
import type { PlaySceneContext } from "@/player/playSceneTypes";

type ShopVisitLedgers = {
  shopMerchantGold?: Record<string, number>;
  shopLastRestockDayKey?: Record<string, string>;
};

type ShopVisitStep = {
  readonly loyaltyTierId?: string;
  readonly merchantGold?: number;
  readonly investmentLevel?: number;
  readonly restockPolicy?: string;
  readonly blackMarketFlag?: string;
  readonly festivalFlag?: string;
};

export function shopKeyOf(step: Pick<ShopVisitStep, "loyaltyTierId">): string {
  return step.loyaltyTierId ?? "global";
}

export function shopIsClosed(
  session: PlaySceneContext["session"],
  step: Pick<ShopVisitStep, "blackMarketFlag" | "festivalFlag">,
): string | undefined {
  if (!isBlackMarketOpen(session, step.blackMarketFlag)) return "오늘은 문을 닫았습니다.";
  if (!isFestivalShopOpen(session, step.festivalFlag)) return "오늘은 문을 닫았습니다.";
  return undefined;
}

export function beginShopVisit(scene: PlaySceneContext, step: ShopVisitStep): number {
  const budget = resolveShopMerchantBudget(step.merchantGold, step.investmentLevel);
  if (!step.restockPolicy || step.restockPolicy === "onDemand") return budget;
  const ledgers = scene.session as ShopVisitLedgers;
  const key = shopKeyOf(step);
  const dayKey = shopDayKey(scene.session);
  const lastKey = ledgers.shopLastRestockDayKey?.[key];
  if (shouldRestock(step.restockPolicy, lastKey, dayKey)) {
    ledgers.shopLastRestockDayKey = { ...(ledgers.shopLastRestockDayKey ?? {}), [key]: dayKey };
    return budget;
  }
  const stored = ledgers.shopMerchantGold?.[key];
  if (typeof stored === "number" && Number.isFinite(stored)) {
    return Math.max(0, Math.trunc(stored));
  }
  return budget;
}

export function endShopVisit(scene: PlaySceneContext, step: ShopVisitStep, merchantGold: number): void {
  if (!step.restockPolicy || step.restockPolicy === "onDemand") return;
  const ledgers = scene.session as ShopVisitLedgers;
  const key = shopKeyOf(step);
  ledgers.shopMerchantGold = { ...(ledgers.shopMerchantGold ?? {}), [key]: Math.max(0, Math.trunc(merchantGold)) };
}
