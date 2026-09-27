// 맵 타일 레이어 → 2D 캔버스 렌더(오프스크린). mapScreenshot(전체 맵)과
// regionSnapshot(영역 크롭 썸네일)이 공유한다. scale은 픽셀 배율(연속값 허용).
// 그리는 부분은 mapTileDrawCore.ts(순수, store 무관)이고 여기는 편집기 쪽 타일셋 그림 로드를 더한다.
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { createTransparentColorKeyCanvas, isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { MapTileDrawError, type TilesetCanvasImage } from "@/editor/mapTileDrawCore";
import type { TilesetDef } from "@/project/types";

export { drawMapTileLayer, drawMapTileLayers, drawShadowQuarters, MapTileDrawError, type TilesetCanvasImage } from "@/editor/mapTileDrawCore";

const tilesetImagePromises = new Map<string, Promise<TilesetCanvasImage>>();

/** Canvas previews share the same explicit/known color-key contract as Phaser textures. */
export function loadTilesetImage(tileset: TilesetDef): Promise<TilesetCanvasImage> {
  const url = tilesetImageUrl(tileset);
  const color = normalizeRgbHexColor(tileset.transparentColor ?? "");
  // Unknown sheets without an explicit key stay untouched: their top-left pixel may be water.
  const knownKey = tileset.image.type === "bundled" && isColorKeyedChipsetTextureKey(tileset.image.id)
    ? tileset.image.id : null;
  const sourceKey = color ? { image: { ...tileset.image }, transparentColor: color } : knownKey;
  const cacheKey = JSON.stringify([url, color ?? knownKey]);
  const existing = tilesetImagePromises.get(cacheKey);
  if (existing) return existing;
  const promise = new Promise<TilesetCanvasImage>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        resolve(sourceKey ? createTransparentColorKeyCanvas(sourceKey, image) ?? image : image);
      } catch {
        reject(new MapTileDrawError("타일셋 투명색을 처리하지 못했습니다."));
      }
    };
    image.onerror = () => reject(new MapTileDrawError("타일셋 이미지를 읽지 못했습니다."));
    image.src = url;
  });
  tilesetImagePromises.set(cacheKey, promise);
  void promise.catch(() => { tilesetImagePromises.delete(cacheKey); });
  return promise;
}
