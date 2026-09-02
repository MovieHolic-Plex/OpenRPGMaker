import { createRequire } from "node:module";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const Jimp = require("jimp");
const OUT = "/tmp/ee-capture/out";
const regions = {
  "02b-list-1440.png": { commands: [268, 160, 1172, 660], settings: [0, 88, 268, 772], modal: [0, 0, 1440, 900] },
  "01-default.png": { commands: [268, 160, 1172, 660] },
  "02-view-preview.png": { commands: [268, 160, 1172, 660] },
  "02-view-flow.png": { commands: [268, 160, 1172, 660] },
  "15-page2.png": { commands: [268, 160, 1172, 660] },
  "26-vp1920.png": { settings: [0, 88, 660, 952], commands: [660, 160, 920, 640] },
  "04-edit-text.png": { dialog: [251, 112, 938, 676], preview: [268, 218, 370, 290] },
  "07-edit-moveroute.png": { dialog: [160, 88, 1120, 720] },
  "10-picker-tab1.png": { picker: [291, 20, 858, 860] },
};
const isBg = (r, g, b) => { const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; const sat = Math.max(r, g, b) - Math.min(r, g, b); return lum > 232 && sat < 14; };
const out = {};
for (const [file, regs] of Object.entries(regions)) {
  let img; try { img = await Jimp.read(`${OUT}/${file}`); } catch (e) { out[file] = { error: String(e).slice(0, 100) }; continue; }
  out[file] = {};
  for (const [name, [x, y, w, h]] of Object.entries(regs)) {
    let bg = 0, total = 0;
    for (let yy = y; yy < Math.min(y + h, img.bitmap.height); yy += 1) for (let xx = x; xx < Math.min(x + w, img.bitmap.width); xx += 1) {
      const idx = (yy * img.bitmap.width + xx) * 4; const d = img.bitmap.data; total += 1; if (isBg(d[idx], d[idx + 1], d[idx + 2])) bg += 1;
    }
    out[file][name] = { blankPct: Math.round((bg / total) * 1000) / 10, px: total };
  }
}
console.log(JSON.stringify(out, null, 1));
