import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  BUNDLED_REFERENCE_CHIPSET_ASSETS,
  registerTilesetTextureFrames,
  TEX_TILESET,
  TILE_FRAME_COUNT,
} from "@/assets/bundled";
import { graftedTilesetImageUrl, setUploadedGraftSourceUrlResolver } from "@/assets/tileGraftImageCache";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { activeTileGrafts, tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { bakeTilesetTextureCanvas, tilesetTextureNeedsBake } from "@/assets/tileGraftTexture";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import {
  DEFAULT_TILESET_TEXTURE_KEY,
  LEGACY_RM_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";
import { INTERIOR_TEXTURE_KEY, isDungeonSheetTexture } from "@/project/tilesetHarness/themePacks";
import { isWorldTileset, isWorldAnimatedTile } from "@/project/defaults/worldCoastMapping";
import { isCombinedTownHalfTile, isCombinedTownRetroWorldTileset } from "@/project/defaults/combinedTownRetroWorld";
import { store } from "@/project/store";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import type { Project, TilesetDef } from "@/project/types";
import type Phaser from "phaser";
import { animationKeyForTile, animationStripForTile } from "@/project/defaults/chipsetAnimation";
import { registerUploadedTilesetFrames, uploadedTilesetAnimationName, uploadedTilesetTextureKey } from "@/assets/uploadedTilesets";

const DEFAULT_TILESET_IMAGE_URL = `/${ASSET_TILESET}`;

/** Graft-free atlas URL (uploaded bytes or bundled path). Editor and evidence share this base. */
export function tilesetBaseImageUrl(tileset: TilesetDef, project?: Project): string {
  const uploaded = tileset.image.type === "uploaded" ? (project ?? store.getCurrent()).assets.uploaded[tileset.image.id] : undefined;
  if (project && tileset.image.type === "uploaded" && !uploaded) throw new Error("map-rendering-unavailable: draft atlas missing");
  if (project && uploaded && !uploadedAssetUrl(uploaded)) throw new Error("map-rendering-unavailable: draft atlas bytes unresolved");
  return withInlineAsset(
    tileset.image.type === "uploaded"
      ? (uploaded ? uploadedAssetUrl(uploaded) : "") || DEFAULT_TILESET_IMAGE_URL
      : bundledTilesetImageUrl(tileset.image.id) ?? DEFAULT_TILESET_IMAGE_URL,
  );
}

setUploadedGraftSourceUrlResolver((textureKey) => {
  const asset = store.getCurrent().assets.uploaded[textureKey];
  const url = asset ? uploadedAssetUrl(asset) : "";
  return url ? withInlineAsset(url) : null;
});

export function tilesetImageUrl(tileset: TilesetDef): string {
  const baseUrl = tilesetBaseImageUrl(tileset);
  // 타일 이식이 있으면 베이크 결과(dataURL)를 반환 — 팔레트/DB 미리보기에도 이식 타일이 보인다.
  // 아직 베이크 전이면 베이스 URL 을 임시 반환(베이크는 예약되어 다음 리렌더에 반영).
  // Evidence rendering must not use this transient fallback; see toolImageCanvas.loadTilesetImage.
  return graftedTilesetImageUrl(tileset, baseUrl) ?? baseUrl;
}

export function tilesetTextureKey(tileset: TilesetDef): string {
  const baseKey = baseTilesetTextureKey(tileset);
  const transparentColor = normalizeRgbHexColor(tileset.transparentColor ?? "");
  const transparentSuffix = transparentColor ? `__transparent_${transparentColor.slice(1)}` : "";
  return `${baseKey}${transparentSuffix}${tileGraftsTextureSuffix(tileset)}`;
}

export function ensureTilesetTexture(scene: Phaser.Scene, tileset: TilesetDef): string {
  const textureKey = tilesetTextureKey(tileset);
  if (scene.textures.exists(textureKey)) return textureKey;
  if (!tilesetTextureNeedsBake(tileset)) return textureKey;

  const baseKey = baseTilesetTextureKey(tileset);
  // 업로드 그림판에서 이식하는 칸은 그 그림판이 실린 뒤에만 굽는다 — 먼저 구우면 빠진 칸이 든 텍스처가 캐시로 남는다.
  const uploaded = store.getCurrent().assets.uploaded;
  if (activeTileGrafts(tileset).some((graft) => uploaded[graft.sourceChipset] && !scene.textures.exists(graft.sourceChipset))) return baseKey;
  const canvas = bakeTilesetTextureCanvas(scene, tileset, baseKey);
  if (!canvas) return baseKey;

  const texture = scene.textures.addCanvas(textureKey, canvas);
  if (!texture) return baseKey;

  // 확장 타일셋(count > 480)은 확장분 프레임까지 등록한다(기본 480 은 불변).
  if (tileset.image.type === "uploaded") registerUploadedTilesetFrames(scene, tileset, textureKey);
  else registerTilesetTextureFrames(scene, textureKey, Math.max(TILE_FRAME_COUNT, tileset.count), tileset.tileSize, tileset.tilesPerRow);
  return textureKey;
}

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

function usesCombinedTownWaterBlock(tileset: TilesetDef): boolean {
  return tileset.image.type === "bundled" && COMBINED_TOWN_WATER_BLOCK_TEXTURES.has(tileset.image.id);
}

export function isDefaultTilesetTexture(tileset: TilesetDef): boolean {
  return (
    tileset.image.type === "bundled" &&
    (tileset.image.id === DEFAULT_TILESET_TEXTURE_KEY || tileset.image.id === LEGACY_RM_TILESET_TEXTURE_KEY)
  );
}

export function supportsChipsetQuarterComposition(tileset: TilesetDef): boolean {
  return isWorldTileset(tileset) || isDefaultTilesetTexture(tileset)
    || usesCombinedTownWaterBlock(tileset)
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY)
    || (tileset.image.type === "bundled" && isDungeonSheetTexture(tileset.image.id));
}

/**
 * Interior fire and ungrafted World strips animate without enabling town road/tree rules.
 * The combined-town + retro-world sheet animates only its combined-town half (same tile ids,
 * same water strips); the retro-world half stays still exactly like the standalone retro-world sheet.
 */
export function supportsChipsetTileAnimation(tileset: TilesetDef, tile: number): boolean {
  return isDefaultTilesetTexture(tileset)
    || (isCombinedTownRetroWorldTileset(tileset) && isCombinedTownHalfTile(tile))
    || (isWorldTileset(tileset) && isWorldAnimatedTile(tile, tileset))
    || (usesCombinedTownWaterBlock(tileset) && animationStripForTile(tile)?.key.startsWith("chipset_tile_") === true)
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY
      && animationStripForTile(tile)?.baseTile === 124);
}

function baseTilesetTextureKey(tileset: TilesetDef): string {
  return tileset.image.type === "bundled" ? tileset.image.id : uploadedTilesetTextureKey(tileset);
}

/** The renderer and the preload registry must agree on project-authored animation names. */
export function tilesetAnimationKeyForTile(tileset: TilesetDef, tile: number): string | null {
  return uploadedTilesetAnimationName(tileset, tile)
    ?? (supportsChipsetTileAnimation(tileset, tile) ? animationKeyForTile(tile) : null);
}

export function tilesetCssImageValue(imageUrl: string): string {
  return cssUrl(imageUrl);
}

export function tilesetTileBackgroundStyle(
  tileset: TilesetDef,
  tile: number,
  previewSize: number | string,
  imageUrl = tilesetImageUrl(tileset),
  imageVariable?: string,
): string {
  const column = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  const cellSize = previewSizeCss(previewSize);
  return [
    imageVariable ? `background-image:var(${imageVariable})` : `background-image:${cssUrl(imageUrl)}`,
    `background-size:calc(${tileset.tilesPerRow} * ${cellSize}) auto`,
    `background-position:calc(${-column} * ${cellSize}) calc(${-row} * ${cellSize})`,
  ].join(";");
}

function previewSizeCss(previewSize: number | string): string {
  return typeof previewSize === "number" ? `${previewSize}px` : previewSize;
}

/** 타일셋에 붙이기 전 후보 그래픽의 URL — 그래픽 고르기 미리보기가 쓴다. */
export function tilesetImageSourceUrl(image: TilesetDef["image"]): string {
  if (image.type === "uploaded") {
    const asset = store.getCurrent().assets.uploaded[image.id];
    return withInlineAsset(asset ? uploadedAssetUrl(asset) || DEFAULT_TILESET_IMAGE_URL : DEFAULT_TILESET_IMAGE_URL);
  }
  return withInlineAsset(bundledTilesetImageUrl(image.id) ?? DEFAULT_TILESET_IMAGE_URL);
}

function bundledTilesetImageUrl(textureKey: string): string | null {
  if (textureKey === TEX_TILESET) return DEFAULT_TILESET_IMAGE_URL;
  const asset = [...BUNDLED_EASYRPG_CHIPSET_ASSETS, ...BUNDLED_REFERENCE_CHIPSET_ASSETS]
    .find((candidate) => candidate.textureKey === textureKey);
  return asset ? `/${asset.path}` : null;
}

function cssUrl(url: string): string {
  return `url("${url.replaceAll("\"", "\\\"")}")`;
}
