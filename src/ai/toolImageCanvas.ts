import { createTransparentColorKeyCanvas, isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";
import { awaitGraftedTilesetImageUrl, peekGraftedTilesetImageUrl, bakeSnapshotGraftedTilesetImage } from "@/assets/tileGraftImageCache";
import { uploadedAssetUrl } from '@/project/persistence/assetAccessors';
import { withInlineAsset } from '@/assets/inlineAssetStore';
import { activeTileGrafts } from "@/assets/tileGrafts";
import { tilesetBaseImageUrl } from "@/editor/tilesetImage";
import type { Project, TilesetDef } from "@/project/types";
import {
  applyTransparentColorKey,
  applyTransparentColorKeys,
  normalizeRgbHexColor,
  STANDARD_COLOR_KEYS,
} from "@/assets/transparentColorKey";

export const MAX_IMAGE_DIMENSION = 512;
/** 맵 미리보기 타일 배율 — 너무 크면 base64가 컨텍스트를 잠식(16×16×3×16px ≈ 거대). */
export const TILE_GRID_SCALE = 2;
export const CHECKER_DARK = "#2a2a2e";
export const CHECKER_LIGHT = "#33333a";
export const EMPTY_TILE = -1;

const tilesetImagePromises = new Map<string, Promise<HTMLImageElement>>();
const charsetImagePromises = new Map<string, Promise<HTMLImageElement>>();

/** Test-only: drop decoded atlas promises so graft readiness cases cannot reuse stale base URLs. */
export function clearTilesetImageCache(): void {
  tilesetImagePromises.clear();
}

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

/** Same key policy as the editor capture (`mapTileDraw`). A missing key stays untouched — the atlas corner is not a background. */
export function keyedTilesetImage(tileset: TilesetDef, image: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  const color = normalizeRgbHexColor(tileset.transparentColor ?? "");
  const knownKey = tileset.image.type === "bundled" && isColorKeyedChipsetTextureKey(tileset.image.id) ? tileset.image.id : null;
  const sourceKey = color ? { image: tileset.image, transparentColor: color } : knownKey;
  if (!sourceKey) return image;
  return createTransparentColorKeyCanvas(sourceKey, image) ?? image;
}

/** Activity evidence uses exact immutable bytes/refs, color policy, geometry and
 * graft sources as its identity. LRU bounds both retained source text and decoded
 * pixels; failed or oversize atlases are never retained. Pending jobs share work.
 */
const activityAtlases = new Map<string, { promise: Promise<HTMLImageElement | HTMLCanvasElement>; bytes: number }>();
const ACTIVITY_ATLAS_MAX_ENTRIES = 8, ACTIVITY_ATLAS_MAX_BYTES = 64 * 1024 * 1024;
function trimActivityAtlases(): void {
  let bytes = 0;
  for (const item of activityAtlases.values()) bytes += item.bytes;
  for (const [key, item] of activityAtlases) {
    if (activityAtlases.size <= ACTIVITY_ATLAS_MAX_ENTRIES && bytes <= ACTIVITY_ATLAS_MAX_BYTES) break;
    activityAtlases.delete(key); bytes -= item.bytes;
  }
}
export function clearActivityAtlasCache(): void { activityAtlases.clear(); }
export function loadActivityTilesetAtlas(tileset: TilesetDef, source: string, graftSources: ReadonlyMap<string, string>): Promise<HTMLImageElement | HTMLCanvasElement> {
  const key = JSON.stringify([source, tileset.image, normalizeRgbHexColor(tileset.transparentColor ?? ""),
    tileset.count, tileset.tileSize, tileset.tilesPerRow, activeTileGrafts(tileset), [...graftSources].sort(([a], [b]) => a.localeCompare(b))]);
  const existing = activityAtlases.get(key);
  if (existing) { activityAtlases.delete(key); activityAtlases.set(key, existing); return existing.promise; }
  const snapshot = { image: { ...tileset.image }, transparentColor: tileset.transparentColor,
    count: tileset.count, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow,
    tileGrafts: activeTileGrafts(tileset).map(graft => ({ ...graft })) } as TilesetDef;
  const urls = new Map(graftSources);
  const entry = { promise: undefined as unknown as Promise<HTMLImageElement | HTMLCanvasElement>, bytes: key.length * 2 };
  entry.promise = (async () => {
    let url = source;
    if (activeTileGrafts(snapshot).length) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const baked = await Promise.race([bakeSnapshotGraftedTilesetImage(snapshot, source, urls),
          new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), GRAFT_EVIDENCE_WAIT_MS); })]);
        if (!baked) throw new Error("Graft atlas snapshot unavailable");
        url = baked;
      } finally { if (timer !== undefined) clearTimeout(timer); }
    }
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.crossOrigin = "anonymous";
      const timer = setTimeout(() => { image.src = ""; reject(new Error("image timeout")); }, 8000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("image unavailable")); };
      image.src = url;
    });
    const atlas = keyedTilesetImage(snapshot, image);
    entry.bytes += image.naturalWidth * image.naturalHeight * (atlas === image ? 4 : 8);
    if (activityAtlases.get(key) === entry) trimActivityAtlases();
    return atlas;
  })();
  activityAtlases.set(key, entry);
  trimActivityAtlases();
  void entry.promise.catch(() => { if (activityAtlases.get(key) === entry) activityAtlases.delete(key); });
  return entry.promise;
}

export function drawTile(context: CanvasRenderingContext2D, image: CanvasImageSource, tile: number, tileset: TilesetDef, targetX: number, targetY: number, targetSize: number): void {
  const sourceX = (tile % tileset.tilesPerRow) * tileset.tileSize;
  const sourceY = Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize;
  context.drawImage(image, sourceX, sourceY, tileset.tileSize, tileset.tileSize, targetX, targetY, targetSize, targetSize);
}

/** Per-tile draw size for a tile-grid render.
 *
 * `canvasDataUrl` only shrinks a canvas that is already drawn, so a whole-map render at
 * the native scale allocates `w * h * (tileSize * TILE_GRID_SCALE)²` pixels and then
 * throws almost all of them away: a 256×256 map is an 8192×8192 canvas (~268MB) for a
 * 512px result. Pick a size that lands inside the delivered image up front. Small
 * regions keep the native scale so their existing output is unchanged.
 */
export function tileDrawSize(tilesWide: number, tilesHigh: number, tileSize: number, maxDimension = MAX_IMAGE_DIMENSION): number {
  const natural = Math.max(1, tileSize * TILE_GRID_SCALE);
  const span = Math.max(1, tilesWide, tilesHigh);
  if (span * natural <= maxDimension * 2) return natural;
  return Math.max(1, Math.floor(maxDimension / span));
}

export function canvasDataUrl(canvas: HTMLCanvasElement, limit = MAX_IMAGE_DIMENSION): string | null {
  const maxDimension = Math.max(canvas.width, canvas.height);
  if (maxDimension <= limit) return canvas.toDataURL("image/png");
  const scale = limit / maxDimension;
  const scaledPair = createCanvas(canvas.width * scale, canvas.height * scale);
  if (!scaledPair) return null;
  scaledPair.context.drawImage(canvas, 0, 0, scaledPair.canvas.width, scaledPair.canvas.height);
  return scaledPair.canvas.toDataURL("image/png");
}

/** Maximum wait for a cold graft atlas; missing sources still fail closed. */
export const GRAFT_EVIDENCE_WAIT_MS = 5_000;

/**
 * Load the exact composite atlas, including on the first review after a graft edit.
 * Bound the wait so held source I/O cannot indefinitely block the assistant turn.
 */
export async function loadTilesetImage(tileset: TilesetDef, project?: Project): Promise<HTMLImageElement> {
  const baseUrl = tilesetBaseImageUrl(tileset, project);
  if (activeTileGrafts(tileset).length === 0) return loadImageUrl(baseUrl);
  if (project) {
    const sourceUrls = new Map<string, string>();
    for (const graft of activeTileGrafts(tileset)) {
      const asset = project.assets.uploaded[graft.sourceChipset];
      if (!asset) continue; // Bundled sources resolve from the immutable bundled catalog.
      const url = uploadedAssetUrl(asset);
      if (!url) throw new Error('map-rendering-unavailable: snapshot graft source bytes unresolved');
      sourceUrls.set(graft.sourceChipset, withInlineAsset(url));
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const baked = await Promise.race([bakeSnapshotGraftedTilesetImage(tileset, baseUrl, sourceUrls),
        new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), GRAFT_EVIDENCE_WAIT_MS); })]);
      if (!baked) throw new Error('map-rendering-unavailable: snapshot graft bake incomplete or timed out; no approval');
      return loadImageUrl(baked);
    } finally { if (timer) clearTimeout(timer); }
  }
  const ready = peekGraftedTilesetImageUrl(tileset, baseUrl);
  if (ready) return loadImageUrl(ready);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAFT_EVIDENCE_WAIT_MS);
  try {
    const baked = await awaitGraftedTilesetImageUrl(tileset, baseUrl, controller.signal);
    if (baked) return loadImageUrl(baked);
    const reason = controller.signal.aborted
      ? "graft atlas bake timed out after 5000ms; retry review when images finish loading"
      : "graft atlas bake failed or incomplete; check source chipset images";
    throw new Error(
      `tileset-graft-rendering-unavailable: tileset ${tileset.id}; ${reason}; no approval`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function loadImageUrl(url: string): Promise<HTMLImageElement> {
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
