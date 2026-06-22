import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  TEX_TILESET,
} from "@/assets/bundled";
import {
  DEFAULT_TILESET_TEXTURE_KEY,
  LEGACY_RM_TILESET_TEXTURE_KEY,
} from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";

const DEFAULT_TILESET_IMAGE_URL = `/${ASSET_TILESET}`;

export function tilesetImageUrl(tileset: TilesetDef): string {
  if (tileset.image.type === "uploaded") {
    return store.getCurrent().assets.uploaded[tileset.image.id]?.dataUrl ?? DEFAULT_TILESET_IMAGE_URL;
  }
  return bundledTilesetImageUrl(tileset.image.id) ?? DEFAULT_TILESET_IMAGE_URL;
}

export function tilesetTextureKey(tileset: TilesetDef): string {
  return tileset.image.type === "bundled" ? tileset.image.id : TEX_TILESET;
}

export function isDefaultTilesetTexture(tileset: TilesetDef): boolean {
  return (
    tileset.image.type === "bundled" &&
    (tileset.image.id === DEFAULT_TILESET_TEXTURE_KEY || tileset.image.id === LEGACY_RM_TILESET_TEXTURE_KEY)
  );
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
