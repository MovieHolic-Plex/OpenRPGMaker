// harnessSuggestion/kitRender.ts
// §④ "그림으로 말한다" — 제안 카드·팔레트 스탬프 아이콘용 2D 캔버스 타일 렌더.
// 팔레트(tilesetTileBackgroundStyle)와 동일한 칩셋 시트·타일 좌표 규약을 캔버스에 그린다.

import { TILE_SIZE } from "@/assets/bundled";
import { structureKitUnitCells } from "@/editor/harnessSuggestion/structureKitModel";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, StructureKitDef, TilesetDef } from "@/project/types";

export type KitRenderCell = {
  readonly dx: number;
  readonly dy: number;
  readonly layer: "lower" | "upper";
  readonly tile: number;
};

export type KitRenderInput = {
  readonly tileset: TilesetDef;
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly cells: readonly KitRenderCell[];
  /** 칸 하나의 렌더 픽셀 배율(기본 2 → 32px). */
  readonly scale?: number;
  /** 빈 칸 밑에 깔 받침 타일. null 이면 받침 없음(어두운 바탕). 기본 잔디. */
  readonly backgroundTile?: number | null;
};

const imageCache = new Map<string, HTMLImageElement>();

/**
 * 타일 셀 목록을 캔버스에 렌더한다. 칩셋 이미지는 비동기 로드 — 캔버스는 즉시 반환되고
 * 로드가 끝나는 프레임에 그려진다(제안 카드/팔레트 아이콘 용도로 충분).
 */
export function renderTileCellsToCanvas(input: KitRenderInput): HTMLCanvasElement {
  const scale = input.scale ?? 2;
  const cellPx = TILE_SIZE * scale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, input.widthTiles * cellPx);
  canvas.height = Math.max(1, input.heightTiles * cellPx);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#101318";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const draw = (image: HTMLImageElement): void => {
    const backgroundTile = input.backgroundTile === undefined ? TILE.GRASS : input.backgroundTile;
    if (backgroundTile !== null && backgroundTile >= 0) {
      for (let y = 0; y < input.heightTiles; y += 1) {
        for (let x = 0; x < input.widthTiles; x += 1) {
          drawTile(context, image, input.tileset, backgroundTile, x * cellPx, y * cellPx, cellPx);
        }
      }
    }
    for (const layer of ["lower", "upper"] as const) {
      for (const cell of input.cells) {
        if (cell.layer !== layer) continue;
        if (cell.tile === TILE.EMPTY || cell.tile < 0) continue;
        drawTile(context, image, input.tileset, cell.tile, cell.dx * cellPx, cell.dy * cellPx, cellPx);
      }
    }
  };
  withTilesetImage(input.tileset, draw);
  return canvas;
}

/** 맵 사각형 영역의 실렌더 크롭 셀 — "방금 찍은 패턴" 카드용. */
export function cellsFromMapRect(
  map: Pick<GameMap, "width" | "height" | "lowerTiles" | "upperTiles">,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): KitRenderCell[] {
  const cells: KitRenderCell[] = [];
  for (let dy = 0; dy < rect.height; dy += 1) {
    for (let dx = 0; dx < rect.width; dx += 1) {
      const x = rect.x + dx;
      const y = rect.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const index = y * map.width + x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY) cells.push({ dx, dy, layer: "lower", tile: lower });
      if (upper !== TILE.EMPTY) cells.push({ dx, dy, layer: "upper", tile: upper });
    }
  }
  return cells;
}

/** 킷 단위를 가로로 이어붙인 조립 셀 — "등록하면 이걸 얻는다" 미리보기·팔레트 아이콘용.
 * 파라메트릭 집 킷은 한 채가 완결 단위 — 반복 없이 전개 셀 그대로. */
export function assembledKitCells(kit: StructureKitDef, columns: number): KitRenderCell[] {
  if (kit.kind === "house") return structureKitUnitCells(kit);
  const cells: KitRenderCell[] = [];
  const repeatCount = Math.max(1, Math.floor(columns / Math.max(1, kit.width)));
  for (let repeat = 0; repeat < repeatCount; repeat += 1) {
    for (let row = 0; row < kit.rows.length; row += 1) {
      const rowDef = kit.rows[row];
      if (!rowDef) continue;
      for (let column = 0; column < kit.width; column += 1) {
        const dx = repeat * kit.width + column;
        const lower = rowDef.tiles[column] ?? TILE.EMPTY;
        const upper = rowDef.upperTiles?.[column] ?? TILE.EMPTY;
        if (lower !== TILE.EMPTY) cells.push({ dx, dy: row, layer: "lower", tile: lower });
        if (upper !== TILE.EMPTY) cells.push({ dx, dy: row, layer: "upper", tile: upper });
      }
    }
  }
  return cells;
}

function drawTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tileset: TilesetDef,
  tile: number,
  destX: number,
  destY: number,
  cellPx: number,
): void {
  const column = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  context.drawImage(
    image,
    column * TILE_SIZE,
    row * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    destX,
    destY,
    cellPx,
    cellPx,
  );
}

function withTilesetImage(tileset: TilesetDef, draw: (image: HTMLImageElement) => void): void {
  const url = tilesetImageUrl(tileset);
  const cached = imageCache.get(url);
  if (cached) {
    if (cached.complete && cached.naturalWidth > 0) {
      draw(cached);
    } else {
      cached.addEventListener("load", () => draw(cached), { once: true });
    }
    return;
  }
  const image = new Image();
  imageCache.set(url, image);
  image.addEventListener("load", () => draw(image), { once: true });
  image.src = url;
}
