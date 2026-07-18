import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  registerTilesetTextureFrames,
  TEX_TILESET,
  TILE_FRAME_COUNT,
} from "@/assets/bundled";
import { graftedTilesetImageUrl } from "@/assets/tileGraftImageCache";
import { tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { bakeTilesetTextureCanvas, tilesetTextureNeedsBake } from "@/assets/tileGraftTexture";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import {
  DEFAULT_TILESET_TEXTURE_KEY,
  LEGACY_RM_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";
import { INTERIOR_TEXTURE_KEY } from "@/project/tilesetHarness/themePacks";
import type { TilesetDef } from "@/project/types";
import type Phaser from "phaser";
import { store } from "@/project/store";

const DEFAULT_TILESET_IMAGE_URL = `/${ASSET_TILESET}`;

export function tilesetImageUrl(tileset: TilesetDef): string {
  const baseUrl =
    tileset.image.type === "uploaded"
      ? store.getCurrent().assets.uploaded[tileset.image.id]?.dataUrl ?? DEFAULT_TILESET_IMAGE_URL
      : bundledTilesetImageUrl(tileset.image.id) ?? DEFAULT_TILESET_IMAGE_URL;
  // 타일 이식이 있으면 베이크 결과(dataURL) — DOM 미리보기에도 이식 타일이 보인다.
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
  if (tileset.image.type === "uploaded") {
    const url = store.getCurrent().assets.uploaded[tileset.image.id]?.dataUrl;
    if (url && !scene.textures.exists(tileset.image.id)) {
      scene.textures.addBase64(tileset.image.id, url);
      return tileset.image.id;
    }
  }
  if (!tilesetTextureNeedsBake(tileset)) return textureKey;

  const baseKey = baseTilesetTextureKey(tileset);
  const canvas = bakeTilesetTextureCanvas(scene, tileset, baseKey);
  if (!canvas) return baseKey;

  const texture = scene.textures.addCanvas(textureKey, canvas);
  if (!texture) return baseKey;

  // 확장 타일셋(count > 480)은 확장분 프레임까지 등록한다(기본 480 은 불변).
  registerTilesetTextureFrames(scene, textureKey, Math.max(TILE_FRAME_COUNT, tileset.count));
  return textureKey;
}

export function isDefaultTilesetTexture(tileset: TilesetDef): boolean {
  return (
    tileset.image.type === "bundled" &&
    (tileset.image.id === DEFAULT_TILESET_TEXTURE_KEY || tileset.image.id === LEGACY_RM_TILESET_TEXTURE_KEY)
  );
}

export function supportsChipsetQuarterComposition(tileset: TilesetDef): boolean {
  return isDefaultTilesetTexture(tileset)
    || (tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY);
}

function baseTilesetTextureKey(tileset: TilesetDef): string {
  return tileset.image.type === "bundled" ? tileset.image.id : tileset.image.id;
}

function bundledTilesetImageUrl(textureKey: string): string | null {
  if (textureKey === TEX_TILESET) return DEFAULT_TILESET_IMAGE_URL;
  const asset = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((candidate) => candidate.textureKey === textureKey);
  return asset ? `/${asset.path}` : null;
}
