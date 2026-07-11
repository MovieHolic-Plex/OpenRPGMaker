/**
 * 마켓 예시 맵을 10×10 빈 공터로 교체·저장 (타일 깔기용).
 */
import fs from "node:fs";
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

// 마켓 작업용: 10×10 잔디 공터 하나만
const ctx: { project: Project } = { project: createEmptyToolProject("마켓 예시") };
ctx.project.meta.title = "마켓 예시 — 10x10 공터";

const mapId = "map_market_reference";
runOk(ctx, "create_map", {
  id: mapId,
  name: "마켓 공터 10x10",
  width: 10,
  height: 10,
  border: "none",
});

ctx.project.startMapId = mapId;
ctx.project.startPos = { x: 5, y: 5 };
ctx.project.mapTree = { mapId, children: [] };

const map = ctx.project.maps[mapId]!;
console.log("[map]", mapId, map.width, "x", map.height, "events", map.events.length);

const saved = await saveProjectToSupabase(ctx.project, config);
console.log("[saved]", saved);

const verify = await loadProjectFromSupabase(config);
const v = verify?.maps[mapId];
console.log("[verify]", verify?.meta?.title, v ? `${v.width}x${v.height}` : null, "start", verify?.startPos);
console.log("[done] 에디터 새로고침 후 타일 깔기");
