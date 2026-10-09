import { describe, expect, it } from "vitest";
import { store } from "@/project/store";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { mockSprite, movementScene } from "./runtimeEventPageFixtures";

describe("runtime NPC map transfer route commands", () => {
  it("moves an NPC between maps as part of its autonomous route", () => {
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 8,
        frequency: 8,
        route: {
          moves: [
            { kind: "setThrough", enabled: true },
            { kind: "move", dir: "right" },
            { kind: "npcTransfer", mapId: "map_runtime_target", x: 3, y: 2, direction: "down" },
            { kind: "setThrough", enabled: false },
          ],
          repeat: false,
        },
      },
    });
    const targetMap = { ...scene.map, id: "map_runtime_target", name: "Target", events: [] };
    const project = store.getCurrent();
    project.maps[targetMap.id] = targetMap;
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

    for (let guard = 0; guard < 8 && scene.autonomousNPCs.get("npc")?.moves.length; guard += 1) {
      updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);
      if (mover.activeMove) updateAutonomousNPCs(runtimeScene, mover.moveDurationMs);
    }

    expect(scene.eventPositions.npc).toBeUndefined();
    expect(scene.session.eventLocations?.npc).toEqual({
      mapId: "map_runtime_target",
      x: 3,
      y: 2,
      direction: "down",
    });
    expect(scene.autonomousNPCs.has("npc")).toBe(false);
  });

  it("keeps NPC transfers safe for missing maps and blocked target tiles", () => {
    const missingMapScene = movementScene({
      movement: {
        type: "custom",
        speed: 8,
        frequency: 8,
        route: { moves: [{ kind: "npcTransfer", mapId: "missing_map", x: 4, y: 4 }], repeat: false },
      },
    });
    registerPageMoveRoutes(missingMapScene);
    const missingMapMover = missingMapScene.autonomousNPCs.get("npc");
    if (!missingMapMover) throw new Error("missing autonomous mover");
    updateAutonomousNPCs({
      ...missingMapScene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map([["npc", mockSprite()]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    }, missingMapMover.moveIntervalMs);

    expect(missingMapScene.eventPositions.npc).toEqual({ x: 1, y: 1 });
    expect(missingMapScene.session.eventLocations?.npc).toBeUndefined();

    const blockedTargetScene = movementScene({
      movement: {
        type: "custom",
        speed: 8,
        frequency: 8,
        route: { moves: [{ kind: "npcTransfer", mapId: "map_runtime_blocked_target", x: 3, y: 2 }], repeat: false },
      },
    });
    const project = store.getCurrent();
    const targetMap = { ...blockedTargetScene.map, id: "map_runtime_blocked_target", name: "Blocked Target", events: [] };
    targetMap.lowerTiles[2 * targetMap.width + 3] = 1;
    project.maps[targetMap.id] = targetMap;
    registerPageMoveRoutes(blockedTargetScene);
    const blockedTargetMover = blockedTargetScene.autonomousNPCs.get("npc");
    if (!blockedTargetMover) throw new Error("missing autonomous mover");
    updateAutonomousNPCs({
      ...blockedTargetScene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map([["npc", mockSprite()]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    }, blockedTargetMover.moveIntervalMs);

    expect(blockedTargetScene.session.eventLocations?.npc?.mapId).toBe("map_runtime_blocked_target");
    expect(blockedTargetScene.session.eventLocations?.npc).not.toMatchObject({ x: 3, y: 2 });
  });
});
