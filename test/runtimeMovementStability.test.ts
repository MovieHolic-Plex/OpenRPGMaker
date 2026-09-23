/** @vitest-environment happy-dom */
import { playPathfindMove, planPathfindMove } from "@/player/playScenePathfinding";
import { conditionWaitScenes } from "@/player/runtimeConditionWait";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { event, page, mockSprite } from "./runtimeEventPageFixtures";
import { applySaveSnapshot, createSaveSnapshot } from '@/player/saveSlots';
import { cancelFurniturePush, furniturePushPosition, furniturePushBlocks, furniturePushFrames } from '@/player/furniturePushAnimation';
import { runtimeEventViewsForMap } from '@/project/runtimeEventState';

// 런타임 불안정 회귀 증거 — 2026-09-03 리뷰에서 실측한 세 결함을 고치기 **전 코드에서 실패**하도록 썼다.
//
//  1. 방향키를 한 프레임 사이에 눌렀다 떼면 걸음이 0 회다(래치 없음). 브라우저 실측: 즉시 탭 4회 → 1칸.
//  2. 인터프리터 스텝마다 타일 1~2만 개를 파괴·재생성하고 카메라 startFollow 로 스크롤을 스냅한다.
//     실측: 대화 1회 = 타일 재생성 6회 · 카메라 스냅 6회, 100ms 병렬 이벤트 = 3초 정지에 24회.
//  3. 걸음마다 walkFrame 이 0 으로 돌아가 세 번째 걷기 패턴이 한 번도 안 나오고, 칸 사이에 유휴
//     프레임이 끼어 6 칸을 걷는 데 6.6 칸 시간이 든다.
import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { TILE_SIZE } from "@/assets/bundled";
import { footprintSpriteX } from "@/player/characterDepth";
import { Input, type InputState } from "@/player/input";
import { applyStoredCameraState } from "@/player/playSceneCamera";
import { renderTiles, resetMapRuntime } from "@/player/playSceneMapRuntime";
import { tryStartFurniturePush, updatePlayScene } from "@/player/playSceneMovement";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { onRegistryValue } from "@/player/registryReady";
import { createRuntimePerfCounters } from "@/player/runtimePerfCounters";
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { LocalDiagnosticSession } from "@/util/localDiagnosticSession";

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

  it("탭 엣지는 항상 다음 update 한 번에 소비된다 — update 에 미루기 옵션이 없다(RPG Maker 처럼 걷는 중 입력은 보관하지 않는다)", () => {
    const input = new Input(keyboardStubScene());
    pressAndRelease("ArrowDown");
    // @ts-expect-error deferTaps 가 사라진 것이 계약이다 — 옵션이 부활하면 이 줄이 타입 오류로 잡는다.
    expect(input.update({ deferTaps: true })).toMatchObject({ y: 1 });
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
    logicTickAccumulatorMs: 0,
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

it("local diagnostics observe completed movement and actual blocked attempts without QA instrumentation", () => {
  const harness = movementHarness();
  const diagnostics = new LocalDiagnosticSession();
  diagnostics.start(true, ["movement", "collision"]);
  try {
    harness.hold({ dir: "right", x: 1 });
    harness.tick(10);
    expect(diagnostics.snapshot().receipts).toContainEqual(expect.objectContaining({ category: "movement", phase: "completed", x: 6, y: 5 }));
    harness.scene.tileX = 0;
    harness.hold({ dir: "left", x: -1 });
    harness.tick(1);
    expect(diagnostics.snapshot().receipts).toContainEqual(expect.objectContaining({ category: "collision", phase: "terrain", x: -1, y: 5 }));
  } finally { diagnostics.clear(); }
});

function walkPatternsSeen(frames: ReadonlyArray<string | number>, direction: "right"): Set<number> {
  const patterns = new Set<number>();
  for (const frame of frames) {
    for (const pattern of [0, 1, 2]) {
      if (frame === charsetFrameIndex({ characterIndex: 0, direction, pattern })) patterns.add(pattern);
    }
  }
  return patterns;
}

describe("주인공 걷기 — RPG Maker 식 프레임 정량화", () => {
  // RPG Maker 는 걸음을 시간이 아니라 프레임으로 가른다(MV: 2^speed/256 타일/프레임 → 보통 속도 16프레임/칸).
  // 걸음은 항상 프레임 경계에서 끝나고, 안 걷고 있을 때만 그 프레임의 입력으로 다음 걸음을 시작한다.
  // 「남은 시간 이월」·「걸음 이어 붙이기」는 존재하지 않는다. 이 프로젝트는 160ms 걸음 = 10 논리 프레임(60Hz).
  it("10 논리 프레임이면 정확히 한 칸을 마치고 칸 경계에 서 있다 — 다음 걸음은 다음 프레임에 시작한다", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    harness.tick(10);
    expect(harness.scene.tileX).toBe(6);
    expect(harness.scene.moving).toBe(false);
    expect(harness.scene.player.x).toBe(footprintSpriteX(6, { width: 1, height: 1 }));
    harness.tick(1);
    expect(harness.scene.moving).toBe(true);
    expect(harness.scene.movingTo).toEqual({ x: 7, y: 5 });
  });

  it("프레임 시간이 16.2/17.1ms 로 흔들려도 프레임당 이동은 언제나 1/10 칸(1.6px)이다 — 시간 보간이 아니라 프레임 이동", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    const deltas: number[] = [];
    let previousX = footprintSpriteX(5, { width: 1, height: 1 });
    for (let frame = 0; frame < 30; frame += 1) {
      harness.tick(1, frame % 2 === 0 ? 16.2 : 17.1);
      deltas.push(Number((harness.scene.player.x - previousX).toFixed(3)));
      previousX = harness.scene.player.x;
    }
    expect(new Set(deltas)).toEqual(new Set([1.6]));
  });

  it("120Hz(8.3ms) 에서는 두 프레임에 한 논리 프레임 — 1초에 여전히 6 칸", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    harness.tick(120, 1000 / 120);
    expect(harness.scene.tileX).toBe(11);
  });

  it("키를 누른 채 걸으면 걷기 패턴 0·1·2 가 모두 나온다(칸마다 애니메이션이 처음으로 돌아가지 않는다)", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    harness.tick(60);
    expect([...walkPatternsSeen(harness.frames, "right")].sort()).toEqual([0, 1, 2]);
  });

  it("60 프레임(1초) 동안 160ms 걸음은 정확히 6 칸이다 — 칸 사이에 유휴 프레임도, 남은 시간 이월도 없다", () => {
    const harness = movementHarness();
    harness.hold({ dir: "right", x: 1 });
    harness.tick(60);
    expect(harness.scene.tileX).toBe(11);
    expect(harness.scene.moving).toBe(false);
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

describe("걷는 중 입력은 RPG Maker 처럼 걸음이 끝나는 프레임의 눌림만 본다", () => {
  // 회귀: 예전 탭 래치는 걷는 중 눌린 키를 보관해 다음 걸음으로 내보냈고, 걸음 이어 붙이기와 겹쳐 키를 전부 뗀 뒤에도
  // 벽에 닿을 때까지 걸었다(브라우저 실측: 아래 유지 중 위로 바꾼 뒤 전부 뗌 → y 18→7 계속 이동).
  // RPG Maker 는 걷는 중 입력을 보관하지 않는다 — 걸음이 끝나는 프레임에 눌려 있는 키만 다음 걸음이 된다.
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

  it("오른쪽 유지 중 한 칸 안에서 시작하고 끝난 아래 탭은 버려진다(RPG Maker 계약) — 오른쪽으로만 계속 걷는다", () => {
    const harness = realInputHarness();
    harness.down("ArrowRight");
    harness.tick(15);
    harness.down("ArrowDown");
    harness.tick(2);
    harness.up("ArrowDown");
    harness.tick(60);
    expect(harness.scene.tileY).toBe(5);
    expect(harness.scene.tileX).toBeGreaterThanOrEqual(11);
    harness.up("ArrowRight");
    harness.tick(30);
    expect(harness.scene.moving).toBe(false);
  });

  it("오른쪽 유지 중 아래를 칸 경계를 넘기도록 누르면 그 경계에서 대각선 걸음이 시작된다", () => {
    const harness = realInputHarness();
    harness.down("ArrowRight");
    harness.tick(15);
    harness.down("ArrowDown");
    harness.tick(10);
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
    setBounds(): void {
      return undefined;
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


function furnitureHarness(dir: 'up' | 'down' | 'left' | 'right' = 'up') {
  const h = movementHarness();
  const s = h.scene;
  s.session.x = s.tileX; s.session.y = s.tileY;
  s.player.x = (s.tileX + .5) * 16; s.player.y = (s.tileY + 1) * 16;
  s.facing = dir;
  const dx = dir === 'right' ? 1 : dir === 'left' ? -1 : 0;
  const dy = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
  const x = s.tileX + dx, y = s.tileY + dy;
  const chair = { x: (x+.5)*16, y:(y+1)*16, frame:7, depth:0,
    setDepth(d: number) { this.depth=d; }, setFrame(f: number) { this.frame=f; },
  };
  s.map.events.push({ id:'chair', x,y, trigger:{kind:'action'},commands:[],pages:[{
    id:'chair_page',name:'chair',conditions:[],graphic:{},trigger:{kind:'action'},
    priority:'same',overlapForbidden:true,movement:{type:'fixed',speed:3,frequency:3},
    interaction:{kind:'pushable'},commands:[],
  }] });
  s.eventPositions.chair={x,y}; s.eventSprites.set('chair',chair as any);
  const view=()=>runtimeEventViewsForMap(store.getCurrent(),s.map,s.session,s.eventPositions).find(e=>e.event.id==='chair')!;
  return { ...h, chair, view, dx, dy, x, y };
}

describe('coordinated furniture pushing', () => {
  it.each(['up','down','left','right'] as const)('action push %s follows the chair smoothly with fixed contact spacing', dir => {
    const h=furnitureHarness(dir), s=h.scene;
    const start={x:s.player.x,y:s.player.y,cx:h.chair.x,cy:h.chair.y};
    h.hold({actionPressed:true}); h.tick(1); h.hold({});
    expect(s.moving).toBe(true);
    expect(h.chair).toMatchObject({x:start.cx,y:start.cy});
    const xs:number[]=[],ys:number[]=[];
    for(let i=0;i<19;i++) {
      h.tick(1); xs.push(h.chair.x);ys.push(h.chair.y);
      expect(h.chair.x-s.player.x).toBeCloseTo(h.dx*16);
      expect(h.chair.y-s.player.y).toBeCloseTo(h.dy*16);
      expect(h.chair.frame).toBe(7);
      expect(h.chair.depth).toBeCloseTo(200000+h.chair.y);
    }
    expect(new Set(h.dx?xs:ys).size).toBeGreaterThan(10);
    expect(s.moving).toBe(false);
    expect(s.session).toMatchObject({x:h.x,y:h.y});
    expect(h.chair.x).toBeCloseTo(start.cx+h.dx*16);
    expect(h.chair.y).toBeCloseTo(start.cy+h.dy*16);
    expect(furniturePushFrames(s)).toBeUndefined();
    // Endpoints are exact; no residual animation after the input has stopped.
    h.tick(30);expect(s.session).toMatchObject({x:h.x,y:h.y});
  });

  it('direction + dash uses the same slower push and ignores repeated action during it', () => {
    const h=furnitureHarness();
    h.hold({dir:'up',x:0,y:-1,dash:true});h.tick(1);
    expect(h.scene.dashing).toBe(false);
    h.hold({actionPressed:true});h.tick(8);h.hold({});
    expect(h.chair.y).toBeGreaterThan((h.y)*16);
    expect(h.chair.y).toBeLessThan((h.y+1)*16);
    h.tick(10);
    expect(h.scene.session.eventLocations.chair).toMatchObject({x:h.x,y:h.y-1});
    expect(h.scene.session.y).toBe(h.y);
  });

  it.each([30,60,120])('finishes in 19 logic ticks at %i Hz with no chained motion', hz => {
    const h=furnitureHarness();
    expect(tryStartFurniturePush(h.scene,h.view())).toBe(true);
    h.tick(hz/2,1000/hz);
    expect(h.scene.moving).toBe(false);
    expect(h.scene.session.y).toBe(h.y);
    expect(h.chair.y).toBe(h.y*16);
  });

  it('menu freezes both participants and resume continues from the same pose', () => {
    const h=furnitureHarness();tryStartFurniturePush(h.scene,h.view());h.tick(8);
    const pose={chair:h.chair.y,player:h.scene.player.y};
    const doc=h.scene.game.canvas.ownerDocument;
    const query=doc.querySelector;
    doc.querySelector=(()=>({})) as any;h.tick(120);
    expect({chair:h.chair.y,player:h.scene.player.y}).toEqual(pose);
    doc.querySelector=query;h.tick(11);expect(h.scene.moving).toBe(false);
  });

  it('preserves presentation when a refresh replaces the sprite mid-push', () => {
    const h=furnitureHarness();tryStartFurniturePush(h.scene,h.view());h.tick(8);
    const position=furniturePushPosition(h.scene,'chair')!;
    expect(position.y*16+16).toBeCloseTo(h.chair.y);
    const replacement={...h.chair};h.scene.eventSprites.set('chair',replacement as any);
    h.tick(1);expect(replacement.y).toBeLessThan(h.chair.y);
    expect(replacement.frame).toBe(7);
  });

  it('blocked destinations and disallowed directions leave both participants untouched', () => {
    const h=furnitureHarness();h.scene.map.events[0]!.pages![0]!.interaction!.directions=['down'];
    expect(tryStartFurniturePush(h.scene,h.view())).toBe(false);
    delete h.scene.map.events[0]!.pages![0]!.interaction!.directions;
    const blocker=structuredClone(h.scene.map.events[0]!);blocker.id='blocker';blocker.y--;
    h.scene.map.events.push(blocker);
    expect(tryStartFurniturePush(h.scene,h.view())).toBe(false);
    expect(h.scene.moving).toBe(false);expect(h.scene.session.eventLocations.chair).toBeUndefined();
  });

  it('keeps the source reserved until cancellation rolls the furniture back', () => {
    const h=furnitureHarness();tryStartFurniturePush(h.scene,h.view());h.tick(8);
    const rect={left:h.x,right:h.x,top:h.y,bottom:h.y};
    expect(furniturePushBlocks(h.scene,rect)).toBe(true);
    expect(furniturePushBlocks(h.scene,rect,'chair')).toBe(false);
    cancelFurniturePush(h.scene);
    expect(h.scene.session.eventLocations.chair).toMatchObject({x:h.x,y:h.y});
    expect(h.chair.y).toBe((h.y+1)*16);
    expect(furniturePushBlocks(h.scene,rect)).toBe(false);
    expect(furniturePushPosition(h.scene,'chair')).toBeUndefined();
  });
});


describe('furniture animation lifecycle', () => {
  it('action pressed on the final movement tick does not queue another push', () => {
    const h=furnitureHarness();tryStartFurniturePush(h.scene,h.view());h.tick(18);
    h.hold({actionPressed:true});h.tick(1);
    expect(h.scene.moving).toBe(false);
    expect(h.scene.session.eventLocations.chair!.y).toBe(h.y-1);
  });

  it('save during motion restores valid tile positions, without serializing animation state', () => {
    const h=furnitureHarness();tryStartFurniturePush(h.scene,h.view());h.tick(8);
    const project=store.getCurrent();
    const restored=applySaveSnapshot(project,createSaveSnapshot(project,h.scene.session));
    expect(restored.y).toBe(5);
    expect(restored.eventLocations.chair).toMatchObject({x:h.x,y:h.y-1});
    expect(Number.isInteger(restored.eventLocations.chair!.y)).toBe(true);
  });

  it('map reset removes the interpolation and footprint reservation before sprites are rebuilt', () => {
    const h=furnitureHarness();tryStartFurniturePush(h.scene,h.view());h.tick(8);
    Object.assign(h.chair,{destroy(){}});
    Object.assign(h.scene,{
      parallelProcesses:new Map(),autoStartedKeys:new Set(),pageMoveRouteKeys:new Set(),
      pageMoveRouteEventIds:new Set(),commandMoveRouteEventIds:new Set(),eventGraphicPatternOverrides:new Map(),
      activeMapAnimations:new Set(),missingResources:new Set(),runtimeDom:{clearEventMarkers(){}},
    });
    resetMapRuntime(h.scene);
    expect(furniturePushPosition(h.scene,'chair')).toBeUndefined();
    expect(furniturePushFrames(h.scene)).toBeUndefined();
    expect(furniturePushBlocks(h.scene,{left:h.x,right:h.x,top:h.y,bottom:h.y})).toBe(false);
  });
});

describe("command NPC routes while an event is running", () => {
  it("finishes a forced turn during a blocking event while background NPCs and parallel events stay paused", () => {
    const harness = movementHarness();
    const { scene } = harness;
    scene.running = true;
    scene.session.messageWindowSettings = { format: "normal", position: "bottom", preventObscuringPlayer: true, allowEventMovementDuringWait: false };
    scene.commandMoveRouteEventIds = new Set(["father"]);
    scene.map.events.push(event("father", 7, 5, [page("father", "same", { kind: "action" })]));
    scene.map.events.push(event("bystander", 8, 5, [page("bystander", "same", { kind: "action" })]));
    scene.eventSprites.set("father", mockSprite() as never);
    scene.eventSprites.set("bystander", mockSprite() as never);
    scene.runtimeDom = { upsertEventMarker: () => undefined } as never;
    registerAutonomousMover(scene, "father", [{ kind: "turn", dir: "up" }], false);
    registerAutonomousMover(scene, "bystander", [{ kind: "turn", dir: "left" }], true);
    scene.updateAutonomousNPCs = (delta) => updateAutonomousNPCs(scene, delta);
    let parallelUpdates = 0;
    scene.updateParallelEvents = () => { parallelUpdates += 1; };

    harness.tick(60); // one second of real update dispatch; not the 30-second wait fallback

    expect(scene.autonomousNPCs.has("father")).toBe(false);
    expect(scene.commandMoveRouteEventIds.has("father")).toBe(false);
    expect(scene.eventSprites.get("father")?.frame).toBe(charsetFrameIndex({ characterIndex: 0, direction: "up", pattern: 1 }));
    expect(scene.autonomousNPCs.get("bystander")?.step).toBe(0);
    expect(parallelUpdates).toBe(0);

    scene.session.messageWindowSettings.allowEventMovementDuringWait = true;
    harness.tick(60);
    expect(scene.autonomousNPCs.get("bystander")?.step).toBeGreaterThan(0);
    expect(parallelUpdates).toBeGreaterThan(0);
  });
});

describe("pathfinding through the real frame dispatcher", () => {
  function setup() {
    const h = movementHarness();
    const s = h.scene;
    s.running = true;
    s.session.x = s.tileX; s.session.y = s.tileY;
    s.commandMoveRouteEventIds = new Set();
    s.registerAutonomousMover = (id, moves, repeat) => registerAutonomousMover(s, id, moves, repeat);
    s.updateAutonomousNPCs = delta => updateAutonomousNPCs(s, delta);
    s.runtimeDom = { upsertEventMarker: () => undefined } as never;
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(cb => { callbacks.set(++id, cb); return id; });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(key => { callbacks.delete(key); });
    const tick = () => {
      h.tick(1);
      const pending = [...callbacks.values()]; callbacks.clear();
      for (const cb of pending) cb(performance.now());
    };
    return { s, tick };
  }

  it.each(["player", "this-event"])("walks %s around a solid NPC and waits for the last tween", async target => {
    const { s, tick } = setup();
    try {
      const start = target === "player" ? 5 : 8;
      if (target !== "player") {
        s.map.events.push(event("walker", start, 5, [page("walker", "same", { kind: "action" })]));
        s.eventSprites.set("walker", mockSprite() as never);
      }
      s.map.events.push(event("blocker", start + 1, 5, [page("blocker", "same", { kind: "action" })]));
      const step = { kind: "pathfindMove", target, x: start + 2, y: 5, speed: 4, wait: true } as const;
      const plan = planPathfindMove(s, step, "walker")!;
      expect(plan.moves.length).toBeGreaterThan(2);
      let done = false;
      const pending = playPathfindMove(s, step, "walker").then(() => { done = true; });
      expect(done).toBe(false);
      expect(s.tileX).toBe(5);
      const visited: string[] = [];
      for (let i = 0; i < 250; i++) {
        tick();
        const p = target === "player" ? { x: s.tileX, y: s.tileY } : s.eventPositions.walker;
        if (p) visited.push(`${p.x},${p.y}`);
        if (i === 5) expect(done).toBe(false);
      }
      await pending;
      expect(visited).not.toContain(`${start + 1},5`);
      expect(visited).toContain(`${start + 2},5`);
      expect(s.session.flags.pathfindSucceeded).toBe(true);
      expect(s.moveDurationMs).toBe(160);
    } finally { vi.restoreAllMocks(); }
  });

  it.each(["player", "this-event"])("stops %s when an obstacle appears instead of drifting along the remaining directions", async target => {
    const { s, tick } = setup();
    try {
      const start = target === "player" ? 5 : 8;
      if (target !== "player") {
        s.map.events.push(event("walker", start, 5, [page("walker", "same", { kind: "action" })]));
        s.eventSprites.set("walker", mockSprite() as never);
      }
      const step = { kind: "pathfindMove", target, x: start + 2, y: 6, speed: 4, wait: true } as const;
      const first = planPathfindMove(s, step, "walker")!.moves[0]!;
      if (first.kind !== "move") throw new Error("Expected walking step");
      const dx = first.dir === "right" ? 1 : first.dir === "left" ? -1 : 0;
      const dy = first.dir === "down" ? 1 : first.dir === "up" ? -1 : 0;
      const pending = playPathfindMove(s, step, "walker");
      s.map.events.push(event("new_blocker", start + dx, 5 + dy, [page("blocker", "same", { kind: "action" })]));
      for (let i = 0; i < 100; i++) tick();
      await pending;
      if (target === "player") expect([s.tileX, s.tileY]).toEqual([start, 5]);
      else expect(s.eventPositions.walker ?? { x: start, y: 5 }).toMatchObject({ x: start, y: 5 });
      expect(s.playerRoute).toBeNull();
      expect(s.autonomousNPCs.has("walker")).toBe(false);
      expect(s.session.flags.pathfindSucceeded).toBe(false);
    } finally { vi.restoreAllMocks(); }
  });

  it("retargets a walking player from the admitted landing tile without accelerating the active step", async () => {
    const { s, tick } = setup();
    try {
      const first = playPathfindMove(s, { kind: "pathfindMove", target: "player", x: 9, y: 5, speed: 2, wait: false });
      for (let i = 0; i < 5; i++) tick();
      expect(s.moving).toBe(true);
      const before = s.moveProgress;
      const replacement = playPathfindMove(s, { kind: "pathfindMove", target: "player", x: 5, y: 8, speed: 5, wait: true });
      tick();
      expect(s.moveProgress - before).toBeLessThan(0.1);
      for (let i = 0; i < 300; i++) tick();
      await Promise.all([first, replacement]);
      expect([s.tileX, s.tileY]).toEqual([5, 8]);
      expect(s.session.flags.pathfindSucceeded).toBe(true);
    } finally { vi.restoreAllMocks(); }
  });

  it("waits for landing when a moving player is retargeted to that very landing tile", async () => {
    const { s, tick } = setup();
    try {
      const first = playPathfindMove(s, { kind: "pathfindMove", target: "player", x: 9, y: 5, speed: 2, wait: false });
      for (let i = 0; i < 5; i++) tick();
      const target = { ...s.movingTo };
      let done = false;
      const replacement = playPathfindMove(s, { kind: "pathfindMove", target: "player", ...target, speed: 5, wait: true }).then(() => { done = true; });
      await Promise.resolve();
      expect(done).toBe(false);
      for (let i = 0; i < 300; i++) tick();
      await Promise.all([first, replacement]);
      expect([s.tileX, s.tileY]).toEqual([target.x, target.y]);
      expect(s.session.flags.pathfindSucceeded).toBe(true);
    } finally { vi.restoreAllMocks(); }
  });

  it("retargets a walking NPC without snapping its active tween or reporting arrival early", async () => {
    const { s, tick } = setup();
    try {
      s.map.events.push(event("walker", 8, 5, [page("walker", "same", { kind: "action" })]));
      const sprite = mockSprite(); s.eventSprites.set("walker", sprite as never);
      const first = playPathfindMove(s, { kind: "pathfindMove", target: "walker", x: 12, y: 5, speed: 2, wait: false });
      for (let i = 0; i < 5; i++) tick();
      const before = sprite.x;
      const landing = { ...s.eventPositions.walker };
      let done = false;
      const replacement = playPathfindMove(s, { kind: "pathfindMove", target: "walker", x: landing.x, y: landing.y, speed: 5, wait: true }).then(() => { done = true; });
      await Promise.resolve(); expect(done).toBe(false);
      tick(); expect(Math.abs(sprite.x - before)).toBeLessThan(2);
      for (let i = 0; i < 300; i++) tick();
      await Promise.all([first, replacement]);
      expect(s.eventPositions.walker).toMatchObject({ x: landing.x, y: landing.y });
      expect(sprite.x).toBe(footprintSpriteX(landing.x, { width: 1, height: 1 }));
      expect(s.autonomousNPCs.has("walker")).toBe(false);
    } finally { vi.restoreAllMocks(); }
  });

  it.each(["player", "walker"])("replaces a queued route to %s with a no-op destination before any step starts", async target => {
    const { s, tick } = setup();
    try {
      const x = target === "player" ? 5 : 8;
      if (target === "walker") {
        s.map.events.push(event("walker", x, 5, [page("walker", "same", { kind: "action" })]));
        s.eventSprites.set("walker", mockSprite() as never);
      }
      const first = playPathfindMove(s, { kind: "pathfindMove", target, x: x + 3, y: 5, speed: 2, wait: false });
      const replacement = playPathfindMove(s, { kind: "pathfindMove", target, x, y: 5, speed: 5, wait: true });
      for (let i = 0; i < 300; i++) tick();
      await Promise.all([first, replacement]);
      const position = target === "player" ? { x: s.tileX, y: s.tileY } : s.eventPositions.walker ?? { x, y: 5 };
      expect(position).toMatchObject({ x, y: 5 });
      expect(s.session.flags.pathfindSucceeded).toBe(true);
    } finally { vi.restoreAllMocks(); }
  });

  it("does not start a route outside the map and cancels its own route on abort", async () => {
    const { s } = setup();
    try {
      await playPathfindMove(s, { kind: "pathfindMove", target: "player", x: -1, y: 5, speed: 4, wait: true });
      expect(s.playerRoute).toBeNull();
      const abort = new AbortController();
      const pending = playPathfindMove(s, { kind: "pathfindMove", target: "player", x: 8, y: 5, speed: 4, wait: true }, undefined, abort.signal);
      abort.abort();
      await pending;
      expect(s.playerRoute).toBeNull();
    } finally { vi.restoreAllMocks(); }
  });

  it("keeps input locked but lets parallel producers run during a foreground condition wait", () => {
    const h = movementHarness();
    h.scene.running = true;
    h.scene.inputEnabled = false;
    h.scene.updateParallelEvents = () => { h.scene.session.switches.ready = true; };
    conditionWaitScenes.add(h.scene);
    try { h.tick(1); } finally { conditionWaitScenes.delete(h.scene); }
    expect(h.scene.session.switches.ready).toBe(true);
    expect(h.scene.inputEnabled).toBe(false);
  });
});
