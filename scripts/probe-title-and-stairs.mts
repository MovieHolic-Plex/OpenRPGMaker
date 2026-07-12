import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { resolveAssetResourceUrl } from "../src/assets/generatedAssetResourceResolver.ts";
import { canMove, getTileset, tileAt, tilePassability } from "../src/project/collision.ts";
import { VILLAGE_SHOPPING_STREET_MAP_ID } from "../src/project/defaults/villageShoppingStreetBuild.ts";

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
console.log("titleResourceId", p.system.titleResourceId);
console.log("titleScreen.bg", p.system.titleScreen?.backgroundResourceId);
console.log("titleScreen.title", p.system.titleScreen?.title);
const bg = p.system.titleScreen?.backgroundResourceId ?? p.system.titleResourceId;
const url = resolveAssetResourceUrl(bg, { project: p });
console.log("resolve bg", bg, "url?", Boolean(url), url?.slice(0, 80));

const map = p.maps[VILLAGE_SHOPPING_STREET_MAP_ID] ?? Object.values(p.maps)[0];
if (!map) throw new Error("no map");
const ts = getTileset(p, map)!;
console.log("112 pass", ts.passability[112], "prio", ts.priority[112]);
for (const [x, y] of [
  [36, 20],
  [37, 20],
  [38, 20],
  [39, 20],
  [38, 21],
  [38, 19],
] as const) {
  const t = tileAt(map, x, y);
  const pass = tilePassability(ts, t.lower, t.upper);
  console.log(
    `${x},${y} L${t.lower} U${t.upper}`,
    JSON.stringify(pass),
    "H",
    canMove(p, map, x - 1, y, x, y),
    "V",
    canMove(p, map, x, y - 1, x, y),
  );
}
