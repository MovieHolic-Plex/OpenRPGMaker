import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { isTransparentChipsetTile } from "../src/project/defaults/chipsetMapping.ts";
import { isTreeCanopyTileId, isTreeTrunkTileId, isUpperOnlyOverlayTile } from "../src/project/tilesetHarness.ts";
import { COMBINED_TOWN_TRANSPARENT_TILES } from "../src/project/defaults/generatedChipsetTransparency.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!project) throw new Error("no project");
const map = project.maps.map_lake_village;
if (!map) throw new Error("no map");
const ts = project.tilesets[map.tilesetId];
const x = 14;
const y = 19;
const i = y * map.width + x;
const lower = map.lowerTiles[i];
const upper = map.upperTiles[i];

function info(tile: number, label: string) {
  if (tile < 0) return { label, tile, empty: true };
  return {
    label,
    tile,
    meta: ts.tileMeta?.[tile],
    priority: ts.priority[tile],
    transparentList: COMBINED_TOWN_TRANSPARENT_TILES.includes(tile),
    isTransparentChip: isTransparentChipsetTile(tile),
    upperOnlyOverlay: isUpperOnlyOverlayTile(ts, tile),
    canopy: isTreeCanopyTileId(tile),
    trunk: isTreeTrunkTileId(tile),
  };
}

console.log(JSON.stringify({
  cell: { x, y },
  lower: info(lower, "lower"),
  upper: info(upper, "upper"),
  neighbors: ["n", "s", "w", "e"].map((dir, idx) => {
    const dx = [0, 0, -1, 1][idx]!;
    const dy = [-1, 1, 0, 0][idx]!;
    const ni = (y + dy) * map.width + (x + dx);
    return {
      dir,
      lower: map.lowerTiles[ni],
      upper: map.upperTiles[ni],
    };
  }),
}, null, 2));
