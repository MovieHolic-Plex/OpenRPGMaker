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
const p = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-home-8pyeong",
});
if (!p) throw new Error("missing project");

const maps = Object.values(p.maps).map((m) => ({
  id: m.id,
  name: m.name,
  size: `${m.width}x${m.height}`,
  tileset: m.tilesetId,
  events: m.events.map((e) => {
    const battle = e.pages?.[0]?.commands?.find((c) => c.kind === "battleProcessing");
    return {
      id: e.id,
      name: e.pages?.[0]?.name,
      x: e.x,
      y: e.y,
      troopId: battle && battle.kind === "battleProcessing" ? battle.troopId : undefined,
    };
  }),
}));

console.log(
  JSON.stringify(
    {
      title: p.meta?.title,
      startMapId: p.startMapId,
      mapTree: p.mapTree,
      maps,
      namedSwitches: p.switches.filter((s) => s.name).map((s) => `${s.id}:${s.name}`),
      troops: p.database.troops.map((t) => t.id),
    },
    null,
    2,
  ),
);
