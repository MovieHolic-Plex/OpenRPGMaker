/**
 * Builds and persists the playable 55x55 ice expedition derived from map_g_ice_grand.
 * The canonical reference map and the project's global start map are never changed.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isPassable } from "../src/project/collision.ts";
import {
  ICE_GRAND_ADVENTURE_ENCOUNTERS,
  ICE_GRAND_ADVENTURE_MAP_ID,
  ICE_GRAND_ADVENTURE_START,
  installIceGrandAdventure,
} from "../src/project/defaults/iceGrandAdventure.ts";
import {
  ICE_DIAGONAL_CANONICAL_SOURCE,
  validateIceDiagonalTerrain,
} from "../src/project/defaults/iceDiagonalTerrain.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapTreeNode } from "../src/project/types.ts";

function loadEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      env[match[1]!] ||= match[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function digestMap(map: GameMap): string {
  return createHash("sha256")
    .update(canonicalJson({
      id: map.id,
      width: map.width,
      height: map.height,
      lowerTiles: map.lowerTiles,
      upperTiles: map.upperTiles,
      events: map.events,
      layoutPlan: map.layoutPlan,
    }))
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return entry;
    return Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)));
  });
}

function countTreeId(node: MapTreeNode, mapId: string): number {
  return Number(node.mapId === mapId) + node.children.reduce((sum, child) => sum + countTreeId(child, mapId), 0);
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error(".env.local requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");

const projectId = ICE_DIAGONAL_CANONICAL_SOURCE.projectId;
const config = { url: url.replace(/\/$/, ""), anonKey, projectId };
const project = await loadProjectFromSupabase(config);
if (!project) throw new Error(`project load failed: ${projectId}`);
const reference = project.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId];
if (!reference) throw new Error(`canonical map missing: ${ICE_DIAGONAL_CANONICAL_SOURCE.mapId}`);
const canonicalHashBefore = digestMap(reference);
const startBefore = { mapId: project.startMapId, pos: structuredClone(project.startPos) };

const installed = installIceGrandAdventure(project);
const map = installed.map;
const terrainIssues = validateIceDiagonalTerrain({ width: map.width, height: map.height, lower: map.lowerTiles });
if (terrainIssues.length > 0) throw new Error(`ice terrain rejected: ${JSON.stringify(terrainIssues.slice(0, 12))}`);
if (!isPassable(project, map, ICE_GRAND_ADVENTURE_START.x, ICE_GRAND_ADVENTURE_START.y)) {
  throw new Error("adventure start is not passable");
}
for (const encounter of ICE_GRAND_ADVENTURE_ENCOUNTERS) {
  if (!isPassable(project, map, encounter.x, encounter.y)) {
    throw new Error(`encounter is not on passable terrain: ${encounter.eventId}`);
  }
}
if (digestMap(project.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId]!) !== canonicalHashBefore) {
  throw new Error("canonical map changed during install");
}
if (project.startMapId !== startBefore.mapId || JSON.stringify(project.startPos) !== JSON.stringify(startBefore.pos)) {
  throw new Error("global project start changed during install");
}
if (countTreeId(project.mapTree, ICE_GRAND_ADVENTURE_MAP_ID) !== 1) {
  throw new Error("adventure map tree node is missing or duplicated");
}

const localHash = digestMap(map);
const saved = await saveProjectToSupabase(project, config);
if (saved.kind !== "saved") throw new Error(`project save failed: ${saved.kind}`);
const reloaded = await loadProjectFromSupabase(config);
const remoteMap = reloaded?.maps[ICE_GRAND_ADVENTURE_MAP_ID];
const remoteReference = reloaded?.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId];
if (!reloaded || !remoteMap || !remoteReference) throw new Error("saved project or map missing after reload");
const remoteHash = digestMap(remoteMap);
if (remoteHash !== localHash) throw new Error(`saved map hash mismatch: ${localHash} != ${remoteHash}`);
if (digestMap(remoteReference) !== canonicalHashBefore) throw new Error("canonical map changed after remote reload");
if (reloaded.startMapId !== startBefore.mapId || JSON.stringify(reloaded.startPos) !== JSON.stringify(startBefore.pos)) {
  throw new Error("global project start changed after remote reload");
}

const evidence = {
  projectId,
  mapId: ICE_GRAND_ADVENTURE_MAP_ID,
  referenceMapId: ICE_DIAGONAL_CANONICAL_SOURCE.mapId,
  size: `${remoteMap.width}x${remoteMap.height}`,
  encounters: ICE_GRAND_ADVENTURE_ENCOUNTERS.map(({ eventId, troopId, x, y, label }) => ({ eventId, troopId, x, y, label })),
  rewards: 2,
  checkpoint: { x: 27, y: 47 },
  start: ICE_GRAND_ADVENTURE_START,
  terrainIssues: 0,
  canonicalPreserved: true,
  projectStartPreserved: true,
  hash: remoteHash,
  save: "saved-and-reloaded",
};
const outputDir = path.resolve("output/evidence/ice-grand-adventure");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "supabase-save-result.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));
