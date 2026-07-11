/**
 * 프로젝트 맵 전부 제거 후 build_village(50×50, 울타리 포함) 시공·저장.
 */
import fs from "node:fs";
import path from "node:path";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

try {
  const existing = await loadProjectFromSupabase(config);
  console.log("[before] maps:", existing ? Object.keys(existing.maps) : null);
  console.log("[before] title:", existing?.meta?.title);
} catch (err) {
  console.warn("[before] load failed, will overwrite:", err);
}

const ctx: { project: Project } = { project: createEmptyToolProject("마을 50x50") };
ctx.project.meta.title = "마을 50x50";

const result = runTool(ctx, "build_village", {
  seed: 7,
  width: 50,
  height: 50,
  name: "마을 50x50",
  fences: true,
  decor: true,
  pathStyle: "sand",
});
if (!result.ok) {
  throw new Error(`build_village failed: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
}

// runTool은 쓰기 성공 시 ctx.project를 draft로 교체한다 — 로컬 바인딩을 다시 잡는다.
const project = ctx.project;

const data = result.data as {
  mapId: string;
  housesBuilt: number;
  fencedHouses?: number;
  fenceTiles?: number;
  doorsConnected: number;
  roadComponents: number;
  npcCount: number;
  interiorCount: number;
};

const map = project.maps[data.mapId];
if (!map) throw new Error(`village map missing: ${data.mapId}`);

// create_map / build_village가 startMapId를 세팅하는지 확인 후 보정
if (!project.startMapId || !project.maps[project.startMapId]) {
  project.startMapId = data.mapId;
  project.startPos = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
}
if (!project.mapTree?.mapId) {
  project.mapTree = { mapId: data.mapId, children: project.mapTree?.children ?? [] };
}

const fenceIds = new Set([378, 379, 380, 408, 409, 410, 438, 439]);
const fenceCount = map.upperTiles.filter((t) => fenceIds.has(t)).length;

console.log("[build]", result.summary);
console.log("[build] data:", data);
console.log("[build] fence upper tiles:", fenceCount);
console.log("[build] maps:", Object.keys(project.maps));
console.log("[build] start:", project.startMapId, project.startPos);

const finalSaved = await saveProjectToSupabase(project, config);
console.log("[rebuild] saved:", finalSaved);

const verify = await loadProjectFromSupabase(config);
console.log("[verify] maps:", verify ? Object.keys(verify.maps) : null);
console.log("[verify] start:", verify?.startMapId, verify?.startPos);
const verifyMap = verify?.maps[data.mapId];
const verifyFence = verifyMap ? verifyMap.upperTiles.filter((t) => fenceIds.has(t)).length : 0;
console.log("[verify] fence tiles:", verifyFence);

const report = {
  ok: true,
  summary: result.summary,
  data,
  fenceCount,
  verifyFence,
  maps: verify ? Object.keys(verify.maps) : [],
  startMapId: verify?.startMapId,
  finalSaved,
  warnings: result.warnings ?? [],
};

const outDir = path.join("output", "evidence", "village-50-fence-rebuild");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("[done]", JSON.stringify(report, null, 2));
