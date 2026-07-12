import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

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
if (!map) throw new Error("no map");
const ts = project.tilesets[map.tilesetId];

for (const id of [260, 290, 262, 263, 292, 293]) {
  console.log(id, {
    priority: ts.priority[id],
    metaLayer: ts.tileMeta?.[id]?.defaultLayer,
    label: ts.tileMeta?.[id]?.label,
    passage: ts.tileMeta?.[id]?.passage,
  });
}

const bottoms: { x: number; y: number }[] = [];
const tops: { x: number; y: number }[] = [];
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const u = map.upperTiles[y * map.width + x];
    const l = map.lowerTiles[y * map.width + x];
    if (u === 290 || l === 290) bottoms.push({ x, y });
    if (u === 260 || l === 260) tops.push({ x, y });
  }
}
let minCheb = 99;
for (let i = 0; i < bottoms.length; i += 1) {
  for (let j = i + 1; j < bottoms.length; j += 1) {
    const d = Math.max(Math.abs(bottoms[i].x - bottoms[j].x), Math.abs(bottoms[i].y - bottoms[j].y));
    if (d < minCheb) minCheb = d;
  }
}
// count tops that sit on lower vs upper array
let topOnUpper = 0;
let topOnLower = 0;
let botOnUpper = 0;
let botOnLower = 0;
for (let i = 0; i < map.upperTiles.length; i += 1) {
  if (map.upperTiles[i] === 260) topOnUpper += 1;
  if (map.lowerTiles[i] === 260) topOnLower += 1;
  if (map.upperTiles[i] === 290) botOnUpper += 1;
  if (map.lowerTiles[i] === 290) botOnLower += 1;
}
console.log({
  bottoms: bottoms.length,
  tops: tops.length,
  minChebyshevBetweenBottoms: minCheb,
  topOnUpper,
  topOnLower,
  botOnUpper,
  botOnLower,
});
