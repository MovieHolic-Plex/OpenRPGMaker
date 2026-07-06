import { applyTransparentColorKey, applyTransparentColorKeys, parseRgbHexColor } from "@/assets/transparentColorKey";
import type { RgbColor } from "@/assets/transparentColorKey";
import type { TilesetDef } from "@/project/types";

const RAW_CHIPSET_TEXTURE_SUFFIX = "__raw_chipset";
const INTERIOR_CHIPSET_OBJECT_BACKGROUND: RgbColor = { r: 255, g: 103, b: 139 };
const COLOR_KEYED_CHIPSET_TEXTURE_KEYS = new Set<string>([
  "tex_easyrpg_chipset_dungeon",
  "tex_easyrpg_chipset_interior",
  "tex_easyrpg_chipset_retro_dungeon",
]);

export function isColorKeyedChipsetTextureKey(textureKey: string): boolean {
  return COLOR_KEYED_CHIPSET_TEXTURE_KEYS.has(textureKey);
}

export function chipsetLoadTextureKey(textureKey: string): string {
  return isColorKeyedChipsetTextureKey(textureKey) ? rawChipsetTextureKey(textureKey) : textureKey;
}

export function rawChipsetTextureKey(textureKey: string): string {
  return `${textureKey}${RAW_CHIPSET_TEXTURE_SUFFIX}`;
}

export function createTransparentColorKeyCanvas(
  sourceKey: string | Pick<TilesetDef, "image" | "transparentColor">,
  source: HTMLImageElement | HTMLCanvasElement
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImageWidth(source);
  canvas.height = sourceImageHeight(source);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const keys = typeof sourceKey === "string" ? transparentColorKeysForChipset(sourceKey) : resolveTransparentColorKeys(sourceKey);
  if (keys) {
    applyTransparentColorKeys(imageData.data, keys);
  } else {
    applyTransparentColorKey(imageData.data);
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

export function isTransparentColorKeySourceImage(source: object): source is HTMLImageElement | HTMLCanvasElement {
  return source instanceof HTMLImageElement || source instanceof HTMLCanvasElement;
}

function sourceImageWidth(source: HTMLImageElement | HTMLCanvasElement): number {
  return source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
}

function sourceImageHeight(source: HTMLImageElement | HTMLCanvasElement): number {
  return source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
}

export function resolveTransparentColorKeys(
  tileset: Pick<TilesetDef, "image" | "transparentColor">
): readonly RgbColor[] | null {
  const userKey = tileset.transparentColor ? parseRgbHexColor(tileset.transparentColor) : null;
  if (userKey) return [userKey];
  return transparentColorKeysForChipset(tilesetTextureSourceKey(tileset));
}

export function transparentColorKeysForChipset(textureKey: string): readonly RgbColor[] | null {
  if (textureKey === "tex_easyrpg_chipset_interior") return [INTERIOR_CHIPSET_OBJECT_BACKGROUND];
  return null;
}

function tilesetTextureSourceKey(tileset: Pick<TilesetDef, "image">): string {
  return tileset.image.id;
}
