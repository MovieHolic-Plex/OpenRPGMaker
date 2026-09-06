import { calendarDayKey, type GameTime } from "@/project/gameTime";
import { haggleBuyFloor, haggleSellCeiling } from "@/project/haggle";
import {
  applyDynamicMarkup,
  resolveClosingSaleDiscount,
  resolveLoyaltyDiscount,
  resolveShopStock,
  type ResolvedShopStockItem,
  type ShopMerchantEvent,
} from "@/project/shopStock";
import type { Command, ItemId, Project } from "@/project/types";
import { resolveSellPrice } from "@/project/upgrades";

export type ShopPriceSession = {
  readonly gameTime?: GameTime;
  readonly friendship?: Readonly<Record<string, number>>;
  readonly shopLoyaltySpend?: Readonly<Record<string, number>>;
  readonly shopTradeCounts?: Readonly<Record<string, { readonly sold: number; readonly bought: number }>>;
};

type ShopCommand = Extract<Command, { kind: "shop" }>;

export function resolveShopBuyUnitPrice(
  project: Project,
  session: ShopPriceSession,
  command: ShopCommand,
  itemId: ItemId,
  listedPrice: number,
): number {
  const listed = Math.max(0, Math.trunc(listedPrice));
  const dbPrice = project.database.items.find((item) => item.id === itemId)?.price
    ?? project.database.equipment.find((item) => item.id === itemId)?.price
    ?? listed;
  const floorAt = haggleBuyFloor(Math.max(listed, dbPrice));
  const economy = command.economy;
  const counts = session.shopTradeCounts?.[itemId] ?? { sold: 0, bought: 0 };
  let price = listed;
  if (economy?.dynamicPricing === true) {
    price = applyDynamicMarkup(price, counts.sold, counts.bought);
  }
  const spend = session.shopLoyaltySpend?.[command.loyaltyTierId ?? "global"] ?? 0;
  const loyalty = resolveLoyaltyDiscount(spend);
  if (loyalty > 0) {
    price = Math.floor(price * (1 - loyalty));
  }
  const closing = resolveClosingSaleDiscount(session.gameTime?.hour ?? 0, economy?.closingSaleEnabled === true);
  if (closing > 0) {
    price = Math.floor(price * (1 - closing));
  }
  return Math.max(floorAt, price);
}

export function resolveShopSellUnitPrice(project: Project, itemId: ItemId, buyPrice: number): number {
  const table = resolveSellPrice(project, itemId);
  const fallback = haggleBuyFloor(buyPrice);
  const raw = table === undefined ? fallback : table;
  return Math.min(raw, haggleSellCeiling(Math.max(1, buyPrice)));
}

export function resolvePricedShopStock(
  project: Project,
  session: ShopPriceSession,
  command: ShopCommand,
  merchantEvent?: ShopMerchantEvent,
): ResolvedShopStockItem[] {
  return resolveShopStock(project, session, command, merchantEvent).map((row) => {
    const dbPrice = project.database.items.find((item) => item.id === row.itemId)?.price
      ?? project.database.equipment.find((item) => item.id === row.itemId)?.price
      ?? 0;
    const listed = row.price ?? dbPrice;
    return { itemId: row.itemId, price: resolveShopBuyUnitPrice(project, session, command, row.itemId, listed) };
  });
}

export function shopDayKey(session: { readonly gameTime?: GameTime }): string {
  return calendarDayKey(session.gameTime);
}
