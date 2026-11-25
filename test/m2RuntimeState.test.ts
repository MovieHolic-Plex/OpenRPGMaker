import { describe, expect, it } from "vitest";
import { createBlankMap } from "@/project/defaults";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { initialGameTime, setGameTimeClock } from "@/project/gameTime";
import { matchNpcSchedule, npcScheduleWhenMatches } from "@/project/npcSchedule";
import { startSession, type PlaySession } from "@/project/session";
import { store } from "@/project/store";
import type { EventPage, GameEvent, GameMap, NpcScheduleEntry, Project, Command } from "@/project/types";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { updateNpcSchedules } from "@/player/npcSchedules";
import { npcMoveDurationMs } from "@/player/playScenePageMoveRoutes";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot, type SaveSnapshot } from "@/player/saveSlots";
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { validateMaps } from "@/project/io/shapeEventFields";
import { createNpcScheduleDemoProject } from "./fixtures/npcScheduleDemo";
import { mockSprite } from "./runtimeEventPageFixtures";
import { createInterpreter } from "@/player/interpreter";
import { objectiveTargetViews } from "@/player/objectiveTarget";
import { sessionFromQaCheckpoint } from "@/player/qaCheckpoint";
import { currentObjective, currentObjectiveText } from "@/player/zoneFeedback";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { isolateTimers } from "./mergedTeardown";

describe("npcSchedule", () => {
  isolateTimers();
  describe("NPC schedule matching", () => {
    it("matches timePhase, season, dayRange, and hourRange combinations", () => {
      const springMorning = { minute: 0, hour: 7, day: 3, season: "spring" as const, year: 1 };
      const entry = scheduleEntry({ timePhase: "morning", season: "spring", dayRange: [2, 4], hourRange: [6, 9] });

      expect(npcScheduleWhenMatches(entry, springMorning, undefined)).toBe(true);
      expect(npcScheduleWhenMatches(entry, { ...springMorning, season: "summer" }, undefined)).toBe(false);
      expect(npcScheduleWhenMatches(entry, { ...springMorning, day: 5 }, undefined)).toBe(false);
      expect(npcScheduleWhenMatches(entry, { ...springMorning, hour: 10 }, undefined)).toBe(false);
      expect(npcScheduleWhenMatches(scheduleEntry({ hourRange: [20, 6] }), { ...springMorning, hour: 23 }, undefined)).toBe(true);
      expect(npcScheduleWhenMatches(scheduleEntry({ hourRange: [20, 6] }), springMorning, undefined)).toBe(false);

      const schedule = [
        scheduleEntry({ season: "winter" }),
        scheduleEntry({ timePhase: "morning" }, "field"),
      ];
      expect(matchNpcSchedule(schedule, springMorning, undefined)).toMatchObject({ index: 1, entry: { activity: "field" } });
    });
  });
  describe("NPC schedule weather condition", () => {
    const springMorning = { minute: 0, hour: 7, day: 3, season: "spring" as const, year: 1 };

    it("matches a weather-conditioned slot only in that weather and never when the weather is unknown", () => {
      const rainy = scheduleEntry({ weather: "rain" });
      expect(npcScheduleWhenMatches(rainy, springMorning, "rain")).toBe(true);
      expect(npcScheduleWhenMatches(rainy, springMorning, "snow")).toBe(false);
      expect(npcScheduleWhenMatches(rainy, springMorning, "none")).toBe(false);
      expect(npcScheduleWhenMatches(rainy, springMorning, undefined)).toBe(false);
      expect(npcScheduleWhenMatches(scheduleEntry({}), springMorning, undefined)).toBe(true);
    });

    it("keeps first-match order, so a rain slot listed first wins over the day slot only while it rains", () => {
      const schedule = [scheduleEntry({ weather: "rain" }, "shelter"), scheduleEntry({ timePhase: "morning" }, "market")];
      expect(matchNpcSchedule(schedule, springMorning, "rain")).toMatchObject({ index: 0, entry: { activity: "shelter" } });
      expect(matchNpcSchedule(schedule, springMorning, "none")).toMatchObject({ index: 1, entry: { activity: "market" } });
      expect(matchNpcSchedule(schedule, springMorning, undefined)).toMatchObject({ index: 1, entry: { activity: "market" } });
    });

    it("moves the NPC to the shelter slot when it rains and back when the rain stops", () => {
      const { project, map } = createScheduleProject([
        { when: { weather: "rain" }, at: { mapId: "map_schedule_runtime", x: 6, y: 6 }, activity: "shelter" },
        { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_runtime", x: 2, y: 1 }, activity: "market" },
      ]);
      const scene = scheduleScene(project, map);

      updateNpcSchedules(scene);
      expect(scene.session.npcActivities.npc).toBe("market");

      ensureM2Runtime(scene.session).screen.weather = "rain,5";
      updateNpcSchedules(scene);
      expect(scene.session.npcActivities.npc).toBe("shelter");

      ensureM2Runtime(scene.session).screen.weather = "none";
      updateNpcSchedules(scene);
      expect(scene.session.npcActivities.npc).toBe("market");
    });

    it("sees the authored daily weather, which startSession writes into the same screen weather string", () => {
      const { project, map } = createScheduleProject([
        { when: { weather: "rain" }, at: { mapId: "map_schedule_runtime", x: 6, y: 6 }, activity: "shelter" },
        { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_runtime", x: 2, y: 1 }, activity: "market" },
      ]);
      const rainOnly = [{ kind: "rain" as const, weight: 1, intensity: 0.6 }];
      project.system.dailyWeather = { enabled: true, seasons: { spring: rainOnly, summer: rainOnly, fall: rainOnly, winter: rainOnly } };
      const scene = scheduleScene(project, map);

      updateNpcSchedules(scene);

      expect(scene.session.dailyWeather?.kind).toBe("rain");
      expect(scene.session.npcActivities.npc).toBe("shelter");
    });
  });
  describe("NPC schedule weather shape", () => {
    it("accepts a known weather kind and rejects an unknown one", () => {
      expect(() => validateMaps({ m: mapWithSchedule({ weather: "rain" }) })).not.toThrow();
      expect(() => validateMaps({ m: mapWithSchedule({ weather: "hail" }) })).toThrow(/weather/);
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

    it("inherits page speed for schedule movers and keeps the schedule step interval", () => {
      const { project, map } = createScheduleProject([
        { when: { hourRange: [6, 18] }, at: { mapId: "map_schedule_runtime", x: 3, y: 1 }, activity: "work" },
      ]);
      const npcEvent = map.events[0];
      if (!npcEvent?.pages?.[0]) throw new Error("missing schedule npc page");
      npcEvent.pages[0].movement = { type: "fixed", speed: 8, frequency: 2 };
      const scene = scheduleScene(project, map);

      updateNpcSchedules(scene);

      const mover = scene.autonomousNPCs.get("npc");
      expect(mover?.speedRank).toBe(8);
      expect(mover?.moveDurationMs).toBe(npcMoveDurationMs(8));
      expect(mover?.moveIntervalMs).toBe(80);
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
  function mapWithSchedule(when: Record<string, unknown>): Record<string, unknown> {
    const { map } = createScheduleProject([{ when: when as NpcScheduleEntry["when"], at: { mapId: "map_schedule_runtime", x: 1, y: 1 } }]);
    return JSON.parse(JSON.stringify(map)) as Record<string, unknown>;
  }
});

// 목표가 «가리키는 이벤트»를 들고 다닌다 — 명령(fields.targetMapId · targetEventId) → 세션 목표(target) → 저장 칸 → QA 체크포인트 → 표시.
// 2026-11-12 r1 눈가림 플레이: 표시가 글의 이름으로 대상을 찾아 이름이 같은 다른 이벤트(r1-farm 「보리」 둘, r1-fantasy 「광산 수호자」 말 이벤트)에 섰다.
// 글 찾기는 옛 저장본·손으로 만든 게임의 대비로 남는다(openwiki/runtime-sessions.md 「목표가 가리키는 이벤트」).
describe("objectiveExplicitTarget", () => {
  isolateTimers();
  const chip = (message: string, target?: { mapId: string; eventId: string }): Command => ({
    kind: "m2Command", commandId: "m2-214-ui-command",
    fields: { surface: "objectiveChip", message, durationMs: 0, ...(target ? { targetMapId: target.mapId, targetEventId: target.eventId } : {}) },
  }) as Command;
  function run(session: ReturnType<typeof startSession>, commands: Command[]): void {
    const it = createInterpreter(commands, session);
    let r = it.start();
    for (let guard = 0; r.kind !== "done" && guard < 100; guard += 1) r = it.resume(undefined as never);
  }
  function memoryStorage(): Storage {
    const backing = new Map<string, string>();
    return {
      get length() { return backing.size; },
      clear: () => backing.clear(),
      getItem: (key: string) => backing.get(key) ?? null,
      key: (index: number) => [...backing.keys()][index] ?? null,
      removeItem: (key: string) => void backing.delete(key),
      setItem: (key: string, value: string) => void backing.set(key, value),
    } satisfies Storage;
  }
  describe("objective target: load · play · save", () => {
    it("loads: the two flat string fields pass the command shape check (an object field would not)", () => {
      expect(() => validateCommandArray("commands", [chip("보리와 이야기한다", { mapId: "m_field", eventId: "ev_bori" })])).not.toThrow();
      const nested = { kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message: "x", durationMs: 0, target: { mapId: "m", eventId: "e" } } };
      expect(() => validateCommandArray("commands", [nested])).toThrow(/fields/);
    });

    it("plays: the objective command hands its target to the session objective; a later objective without one clears it", () => {
      const project = createBlankProject();
      const session = startSession(project);
      run(session, [chip("보리와 이야기한다", { mapId: "m_field", eventId: "ev_bori" })]);
      expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다", target: { mapId: "m_field", eventId: "ev_bori" } });
      expect(currentObjectiveText(session.m2Runtime?.ui)).toBe("보리와 이야기한다");
      run(session, [chip("마을로 돌아간다")]);
      expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "마을로 돌아간다" });
      // 한쪽 칸만 있으면 대상으로 치지 않는다.
      run(session, [{ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message: "반쪽", durationMs: 0, targetEventId: "ev_bori" } } as Command]);
      expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "반쪽" });
    });

    it("saves and loads: the target rides the save slot next to the objective text", () => {
      const project = createBlankProject();
      const session = startSession(project);
      run(session, [chip("보리와 이야기한다", { mapId: project.startMapId, eventId: "ev_bori" })]);
      const snapshot = createSaveSnapshot(project, session);
      expect(snapshot.session.objective).toBe("보리와 이야기한다");
      expect(snapshot.session.objectiveTarget).toEqual({ mapId: project.startMapId, eventId: "ev_bori" });
      const storage = memoryStorage();
      expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      const loaded = applySaveSnapshot(project, (read as { snapshot: SaveSnapshot }).snapshot);
      expect(currentObjective(loaded.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다", target: { mapId: project.startMapId, eventId: "ev_bori" } });
    });

    it("an old save (objective text only) still loads — the marker then finds its target by the text", () => {
      const project = createBlankProject();
      const session = startSession(project);
      run(session, [chip("보리와 이야기한다")]);
      const snapshot = createSaveSnapshot(project, session);
      expect("objectiveTarget" in snapshot.session).toBe(false);
      const storage = memoryStorage();
      saveToSlot(storage, 1, snapshot);
      const loaded = applySaveSnapshot(project, (readSaveSlot(storage, 1) as { snapshot: SaveSnapshot }).snapshot);
      expect(currentObjective(loaded.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다" });
    });

    it("a save whose objectiveTarget is malformed loads with the text only", () => {
      const project = createBlankProject();
      const session = startSession(project);
      run(session, [chip("보리와 이야기한다", { mapId: project.startMapId, eventId: "ev_bori" })]);
      const storage = memoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const key = [...Array(storage.length).keys()].map((i) => storage.key(i)!).find((k) => (storage.getItem(k) ?? "").includes("objectiveTarget"))!;
      storage.setItem(key, storage.getItem(key)!.replace(/"objectiveTarget":\{[^}]*\}/u, '"objectiveTarget":{"mapId":7}'));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      const loaded = applySaveSnapshot(project, (read as { snapshot: SaveSnapshot }).snapshot);
      expect(currentObjective(loaded.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다" });
    });

    it("QA checkpoint: objectiveTarget starts the board with the same target", () => {
      const project = createBlankProject();
      const session = sessionFromQaCheckpoint(project, { id: "cp", mapId: project.startMapId, objective: "보리와 이야기한다", objectiveTarget: { mapId: project.startMapId, eventId: "ev_bori" } });
      expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다", target: { mapId: project.startMapId, eventId: "ev_bori" } });
      const plain = sessionFromQaCheckpoint(project, { id: "cp2", mapId: project.startMapId, objective: "보리와 이야기한다" });
      expect(currentObjective(plain.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다" });
    });
  });
  type Page = { commands: unknown[]; conditions?: unknown[]; trigger?: string };
  type Ev = { id: string; name?: string; x: number; y: number; pages: Page[] };
  const talk = (...commands: unknown[]): Page => ({ commands: [{ kind: "text", body: "…" }, ...commands] });
  const door = (to: string, conditions: unknown[] = []): Page => ({ trigger: "playerTouch", conditions, commands: [{ kind: "transfer", mapId: to, x: 1, y: 1 }] });
  const on = (switchId: string) => ({ kind: "switch", switchId, value: true });
  const has = (itemId: string) => ({ kind: "item", itemId, present: true });
  const set = (switchId: string) => ({ kind: "setSwitch", switchId, value: true });
  function world(maps: Record<string, { name: string; events: Ev[] }>): Project {
    const project = createBlankProject();
    const template = project.maps[project.startMapId]!;
    const out: Record<string, GameMap> = {};
    for (const [id, spec] of Object.entries(maps)) {
      out[id] = {
        ...structuredClone(template), id, name: spec.name,
        events: spec.events.map((e) => ({
          id: e.id, name: e.name ?? "", x: e.x, y: e.y,
          pages: e.pages.map((p, i) => ({ id: `${e.id}_p${i}`, trigger: { kind: p.trigger ?? "action" }, priority: "same", graphic: {}, conditions: p.conditions ?? [], commands: p.commands })),
        })) as unknown as GameEvent[],
      } as GameMap;
    }
    project.maps = out as Project["maps"];
    project.startMapId = Object.keys(maps)[0]!;
    return project;
  }
  function ids(project: Project, mapId: string, text: string, options: { target?: { mapId: string; eventId: string }; switches?: string[]; items?: string[]; blind?: boolean } = {}): string[] {
    const session = startSession(project);
    for (const id of options.switches ?? []) session.switches[id] = true;
    for (const id of options.items ?? []) session.inventory[id] = 1;
    const map = project.maps[mapId]!;
    const views = runtimeEventViewsForMap(project, map, session, {});
    return objectiveTargetViews(project, map, views, text, { target: options.target, ...(options.blind ? {} : { session }) }).map((view) => view.event.id);
  }
  describe("objective target: the marker stands on the event the objective carries", () => {
    // 밭에 「보리」 가 둘 — 이야기를 넘기는 쪽(ev_bori)과 같은 이름의 곁 이벤트(ev_bori_story).
    const farm = () => world({
      m_field: { name: "보리밭", events: [
        { id: "ev_bori_story", name: "보리", x: 3, y: 3, pages: [talk()] },
        { id: "ev_bori", name: "보리", x: 12, y: 9, pages: [talk(set("sw_talked"))] },
        { id: "ev_gate_field_barn", x: 19, y: 7, pages: [door("m_barn")] },
      ] },
      m_barn: { name: "헛간", events: [
        { id: "ev_gate_barn_field", x: 0, y: 7, pages: [door("m_field")] },
        { id: "ev_chest", name: "씨앗 상자", x: 5, y: 5, pages: [talk(set("sw_seed")), { conditions: [on("sw_seed")], commands: [] }] },
      ] },
    });

    it("text alone finds both namesakes; the carried target picks the one that advances the step", () => {
      const project = farm();
      expect(ids(project, "m_field", "보리와 이야기한다 (보리)").sort()).toEqual(["ev_bori", "ev_bori_story"]);
      expect(ids(project, "m_field", "보리와 이야기한다 (보리)", { target: { mapId: "m_field", eventId: "ev_bori" } })).toEqual(["ev_bori"]);
    });

    it("a target on another map: the first exit toward that map, whatever the text says", () => {
      const project = farm();
      expect(ids(project, "m_field", "보리와 이야기한다 (보리)", { target: { mapId: "m_barn", eventId: "ev_chest" } })).toEqual(["ev_gate_field_barn"]);
    });

    it("falls back to the text when the target event is gone, on an unknown map, or its open page does nothing", () => {
      const project = farm();
      const text = "씨앗 상자를 연다 (씨앗 상자)";
      expect(ids(project, "m_barn", text, { target: { mapId: "m_barn", eventId: "ev_missing" } })).toEqual(["ev_chest"]);
      expect(ids(project, "m_barn", text, { target: { mapId: "m_nowhere", eventId: "ev_chest" } })).toEqual(["ev_chest"]);
      expect(ids(project, "m_field", "보리와 이야기한다 (보리)", { target: { mapId: "m_barn", eventId: "ev_missing" } }).sort()).toEqual(["ev_bori", "ev_bori_story"]);
      // 상자를 이미 열었다(빈 페이지) — 대상은 눌러도 아무 일이 없으니 글이 이름을 댄 쪽으로.
      expect(ids(project, "m_barn", "보리에게 돌아간다 (보리밭 입구: 서쪽 → 보리)", { target: { mapId: "m_barn", eventId: "ev_chest" }, switches: ["sw_seed"] })).toEqual(["ev_gate_barn_field"]);
    });
  });
  describe("objective target: a locked exit on the way points at what opens it", () => {
    // 찻집 → 시장 → 여관. 시장→여관 길목은 나디아(시장)와 아말(찻집) 둘 다와 이야기해야 열린다 — 어느 쪽이 먼저든 된다.
    const bazaar = () => world({
      m_tea: { name: "별빛 찻집", events: [
        { id: "ev_gate_tea_market", x: 9, y: 14, pages: [door("m_market")] },
        { id: "ev_amal", name: "아말", x: 4, y: 4, pages: [talk(set("sw_amal")), { conditions: [on("sw_amal")], commands: [{ kind: "text", body: "다녀와." }] }] },
      ] },
      m_market: { name: "황금 천막 시장", events: [
        { id: "ev_gate_market_tea", x: 9, y: 0, pages: [door("m_tea")] },
        { id: "ev_gate_market_inn", x: 19, y: 7, pages: [
          { commands: [{ kind: "text", body: "(나디아와 아말에게 먼저 길을 물어야 한다.)" }] },
          door("m_inn", [on("sw_nadia"), on("sw_amal")]),
        ] },
        { id: "ev_nadia", name: "나디아", x: 6, y: 9, pages: [talk(set("sw_nadia"))] },
      ] },
      m_inn: { name: "모래바람 여관", events: [
        { id: "ev_gate_inn_market", x: 0, y: 7, pages: [door("m_market")] },
        { id: "ev_idris", name: "이드리스", x: 8, y: 6, pages: [talk(set("sw_idris"))] },
      ] },
    });
    const text = "궁전 가는 길을 듣는다 (황금 천막 시장 입구: 남쪽 → 황금 천막 시장에서 동쪽 → 모래바람 여관 · 이드리스)";

    it("on the map of the locked exit: the events that give what is still missing, not the shut exit", () => {
      const project = bazaar();
      expect(ids(project, "m_market", text)).toEqual(["ev_nadia"]);
      // 나디아와는 이야기했다 — 남은 것은 찻집의 아말이므로 찻집으로 가는 문.
      expect(ids(project, "m_market", text, { switches: ["sw_nadia"] })).toEqual(["ev_gate_market_tea"]);
    });

    it("one map before the lock: the opener standing here first, then the way on", () => {
      const project = bazaar();
      expect(ids(project, "m_tea", text)).toEqual(["ev_amal"]);
      expect(ids(project, "m_tea", text, { switches: ["sw_amal"] })).toEqual(["ev_gate_tea_market"]);
    });

    it("once everything is given the exit is the target again; the carried target behaves the same", () => {
      const project = bazaar();
      expect(ids(project, "m_market", text, { switches: ["sw_nadia", "sw_amal"] })).toEqual(["ev_gate_market_inn"]);
      const target = { mapId: "m_inn", eventId: "ev_idris" };
      expect(ids(project, "m_market", "길을 듣는다", { target })).toEqual(["ev_nadia"]);
      expect(ids(project, "m_market", "길을 듣는다", { target, switches: ["sw_nadia", "sw_amal"] })).toEqual(["ev_gate_market_inn"]);
      expect(ids(project, "m_inn", "길을 듣는다", { target, switches: ["sw_nadia", "sw_amal"] })).toEqual(["ev_idris"]);
    });

    it("without the board (editor, checks) the lock is not read — as before: the shut exit carries no marker, the open one does", () => {
      const project = bazaar();
      expect(ids(project, "m_market", text, { blind: true })).toEqual([]);
      expect(ids(project, "m_tea", text, { blind: true })).toEqual(["ev_gate_tea_market"]);
    });

    it("an opener that is itself locked: go to what opens the opener (an item given on another map)", () => {
      const project = world({
        m_mine: { name: "버려진 광산", events: [
          { id: "ev_gate_mine_forest", x: 0, y: 7, pages: [door("m_forest")] },
          { id: "ev_gate_mine_deep", x: 19, y: 7, pages: [{ commands: [{ kind: "text", body: "(물길이 막혀 있다.)" }] }, door("m_deep", [on("sw_water")])] },
          // 수문은 이끼의 부적이 있어야 돌아간다.
          { id: "ev_sluice", name: "수문", x: 10, y: 4, pages: [talk(), { conditions: [has("item_charm")], commands: [{ kind: "text", body: "돌렸다." }, set("sw_water")] }] },
        ] },
        m_forest: { name: "속삭임 숲", events: [
          { id: "ev_gate_forest_mine", x: 19, y: 7, pages: [door("m_mine")] },
          { id: "ev_moss", name: "숲지기 이끼", x: 6, y: 6, pages: [talk({ kind: "changeItem", itemId: "item_charm", op: "+=", amount: 1 })] },
        ] },
        m_deep: { name: "깊은 수로", events: [{ id: "ev_gate_deep_mine", x: 0, y: 7, pages: [door("m_mine")] }, { id: "ev_spring", name: "샘", x: 9, y: 9, pages: [talk(set("sw_end"))] }] },
      });
      const goal = "샘을 살핀다 (깊은 수로 입구: 동쪽 → 샘)";
      expect(ids(project, "m_mine", goal)).toEqual(["ev_gate_mine_forest"]);
      expect(ids(project, "m_forest", goal)).toEqual(["ev_moss"]);
      expect(ids(project, "m_mine", goal, { items: ["item_charm"] })).toEqual(["ev_sluice"]);
      expect(ids(project, "m_mine", goal, { items: ["item_charm"], switches: ["sw_water"] })).toEqual(["ev_gate_mine_deep"]);
    });

    it("a lock nothing gives: the shut exit itself (its own line says what is missing)", () => {
      const project = world({
        m_a: { name: "안뜰", events: [{ id: "ev_gate_a_b", x: 19, y: 7, pages: [{ commands: [{ kind: "text", body: "(잠겨 있다.)" }] }, door("m_b", [on("sw_never")])] }] },
        m_b: { name: "탑", events: [{ id: "ev_gate_b_a", x: 0, y: 7, pages: [door("m_a")] }, { id: "ev_top", name: "종", x: 5, y: 5, pages: [talk()] }] },
      });
      expect(ids(project, "m_a", "종을 울린다 (탑 입구: 동쪽 → 종)")).toEqual(["ev_gate_a_b"]);
    });
  });
  it("a toast shown after the objective does not hide the objective or its target", () => {
    const project = createBlankProject();
    const session = startSession(project);
    ensureM2Runtime(session).ui.push({ surface: "objectiveChip", message: "옛 목표", durationMs: 0, target: { mapId: "m", eventId: "e" } });
    ensureM2Runtime(session).ui.push({ surface: "toast", message: "알림", durationMs: 1600 });
    expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "옛 목표", target: { mapId: "m", eventId: "e" } });
  });
});

describe("screenSaveRestore", () => {
  isolateTimers();
  function mkSession(): PlaySession {
    return {
      switches: {},
      selfSwitches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      monsterInstances: {},
      monsterParty: [],
      monsterBox: [],
      classOverrides: {},
      actorSkillIds: {},
      actorExperience: {},
      actorLevels: {},
      actorVitals: {},
      eventLocations: {},
      erasedEventIds: [],
      npcTravelStates: {},
      followers: [],
      followerTrail: [],
      actorEquipment: {},
      actorRows: {},
      currentMapId: "m1",
      x: 0,
      y: 0,
      lighting: { ambient: 0, sources: [] },
      mapOverrides: {},
      flags: {},
      audio: {},
      pictures: {},
      playTimeSeconds: 0,
    };
  }
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }
  describe("세이브/로드 — 화면 색조/날씨 복원", () => {
    it("tint/weather/tintDurationMs 가 스냅샷에 저장되고 로드 후 복원된다", () => {
      const project = createBlankProject();
      const session = mkSession();
      const screen = ensureM2Runtime(session).screen;
      screen.tint = "128,64,32";
      screen.tintDurationMs = 800;
      screen.weather = "rain,5";

      const snapshot = createSaveSnapshot(project, session);
      expect(snapshot.session.screen).toEqual({
        tint: "128,64,32",
        weather: "rain,5",
        hidden: undefined,
        tintDurationMs: 800,
      });

      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.m2Runtime?.screen.tint).toBe("128,64,32");
      expect(restored.m2Runtime?.screen.weather).toBe("rain,5");
      expect(restored.m2Runtime?.screen.tintDurationMs).toBe(800);
    });

    it("화면 효과가 없으면 screen 을 생략한다", () => {
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, mkSession());
      expect(snapshot.session.screen).toBeUndefined();
    });

    it("픽처의 트윈 필드(scale/opacity)도 저장/복원된다", () => {
      const project = createBlankProject();
      const session = mkSession();
      session.pictures = {
        pic1: { pictureId: "pic1", resourceId: "hero", x: 3, y: 4, scale: 150, opacity: 200 },
      };
      const snapshot = createSaveSnapshot(project, session);
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.pictures.pic1).toMatchObject({ scale: 150, opacity: 200, x: 3, y: 4 });
    });

    it("액터 그래픽, 파라미터 보정, 상태 이상 세션 필드를 저장/복원한다", () => {
      const project = createBlankProject();
      const session = mkSession();
      session.actorCharacterResourceIds = { actor_hero: "easyrpg-charset-actor2" };
      session.actorParamBonuses = { actor_hero: { maxHp: 20, attack: 4 } };
      session.actorStateIds = { actor_hero: ["state_poison"] };

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const result = readSaveSlot(storage, 1);

      expect(result.kind).toBe("present");
      if (result.kind === "present") {
        const restored = applySaveSnapshot(project, result.snapshot);
        expect(restored.actorCharacterResourceIds).toEqual({ actor_hero: "easyrpg-charset-actor2" });
        expect(restored.actorParamBonuses).toEqual({ actor_hero: { maxHp: 20, attack: 4 } });
        expect(restored.actorStateIds).toEqual({ actor_hero: ["state_poison"] });
      }
    });

    it("storage 왕복(직렬화)에서도 fog 날씨 상태가 유지된다", () => {
      const project = createBlankProject();
      const session = mkSession();
      ensureM2Runtime(session).screen.weather = "fog,0.4";
      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind === "present") {
        const restored = applySaveSnapshot(project, result.snapshot);
        expect(restored.m2Runtime?.screen.weather).toBe("fog,0.4");
      }
    });
  });
});
