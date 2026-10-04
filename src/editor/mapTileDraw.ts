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
/**
 * 주소 하나당 디코드된 원본 그림 하나. 색키 유무·색이 다른 변형이 같은 PNG 를 각자 `new Image()` 로
 * 다시 읽고 디코드하던 것을 하나로 합친다(2026-09-30 렉 수정). 변형마다 다른 건 캔버스 후처리뿐이다.
 */
const decodedImagePromises = new Map<string, Promise<HTMLImageElement>>();

function loadDecodedImage(url: string): Promise<HTMLImageElement> {
  const existing = decodedImagePromises.get(url);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new MapTileDrawError("타일셋 이미지를 읽지 못했습니다."));
    image.src = url;
  });
  decodedImagePromises.set(url, promise);
  void promise.catch(() => { decodedImagePromises.delete(url); });
  return promise;
}

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
  const promise = loadDecodedImage(url).then((image): TilesetCanvasImage => {
    try {
      return sourceKey ? createTransparentColorKeyCanvas(sourceKey, image) ?? image : image;
    } catch {
      throw new MapTileDrawError("타일셋 투명색을 처리하지 못했습니다.");
    }
  });
  tilesetImagePromises.set(cacheKey, promise);
  void promise.catch(() => { tilesetImagePromises.delete(cacheKey); });
  return promise;
}
