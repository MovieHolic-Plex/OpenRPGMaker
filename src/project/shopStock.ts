import type { Command, ItemId, Project, Season, ShopStockEntry } from "@/project/types";
import type { GameTime } from "@/project/gameTime";

export type ResolvedShopStockItem = {
  readonly itemId: ItemId;
  readonly price?: number;
};

export function resolveShopStock(
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

export function stockEntryVisibleInSeason(entry: ShopStockEntry, season: Season | undefined): boolean {
  if (!season) return true;
  return !entry.seasons?.length || entry.seasons.includes(season);
}

export function stockEntryPrice(entry: ShopStockEntry, season: Season | undefined): number | undefined {
  const seasonal = season ? entry.priceBySeason?.[season] : undefined;
  const price = seasonal ?? entry.priceOverride;
  return typeof price === "number" && Number.isFinite(price) ? Math.max(0, Math.trunc(price)) : undefined;
}
