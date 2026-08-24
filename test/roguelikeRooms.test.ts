import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { deserialize, serialize } from "@/project/io";
import {
  advanceRoguelikeRunFloor,
  resetRoguelikeRunRoom,
  startRoguelikeRun,
} from "@/project/roguelikeRun";
import {
  resolveRoguelikeRoomFieldSpawns,
  roguelikeRoomGenerationKey,
} from "@/project/roguelikeRooms";
import {
  createFieldSpawnRuntime,
  fieldSpawnRuntimeNeedsRefresh,
  resolveFieldSpawnVictory,
} from "@/player/fieldSpawns";
import { syncActionEnemiesForScene } from "@/player/playSceneActionCombat";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runTool } from "@/editor/tools/toolRunner";
import { toOpenAiTools } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";

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
      encounterSlots: [{
        id: "front",
        choices: [
          { fieldSpawnId: "spawn_a", weight: 1, maxFloor: 2 },
          { fieldSpawnId: "spawn_b", weight: 3, minFloor: 3 },
        ],
      }],
    });
    expect(deserialize(serialize(context.project)).maps[mapId]?.roguelikeRoom).toEqual(context.project.maps[mapId]?.roguelikeRoom);

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
