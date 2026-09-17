import { describe, expect, it } from "vitest";
import { applyDailyWeatherForDate } from "@/project/dailyWeather";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { advanceGameDays, resolveTimeSystem } from "@/project/gameTime";
import { startSession } from "@/project/session";
import { farmPlotAt, interactWithFarmPlot, syncFarmPlotsToDate } from "@/player/farming";
import { waterFarmPlotsForDailyWeather } from "@/player/farmingWeather";

describe("P1 weather watering handoff", () => {
  it.each(["rain", "storm"] as const)(
    "marks dry destination-day plots before farm growth synchronization for %s",
    (kind) => {
      // Break caught: transition synchronizes growth before destination rain can water the crop.
      const project = createFarmingDemoProject();
      project.system.dailyWeather = {
        enabled: true,
        seasons: { spring: [{ kind, weight: 1, intensity: 0.8 }] },
      };
      const session = startSession(project, 41);
      const map = project.maps[project.startMapId]!;
      interactWithFarmPlot(project, session, map, 4, 5);
      interactWithFarmPlot(project, session, map, 4, 5);
      expect(farmPlotAt(session, map.id, 4, 5)?.watered).toBe(false);

      const system = resolveTimeSystem(project)!;
      session.gameTime = advanceGameDays(session.gameTime!, 1, system).time;
      applyDailyWeatherForDate(project, session, session.gameTime);

      expect(waterFarmPlotsForDailyWeather(session, session.gameTime)).toBe(1);
      expect(farmPlotAt(session, map.id, 4, 5)?.watered).toBe(true);
      syncFarmPlotsToDate(project, session, system);
      expect(farmPlotAt(session, map.id, 4, 5)).toMatchObject({ growthDays: 1, watered: false });
    },
  );

  it("does not water from clear, non-rain, zero-strength, or stale saved weather", () => {
    // Break caught: a stale/visually-clear weather receipt waters the wrong calendar day.
    const project = createFarmingDemoProject();
    const session = startSession(project, 42);
    const map = project.maps[project.startMapId]!;
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    const destination = { ...session.gameTime!, day: 2 };

    for (const weather of [
      { dayKey: "1:spring:2", kind: "none" as const, intensity: 0 },
      { dayKey: "1:spring:2", kind: "snow" as const, intensity: 1 },
      { dayKey: "1:spring:2", kind: "rain" as const, intensity: 0 },
      { dayKey: "1:spring:1", kind: "storm" as const, intensity: 1 },
    ]) {
      session.dailyWeather = weather;
      expect(waterFarmPlotsForDailyWeather(session, destination), weather.kind).toBe(0);
      expect(farmPlotAt(session, map.id, 4, 5)?.watered).toBe(false);
    }
  });

  it("is idempotent and leaves un-tilled or dead plots unchanged", () => {
    // Break caught: repeated orchestration inflates work or resurrects invalid/dead farm state.
    const project = createFarmingDemoProject();
    const session = startSession(project, 43);
    const mapId = project.startMapId;
    session.farmPlots = {
      [mapId]: {
        "1,1": { tilled: false, watered: false },
        "2,2": { tilled: true, watered: false, cropId: "crop_potato", dead: true },
        "3,3": { tilled: true, watered: false, cropId: "crop_potato", dead: false },
        "4,4": { tilled: true, watered: true, cropId: "crop_potato", dead: false },
      },
    };
    session.dailyWeather = { dayKey: "1:spring:1", kind: "rain", intensity: 1 };

    expect(waterFarmPlotsForDailyWeather(session, session.gameTime)).toBe(1);
    expect(waterFarmPlotsForDailyWeather(session, session.gameTime)).toBe(0);
    expect(session.farmPlots[mapId]?.["1,1"]?.watered).toBe(false);
    expect(session.farmPlots[mapId]?.["2,2"]?.watered).toBe(false);
    expect(session.farmPlots[mapId]?.["3,3"]?.watered).toBe(true);
    expect(session.farmPlots[mapId]?.["4,4"]?.watered).toBe(true);
  });
});
