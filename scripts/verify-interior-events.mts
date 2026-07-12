import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { createInteriorWallFrameAutotileGroup } from "../src/project/tilesetHarness/themePacks.ts";

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
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!p) throw new Error("no project");

for (const [id, map] of Object.entries(p.maps)) {
  console.log(
    id,
    "events=",
    (map.events ?? []).map((e) => ({
      name: e.name,
      x: e.x,
      y: e.y,
      cmd0: e.pages?.[0]?.commands?.[0],
    })),
  );
}

const g = (p.tilesets.easyrpg_chipset_interior?.autotileGroups ?? []).find((a) =>
  a.id.includes("wall-frame"),
);
const fresh = createInteriorWallFrameAutotileGroup();
console.log("saved autotile corners sample", {
  "0": g?.variantMap?.["0"],
  "3": g?.variantMap?.["3"], // N+E? 
  freshNW: fresh.variantMap["3"], // mask for missing N and W? need check
  membersHas233: g?.memberTileIds?.includes(233),
  membersHas258: g?.memberTileIds?.includes(258),
});
// mask: N=1 E=2 S=4 W=8; missing N and W means only E+S connected = 2+4=6
console.log("variant missing NW (mask E+S=6)", fresh.variantMap["6"], "expect 233");
console.log("variant missing NE (mask S+W=12)", fresh.variantMap["12"], "expect 258");
