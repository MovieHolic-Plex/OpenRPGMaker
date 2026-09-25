// Retro-fit the cheeked cliff stairs (scripts/content/lib/cliff-stairs.mjs) onto maps already written: every run of the
// old cheekless tread 2689 on the forest village sheets becomes 111 | 112… | 113, row by row. Same result the fixed
// generators now write, so later re-runs agree. Touches JSON artifacts only; canonical stores go through
// save-cliff-stairs.mjs. Usage: node scripts/content/fix-cliff-stairs.mjs [--dry] <file.json…>
import fs from "node:fs";
import { stairTile } from "./lib/cliff-stairs.mjs";

export const FAMILY = new Set(["forest_harmony", "forest_harmony_snow", "forest_harmony_volcano", "forest_harmony_desert", "forest_harmony_autumn"]);
export const OLD_TREAD = 2689;

/** Rewrite one map in place; returns the changed cells [{x, y, from, to}]. */
export function fixMapStairs(map) {
  if (!FAMILY.has(map.tilesetId) || !Array.isArray(map.lowerTiles)) return [];
  const W = map.width, L = map.lowerTiles, changed = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < W; x++) {
      if (L[y * W + x] !== OLD_TREAD || (x > 0 && L[y * W + x - 1] === OLD_TREAD)) continue;
      let w = 1;
      while (x + w < W && L[y * W + x + w] === OLD_TREAD) w++;
      if (w < 2) continue;                       // a lone tread is left alone (none are drawn that way)
      for (let d = 0; d < w; d++) {
        const to = stairTile(x + d, x, w);
        changed.push({ x: x + d, y, from: OLD_TREAD, to });
        L[y * W + x + d] = to;
      }
    }
  }
  return changed;
}

/** Every map object inside a JSON artifact (catalog / snapshot / project export). */
export function mapsIn(doc) {
  const out = [];
  if (doc && typeof doc === "object" && doc.maps && typeof doc.maps === "object") for (const m of Object.values(doc.maps)) if (m?.lowerTiles) out.push(m);
  if (doc?.map?.lowerTiles) out.push(doc.map);   // single-place snapshot {map, tileset}
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes("--dry"), files = process.argv.slice(2).filter((a) => a !== "--dry"), report = {};
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8"), doc = JSON.parse(text);
    const per = {};
    for (const m of mapsIn(doc)) { const c = fixMapStairs(m); if (c.length) per[m.id] = c; }
    if (!Object.keys(per).length) continue;
    report[f] = per;
    if (!dry) {
      const pretty = /^\{\n/.test(text), tail = text.endsWith("\n") ? "\n" : "";
      fs.writeFileSync(f, (pretty ? JSON.stringify(doc, null, text.match(/^\{\n( +)/)?.[1].length ?? 2) : JSON.stringify(doc)) + tail);
    }
  }
  if (process.env.STAIR_REPORT) fs.writeFileSync(process.env.STAIR_REPORT, JSON.stringify(report));
  for (const [f, per] of Object.entries(report)) console.log(f, Object.entries(per).map(([id, c]) => `${id}:${c.length}`).join(" "));
}
