import { describe, expect, it } from "vitest";
import { dailyWeatherForecast } from "@/project/dailyWeather";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { calendarDayKey } from "@/project/gameTime";
import { feedFarmAnimal, petFarmAnimal } from "@/project/farmAnimals";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
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
        stages: ["recovery", "shipping", "calendar", "dailyWeather", "rainWatering", "farm", "forage", "energy", "makers", "animals"],
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

  it("advances cared animals for the source day after every other successful stage", () => {
    const project = createFarmingDemoProject();
    const session = startSession(project, 704);
    const sourceDayKey = calendarDayKey(session.gameTime!);
    session.inventory.item_hay = 1;

    expect(feedFarmAnimal(project, session, "farm_animal_bori", sourceDayKey)).toMatchObject({ ok: true });
    expect(petFarmAnimal(project, session, "farm_animal_bori", sourceDayKey)).toMatchObject({ ok: true });

    const result = transitionToNextDay(project, session, sourceDayKey);

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        stages: ["recovery", "shipping", "calendar", "dailyWeather", "rainWatering", "farm", "forage", "energy", "makers", "animals"],
        animals: {
          ok: true,
          dayKey: sourceDayKey,
          advancedInstanceIds: ["farm_animal_bori", "farm_animal_dubu"],
          products: [{ instanceId: "farm_animal_bori", itemId: "item_egg", count: 1 }],
        },
      },
    });
    expect(session.farmAnimals?.farm_animal_bori).toMatchObject({
      lastAdvancedDayKey: sourceDayKey,
      productionProgress: 0,
      readyProductCount: 1,
    });
  });

  it("rolls back the complete day when animal production overflows", () => {
    const project = createFarmingDemoProject();
    const session = startSession(project, 705);
    const sourceDayKey = calendarDayKey(session.gameTime!);
    session.inventory.item_hay = 1;
    expect(feedFarmAnimal(project, session, "farm_animal_bori", sourceDayKey)).toMatchObject({ ok: true });
    expect(petFarmAnimal(project, session, "farm_animal_bori", sourceDayKey)).toMatchObject({ ok: true });
    const animal = session.farmAnimals?.farm_animal_bori;
    if (!animal) throw new Error("missing fixture animal");
    session.farmAnimals = { ...session.farmAnimals, farm_animal_bori: { ...animal, readyProductCount: ITEM_QUANTITY_MAX } };
    const before = structuredClone(session);

    const result = transitionToNextDay(project, session, sourceDayKey);

    expect(result).toEqual({ ok: false, reason: "animals", stage: "animals" });
    expect(session).toEqual(before);
  });
});
