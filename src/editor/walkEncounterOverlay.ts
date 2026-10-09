import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { walkEncounterRegions } from "@/editor/walkEncounterAuthoring";
import type { GameMap } from "@/project/types";

/** Called only by the editor renderer, after its map-only-capture early return. */
export function renderWalkEncounterOverlay(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  map: GameMap,
  tileSize: number = TILE_SIZE,
): void {
  const regions = walkEncounterRegions(map);
  if (!regions.length) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  // Studio's --accent is a six-digit hex token; Phaser consumes a number.
  const color = Number.parseInt(accent.replace("#", ""), 16);
  const graphics = scene.add.graphics();
  graphics.lineStyle(2, color, 0.9);
  graphics.fillStyle(color, 0.10);
  for (const rect of regions) {
    graphics.fillRect(rect.x * tileSize, rect.y * tileSize, rect.w * tileSize, rect.h * tileSize);
    graphics.strokeRect(rect.x * tileSize, rect.y * tileSize, rect.w * tileSize, rect.h * tileSize);
  }
  layer.add(graphics);
}
