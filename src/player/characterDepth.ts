import { TILE_SIZE } from "@/assets/bundled";
import type { EventPriority } from "@/project/types";

const PRIORITY_DEPTH_BASE: Record<EventPriority, number> = {
  below: 100_000,
  same: 200_000,
  above: 300_000,
};

/** 하층 지형 컨테이너 depth — 캐릭터(same=200k+) 아래. */
export const MAP_LOWER_LAYER_DEPTH = 0;
/**
 * 상층(★) 타일 컨테이너 depth — same 캐릭터 위, above 이벤트 아래.
 * RM2K3 ★: 수관이 플레이어 위에 그려져 숲 겹침/뒤로 지나감 효과가 난다.
 * 예전에는 tileLayer(depth 0) 안에 upper 를 넣어 수관이 항상 캐릭터 아래에 깔렸다.
 */
export const MAP_UPPER_LAYER_DEPTH = 250_000;

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
