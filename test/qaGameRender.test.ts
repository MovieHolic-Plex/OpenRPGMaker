import { describe, expect, it, vi } from "vitest";
import { checkHorror, chaserStepMs } from "@/qa/gameCheck/horror";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { deserialize, serialize } from "@/project/io";
import { advanceRoguelikeRunFloor, resetRoguelikeRunRoom, startRoguelikeRun } from "@/project/roguelikeRun";
import { resolveRoguelikeRoomFieldSpawns, roguelikeRoomGenerationKey, syncRoguelikeRoomEventGeneration } from "@/project/roguelikeRooms";
import { createFieldSpawnRuntime, fieldSpawnRuntimeNeedsRefresh, resolveFieldSpawnVictory } from "@/player/fieldSpawns";
import { syncActionEnemiesForScene } from "@/player/playSceneActionCombat";
import { refreshRoguelikeRoomForScene } from "@/player/playSceneFieldSpawns";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { toOpenAiTools } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools/types";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { isolateTimers } from "./mergedTeardown";

// 추격 호러 검사(qa gameCheck/horror) — 2026-09-24 「잿빛 저택의 술래」 도그푸딩 결함을 데이터로 잡는다.
describe("qaGameCheckHorror", () => {
  isolateTimers();
  const BRIEF = "직접 쫓아오는 존재. 옷장에 숨으면 놓친다. 어둡고 긴장감 있게. 금고 암호 4자리.";
  function horrorProject() {
    const ctx = { project: createBlankProject() };
    ctx.project.system.genre = "horror-chase";
    return ctx;
  }
  describe("qa gameCheck — 추격 호러", () => {
    it("추격자 한 칸 시간은 걸음 트윈 + 이동 간격이다", () => {
      // #3231 이 걸음 속도표(characterMotion.ts)를 다시 잡았다 — 속도 3 트윈이 짧아져 960 → 880.
      expect(chaserStepMs({ type: "chase", speed: 3, frequency: 3 })).toBe(880);
      expect(chaserStepMs({ type: "chase", speed: 6, frequency: 8 })).toBe(240);
    });

    it("느린 추격자·가짜 은신·정답 누설·밝은 조명을 짚는다", () => {
      const ctx = horrorProject();
      const mapId = ctx.project.startMapId;
      ctx.project.startPos = { x: 1, y: 1 };
      const chase = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_oni", x: 8, y: 8, pages: [{
        conditions: [], trigger: { kind: "eventTouch" }, graphic: {}, movement: { type: "chase", speed: 3, frequency: 3, sightRange: 12 },
        commands: [{ kind: "killPlayer", message: "붙잡혔다." }] }] } });
      expect(chase.ok, chase.summary).toBe(true);
      const closet = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_closet", x: 3, y: 3, pages: [{
        conditions: [], trigger: { kind: "action" }, graphic: { transparent: true },
        commands: [{ kind: "choices", options: [{ text: "옷장에 숨는다", branch: [{ kind: "text", body: "숨었다" }] }, { text: "[ 7 4 1 9 ] (쪽지의 암호)", branch: [] }] }] }] } });
      expect(closet.ok, closet.summary).toBe(true);
      const codes = checkHorror(ctx.project, BRIEF).map((finding) => finding.code);
      expect(codes).toEqual(expect.arrayContaining(["chaser-too-slow", "horror-no-hiding", "choice-answer-leak", "horror-not-dark", "capture-no-retry", "code-as-choices"]));
      expect(codes).not.toContain("chaser-cannot-reach");
    });

    it("make_chase_scene 으로 만든 추격(속도 6·은신처·체크포인트)은 속도·은신 지적이 없고 실제로 붙잡는다", () => {
      const ctx = horrorProject();
      const mapId = ctx.project.startMapId;
      ctx.project.startPos = { x: 1, y: 1 };
      const result = runTool(ctx, "make_chase_scene", {
        mapId, chaser: { at: { x: 10, y: 8 }, graphic: { query: "monster" }, speed: 6, sightRange: 20 },
        killOnTouch: true, checkpointOnEntry: true, hidingSpots: [{ x: 3, y: 3 }],
      });
      expect(result.ok, result.summary).toBe(true);
      const codes = checkHorror(ctx.project, BRIEF).map((finding) => finding.code);
      expect(codes).not.toContain("chaser-too-slow");
      expect(codes).not.toContain("horror-no-hiding");
      expect(codes).not.toContain("chaser-never-catches");
      expect(codes).not.toContain("capture-no-retry");
    });
  });
  describe("run_scene_test — 은신처", () => {
    async function scene(hide: boolean) {
      const { runSceneTest } = await import("@/testing/sceneTestRunner");
      const ctx = horrorProject();
      const mapId = ctx.project.startMapId;
      const made = runTool(ctx, "make_chase_scene", {
        mapId, chaser: { at: { x: 12, y: 5 }, graphic: { query: "monster" }, speed: 6, sightRange: 3 },
        pursuit: { scope: "map", doorDelayMs: 0, searchMs: 2000, onLost: "return" },
        activateSwitch: "sw_oni_awake", killOnTouch: true, hidingSpots: [{ x: 3, y: 4 }],
      });
      expect(made.ok, made.summary).toBe(true);
      return runSceneTest(ctx.project, { mapId, start: { x: 3, y: 5 }, steps: [
        { kind: "set", switches: { sw_oni_awake: true }, facing: "up" },
        ...(hide ? [{ kind: "interact" } as const] : []),
        { kind: "wait", ticks: 600 },
        { kind: "expect", gameOver: !hide },
        ...(hide ? [{ kind: "move", dir: "down" } as const] : []),
      ] });
    }
    it("스위치로 깨운 추격자는 시야 밖에서도 달려와 붙잡는다", async () => {
      const exposed = await scene(false);
      expect(exposed.ok, exposed.failureReason).toBe(true);
    });
    it("보이지 않을 때 옷장에 숨으면 붙잡히지 않고, 숨은 채로는 못 움직인다", async () => {
      const hidden = await scene(true);
      expect(hidden.finalState.gameOver).toBe(false);
      expect(hidden.failureReason).toContain("숨어 있는 동안에는 움직일 수 없습니다");
    });
  });
  describe("안전지대·깨우는 스위치", () => {
    it("맵을 덮는 안전지대와 아무도 켜지 않는 추격 스위치를 도구와 검사가 알린다", () => {
      const ctx = horrorProject();
      const mapId = ctx.project.startMapId;
      const map = ctx.project.maps[mapId]!;
      const result = runTool(ctx, "make_chase_scene", {
        mapId, chaser: { at: { x: 5, y: 5 }, graphic: { query: "monster" }, speed: 6 }, killOnTouch: true,
        safeZone: { x: 0, y: 0, w: map.width, h: map.height - 2 }, activateSwitch: "sw_never_on",
      });
      expect(result.ok, result.summary).toBe(true);
      const warnings = (result.diff?.warnings ?? []).join(" ");
      expect(warnings).toContain("안전지대가 맵의");
      expect(warnings).toContain("sw_never_on");
      const codes = checkHorror(ctx.project, BRIEF).map((finding) => finding.code);
      expect(codes).toEqual(expect.arrayContaining(["safe-zone-too-large", "chaser-never-wakes"]));
    });
  });
  describe("체크포인트 재시작과 추격자", () => {
    it("붙잡힌 뒤 재시작하면 추격자가 제자리로 돌아가 바로 다시 잡히지 않는다", async () => {
      const { runSceneTest } = await import("@/testing/sceneTestRunner");
      const ctx = horrorProject();
      const mapId = ctx.project.startMapId;
      const made = runTool(ctx, "make_chase_scene", {
        mapId, chaser: { at: { x: 14, y: 5 }, graphic: { query: "monster" }, speed: 6, sightRange: 30 },
        pursuit: { scope: "map", doorDelayMs: 0, searchMs: 2000, onLost: "return", tracking: "persistent" },
        activateSwitch: "sw_awake", killOnTouch: true,
      });
      expect(made.ok, made.summary).toBe(true);
      ctx.project.session.switches = { ...(ctx.project.session.switches ?? {}), sw_awake: true };
      const result = runSceneTest(ctx.project, { mapId, start: { x: 3, y: 5 }, steps: [
        { kind: "wait", ticks: 30 },
        { kind: "wait", ticks: 400 },
        { kind: "expect", gameOver: true },
        { kind: "retryCheckpoint" },
        { kind: "wait", ticks: 60 },
        { kind: "expect", gameOver: false },
      ] });
      expect(result.ok, result.failureReason).toBe(true);
    });
  });
  describe("암호 선택지와 가짜 은신", () => {
    it("암호 숫자를 선택지로 내거나 추격 스위치를 끄면 짚고, choice4 취소는 허용한다", async () => {
      const { runGameCheck } = await import("@/qa/gameCheck");
      const ctx = horrorProject();
      const mapId = ctx.project.startMapId;
      const made = runTool(ctx, "make_chase_scene", {
        mapId, chaser: { at: { x: 8, y: 5 }, graphic: { query: "monster" }, speed: 6 },
        activateSwitch: "sw_chase", killOnTouch: true, mood: false,
      });
      expect(made.ok, made.summary).toBe(true);
      const vault = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_vault", x: 3, y: 3, pages: [{
        conditions: [], trigger: { kind: "action" }, commands: [
          { kind: "choices", cancelBehavior: "choice4", options: [
            { text: "4729", branch: [{ kind: "setSwitch", switchId: "sw_chase", value: false }] },
            { text: "그만둔다", branch: [{ kind: "text", body: "물러선다." }] },
          ] },
        ],
      }] } });
      expect(vault.ok, vault.summary).toBe(true);
      const codes = checkHorror(ctx.project, BRIEF).map((finding) => finding.code);
      expect(codes).toContain("code-choice-is-answer");
      expect(codes).toContain("chase-switch-cleared");
      const report = runGameCheck(ctx.project, { skipAutoPlay: true, briefText: BRIEF });
      expect(report.findings.map((finding) => finding.code)).not.toContain("command-invalid-enum");
    });
  });
  describe("공포 추격 맵 조명", () => {
    it("공포 장르 추격 맵은 조명이 없으면 어두워지고, mood:false 면 그대로다", () => {
      const ctx = horrorProject();
      const mapId = ctx.project.startMapId;
      const made = runTool(ctx, "make_chase_scene", { mapId, chaser: { at: { x: 5, y: 5 }, graphic: { query: "monster" } }, killOnTouch: true });
      expect(made.ok, made.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.defaultLighting?.ambient).toBe(0.5);
      expect(checkHorror(ctx.project, BRIEF).map((f) => f.code)).not.toContain("horror-not-dark");
      const other = horrorProject();
      runTool(other, "make_chase_scene", { mapId: other.project.startMapId, chaser: { at: { x: 5, y: 5 }, graphic: { query: "monster" } }, mood: false });
      expect(other.project.maps[other.project.startMapId]!.defaultLighting).toBeUndefined();
    });
  });
});

describe("roguelikeRooms", () => {
  isolateTimers();
  function configuredRoom(): { map: GameMap; troopId: string } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const troopId = project.database.troops[0]?.id;
    if (!map || !troopId) throw new Error("fixture missing");
    map.fieldSpawns = [
      { id: "base", troopId, area: { x: 5, y: 5, w: 1, h: 1 }, maxAlive: 1 },
      { id: "spawn_a", troopId, area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1 },
      { id: "spawn_b", troopId, area: { x: 7, y: 5, w: 1, h: 1 }, maxAlive: 1 },
    ];
    map.roguelikeRoom = {
      roomId: "room-a",
      encounterSlots: [
        {
          id: "front",
          choices: [
            { fieldSpawnId: "spawn_a", weight: 2 },
            { fieldSpawnId: "spawn_b", weight: 2 },
          ],
        },
      ],
    };
    return { map, troopId };
  }
  describe("roguelike room encounter resolution", () => {
    it("selects stable field-spawn choices from seed, floor, room, and reset count", () => {
      // Break named: resolving every authored field spawn ignores the run seed and cannot vary a room by floor/reset.
      const { map } = configuredRoom();
      const host: { roguelikeRun?: ReturnType<typeof startRoguelikeRun> } = {};
      startRoguelikeRun(host, { seed: 123 });

      expect(resolveRoguelikeRoomFieldSpawns(map, host.roguelikeRun).map((spawn) => spawn.id)).toEqual(["base", "spawn_b"]);
      expect(roguelikeRoomGenerationKey(map, host.roguelikeRun)).toBe("run-0000007b:123:1:room-a:0");

      advanceRoguelikeRunFloor(host);
      expect(resolveRoguelikeRoomFieldSpawns(map, host.roguelikeRun).map((spawn) => spawn.id)).toEqual(["base", "spawn_a"]);

      host.roguelikeRun!.floor = 1;
      resetRoguelikeRunRoom(host, "room-a");
      expect(resolveRoguelikeRoomFieldSpawns(map, host.roguelikeRun).map((spawn) => spawn.id)).toEqual(["base", "spawn_a"]);
    });

    it("marks the live field runtime stale and rebuilds the selected encounter after a reset", () => {
      // Break named: resetRoom increments a counter but the field runtime never consumes it, so defeated enemies stay gone.
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map missing");
      Object.assign(map, configuredRoom().map);
      const session = { roguelikeRun: undefined as ReturnType<typeof startRoguelikeRun> | undefined };
      startRoguelikeRun(session, { seed: 123 });

      const first = createFieldSpawnRuntime(project, map, { x: 1, y: 1 }, undefined, session.roguelikeRun);
      expect(first.entries.map((entry) => entry.spawn.id)).toEqual(["base", "spawn_b"]);
      const defeated = first.entries.find((entry) => entry.spawn.id === "spawn_b")?.alive[0]?.eventId;
      expect(defeated).toBeDefined();
      resolveFieldSpawnVictory(first, defeated ?? "");

      resetRoguelikeRunRoom(session, "room-a");
      expect(fieldSpawnRuntimeNeedsRefresh(first, map, session.roguelikeRun)).toBe(true);
      const reset = createFieldSpawnRuntime(project, map, { x: 1, y: 1 }, undefined, session.roguelikeRun);
      expect(reset.entries.map((entry) => entry.spawn.id)).toEqual(["base", "spawn_a"]);
      expect(reset.entries.find((entry) => entry.spawn.id === "spawn_a")?.alive).toHaveLength(1);
    });

    it("treats starting the same seeded run again as a fresh room generation", () => {
      // Break named: a restart with the same derived runId/seed/floor has an identical string key and leaves defeated enemies dead.
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map missing");
      Object.assign(map, configuredRoom().map);
      const session = { roguelikeRun: undefined as ReturnType<typeof startRoguelikeRun> | undefined };
      startRoguelikeRun(session, { seed: 123 });
      const first = createFieldSpawnRuntime(project, map, { x: 1, y: 1 }, undefined, session.roguelikeRun);

      startRoguelikeRun(session, { seed: 123 });

      expect(roguelikeRoomGenerationKey(map, session.roguelikeRun)).toBe(first.roguelikeGenerationKey);
      expect(fieldSpawnRuntimeNeedsRefresh(first, map, session.roguelikeRun)).toBe(true);
    });
  });
  describe("roguelike room runtime and authoring integration", () => {
    it("restores one-shot loot events and their self switches for a new room generation", () => {
      // Break named: resetRoom rebuilds field enemies but leaves Erase Event/self-switch state behind, so room loot cannot respawn.
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const itemId = project.database.items[0]?.id;
      if (!map || !itemId) throw new Error("fixture missing");
      map.roguelikeRoom = { roomId: "room-a" };
      map.events.push(
        {
          id: "run_console",
          x: 1,
          y: 2,
          trigger: { kind: "action" },
          commands: [{
            kind: "fork",
            condition: { kind: "run", query: "active", value: true },
            then: [{ kind: "runControl", action: "resetRoom" }],
            else: [{ kind: "runControl", action: "start", seed: 123 }],
          }],
        },
        {
          id: "room_loot",
          x: 2,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          pages: [{
            id: "room_loot_available",
            name: "available",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [
              { kind: "changeItem", itemId, op: "+=", amount: 1 },
              { kind: "setSelfSwitch", key: "A", value: true },
              { kind: "eraseEvent" },
            ],
          }, {
            id: "room_loot_taken",
            name: "taken",
            conditions: [{ kind: "selfSwitch", key: "A", value: true }],
            graphic: { transparent: true },
            trigger: { kind: "action" },
            priority: "below",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          }],
        },
      );

      const result = runSceneTest(project, {
        mapId: map.id,
        start: { x: 1, y: 1 },
        steps: [
          { kind: "face", dir: "down" },
          { kind: "interact" },
          { kind: "face", dir: "right" },
          { kind: "interact" },
          { kind: "expect", inventoryCount: { itemId, count: 1 } },
          { kind: "face", dir: "down" },
          { kind: "interact" },
          { kind: "face", dir: "right" },
          { kind: "interact" },
          { kind: "expect", inventoryCount: { itemId, count: 2 } },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
      expect(result.log.filter((line) => line === "event room_loot start")).toHaveLength(2);
      expect(result.session.selfSwitches?.room_loot?.A).toBe(true);
    });

    it("persists the current event generation so loading mid-room keeps consumed loot consumed", () => {
      // Break named: if the generation marker is runtime-only, loading a save clears the room's one-shot state a second time.
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map missing");
      map.roguelikeRoom = { roomId: "room-a" };
      map.events.push({ id: "room_loot", x: 2, y: 1, trigger: { kind: "action" }, commands: [] });
      const session = startSession(project);
      startRoguelikeRun(session, { seed: 123 });

      expect(syncRoguelikeRoomEventGeneration(map, session)).toBe(true);
      session.selfSwitches.room_loot = { A: true };
      session.erasedEventIds.push("room_loot");

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));

      expect(syncRoguelikeRoomEventGeneration(map, restored)).toBe(false);
      expect(restored.selfSwitches.room_loot?.A).toBe(true);
      expect(restored.erasedEventIds).toContain("room_loot");

      resetRoguelikeRunRoom(restored, "room-a");
      expect(syncRoguelikeRoomEventGeneration(map, restored)).toBe(true);
      expect(restored.selfSwitches.room_loot).toBeUndefined();
      expect(restored.erasedEventIds).not.toContain("room_loot");
    });

    it("allows authored rooms to retain event state across generations", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map missing");
      map.roguelikeRoom = { roomId: "room-a", resetEventState: false };
      map.events.push({ id: "story_event", x: 2, y: 1, trigger: { kind: "action" }, commands: [] });
      const session = startSession(project);
      session.selfSwitches.story_event = { A: true };
      session.erasedEventIds.push("story_event");
      startRoguelikeRun(session, { seed: 123 });

      expect(syncRoguelikeRoomEventGeneration(map, session)).toBe(false);
      expect(session.selfSwitches.story_event?.A).toBe(true);
      expect(session.erasedEventIds).toContain("story_event");
      expect(session.roguelikeRun?.roomEventGenerationKeys).toEqual({});
    });

    it("rebuilds live event runtime surfaces when the room generation changes", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map missing");
      map.roguelikeRoom = { roomId: "room-a" };
      map.events.push({ id: "room_loot", x: 2, y: 1, trigger: { kind: "action" }, commands: [] });
      const session = startSession(project);
      startRoguelikeRun(session, { seed: 123 });
      syncRoguelikeRoomEventGeneration(map, session);
      session.selfSwitches.room_loot = { A: true };
      session.erasedEventIds.push("room_loot");
      const fieldSpawnState = createFieldSpawnRuntime(project, map, { x: 1, y: 1 }, undefined, session.roguelikeRun);
      resetRoguelikeRunRoom(session, "room-a");
      store.replace(project);
      const scene = {
        session,
        map,
        fieldSpawnState,
        tileX: 1,
        tileY: 1,
        eventPositions: { room_loot: { x: 7, y: 7 } },
        parallelProcesses: new Map([["room_loot:page", {}]]),
        autoStartedKeys: new Set([`${map.id}:room_loot:page`]),
        pageMoveRouteKeys: new Set(["room_loot:page"]),
        pageMoveRouteEventIds: new Set(["room_loot"]),
        commandMoveRouteEventIds: new Set(["room_loot"]),
        eventGraphicPatternOverrides: new Map([["room_loot", 3]]),
        autonomousNPCs: new Map([["room_loot", {}]]),
        renderTiles: vi.fn(),
        registerPageMoveRoutes: vi.fn(),
      };

      expect(refreshRoguelikeRoomForScene(scene as never)).toBe(true);
      expect(scene.eventPositions.room_loot).toEqual({ x: 2, y: 1 });
      expect(session.selfSwitches.room_loot).toBeUndefined();
      expect(session.erasedEventIds).not.toContain("room_loot");
      expect(scene.parallelProcesses.size).toBe(0);
      expect(scene.autoStartedKeys.size).toBe(0);
      expect(scene.eventGraphicPatternOverrides.size).toBe(0);
      expect(scene.renderTiles).toHaveBeenCalledOnce();
      expect(scene.registerPageMoveRoutes).toHaveBeenCalledOnce();
    });

    it("run_scene_test consumes resetRoom and respawns a defeated field encounter", () => {
      // Break named: the headless/real field loops do not observe room generations after an event mutates the run.
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const troopId = project.database.troops[0]?.id;
      if (!map || !troopId) throw new Error("fixture missing");
      map.fieldSpawns = [{
        id: "room_enemy",
        troopId,
        area: { x: 2, y: 1, w: 1, h: 1 },
        maxAlive: 1,
        respawnSec: 999,
        persistKill: true,
      }];
      map.roguelikeRoom = {
        roomId: "room-a",
        encounterSlots: [{ id: "enemy", choices: [{ fieldSpawnId: "room_enemy", weight: 1 }] }],
      };
      map.events.push({
        id: "run_console",
        x: 1,
        y: 2,
        trigger: { kind: "action" },
        commands: [{
          kind: "fork",
          condition: { kind: "run", query: "active", value: true },
          then: [{ kind: "runControl", action: "resetRoom" }],
          else: [{ kind: "runControl", action: "start", seed: 123 }],
        }],
      });

      const result = runSceneTest(project, {
        mapId: map.id,
        start: { x: 1, y: 1 },
        steps: [
          { kind: "interact" },
          { kind: "move", dir: "right" },
          { kind: "expect", fieldSpawnCount: 0 },
          { kind: "face", dir: "down" },
          { kind: "interact" },
          { kind: "expect", fieldSpawnCount: 1 },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
      expect(result.session.roguelikeRun?.roomResetCounts["room-a"]).toBe(1);
      expect(result.session.killedFieldSpawns?.[map.id]?.room_enemy).toBeUndefined();
    });

    it("resets real-time enemy HP and projectiles when the room generation changes", () => {
      // Break named: deterministic field respawn can reuse an event id, leaking the prior action enemy's HP/projectiles.
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const troopId = project.database.troops[0]?.id;
      if (!map || !troopId) throw new Error("fixture missing");
      map.fieldSpawns = [{ id: "room_enemy", troopId, area: { x: 2, y: 1, w: 1, h: 1 }, maxAlive: 1 }];
      map.roguelikeRoom = {
        roomId: "room-a",
        encounterSlots: [{ id: "enemy", choices: [{ fieldSpawnId: "room_enemy" }] }],
      };
      const session = { roguelikeRun: undefined as ReturnType<typeof startRoguelikeRun> | undefined };
      startRoguelikeRun(session, { seed: 123 });
      const first = createFieldSpawnRuntime(project, map, { x: 1, y: 1 }, undefined, session.roguelikeRun);
      const eventId = first.entries[0]?.alive[0]?.eventId;
      if (!eventId) throw new Error("spawn missing");
      const projectile = { destroy: vi.fn() };
      const actionState = {
        enemies: new Map([[eventId, {
          eventId,
          hp: 1,
          telegraph: undefined,
          windupTween: undefined,
        }]]),
        projectiles: [{ object: projectile }],
        fieldSpawnRuntime: first,
      };

      resetRoguelikeRunRoom(session, "room-a");
      const reset = createFieldSpawnRuntime(project, map, { x: 1, y: 1 }, undefined, session.roguelikeRun);
      store.replace(project);
      syncActionEnemiesForScene({
        actionCombatState: actionState,
        fieldSpawnState: reset,
        autonomousNPCs: new Map(),
        eventSprites: new Map(),
      } as never);

      expect(projectile.destroy).toHaveBeenCalledOnce();
      expect(actionState.projectiles).toHaveLength(0);
      expect(actionState.fieldSpawnRuntime).toBe(reset);
      expect(actionState.enemies.get(eventId)?.hp).toBeGreaterThan(1);
    });

    it("configure_roguelike_room writes validated slots that survive project serialization", () => {
      // Break named: the AI tool registry has no way to author deterministic room encounter slots.
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const map = context.project.maps[mapId];
      const troopId = context.project.database.troops[0]?.id;
      if (!map || !troopId) throw new Error("fixture missing");
      map.fieldSpawns = [
        { id: "spawn_a", troopId, area: { x: 1, y: 1, w: 1, h: 1 } },
        { id: "spawn_b", troopId, area: { x: 2, y: 1, w: 1, h: 1 } },
      ];

      const configured = runTool(context, "configure_roguelike_room", {
        mapId,
        roomId: "room-a",
        resetEventState: false,
        slots: [{
          id: "front",
          choices: [
            { fieldSpawnId: "spawn_a", weight: 1, maxFloor: 2 },
            { fieldSpawnId: "spawn_b", weight: 3, minFloor: 3 },
          ],
        }],
      });

      expect(configured.ok, configured.summary).toBe(true);
      expect(context.project.maps[mapId]?.roguelikeRoom).toEqual({
        roomId: "room-a",
        resetEventState: false,
        encounterSlots: [{
          id: "front",
          choices: [
            { fieldSpawnId: "spawn_a", weight: 1, maxFloor: 2 },
            { fieldSpawnId: "spawn_b", weight: 3, minFloor: 3 },
          ],
        }],
      });
      expect(deserialize(serialize(context.project)).maps[mapId]?.roguelikeRoom).toEqual(context.project.maps[mapId]?.roguelikeRoom);

      const policyOnly = runTool(context, "configure_roguelike_room", {
        mapId,
        resetEventState: true,
      });
      expect(policyOnly.ok, policyOnly.summary).toBe(true);
      expect(context.project.maps[mapId]?.roguelikeRoom?.roomId).toBe("room-a");
      expect(context.project.maps[mapId]?.roguelikeRoom?.encounterSlots).toHaveLength(1);
      expect(context.project.maps[mapId]?.roguelikeRoom?.resetEventState).toBe(true);

      const invalid = runTool(context, "configure_roguelike_room", {
        mapId,
        slots: [{ id: "broken", choices: [{ fieldSpawnId: "missing", weight: 1 }] }],
      });
      expect(invalid.ok).toBe(false);
    });

    it("keeps the room authoring tool exposed in map-scoped AI turns", () => {
      const names = toOpenAiTools(undefined, { domains: new Set(["map"]) })
        .map((tool) => tool.function.name);
      expect(names).toContain("make_hunting_ground");
      expect(names).toContain("configure_roguelike_room");
    });

    it("rejects duplicate encounter slot ids at the project import boundary", () => {
      // Break named: hand-edited/imported JSON can bypass the AI tool and make two slots share one seed namespace.
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const troopId = project.database.troops[0]?.id;
      if (!map || !troopId) throw new Error("fixture missing");
      map.fieldSpawns = [{ id: "spawn_a", troopId, area: { x: 1, y: 1, w: 1, h: 1 } }];
      map.roguelikeRoom = {
        encounterSlots: [
          { id: "same", choices: [{ fieldSpawnId: "spawn_a" }] },
          { id: "same", choices: [{ fieldSpawnId: "spawn_a" }] },
        ],
      };

      expect(() => deserialize(serialize(project))).toThrow(/encounterSlots.*중복/);
    });
  });
});

describe("showMapRegion", () => {
  isolateTimers();
  type ShowMapRegionData = {
    readonly h: number;
    readonly lower: readonly (readonly number[])[];
    readonly mapId: string;
    readonly upper: readonly (readonly number[])[];
    readonly w: number;
    readonly x: number;
    readonly y: number;
  };
  function showMapRegionData(value: unknown): ShowMapRegionData {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("show_map_region data must be an object");
    const lower = Reflect.get(value, "lower");
    const upper = Reflect.get(value, "upper");
    if (!Array.isArray(lower) || !lower.every(Array.isArray)) throw new Error("show_map_region lower grid mismatch");
    if (!Array.isArray(upper) || !upper.every(Array.isArray)) throw new Error("show_map_region upper grid mismatch");
    const data = {
      h: Reflect.get(value, "h"),
      lower,
      mapId: Reflect.get(value, "mapId"),
      upper,
      w: Reflect.get(value, "w"),
      x: Reflect.get(value, "x"),
      y: Reflect.get(value, "y"),
    };
    if (
      typeof data.mapId !== "string"
      || !Number.isInteger(data.x)
      || !Number.isInteger(data.y)
      || !Number.isInteger(data.w)
      || !Number.isInteger(data.h)
    ) {
      throw new Error("show_map_region scalar fields mismatch");
    }
    return data;
  }
  describe("show_map_region", () => {
    it("returns clamped lower and upper 2D tile arrays", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      map.width = 4;
      map.height = 3;
      map.tilesetId = COMBINED_TOWN_TILESET_ID;
      map.lowerTiles = [
        0, 1, 2, 3,
        10, 11, 12, 13,
        20, 21, 22, 23,
      ];
      map.upperTiles = [
        TILE.EMPTY, 101, 102, 103,
        110, 111, 112, 113,
        120, 121, 122, 123,
      ];

      const result = runTool({ project }, "show_map_region", { h: 4, mapId: map.id, w: 4, x: 2, y: 1 });

      expect(result.ok, result.summary).toBe(true);
      const data = showMapRegionData(result.data);
      expect(data).toMatchObject({ h: 2, mapId: map.id, w: 2, x: 2, y: 1 });
      expect(data.lower).toEqual([
        [12, 13],
        [22, 23],
      ]);
      expect(data.upper).toEqual([
        [112, 113],
        [122, 123],
      ]);
    });

    it("lets the image renderer accept show_map_region data in fakeDom", async () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      const result = runTool({ project }, "show_map_region", { h: 1, mapId: map.id, w: 1, x: 0, y: 0 });
      expect(result.ok, result.summary).toBe(true);

      const images = await renderToolImages(project, "show_map_region", result.data);

      expect(images).toEqual([]);
    });
  });
});

// 없는 전투 애니메이션 id 는 비우고 경고 — 커밋 거부·연쇄 거부를 하지 않는다(2026-09-24 JRPG 도그푸딩).
describe("skillUnknownAnimation", () => {
  isolateTimers();
  describe("upsert_skill/upsert_class 의 없는 animationId", () => {
    it("스킬을 저장하고 animationId 를 비우며 후보를 알린다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_skill", { skill: { id: "skill_heavy_strike", name: "강타", power: 30, animationId: "anim_slash" } }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.database.skills.find((skill) => skill.id === "skill_heavy_strike")?.animationId).toBeUndefined();
      expect(JSON.stringify(result.diff?.warnings)).toContain("anim_slash");
      const klass = ctx.project.database.classes[0]!;
      const cls = runTool(ctx, "upsert_class", { class: { id: klass.id, animationId: "anim_nope", learnedSkills: [{ level: 1, skillId: "skill_heavy_strike" }] } }, { dryRun: false });
      expect(cls.ok, cls.summary).toBe(true);
    });
  });
});

// 2026-09-24 연애 4회차: 마을을 시작 맵에 짓고 시작을 새 기숙사로 옮긴 뒤 잇지 않아 마을 전체가 플레이에서 빠졌다.
describe("startMoveOrphan", () => {
  isolateTimers();
  describe("set_start_position 이 내용 있는 이전 시작 맵을 고아로 만든다", () => {
    it("닿지 않으면 경고하고, 이어져 있으면 말하지 않는다", () => {
      const ctx = { project: createBlankProject() };
      const town = ctx.project.startMapId;
      expect(runTool(ctx, "upsert_event", { mapId: town, event: { id: "ev_a", x: 2, y: 2, pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands: [{ kind: "text", body: "마을 주민" }] }] } }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_dorm", name: "기숙사", width: 12, height: 10 }).ok).toBe(true);
      const moved = runTool(ctx, "set_start_position", { mapId: "map_dorm", x: 5, y: 5 });
      expect(moved.ok, moved.summary).toBe(true);
      expect((moved.diff?.warnings ?? moved.warnings ?? []).join(" ")).toContain("닿지 않습니다");
      expect(runTool(ctx, "upsert_event", { mapId: "map_dorm", event: { id: "ev_door", x: 5, y: 8, pages: [{ trigger: { kind: "playerTouch" }, graphic: { transparent: true }, commands: [{ kind: "transfer", mapId: town, x: 3, y: 3 }] }] } }).ok).toBe(true);
      const again = runTool(ctx, "set_start_position", { mapId: "map_dorm", x: 5, y: 4 });
      expect((again.diff?.warnings ?? again.warnings ?? []).join(" ")).not.toContain("닿지 않습니다");
    });
  });
});
