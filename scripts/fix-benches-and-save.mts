import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";

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
if (!map) throw new Error("no map");

// 잘못된 2×2 벤치 잔재: 357/358 제거. 327|328 가로 벤치는 유지.
let cleared = 0;
for (let i = 0; i < map.upperTiles.length; i += 1) {
  const u = map.upperTiles[i];
  if (u === 357 || u === 358) {
    map.upperTiles[i] = TILE.EMPTY;
    cleared += 1;
  }
}
console.log("cleared false-bench tiles 357/358:", cleared);

// 남쪽 광장에 가로 벤치만 다시 (place_props post-hook 포함)
const ctx = { project };
const placed = runTool(ctx, "place_props", {
  mapId: "map_lake_village",
  area: { x: 20, y: 36, w: 12, h: 4 },
  material: "벤치",
  count: 3,
  naturalness: 0.3,
  minGap: 2,
  seed: 220,
});
console.log(placed.summary);

// 샘플 좌표
for (const [x, y] of [[23, 36], [24, 36], [23, 37], [24, 37]] as const) {
  const i = y * map.width + x;
  console.log(`(${x},${y}) lower=${map.lowerTiles[i]} upper=${map.upperTiles[i]}`);
}

const saved = await saveProjectToSupabase(ctx.project, config);
console.log("saved", saved);
