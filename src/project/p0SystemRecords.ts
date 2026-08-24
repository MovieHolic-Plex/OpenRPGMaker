import type {
  BundleDefinition,
  BundleRewardDefinition,
  EnergySystemConfig,
  ItemAmount,
  MakerDefinition,
  ShippingSystemConfig,
  WorldUnlockDefinition,
} from "@/project/types";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";

const CONFIG_AMOUNT_MAX = ITEM_QUANTITY_MAX;
const SHIPPING_HISTORY_MAX = 365;

export function normalizeEnergySystemConfig(value: EnergySystemConfig | undefined): EnergySystemConfig | undefined {
  if (!value) return undefined;
  const max = clampInteger(value.max, 1, CONFIG_AMOUNT_MAX);
  return {
    max,
    ...(value.initial !== undefined ? { initial: clampInteger(value.initial, 0, max) } : {}),
    ...(value.restorePerDay !== undefined ? { restorePerDay: clampInteger(value.restorePerDay, 0, max) } : {}),
  };
}

export function normalizeShippingSystemConfig(value: ShippingSystemConfig | undefined): ShippingSystemConfig | undefined {
  if (!value) return undefined;
  return {
    enabled: value.enabled === true,
    ...(value.historyLimit !== undefined
      ? { historyLimit: clampInteger(value.historyLimit, 1, SHIPPING_HISTORY_MAX) }
      : {}),
    ...(value.allowedItemIds !== undefined ? { allowedItemIds: uniqueIds(value.allowedItemIds) } : {}),
  };
}

export function normalizeBundleDefinitions(values: readonly BundleDefinition[] | undefined): BundleDefinition[] | undefined {
  if (!values) return undefined;
  return values.map((bundle) => ({
    id: bundle.id.trim(),
    ...(cleanText(bundle.name) ? { name: cleanText(bundle.name) } : {}),
    requirements: bundle.requirements.map(normalizeItemAmount),
    ...(bundle.reward ? { reward: normalizeBundleReward(bundle.reward) } : {}),
  }));
}

export function normalizeWorldUnlockDefinitions(values: readonly WorldUnlockDefinition[] | undefined): WorldUnlockDefinition[] | undefined {
  if (!values) return undefined;
  return values.map((unlock) => ({
    id: unlock.id.trim(),
    ...(cleanText(unlock.name) ? { name: cleanText(unlock.name) } : {}),
    ...(cleanText(unlock.switchId) ? { switchId: cleanText(unlock.switchId) } : {}),
  }));
}

export function normalizeMakerDefinitions(values: readonly MakerDefinition[] | undefined): MakerDefinition[] | undefined {
  if (!values) return undefined;
  return values.map((maker) => ({
    id: maker.id.trim(),
    ...(cleanText(maker.name) ? { name: cleanText(maker.name) } : {}),
    inputs: maker.inputs.map(normalizeItemAmount),
    outputs: maker.outputs.map(normalizeItemAmount),
    durationMinutes: clampInteger(maker.durationMinutes, 1, CONFIG_AMOUNT_MAX),
  }));
}

function normalizeBundleReward(reward: BundleRewardDefinition): BundleRewardDefinition {
  return {
    ...(reward.gold !== undefined ? { gold: clampInteger(reward.gold, 0, CONFIG_AMOUNT_MAX) } : {}),
    ...(reward.itemRewards !== undefined ? { itemRewards: reward.itemRewards.map(normalizeItemAmount) } : {}),
    ...(cleanText(reward.switchId) ? { switchId: cleanText(reward.switchId) } : {}),
    ...(reward.worldUnlockIds !== undefined ? { worldUnlockIds: uniqueIds(reward.worldUnlockIds) } : {}),
    ...(reward.recipeIds !== undefined ? { recipeIds: uniqueIds(reward.recipeIds) } : {}),
  };
}

function normalizeItemAmount(value: ItemAmount): ItemAmount {
  return { itemId: value.itemId.trim(), count: clampInteger(value.count, 1, CONFIG_AMOUNT_MAX) };
}

function uniqueIds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
