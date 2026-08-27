// 사용자 시나리오를 예제 마을 실물 데이터로 재현한다: 시간 시스템이 켜진 프로젝트의
// 주민(일정 보유)에게 이동 유형 "무작위"를 주면 실제로 타일을 옮겨야 한다.
// 픽스처가 아니라 createSampleAdventureProject 의 실제 맵·통행 데이터를 쓰고,
// 런타임 제품 함수(registerPageMoveRoutes + updateAutonomousNPCs)를 그대로 굴린다.
import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { mockSprite } from "./runtimeEventPageFixtures";

describe("예제 마을 주민의 무작위 이동", () => {
  it("일정을 가진 주민이 이동 유형 무작위에서 실제로 타일을 옮긴다", () => {
    const project = createSampleAdventureProject();
    expect(project.system.timeSystem?.enabled, "예제 프로젝트의 시간 시스템이 꺼져 있다").toBe(true);
    const map = project.maps[project.startMapId]!;
    const villager = map.events.find((event) => (event.schedule?.length ?? 0) > 0 && (event.pages?.length ?? 0) > 0);
    if (!villager) throw new Error("일정을 가진 주민 이벤트가 예제 마을에 없다");
    for (const page of villager.pages!) {
      page.movement = { type: "random", speed: 6, frequency: 8 };
    }
    store.replace(project);

    const start = { x: villager.x, y: villager.y };
    let scene: Parameters<typeof updateAutonomousNPCs>[0] & Parameters<typeof registerPageMoveRoutes>[0];
    scene = {
      map,
      session: { ...startSession(project), currentMapId: map.id },
      eventPositions: initialRuntimeEventPositions(map.events),
      pageMoveRouteKeys: new Set(),
      pageMoveRouteEventIds: new Set(),
      commandMoveRouteEventIds: new Set(),
      autonomousNPCs: new Map(),
      registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
      eventSprites: new Map([[villager.id, mockSprite()]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
      tileX: 0,
      tileY: 0,
    } as typeof scene;

    registerPageMoveRoutes(scene);
    expect(scene.autonomousNPCs.get(villager.id)?.strategy).toBe("random");

    for (let tick = 0; tick < 400; tick += 1) updateAutonomousNPCs(scene, 16);

    const end = scene.eventPositions[villager.id]!;
    expect(
      `${end.x},${end.y}`,
      `주민 ${villager.id} 이 6.4초 동안 (${start.x},${start.y}) 에서 한 칸도 움직이지 않았다`,
    ).not.toBe(`${start.x},${start.y}`);
  });
});
