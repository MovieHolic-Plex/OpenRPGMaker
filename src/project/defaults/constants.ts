import type { AssetRef } from "../types";
import { BUILTIN_SPRITE_SLICING, RESOURCE_SLICING } from "@/assets/resourceSlicing";

export const DEFAULT_TILESET_ID = "easyrpg_chipset_combined_town";
// 표시명 규약은 src/assets/bundled.ts 헤더 주석 참고 — 이 값은 새 프로젝트의 타일셋
// 이름으로 저장되고 UI 에 그대로 보인다. bundled.ts 의 같은 textureKey 항목과 일치해야
// 한다(test/easyrpgAssets.test.ts 가 두 값을 비교한다).
export const DEFAULT_TILESET_NAME = "합본 마을 · EasyRPG (CC0)";
export const DEFAULT_TILESET_TEXTURE_KEY = "tex_easyrpg_chipset_combined_town";
export const LEGACY_RM_TILESET_ID = "tiles_default";
export const LEGACY_RM_TILESET_NAME = "RM 기본 샘플 타일 그림판";
export const LEGACY_RM_TILESET_TEXTURE_KEY = "tex_tiles_default";
export const DEFAULT_EASYRPG_CHARSET_ID = "tex_easyrpg_charset_people1";
export const DEFAULT_ACTOR_ID = "actor_hero";
export const DEFAULT_CLASS_ID = "class_hero";
export const DEFAULT_SKILL_ID = "skill_attack";
export const DEFAULT_ITEM_ID = "item_potion";
export const DEFAULT_EQUIPMENT_ID = "equip_sword";
export const DEFAULT_ENEMY_ID = "enemy_slime";
export const DEFAULT_TROOP_ID = "troop_slime";
export const DEFAULT_STATE_ID = "state_poison";
export const DEFAULT_ANIMATION_ID = "anim_hit";

export const DEFAULT_TILE_SIZE = RESOURCE_SLICING.chipset.cellWidth;
export const DEFAULT_TILES_PER_ROW = RESOURCE_SLICING.chipset.columns;
export const DEFAULT_TILE_COUNT = RESOURCE_SLICING.chipset.count;
export const DEFAULT_SPRITE_FRAME_WIDTH = BUILTIN_SPRITE_SLICING.cellWidth;
export const DEFAULT_SPRITE_FRAME_HEIGHT = BUILTIN_SPRITE_SLICING.cellHeight;

/**
 * 기본 칩셋(easyrpg_chipset_combined_town)의 **원시 타일 인덱스**다.
 * 이름은 의미처럼 보이지만 실제로는 좌표일 뿐이라, **다른 타일셋에서는 전혀 다른 그림**이다
 * (예: 342 는 combined_town·interior 에서 막힘, dungeon·world·ship 에서는 통행 가능 — 2026-07-27 실측).
 *
 * ⚠ FLOOR(342) / STAIRS(246) 는 **바닥·계단이 아니다.** 두 타일 모두 combined_town 에서
 * 전방향 통행 불가다. 이 저장소는 이미 그걸 알고 있어서 하네스 그룹 이름이 그대로
 * `stone-floor-trap`("겉보기엔 평평해 통행 가능해 보이지만 실측 결과 막히는 돌바닥")이다.
 * 그런데도 starterHouseTransfer 가 실내 300칸을 FLOOR 로 채워 **밟을 수 있는 칸이 2칸뿐**이었다.
 * 지면이 필요하면 GRASS / PATH / SAND / 421(자갈) / 222(나무 마루) 를 쓸 것.
 */
export const TILE = {
  GRASS: 240,
  WATER: 120,
  WALL: 306,
  PATH: 360,
  /** ⚠ 통행 불가 장식 타일. 바닥으로 쓰지 말 것 — 위 주석 참고. */
  FLOOR: 342,
  SAND: 423,
  TREE: 290,
  /** ⚠ 통행 불가 성벽 조각. 계단이 필요하면 111~113(stoneStairObjects)을 쓸 것. */
  STAIRS: 246,
  DARK_GRASS: 303,
  FLOWERS: 288,
  EMPTY: -1,
} as const;

export const DEFAULT_SOLID_TILES = new Set<number>([TILE.WATER, TILE.WALL, TILE.TREE]);

export function bundledAssetRef(id: string): AssetRef {
  return { type: "bundled", id };
}
