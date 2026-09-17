import type { StorageChestLayout, StorageChestTemplate } from "@/project/types/events";
import type { ItemType } from "@/project/types/database";
import type { ItemId } from "@/project/types";
import { changeGold, getSwitch } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { GOLD_MAX } from "@/project/economyValues";
import { inventoryEntries, type ChestState } from "@/project/placeables";

export type { StorageChestLayout, StorageChestTemplate };
export const STORAGE_CHEST_TEMPLATES = ["farm", "warehouse", "vault"] as const satisfies readonly StorageChestTemplate[];
export const STORAGE_CHEST_LAYOUTS = ["center", "bottom", "wide"] as const satisfies readonly StorageChestLayout[];
export const STORAGE_CHEST_TABS = ["all", "medicine", "material", "gear", "key"] as const;
export type StorageChestTab = (typeof STORAGE_CHEST_TABS)[number];

const ITEM_TYPES: readonly ItemType[] = [
  "normalGoods",
  "weapon",
  "shield",
  "body",
  "head",
  "accessory",
  "medicine",
  "book",
  "seed",
  "special",
  "switch",
];

export type OpenChestFields = {
  readonly chestId?: string;
  readonly displayName?: string;
  readonly template?: StorageChestTemplate;
  readonly layout?: StorageChestLayout;
  readonly showIcons?: boolean;
  readonly capacity?: number;
  readonly allowBulk?: boolean;
  readonly allowSort?: boolean;
  readonly showCategories?: boolean;
  readonly goldVault?: boolean;
  readonly lockSwitchId?: string;
  readonly lockItemId?: string;
  readonly allowedItemTypes?: readonly string[];
};

export type ResolvedStorageChest = {
  readonly chestId?: string;
  readonly displayName: string;
  readonly template?: StorageChestTemplate;
  readonly layout: StorageChestLayout;
  readonly showIcons: boolean;
  readonly capacity?: number;
  readonly allowBulk: boolean;
  readonly allowSort: boolean;
  readonly showCategories: boolean;
  readonly goldVault: boolean;
  readonly lockSwitchId?: string;
  readonly lockItemId?: string;
  readonly allowedItemTypes: readonly ItemType[];
};

const TEMPLATE_DEFAULTS: Record<StorageChestTemplate, Omit<ResolvedStorageChest, "chestId" | "template" | "lockSwitchId" | "lockItemId" | "allowedItemTypes">> = {
  farm: {
    displayName: "농장 상자",
    layout: "center",
    showIcons: true,
    capacity: 24,
    allowBulk: true,
    allowSort: true,
    showCategories: false,
    goldVault: false,
  },
  warehouse: {
    displayName: "공동 창고",
    layout: "wide",
    showIcons: true,
    capacity: 80,
    allowBulk: true,
    allowSort: true,
    showCategories: true,
    goldVault: false,
  },
  vault: {
    displayName: "금고",
    layout: "center",
    showIcons: true,
    capacity: 16,
    allowBulk: false,
    allowSort: true,
    showCategories: false,
    goldVault: true,
  },
};

const LEGACY_DEFAULTS: Omit<ResolvedStorageChest, "chestId" | "template" | "lockSwitchId" | "lockItemId" | "allowedItemTypes"> = {
  displayName: "보관 상자",
  layout: "center",
  showIcons: true,
  capacity: undefined,
  allowBulk: true,
  allowSort: true,
  showCategories: false,
  goldVault: false,
};

export function isStorageChestTemplate(value: unknown): value is StorageChestTemplate {
  return value === "farm" || value === "warehouse" || value === "vault";
}

export function isStorageChestLayout(value: unknown): value is StorageChestLayout {
  return value === "center" || value === "bottom" || value === "wide";
}

export function templateDefaults(template: StorageChestTemplate): typeof TEMPLATE_DEFAULTS.farm {
  return TEMPLATE_DEFAULTS[template];
}

export function resolveStorageChest(fields: OpenChestFields): ResolvedStorageChest {
  const template = isStorageChestTemplate(fields.template) ? fields.template : undefined;
  const base = template ? TEMPLATE_DEFAULTS[template] : LEGACY_DEFAULTS;
  const displayName = fields.displayName?.trim() || base.displayName;
  const allowed = (fields.allowedItemTypes ?? []).filter((type): type is ItemType =>
    (ITEM_TYPES as readonly string[]).includes(type)
  );
  return {
    ...base,
    chestId: fields.chestId?.trim() || undefined,
    template,
    displayName,
    layout: isStorageChestLayout(fields.layout) ? fields.layout : base.layout,
    showIcons: fields.showIcons ?? base.showIcons,
    capacity: fields.capacity ?? base.capacity,
    allowBulk: fields.allowBulk ?? base.allowBulk,
    allowSort: fields.allowSort ?? base.allowSort,
    showCategories: fields.showCategories ?? base.showCategories,
    goldVault: fields.goldVault ?? base.goldVault,
    lockSwitchId: fields.lockSwitchId?.trim() || undefined,
    lockItemId: fields.lockItemId?.trim() || undefined,
    allowedItemTypes: allowed,
  };
}

export function occupiedChestSlots(inventory: Record<string, number> | undefined): number {
  return inventoryEntries(inventory).length;
}

export function chestAcceptsNewStack(
  inventory: Record<string, number> | undefined,
  itemId: ItemId,
  capacity: number | undefined,
): boolean {
  if (capacity === undefined) return true;
  if ((inventory?.[itemId] ?? 0) > 0) return true;
  return occupiedChestSlots(inventory) < capacity;
}

export function itemMatchesAllowedTypes(
  itemType: string | undefined,
  allowed: readonly string[],
): boolean {
  if (allowed.length === 0) return true;
  if (!itemType) return false;
  return allowed.includes(itemType);
}

export function storageChestTabOf(itemType: ItemType | undefined): StorageChestTab {
  switch (itemType) {
    case "medicine":
    case "book":
      return "medicine";
    case "weapon":
    case "shield":
    case "body":
    case "head":
    case "accessory":
      return "gear";
    case "switch":
    case "special":
      return "key";
    default:
      return "material";
  }
}

export function storageChestTabLabel(tab: StorageChestTab): string {
  switch (tab) {
    case "all": return "전부";
    case "medicine": return "회복";
    case "material": return "재료";
    case "gear": return "장비";
    case "key": return "열쇠";
  }
}

export type StorageChestLock = { readonly locked: boolean; readonly reason?: string };

export function storageChestLockState(
  session: PlaySessionLike,
  presentation: ResolvedStorageChest,
): StorageChestLock {
  if (presentation.lockSwitchId && !getSwitch(session, presentation.lockSwitchId)) {
    return { locked: true, reason: "아직 열 수 없습니다." };
  }
  if (presentation.lockItemId) {
    const count = session.inventory[presentation.lockItemId] ?? 0;
    if (count <= 0) return { locked: true, reason: "열쇠가 필요합니다." };
  }
  return { locked: false };
}

export function transferChestGold(
  session: PlaySessionLike,
  chest: ChestState,
  direction: "deposit" | "withdraw",
  amount: number,
): boolean {
  const qty = Math.trunc(amount);
  if (!Number.isSafeInteger(qty) || qty <= 0) return false;
  const chestGold = chest.gold ?? 0;
  if (direction === "deposit") {
    if (session.gold < qty) return false;
    const next = chestGold + qty;
    if (next > GOLD_MAX) return false;
    changeGold(session, "-=", qty);
    chest.gold = next;
    return true;
  }
  if (chestGold < qty) return false;
  changeGold(session, "+=", qty);
  const remaining = chestGold - qty;
  chest.gold = remaining > 0 ? remaining : 0;
  return true;
}
