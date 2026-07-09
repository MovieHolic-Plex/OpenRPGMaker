import { describe, expect, it } from "vitest";
import {
  applyCameraControl,
  applyStoredCameraState,
  calculateScrollMapPanTarget,
} from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";

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
