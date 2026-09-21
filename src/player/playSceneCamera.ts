import { mapTileSize } from "@/project/tileGeometry";
import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import type { GameMap } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { RuntimeCameraSessionState, RuntimeCameraTarget } from "@/project/sessionRuntimeTypes"
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState"
import { store } from "@/project/store";
import { bumpPerfCounter } from "@/player/runtimePerfCounters";

export type ScrollMapDirection = "down" | "left" | "right" | "up";

export type ScrollMapPanInput = {
  readonly centerX: number;
  readonly centerY: number;
  readonly direction: ScrollMapDirection;
  readonly distanceTiles: number;
  readonly tileSize?: number;
};

export type ScrollMapPanTarget = {
  readonly x: number;
  readonly y: number;
};

export function centerRuntimeCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  map: GameMap,
  player: Phaser.GameObjects.Sprite
): void {
  const mapWidth = Math.max(mapTileSize(map), map.width * mapTileSize(map));
  const mapHeight = Math.max(mapTileSize(map), map.height * mapTileSize(map));
  const paddingX = Math.max(0, (camera.width - mapWidth) / 2);
  const paddingY = Math.max(0, (camera.height - mapHeight) / 2);
  camera.setZoom(1);
  camera.setBounds(
    -paddingX,
    -paddingY,
    Math.max(camera.width, mapWidth),
    Math.max(camera.height, mapHeight)
  );
  camera.centerOn(player.x, player.y);
}

export function calculateScrollMapPanTarget(input: ScrollMapPanInput): ScrollMapPanTarget {
  const distance = Math.max(0, input.distanceTiles) * (input.tileSize ?? TILE_SIZE);
  switch (input.direction) {
    case "left":
      return { x: input.centerX - distance, y: input.centerY };
    case "right":
      return { x: input.centerX + distance, y: input.centerY };
    case "up":
      return { x: input.centerX, y: input.centerY - distance };
    case "down":
      return { x: input.centerX, y: input.centerY + distance };
  }
}

export type ScrollMapStep = {
  readonly direction: ScrollMapDirection;
  readonly distanceTiles: number;
  readonly durationMs: number;
  readonly wait: boolean;
  readonly returnToPlayer: boolean;
  readonly lock: boolean;
};

export function panRuntimeCamera(scene: PlaySceneContext, step: ScrollMapStep): Promise<void> {
  const camera = scene.cameras.main;
  const from = camera.worldView.centerX || scene.player.x;
  const fromY = camera.worldView.centerY || scene.player.y;
  const target = calculateScrollMapPanTarget({
    centerX: from,
    centerY: fromY,
    direction: step.direction,
    distanceTiles: step.distanceTiles,
    tileSize: mapTileSize(scene.map),
  });
  camera.stopFollow();
  const sequence = async (): Promise<void> => {
    await panCamera(camera, target.x, target.y, step.durationMs);
    if (step.returnToPlayer) {
      await panCamera(camera, scene.player.x, scene.player.y, step.durationMs);
    }
    if (!step.lock || step.returnToPlayer) {
      camera.startFollow(scene.player, true, 0.2, 0.2);
    }
  };
  const promise = sequence();
  return step.wait ? promise : Promise.resolve();
}

export type CameraControlStep = {
  readonly mode: "pan" | "follow" | "fixed" | "return";
  readonly target: RuntimeCameraTarget;
  readonly durationMs: number;
  readonly wait: boolean;
  readonly returnToPlayer: boolean;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly zoom?: number;
};

export function applyStoredCameraState(scene: PlaySceneContext): void {
  const state = scene.session.camera;
  if (!state) {
    followCameraTarget(scene, { kind: "player" });
    return;
  }
  applyCameraZoom(scene.cameras.main, state.zoom);
  if (state.mode === "follow") {
    followCameraTarget(scene, state.target);
    return;
  }
  const target = resolveCameraTarget(scene, state.target, state.offsetX, state.offsetY);
  scene.cameras.main.stopFollow();
  scene.cameras.main.centerOn(target.x, target.y);
}

export function applyCameraControl(scene: PlaySceneContext, step: CameraControlStep): Promise<void> {
  applyCameraZoom(scene.cameras.main, step.zoom);
  const run = async (): Promise<void> => {
    if (step.mode === "follow") {
      followCameraTarget(scene, step.target);
      scene.session.camera = cameraState("follow", step);
      scene.syncRuntimeState();
      return;
    }
    if (step.mode === "return" || step.returnToPlayer) {
      scene.cameras.main.stopFollow();
      await panToTarget(scene, { kind: "player" }, step.durationMs, step.offsetX, step.offsetY);
      followCameraTarget(scene, { kind: "player" });
      scene.session.camera = { mode: "follow", target: { kind: "player" }, zoom: step.zoom };
      scene.syncRuntimeState();
      return;
    }
    scene.cameras.main.stopFollow();
    await panToTarget(scene, step.target, step.durationMs, step.offsetX, step.offsetY);
    scene.session.camera = cameraState("fixed", step);
    scene.syncRuntimeState();
  };
  const promise = run();
  if (!step.wait) {
    void promise;
    return Promise.resolve();
  }
  return promise;
}

function cameraState(mode: RuntimeCameraSessionState["mode"], step: CameraControlStep): RuntimeCameraSessionState {
  return {
    mode,
    target: step.target,
    offsetX: step.offsetX,
    offsetY: step.offsetY,
    zoom: step.zoom,
  };
}

function followCameraTarget(scene: PlaySceneContext, target: RuntimeCameraTarget): void {
  const followTarget = followObjectForTarget(scene, target);
  if (followTarget) {
    const camera = scene.cameras.main;
    // Phaser 의 startFollow 는 scrollX/Y 를 대상 좌표로 **하드 설정**한다(Camera.js §startFollow).
    // 이미 같은 대상을 따르는 중에 다시 부르면 0.2 러프가 죽고 화면이 대상 위치로 튄다. 이 함수는
    // refreshRuntimeSurfaces 를 거쳐 인터프리터 스텝마다 불리므로(실측: 대화 1회에 6번, 100ms
    // 병렬 이벤트면 초당 8번) 같은 대상이면 아무것도 하지 않는다.
    if (isFollowing(camera, followTarget)) {
      bumpPerfCounter(scene, "cameraRefollowsSkipped");
      return;
    }
    bumpPerfCounter(scene, "cameraRefollows");
    camera.startFollow(followTarget, true, 0.2, 0.2);
    return;
  }
  const resolved = resolveCameraTarget(scene, target);
  scene.cameras.main.stopFollow();
  scene.cameras.main.centerOn(resolved.x, resolved.y);
}

/**
 * 카메라가 지금 이 객체를 따르는가. Phaser 는 추적 대상을 `_follow` 에만 둔다(공개 getter 없음);
 * 없는 환경(테스트 스텁)에서는 모른다고 보고 startFollow 를 그대로 부른다.
 */
function isFollowing(camera: Phaser.Cameras.Scene2D.Camera, target: Phaser.GameObjects.Sprite): boolean {
  const current = (camera as unknown as { _follow?: unknown })._follow;
  return current !== undefined && current === target;
}

function followObjectForTarget(
  scene: PlaySceneContext,
  target: RuntimeCameraTarget
): Phaser.GameObjects.Sprite | null {
  if (target.kind === "player") return scene.player;
  if (target.kind === "event") return scene.eventSprites.get(target.eventId) ?? null;
  return null;
}

function panToTarget(
  scene: PlaySceneContext,
  target: RuntimeCameraTarget,
  durationMs: number,
  offsetX = 0,
  offsetY = 0
): Promise<void> {
  const resolved = resolveCameraTarget(scene, target, offsetX, offsetY);
  return panCamera(scene.cameras.main, resolved.x, resolved.y, durationMs);
}

function resolveCameraTarget(
  scene: PlaySceneContext,
  target: RuntimeCameraTarget,
  offsetX = 0,
  offsetY = 0
): { readonly x: number; readonly y: number } {
  if (target.kind === "player") return { x: scene.player.x + offsetX, y: scene.player.y + offsetY };
  if (target.kind === "position") {
    return { x: characterSpriteX(target.x, mapTileSize(scene.map)) + offsetX, y: characterSpriteY(target.y, mapTileSize(scene.map)) + offsetY };
  }
  const sprite = scene.eventSprites.get(target.eventId);
  if (sprite) return { x: sprite.x + offsetX, y: sprite.y + offsetY };
  const view = runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)
    .find((event) => event.event.id === target.eventId);
  // 스프라이트가 없는 이벤트로 팬할 때도 **몸 중앙**을 겨눈다. 앵커를 쓰면 3x3 골렘이
  // 화면 한쪽으로 밀린 채 멈춘다.
  if (view) return { x: footprintSpriteX(view.x, view.footprint, mapTileSize(scene.map)) + offsetX, y: characterSpriteY(view.y, mapTileSize(scene.map)) + offsetY };
  return { x: scene.player.x + offsetX, y: scene.player.y + offsetY };
}

function applyCameraZoom(camera: Phaser.Cameras.Scene2D.Camera, zoom: number | undefined): void {
  if (zoom === undefined || !Number.isFinite(zoom) || zoom <= 0) return;
  camera.setZoom(Math.min(4, Math.max(0.25, zoom)));
}

export function panCamera(camera: Phaser.Cameras.Scene2D.Camera, x: number, y: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const duration = Math.max(0, Math.round(durationMs));
    if (duration === 0) {
      camera.centerOn(x, y);
      resolve();
      return;
    }
    camera.once("camerapancomplete", () => resolve());
    camera.pan(x, y, duration, "Linear", true);
  });
}
