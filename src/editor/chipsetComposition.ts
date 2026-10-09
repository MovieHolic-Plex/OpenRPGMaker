// editor/chipsetComposition.ts
// 타일셋이 쿼터 합성(호수·흙길·모래 오토타일)을 쓰는지의 판정. 편집기 저장소(store)를 모르는 순수 모듈이다 —
// 편집기 번들이 없는 데스크톱 시작 화면도 같은 규칙으로 맵 썸네일을 그린다(src/start/startCover.ts).
// 예전에는 tilesetImage.ts 에 있었고, 그 파일이 store 를 import 해서 시작 화면이 쓸 수 없었다.

import { COMBINED_TOWN_TILESET_TEXTURE_KEY, LEGACY_RM_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { isWorldTileset } from "@/project/defaults/worldCoastMapping";
import { INTERIOR_TEXTURE_KEY, isDungeonSheetTexture } from "@/project/tilesetHarness/themePacks";
import type { TilesetDef } from "@/project/types";

/**
 * 16px·30열 시트 중 합본 마을과 물 블록(0/30/60/90/120과 가로 3프레임)이 칸 단위로 같은 것.
 * 월드맵 본편은 해안 그룹이 이미 같은 칸을 합성한다. 던전·잔디 사선·부분만 같은 실내는 빠진다.
 */
const COMBINED_TOWN_WATER_BLOCK_TEXTURES = new Set<string>([
  "tex_forest_harmony",
  "tex_forest_harmony_snow",
  "tex_forest_harmony_volcano",
  "tex_forest_harmony_desert",
  "tex_forest_harmony_autumn",
  "tex_easyrpg_chipset_ship",
  "tex_easyrpg_chipset_retro_exterior",
  "tex_easyrpg_chipset_retro_house",
  "tex_easyrpg_chipset_retro_world",
  "tex_easyrpg_chipset_combined_town_retro_world",
  "tex_tibo_interior_expanded",
  "tex_modern_exteriors_nocturne",
  "tex_scarloxy_chipset_grassland",
  "tex_scarloxy_chipset_wilds",
]);

export function usesCombinedTownWaterBlock(tileset: TilesetDef): boolean {
  return tileset.image.type === "bundled" && COMBINED_TOWN_WATER_BLOCK_TEXTURES.has(tileset.image.id);
}

export function isDefaultTilesetTexture(tileset: TilesetDef): boolean {
  return (
    tileset.image.type === "bundled" &&
    (tileset.image.id === COMBINED_TOWN_TILESET_TEXTURE_KEY || tileset.image.id === LEGACY_RM_TILESET_TEXTURE_KEY)
  );
}

export function supportsChipsetQuarterComposition(tileset: TilesetDef): boolean {
  return isWorldTileset(tileset) || isDefaultTilesetTexture(tileset)
    || usesCombinedTownWaterBlock(tileset)
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY)
    || (tileset.image.type === "bundled" && isDungeonSheetTexture(tileset.image.id));
}
