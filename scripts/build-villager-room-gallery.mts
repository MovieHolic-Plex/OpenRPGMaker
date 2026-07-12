/**
 * Build 5 villager-room-v1 review maps into Supabase gallery project.
 * Usage: npx tsx scripts/build-villager-room-gallery.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  createVillagerRoomMap,
  VILLAGER_ROOM_KIT_ID,
  VILLAGER_ROOM_VARIANTS,
} from "../src/editor/villagerRoomKit.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { MapTreeNode, Project } from "../src/project/types.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function attachMaps(tree: MapTreeNode, mapIds: readonly string[]): MapTreeNode {
  const without = stripMaps(tree, new Set(mapIds));
  const children = [
    ...(without.children ?? []),
    ...mapIds.map((mapId) => ({ mapId, children: [] as MapTreeNode[] })),
  ];
  return { ...without, children };
}

function stripMaps(node: MapTreeNode, drop: Set<string>): MapTreeNode {
  const children = (node.children ?? [])
    .filter((c) => !drop.has(c.mapId))
    .map((c) => stripMaps(c, drop));
  return { ...node, children };
}

const env = loadEnv();
const projectId = env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery";
const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId,
});
if (!project) throw new Error("failed to load project");

const maps = VILLAGER_ROOM_VARIANTS.map((v) => createVillagerRoomMap(v.id));
const next: Project = {
  ...project,
  maps: { ...project.maps },
  mapTree: project.mapTree,
};
for (const map of maps) {
  next.maps[map.id] = map;
}
next.mapTree = attachMaps(project.mapTree, maps.map((m) => m.id));

const result = await saveProjectToSupabase(next, {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId,
});
if (result.kind !== "saved") {
  console.error(result);
  throw new Error(`save failed: ${result.kind}`);
}

// local JSON snapshot for review offline
const outDir = path.resolve("output/docs/villager-room-v1");
fs.mkdirSync(outDir, { recursive: true });
const catalog = {
  kitId: VILLAGER_ROOM_KIT_ID,
  projectId,
  savedAt: new Date().toISOString(),
  variants: VILLAGER_ROOM_VARIANTS.map((v) => {
    const map = next.maps[v.mapId]!;
    return {
      ...v,
      size: [map.width, map.height],
      lowerSample: map.lowerTiles.slice(0, map.width * 4),
    };
  }),
};
fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(catalog, null, 2));
for (const v of VILLAGER_ROOM_VARIANTS) {
  fs.writeFileSync(
    path.join(outDir, `${v.id}.json`),
    JSON.stringify(next.maps[v.mapId], null, 2),
  );
}

console.log(JSON.stringify({
  ok: true,
  projectId,
  kitId: VILLAGER_ROOM_KIT_ID,
  maps: VILLAGER_ROOM_VARIANTS.map((v) => ({ id: v.mapId, name: v.name, blurb: v.blurb })),
  outDir,
}, null, 2));
