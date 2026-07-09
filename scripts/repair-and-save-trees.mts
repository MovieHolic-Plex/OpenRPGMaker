import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { repairTreePairsOnProject, formatTreePairRepairSummary } from "../src/project/lint/repairTreePairs.ts";

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
if (!project) throw new Error("load failed");

const map = project.maps.map_lake_village;
if (map) {
  const before = {
    lower: map.lowerTiles[5 * map.width + 14],
    upperAbove: map.upperTiles[4 * map.width + 14],
  };
  console.log("before (14,5)", before);
}

const result = repairTreePairsOnProject(project);
console.log(formatTreePairRepairSummary(result), result);

if (map) {
  console.log("after (14,5)", {
    lower: map.lowerTiles[5 * map.width + 14],
    upperAbove: map.upperTiles[4 * map.width + 14],
  });
}

const saved = await saveProjectToSupabase(project, config);
console.log("saved", saved);
