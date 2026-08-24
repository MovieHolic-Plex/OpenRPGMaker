import { describe, expect, it } from "vitest";
import { dailyWeatherForecast } from "@/project/dailyWeather";
import { createFarmingDemoProject } from "@/project/defaults";
import { calendarDayKey } from "@/project/gameTime";
import { startSession } from "@/project/session";
import { transitionToNextDay } from "@/player/dayTransition";

describe("P1 daily weather transition integration", () => {
  it("initializes today's weather and visual state when a new session starts", () => {
    const project = createFarmingDemoProject();
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 3,
      seasons: { spring: [{ kind: "fog", weight: 1, intensity: 0.4 }] },
    };

    const session = startSession(project, 701);

    expect(session.dailyWeather).toEqual({ dayKey: "1:spring:1", kind: "fog", intensity: 0.4 });
    expect(session.m2Runtime?.screen.weather).toBe("fog,0.4");
  });

  it("advances calendar, resolves forecast-matching rain, waters, then grows in one transaction", () => {
    const project = createFarmingDemoProject();
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 3,
      seasons: { spring: [{ kind: "rain", weight: 1, intensity: 0.8 }] },
    };
    const session = startSession(project, 702);
    session.farmPlots = {
      [project.startMapId]: {
        "4,5": { tilled: true, watered: false, cropId: "crop_potato", stage: 0, growthDays: 0 },
      },
    };
    const forecast = dailyWeatherForecast(project, session)[0];
    const sourceDayKey = calendarDayKey(session.gameTime!);

    const result = transitionToNextDay(project, session, sourceDayKey);

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        destinationDayKey: "1:spring:2",
        stages: ["shipping", "calendar", "dailyWeather", "rainWatering", "farm", "energy", "makers"],
        weather: forecast,
        wateredPlots: 1,
      },
    });
    expect(session.dailyWeather).toEqual(forecast);
    expect(session.m2Runtime?.screen.weather).toBe("rain,0.8");
    expect(session.farmPlots?.[project.startMapId]?.["4,5"]).toMatchObject({ growthDays: 1, watered: false });
  });

  it("keeps non-rain weather visual but does not water a crop", () => {
    const project = createFarmingDemoProject();
    project.system.dailyWeather = {
      enabled: true,
      seasons: { spring: [{ kind: "snow", weight: 1, intensity: 0.6 }] },
    };
    const session = startSession(project, 703);
    session.farmPlots = {
      [project.startMapId]: {
        "4,5": { tilled: true, watered: false, cropId: "crop_potato", stage: 0, growthDays: 0 },
      },
    };

    const result = transitionToNextDay(project, session, calendarDayKey(session.gameTime!));

    expect(result).toMatchObject({ ok: true, receipt: { wateredPlots: 0 } });
    expect(session.m2Runtime?.screen.weather).toBe("snow,0.6");
    expect(session.farmPlots?.[project.startMapId]?.["4,5"]?.growthDays).toBe(0);
  });
});
