/**
 * 《이슬 마을의 종》 fixture → Supabase 강제 업서트 + 재로드 검증.
 * 사용: npx tsx scripts/force-save-dew-village.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

export const DEW_VILLAGE_PROJECT_ID = "rpg-zzu-dew-village";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const base = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
};

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/project/defaults/fixtures/dew-village-demo.json"
);
const project = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Project;

const config = { ...base, projectId: DEW_VILLAGE_PROJECT_ID };
console.log(`[dew-village] save → ${DEW_VILLAGE_PROJECT_ID} @ ${config.url}`);
console.log(`[dew-village] title=${project.meta?.title} maps=${Object.keys(project.maps).length}`);

const saved = await saveProjectToSupabase(project, config);
console.log("[dew-village] save result:", saved);

const verify = await loadProjectFromSupabase(config);
const ok =
  verify?.meta?.title === "이슬 마을의 종"
  && Object.keys(verify?.maps ?? {}).length === 2
  && Object.values(verify?.maps ?? {}).some((m) => m.name === "이슬 마을")
  && Object.values(verify?.maps ?? {}).some((m) => m.name === "갈대 언덕");

console.log("[dew-village] verify:", {
  ok,
  title: verify?.meta?.title,
  maps: verify ? Object.keys(verify.maps).map((id) => verify.maps[id]?.name) : null,
  startMapId: verify?.startMapId,
});

if (!ok) {
  console.error("[dew-village] FAILED — Supabase reload mismatch");
  process.exit(1);
}
console.log(`[dew-village] OK — open editor with project id ${DEW_VILLAGE_PROJECT_ID}`);
