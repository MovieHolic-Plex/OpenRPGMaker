import { dailyWeatherForecast } from "@/project/dailyWeather";
import {
  formatGameClock,
  initialGameTime,
  isSeason,
  normalizeGameTime,
  resolveTimeSystem,
  SEASONS,
  type GameTime,
  type Season,
} from "@/project/gameTime";
import { WEATHER_RULES_PER_SEASON_LIMIT } from "@/project/p1FoundationRecords";
import type { PlaySession } from "@/project/session";
import type { DailyWeatherConfig, GameMap, Project, WeatherKind } from "@/project/types";

const SEASON_LABEL: Record<Season, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
const WEATHER_LABEL: Record<WeatherKind, string> = { none: "맑음", rain: "비", storm: "폭풍", snow: "눈", fog: "안개" };

type HudProject = Pick<Project, "system" | "characters" | "maps">;
type HudSession = Pick<PlaySession, "gameTime" | "dailyWeather" | "rng">;
type BirthdayEntry = { readonly season: Season; readonly day: number; readonly name: string };
/** How often an unchanged events array is scanned again, so an in-place birthday edit shows up. */
const BIRTHDAY_INDEX_REFRESH_MS = 500;

type BirthdayIndex = {
  readonly maps: Project["maps"];
  readonly daysPerSeason: number;
  readonly characterStamp: string;
  readonly eventLists: readonly GameMap["events"][];
  readonly eventCounts: readonly number[];
  readonly entries: readonly BirthdayEntry[];
  readonly builtAt: number;
};
type LinesCache = {
  readonly project: HudProject;
  readonly entries: readonly BirthdayEntry[];
  readonly signature: string;
  readonly lines: string[];
};

const NO_BIRTHDAYS: readonly BirthdayEntry[] = [];
const birthdayIndexes = new WeakMap<object, BirthdayIndex>();
let linesCache: LinesCache | undefined;

/**
 * Compact, deterministic lines consumed by the runtime DOM HUD and browser evidence.
 *
 * Play calls this every frame while a clock is enabled. The birthday index is reused until
 * the map list, an events array (or its length), or a character birthday/name changes, and
 * an unchanged events array is scanned again after half a second so an in-place edit shows up.
 * Finished lines are reused until the clock minute, weather, or that index changes.
 */
export function lifeCalendarHudLines(project: HudProject, session: HudSession): string[] {
  const time = session.gameTime;
  if (!time) return [];
  const entries = birthdayEntries(project);
  const signature = linesSignature(project, session, time);
  if (linesCache && linesCache.project === project && linesCache.entries === entries && linesCache.signature === signature) {
    return linesCache.lines;
  }
  const lines = [`${time.year}년 ${SEASON_LABEL[time.season]} ${time.day}일 ${formatGameClock(time)}`];
  if (project.system.dailyWeather?.enabled) {
    const current = session.dailyWeather?.dayKey ? WEATHER_LABEL[session.dailyWeather.kind] : "확인 중";
    const forecast = dailyWeatherForecast(project, session, time);
    const weatherParts = [`오늘 ${current}`, ...forecast.map((entry, index) => `${forecastOffsetLabel(index + 1)} ${WEATHER_LABEL[entry.kind]}`)];
    lines.push(weatherParts.join(" · "));
  }
  const birthday = nearestBirthday(project, time, entries);
  if (birthday) {
    lines.push(`${birthday.offset === 0 ? "생일 오늘" : `다음 생일 ${birthday.offset}일 후`} · ${birthday.names.join(", ")}`);
  }
  linesCache = { project, entries, signature, lines };
  return lines;
}

function linesSignature(project: HudProject, session: HudSession, time: GameTime): string {
  const weather = session.dailyWeather;
  return [
    time.year,
    time.season,
    time.day,
    time.hour,
    time.minute,
    session.rng?.seed ?? "",
    weather?.dayKey ?? "",
    weather?.kind ?? "",
    weatherConfigStamp(project.system.dailyWeather),
  ].join("\0");
}

function weatherConfigStamp(config: DailyWeatherConfig | undefined): string {
  if (!config?.enabled) return "off";
  let stamp = `on:${config.forecastDays ?? ""}`;
  for (const season of SEASONS) {
    const rules = config.seasons?.[season];
    stamp += `|${season}:`;
    if (!rules) continue;
    const limit = Math.min(rules.length, WEATHER_RULES_PER_SEASON_LIMIT);
    for (let index = 0; index < limit; index += 1) {
      const rule = rules[index];
      if (!rule) continue;
      stamp += `${rule.kind},${rule.weight};`;
    }
  }
  return stamp;
}

function birthdayEntries(project: HudProject): readonly BirthdayEntry[] {
  const system = resolveTimeSystem(project.system.timeSystem);
  if (!system) return NO_BIRTHDAYS;
  const daysPerSeason = system.daysPerSeason;
  const characterStamp = characterBirthdayStamp(project.characters);
  const cached = birthdayIndexes.get(project);
  if (
    cached
    && cached.maps === project.maps
    && cached.daysPerSeason === daysPerSeason
    && cached.characterStamp === characterStamp
    && sameEventLists(project.maps, cached)
    && performance.now() - cached.builtAt < BIRTHDAY_INDEX_REFRESH_MS
  ) return cached.entries;

  const birthdays = new Map<string, BirthdayEntry>();
  for (const [characterId, profile] of Object.entries(project.characters ?? {})) {
    const birthday = profile.birthday;
    if (!birthday || !isSeason(birthday.season) || birthday.day < 1 || birthday.day > daysPerSeason) continue;
    birthdays.set(characterId, { season: birthday.season, day: birthday.day, name: profile.displayName?.trim() || characterId });
  }
  const eventLists: GameMap["events"][] = [];
  const eventCounts: number[] = [];
  for (const map of Object.values(project.maps)) {
    eventLists.push(map.events);
    eventCounts.push(map.events.length);
    for (const event of map.events) {
      const birthday = event.socialCalendar?.birthday;
      if (!birthday || !isSeason(birthday.season) || birthday.day < 1 || birthday.day > daysPerSeason) continue;
      const key = event.characterId?.trim() || event.id;
      const name = project.characters?.[key]?.displayName?.trim() || key;
      birthdays.set(key, { season: birthday.season, day: birthday.day, name });
    }
  }
  const entries = [...birthdays.values()];
  birthdayIndexes.set(project, {
    maps: project.maps,
    daysPerSeason,
    characterStamp,
    eventLists,
    eventCounts,
    entries,
    builtAt: performance.now(),
  });
  return entries;
}

function sameEventLists(maps: Project["maps"], index: BirthdayIndex): boolean {
  const mapList = Object.values(maps);
  if (mapList.length !== index.eventLists.length) return false;
  for (let indexInMaps = 0; indexInMaps < mapList.length; indexInMaps += 1) {
    const events = mapList[indexInMaps]?.events;
    if (events !== index.eventLists[indexInMaps] || events.length !== index.eventCounts[indexInMaps]) return false;
  }
  return true;
}

function characterBirthdayStamp(characters: Project["characters"] | undefined): string {
  if (!characters) return "";
  let stamp = "";
  for (const [id, profile] of Object.entries(characters)) {
    const birthday = profile?.birthday;
    stamp += `${id}\0${profile?.displayName ?? ""}\0${birthday?.season ?? ""}\0${birthday?.day ?? ""}\0`;
  }
  return stamp;
}

function nearestBirthday(
  project: HudProject,
  from: GameTime,
  entries: readonly BirthdayEntry[],
): { readonly offset: number; readonly names: readonly string[] } | undefined {
  const system = resolveTimeSystem(project.system.timeSystem);
  if (!system || entries.length === 0) return undefined;
  const origin = normalizeGameTime(from, system) ?? initialGameTime(system) ?? from;
  const yearDays = system.daysPerSeason * SEASONS.length;
  const originDay = dayOfYear(origin.season, origin.day, system.daysPerSeason);
  let best = yearDays;
  const names: string[] = [];
  for (const entry of entries) {
    let offset = dayOfYear(entry.season, entry.day, system.daysPerSeason) - originDay;
    if (offset < 0) offset += yearDays;
    if (offset < best) {
      best = offset;
      names.length = 0;
      names.push(entry.name);
    } else if (offset === best) names.push(entry.name);
  }
  if (best >= yearDays) return undefined;
  names.sort((left, right) => left.localeCompare(right, "ko"));
  return { offset: best, names };
}

function dayOfYear(season: Season, day: number, daysPerSeason: number): number {
  const clampedDay = Math.min(daysPerSeason, Math.max(1, day));
  return SEASONS.indexOf(season) * daysPerSeason + (clampedDay - 1);
}

function forecastOffsetLabel(offset: number): string {
  if (offset === 1) return "내일";
  if (offset === 2) return "모레";
  return `${offset}일 뒤`;
}
