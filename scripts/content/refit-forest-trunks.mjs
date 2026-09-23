// Re-fit the forest trunks of finished maps in a catalog, in place: every bottom edge of the
// forest_harmony_grove_47 canopy gets roots exactly as wide as the edge (forestTrunkTiles.ts).
// Maps painted before that rule have 4-wide caps ending in half a trunk and runs overhanging under
// the next canopy's transparent edge; both read as trunks cut in half. The canopy is kept except
// where an edge must move by a cell; houses, roads, props, door fronts and the entrance are untouched.
// Usage: node scripts/content/refit-forest-trunks.mjs tiledata/forest-villages/diverse/catalog.json [mapId...]
import fs from "node:fs";
import { withTsModule } from "../ontology-ts-loader.mjs";

const GROUND = 240;
const [file, ...only] = process.argv.slice(2);
if (!file) throw new Error("usage: refit-forest-trunks.mjs <catalog.json> [mapId...]");
const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
const group = catalog.tileset.autotileGroups.find((g) => g.id === "forest_harmony_grove_47");

await withTsModule("src/editor/tools/village/forestContour.ts", "refit-forest.mjs", ({ refitForestTrunks }) => {
  for (const map of Object.values(catalog.maps)) {
    if (only.length && !only.includes(map.id)) continue;
    const W = map.width, keep = new Set();
    const plan = map.layoutPlan ?? {};
    for (const p of [plan.entrance, ...(plan.regions ?? []).flatMap((r) => [r.front, r.doorAt])]) if (p) keep.add(p.y * W + p.x);
    for (const e of map.events ?? []) keep.add(e.y * W + e.x);
    const before = { lower: [...map.lowerTiles], upper: [...map.upperTiles] };
    const report = refitForestTrunks(map, { x: 0, y: 0, w: W, h: map.height }, group, GROUND,
      (x, y) => map.lowerTiles[y * W + x] === GROUND && map.upperTiles[y * W + x] === -1 && !keep.has(y * W + x));
    const changed = (layer) => map[layer].reduce((n, t, i) => n + (t !== before[layer === "lowerTiles" ? "lower" : "upper"][i]), 0);
    console.log(map.id, { trunkRuns: report.trunkRuns, canopy: report.canopyCells, lowerChanged: changed("lowerTiles"), upperChanged: changed("upperTiles") });
  }
});
fs.writeFileSync(file, JSON.stringify(catalog) + (fs.readFileSync(file, "utf8").endsWith("\n") ? "\n" : ""));
