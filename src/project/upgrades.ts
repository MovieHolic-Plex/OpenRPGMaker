// Opt-in upgrade rows + simple sell price table helpers.
import { changeGold, changeItem, type PlaySession } from "@/project/session";
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
  | { readonly ok: false; readonly reason: "disabled" | "missing-rule" | "missing-item" | "missing-gold" | "missing-ingredients" };

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
  if (
    !capability
    || !Number.isInteger(capability.areaWidth)
    || capability.areaWidth <= 0
    || !Number.isInteger(capability.areaHeight)
    || capability.areaHeight <= 0
    || !Number.isFinite(capability.energyMultiplier)
    || capability.energyMultiplier <= 0
  ) {
    return DEFAULT_TOOL_CAPABILITY;
  }
  return capability;
}

export function applyItemUpgrade(project: Project, session: PlaySession, ruleId: string): UpgradeResult {
  const rules = upgradeRulesOf(project);
  if (rules.length === 0) return { ok: false, reason: "disabled" };
  const rule = rules.find((entry) => entry.id === ruleId);
  if (!rule) return { ok: false, reason: "missing-rule" };
  if ((session.inventory[rule.fromItemId] ?? 0) < 1) return { ok: false, reason: "missing-item" };
  if ((rule.goldCost ?? 0) > 0 && session.gold < (rule.goldCost ?? 0)) {
    return { ok: false, reason: "missing-gold" };
  }
  for (const ing of rule.ingredients ?? []) {
    const need = Math.max(1, Math.trunc(ing.count || 1));
    if ((session.inventory[ing.itemId] ?? 0) < need) return { ok: false, reason: "missing-ingredients" };
  }
  if ((rule.goldCost ?? 0) > 0) changeGold(session, "-=", rule.goldCost ?? 0);
  for (const ing of rule.ingredients ?? []) {
    changeItem(session, ing.itemId, "-=", Math.max(1, Math.trunc(ing.count || 1)));
  }
  changeItem(session, rule.fromItemId, "-=", 1);
  changeItem(session, rule.toItemId, "+=", 1);
  if (session.equippedToolItemId === rule.fromItemId) {
    session.equippedToolItemId = rule.toItemId;
  }
  return { ok: true, ruleId: rule.id, toItemId: rule.toItemId };
}
