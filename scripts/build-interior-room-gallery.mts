/**
 * Delete all maps (including interior blank), build 3 interiors via full pipeline.
 * Usage: npx tsx scripts/build-interior-room-gallery.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  INTERIOR_ROOM_DEMO_PLANS,
  INTERIOR_ROOM_KIT_ID,
  ensureInteriorRoomHarness,
  runInteriorRoomPipeline,
} from "../src/editor/interiorRoomPipeline.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { GameMap, MapTreeNode, Project } from "../src/project/types.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
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

const removed = Object.keys(project.maps);
ensureInteriorRoomHarness(project);

const maps: Record<string, GameMap> = {};
const logs: unknown[] = [];
for (const plan of INTERIOR_ROOM_DEMO_PLANS) {
  const result = runInteriorRoomPipeline(plan);
  if (!result.ok) {
    console.error("critique failed", plan.mapId, result.warnings, result.log);
    throw new Error(`pipeline failed for ${plan.mapId}`);
  }
  maps[plan.mapId] = result.map;
  logs.push({ mapId: plan.mapId, log: result.log, events: result.map.events?.map((e) => e.name) });
}

const rootId = INTERIOR_ROOM_DEMO_PLANS[0]!.mapId;
const mapTree: MapTreeNode = {
  mapId: rootId,
  children: INTERIOR_ROOM_DEMO_PLANS.slice(1).map((p) => ({ mapId: p.mapId, children: [] })),
};

const next: Project = {
  ...project,
  maps,
  mapTree,
  startMapId: rootId,
};

const save = await saveProjectToSupabase(next, config);
if (save.kind !== "saved") {
  console.error(save);
  throw new Error(`save failed: ${save.kind}`);
}

const outDir = path.resolve("output/docs/interior-room-v1");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "build-log.json"),
  JSON.stringify(
    {
      kitId: INTERIOR_ROOM_KIT_ID,
      projectId,
      removed,
      created: INTERIOR_ROOM_DEMO_PLANS.map((p) => p.mapId),
      logs,
      savedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      projectId,
      kitId: INTERIOR_ROOM_KIT_ID,
      removedCount: removed.length,
      removed,
      created: Object.keys(maps),
      mapTreeRoot: rootId,
      pipelines: logs,
    },
    null,
    2,
  ),
);
