/**
 * wipe-village-dungeon AI 결과에서 잡맵 제거 후 Supabase 강제 저장.
 */
import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { MapTreeNode, Project } from "../src/project/types.ts";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const PROJECT_ID = process.env.OPRN_PROJECT_ID ?? "rpg-zzu-dew-30min";
const SRC = process.argv[2] ?? "output/evidence/wipe-village-dungeon/project-after.json";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const KEEP_ROOT = "map_village_42_64x64";
const DUNGEON = "map_1667ad45-42ea-40f2-9331-67680c0730f5";
const INTERIORS = [
  "map_house_interior_42_map_village_42_64x64_1",
  "map_house_interior_42_map_village_42_64x64_2",
  "map_house_interior_42_map_village_42_64x64_3",
  "map_house_interior_42_map_village_42_64x64_4",
];
const keep = new Set([KEEP_ROOT, DUNGEON, ...INTERIORS]);

const project = JSON.parse(fs.readFileSync(SRC, "utf8")) as Project;
const maps: Project["maps"] = {};
for (const id of keep) {
  if (!project.maps[id]) throw new Error(`missing map ${id}`);
  maps[id] = project.maps[id]!;
}
project.maps = maps;
project.startMapId = KEEP_ROOT;
project.mapTree = {
  mapId: KEEP_ROOT,
  children: [
    ...INTERIORS.map((mapId): MapTreeNode => ({ mapId, children: [] })),
    { mapId: DUNGEON, children: [] },
  ],
};
project.meta = { ...project.meta, title: "이슬 마을과 폐광" };
if (project.system?.titleScreen) {
  project.system = {
    ...project.system,
    titleScreen: { ...project.system.titleScreen, title: "이슬 마을" },
  };
}

const out = "output/evidence/wipe-village-dungeon/project-cleaned.json";
fs.writeFileSync(out, JSON.stringify(project, null, 2) + "\n");
console.log(
  "cleaned",
  Object.values(maps).map((m) => `${m.name} ${m.width}x${m.height} e=${m.events?.length ?? 0}`)
);

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: PROJECT_ID,
};
const saved = await saveProjectToSupabase(project, config);
console.log("saved", saved);
const verify = await loadProjectFromSupabase(config);
console.log("verify", {
  title: verify?.meta?.title,
  start: verify?.startMapId,
  maps: verify
    ? Object.values(verify.maps).map((m) => `${m.name} ${m.width}x${m.height} e=${m.events?.length ?? 0}`)
    : null,
});
if (!verify || Object.keys(verify.maps).length !== 6) process.exit(1);
if (verify.startMapId !== KEEP_ROOT) process.exit(1);
console.log("OK supabase", PROJECT_ID);
