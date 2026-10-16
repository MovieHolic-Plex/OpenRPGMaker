import { inBounds } from "@/project/collision";
import { resolveToolUseOnTile, toolActionRulesOf } from "@/project/toolActions";
import { incrementCollection, canIncrementCollection } from "@/project/collections";
import { spendEnergy } from "@/project/energy";
import { timePhaseFor } from "@/project/gameTime";
import { isItemQuantity, ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { awardLifeSkillXp } from "@/project/lifeSkillProgress";
import { changeItemsAtomically, nextSessionRandom, type PlaySession } from "@/project/session";
import type { FishingCatchRule, FishingMonsterCatchRule, Project } from "@/project/types";
import { wildTroopIdForSpecies } from "@/project/wildTroops";

export type FishingLocation = { readonly mapId: string; readonly x: number; readonly y: number };
export type FishingAvailabilityResult =
  | { readonly ok: true; readonly spotId: string; readonly fishIds: readonly string[] }
  | { readonly ok: false; readonly reason: "disabled" | "no-spot" | "unavailable" | "invalid-state" };
export type FishingCatchResult =
  | { readonly ok: true; readonly spotId: string; readonly fishId: string; readonly itemId: string }
  /** 몬스터가 낚였다: 호출자가 troopId 로 야생 전투를 연다(level 이 있으면 enemyLevel 로 넘긴다). */
  | { readonly ok: true; readonly kind: "encounter"; readonly spotId: string; readonly speciesId: string; readonly troopId: string; readonly level?: number }
  | { readonly ok: false; readonly reason: "disabled" | "no-spot" | "unavailable" | "invalid-state" | "energy" | "inventory" | "collection" | "xp" | "tool" };

export function resolveFishingAvailability(project: Project, session: PlaySession, location: FishingLocation): FishingAvailabilityResult {
  const config = project.system.fishing;
  if (!config?.enabled) return { ok: false, reason: "disabled" };
  const map = project.maps[location.mapId];
  if (!map || !Number.isSafeInteger(location.x) || !Number.isSafeInteger(location.y)
    || !inBounds(map, location.x, location.y)) return { ok: false, reason: "invalid-state" };
  const spot = fishingSpotAt(project, location);
  if (!spot) return { ok: false, reason: "no-spot" };
  const fishIds = availableRules(project, session, spot.catches).map((rule) => rule.fishId);
  const monsters = availableMonsterRules(project, session, spot.monsterCatches ?? []);
  return fishIds.length || monsters.length ? { ok: true, spotId: spot.id, fishIds } : { ok: false, reason: "unavailable" };
}

/** Authored regions only; membership is separate from eligibility/refusal. */
export function fishingSpotAt(project: Project, location: FishingLocation) {
  return project.system.fishing?.spots.find((entry) => entry.mapId === location.mapId && inRect(location.x, location.y, entry.area));
}

export function attemptFishingCatch(project: Project, session: PlaySession, location: FishingLocation): FishingCatchResult {
  const availability = resolveFishingAvailability(project, session, location);
  if (!availability.ok) return availability;
  const map = project.maps[location.mapId];
  if (!map || !session.collections) return { ok: false, reason: "invalid-state" };
  if (toolActionRulesOf(project).some((rule) => rule.action === "fish")
    && !resolveToolUseOnTile(project, session, map, location.x, location.y, "fish")) {
    return { ok: false, reason: "tool" };
  }
  const spot = project.system.fishing!.spots.find((entry) => entry.id === availability.spotId)!;
  const fishRules = availableRules(project, session, spot.catches);
  const monsterRules = availableMonsterRules(project, session, spot.monsterCatches ?? []);
  // 어종과 몬스터는 한 가중치 풀에서 함께 뽑힌다(몬스터 규칙이 어종을 가리지 않는다).
  const pool: Array<{ readonly weight: number; readonly fish?: FishingCatchRule; readonly monster?: FishingMonsterCatchRule }> = [
    ...fishRules.map((fish) => ({ weight: fish.weight, fish })),
    ...monsterRules.map((monster) => ({ weight: monster.weight, monster })),
  ];
  const rules = fishRules;
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
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
  const selectedEntry = pool.find((entry) => ((roll -= entry.weight) < 0)) ?? pool[pool.length - 1]!;
  if (selectedEntry.monster) {
    const monster = selectedEntry.monster;
    const troopId = wildTroopIdForSpecies(project, monster.speciesId);
    if (!troopId) return { ok: false, reason: "invalid-state" };
    const energy = project.system.fishing?.energyCost ?? 0;
    if (energy > 0 && !spendEnergy(project, draft, energy).ok) return { ok: false, reason: "energy" };
    const level = rollMonsterLevel(monster, () => nextSessionRandom(draft, "fishing"));
    replace(session, draft);
    return { ok: true, kind: "encounter", spotId: spot.id, speciesId: monster.speciesId, troopId, ...(level !== undefined ? { level } : {}) };
  }
  const selected = selectedEntry.fish!;
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

function rollMonsterLevel(rule: FishingMonsterCatchRule, rng: () => number): number | undefined {
  const lo = rule.levelMin ?? rule.levelMax;
  const hi = rule.levelMax ?? rule.levelMin;
  if (lo === undefined || hi === undefined) return undefined;
  const min = Math.max(1, Math.min(99, Math.trunc(Math.min(lo, hi))));
  const max = Math.max(1, Math.min(99, Math.trunc(Math.max(lo, hi))));
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
}

function availableMonsterRules(project: Project, session: PlaySession, rules: readonly FishingMonsterCatchRule[]): FishingMonsterCatchRule[] {
  if (!rules.length) return [];
  const speciesIds = new Set((project.database.monsterSpecies ?? []).map((species) => species.id));
  const phase = timePhaseFor(session.gameTime);
  const weather = session.dailyWeather?.kind ?? "none";
  return rules.filter((rule) => speciesIds.has(rule.speciesId)
    && Number.isSafeInteger(rule.weight) && rule.weight > 0
    && wildTroopIdForSpecies(project, rule.speciesId) !== undefined
    && (!rule.seasons?.length || Boolean(session.gameTime && rule.seasons.includes(session.gameTime.season)))
    && (!rule.timePhases?.length || Boolean(phase && rule.timePhases.includes(phase)))
    && (!rule.weatherKinds?.length || rule.weatherKinds.includes(weather)));
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
