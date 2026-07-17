import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!(k in env) || !env[k]) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const p = await loadProjectFromSupabase({
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: "rpg-zzu-dungeon-example",
});
const m = p?.maps.map_ice;
console.log(
  JSON.stringify(
    {
      title: p?.meta?.title,
      startMapId: p?.startMapId,
      map: m ? { name: m.name, w: m.width, h: m.height, events: m.events.length } : null,
      monsters: m?.events
        .filter((e) => /monster_/i.test(e.id) || /몬스터|슬라임|유령|벌/.test(e.name))
        .map((e) => ({
          id: e.id,
          name: e.name,
          x: e.x,
          y: e.y,
          graphic: e.pages?.[0]?.graphic ?? null,
          trigger: e.pages?.[0]?.trigger ?? null,
        })),
      allEvents: m?.events.map((e) => ({ id: e.id, name: e.name, x: e.x, y: e.y })),
    },
    null,
    2,
  ),
);
