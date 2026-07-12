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
const base = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
};

for (const projectId of ["rpg-zzu-house-template-gallery", "rpg-zzu-large-river-market"]) {
  const p = await loadProjectFromSupabase({ ...base, projectId });
  if (!p) {
    console.log(projectId, "=> NULL");
    continue;
  }
  const ids = Object.keys(p.maps);
  const m = p.maps[ids[0]!];
  console.log(
    projectId,
    "=>",
    JSON.stringify({
      title: p.meta.title,
      maps: ids,
      start: p.startMapId,
      size: m ? `${m.width}x${m.height}` : null,
      mapName: m?.name,
      events: m?.events.length,
    }),
  );
}
