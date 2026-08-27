// 애니메이션 유형의 방향 고정 계열은 자율 이동에서도 방향을 바꾸지 않아야 한다.
// 조사 시 회전 경로는 canActionTurn(playSceneMovement.ts)으로 이미 이 규칙을 지키는데,
// 자율 이동 경로는 mover.directionFix(이동 루트 명령 전용)만 봐서 규칙이 갈라져 있었다.
import { describe, expect, it } from "vitest";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { movementScene } from "./runtimeEventPageFixtures";

describe("애니메이션 유형과 자율 이동 방향 고정", () => {
  it("fixedDirection 페이지는 자율 이동 중에도 페이지 방향을 유지한다", () => {
    const scene = movementScene({
      animationType: "fixedDirection",
      graphic: { direction: "up" },
      movement: { type: "random", speed: 4, frequency: 8 },
    });
    registerPageMoveRoutes(scene);
    expect(scene.autonomousNPCs.get("npc")?.directionFix).toBe(true);

    const runtimeScene = {
      ...scene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    } as Parameters<typeof updateAutonomousNPCs>[0];
    for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, 16);

    expect(scene.autonomousNPCs.get("npc")?.facing).toBe("up");
  });

  it("normal 페이지는 자율 이동 방향을 따라 돈다", () => {
    const scene = movementScene({
      animationType: "normal",
      graphic: { direction: "up" },
      movement: { type: "custom", speed: 4, frequency: 8, route: { moves: [{ kind: "move", dir: "right" }], repeat: true } },
    });
    registerPageMoveRoutes(scene);
    expect(scene.autonomousNPCs.get("npc")?.directionFix).toBe(false);

    const runtimeScene = {
      ...scene,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    } as Parameters<typeof updateAutonomousNPCs>[0];
    for (let tick = 0; tick < 60; tick += 1) updateAutonomousNPCs(runtimeScene, 16);

    expect(scene.autonomousNPCs.get("npc")?.facing).toBe("right");
  });
});
