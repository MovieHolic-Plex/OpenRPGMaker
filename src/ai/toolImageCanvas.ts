import { tilesetImageUrl } from "@/editor/tilesetImage";
import type { TilesetDef } from "@/project/types";
import {
  applyTransparentColorKey,
  applyTransparentColorKeys,
  STANDARD_COLOR_KEYS,
} from "@/assets/transparentColorKey";

export const MAX_IMAGE_DIMENSION = 512;
export const CHECKER_DARK = "#2a2a2e";
export const CHECKER_LIGHT = "#33333a";
export const EMPTY_TILE = -1;

const tilesetImagePromises = new Map<string, Promise<HTMLImageElement>>();
const charsetImagePromises = new Map<string, Promise<HTMLImageElement>>();

export function createCanvas(width: number, height: number): { readonly canvas: HTMLCanvasElement; readonly context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

export function drawCheckerBackground(context: CanvasRenderingContext2D, width: number, height: number, size: number): void {
  context.fillStyle = CHECKER_DARK;
  context.fillRect(0, 0, width, height);
  context.fillStyle = CHECKER_LIGHT;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if ((x / size + y / size) % 2 === 0) context.fillRect(x, y, size, size);
    }
  }
}

export function drawTile(context: CanvasRenderingContext2D, image: HTMLImageElement, tile: number, tileset: TilesetDef, targetX: number, targetY: number, targetSize: number): void {
  const sourceX = (tile % tileset.tilesPerRow) * tileset.tileSize;
  const sourceY = Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize;
  context.drawImage(image, sourceX, sourceY, tileset.tileSize, tileset.tileSize, targetX, targetY, targetSize, targetSize);
}

export function canvasDataUrl(canvas: HTMLCanvasElement): string | null {
  const maxDimension = Math.max(canvas.width, canvas.height);
  if (maxDimension <= MAX_IMAGE_DIMENSION) return canvas.toDataURL("image/png");
  const scale = MAX_IMAGE_DIMENSION / maxDimension;
  const scaledPair = createCanvas(canvas.width * scale, canvas.height * scale);
  if (!scaledPair) return null;
  scaledPair.context.drawImage(canvas, 0, 0, scaledPair.canvas.width, scaledPair.canvas.height);
  return scaledPair.canvas.toDataURL("image/png");
}

export function loadTilesetImage(tileset: TilesetDef): Promise<HTMLImageElement> {
  const url = tilesetImageUrl(tileset);
  const existing = tilesetImagePromises.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("tileset image failed to load"));
    image.src = url;
  });
  tilesetImagePromises.set(url, promise);
  promise.catch(() => tilesetImagePromises.delete(url));
  return promise;
}

export function clearCharsetImageCache(): void {
  charsetImagePromises.clear();
}

export function loadKeyedCharsetImage(url: string): Promise<HTMLImageElement> {
  const existing = charsetImagePromises.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      void keyOutCharsetImage(image).then(resolve, reject);
    };
    image.onerror = () => reject(new Error(`charset image failed to load: ${url}`));
    image.src = url;
  });
  charsetImagePromises.set(url, promise);
  promise.catch(() => charsetImagePromises.delete(url));
  return promise;
}

async function keyOutCharsetImage(source: HTMLImageElement): Promise<HTMLImageElement> {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (width <= 0 || height <= 0) return source;
  const canvasPair = createCanvas(width, height);
  if (!canvasPair) return source;
  const { canvas, context } = canvasPair;
  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  applyTransparentColorKey(imageData.data);
  applyTransparentColorKeys(imageData.data, STANDARD_COLOR_KEYS);
  context.putImageData(imageData, 0, 0);
  const keyed = new Image();
  await new Promise<void>((resolve, reject) => {
    keyed.onload = () => resolve();
    keyed.onerror = () => reject(new Error("keyed charset image failed"));
    keyed.src = canvas.toDataURL("image/png");
  });
  return keyed;
}
