import { SEASONS, isSeason } from "@/project/gameTime";
import { ITEM_QUANTITY_MAX, isItemQuantity } from "@/project/itemQuantities";
import type {
  DailyWeatherConfig,
  DailyWeatherRule,
  EventPageGraphic,
  FarmAnimalBuildingDefinition,
  FarmAnimalSpeciesRecord,
  FarmAnimalStartInstance,
  WeatherKind,
} from "@/project/types";
import type { DailyWeatherState, FarmAnimalState } from "@/project/session";

export const FARM_ANIMAL_RECORD_LIMIT = 500;
export const FARM_ANIMAL_BUILDING_CAPACITY_MAX = 500;
export const FARM_ANIMAL_FRIENDSHIP_MAX = 1_000;
export const WEATHER_FORECAST_DAYS_MAX = 7;
export const WEATHER_RULES_PER_SEASON_LIMIT = 128;
export const WEATHER_WEIGHT_MAX = 1_000_000;

export const FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX = 3_650;
const CALENDAR_DAY_KEY_PATTERN = /^([1-9]\d*):(spring|summer|fall|winter):([1-9]\d*)$/;

export function isWeatherKind(value: unknown): value is WeatherKind {
  return value === "none" || value === "rain" || value === "storm" || value === "snow" || value === "fog";
}

export function normalizeDailyWeatherConfig(value: DailyWeatherConfig | undefined): DailyWeatherConfig | undefined {
  if (!isRecord(value)) return undefined;
  const seasons: DailyWeatherConfig["seasons"] = {};
  const rawSeasons = isRecord(value.seasons) ? value.seasons : {};
  for (const season of SEASONS) {
    const rawRules = rawSeasons[season];
    if (!Array.isArray(rawRules)) continue;
    const rules = rawRules
      .slice(0, WEATHER_RULES_PER_SEASON_LIMIT)
      .flatMap((rule): DailyWeatherRule[] => {
        if (!isRecord(rule) || !isWeatherKind(rule.kind)) return [];
        const weight = positiveBoundedInteger(rule.weight, WEATHER_WEIGHT_MAX);
        if (weight === undefined) return [];
        const intensity = optionalClampedNumber(rule.intensity, 0, 1);
        return [{
          kind: rule.kind,
          weight,
          ...(intensity !== undefined ? { intensity } : {}),
        }];
      });
    seasons[season] = rules;
  }
  return {
    enabled: value.enabled === true,
    ...(value.forecastDays !== undefined
      ? { forecastDays: clampInteger(value.forecastDays, 1, WEATHER_FORECAST_DAYS_MAX) }
      : {}),
    seasons,
  };
}

export function normalizeFarmAnimalSpeciesRecords(
  values: readonly FarmAnimalSpeciesRecord[] | undefined,
): FarmAnimalSpeciesRecord[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const result: FarmAnimalSpeciesRecord[] = [];
  const seen = new Set<string>();
  for (const raw of values.slice(0, FARM_ANIMAL_RECORD_LIMIT)) {
    if (!isRecord(raw)) continue;
    const id = cleanId(raw.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const feedItemId = cleanId(raw.feedItemId);
    const productItemId = cleanId(raw.productItemId);
    if (!feedItemId || !productItemId) continue;
    const graphic = normalizeEventPageGraphic(raw.graphic);
    result.push({
      id,
      name: cleanText(raw.name) ?? id,
      ...(graphic ? { graphic } : {}),
      feedItemId,
      productItemId,
      productCount: clampInteger(raw.productCount, 1, ITEM_QUANTITY_MAX),
      productEveryDays: clampInteger(raw.productEveryDays, 1, FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX),
      petFriendship: clampInteger(raw.petFriendship, 0, FARM_ANIMAL_FRIENDSHIP_MAX),
    });
  }
  return result;
}

export function normalizeFarmAnimalBuildingDefinitions(
  values: readonly FarmAnimalBuildingDefinition[] | undefined,
): FarmAnimalBuildingDefinition[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const result: FarmAnimalBuildingDefinition[] = [];
  const seen = new Set<string>();
  for (const raw of values.slice(0, FARM_ANIMAL_RECORD_LIMIT)) {
    if (!isRecord(raw)) continue;
    const id = cleanId(raw.id);
    const mapId = cleanId(raw.mapId);
    if (!id || seen.has(id) || !mapId) continue;
    seen.add(id);
    result.push({
      id,
      name: cleanText(raw.name) ?? id,
      mapId,
      x: safeIntegerOr(raw.x, 0),
      y: safeIntegerOr(raw.y, 0),
      capacity: clampInteger(raw.capacity, 1, FARM_ANIMAL_BUILDING_CAPACITY_MAX),
      allowedSpeciesIds: uniqueIds(raw.allowedSpeciesIds).slice(0, FARM_ANIMAL_RECORD_LIMIT),
    });
  }
  return result;
}

export function normalizeFarmAnimalStartInstances(
  values: readonly FarmAnimalStartInstance[] | undefined,
): FarmAnimalStartInstance[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const result: FarmAnimalStartInstance[] = [];
  const seen = new Set<string>();
  for (const raw of values.slice(0, FARM_ANIMAL_RECORD_LIMIT)) {
    if (!isRecord(raw)) continue;
    const instanceId = cleanId(raw.instanceId);
    const speciesId = cleanId(raw.speciesId);
    if (!instanceId || seen.has(instanceId) || !speciesId) continue;
    seen.add(instanceId);
    const eventId = cleanId(raw.eventId);
    const buildingId = cleanId(raw.buildingId);
    result.push({
      instanceId,
      speciesId,
      name: cleanText(raw.name) ?? instanceId,
      ...(eventId ? { eventId } : {}),
      ...(buildingId ? { buildingId } : {}),
    });
  }
  return result;
}

export function initialFarmAnimalStates(
  starts: readonly FarmAnimalStartInstance[] | undefined,
): Record<string, FarmAnimalState> | undefined {
  if (starts === undefined) return undefined;
  return Object.fromEntries(normalizeFarmAnimalStartInstances(starts)?.map((animal) => [
    animal.instanceId,
    initialFarmAnimalState(animal),
  ]) ?? []);
}

export function normalizeDailyWeatherState(value: unknown): DailyWeatherState | undefined {
  if (!isRecord(value) || !isCalendarDayKey(value.dayKey) || !isWeatherKind(value.kind)) return undefined;
  if (typeof value.intensity !== "number" || !Number.isFinite(value.intensity)) return undefined;
  return {
    dayKey: value.dayKey,
    kind: value.kind,
    intensity: value.kind === "none" ? 0 : Math.max(0, Math.min(1, value.intensity)),
  };
}

/** Project-independent parser used at the save boundary; project ids are filtered during apply. */
export function parseFarmAnimalStateRecord(value: unknown): Record<string, FarmAnimalState> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, FarmAnimalState> = {};
  for (const [instanceId, raw] of Object.entries(value).slice(0, FARM_ANIMAL_RECORD_LIMIT)) {
    const state = normalizeFarmAnimalState(raw, instanceId);
    if (state) result[instanceId] = state;
  }
  return result;
}

export function restoreFarmAnimalStates(
  starts: readonly FarmAnimalStartInstance[] | undefined,
  saved: Record<string, FarmAnimalState> | undefined,
  knownSpeciesIds: ReadonlySet<string>,
): Record<string, FarmAnimalState> | undefined {
  if (starts === undefined && saved === undefined) return undefined;
  const normalizedStarts = normalizeFarmAnimalStartInstances(starts) ?? [];
  const startById = new Map(normalizedStarts.map((animal) => [animal.instanceId, animal] as const));
  const restored: Record<string, FarmAnimalState> = {};

  for (const start of normalizedStarts) restored[start.instanceId] = initialFarmAnimalState(start);
  for (const [instanceId, state] of Object.entries(saved ?? {}).slice(0, FARM_ANIMAL_RECORD_LIMIT)) {
    if (!knownSpeciesIds.has(state.speciesId)) continue;
    const start = startById.get(instanceId);
    if (start && state.speciesId !== start.speciesId) continue;
    const identity = start ?? state;
    restored[instanceId] = {
      instanceId,
      speciesId: identity.speciesId,
      name: identity.name,
      ...(identity.eventId ? { eventId: identity.eventId } : {}),
      ...(identity.buildingId ? { buildingId: identity.buildingId } : {}),
      friendship: state.friendship,
      productionProgress: state.productionProgress,
      readyProductCount: state.readyProductCount,
      ...(state.lastFedDayKey ? { lastFedDayKey: state.lastFedDayKey } : {}),
      ...(state.lastPettedDayKey ? { lastPettedDayKey: state.lastPettedDayKey } : {}),
      ...(state.lastAdvancedDayKey ? { lastAdvancedDayKey: state.lastAdvancedDayKey } : {}),
    };
  }
  return restored;
}

export function isCalendarDayKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = CALENDAR_DAY_KEY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const season = match[2];
  const day = Number(match[3]);
  return Number.isSafeInteger(year) && Number.isSafeInteger(day) && day <= 99 && isSeason(season);
}

function initialFarmAnimalState(animal: FarmAnimalStartInstance): FarmAnimalState {
  return {
    ...animal,
    friendship: 0,
    productionProgress: 0,
    readyProductCount: 0,
  };
}

function normalizeFarmAnimalState(value: unknown, recordKey: string): FarmAnimalState | undefined {
  if (!isRecord(value) || value.instanceId !== recordKey) return undefined;
  const instanceId = cleanId(value.instanceId);
  const speciesId = cleanId(value.speciesId);
  const name = cleanText(value.name);
  if (!instanceId || !speciesId || !name) return undefined;
  if (!isBoundedSafeInteger(value.friendship, 0, FARM_ANIMAL_FRIENDSHIP_MAX)) return undefined;
  if (!isItemQuantity(value.productionProgress) || !isItemQuantity(value.readyProductCount)) return undefined;
  for (const key of ["lastFedDayKey", "lastPettedDayKey", "lastAdvancedDayKey"] as const) {
    if (value[key] !== undefined && !isCalendarDayKey(value[key])) return undefined;
  }
  const eventId = cleanId(value.eventId);
  const buildingId = cleanId(value.buildingId);
  return {
    instanceId,
    speciesId,
    name,
    ...(eventId ? { eventId } : {}),
    ...(buildingId ? { buildingId } : {}),
    friendship: value.friendship,
    productionProgress: value.productionProgress,
    readyProductCount: value.readyProductCount,
    ...(value.lastFedDayKey ? { lastFedDayKey: value.lastFedDayKey as string } : {}),
    ...(value.lastPettedDayKey ? { lastPettedDayKey: value.lastPettedDayKey as string } : {}),
    ...(value.lastAdvancedDayKey ? { lastAdvancedDayKey: value.lastAdvancedDayKey as string } : {}),
  };
}

function normalizeEventPageGraphic(value: unknown): EventPageGraphic | undefined {
  if (!isRecord(value)) return undefined;
  const sprite: EventPageGraphic["sprite"] = isRecord(value.sprite)
    && (value.sprite.type === "bundled" || value.sprite.type === "uploaded")
    && cleanId(value.sprite.id)
      ? { type: value.sprite.type, id: cleanId(value.sprite.id)! }
      : undefined;
  const direction = value.direction === "down" || value.direction === "left" || value.direction === "right" || value.direction === "up"
    ? value.direction
    : undefined;
  const pattern = Number.isSafeInteger(value.pattern) ? value.pattern as number : undefined;
  const transparent = typeof value.transparent === "boolean" ? value.transparent : undefined;
  if (!sprite && !direction && pattern === undefined && transparent === undefined) return undefined;
  return {
    ...(sprite ? { sprite } : {}),
    ...(direction ? { direction } : {}),
    ...(pattern !== undefined ? { pattern } : {}),
    ...(transparent !== undefined ? { transparent } : {}),
  };
}

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((entry) => cleanId(entry) ? [cleanId(entry)!] : []))];
}

function cleanId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function positiveBoundedInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function optionalClampedNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

function safeIntegerOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
}

function isBoundedSafeInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
