import type { Command, GameEvent, ItemId, Project, Season, ShopStockEntry, SocialShop } from "@/project/types";
import type { GameTime } from "@/project/gameTime";
import { clampFriendship } from "@/project/session";
import { resolveSocialKey } from "@/project/socialKey";

/** 상점 명령에 merchantGold 가 없을 때 상인이 쓸 기본 소지금. */
export const DEFAULT_SHOP_MERCHANT_GOLD = 100;

export type ResolvedShopStockItem = {
  readonly itemId: ItemId;
  readonly price?: number;
};

export type ShopMerchantEvent = Pick<GameEvent, "id" | "characterId" | "socialShop">;

/** 상인 소지금. 생략/비정상이면 기본 100G, 음수는 0으로 클램프. */
export function resolveShopMerchantGold(merchantGold: number | undefined): number {
  if (typeof merchantGold !== "number" || !Number.isFinite(merchantGold)) {
    return DEFAULT_SHOP_MERCHANT_GOLD;
  }
  return Math.max(0, Math.floor(merchantGold));
}

/**
 * 가게 투자 레벨(0..5) → 상인 매입 예산 배수. Lv당 +25%.
 * 「가게에 투자하면 상인이 더 많이 사줄 수 있다」는 한 줄 규칙이다.
 * 예전에는 investmentLevel 을 읽는 런타임 경로가 아예 없어 저장만 되는 죽은 설정이었다.
 */
export function resolveShopInvestmentMultiplier(investmentLevel: number | undefined): number {
  if (typeof investmentLevel !== "number" || !Number.isFinite(investmentLevel)) return 1;
  return 1 + 0.25 * Math.min(5, Math.max(0, Math.floor(investmentLevel)));
}

/** 투자 레벨을 반영한 방문 시작 시 상인 소지금. */
export function resolveShopMerchantBudget(
  merchantGold: number | undefined,
  investmentLevel: number | undefined
): number {
  const base = resolveShopMerchantGold(merchantGold);
  return Math.floor(base * resolveShopInvestmentMultiplier(investmentLevel));
}

/**
 * Buy-price multiplier from GameEvent.socialShop when merchant has characterId
 * and session friendship for that social key is >= minFriendship.
 * Without characterId / socialShop / enough bond => 1 (no discount).
 */
export function resolveSocialShopPriceMultiplier(
  session: { readonly friendship?: Readonly<Record<string, number>> },
  merchantEvent: ShopMerchantEvent | undefined
): number {
  const cfg = merchantEvent?.socialShop;
  if (!cfg) return 1;
  const npcKey = resolveSocialKey(merchantEvent);
  if (!npcKey) return 1;
  const bond = clampFriendship(session.friendship?.[npcKey] ?? 0);
  if (bond < clampFriendship(cfg.minFriendship)) return 1;
  const mult = cfg.priceMultiplier;
  if (typeof mult !== "number" || !Number.isFinite(mult) || mult < 0) return 1;
  // 할인 50% 초과(0.5 미만)면 buy 20G vs sell 25G처럼 돈 복사 발생. 런타임은 0.5 하한으로 방어.
  if (mult < 0.5) return 0.5;
  return mult;
}

export function resolveShopStock(
  project: Project,
  session: {
    readonly gameTime?: GameTime;
    readonly friendship?: Readonly<Record<string, number>>;
  },
  command: Extract<Command, { kind: "shop" }>,
  merchantEvent?: ShopMerchantEvent
): ResolvedShopStockItem[] {
  const base = resolveBaseShopStock(project, session, command);
  const multiplier = resolveSocialShopPriceMultiplier(session, merchantEvent);
  return applySocialShopPrices(project, base, multiplier);
}

function resolveBaseShopStock(
  project: Project,
  session: { readonly gameTime?: GameTime },
  command: Extract<Command, { kind: "shop" }>
): ResolvedShopStockItem[] {
  if (!command.stock) return command.itemIds.map((itemId) => ({ itemId }));
  const season = project.system.timeSystem?.enabled === true ? session.gameTime?.season : undefined;
  return command.stock
    .filter((entry) => stockEntryVisibleInSeason(entry, season))
    .map((entry) => ({
      itemId: entry.itemId,
      price: stockEntryPrice(entry, season),
    }));
}

/** Scale resolved buy prices; fills DB price when stock left price undefined.
 *  차익 방어: 할인가가 sellPrice(=floor(base/2))보다 싸질 수 없도록 하한을 건다.
 */
export function applySocialShopPrices(
  project: Project,
  items: readonly ResolvedShopStockItem[],
  multiplier: number
): ResolvedShopStockItem[] {
  if (multiplier === 1) return items.slice();
  const floor = Math.max(0.5, multiplier);
  return items.map((entry) => {
    const basePrice =
      entry.price ?? project.database.items.find((item) => item.id === entry.itemId)?.price;
    if (typeof basePrice !== "number" || !Number.isFinite(basePrice)) return { itemId: entry.itemId };
    const discounted = Math.max(0, Math.floor(basePrice * floor));
    const sellFloor = Math.floor(basePrice / 2);
    return {
      itemId: entry.itemId,
      price: Math.max(sellFloor, discounted),
    };
  });
}

export function stockEntryVisibleInSeason(entry: ShopStockEntry, season: Season | undefined): boolean {
  if (!season) return true;
  return !entry.seasons?.length || entry.seasons.includes(season);
}

export function stockEntryPrice(entry: ShopStockEntry, season: Season | undefined): number | undefined {
  const seasonal = season ? entry.priceBySeason?.[season] : undefined;
  const price = seasonal ?? entry.priceOverride;
  return typeof price === "number" && Number.isFinite(price) ? Math.max(0, Math.trunc(price)) : undefined;
}

export function clampShopPriceOverride(dbPrice: number, override: number | undefined): number | undefined {
  if (override === undefined) return undefined;
  const floor = Math.floor(dbPrice / 2);
  return Math.max(floor, Math.max(0, Math.trunc(override)));
}

export const SHOP_CART_MAX_LINES = 12;
export const SHOP_BUYBACK_MAX = 8;
export const SHOP_CONSIGNMENT_MAX = 16;
export const SHOP_PAWN_MAX = 8;
export const SHOP_INVESTMENT_MAX_LEVEL = 5;
export const SHOP_LOYALTY_TIERS: ReadonlyArray<{ id: string; minSpend: number; discount: number }> = [
  { id: "bronze", minSpend: 0, discount: 0 },
  { id: "silver", minSpend: 5000, discount: 0.03 },
  { id: "gold", minSpend: 20000, discount: 0.06 },
  { id: "platinum", minSpend: 60000, discount: 0.1 },
];
export function resolveLoyaltyDiscount(totalSpend: number): number { let d=0; for(const tt of SHOP_LOYALTY_TIERS) if(totalSpend>=tt.minSpend) d=tt.discount; return Math.min(0.15, Math.max(0,d)); }
export function resolveClosingSaleDiscount(hour: number, enabled?: boolean): number { if(!enabled) return 0; return hour>=20&&hour<=22?0.15:0; }
export function clampShopCart(lines: readonly { itemId: string; qty:number; unitPrice:number }[]): typeof lines { return lines.slice(0, SHOP_CART_MAX_LINES).map(l=>({ ...l, qty: Math.max(1, Math.min(99, Math.trunc(l.qty))), unitPrice: Math.max(0, Math.trunc(l.unitPrice)) })); }
export function clampShopBuyback(entries: readonly { itemId:string; price:number; expiresAtDayKey?: string }[]): typeof entries { return entries.slice(-SHOP_BUYBACK_MAX); }
export function applyHaggleDiscount(price:number, bonus:number): number { const b=Math.max(0, Math.min(10, Math.floor(bonus/10))); const rate=Math.min(0.15, 0.05+b/100); return Math.max(Math.floor(price/2), Math.max(0, Math.floor(price*(1-rate)))); }
export function applyDynamicMarkup(base:number, sold:number, bought:number): number { const d=(bought-sold)*0.02; const f=Math.max(0.8, Math.min(1.2, 1+d)); return Math.max(1, Math.floor(base*f)); }
export function isBlackMarketOpen(session:{ readonly switches?: Record<string,boolean> }, flag?: string): boolean { if(!flag) return true; return session.switches?.[flag]===true; }
export function isFestivalShopOpen(session:{ readonly switches?: Record<string,boolean> }, flag?: string): boolean { if(!flag) return true; return session.switches?.[flag]===true; }
export function shouldRestock(policy: string|undefined, lastKey:string|undefined, curKey:string): boolean { if(!policy||policy==="onDemand") return false; if(!lastKey) return true; if(policy==="daily") return lastKey!==curKey; if(policy==="weekly") return lastKey!==curKey; return false; }

/** Shape helper for tests / tooling — re-export SocialShop shape intent. */
export type { SocialShop };
