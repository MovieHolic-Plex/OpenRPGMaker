import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import type { GameMap } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";

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
  const mapWidth = Math.max(TILE_SIZE, map.width * TILE_SIZE);
  const mapHeight = Math.max(TILE_SIZE, map.height * TILE_SIZE);
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

function panCamera(camera: Phaser.Cameras.Scene2D.Camera, x: number, y: number, durationMs: number): Promise<void> {
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
