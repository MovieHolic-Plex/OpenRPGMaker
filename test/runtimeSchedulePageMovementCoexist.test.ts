// 일정을 가진 NPC 도 페이지 이동 유형(무작위/접근/추격/사용자 지정)을 쓸 수 있어야 한다.
// 일정은 "언제 어디에 있어야 하는가"만 소유한다. 일정 행이 있다는 사실만으로 이동 유형을
// 통째로 버리면, 시간 시스템이 켜진 프로젝트의 주민은 무작위를 줘도 영원히 제자리에 선다.
// 일정 경로가 실제로 무버를 몰고 있는 동안에만 페이지 이동 등록을 양보한다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import type { EventPage, GameEvent, GameMap, NpcScheduleEntry, Project } from "@/project/types";
import { event, mockSprite, pageWith } from "./runtimeEventPageFixtures";

function projectWith(schedule: NpcScheduleEntry[], movement: EventPage["movement"]): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.id = "map_start";
  project.maps = { map_start: map };
  project.startMapId = "map_start";
  project.mapTree = { mapId: "map_start", children: [] };
  project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60 };
  const npc: GameEvent = { ...event("npc", 1, 1, [pageWith({ movement })]), schedule };
  map.events = [npc];
  return { project, map };
}

function moveScene(project: Project, map: GameMap): Parameters<typeof registerPageMoveRoutes>[0] {
  store.replace(project);
  let scene: Parameters<typeof registerPageMoveRoutes>[0];
  scene = {
    map,
    session: { ...startSession(project), currentMapId: map.id },
    eventPositions: initialRuntimeEventPositions(map.events),
    pageMoveRouteKeys: new Set(),
    pageMoveRouteEventIds: new Set(),
    autonomousNPCs: new Map(),
    commandMoveRouteEventIds: new Set(),
    registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
    eventSprites: new Map([["npc", mockSprite()]]),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
    tileX: 0,
    tileY: 0,
  } as Parameters<typeof registerPageMoveRoutes>[0];
  return scene;
}

describe("일정과 페이지 이동 공존", () => {
  it("일정이 무버를 몰고 있지 않으면 무작위 이동이 등록된다", () => {
    const { project, map } = projectWith(
      [{ when: { timePhase: "night" }, at: { mapId: "map_start", x: 4, y: 4 } }],
      { type: "random", speed: 3, frequency: 3 },
    );
    const scene = moveScene(project, map);

    registerPageMoveRoutes(scene);

    expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("random");
  });

  it("일정 경로가 무버를 몰고 있는 동안에는 페이지 이동이 끼어들지 않는다", () => {
    const { project, map } = projectWith(
      [{ when: {}, at: { mapId: "map_start", x: 4, y: 4 } }],
      { type: "random", speed: 3, frequency: 3 },
    );
    const scene = moveScene(project, map);
    scene.registerAutonomousMover("npc", [{ kind: "move", dir: "right" }], false);
    scene.commandMoveRouteEventIds.add("npc");

    registerPageMoveRoutes(scene);

    expect(scene.autonomousNPCs.get("npc")?.strategy).toBe("sequence");
    expect(scene.pageMoveRouteEventIds.has("npc")).toBe(false);
  });
});
