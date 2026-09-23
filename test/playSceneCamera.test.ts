import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyCameraControl,
  applyStoredCameraState,
  calculateScrollMapPanTarget,
} from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import { rebindEventFollowCamera } from "@/player/playSceneMapRuntime";
import { store } from "@/project/store";

type CameraListener = () => void;

class CameraStub {
  width = 320;
  height = 240;
  zoom = 1;
  scrollX = 0;
  scrollY = 0;
  worldView = { centerX: 160, centerY: 120 };
  followTarget: unknown = null;
  stopFollowCalls = 0;
  panCalls: { readonly x: number; readonly y: number; readonly duration: number }[] = [];
  centerCalls: { readonly x: number; readonly y: number }[] = [];
  private readonly listeners: Record<string, CameraListener> = {};

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  setBounds(): void {
    return undefined;
  }

  centerOn(x: number, y: number): void {
    this.worldView.centerX = x;
    this.worldView.centerY = y;
    this.centerCalls.push({ x, y });
  }

  startFollow(target: unknown): void {
    this.followTarget = target;
  }

  stopFollow(): void {
    this.stopFollowCalls += 1;
    this.followTarget = null;
  }

  once(eventName: string, listener: CameraListener): void {
    this.listeners[eventName] = listener;
  }

  pan(x: number, y: number, duration: number): void {
    this.worldView.centerX = x;
    this.worldView.centerY = y;
    this.panCalls.push({ x, y, duration });
    this.listeners.camerapancomplete?.();
  }
}

function cameraScene(camera = new CameraStub()): PlaySceneContext & { readonly camera: CameraStub } {
  const project = createBlankProject();
  const session = startSession(project);
  const player = { x: 160, y: 120 };
  return {
    camera,
    cameras: { main: camera },
    player,
    eventSprites: new Map(),
    session,
    map: project.maps[project.startMapId],
    eventPositions: {},
    syncRuntimeState: () => undefined,
  } as unknown as PlaySceneContext & { readonly camera: CameraStub };
}

describe("playSceneCamera scroll map", () => {
  it("calculates tile-distance pan targets by direction", () => {
    expect(calculateScrollMapPanTarget({ centerX: 160, centerY: 120, direction: "right", distanceTiles: 3, tileSize: 16 })).toEqual({
      x: 208,
      y: 120,
    });
    expect(calculateScrollMapPanTarget({ centerX: 160, centerY: 120, direction: "up", distanceTiles: 2, tileSize: 16 })).toEqual({
      x: 160,
      y: 88,
    });
  });

  it("clamps negative distance to no movement", () => {
    expect(calculateScrollMapPanTarget({ centerX: 10, centerY: 20, direction: "left", distanceTiles: -4, tileSize: 16 })).toEqual({
      x: 10,
      y: 20,
    });
  });
});

describe("playSceneCamera camera control", () => {
  it("pans to a tile coordinate and records a fixed camera state", async () => {
    const scene = cameraScene();

    await applyCameraControl(scene, {
      mode: "pan",
      target: { kind: "position", x: 4, y: 5 },
      durationMs: 120,
      wait: true,
      returnToPlayer: false,
    });

    expect(scene.camera.stopFollowCalls).toBe(1);
    expect(scene.camera.panCalls).toEqual([{ x: 72, y: 96, duration: 120 }]);
    expect(scene.session.camera).toMatchObject({ mode: "fixed", target: { kind: "position", x: 4, y: 5 } });
  });

  it("follows an event sprite by id", async () => {
    const scene = cameraScene();
    const npcSprite = { x: 88, y: 104 };
    scene.eventSprites.set("npc", npcSprite as never);

    await applyCameraControl(scene, {
      mode: "follow",
      target: { kind: "event", eventId: "npc" },
      durationMs: 0,
      wait: true,
      returnToPlayer: false,
    });

    expect(scene.camera.followTarget).toBe(npcSprite);
    expect(scene.session.camera).toMatchObject({ mode: "follow", target: { kind: "event", eventId: "npc" } });
  });

  it("returns to player follow after a camera control return", async () => {
    const scene = cameraScene();

    await applyCameraControl(scene, {
      mode: "return",
      target: { kind: "position", x: 0, y: 0 },
      durationMs: 90,
      wait: true,
      returnToPlayer: true,
    });

    expect(scene.camera.panCalls).toEqual([{ x: 160, y: 120, duration: 90 }]);
    expect(scene.camera.followTarget).toBe(scene.player);
    expect(scene.session.camera).toMatchObject({ mode: "follow", target: { kind: "player" } });
  });

  it("applies and saves fixed camera state across a save round trip", () => {
    const scene = cameraScene();
    scene.session.camera = {
      mode: "fixed",
      target: { kind: "position", x: 2, y: 3 },
      offsetX: 4,
      offsetY: -2,
      zoom: 1.5,
    };

    applyStoredCameraState(scene);

    expect(scene.camera.zoom).toBe(1.5);
    expect(scene.camera.centerCalls.at(-1)).toEqual({ x: 44, y: 62 });

    const project = createBlankProject();
    const session = startSession(project);
    session.camera = scene.session.camera;
    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, snapshot);

    expect(restored.camera).toEqual(scene.session.camera);
  });
});

// 이벤트 스프라이트를 파괴·재생성하는 갱신 경로(refreshRuntimeEntities)는 카메라를 새
// 객체에 다시 걸어야 한다. 안 걸면 Phaser 가 파괴된 옛 객체의 x/y 를 계속 읽어 카메라가
// 그 자리에 영구히 얼어붙는다 — 시간표 변경 한 번으로 그렇게 된다.
// (여기서는 재바인딩 단위를 직접 시험한다. refreshRuntimeEntities 에서 이 함수를 부르는
//  한 줄은 코드로 확인했다 — 그 경로 전체는 렌더 하네스가 필요해 e2e 영역이다.)
describe("이벤트 추적 카메라는 스프라이트 재생성 뒤 다시 걸린다", () => {
  it("새 스프라이트로 재바인딩한다", async () => {
    const scene = cameraScene();
    const oldSprite = { x: 88, y: 104 };
    scene.eventSprites.set("npc", oldSprite as never);
    await applyCameraControl(scene, {
      mode: "follow",
      target: { kind: "event", eventId: "npc" },
      durationMs: 0,
      wait: true,
      returnToPlayer: false,
    });
    expect(scene.camera.followTarget).toBe(oldSprite);

    // renderEventLayer 가 하는 일: 옛 스프라이트를 파괴하고 새 객체로 갈아치운다.
    const newSprite = { x: 200, y: 216 };
    scene.eventSprites.set("npc", newSprite as never);

    rebindEventFollowCamera(scene);

    expect(
      scene.camera.followTarget,
      "카메라가 파괴된 옛 스프라이트를 계속 따라간다 — 그 자리에 얼어붙는다"
    ).toBe(newSprite);
  });

  it("플레이어 추적은 건드리지 않는다 (startFollow 가 러프를 죽인다)", () => {
    const scene = cameraScene();
    scene.camera.startFollow(scene.player);
    scene.session.camera = { mode: "follow", target: { kind: "player" }, zoom: 1 } as never;

    rebindEventFollowCamera(scene);

    expect(scene.camera.followTarget).toBe(scene.player);
    expect(scene.camera.stopFollowCalls, "플레이어 추적을 건드렸다").toBe(0);
  });

  it("고정(fixed) 카메라도 건드리지 않는다", () => {
    const scene = cameraScene();
    scene.session.camera = {
      mode: "fixed",
      target: { kind: "event", eventId: "npc" },
      zoom: 1,
    } as never;

    rebindEventFollowCamera(scene);

    expect(scene.camera.followTarget).toBeNull();
    expect(scene.camera.centerCalls).toEqual([]);
  });
});

describe("타일 크기가 섞인 프로젝트의 카메라", () => {
  class BoundsCameraStub extends CameraStub {
    bounds: readonly number[] = [];
    override setBounds(...args: number[]): void {
      this.bounds = args;
    }
  }

  function mixedScene(tileSize: number, density: number) {
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    const other = { ...structuredClone(start), id: "map_32", tileSize: 32, width: 12, height: 8 };
    project.maps = { ...project.maps, map_16b: { ...structuredClone(start), id: "map_16b" }, map_32: other };
    vi.spyOn(store, "getCurrent").mockReturnValue(project);
    const camera = new BoundsCameraStub();
    camera.width = 320 * density;
    camera.height = 240 * density;
    const scene = cameraScene(camera);
    Object.assign(scene, {
      map: tileSize === 32 ? other : start,
      game: { registry: { get: (key: string) => (key === "playPixelDensity" ? density : undefined) } },
    });
    return { scene, camera };
  }

  afterEach(() => vi.restoreAllMocks());

  it("모든 맵이 기준(16px) 칸 수를 보여준다 — 저작 배율은 그 위에 곱해진다", () => {
    const village = mixedScene(16, 2);
    applyStoredCameraState(village.scene);
    expect(village.camera.zoom).toBe(2);

    const dungeon = mixedScene(32, 2);
    applyStoredCameraState(dungeon.scene);
    expect(dungeon.camera.zoom).toBe(1);

    dungeon.scene.session.camera = { mode: "follow", target: { kind: "player" }, zoom: 1.5 };
    applyStoredCameraState(dungeon.scene);
    expect(dungeon.camera.zoom).toBe(1.5);
  });

  it("경계는 보이는 세계 크기 기준이다 — 작은 맵은 가운데, 여백은 배율로 나눈 값", () => {
    const { scene, camera } = mixedScene(32, 2);
    applyStoredCameraState(scene);
    // 640x480 캔버스, 배율 1 → 세계 640x480 이 보인다. 맵은 384x256 이라 양옆 128, 위아래 112 여백.
    expect(camera.bounds).toEqual([-128, -112, 640, 480]);
  });
});
