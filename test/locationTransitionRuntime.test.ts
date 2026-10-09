// 「구역에 들어오면/나가면」 — **런타임 배선**을 실제 걸음/순간이동으로 검사한다.
//
// 왜 runSceneTest 인가: 이 하네스는 걸음 완료 → 드나듦 → 접촉 → 인카운터 순서와 순간이동
// 절차를 출하 씬(`playSceneMovement` / `playSceneMapCommands`)과 같은 산법으로 돌린다.
// 판정 자체는 `project/locationTransitions.ts` 한 곳이고, 여기서는 «그 판정이 정말로
// 이벤트를 돌리는가» 와 «돌리지 말아야 할 때 안 돌리는가» 를 본다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { addMapLocation, deleteMapLocation, resizeMapLocation } from "@/project/mapNamedLocations";
import { runSceneTest } from "@/testing/sceneTestRunner";
import {
  drainPendingLocationTransitions,
  fireLocationTransitionTriggers,
  fireLocationTransitionTriggersAfterTransfer,
  seedLocationOccupancyForScene,
} from "@/player/playSceneLocationTransitions";
import type { Command, EventPage, GameEvent, GameMap, Project, Trigger } from "@/project/types";

const ENTERED = "sw_entered";
const LEFT = "sw_left";
const ENTER_COUNT = "var_enter_count";

function blankMap(id: string, name: string, width = 16, height = 16): GameMap {
  return {
    id,
    name,
    width,
    height,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(width * height).fill(TILE.GRASS),
    upperTiles: new Array(width * height).fill(TILE.EMPTY),
    events: [],
  };
}

/**
 * 맵 하나에 광장(2,2 6×6)이 있는 프로젝트. 스위치 두 개와 카운터 변수 하나를 미리 선언한다
 * (선언 없는 id 는 startSession 이 시드하지 않는다).
 */
function projectWithPlaza(): { project: Project; mapId: string; plazaId: string } {
  const project = createBlankProject();
  project.switches = [...project.switches, { id: ENTERED, name: "들어옴" }, { id: LEFT, name: "나감" }];
  project.variables = [...project.variables, { id: ENTER_COUNT, name: "진입 횟수" }];
  const map = blankMap("map_plaza", "광장 맵");
  project.maps[map.id] = map;
  project.startMapId = map.id;
  project.session = { ...project.session, startMapId: map.id, startX: 0, startY: 0 };
  const plaza = addMapLocation(map, { name: "정문 광장", x: 2, y: 2, w: 6, h: 6 });
  if (!plaza.ok) throw new Error("fixture");
  return { project, mapId: map.id, plazaId: plaza.location.id };
}

function transitionEvent(options: {
  readonly id: string;
  readonly locationId: string;
  readonly transition: "enter" | "leave";
  readonly commands: readonly Command[];
  /** 페이지에 트리거를 두면 이벤트 트리거 대신 페이지 트리거가 이긴다(런타임 규칙). */
  readonly onPage?: boolean;
  readonly x?: number;
  readonly y?: number;
}): GameEvent {
  const trigger: Trigger = {
    kind: "locationTransition",
    locationId: options.locationId,
    transition: options.transition,
  };
  // 페이지가 있으면 **페이지 트리거가 이긴다**(`runtimeEventView`: `page.trigger ?? event.trigger`).
  // 그러니 «이벤트 트리거로 저작» 을 검사하려면 페이지가 **없어야** 한다(레거시 꼴).
  // 이 분기를 헷갈리면 페이지의 action 트리거가 조용히 이기며 «안 도는 트리거» 를 검사하게 된다.
  if (!options.onPage) {
    return {
      id: options.id,
      // 이벤트 본체는 구역 밖 구석에 둔다 — 발동은 «주인공이 어디 있나» 로만 정해지고
      // 이벤트 좌표와 무관하다는 것도 이 배치가 증명한다.
      x: options.x ?? 14,
      y: options.y ?? 14,
      trigger,
      commands: [...options.commands],
    };
  }
  const page: EventPage = {
    id: `${options.id}_p1`,
    name: "구역 반응",
    conditions: [],
    graphic: {},
    trigger,
    priority: "below",
    overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [...options.commands],
  };
  return {
    id: options.id,
    x: options.x ?? 14,
    y: options.y ?? 14,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}

const setSwitch = (switchId: string): Command => ({ kind: "setSwitch", switchId, value: true });
const bumpCounter: Command = { kind: "setVariable", variableId: ENTER_COUNT, op: "+=", value: 1 };

describe("location transition trigger — 걸음으로 드나들면 발동한다", () => {
  it("구역 경계를 밟는 걸음에서 enter 이벤트가 실행된다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_enter",
      locationId: plazaId,
      transition: "enter",
      commands: [setSwitch(ENTERED)],
    })];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 2 },
      steps: [
        { kind: "expect", switchOff: ENTERED },
        { kind: "move", dir: "right" },
        { kind: "expect", playerAt: { x: 2, y: 2 }, switchOn: ENTERED },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("페이지 트리거로 저작해도 같다 (페이지 트리거가 이벤트 트리거를 이긴다)", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_enter_page",
      locationId: plazaId,
      transition: "enter",
      commands: [setSwitch(ENTERED)],
      onPage: true,
    })];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 3 },
      steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOn: ENTERED }],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("구역을 벗어나는 걸음에서 leave 이벤트가 실행된다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_leave",
      locationId: plazaId,
      transition: "leave",
      commands: [setSwitch(LEFT)],
    })];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 2, y: 2 },
      steps: [
        // 시작 지점이 이미 안이라 «들어옴» 은 없다(기준선). 밖으로 한 걸음.
        { kind: "expect", switchOff: LEFT },
        { kind: "move", dir: "left" },
        { kind: "expect", playerAt: { x: 1, y: 2 }, switchOn: LEFT },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("구역 안을 계속 걸어도 enter 는 한 번뿐이다 (같은 칸·인접 칸 재진입 없음)", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_count",
      locationId: plazaId,
      transition: "enter",
      commands: [bumpCounter],
    })];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 3 },
      steps: [
        { kind: "move", dir: "right" },
        { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 } },
        { kind: "move", dir: "right" },
        { kind: "move", dir: "down" },
        { kind: "move", dir: "left" },
        { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 } },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("나갔다 다시 들어오면 두 번째 enter 가 난다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_count",
      locationId: plazaId,
      transition: "enter",
      commands: [bumpCounter],
    })];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 3 },
      steps: [
        { kind: "move", dir: "right" },
        { kind: "move", dir: "left" },
        { kind: "move", dir: "right" },
        { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 2 } },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("시작 지점이 구역 안이면 부팅만으로는 enter 가 나지 않는다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_enter",
      locationId: plazaId,
      transition: "enter",
      commands: [setSwitch(ENTERED)],
    })];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 4, y: 4 },
      steps: [{ kind: "expect", switchOff: ENTERED }],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("다른 구역의 트리거는 발동하지 않는다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    const dock = addMapLocation(project.maps[mapId]!, { name: "부두", x: 11, y: 11, w: 3, h: 3 });
    expect(dock.ok).toBe(true);
    if (!dock.ok) return;
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_dock",
      locationId: dock.location.id,
      transition: "enter",
      commands: [setSwitch(ENTERED)],
      x: 0,
      y: 0,
    })];
    void plazaId;

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 3 },
      steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOff: ENTERED }],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});

describe("location transition trigger — 겹친 구역", () => {
  it("광장 안에서 좌판에 들어가면 좌판 enter 만 나고 광장 enter 는 다시 나지 않는다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    const stall = addMapLocation(project.maps[mapId]!, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
    expect(stall.ok).toBe(true);
    if (!stall.ok) return;
    project.maps[mapId]!.events = [
      transitionEvent({ id: "ev_plaza", locationId: plazaId, transition: "enter", commands: [bumpCounter], x: 0, y: 0 }),
      transitionEvent({ id: "ev_stall", locationId: stall.location.id, transition: "enter", commands: [setSwitch(ENTERED)], x: 15, y: 0 }),
    ];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 4 },
      steps: [
        { kind: "move", dir: "right" }, // (2,4) 광장 진입
        { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 }, switchOff: ENTERED },
        { kind: "move", dir: "right" }, // (3,4) 광장 안
        { kind: "move", dir: "right" }, // (4,4) 좌판 진입
        { kind: "expect", switchOn: ENTERED, variableEquals: { variableId: ENTER_COUNT, value: 1 } },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("좌판에서 광장으로 되돌아 나오면 좌판 leave 만 난다 (광장 leave 는 없다)", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    const stall = addMapLocation(project.maps[mapId]!, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
    expect(stall.ok).toBe(true);
    if (!stall.ok) return;
    project.maps[mapId]!.events = [
      transitionEvent({ id: "ev_stall_out", locationId: stall.location.id, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
      transitionEvent({ id: "ev_plaza_out", locationId: plazaId, transition: "leave", commands: [setSwitch(ENTERED)], x: 15, y: 0 }),
    ];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 4, y: 4 },
      steps: [
        { kind: "move", dir: "left" }, // (3,4): 좌판 밖, 광장 안
        { kind: "expect", switchOn: LEFT, switchOff: ENTERED },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});

describe("location transition trigger — 순간이동(중간 걸음 없음)", () => {
  function projectWithTwoMaps(): { project: Project; plazaId: string; hallId: string } {
    const { project, mapId, plazaId } = projectWithPlaza();
    const inner = blankMap("map_hall", "회관");
    project.maps[inner.id] = inner;
    const hall = addMapLocation(inner, { name: "회관 안", x: 1, y: 1, w: 6, h: 6 });
    if (!hall.ok) throw new Error("fixture");
    void mapId;
    return { project, plazaId, hallId: hall.location.id };
  }

  it("구역 안에서 다른 맵으로 순간이동하면 출발 구역의 leave 가 실행된다", () => {
    const { project, plazaId } = projectWithTwoMaps();
    project.maps.map_plaza!.events = [
      transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
      // 광장 안 (3,3) 을 밟으면 회관으로 보내는 접촉 이벤트.
      {
        id: "ev_door",
        x: 3,
        y: 3,
        trigger: { kind: "playerTouch" },
        commands: [{ kind: "transfer", mapId: "map_hall", x: 10, y: 10 }],
      },
    ];

    const result = runSceneTest(project, {
      mapId: "map_plaza",
      start: { x: 3, y: 2 },
      steps: [
        { kind: "move", dir: "down" },
        { kind: "expect", mapId: "map_hall", playerAt: { x: 10, y: 10, mapId: "map_hall" }, switchOn: LEFT },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("도착 지점이 구역 안이면 그 구역의 enter 가 실행된다", () => {
    const { project, hallId } = projectWithTwoMaps();
    project.maps.map_hall!.events = [transitionEvent({
      id: "ev_hall_enter",
      locationId: hallId,
      transition: "enter",
      commands: [setSwitch(ENTERED)],
      x: 12,
      y: 12,
    })];
    project.maps.map_plaza!.events = [{
      id: "ev_door",
      x: 3,
      y: 3,
      trigger: { kind: "playerTouch" },
      // 도착 좌표 (2,2) 는 회관 구역(1,1 6×6) 안이다.
      commands: [{ kind: "transfer", mapId: "map_hall", x: 2, y: 2 }],
    }];

    const result = runSceneTest(project, {
      mapId: "map_plaza",
      start: { x: 3, y: 2 },
      steps: [
        { kind: "move", dir: "down" },
        { kind: "expect", mapId: "map_hall", switchOn: ENTERED },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("같은 맵 안 순간이동으로 구역을 벗어나도 leave 가 실행된다", () => {
    const { project, plazaId } = projectWithPlaza();
    project.maps[project.startMapId]!.events = [
      transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
      {
        id: "ev_warp",
        x: 3,
        y: 3,
        trigger: { kind: "playerTouch" },
        commands: [{ kind: "transfer", mapId: project.startMapId, x: 12, y: 12 }],
      },
    ];

    const result = runSceneTest(project, {
      mapId: project.startMapId,
      start: { x: 3, y: 2 },
      steps: [
        { kind: "move", dir: "down" },
        { kind: "expect", playerAt: { x: 12, y: 12 }, switchOn: LEFT },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("구역 안에서 같은 구역 안으로 순간이동하면 leave 와 enter 가 둘 다 난다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [
      transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
      transitionEvent({ id: "ev_enter", locationId: plazaId, transition: "enter", commands: [bumpCounter], x: 15, y: 0 }),
      {
        id: "ev_warp",
        x: 3,
        y: 3,
        trigger: { kind: "playerTouch" },
        commands: [{ kind: "transfer", mapId, x: 6, y: 6 }],
      },
    ];

    const result = runSceneTest(project, {
      mapId,
      start: { x: 3, y: 2 },
      steps: [
        { kind: "move", dir: "down" },
        // (2,2)..(7,7) 안에서 안으로 옮겨졌다: 구역을 벗어났다 돌아온 것이므로 둘 다 난다.
        { kind: "expect", playerAt: { x: 6, y: 6 }, switchOn: LEFT, variableEquals: { variableId: ENTER_COUNT, value: 1 } },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});

describe("location transition trigger — 저작이 깨진 상태", () => {
  it("삭제된 구역을 가리키는 트리거는 조용히 실행되지 않는다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_enter",
      locationId: plazaId,
      transition: "enter",
      commands: [setSwitch(ENTERED)],
      x: 0,
      y: 0,
    })];
    expect(deleteMapLocation(project.maps[mapId]!, plazaId)).toBe(true);

    const result = runSceneTest(project, {
      mapId,
      start: { x: 1, y: 3 },
      steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOff: ENTERED }],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("구역이 축소되어 발밑을 벗어나면 다음 걸음에서 leave 가 실행된다", () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    project.maps[mapId]!.events = [transitionEvent({
      id: "ev_leave",
      locationId: plazaId,
      transition: "leave",
      commands: [setSwitch(LEFT)],
      x: 0,
      y: 0,
    })];
    // 광장을 (2,2) 2×2 로 축소한다 — 주인공이 서게 될 (7,7) 은 이제 밖이다.
    expect(resizeMapLocation(project.maps[mapId]!, plazaId, { x: 2, y: 2, w: 2, h: 2 }).ok).toBe(true);

    const result = runSceneTest(project, {
      mapId,
      // 축소 전 광장이었던 (7,7) 근처에서 시작해 축소된 구역 밖을 걷는다.
      start: { x: 7, y: 7 },
      steps: [
        // 시작 기준선이 이미 «밖» 이므로 leave 도 나지 않는다 — 저작 편집은 사건이 아니다.
        { kind: "expect", switchOff: LEFT },
        { kind: "move", dir: "right" },
        { kind: "expect", switchOff: LEFT },
        // 축소된 구역(2,2 2×2)에 실제로 들어갔다 나오면 leave 가 난다.
        { kind: "walk", to: { x: 2, y: 2 } },
        { kind: "move", dir: "left" },
        { kind: "expect", switchOn: LEFT },
      ],
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});

// ── 실행이 «밀리는» 경로 ──────────────────────────────────────────────────────
//
// 브라우저 실측으로 발견한 결함의 회귀다(2026-09-10): 문(playerTouch)을 밟아 장소 이동하면
// `transferTo` 가 **문 이벤트의 인터프리터 안에서** 불리므로 그 시점 `scene.running` 이
// 참이고 `runEvent` 가 즉시 되돌아 나온다 — 가장 흔한 저작(문으로 구역에 들어가기)의
// enter 이벤트가 한 번도 돌지 않았다. 이제 실행할 수 없었던 것은 큐에 담기고
// `refreshRuntimeSurfaces`(= 이벤트가 끝나는 자리)에서 뽑힌다.
//
// 씬 대역을 쓰는 이유: 이 결함은 Phaser 씬의 `running` 수명에 걸린 배선 문제이고,
// runSceneTest 하네스는 이벤트를 중첩 실행하므로(running 개념이 없다) 이 경로를 재현하지 못한다.
describe("location transition trigger — 진행 중이면 밀리고 이벤트가 끝나면 돌아온다", () => {
  type StubScene = {
    map: GameMap;
    session: { occupiedLocationIds?: Record<string, string[]> };
    tileX: number;
    tileY: number;
    running: boolean;
    ran: string[];
    activeRuntimeEvents: (kind: string) => { event: { id: string }; trigger: Trigger }[];
    runEvent: (eventId: string) => Promise<void>;
  };

  function stubScene(map: GameMap, triggers: readonly { id: string; trigger: Trigger }[]): StubScene {
    const scene: StubScene = {
      map,
      session: {},
      tileX: 1,
      tileY: 3,
      running: false,
      ran: [],
      activeRuntimeEvents: (kind) => kind === "locationTransition"
        ? triggers.map((entry) => ({ event: { id: entry.id }, trigger: entry.trigger }))
        : [],
      runEvent: async (eventId) => { scene.ran.push(eventId); },
    };
    return scene;
  }

  it("running 중의 순간이동 진입은 버려지지 않고 이벤트 종료 후 실행된다", async () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    const map = project.maps[mapId]!;
    const scene = stubScene(map, [
      { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
    ]);
    seedLocationOccupancyForScene(scene);

    // 문 이벤트가 도는 중이다.
    scene.running = true;
    scene.tileX = 4;
    scene.tileY = 4;
    fireLocationTransitionTriggersAfterTransfer(scene, mapId);
    await Promise.resolve();
    expect(scene.ran).toEqual([]);
    // 점유 기록은 밀림과 무관하게 이미 갱신됐다.
    expect(scene.session.occupiedLocationIds?.[mapId]).toEqual([plazaId]);

    // 이벤트가 끝나 running 이 내려간 자리에서 뽑힌다.
    scene.running = false;
    drainPendingLocationTransitions(scene);
    await Promise.resolve();
    expect(scene.ran).toEqual(["ev_enter"]);

    // 두 번 뽑아도 다시 돌지 않는다.
    drainPendingLocationTransitions(scene);
    await Promise.resolve();
    expect(scene.ran).toEqual(["ev_enter"]);
  });

  it("running 중의 걸음 진입도 같은 자리에서 회복된다", async () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    const map = project.maps[mapId]!;
    const scene = stubScene(map, [
      { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
    ]);
    seedLocationOccupancyForScene(scene);

    scene.running = true;
    scene.tileX = 3;
    scene.tileY = 3;
    fireLocationTransitionTriggers(scene);
    await Promise.resolve();
    expect(scene.ran).toEqual([]);

    scene.running = false;
    drainPendingLocationTransitions(scene);
    await Promise.resolve();
    expect(scene.ran).toEqual(["ev_enter"]);
  });

  it("한 사건에 두 이벤트가 반응하면 첫 이벤트가 대화를 열어도 두 번째가 살아남는다", async () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    const map = project.maps[mapId]!;
    const trigger: Trigger = { kind: "locationTransition", locationId: plazaId, transition: "enter" };
    const scene = stubScene(map, [{ id: "ev_first", trigger }, { id: "ev_second", trigger }]);
    seedLocationOccupancyForScene(scene);
    // 첫 이벤트가 대화를 열어 running 을 세우는 상황을 흉내낸다.
    scene.runEvent = async (eventId) => {
      scene.ran.push(eventId);
      if (eventId === "ev_first") scene.running = true;
    };

    scene.tileX = 3;
    scene.tileY = 3;
    fireLocationTransitionTriggers(scene);
    await Promise.resolve();
    await Promise.resolve();
    expect(scene.ran).toEqual(["ev_first"]);

    scene.running = false;
    drainPendingLocationTransitions(scene);
    await Promise.resolve();
    // 이미 돌린 첫 이벤트가 다시 뽑히지 않는다 — 꼬리만 이어 간다.
    expect(scene.ran).toEqual(["ev_first", "ev_second"]);
  });

  it("기준선 심기는 이전 세션의 밀린 사건을 물려받지 않는다", async () => {
    const { project, mapId, plazaId } = projectWithPlaza();
    const map = project.maps[mapId]!;
    const scene = stubScene(map, [
      { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
    ]);
    seedLocationOccupancyForScene(scene);
    scene.running = true;
    scene.tileX = 3;
    scene.tileY = 3;
    fireLocationTransitionTriggers(scene);
    await Promise.resolve();

    // 세이브 불러오기 = 새 기준선. 밀린 사건은 버려진다.
    scene.running = false;
    seedLocationOccupancyForScene(scene);
    drainPendingLocationTransitions(scene);
    await Promise.resolve();
    expect(scene.ran).toEqual([]);
  });
});
