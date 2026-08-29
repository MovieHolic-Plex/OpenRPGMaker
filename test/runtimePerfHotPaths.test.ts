import { describe, expect, it } from "vitest";
import {
  findChasePath,
  nearestReachableCandidate,
  nextChaseDecision,
  type ChaseRuntimeState,
} from "@/player/chaseAi";
import { NPC_SCHEDULE_TICK_MS, tickNpcSchedules, updateNpcSchedules } from "@/player/npcSchedules";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { initialGameTime, setGameTimeClock } from "@/project/gameTime";
import { appendTileToStack, clearTileStack, tileStackAt, topTileInStack } from "@/project/mapOverlayTiles";
import { initialRuntimeEventPositions, runtimeEventViewById, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { GameEvent, GameMap, MoveCommand, NpcScheduleEntry, Project } from "@/project/types";
import { mockSprite } from "./runtimeEventPageFixtures";

function openMap(id: string, size = 12): GameMap {
  const map = createBlankMap("경로 테스트", size, size);
  map.id = id;
  map.lowerTiles = new Array(size * size).fill(TILE.GRASS);
  map.upperTiles = new Array(size * size).fill(-1);
  return map;
}

function projectWith(...maps: GameMap[]): Project {
  const project = createBlankProject();
  project.maps = Object.fromEntries(maps.map((map) => [map.id, map]));
  project.mapTree = {
    mapId: maps[0].id,
    children: maps.slice(1).map((map) => ({ mapId: map.id, children: [] })),
  };
  project.startMapId = maps[0].id;
  project.startPos = { x: 0, y: 0 };
  return project;
}

describe("findChasePath (힙 + 정수 키)", () => {
  it("빈 맵에서 맨해튼 거리와 같은 길이의 인접 경로를 낸다", () => {
    const map = openMap("map_astar_open");
    const project = projectWith(map);
    store.replace(project);

    const from = { x: 0, y: 0 };
    const to = { x: 11, y: 7 };
    const path = findChasePath(project, map, from, to);

    expect(path).toHaveLength(11 + 7);
    expect(path[path.length - 1]).toEqual(to);
    // 시작 칸은 결과에 없고 각 걸음은 4방향 한 칸이다.
    let cursor = from;
    for (const step of path) {
      expect(Math.abs(step.x - cursor.x) + Math.abs(step.y - cursor.y)).toBe(1);
      cursor = step;
    }
    expect(path.some((step) => step.x === from.x && step.y === from.y)).toBe(false);
  });

  it("벽을 돌아가는 경로도 최단이다", () => {
    const map = openMap("map_astar_wall");
    // x=5 열을 y=0..10 까지 물로 막고 y=11 한 칸만 남긴다.
    for (let y = 0; y <= 10; y += 1) map.lowerTiles[y * map.width + 5] = TILE.WATER;
    const project = projectWith(map);
    store.replace(project);

    const path = findChasePath(project, map, { x: 4, y: 0 }, { x: 6, y: 0 });
    // 아래로 11칸 → 오른쪽 2칸 → 위로 11칸.
    expect(path).toHaveLength(11 + 2 + 11);
    expect(path[path.length - 1]).toEqual({ x: 6, y: 0 });
    expect(path.every((step) => map.lowerTiles[step.y * map.width + step.x] !== TILE.WATER)).toBe(true);
  });

  it("갈린 맵에서는 빈 경로를 낸다", () => {
    const map = openMap("map_astar_split");
    for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 5] = TILE.WATER;
    const project = projectWith(map);
    store.replace(project);

    expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 11, y: 11 })).toEqual([]);
  });

  it("맵 밖 좌표와 제자리 목표는 빈 경로다", () => {
    const map = openMap("map_astar_bounds");
    const project = projectWith(map);
    store.replace(project);

    expect(findChasePath(project, map, { x: -1, y: 0 }, { x: 3, y: 3 })).toEqual([]);
    expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 99, y: 0 })).toEqual([]);
    expect(findChasePath(project, map, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([]);
  });
});

describe("nearestReachableCandidate (후보 396개 A* 대체 BFS)", () => {
  it("가장 가까운 후보를 고르고 동률은 배열 순서로 끊는다", () => {
    const map = openMap("map_bfs_near");
    const project = projectWith(map);
    store.replace(project);

    const from = { x: 5, y: 5 };
    // 먼 후보를 먼저 넣어도 가까운 쪽이 이긴다.
    expect(nearestReachableCandidate(project, map, from, [{ x: 11, y: 5 }, { x: 7, y: 5 }]))
      .toEqual({ x: 7, y: 5 });
    // 거리가 같으면 배열에서 앞선 것.
    expect(nearestReachableCandidate(project, map, from, [{ x: 5, y: 8 }, { x: 8, y: 5 }]))
      .toEqual({ x: 5, y: 8 });
    expect(nearestReachableCandidate(project, map, from, [{ x: 8, y: 5 }, { x: 5, y: 8 }]))
      .toEqual({ x: 8, y: 5 });
  });

  it("from 자신이 후보면 즉시 이긴다", () => {
    const map = openMap("map_bfs_self");
    const project = projectWith(map);
    store.replace(project);

    expect(nearestReachableCandidate(project, map, { x: 4, y: 4 }, [{ x: 4, y: 5 }, { x: 4, y: 4 }]))
      .toEqual({ x: 4, y: 4 });
  });

  it("닿을 수 없는 후보를 건너뛰고 닿는 것만 고른다", () => {
    const map = openMap("map_bfs_blocked");
    for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 6] = TILE.WATER;
    const project = projectWith(map);
    store.replace(project);

    // (7,3) 은 벽 반대편이라 닿지 않는다 — 더 멀지만 같은 쪽인 (1,3) 이 답이다.
    expect(nearestReachableCandidate(project, map, { x: 5, y: 3 }, [{ x: 7, y: 3 }, { x: 1, y: 3 }]))
      .toEqual({ x: 1, y: 3 });
    expect(nearestReachableCandidate(project, map, { x: 5, y: 3 }, [{ x: 7, y: 3 }])).toBeNull();
  });

  it("accept 가 거절한 후보는 고르지 않는다", () => {
    const map = openMap("map_bfs_accept");
    const project = projectWith(map);
    store.replace(project);

    const rejected: string[] = [];
    const picked = nearestReachableCandidate(
      project,
      map,
      { x: 5, y: 5 },
      [{ x: 6, y: 5 }, { x: 7, y: 5 }],
      (point) => {
        if (point.x === 6) {
          rejected.push(`${point.x},${point.y}`);
          return false;
        }
        return true;
      }
    );
    expect(picked).toEqual({ x: 7, y: 5 });
    // accept 는 닿은 후보에만 불린다 — 맵 전체 칸에 돌지 않는다.
    expect(rejected).toEqual(["6,5"]);
  });

  it("맵 밖에서 출발하면 null 이다", () => {
    const map = openMap("map_bfs_oob");
    const project = projectWith(map);
    store.replace(project);
    expect(nearestReachableCandidate(project, map, { x: -1, y: 0 }, [{ x: 0, y: 0 }])).toBeNull();
  });
});

describe("추격 재탐색 스로틀", () => {
  function mover(): ChaseRuntimeState {
    return { timer: 0, moveIntervalMs: 0 };
  }

  it("도달 불가 표적은 재탐색 주기까지 다시 탐색하지 않는다", () => {
    const map = openMap("map_chase_blocked");
    for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 5] = TILE.WATER;
    const project = projectWith(map);
    store.replace(project);

    const state = mover();
    const input = { project, map, from: { x: 1, y: 1 }, player: { x: 9, y: 9 }, mover: state };

    expect(nextChaseDecision({ ...input, deltaMs: 16 })).toEqual({ kind: "wait" });
    expect(state.chasePathBlocked).toBe(true);
    expect(state.chaseRepathTimerMs).toBe(0);

    // 경로가 비어 있지만 막힌 것으로 기억하므로 재탐색을 건너뛴다 — 타이머만 쌓인다.
    nextChaseDecision({ ...input, deltaMs: 16 });
    expect(state.chaseRepathTimerMs).toBe(16);
    nextChaseDecision({ ...input, deltaMs: 16 });
    expect(state.chaseRepathTimerMs).toBe(32);

    // 주기를 넘기면 다시 본다(길이 열렸을 수 있으므로 영구 포기는 아니다).
    nextChaseDecision({ ...input, deltaMs: 500 });
    expect(state.chaseRepathTimerMs).toBe(0);
    expect(state.chasePathBlocked).toBe(true);
  });

  it("길이 열리면 같은 표적에 경로가 다시 잡힌다", () => {
    const map = openMap("map_chase_opens");
    for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 5] = TILE.WATER;
    const project = projectWith(map);
    store.replace(project);

    const state = mover();
    const input = { project, map, from: { x: 1, y: 1 }, player: { x: 9, y: 9 }, mover: state };
    nextChaseDecision({ ...input, deltaMs: 16 });
    expect(state.chasePathBlocked).toBe(true);

    map.lowerTiles[3 * map.width + 5] = TILE.GRASS;
    store.replace(project);
    const decision = nextChaseDecision({ ...input, deltaMs: 500 });
    expect(decision.kind).toBe("move");
    expect(state.chasePathBlocked).toBe(false);
  });

  it("도달 가능한 표적은 경로가 소진되면 즉시 다시 탐색한다", () => {
    const map = openMap("map_chase_open");
    const project = projectWith(map);
    store.replace(project);

    const state = mover();
    const input = { project, map, from: { x: 1, y: 1 }, player: { x: 4, y: 1 }, mover: state };
    expect(nextChaseDecision({ ...input, deltaMs: 16 }).kind).toBe("move");
    expect(state.chasePathBlocked).toBe(false);

    state.chasePath = [];
    // 막히지 않았으므로 스로틀에 걸리지 않고 바로 재탐색한다.
    expect(nextChaseDecision({ ...input, deltaMs: 1 }).kind).toBe("move");
    expect(state.chaseRepathTimerMs).toBe(0);
  });
});

describe("tickNpcSchedules 주기", () => {
  function scheduleScene(schedule: NpcScheduleEntry[]) {
    const map = openMap("map_tick", 8);
    const event: GameEvent = {
      id: "npc",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      schedule,
      pages: [{
        id: "npc_base",
        name: "NPC",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      }],
    };
    map.events = [event];
    const project = projectWith(map);
    project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60, dayStartHour: 6, dayEndHour: 26 };
    store.replace(project);
    const system = project.system.timeSystem;
    const time = setGameTimeClock(initialGameTime(system)!, 8, 0, system);
    // eslint-disable-next-line prefer-const
    let scene: Parameters<typeof updateNpcSchedules>[0];
    scene = {
      map,
      session: { ...startSession(project), currentMapId: map.id, gameTime: time },
      eventPositions: initialRuntimeEventPositions(map.events),
      autonomousNPCs: new Map(),
      commandMoveRouteEventIds: new Set(),
      registerAutonomousMover: (eventId: string, moves: MoveCommand[], repeat: boolean) =>
        registerAutonomousMover(scene as never, eventId, moves, repeat),
      refreshRuntimeSurfaces: () => undefined,
      syncRuntimeState: () => undefined,
      eventSprites: new Map([["npc", mockSprite()]]),
      runtimeDom: { upsertEventMarker: () => undefined },
      runEvent: async () => undefined,
      tileX: 0,
      tileY: 0,
    } as never;
    return scene;
  }

  /** updateNpcSchedules 는 언제나 npcActivities 를 되살린다 — 본문이 돌았는지의 관측점. */
  function ran(scene: Parameters<typeof updateNpcSchedules>[0], deltaMs: number): boolean {
    delete scene.session.npcActivities;
    tickNpcSchedules(scene, false, deltaMs);
    return scene.session.npcActivities !== undefined;
  }

  it("첫 호출은 즉시 돌고 이후는 주기마다 돈다", () => {
    const scene = scheduleScene([
      { when: { hourRange: [6, 18] }, at: { mapId: "map_tick", x: 5, y: 5 }, activity: "work" },
    ]);

    expect(ran(scene, 16)).toBe(true);
    // 100ms 가 차기 전에는 본문을 건너뛴다.
    expect(ran(scene, 16)).toBe(false);
    expect(ran(scene, 16)).toBe(false);
    expect(ran(scene, NPC_SCHEDULE_TICK_MS)).toBe(true);
    expect(ran(scene, 16)).toBe(false);
  });

  it("음수 delta 는 누적을 되돌리지 않는다", () => {
    const scene = scheduleScene([
      { when: { hourRange: [6, 18] }, at: { mapId: "map_tick", x: 5, y: 5 }, activity: "work" },
    ]);
    expect(ran(scene, 16)).toBe(true);
    expect(ran(scene, -1000)).toBe(false);
    expect(ran(scene, NPC_SCHEDULE_TICK_MS)).toBe(true);
  });
});

describe("runtimeEventViewById", () => {
  it("배열을 만들지 않고 같은 뷰를 찾는다", () => {
    const map = openMap("map_view_home", 8);
    map.events = [
      { id: "a", x: 1, y: 1, trigger: { kind: "action" }, commands: [] },
      { id: "b", x: 2, y: 2, trigger: { kind: "action" }, commands: [] },
    ];
    const away = openMap("map_view_away", 8);
    away.events = [{ id: "c", x: 3, y: 3, trigger: { kind: "action" }, commands: [] }];
    const project = projectWith(map, away);
    store.replace(project);
    const session = { ...startSession(project), currentMapId: map.id };
    const positions = initialRuntimeEventPositions([...map.events, ...away.events]);

    const views = runtimeEventViewsForMap(project, map, session, positions);
    expect(views.map((view) => view.event.id)).toEqual(["a", "b"]);
    expect(runtimeEventViewById(project, map, session, positions, "b")).toEqual(views[1]);
    // 다른 맵에 있는 이벤트는 이 맵의 질의 대상이 아니다.
    expect(runtimeEventViewById(project, map, session, positions, "c")).toBeUndefined();
    expect(runtimeEventViewById(project, map, session, positions, "없음")).toBeUndefined();
  });

  it("이 맵으로 옮겨진 이벤트도 찾는다", () => {
    const map = openMap("map_view_home2", 8);
    map.events = [{ id: "a", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }];
    const away = openMap("map_view_away2", 8);
    away.events = [{ id: "c", x: 3, y: 3, trigger: { kind: "action" }, commands: [] }];
    const project = projectWith(map, away);
    store.replace(project);
    const session = {
      ...startSession(project),
      currentMapId: map.id,
      eventLocations: { c: { mapId: map.id, x: 4, y: 4 } },
    };
    const positions = initialRuntimeEventPositions([...map.events, ...away.events]);

    const moved = runtimeEventViewById(project, map, session, positions, "c");
    expect(moved).toMatchObject({ x: 4, y: 4 });
    expect(runtimeEventViewsForMap(project, map, session, positions).map((view) => view.event.id))
      .toEqual(["a", "c"]);
  });

  it("지워진 이벤트는 찾지 않는다", () => {
    const map = openMap("map_view_erased", 8);
    map.events = [{ id: "a", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }];
    const project = projectWith(map);
    store.replace(project);
    const session = { ...startSession(project), currentMapId: map.id, erasedEventIds: ["a"] };
    const positions = initialRuntimeEventPositions(map.events);

    expect(runtimeEventViewById(project, map, session, positions, "a")).toBeUndefined();
    expect(runtimeEventViewsForMap(project, map, session, positions)).toEqual([]);
  });
});

describe("tileStackAt 은 맵을 건드리지 않는다", () => {
  it("읽기만 해도 저작된 스택 기록이 사라지지 않는다", () => {
    const map = openMap("map_stack", 4);
    map.lowerTileStacks = { 5: [TILE.GRASS, TILE.WATER] };
    map.upperTileStacks = { 6: [234] };

    expect(tileStackAt(map, "lower", 5)).toEqual([]);
    expect(topTileInStack(map, "lower", 5)).toBeUndefined();
    expect(tileStackAt(map, "upper", 6)).toEqual([]);

    // 렌더 경로가 store 의 살아 있는 맵을 넘기므로 읽기는 반드시 순수해야 한다.
    expect(map.lowerTileStacks).toEqual({ 5: [TILE.GRASS, TILE.WATER] });
    expect(map.upperTileStacks).toEqual({ 6: [234] });
  });

  it("쓰기 함수와 명시적 clearTileStack 만 기록을 지운다", () => {
    const map = openMap("map_stack_write", 4);
    map.lowerTileStacks = { 5: [TILE.GRASS], 6: [TILE.WATER] };

    appendTileToStack(map, "lower", 5, TILE.WATER);
    expect(map.lowerTileStacks).toEqual({ 6: [TILE.WATER] });

    clearTileStack(map, "lower", 6);
    expect(map.lowerTileStacks).toBeUndefined();
  });
});
