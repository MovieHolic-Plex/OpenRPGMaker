import {
  advanceGameDays,
  calendarDayKey,
  daysPerSeasonOf,
  type GameTime,
} from "@/project/gameTime";
import {
  isWeatherKind,
  WEATHER_FORECAST_DAYS_MAX,
  WEATHER_RULES_PER_SEASON_LIMIT,
  WEATHER_WEIGHT_MAX,
} from "@/project/p1FoundationRecords";
import type { DailyWeatherState, PlaySession } from "@/project/session";
import type { DailyWeatherConfig, DailyWeatherRule, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";

const DEFAULT_FORECAST_DAYS = 1;
const DEFAULT_WEATHER_INTENSITY = 0.5;
const DEFAULT_WEATHER_SEED = 1;

type WeatherSessionSource = Pick<PlaySession, "gameTime" | "rng">;

/**
 * Resolves one calendar day's weather without reading or advancing a mutable RNG stream.
 * The same project table, session seed, and day key always produce the same result.
 */
export function resolveDailyWeatherForDate(
  project: Pick<Project, "system">,
  sessionSeed: number,
  date: GameTime,
): DailyWeatherState {
  const dayKey = calendarDayKey(date);
  const rules = usableRules(project.system.dailyWeather, date);
  const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
  if (totalWeight <= 0) return clearWeather(dayKey);

  let cursor = mulberry32(weatherSeed(sessionSeed, dayKey))() * totalWeight;
  for (const rule of rules) {
    cursor -= rule.weight;
    if (cursor < 0) return weatherState(dayKey, rule);
  }
  // Floating-point drift must never make a valid table produce an invalid/undefined result.
  const fallback = rules[rules.length - 1];
  return fallback ? weatherState(dayKey, fallback) : clearWeather(dayKey);
}

/**
 * Returns the authored number of future days, starting tomorrow. Forecasts are derived and
 * never stored, so querying them cannot affect current weather or any session RNG stream.
 */
export function dailyWeatherForecast(
  project: Pick<Project, "system">,
  session: WeatherSessionSource,
  fromDate: GameTime | undefined = session.gameTime,
): DailyWeatherState[] {
  const config = project.system.dailyWeather;
  if (!config?.enabled || !fromDate) return [];
  const count = forecastDayCount(config.forecastDays);
  const calendarSystem = {
    enabled: true as const,
    daysPerSeason: daysPerSeasonOf(project.system.timeSystem),
  };
  const seed = session.rng?.seed ?? DEFAULT_WEATHER_SEED;
  return Array.from({ length: count }, (_, index) => {
    const date = advanceGameDays(fromDate, index + 1, calendarSystem).time;
    return resolveDailyWeatherForDate(project, seed, date);
  });
}

/** Applies one resolved day to session state while leaving every RNG stream untouched. */
export function applyDailyWeatherForDate(
  project: Pick<Project, "system">,
  session: PlaySession,
  date: GameTime | undefined = session.gameTime,
): DailyWeatherState | undefined {
  if (!project.system.dailyWeather?.enabled || !date) {
    session.dailyWeather = undefined;
    return undefined;
  }
  const weather = resolveDailyWeatherForDate(
    project,
    session.rng?.seed ?? DEFAULT_WEATHER_SEED,
    date,
  );
  session.dailyWeather = weather;
  return weather;
}

function usableRules(
  config: DailyWeatherConfig | undefined,
  date: GameTime,
): Array<{ readonly kind: DailyWeatherRule["kind"]; readonly weight: number; readonly intensity?: number }> {
  if (!config?.enabled || !isRecord(config.seasons)) return [];
  const rawRules: unknown = config.seasons[date.season];
  if (!Array.isArray(rawRules)) return [];
  return rawRules.slice(0, WEATHER_RULES_PER_SEASON_LIMIT).flatMap((raw) => {
    if (!isRecord(raw) || !isWeatherKind(raw.kind)) return [];
    const weight = boundedPositiveInteger(raw.weight, WEATHER_WEIGHT_MAX);
    if (weight === undefined) return [];
    const intensity = optionalIntensity(raw.intensity);
    return [{ kind: raw.kind, weight, ...(intensity !== undefined ? { intensity } : {}) }];
  });
}

function weatherState(
  dayKey: string,
  rule: { readonly kind: DailyWeatherRule["kind"]; readonly intensity?: number },
): DailyWeatherState {
  if (rule.kind === "none") return clearWeather(dayKey);
  return {
    dayKey,
    kind: rule.kind,
    intensity: rule.intensity ?? DEFAULT_WEATHER_INTENSITY,
  };
}

function clearWeather(dayKey: string): DailyWeatherState {
  return { dayKey, kind: "none", intensity: 0 };
}

function forecastDayCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_FORECAST_DAYS;
  return Math.max(1, Math.min(WEATHER_FORECAST_DAYS_MAX, Math.trunc(value)));
}

function boundedPositiveInteger(value: unknown, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function optionalIntensity(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

function weatherSeed(seed: unknown, dayKey: string): number {
  const normalizedSeed = typeof seed === "number" && Number.isFinite(seed)
    ? (seed >>> 0) || DEFAULT_WEATHER_SEED
    : DEFAULT_WEATHER_SEED;
  return fnv1a(`${normalizedSeed}:${dayKey}:daily-weather`);
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
