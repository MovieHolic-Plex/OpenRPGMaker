// start/startCover.ts
// 데스크톱 시작 화면이 최근 프로젝트 카드 그림을 **직접** 굽는다. 편집기에서 한 번도 안 연 프로젝트(이 기능 이전에
// 만든 것)나, 다른 빌드·팀 호스트에서 고쳐 cover.jpg 가 낡은 프로젝트도 목록을 여는 순간 그림이 생긴다.
//
// 재료는 호스트가 읽어 준 시작 맵 + 그 타일셋(oprn:start.coverSource)이다. 그리기는 편집기와 같은 코어
// (mapTileDrawCore)라 오토타일·받침·겹층이 편집기 썸네일과 같다. 타일셋 그림은 편집기처럼 이식(tileGrafts)을 합성하고
// 투명색을 뺀다. 이식 재료가 하나라도 없으면 반쪽 그림을 남기지 않고 null — 카드는 첫 글자로 남는다.
// 이 모듈은 시작 화면이 필요할 때만 동적으로 받는다(번들 칩셋 목록이 커서 첫 화면 번들에 넣지 않는다).

import {
  ASSET_TILESET,
  BUNDLED_EASYRPG_CHIPSET_ASSETS,
  BUNDLED_REFERENCE_CHIPSET_ASSETS,
  TEX_TILESET,
} from "@/assets/bundled";
import { createTransparentColorKeyCanvas, isColorKeyedChipsetTextureKey } from "@/assets/chipsetTransparency";
import { activeTileGrafts, createGraftedTilesetCanvas } from "@/assets/tileGrafts";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import { renderMapCoverJpeg } from "@/editor/mapCoverRender";
import type { TilesetCanvasImage } from "@/editor/mapTileDrawCore";
import type { GameMap, TilesetDef } from "@/project/types";
import { PROJECT_COVER_HEIGHT, PROJECT_COVER_WIDTH, type ProjectCoverSource } from "../../electron/shared/start";

const imagePromises = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imagePromises.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
  // data URL(업로드 그림판)은 프로젝트마다 한 번만 쓰인다 — 캐시에 붙잡아 두지 않는다.
  if (!url.startsWith("data:")) imagePromises.set(url, promise);
  return promise;
}

function bundledChipsetUrl(textureKey: string): string | null {
  if (textureKey === TEX_TILESET) return "/" + ASSET_TILESET;
  const asset = [...BUNDLED_EASYRPG_CHIPSET_ASSETS, ...BUNDLED_REFERENCE_CHIPSET_ASSETS].find((candidate) => candidate.textureKey === textureKey);
  return asset ? "/" + asset.path : null;
}

/** 이식 재료 시트 — 편집기(tileGraftImageCache)처럼 색상키 칩셋은 투명색을 뺀 뒤 붙인다. */
async function graftSource(textureKey: string): Promise<TilesetCanvasImage | null> {
  const url = bundledChipsetUrl(textureKey);
  if (!url) return null;
  const image = await loadImage(url);
  if (!image) return null;
  return isColorKeyedChipsetTextureKey(textureKey) ? createTransparentColorKeyCanvas(textureKey, image) ?? image : image;
}

/** 편집기 loadTilesetImage 와 같은 결과: 베이스 → 이식 합성 → (지정·알려진) 투명색. */
export async function loadCoverTilesetImage(tileset: TilesetDef, uploadedImage: string | null): Promise<TilesetCanvasImage | null> {
  const baseUrl = tileset.image.type === "uploaded" ? uploadedImage : bundledChipsetUrl(tileset.image.id);
  if (!baseUrl) return null;
  const base = await loadImage(baseUrl);
  if (!base) return null;
  let atlas: TilesetCanvasImage = base;
  const grafts = activeTileGrafts(tileset);
  if (grafts.length > 0) {
    const keys = [...new Set(grafts.map((graft) => graft.sourceChipset))];
    const sources = await Promise.all(keys.map((key) => graftSource(key)));
    if (sources.some((source) => !source)) return null;
    const byKey = new Map(keys.map((key, index) => [key, sources[index]!] as const));
    const grafted = createGraftedTilesetCanvas(tileset, base, (key) => byKey.get(key) ?? null);
    if (!grafted) return null;
    atlas = grafted;
  }
  const color = normalizeRgbHexColor(tileset.transparentColor ?? "");
  const knownKey = tileset.image.type === "bundled" && isColorKeyedChipsetTextureKey(tileset.image.id) ? tileset.image.id : null;
  const sourceKey = color ? { image: { ...tileset.image }, transparentColor: color } : knownKey;
  return sourceKey ? createTransparentColorKeyCanvas(sourceKey, atlas) ?? atlas : atlas;
}

function isRenderableMap(value: unknown): value is GameMap {
  const map = value as Partial<GameMap> | null;
  return !!map && typeof map.width === "number" && typeof map.height === "number"
    && Array.isArray(map.lowerTiles) && Array.isArray(map.upperTiles);
}

function isRenderableTileset(value: unknown): value is TilesetDef {
  const tileset = value as Partial<TilesetDef> | null;
  return !!tileset && typeof tileset.tileSize === "number" && typeof tileset.tilesPerRow === "number"
    && typeof tileset.count === "number" && !!tileset.image && typeof tileset.image.id === "string";
}

/** 재료로 480×300 JPEG data URL 을 굽는다. 그릴 수 없으면 null. */
export async function renderProjectCover(source: ProjectCoverSource): Promise<string | null> {
  if (!isRenderableMap(source.map) || !isRenderableTileset(source.tileset)) return null;
  const image = await loadCoverTilesetImage(source.tileset, source.uploadedImage);
  if (!image) return null;
  try {
    return renderMapCoverJpeg(source.map, source.tileset, image, PROJECT_COVER_WIDTH, PROJECT_COVER_HEIGHT, source.focus);
  } catch {
    return null;
  }
}
