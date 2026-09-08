/** @vitest-environment happy-dom */
// OPRN-OUT-016 — 이동 경로 설정의 「통과 ON/OFF」가 **주인공** 대상에서도 듣는가.
//
// 결함은 실행기의 default 분기에 있었다: NPC 쪽(playSceneAutonomousCommands.executeInstantCommand)
// 은 setThrough 를 mover.through 로 받는데, 주인공 쪽(playSceneMovement.applyPlayerRouteCommand)
// 은 case 가 없어 조용히 삼켰다. 그래서 커맨드 JSON·경로 미리보기만 보는 테스트로는 절대 못 잡는다 —
// 여기서는 Studio 가 쓴 커맨드를 직렬화 왕복(저장·로드)시킨 뒤 인터프리터로 dispatch 하고,
// 실제 updatePlayScene 프레임으로 걷게 해서 **좌표**로 판정한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputState } from "@/player/input";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { runCommands } from "@/player/playSceneInterpreter";
import { transferTo } from "@/player/playSceneMapCommands";
import { updatePlayScene } from "@/player/playSceneMovement";
import { applyNonBlockingStep, registerAutonomousMover } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { createBlankProject, TILE } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, GameMap, MoveCommand } from "@/project/types";
import { event, mockSprite, page } from "./runtimeEventPageFixtures";

const FRAME_MS = 1000 / 60;
/** 160ms 걸음 = 10 논리 프레임. 한 걸음에 여유를 둔 프레임 수. */
const STEP_FRAMES = 12;
/**
 * NPC 한 걸음 분량의 프레임. NPC 루트는 걸음 간격(rank 3 = 560ms)까지 기다리므로
 * 주인공(간격 없음)보다 훨씬 느리다 — 여기서 주인공 프레임 수를 쓰면 아무것도 안 움직인다.
 */
const NPC_FRAMES = 120;
const DONE_SWITCH = "sw_route_done";

type RouteSpec = {
  /** 이 커맨드 묶음을 담는 트리거 이벤트 id. `commands(id)` 로 꺼낸다. */
  readonly id: string;
  /** moveEvent 대상 — 주인공 센티넬이거나 NPC 이벤트 id. */
  readonly target: string;
  readonly moves: readonly MoveCommand[];
  readonly repeat?: boolean;
  readonly wait?: boolean;
};

type AuthoredProject = {
  readonly map: GameMap;
  commands(id: string): readonly Command[];
};

/**
 * Studio 가 authored 한 커맨드를 **직렬화 왕복**시켜 스토어에 앉힌다.
 *
 * 왕복을 넣는 이유: setThrough 는 validateMoveCommandShape(shapeCommandFields) 를 통과해야
 * 저장·로드에서 살아남고, 이 이슈의 수락 기준이 "저장된 커맨드 데이터와 Test Play 동작이
 * 일치" 이기 때문이다. 한 프로젝트에 모든 루트를 한꺼번에 심는다 — 테스트 중간에 store 를
 * 갈아 끼우면 harness 가 들고 있는 map/session 이 스토어의 것과 갈라진다.
 */
function authorProject(specs: readonly RouteSpec[], buildMap?: (map: GameMap) => void): AuthoredProject {
  const draft = createBlankProject();
  // 저장 검사(validateProjectReferences)는 setSwitch 대상이 선언돼 있어야 통과시킨다.
  draft.switches = [...draft.switches, { id: DONE_SWITCH, name: "루트 완료" }];
  const draftMap = draft.maps[draft.startMapId]!;
  draftMap.lowerTiles.fill(TILE.GRASS);
  draftMap.upperTiles.fill(TILE.EMPTY);
  draftMap.encounterRate = 0;
  draftMap.events = [];
  buildMap?.(draftMap);
  specs.forEach((spec, index) => {
    draftMap.events.push(
      event(spec.id, index, 0, [
        {
          ...page(spec.id, "below", { kind: "action" }),
          commands: [
            {
              kind: "moveEvent",
              eventId: spec.target,
              route: { moves: [...spec.moves], repeat: spec.repeat === true, wait: spec.wait === true },
            },
            { kind: "setSwitch", switchId: DONE_SWITCH, value: true },
          ],
        },
      ])
    );
  });
  const project = store.replace(deserialize(serialize(draft)));
  const map = project.maps[project.startMapId]!;
  return {
    map,
    commands(id) {
      const trigger = map.events.find((entry) => entry.id === id);
      const authored = trigger?.pages?.[0];
      if (authored === undefined) throw new Error(`authored commands missing after persistence round trip: ${id}`);
      return authored.commands;
    },
  };
}

type RouteHarness = {
  readonly scene: PlaySceneContext;
  hold(state: Partial<InputState>): void;
  /** 한 논리 프레임 + 그 프레임에 예약된 rAF(완료 폴링) 를 함께 돌린다. */
  step(count?: number): void;
};

function routeHarness(map: GameMap): RouteHarness {
  const project = store.getCurrent();
  const session = startSession(project);
  session.currentMapId = map.id;
  session.x = 5;
  session.y = 5;
  const player = {
    x: 0,
    y: 0,
    depth: 0,
    setFrame: () => undefined,
    setPosition(x: number, y: number): void {
      this.x = x;
      this.y = y;
    },
    setDepth(depth: number): void {
      this.depth = depth;
    },
    setOrigin: () => undefined,
    setVisible: () => undefined,
  };
  const idle: InputState = {
    dir: null, x: 0, y: 0, dash: false,
    actionPressed: false, confirmPressed: false, attackPressed: false, skillPressed: false,
  };
  let held: InputState = idle;
  const registry = new Map<string, unknown>([[
    "dialogue",
    {
      showText: vi.fn(async () => undefined),
      showChoices: vi.fn(async () => 0),
      showNumberInput: vi.fn(async () => 0),
      hide: vi.fn(),
      close: vi.fn(),
    },
  ]]);
  const eventSprites = new Map<string, unknown>();
  for (const entry of map.events) eventSprites.set(entry.id, mockSprite());
  let scene: PlaySceneContext;
  scene = {
    game: {
      canvas: { parentElement: null, ownerDocument: { querySelector: () => null } },
      registry: { get: (key: string) => registry.get(key) },
    },
    session,
    map,
    input_: {
      update: () => held,
      resetEdges: () => undefined,
      setEnabled: () => undefined,
      clearDirectionTaps: () => undefined,
    },
    player,
    playerSprite: resolvePlayerSpriteResource(project, session),
    tileX: 5,
    tileY: 5,
    movingFrom: { x: 5, y: 5 },
    movingTo: { x: 5, y: 5 },
    moving: false,
    moveProgress: 0,
    moveElapsedFrames: 0,
    moveDurationMs: 160,
    logicTickAccumulatorMs: 0,
    dashing: false,
    facing: "down",
    walkFrame: 0,
    walkTimer: 0,
    lastActionTargetKey: "",
    playerRoute: null,
    playerHop: null,
    eventPositions: initialRuntimeEventPositions(map.events),
    autonomousNPCs: new Map(),
    commandMoveRouteEventIds: new Set(),
    pageMoveRouteEventIds: new Set(),
    pageMoveRouteKeys: new Set(),
    eventSprites,
    followerSprites: new Map(),
    characterShadows: new Map(),
    characterHopScales: new Map(),
    eventGraphicPatternOverrides: new Map(),
    runtimeDom: { upsertEventMarker: () => undefined },
    running: false,
    inputEnabled: true,
    registerAutonomousMover: (eventId: string, moves: MoveCommand[], repeat: boolean) =>
      registerAutonomousMover(scene, eventId, moves, repeat),
    updateAutonomousNPCs: (deltaMs: number) => updateAutonomousNPCs(scene, deltaMs),
    updateParallelEvents: () => undefined,
    updateTimers: () => undefined,
    updateFieldSpawns: () => undefined,
    syncRuntimeState: () => undefined,
    refreshRuntimeSurfaces: () => undefined,
    refreshRuntimeEntities: () => undefined,
    centerCamera: () => undefined,
    loadMap: () => undefined,
    setInputEnabled: (enabled: boolean) => { scene.inputEnabled = enabled; },
    showRuntimeOverlay: () => undefined,
    clearRuntimeOverlay: () => undefined,
    runEvent: async () => undefined,
    add: { sprite: () => player },
  } as unknown as PlaySceneContext;
  return {
    scene,
    hold(state) {
      held = { ...idle, ...state };
    },
    step(count = 1) {
      for (let index = 0; index < count; index += 1) {
        updatePlayScene(scene, FRAME_MS);
        flushFrames();
      }
    },
  };
}

// waitForPlayerRouteComplete 는 requestAnimationFrame 으로 폴링한다. 실제 rAF 에 맡기면
// 프레임 진행과 폴링의 순서가 어긋나 30초 타임아웃까지 매달리므로 손으로 돌린다.
const pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;

function installManualFrames(): void {
  pendingFrames.clear();
  nextFrameId = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    nextFrameId += 1;
    pendingFrames.set(nextFrameId, callback);
    return nextFrameId;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((frameId) => {
    pendingFrames.delete(frameId);
  });
}

function flushFrames(): void {
  const batch = [...pendingFrames.values()];
  pendingFrames.clear();
  for (const callback of batch) callback(performance.now());
}

/** 커맨드를 dispatch 하고 프레임을 돌린다. wait:true 루트는 이 프레임들 안에서 끝난다. */
async function playCommands(harness: RouteHarness, commands: readonly Command[], frames: number): Promise<void> {
  const pending = runCommands(harness.scene, commands);
  harness.step(frames);
  await pending;
}

function wall(map: GameMap, x: number, y: number): void {
  map.lowerTiles[y * map.width + x] = TILE.WALL;
}

afterEach(() => {
  vi.restoreAllMocks();
  pendingFrames.clear();
});

describe("주인공 이동 경로의 통과 ON/OFF (OPRN-OUT-016)", () => {
  function terrainFixture(): AuthoredProject {
    return authorProject(
      [
        { id: "through_on", target: PLAYER_MOVE_TARGET, wait: true,
          moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "right" }, { kind: "move", dir: "right" }] },
        { id: "through_off", target: PLAYER_MOVE_TARGET, wait: true,
          moves: [
            { kind: "setThrough", enabled: true },
            { kind: "move", dir: "right" },
            { kind: "setThrough", enabled: false },
            { kind: "move", dir: "right" },
          ] },
        { id: "no_through", target: PLAYER_MOVE_TARGET, wait: true,
          moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }] },
      ],
      (map) => { wall(map, 6, 5); wall(map, 7, 5); }
    );
  }

  it("통과 ON 이면 통행 불가 지형을 밟고 지나간다 — 저장된 커맨드 → 인터프리터 → 실제 걸음", async () => {
    installManualFrames();
    const authored = terrainFixture();
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("through_on"), STEP_FRAMES * 3);

    expect([harness.scene.tileX, harness.scene.tileY]).toEqual([7, 5]);
    // wait:true 루트가 실제로 완료 신호를 냈다 — 뒤 커맨드까지 실행됐다.
    expect(harness.scene.session.switches[DONE_SWITCH]).toBe(true);
    expect(harness.scene.playerRoute).toBeNull();
  });

  it("통과 OFF 는 다음 걸음부터 즉시 충돌을 되돌린다", async () => {
    installManualFrames();
    const authored = terrainFixture();
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("through_off"), STEP_FRAMES * 3);

    expect([harness.scene.tileX, harness.scene.tileY]).toEqual([6, 5]);
  });

  it("통과 없이 같은 지형을 지나려 하면 제자리다 — 통과가 원인임을 못 박는 대조군", async () => {
    installManualFrames();
    const authored = terrainFixture();
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("no_through"), STEP_FRAMES * 3);

    expect([harness.scene.tileX, harness.scene.tileY]).toEqual([5, 5]);
  });

  it("통과 ON 은 솔리드 이벤트(same 우선순위)도 지나가고, 통과가 없으면 여전히 막힌다", async () => {
    installManualFrames();
    const authored = authorProject(
      [
        { id: "event_through", target: PLAYER_MOVE_TARGET, wait: true,
          moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "right" }] },
        { id: "event_blocked", target: PLAYER_MOVE_TARGET, wait: true,
          moves: [{ kind: "move", dir: "right" }] },
      ],
      (map) => { map.events.push(event("statue", 6, 5, [page("statue", "same", { kind: "action" })])); }
    );

    const blocked = routeHarness(authored.map);
    await playCommands(blocked, authored.commands("event_blocked"), STEP_FRAMES * 2);
    expect([blocked.scene.tileX, blocked.scene.tileY]).toEqual([5, 5]);

    const passing = routeHarness(authored.map);
    await playCommands(passing, authored.commands("event_through"), STEP_FRAMES * 2);
    expect([passing.scene.tileX, passing.scene.tileY]).toEqual([6, 5]);
  });

  it("통과 ON 이어도 맵 밖으로는 나가지 않는다", async () => {
    installManualFrames();
    const authored = authorProject([
      { id: "out_of_bounds", target: PLAYER_MOVE_TARGET, wait: true,
        moves: [
          { kind: "setThrough", enabled: true },
          { kind: "move", dir: "left" },
          { kind: "move", dir: "left" },
          { kind: "move", dir: "up" },
        ] },
    ]);
    const harness = routeHarness(authored.map);
    harness.scene.tileX = 0;
    harness.scene.tileY = 0;
    harness.scene.movingFrom = { x: 0, y: 0 };
    harness.scene.movingTo = { x: 0, y: 0 };

    await playCommands(harness, authored.commands("out_of_bounds"), STEP_FRAMES * 4);

    expect([harness.scene.tileX, harness.scene.tileY]).toEqual([0, 0]);
  });
});

describe("주인공 통과 상태의 수명 (OPRN-OUT-016)", () => {
  function lifetimeFixture(): AuthoredProject {
    return authorProject(
      [
        { id: "long_through", target: PLAYER_MOVE_TARGET,
          moves: [
            { kind: "setThrough", enabled: true },
            { kind: "move", dir: "right" },
            { kind: "move", dir: "right" },
            { kind: "move", dir: "right" },
          ] },
        { id: "plain_step", target: PLAYER_MOVE_TARGET, wait: true,
          moves: [{ kind: "move", dir: "right" }] },
      ],
      (map) => { wall(map, 6, 5); wall(map, 7, 5); }
    );
  }

  it("루트 취소(stopAllMovement) 뒤에 시작한 루트는 통과가 꺼진 상태로 출발한다", async () => {
    installManualFrames();
    const authored = lifetimeFixture();
    const harness = routeHarness(authored.map);

    // 통과 ON 이 켜진 채 첫 걸음만 시작시킨다.
    await playCommands(harness, authored.commands("long_through"), 1);
    expect(harness.scene.playerRoute?.through).toBe(true);

    // 「모든 이동 정지」는 authored Command 가 아니라 인터프리터 StepResult 다 — 런타임이 그 스텝을
    // 받는 실제 통로(applyNonBlockingStep)로 취소시킨다. 이미 허가된 걸음은 착지만 한다.
    applyNonBlockingStep(harness.scene, { kind: "stopAllMovement" });
    expect(harness.scene.playerRoute).toBeNull();
    harness.step(STEP_FRAMES);
    expect(harness.scene.tileX).toBe(6);

    // 통과 명령이 없는 새 루트는 (7,5) 벽 앞에서 멈춘다 — 취소된 루트의 통과가 새 루트로 새지 않는다.
    await playCommands(harness, authored.commands("plain_step"), STEP_FRAMES * 2);
    expect(harness.scene.tileX).toBe(6);
  });

  it("루트 교체는 통과를 물려주지 않는다", async () => {
    installManualFrames();
    const authored = lifetimeFixture();
    const harness = routeHarness(authored.map);

    // 첫 걸음만 시작시킨다 — 통과 ON 이 켜진 루트가 진행 중인 상태를 만든다.
    await playCommands(harness, authored.commands("long_through"), 1);
    expect(harness.scene.playerRoute?.through).toBe(true);

    // 교체 루트에는 통과 명령이 없다 → 새 PlayerRouteState 는 통과가 꺼져 있어야 한다.
    await playCommands(harness, authored.commands("plain_step"), STEP_FRAMES * 3);

    expect(harness.scene.tileX).toBe(6);
    expect(harness.scene.playerRoute).toBeNull();
  });

  it("반복(repeat) 루트는 index 가 되감겨도 통과를 유지한다", async () => {
    installManualFrames();
    const authored = authorProject(
      [
        { id: "repeat_through", target: PLAYER_MOVE_TARGET, repeat: true,
          moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "right" }] },
      ],
      (map) => { for (const x of [6, 7, 8, 9]) wall(map, x, 5); }
    );
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("repeat_through"), STEP_FRAMES * 4);

    expect(harness.scene.tileX).toBeGreaterThanOrEqual(8);
    expect(harness.scene.playerRoute?.through).toBe(true);
  });

  it("장소 이동은 살아남은 루트의 통과를 끈다 — A 맵 기준 통과가 착지 맵의 벽을 뚫으면 안 된다", async () => {
    installManualFrames();
    const authored = authorProject(
      [
        { id: "transfer_through", target: PLAYER_MOVE_TARGET,
          moves: [
            { kind: "setThrough", enabled: true },
            { kind: "move", dir: "right" },
            { kind: "move", dir: "right" },
            { kind: "move", dir: "right" },
          ] },
      ],
      (map) => { wall(map, 6, 5); wall(map, 3, 5); }
    );
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("transfer_through"), STEP_FRAMES);
    expect(harness.scene.playerRoute?.through).toBe(true);

    await transferTo(harness.scene, { mapId: harness.scene.map.id, x: 2, y: 5, fade: "none" });
    expect(harness.scene.playerRoute?.through).toBe(false);

    // 착지 뒤 남은 걸음은 정상 충돌로 판정된다 — (3,5) 벽을 넘지 않는다.
    harness.step(STEP_FRAMES * 2);
    expect(harness.scene.tileX).toBe(2);
  });

  it("루트가 끝난 뒤의 일반 조작은 통과를 물려받지 않는다", async () => {
    installManualFrames();
    const authored = authorProject(
      [
        { id: "one_through_step", target: PLAYER_MOVE_TARGET, wait: true,
          moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "right" }] },
      ],
      (map) => { wall(map, 6, 5); wall(map, 7, 5); }
    );
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("one_through_step"), STEP_FRAMES * 2);
    expect(harness.scene.tileX).toBe(6);
    expect(harness.scene.playerRoute).toBeNull();

    harness.hold({ dir: "right", x: 1 });
    harness.step(STEP_FRAMES * 2);

    expect(harness.scene.tileX).toBe(6);
  });
});

describe("NPC 통과 회귀 (OPRN-OUT-016)", () => {
  function npcFixture(): AuthoredProject {
    return authorProject(
      [
        { id: "npc_through", target: "walker",
          moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "right" }] },
        { id: "npc_plain", target: "walker",
          moves: [{ kind: "move", dir: "right" }] },
      ],
      (map) => {
        map.events.push(event("walker", 10, 8, [page("walker", "same", { kind: "action" })]));
        wall(map, 11, 8);
      }
    );
  }

  it("같은 authored 커맨드를 NPC 대상으로 태우면 통과가 그대로 듣는다", async () => {
    installManualFrames();
    const authored = npcFixture();
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("npc_through"), NPC_FRAMES);

    // 위치 레코드에는 방향도 실린다 — 좌표만 본다.
    expect(harness.scene.eventPositions.walker).toMatchObject({ x: 11, y: 8 });
  });

  it("통과 없는 NPC 루트는 여전히 벽에 막힌다", async () => {
    installManualFrames();
    const authored = npcFixture();
    const harness = routeHarness(authored.map);

    await playCommands(harness, authored.commands("npc_plain"), NPC_FRAMES);

    expect(harness.scene.eventPositions.walker).toMatchObject({ x: 10, y: 8 });
  });
});
