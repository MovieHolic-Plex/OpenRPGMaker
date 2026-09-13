import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { HOUSE_SHELL_TILE } from "../src/project/defaults/interiorHouseWallTiles.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};
const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("no project");
const names = new Map(Object.entries(HOUSE_SHELL_TILE).map(([k,v]) => [v, k]));
function tileName(t: number): string {
  if (t < 0) return "empty";
  return names.get(t) ?? String(t);
}
for (const mapId of ["map_lake_shop", "map_lake_house", "map_lake_tavern", "map_lake_smithy"]) {
  const map = project.maps[mapId];
  if (!map) continue;
  const entrance = (map.events ?? []).find((e) => e.id.startsWith("ev_entrance_") || (e.pages ?? []).some((p) => p.name === "입구"));
  console.log("==", mapId, map.width + "x" + map.height, "entrance", JSON.stringify(entrance && { id: entrance.id, x: entrance.x, y: entrance.y }));
  const cx = entrance?.x ?? Math.floor(map.width / 2);
  const cy = entrance?.y ?? map.height - 3;
  for (let y = Math.max(0, cy - 3); y < map.height; y++) {
    const row = [];
    for (let x = Math.max(0, cx - 2); x <= Math.min(map.width - 1, cx + 2); x++) {
      const i = y * map.width + x;
      row.push("(" + x + "," + y + ") L" + tileName(map.lowerTiles[i]) + "/U" + tileName(map.upperTiles[i]));
    }
    console.log(row.join(" | "));
  }
}
