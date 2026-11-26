// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { mapTarget, dbTarget, SmallTaskError, type SmallTaskCollection } from "@/editor/smallTask/target";
import type { InputState } from "@/player/input";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { runCommands, runEvent } from "@/player/playSceneInterpreter";
import { transferTo } from "@/player/playSceneMapCommands";
import { updatePlayScene } from "@/player/playSceneMovement";
import { applyNonBlockingStep, registerAutonomousMover } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { TILE } from "@/project/defaults";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { deserialize, serialize } from "@/project/io";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, GameMap, MoveCommand, GameEvent, Project } from "@/project/types";
import { event, mockSprite, page } from "./runtimeEventPageFixtures";
import { smallTaskRefusal } from "@/editor/smallTask/tools";
import { ledgerLines, plainSummary } from "@/editor/smallTask/plainSummary";
import { canvasSmallTask, smallTaskErrorMessage } from "@/editor/smallTask/capsule";
import { LOCATION_DELETION_DRAFT_REFUSAL, MAP_REMOVAL_DRAFT_REFUSAL, MAP_REMOVAL_REFERENCE_REFUSAL } from "@/editor/smallTask/primitives/errors";
import { editorState } from "@/editor/editorState";
import { installFakeDom } from "./fakeDom";
import { runSmallTask } from "@/editor/smallTask/run";
import { setLocale } from "@/i18n";
import { isolateTimers } from "./mergedTeardown";

// OPRN-OUT-016 — 이동 경로 설정의 「통과 ON/OFF」가 **주인공** 대상에서도 듣는가.
//
// 결함은 실행기의 default 분기에 있었다: NPC 쪽(playSceneAutonomousCommands.executeInstantCommand)
// 은 setThrough 를 mover.through 로 받는데, 주인공 쪽(playSceneMovement.applyPlayerRouteCommand)
// 은 case 가 없어 조용히 삼켰다. 그래서 커맨드 JSON·경로 미리보기만 보는 테스트로는 절대 못 잡는다 —
// 여기서는 Studio 가 쓴 커맨드를 직렬화 왕복(저장·로드)시킨 뒤 인터프리터로 dispatch 하고,
// 실제 updatePlayScene 프레임으로 걷게 해서 **좌표**로 판정한다.
describe("runtimePlayerRouteThrough", () => {
  isolateTimers();
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
    /** false 만 저장한다. 생략은 막힌 걸음을 소비하는 기본 동작. */
    readonly skippable?: false;
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
    // TILE.GRASS(240)·TILE.WALL(306) 은 합본 마을 칸 번호다. 빈 프로젝트의 기본 칩셋은
    // 버들항이라 그 번호는 둘 다 통행 불가 벽이다(constants.ts). 바닥은 그 칩셋의 빈 풀밭,
    // 벽은 통행이 네 방향 모두 닫힌 칸으로 깐다.
    blockedTileId = blockingTile(draft, draftMap);
    draftMap.lowerTiles.fill(blankFillTileFor(draftMap.tilesetId));
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
                route: {
                  moves: [...spec.moves],
                  repeat: spec.repeat === true,
                  wait: spec.wait === true,
                  ...(spec.skippable === false ? { skippable: false as const } : {}),
                },
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
      // PlayScene.getMapId 와 같다. transferTo 가 월드 지도 이동 가능 여부를 이 값으로 본다.
      getMapId: () => session.currentMapId,
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
  let blockedTileId = 0;
  /** 바닥 칸이 아닌, 네 방향이 모두 막힌 칸. 칩셋 번호(TILE.WALL)에 묶지 않는다. */
  function blockingTile(project: ReturnType<typeof createBlankProject>, map: GameMap): number {
    const ground = blankFillTileFor(map.tilesetId);
    const passability = project.tilesets[map.tilesetId]?.passability ?? [];
    for (let index = 0; index < passability.length; index += 1) {
      if (index === ground) continue;
      const flag = passability[index];
      if (flag && !flag.up && !flag.down && !flag.left && !flag.right) return index;
    }
    throw new Error(`no fully blocked tile on ${map.tilesetId}`);
  }
  function wall(map: GameMap, x: number, y: number): void {
    map.lowerTiles[y * map.width + x] = blockedTileId;
  }
  afterEach(() => {
    vi.restoreAllMocks();
    pendingFrames.clear();
  });
  it("작은 일로 잠근 출입구에서 안내를 닫으면 주인공이 한 칸 물러난다", async () => {
    installManualFrames();
    const { map } = authorProject([], room => {
      room.lowerTiles.fill(blankFillTileFor(room.tilesetId));
      room.lowerTiles[4 * room.width + 5] = TILE.EMPTY;
      room.lowerTiles[5 * room.width + 4] = TILE.EMPTY;
      room.lowerTiles[5 * room.width + 6] = TILE.EMPTY;
    });
    const project = store.getCurrent();
    const { after: placed } = runPrimitive(project, mapTarget(project, map.id)!, "event.transfer.place", {
      toMapId: map.id, toX: 8, toY: 8,
    }, { rect: { x: 5, y: 5, w: 1, h: 1 } });
    const gate = placed.maps[map.id].events[0]!;
    const { after: locked } = runPrimitive(placed, mapTarget(placed, map.id, gate.id)!, "event.door.setLock", {
      switchId: DONE_SWITCH, text: "문이 잠겨 있다.",
    });
    const reloaded = store.replace(deserialize(serialize(locked)));
    const harness = routeHarness(reloaded.maps[map.id]);
    const dialogue = harness.scene.game.registry.get("dialogue") as { showText: ReturnType<typeof vi.fn> };
    let dismissText!: () => void;
    dialogue.showText.mockImplementationOnce(() => new Promise<void>(resolve => { dismissText = resolve; }));

    const pending = runEvent(harness.scene, gate.id);
    expect(dialogue.showText).toHaveBeenCalledWith(expect.objectContaining({ body: "문이 잠겨 있다." }));
    harness.step(STEP_FRAMES);
    expect(harness.scene.session).toMatchObject({ currentMapId: map.id, x: 5, y: 5 });
    dismissText();
    for (let frame = 0; frame < STEP_FRAMES * 2; frame++) {
      await Promise.resolve();
      harness.step();
    }
    expect(harness.scene.session).toMatchObject({ currentMapId: map.id, x: 5, y: 6 });
    expect(harness.scene.playerRoute).toBeNull();
    await pending;
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
  describe("moveEvent skippable false retries a blocked step", () => {
    it("keeps the blocked player step instead of taking the next command", async () => {
      installManualFrames();
      const authored = authorProject(
        [{
          id: "hold_player",
          target: PLAYER_MOVE_TARGET,
          skippable: false,
          moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }],
        }],
        (map) => { wall(map, 6, 5); },
      );
      const harness = routeHarness(authored.map);

      await playCommands(harness, authored.commands("hold_player"), STEP_FRAMES * 3);

      expect([harness.scene.tileX, harness.scene.tileY]).toEqual([5, 5]);
      expect(harness.scene.playerRoute?.index).toBe(0);
      expect(harness.scene.playerRoute?.moves[0]).toEqual({ kind: "move", dir: "right" });
      expect(harness.scene.playerRoute?.preserveBlockedSteps).toBe(true);
    });

    it("still drops a blocked player step when skippable is omitted", async () => {
      installManualFrames();
      const authored = authorProject(
        [{
          id: "skip_player",
          target: PLAYER_MOVE_TARGET,
          moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }],
        }],
        (map) => { wall(map, 6, 5); },
      );
      const harness = routeHarness(authored.map);

      await playCommands(harness, authored.commands("skip_player"), STEP_FRAMES * 3);

      expect([harness.scene.tileX, harness.scene.tileY]).toEqual([4, 5]);
      expect(harness.scene.playerRoute).toBeNull();
    });

    it("keeps a blocked NPC step instead of walking the unmatched next step", async () => {
      installManualFrames();
      const authored = authorProject(
        [{
          id: "hold_npc",
          target: "walker",
          skippable: false,
          moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }],
        }],
        (map) => {
          map.events.push(event("walker", 10, 8, [page("walker", "same", { kind: "action" })]));
          wall(map, 11, 8);
        },
      );
      const harness = routeHarness(authored.map);

      await playCommands(harness, authored.commands("hold_npc"), NPC_FRAMES);

      expect(harness.scene.eventPositions.walker).toMatchObject({ x: 10, y: 8 });
      const mover = harness.scene.autonomousNPCs.get("walker");
      expect(mover?.preserveBlockedSteps).toBe(true);
      expect(mover?.step).toBe(0);
      expect(mover?.moves[0]).toEqual({ kind: "move", dir: "right" });
    });

    it("still drops a blocked NPC step when skippable is omitted", async () => {
      installManualFrames();
      const authored = authorProject(
        [{
          id: "skip_npc",
          target: "walker",
          moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }],
        }],
        (map) => {
          map.events.push(event("walker", 10, 8, [page("walker", "same", { kind: "action" })]));
          wall(map, 11, 8);
        },
      );
      const harness = routeHarness(authored.map);

      await playCommands(harness, authored.commands("skip_npc"), NPC_FRAMES);

      expect(harness.scene.eventPositions.walker).toMatchObject({ x: 9, y: 8 });
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
});

describe("smallTask", () => {
  isolateTimers();
  const collections: SmallTaskCollection[] = ["actors", "classes", "items", "skills", "enemies", "troops", "states", "equipment"];
  function fixture(): Project {
    const event: GameEvent = { id: "ev_f52", name: "경비", x: 2, y: 3, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "page_first", name: "", conditions: [], trigger: { kind: "action" }, graphic: { sprite: { type: "bundled", id: "tex_actor" } },
        priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "안녕." }] }] };
    return { maps: { map_a: { id: "map_a", name: "장터", events: [event] } },
      database: Object.fromEntries(collections.map(collection => [collection, [{ id: "id_first", name: "포션", price: 50 }]])) } as unknown as Project;
  }
  describe("호스트가 고른 작은 일 대상", () => {
    it("맵, 캐릭터 그림이 있는 NPC, 그림이 없는 이벤트와 페이지를 구별한다", () => {
      const p = fixture();
      expect(mapTarget(p, null)).toBeNull();
      expect(mapTarget(p, "map_a", "missing")).toBeNull();
      const map = mapTarget(p, "map_a")!;
      expect(map).toEqual({ kind: "map", mapId: "map_a", label: "장터" });
      expect(Object.isFrozen(map)).toBe(true);
      expect(smallTaskRefusal(map, "get_map_region", { mapId: "map_b" })).toContain("선택한 대상");
      const npc = mapTarget(p, "map_a", "ev_f52", "page_first")!;
      expect(npc).toEqual({ kind: "event", mapId: "map_a", eventId: "ev_f52", pageId: "page_first", isNpc: true, x: 2, y: 3, label: "NPC · 경비" });
      expect(Object.isFrozen(npc)).toBe(true);
      const args = { mapId: "map_a", eventId: "ev_f52", pageId: "page_first" };
      expect(smallTaskRefusal(npc, "patch_event_page", args)).toBeNull();
      for (const key of ["mapId", "eventId", "pageId"]) expect(smallTaskRefusal(npc, "patch_event_page", { ...args, [key]: "else" })).toBeTruthy();
      p.maps.map_a.events[0].pages = [];
      const event = mapTarget(p, "map_a", "ev_f52")!;
      expect(event).toMatchObject({ isNpc: false, label: "이벤트 · 경비" });
      expect(smallTaskRefusal(event, "upsert_event", { mapId: "map_a", event: { id: "else" } })).toBeTruthy();
    });
    it.each(collections)("자료집 %s의 현재 레코드만 고친다", collection => {
      const p = fixture();
      expect(dbTarget(p, collection, "absent")).toBeNull();
      const target = dbTarget(p, collection, "id_first")!;
      expect(Object.isFrozen(target)).toBe(true);
      const key = ({ equipment: "equipment", classes: "class", enemies: "enemy" } as Record<string, string>)[collection] ?? collection.slice(0, -1);
      const tool = `upsert_${key}`;
      const args = { [key]: { id: "id_first" } };
      expect(smallTaskRefusal(target, tool, args)).toBeNull();
      expect(smallTaskRefusal(target, tool, { ...args, collection: "foreign" })).toBeTruthy();
      expect(smallTaskRefusal(target, tool, { [key]: { id: "foreign" } })).toBeTruthy();
      expect(smallTaskRefusal(target, tool === "upsert_skill" ? "upsert_actor" : "upsert_skill", args)).toBeTruthy();
    });
  });
  it("캔버스 도구막대가 다시 그려져도 닫을 때 새 작업 버튼에 초점을 돌려준다", () => {
    const restoreDom = installFakeDom({ window: true });
    vi.stubGlobal("innerWidth", window.innerWidth);
    vi.stubGlobal("innerHeight", window.innerHeight);
    const createElement = document.createElement.bind(document);
    const create = vi.spyOn<{ createElement(tag: string): HTMLElement }, "createElement">(document, "createElement").mockImplementation(tag => {
      const element = createElement(tag);
      if (tag === "section") element.showPopover = () => {};
      return element;
    });
    try {
      const toolbar = document.createElement("div");
      toolbar.classList.add("canvas-toolbar");
      const original = canvasSmallTask(), replacement = canvasSmallTask();
      const otherTrigger = canvasSmallTask();
      document.body.append(otherTrigger, toolbar);
      toolbar.append(original);
      original.click();
      expect(document.querySelector(".small-task")).not.toBeNull();
      toolbar.replaceChildren(replacement);
      document.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" }));
      expect(document.querySelector(".small-task")).toBeNull();
      expect(document.activeElement).toBe(replacement);
    } finally {
      create.mockRestore();
      vi.unstubAllGlobals();
      restoreDom();
    }
  });
  it.each([
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 } },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, omitChangedKeys: true },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, withSpawnDraft: true },
    { kind: "event", selectedMapId: "another_map", rect: undefined },
    { kind: "dbEntry", selectedMapId: "map_a", rect: undefined },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, selectedDraft: true },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, noDraft: true },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 },
      stoppedEarly: "명령 목록이 바뀌었어요. 이벤트를 다시 읽어 주세요." },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 },
      stoppedEarly: "이벤트 페이지가 여러 개예요. 고칠 페이지를 선택해 주세요." },
    { kind: "map", selectedMapId: "another_map", rect: undefined,
      stoppedEarly: `${MAP_REMOVAL_DRAFT_REFUSAL}워커 문구`, shownMessage: "『미저장 출입구』의 편집을 먼저 저장하거나 취소해 주세요." },
    { kind: "map", selectedMapId: "another_map", rect: undefined, savedMapReference: true, noDraft: true,
      stoppedEarly: `${MAP_REMOVAL_REFERENCE_REFUSAL}워커 문구`, shownMessage: "『North Gate』에서 이 맵을 사용하고 있어 삭제할 수 없어요." },
    { kind: "map", selectedMapId: "another_map", rect: undefined, draftLocationId: "loc1",
      stoppedEarly: `${LOCATION_DELETION_DRAFT_REFUSAL}워커 문구\nloc1`,
      shownMessage: "미저장 이벤트 『미저장 출입구』에서 이 장소를 사용하고 있어 삭제할 수 없어요." },
    { kind: "map", selectedMapId: "another_map", rect: undefined, draftLocationId: "loc1",
      stoppedEarly: `${LOCATION_DELETION_DRAFT_REFUSAL}워커 문구\nloc2`,
      shownMessage: "AI가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, dialogueCaller: true },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 },
      stoppedEarly: "퀘스트에 연결할 이벤트를 먼저 저장해 주세요.\n범위 밖: 퀘스트가 사용하는 미저장 이벤트",
      shownMessage: "퀘스트에 연결할 이벤트를 먼저 저장해 주세요." },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 }, smallTaskPrimitiveRefused: true,
      stoppedEarly: "도착할 수 있는 빈 칸을 골라 주세요. 주인공이 정확히 도착해 걸어서 나갈 수 있어야 해요." },
    { kind: "event", selectedMapId: "map_a", rect: { x: 2, y: 3, w: 4, h: 5 },
      stoppedEarly: "임시 워커 오류", expectedMessage: "AI가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요." },
  ])("작은 일 Pi HTTP 요청은 대상과 선택 영역을 보내고 안내를 받는다 ($kind, $selectedMapId, $#)", async ({
    kind, selectedMapId, rect, stoppedEarly, omitChangedKeys, selectedDraft, noDraft, withSpawnDraft,
    shownMessage, savedMapReference, draftLocationId, dialogueCaller, smallTaskPrimitiveRefused, expectedMessage,
  }) => {
    const project = fixture();
    if (savedMapReference) {
      const gate: GameEvent = { id: "north_gate", name: "North Gate", x: 1, y: 1, trigger: { kind: "action" },
        commands: [{ kind: "transfer", mapId: "map_a", x: 2, y: 3 }] };
      project.maps.map_b = { ...project.maps.map_a, id: "map_b", events: [gate] };
      project.commonEvents = [];
    }
    const live = structuredClone(project);
    const original = project.maps.map_a.events[0]!;
    const draft: GameEvent = {
      ...original, id: "draft_event", draft: { kind: "new", original },
      ...(kind === "map" ? { name: "미저장 출입구" } : {}),
      ...(draftLocationId ? { condition: { kind: "insideLocation", locationId: draftLocationId, inside: true } } : {}),
      ...(dialogueCaller ? { pages: original.pages!.map(page => ({
        ...page, commands: [{ kind: "callMapEvent", eventId: original.id }],
      })) } : {}),
    };
    const selected = live.maps.map_a.events[0]!;
    const spawnDraft: GameEvent = { ...original, id: "ev_spawn_draft", draft: { kind: "new" }, pages: [],
      commands: [{ kind: "despawnFieldEnemy", spawnId: "spawn_trial" }] };
    if (selectedDraft) selected.draft = { kind: "edit", original };
    if (!noDraft) live.maps.map_a.events.push(draft);
    if (withSpawnDraft) live.maps.map_a.events.push(spawnDraft);
    const target = kind === "dbEntry" ? dbTarget(project, "items", "id_first")!
      : kind === "map" ? mapTarget(project, "map_a")! : mapTarget(project, "map_a", "ev_f52", "page_first")!;
    const previousSelection = editorState.get().selection;
    editorState.set({ selection: { mapId: selectedMapId, x: 2, y: 3, width: 4, height: 5 } });
    const signal = new AbortController().signal;
    const config = { authMode: "chatgpt", apiKey: "", providerId: "openai-codex", model: "gpt-6.1-sol",
      roleModelsPolicyVersion: 1, roleModels: { deep: { provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" } } };
    vi.stubGlobal("window", { oprn: { companionOrigin: "http://127.0.0.1:12345", companionToken: "test-companion-token" } });
    vi.stubGlobal("localStorage", { getItem: (key: string) => key === "oprn:ai-config" ? JSON.stringify(config) : null });
    const fetch = vi.fn(async (_input: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(new Headers(init.headers).get("x-oprn-companion-token")).toBe("test-companion-token");
      expect(body).toMatchObject({ mode: "single", model: "gpt-6.2-sol", thinkingLevel: "medium", smallTask: { target } });
      expect(body.smallTask.selection).toEqual(rect ? { rect } : undefined);
      const drafts = [
        ...(selectedDraft ? [selected] : []),
        ...(noDraft ? [] : [draft]),
        ...(withSpawnDraft ? [spawnDraft] : []),
      ];
      expect(body.smallTask.draftSource).toEqual(drafts.length ? { maps: { map_a: { events: drafts } } } : undefined);
      expect(body.project.maps.map_a.events).toEqual(project.maps.map_a.events);
      if (dialogueCaller) expect(body.task).toBe("고른 대사를 첫 대화에만 보여 줘");
      expect(body).not.toHaveProperty("apiKey");
      const done = { type: "done", smallTask: true, project, changedKeys: omitChangedKeys ? undefined : [], stoppedEarly, smallTaskPrimitiveRefused,
        stats: { ms: 0, turns: 1, toolCalls: 0, toolErrors: 0 } };
      return new Response(JSON.stringify(done) + "\n", {
        headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": body.runId },
      });
    });
    vi.stubGlobal("fetch", fetch);
    try {
      const request = dialogueCaller ? "고른 대사를 첫 대화에만 보여 줘" : "고른 대상을 확인해 줘";
      const run = runSmallTask(project, target, request, signal, live);
      if (stoppedEarly) await expect(run.catch(smallTaskErrorMessage)).resolves.toBe(shownMessage ?? expectedMessage ?? stoppedEarly);
      else await expect(run).resolves.toBe(project);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toMatch(/^http:\/\/127\.0\.0\.1:12345\/v1\/agent\/run\?provider=openai-codex&reader=/u);
    } finally {
      vi.unstubAllGlobals();
      editorState.set({ selection: previousSelection });
    }
  });
  it.each([
    [Object.assign(new Error("credential missing"), { status: 401 }), "AI 로그인이 만료됐거나 연결되지 않았어요. 설정에서 다시 로그인해 주세요."],
    [new Error("No API key found"), "AI 로그인이 만료됐거나 연결되지 않았어요. 설정에서 다시 로그인해 주세요."],
    [new TypeError("Failed to fetch"), "인터넷 연결을 확인하고 다시 시도해 주세요."],
    [new Error("400: Invalid tools schema"), "AI가 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요."],
    [Object.assign(new Error("Pi 에이전트 실행 실패: bun 이 필요합니다. oh-my-pi 제공자 로그인/전송은 Bun 에서만 로드됩니다."), { status: 500 }), "AI 실행 환경을 쓸 수 없어요. Bun 런타임이 설치되지 않았거나 시작되지 않았습니다."],
    [Object.assign(new Error("oh-my-pi worker 409"), { status: 409 }), "AI 실행 환경을 쓸 수 없어요. Bun 런타임이 설치되지 않았거나 시작되지 않았습니다."],
    [new SmallTaskError("선택한 대상만 고칠 수 있어요."), "선택한 대상만 고칠 수 있어요."],
  ])("작은 일이 실패하면 내부 오류 대신 대응하는 안내를 표시한다 (%s)", (error, message) => {
    expect(smallTaskErrorMessage(error)).toBe(message);
  });
  describe("명세를 읽는 쉬운 말 요약", () => {
    it("가격 한 칸은 전후 값이 곧 제목이다", () => {
      const a = fixture(), b = structuredClone(a);
      b.database.items[0].price = 80;
      expect(plainSummary(a, b)).toEqual({ headline: "포션 가격 50 → 80", lines: ["포션 가격 50 → 80"] });
    });
    it("대사 줄을 세고 바뀐 본문을 짧게 보여 준다", () => {
      const a = fixture(), b = structuredClone(a);
      b.maps.map_a.events[0].pages![0].commands = ["들어와.", "어서.", "길은 map_hidden 쪽", "기다려.".repeat(60)].map(body => ({ kind: "text", body }));
      const { headline, lines } = plainSummary(a, b);
      expect(headline).toBe("대사 3줄 추가 · 대사 1줄 수정 · 이벤트 1개");
      expect(lines).toContain("대사 「안녕.」 → 「들어와.」");
      expect(lines.join(" ")).not.toMatch(/map_hidden|ev_f52|page_first/);
      expect(lines.every(line => line.length < 100)).toBe(true);
    });
    it.each([
      ["ko", "대사 추가 「경비 · 좋은 아침!」"],
      ["en", "Dialogue added 「경비 · 좋은 아침!」"],
      ["ja", "せりふを追加 「경비 · 좋은 아침!」"],
      ["zh", "新增对话 「경비 · 좋은 아침!」"],
    ] as const)("%s에서 새 대사는 이전 값 없이 표시한다", async (locale, added) => {
      try {
        await setLocale(locale);
        const a = fixture(), b = structuredClone(a);
        b.maps.map_a.events[0].pages![0].commands.push({ kind: "text", speaker: "경비", body: "좋은 아침!" });
        const lines = plainSummary(a, b).lines;
        expect(lines.filter(line => line.includes("좋은 아침!"))).toEqual([added]);
      } finally {
        await setLocale("ko");
      }
    });
    it("추가·삭제·변경과 낯선 모양도 한 줄 이상 남기고 내부 식별자를 숨긴다", () => {
      for (const change of ["added", "removed", "changed"] as const) {
        for (const area of ["맵", "이벤트 · 장터", "데이터베이스 · 상태", "퀘스트", "타일셋", "새 설정", "futureArea"]) {
          const lines = ledgerLines({ area, change, label: "map_xxx (ev_xxx)", detail: ["이름: ev_xxx → 6ac327c1-b18a-4fa0-8ba4-1919ee76b8dc"] });
          expect(lines.length).toBeGreaterThan(0);
          expect(lines.join(" ")).not.toMatch(/map_|ev_|6ac327c1|futureArea/);
        }
      }
      const a = fixture(), b = structuredClone(a);
      b.maps.map_a.events = [];
      expect(plainSummary(a, b).headline).toBe("대사 1줄 삭제 · 이벤트 1개");
      expect(ledgerLines({ area: "맵", change: "changed", label: "장터 (abc)", detail: ["BGM: Town1 → Town2"] }))
        .toEqual(["장터 BGM 바뀜"]);
    });
  });
});
