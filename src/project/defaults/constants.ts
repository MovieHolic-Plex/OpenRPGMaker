import type { AssetRef } from "../types";

export const DEFAULT_TILESET_ID = "easyrpg_chipset_combined_town";
export const DEFAULT_TILESET_NAME = "EasyRPG RTP Combined Town ChipSet";
export const DEFAULT_TILESET_TEXTURE_KEY = "tex_easyrpg_chipset_combined_town";
export const LEGACY_RM_TILESET_ID = "tiles_default";
export const LEGACY_RM_TILESET_NAME = "RM 기본 샘플 칩셋";
export const LEGACY_RM_TILESET_TEXTURE_KEY = "tex_tiles_default";
export const DEFAULT_SPRITE_HERO = "hero";
export const DEFAULT_SPRITE_NPC = "npc_villager";
export const DEFAULT_ACTOR_ID = "actor_hero";
export const DEFAULT_CLASS_ID = "class_hero";
export const DEFAULT_SKILL_ID = "skill_attack";
export const DEFAULT_ITEM_ID = "item_potion";
export const DEFAULT_EQUIPMENT_ID = "equip_sword";
export const DEFAULT_ENEMY_ID = "enemy_slime";
export const DEFAULT_TROOP_ID = "troop_slime";
export const DEFAULT_STATE_ID = "state_poison";
export const DEFAULT_ANIMATION_ID = "anim_hit";

export const DEFAULT_TILE_SIZE = 16;
export const DEFAULT_TILES_PER_ROW = 30;
export const DEFAULT_TILE_COUNT = 480;
export const DEFAULT_SPRITE_FRAME_WIDTH = 32;
export const DEFAULT_SPRITE_FRAME_HEIGHT = 32;

export const TILE = {
  GRASS: 240,
  WATER: 120,
  WALL: 306,
  PATH: 360,
  FLOOR: 342,
  SAND: 423,
  TREE: 290,
  STAIRS: 246,
  DARK_GRASS: 303,
  FLOWERS: 288,
  EMPTY: -1,
} as const;

export const DEFAULT_SOLID_TILES = new Set<number>([TILE.WATER, TILE.WALL, TILE.TREE]);

export function bundledAssetRef(id: string): AssetRef {
  return { type: "bundled", id };
}
