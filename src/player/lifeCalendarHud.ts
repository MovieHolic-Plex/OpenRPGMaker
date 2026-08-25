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
import type { Project, WeatherKind } from "@/project/types";

const SEASON_LABEL: Record<Season, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
const WEATHER_LABEL: Record<WeatherKind, string> = { none: "맑음", rain: "비", storm: "폭풍", snow: "눈", fog: "안개" };

/** Compact, deterministic lines consumed by the runtime DOM HUD and browser evidence. */
export function lifeCalendarHudLines(
  project: Pick<Project, "system" | "characters" | "maps">,
  session: Pick<PlaySession, "gameTime" | "dailyWeather" | "rng">,
): string[] {
  const time = session.gameTime;
  if (!time) return [];
  const lines = [`${time.year}년 ${SEASON_LABEL[time.season]} ${time.day}일 ${formatGameClock(time)}`];
  if (project.system.dailyWeather?.enabled) {
    const current = session.dailyWeather?.dayKey ? WEATHER_LABEL[session.dailyWeather.kind] : "확인 중";
    const forecast = dailyWeatherForecast(project, session, time);
    const weatherParts = [`오늘 ${current}`, ...forecast.map((entry, index) => `${forecastOffsetLabel(index + 1)} ${WEATHER_LABEL[entry.kind]}`)];
    lines.push(weatherParts.join(" · "));
  }
  const birthday = nearestBirthday(project, time);
  if (birthday) {
    lines.push(`${birthday.offset === 0 ? "생일 오늘" : `다음 생일 ${birthday.offset}일 후`} · ${birthday.names.join(", ")}`);
  }
  return lines;
}

function nearestBirthday(
  project: Pick<Project, "system" | "characters" | "maps">,
  from: GameTime,
): { readonly offset: number; readonly names: readonly string[] } | undefined {
  const system = resolveTimeSystem(project.system.timeSystem);
  if (!system) return undefined;
  const daysPerSeason = daysPerSeasonOf(project.system.timeSystem);
  const birthdays = new Map<string, { readonly season: Season; readonly day: number; readonly name: string }>();
  for (const [characterId, profile] of Object.entries(project.characters ?? {})) {
    const birthday = profile.birthday;
    if (!birthday || birthday.day < 1 || birthday.day > daysPerSeason) continue;
    birthdays.set(characterId, { ...birthday, name: profile.displayName?.trim() || characterId });
  }
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const birthday = event.socialCalendar?.birthday;
      if (!birthday || birthday.day < 1 || birthday.day > daysPerSeason) continue;
      const key = event.characterId?.trim() || event.id;
      const name = project.characters?.[key]?.displayName?.trim() || key;
      birthdays.set(key, { ...birthday, name });
    }
  }
  if (birthdays.size === 0) return undefined;
  for (let offset = 0; offset < daysPerSeason * 4; offset += 1) {
    const date = advanceGameDays(from, offset, system).time;
    const names = [...birthdays.values()]
      .filter((entry) => entry.season === date.season && entry.day === date.day)
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "ko"));
    if (names.length > 0) return { offset, names };
  }
  return undefined;
}

function forecastOffsetLabel(offset: number): string {
  if (offset === 1) return "내일";
  if (offset === 2) return "모레";
  return `${offset}일 뒤`;
}
