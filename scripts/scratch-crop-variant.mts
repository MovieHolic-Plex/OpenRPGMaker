import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const maps = JSON.parse(readFileSync("tmp/snow-variants/maps.json", "utf-8"));
const chip = PNG.sync.read(readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));

function crop(mid: string, x0: number, y0: number, w: number, h: number, s: number, name: string): void {
  const m = maps[mid];
  const out = new PNG({ width: w * 16 * s, height: h * 16 * s });
  out.data.fill(40);
  for (const [layerKey] of [["lowerTiles"], ["upperTiles"]] as const) {
    const tiles = m[layerKey] as number[];
    for (let ty = 0; ty < h; ty += 1) {
      for (let tx = 0; tx < w; tx += 1) {
        const t = tiles[(y0 + ty) * m.width + (x0 + tx)]!;
        if (t < 0) continue;
        const sx = (t % 30) * 16, sy = Math.floor(t / 30) * 16;
        for (let py = 0; py < 16 * s; py += 1) {
          for (let px = 0; px < 16 * s; px += 1) {
            const si = ((sy + Math.floor(py / s)) * chip.width + sx + Math.floor(px / s)) * 4;
            const di = ((ty * 16 * s + py) * out.width + tx * 16 * s + px) * 4;
            const a = chip.data[si + 3]! / 255;
            for (let c = 0; c < 3; c += 1) out.data[di + c] = Math.round(chip.data[si + c]! * a + out.data[di + c]! * (1 - a));
            out.data[di + 3] = 255;
          }
        }
      }
    }
  }
  writeFileSync(`tmp/snow-variants/${name}.png`, PNG.sync.write(out));
  console.log(name, "ok");
}

crop("map_snow_basin_60", 36, 47, 14, 10, 5, "lake-floe-check");
crop("map_snow_basin_60", 2, 43, 20, 14, 3, "lake-floe-wide");
