// Re-edge the farm plots of finished maps in a catalog, in place. Plots painted before the builtin_farmland 3×3
// (lib/village-farmland.mjs) were filled with 188, the plot's right-edge tile, and read as vertical stripes.
// A plot is a rectangle of farmland tiles (a farm placement's rect when the plan has one); only its lower tiles
// and that placement's `lower` change. Running it again changes nothing.
// Usage: node scripts/content/refit-farmland-edges.mjs <catalog.json> [mapId...]
import fs from "node:fs";
import { FARMLAND_TILES, farmlandTiles } from "./lib/village-farmland.mjs";

const [file, ...only] = process.argv.slice(2);
if (!file) throw new Error("usage: refit-farmland-edges.mjs <catalog.json> [mapId...]");
const text = fs.readFileSync(file, "utf8"), catalog = JSON.parse(text);

// Bounding boxes of 4-connected farmland areas; only full rectangles are plots.
function plots(map) {
  const W = map.width, seen = new Set(), out = [];
  for (let i = 0; i < map.lowerTiles.length; i++) {
    if (seen.has(i) || !FARMLAND_TILES.has(map.lowerTiles[i])) continue;
    const cells = [], queue = [i];
    seen.add(i);
    while (queue.length) {
      const c = queue.pop(), x = c % W, y = Math.floor(c / W);
      cells.push(c);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const n = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < map.height && !seen.has(n) && FARMLAND_TILES.has(map.lowerTiles[n])) { seen.add(n); queue.push(n); }
      }
    }
    const xs = cells.map((c) => c % W), ys = cells.map((c) => Math.floor(c / W));
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x + 1, h = Math.max(...ys) - y + 1;
    if (cells.length === w * h) out.push({ x, y, w, h });
    else console.warn(map.id, "farmland area is not a rectangle — left as is", { x, y, w, h, cells: cells.length });
  }
  return out;
}

for (const map of Object.values(catalog.maps)) {
  if (only.length && !only.includes(map.id)) continue;
  const W = map.width, farms = (catalog.plans ?? []).find((p) => p.id === map.id)?.placements?.filter((o) => o.kind === "farm") ?? [];
  let changed = 0;
  const found = plots(map);
  for (const r of found) {
    const tiles = farmlandTiles(r.w, r.h);
    tiles.forEach((t, k) => {
      const i = (r.y + Math.floor(k / r.w)) * W + r.x + (k % r.w);
      if (map.lowerTiles[i] !== t) { map.lowerTiles[i] = t; changed++; }
    });
    const placement = farms.find((o) => o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h);
    if (placement) placement.lower = tiles;
  }
  if (found.length) console.log(map.id, { plots: found.length, lowerChanged: changed });
}
fs.writeFileSync(file, JSON.stringify(catalog) + (text.endsWith("\n") ? "\n" : ""));
