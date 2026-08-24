import { isSeason, isTimePhase, SEASONS, TIME_PHASES } from "@/project/gameTime";
import { isWeatherKind } from "@/project/p1FoundationRecords";
import type {
  BundleRewardDefinition,
  CollectionSystemConfig,
  FishSpeciesRecord,
  FishingCatchRule,
  FishingSpotDefinition,
  FishingSystemConfig,
  ForageAreaDefinition,
  ForageEntryDefinition,
  MuseumRewardDefinition,
  MuseumSystemConfig,
  SeasonalForageConfig,
  Season,
} from "@/project/types";

export const P2_RECORD_LIMIT = 500;
export const P2_RULE_LIMIT = 500;
export const P2_WEIGHT_MAX = 1_000_000;
export const P2_COUNT_MAX = 9_999_999;

export function normalizeFishSpeciesRecords(values: readonly FishSpeciesRecord[] | undefined): FishSpeciesRecord[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const seen = new Set<string>();
  return values.slice(0, P2_RECORD_LIMIT).flatMap((raw): FishSpeciesRecord[] => {
    if (!isRecord(raw)) return [];
    const id = cleanId(raw.id);
    const itemId = cleanId(raw.itemId);
    if (!id || !itemId || seen.has(id)) return [];
    seen.add(id);
    const skillXp = optionalInteger(raw.skillXp, 0, P2_COUNT_MAX);
    return [{ id, name: cleanText(raw.name) ?? id, itemId, ...(skillXp !== undefined ? { skillXp } : {}) }];
  });
}

export function normalizeFishingSystem(value: FishingSystemConfig | undefined): FishingSystemConfig | undefined {
  if (!isRecord(value)) return undefined;
  const seen = new Set<string>();
  const spots = (Array.isArray(value.spots) ? value.spots : []).slice(0, P2_RECORD_LIMIT).flatMap((raw): FishingSpotDefinition[] => {
    if (!isRecord(raw)) return [];
    const id = cleanId(raw.id);
    const mapId = cleanId(raw.mapId);
    const area = normalizeRect(raw.area);
    if (!id || !mapId || !area || seen.has(id)) return [];
    seen.add(id);
    const catches = normalizeCatchRules(raw.catches);
    return [{ id, ...(cleanText(raw.name) ? { name: cleanText(raw.name) } : {}), mapId, area, catches }];
  });
  const energyCost = optionalInteger(value.energyCost, 0, P2_COUNT_MAX);
  return { enabled: value.enabled === true, ...(energyCost !== undefined ? { energyCost } : {}), spots };
}

export function normalizeSeasonalForage(value: SeasonalForageConfig | undefined): SeasonalForageConfig | undefined {
  if (!isRecord(value)) return undefined;
  const seen = new Set<string>();
  const areas = (Array.isArray(value.areas) ? value.areas : []).slice(0, P2_RECORD_LIMIT).flatMap((raw): ForageAreaDefinition[] => {
    if (!isRecord(raw)) return [];
    const id = cleanId(raw.id);
    const mapId = cleanId(raw.mapId);
    const area = normalizeRect(raw.area);
    if (!id || !mapId || !area || seen.has(id)) return [];
    seen.add(id);
    const spawnEveryDays = optionalInteger(raw.spawnEveryDays, 1, 3_650);
    return [{
      id,
      ...(cleanText(raw.name) ? { name: cleanText(raw.name) } : {}),
      mapId,
      area,
      dailySpawnCount: integer(raw.dailySpawnCount, 0, P2_COUNT_MAX, 0),
      maxActive: integer(raw.maxActive, 0, P2_COUNT_MAX, 0),
      ...(spawnEveryDays !== undefined ? { spawnEveryDays } : {}),
      despawnAfterDays: integer(raw.despawnAfterDays, 1, 3_650, 1),
      entries: normalizeForageEntries(raw.entries),
    }];
  });
  return { enabled: value.enabled === true, areas };
}

export function normalizeCollectionSystem(value: CollectionSystemConfig | undefined): CollectionSystemConfig | undefined {
  if (!isRecord(value)) return undefined;
  const trackedItemIds = uniqueIds(value.trackedItemIds).slice(0, P2_RECORD_LIMIT);
  return { enabled: value.enabled === true, ...(value.trackedItemIds !== undefined ? { trackedItemIds } : {}) };
}

export function normalizeMuseumSystem(value: MuseumSystemConfig | undefined): MuseumSystemConfig | undefined {
  if (!isRecord(value)) return undefined;
  const seen = new Set<string>();
  const rewards = (Array.isArray(value.rewards) ? value.rewards : []).slice(0, P2_RECORD_LIMIT).flatMap((raw): MuseumRewardDefinition[] => {
    if (!isRecord(raw)) return [];
    const id = cleanId(raw.id);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const minDonations = optionalInteger(raw.minDonations, 1, P2_COUNT_MAX);
    const requiredItemIds = uniqueIds(raw.requiredItemIds).slice(0, P2_RECORD_LIMIT);
    const reward = normalizeReward(raw.reward);
    if (minDonations === undefined && requiredItemIds.length === 0) return [];
    return [{
      id,
      ...(cleanText(raw.name) ? { name: cleanText(raw.name) } : {}),
      ...(minDonations !== undefined ? { minDonations } : {}),
      ...(requiredItemIds.length > 0 ? { requiredItemIds } : {}),
      ...(reward ? { reward } : {}),
    }];
  });
  return { enabled: value.enabled === true, eligibleItemIds: uniqueIds(value.eligibleItemIds).slice(0, P2_RECORD_LIMIT), rewards };
}

function normalizeCatchRules(value: unknown): FishingCatchRule[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, P2_RULE_LIMIT).flatMap((raw): FishingCatchRule[] => {
    if (!isRecord(raw)) return [];
    const fishId = cleanId(raw.fishId);
    if (!fishId || seen.has(fishId)) return [];
    seen.add(fishId);
    const weight = optionalInteger(raw.weight, 1, P2_WEIGHT_MAX);
    if (weight === undefined) return [];
    const minSkillLevel = optionalInteger(raw.minSkillLevel, 1, 99);
    const seasons = uniqueEnums(raw.seasons, isSeason, SEASONS);
    const timePhases = uniqueEnums(raw.timePhases, isTimePhase, TIME_PHASES);
    const weatherKinds = uniqueEnums(raw.weatherKinds, isWeatherKind, ["none", "rain", "storm", "snow", "fog"] as const);
    return [{ fishId, weight,
      ...(raw.seasons !== undefined ? { seasons } : {}),
      ...(raw.timePhases !== undefined ? { timePhases } : {}),
      ...(raw.weatherKinds !== undefined ? { weatherKinds } : {}),
      ...(minSkillLevel !== undefined ? { minSkillLevel } : {}),
    }];
  });
}

function normalizeForageEntries(value: unknown): ForageEntryDefinition[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, P2_RULE_LIMIT).flatMap((raw): ForageEntryDefinition[] => {
    if (!isRecord(raw)) return [];
    const id = cleanId(raw.id);
    if (!id || seen.has(id)) return [];
    const weight = optionalInteger(raw.weight, 1, P2_WEIGHT_MAX);
    const itemId = cleanId(raw.itemId);
    const seasonalDrops: Partial<Record<Season, string>> = {};
    if (isRecord(raw.seasonalDrops)) for (const season of SEASONS) {
      const drop = cleanId(raw.seasonalDrops[season]);
      if (drop) seasonalDrops[season] = drop;
    }
    if (weight === undefined || (!itemId && Object.keys(seasonalDrops).length === 0)) return [];
    seen.add(id);
    return [{ id, weight, ...(itemId ? { itemId } : {}), ...(Object.keys(seasonalDrops).length ? { seasonalDrops } : {}) }];
  });
}

function normalizeReward(value: unknown): BundleRewardDefinition | undefined {
  if (!isRecord(value)) return undefined;
  const gold = optionalInteger(value.gold, 0, P2_COUNT_MAX);
  const itemRewards = Array.isArray(value.itemRewards) ? value.itemRewards.slice(0, P2_RECORD_LIMIT).flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const itemId = cleanId(raw.itemId);
    const count = optionalInteger(raw.count, 1, P2_COUNT_MAX);
    return itemId && count !== undefined ? [{ itemId, count }] : [];
  }) : undefined;
  const switchId = cleanId(value.switchId);
  const worldUnlockIds = uniqueIds(value.worldUnlockIds).slice(0, P2_RECORD_LIMIT);
  const recipeIds = uniqueIds(value.recipeIds).slice(0, P2_RECORD_LIMIT);
  return {
    ...(gold !== undefined ? { gold } : {}),
    ...(itemRewards !== undefined ? { itemRewards } : {}),
    ...(switchId ? { switchId } : {}),
    ...(worldUnlockIds.length ? { worldUnlockIds } : {}),
    ...(recipeIds.length ? { recipeIds } : {}),
  };
}

function normalizeRect(value: unknown): { x: number; y: number; w: number; h: number } | undefined {
  if (!isRecord(value)) return undefined;
  if (![value.x, value.y, value.w, value.h].every(Number.isSafeInteger)) return undefined;
  if ((value.w as number) <= 0 || (value.h as number) <= 0) return undefined;
  return { x: value.x as number, y: value.y as number, w: value.w as number, h: value.h as number };
}

function uniqueEnums<T extends string>(value: unknown, guard: (entry: unknown) => entry is T, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(guard))].filter((entry) => allowed.includes(entry));
}

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanId).filter((id): id is string => Boolean(id)))];
}

function cleanId(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function cleanText(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function optionalInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : undefined;
}
function integer(value: unknown, min: number, max: number, fallback: number): number { return optionalInteger(value, min, max) ?? fallback; }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
