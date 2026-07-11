import { describe, expect, it } from "vitest";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { canNpcMove, isPlayerOccupyingTile } from "@/player/playSceneAutonomousMapActions";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { movementScene, pageWith } from "./runtimeEventPageFixtures";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { initialRuntimeEventPositions } from "@/player/runtimeEventState";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import type { EventPage } from "@/project/types";

describe("NPC-player character collision", () => {
  it("blocks an NPC from stepping onto the player's committed tile when through is off", () => {
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 6,
        frequency: 6,
        route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
      },
    });
    registerPageMoveRoutes(scene);
    const runtimeScene = {
      ...scene,
      tileX: 2,
      tileY: 1,
      moving: false,
      movingTo: { x: 2, y: 1 },
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing mover");

    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

    expect(scene.eventPositions.npc).toEqual({ x: 1, y: 1 });
    expect(mover.activeMove).toBeNull();
  });

  it("blocks an NPC from stepping onto the player's mid-move destination", () => {
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 6,
        frequency: 6,
        route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
      },
    });
    registerPageMoveRoutes(scene);
    const runtimeScene = {
      ...scene,
      // Player is mid-step from (3,1) into (2,1) — the tile the NPC wants.
      tileX: 3,
      tileY: 1,
      moving: true,
      movingTo: { x: 2, y: 1 },
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing mover");

    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

    expect(scene.eventPositions.npc).toEqual({ x: 1, y: 1 });
    expect(mover.activeMove).toBeNull();
  });

  it("allows through ON to enter the player tile", () => {
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 6,
        frequency: 6,
        route: {
          moves: [
            { kind: "setThrough", enabled: true },
            { kind: "move", dir: "right" },
          ],
          repeat: false,
        },
      },
    });
    registerPageMoveRoutes(scene);
    const runtimeScene = {
      ...scene,
      tileX: 2,
      tileY: 1,
      moving: false,
      movingTo: { x: 2, y: 1 },
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing mover");

    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs); // setThrough
    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs); // move onto player

    expect(scene.eventPositions.npc).toEqual({ x: 2, y: 1, direction: "right" });
  });

  it("blocks an NPC from stepping onto another same-priority solid event", () => {
    const scene = twoNpcMovementScene(
      {
        movement: {
          type: "custom",
          speed: 6,
          frequency: 6,
          route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
        },
      },
      { id: "blocker", x: 2, y: 1, overlapForbidden: true, priority: "same" }
    );
    registerPageMoveRoutes(scene);
    const runtimeScene = {
      ...scene,
      tileX: 9,
      tileY: 9,
      moving: false,
      movingTo: { x: 9, y: 9 },
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing mover");

    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

    expect(scene.eventPositions.npc).toEqual({ x: 1, y: 1 });
    expect(mover.activeMove).toBeNull();
  });

  it("isPlayerOccupyingTile covers committed and mid-move destination tiles", () => {
    expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5 }, 4, 5)).toBe(true);
    expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5, moving: false, movingTo: { x: 5, y: 5 } }, 5, 5)).toBe(false);
    expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5, moving: true, movingTo: { x: 5, y: 5 } }, 5, 5)).toBe(true);
    expect(isPlayerOccupyingTile({ tileX: 4, tileY: 5, moving: true, movingTo: { x: 5, y: 5 } }, 4, 5)).toBe(true);
  });

  it("canNpcMove rejects player-occupied destinations when through is off", () => {
    const scene = movementScene({
      movement: { type: "fixed", speed: 3, frequency: 3 },
    });
    const request = {
      project: store.getCurrent(),
      scene: {
        ...scene,
        tileX: 2,
        tileY: 1,
        moving: false,
        movingTo: { x: 2, y: 1 },
        eventSprites: new Map(),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
      },
      mover: {
        moves: [],
        step: 0,
        timer: 0,
        repeat: false,
        strategy: "sequence" as const,
        facing: "right" as const,
        directionFix: false,
        through: false,
        animationEnabled: true,
        opacity: 255,
        speedRank: 3,
        frequencyRank: 3,
        moveIntervalMs: 100,
        moveDurationMs: 100,
        activeMove: null,
      },
      eventId: "npc",
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
    };
    expect(canNpcMove(request, { x: 1, y: 0, face: "right" })).toBe(false);
    request.mover.through = true;
    expect(canNpcMove(request, { x: 1, y: 0, face: "right" })).toBe(true);
  });
});

function twoNpcMovementScene(
  walkerPage: Partial<EventPage>,
  blocker: { id: string; x: number; y: number; overlapForbidden: boolean; priority: EventPage["priority"] }
): Parameters<typeof registerPageMoveRoutes>[0] {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.events = [
    {
      id: "npc",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [pageWith(walkerPage)],
    },
    {
      id: blocker.id,
      x: blocker.x,
      y: blocker.y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        pageWith({
          id: `${blocker.id}_page`,
          priority: blocker.priority,
          overlapForbidden: blocker.overlapForbidden,
          movement: { type: "fixed", speed: 3, frequency: 3 },
        }),
      ],
    },
  ];
  store.replace(project);

  let scene: Parameters<typeof registerPageMoveRoutes>[0];
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
  };
  return scene;
}
