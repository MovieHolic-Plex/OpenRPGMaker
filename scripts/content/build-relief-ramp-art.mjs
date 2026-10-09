// tiledata/relief-art/<style>-ramp.png (exported from the LibreSprite source <style>-ramp.ase) → the ramp pixel art the
// relief renderer paints smooth ramps with on chip-rim maps (src/project/relief/rampArt.json).
// Sheet, 40×16: lit face 16×16 at x 0 (ramps climbing north/east — they face the viewer or the light), shaded face 16×16
// at x 18 (climbing south/west), edge colours 3×16 at x 36 (column 0 = the foot line, column 1 = the crest line).
// Usage: node scripts/content/build-relief-ramp-art.mjs
import fs from "node:fs";
import { PNG } from "pngjs";

const DIR = "tiledata/relief-art", OUT = "src/project/relief/rampArt.json";
const cut = (png, x0, w) => {
  const rgba = [];
  for (let y = 0; y < 16; y++) for (let x = x0; x < x0 + w; x++) { const o = (y * png.width + x) * 4; rgba.push(png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]); }
  return { w, h: 16, rgba };
};
// Procedural earth-bank slopes (2026-09-29 r2): the swamp ramps were drawn as dark brick/plank paving, which on a grass bank read as a
// striped mat laid on the ground (swamp QA "ramp = mat"). Regenerate lit/shade as a low-contrast turf bank in the style's own top
// ramp (speckle + two broken contour lines), keep the drawn edge strip (foot/crest colours), and write the PNG source back so
// tiledata/relief-art stays the single source. Styles listed here are re-derived on every run (idempotent).
const TURF = {
  "swamp-peat": ["#373b1f", "#4e542c", "#68703b", "#828c4a", "#939e54", "#a9b660"],
  "swamp-dead": ["#2c3022", "#3c412e", "#4f553b", "#626a48", "#707852", "#838c60"],
  // r3 (2026-09-29, 사용자 「그냥 주변 지형이랑 어울리는 느낌의 경사로면 충분함」): the styles whose automatic stair ramps drew as stone
  // steps now draw every ramp as a slope of their own ground (styles.ts smoothStairs) — each from the style's top ramp
  // (snow / red strata soil / basalt gravel / crystal dust / cinder / grave moss / pilgrim lawn). No PNG yet → one is made here.
  "tundra-snow": ["#6a7f9e", "#93a9c6", "#b9cce0", "#d6e3ef", "#e9f1f8", "#ffffff"],
  badlands: ["#523221", "#76482f", "#9d603e", "#c4784e", "#dd8858", "#ff9c65"],
  dwarf: ["#37352f", "#4e4c43", "#68655a", "#827e70", "#938e7f", "#a9a492"],
  crystal: ["#464450", "#646272", "#868298", "#a7a3be", "#bdb8d7", "#d9d4f7"],
  steampunk: ["#353228", "#4c4739", "#655e4c", "#7e765f", "#8e856b", "#a4997c"],
  gothic: ["#20241d", "#2e3329", "#3e4437", "#4d5545", "#57604e", "#646e5a"],
  holy: ["#39522a", "#51763c", "#6c9d50", "#87c464", "#99dd71", "#b0ff82"],
  // desert r3 cut-stair styles: their few east / west climbs are sand slopes (the stairs themselves are drawn by the renderer)
  "desert-cut": ["#5b4d35", "#826e4c", "#ae9366", "#d9b87f", "#f5d090", "#ffefa5"],
  "dune-cut": ["#946234", "#bc8a4e", "#d8aa6a", "#ecc88c", "#f0d49e", "#f8e2b2"],
};
// the lawn tone each slope sits on (index into its ramp): swamp banks are dark peat, the r3 grounds sit one or two tones up
const TURF_BASE = { "desert-cut": 3, "dune-cut": 3, "tundra-snow": 3, badlands: 3, dwarf: 3, crystal: 3, steampunk: 3, gothic: 3, holy: 3 };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hsh = (a, b, c) => { let v = 2166136261; for (const n of [a, b, c]) v = Math.imul(v ^ n, 16777619) >>> 0; return v; };
// r3 slopes: one tone lighter (lit) / darker (shaded) than the lawn so the slope reads as a face, speckles, and short dashes down
// the fall line instead of contour rows — contour rows every 8 px read as steps again on snow and soil
function fallBank(ramp, base, seed, shaded = false) {
  const px = [], b0 = base + (shaded ? -1 : 1);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let k = b0;
    const r = hsh(x, y, seed) % 100;
    if (r < 9) k = b0 - 1; else if (r < 14) k = b0 + 1;
    const col = hsh(x, 0, seed + 5) % 7, y0 = hsh(x, 1, seed + 5) % 16, d = (y - y0 + 16) % 16;
    if (col === 0 && d < 3) k = b0 - 1;
    if (col === 1 && d < 2) k = b0 + (shaded ? 0 : 1);
    px.push(hex(ramp[Math.max(0, Math.min(5, k))]));
  }
  return px;
}
function turfBank(ramp, base, seed, shaded = false) {
  const px = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let k = base;
    const r = hsh(x, y, seed) % 100;
    if (shaded) { if (r < 26) k = base - 1; else if (r < 30) k = base + 1; else if (r < 33) k = base - 2; }
    else if (r < 8) k = base - 1; else if (r < 15) k = base + 1; else if (r < 17) k = base - 2;
    // broken contour: a lit lip row over a shadow row, every 8 px, 60% of the columns (reads the climb without banding the whole tile)
    const band = y % 8;
    if ((band === 3 || band === 4) && hsh(Math.floor(x / 3), Math.floor(y / 8), seed + 9) % 5 < 3) k = band === 3 ? base + 1 : base - 1;
    px.push(hex(ramp[Math.max(0, Math.min(5, k))]));
  }
  return px;
}
const out = {};
// a TURF style without a source sheet gets one: faces filled below, the edge strip = foot (ramp 1) and crest (ramp 4) lines
for (const [style, ramp] of Object.entries(TURF)) {
  const f = `${DIR}/${style}-ramp.png`;
  if (fs.existsSync(f)) continue;
  const png = new PNG({ width: 40, height: 16 });
  for (let y = 0; y < 16; y++) for (const [x, k] of [[36, 1], [37, 4], [38, 3]]) { const c = hex(ramp[k]), o = (y * 40 + x) * 4; png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255; }
  fs.writeFileSync(f, PNG.sync.write(png));
}
for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith("-ramp.png")).sort()) {
  const png = PNG.sync.read(fs.readFileSync(`${DIR}/${f}`));
  if (png.width !== 40 || png.height !== 16) throw new Error(`${f}: expected 40x16, got ${png.width}x${png.height}`);
  const style = f.replace(/-ramp\.png$/, "");
  if (TURF[style]) {
    const put = (x0, cols) => cols.forEach((c, i) => { const o = ((Math.floor(i / 16)) * png.width + x0 + (i % 16)) * 4; png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255; });
    const base = TURF_BASE[style] ?? 2;
    const bank = TURF_BASE[style] ? fallBank : turfBank;
    put(0, bank(TURF[style], base, 11)); put(18, bank(TURF[style], base, 23, true));
    fs.writeFileSync(`${DIR}/${f}`, PNG.sync.write(png));
  }
  out[f.replace(/-ramp\.png$/, "")] = { lit: cut(png, 0, 16), shade: cut(png, 18, 16), side: cut(png, 36, 3) };
}
fs.writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(JSON.stringify({ styles: Object.keys(out), out: OUT }));
