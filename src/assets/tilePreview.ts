// assets/tilePreview.ts
// DOM Canvas용 타일 미리보기. Phaser(bundled.ts)와 시각적 일관을 맞춘다.
// 같은 색/구조를 사용하지만 Canvas2D API로 다시 그린다.

import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { TILE } from "@/project/defaults";

export const TILE_SIZE = RESOURCE_SLICING.chipset.cellWidth;
export const TILES_PER_ROW = 8;
const PREVIEW_COORD_UNITS = TILE_SIZE + TILE_SIZE;

type Ctx = CanvasRenderingContext2D;

export function drawTilePreview(ctx: Ctx, index: number): void {
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  if (index < 0) {
    // 빈 칸: 체커.
    checker(ctx, 0, 0);
    return;
  }
  switch (index) {
    case TILE.GRASS:
      grass(ctx);
      break;
    case TILE.WATER:
      water(ctx);
      break;
    case TILE.WALL:
      wall(ctx);
      break;
    case TILE.PATH:
      path(ctx);
      break;
    case TILE.FLOOR:
      floor(ctx);
      break;
    case TILE.SAND:
      sand(ctx);
      break;
    case TILE.TREE:
      tree(ctx);
      break;
    case TILE.STAIRS:
      stairs(ctx);
      break;
    default:
      checker(ctx, 0, 0);
  }
}

function checker(ctx: Ctx, ox: number, oy: number): void {
  ctx.fillStyle = "#15171c";
  ctx.fillRect(ox, oy, TILE_SIZE / 2, TILE_SIZE / 2);
  ctx.fillStyle = "#1a1d23";
  ctx.fillRect(ox + TILE_SIZE / 2, oy, TILE_SIZE / 2, TILE_SIZE / 2);
  ctx.fillRect(ox, oy + TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2);
  ctx.fillStyle = "#15171c";
  ctx.fillRect(ox + TILE_SIZE / 2, oy + TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2);
}

function px(value: number): number {
  return (value / PREVIEW_COORD_UNITS) * TILE_SIZE;
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillRect(px(x), px(y), px(w), px(h));
}

function grass(ctx: Ctx): void {
  ctx.fillStyle = "#3a7d3a";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#4f9b4f";
  const spots = [[2, 2], [7, 4], [12, 2], [18, 6], [24, 3], [5, 9], [20, 12], [10, 16], [26, 20], [3, 24], [15, 26], [22, 24]];
  for (const [x, y] of spots) rect(ctx, x, y, 2, 4);
}

function water(ctx: Ctx): void {
  ctx.fillStyle = "#2a5d9a";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#4a8ad6";
  rect(ctx, 4, 8, 8, 2);
  rect(ctx, 18, 14, 10, 2);
  rect(ctx, 6, 22, 12, 2);
}

function wall(ctx: Ctx): void {
  ctx.fillStyle = "#555a66";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#3a3f4b";
  for (let r = 0; r < 4; r++) {
    const y = px(r * 8);
    ctx.fillRect(0, y, TILE_SIZE, px(1));
    const offset = r % 2 === 0 ? 0 : 8;
    for (let bx = offset; bx < PREVIEW_COORD_UNITS; bx += 16) {
      rect(ctx, bx, r * 8, 1, 8);
    }
  }
}

function path(ctx: Ctx): void {
  ctx.fillStyle = "#9a7a4a";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#b89868";
  rect(ctx, 3, 4, 3, 3);
  rect(ctx, 14, 8, 4, 3);
  rect(ctx, 22, 18, 3, 4);
  rect(ctx, 8, 22, 3, 3);
}

function floor(ctx: Ctx): void {
  ctx.fillStyle = "#b89a6a";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#8a6e44";
  rect(ctx, 15, 0, 1, PREVIEW_COORD_UNITS);
  rect(ctx, 0, 15, PREVIEW_COORD_UNITS, 1);
}

function sand(ctx: Ctx): void {
  ctx.fillStyle = "#d9c98a";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#c4b274";
  const spots = [[2, 2], [8, 5], [14, 3], [20, 8], [26, 4], [5, 14], [18, 18], [10, 24], [24, 22]];
  for (const [x, y] of spots) rect(ctx, x, y, 2, 2);
}

function tree(ctx: Ctx): void {
  grass(ctx);
  ctx.fillStyle = "#6b4a2a";
  rect(ctx, 14, 20, 4, 8);
  ctx.fillStyle = "#2f6b2f";
  ctx.beginPath();
  ctx.arc(px(16), px(12), px(11), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3f8a3f";
  ctx.beginPath();
  ctx.arc(px(13), px(10), px(5), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px(20), px(13), px(5), 0, Math.PI * 2);
  ctx.fill();
}

function stairs(ctx: Ctx): void {
  ctx.fillStyle = "#6a6f7a";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#454a55";
  for (let r = 0; r < 4; r++) {
    const y = 4 + r * 7;
    rect(ctx, 4, y, PREVIEW_COORD_UNITS - 8, 5);
  }
}
