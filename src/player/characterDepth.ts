import { TILE_SIZE } from "@/assets/bundled";
import type { EventPriority, TilesetDef } from "@/project/types";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { footprintBounds } from "@/project/footprint";
import type { CharacterFootprint } from "@/project/types";

const PRIORITY_DEPTH_BASE: Record<EventPriority, number> = {
  below: 100_000,
  same: 200_000,
  above: 300_000,
};

/** 하층 지형 컨테이너 depth — 캐릭터(same=200k+) 아래. */
export const MAP_LOWER_LAYER_DEPTH = 0;
/**
 * 상층 ★(수관·통행 가능 오버레이) 컨테이너 depth — same 캐릭터 위, above 이벤트 아래.
 * RM2K3 ★: 수관이 플레이어 위에 그려져 숲 겹침/뒤로 지나감 효과가 난다.
 *
 * 주의: 상위 레이어의 **솔리드 가구(×)** 는 이 고정 depth를 쓰면 안 된다.
 * 책상·탁자 등은 캐릭터와 y-sort 되어야 하므로 {@link mapUpperTileDepth} 를 쓴다.
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

/**
 * 발자국 가로 중앙의 월드 X. 스프라이트 원점이 (0.5, 1) 이라 이 값이 곧 중심선이다.
 * 1x1·홀수 폭이면 characterSpriteX 와 같고, 짝수 폭이면 두 칸 경계에 온다.
 *
 * Y 는 별도 함수가 필요 없다 — 발자국 하단은 언제나 y 이므로 characterSpriteY 가 그대로 맞는다.
 *
 * ⚠️ 적용 범위는 **최초 렌더(`renderEvents`) 하나뿐이다.** 이벤트 스프라이트를 *다시*
 * 놓는 경로들은 아직 `characterSpriteX` 를 쓴다 — `playSceneAutonomous.ts` 의
 * `updateAutonomousNPCs`·`updateChaseNpc`·`updateActiveNpcMove`, 그리고
 * `playSceneActionCombat.ts` 의 `applyKnockback`·`startWindup`·`stepDash`.
 * 그래서 폭이 2 이상인 이벤트가 움직이면 발자국 중앙에서 타일 중앙으로 튄다.
 *
 * 의도된 경계이지 누락이 아니다. `EventPage.footprint` 를 쓰는 편집 UI 가 아직 없어
 * (2차 계획) 움직이는 다중 타일 이벤트를 저작할 방법 자체가 없고, 이 경로들은 게임에서
 * 가장 타이밍에 민감한 코드다. 2차에서 `canMoveFootprint` 전환과 함께 옮긴다.
 */
export function footprintSpriteX(tileX: number, footprint: CharacterFootprint): number {
  return (footprintBounds(tileX, 0, footprint).left + footprint.width / 2) * TILE_SIZE;
}

export function characterDepth(priority: EventPriority, worldY: number): number {
  return PRIORITY_DEPTH_BASE[priority] + worldY;
}

/**
 * 상위 맵 타일 depth.
 * - ★(통행 가능 upper): 항상 캐릭터 위 — 숲 수관.
 * - ×(솔리드 upper): same-priority 캐릭터와 타일 하단 y 로 정렬 — 책상/가구.
 */
export function mapUpperTileDepth(tileset: TilesetDef, tile: number, tileY: number): number {
  if (passageMarkForTile(tileset, tile) === "star") return MAP_UPPER_LAYER_DEPTH;
  return characterDepth("same", characterSpriteY(tileY));
}

/** ★ 수관/꽃 등 — 고정 upper 컨테이너. 솔리드 가구는 false(y-sort). */
export function isAlwaysAboveCharacterUpperTile(tileset: TilesetDef, tile: number): boolean {
  return passageMarkForTile(tileset, tile) === "star";
}

export function placeCharacterSprite(sprite: CharacterSprite, priority: EventPriority): void {
  sprite.setOrigin(0.5, 1);
  updateCharacterDepth(sprite, priority);
}

export function updateCharacterDepth(sprite: CharacterSprite, priority: EventPriority): void {
  sprite.setDepth(characterDepth(priority, sprite.y));
}
