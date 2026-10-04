import { rasterSunlightArt, type SunlightArtSource } from "./sunlightArt";

const sources = new WeakMap<object, Map<string, SunlightArtSource>>();
/** Read a small tile canvas lazily. Large atlases are not duplicated in memory. */
export function canvasSunlightArt(image: CanvasImageSource, tileSize: number, tilesPerRow: number): SunlightArtSource | undefined {
  const key = `${tileSize}:${tilesPerRow}`, cached = sources.get(image)?.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = tileSize;
  const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return undefined;
  const masks = new Map<number, Uint8Array>();
  const source: SunlightArtSource = { tileMask(tile) {
    const old = masks.get(tile); if (old) return old;
    context.clearRect(0, 0, tileSize, tileSize);
    context.drawImage(image, tile % tilesPerRow * tileSize, Math.floor(tile / tilesPerRow) * tileSize,
      tileSize, tileSize, 0, 0, tileSize, tileSize);
    const mask = rasterSunlightArt(context.getImageData(0, 0, tileSize, tileSize), tileSize, 1).tileMask(0)!;
    masks.set(tile, mask); return mask;
  } };
  const entries = sources.get(image) ?? new Map<string, SunlightArtSource>(); entries.set(key, source); sources.set(image, entries);
  return source;
}
