/**
 * 맵 전부 비우고 multi-turn 세션으로 강촌마을 시공·저장.
 * run_village_session: plan→map→settlement→water→forest_conifer→forest_big→critique→look
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

// 완전 wipe — 빈 프로젝트에서 멀티턴 세션으로 강촌만
const ctx: { project: Project } = { project: createEmptyToolProject("강촌마을") };
ctx.project.meta.title = "강촌마을";

const trees = runOk(ctx, "list_village_tree_assets", {});
console.log("[trees]", trees.data);

const sessionRun = runOk(ctx, "run_village_session", {
  theme: "강촌마을",
  query: "강촌마을",
  seed: 202,
  width: 50,
  height: 50,
  mapName: "강촌마을",
  roadWidth: 3,
  settlementLayout: "street-grid",
  budgetTurns: 16,
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
    { name: "농부", lines: ["동쪽 숲 큰 나무 아래에서 쉬어요."] },
    { name: "아낙", lines: ["강가 빨래터가 붐벼."] },
    { name: "나무꾼", lines: ["2그루짜리 큰 나무가 숲에 있어요."] },
  ],
});

const data = sessionRun.data as {
  ok: boolean;
  sessionId: string;
  planId: string;
  mapId: string;
  status: string;
  turnsUsed: number;
  evaluation?: {
    ok: boolean;
    score: number;
    issues: string[];
    metrics: Record<string, number>;
    requirementsMet?: { kind: string; ok: boolean; detail: string }[];
  };
  session: { checklist: { id: string; status: string; lastVerify?: string }[] };
  log: unknown[];
};

console.log("[session] status", data.status, "turns", data.turnsUsed, "map", data.mapId);
console.log("[checklist]", data.session.checklist.map((c) => `${c.id}:${c.status}`).join(" | "));
console.log("[evaluation]", data.evaluation);
console.log("[log turns]", data.log?.length);

// layer verify + look once more
runOk(ctx, "evaluate_village_layer", { sessionId: data.sessionId, layer: "forest_big" });
runOk(ctx, "evaluate_village_layer", { sessionId: data.sessionId, layer: "all" });
const look = runOk(ctx, "evaluate_village_look", {
  mapId: data.mapId,
  planId: data.planId,
});
console.log("[final look]", look.data);

const project = ctx.project;
if (!project.startMapId && data.mapId) project.startMapId = data.mapId;
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
  multiTurn: data,
  look: look.data,
  maps: verify ? Object.keys(verify.maps) : [],
  title: verify?.meta?.title,
  start: { mapId: verify?.startMapId, pos: verify?.startPos },
  saved,
};

const outDir = path.join("output", "evidence", "multi-turn-village");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("[done] wrote", path.join(outDir, "report.json"));
