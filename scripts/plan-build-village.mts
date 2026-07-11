/**
 * 에디터 툴 전체 파이프라인:
 * plan → build → spec → evaluate → (실패 시 revise → wipe → rebuild)
 * 맵 전부 비우고 저장.
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

function runOk(ctx: { project: Project }, name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(`${name} failed: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`);
  }
  console.log(`[ok] ${name}: ${result.summary}`);
  return result;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

try {
  const before = await loadProjectFromSupabase(config);
  console.log("[before] maps:", before ? Object.keys(before.maps) : null);
} catch (err) {
  console.warn("[before] load skip:", err);
}

// 완전 새 초안 (맵 없음)
const ctx: { project: Project } = { project: createEmptyToolProject("어촌 장터 마을") };
// 완전 초기화 후 강촌마을 (C 시공 + E 지형 마스크 패스)
ctx.project.meta.title = "강촌마을";

const pipeline = runOk(ctx, "run_village_pipeline", {
  maxAttempts: 2,
  theme: "강촌마을",
  query: "강촌마을",
  seed: 101,
  width: 50,
  height: 50,
  mapName: "강촌마을",
  roadWidth: 3,
  settlementLayout: "street-grid",
  houses: [
    { kitId: "blue-stone", yard: ["mailbox", "flowers"], ownerName: "촌장" },
    { kitId: "bright-plaster", yard: ["firewood", "pot"], ownerName: "농부" },
    { kitId: "blue-stone", yard: ["jar"], ownerName: "아낙" },
    { kitId: "bright-plaster", yard: ["wood_box"], ownerName: "나무꾼" },
    { kitId: "blue-stone", yard: ["bench_h", "flowers"], ownerName: "아이" },
    { kitId: "bright-plaster", yard: ["sign"], ownerName: "나그네" },
  ],
  npcs: [
    { name: "촌장", lines: ["강물이 맑아야 마을이 산다."] },
    { name: "농부", lines: ["동쪽 숲에서 버섯을 캐요."] },
    { name: "아낙", lines: ["강가 빨래터가 붐벼."] },
    { name: "나무꾼", lines: ["숲길이 촉촉하다."] },
  ],
});

const data = pipeline.data as {
  ok: boolean;
  planId: string;
  mapId: string;
  attempt: number;
  evaluation: { ok: boolean; score: number; issues: string[]; feedbackForLlm: string; metrics: Record<string, number> };
  build: { housesBuilt: number; pathStyle: string; decorPlaced: number; doorsConnected: number };
  log: unknown[];
};

console.log("[pipeline] ok", data.ok, "attempt", data.attempt, "plan", data.planId, "map", data.mapId);
console.log("[evaluation]", data.evaluation);
console.log("[build]", data.build);

// 명시 critique + look 한 번 더 (툴 경로 검증)
runOk(ctx, "critique_village", {
  mapId: data.mapId,
  doorFronts: ((data.build as { houses?: { front: { x: number; y: number } }[] }).houses ?? []).map((h) => h.front),
});
runOk(ctx, "evaluate_village_look", {
  mapId: data.mapId,
  planId: data.planId,
  attempt: data.attempt,
});

const project = ctx.project;
if (!project.startMapId && data.mapId) {
  project.startMapId = data.mapId;
}
if (!project.mapTree?.mapId && data.mapId) {
  project.mapTree = { mapId: data.mapId, children: project.mapTree?.children ?? [] };
}

const saved = await saveProjectToSupabase(project, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
console.log("[verify] maps", verify ? Object.keys(verify.maps) : null);
console.log("[verify] title", verify?.meta?.title);
console.log("[verify] start", verify?.startMapId, verify?.startPos);

const report = {
  pipeline: data,
  maps: verify ? Object.keys(verify.maps) : [],
  title: verify?.meta?.title,
  start: { mapId: verify?.startMapId, pos: verify?.startPos },
  saved,
};

const outDir = path.join("output", "evidence", "plan-build-village");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("[done] wrote", path.join(outDir, "report.json"));
