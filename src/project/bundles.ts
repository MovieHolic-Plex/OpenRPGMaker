import { changeGold, changeItemsAtomically, GOLD_MAX, setSwitch, type PlaySession } from "@/project/session";
import { isItemQuantity, isPositiveItemQuantity, type ItemQuantityOperation } from "@/project/itemQuantities";
import type { BundleDefinition, BundleRewardDefinition, Project } from "@/project/types";

type BundleFailureReason =
  | "disabled"
  | "missing-bundle"
  | "already-complete"
  | "invalid-count"
  | "invalid-definition"
  | "item-not-required"
  | "exceeds-requirement"
  | "insufficient-inventory"
  | "invalid-reward";

export type BundleContributionResult =
  | {
      readonly ok: true;
      readonly bundleId: string;
      readonly itemId: string;
      readonly contributed: number;
      readonly required: number;
      readonly completed: boolean;
      readonly rewardApplied: boolean;
    }
  | { readonly ok: false; readonly reason: BundleFailureReason; readonly bundleId?: string; readonly itemId?: string };

export function contributeBundle(
  project: Project,
  session: PlaySession,
  bundleId: string,
  itemId: string,
  count: number,
): BundleContributionResult {
  const bundles = project.system.bundles;
  if (!bundles || bundles.length === 0) return { ok: false, reason: "disabled", bundleId, itemId };
  const bundle = bundles.find((entry) => entry.id === bundleId);
  if (!bundle) return { ok: false, reason: "missing-bundle", bundleId, itemId };
  if ((session.completedBundleIds ?? []).includes(bundleId)) {
    return { ok: false, reason: "already-complete", bundleId, itemId };
  }
  if (!isPositiveItemQuantity(count)) {
    return { ok: false, reason: "invalid-count", bundleId, itemId };
  }
  if (!validBundleRequirements(project, bundle)) {
    return { ok: false, reason: "invalid-definition", bundleId, itemId };
  }
  const requirement = bundle.requirements.find((entry) => entry.itemId === itemId);
  if (!requirement) return { ok: false, reason: "item-not-required", bundleId, itemId };

  const contribution = session.bundleContributions?.[bundleId]?.[itemId] ?? 0;
  if (!isItemQuantity(contribution) || contribution > requirement.count) {
    return { ok: false, reason: "invalid-definition", bundleId, itemId };
  }
  const nextContribution = contribution + count;
  if (nextContribution > requirement.count) {
    return { ok: false, reason: "exceeds-requirement", bundleId, itemId };
  }
  if (!isItemQuantity(session.inventory[itemId] ?? 0) || (session.inventory[itemId] ?? 0) < count) {
    return { ok: false, reason: "insufficient-inventory", bundleId, itemId };
  }

  const nextProgress = {
    ...(session.bundleContributions?.[bundleId] ?? {}),
    [itemId]: nextContribution,
  };
  const completed = bundle.requirements.every((entry) => (nextProgress[entry.itemId] ?? 0) >= entry.count);
  if (completed && !validBundleReward(project, bundle.reward)) {
    return { ok: false, reason: "invalid-reward", bundleId, itemId };
  }

  const itemOperations: ItemQuantityOperation[] = [{ itemId, op: "-=", amount: count }];
  if (completed && !(session.bundleRewardAppliedIds ?? []).includes(bundleId)) {
    for (const entry of bundle.reward?.itemRewards ?? []) {
      itemOperations.push({ itemId: entry.itemId, op: "+=", amount: entry.count });
    }
  }
  if (!changeItemsAtomically(session, itemOperations)) {
    return { ok: false, reason: completed ? "invalid-reward" : "insufficient-inventory", bundleId, itemId };
  }
  session.bundleContributions ??= {};
  session.bundleContributions[bundleId] = nextProgress;

  let rewardApplied = false;
  if (completed) {
    session.completedBundleIds = appendUnique(session.completedBundleIds, bundleId);
    if (!(session.bundleRewardAppliedIds ?? []).includes(bundleId)) {
      applyBundleReward(project, session, bundle.reward);
      session.bundleRewardAppliedIds = appendUnique(session.bundleRewardAppliedIds, bundleId);
      rewardApplied = true;
    }
  }

  return {
    ok: true,
    bundleId,
    itemId,
    contributed: nextContribution,
    required: requirement.count,
    completed,
    rewardApplied,
  };
}

function validBundleRequirements(project: Project, bundle: BundleDefinition): boolean {
  if (!bundle.id.trim() || bundle.requirements.length === 0) return false;
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const seen = new Set<string>();
  return bundle.requirements.every((entry) => {
    if (!itemIds.has(entry.itemId) || seen.has(entry.itemId) || !isPositiveItemQuantity(entry.count)) return false;
    seen.add(entry.itemId);
    return true;
  });
}

function validBundleReward(project: Project, reward: BundleRewardDefinition | undefined): boolean {
  if (!reward) return true;
  if (reward.gold !== undefined && (!isNonNegativeInteger(reward.gold) || reward.gold > GOLD_MAX)) return false;
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const rewardedItemIds = new Set<string>();
  for (const entry of reward.itemRewards ?? []) {
    if (rewardedItemIds.has(entry.itemId) || !itemIds.has(entry.itemId) || !isPositiveItemQuantity(entry.count)) return false;
    rewardedItemIds.add(entry.itemId);
    // Quantity preflight belongs to the atomic donation-then-reward batch above.
  }
  const switchIds = new Set(project.switches.map((entry) => entry.id));
  if (reward.switchId && !switchIds.has(reward.switchId)) return false;
  const unlocks = new Map((project.system.worldUnlocks ?? []).map((unlock) => [unlock.id, unlock] as const));
  for (const unlockId of reward.worldUnlockIds ?? []) {
    const unlock = unlocks.get(unlockId);
    if (!unlock || (unlock.switchId && !switchIds.has(unlock.switchId))) return false;
  }
  const recipeIds = new Set((project.system.craftRecipes ?? []).map((recipe) => recipe.id));
  if ((reward.recipeIds ?? []).some((recipeId) => !recipeIds.has(recipeId))) return false;
  return true;
}

function applyBundleReward(project: Project, session: PlaySession, reward: BundleRewardDefinition | undefined): void {
  if (!reward) return;
  if (reward.gold) changeGold(session, "+=", reward.gold);
  if (reward.switchId) setSwitch(session, reward.switchId, true);
  const unlocks = new Map((project.system.worldUnlocks ?? []).map((unlock) => [unlock.id, unlock] as const));
  for (const unlockId of reward.worldUnlockIds ?? []) {
    session.unlockedRegionIds = appendUnique(session.unlockedRegionIds, unlockId);
    const switchId = unlocks.get(unlockId)?.switchId;
    if (switchId) setSwitch(session, switchId, true);
  }
  for (const recipeId of reward.recipeIds ?? []) {
    session.unlockedRecipeIds = appendUnique(session.unlockedRecipeIds, recipeId);
  }
}

function appendUnique(values: readonly string[] | undefined, value: string): string[] {
  const current = values ?? [];
  return current.includes(value) ? [...current] : [...current, value];
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
