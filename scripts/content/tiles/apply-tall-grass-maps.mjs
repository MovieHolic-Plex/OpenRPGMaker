// Re-lay the tall grass of shipped forest_harmony maps with the E/F/G helper (lib/tall-grass.mjs).
// Usage: node scripts/content/tiles/apply-tall-grass-maps.mjs [--dry]
// Maps: every shipped map drawn on the forest_harmony art that holds tall grass (2026-09-24 main: the reviewed
// river village place only; the retro-atlas places keep their own speckled grass at 243..335 and are not touched).
import fs from "node:fs";
import { arrangeTallGrass } from "../lib/tall-grass.mjs";

const dry = process.argv.includes("--dry");
const forest = JSON.parse(fs.readFileSync("src/assets/forestHarmonyTileset.json", "utf8"));
const MAPS = [
  { file: "src/project/defaults/spatial/reviewedPlaces/riverVillage.json", map: j => j, tileset: forest },
];
for (const { file, map, tileset } of MAPS) {
  const text = fs.readFileSync(file, "utf8"), json = JSON.parse(text), m = map(json);
  const { lowerTiles, stats } = arrangeTallGrass(m, { tileset, seed: 1 });
  const changed = lowerTiles.some((t, i) => t !== m.lowerTiles[i]);
  console.log(file, JSON.stringify(stats), changed ? "changed" : "unchanged");
  if (changed && !dry) { m.lowerTiles = lowerTiles; fs.writeFileSync(file, JSON.stringify(json) + (text.endsWith("\n") ? "\n" : "")); }
}
