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

function cell(x: number, y: number) {
  const i = y * map.width + x;
  const lower = map.lowerTiles[i];
  const upper = map.upperTiles[i];
  return {
    x,
    y,
    lower,
    upper,
    lowerLabel: lower >= 0 ? ts.tileMeta?.[lower]?.label ?? ts.tileMeta?.[lower]?.aiLabel : "(empty)",
    upperLabel: upper >= 0 ? ts.tileMeta?.[upper]?.label ?? ts.tileMeta?.[upper]?.aiLabel : "(empty)",
    lowerPassage: ts.tileMeta?.[lower]?.passage,
    upperPassage: ts.tileMeta?.[upper]?.passage,
  };
}

const targets = [cell(23, 37), cell(24, 37)];
const neigh: ReturnType<typeof cell>[] = [];
for (let y = 35; y <= 39; y++) {
  for (let x = 21; x <= 26; x++) {
    neigh.push(cell(x, y));
  }
}

// houses near
const housesNote = "rebuild places houses, sand, benches, flowers, trees around plaza south of lake";

console.log(JSON.stringify({ targets, neighborhood: neigh, housesNote }, null, 2));
