import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import type { GameMap } from "@/project/types";

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
