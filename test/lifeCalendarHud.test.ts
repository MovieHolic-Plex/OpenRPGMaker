// 생활 달력 HUD 는 플레이어 매 프레임에 불린다. 생일 줄은 맵 이벤트를 전부 훑으므로,
// 같은 분·같은 재료면 이벤트를 다시 돌지 않는지와 답이 그대로인지를 본다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { Season } from "@/project/gameTime";
import { lifeCalendarHudLines } from "@/player/lifeCalendarHud";

function event(id: string, birthday?: { readonly season: Season; readonly day: number }, characterId?: string): GameEvent {
  return {
    id,
    x: 0,
    y: 0,
    trigger: { kind: "action" },
    commands: [],
    ...(characterId ? { characterId } : {}),
    ...(birthday ? { socialCalendar: { birthday } } : {}),
  };
}

function watch(events: GameEvent[], walks: { n: number }): GameEvent[] {
  return new Proxy(events, {
    get(target, prop, receiver) {
      if (prop === Symbol.iterator) walks.n += 1;
      return Reflect.get(target, prop, receiver);
    },
  });
}

function calendarProject(): { project: Project; session: ReturnType<typeof startSession>; walks: { n: number }; home: GameEvent[] } {
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
  project.characters = {
    bomi: { displayName: "봄이", birthday: { season: "spring", day: 1 } },
    minsu: { displayName: "민수", birthday: { season: "spring", day: 1 } },
    late: { displayName: "늦은", birthday: { season: "spring", day: 40 } },
  };
  const walks = { n: 0 };
  const home = [
    event("ev_minsu", { season: "summer", day: 1 }, "minsu"),
    ...Array.from({ length: 40 }, (_, index) => event(`ev_filler_${index}`)),
  ];
  const other = Array.from({ length: 40 }, (_, index) => event(`ev_other_${index}`));
  const map = project.maps[project.startMapId]!;
  map.events = watch(home, walks);
  const side: GameMap = { ...map, id: "map_side", name: "옆 맵", events: watch(other, walks) };
  project.maps = { ...project.maps, [side.id]: side };
  const session = startSession(project, 7);
  session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute: 0 };
  walks.n = 0;
  return { project, session, walks, home };
}

describe("lifeCalendarHudLines", () => {
  it("keeps the birthday answer and does not walk map events again in the same minute", () => {
    const { project, session, walks } = calendarProject();
    const first = lifeCalendarHudLines(project, session);
    expect(first).toEqual([
      "1년 봄 1일 06:00",
      // 민수의 이벤트 생일이 프로필(봄 1일)을 덮어 여름 1일이 된다. 봄 1일 생일은 봄이만.
      // 날짜 40 은 계절 길이 28 밖이라 빠진다.
      "생일 오늘 · 봄이",
    ]);
    expect(walks.n).toBe(2);

    for (let frame = 0; frame < 60; frame += 1) expect(lifeCalendarHudLines(project, session)).toBe(first);
    expect(walks.n).toBe(2);

    session.gameTime = { ...session.gameTime!, minute: 30 };
    const nextMinute = lifeCalendarHudLines(project, session);
    expect(nextMinute).toEqual(["1년 봄 1일 06:30", "생일 오늘 · 봄이"]);
    expect(nextMinute).not.toBe(first);
    expect(walks.n).toBe(2);

    session.gameTime = { year: 1, season: "summer", day: 1, hour: 6, minute: 0 };
    expect(lifeCalendarHudLines(project, session)).toEqual(["1년 여름 1일 06:00", "생일 오늘 · 민수"]);
    expect(walks.n).toBe(2);
  });

  it("rebuilds when an events array grows, characters are replaced, or the clock config object changes", () => {
    const { project, session, walks, home } = calendarProject();
    lifeCalendarHudLines(project, session);
    expect(walks.n).toBe(2);

    home.push(event("하루", { season: "spring", day: 1 }));
    expect(lifeCalendarHudLines(project, session)[1]).toBe("생일 오늘 · 봄이, 하루");
    expect(walks.n).toBe(4);

    project.characters = {
      ...project.characters,
      bomi: { displayName: "봄", birthday: { season: "spring", day: 1 } },
    };
    expect(lifeCalendarHudLines(project, session)[1]).toBe("생일 오늘 · 봄, 하루");
    expect(walks.n).toBe(6);

    project.system.timeSystem = { enabled: true, daysPerSeason: 40 };
    expect(lifeCalendarHudLines(project, session)[1]).toBe("생일 오늘 · 늦은, 봄, 하루");
    expect(walks.n).toBe(8);
  });

  it("shows the weather line from the saved day and does not rescan events while the minute holds", () => {
    const { project, session, walks } = calendarProject();
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 2,
      seasons: {
        spring: [{ kind: "rain", weight: 1, intensity: 0.4 }],
      },
    };
    session.dailyWeather = { dayKey: "1:spring:1", kind: "rain", intensity: 0.4 };
    const lines = lifeCalendarHudLines(project, session);
    expect(lines).toEqual([
      "1년 봄 1일 06:00",
      "오늘 비 · 내일 비 · 모레 비",
      "생일 오늘 · 봄이",
    ]);
    const walked = walks.n;
    expect(lifeCalendarHudLines(project, session)).toBe(lines);
    expect(walks.n).toBe(walked);

    session.dailyWeather = { dayKey: "1:spring:1", kind: "storm", intensity: 0.8 };
    expect(lifeCalendarHudLines(project, session)[1]).toBe("오늘 폭풍 · 내일 비 · 모레 비");
    expect(walks.n).toBe(walked);
  });

  it("returns no lines without a clock and no birthday line when the time system is off", () => {
    const { project, session, walks } = calendarProject();
    session.gameTime = undefined;
    expect(lifeCalendarHudLines(project, session)).toEqual([]);
    expect(walks.n).toBe(0);

    session.gameTime = { year: 1, season: "spring", day: 1, hour: 6, minute: 0 };
    project.system.timeSystem = { enabled: false };
    expect(lifeCalendarHudLines(project, session)).toEqual(["1년 봄 1일 06:00"]);
    expect(lifeCalendarHudLines(project, session)).toEqual(["1년 봄 1일 06:00"]);
    expect(walks.n).toBe(0);
  });
});
