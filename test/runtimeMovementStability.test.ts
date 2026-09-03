/** @vitest-environment happy-dom */
// 런타임 불안정 회귀 증거 — 2026-09-03 리뷰에서 실측한 세 결함을 고치기 **전 코드에서 실패**하도록 썼다.
//
//  1. 방향키를 한 프레임 사이에 눌렀다 떼면 걸음이 0 회다(래치 없음). 브라우저 실측: 즉시 탭 4회 → 1칸.
//  2. 인터프리터 스텝마다 타일 1~2만 개를 파괴·재생성하고 카메라 startFollow 로 스크롤을 스냅한다.
//     실측: 대화 1회 = 타일 재생성 6회 · 카메라 스냅 6회, 100ms 병렬 이벤트 = 3초 정지에 24회.
//  3. 걸음마다 walkFrame 이 0 으로 돌아가 세 번째 걷기 패턴이 한 번도 안 나오고, 칸 사이에 유휴
//     프레임이 끼어 6 칸을 걷는 데 6.6 칸 시간이 든다.
import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { TILE_SIZE } from "@/assets/bundled";
import { footprintSpriteX } from "@/player/characterDepth";
import { Input, type InputState } from "@/player/input";
import { applyStoredCameraState } from "@/player/playSceneCamera";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { updatePlayScene } from "@/player/playSceneMovement";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { onRegistryValue } from "@/player/registryReady";
import { createRuntimePerfCounters } from "@/player/runtimePerfCounters";
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

const FRAME_MS = 1000 / 60;

function keyboardStubScene(): Phaser.Scene {
  const key = (): { isDown: boolean } => ({ isDown: false });
  return {
    input: {
      keyboard: {
        createCursorKeys: () => ({ up: key(), down: key(), left: key(), right: key(), space: key(), shift: key() }),
        addKeys: () => ({}),
        on: () => undefined,
      },
    },
    events: { once: () => undefined },
  } as unknown as Phaser.Scene;
}

function pressAndRelease(key: string): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key }));
  document.dispatchEvent(new KeyboardEvent("keyup", { key }));
}

describe("방향키 탭 래치", () => {
  it("한 프레임 사이에 눌렀다 뗀 방향키는 다음 update 에서 한 번 이동 의도로 남는다", () => {
    const input = new Input(keyboardStubScene());
    pressAndRelease("ArrowRight");
    expect(input.update()).toMatchObject({ dir: "right", x: 1, y: 0 });
    // 한 번만 남는다 — 뗀 키가 계속 걷게 하지 않는다.
    expect(input.update()).toMatchObject({ dir: null, x: 0, y: 0 });
  });

  it("걷는 중(deferTaps) 에 들어온 탭은 버리지 않고 정지한 프레임에서 소비한다", () => {
    const input = new Input(keyboardStubScene());
    pressAndRelease("ArrowDown");
    expect(input.update({ deferTaps: true })).toMatchObject({ y: 1 });
    expect(input.update()).toMatchObject({ y: 1 });
    expect(input.update()).toMatchObject({ y: 0 });
  });

  it("입력이 닫힌 동안의 탭은 버린다 — 이벤트 중 누른 키가 끝난 뒤 걷게 하면 안 된다", () => {
    const input = new Input(keyboardStubScene());
    input.setEnabled(false);
    pressAndRelease("ArrowLeft");
    input.setEnabled(true);
    expect(input.update()).toMatchObject({ x: 0, y: 0 });
  });

  it("자동화 주입 dir(d)→dir(null) 도 같은 태스크 안이면 정확히 한 걸음이다 — 눌림이 남아 계속 걷지 않는다", () => {
    const input = new Input(keyboardStubScene());
    input.injectDirection("down");
    input.injectDirection(null);
    expect(input.update()).toMatchObject({ y: 1 });
    expect(input.update()).toMatchObject({ y: 0 });
    expect(input.update()).toMatchObject({ y: 0 });
  });

  it("clearDirectionTaps 는 메뉴가 열린 동안 쌓인 탭을 비운다", () => {
    const input = new Input(keyboardStubScene());
    pressAndRelease("ArrowUp");
    input.clearDirectionTaps();
    expect(input.update()).toMatchObject({ x: 0, y: 0 });
  });
});

type MovementHarness = {
  readonly scene: PlaySceneContext;
  readonly frames: Array<string | number>;
  hold(state: Partial<InputState>): void;
  tick(count: number, deltaMs?: number): void;
};

function movementHarness(): MovementHarness {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.lowerTiles.fill(TILE.GRASS);
  map.upperTiles.fill(-1);
  map.events = [];
  store.replace(project);
  const session = startSession(project);
  session.currentMapId = map.id;
  const frames: Array<string | number> = [];
  const player = {
    x: 0,
    y: 0,
    depth: 0,
    setFrame(frame: string | number): void {
      frames.push(frame);
    },
    setPosition(x: number, y: number): void {
      this.x = x;
      this.y = y;
    },
    setDepth(depth: number): void {
      this.depth = depth;
    },
    setOrigin(): void {
      return undefined;
    },
  };
  const idle: InputState = { dir: null, x: 0, y: 0, dash: false, actionPressed: false, confirmPressed: false, attackPressed: false, skillPressed: false };
  let held: InputState = idle;
  const scene = {
    game: { canvas: { parentElement: null, ownerDocument: { querySelector: () => null } } },
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
    moveDurationMs: 160,
    dashing: false,
    facing: "down",
    walkFrame: 0,
    walkTimer: 0,
    lastActionTargetKey: "",
    playerRoute: null,
    playerHop: null,
    eventPositions: {},
    autonomousNPCs: new Map(),
    eventSprites: new Map(),
    followerSprites: new Map(),
    characterShadows: new Map(),
    characterHopScales: new Map(),
    running: false,
    inputEnabled: true,
    updateAutonomousNPCs: () => undefined,
    updateParallelEvents: () => undefined,
    updateTimers: () => undefined,
    updateFieldSpawns: () => undefined,
    syncRuntimeState: () => undefined,
    runEvent: async () => undefined,
    add: { sprite: () => player },
  } as unknown as PlaySceneContext;
  return {
    scene,
    frames,
    hold(state) {
      held = { ...idle, ...state };
    },
    tick(count, deltaMs = FRAME_MS) {
      for (let index = 0; index < count; index += 1) updatePlayScene(scene, deltaMs);
    },
  };
}

function walkPatternsSeen(frames: ReadonlyArray<string | number>, direction: "right"): Set<number> {
  const patterns = new Set<number>();
  for (const frame of frames) {
    for (const pattern of [0, 1, 2]) {
      if (frame === charsetFrameIndex({ characterIndex: 0, direction, pattern })) patterns.add(pattern);
    }
  }
  return patterns;
}

describe("주인공 걷기 연속성", () => {
  it("키를 누른 채 걸으면 걷기 패턴 0·1·2 가 모두 나온다(칸마다 애니메이션이 처음으로 돌아가지 않는다)", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    harness.tick(60);
    expect([...walkPatternsSeen(harness.frames, "right")].sort()).toEqual([0, 1, 2]);
  });

  it("60 프레임(1초) 동안 160ms 걸음은 6 칸을 마친다 — 칸 사이에 유휴 프레임이 끼지 않는다", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    harness.tick(60);
    // 정확히 1000.2ms → 6 칸 완료 + 7 번째 칸 진행 중. 유휴 프레임이 칸마다 끼면 5 칸에 그친다.
    expect(harness.scene.tileX).toBe(11);
    expect(harness.scene.moving).toBe(true);
  });

  it("키를 떼면 진행 중인 걸음은 마치고 다음 칸으로 넘어가지 않는다", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    harness.tick(3);
    harness.hold({});
    harness.tick(30);
    expect(harness.scene.tileX).toBe(6);
    expect(harness.scene.moving).toBe(false);
    expect(harness.scene.player.x).toBe(footprintSpriteX(6, { width: 1, height: 1 }));
  });
});

describe("걷는 중 들어온 방향 탭이 걸음을 이어 붙인 뒤에는 소비된다", () => {
  // 회귀: 이어 붙인 걸음이 매 프레임 moving 을 유지해 래치가 peek 만 되고 take 되지 않아, 키를 전부 뗀 뒤에도
  // 벽에 닿을 때까지 걸었다(브라우저 실측: 아래 유지 중 위로 바꾼 뒤 전부 뗌 → y 18→7 계속 이동).
  function realInputHarness(): MovementHarness & { down(key: string): void; up(key: string): void } {
    const harness = movementHarness();
    (harness.scene as { input_: Input }).input_ = new Input(keyboardStubScene());
    return {
      ...harness,
      down: (key) => document.dispatchEvent(new KeyboardEvent("keydown", { key })),
      up: (key) => document.dispatchEvent(new KeyboardEvent("keyup", { key })),
    };
  }

  it("오른쪽 유지 중 아래를 눌렀다 떼고 오른쪽도 떼면 한 칸 안에 멈춘다", () => {
    const harness = realInputHarness();
    harness.down("ArrowRight");
    harness.tick(15);
    harness.down("ArrowDown");
    harness.tick(3);
    harness.up("ArrowDown");
    harness.up("ArrowRight");
    harness.tick(120);
    expect(harness.scene.moving).toBe(false);
    expect(harness.scene.tileY).toBeLessThanOrEqual(7);
    expect(harness.scene.tileX).toBeLessThanOrEqual(9);
  });

  it("오른쪽 유지 중 아래 탭 한 번은 정확히 한 칸이다", () => {
    const harness = realInputHarness();
    harness.down("ArrowRight");
    harness.tick(15);
    harness.down("ArrowDown");
    harness.up("ArrowDown");
    harness.tick(60);
    expect(harness.scene.tileY).toBe(6);
    harness.up("ArrowRight");
    harness.tick(30);
    expect(harness.scene.moving).toBe(false);
  });

  it("아래 유지 중 위로 바꾼 뒤 전부 떼면 멈춘다", () => {
    const harness = realInputHarness();
    harness.down("ArrowDown");
    harness.tick(20);
    harness.down("ArrowUp");
    harness.up("ArrowDown");
    harness.tick(20);
    harness.up("ArrowUp");
    harness.tick(60);
    expect(harness.scene.moving).toBe(false);
    const restingY = harness.scene.tileY;
    harness.tick(60);
    expect(harness.scene.tileY).toBe(restingY);
  });
});

describe("카메라 재추적 멱등성", () => {
  class CameraStub {
    _follow: unknown = null;
    startFollowCalls = 0;
    zoom = 1;
    startFollow(target: unknown): void {
      this._follow = target;
      this.startFollowCalls += 1;
    }
    stopFollow(): void {
      this._follow = null;
    }
    setZoom(zoom: number): void {
      this.zoom = zoom;
    }
    centerOn(): void {
      return undefined;
    }
  }

  it("이미 따르고 있는 대상에는 startFollow 를 다시 부르지 않는다(스크롤 스냅 방지)", () => {
    const project = createBlankProject();
    const camera = new CameraStub();
    const player = { x: 100, y: 80 };
    const scene = {
      cameras: { main: camera },
      player,
      eventSprites: new Map(),
      session: startSession(project),
      map: project.maps[project.startMapId],
      eventPositions: {},
      perfCounters: createRuntimePerfCounters(),
    } as unknown as PlaySceneContext;

    applyStoredCameraState(scene);
    applyStoredCameraState(scene);
    applyStoredCameraState(scene);
    expect(camera.startFollowCalls).toBe(1);
    expect(scene.perfCounters?.cameraRefollowsSkipped).toBe(2);

    // 다른 코드가 추적을 끊었으면(팬·전투) 다시 건다.
    camera.stopFollow();
    applyStoredCameraState(scene);
    expect(camera.startFollowCalls).toBe(2);
  });
});

type TileImage = {
  setOrigin(): void;
  setDepth(): void;
  setVisible(): void;
  visible: boolean;
  play(): TileImage;
  destroy(): void;
};

function tileScene(): { scene: Parameters<typeof renderTiles>[0]; created: TileImage[]; map: ReturnType<typeof createBlankProject>["maps"][string]; session: ReturnType<typeof startSession> } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.lowerTiles.fill(TILE.GRASS);
  map.upperTiles.fill(-1);
  map.events = [];
  store.replace(project);
  const session = startSession(project);
  const created: TileImage[] = [];
  const make = (): TileImage => {
    const image: TileImage = {
      visible: true,
      setOrigin: () => undefined,
      setDepth: () => undefined,
      setVisible: () => undefined,
      play: () => image,
      destroy: () => undefined,
    };
    created.push(image);
    return image;
  };
  const scene = {
    map,
    session,
    eventPositions: {},
    tileLayer: { removeAll: () => undefined, add: () => undefined },
    upperTileLayer: { removeAll: () => undefined, add: () => undefined },
    eventSprites: new Map(),
    runtimeDom: {
      clearEventMarkers: () => undefined,
      upsertEventMarker: () => undefined,
      syncMissingResourceError: () => undefined,
    },
    missingResources: new Set<string>(),
    add: { image: make, sprite: make },
    runEvent: async () => undefined,
    syncRuntimeState: () => undefined,
    perfCounters: createRuntimePerfCounters(),
  };
  return { scene: scene as never, created, map, session };
}

describe("renderTiles 서명 게이트", () => {
  it("타일·오버레이 입력이 그대로면 두 번째 호출은 타일을 다시 만들지 않는다", () => {
    const { scene, created } = tileScene();
    renderTiles(scene);
    const afterFirst = created.length;
    expect(afterFirst).toBeGreaterThan(0);

    renderTiles(scene);
    expect(created.length).toBe(afterFirst);
    const counters = (scene as unknown as { perfCounters: ReturnType<typeof createRuntimePerfCounters> }).perfCounters;
    expect(counters.tileRebuilds).toBe(1);
    expect(counters.tileRebuildsSkipped).toBe(1);
  });

  it("타일 하나가 바뀌면(changeTile) 다시 만든다", () => {
    const { scene, created, map } = tileScene();
    renderTiles(scene);
    const afterFirst = created.length;
    map.lowerTiles[0] = TILE.WATER;
    renderTiles(scene);
    expect(created.length).toBeGreaterThan(afterFirst);
  });

  it("밭 상태가 바뀌면 다시 만든다(오버레이도 타일 계층이다)", () => {
    const { scene, created, map, session } = tileScene();
    renderTiles(scene);
    const afterFirst = created.length;
    session.farmPlots = { [map.id]: { "1,1": { tilled: true, watered: false } } };
    renderTiles(scene);
    expect(created.length).toBeGreaterThan(afterFirst);
  });

  it("맵 객체가 바뀌면(맵 이동) 다시 만든다", () => {
    const { scene, created } = tileScene();
    renderTiles(scene);
    const afterFirst = created.length;
    (scene as unknown as { map: unknown }).map = structuredClone((scene as unknown as { map: unknown }).map);
    renderTiles(scene);
    expect(created.length).toBeGreaterThan(afterFirst);
  });
});

/** 가장 많이 쓰인 텍스처 키 = 타일셋. 이벤트 스프라이트는 소수다. */
function tilesetTextureOf(placed: ReadonlyArray<{ texture: string }>): string {
  const counts = new Map<string, number>();
  for (const point of placed) counts.set(point.texture, (counts.get(point.texture) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

describe("이벤트 스프라이트 재생성 중 보간 위치", () => {
  it("걷는 중인 NPC 를 다시 그리면 목적지가 아니라 보간 위치에 놓는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.lowerTiles.fill(TILE.GRASS);
    map.upperTiles.fill(-1);
    map.events = [{
      id: "npc",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" },
    }] as never;
    store.replace(project);
    const session = startSession(project);
    const placed: Array<{ x: number; y: number; texture: string }> = [];
    const make = (x: number, y: number, texture: string): unknown => {
      placed.push({ x, y, texture });
      const image = { setOrigin: () => undefined, setDepth: () => undefined, setScale: () => undefined, setFrame: () => undefined, setPosition: () => undefined, play: () => image, destroy: () => undefined, y };
      return image;
    };
    const mover: AutonomousMover = {
      moves: [],
      step: 0,
      timer: 0,
      repeat: true,
      strategy: "random",
      facing: "right",
      directionFix: false,
      through: false,
      animationEnabled: true,
      opacity: 255,
      speedRank: 3,
      frequencyRank: 3,
      moveIntervalMs: 400,
      moveDurationMs: 320,
      activeMove: { fromX: 2, fromY: 2, toX: 3, toY: 2, dir: "right", baseFrame: 0, elapsedMs: 160 },
    };
    const scene = {
      map,
      session,
      // 걸음이 시작되면 논리 위치는 즉시 목적지로 커밋된다(playSceneAutonomous §moveAutonomousRuntimePosition).
      eventPositions: { npc: { x: 3, y: 2, direction: "right" } },
      tileLayer: { removeAll: () => undefined, add: () => undefined },
      upperTileLayer: { removeAll: () => undefined, add: () => undefined },
      eventSprites: new Map(),
      autonomousNPCs: new Map([["npc", mover]]),
      runtimeDom: {
        clearEventMarkers: () => undefined,
        upsertEventMarker: () => undefined,
        syncMissingResourceError: () => undefined,
      },
      missingResources: new Set<string>(),
      add: { image: make, sprite: make },
      runEvent: async () => undefined,
      syncRuntimeState: () => undefined,
    };
    renderTiles(scene as never);
    // 타일 이미지도 y=48 에 놓이므로(3행) 텍스처로 NPC 스프라이트를 가른다.
    const npcSprite = placed.find((point) => point.texture !== tilesetTextureOf(placed) && point.y === 3 * TILE_SIZE);
    expect(npcSprite, "NPC 스프라이트가 그려지지 않았다").toBeDefined();
    // 절반 진행: x = 2.5 칸 → 몸 중앙 = 2.5*16 + 8 = 48
    expect(npcSprite?.x).toBe(footprintSpriteX(2.5, { width: 1, height: 1 }));
  });
});

describe("registry 준비 대기", () => {
  type Listener = (parent: unknown, key: string, value: unknown) => void;
  function fakeRegistry(): { registry: Parameters<typeof onRegistryValue>[0]; emit(event: string, key: string, value: unknown): void; values: Map<string, unknown>; listeners(): number } {
    const values = new Map<string, unknown>();
    const handlers = new Map<string, Set<Listener>>();
    const events = {
      on: (event: string, listener: Listener): void => {
        const set = handlers.get(event) ?? new Set<Listener>();
        set.add(listener);
        handlers.set(event, set);
      },
      off: (event: string, listener: Listener): void => {
        handlers.get(event)?.delete(listener);
      },
    };
    return {
      registry: { get: (key: string) => values.get(key), events } as never,
      emit(event, key, value) {
        values.set(key, value);
        for (const listener of [...(handlers.get(event) ?? [])]) listener(null, key, value);
      },
      values,
      listeners: () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0),
    };
  }

  it("처음 넣는 키는 changedata 가 아니라 setdata 로 온다 — 그래도 한 번 콜백한다", () => {
    const fake = fakeRegistry();
    let calls = 0;
    onRegistryValue(fake.registry, "dialogue", () => {
      calls += 1;
    });
    fake.emit("setdata", "dialogueHost", {});
    expect(calls).toBe(0);
    fake.emit("setdata", "dialogue", {});
    expect(calls).toBe(1);
    fake.emit("changedata", "dialogue", {});
    expect(calls).toBe(1);
    expect(fake.listeners()).toBe(0);
  });

  it("이미 값이 있으면 즉시 콜백한다", () => {
    const fake = fakeRegistry();
    fake.values.set("dialogue", {});
    let calls = 0;
    onRegistryValue(fake.registry, "dialogue", () => {
      calls += 1;
    });
    expect(calls).toBe(1);
  });
});
