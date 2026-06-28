import { describe, expect, it } from "vitest";
import type { MoveCommand } from "@/project/types";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import {
  npcMoveDurationMs,
  npcMoveIntervalMs,
  registerPageMoveRoutes,
} from "@/player/playScenePageMoveRoutes";
import { mockSprite, movementScene } from "./runtimeEventPageFixtures";

describe("runtime move route commands", () => {
  it("executes every custom NPC move-route command family during play updates", () => {
    const moves = [
      { kind: "turn", dir: "right" },
      { kind: "moveDiagonal", horizontal: "right", vertical: "down" },
      { kind: "turnRelative", turn: "turn180" },
      { kind: "stepForward" },
      { kind: "turnTowardPlayer" },
      { kind: "moveTowardPlayer" },
      { kind: "turnAwayFromPlayer" },
      { kind: "moveAwayFromPlayer" },
      { kind: "setDirectionFix", enabled: true },
      { kind: "turn", dir: "up" },
      { kind: "setDirectionFix", enabled: false },
      { kind: "setThrough", enabled: true },
      { kind: "jump", dx: 2, dy: 0 },
      { kind: "land" },
      { kind: "setThrough", enabled: false },
      { kind: "setAnimation", enabled: false },
      { kind: "setAnimation", enabled: true },
      { kind: "changeOpacity", delta: -64 },
      { kind: "changeOpacity", delta: 64 },
      { kind: "setSwitch", switchId: "sw_route_done", value: true },
      { kind: "changeSpeed", delta: 1 },
      { kind: "changeFrequency", delta: 1 },
      { kind: "changeGraphic", spriteId: "npc_villager" },
      { kind: "playSe", resourceId: "se_route_chime" },
      { kind: "moveRandom" },
      { kind: "turnRandom" },
      { kind: "wait" },
    ] satisfies MoveCommand[];
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 3,
        frequency: 3,
        route: { moves, repeat: false },
      },
    });

    registerPageMoveRoutes(scene);
    const sprite = mockSprite();
    const overlays: Record<string, string> = {};
    const markerUpdates: string[] = [];
    const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
      ...scene,
      tileX: 4,
      tileY: 4,
      eventSprites: new Map([["npc", sprite]]),
      runtimeDom: {
        upsertEventMarker: (view) => {
          markerUpdates.push(`${view.x},${view.y}`);
        },
      },
      runEvent: async () => undefined,
      showRuntimeOverlay: (testId, text) => {
        overlays[testId] = text;
      },
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing autonomous mover");
    const initialDuration = mover.moveDurationMs;
    const initialInterval = mover.moveIntervalMs;

    for (let guard = 0; guard < 80 && scene.autonomousNPCs.get("npc")?.moves.length; guard += 1) {
      updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);
      updateAutonomousNPCs(runtimeScene, mover.moveDurationMs);
    }

    expect(scene.autonomousNPCs.get("npc")?.moves).toEqual([]);
    expect(scene.session.switches.sw_route_done).toBe(true);
    expect(scene.eventPositions.npc).not.toEqual({ x: 1, y: 1 });
    expect(scene.eventPositions.npc.x).toBeGreaterThanOrEqual(0);
    expect(scene.eventPositions.npc.y).toBeGreaterThanOrEqual(0);
    expect(mover.moveDurationMs).toBeLessThan(initialDuration);
    expect(mover.moveIntervalMs).toBeLessThan(initialInterval);
    expect(mover.directionFix).toBe(false);
    expect(mover.through).toBe(false);
    expect(mover.animationEnabled).toBe(true);
    expect(mover.opacity).toBe(255);
    expect(sprite.alpha).toBe(1);
    expect(sprite.texture.key).toBe("tex_npc_villager");
    expect(overlays["audio-indicator"]).toBe("se_route_chime");
    expect(markerUpdates.length).toBeGreaterThan(0);
  });

  it("applies move-route toggles, clamps, blocked movement, and OFF/decrease variants", () => {
    const moves = [
      { kind: "move", dir: "right" },
      { kind: "setThrough", enabled: true },
      { kind: "move", dir: "right" },
      { kind: "setThrough", enabled: false },
      { kind: "turn", dir: "right" },
      { kind: "setDirectionFix", enabled: true },
      { kind: "turn", dir: "up" },
      { kind: "setThrough", enabled: true },
      { kind: "stepForward" },
      { kind: "setThrough", enabled: false },
      { kind: "setDirectionFix", enabled: false },
      { kind: "turn", dir: "up" },
      { kind: "setThrough", enabled: true },
      { kind: "stepForward" },
      { kind: "setThrough", enabled: false },
      { kind: "changeOpacity", delta: -999 },
      { kind: "changeOpacity", delta: 999 },
      { kind: "setSwitch", switchId: "sw_route_toggle", value: false },
      { kind: "changeSpeed", delta: 5 },
      { kind: "changeSpeed", delta: -10 },
      { kind: "changeFrequency", delta: 5 },
      { kind: "changeFrequency", delta: -10 },
    ] satisfies MoveCommand[];
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 3,
        frequency: 3,
        route: { moves, repeat: false },
      },
    });
    const blockedTileIndex = 1 * scene.map.width + 2;
    scene.map.lowerTiles[blockedTileIndex] = 1;
    scene.session.switches.sw_route_toggle = true;
    registerPageMoveRoutes(scene);
    const sprite = mockSprite();
    const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
      ...scene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map([["npc", sprite]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing autonomous mover");
    const executeNext = () => {
      const beforeStep = mover.step;
      updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);
      if (mover.activeMove) updateAutonomousNPCs(runtimeScene, mover.moveDurationMs);
      expect(mover.step).toBeGreaterThan(beforeStep);
    };

    executeNext();
    expect(scene.eventPositions.npc).toEqual({ x: 1, y: 1 });
    executeNext();
    expect(mover.through).toBe(true);
    executeNext();
    expect(scene.eventPositions.npc).toEqual({ x: 2, y: 1 });
    executeNext();
    expect(mover.through).toBe(false);
    scene.map.lowerTiles[blockedTileIndex] = 0;
    executeNext();
    expect(mover.facing).toBe("right");
    executeNext();
    executeNext();
    expect(mover.facing).toBe("right");
    executeNext();
    expect(mover.through).toBe(true);
    executeNext();
    expect(scene.eventPositions.npc).toEqual({ x: 3, y: 1 });
    executeNext();
    expect(mover.through).toBe(false);
    executeNext();
    executeNext();
    expect(mover.facing).toBe("up");
    executeNext();
    expect(mover.through).toBe(true);
    executeNext();
    expect(scene.eventPositions.npc).toEqual({ x: 3, y: 0 });
    executeNext();
    expect(mover.through).toBe(false);
    executeNext();
    expect(mover.opacity).toBe(0);
    expect(sprite.alpha).toBe(0);
    executeNext();
    expect(mover.opacity).toBe(255);
    expect(sprite.alpha).toBe(1);
    executeNext();
    expect(scene.session.switches.sw_route_toggle).toBe(false);
    executeNext();
    expect(mover.speedRank).toBe(8);
    expect(mover.moveDurationMs).toBe(npcMoveDurationMs(8));
    executeNext();
    expect(mover.speedRank).toBe(1);
    expect(mover.moveDurationMs).toBe(npcMoveDurationMs(1));
    executeNext();
    expect(mover.frequencyRank).toBe(8);
    expect(mover.moveIntervalMs).toBe(npcMoveIntervalMs(8));
    executeNext();
    expect(mover.frequencyRank).toBe(1);
    expect(mover.moveIntervalMs).toBe(npcMoveIntervalMs(1));
    expect(mover.moves).toEqual([]);
  });
});
