// MV/MZ 시트 픽셀 → OPRN 평면 아틀라스 픽셀. 브라우저(ImageData)와 Node(pngjs) 모두 같은 RGBA 버퍼로 부른다.
// 칸 번호 배치는 layout.ts 가 정한다. 여기서는 그 배치대로 쿼터를 옮겨 붙이기만 한다.

import { quarterTable } from "./autotile";
import { MV_TILE_SIZE, type MvAtlasLayout } from "./layout";

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}

const QUARTER = MV_TILE_SIZE / 2;

function copyBlock(src: RgbaImage, sx: number, sy: number, dst: Uint8ClampedArray, dstWidth: number, dx: number, dy: number, size: number): void {
  for (let row = 0; row < size; row += 1) {
    const y = sy + row;
    if (y < 0 || y >= src.height) continue;
    const from = (y * src.width + sx) * 4;
    const width = Math.max(0, Math.min(size, src.width - sx));
    dst.set(src.data.subarray(from, from + width * 4), ((dy + row) * dstWidth + dx) * 4);
  }
}

/** 배치대로 아틀라스를 굽는다. sheets 에 없는 시트의 칸은 투명으로 남는다. */
export function bakeMvAtlas(layout: MvAtlasLayout, sheets: ReadonlyMap<string, RgbaImage>): RgbaImage {
  const width = layout.columns * MV_TILE_SIZE;
  const height = layout.rows * MV_TILE_SIZE;
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [tile, cell] of layout.cells) {
    const sheet = sheets.get(cell.sheet);
    if (!sheet) continue;
    const ox = (tile % layout.columns) * MV_TILE_SIZE;
    const oy = Math.floor(tile / layout.columns) * MV_TILE_SIZE;
    const source = cell.source;
    if (source.kind === "flat") {
      copyBlock(sheet, source.cellX * MV_TILE_SIZE, source.cellY * MV_TILE_SIZE, data, width, ox, oy, MV_TILE_SIZE);
      continue;
    }
    const quarters = quarterTable(source.shapeKind)[source.shape]!;
    quarters.forEach(([qx, qy], i) => {
      copyBlock(
        sheet,
        (source.blockX * 2 + qx) * QUARTER,
        (source.blockY * 2 + qy) * QUARTER,
        data, width,
        ox + (i % 2) * QUARTER,
        oy + Math.floor(i / 2) * QUARTER,
        QUARTER,
      );
    });
  }
  return { width, height, data };
}

/** 칸 하나의 불투명 픽셀 비율(0..1). 통행·홈 레이어 추정과 빈 칸 판정에 쓴다. */
export function tileOpacity(atlas: RgbaImage, columns: number, tile: number): number {
  const ox = (tile % columns) * MV_TILE_SIZE;
  const oy = Math.floor(tile / columns) * MV_TILE_SIZE;
  let opaque = 0;
  for (let y = 0; y < MV_TILE_SIZE; y += 1) {
    for (let x = 0; x < MV_TILE_SIZE; x += 1) {
      if (atlas.data[((oy + y) * atlas.width + ox + x) * 4 + 3]! >= 128) opaque += 1;
    }
  }
  return opaque / (MV_TILE_SIZE * MV_TILE_SIZE);
}
