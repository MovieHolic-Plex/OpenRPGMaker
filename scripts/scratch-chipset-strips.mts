import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
const chip = PNG.sync.read(readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
function strip(name: string, y0: number, rows: number, scale: number): void {
  const h = rows * 16;
  const out = new PNG({ width: chip.width * scale, height: h * scale });
  for (let y = 0; y < h * scale; y += 1) {
    for (let x = 0; x < chip.width * scale; x += 1) {
      const si = ((y0 * 16 + Math.floor(y / scale)) * chip.width + Math.floor(x / scale)) * 4;
      const di = (y * out.width + x) * 4;
      const a = chip.data[si + 3]! / 255;
      for (let c = 0; c < 3; c += 1) out.data[di + c] = Math.round(chip.data[si + c]! * a + 40 * (1 - a));
      out.data[di + 3] = 255;
    }
  }
  writeFileSync(`tmp/snow60-render/${name}`, PNG.sync.write(out));
}
strip("chip-rows0-4.png", 0, 5, 2);
strip("chip-rows9-13.png", 9, 5, 2);
console.log("ok");
