/**
 * Read-only verifier for the user-authored ice canon.
 *
 * map_g_ice_grand is reference material: this script never writes it back.
 * New ice dungeons must consume src/project/defaults/iceDiagonalTerrain.ts.
 */
import fs from "node:fs";
import {
  ICE_DIAGONAL_TILES,
  ICE_DIAGONAL_CANONICAL_SOURCE,
  validateIceDiagonalTerrain,
} from "../src/project/defaults/iceDiagonalTerrain.ts";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

const PROJECT_ID = ICE_DIAGONAL_CANONICAL_SOURCE.projectId;
const MAP_ID = ICE_DIAGONAL_CANONICAL_SOURCE.mapId;

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
}
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  throw new Error(".env.local requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  projectId: PROJECT_ID,
});
const map = project?.maps[MAP_ID];
if (!map) throw new Error(`canonical map missing: ${PROJECT_ID}/${MAP_ID}`);

const issues = validateIceDiagonalTerrain({
  width: map.width,
  height: map.height,
  lower: map.lowerTiles,
});
if (issues.length > 0) {
  throw new Error(`canonical map rejected: ${JSON.stringify(issues.slice(0, 12))}`);
}

const counts = Object.fromEntries(
  Object.values(ICE_DIAGONAL_TILES)
    .flatMap((face) => Object.values(face))
    .map((tile) => [tile, map.lowerTiles.filter((value) => value === tile).length]),
);
console.log(JSON.stringify({ projectId: PROJECT_ID, mapId: MAP_ID, size: `${map.width}x${map.height}`, issues: 0, counts }, null, 2));
