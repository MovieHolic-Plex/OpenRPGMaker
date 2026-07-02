import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createStarterHouseInteriorMap } from "@/project/defaults/starterHouseTransfer";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { EventPage, GameMap } from "@/project/types";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import {
  findBlockingRuntimeEventAtInMap,
  findRuntimeEventAtInMap,
  initialRuntimeEventPositions,
} from "@/player/runtimeEventState";
import { event, mockSprite, pageWith } from "./runtimeEventPageFixtures";

describe("runtime NPC living map travel", () => {
  it("routes an NPC through map connections to a living destination on another map", () => {
    // Given: an NPC has a living destination in the starter house and an NPC-enabled door connection.
    const project = createBlankProject();
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("missing default source map");
    const targetMap = createStarterHouseInteriorMap(sourceMap.id);
    project.maps[targetMap.id] = targetMap;
    sourceMap.events = [event("traveler", 6, 10, [livingPage(targetMap.id, 4, 6)])];
    project.mapConnections = [
      {
        id: "link_starter_house",
        from: { mapId: sourceMap.id, x: 7, y: 10 },
        to: { mapId: targetMap.id, x: 4, y: 7, direction: "down" },
        npcEnabled: true,
        playerEnabled: true,
      },
    ];
    const scene = movementScene(project, sourceMap);

    // When: autonomous movement ticks enough times to step to the exit and transfer.
    registerPageMoveRoutes(scene);
    tick(scene, 8);

    // Then: the NPC is now tracked on the target map at the linked entry.
    expect(scene.session.eventLocations.traveler).toEqual({
      mapId: targetMap.id,
      x: 4,
      y: 7,
      direction: "down",
    });

    // When: the player later visits that target map, the same NPC continues to its actual living destination.
    scene.map = targetMap;
    scene.eventPositions = initialRuntimeEventPositions(targetMap.events);
    registerPageMoveRoutes(scene);
    tick(scene, 10);

    // Then: the NPC is no longer stranded at the doorway; it walks to the authored destination.
    expect(scene.session.eventLocations.traveler).toEqual({
      mapId: targetMap.id,
      x: 4,
      y: 6,
      direction: "up",
    });
  });

  it("keeps living NPCs safe when no NPC-enabled map connection exists", () => {
    // Given: an NPC wants another map, but the only connection is player-only.
    const project = createBlankProject();
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("missing default source map");
    const targetMap = createStarterHouseInteriorMap(sourceMap.id);
    project.maps[targetMap.id] = targetMap;
    sourceMap.events = [event("traveler", 6, 10, [livingPage(targetMap.id, 4, 6)])];
    project.mapConnections = [
      {
        id: "player_only_link",
        from: { mapId: sourceMap.id, x: 7, y: 10 },
        to: { mapId: targetMap.id, x: 4, y: 6 },
        npcEnabled: false,
        playerEnabled: true,
      },
    ];
    const scene = movementScene(project, sourceMap);

    // When: autonomous movement tries to resolve a living route.
    registerPageMoveRoutes(scene);
    tick(scene, 4);

    // Then: no unsafe teleport occurs and the NPC remains on its source map.
    expect(scene.session.eventLocations.traveler).toBeUndefined();
    expect(scene.eventPositions.traveler).toEqual({ x: 6, y: 10 });
  });

  it("persists transferred NPC locations and living progress through save/load", () => {
    // Given: a session has a transferred living NPC and a remembered destination index.
    const project = createBlankProject();
    const session = startSession(project);
    session.eventLocations.traveler = {
      mapId: "map_starter_house_interior",
      x: 4,
      y: 6,
      direction: "down",
    };
    session.npcTravelStates.traveler = { destinationIndex: 1 };

    // When: the play session is saved and restored.
    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, snapshot);

    // Then: cross-map NPC state survives the save boundary.
    expect(restored.eventLocations.traveler).toEqual(session.eventLocations.traveler);
    expect(restored.npcTravelStates.traveler).toEqual({ destinationIndex: 1 });
  });

  it("removes transferred-away NPCs from source-map blocking, action, and touch lookup", () => {
    // Given: source-map events have been transferred to another map but retain source-map-like coordinates.
    const project = createBlankProject();
    const sourceMap = project.maps[project.startMapId];
    if (!sourceMap) throw new Error("missing default source map");
    const targetMap = createStarterHouseInteriorMap(sourceMap.id);
    project.maps[targetMap.id] = targetMap;
    sourceMap.events = [
      event("away-action", 6, 10, [pageWith({ trigger: { kind: "action" }, priority: "same" })]),
      event("away-touch", 7, 10, [pageWith({ trigger: { kind: "playerTouch" }, priority: "below" })]),
    ];
    const session = startSession(project);
    session.eventLocations["away-action"] = { mapId: targetMap.id, x: 6, y: 10, direction: "down" };
    session.eventLocations["away-touch"] = { mapId: targetMap.id, x: 7, y: 10, direction: "down" };
    const positions = initialRuntimeEventPositions(sourceMap.events);

    // When/Then: player movement lookups on the source map do not see transferred-away events as ghosts.
    expect(findBlockingRuntimeEventAtInMap(project, sourceMap, session, positions, 6, 10)).toBeUndefined();
    expect(findRuntimeEventAtInMap(project, sourceMap, session, positions, 6, 10, "action")).toBeUndefined();
    expect(findRuntimeEventAtInMap(project, sourceMap, session, positions, 7, 10, ["touch", "playerTouch"])).toBeUndefined();
  });
});

function livingPage(mapId: string, x: number, y: number): EventPage {
  return pageWith({
    movement: {
      type: "living",
      speed: 8,
      frequency: 8,
      living: {
        destinations: [{ mapId, x, y, direction: "down" }],
        repeat: false,
      },
    },
  });
}

function movementScene(project: ReturnType<typeof createBlankProject>, map: GameMap): Parameters<typeof registerPageMoveRoutes>[0] & Parameters<typeof updateAutonomousNPCs>[0] {
  store.replace(project);
  const eventSprites = new Map<string, ReturnType<typeof mockSprite>>();
  eventSprites.set("traveler", mockSprite());
  let scene: Parameters<typeof registerPageMoveRoutes>[0] & Parameters<typeof updateAutonomousNPCs>[0];
  scene = {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    pageMoveRouteKeys: new Set(),
    pageMoveRouteEventIds: new Set(),
    autonomousNPCs: new Map(),
    registerAutonomousMover: (eventId, moves, repeat) => {
      registerAutonomousMover(scene, eventId, moves, repeat);
    },
    eventSprites,
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
    tileX: 0,
    tileY: 0,
  };
  return scene;
}

function tick(scene: Parameters<typeof updateAutonomousNPCs>[0], count: number): void {
  for (let index = 0; index < count; index += 1) updateAutonomousNPCs(scene, 1200);
}
