import { describe, expect, it } from "vitest";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { canNpcMove, isPlayerOccupyingTile } from "@/player/playSceneAutonomousMapActions";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { movementScene, pageWith } from "./runtimeEventPageFixtures";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState"
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

  it("blocks an NPC from stepping into any cell of a 2x3 solid event's footprint, not just its anchor", () => {
    // 앵커 (6,4) 의 2x3(가로2·세로3) 발자국은 footprintBounds 로 x 6..7 / y 2..4 를 덮는다.
    // NPC 는 (5,2) 에서 오른쪽으로 한 칸 움직여 (6,2) 로 가려 한다 — 이건 발자국의 좌상단 칸이고 앵커가 아니다.
    // 폭·높이가 다른 발자국을 쓰는 이유: footprintContains 의 인자가 뒤바뀌면(주체↔조사점)
    // 대칭이 아니라 (top = y - (height-1)) 편향 때문에 이 사례에서 결과가 갈린다.
    const scene = twoNpcMovementScene(
      {
        movement: {
          type: "custom",
          speed: 6,
          frequency: 6,
          route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
        },
      },
      { id: "blocker", x: 6, y: 4, overlapForbidden: true, priority: "same", footprint: { width: 2, height: 3 } },
      { x: 5, y: 2 }
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

    expect(scene.eventPositions.npc).toEqual({ x: 5, y: 2 });
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
  blocker: {
    id: string;
    x: number;
    y: number;
    overlapForbidden: boolean;
    priority: EventPage["priority"];
    footprint?: { width: number; height: number };
  },
  npcStart: { x: number; y: number } = { x: 1, y: 1 }
): Parameters<typeof registerPageMoveRoutes>[0] {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.events = [
    {
      id: "npc",
      x: npcStart.x,
      y: npcStart.y,
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
          footprint: blocker.footprint,
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
