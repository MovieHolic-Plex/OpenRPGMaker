// Render tiledata/atlas-towns maps with the app's own tile drawer (dev server) → output/atlas-towns/images/<id>.png (16px
// cells) and a thumbnail tiledata/atlas-towns/images/<id>.png (long side ≤ 640). Night maps also get <id>-night.png with
// their defaultLighting laid over (ambient darkness + colour), as the runtime shows them.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/render-atlas-towns.mjs   (ATLAS_ONLY=<id,id> for some)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { withTsModule } from "../ontology-ts-loader.mjs";
import { townTilesets } from "./lib/atlas-town-map.mjs";
import { renderMaps } from "./lib/atlas-render.mjs";

const catalog = JSON.parse(fs.readFileSync("tiledata/atlas-towns/catalog.json"));
const only = process.env.ATLAS_ONLY ? process.env.ATLAS_ONLY.split(",") : null;
const maps = Object.fromEntries(Object.entries(catalog.maps).filter(([id]) => !only || only.includes(id)));
const tilesets = await withTsModule("scripts/content/lib/atlas-towns-entry.ts", "atlas-render-entry.mjs", (api) => townTilesets(api));
fs.mkdirSync("output/atlas-towns/images", { recursive: true });
fs.mkdirSync("tiledata/atlas-towns/images", { recursive: true });
const images = await renderMaps(maps, tilesets);
for (const [id, buf] of Object.entries(images)) {
  const full = `output/atlas-towns/images/${id}.png`;
  fs.writeFileSync(full, buf);
  const light = maps[id].defaultLighting;
  execFileSync("python3", ["scripts/content/lib/night-preview.py", full, `tiledata/atlas-towns/images/${id}.png`, light ? JSON.stringify(light) : ""]);
}
console.log(Object.keys(images).length, "maps rendered");
