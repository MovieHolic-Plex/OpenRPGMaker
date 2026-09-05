import { normalizeItemRecord } from "@/project/databaseRecordModel";
import type { Command, Project } from "@/project/types";
import type { ItemRecord, ItemType } from "@/project/types/database";
import type { CommandEditContext } from "./types";

export type ShopCommand = Extract<Command, { kind: "shop" }>;
export type ShopTab = "goods" | "rules" | "messages" | "branches";
export type ShopEditorView = {
  tab: ShopTab;
  selectedId: string | null;
  scrollTop: number;
};
export const SHOP_SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type ShopSeason = (typeof SHOP_SEASONS)[number];
export const SHOP_SEASON_LABELS: Record<ShopSeason, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
export const SHOP_ITEM_TYPES: Record<ItemType, string> = {
  normalGoods: "일반", weapon: "무기", shield: "방패", body: "갑옷", head: "투구",
  accessory: "장신구", medicine: "회복", book: "서적", seed: "씨앗", special: "특수", switch: "스위치",
};

export function latestShop(context: CommandEditContext, fallback: ShopCommand): ShopCommand {
  const current = context.getCurrentCommand?.();
  return current?.kind === "shop" ? current : fallback;
}

/** Items and equipment share a display catalog, while their authored records stay untouched. */
export function shopCatalogRecords(project: Project): readonly ItemRecord[] {
  const seen = new Set(project.database.items.map((item) => item.id));
  const slots: Record<string, ItemType> = { weapon: "weapon", shield: "shield", armor: "body", helmet: "head", accessory: "accessory" };
  return [...project.database.items, ...project.database.equipment.filter((record) => !seen.has(record.id)).map((record) => normalizeItemRecord({
    id: record.id, name: record.name, price: record.price, description: record.description,
    type: slots[record.slot] ?? "normalGoods", iconResourceId: record.iconResourceId,
    imageResourceId: record.imageResourceId, scope: "none", occasion: "never", consumable: false,
  }))];
}

export function shopPriceLabel(price: number): string {
  return `${price.toLocaleString("ko-KR")} G`;
}

/** Only removing/reordering goods changes stock membership; preserve every remaining overlay field. */
export function withShopItems(command: ShopCommand, itemIds: readonly string[]): ShopCommand {
  const byId = new Map((command.stock ?? []).map((entry) => [entry.itemId, entry]));
  const stock = itemIds.map((id) => byId.get(id)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return { ...command, itemIds: [...itemIds], ...(stock.length ? { stock } : command.stock ? { stock: undefined } : {}) };
}
