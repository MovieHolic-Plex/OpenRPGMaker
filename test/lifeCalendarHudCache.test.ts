import { describe, expect, it } from "vitest";
import { advanceGameDays } from "@/project/gameTime";
import { lifeCalendarHudLines } from "@/player/lifeCalendarHud";
import type { PlaySession } from "@/project/session";
import type { GameEvent, Project } from "@/project/types";

function clock(minute = 0) {
  return { minute, hour: 6, day: 1, season: "spring" as const, year: 1 };
}

function sessionAt(minute = 0): Pick<PlaySession, "gameTime" | "dailyWeather" | "rng"> {
  return { gameTime: clock(minute) };
}

function hudProject(events: GameEvent[] = []): Pick<Project, "system" | "characters" | "maps"> {
  return {
    system: { timeSystem: { enabled: true, daysPerSeason: 28 } },
    characters: {
      gaeul: { displayName: "가을", birthday: { season: "spring", day: 1 } },
      hana: { displayName: "하나", birthday: { season: "spring", day: 1 } },
    },
    maps: { town: { events } },
  } as unknown as Pick<Project, "system" | "characters" | "maps">;
}

describe("life calendar HUD frame cache", () => {
  it("reuses the same lines until the clock minute or the birthday index changes", () => {
    const events: GameEvent[] = [];
    const project = hudProject(events);
    const session = sessionAt(0);
    const names = ["가을", "하나"].sort((left, right) => left.localeCompare(right, "ko"));
    const first = lifeCalendarHudLines(project, session);
    expect(first[0]).toBe("1년 봄 1일 06:00");
    expect(first.at(-1)).toBe(`생일 오늘 · ${names.join(", ")}`);
    expect(lifeCalendarHudLines(project, session)).toBe(first);

    const later = lifeCalendarHudLines(project, sessionAt(5));
    expect(later).not.toBe(first);
    expect(later[0]).toBe("1년 봄 1일 06:05");
    expect(later.at(-1)).toBe(first.at(-1));
    expect(lifeCalendarHudLines(project, sessionAt(5))).toBe(later);

    events.push({
      id: "ev_hana",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      characterId: "hana",
      socialCalendar: { birthday: { season: "winter", day: 28 } },
    });
    const moved = lifeCalendarHudLines(project, sessionAt(5));
    expect(moved).not.toBe(later);
    expect(moved.at(-1)).toBe("생일 오늘 · 가을");
    expect(lifeCalendarHudLines(project, sessionAt(5))).toBe(moved);
  });

  it("counts days to a far birthday the same way the calendar stepper does", () => {
    const project = {
      system: { timeSystem: { enabled: true, daysPerSeason: 28 } },
      characters: { end: { displayName: "끝", birthday: { season: "winter", day: 28 } } },
      maps: { town: { events: [] as GameEvent[] } },
    } as unknown as Pick<Project, "system" | "characters" | "maps">;
    const from = clock();
    const system = { enabled: true as const, daysPerSeason: 28 };
    let offset = 0;
    for (; offset < 28 * 4; offset += 1) {
      const date = advanceGameDays(from, offset, system).time;
      if (date.season === "winter" && date.day === 28) break;
    }
    const lines = lifeCalendarHudLines(project, sessionAt(0));
    expect(lines.at(-1)).toBe(`다음 생일 ${offset}일 후 · 끝`);
    expect(lifeCalendarHudLines(project, sessionAt(0))).toBe(lines);
  });

  it("picks up an in-place character birthday edit on the next read", () => {
    const characters: NonNullable<Project["characters"]> = {
      hana: { displayName: "하나", birthday: { season: "spring", day: 2 } },
    };
    const project = {
      system: { timeSystem: { enabled: true, daysPerSeason: 28 } },
      characters,
      maps: { town: { events: [] as GameEvent[] } },
    } as unknown as Pick<Project, "system" | "characters" | "maps">;
    expect(lifeCalendarHudLines(project, sessionAt(0)).at(-1)).toBe("다음 생일 1일 후 · 하나");
    characters.hana = { displayName: "하나", birthday: { season: "spring", day: 1 } };
    const today = lifeCalendarHudLines(project, sessionAt(0));
    expect(today.at(-1)).toBe("생일 오늘 · 하나");
    expect(lifeCalendarHudLines(project, sessionAt(0))).toBe(today);
  });
});
