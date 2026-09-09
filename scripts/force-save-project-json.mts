/** Legacy-only JSON replacement. Never graft a freshly read canonical token onto an old file. */
import fs from "node:fs";
import { loadProjectFromSupabase, loadProjectSnapshotFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { ProjectRoutingError } from "../src/project/spatial/saveRouting";
import { deserialize } from "../src/project/io";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const projectPath = process.argv[2] ?? "output/evidence/dew-village-ai-rebuild/project-after-ai.json";
const projectId = process.argv[3] ?? "rpg-zzu-dew-village";
const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId,
};
const project = deserialize(fs.readFileSync(projectPath, "utf8"));
const snapshot = await loadProjectSnapshotFromSupabase(config);
if (snapshot?.authority.mode === "canonical" || Object.hasOwn(project, "spatialAuthoring")) {
  throw new ProjectRoutingError("authority-required", "This legacy force-save utility cannot publish canonical files. Load and edit with retained authority or explicitly create a new target.");
}
console.log("save", projectPath, "→", projectId, project.meta?.title);
const saved = await saveProjectToSupabase(project, config);
console.log("saved", saved);
const verify = await loadProjectFromSupabase(config);
console.log("verify title", verify?.meta?.title, "maps", verify ? Object.keys(verify.maps).length : 0);
if (!verify || verify.meta?.title !== project.meta?.title) process.exit(1);
