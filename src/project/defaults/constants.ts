import type { AssetRef } from "../types";
import { BUILTIN_SPRITE_SLICING, RESOURCE_SLICING } from "@/assets/resourceSlicing";

export const DEFAULT_TILESET_ID = "easyrpg_chipset_combined_town";
// 표시명 규약은 src/assets/bundled.ts 헤더 주석 참고 — 이 값은 새 프로젝트의 타일셋
// 이름으로 저장되고 UI 에 그대로 보인다. bundled.ts 의 같은 textureKey 항목과 일치해야
// 한다(test/easyrpgAssets.test.ts 가 두 값을 비교한다).
export const DEFAULT_TILESET_NAME = "합본 마을 · EasyRPG (CC0)";
export const DEFAULT_TILESET_TEXTURE_KEY = "tex_easyrpg_chipset_combined_town";
/** Castle2.png 원본 512px를 축소하지 않고 엔진의 16px 셀(32열)로 나눈다. */
export const CASTLE_TILESET_ID = "opengameart_castle";
export const CASTLE_TILESET_NAME = "성채 · OpenGameArt (CC-BY 3.0)";
export const CASTLE_TILESET_TEXTURE_KEY = "tex_opengameart_castle";
/** 16px reference-board atlas generated from the user-provided castle composition. */
export const CASTLE_REFERENCE_TILESET_ID = "opengameart_castle_reference";
export const CASTLE_REFERENCE_TILESET_TEXTURE_KEY = "tex_opengameart_castle_reference";
export const CASTLE_REFERENCE_TILE_SIZE = 16;
export const CASTLE_REFERENCE_TILES_PER_ROW = 140;
export const CASTLE_REFERENCE_TILE_COUNT = 140 * 140;
/** [LPC] Wooden Furniture — bluecarrot16 등, CC-BY-SA 3.0 / GPL 3.0. 32px 원본을 32열로 등록한다. */
export const LPC_WOODEN_FURNITURE_TILESET_ID = "opengameart_lpc_wooden_furniture";
export const LPC_WOODEN_FURNITURE_TILESET_NAME = "LPC 나무 가구 · OpenGameArt (CC-BY-SA 3.0)";
export const LPC_WOODEN_FURNITURE_TILESET_TEXTURE_KEY = "tex_opengameart_lpc_wooden_furniture";
export const LPC_WOODEN_FURNITURE_TILE_SIZE = 32;
export const LPC_WOODEN_FURNITURE_TILES_PER_ROW = 16;
export const LPC_WOODEN_FURNITURE_TILE_COUNT = 16 * 32;
/**
 * 16px 판 — 같은 시트를 unfake.js 로 반감 축소한 병행본(2026-09-22).
 *
 * 왜 병행하는가: 32px 판은 자기 타일셋 맵에서만 쓸 수 있고, 기존 16px 맵(합본 마을·실내)에는
 * 격자가 맞지 않아 찍을 수 없다. 16px 판은 기존 맵 어디에나 놓을 수 있다. 원본 32px 판은
 * 손대지 않고 보존한다 — 축소본이 원본을 대체하지 않는다.
 *
 * 축소는 unfake.js 코어(unfake-core WASM)의 median 블록 다운스케일로 했다. 그 라이브러리의
 * morph(구멍 메우기)와 양자화는 이 시트에 해로웠다 — 얇은 손잡이·칸막이를 노이즈로 보고
 * 지운다(실측: 긴 탁자 다리 소실). 이 시트는 AI 생성물이 아니라 진짜 픽셀아트라 되돌릴
 * 가짜 픽셀이 없기 때문이다. 그래서 다운스케일 단계만 쓴다.
 */
export const LPC_WOODEN_FURNITURE_16_ID = "opengameart_lpc_wooden_furniture_16";
export const LPC_WOODEN_FURNITURE_16_NAME = "LPC 나무 가구 16px · OpenGameArt (CC-BY-SA 3.0)";
export const LPC_WOODEN_FURNITURE_16_TEXTURE_KEY = "tex_opengameart_lpc_wooden_furniture_16";
export const LPC_WOODEN_FURNITURE_16_TILE_SIZE = 16;
export const LPC_WOODEN_FURNITURE_16_TILES_PER_ROW = 16;
export const LPC_WOODEN_FURNITURE_16_TILE_COUNT = 16 * 32;
export const CASTLE_TILE_SIZE = 16;
export const CASTLE_TILES_PER_ROW = 32;
export const CASTLE_TILE_COUNT = 1024;
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

/**
 * 「합본 마을 + 레트로 월드맵」 혼합 칩셋(2026-09-18). 480×608 한 장 — 위 480칸은 합본 마을과
 * **같은 ID**(하네스·시맨틱·오토타일·물 애니가 그 번호에 묶여 있어 흔들 수 없다), 다음 480칸은
 * 레트로 월드맵(ID = 원본 + RETRO_WORLD_TILE_OFFSET), 맨 아래 6행(180칸)은 숲 나무 확장 띠
 * (FOREST_TREES_TILE_OFFSET 부터, defaults/forestTreesExtension.ts). 시트는
 * scripts/gen-combined-town-retro-world-chipset.mjs, 타일셋 조립은 defaults/combinedTownRetroWorld.ts.
 * 이름의 「혼합 출처」는 레트로 월드맵 반쪽의 CC-BY/CC0/WTFPL 혼합(vendor/easyrpg-rtp/AUTHORS.md)을
 * 그대로 이어받은 것이다.
 */
export const COMBINED_TOWN_RETRO_WORLD_TILESET_ID = "easyrpg_chipset_combined_town_retro_world";
export const COMBINED_TOWN_RETRO_WORLD_TEXTURE_KEY = "tex_easyrpg_chipset_combined_town_retro_world";
export const COMBINED_TOWN_RETRO_WORLD_NAME = "합본 마을+레트로 월드맵 · EasyRPG (혼합 출처)";
export const RETRO_WORLD_TILE_OFFSET = DEFAULT_TILE_COUNT;
/**
 * 숲 나무 확장 띠 — 사용자 제공 32px 격자 자연 시트의 나무·덤불만 원본 픽셀로 옮긴 6행(2026-09-18).
 * 타일 번호 960~1139. 그림 public/assets/chipset-ext-forest-trees.png, 판정표 defaults/forestTreesExtension.ts.
 */
export const FOREST_TREES_TILE_OFFSET = DEFAULT_TILE_COUNT * 2;
export const FOREST_TREES_ROWS = 6;
export const FOREST_TREES_TILE_COUNT = FOREST_TREES_ROWS * DEFAULT_TILES_PER_ROW;
export const COMBINED_TOWN_RETRO_WORLD_TILE_COUNT = DEFAULT_TILE_COUNT * 2 + FOREST_TREES_TILE_COUNT;
/**
 * 혼합 칩셋 아래 반쪽(레트로 월드맵)에서 통행 가능으로 고쳐 쓰는 칸(원본 ID) — 마을 언덕(2026-09-18) 어휘.
 * 대지 윗선 138/139/140·가장자리 테 78/79/80/108/109/110 은 잔디 위 가는 선이고, 374 는 돌계단이다.
 * 단독 레트로 월드맵 하네스는 합본 마을 투명 인덱스 표를 옮긴 휴리스틱이라 이 칸들을 막는다.
 */
export const RETRO_WORLD_CLIFF_WALKABLE_TILES: readonly number[] = [78, 79, 80, 108, 109, 110, 138, 139, 140, 374];

export function bundledAssetRef(id: string): AssetRef {
  return { type: "bundled", id };
}
