/**
 * Builds a derived ice dungeon from the shared user-authored canon and persists it.
 * The reference map map_g_ice_grand is never mutated.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  buildDungeonThemeMap,
  canReachDungeonLandmarks,
} from "../src/project/defaults/dungeonThemedLayouts.ts";
import {
  ICE_DIAGONAL_TILES,
  ICE_DIAGONAL_CANONICAL_SOURCE,
  validateIceDiagonalTerrain,
} from "../src/project/defaults/iceDiagonalTerrain.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { GameMap } from "../src/project/types.ts";

const PROJECT_ID = ICE_DIAGONAL_CANONICAL_SOURCE.projectId;
const MAP_ID = "map_g_ice_canonical_generated";
const REFERENCE_MAP_ID = ICE_DIAGONAL_CANONICAL_SOURCE.mapId;

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
}
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  throw new Error(".env.local requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}
const config = {
  url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  projectId: PROJECT_ID,
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error(`project load failed: ${PROJECT_ID}`);
if (!project.maps[REFERENCE_MAP_ID]) throw new Error(`canonical reference missing: ${REFERENCE_MAP_ID}`);

const built = buildDungeonThemeMap("ice");
if (!canReachDungeonLandmarks(built)) throw new Error("generated dungeon landmarks are not reachable");
const terrainIssues = validateIceDiagonalTerrain({
  width: built.width,
  height: built.height,
  lower: built.grid.lower,
});
if (terrainIssues.length > 0) throw new Error(`generated ridge rejected: ${JSON.stringify(terrainIssues)}`);

const map: GameMap = {
  id: MAP_ID,
  name: "얼음 던전 · 정본 파생 (26×18)",
  width: built.width,
  height: built.height,
  tilesetId: built.tilesetId,
  tileSize: 16,
  lowerTiles: [...built.grid.lower],
  upperTiles: [...built.grid.upper],
  events: [],
};
project.maps[MAP_ID] = map;

const tileset = project.tilesets[built.tilesetId];
if (!tileset) throw new Error(`tileset missing: ${built.tilesetId}`);
for (const tile of Object.values(ICE_DIAGONAL_TILES).flatMap((face) => Object.values(face))) {
  tileset.passability[tile] = { up: false, down: false, left: false, right: false };
}

const digest = (value: GameMap): string => createHash("sha256")
  .update(JSON.stringify({ lowerTiles: value.lowerTiles, upperTiles: value.upperTiles }))
  .digest("hex");
const expectedHash = digest(map);

const saved = await saveProjectToSupabase(project, config);
if (saved.kind !== "saved") throw new Error(`project save failed: ${saved.kind}`);
const reloaded = await loadProjectFromSupabase(config);
const remoteMap = reloaded?.maps[MAP_ID];
if (!remoteMap) throw new Error(`saved map missing after reload: ${MAP_ID}`);
const reloadedHash = digest(remoteMap);
if (reloadedHash !== expectedHash) throw new Error(`reload mismatch: ${expectedHash} != ${reloadedHash}`);

console.log(JSON.stringify({
  projectId: PROJECT_ID,
  mapId: MAP_ID,
  referenceMapId: REFERENCE_MAP_ID,
  size: `${map.width}x${map.height}`,
  terrainIssues: 0,
  landmarksReachable: true,
  hash: reloadedHash,
  save: "saved-and-reloaded",
}, null, 2));
