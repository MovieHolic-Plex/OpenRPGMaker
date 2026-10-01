// Contact sheet of the biome cliff styles (src/project/relief/styles.ts): one small test landform — a two-level
// terrace, a round knoll and a stair — drawn with every RELIEF_STYLES entry over its biome's lawn tile, 3x.
//   node_modules/.bin/vite-node scripts/content/relief-style-sheet.mts [out.png]
import fs from "node:fs";
import { PNG } from "pngjs";
import { effectiveHeights, renderRelief } from "../../src/project/relief/render";
import { RELIEF_STYLES } from "../../src/project/relief/styles";
import { gridFromRelief, type ReliefData } from "../../src/project/relief/types";
import { reliefSlopes } from "../../src/project/relief/walk";

const out = process.argv[2] ?? "verify-shots/relief-landforms/style-sheet.png";
const W = 20, H = 13, T = 16, SCALE = 3;
const levels = new Array(W * H).fill(0), ramps = new Array(W * H).fill(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (y < 5 + (x > 12 ? 1 : 0)) levels[i] = x < 3 ? 2 : 3;
  if (Math.hypot(x - 14, (y - 10) * 1.2) < 3.2) levels[i] = 2;
}
for (let y = 5; y <= 8; y++) for (let x = 5; x <= 6; x++) { ramps[y * W + x] = 5; levels[y * W + x] = 0; }
const base: ReliefData = { width: W, height: H, levels, ramps };
const names = Object.keys(RELIEF_STYLES);
const cols = 3, cw = W * T, rows = Math.ceil(names.length / cols);
const probe = renderRelief(effectiveHeights(gridFromRelief(base)), { slopes: reliefSlopes(base) });
const ch = probe.SH + 12;
const sheet = new PNG({ width: cols * cw * SCALE, height: rows * ch * SCALE });
names.forEach((name, k) => {
  const spec = RELIEF_STYLES[name]!;
  const r = renderRelief(effectiveHeights(gridFromRelief(base)), { slopes: reliefSlopes(base), style: name });
  const lawn = spec.top[3]!, bg = [1, 3, 5].map((o) => parseInt(lawn.slice(o, o + 2), 16));
  const ox = (k % cols) * cw, oy = Math.floor(k / cols) * ch;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sy = y - 12, s = (sy * r.PW + x) * 4;
    let px = [20, 20, 24];
    if (sy >= 0 && sy < r.SH) px = r.rgba[s + 3] ? [r.rgba[s], r.rgba[s + 1], r.rgba[s + 2]] : bg;
    else if (y < 12) px = name.length && x < 4 + name.length * 6 && y > 2 && y < 9 && (Math.floor(x / 2) + y) % 3 === 0 ? [230, 230, 230] : [20, 20, 24];
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
      const d = (((oy + y) * SCALE + dy) * sheet.width + (ox + x) * SCALE + dx) * 4;
      sheet.data[d] = px[0]!; sheet.data[d + 1] = px[1]!; sheet.data[d + 2] = px[2]!; sheet.data[d + 3] = 255;
    }
  }
});
fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(JSON.stringify({ out, styles: names }));
