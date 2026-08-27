// 스폰된 이벤트(필드 몬스터·spawnEvent 명령 산출물)의 플레이어 상대 이동 보증.
// 이 이벤트들은 map.events 에 없고 런타임 좌표만 가지므로, 위치 조회가 map.events 에만
// 의존하면 dx=dy=0 이 되어 접근/도주가 영구히 정지한다.
import { describe, expect, it } from "vitest";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { movementScene } from "./runtimeEventPageFixtures";

const TICK_MS = 16;

function runtimeSceneFor(scene: ReturnType<typeof movementScene>, player: { x: number; y: number }) {
  return {
    ...scene,
    tileX: player.x,
    tileY: player.y,
    eventSprites: new Map(),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
  } as Parameters<typeof updateAutonomousNPCs>[0];
}

describe("스폰된 이벤트의 플레이어 상대 자율 이동", () => {
  it("접근 이동 스폰 몬스터는 플레이어 쪽으로 이동한다", () => {
    const scene = movementScene({ movement: { type: "approach", speed: 4, frequency: 8 } });
    scene.session.spawnedEvents = {
      mon_spawned: { templateMapId: scene.map.id, templateEventId: "npc", mapId: scene.map.id, x: 3, y: 3 },
    };
    scene.eventPositions.mon_spawned = { x: 3, y: 3, direction: "down" };
    registerPageMoveRoutes(scene);
    expect(scene.autonomousNPCs.get("mon_spawned")?.strategy).toBe("approach");

    const runtimeScene = runtimeSceneFor(scene, { x: 8, y: 3 });
    for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, TICK_MS);

    expect(scene.eventPositions.mon_spawned.x).toBeGreaterThan(3);
  });

  it("도주 이동 스폰 몬스터는 플레이어에게서 멀어진다", () => {
    const scene = movementScene({
      movement: {
        type: "custom",
        speed: 4,
        frequency: 8,
        route: { moves: [{ kind: "moveAwayFromPlayer" }], repeat: true },
      },
    });
    scene.session.spawnedEvents = {
      mon_flee: { templateMapId: scene.map.id, templateEventId: "npc", mapId: scene.map.id, x: 5, y: 3 },
    };
    scene.eventPositions.mon_flee = { x: 5, y: 3, direction: "down" };
    registerPageMoveRoutes(scene);

    const runtimeScene = runtimeSceneFor(scene, { x: 2, y: 3 });
    for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, TICK_MS);

    expect(scene.eventPositions.mon_flee.x).toBeGreaterThan(5);
  });
});
