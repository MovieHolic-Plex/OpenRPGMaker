// Leaf interior for finished maps, in place: every full cell of the forest_harmony_grove_47 canopy (all 8 neighbours
// canopy) becomes one of its depth variants — shallow when open ground is within two cells, deep otherwise — picked by
// position (shadeForestCanopy → autotileEngine.shadeAutotileInterior). Edge tiles, trunks and everything else stay.
// A catalog whose own tileset has the grove without the depth variants gets them first (ensureForestGroveInterior).
// Catalogs without a tileset (climate, field) use the diverse forest-village grove: the climate sheets share its numbers.
// Usage: node scripts/content/shade-forest-canopy.mjs <catalog.json|snapshot.oprn.json>... [--only=mapId,...]
import fs from "node:fs";
import { withTsModule } from "../ontology-ts-loader.mjs";

const args = process.argv.slice(2), only = (args.find((a) => a.startsWith("--only="))?.slice(7) ?? "").split(",").filter(Boolean);
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) throw new Error("usage: shade-forest-canopy.mjs <catalog.json>... [--only=mapId,...]");
const GROVE = "forest_harmony_grove_47";
const { ensureForestGroveInterior } = await withTsModule("src/project/defaults/forestGrove.ts", "shade-grove.mjs", (m) => m);
const { shadeForestCanopy } = await withTsModule("src/editor/tools/village/forestContour.ts", "shade-forest.mjs", (m) => m);
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json", "utf8"));
ensureForestGroveInterior(village.tileset);
const shared = village.tileset.autotileGroups.find((g) => g.id === GROVE);

for (const file of files) {
  const text = fs.readFileSync(file, "utf8"), data = JSON.parse(text);
  const tilesets = [data.tileset, ...Object.values(data.tilesets ?? {})].filter(Boolean);
  const upgraded = tilesets.map((ts) => ensureForestGroveInterior(ts)).filter(Boolean).length;
  const groupFor = (map) => tilesets.find((ts) => ts.id === map.tilesetId)?.autotileGroups?.find((g) => g.id === GROVE && g.interiorVariants) ?? shared;
  const counts = {};
  for (const map of Object.values(data.maps ?? {})) {
    if (only.length && !only.includes(map.id)) continue;
    counts[map.id] = shadeForestCanopy(map, groupFor(map));
  }
  fs.writeFileSync(file, JSON.stringify(data) + (text.endsWith("\n") ? "\n" : ""));
  console.log(file, { upgradedTilesets: upgraded, shaded: counts });
}
