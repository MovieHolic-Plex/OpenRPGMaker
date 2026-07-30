import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
const chip = PNG.sync.read(readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const S = 4, cols = 12, rows = 2;
const out = new PNG({ width: cols * 16 * S, height: rows * 16 * S });
out.data.fill(30);
const ids = [56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97];
ids.forEach((t, i) => {
  const gx = (i % cols) * 16 * S, gy = Math.floor(i / cols) * 16 * S;
  const sx = (t % 30) * 16, sy = Math.floor(t / 30) * 16;
  for (let y = 0; y < 16 * S; y += 1) {
    for (let x = 0; x < 16 * S; x += 1) {
      const si = ((sy + (y >> 2)) * chip.width + sx + (x >> 2)) * 4;
      const di = ((gy + y) * out.width + gx + x) * 4;
      const a = chip.data[si + 3]! / 255;
      for (let c = 0; c < 3; c += 1) out.data[di + c] = Math.round(chip.data[si + c]! * a + 30 * (1 - a));
      out.data[di + 3] = 255;
    }
  }
});
writeFileSync("tmp/snow60-render/water-tiles.png", PNG.sync.write(out));
console.log("row0: 56..67, row1: 86..97");
