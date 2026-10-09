import { describe, expect, it } from "vitest";
import { normalizeActionSkillProfile, resolveActionCombatConfig } from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import {
  addFieldSpawnEntry,
  createFieldSpawnRuntime,
  removeFieldSpawnEntry,
  resolveFieldSpawnVictory,
  syncFieldSpawnEventsIntoMap,
} from "@/player/fieldSpawns";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState"
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { EventPage, GameEvent } from "@/project/types";

function blankWithMap() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  store.replace(project);
  return { project, map };
}

describe("탄약(itemCost) — 노비하자 블로커 1", () => {
  it("normalize keeps itemCost and clamps amount", () => {
    const profile = normalizeActionSkillProfile({ kind: "projectile", damage: 5, range: 8, itemCost: { itemId: "item_9mm", amount: 0 } });
    expect(profile?.itemCost).toEqual({ itemId: "item_9mm", amount: 1 });
    const over = normalizeActionSkillProfile({ kind: "projectile", damage: 5, range: 8, itemCost: { itemId: "item_9mm", amount: 500 } });
    expect(over?.itemCost?.amount).toBe(99);
  });

  it("normalize drops itemCost without itemId", () => {
    const profile = normalizeActionSkillProfile({ kind: "projectile", damage: 5, range: 8, itemCost: { itemId: "", amount: 1 } });
    expect(profile?.itemCost).toBeUndefined();
  });
});

describe("영구 처치(persistKill) — 노비하자 블로커 3", () => {
  it("persistKill victory skips respawn and counts persistedDead", () => {
    const { project, map } = blankWithMap();
    const troopId = project.database.troops[0]!.id;
    map.fieldSpawns = [
      { id: "spawn_persist", troopId, area: { x: 1, y: 1, w: 4, h: 4 }, maxAlive: 2, respawnSec: 5, chase: true, persistKill: true },
    ];
    const state = createFieldSpawnRuntime(project, map, { x: 10, y: 10 });
    expect(state.entries[0]?.alive.length).toBe(2);

    const firstId = state.entries[0]!.alive[0]!.eventId;
    const spawn = resolveFieldSpawnVictory(state, firstId);
    expect(spawn?.persistKill).toBe(true);
    expect(state.entries[0]?.persistedDead).toBe(1);
    expect(state.entries[0]?.respawnTimersMs.length).toBe(0);

    // 두 번째 처치로 상한 도달 → 더 이상 배치되지 않는다.
    const secondId = state.entries[0]!.alive[0]!.eventId;
    resolveFieldSpawnVictory(state, secondId);
    expect(state.entries[0]?.persistedDead).toBe(2);
  });

  it("killedCounts reduce initial placement on map re-entry", () => {
    const { project, map } = blankWithMap();
    const troopId = project.database.troops[0]!.id;
    map.fieldSpawns = [
      { id: "spawn_persist", troopId, area: { x: 1, y: 1, w: 4, h: 4 }, maxAlive: 2, respawnSec: 5, chase: true, persistKill: true },
    ];
    const fresh = createFieldSpawnRuntime(project, map, { x: 10, y: 10 }, { spawn_persist: 2 });
    expect(fresh.entries[0]?.alive.length).toBe(0);
    const partial = createFieldSpawnRuntime(project, map, { x: 10, y: 10 }, { spawn_persist: 1 });
    expect(partial.entries[0]?.alive.length).toBe(1);
  });

  it("killedFieldSpawns survive a save snapshot roundtrip", () => {
    const { project } = blankWithMap();
    const session = startSession(project);
    session.killedFieldSpawns = { [project.startMapId]: { spawn_persist: 2 } };
    session.m2Runtime = { ...session.m2Runtime, access: { save: false } } as never;
    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.killedFieldSpawns?.[project.startMapId]?.spawn_persist).toBe(2);
    expect(restored.m2Runtime?.access?.save).toBe(false);
  });
});

describe("동적 스폰(spawnFieldEnemy/despawnFieldEnemy)", () => {
  it("adds and removes a runtime spawn entry", () => {
    const { project, map } = blankWithMap();
    const state = createFieldSpawnRuntime(project, map, { x: 10, y: 10 });
    expect(state.entries.length).toBe(0);
    const troopId = project.database.troops[0]!.id;
    addFieldSpawnEntry(state, project, map, { id: "spawn_ambush", troopId, area: { x: 2, y: 2, w: 3, h: 3 }, maxAlive: 1, chase: true }, { x: 10, y: 10 });
    expect(state.entries.length).toBe(1);
    expect(state.entries[0]?.alive.length).toBe(1);
    addFieldSpawnEntry(state, project, map, { id: "spawn_ambush", troopId, area: { x: 2, y: 2, w: 3, h: 3 }, maxAlive: 1, chase: true }, { x: 10, y: 10 });
    expect(state.entries.length).toBe(1);
    removeFieldSpawnEntry(state, "spawn_ambush");
    expect(state.entries.length).toBe(0);
  });

  it("validates the new command kinds", () => {
    const validate = (command: unknown) => validateCommandArray("cmd", [command]);
    expect(() =>
      validate({ kind: "spawnFieldEnemy", spawn: { id: "s1", troopId: "t1", area: { x: 0, y: 0, w: 2, h: 2 } } })
    ).not.toThrow();
    expect(() => validate({ kind: "despawnFieldEnemy", spawnId: "s1" })).not.toThrow();
    expect(() => validate({ kind: "openSaveMenu" })).not.toThrow();
    expect(() => validate({ kind: "spawnFieldEnemy", spawn: { id: "s1" } })).toThrow();
    expect(() => validate({ kind: "despawnFieldEnemy" })).toThrow();
  });
});

describe("타자기 세이브(Change Save Access + openSaveMenu)", () => {
  it("hides the save menu entry when access.save is false", () => {
    const { project } = blankWithMap();
    const session = startSession(project);
    expect(listStatusMenuCommandIds(project, session)).toContain("save");
    session.m2Runtime = { ...session.m2Runtime, access: { save: false } } as never;
    expect(listStatusMenuCommandIds(project, session)).not.toContain("save");
  });
});

describe("좀비 군집 — 노비하자 블로커 2", () => {
  function chaseScene() {
    const { project, map } = blankWithMap();
    const chasePage = (id: string): EventPage => ({
      id,
      name: id,
      conditions: [],
      graphic: {},
      trigger: { kind: "eventTouch" },
      priority: "same",
      overlapForbidden: true,
      animationType: "normal",
      movement: { type: "chase", speed: 5, frequency: 6, sightRange: 12, giveUpRange: 18, pathfind: true },
      commands: [],
    });
    const events: GameEvent[] = [
      { id: "z1", x: 2, y: 2, trigger: { kind: "eventTouch" }, commands: [], pages: [chasePage("z1_page")] },
      { id: "z2", x: 2, y: 3, trigger: { kind: "eventTouch" }, commands: [], pages: [chasePage("z2_page")] },
      { id: "z3", x: 3, y: 2, trigger: { kind: "eventTouch" }, commands: [], pages: [chasePage("z3_page")] },
    ];
    map.events = events;
    let scene: Parameters<typeof registerPageMoveRoutes>[0];
    scene = {
      map,
      session: startSession(project),
      eventPositions: initialRuntimeEventPositions(map.events),
      pageMoveRouteKeys: new Set(),
      pageMoveRouteEventIds: new Set(),
      autonomousNPCs: new Map(),
      registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
    };
    registerPageMoveRoutes(scene);
    const runtimeScene = {
      ...scene,
      tileX: 6,
      tileY: 2,
      moving: false,
      movingTo: { x: 6, y: 2 },
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    return { scene, runtimeScene };
  }

  it("chasers never stack on one tile while converging on the player", () => {
    const { scene, runtimeScene } = chaseScene();
    for (let tick = 0; tick < 40; tick += 1) {
      updateAutonomousNPCs(runtimeScene, 100);
      const occupied = Object.entries(scene.eventPositions).map(([id, pos]) => `${pos.x},${pos.y}:${id}`);
      const tiles = occupied.map((entry) => entry.split(":")[0]);
      expect(new Set(tiles).size).toBe(tiles.length);
    }
    // 플레이어에게 수렴했는지(군집이 실제로 움직였는지) 확인.
    const positions = Object.values(scene.eventPositions);
    expect(positions.some((pos) => Math.abs(pos.x - 6) + Math.abs(pos.y - 2) <= 2)).toBe(true);
  });

  it("wires actionProfile moveIntervalMs/aggroRange into chase instances and movers", () => {
    const { project, map } = blankWithMap();
    const troop = project.database.troops[0]!;
    const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0];
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) throw new Error("enemy missing");
    enemy.actionProfile = { contactDamage: 2, moveIntervalMs: 900, aggroRange: 6 };
    map.fieldSpawns = [{ id: "spawn_tuned", troopId: troop.id, area: { x: 1, y: 1, w: 3, h: 3 }, maxAlive: 1, chase: true }];
    const state = createFieldSpawnRuntime(project, map, { x: 10, y: 10 });
    const instance = state.entries[0]?.alive[0];
    expect(instance?.sightRange).toBe(6);
    expect(instance?.moveIntervalMs).toBe(900);

    const positions = initialRuntimeEventPositions(map.events);
    syncFieldSpawnEventsIntoMap(map, state, positions);
    let scene: Parameters<typeof registerPageMoveRoutes>[0];
    scene = {
      map,
      session: startSession(project),
      eventPositions: positions,
      pageMoveRouteKeys: new Set(),
      pageMoveRouteEventIds: new Set(),
      autonomousNPCs: new Map(),
      registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
    };
    registerPageMoveRoutes(scene);
    const mover = scene.autonomousNPCs.get(instance!.eventId);
    expect(mover?.moveIntervalMs).toBe(900);
    expect(mover?.sightRange).toBe(6);
  });
});

describe("4방향 이동 옵션", () => {
  it("resolves fourWayMovement from system config", () => {
    const { project } = blankWithMap();
    expect(resolveActionCombatConfig(project).fourWayMovement).toBe(false);
    project.system.actionCombat = { enabled: true, fourWayMovement: true };
    expect(resolveActionCombatConfig(project).fourWayMovement).toBe(true);
  });
});
