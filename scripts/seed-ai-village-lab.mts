/**
 * 내장 AI 마을 생성 실험 전용 시드: 100x100 빈 초지 맵 1장 + 기본 골격만 Supabase에 업서트.
 * project id: rpg-zzu-ai-village-lab
 * 목적: 에디터 내장 AI 어시스턴트가 빈 맵에서 마을을 얼마나 만들 수 있는지 측정.
 */
import fs from "node:fs";
import { createBlankProject } from "../src/project/defaults/defaultProject.ts";
import { createBlankMap } from "../src/project/defaults/defaultMaps.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";

export const AI_VILLAGE_LAB_PROJECT_ID = "rpg-zzu-ai-village-lab";
const MAP_ID = "map_ai_village_lab_100";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]!]) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: AI_VILLAGE_LAB_PROJECT_ID,
};

const project = createBlankProject();
const map = createBlankMap("AI 실험 마을", 100, 100);
map.id = MAP_ID;
project.maps = { [MAP_ID]: map };
project.mapTree = { mapId: MAP_ID, children: [] };
project.startMapId = MAP_ID;
project.startPos = { x: 50, y: 50 };
project.meta = { ...project.meta, title: "AI 마을 실험", author: "RPG ZZU" };

console.log("seed →", AI_VILLAGE_LAB_PROJECT_ID, "100x100 blank grass");
const saved = await saveProjectToSupabase(project, config);
console.log("saved", saved);
const verify = await loadProjectFromSupabase(config);
const m = verify?.maps[MAP_ID];
console.log("verify", {
  title: verify?.meta?.title,
  maps: verify ? Object.keys(verify.maps).length : 0,
  size: m ? `${m.width}x${m.height}` : null,
  events: m?.events?.length ?? null,
});
if (!m || m.width !== 100 || m.height !== 100) process.exit(1);
console.log("OK seed ready");
