import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { tileLabelForIndex, describeChipsetTile } from "../src/project/defaults/chipsetMapping.ts";

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
const map = p.maps.map_castle_keep;
if (!map) throw new Error("no map");

// User said (18,18) to (19,24) — interpret as tile coords. Expand a bit for context.
const x0 = 16;
const x1 = 22;
const y0 = 16;
const y1 = 26;

console.log("map", map.id, map.width, "x", map.height);
console.log("region x", x0, "..", x1, "y", y0, "..", y1);
console.log("   " + Array.from({ length: x1 - x0 + 1 }, (_, i) => String(x0 + i).padStart(4)).join(""));

const used = new Map<number, number>();
for (let y = y0; y <= y1; y += 1) {
  const cells: string[] = [];
  for (let x = x0; x <= x1; x += 1) {
    const lower = map.lowerTiles[y * map.width + x]!;
    const upper = map.upperTiles[y * map.width + x]!;
    used.set(lower, (used.get(lower) ?? 0) + 1);
    if (upper >= 0) used.set(upper, (used.get(upper) ?? 0) + 1);
    const u = upper >= 0 ? `/${upper}` : "";
    cells.push(String(lower).padStart(4) + (u ? u : ""));
  }
  console.log(String(y).padStart(2) + " " + cells.join(" "));
}

// Exact user bbox 18-19 x, 18-24 y
console.log("\nexact (18..19, 18..24):");
for (let y = 18; y <= 24; y += 1) {
  for (let x = 18; x <= 19; x += 1) {
    const lower = map.lowerTiles[y * map.width + x]!;
    const upper = map.upperTiles[y * map.width + x]!;
    let label = tileLabelForIndex(lower);
    try {
      label = describeChipsetTile(lower).label;
    } catch {
      /* */
    }
    console.log(`  (${x},${y}) lower=${lower} "${label}" upper=${upper}`);
  }
}

console.log("\nunique tiles in padded region:");
for (const [t, n] of [...used.entries()].sort((a, b) => a[0] - b[0])) {
  let label = `Tile ${t}`;
  try {
    label = describeChipsetTile(t).label;
  } catch {
    /* */
  }
  console.log(`  ${t}: ${n}x — ${label} / ${tileLabelForIndex(t)}`);
}
