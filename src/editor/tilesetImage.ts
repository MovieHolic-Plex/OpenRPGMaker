import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  registerTilesetTextureFrames,
  TEX_TILESET,
  TILE_FRAME_COUNT,
} from "@/assets/bundled";
import { graftedTilesetImageUrl } from "@/assets/tileGraftImageCache";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { bakeTilesetTextureCanvas, tilesetTextureNeedsBake } from "@/assets/tileGraftTexture";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import {
  DEFAULT_TILESET_TEXTURE_KEY,
  LEGACY_RM_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";
import { DUNGEON_TEXTURE_KEY, INTERIOR_TEXTURE_KEY } from "@/project/tilesetHarness/themePacks";
import { isWorldTileset, isWorldAnimatedTile } from "@/project/defaults/worldCoastMapping";
import { isCombinedTownHalfTile, isCombinedTownRetroWorldTileset } from "@/project/defaults/combinedTownRetroWorld";
import { store } from "@/project/store";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import type { TilesetDef } from "@/project/types";
import type Phaser from "phaser";
import { animationKeyForTile, animationStripForTile } from "@/project/defaults/chipsetAnimation";
import { registerUploadedTilesetFrames, uploadedTilesetAnimationName, uploadedTilesetTextureKey } from "@/assets/uploadedTilesets";

const DEFAULT_TILESET_IMAGE_URL = `/${ASSET_TILESET}`;

/** Graft-free atlas URL (uploaded bytes or bundled path). Editor and evidence share this base. */
export function tilesetBaseImageUrl(tileset: TilesetDef): string {
  const uploaded = tileset.image.type === "uploaded" ? store.getCurrent().assets.uploaded[tileset.image.id] : undefined;
  return withInlineAsset(
    tileset.image.type === "uploaded"
      ? (uploaded ? uploadedAssetUrl(uploaded) : "") || DEFAULT_TILESET_IMAGE_URL
      : bundledTilesetImageUrl(tileset.image.id) ?? DEFAULT_TILESET_IMAGE_URL,
  );
}

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
  const canvas = bakeTilesetTextureCanvas(scene, tileset, baseKey);
  if (!canvas) return baseKey;

  const texture = scene.textures.addCanvas(textureKey, canvas);
  if (!texture) return baseKey;

  // 확장 타일셋(count > 480)은 확장분 프레임까지 등록한다(기본 480 은 불변).
  if (tileset.image.type === "uploaded") registerUploadedTilesetFrames(scene, tileset, textureKey);
  else registerTilesetTextureFrames(scene, textureKey, Math.max(TILE_FRAME_COUNT, tileset.count));
  return textureKey;
}

export function isDefaultTilesetTexture(tileset: TilesetDef): boolean {
  return (
    tileset.image.type === "bundled" &&
    (tileset.image.id === DEFAULT_TILESET_TEXTURE_KEY || tileset.image.id === LEGACY_RM_TILESET_TEXTURE_KEY)
  );
}

export function supportsChipsetQuarterComposition(tileset: TilesetDef): boolean {
  return isWorldTileset(tileset) || isDefaultTilesetTexture(tileset)
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY)
    || (tileset.image.type === "bundled" && tileset.image.id === DUNGEON_TEXTURE_KEY);
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

export function tilesetTileBackgroundStyle(tileset: TilesetDef, tile: number, previewSize: number | string): string {
  const column = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  const cellSize = previewSizeCss(previewSize);
  return [
    `background-image:${cssUrl(tilesetImageUrl(tileset))}`,
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
  const asset = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((candidate) => candidate.textureKey === textureKey);
  return asset ? `/${asset.path}` : null;
}

function cssUrl(url: string): string {
  return `url("${url.replaceAll("\"", "\\\"")}")`;
}
