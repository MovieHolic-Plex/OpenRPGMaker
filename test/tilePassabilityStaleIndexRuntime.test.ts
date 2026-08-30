// 낡은 성분 색인이 **런타임 전체 사슬**에서도 추격을 포기시키지 않는다는 증거.
//
// 단위 테스트(tilePassabilityComponents.test.ts)는 색인 함수를 직접 불러 검증한다. 여기서
// 확인하는 것은 실제 사슬이다:
//   changeTile 명령 → setMapTileOverride(세션) → applyMapOverrides(제자리 타일 수정 + 색인 폐기)
//   → updateNpcSchedules → routeTo → findChasePath → terrainMayReach
// 이 사슬 어디에서 끊겨도 "벽이 열렸는데 주민이 계속 못 간다" 가 된다. 그건 성능 최적화가
// 게임을 망가뜨린 것이고, 색인 값(265×)보다 훨씬 비싼 손해다.
//
// 두 겹을 **따로** 시험한다.
//  1. applyMapOverrides 가 색인을 버리는 경로 (의도된 정상 경로)
//  2. 색인을 **버리지 않고** 타일만 제자리에서 고친 경로 — 지문 검증만으로 낡음을 잡아야 한다.
//     이쪽이 통과해야 "무효화 호출을 누가 지우면 조용히 깨진다" 가 아니게 된다.
import { describe, expect, it } from "vitest";
import { updateNpcSchedules } from "@/player/npcSchedules";
import { applyMapOverrides } from "@/player/playSceneMapRuntime";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { initialGameTime, setGameTimeClock } from "@/project/gameTime";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { setMapTileOverride, startSession } from "@/project/session";
import { store } from "@/project/store";
import { terrainMayReach } from "@/project/tilePassabilityComponents";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { mockSprite } from "./runtimeEventPageFixtures";

const SIZE = 12;
const MAP_ID = "map_stale_index";
/** 좌우를 가르는 벽 열. NPC 는 왼쪽(x=1), 목표는 오른쪽(x=SIZE-2). */
const WALL_X = 6;
/** 벽에 낼 문. NPC 와 같은 행이라 열리면 곧바로 경로가 생긴다. */
const DOOR = { x: WALL_X, y: 1 };

type ScheduleScene = Parameters<typeof updateNpcSchedules>[0] & Parameters<typeof updateAutonomousNPCs>[0];

function walledProject(): { readonly project: Project; readonly map: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("낡은 색인 테스트", SIZE, SIZE);
  map.id = MAP_ID;
  map.lowerTiles = new Array(SIZE * SIZE).fill(TILE.GRASS);
  map.upperTiles = new Array(SIZE * SIZE).fill(-1);
  for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + WALL_X] = TILE.WATER;
  map.events = [npcEvent()];
  project.startMapId = map.id;
  project.startPos = { x: 0, y: 0 };
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60, dayStartHour: 6, dayEndHour: 26 };
  return { project, map };
}

function npcEvent(): GameEvent {
  return {
    id: "npc",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    // 벽 반대편이 목표다 — 문이 닫혀 있으면 도달 불가.
    schedule: [
      {
        when: { hourRange: [6, 18] },
        at: { mapId: MAP_ID, x: SIZE - 2, y: 1 },
        activity: "work",
      },
    ],
    pages: [
      {
        id: "npc_base",
        name: "NPC",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      } satisfies EventPage,
    ],
  };
}

/**
 * loadMap 과 같은 방식으로 씬 맵을 만든다 — `mapWithCommittedEvents` 는 structuredClone 이라
 * 씬 맵은 프로젝트 맵과 **다른 객체**다. 색인이 어느 객체에 붙는지가 이 테스트의 핵심이라
 * 이 복제를 건너뛰면 실제와 다른 것을 시험하게 된다.
 */
function runtimeScene(project: Project, projectMap: GameMap): ScheduleScene {
  store.replace(project);
  const system = project.system.timeSystem;
  const time = setGameTimeClock(initialGameTime(system)!, 6, 0, system!);
  const sceneMap = mapWithCommittedEvents(projectMap);
  let scene: ScheduleScene;
  scene = {
    map: sceneMap,
    session: { ...startSession(project), currentMapId: sceneMap.id, gameTime: time },
    eventPositions: initialRuntimeEventPositions(sceneMap.events),
    autonomousNPCs: new Map(),
    commandMoveRouteEventIds: new Set(),
    registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
    refreshRuntimeSurfaces: () => undefined,
    syncRuntimeState: () => undefined,
    eventSprites: new Map([["npc", mockSprite()]]),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
    tileX: 0,
    tileY: 0,
  } as ScheduleScene;
  return scene;
}

/** applyChangeTileStep 이 하는 일 그대로 — 세션 오버라이드에 적고 현재 맵에 반영한다. */
function openDoorThroughRuntime(scene: ScheduleScene): void {
  const index = DOOR.y * SIZE + DOOR.x;
  setMapTileOverride(scene.session, MAP_ID, "lower", index, TILE.GRASS);
  applyMapOverrides({
    session: scene.session,
    map: scene.map,
    getMapId: () => MAP_ID,
  } as unknown as Parameters<typeof applyMapOverrides>[0]);
}

/** 시간표 점검을 N 번 돌린다. 실패 기억(SCHEDULE_ROUTE_RETRY_TICKS=10)을 넘기는 데 쓴다. */
function tickSchedules(scene: ScheduleScene, times: number): void {
  for (let index = 0; index < times; index += 1) updateNpcSchedules(scene);
}

function scheduleRouteStarted(scene: ScheduleScene): boolean {
  return scene.autonomousNPCs.has("npc");
}

describe("낡은 성분 색인이 런타임 사슬에서 주민을 가두지 않는다", () => {
  it("applyMapOverrides 로 문을 열면 주민이 다시 경로를 받는다", () => {
    const { project, map } = walledProject();
    const scene = runtimeScene(project, map);

    // 1) 문이 닫혀 있다 — 경로 탐색이 실패하고 그 자리에서 색인이 만들어진다.
    updateNpcSchedules(scene);
    expect(
      scheduleRouteStarted(scene),
      "벽이 막혀 있는데 경로가 생겼다 — 픽스처가 실제로 갈라지지 않았다"
    ).toBe(false);
    expect(
      terrainMayReach(project, scene.map, 1, 1, SIZE - 2, 1),
      "탐색 실패 뒤에도 색인이 만들어지지 않았다 — 이 테스트가 낡은 색인을 시험하지 못한다"
    ).toBe(false);

    // 2) changeTile 사슬로 문을 연다.
    openDoorThroughRuntime(scene);
    expect(scene.map.lowerTiles[DOOR.y * SIZE + DOOR.x]).toBe(TILE.GRASS);
    expect(
      terrainMayReach(project, scene.map, 1, 1, SIZE - 2, 1),
      "문을 열었는데 색인이 여전히 도달 불가라고 우긴다"
    ).toBe(true);

    // 3) 실패 기억이 풀리면 경로가 나와야 한다. 기억은 최대 10 점검(약 1초)이다.
    tickSchedules(scene, 12);
    expect(
      scheduleRouteStarted(scene),
      "문이 열렸는데 주민이 12번 점검 동안 경로를 못 받았다 — 최적화가 게임을 막았다"
    ).toBe(true);
  });

  it("무효화 호출이 없어도 지문만으로 낡음을 잡는다 (둘째 방어선)", () => {
    const { project, map } = walledProject();
    const scene = runtimeScene(project, map);

    updateNpcSchedules(scene);
    expect(scheduleRouteStarted(scene)).toBe(false);
    expect(terrainMayReach(project, scene.map, 1, 1, SIZE - 2, 1)).toBe(false);

    // applyMapOverrides 를 **부르지 않고** 타일만 제자리에서 고친다. 배열 identity 는 그대로다.
    const sameArray = scene.map.lowerTiles;
    scene.map.lowerTiles[DOOR.y * SIZE + DOOR.x] = TILE.GRASS;
    expect(scene.map.lowerTiles).toBe(sameArray);

    expect(
      terrainMayReach(project, scene.map, 1, 1, SIZE - 2, 1),
      "무효화가 없으면 지문이 낡음을 못 잡는다 — 방어선이 한 겹뿐이다"
    ).toBe(true);
    tickSchedules(scene, 12);
    expect(
      scheduleRouteStarted(scene),
      "지문만으로는 주민이 풀리지 않는다 — 무효화 호출을 지우면 조용히 깨진다"
    ).toBe(true);
  });

  it("문을 다시 막으면 주민이 멈춘다 (반대 방향도 성립)", () => {
    const { project, map } = walledProject();
    map.lowerTiles[DOOR.y * SIZE + DOOR.x] = TILE.GRASS;
    const scene = runtimeScene(project, map);

    updateNpcSchedules(scene);
    expect(scheduleRouteStarted(scene), "문이 열려 있는데 경로가 없다").toBe(true);

    // 걷던 경로를 지우고 문을 막는다 — 다음 점검에서 새 경로를 찾지 못해야 한다.
    scene.autonomousNPCs.delete("npc");
    scene.session.npcScheduleStates = {};
    setMapTileOverride(scene.session, MAP_ID, "lower", DOOR.y * SIZE + DOOR.x, TILE.WATER);
    applyMapOverrides({
      session: scene.session,
      map: scene.map,
      getMapId: () => MAP_ID,
    } as unknown as Parameters<typeof applyMapOverrides>[0]);

    tickSchedules(scene, 12);
    expect(
      scheduleRouteStarted(scene),
      "문을 막았는데 주민이 벽을 통과하는 경로를 받았다"
    ).toBe(false);
  });
});
