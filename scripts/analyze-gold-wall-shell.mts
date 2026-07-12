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
const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
const map = project!.maps.map_interior_blank!;
const w = map.width;
const labels: Record<number, string> = {
  430: "VOID",
  72: "FLOOR",
  105: "BODY",
  104: "IN_L",
  106: "IN_R",
  428: "EW",
  426: "EE",
  457: "EN",
  397: "ES",
  233: "CNW",
  258: "CNE",
  456: "BSW",
  458: "BSE",
  396: "AL",
  398: "AR",
  18: "BK",
  20: "BK",
  48: "BK",
  50: "BK",
  78: "BK",
  79: "BK",
};

function tag(t: number): string {
  return labels[t] ?? String(t);
}

console.log("size", map.width, map.height);
for (let y = 0; y < map.height; y++) {
  const row: string[] = [];
  for (let x = 0; x < map.width; x++) {
    const L = map.lowerTiles[y * w + x]!;
    const U = map.upperTiles[y * w + x]!;
    row.push(U >= 0 ? `${tag(L)}+${U}` : tag(L).padEnd(4));
  }
  console.log(String(y).padStart(2), row.join(" "));
}
