import { characterBaseOrigin } from "./characterOrigin";
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

/**
 * 맵 배경(패럴랙스) depth — 하층 지형(0) **아래**. 비어 있는 칸이 뚫린 창이 되고 타일이
 * 깔린 칸은 배경을 가린다. 음수인 이유: 하층 컨테이너가 0 이고 그 아래에는 아무것도 없다.
 */
export const MAP_BACKGROUND_LAYER_DEPTH = -100_000;
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
/** 같은 묶음 안에서 위 층을 조금 위로(설계 §3). 가구 × 가 같은 줄 캐릭터 앞으로 튀지 않게 아주 작게 둔다. */
export const OVERLAY_LAYER_DEPTH_OFFSET = 0.01;
/** 그림자는 2층 위, 3층 밑(lower 컨테이너 안). */
export const SHADOW_LAYER_DEPTH_OFFSET = 0.02;

export type CharacterSprite = {
  readonly y: number;
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
};

export function characterSpriteX(tileX: number, tileSize: number = TILE_SIZE): number {
  return tileX * tileSize + tileSize / 2;
}

export function characterSpriteY(tileY: number, tileSize: number = TILE_SIZE): number {
  return tileY * tileSize + tileSize;
}

/**
 * 발자국 가로 중앙의 월드 X. 스프라이트 원점이 (0.5, 1) 이라 이 값이 곧 중심선이다.
 * 1x1·홀수 폭이면 characterSpriteX 와 같고, 짝수 폭이면 두 칸 경계에 온다.
 *
 * Y 는 별도 함수가 필요 없다 — 발자국 하단은 언제나 y 이므로 characterSpriteY 가 그대로 맞는다.
 *
 * 이벤트 스프라이트를 놓는 **모든** 경로가 이것을 쓴다(2차): 최초 렌더 `renderEvents`,
 * `playSceneAutonomous.ts` 의 걸음 보간 4곳, `playSceneActionCombat.ts` 의 넉백·윈드업·대시,
 * 그리고 스프라이트가 없는 이벤트를 겨누는 카메라·조명.
 *
 * ⚠️ 반대로 **데미지 숫자·파티클·텔레그래프·스윙 아크는 타일 중앙(`characterSpriteX`)이 맞다.**
 * 그것들은 캐릭터 그림이 아니라 칸을 가리키는 표식이다. 같은 파일에 둘이 섞여 있으니
 * 일괄 치환은 오답이다.
 */
export function footprintSpriteX(tileX: number, footprint: CharacterFootprint, tileSize: number = TILE_SIZE): number {
  return (footprintBounds(tileX, 0, footprint).left + footprint.width / 2) * tileSize;
}

export function characterDepth(priority: EventPriority, worldY: number): number {
  return PRIORITY_DEPTH_BASE[priority] + worldY;
}

/**
 * 상위 맵 타일 depth.
 * - ★(통행 가능 upper): 항상 캐릭터 위 — 숲 수관. 단, 밟고 올라서는 계단(tileMeta tags에 stair/계단/사다리 포함 —
 *   1칸 계단 444/445/474/475의 "stairs"뿐 아니라 3칸 돌계단 111/141/171의 "stone stairs"/"돌계단"까지)은
 *   수관처럼 위에 그려지면 칩이 사람 위로 뜨므로 ○扱い(캐릭터 아래)로 둔다.
 * - ○(통행 가능한 바닥/다리): 하층 지형 위, 모든 캐릭터 아래.
 * - ×(솔리드 upper): same-priority 캐릭터와 타일 하단 y 로 정렬 — 책상/가구.
 */
function isWalkableStairTile(tileset: TilesetDef, tile: number): boolean {
  const tags = tileset.tileMeta?.[tile]?.tags ?? [];
  return tags.some((tag) => /stair/i.test(tag) || tag.includes("계단") || tag.includes("사다리"));
}
/**
 * 키 큰 기물(노면전차 센터 전주 등)의 위 칸: tileMeta 태그 `foot-dy:N` = 이 칸에서 N행 아래가 밑동.
 * ★ 칸이어도 고정 상층에 두지 않고 **밑동 줄** 로 캐릭터·탈것과 y 정렬한다 — 밑동보다 남쪽에 선 전차는 기둥을 가리고,
 * 북쪽 전차는 기둥 뒤로 지나간다(줄마다 따로 정렬하면 한쪽이 틀린다, 2026-10-07 적대적 관문 지적).
 */
export function tileFootRowsBelow(tileset: TilesetDef, tile: number): number | null {
  const tags = tileset.tileMeta?.[tile]?.tags;
  if (!tags) return null;
  for (const tag of tags) {
    const m = /^foot-dy:(\d+)$/.exec(tag);
    if (m) return Number(m[1]);
  }
  return null;
}

export function mapUpperTileDepth(tileset: TilesetDef, tile: number, tileY: number, tileSize: number = tileset.tileSize): number {
  const footDy = tileFootRowsBelow(tileset, tile);
  if (footDy !== null) return characterDepth("same", characterSpriteY(tileY + footDy, tileSize));
  const mark = passageMarkForTile(tileset, tile);
  const walkableStair = mark === "star" && isWalkableStairTile(tileset, tile);
  if (mark === "star" && !walkableStair) return MAP_UPPER_LAYER_DEPTH;
  if (mark === "o" || mark === "star") return MAP_LOWER_LAYER_DEPTH + tileY * 2 + 1;
  return characterDepth("same", characterSpriteY(tileY, tileSize));
}

/** ★ 수관/꽃 등 — 고정 upper 컨테이너. 솔리드 가구·밟는 계단은 false(y-sort/하위). */
export function isAlwaysAboveCharacterUpperTile(tileset: TilesetDef, tile: number): boolean {
  if (passageMarkForTile(tileset, tile) !== "star") return false;
  if (tileFootRowsBelow(tileset, tile) !== null) return false;
  return !isWalkableStairTile(tileset, tile);
}

export function placeCharacterSprite(sprite: CharacterSprite, priority: EventPriority): void {
  const origin = characterBaseOrigin(sprite);
  sprite.setOrigin(origin.x, origin.y);
  updateCharacterDepth(sprite, priority);
}

export function updateCharacterDepth(sprite: CharacterSprite, priority: EventPriority): void {
  sprite.setDepth(characterDepth(priority, sprite.y));
}
