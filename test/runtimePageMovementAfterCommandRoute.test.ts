// 명령 "이동 루트 설정"이 끝난 뒤 페이지 이동(무작위/접근/추격/사용자 지정)이 되살아나야 한다.
// 명령 무버가 제거될 때 pageMoveRouteKeys/EventIds 는 남아 있으므로, 재등록 판정이 키만 보면
// "이미 등록됨" 분기로 들어가 무버 없이 continue 하고 NPC 가 맵 재로드까지 영구 정지한다.
import { describe, expect, it } from "vitest";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { movementScene } from "./runtimeEventPageFixtures";

describe("명령 이동 루트 이후의 페이지 이동 복귀", () => {
  it("명령 루트가 끝난 NPC 는 페이지 이동 무버를 다시 얻는다", () => {
    const scene = movementScene({ movement: { type: "random", speed: 4, frequency: 8 } });
    registerPageMoveRoutes(scene);
    expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("random");

    const commandMoveRouteEventIds = new Set<string>(["npc"]);
    registerAutonomousMover(scene, "npc", [], false);
    const runtimeScene = {
      ...scene,
      commandMoveRouteEventIds,
      tileX: 9,
      tileY: 9,
      eventSprites: new Map(),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
    } as Parameters<typeof updateAutonomousNPCs>[0];

    updateAutonomousNPCs(runtimeScene, 16);
    expect(scene.autonomousNPCs.has("npc")).toBe(false);
    expect(scene.pageMoveRouteEventIds.has("npc")).toBe(true);

    registerPageMoveRoutes(scene);

    expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("random");
  });
});
