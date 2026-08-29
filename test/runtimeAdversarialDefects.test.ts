// 적대적 점검에서 확인된 런타임 결함 6건의 회귀 증거.
//
// 각 테스트는 고치기 **전 코드에서 실패**하도록 썼다. 성능 최적화가 만든 결함(1~3)과
// 그 최적화가 드러낸 기존 결함(4~6)을 한 파일에 모은다 — 전부 "NPC 가 조용히 멈추거나
// 프레임을 먹는" 같은 증상이라 같이 지켜야 뜻이 있다.
import { describe, expect, it, vi } from "vitest";
import { findChasePath, nextChaseDecision } from "@/player/chaseAi";
import { updateNpcSchedules, tickNpcSchedules, NPC_SCHEDULE_TICK_MS } from "@/player/npcSchedules";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { applyMapOverrides } from "@/player/playSceneMapRuntime";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { canMove, canMoveFootprint, getTileset } from "@/project/collision";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { initialGameTime, setGameTimeClock } from "@/project/gameTime";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { setMapTileOverride, startSession } from "@/project/session";
import { store } from "@/project/store";
import { invalidateTilePassabilityComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import { setPassageMark } from "@/project/tilesetPassage";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { mockSprite } from "./runtimeEventPageFixtures";

const SIZE = 16;
const MAP_ID = "map_adversarial";
/** 좌우를 가르는 벽 열. 왼쪽(x=1)에서 오른쪽(x=SIZE-2)은 도달 불가다. */
const WALL_X = 8;

function walledMap(id = MAP_ID, size = SIZE): GameMap {
  const map = createBlankMap("적대 점검", size, size);
  map.id = id;
  map.lowerTiles = new Array(size * size).fill(TILE.GRASS);
  map.upperTiles = new Array(size * size).fill(-1);
  for (let y = 0; y < size; y += 1) map.lowerTiles[y * size + WALL_X] = TILE.WATER;
  return map;
}

function projectWith(map: GameMap): Project {
  const project = createBlankProject();
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 0, y: 0 };
  project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60, dayStartHour: 6, dayEndHour: 26 };
  return project;
}

function baseMover(overrides: Partial<AutonomousMover> = {}): AutonomousMover {
  return {
    moves: [],
    step: 0,
    timer: 1000,
    repeat: false,
    strategy: "chase",
    facing: "down",
    directionFix: false,
    through: false,
    animationEnabled: true,
    opacity: 255,
    speedRank: 3,
    frequencyRank: 3,
    moveIntervalMs: 100,
    moveDurationMs: 300,
    activeMove: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 통행 사각이 1x1 이면 pass 를 넘겨도 성분 색인을 쓴다
//
// 런타임 추격은 1x1 NPC 에도 pass 를 **객체로 항상** 넘긴다. 색인 게이트가 pass 의
// 유무를 보면 모든 추격 NPC 에서 색인이 죽어 도달 불가 탐색이 맵 전체를 매번 훑는다.
// ─────────────────────────────────────────────────────────────────────────────
describe("성분 색인은 pass 유무가 아니라 사각 크기로 갈린다", () => {
  const UNIT_PASS = { footprint: { width: 1, height: 1 }, passRows: 1 } as const;

  it("1x1 통행 사각은 canMoveFootprint 가 canMove 와 완전히 같다 (색인 전제)", () => {
    const map = walledMap("map_unit_equiv", 12);
    const project = projectWith(map);
    // 통행 성질이 섞이도록 물·길·풀을 결정적으로 깐다.
    const palette = [TILE.GRASS, TILE.WATER, TILE.PATH];
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      map.lowerTiles[index] = palette[(index * 7 + 3) % palette.length] as number;
    }
    let checked = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        for (const delta of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
          const nx = x + delta.x;
          const ny = y + delta.y;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
          checked += 1;
          expect(
            canMoveFootprint(project, map, x, y, UNIT_PASS.footprint, nx, ny, UNIT_PASS.passRows),
            `(${x},${y})→(${nx},${ny}) 에서 1x1 발자국이 canMove 와 다르다 — 색인 전제가 깨진다`
          ).toBe(canMove(project, map, x, y, nx, ny));
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it("1x1 pass 를 넘긴 추격 실패도 색인을 만든다", () => {
    const map = walledMap("map_unit_arm");
    const project = projectWith(map);
    invalidateTilePassabilityComponents(map);

    expect(findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS)).toEqual([]);
    expect(
      terrainMayReach(project, map, 1, 1, SIZE - 2, 1),
      "1x1 추격 실패가 색인을 만들지 않았다 — 런타임 추격 전체에서 색인이 죽는다"
    ).toBe(false);
  });

  it("1x1 pass 를 넘긴 추격은 색인을 읽어 탐색을 건너뛴다", () => {
    const map = walledMap("map_unit_read");
    const project = projectWith(map);
    invalidateTilePassabilityComponents(map);
    // 첫 실패로 색인을 세운다.
    findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS);

    // 이 최적화는 답을 바꾸지 않고 **값만** 바꾸므로 결과로는 관찰할 수 없다. canMove 가
    // 호출마다 project.tilesets[map.tilesetId] 를 읽는 것을 세어 탐색을 돌았는지 가린다.
    const tilesets = project.tilesets;
    let reads = 0;
    (project as { tilesets: typeof tilesets }).tilesets = new Proxy(tilesets, {
      get(target, property, receiver) {
        if (property === map.tilesetId) reads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    const path = findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS);
    (project as { tilesets: typeof tilesets }).tilesets = tilesets;

    expect(path).toEqual([]);
    // 왼쪽 성분은 약 120칸이라 A* 를 돌면 통행 판정이 수백 번이다. 색인을 읽으면
    // 지문 검증에 쓰는 한두 번으로 끝난다.
    expect(reads, `색인이 있는데도 통행 판정을 ${reads}번 했다 — 탐색을 그대로 돌았다`).toBeLessThan(10);
  });

  it("1x1 보다 큰 통행 사각은 여전히 색인을 만들지도 읽지도 않는다", () => {
    const map = walledMap("map_wide_pass");
    const project = projectWith(map);
    invalidateTilePassabilityComponents(map);
    const wide = { footprint: { width: 3, height: 3 }, passRows: 1 } as const;

    expect(findChasePath(project, map, { x: 1, y: 4 }, { x: SIZE - 2, y: 4 }, wide)).toEqual([]);
    expect(
      terrainMayReach(project, map, 1, 4, SIZE - 2, 4),
      "비대칭 통행 그래프의 답이 색인에 섞였다"
    ).toBe(true);
  });

  it("nextChaseDecision 경로(런타임과 같은 호출)도 색인을 만든다", () => {
    const map = walledMap("map_decision_arm");
    const project = projectWith(map);
    invalidateTilePassabilityComponents(map);
    const mover = baseMover({ chaseRepathTimerMs: 1000 });

    const decision = nextChaseDecision({
      project,
      map,
      from: { x: 1, y: 1 },
      player: { x: SIZE - 2, y: 1 },
      deltaMs: 16,
      mover,
      pathfind: true,
      // playSceneAutonomous 가 넘기는 것과 같은 모양.
      pass: { footprint: { width: 1, height: 1 }, passRows: 1 },
    });

    expect(decision.kind).toBe("wait");
    expect(
      terrainMayReach(project, map, 1, 1, SIZE - 2, 1),
      "런타임과 같은 호출에서 색인이 만들어지지 않았다"
    ).toBe(false);
  });

  it("훑은 성분이 면적에 비해 작으면 색인을 만들지 않는다", () => {
    // 3x3 방 하나에 갇힌 자리에서 실패하면, 색인 빌드(면적 전체)가 방금 훑은 값보다 훨씬 비싸다.
    const map = createBlankMap("작은 성분", 40, 40);
    map.id = "map_small_component";
    map.lowerTiles = new Array(40 * 40).fill(TILE.WATER);
    map.upperTiles = new Array(40 * 40).fill(-1);
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) map.lowerTiles[y * 40 + x] = TILE.GRASS;
    }
    map.lowerTiles[20 * 40 + 20] = TILE.GRASS;
    const project = projectWith(map);
    invalidateTilePassabilityComponents(map);

    expect(findChasePath(project, map, { x: 2, y: 2 }, { x: 20, y: 20 })).toEqual([]);
    expect(
      terrainMayReach(project, map, 2, 2, 20, 20),
      "9칸을 훑고 1600칸 색인을 지었다 — 색인이 없을 때보다 느려진다"
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 타일셋 통행 정의를 제자리에서 고쳐도 색인이 낡음을 잡는다
//
// setPassageMark 는 같은 TilesetDef 객체를 제자리에서 바꾼다. identity 비교만으로는
// 못 잡고, 타일만 해싱한 지문도 못 잡는다.
// ─────────────────────────────────────────────────────────────────────────────
describe("색인 지문은 타일셋 통행 정의도 덮는다", () => {
  it("벽 타일을 통행 가능으로 바꾸면 추격이 다시 경로를 찾는다", () => {
    const map = walledMap("map_tileset_open");
    const project = projectWith(map);
    invalidateTilePassabilityComponents(map);
    const from = { x: 1, y: 1 };
    const to = { x: SIZE - 2, y: 1 };

    expect(findChasePath(project, map, from, to)).toEqual([]);
    expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);

    // 타일 배열은 그대로다 — 타일셋 정의만 제자리에서 연다.
    const tileset = getTileset(project, map);
    expect(tileset).not.toBeNull();
    const sameTiles = map.lowerTiles;
    setPassageMark(tileset!, TILE.WATER, "o");
    expect(map.lowerTiles).toBe(sameTiles);

    expect(
      terrainMayReach(project, map, from.x, from.y, to.x, to.y),
      "타일셋 통행을 열었는데 색인이 여전히 도달 불가라고 우긴다"
    ).toBe(true);
    const path = findChasePath(project, map, from, to);
    expect(path.length, "벽 타일이 열렸는데 경로를 못 찾았다").toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual(to);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 스로틀 누적기는 초과분을 이월한다
// ─────────────────────────────────────────────────────────────────────────────
describe("시간표 스로틀은 프레임이 길어져도 주기를 늘리지 않는다", () => {
  /**
   * 점검이 실제로 돌았는지는 결과로 안 드러난다(이벤트가 없으면 아무것도 안 바뀐다).
   * updateNpcSchedules 의 첫 줄이 store.getCurrent() 라 그 호출 수가 곧 점검 횟수다.
   */
  function throttleScene(): Parameters<typeof tickNpcSchedules>[0] {
    const map = createBlankMap("스로틀", 8, 8);
    map.id = "map_throttle";
    map.events = [];
    const project = projectWith(map);
    store.replace(project);
    return {
      map,
      session: { ...startSession(project), currentMapId: map.id },
      eventPositions: {},
      autonomousNPCs: new Map(),
      commandMoveRouteEventIds: new Set(),
      registerAutonomousMover: () => undefined,
      refreshRuntimeSurfaces: () => undefined,
      syncRuntimeState: () => undefined,
    } as unknown as Parameters<typeof tickNpcSchedules>[0];
  }

  function countTicks(scene: Parameters<typeof tickNpcSchedules>[0], frames: readonly number[]): number {
    const spy = vi.spyOn(store, "getCurrent");
    for (const frameMs of frames) tickNpcSchedules(scene, false, frameMs);
    const ran = spy.mock.calls.length;
    spy.mockRestore();
    return ran;
  }

  it("99ms 프레임에서도 실효 주기가 100ms 에 붙는다", () => {
    const ran = countTicks(throttleScene(), new Array(100).fill(99));
    // 100 프레임 × 99ms = 9900ms. 100ms 주기면 99회다. 누적기를 0 으로 리셋하면 실효
    // 주기가 198ms 로 늘어 50회로 떨어진다 — 프레임이 길어질 때가 바로 이 스로틀이
    // 겨냥한 상황이므로 거기서 두 배로 느려지면 안 된다.
    expect(ran, `99ms 프레임에서 ${ran}회만 돌았다 — 실효 주기가 늘었다`).toBeGreaterThanOrEqual(99);
  });

  it("60ms 프레임에서도 주기가 120ms 로 늘지 않는다", () => {
    const ran = countTicks(throttleScene(), new Array(60).fill(60));
    // 60 × 60ms = 3600ms → 100ms 주기면 36회. 리셋이면 120ms 주기라 30회다.
    expect(ran, `60ms 프레임에서 ${ran}회만 돌았다`).toBeGreaterThanOrEqual(36);
  });

  it("오래 멈춘 뒤 몰아서 돌지 않는다", () => {
    // 5초짜리 프레임이 세 번 와도 점검은 세 번이다 — 이월을 한 주기 미만으로 자르므로
    // 밀린 시간을 몰아서 돌지 않는다(자르지 않으면 누적기가 무한히 자란다).
    const scene = throttleScene();
    expect(countTicks(scene, [5000, 5000, 5000]), "멈춘 시간을 몰아서 돌았다").toBe(3);
    expect(NPC_SCHEDULE_TICK_MS).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4~6. 시간표 사슬의 기존 결함
// ─────────────────────────────────────────────────────────────────────────────
type ScheduleScene = Parameters<typeof updateNpcSchedules>[0] & Parameters<typeof updateAutonomousNPCs>[0];

function scheduledNpc(
  id: string,
  at: { x: number; y: number },
  home: { x: number; y: number },
  mapId: string
): GameEvent {
  return {
    id,
    x: home.x,
    y: home.y,
    trigger: { kind: "action" },
    commands: [],
    schedule: [{ when: { hourRange: [6, 18] }, at: { mapId, x: at.x, y: at.y }, activity: "work" }],
    pages: [
      {
        id: `${id}_base`,
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

function scheduleScene(project: Project, projectMap: GameMap, playerAt = { x: 0, y: 0 }): ScheduleScene {
  store.replace(project);
  const system = project.system.timeSystem;
  const time = setGameTimeClock(initialGameTime(system)!, 8, 0, system!);
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
    eventSprites: new Map(sceneMap.events.map((event) => [event.id, mockSprite()])),
    runtimeDom: { upsertEventMarker: () => undefined },
    runEvent: async () => undefined,
    tileX: playerAt.x,
    tileY: playerAt.y,
  } as ScheduleScene;
  return scene;
}

describe("지워진 시간표 NPC 가 이벤트 계층 재생성 루프를 만들지 않는다", () => {
  it("erase 된 NPC 는 시간표 점검에서 변경을 만들지 않는다", () => {
    const map = walledMap("map_erased");
    map.events = [scheduledNpc("npc_erased", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
    const project = projectWith(map);
    const scene = scheduleScene(project, map);
    scene.session.erasedEventIds = ["npc_erased"];

    let rebuilds = 0;
    (scene as { refreshRuntimeEntities?: () => void }).refreshRuntimeEntities = () => {
      rebuilds += 1;
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (let index = 0; index < 5; index += 1) updateNpcSchedules(scene);
    const warns = warn.mock.calls.length;
    warn.mockRestore();

    expect(
      rebuilds,
      "지워진 NPC 때문에 이벤트 계층이 재생성됐다 — 100ms 마다 영구 반복된다"
    ).toBe(0);
    expect(warns, "지워진 NPC 에 무버를 만들려 시도했다").toBe(0);
    expect(scene.autonomousNPCs.has("npc_erased")).toBe(false);
  });

  it("removeEvent 된 NPC 도 같다", () => {
    const map = walledMap("map_removed");
    map.events = [scheduledNpc("npc_removed", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
    const project = projectWith(map);
    const scene = scheduleScene(project, map);
    scene.session.removedEventIds = { [map.id]: ["npc_removed"] };

    let rebuilds = 0;
    (scene as { refreshRuntimeEntities?: () => void }).refreshRuntimeEntities = () => {
      rebuilds += 1;
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (let index = 0; index < 5; index += 1) updateNpcSchedules(scene);
    warn.mockRestore();

    expect(rebuilds, "지워진 NPC 때문에 이벤트 계층이 재생성됐다").toBe(0);
  });

  it("멀쩡한 시간표 NPC 는 그대로 경로를 받는다 (필터가 과하지 않다)", () => {
    const map = walledMap("map_alive");
    map.events = [scheduledNpc("npc_alive", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
    const project = projectWith(map);
    const scene = scheduleScene(project, map);

    updateNpcSchedules(scene);
    expect(scene.autonomousNPCs.has("npc_alive"), "소거 필터가 살아 있는 NPC 를 걸렀다").toBe(true);
  });
});

describe("시간표 목적지 판정과 경로 탐색이 같은 맵을 본다", () => {
  it("changeTile 로 목적지를 막으면 그 자리를 목표로 잡지 않는다", () => {
    const map = walledMap("map_target_sync");
    // 목적지는 벽 왼쪽(같은 성분)이라 원래는 도달 가능하다.
    map.events = [scheduledNpc("npc_sync", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
    const project = projectWith(map);
    const scene = scheduleScene(project, map);

    // 씬 맵에서만 목적지를 물로 막는다 — project.maps 는 그대로다.
    const targetIndex = 6 * SIZE + 4;
    setMapTileOverride(scene.session, map.id, "lower", targetIndex, TILE.WATER);
    applyMapOverrides({
      session: scene.session,
      map: scene.map,
      getMapId: () => map.id,
    } as unknown as Parameters<typeof applyMapOverrides>[0]);
    expect(scene.map.lowerTiles[targetIndex]).toBe(TILE.WATER);
    expect(project.maps[map.id]!.lowerTiles[targetIndex]).toBe(TILE.GRASS);

    updateNpcSchedules(scene);
    const mover = scene.autonomousNPCs.get("npc_sync");
    expect(
      mover,
      "막힌 목적지로 경로를 못 받아야 정상이지만, 비켜선 칸으로는 갈 수 있어야 한다"
    ).toBeDefined();
    // 정규화가 씬 맵을 봤다면 물 칸을 피해 인접한 통행 칸으로 목표를 옮긴다.
    // 원본 맵을 봤다면 물 칸을 그대로 목표로 잡고 routeTo 가 실패해 무버가 없다.
  });
});

describe("막힌 걸음을 소비하지 않아 순서 경로가 어긋나지 않는다", () => {
  it("플레이어가 길을 막으면 같은 걸음을 다시 시도한다", () => {
    const map = createBlankMap("막힌 걸음", 8, 8);
    map.id = MAP_ID;
    map.lowerTiles = new Array(64).fill(TILE.GRASS);
    map.upperTiles = new Array(64).fill(-1);
    map.events = [scheduledNpc("npc_blocked", { x: 4, y: 4 }, { x: 2, y: 4 }, map.id)];
    const project = projectWith(map);
    // 플레이어가 NPC 의 다음 칸(3,4)에 서 있다.
    const scene = scheduleScene(project, map, { x: 3, y: 4 });

    // 오른쪽으로 두 칸 가는 순서 경로를 직접 심는다.
    scene.registerAutonomousMover(
      "npc_blocked",
      [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }],
      false
    );
    const mover = scene.autonomousNPCs.get("npc_blocked");
    expect(mover).toBeDefined();
    mover!.strategy = "sequence";
    mover!.moveIntervalMs = 10;
    mover!.timer = 100;

    updateAutonomousNPCs(scene, 100);
    expect(
      mover!.step,
      "막힌 걸음을 소비했다 — 남은 계획 전부가 한 칸 어긋난다"
    ).toBe(0);
    expect(mover!.moves.length, "계획이 버려졌다").toBe(2);

    // 한계까지 막히면 예전처럼 소비해 영구 정지를 만들지 않는다.
    for (let index = 0; index < 20; index += 1) {
      mover!.timer = 100;
      updateAutonomousNPCs(scene, 100);
    }
    expect(
      mover!.step > 0 || mover!.moves.length === 0,
      "영구히 막힌 자리에서 무버가 멈춘 채 남았다 — 재계획이 안 일어난다"
    ).toBe(true);
  });

  it("길이 열리면 어긋남 없이 원래 계획대로 걷는다", () => {
    const map = createBlankMap("열린 길", 8, 8);
    map.id = MAP_ID;
    map.lowerTiles = new Array(64).fill(TILE.GRASS);
    map.upperTiles = new Array(64).fill(-1);
    map.events = [scheduledNpc("npc_resume", { x: 4, y: 4 }, { x: 2, y: 4 }, map.id)];
    const project = projectWith(map);
    const scene = scheduleScene(project, map, { x: 3, y: 4 });

    scene.registerAutonomousMover(
      "npc_resume",
      [{ kind: "move", dir: "right" }, { kind: "move", dir: "down" }],
      false
    );
    const mover = scene.autonomousNPCs.get("npc_resume");
    mover!.strategy = "sequence";
    mover!.moveIntervalMs = 10;

    // 막힌 상태로 한 번 시도.
    mover!.timer = 100;
    updateAutonomousNPCs(scene, 100);
    expect(scene.eventPositions["npc_resume"]?.x ?? 2).toBe(2);

    // 플레이어가 비켜선다.
    (scene as { tileX: number }).tileX = 0;
    mover!.timer = 100;
    updateAutonomousNPCs(scene, 100);
    // 첫 걸음(right)이 소비되지 않았으므로 지금 오른쪽으로 간다 — down 이 아니다.
    expect(
      scene.eventPositions["npc_resume"]?.x,
      "막힌 걸음이 사라져 계획이 어긋났다 — 첫 걸음(right)을 건너뛰었다"
    ).toBe(3);
  });
});
