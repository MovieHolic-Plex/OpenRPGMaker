import { describe, expect, it } from "vitest";
import { isPassable } from "@/project/collision";
import { ICE_GRAND_EXPANSE_BOSS_EVENT, ICE_GRAND_EXPANSE_GUARDS } from "@/project/defaults/iceGrandExpanseBoss";
import { ICE_GRAND_EXPANSE_CHECKPOINTS } from "@/project/defaults/iceGrandExpanseCheckpoints";
import {
  ICE_GRAND_EXPANSE_REGION_EVENTS,
  ICE_GRAND_EXPANSE_REWARDS,
  ICE_GRAND_EXPANSE_SAFE_ZONES,
} from "@/project/defaults/iceGrandExpanseEvents";
import { ICE_GRAND_EXPANSE_FIELD_SPAWNS } from "@/project/defaults/iceGrandExpanseFieldSpawns";
import { ICE_GRAND_EXPANSE_START } from "@/project/defaults/iceGrandExpansePlan";
import {
  assertIceGrandExpanseContactAllowed,
  ICE_GRAND_EXPANSE_GATE,
  ICE_GRAND_EXPANSE_SEALS,
  ICE_GRAND_EXPANSE_SHORTCUT_EVENTS,
} from "@/project/defaults/iceGrandExpanseSeals";
import { iceDiagonalRole } from "@/project/defaults/iceDiagonalTerrain";
import { hasFieldMonsterVictoryErasePattern } from "@/project/fieldMonsterTemplate";
import { hasSessionCheckpoint } from "@/player/checkpoints";
import { nextChaseDecision } from "@/player/chaseAi";
import { createFieldSpawnRuntime, fieldSpawnAliveCount } from "@/player/fieldSpawns";
import { resolveEventPage } from "@/project/io";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { runSceneTest } from "@/testing/sceneTestRunner";
import {
  actionScenario,
  EXPECTED_FIELD_SPAWNS,
  expectGameplayError,
  facingPoint,
  frozenPoints,
  fullyUnlockedScenario,
  gameplayFixture,
  requiredEvent,
} from "./helpers/iceGrandExpanseGameplayFixture";

describe("ice grand expanse gameplay population", () => {
  it("freezes exactly twenty-two hostiles and the exact field-spawn assignments", () => {
    const { map } = gameplayFixture();
    expect(ICE_GRAND_EXPANSE_FIELD_SPAWNS.map((spawn) => [
      spawn.id, spawn.x, spawn.y, spawn.troopId, spawn.textureKey, spawn.characterIndex, spawn.chase,
    ])).toEqual(EXPECTED_FIELD_SPAWNS);
    expect(map.fieldSpawns).toHaveLength(17);
    expect(ICE_GRAND_EXPANSE_GUARDS).toHaveLength(4);
    expect(map.fieldSpawns?.filter((spawn) => spawn.chase)).toHaveLength(8);
    expect(map.fieldSpawns?.every((spawn) => spawn.area.w === 1 && spawn.area.h === 1 && spawn.maxAlive === 1 && spawn.persistKill === true)).toBe(true);
    expect(map.fieldSpawns?.map((spawn) => spawn.id)).toEqual(ICE_GRAND_EXPANSE_FIELD_SPAWNS.map((spawn) => spawn.id));
    expect(map.fieldSpawns?.filter((spawn) => spawn.troopId === "troop_golem_guard").map((spawn) => spawn.id)).toEqual([
      "fs_ice_expanse_east_04", "fs_ice_expanse_east_05", "fs_ice_expanse_lake_02",
    ]);
    expect((map.fieldSpawns?.length ?? 0) + ICE_GRAND_EXPANSE_GUARDS.length + 1).toBe(22);
  });

  it("keeps ordinary hostiles separated and every 20x15 chase window at three or fewer", () => {
    for (let left = 0; left <= 108; left += 1) for (let top = 0; top <= 113; top += 1) {
      const count = ICE_GRAND_EXPANSE_FIELD_SPAWNS.filter((spawn) => spawn.chase && spawn.x >= left && spawn.x < left + 20 && spawn.y >= top && spawn.y < top + 15).length;
      expect(count, `chase density at ${left},${top}`).toBeLessThanOrEqual(3);
    }
    for (let a = 0; a < ICE_GRAND_EXPANSE_FIELD_SPAWNS.length; a += 1) for (let b = a + 1; b < ICE_GRAND_EXPANSE_FIELD_SPAWNS.length; b += 1) {
      const first = ICE_GRAND_EXPANSE_FIELD_SPAWNS[a];
      const second = ICE_GRAND_EXPANSE_FIELD_SPAWNS[b];
      if (first === undefined || second === undefined) continue;
      expect(Math.abs(first.x - second.x) + Math.abs(first.y - second.y)).toBeGreaterThanOrEqual(4);
    }
  });

  it("places three checkpoint safe zones and blocks chase/contact inside each", () => {
    const { project, map } = gameplayFixture();
    expect(map.safeZones).toEqual(ICE_GRAND_EXPANSE_SAFE_ZONES);
    expect(map.safeZones).toHaveLength(3);
    for (const zone of ICE_GRAND_EXPANSE_SAFE_ZONES) {
      const player = { x: zone.x + 1, y: zone.y + 1 };
      expectGameplayError(() => assertIceGrandExpanseContactAllowed(project, map, player), "CONTACT_BLOCKED");
      expect(nextChaseDecision({ project, map, from: { x: player.x + 4, y: player.y }, player, deltaMs: 16, mover: { timer: 999, moveIntervalMs: 0 }, sightRange: 12, giveUpRange: 16, pathfind: true })).toEqual({ kind: "wait" });
    }
  });

  it("keeps every frozen anchor off ridge roles with terrain passability and an action-facing tile", () => {
    const { project, map } = gameplayFixture();
    const actionEvents = map.events.filter((event) => event.trigger.kind === "action");
    const points = frozenPoints();
    expect(points).toHaveLength(45);
    for (const point of points) {
      expect(iceDiagonalRole(map.lowerTiles[point.y * map.width + point.x] ?? -1), `${point.x},${point.y}`).toBeNull();
      expect(isPassable(project, map, point.x, point.y), `${point.x},${point.y}`).toBe(true);
    }
    for (const event of actionEvents) expect(facingPoint(project, map, event.x, event.y)).toBeDefined();
  });

  it("triggers all region/checkpoint/action producers and reaches boss troop through its authored event", () => {
    const { project, map } = gameplayFixture();
    const actionEvents = map.events.filter((event) => event.trigger.kind === "action");
    expect(actionEvents).toHaveLength(19);
    expect(new Set(actionEvents.map((event) => event.id))).toEqual(new Set([
      ...ICE_GRAND_EXPANSE_CHECKPOINTS.map((event) => event.id),
      ...ICE_GRAND_EXPANSE_SEALS.map((event) => event.id), ICE_GRAND_EXPANSE_GATE.id,
      ...ICE_GRAND_EXPANSE_SHORTCUT_EVENTS.map((event) => event.id),
      ...ICE_GRAND_EXPANSE_REWARDS.map((event) => event.id),
      ...ICE_GRAND_EXPANSE_GUARDS.map((event) => event.id), ICE_GRAND_EXPANSE_BOSS_EVENT.id,
    ]));
    for (const event of actionEvents) {
      const result = actionScenario(project, map, event);
      expect(result.ok, `${event.id}:${result.failureReason ?? ""}`).toBe(true);
      expect(result.log).toContain(`event ${event.id} start`);
    }
    const regionEvents = map.events.filter((event) => event.trigger.kind === "playerTouch");
    expect(regionEvents).toHaveLength(8);
    expect(new Set(regionEvents.map((event) => event.id))).toEqual(new Set(ICE_GRAND_EXPANSE_REGION_EVENTS.map((event) => event.id)));
    for (const region of ICE_GRAND_EXPANSE_REGION_EVENTS) {
      const start = facingPoint(project, map, region.x, region.y);
      const result = runSceneTest(project, { mapId: map.id, start, steps: [{ kind: "move", dir: start.dir }] });
      expect(result.ok, `${region.id}:${result.failureReason ?? ""}`).toBe(true);
      expect(result.session.m2Runtime?.ui.some((entry) => entry.surface === "banner" && entry.message === region.label)).toBe(true);
    }
    for (const checkpoint of ICE_GRAND_EXPANSE_CHECKPOINTS) {
      const event = requiredEvent(map, checkpoint.id);
      const result = actionScenario(project, map, event);
      expect(result.ok, result.failureReason).toBe(true);
      expect(hasSessionCheckpoint(result.session)).toBe(true);
      expect(result.session.m2Runtime?.ui.at(-1)?.surface).toBe("toast");
    }
    const boss = requiredEvent(map, ICE_GRAND_EXPANSE_BOSS_EVENT.id);
    const bossRun = actionScenario(project, map, boss);
    expect(bossRun.ok, bossRun.failureReason).toBe(true);
    expect(bossRun.log).toContain(`event ${ICE_GRAND_EXPANSE_BOSS_EVENT.id} start`);
    expect(bossRun.log.some((line) => line.startsWith("battle troop_dragon:"))).toBe(true);
    expect(resolveEventPage(boss, bossRun.session)?.id).toContain(bossRun.session.battleResult === "victory" ? "cleared" : "fight");
  });

  it("applies every reward exactly once through its authored event", () => {
    const { project, map } = gameplayFixture();
    for (const reward of ICE_GRAND_EXPANSE_REWARDS) {
      const event = requiredEvent(map, reward.id);
      const start = facingPoint(project, map, event.x, event.y);
      const result = runSceneTest(project, {
        mapId: map.id, start,
        steps: [{ kind: "face", dir: start.dir }, { kind: "interact" }, { kind: "interact" }],
      });
      expect(result.ok, `${reward.id}:${result.failureReason ?? ""}`).toBe(true);
      expect(result.finalState.inventory.item_potion).toBe(reward.amount);
      expect(resolveEventPage(event, result.session)?.id).toBe(`${reward.id}_opened`);
      expect(result.session.m2Runtime?.ui.filter((entry) => entry.surface === "toast")).toHaveLength(1);
      expect(result.log.filter((line) => line === `event ${reward.id} start`)).toHaveLength(2);
    }
  });

  it("executes all four guards through their authored golem battles", () => {
    const { project, map } = gameplayFixture();
    for (const guard of ICE_GRAND_EXPANSE_GUARDS) {
      const event = requiredEvent(map, guard.id);
      const result = actionScenario(project, map, event);
      expect(result.ok, `${guard.id}:${result.failureReason ?? ""}`).toBe(true);
      expect(result.log.some((line) => line.startsWith("battle troop_golem_guard:")), guard.id).toBe(true);
      expect(resolveEventPage(event, result.session)?.id).toContain(result.session.battleResult === "victory" ? "cleared" : "fight");
    }
  });

  it("executes all four shortcut transfers after their real unlock events", () => {
    const { project, map } = gameplayFixture();
    for (const shortcut of ICE_GRAND_EXPANSE_SHORTCUT_EVENTS) {
      const event = requiredEvent(map, shortcut.id);
      const result = fullyUnlockedScenario(project, map, event);
      expect(result.ok, `${shortcut.id}:${result.failureReason ?? ""}`).toBe(true);
      expect(result.finalState.mapId).toBe(map.id);
      expect([result.finalState.x, result.finalState.y]).toEqual([shortcut.to.x, shortcut.to.y]);
      expect(resolveEventPage(event, result.session)?.id).toBe(`${shortcut.id}_open`);
    }
  });

  it("uses real field-spawn persistence data across a save roundtrip", () => {
    const { project, map } = gameplayFixture();
    const first = ICE_GRAND_EXPANSE_FIELD_SPAWNS[0];
    if (first === undefined) throw new RangeError("missing first spawn");
    const session = startSession(project);
    session.killedFieldSpawns = { [map.id]: { [first.id]: 1 } };
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    const runtime = createFieldSpawnRuntime(project, map, ICE_GRAND_EXPANSE_START, restored.killedFieldSpawns?.[map.id]);
    expect(restored.killedFieldSpawns?.[map.id]?.[first.id]).toBe(1);
    expect(runtime.entries.find((entry) => entry.spawn.id === first.id)?.persistedDead).toBe(1);
    expect(fieldSpawnAliveCount(runtime)).toBe(16);
  });

  it("builds guards and boss only through the real victory-erase battle template", () => {
    const { map } = gameplayFixture();
    const hostileIds = [...ICE_GRAND_EXPANSE_GUARDS.map((guard) => guard.id), ICE_GRAND_EXPANSE_BOSS_EVENT.id];
    for (const id of hostileIds) {
      const event = map.events.find((entry) => entry.id === id);
      const commands = event?.pages?.[0]?.commands ?? [];
      expect(hasFieldMonsterVictoryErasePattern(commands), id).toBe(true);
    }
  });
});
