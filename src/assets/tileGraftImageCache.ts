// DOM 미리보기(팔레트/DB 타일셋 시트)용 graft 베이크 캐시.
// tilesetImageUrl 은 동기 API(CSS background/img src)라서, 베이크는 비동기로 돌리고
// 결과 dataURL 을 캐시한다 — 캐시 미스면 베이스 URL 을 임시 반환하고 베이크를 예약한다.
// 베이크 완료 시 "oprn:tileset-graft-image-baked" 윈도우 이벤트를 쏜다(다음 리렌더에서 반영).
import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  TEX_TILESET,
} from "@/assets/bundled";
import {
  createTransparentColorKeyCanvas,
  isColorKeyedChipsetTextureKey,
} from "@/assets/chipsetTransparency";
import { activeTileGrafts, createGraftedTilesetCanvas, tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import type { TilesetDef } from "@/project/types";

export const TILE_GRAFT_IMAGE_BAKED_EVENT = "oprn:tileset-graft-image-baked";

const bakedUrlCache = new Map<string, string>();
const pendingBakes = new Set<string>();

// 베이크 결과가 있으면 dataURL, 없으면 null(베이크 예약). baseUrl 은 graft 없는 원본 시트 URL.
export function graftedTilesetImageUrl(tileset: TilesetDef, baseUrl: string): string | null {
  if (activeTileGrafts(tileset).length === 0) return null;
  const cacheKey = graftImageCacheKey(tileset, baseUrl);
  const cached = bakedUrlCache.get(cacheKey);
  if (cached) return cached;
  scheduleGraftImageBake(cacheKey, tileset, baseUrl);
  return null;
}

function graftImageCacheKey(tileset: TilesetDef, baseUrl: string): string {
  return `${baseUrl}|${tileset.count}|${tileGraftsTextureSuffix(tileset)}`;
}

function scheduleGraftImageBake(cacheKey: string, tileset: TilesetDef, baseUrl: string): void {
  if (pendingBakes.has(cacheKey) || typeof document === "undefined" || typeof Image === "undefined") return;
  pendingBakes.add(cacheKey);
  // 스냅샷 — 비동기 완료 시점에 tileset 객체가 바뀌어도 요청 시점 구성을 베이크한다.
  const snapshot: Pick<TilesetDef, "count" | "tileSize" | "tilesPerRow" | "tileGrafts"> = {
    count: tileset.count,
    tileSize: tileset.tileSize,
    tilesPerRow: tileset.tilesPerRow,
    tileGrafts: activeTileGrafts(tileset),
  };
  void bakeGraftedTilesetImage(snapshot, baseUrl)
    .then((dataUrl) => {
      if (!dataUrl) return;
      bakedUrlCache.set(cacheKey, dataUrl);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(TILE_GRAFT_IMAGE_BAKED_EVENT, { detail: { cacheKey } }));
      }
    })
    .finally(() => {
      pendingBakes.delete(cacheKey);
    });
}

async function bakeGraftedTilesetImage(
  tileset: Pick<TilesetDef, "count" | "tileSize" | "tilesPerRow" | "tileGrafts">,
  baseUrl: string
): Promise<string | null> {
  const grafts = activeTileGrafts(tileset);
  const sourceKeys = [...new Set(grafts.map((graft) => graft.sourceChipset))];
  const [base, ...sources] = await Promise.all([
    loadImage(baseUrl),
    ...sourceKeys.map((key) => loadChipsetSourceImage(key)),
  ]);
  if (!base) return null;
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

// 소스 칩셋 textureKey → 이미지. 색상키 칩셋(interior 등)은 투명색 처리를 적용한다.
async function loadChipsetSourceImage(textureKey: string): Promise<HTMLImageElement | HTMLCanvasElement | null> {
  const path = bundledChipsetPath(textureKey);
  if (!path) {
    console.warn(`[tileGrafts] 알 수 없는 소스 칩셋 textureKey: ${textureKey}`);
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
