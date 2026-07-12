import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { passageMarkForTile } from "../src/project/tilesetPassage.ts";
import { isPassable } from "../src/project/collision.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { applyCombinedTownHarness } from "../src/project/tilesetHarness.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!project) throw new Error("no project");
const map = project.maps.map_lake_village;
if (!map) throw new Error(`no map_lake_village keys=${Object.keys(project.maps)}`);
const ts = project.tilesets[map.tilesetId];

console.log("=== remote tileset tree contract ===");
for (const id of [260, 290, 262, 263, 292, 293]) {
  console.log(id, {
    priority: ts.priority[id],
    mark: passageMarkForTile(ts, id),
    pass: ts.passability[id],
    meta: {
      layer: ts.tileMeta?.[id]?.defaultLayer,
      passage: ts.tileMeta?.[id]?.passage,
      source: ts.tileMeta?.[id]?.source,
    },
  });
}

// fresh harness blank
const blank = createBlankProject();
const bts = blank.tilesets[Object.keys(blank.tilesets)[0]!];
applyCombinedTownHarness(bts);
console.log("=== blank harness after apply ===");
for (const id of [260, 290]) {
  console.log(id, { priority: bts.priority[id], mark: passageMarkForTile(bts, id), pass: bts.passability[id] });
}

// sample a dense area: count tree tiles and adjacency
type Cell = { x: number; y: number; u: number; l: number };
const trees: Cell[] = [];
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    const u = map.upperTiles[i];
    const l = map.lowerTiles[i];
    if ([260, 290, 262, 263, 292, 293].includes(u) || [260, 290, 262, 263, 292, 293].includes(l)) {
      trees.push({ x, y, u, l });
    }
  }
}
console.log("tree cells", trees.length);

// find any 2x2 block of tree uppers (dense patch)
let dense2x2 = 0;
for (let y = 0; y < map.height - 1; y++) {
  for (let x = 0; x < map.width - 1; x++) {
    const cells = [
      map.upperTiles[y * map.width + x],
      map.upperTiles[y * map.width + x + 1],
      map.upperTiles[(y + 1) * map.width + x],
      map.upperTiles[(y + 1) * map.width + x + 1],
    ];
    if (cells.every((t) => [260, 290, 262, 263, 292, 293].includes(t))) dense2x2++;
  }
}
console.log("full tree-upper 2x2 blocks", dense2x2);

// bottoms spacing
const bottoms: { x: number; y: number }[] = [];
for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const u = map.upperTiles[y * map.width + x];
    if (u === 290 || u === 292 || u === 293) bottoms.push({ x, y });
  }
}
let minD = 99;
let hist: Record<number, number> = {};
for (let i = 0; i < bottoms.length; i++) {
  for (let j = i + 1; j < bottoms.length; j++) {
    const d = Math.max(Math.abs(bottoms[i].x - bottoms[j].x), Math.abs(bottoms[i].y - bottoms[j].y));
    if (d <= 5) hist[d] = (hist[d] ?? 0) + 1;
    if (d < minD) minD = d;
  }
}
console.log("bottom min cheb", minD, "hist<=5", hist);

// dump NW corner forest sample 12x8 upper grid
console.log("=== NW upper sample (x0-11,y0-7) ===");
for (let y = 0; y < 8; y++) {
  const row: string[] = [];
  for (let x = 0; x < 12; x++) {
    const u = map.upperTiles[y * map.width + x];
    if (u === 260) row.push("T");
    else if (u === 290) row.push("B");
    else if (u === 262) row.push("tl");
    else if (u === 263) row.push("tr");
    else if (u === 292) row.push("bl");
    else if (u === 293) row.push("br");
    else if (u >= 0) row.push("·");
    else row.push(".");
  }
  console.log(String(y).padStart(2), row.join(" "));
}

// walkability under canopy top cell
const topCell = trees.find((c) => c.u === 260);
if (topCell) {
  console.log("sample canopy cell passable?", topCell, isPassable(project, map, topCell.x, topCell.y));
}
const botCell = trees.find((c) => c.u === 290);
if (botCell) {
  console.log("sample trunk cell passable?", botCell, isPassable(project, map, botCell.x, botCell.y));
}
