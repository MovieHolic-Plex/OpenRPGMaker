import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  registerTilesetTextureFrames,
  TEX_TILESET,
} from "@/assets/bundled";
import {
  createTransparentColorKeyCanvas,
  isTransparentColorKeySourceImage,
  rawChipsetTextureKey,
} from "@/assets/chipsetTransparency";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import {
  DEFAULT_TILESET_TEXTURE_KEY,
  LEGACY_RM_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";
import { INTERIOR_TEXTURE_KEY } from "@/project/tilesetHarness/themePacks";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import type Phaser from "phaser";

const DEFAULT_TILESET_IMAGE_URL = `/${ASSET_TILESET}`;

export function tilesetImageUrl(tileset: TilesetDef): string {
  if (tileset.image.type === "uploaded") {
    return store.getCurrent().assets.uploaded[tileset.image.id]?.dataUrl ?? DEFAULT_TILESET_IMAGE_URL;
  }
  return bundledTilesetImageUrl(tileset.image.id) ?? DEFAULT_TILESET_IMAGE_URL;
}

export function tilesetTextureKey(tileset: TilesetDef): string {
  const baseKey = baseTilesetTextureKey(tileset);
  const transparentColor = normalizeRgbHexColor(tileset.transparentColor ?? "");
  return transparentColor ? `${baseKey}__transparent_${transparentColor.slice(1)}` : baseKey;
}

export function ensureTilesetTexture(scene: Phaser.Scene, tileset: TilesetDef): string {
  const textureKey = tilesetTextureKey(tileset);
  if (scene.textures.exists(textureKey)) return textureKey;
  if (!normalizeRgbHexColor(tileset.transparentColor ?? "")) return textureKey;

  const baseKey = baseTilesetTextureKey(tileset);
  const sourceKey = sourceTextureKey(scene, baseKey);
  if (!sourceKey) return baseKey;

  const source = scene.textures.get(sourceKey).getSourceImage();
  if (!isTransparentColorKeySourceImage(source)) return baseKey;

  const canvas = createTransparentColorKeyCanvas(tileset, source);
  if (!canvas) return baseKey;

  const texture = scene.textures.addCanvas(textureKey, canvas);
  if (!texture) return baseKey;

  registerTilesetTextureFrames(scene, textureKey);
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
  return tileset.image.type === "bundled" ? tileset.image.id : TEX_TILESET;
}

function sourceTextureKey(scene: Phaser.Scene, baseKey: string): string | null {
  const rawKey = rawChipsetTextureKey(baseKey);
  if (scene.textures.exists(rawKey)) return rawKey;
  if (scene.textures.exists(baseKey)) return baseKey;
  return null;
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

function bundledTilesetImageUrl(textureKey: string): string | null {
  if (textureKey === TEX_TILESET) return DEFAULT_TILESET_IMAGE_URL;
  const asset = BUNDLED_EASYRPG_CHIPSET_ASSETS.find((candidate) => candidate.textureKey === textureKey);
  return asset ? `/${asset.path}` : null;
}

function cssUrl(url: string): string {
  return `url("${url.replaceAll("\"", "\\\"")}")`;
}
