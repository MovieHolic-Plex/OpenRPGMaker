import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const p = await loadProjectFromSupabase(config);
if (!p) throw new Error("no project");
const map = p.maps.map_lake_village;
if (!map) throw new Error("no map");

const groups: Record<string, { x: number; y: number; u: number }[]> = {
  yard: [],
  cemetery: [],
  bench: [],
  table: [],
  furniture: [],
};
const yard = new Set([349, 350, 351, 352]);
const cem = new Set([323, 353, 383]);
const bench = new Set([327, 328, 358, 388]);
const table = new Set([144, 174, 204, 234, 235, 236]);
const furniture = new Set([147, 148, 175, 176, 205, 206, 202, 203, 237, 231]);

for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const u = map.upperTiles[y * map.width + x];
    if (u < 0) continue;
    const cell = { x, y, u };
    if (yard.has(u)) groups.yard!.push(cell);
    else if (cem.has(u)) groups.cemetery!.push(cell);
    else if (bench.has(u)) groups.bench!.push(cell);
    else if (table.has(u)) groups.table!.push(cell);
    else if (furniture.has(u)) groups.furniture!.push(cell);
  }
}

function bbox(a: { x: number; y: number }[]) {
  if (a.length === 0) return null;
  const xs = a.map((c) => c.x);
  const ys = a.map((c) => c.y);
  return {
    n: a.length,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    spanX: Math.max(...xs) - Math.min(...xs),
    spanY: Math.max(...ys) - Math.min(...ys),
  };
}

console.log(
  JSON.stringify(
    {
      size: [map.width, map.height],
      yard: bbox(groups.yard!),
      cemetery: bbox(groups.cemetery!),
      bench: bbox(groups.bench!),
      table: bbox(groups.table!),
      furniture: bbox(groups.furniture!),
    },
    null,
    2,
  ),
);
