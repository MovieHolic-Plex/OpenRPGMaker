// Retained native ground fingerprints; known lower-plane edits patch only their
// indexes. Relief-only edits reuse the ground input before render-key equality.
import type { GameMap, TilesetDef } from "@/project/types";
import type { ReliefGroundSurface } from "@/project/relief/render";
import { layerTileAt, shadowAt } from "@/project/mapLayers";
import { tileStackAt } from "@/project/mapOverlayTiles";
import { drawMapTileCell, type TilesetCanvasImage } from "./mapTileDrawCore";
import { hasRelief } from "@/project/relief/walk";
import { bindReliefRevision, unbindReliefRevision } from "@/project/relief/revision";
import { store } from "@/project/store";

export interface GroundRaster { readonly width: number; readonly height: number; readonly data: ArrayLike<number> }
const reliefStore = store as Pick<typeof store, "getCurrent"> & Partial<Pick<typeof store, "getVersionToken" | "subscribe">>;
const cellCaches = new WeakMap<object, WeakMap<TilesetDef, Map<string, Uint8ClampedArray>>>();
const imageRasters = new WeakMap<object, GroundRaster>();
const isImage = (image: unknown): image is HTMLImageElement | HTMLCanvasElement | ImageBitmap => typeof document !== "undefined" && (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap);

/** Editor writes (including shallow in-place writers, undo and replacement) all
 * publish the store generation. Uncommitted inputs keep content verification.
 * The exported-player store has no writer/revision API: its project is read only.
 */
const boundReliefs = new WeakMap<object, string>();
export function prepareReliefRead(map: GameMap): void {
  observeGroundChanges();
  const relief = map.relief;
  if (!relief) return;
  if (reliefStore.getCurrent().maps[map.id] !== map) {
    if (boundReliefs.delete(relief)) unbindReliefRevision(relief);
    return;
  }
  if (boundReliefs.get(relief) === map.id) return;
  boundReliefs.set(relief, map.id);
  const id = map.id, project = reliefStore.getVersionToken ? undefined : reliefStore.getCurrent();
  bindReliefRevision(relief, () => {
    const current = reliefStore.getCurrent();
    if (current.maps[id]?.relief !== relief) return undefined;
    const token = reliefStore.getVersionToken?.();
    return token ? `${token.lineage}:${token.generation}` : current === project ? "export-readonly" : undefined;
  });
}

export function reliefGroundAvailable(map: GameMap, image: unknown): boolean {
  prepareReliefRead(map);
  return isImage(image) && hasRelief(map.relief);
}
export function reliefTilesetImage(textures: { get?(key: string): unknown } | undefined, key: string): unknown {
  return (textures?.get?.(key) as { getSourceImage?(): unknown } | undefined)?.getSourceImage?.();
}
const mix = (h: number, v: number) => Math.imul(h ^ v, 0x01000193);
const fingerprint = (map: GameMap, i: number) => {
  let h = mix(mix(0x811c9dc5, map.lowerTiles[i] ?? -1), layerTileAt(map, 2, i));
  h = mix(h, shadowAt(map, i));
  for (const tile of tileStackAt(map, "lower", i)) h = mix(h, tile);
  return h;
};
type Entry = { map: GameMap; tileset: TilesetDef; atlas: GroundRaster; surface: ReliefGroundSurface; cells: Int32Array; resolved: Map<number, Uint8ClampedArray>; signature: number };
const grounds = new Map<string, Entry>();
let groundSerial = 0;
// No subscription in the read-only exported store shim.
let observing = false;
function observeGroundChanges(): void {
  if (observing) return;
  observing = true;
  reliefStore.subscribe?.((project, change) => {
  if (change.scope !== "map") { grounds.clear(); return; }
  const entry = grounds.get(change.mapId);
  if (!entry) return;
  const map = project.maps[change.mapId];
  if (!map || map.width !== entry.map.width || map.height !== entry.map.height || map.tilesetId !== entry.map.tilesetId || (!change.relief && !change.cells?.length)) {
    grounds.delete(change.mapId); return;
  }
  entry.map = map;
  const indices = new Set<number>();
  for (const c of change.cells ?? []) if (c.layer === "lower" && c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height) indices.add(c.y * map.width + c.x);
  for (const i of indices) {
    const next = fingerprint(map, i);
    if (entry.cells[i] === next) continue;
    entry.cells[i] = next; entry.signature = ++groundSerial;
    // Autotile composition reads all eight neighbours.
    const x = i % map.width, y = Math.floor(i / map.width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx >= 0 && x + dx < map.width && y + dy >= 0 && y + dy < map.height) entry.resolved.delete((y + dy) * map.width + x + dx);
    }
  }
  });
}

export function createReliefGroundSurface(map: GameMap, tileset: TilesetDef, atlas: GroundRaster): ReliefGroundSurface {
  observeGroundChanges();
  const old = grounds.get(map.id);
  if (old && old.map === map && old.tileset === tileset && old.atlas === atlas) return old.surface;
  const cells = new Int32Array(map.width * map.height);
  for (let i = 0; i < cells.length; i++) cells[i] = fingerprint(map, i);
  let tilesetCaches = cellCaches.get(atlas);
  if (!tilesetCaches) { tilesetCaches = new WeakMap(); cellCaches.set(atlas, tilesetCaches); }
  let cache = tilesetCaches.get(tileset);
  if (!cache) { cache = new Map(); tilesetCaches.set(tileset, cache); }
  const entry: Entry = { map, tileset, atlas, cells, resolved: new Map(), signature: ++groundSerial, surface: undefined! };
  const surface: ReliefGroundSurface = { cells, get signature() { return entry.signature; }, sample(px, py, out, offset) {
    const map = entry.map;
    const x = Math.floor(px / 16), y = Math.floor(py / 16);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const cell = y * map.width + x;
    let data = entry.resolved.get(cell);
    if (!data) {
      const neighbours: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) neighbours.push(x + dx < 0 || x + dx >= map.width || y + dy < 0 || y + dy >= map.height ? 0 : cells[(y + dy) * map.width + x + dx]!);
      const key = neighbours.join(",");
      data = cache!.get(key);
      if (!data) {
        data = new Uint8ClampedArray(16 * 16 * 4);
        drawMapTileCell(cellContext(atlas, data, x * 16, y * 16), atlas as unknown as TilesetCanvasImage, map, tileset, "lower", x, y, 16 / tileset.tileSize);
        if (cache!.size >= 2048) cache!.delete(cache!.keys().next().value!);
        cache!.set(key, data);
      }
      if (entry.resolved.size >= 2048) entry.resolved.delete(entry.resolved.keys().next().value!);
      entry.resolved.set(cell, data);
    }
    const source = ((Math.floor(py) % 16) * 16 + Math.floor(px) % 16) * 4;
    for (let c = 0; c < 4; c++) out[offset + c] = data[source + c]!;
    return data[source + 3]! > 0;
  } };
  entry.surface = surface;
  // Only committed, versioned inputs can skip future fingerprint verification.
  if (reliefStore.getCurrent().maps[map.id] === map) {
    if (grounds.size >= 4) grounds.delete(grounds.keys().next().value!);
    grounds.set(map.id, entry);
  }
  return surface;
}

/** Read the already loaded, color-keyed/grafted Phaser image once. */
export function reliefGroundFromImage(map: GameMap, tileset: TilesetDef, image: unknown): ReliefGroundSurface | undefined {
  prepareReliefRead(map);
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
