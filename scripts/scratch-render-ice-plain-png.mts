// Render the 64x64 ice plain to PNG (both layers) + inspection crops.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import { buildIcePlainTerrain, ICE_PLAIN_WIDTH as W, ICE_PLAIN_HEIGHT as H, ICE_PLAIN_START } from "../src/project/defaults/iceGrandPlain64";

const T = 16, TPR = 30;
const OUT = "tmp/ice-plain-render";
mkdirSync(OUT, { recursive: true });

const chipset = PNG.sync.read(readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const terrain = buildIcePlainTerrain();
const lower = [...terrain.lowerTiles];
const upper = [...terrain.upperTiles];

function drawTile(dst: PNG, tile: number, dx: number, dy: number, scale: number): void {
  const sx = (tile % TPR) * T, sy = Math.floor(tile / TPR) * T;
  for (let y = 0; y < T * scale; y += 1) {
    for (let x = 0; x < T * scale; x += 1) {
      const sxi = sx + Math.floor(x / scale), syi = sy + Math.floor(y / scale);
      const si = (syi * chipset.width + sxi) * 4, di = ((dy + y) * dst.width + dx + x) * 4;
      const a = (chipset.data[si + 3] ?? 0) / 255;
      for (let c = 0; c < 3; c += 1) {
        dst.data[di + c] = Math.round((chipset.data[si + c] ?? 0) * a + (dst.data[di + c] ?? 0) * (1 - a));
      }
      dst.data[di + 3] = 255;
    }
  }
}

function render(crop: { x: number; y: number; w: number; h: number }, scale: number, marker?: { x: number; y: number }): PNG {
  const png = new PNG({ width: crop.w * T * scale, height: crop.h * T * scale, fill: true });
  png.data.fill(20);
  for (let y = 0; y < crop.h; y += 1) for (let x = 0; x < crop.w; x += 1) {
    const mx = crop.x + x, my = crop.y + y;
    if (mx < 0 || my < 0 || mx >= W || my >= H) continue;
    const lo = lower[my * W + mx] ?? -1;
    if (lo >= 0) drawTile(png, lo, x * T * scale, y * T * scale, scale);
    const up = upper[my * W + mx] ?? -1;
    if (up >= 0) drawTile(png, up, x * T * scale, y * T * scale, scale);
  }
  if (marker !== undefined) {
    const mx = (marker.x - crop.x) * T * scale, my = (marker.y - crop.y) * T * scale;
    for (let py = 0; py < T * scale; py += 1) for (let px = 0; px < T * scale; px += 1) {
      const edge = py < 2 * scale || px < 2 * scale || py >= (T - 2) * scale || px >= (T - 2) * scale;
      if (!edge) continue;
      const di = ((my + py) * png.width + mx + px) * 4;
      if (di < 0 || di + 3 >= png.data.length) continue;
      png.data[di] = 255; png.data[di + 1] = 40; png.data[di + 2] = 220;
    }
  }
  return png;
}

const jobs: Array<{ name: string; crop: { x: number; y: number; w: number; h: number }; scale: number; marker?: { x: number; y: number } }> = [
  { name: "00-full", crop: { x: 0, y: 0, w: W, h: H }, scale: 2, marker: ICE_PLAIN_START },
  { name: "01-pool-and-floe", crop: { x: 0, y: 50, w: 50, h: 14 }, scale: 5, marker: ICE_PLAIN_START },
  { name: "02-band-a-stair", crop: { x: 26, y: 44, w: 24, h: 12 }, scale: 6 },
  { name: "03-band-b-diagonals", crop: { x: 0, y: 33, w: 30, h: 11 }, scale: 6 },
  { name: "04-band-c-stair", crop: { x: 34, y: 17, w: 26, h: 12 }, scale: 6 },
  { name: "05-band-d-summit-rim", crop: { x: 14, y: 6, w: 30, h: 12 }, scale: 6 },
  { name: "06-summit-peaks", crop: { x: 0, y: 0, w: 34, h: 10 }, scale: 6 },
  { name: "07-summit-peaks-east", crop: { x: 32, y: 0, w: 32, h: 10 }, scale: 6 },
  { name: "08-magic-pillar", crop: { x: 12, y: 12, w: 16, h: 12 }, scale: 8 },
  { name: "09-ice-patch-seam", crop: { x: 2, y: 24, w: 26, h: 12 }, scale: 6 },
  { name: "10-drape-detail", crop: { x: 0, y: 44, w: 28, h: 10 }, scale: 8 },
];

const written: string[] = [];
for (const job of jobs) {
  const png = render(job.crop, job.scale, job.marker);
  const path = `${OUT}/${job.name}.png`;
  writeFileSync(path, PNG.sync.write(png));
  written.push(`${path} ${png.width}x${png.height}`);
}
console.log(written.join("\n"));
