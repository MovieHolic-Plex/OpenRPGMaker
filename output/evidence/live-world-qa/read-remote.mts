import { writeFileSync } from "node:fs";
import { loadEnv } from "vite";
import { loadProjectFromSupabase } from "../../../src/project/supabaseProjectSync";

const env = loadEnv("development", process.cwd(), "");
const projectId = "rpg-zzu-qa-world-2026-09-06-f51eb3ca-final";
const project = await loadProjectFromSupabase({
  projectId, url: env.VITE_SUPABASE_URL,
  anonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
});
if (!project) throw new Error("QA project missing");
const map = project.maps[project.startMapId];
writeFileSync("output/evidence/live-world-qa/latest-remote-project.json", JSON.stringify(project, null, 2));
console.log("REMOTE_READ", JSON.stringify({
  projectId, width: map.width, height: map.height,
  trees: map.upperTiles.filter(tile => [260, 261, 262, 263].includes(tile)).length,
  houses: map.layoutPlan?.regions.filter(region => region.role === "house").length,
}));
