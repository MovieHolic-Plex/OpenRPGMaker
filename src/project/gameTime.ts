import type { Project } from "@/project/types";

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const TIME_PHASES = ["morning", "day", "evening", "night"] as const;
export type TimePhase = (typeof TIME_PHASES)[number];

export interface GameTime {
  readonly minute: number;
  readonly hour: number;
  readonly day: number;
  readonly season: Season;
  readonly year: number;
}

export interface TimeSystemConfig {
  readonly enabled: boolean;
  readonly minutesPerRealSecond?: number;
  readonly dayStartHour?: number;
  readonly dayEndHour?: number;
  readonly forceSleep?: boolean;
  readonly onDayEnd?: string;
}

export interface ResolvedTimeSystemConfig {
  readonly enabled: true;
  readonly minutesPerRealSecond: number;
  readonly dayStartHour: number;
  readonly dayEndHour: number;
  readonly forceSleep: boolean;
  readonly onDayEnd?: string;
}

export const DEFAULT_TIME_MINUTES_PER_REAL_SECOND = 1;
export const DEFAULT_DAY_START_HOUR = 6;
export const DEFAULT_DAY_END_HOUR = 26;
export const DAYS_PER_SEASON = 28;

export function isSeason(value: unknown): value is Season {
  return typeof value === "string" && (SEASONS as readonly string[]).includes(value);
}

export function isTimePhase(value: unknown): value is TimePhase {
  return typeof value === "string" && (TIME_PHASES as readonly string[]).includes(value);
}

export function resolveTimeSystem(projectOrConfig: Project | TimeSystemConfig | undefined): ResolvedTimeSystemConfig | undefined {
  const config = isProjectLike(projectOrConfig) ? projectOrConfig.system.timeSystem : projectOrConfig;
  if (!config?.enabled) return undefined;
  const dayStartHour = clampInteger(config.dayStartHour ?? DEFAULT_DAY_START_HOUR, 0, 23);
  let dayEndHour = clampInteger(config.dayEndHour ?? DEFAULT_DAY_END_HOUR, dayStartHour + 1, 48);
  if (dayEndHour <= dayStartHour) dayEndHour = DEFAULT_DAY_END_HOUR;
  return {
    enabled: true,
    minutesPerRealSecond: positiveNumber(config.minutesPerRealSecond, DEFAULT_TIME_MINUTES_PER_REAL_SECOND),
    dayStartHour,
    dayEndHour,
    forceSleep: config.forceSleep === true,
    ...(cleanId(config.onDayEnd) ? { onDayEnd: cleanId(config.onDayEnd) } : {}),
  };
}

export function initialGameTime(system: ResolvedTimeSystemConfig | TimeSystemConfig | undefined): GameTime | undefined {
  const resolved = resolveTimeSystem(system);
  if (!resolved) return undefined;
  return { minute: 0, hour: resolved.dayStartHour, day: 1, season: "spring", year: 1 };
}

export function normalizeGameTime(value: unknown, system?: ResolvedTimeSystemConfig | TimeSystemConfig): GameTime | undefined {
  if (!isRecord(value)) return undefined;
  const resolved = resolveTimeSystem(system);
  const maxHour = Math.max(23, resolved?.dayEndHour ?? DEFAULT_DAY_END_HOUR);
  return {
    minute: clampInteger(numberOr(value.minute, 0), 0, 59),
    hour: clampInteger(numberOr(value.hour, resolved?.dayStartHour ?? DEFAULT_DAY_START_HOUR), 0, maxHour),
    day: clampInteger(numberOr(value.day, 1), 1, DAYS_PER_SEASON),
    season: isSeason(value.season) ? value.season : "spring",
    year: Math.max(1, Math.trunc(numberOr(value.year, 1))),
  };
}

export function timePhaseFor(time: GameTime | undefined): TimePhase | undefined {
  if (!time) return undefined;
  if (time.hour >= 6 && time.hour < 10) return "morning";
  if (time.hour >= 10 && time.hour < 17) return "day";
  if (time.hour >= 17 && time.hour < 20) return "evening";
  return "night";
}

export function conditionMatchesTimePhase(time: GameTime | undefined, phase: TimePhase): boolean {
  return timePhaseFor(time) === phase;
}

export function conditionMatchesSeason(time: GameTime | undefined, season: Season): boolean {
  return time?.season === season;
}

export function advanceGameTime(
  current: GameTime,
  minutes: number,
  system: ResolvedTimeSystemConfig | TimeSystemConfig
): { readonly time: GameTime; readonly dayEnds: number } {
  const resolved = resolveTimeSystem(system);
  if (!resolved) return { time: current, dayEnds: 0 };
  let next = normalizeGameTime(current, resolved) ?? initialGameTime(resolved) as GameTime;
  let total = next.hour * 60 + next.minute + Math.max(0, Math.floor(minutes));
  const dayEnd = resolved.dayEndHour * 60;
  let dayEnds = 0;
  while (total >= dayEnd) {
    total = resolved.dayStartHour * 60 + (total - dayEnd);
    next = advanceCalendarDay(next);
    dayEnds += 1;
  }
  return {
    time: { ...next, hour: Math.floor(total / 60), minute: total % 60 },
    dayEnds,
  };
}

export function advanceGameDays(
  current: GameTime,
  days: number,
  system: ResolvedTimeSystemConfig | TimeSystemConfig
): { readonly time: GameTime; readonly dayEnds: number } {
  const resolved = resolveTimeSystem(system);
  if (!resolved) return { time: current, dayEnds: 0 };
  let next = normalizeGameTime(current, resolved) ?? initialGameTime(resolved) as GameTime;
  const count = Math.max(0, Math.floor(days));
  for (let index = 0; index < count; index += 1) next = advanceCalendarDay(next);
  return { time: { ...next, hour: resolved.dayStartHour, minute: 0 }, dayEnds: count };
}

export function sleepGameTimeUntilMorning(
  current: GameTime,
  system: ResolvedTimeSystemConfig | TimeSystemConfig
): { readonly time: GameTime; readonly dayEnds: number } {
  return advanceGameDays(current, 1, system);
}

export function setGameTimeClock(
  current: GameTime,
  hour: number,
  minute: number | undefined,
  system: ResolvedTimeSystemConfig | TimeSystemConfig
): GameTime {
  const resolved = resolveTimeSystem(system);
  const maxHour = Math.max(23, resolved?.dayEndHour ?? DEFAULT_DAY_END_HOUR);
  return {
    ...current,
    hour: clampInteger(hour, 0, maxHour),
    minute: clampInteger(minute ?? 0, 0, 59),
  };
}

export function minutesUntilDayEnd(time: GameTime, system: ResolvedTimeSystemConfig | TimeSystemConfig): number {
  const resolved = resolveTimeSystem(system);
  if (!resolved) return Number.POSITIVE_INFINITY;
  const current = time.hour * 60 + time.minute;
  return Math.max(0, resolved.dayEndHour * 60 - current);
}

export function formatGameTime(time: GameTime): string {
  return `${seasonLabel(time.season)} ${time.day}일 ${formatGameClock(time)}`;
}

export function formatGameClock(time: Pick<GameTime, "hour" | "minute">): string {
  return `${String(((time.hour % 24) + 24) % 24).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function advanceCalendarDay(time: GameTime): GameTime {
  if (time.day < DAYS_PER_SEASON) return { ...time, day: time.day + 1 };
  const seasonIndex = SEASONS.indexOf(time.season);
  const nextSeason = SEASONS[(seasonIndex + 1) % SEASONS.length] ?? "spring";
  return {
    ...time,
    day: 1,
    season: nextSeason,
    year: nextSeason === "spring" ? time.year + 1 : time.year,
  };
}

function seasonLabel(season: Season): string {
  switch (season) {
    case "spring":
      return "봄";
    case "summer":
      return "여름";
    case "fall":
      return "가을";
    case "winter":
      return "겨울";
  }
}

function isProjectLike(value: Project | TimeSystemConfig | undefined): value is Project {
  return isRecord(value) && isRecord(value.system);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function cleanId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
