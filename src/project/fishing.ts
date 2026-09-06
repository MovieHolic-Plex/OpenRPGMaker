import { incrementCollection, canIncrementCollection } from "@/project/collections";
import { spendEnergy } from "@/project/energy";
import { timePhaseFor } from "@/project/gameTime";
import { isItemQuantity, ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { awardLifeSkillXp } from "@/project/lifeSkillProgress";
import { changeItemsAtomically, nextSessionRandom, type PlaySession } from "@/project/session";
import type { FishingCatchRule, Project } from "@/project/types";

export type FishingLocation = { readonly mapId: string; readonly x: number; readonly y: number };
export type FishingAvailabilityResult =
  | { readonly ok: true; readonly spotId: string; readonly fishIds: readonly string[] }
  | { readonly ok: false; readonly reason: "disabled" | "no-spot" | "unavailable" | "invalid-state" };
export type FishingCatchResult =
  | { readonly ok: true; readonly spotId: string; readonly fishId: string; readonly itemId: string }
  | { readonly ok: false; readonly reason: "disabled" | "no-spot" | "unavailable" | "invalid-state" | "energy" | "inventory" | "collection" | "xp" };

export function resolveFishingAvailability(project: Project, session: PlaySession, location: FishingLocation): FishingAvailabilityResult {
  const config = project.system.fishing;
  if (!config?.enabled) return { ok: false, reason: "disabled" };
  if (!Number.isSafeInteger(location.x) || !Number.isSafeInteger(location.y)) return { ok: false, reason: "invalid-state" };
  const spot = config.spots.find((entry) => entry.mapId === location.mapId && inRect(location.x, location.y, entry.area));
  if (!spot) return { ok: false, reason: "no-spot" };
  const fishIds = availableRules(project, session, spot.catches).map((rule) => rule.fishId);
  return fishIds.length ? { ok: true, spotId: spot.id, fishIds } : { ok: false, reason: "unavailable" };
}

export function attemptFishingCatch(project: Project, session: PlaySession, location: FishingLocation): FishingCatchResult {
  const availability = resolveFishingAvailability(project, session, location);
  if (!availability.ok) return availability;
  if (!session.collections) return { ok: false, reason: "invalid-state" };
  const spot = project.system.fishing!.spots.find((entry) => entry.id === availability.spotId)!;
  const rules = availableRules(project, session, spot.catches);
  const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
  if (!Number.isSafeInteger(total) || total <= 0) return { ok: false, reason: "invalid-state" };
  const fishById = new Map((project.database.fishSpecies ?? []).map((fish) => [fish.id, fish] as const));
  const itemIds = new Set(project.database.items.map((item) => item.id));
  if (rules.some((rule) => {
    const fish = fishById.get(rule.fishId);
    return !fish || !itemIds.has(fish.itemId) || !Number.isSafeInteger(rule.weight) || rule.weight <= 0;
  })) {
    return { ok: false, reason: "invalid-state" };
  }
  const draft = structuredClone(session);
  let roll = nextSessionRandom(draft, "fishing") * total;
  const selected = rules.find((rule) => ((roll -= rule.weight) < 0)) ?? rules[rules.length - 1]!;
  const fish = fishById.get(selected.fishId)!;
  const current = session.inventory[fish.itemId] ?? 0;
  if (!isItemQuantity(current) || current >= ITEM_QUANTITY_MAX) return { ok: false, reason: "inventory" };
  if (!canIncrementCollection(session, fish.itemId, "caughtCount", 1)) return { ok: false, reason: "collection" };
  const energyCost = project.system.fishing?.energyCost ?? 0;
  if (energyCost > 0 && !spendEnergy(project, draft, energyCost).ok) return { ok: false, reason: "energy" };
  if (!changeItemsAtomically(draft, [{ itemId: fish.itemId, op: "+=", amount: 1 }])) return { ok: false, reason: "inventory" };
  if (!incrementCollection(draft, fish.itemId, "caughtCount", 1)) return { ok: false, reason: "collection" };
  if (project.system.skillSystem?.enabled === true && (fish.skillXp ?? 0) > 0) {
    const skill = project.database.lifeSkills?.find((entry) => entry.skillType === "fishing");
    if (!skill || !awardLifeSkillXp(project, draft, skill.id, fish.skillXp!).ok) return { ok: false, reason: "xp" };
  }
  replace(session, draft);
  return { ok: true, spotId: spot.id, fishId: fish.id, itemId: fish.itemId };
}

function availableRules(project: Project, session: PlaySession, rules: readonly FishingCatchRule[]): FishingCatchRule[] {
  const fishIds = new Set((project.database.fishSpecies ?? []).map((fish) => fish.id));
  const phase = timePhaseFor(session.gameTime);
  const weather = session.dailyWeather?.kind ?? "none";
  const fishingSkill = project.database.lifeSkills?.find((entry) => entry.skillType === "fishing");
  const level = fishingSkill ? session.lifeSkills?.[fishingSkill.id]?.level ?? 1 : 0;
  return rules.filter((rule) => fishIds.has(rule.fishId)
    && (!rule.seasons?.length || Boolean(session.gameTime && rule.seasons.includes(session.gameTime.season)))
    && (!rule.timePhases?.length || Boolean(phase && rule.timePhases.includes(phase)))
    && (!rule.weatherKinds?.length || rule.weatherKinds.includes(weather))
    && (rule.minSkillLevel === undefined || level >= rule.minSkillLevel));
}

function inRect(x: number, y: number, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}
function replace(target: PlaySession, source: PlaySession): void { Object.assign(target, source); }
