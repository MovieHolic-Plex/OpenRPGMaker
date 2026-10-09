import { canDonateCollection, collectionProgress, markDonated } from "@/project/collections";
import { isItemQuantity, isPositiveItemQuantity, ITEM_QUANTITY_MAX, type ItemQuantityOperation } from "@/project/itemQuantities";
import { changeGold, changeItemsAtomically, GOLD_MAX, setSwitch, type PlaySession } from "@/project/session";
import type { BundleRewardDefinition, MuseumRewardDefinition, Project } from "@/project/types";

export type MuseumDonationResult =
  | { readonly ok: true; readonly itemId: string; readonly appliedRewardIds: readonly string[] }
  | { readonly ok: false; readonly reason: "disabled" | "ineligible" | "already-donated" | "inventory" | "invalid-state" | "invalid-reward" };

export function donateMuseumItem(project: Project, session: PlaySession, itemId: string): MuseumDonationResult {
  const museum = project.system.museum;
  if (!museum?.enabled) return { ok: false, reason: "disabled" };
  if (!session.collections) return { ok: false, reason: "invalid-state" };
  const rewardIds = museum.rewards.map((reward) => reward.id);
  if (rewardIds.some((id) => !id.trim()) || new Set(rewardIds).size !== rewardIds.length) {
    return { ok: false, reason: "invalid-state" };
  }
  if (!project.database.items.some((item) => item.id === itemId) || !museum.eligibleItemIds.includes(itemId)) return { ok: false, reason: "ineligible" };
  const progress = collectionProgress(session, itemId);
  if (progress?.donated) return { ok: false, reason: "already-donated" };
  if (!canDonateCollection(session, itemId)) return { ok: false, reason: "invalid-state" };
  const current = session.inventory[itemId] ?? 0;
  if (!isItemQuantity(current) || current < 1) return { ok: false, reason: "inventory" };
  if (!Array.isArray(session.museumRewardAppliedIds) || new Set(session.museumRewardAppliedIds).size !== session.museumRewardAppliedIds.length) {
    return { ok: false, reason: "invalid-state" };
  }
  const eligibleIds = new Set(museum.eligibleItemIds.filter((id) => project.database.items.some((item) => item.id === id)));
  const donatedIds = new Set(Object.entries(session.collections)
    .filter(([id, row]) => eligibleIds.has(id) && row.donated)
    .map(([id]) => id));
  donatedIds.add(itemId);
  const newlyQualified = museum.rewards.filter((reward) => !session.museumRewardAppliedIds!.includes(reward.id) && qualifies(reward, donatedIds));
  if (newlyQualified.some((reward) => !validReward(project, session, reward.reward))) return { ok: false, reason: "invalid-reward" };
  const totalGold = newlyQualified.reduce((sum, reward) => sum + (reward.reward?.gold ?? 0), 0);
  if (!Number.isSafeInteger(totalGold) || !safeNonNegative(session.gold) || totalGold > GOLD_MAX - session.gold) {
    return { ok: false, reason: "invalid-reward" };
  }

  const draft = structuredClone(session);
  const operations: ItemQuantityOperation[] = [{ itemId, op: "-=", amount: 1 }];
  for (const reward of newlyQualified) for (const item of reward.reward?.itemRewards ?? []) operations.push({ itemId: item.itemId, op: "+=", amount: item.count });
  if (!changeItemsAtomically(draft, operations)) return { ok: false, reason: "invalid-reward" };
  if (!markDonated(draft, itemId)) return { ok: false, reason: "invalid-state" };
  for (const reward of newlyQualified) applyReward(project, draft, reward.reward);
  draft.museumRewardAppliedIds = [...draft.museumRewardAppliedIds!, ...newlyQualified.map((reward) => reward.id)];
  Object.assign(session, draft);
  return { ok: true, itemId, appliedRewardIds: newlyQualified.map((reward) => reward.id) };
}

function qualifies(reward: MuseumRewardDefinition, donated: ReadonlySet<string>): boolean {
  return (reward.minDonations === undefined || donated.size >= reward.minDonations)
    && (reward.requiredItemIds === undefined || reward.requiredItemIds.every((itemId) => donated.has(itemId)));
}

function validReward(project: Project, session: PlaySession, reward: BundleRewardDefinition | undefined): boolean {
  if (!reward) return true;
  if (reward.gold !== undefined && (!safeNonNegative(reward.gold) || !safeNonNegative(session.gold) || session.gold + reward.gold > GOLD_MAX)) return false;
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const totals = new Map<string, number>();
  for (const item of reward.itemRewards ?? []) {
    if (!itemIds.has(item.itemId) || !isPositiveItemQuantity(item.count)) return false;
    totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.count);
  }
  for (const [itemId, amount] of totals) {
    const current = session.inventory[itemId] ?? 0;
    if (!isItemQuantity(current) || !Number.isSafeInteger(amount) || amount > ITEM_QUANTITY_MAX - current) return false;
  }
  const switchIds = new Set(project.switches.map((entry) => entry.id));
  if (reward.switchId && !switchIds.has(reward.switchId)) return false;
  const unlocks = new Map((project.system.worldUnlocks ?? []).map((entry) => [entry.id, entry] as const));
  if ((reward.worldUnlockIds ?? []).some((id) => !unlocks.has(id) || (unlocks.get(id)?.switchId && !switchIds.has(unlocks.get(id)!.switchId!)))) return false;
  const recipes = new Set((project.system.craftRecipes ?? []).map((entry) => entry.id));
  return !(reward.recipeIds ?? []).some((id) => !recipes.has(id));
}

function applyReward(project: Project, session: PlaySession, reward: BundleRewardDefinition | undefined): void {
  if (!reward) return;
  if (reward.gold) changeGold(session, "+=", reward.gold);
  if (reward.switchId) setSwitch(session, reward.switchId, true);
  const unlocks = new Map((project.system.worldUnlocks ?? []).map((entry) => [entry.id, entry] as const));
  for (const id of reward.worldUnlockIds ?? []) {
    session.unlockedRegionIds ??= [];
    if (!session.unlockedRegionIds.includes(id)) session.unlockedRegionIds.push(id);
    const switchId = unlocks.get(id)?.switchId;
    if (switchId) setSwitch(session, switchId, true);
  }
  for (const id of reward.recipeIds ?? []) {
    session.unlockedRecipeIds ??= [];
    if (!session.unlockedRecipeIds.includes(id)) session.unlockedRecipeIds.push(id);
  }
}
function safeNonNegative(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
