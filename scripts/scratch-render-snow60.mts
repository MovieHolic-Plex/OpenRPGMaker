// Render snow60 live/orig maps + annotated crops from the dungeon chipset PNG.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import { buildSnowMountainTerrain } from "../src/project/defaults/snowMountain60";

const W = 60, H = 60, T = 16, TPR = 30;
const OUT = "tmp/snow60-render";
mkdirSync(OUT, { recursive: true });

const chipset = PNG.sync.read(readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const live = JSON.parse(readFileSync("tmp/snow60-live.json", "utf-8")) as { lowerTiles: number[] };
const orig = buildSnowMountainTerrain();
const diff = JSON.parse(readFileSync("tmp/snow60-diff.json", "utf-8")) as { diffs: Array<{ x: number; y: number }> };
const changed = new Set(diff.diffs.map((d) => d.y * W + d.x));

function drawTile(dst: PNG, tile: number, dx: number, dy: number, scale: number): void {
  const sx = (tile % TPR) * T, sy = Math.floor(tile / TPR) * T;
  for (let y = 0; y < T * scale; y += 1) {
    for (let x = 0; x < T * scale; x += 1) {
      const sxi = sx + Math.floor(x / scale), syi = sy + Math.floor(y / scale);
      const si = (syi * chipset.width + sxi) * 4, di = ((dy + y) * dst.width + dx + x) * 4;
      const a = chipset.data[si + 3]! / 255;
      for (let c = 0; c < 3; c += 1) dst.data[di + c] = Math.round(chipset.data[si + c]! * a + dst.data[di + c]! * (1 - a));
      dst.data[di + 3] = 255;
    }
  }
}

function render(tiles: number[], crop: { x: number; y: number; w: number; h: number }, scale: number, tintChanged: boolean): PNG {
  const png = new PNG({ width: crop.w * T * scale, height: crop.h * T * scale, fill: true });
  png.data.fill(24);
  for (let y = 0; y < crop.h; y += 1) {
    for (let x = 0; x < crop.w; x += 1) {
      const mx = crop.x + x, my = crop.y + y;
      const tile = tiles[my * W + mx]!;
      if (tile >= 0) drawTile(png, tile, x * T * scale, y * T * scale, scale);
      if (tintChanged && changed.has(my * W + mx)) {
        for (let py = 0; py < T * scale; py += 1) {
          for (let px = 0; px < T * scale; px += 1) {
            const di = ((y * T * scale + py) * png.width + x * T * scale + px) * 4;
            dst: {
              png.data[di] = Math.round(png.data[di]! * 0.55 + 255 * 0.45);
              png.data[di + 1] = Math.round(png.data[di + 1]! * 0.55 + 0 * 0.45);
              png.data[di + 2] = Math.round(png.data[di + 2]! * 0.55 + 255 * 0.45);
            }
          }
        }
      }
    }
  }
  return png;
}

const jobs: Array<{ name: string; tiles: number[]; crop: { x: number; y: number; w: number; h: number }; scale: number; tint: boolean }> = [
  { name: "full-live", tiles: live.lowerTiles, crop: { x: 0, y: 0, w: 60, h: 60 }, scale: 2, tint: false },
  { name: "full-orig", tiles: [...orig.lowerTiles], crop: { x: 0, y: 0, w: 60, h: 60 }, scale: 2, tint: false },
  { name: "full-live-tint", tiles: live.lowerTiles, crop: { x: 0, y: 0, w: 60, h: 60 }, scale: 2, tint: true },
  { name: "a-shoulder-live", tiles: live.lowerTiles, crop: { x: 0, y: 5, w: 30, h: 9 }, scale: 4, tint: false },
  { name: "a-shoulder-orig", tiles: [...orig.lowerTiles], crop: { x: 0, y: 5, w: 30, h: 9 }, scale: 4, tint: false },
  { name: "a2-shoulder-live", tiles: live.lowerTiles, crop: { x: 28, y: 5, w: 32, h: 9 }, scale: 4, tint: false },
  { name: "b-diag-stair-live", tiles: live.lowerTiles, crop: { x: 14, y: 16, w: 34, h: 9 }, scale: 4, tint: false },
  { name: "b-diag-stair-orig", tiles: [...orig.lowerTiles], crop: { x: 14, y: 16, w: 34, h: 9 }, scale: 4, tint: false },
  { name: "c-mid-drape-live", tiles: live.lowerTiles, crop: { x: 0, y: 26, w: 32, h: 8 }, scale: 4, tint: false },
  { name: "c-mid-drape-orig", tiles: [...orig.lowerTiles], crop: { x: 0, y: 26, w: 32, h: 8 }, scale: 4, tint: false },
  { name: "d-stair3-live", tiles: live.lowerTiles, crop: { x: 4, y: 41, w: 22, h: 9 }, scale: 4, tint: false },
  { name: "e-foot-live", tiles: live.lowerTiles, crop: { x: 20, y: 51, w: 26, h: 9 }, scale: 4, tint: false },
  { name: "f-deco37-live", tiles: live.lowerTiles, crop: { x: 26, y: 10, w: 12, h: 6 }, scale: 6, tint: false },
  { name: "f-deco8-live", tiles: live.lowerTiles, crop: { x: 4, y: 24, w: 22, h: 7 }, scale: 6, tint: false },
  { name: "b2-tint-live", tiles: live.lowerTiles, crop: { x: 14, y: 16, w: 34, h: 9 }, scale: 4, tint: true },
  { name: "c2-tint-live", tiles: live.lowerTiles, crop: { x: 0, y: 26, w: 32, h: 8 }, scale: 4, tint: true },
];

for (const j of jobs) {
  writeFileSync(`${OUT}/${j.name}.png`, PNG.sync.write(render(j.tiles, j.crop, j.scale, j.tint)));
}
console.log("rendered", jobs.length);
