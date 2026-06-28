import { TILE_SIZE } from "@/assets/bundled";
import type { EventPriority } from "@/project/types";

const PRIORITY_DEPTH_BASE: Record<EventPriority, number> = {
  below: 100_000,
  same: 200_000,
  above: 300_000,
};

export type CharacterSprite = {
  readonly y: number;
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
};

export function characterSpriteX(tileX: number): number {
  return tileX * TILE_SIZE + TILE_SIZE / 2;
}

export function characterSpriteY(tileY: number): number {
  return tileY * TILE_SIZE + TILE_SIZE;
}

export function characterDepth(priority: EventPriority, worldY: number): number {
  return PRIORITY_DEPTH_BASE[priority] + worldY;
}

export function placeCharacterSprite(sprite: CharacterSprite, priority: EventPriority): void {
  sprite.setOrigin(0.5, 1);
  updateCharacterDepth(sprite, priority);
}

export function updateCharacterDepth(sprite: CharacterSprite, priority: EventPriority): void {
  sprite.setDepth(characterDepth(priority, sprite.y));
}
