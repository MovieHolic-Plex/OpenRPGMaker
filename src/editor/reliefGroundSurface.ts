// Actual lower-layer pixels projected onto cliff tops and continuous ramps.
// Small composed cells are cached, rather than allocating a full-map canvas.
import type { GameMap, TilesetDef } from "@/project/types";
import type { ReliefGroundSurface } from "@/project/relief/render";
import { layerTileAt, shadowAt } from "@/project/mapLayers";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { drawMapTileCell, type TilesetCanvasImage } from "./mapTileDrawCore";
import { hasRelief } from "@/project/relief/walk";
import type { ReliefData } from "@/project/relief/types";

export interface GroundRaster { readonly width: number; readonly height: number; readonly data: ArrayLike<number> }
const cellCaches = new WeakMap<object, WeakMap<TilesetDef, Map<string, Uint8ClampedArray>>>();
const imageRasters = new WeakMap<object, GroundRaster>();
const present = new WeakMap<ReliefData, boolean>();
const isImage = (image: unknown): image is HTMLImageElement | HTMLCanvasElement | ImageBitmap => typeof document !== "undefined" && (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap);
export function reliefGroundAvailable(map: GameMap, image: unknown): boolean {
  if (!map.relief || !isImage(image)) return false;
  let yes = present.get(map.relief);
  if (yes === undefined) present.set(map.relief, yes = hasRelief(map.relief));
  return yes;
}
export function reliefTilesetImage(textures: { get?(key: string): unknown } | undefined, key: string): unknown {
  return (textures?.get?.(key) as { getSourceImage?(): unknown } | undefined)?.getSourceImage?.();
}
const mix = (h: number, v: number) => Math.imul(h ^ v, 0x01000193);

export function createReliefGroundSurface(map: GameMap, tileset: TilesetDef, atlas: GroundRaster): ReliefGroundSurface {
  const cells = new Int32Array(map.width * map.height);
  let signature = 0x811c9dc5;
  for (let i = 0; i < cells.length; i++) {
    let h = mix(mix(0x811c9dc5, map.lowerTiles[i] ?? -1), layerTileAt(map, 2, i));
    h = mix(h, shadowAt(map, i));
    for (const tile of tileStackAt(map, "lower", i)) h = mix(h, tile);
    cells[i] = h; signature = mix(signature, h);
  }
  let tilesetCaches = cellCaches.get(atlas);
  if (!tilesetCaches) { tilesetCaches = new WeakMap(); cellCaches.set(atlas, tilesetCaches); }
  let cache = tilesetCaches.get(tileset);
  if (!cache) { cache = new Map(); tilesetCaches.set(tileset, cache); }
  const resolved: (Uint8ClampedArray | undefined)[] = new Array(cells.length);
  return { cells, signature: signature >>> 0, sample(px, py, out, offset) {
    const x = Math.floor(px / 16), y = Math.floor(py / 16);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const cell = y * map.width + x;
    let data = resolved[cell];
    if (!data) {
      const neighbours: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) neighbours.push(x + dx < 0 || x + dx >= map.width || y + dy < 0 || y + dy >= map.height ? 0 : cells[(y + dy) * map.width + x + dx]!);
      const key = neighbours.join(",");
      data = cache!.get(key);
      if (!data) {
        data = new Uint8ClampedArray(16 * 16 * 4);
        const context = cellContext(atlas, data, x * 16, y * 16);
        drawMapTileCell(context, atlas as unknown as TilesetCanvasImage, map, tileset, "lower", x, y, 16 / tileset.tileSize);
        if (cache!.size >= 2048) cache!.delete(cache!.keys().next().value!);
        cache!.set(key, data);
      }
      resolved[cell] = data;
    }
    const source = ((Math.floor(py) % 16) * 16 + Math.floor(px) % 16) * 4;
    for (let c = 0; c < 4; c++) out[offset + c] = data[source + c]!;
    return data[source + 3]! > 0;
  } };
}

/** Read the already loaded, color-keyed/grafted Phaser image once. */
export function reliefGroundFromImage(map: GameMap, tileset: TilesetDef, image: unknown): ReliefGroundSurface | undefined {
  if (!isImage(image) || !reliefGroundAvailable(map, image)) return undefined;
  let raster = imageRasters.get(image);
  if (!raster) {
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return undefined;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    raster = { width: canvas.width, height: canvas.height, data: data.data }; imageRasters.set(image, raster);
  }
  return createReliefGroundSurface(map, tileset, raster);
}

function cellContext(atlas: GroundRaster, data: Uint8ClampedArray, ox: number, oy: number): CanvasRenderingContext2D {
  let fillStyle = "rgba(0,0,0,1)"; const saved: string[] = [];
  const blend = (i: number, r: number, g: number, b: number, alpha: number) => {
    const a = alpha / 255, old = data[i + 3]! / 255, total = a + old * (1 - a);
    if (!total) return;
    [r, g, b].forEach((v, c) => { data[i + c] = (v * a + data[i + c]! * old * (1 - a)) / total; }); data[i + 3] = total * 255;
  };
  return {
    get fillStyle() { return fillStyle; }, set fillStyle(v: string) { fillStyle = v; },
    save() { saved.push(fillStyle); }, restore() { fillStyle = saved.pop() ?? fillStyle; },
    fillRect(x: number, y: number, w: number, h: number) {
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(fillStyle); if (!m) return;
      for (let py = Math.max(0, Math.floor(y - oy)); py < Math.min(16, Math.ceil(y - oy + h)); py++) for (let px = Math.max(0, Math.floor(x - ox)); px < Math.min(16, Math.ceil(x - ox + w)); px++) blend((py * 16 + px) * 4, +m[1]!, +m[2]!, +m[3]!, Math.round(255 * +(m[4] ?? 1)));
    },
    drawImage(_image: unknown, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
      dx -= ox; dy -= oy;
      for (let y = Math.max(0, Math.floor(dy)); y < Math.min(16, Math.ceil(dy + dh)); y++) for (let x = Math.max(0, Math.floor(dx)); x < Math.min(16, Math.ceil(dx + dw)); x++) {
        const ax = Math.floor(sx + (x - dx + .5) * sw / dw), ay = Math.floor(sy + (y - dy + .5) * sh / dh);
        if (ax < 0 || ay < 0 || ax >= atlas.width || ay >= atlas.height) continue;
        const i = (ay * atlas.width + ax) * 4; blend((y * 16 + x) * 4, atlas.data[i]!, atlas.data[i + 1]!, atlas.data[i + 2]!, atlas.data[i + 3]!);
      }
    },
  } as unknown as CanvasRenderingContext2D;
}
