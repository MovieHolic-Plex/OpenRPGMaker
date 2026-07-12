import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { collectMapIdsInTree } from "../src/editor/mapTreeActions.ts";
import { isMapWaterTile } from "../src/editor/tools/queryTools.ts";

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

console.log("projectId", config.projectId);
const p = await loadProjectFromSupabase(config);
if (!p) {
  console.log("NO PROJECT LOADED");
  process.exit(1);
}
console.log("meta.title", p.meta.title);
console.log("startMapId", p.startMapId);
console.log("startPos", p.startPos);
console.log("map keys", Object.keys(p.maps));
console.log("mapTree", JSON.stringify(p.mapTree));
console.log("tree ids", [...collectMapIdsInTree(p.mapTree)]);
console.log("titleResource", p.system.titleResourceId, p.system.titleScreen?.backgroundResourceId);

for (const [id, map] of Object.entries(p.maps)) {
  let water = 0;
  for (const t of map.lowerTiles) if (isMapWaterTile(t)) water += 1;
  const doors = map.lowerTiles.filter((t) => t === 146).length;
  console.log(
    `map ${id} name="${map.name}" ${map.width}x${map.height} events=${map.events.length} water=${water} doors=${doors}`,
  );
}
