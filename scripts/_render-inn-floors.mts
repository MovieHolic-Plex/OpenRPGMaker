import fs from "node:fs";
import path from "node:path";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline.ts";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { renderInteriorMapPng, writePng } from "./lib/renderInteriorMapPng.mts";

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
const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
if (!tileset) throw new Error("no interior tileset");
const outDir = path.resolve("output/evidence/lake-village-interiors");
for (const mapId of ["map_lake_inn_2f", "map_lake_inn_3f"]) {
  const map = project.maps[mapId];
  if (!map) throw new Error("missing " + mapId);
  const png = path.join(outDir, mapId + ".png");
  writePng(renderInteriorMapPng(map, tileset, { scale: 3 }), png);
  console.log("wrote", png, map.width + "x" + map.height, "events", map.events.length);
}
