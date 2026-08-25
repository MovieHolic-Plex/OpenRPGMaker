import { describe, expect, it } from "vitest";
import {
  applyDailyWeatherForDate,
  dailyWeatherForecast,
  resolveDailyWeatherForDate,
} from "@/project/dailyWeather";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { DailyWeatherConfig, Project } from "@/project/types";

function weatherProject(): Project {
  const project = createBlankProject();
  project.system.timeSystem = { enabled: true, daysPerSeason: 28 };
  project.system.dailyWeather = {
    enabled: true,
    forecastDays: 3,
    seasons: {
      spring: [{ kind: "rain", weight: 1, intensity: 0.4 }],
      summer: [{ kind: "storm", weight: 1, intensity: 0.8 }],
      fall: [{ kind: "fog", weight: 1 }],
      winter: [{ kind: "snow", weight: 1, intensity: 0.6 }],
    },
  };
  return project;
}

describe("P1 deterministic daily weather", () => {
  it("derives the same authored outcome from only the session seed and calendar day key", () => {
    // Break caught: weather selection consumes a mutable RNG stream or ignores the calendar date.
    const project = weatherProject();
    project.system.dailyWeather = {
      enabled: true,
      seasons: {
        spring: [
          { kind: "none", weight: 1 },
          { kind: "rain", weight: 1, intensity: 0.7 },
          { kind: "storm", weight: 1, intensity: 0.9 },
        ],
      },
    };
    const date = { year: 2, season: "spring" as const, day: 7, hour: 6, minute: 0 };

    expect(resolveDailyWeatherForDate(project, 1234, date)).toEqual(
      resolveDailyWeatherForDate(project, 1234, date),
    );
    expect(new Set(
      Array.from({ length: 32 }, (_, index) => resolveDailyWeatherForDate(project, index + 1, date).kind),
    ).size).toBeGreaterThan(1);
    expect(new Set(
      Array.from({ length: 28 }, (_, index) => resolveDailyWeatherForDate(
        project,
        1234,
        { ...date, day: index + 1 },
      ).kind),
    ).size).toBeGreaterThan(1);
  });

  it("forecasts future days across season and year boundaries without consuming RNG state", () => {
    // Break caught: forecast calls perturb encounter/battle/movement/misc streams or include today twice.
    const project = weatherProject();
    const session = startSession(project, 20260825);
    const rngBefore = structuredClone(session.rng);

    const springBoundary = dailyWeatherForecast(project, session, {
      year: 1,
      season: "spring",
      day: 27,
      hour: 22,
      minute: 30,
    });
    expect(springBoundary).toEqual([
      { dayKey: "1:spring:28", kind: "rain", intensity: 0.4 },
      { dayKey: "1:summer:1", kind: "storm", intensity: 0.8 },
      { dayKey: "1:summer:2", kind: "storm", intensity: 0.8 },
    ]);

    const winterBoundary = dailyWeatherForecast(project, session, {
      year: 1,
      season: "winter",
      day: 28,
      hour: 6,
      minute: 0,
    });
    expect(winterBoundary[0]).toEqual({ dayKey: "2:spring:1", kind: "rain", intensity: 0.4 });
    expect(session.rng).toEqual(rngBefore);
    expect(dailyWeatherForecast(project, session, {
      year: 1,
      season: "spring",
      day: 27,
      hour: 6,
      minute: 0,
    })).toEqual(springBoundary);
    expect(session.rng).toEqual(rngBefore);
  });

  it("applies one current-day result without changing any RNG stream", () => {
    // Break caught: applying the current day advances a session stream and later forecasts change the result.
    const project = weatherProject();
    const session = startSession(project, 99);
    const rngBefore = structuredClone(session.rng);
    const date = { year: 1, season: "summer" as const, day: 3, hour: 6, minute: 0 };

    const applied = applyDailyWeatherForDate(project, session, date);
    dailyWeatherForecast(project, session, date);
    dailyWeatherForecast(project, session, date);

    expect(applied).toEqual({ dayKey: "1:summer:3", kind: "storm", intensity: 0.8 });
    expect(session.dailyWeather).toEqual(applied);
    expect(session.rng).toEqual(rngBefore);
    expect(applyDailyWeatherForDate(project, session, date)).toEqual(applied);
    expect(session.rng).toEqual(rngBefore);
  });

  it("fails closed to clear weather for empty, all-zero, and malformed direct inputs", () => {
    // Break caught: an invalid/all-zero table divides by zero, selects an invalid row, or loops unbounded.
    const project = weatherProject();
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: Number.POSITIVE_INFINITY,
      seasons: {
        spring: [
          { kind: "rain", weight: 0, intensity: 0.9 },
          { kind: "storm", weight: -5, intensity: Number.NaN },
          { kind: "meteor", weight: 10, intensity: 1 },
          { kind: "snow", weight: Number.POSITIVE_INFINITY, intensity: 1 },
        ],
      },
    } as unknown as DailyWeatherConfig;
    const session = startSession(project, 7);
    const date = { year: 1, season: "spring" as const, day: 1, hour: 6, minute: 0 };

    expect(resolveDailyWeatherForDate(project, session.rng!.seed, date)).toEqual({
      dayKey: "1:spring:1",
      kind: "none",
      intensity: 0,
    });
    expect(dailyWeatherForecast(project, session, date)).toHaveLength(1);

    project.system.dailyWeather = { enabled: false, seasons: {} };
    session.dailyWeather = { dayKey: "1:spring:1", kind: "rain", intensity: 1 };
    expect(applyDailyWeatherForDate(project, session, date)).toBeUndefined();
    expect(session.dailyWeather).toBeUndefined();
    expect(dailyWeatherForecast(project, session, date)).toEqual([]);
  });
});
