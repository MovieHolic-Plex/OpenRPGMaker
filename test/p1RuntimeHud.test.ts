import { describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startSession } from "@/project/session";
import { lifeCalendarHudLines } from "@/player/lifeCalendarHud";

describe("P1 life calendar HUD", () => {
  it("shows date, current weather, deterministic forecast, and the nearest birthday", () => {
    const project = createFarmingDemoProject();
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 2,
      seasons: { spring: [{ kind: "rain", weight: 1, intensity: 0.7 }] },
    };
    project.characters = {
      npc_today: { displayName: "오늘이", birthday: { season: "spring", day: 1 } },
      npc_later: { displayName: "내일이", birthday: { season: "spring", day: 2 } },
    };
    const session = startSession(project, 801);

    expect(lifeCalendarHudLines(project, session)).toEqual([
      "1년 봄 1일 06:00",
      "오늘 비 · 내일 비 · 모레 비",
      "생일 오늘 · 오늘이",
    ]);
  });

  it("skips birthdays outside a custom season length and stays compact without weather", () => {
    const project = createFarmingDemoProject();
    project.system.timeSystem = { ...project.system.timeSystem!, daysPerSeason: 3 };
    delete project.system.dailyWeather;
    project.characters = {
      unreachable: { displayName: "없는 날", birthday: { season: "spring", day: 14 } },
      reachable: { displayName: "여름이", birthday: { season: "summer", day: 1 } },
    };
    const session = startSession(project, 802);

    expect(lifeCalendarHudLines(project, session)).toEqual([
      "1년 봄 1일 06:00",
      "다음 생일 3일 후 · 여름이",
    ]);
  });
});
