// Opt-in upgrade rows + simple sell price table helpers.
import { changeGold, changeItemsAtomically, type PlaySession } from "@/project/session";
import { isItemQuantity, isPositiveItemQuantity, type ItemQuantityOperation } from "@/project/itemQuantities";
import type { ItemId, Project } from "@/project/types";

export type ItemUpgradeRule = {
  readonly id: string;
  readonly fromItemId: ItemId;
  readonly toItemId: ItemId;
  readonly goldCost?: number;
  readonly ingredients?: readonly { readonly itemId: ItemId; readonly count: number }[];
  readonly capability?: ToolCapability;
};

export type ToolCapability = {
  readonly areaWidth: number;
  readonly areaHeight: number;
  readonly energyMultiplier: number;
};

export const TOOL_CAPABILITY_AXIS_MAX = 9;
export const TOOL_CAPABILITY_TILE_MAX = 81;

const DEFAULT_TOOL_CAPABILITY: ToolCapability = {
  areaWidth: 1,
  areaHeight: 1,
  energyMultiplier: 1,
};

export type SellPriceEntry = {
  readonly itemId: ItemId;
  readonly price: number;
};

export type UpgradeResult =
  | { readonly ok: true; readonly ruleId: string; readonly toItemId: ItemId }
  | { readonly ok: false; readonly reason: "disabled" | "missing-rule" | "missing-item" | "missing-gold" | "missing-ingredients" | "invalid-state" };

export function upgradeRulesOf(project: Project): readonly ItemUpgradeRule[] {
  return project.system.itemUpgrades ?? [];
}

export function sellPriceTableOf(project: Project): readonly SellPriceEntry[] {
  return project.system.sellPrices ?? [];
}

export function resolveSellPrice(project: Project, itemId: ItemId): number | undefined {
  const row = sellPriceTableOf(project).find((entry) => entry.itemId === itemId);
  if (row) return Math.max(0, Math.trunc(row.price));
  const item = project.database.items.find((entry) => entry.id === itemId);
  if (!item) return undefined;
  // Default sell = half buy price when no table row (common shop convention).
  return Math.max(0, Math.floor((item.price ?? 0) / 2));
}

export function resolveToolCapability(project: Project, itemId: ItemId | undefined): ToolCapability {
  if (!itemId) return DEFAULT_TOOL_CAPABILITY;
  const capability = upgradeRulesOf(project).find((rule) => rule.toItemId === itemId)?.capability;
  if (!isValidToolCapability(capability)) {
    return DEFAULT_TOOL_CAPABILITY;
  }
  return capability;
}

export function isValidToolCapability(capability: ToolCapability | undefined): capability is ToolCapability {
  return capability !== undefined
    && Number.isSafeInteger(capability.areaWidth)
    && capability.areaWidth > 0
    && capability.areaWidth <= TOOL_CAPABILITY_AXIS_MAX
    && Number.isSafeInteger(capability.areaHeight)
    && capability.areaHeight > 0
    && capability.areaHeight <= TOOL_CAPABILITY_AXIS_MAX
    && capability.areaWidth * capability.areaHeight <= TOOL_CAPABILITY_TILE_MAX
    && Number.isFinite(capability.energyMultiplier)
    && capability.energyMultiplier > 0;
}

export function applyItemUpgrade(project: Project, session: PlaySession, ruleId: string): UpgradeResult {
  const rules = upgradeRulesOf(project);
  if (rules.length === 0) return { ok: false, reason: "disabled" };
  const rule = rules.find((entry) => entry.id === ruleId);
  if (!rule) return { ok: false, reason: "missing-rule" };
  if (!isItemQuantity(session.inventory[rule.fromItemId] ?? 0)) return { ok: false, reason: "invalid-state" };
  if ((session.inventory[rule.fromItemId] ?? 0) < 1) return { ok: false, reason: "missing-item" };
  if ((rule.goldCost ?? 0) > 0 && session.gold < (rule.goldCost ?? 0)) {
    return { ok: false, reason: "missing-gold" };
  }
  const required = new Map<string, number>();
  required.set(rule.fromItemId, 1);
  for (const ing of rule.ingredients ?? []) {
    if (!isPositiveItemQuantity(ing.count)) return { ok: false, reason: "invalid-state" };
    const total = (required.get(ing.itemId) ?? 0) + ing.count;
    if (!isItemQuantity(total)) return { ok: false, reason: "invalid-state" };
    required.set(ing.itemId, total);
  }
  for (const [itemId, need] of required) {
    const current = session.inventory[itemId] ?? 0;
    if (!isItemQuantity(current)) return { ok: false, reason: "invalid-state" };
    if (current < need) return { ok: false, reason: itemId === rule.fromItemId ? "missing-item" : "missing-ingredients" };
  }
  const operations: ItemQuantityOperation[] = [...required].map(([itemId, amount]) => ({ itemId, op: "-=", amount }));
  operations.push({ itemId: rule.toItemId, op: "+=", amount: 1 });
  if (!changeItemsAtomically(session, operations)) return { ok: false, reason: "invalid-state" };
  if ((rule.goldCost ?? 0) > 0) changeGold(session, "-=", rule.goldCost ?? 0);
  if (session.equippedToolItemId === rule.fromItemId) {
    session.equippedToolItemId = rule.toItemId;
  }
  return { ok: true, ruleId: rule.id, toItemId: rule.toItemId };
}
