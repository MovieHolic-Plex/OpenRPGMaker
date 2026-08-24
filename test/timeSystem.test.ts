import { describe, expect, it } from "vitest";
import {
  advanceGameTime,
  initialGameTime,
  resolveTimeSystem,
  setGameTimeClock,
  sleepGameTimeUntilMorning,
  timePhaseFor,
} from "@/project/gameTime";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, type SaveSnapshot } from "@/player/saveSlots";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runTool } from "@/editor/tools";
import { eligibleEncounterEntries } from "@/player/encounters";
import { createTimeDemoProject } from "./fixtures/timeDemo";
import { isGameTimePausedForRuntime, timeTintVisualForPhase } from "@/player/playSceneTime";
import { beginCutsceneControl } from "@/player/cutsceneControl";
import { validateSystem } from "@/project/io/shapeDatabaseFields";
import { TIME_TOOLS } from "@/editor/tools/timeTools";


describe("GameTime phase visuals", () => {
  it("exports distinct automatic day and night tint visuals", () => {
    expect(timeTintVisualForPhase("day")).not.toEqual(timeTintVisualForPhase("night"));
    expect(timeTintVisualForPhase("night").alpha).toBeGreaterThan(timeTintVisualForPhase("day").alpha);
  });
});
describe("GameTime core", () => {
  it("rolls minutes, hours, days, seasons, and years at 28-day seasons", () => {
    const system = resolveTimeSystem({ enabled: true, dayStartHour: 6, dayEndHour: 26 });
    expect(system).toBeDefined();
    const start = { minute: 50, hour: 25, day: 28, season: "winter" as const, year: 1 };
    const result = advanceGameTime(start, 20, system!);
    expect(result.dayEnds).toBe(1);
    expect(result.time).toEqual({ minute: 10, hour: 6, day: 1, season: "spring", year: 2 });
  });

  it("classifies phase boundaries", () => {
    const base = { minute: 0, day: 1, season: "spring" as const, year: 1 };
    expect(timePhaseFor({ ...base, hour: 6 })).toBe("morning");
    expect(timePhaseFor({ ...base, hour: 10 })).toBe("day");
    expect(timePhaseFor({ ...base, hour: 17 })).toBe("evening");
    expect(timePhaseFor({ ...base, hour: 20 })).toBe("night");
    expect(timePhaseFor({ ...base, hour: 2 })).toBe("night");
  });

  it("sets clock and sleeps to the next morning", () => {
    const system = resolveTimeSystem({ enabled: true, dayStartHour: 6, dayEndHour: 26 })!;
    const time = initialGameTime(system)!;
    expect(setGameTimeClock(time, 21, 30, system)).toMatchObject({ hour: 21, minute: 30 });
    expect(sleepGameTimeUntilMorning(time, system).time).toEqual({ minute: 0, hour: 6, day: 2, season: "spring", year: 1 });
  });
  it("uses configurable daysPerSeason for calendar rollover", () => {
    const system = resolveTimeSystem({ enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 7 })!;
    expect(system.daysPerSeason).toBe(7);
    const start = { minute: 0, hour: 6, day: 7, season: "spring" as const, year: 1 };
    const next = sleepGameTimeUntilMorning(start, system).time;
    expect(next).toEqual({ minute: 0, hour: 6, day: 1, season: "summer", year: 1 });
    const short = advanceGameTime({ minute: 50, hour: 25, day: 7, season: "winter" as const, year: 1 }, 20, system);
    expect(short.dayEnds).toBe(1);
    expect(short.time).toMatchObject({ day: 1, season: "spring", year: 2, hour: 6 });
  });

  it("defaults daysPerSeason to 28 when omitted", () => {
    const system = resolveTimeSystem({ enabled: true })!;
    expect(system.daysPerSeason).toBe(28);
  });

});

describe("GameTime session and save compatibility", () => {
  it("keeps time absent when timeSystem is not configured", () => {
    const project = createBlankProject();
    const session = startSession(project);
    expect(session.gameTime).toBeUndefined();
    const result = runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps: [{ kind: "wait", ticks: 120 }] });
    expect(result.ok).toBe(true);
    expect(result.finalState.gameTime).toBeUndefined();
  });

  it("initializes enabled legacy saves to day1 spring 06:00 and preserves modern saves", () => {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    const session = startSession(project);
    expect(session.gameTime).toEqual({ minute: 0, hour: 6, day: 1, season: "spring", year: 1 });
    session.gameTime = { minute: 45, hour: 18, day: 3, season: "summer", year: 2 };
    const snapshot = createSaveSnapshot(project, session);
    expect(applySaveSnapshot(project, snapshot).gameTime).toEqual(session.gameTime);
    const legacySnapshot: SaveSnapshot = {
      ...snapshot,
      session: { ...snapshot.session, gameTime: undefined },
    };
    expect(applySaveSnapshot(project, legacySnapshot).gameTime).toEqual({ minute: 0, hour: 6, day: 1, season: "spring", year: 1 });
  });
});

describe("GameTime tools and scene integration", () => {
  it("configure_time_system writes enabled settings and can remove them", () => {
    const ctx = { project: createBlankProject() };
    const enabled = runTool(ctx, "configure_time_system", { enabled: true, minutesPerRealSecond: 30, forceSleep: true });
    expect(enabled.ok).toBe(true);
    expect(ctx.project.system.timeSystem).toMatchObject({ enabled: true, minutesPerRealSecond: 30, dayStartHour: 6, dayEndHour: 26, forceSleep: true });
    const disabled = runTool(ctx, "configure_time_system", { enabled: false });
    expect(disabled.ok).toBe(true);
    expect(ctx.project.system.timeSystem).toBeUndefined();
  });

  // Break caught: configure_time_system silently drops the authored season length.
  it("configure_time_system forwards daysPerSeason", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "configure_time_system", { enabled: true, daysPerSeason: 14 });
    expect(result.ok).toBe(true);
    expect(ctx.project.system.timeSystem?.daysPerSeason).toBe(14);
    const configure = TIME_TOOLS.find((tool) => tool.name === "configure_time_system");
    expect(configure?.parameters.properties?.daysPerSeason).toMatchObject({ type: "integer" });
  });

  // Break caught: malformed season lengths pass shape validation and normalize as 28.
  it("rejects a non-number daysPerSeason at the project shape boundary", () => {
    const system = createBlankProject().system as unknown as Record<string, unknown>;
    system.timeSystem = { enabled: true, daysPerSeason: "28" };
    expect(() => validateSystem(system)).toThrow(/daysPerSeason/);
  });

  it("run_scene_test handles sleepUntilMorning, onDayEnd order, and timePhase page branches", () => {
    const { project, ids } = createTimeDemoProject();
    const result = runSceneTest(project, {
      mapId: ids.mapId,
      start: { x: 0, y: 0 },
      steps: [
        { kind: "interact" },
        { kind: "expect", variableEquals: { [ids.phaseVariableId]: 1 }, gameTimeAt: { hour: 6, day: 1, season: "spring" }, timePhase: "morning" },
        { kind: "wait", ticks: 875 },
        { kind: "expect", gameTimeAt: { hour: 20 }, timePhase: "night" },
        { kind: "interact" },
        { kind: "expect", variableEquals: { [ids.phaseVariableId]: 2 } },
        { kind: "advanceDays", days: 1 },
        { kind: "expect", variableEquals: { [ids.hookVariableId]: 1 }, gameTimeAt: { hour: 6, day: 2, season: "spring" } },
      ],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log).toContain(`onDayEnd ${ids.dayEndCommonEventId} start`);
  });

  it("run_scene_test can verify a night-only encounter table entry", () => {
    const { project, ids } = createTimeDemoProject();
    const session = startSession(project, 1);
    session.gameTime = { minute: 0, hour: 20, day: 1, season: "spring", year: 1 };
    expect(eligibleEncounterEntries(project.maps[ids.mapId], session, { x: 1, y: 0 }).map((entry) => entry.troopId)).toEqual([ids.nightTroopId]);
    const result = runSceneTest(project, {
      mapId: ids.mapId,
      start: { x: 0, y: 0 },
      steps: [
        { kind: "wait", ticks: 875 },
        { kind: "move", dir: "right" },
      ],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log.some((line) => line.startsWith(`random encounter ${ids.nightTroopId}:`))).toBe(true);
  });

  it("forceSleep runs onDayEnd before the next morning", () => {
    const { project, ids } = createTimeDemoProject();
    const result = runSceneTest(project, {
      mapId: ids.mapId,
      start: { x: 0, y: 0 },
      steps: [
        { kind: "wait", ticks: 1250 },
        { kind: "expect", variableEquals: { [ids.hookVariableId]: 1 }, gameTimeAt: { hour: 6, day: 2, season: "spring" } },
      ],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log.indexOf(`onDayEnd ${ids.dayEndCommonEventId} start`)).toBeLessThan(result.log.findIndex((line) => line.startsWith("sleep until morning")));
  });

  it("pauses time while menu, battle, or cutscene lock is active", () => {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true };
    const session = startSession(project);
    expect(isGameTimePausedForRuntime(fakePauseScene(session, "main-menu"))).toBe(true);
    expect(isGameTimePausedForRuntime(fakePauseScene(session, "battle-scene"))).toBe(true);
    beginCutsceneControl(session, "ev_cutscene", false);
    expect(isGameTimePausedForRuntime(fakePauseScene(session, null))).toBe(true);
  });
});

function fakePauseScene(session: ReturnType<typeof startSession>, activeTestId: string | null): Parameters<typeof isGameTimePausedForRuntime>[0] {
  const root = {
    querySelector(selector: string): object | null {
      return activeTestId && selector.includes(`[data-testid='${activeTestId}']`) ? {} : null;
    },
  };
  return {
    game: {
      canvas: {
        parentElement: { closest: () => root },
        ownerDocument: root,
      },
    },
    session,
    timeSleepInProgress: false,
  } as unknown as Parameters<typeof isGameTimePausedForRuntime>[0];
}
