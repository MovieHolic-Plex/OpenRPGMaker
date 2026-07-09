/**
 * build_castle 툴로 성채2 맵을 만들고 Supabase에 저장.
 */
import fs from "node:fs";
import path from "node:path";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { CASTLE_ROOF, CASTLE_WALL, CASTLE_ROUND_TOWER } from "../src/editor/castleKit.ts";
import type { Project } from "../src/project/types.ts";

const MAP_ID = "map_castle_keep_2";
const MAP_NAME = "성채2";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>): string {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(`${name}: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  }
  return result.summary;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("load failed");

// 기존 성채2가 있으면 교체
if (project.maps[MAP_ID]) {
  delete project.maps[MAP_ID];
  // mapTree에서 제거
  const strip = (node: { mapId: string; children?: typeof node[] }): typeof node => ({
    mapId: node.mapId,
    children: (node.children ?? []).filter((c) => c.mapId !== MAP_ID).map(strip),
  });
  if (project.mapTree.mapId === MAP_ID) {
    const kids = (project.mapTree.children ?? []).filter((c) => c.mapId !== MAP_ID);
    project.mapTree = kids[0]
      ? { mapId: kids[0].mapId, children: [...(kids[0].children ?? []), ...kids.slice(1)] }
      : { mapId: Object.keys(project.maps)[0] ?? MAP_ID, children: [] };
  } else {
    project.mapTree = strip(project.mapTree);
  }
}

const ctx = { project };
const summary = runOk(ctx, "build_castle", {
  id: MAP_ID,
  name: MAP_NAME,
  width: 48,
  height: 40,
  wallHeight: 3,
  gateWidth: 4,
  roundTower: true,
  roundTowerHeight: 7,
  path: true,
  npcs: true,
  seed: 20260710,
});
console.log(summary);

const map = ctx.project.maps[MAP_ID]!;
const counts = {
  roof: 0,
  wall: 0,
  towerBody: 0,
  towerWindow: 0,
  towerCapUpper: 0,
};
const roofSet = new Set(Object.values(CASTLE_ROOF));
const wallSet = new Set(Object.values(CASTLE_WALL));
for (const t of map.lowerTiles) {
  if (roofSet.has(t as (typeof CASTLE_ROOF)[keyof typeof CASTLE_ROOF])) counts.roof += 1;
  if (wallSet.has(t as (typeof CASTLE_WALL)[keyof typeof CASTLE_WALL])) counts.wall += 1;
  if (t === CASTLE_ROUND_TOWER.BODY_L || t === CASTLE_ROUND_TOWER.BODY_R) counts.towerBody += 1;
  if (t === CASTLE_ROUND_TOWER.WIN_L || t === CASTLE_ROUND_TOWER.WIN_R) counts.towerWindow += 1;
}
for (const t of map.upperTiles) {
  if (t === CASTLE_ROUND_TOWER.CAP_L || t === CASTLE_ROUND_TOWER.CAP_R || t === CASTLE_ROUND_TOWER.BASE_L || t === CASTLE_ROUND_TOWER.BASE_R) {
    counts.towerCapUpper += 1;
  }
}

const saved = await saveProjectToSupabase(ctx.project, config);
const report = {
  summary,
  map: { id: MAP_ID, name: MAP_NAME, size: `${map.width}x${map.height}`, events: map.events.length },
  counts,
  saved,
  startUnchanged: { mapId: ctx.project.startMapId, pos: ctx.project.startPos },
};
const outDir = path.join("output", "evidence", "castle-2");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("[done] 성채2", MAP_ID);
