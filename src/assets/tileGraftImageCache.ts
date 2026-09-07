// DOM 미리보기(팔레트/DB 타일셋 시트)용 graft 베이크 캐시.
// tilesetImageUrl 은 동기 API(CSS background/img src)라서, 베이크는 비동기로 돌리고
// 결과 dataURL 을 캐시한다 — 캐시 미스면 베이스 URL 을 임시 반환하고 베이크를 예약한다.
// 베이크 완료 시 "oprn:tileset-graft-image-baked" 윈도우 이벤트를 쏜다(다음 리렌더에서 반영).
// 어시스턴트 증거 렌더는 peekGraftedTilesetImageUrl 로 동일 키의 완전 베이크만 인정한다.
// 미완 시 베이크만 예약하고 즉시 unavailable (세션 턴을 held I/O 에 묶지 않음).
import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  TEX_TILESET,
} from "@/assets/bundled";
import {
  createTransparentColorKeyCanvas,
  isColorKeyedChipsetTextureKey,
} from "@/assets/chipsetTransparency";
import { activeTileGrafts, createGraftedTilesetCanvas } from "@/assets/tileGrafts";
import type { TilesetDef } from "@/project/types";

export const TILE_GRAFT_IMAGE_BAKED_EVENT = "oprn:tileset-graft-image-baked";

type GraftBakeSnapshot = Pick<TilesetDef, "count" | "tileSize" | "tilesPerRow" | "tileGrafts">;

const bakedUrlCache = new Map<string, string>();
const inFlightBakes = new Map<string, Promise<string | null>>();

/** Test-only: drop baked URLs and in-flight work so readiness cases stay isolated. */
export function clearTileGraftImageCache(): void {
  bakedUrlCache.clear();
  inFlightBakes.clear();
}

// 베이크 결과가 있으면 dataURL, 없으면 null(베이크 예약). baseUrl 은 graft 없는 원본 시트 URL.
export function graftedTilesetImageUrl(tileset: TilesetDef, baseUrl: string): string | null {
  if (activeTileGrafts(tileset).length === 0) return null;
  const cacheKey = graftImageCacheKey(tileset, baseUrl);
  const cached = bakedUrlCache.get(cacheKey);
  if (cached) return cached;
  void ensureGraftImageBake(cacheKey, snapshotGraftBake(tileset), baseUrl);
  return null;
}

/** Cached bake for the exact render inputs, or null when grafts are absent. */
export function peekGraftedTilesetImageUrl(tileset: TilesetDef, baseUrl: string): string | null {
  if (activeTileGrafts(tileset).length === 0) return null;
  return bakedUrlCache.get(graftImageCacheKey(tileset, baseUrl)) ?? null;
}

/**
 * Evidence path: await the complete grafted atlas for these exact inputs.
 * Missing/failed sources and incomplete bakes resolve to null — never a partial atlas.
 * Ordinary editor preview keeps the synchronous base fallback via graftedTilesetImageUrl.
 */
export function awaitGraftedTilesetImageUrl(
  tileset: TilesetDef,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (activeTileGrafts(tileset).length === 0) return Promise.resolve(null);
  if (signal?.aborted) return Promise.resolve(null);
  const cacheKey = graftImageCacheKey(tileset, baseUrl);
  const cached = bakedUrlCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);
  const bake = ensureGraftImageBake(cacheKey, snapshotGraftBake(tileset), baseUrl);
  if (!signal) return bake;
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      resolve(null);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void bake.then((url) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      resolve(url);
    });
  });
}

function graftImageCacheKey(tileset: GraftBakeSnapshot, baseUrl: string): string {
  // Exact identity for ready/in-flight evidence bakes: full active graft tuples
  // (every rendering field) plus atlas geometry and base URL. A short texture
  // suffix hash is not equality — distinct compositions must not share a bucket.
  const grafts = activeTileGrafts(tileset).map((graft) => ({
    targetTile: graft.targetTile,
    sourceChipset: graft.sourceChipset,
    sourceTile: graft.sourceTile,
  }));
  return JSON.stringify({
    baseUrl,
    count: tileset.count,
    tileSize: tileset.tileSize,
    tilesPerRow: tileset.tilesPerRow,
    grafts,
  });
}

function snapshotGraftBake(tileset: TilesetDef): GraftBakeSnapshot {
  // Snapshot — async completion must bake the requested composition, not a later edit.
  return {
    count: tileset.count,
    tileSize: tileset.tileSize,
    tilesPerRow: tileset.tilesPerRow,
    tileGrafts: activeTileGrafts(tileset),
  };
}

function ensureGraftImageBake(
  cacheKey: string,
  tileset: GraftBakeSnapshot,
  baseUrl: string,
): Promise<string | null> {
  const existing = inFlightBakes.get(cacheKey);
  if (existing) return existing;
  const pending = bakeGraftedTilesetImage(tileset, baseUrl)
    .then((dataUrl) => {
      if (!dataUrl) return null;
      bakedUrlCache.set(cacheKey, dataUrl);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(TILE_GRAFT_IMAGE_BAKED_EVENT, { detail: { cacheKey } }));
      }
      return dataUrl;
    })
    .catch((cause) => {
      console.warn("[tileGrafts] graft atlas bake failed", cause);
      return null;
    })
    .finally(() => {
      inFlightBakes.delete(cacheKey);
    });
  inFlightBakes.set(cacheKey, pending);
  return pending;
}

async function bakeGraftedTilesetImage(
  tileset: GraftBakeSnapshot,
  baseUrl: string,
): Promise<string | null> {
  const grafts = activeTileGrafts(tileset);
  if (grafts.length === 0) return null;
  const sourceKeys = [...new Set(grafts.map((graft) => graft.sourceChipset))];
  const [base, ...sources] = await Promise.all([
    loadImage(baseUrl),
    ...sourceKeys.map((key) => loadChipsetSourceImage(key)),
  ]);
  if (!base) return null;
  // Incomplete source sets are not successful evidence or cacheable preview bakes.
  if (sources.some((image) => !image)) return null;
  const sourceByKey = new Map<string, HTMLImageElement | HTMLCanvasElement>();
  sourceKeys.forEach((key, index) => {
    const image = sources[index];
    if (image) sourceByKey.set(key, image);
  });
  const canvas = createGraftedTilesetCanvas(tileset, base, (key) => sourceByKey.get(key) ?? null);
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// 소스 타일 그림판 textureKey → 이미지. 색상키 타일 그림판(interior 등)은 투명색 처리를 적용한다.
async function loadChipsetSourceImage(textureKey: string): Promise<HTMLImageElement | HTMLCanvasElement | null> {
  const path = bundledChipsetPath(textureKey);
  if (!path) {
    console.warn(`[tileGrafts] 알 수 없는 소스 타일 그림판 textureKey: ${textureKey}`);
    return null;
  }
  const image = await loadImage(`/${path}`);
  if (!image) return null;
  if (!isColorKeyedChipsetTextureKey(textureKey)) return image;
  return createTransparentColorKeyCanvas(textureKey, image) ?? image;
}

function bundledChipsetPath(textureKey: string): string | null {
  if (textureKey === TEX_TILESET) return ASSET_TILESET;
  return BUNDLED_EASYRPG_CHIPSET_ASSETS.find((asset) => asset.textureKey === textureKey)?.path ?? null;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.warn(`[tileGrafts] 이미지 로드 실패: ${url}`);
      resolve(null);
    };
    image.src = url;
  });
}
