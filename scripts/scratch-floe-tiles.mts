import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
const chip = PNG.sync.read(readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const S = 5, cols = 10;
const ids = [280, 281, 282, 283, 284, 285, 310, 311, 312, 313, 340, 341, 342, 343, 344, 345, 370, 371, 375, 376];
const rows = Math.ceil(ids.length / cols);
const out = new PNG({ width: cols * 16 * S, height: rows * 16 * S });
out.data.fill(30);
ids.forEach((t, i) => {
  const gx = (i % cols) * 16 * S, gy = Math.floor(i / cols) * 16 * S;
  const sx = (t % 30) * 16, sy = Math.floor(t / 30) * 16;
  for (let y = 0; y < 16 * S; y += 1) {
    for (let x = 0; x < 16 * S; x += 1) {
      const si = ((sy + (y % 16 < 16 ? Math.floor(y / S) : 0)) * chip.width + sx + Math.floor(x / S)) * 4;
      const di = ((gy + y) * out.width + gx + x) * 4;
      const a = chip.data[si + 3]! / 255;
      for (let c = 0; c < 3; c += 1) out.data[di + c] = Math.round(chip.data[si + c]! * a + 30 * (1 - a));
      out.data[di + 3] = 255;
    }
  }
});
writeFileSync("tmp/snow60-render/floe-tiles.png", PNG.sync.write(out));
console.log("row0: 280-285+310-313, row1: 340-345+370,371,375,376");
