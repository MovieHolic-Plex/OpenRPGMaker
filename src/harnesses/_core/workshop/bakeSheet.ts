// src/harnesses/_core/workshop/bakeSheet.ts
/**
 * 공방 후보 격자 → 칩셋에 구울 이식 시트(순수, DOM 없음). 편집기 굽기(editor/workshop/workshopBake.ts)와
 * 조수 요청 시험 구동기가 같은 칸 자르기·시트 배치를 쓰게 떼어 냈다. 굽기 자체는 project/workshopTiles.ts bakeWorkshopObject.
 */
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { renderGrid } from "./grid";
import type { Grid, Palette, RgbaImage } from "./types";

const TILE = 16;

export function workshopGridHash(grid: Grid): string {
  const text = `${grid.width}x${grid.height}|${grid.cells.map((cell) => cell ?? "").join(",")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 그림을 16px 칸으로 자른다. 완전히 투명한 칸은 뺀다. */
function sliceTiles(image: RgbaImage): { dx: number; dy: number; pixels: Uint8ClampedArray }[] {
  const columns = Math.ceil(image.width / TILE), rows = Math.ceil(image.height / TILE);
  const out: { dx: number; dy: number; pixels: Uint8ClampedArray }[] = [];
  for (let dy = 0; dy < rows; dy++) {
    for (let dx = 0; dx < columns; dx++) {
      const pixels = new Uint8ClampedArray(TILE * TILE * 4);
      let any = false;
      for (let y = 0; y < TILE; y++) {
        const sy = dy * TILE + y;
        if (sy >= image.height) break;
        for (let x = 0; x < TILE; x++) {
          const sx = dx * TILE + x;
          if (sx >= image.width) break;
          const from = (sy * image.width + sx) * 4;
          if (image.data[from + 3] === 0) continue;
          any = true;
          pixels.set(image.data.subarray(from, from + 4), (y * TILE + x) * 4);
        }
      }
      if (any) out.push({ dx, dy, pixels });
    }
  }
  return out;
}

export interface WorkshopBakeSheet {
  /** 칸을 차례로 늘어놓은 이식 소스 시트(업로드 자산 기본 칸 폭) */
  readonly sheet: RgbaImage;
  /** 시트 칸 k 가 기물의 (dx,dy) 칸 */
  readonly cells: readonly { readonly sourceTile: number; readonly dx: number; readonly dy: number }[];
  readonly columns: number;
  readonly rows: number;
}

/** 격자를 칸으로 잘라(빈 칸 뺌) 이식 시트 한 장으로 늘어놓는다. 그림이 비면 던진다. */
export function workshopBakeSheet(grid: Grid, palette: Palette): WorkshopBakeSheet {
  const image = renderGrid(grid, palette);
  const tiles = sliceTiles(image);
  if (!tiles.length) throw new Error("그림이 비어 있습니다.");
  const columns = Math.ceil(image.width / TILE), rows = Math.ceil(image.height / TILE);
  // 이식 소스 시트의 칸 폭은 업로드 자산 기본값(bundledChipsetTilesPerRow 의 마지막 줄)을 따른다 — 렌더러가 같은 값으로 자른다
  const perRow = bundledChipsetTilesPerRow("workshop_");
  const height = Math.ceil(tiles.length / perRow) * TILE;
  const sheet: RgbaImage = { width: perRow * TILE, height, data: new Uint8ClampedArray(perRow * TILE * height * 4) };
  tiles.forEach((tile, k) => {
    const ox = (k % perRow) * TILE, oy = Math.floor(k / perRow) * TILE;
    for (let y = 0; y < TILE; y++) sheet.data.set(tile.pixels.subarray(y * TILE * 4, (y + 1) * TILE * 4), ((oy + y) * sheet.width + ox) * 4);
  });
  return { sheet, cells: tiles.map((tile, k) => ({ sourceTile: k, dx: tile.dx, dy: tile.dy })), columns, rows };
}
