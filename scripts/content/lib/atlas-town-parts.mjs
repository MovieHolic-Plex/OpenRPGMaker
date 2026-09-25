// Atlas town parts (forest_harmony 3311~, scripts/content/bake-atlas-town-parts.py) as outdoor-kit parts
// ({ name, w, h, upper }) so OutdoorMap.put / props / moor place them by name.
import fs from "node:fs";
const data = JSON.parse(fs.readFileSync("src/assets/forestHarmonyAtlasTownParts.json", "utf8"));
export const ATLAS_PARTS = data.parts.map((p) => ({ name: p.name, w: p.w, h: p.h, upper: p.tiles, atlas: true, passage: p.passage, category: p.category }));
export const ATLAS_PART_RANGE = [data.start, data.count - 1];
