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

/** Scale resolved buy prices; fills DB price when stock left price undefined. */
export function applySocialShopPrices(
  project: Project,
  items: readonly ResolvedShopStockItem[],
  multiplier: number
): ResolvedShopStockItem[] {
  if (multiplier === 1) return items.slice();
  return items.map((entry) => {
    const basePrice =
      entry.price ?? project.database.items.find((item) => item.id === entry.itemId)?.price;
    if (typeof basePrice !== "number" || !Number.isFinite(basePrice)) return { itemId: entry.itemId };
    return {
      itemId: entry.itemId,
      price: Math.max(0, Math.floor(basePrice * multiplier)),
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

/** Shape helper for tests / tooling — re-export SocialShop shape intent. */
export type { SocialShop };
