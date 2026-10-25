import { dailyWeatherForecast } from "@/project/dailyWeather";
import {
  advanceGameDays,
  daysPerSeasonOf,
  formatGameClock,
  resolveTimeSystem,
  type GameTime,
  type Season,
} from "@/project/gameTime";
import type { PlaySession } from "@/project/session";
import type { GameEvent, Project, WeatherKind } from "@/project/types";

const SEASON_LABEL: Record<Season, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
const WEATHER_LABEL: Record<WeatherKind, string> = { none: "맑음", rain: "비", storm: "폭풍", snow: "눈", fog: "안개" };
/** `dailyWeather.ts` 의 시드 기본값과 같다. rng 가 없을 때만 예보 캐시 키가 된다. */
const DEFAULT_WEATHER_SEED = 1;

type CalendarProject = Pick<Project, "system" | "characters" | "maps">;
type CalendarSession = Pick<PlaySession, "gameTime" | "dailyWeather" | "rng">;

interface BirthdayEntry {
  readonly season: Season;
  readonly day: number;
  readonly name: string;
}

/**
 * 생일 색인. 플레이어는 시계가 있는 동안 이 HUD 를 매 프레임 부른다.
 * 재료가 그대로면 맵 이벤트를 다시 훑지 않는다.
 *
 * 무효가 되는 때: `characters`·`timeSystem` 객체가 바뀌거나, 맵 `events` 배열의
 * 정체성 또는 길이가 바뀔 때. 스토어 편집은 그렇게 게시한다(인물 사전을 통째로
 * 갈아끼우고, 이벤트 수정은 배열을 slice 한다). 생일 칸만 제자리에서 고치면
 * 색인이 그대로다 — 필드 스폰은 생일 없는 배열을 새로 대입한다.
 */
interface BirthdayCatalog {
  readonly characters: Project["characters"] | undefined;
  readonly timeSystem: Project["system"]["timeSystem"];
  readonly mapIds: readonly string[];
  readonly eventArrays: readonly (readonly GameEvent[])[];
  readonly eventLengths: readonly number[];
  readonly namesByDate: ReadonlyMap<string, readonly string[]>;
}

interface LineCache {
  readonly namesByDate: ReadonlyMap<string, readonly string[]> | undefined;
  readonly timeSystem: Project["system"]["timeSystem"];
  readonly year: number;
  readonly season: Season;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly weatherConfig: Project["system"]["dailyWeather"];
  readonly weatherDayKey: string;
  readonly weatherKind: string;
  readonly seed: number;
  readonly lines: readonly string[];
}

const catalogs = new WeakMap<object, BirthdayCatalog>();
const lineCaches = new WeakMap<object, LineCache>();

/**
 * Compact, deterministic lines consumed by the runtime DOM HUD and browser evidence.
 * The returned array is shared until the clock minute, weather, or birthday index changes.
 * Callers must not mutate it.
 */
export function lifeCalendarHudLines(project: CalendarProject, session: CalendarSession): string[] {
  const time = session.gameTime;
  if (!time) return [];
  const namesByDate = project.system.timeSystem?.enabled ? birthdayNames(project) : undefined;
  const weather = session.dailyWeather;
  const weatherDayKey = weather?.dayKey ?? "";
  const weatherKind = weather?.kind ?? "";
  const seed = session.rng?.seed ?? DEFAULT_WEATHER_SEED;
  const cached = lineCaches.get(session);
  if (
    cached
    && cached.namesByDate === namesByDate
    && cached.timeSystem === project.system.timeSystem
    && cached.year === time.year
    && cached.season === time.season
    && cached.day === time.day
    && cached.hour === time.hour
    && cached.minute === time.minute
    && cached.weatherConfig === project.system.dailyWeather
    && cached.weatherDayKey === weatherDayKey
    && cached.weatherKind === weatherKind
    && cached.seed === seed
  ) {
    return cached.lines as string[];
  }
  const lines = Object.freeze(buildLines(project, session, time, namesByDate));
  lineCaches.set(session, {
    namesByDate,
    timeSystem: project.system.timeSystem,
    year: time.year,
    season: time.season,
    day: time.day,
    hour: time.hour,
    minute: time.minute,
    weatherConfig: project.system.dailyWeather,
    weatherDayKey,
    weatherKind,
    seed,
    lines,
  });
  return lines as string[];
}

function birthdayNames(project: CalendarProject): ReadonlyMap<string, readonly string[]> {
  const cached = catalogs.get(project);
  if (cached && catalogCurrent(cached, project)) return cached.namesByDate;
  const built = buildCatalog(project);
  catalogs.set(project, built);
  return built.namesByDate;
}

function catalogCurrent(catalog: BirthdayCatalog, project: CalendarProject): boolean {
  if (catalog.characters !== project.characters || catalog.timeSystem !== project.system.timeSystem) return false;
  let index = 0;
  for (const id in project.maps) {
    if (!Object.hasOwn(project.maps, id)) continue;
    const map = project.maps[id];
    if (!map) continue;
    if (
      catalog.mapIds[index] !== id
      || catalog.eventArrays[index] !== map.events
      || catalog.eventLengths[index] !== map.events.length
    ) return false;
    index += 1;
  }
  return index === catalog.mapIds.length;
}

function buildCatalog(project: CalendarProject): BirthdayCatalog {
  const daysPerSeason = daysPerSeasonOf(project.system.timeSystem);
  const byKey = new Map<string, BirthdayEntry>();
  for (const [characterId, profile] of Object.entries(project.characters ?? {})) {
    const birthday = profile.birthday;
    if (!birthday || birthday.day < 1 || birthday.day > daysPerSeason) continue;
    byKey.set(characterId, { season: birthday.season, day: birthday.day, name: profile.displayName?.trim() || characterId });
  }
  const mapIds: string[] = [];
  const eventArrays: (readonly GameEvent[])[] = [];
  const eventLengths: number[] = [];
  for (const id in project.maps) {
    if (!Object.hasOwn(project.maps, id)) continue;
    const map = project.maps[id];
    if (!map) continue;
    mapIds.push(id);
    eventArrays.push(map.events);
    eventLengths.push(map.events.length);
    for (const event of map.events) {
      const birthday = event.socialCalendar?.birthday;
      if (!birthday || birthday.day < 1 || birthday.day > daysPerSeason) continue;
      const key = event.characterId?.trim() || event.id;
      byKey.set(key, { season: birthday.season, day: birthday.day, name: project.characters?.[key]?.displayName?.trim() || key });
    }
  }
  const grouped = new Map<string, string[]>();
  for (const entry of byKey.values()) {
    const key = `${entry.season}:${entry.day}`;
    const names = grouped.get(key);
    if (names) names.push(entry.name);
    else grouped.set(key, [entry.name]);
  }
  for (const names of grouped.values()) names.sort((left, right) => left.localeCompare(right, "ko"));
  return {
    characters: project.characters,
    timeSystem: project.system.timeSystem,
    mapIds,
    eventArrays,
    eventLengths,
    namesByDate: grouped,
  };
}

function buildLines(
  project: CalendarProject,
  session: CalendarSession,
  time: GameTime,
  namesByDate: ReadonlyMap<string, readonly string[]> | undefined,
): string[] {
  const lines = [`${time.year}년 ${SEASON_LABEL[time.season]} ${time.day}일 ${formatGameClock(time)}`];
  if (project.system.dailyWeather?.enabled) {
    const current = session.dailyWeather?.dayKey ? WEATHER_LABEL[session.dailyWeather.kind] : "확인 중";
    const forecast = dailyWeatherForecast(project, session, time);
    const weatherParts = [`오늘 ${current}`, ...forecast.map((entry, index) => `${forecastOffsetLabel(index + 1)} ${WEATHER_LABEL[entry.kind]}`)];
    lines.push(weatherParts.join(" · "));
  }
  const system = namesByDate ? resolveTimeSystem(project.system.timeSystem) : undefined;
  const birthday = namesByDate && system ? nearestBirthday(namesByDate, time, system) : undefined;
  if (birthday) {
    lines.push(`${birthday.offset === 0 ? "생일 오늘" : `다음 생일 ${birthday.offset}일 후`} · ${birthday.names.join(", ")}`);
  }
  return lines;
}

function nearestBirthday(
  namesByDate: ReadonlyMap<string, readonly string[]>,
  from: GameTime,
  system: NonNullable<ReturnType<typeof resolveTimeSystem>>,
): { readonly offset: number; readonly names: readonly string[] } | undefined {
  if (namesByDate.size === 0) return undefined;
  const daysPerSeason = system.daysPerSeason;
  for (let offset = 0; offset < daysPerSeason * 4; offset += 1) {
    const date = advanceGameDays(from, offset, system).time;
    const names = namesByDate.get(`${date.season}:${date.day}`);
    if (names && names.length > 0) return { offset, names };
  }
  return undefined;
}

function forecastOffsetLabel(offset: number): string {
  if (offset === 1) return "내일";
  if (offset === 2) return "모레";
  return `${offset}일 뒤`;
}
