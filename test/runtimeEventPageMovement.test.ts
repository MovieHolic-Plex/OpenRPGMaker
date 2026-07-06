import { describe, expect, it } from "vitest";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import {
  npcMoveDurationMs,
  npcMoveIntervalMs,
  registerPageMoveRoutes,
} from "@/player/playScenePageMoveRoutes";
import { movementScene, movementSceneWithPages, pageWith } from "./runtimeEventPageFixtures";

describe("runtime event page movement", () => {
  it("registers NPC autonomous movement from page movement type, speed, and frequency", () => {
    const scene = movementScene({
      movement: {
        type: "random",
        speed: 5,
        frequency: 6,
      },
    });

    registerPageMoveRoutes(scene);

    const mover = scene.autonomousNPCs.get("npc");
    expect(mover?.strategy).toBe("random");
    expect(mover?.moves.map((move) => move.kind)).toEqual(["move", "move", "move", "move"]);
    expect(mover?.moveDurationMs).toBe(npcMoveDurationMs(5));
    expect(mover?.moveIntervalMs).toBe(npcMoveIntervalMs(6));
  });

  it("executes custom NPC move routes during play updates", () => {
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 6,
        frequency: 6,
        route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
      },
    });

    registerPageMoveRoutes(scene);
    const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
      ...scene,
      tileX: 0,
      tileY: 0,
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };

    updateAutonomousNPCs(runtimeScene, npcMoveIntervalMs(6));

    expect(scene.eventPositions.npc).toEqual({ x: 2, y: 1 });
    expect(scene.autonomousNPCs.get("npc")?.activeMove?.toX).toBe(2);

    updateAutonomousNPCs(runtimeScene, npcMoveDurationMs(6));

    expect(scene.autonomousNPCs.get("npc")?.moves).toEqual([]);
  });

  it("waits for movement frequency again after an active NPC step finishes", () => {
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 6,
        frequency: 6,
        route: {
          repeat: false,
          moves: [
            { kind: "move", dir: "right" },
            { kind: "move", dir: "right" },
          ],
        },
      },
    });
    registerPageMoveRoutes(scene);
    const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
      ...scene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing autonomous mover");

    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);
    expect(mover.step).toBe(1);
    expect(mover.activeMove).not.toBeNull();
    updateAutonomousNPCs(runtimeScene, mover.moveDurationMs);
    expect(mover.activeMove).toBeNull();
    expect(mover.timer).toBe(0);

    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs - 1);
    expect(mover.step).toBe(1);
    updateAutonomousNPCs(runtimeScene, 1);
    expect(mover.step).toBe(2);
  });

  it("preserves an NPC's action-turn facing when page routes are re-registered", () => {
    // refreshRuntimeSurfaces 는 이벤트 조사 직후에도 registerPageMoveRoutes 를 다시
    // 부른다. 그때 facing 을 기본 방향으로 리셋하면 turnActionEventTowardPlayer 가
    // 돌려놓은 방향이 즉시 취소돼 "말을 걸어도 NPC 가 쳐다보지 않는" 버그가 된다.
    const scene = movementScene({
      movement: { type: "random", speed: 3, frequency: 3 },
    });
    registerPageMoveRoutes(scene);
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing autonomous mover");

    // 조사 시 플레이어 쪽으로 돌린 상태를 흉내낸다(기본 방향과 다른 방향).
    mover.facing = "up";

    // 이벤트 실행 중 refreshRuntimeSurfaces → registerPageMoveRoutes 재호출.
    registerPageMoveRoutes(scene);

    expect(scene.autonomousNPCs.get("npc")?.facing).toBe("up");
  });

  it("does not register an autonomous mover for stationary NPC pages", () => {
    const scene = movementScene({
      movement: {
        type: "fixed",
        speed: 6,
        frequency: 6,
      },
    });

    registerPageMoveRoutes(scene);

    expect(scene.autonomousNPCs.has("npc")).toBe(false);
  });

  it("removes stale page-owned movers when page conditions switch to a fixed page", () => {
    const scene = movementSceneWithPages([
      pageWith({
        id: "moving",
        movement: {
          type: "custom",
          speed: 3,
          frequency: 3,
          route: { moves: [{ kind: "setSwitch", switchId: "stop_npc", value: true }], repeat: false },
        },
      }),
      pageWith({
        id: "fixed",
        conditions: [{ kind: "switch", switchId: "stop_npc", value: true }],
        movement: { type: "fixed", speed: 3, frequency: 3 },
      }),
    ]);
    registerPageMoveRoutes(scene);
    expect(scene.autonomousNPCs.has("npc")).toBe(true);
    const runtimeScene: Parameters<typeof updateAutonomousNPCs>[0] = {
      ...scene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
      refreshRuntimeSurfaces: () => registerPageMoveRoutes(scene),
    };
    const mover = scene.autonomousNPCs.get("npc");
    if (!mover) throw new Error("missing autonomous mover");

    updateAutonomousNPCs(runtimeScene, mover.moveIntervalMs);

    expect(scene.session.switches.stop_npc).toBe(true);
    expect(scene.pageMoveRouteEventIds.has("npc")).toBe(false);
    expect(scene.autonomousNPCs.has("npc")).toBe(false);
  });
});
