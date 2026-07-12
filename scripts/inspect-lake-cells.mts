import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { BUILD_PALETTE_PRESETS } from "../src/editor/panels/buildPaletteCore.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const project = await loadProjectFromSupabase(config);
const map = project.maps.map_lake_village;
if (!map) {
  console.log("maps", Object.keys(project.maps));
  throw new Error("map_lake_village missing");
}

const ts = project.tilesets[map.tilesetId];
function cell(x: number, y: number) {
  const i = y * map.width + x;
  return { x, y, lower: map.lowerTiles[i], upper: map.upperTiles[i] };
}
function label(id: number) {
  const m = ts?.tileMeta?.[id];
  return m
    ? { id, label: m.label, aiLabel: m.aiLabel, passage: m.passage }
    : { id, label: "(no meta)" };
}

const targets = [cell(21, 37), cell(21, 38)];
console.log(JSON.stringify({
  map: { id: map.id, size: `${map.width}x${map.height}` },
  paletteTree: BUILD_PALETTE_PRESETS.tree,
  paletteProp: BUILD_PALETTE_PRESETS.prop,
  targets: targets.map((c) => ({
    ...c,
    lowerMeta: label(c.lower),
    upperMeta: label(c.upper),
  })),
  neighborhood: [
    cell(20, 36), cell(21, 36), cell(22, 36),
    cell(20, 37), cell(21, 37), cell(22, 37),
    cell(20, 38), cell(21, 38), cell(22, 38),
    cell(20, 39), cell(21, 39), cell(22, 39),
  ].map((c) => ({ ...c, L: label(c.lower).label, U: label(c.upper).label })),
}, null, 2));

let c260 = 0, c290 = 0, c262 = 0, c263 = 0, c292 = 0, c293 = 0, flowerish = 0;
const upperHist = new Map<number, number>();
for (let i = 0; i < map.upperTiles.length; i += 1) {
  const u = map.upperTiles[i];
  if (u < 0) continue;
  upperHist.set(u, (upperHist.get(u) ?? 0) + 1);
  if (u === 260) c260 += 1;
  if (u === 290) c290 += 1;
  if (u === 262) c262 += 1;
  if (u === 263) c263 += 1;
  if (u === 292) c292 += 1;
  if (u === 293) c293 += 1;
}
console.log("tree counts", { coniferTop: c260, coniferBot: c290, broadTL: c262, broadTR: c263, broadBL: c292, broadBR: c293 });
console.log("top upper tiles", [...upperHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
