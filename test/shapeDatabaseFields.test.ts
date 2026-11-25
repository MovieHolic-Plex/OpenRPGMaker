import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { validateSystem } from "@/project/io/shapeDatabaseFields";
import { SE_CUE_IDS, footstepCueForTerrain, isSeCueId, magicCueForElement, normalizeSeCues, projectSeCue, seCueFallbacks } from "@/project/seCues";
import { SYSTEM_SE_CUES } from "@/project/systemAudioOverrides";
import { authoredBattleCue, skillSeCue } from "@/player/battleJuice";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import { FOOTSTEP_MIN_INTERVAL_MS, footstepResourceAt, playFootstep, resetFootstepClock } from "@/player/footsteps";
import type { Project } from "@/project/types";
import { advanceGameTime, initialGameTime, resolveTimeSystem, setGameTimeClock, sleepGameTimeUntilMorning, timePhaseFor } from "@/project/gameTime";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, type SaveSnapshot } from "@/player/saveSlots";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runTool } from "@/editor/tools";
import { eligibleEncounterEntries } from "@/player/encounters";
import { createTimeDemoProject } from "./fixtures/timeDemo";
import { isGameTimePausedForRuntime, timeTintVisualForPhase } from "@/player/playSceneTime";
import { beginCutsceneControl } from "@/player/cutsceneControl";
import { TIME_TOOLS } from "@/editor/tools/timeTools";
import { isolateTimers } from "./mergedTeardown";

describe("projectSeCues", () => {
  isolateTimers();
  function withCues(cues: Record<string, string>): Project {
    const project = createBlankProject();
    project.system.seCues = cues;
    return project;
  }
  describe("project.system.seCues 자리 표", () => {
    it("시스템 효과음 13자리가 모두 알려진 자리다(스토어 제작자 목록과 같은 id)", () => {
      for (const cue of SYSTEM_SE_CUES) expect(SE_CUE_IDS).toContain(cue);
      for (const cue of ["equip", "save", "load", "bossCollapse", "actorDamage", "cast", "levelUp", "itemGet", "magic-fire", "footstep-grass"]) expect(SE_CUE_IDS).toContain(cue);
    });

    it("모르는 자리 id 도 꼴만 맞으면 저장한다 — 새 스토어 자리에 코드 수정이 필요 없다", () => {
      expect(normalizeSeCues({ "footstep-lava": "snd_a", confirm: " snd_b ", "bad id": "x", empty: "  ", num: 3 })).toEqual({ "footstep-lava": "snd_a", confirm: "snd_b" });
      expect(normalizeSeCues({})).toBeUndefined();
      expect(isSeCueId("magic-fire")).toBe(true);
      expect(isSeCueId("Magic")).toBe(false);
    });

    it("저장 왕복: 정규화가 표를 지키고, 빈 표는 저장하지 않는다(옛 JSON 바이트)", () => {
      const project = createBlankProject();
      project.system.seCues = { save: "snd_save" };
      expect(normalizeSystemRecords(project.system).seCues).toEqual({ save: "snd_save" });
      delete project.system.seCues;
      expect("seCues" in normalizeSystemRecords(project.system)).toBe(false);
      expect(() => validateSystem({ startActorIds: [], seCues: { save: "snd_save" } })).not.toThrow();
      expect(() => validateSystem({ startActorIds: [], seCues: { "not ok": "x" } })).toThrow();
    });

    it("가족 물러섬: magic-<속성> → cast, attack-<종류> → attack", () => {
      expect(seCueFallbacks("magic-fire")).toEqual(["magic-fire", "cast"]);
      expect(seCueFallbacks("attack-blunt")).toEqual(["attack-blunt", "attack"]);
      expect(seCueFallbacks("footstep-snow")).toEqual(["footstep-snow"]);
      expect(projectSeCue(withCues({ cast: "snd_cast" }), "magic-ice")).toBe("snd_cast");
      expect(projectSeCue(withCues({ "magic-ice": "snd_ice", cast: "snd_cast" }), "magic-ice")).toBe("snd_ice");
    });

    it("기술 속성 → 마법 자리, 마력 기술은 cast", () => {
      const project = createBlankProject();
      expect(magicCueForElement("fire")).toBe("magic-fire");
      expect(magicCueForElement("x", "번개")).toBe("magic-thunder");
      expect(skillSeCue(project, { elementId: "ice", effect: { kind: "damage", statistic: "attack", affects: "hp" } })).toBe("magic-ice");
      expect(skillSeCue(project, { effect: { kind: "healing", statistic: "mind", affects: "hp" } })).toBe("cast");
      expect(skillSeCue(project, { effect: { kind: "damage", statistic: "attack", affects: "hp" } })).toBeUndefined();
    });
  });
  describe("전투 사건 → 자리: 세션 덮어쓰기 → 프로젝트 표 → 기본", () => {
    it("프로젝트 표가 기본을 대신하고, 세션 덮어쓰기가 표보다 먼저다", () => {
      const project = withCues({ damage: "snd_hit", critical: "snd_crit" });
      expect(authoredBattleCue("hit-damage", project, undefined)).toEqual({ resourceId: "snd_hit" });
      const session = { systemAudioOverrides: { se: { damage: { resourceId: "snd_session", volume: 80 } } } };
      expect(authoredBattleCue("hit-damage", project, session)).toEqual({ resourceId: "snd_session", volume: 80 });
      expect(authoredBattleCue("hit-miss", project, undefined)).toBeUndefined();
    });

    it("세션 덮어쓰기의 빈 소리는 무음(null)이다", () => {
      const session = { systemAudioOverrides: { se: { damage: { resourceId: "", volume: 100 } } } };
      expect(authoredBattleCue("hit-damage", withCues({ damage: "snd_hit" }), session)).toBeNull();
    });

    it("아군 피해는 actorDamage → damage, 보스 쓰러짐은 bossCollapse → faint 로 물러선다", () => {
      expect(authoredBattleCue("hit-actor", withCues({ damage: "snd_hit" }), undefined)).toEqual({ resourceId: "snd_hit" });
      expect(authoredBattleCue("hit-actor", withCues({ damage: "snd_hit", actorDamage: "snd_ouch" }), undefined)).toEqual({ resourceId: "snd_ouch" });
      expect(authoredBattleCue("boss-collapse", withCues({ faint: "snd_faint" }), undefined)).toEqual({ resourceId: "snd_faint" });
      expect(authoredBattleCue("boss-collapse", withCues({ faint: "snd_faint", bossCollapse: "snd_boss" }), undefined)).toEqual({ resourceId: "snd_boss" });
    });
  });
  describe("메뉴 사건 → 자리", () => {
    it("부른 쪽의 자리(save)가 사건의 기본 자리(confirm)보다 먼저, 없으면 confirm, 그것도 없으면 기본 소리", () => {
      const project = withCues({ save: "snd_save", confirm: "snd_ok" });
      expect(emitRuntimeJuice({ event: "menu-confirm", cue: "save", project }).soundResourceId).toBe("snd_save");
      expect(emitRuntimeJuice({ event: "menu-confirm", cue: "equip", project }).soundResourceId).toBe("snd_ok");
      expect(emitRuntimeJuice({ event: "menu-confirm", cue: "equip", project: createBlankProject() }).soundResourceId).toBe("easyrpg-sound-decision1");
    });

    it("메뉴 열기는 menuOpen 자리를 먼저 본다", () => {
      expect(emitRuntimeJuice({ event: "menu-open", project: withCues({ menuOpen: "snd_open", confirm: "snd_ok" }) }).soundResourceId).toBe("snd_open");
    });
  });
  describe("지형 발소리", () => {
    function steppingProject(terrain: { name: string; footstepSoundResourceId?: string }, cues?: Record<string, string>): Project {
      const project = createBlankProject();
      const map = Object.values(project.maps)[0]!;
      const tileset = project.tilesets[map.tilesetId]!;
      const tile = map.lowerTiles[0]!;
      // 그 칸의 지형 태그 1 = terrains[0]. tileMeta 칸이 이기므로 terrain 배열만 바꾸면 된다(tileMeta 가 있으면 그쪽도).
      const meta = tileset.tileMeta?.[tile];
      if (meta) meta.terrainTag = 1;
      tileset.terrain = [...(tileset.terrain ?? [])];
      tileset.terrain[tile] = 1;
      project.database.terrains = [{ id: "t1", damage: 0, encounterRatePercent: 0, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: false }, ...terrain }];
      if (cues) project.system.seCues = cues;
      return project;
    }

    it("지형 기록의 발소리 → 지형 이름의 footstep 자리 → 없음", () => {
      const at = (p: Project) => ({ mapId: Object.keys(p.maps)[0]!, x: 0, y: 0 });
      const own = steppingProject({ name: "풀밭", footstepSoundResourceId: "snd_own" }, { "footstep-grass": "snd_grass" });
      expect(footstepResourceAt(own, at(own))).toBe("snd_own");
      const named = steppingProject({ name: "풀밭" }, { "footstep-grass": "snd_grass" });
      expect(footstepResourceAt(named, at(named))).toBe("snd_grass");
      const silent = steppingProject({ name: "풀밭" });
      expect(footstepResourceAt(silent, at(silent))).toBeUndefined();
      expect(footstepCueForTerrain("눈 덮인 길")).toBe("footstep-snow");
    });

    it("발소리는 간격 안에 한 번만, 걸린 소리가 없으면 내지 않는다", () => {
      resetFootstepClock();
      const project = steppingProject({ name: "돌길", footstepSoundResourceId: "snd_step" });
      const at = { mapId: Object.keys(project.maps)[0]!, x: 0, y: 0 };
      expect(playFootstep(project, at, 1000)).toBe(true);
      expect(playFootstep(project, at, 1000 + FOOTSTEP_MIN_INTERVAL_MS - 1)).toBe(false);
      expect(playFootstep(project, at, 1000 + FOOTSTEP_MIN_INTERVAL_MS)).toBe(true);
      resetFootstepClock();
      expect(playFootstep(steppingProject({ name: "돌길" }), at, 5000)).toBe(false);
    });
  });
});

describe("timeSystem", () => {
  isolateTimers();
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
});
