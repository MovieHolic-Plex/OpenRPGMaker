// Check the forest trunks of finished maps against the trunk rule (src/editor/tools/village/forestTrunkTiles.ts):
// every bottom edge of the forest_harmony_grove_47 canopy is at least FOREST_TRUNK_MIN_WIDTH wide and carries exactly
// the assembly forestTrunkCandidates gives for its width, and no trunk tile stands anywhere else. A 1–2-wide edge
// reads as a thin root dangling from the canopy; a trunk not under its edge reads as a root with no tree.
// Reads catalogs (maps{}) and region snapshots (*.oprn.json); exits 1 on any finding.
// Usage: node scripts/content/check-forest-trunks.mjs [file...]
//   (default: the diverse, climate and field catalogs and their region snapshots)
import fs from "node:fs";
import { withTsModule } from "../ontology-ts-loader.mjs";

const CATALOGS = ["tiledata/forest-villages/diverse/catalog.json", "tiledata/climate-villages/catalog.json", "tiledata/field-routes/catalog.json"];
const files = process.argv.slice(2);
if (!files.length) for (const catalog of CATALOGS) {
  files.push(catalog);
  for (const plan of JSON.parse(fs.readFileSync(catalog, "utf8")).plans) {
    const snapshot = `public/assets/region-references/${plan.id}.oprn.json`;
    if (fs.existsSync(snapshot)) files.push(snapshot);
  }
}
// The climate sheets keep the forest_harmony numbers, so one group describes every canopy.
const group = JSON.parse(fs.readFileSync(CATALOGS[0], "utf8")).tileset.autotileGroups.find((g) => g.id === "forest_harmony_grove_47");
const canopy = new Set(Object.values(group.variantMap).map(Number));

await withTsModule("src/editor/tools/village/forestTrunkTiles.ts", "check-forest-trunks.mjs", ({ FOREST_TRUNK_MIN_WIDTH, FOREST_TRUNK_TILES, forestTrunkCandidates }) => {
  let findings = 0, maps = 0;
  const totals = { narrow: 0, wrongTrunk: 0, strayTrunk: 0 };
  for (const file of files) {
    for (const map of Object.values(JSON.parse(fs.readFileSync(file, "utf8")).maps ?? {})) {
      const W = map.width, H = map.height, lower = map.lowerTiles, upper = map.upperTiles;
      if (!upper.some((t) => canopy.has(t))) continue;
      maps++;
      const f = (x, y) => x >= 0 && y >= 0 && x < W && y < H && canopy.has(upper[y * W + x]);
      const report = { narrow: [], wrongTrunk: [], strayTrunk: [] }, claimed = new Set();
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
        if (!f(x, y) || f(x, y + 1)) continue;
        const start = x;
        while (f(x + 1, y) && !f(x + 1, y + 1)) x++;
        const width = x - start + 1;
        for (let dy = 0; dy < 3 && y + dy < H; dy++) for (let dx = 0; dx < width; dx++) claimed.add((y + dy) * W + start + dx);
        // Edges within two rows of the bottom run off the map; their roots are out of view.
        if (y + 2 >= H) continue;
        if (width < FOREST_TRUNK_MIN_WIDTH) { report.narrow.push([start, y, width]); continue; }
        const rows = forestTrunkCandidates(start, width)[0].rows;
        if (rows.some((row, dy) => row.some((tile, dx) => lower[(y + dy) * W + start + dx] !== tile))) report.wrongTrunk.push([start, y, width]);
      }
      lower.forEach((t, i) => { if (FOREST_TRUNK_TILES.has(t) && !claimed.has(i)) report.strayTrunk.push([i % W, Math.floor(i / W)]); });
      const count = report.narrow.length + report.wrongTrunk.length + report.strayTrunk.length;
      findings += count;
      for (const key of Object.keys(totals)) totals[key] += report[key].length;
      if (count) console.log(`${file} ${map.id}`, JSON.stringify(Object.fromEntries(Object.entries(report).filter(([, v]) => v.length).map(([k, v]) => [k, v.slice(0, 8)]))));
    }
  }
  console.log(`${files.length} files, ${maps} forest maps, ${findings} findings`, JSON.stringify(totals));
  if (findings) process.exitCode = 1;
});
