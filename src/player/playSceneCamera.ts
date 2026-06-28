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
  const coverZoom = Math.max(1, camera.width / mapWidth, camera.height / mapHeight);
  camera.setBounds(0, 0, mapWidth, mapHeight);
  camera.setZoom(coverZoom);
  camera.centerOn(player.x, player.y);
}
