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

/**
 * 상점 원장을 가를 키. **상점마다 달라야 한다.**
 *
 * 이 키가 상인 지갑(`shopMerchantGold`), 재입고 날짜(`shopLastRestockDayKey`), 흥정 상태
 * (`shopHaggleState`), 진열대(`shopShelf`), 평판(`shopReputation`) 을 전부 색인한다.
 *
 * 예전에는 `loyaltyTierId ?? "global"` 이었는데, 편집기가 만드는 상점은 tier 를 설정하지
 * 않으므로(`eventCommandFactory.ts` 에 tier 지정이 없다) 사실상 **모든 상점이 `"global"`
 * 하나를 공유**했다. 대장간과 잡화점이 지갑·진열대·"기분 상한 상인" 깃발을 한 번에 쓰는
 * 상태라, 한쪽에서 흥정하다 상인을 화나게 하면 다른 상점 주인도 화나 있었다.
 *
 * 이제 맵+이벤트로 잡는다. 이벤트 하나가 상점 하나이고, 같은 이벤트를 다시 방문하면 같은
 * 지갑으로 돌아오는 것이 이 기능이 원하는 연속성이다. `loyaltyTierId` 는 여전히 우선한다 —
 * 여러 이벤트가 의도적으로 한 상인을 공유하는 저작(같은 상인이 장을 돈다)이 그것이기 때문이고,
 * 그럴 때만 키가 묶인다.
 *
 * 이벤트 id 를 모를 수도 있다(툴·테스트에서 직접 부를 때). 그럴 땐 맵만으로 가른다 — 전역
 * 하나보다는 좋고, 생산 경로는 항상 eventId 를 넘긴다.
 */
export type ShopIdentity = { readonly mapId?: string; readonly eventId?: string };

export function shopKeyOf(step: Pick<ShopVisitStep, "loyaltyTierId">, identity?: ShopIdentity): string {
  if (step.loyaltyTierId) return `tier:${step.loyaltyTierId}`;
  const mapId = identity?.mapId;
  const eventId = identity?.eventId;
  if (mapId && eventId) return `shop:${mapId}:${eventId}`;
  if (mapId) return `map:${mapId}`;
  return "global";
}

export function shopIsClosed(
  session: PlaySceneContext["session"],
  step: Pick<ShopVisitStep, "blackMarketFlag" | "festivalFlag">,
): string | undefined {
  if (!isBlackMarketOpen(session, step.blackMarketFlag)) return "오늘은 문을 닫았습니다.";
  if (!isFestivalShopOpen(session, step.festivalFlag)) return "오늘은 문을 닫았습니다.";
  return undefined;
}

export function beginShopVisit(scene: PlaySceneContext, step: ShopVisitStep, identity?: ShopIdentity): number {
  const budget = resolveShopMerchantBudget(step.merchantGold, step.investmentLevel);
  if (!step.restockPolicy || step.restockPolicy === "onDemand") return budget;
  const ledgers = scene.session as ShopVisitLedgers;
  const key = shopKeyOf(step, identity);
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

export function endShopVisit(
  scene: PlaySceneContext,
  step: ShopVisitStep,
  merchantGold: number,
  identity?: ShopIdentity,
): void {
  if (!step.restockPolicy || step.restockPolicy === "onDemand") return;
  const ledgers = scene.session as ShopVisitLedgers;
  const key = shopKeyOf(step, identity);
  ledgers.shopMerchantGold = { ...(ledgers.shopMerchantGold ?? {}), [key]: Math.max(0, Math.trunc(merchantGold)) };
}
