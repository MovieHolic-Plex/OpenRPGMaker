import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { initialGameTime, setGameTimeClock } from "@/project/gameTime";
import { matchNpcSchedule, npcScheduleWhenMatches } from "@/project/npcSchedule";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { EventPage, GameEvent, GameMap, NpcScheduleEntry, Project } from "@/project/types";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { updateNpcSchedules } from "@/player/npcSchedules";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { initialRuntimeEventPositions } from "@/player/runtimeEventState";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createNpcScheduleDemoProject } from "./fixtures/npcScheduleDemo";
import { mockSprite } from "./runtimeEventPageFixtures";

describe("NPC schedule matching", () => {
  it("matches timePhase, season, dayRange, and hourRange combinations", () => {
    const springMorning = { minute: 0, hour: 7, day: 3, season: "spring" as const, year: 1 };
    const entry = scheduleEntry({ timePhase: "morning", season: "spring", dayRange: [2, 4], hourRange: [6, 9] });

    expect(npcScheduleWhenMatches(entry, springMorning)).toBe(true);
    expect(npcScheduleWhenMatches(entry, { ...springMorning, season: "summer" })).toBe(false);
    expect(npcScheduleWhenMatches(entry, { ...springMorning, day: 5 })).toBe(false);
    expect(npcScheduleWhenMatches(entry, { ...springMorning, hour: 10 })).toBe(false);
    expect(npcScheduleWhenMatches(scheduleEntry({ hourRange: [20, 6] }), { ...springMorning, hour: 23 })).toBe(true);
    expect(npcScheduleWhenMatches(scheduleEntry({ hourRange: [20, 6] }), springMorning)).toBe(false);

    const schedule = [
      scheduleEntry({ season: "winter" }),
      scheduleEntry({ timePhase: "morning" }, "field"),
    ];
    expect(matchNpcSchedule(schedule, springMorning)).toMatchObject({ index: 1, entry: { activity: "field" } });
  });
});

describe("NPC schedule runtime", () => {
  it("walks same-map NPCs through the existing mover and applies final facing", () => {
    const { project, map } = createScheduleProject([
      { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_runtime", x: 3, y: 1 }, facing: "up", activity: "work" },
    ]);
    const scene = scheduleScene(project, map);

    updateNpcSchedules(scene);

    expect(scene.autonomousNPCs.has("npc")).toBe(true);
    expect(scene.session.eventLocations.npc).toMatchObject({ mapId: map.id, x: 1, y: 1 });

    advanceMover(scene, "npc");
    updateNpcSchedules(scene);

    expect(scene.session.eventLocations.npc).toEqual({ mapId: map.id, x: 3, y: 1, direction: "up" });
    expect(scene.session.npcActivities?.npc).toBe("work");
  });

  it("relocates offscreen cross-map NPCs immediately", () => {
    const { project, map, otherMap } = createScheduleProject([
      { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_other", x: 2, y: 2 }, facing: "left", activity: "shop" },
    ], true);
    const scene = scheduleScene(project, otherMap);

    updateNpcSchedules(scene);

    expect(scene.autonomousNPCs.has("npc")).toBe(false);
    expect(scene.session.eventLocations.npc).toEqual({ mapId: otherMap.id, x: 2, y: 2, direction: "left" });
    expect(scene.session.npcActivities?.npc).toBe("shop");
    expect(map.events[0]?.id).toBe("npc");
  });

  it("does not advance schedule movement while runtime time is paused", () => {
    const { project, map } = createScheduleProject([
      { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_runtime", x: 3, y: 1 }, activity: "work" },
    ]);
    const scene = scheduleScene(project, map);

    updateNpcSchedules(scene, true);

    expect(scene.autonomousNPCs.has("npc")).toBe(false);
    expect(scene.session.eventLocations.npc).toBeUndefined();
  });

  it("keeps a schedule route paused during dialogue-like waits and resumes afterward", () => {
    const { project, map } = createScheduleProject([
      { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_runtime", x: 4, y: 1 }, activity: "work" },
    ]);
    const scene = scheduleScene(project, map);

    updateNpcSchedules(scene);
    const before = scene.session.eventLocations.npc;
    updateNpcSchedules(scene);

    expect(scene.autonomousNPCs.has("npc")).toBe(true);
    expect(scene.session.eventLocations.npc).toEqual(before);

    advanceMover(scene, "npc");
    updateNpcSchedules(scene);

    expect(scene.session.eventLocations.npc).toMatchObject({ mapId: map.id, x: 4, y: 1 });
  });

  it("does not return or alter NPCs that have no schedule", () => {
    const { project, map } = createScheduleProject([]);
    const scene = scheduleScene(project, map);
    scene.session.eventLocations.npc = { mapId: map.id, x: 5, y: 5, direction: "right" };

    updateNpcSchedules(scene);

    expect(scene.session.eventLocations.npc).toEqual({ mapId: map.id, x: 5, y: 5, direction: "right" });
    expect(scene.autonomousNPCs.has("npc")).toBe(false);
  });

  it("preserves schedule activity and route state through save/load", () => {
    const { project, map } = createScheduleProject([
      { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_runtime", x: 3, y: 1 }, activity: "work" },
    ]);
    const session = startSession(project);
    session.npcActivities = { npc: "work" };
    session.npcScheduleStates = { npc: { routeKey: "schedule:0:map_schedule_runtime:3,1", exitTarget: { mapId: map.id, x: 3, y: 1 } } };

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));

    expect(restored.npcActivities).toEqual(session.npcActivities);
    expect(restored.npcScheduleStates).toEqual(session.npcScheduleStates);
  });
});

describe("NPC schedule run_scene_test integration", () => {
  it("moves villagers between work and home and branches dialogue by npcActivity", () => {
    const { project, ids } = createNpcScheduleDemoProject();
    const result = runSceneTest(project, {
      mapId: ids.townMapId,
      start: { x: 8, y: 1 },
      steps: [
        { kind: "expect", eventAt: { eventId: ids.farmerEventId, x: 8, y: 2, mapId: ids.townMapId } },
        { kind: "interact" },
        { kind: "expect", variableEquals: { [ids.farmerFieldVariableId]: 1 } },
        { kind: "wait", ticks: 188 },
        { kind: "expect", eventOnMap: { eventId: ids.merchantEventId, mapId: ids.shopMapId } },
        { kind: "wait", ticks: 562 },
        { kind: "expect", eventAt: { eventId: ids.farmerEventId, x: 2, y: 2, mapId: ids.townMapId } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
  });
});

function scheduleEntry(when: NpcScheduleEntry["when"], activity?: string): NpcScheduleEntry {
  return {
    when,
    at: { mapId: "map_schedule_runtime", x: 1, y: 1 },
    ...(activity ? { activity } : {}),
  };
}

function createScheduleProject(
  schedule: NpcScheduleEntry[],
  includeOtherMap = false
): { readonly project: Project; readonly map: GameMap; readonly otherMap: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("스케줄 테스트", 8, 8);
  map.id = "map_schedule_runtime";
  const otherMap = createBlankMap("다른 맵", 8, 8);
  otherMap.id = "map_schedule_other";
  map.events = [npcEvent(schedule)];
  project.startMapId = map.id;
  project.startPos = { x: 0, y: 0 };
  project.maps = includeOtherMap ? { [map.id]: map, [otherMap.id]: otherMap } : { [map.id]: map };
  project.mapTree = { mapId: map.id, children: includeOtherMap ? [{ mapId: otherMap.id, children: [] }] : [] };
  project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60, dayStartHour: 6, dayEndHour: 26 };
  return { project, map, otherMap };
}

function npcEvent(schedule: NpcScheduleEntry[]): GameEvent {
  return {
    id: "npc",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    ...(schedule.length ? { schedule } : {}),
    pages: [baseNpcPage()],
  };
}

function baseNpcPage(): EventPage {
  return {
    id: "npc_base",
    name: "NPC",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function scheduleScene(project: Project, map: GameMap): Parameters<typeof updateNpcSchedules>[0] & Parameters<typeof updateAutonomousNPCs>[0] {
  store.replace(project);
  const system = project.system.timeSystem;
  const time = setGameTimeClock(initialGameTime(system)!, 6, 0, system!);
  let scene: Parameters<typeof updateNpcSchedules>[0] & Parameters<typeof updateAutonomousNPCs>[0];
  scene = {
    map,
    session: { ...startSession(project), currentMapId: map.id, gameTime: time },
    eventPositions: initialRuntimeEventPositions(map.events),
    autonomousNPCs: new Map(),
    commandMoveRouteEventIds: new Set(),
    registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
    refreshRuntimeSurfaces: () => undefined,
    syncRuntimeState: () => undefined,
    eventSprites: new Map([["npc", mockSprite()]]),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
    tileX: 0,
    tileY: 0,
  };
  return scene;
}

function advanceMover(scene: Parameters<typeof updateAutonomousNPCs>[0], eventId: string): void {
  for (let guard = 0; guard < 40 && scene.autonomousNPCs.has(eventId); guard += 1) {
    const mover = scene.autonomousNPCs.get(eventId);
    if (!mover) break;
    updateAutonomousNPCs(scene, mover.moveIntervalMs);
    if (mover.activeMove) updateAutonomousNPCs(scene, mover.moveDurationMs);
  }
}
