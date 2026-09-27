// editor/mapCoverRender.ts
// 시작 화면 카드 그림(cover.jpg) 한 장을 굽는다. 타일셋 그림은 호출자가 준다 — store 를 모르는 순수 모듈이라
// 편집기(src/editor/projectCover.ts)와 데스크톱 시작 화면(src/start/startCover.ts)이 같은 모양으로 굽는다.

import { drawMapTileLayers, type TilesetCanvasImage } from "@/editor/mapTileDrawCore";
import type { GameMap, TilesetDef } from "@/project/types";

/** 카드 한 장에 타일이 너무 잘게 보이지 않게, 보이는 창을 가로 최대 이만큼 칸으로 둔다(큰 마을은 일부만 보인다). */
const MAX_VIEW_TILES_X = 30;

/**
 * 카드 비율을 **채우도록** 자른다 — 여백을 두면 16:10 카드 안에서 정사각 맵 양옆에 검은 띠가 남는다.
 * 초점(focus, 타일 좌표)이 있으면 그 둘레를 보인다. 보이는 창만 그린다 — 100×100 맵 전체를 캔버스로 잡지 않는다.
 */
export function renderMapCoverCanvas(
  map: GameMap,
  tileset: TilesetDef,
  image: TilesetCanvasImage,
  width: number,
  height: number,
  focus?: { readonly x: number; readonly y: number } | null,
): HTMLCanvasElement | null {
  // drawMapTileLayers 는 타일셋 칸 크기 기준으로 그린다.
  const tile = tileset.tileSize || 16;
  if (!(map.width > 0) || !(map.height > 0)) return null;
  const viewTilesX = Math.min(map.width, MAX_VIEW_TILES_X, Math.max(1, Math.round(map.height * (width / height))));
  const viewTilesY = Math.min(map.height, Math.max(1, Math.round(viewTilesX * (height / width))));
  const cx = focus ? focus.x + 0.5 : map.width / 2;
  const cy = focus ? focus.y + 0.5 : map.height / 2;
  const left = Math.max(0, Math.min(map.width - viewTilesX, Math.round(cx - viewTilesX / 2)));
  const top = Math.max(0, Math.min(map.height - viewTilesY, Math.round(cy - viewTilesY / 2)));
  const sourceWidth = viewTilesX * tile;
  const sourceHeight = viewTilesY * tile;
  const view = document.createElement("canvas");
  view.width = sourceWidth;
  view.height = sourceHeight;
  const viewContext = view.getContext("2d", { alpha: false });
  if (!viewContext) return null;
  viewContext.imageSmoothingEnabled = false;
  viewContext.fillStyle = "#1b2430";
  viewContext.fillRect(0, 0, sourceWidth, sourceHeight);
  viewContext.translate(-left * tile, -top * tile);
  drawMapTileLayers(viewContext, image, map, tileset, 1);
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const context = target.getContext("2d", { alpha: false });
  if (!context) return null;
  context.fillStyle = "#1b2430";
  context.fillRect(0, 0, width, height);
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  // 도트 그림이라 키울 때는 부드럽게 하지 않는다.
  context.imageSmoothingEnabled = scale < 1;
  context.drawImage(
    view,
    Math.round((width - sourceWidth * scale) / 2),
    Math.round((height - sourceHeight * scale) / 2),
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale),
  );
  return target;
}

export function renderMapCoverJpeg(
  map: GameMap,
  tileset: TilesetDef,
  image: TilesetCanvasImage,
  width: number,
  height: number,
  focus?: { readonly x: number; readonly y: number } | null,
): string | null {
  return renderMapCoverCanvas(map, tileset, image, width, height, focus)?.toDataURL("image/jpeg", 0.82) ?? null;
}
