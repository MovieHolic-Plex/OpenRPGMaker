/**
 * Keep only map_interior_blank (실내 공터), then recreate villager-room-v1 ×5.
 * Usage: npx tsx scripts/reset-villager-room-gallery.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  createVillagerRoomMap,
  VILLAGER_ROOM_KIT_ID,
  VILLAGER_ROOM_VARIANTS,
} from "../src/editor/villagerRoomKit.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapTreeNode, Project } from "../src/project/types.ts";

const KEEP_MAP_ID = "map_interior_blank";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function findMapName(maps: Project["maps"], id: string): string {
  return maps[id]?.name ?? id;
}

const env = loadEnv();
const projectId = env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery";
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId,
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("failed to load project");

const beforeIds = Object.keys(project.maps);
const keep = project.maps[KEEP_MAP_ID];
if (!keep) {
  throw new Error(
    `missing ${KEEP_MAP_ID}. present: ${beforeIds.join(", ")}`,
  );
}

const removed = beforeIds.filter((id) => id !== KEEP_MAP_ID);

// Build fresh maps object: blank + 5 variants only
const maps: Record<string, GameMap> = {
  [KEEP_MAP_ID]: keep,
};
const variantMaps = VILLAGER_ROOM_VARIANTS.map((v) => createVillagerRoomMap(v.id));
for (const map of variantMaps) {
  maps[map.id] = map;
}

const mapTree: MapTreeNode = {
  mapId: KEEP_MAP_ID,
  children: variantMaps.map((m) => ({ mapId: m.id, children: [] })),
};

const next: Project = {
  ...project,
  maps,
  mapTree,
  startMapId: KEEP_MAP_ID,
};

const result = await saveProjectToSupabase(next, config);
if (result.kind !== "saved") {
  console.error(result);
  throw new Error(`save failed: ${result.kind}`);
}

const outDir = path.resolve("output/docs/villager-room-v1");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "reset-log.json"),
  JSON.stringify(
    {
      kitId: VILLAGER_ROOM_KIT_ID,
      projectId,
      kept: { id: KEEP_MAP_ID, name: findMapName(project.maps, KEEP_MAP_ID) },
      removed,
      created: variantMaps.map((m) => ({ id: m.id, name: m.name, size: [m.width, m.height] })),
      savedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
for (const map of variantMaps) {
  fs.writeFileSync(path.join(outDir, `${map.id}.json`), JSON.stringify(map, null, 2));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      projectId,
      kept: KEEP_MAP_ID,
      removedCount: removed.length,
      removed,
      created: variantMaps.map((m) => m.id),
      mapTreeRoot: next.mapTree.mapId,
      children: next.mapTree.children?.map((c) => c.mapId),
    },
    null,
    2,
  ),
);
