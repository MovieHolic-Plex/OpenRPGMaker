/**
 * captureRate 1.0 잔재 복구. 저장된 종족은 0~100 스케일(40)로 저작됐으나 구 clamp(0,1)가
 * 로드 때마다 1.0 으로 뭉갠 뒤 그대로 저장돼, 마이그레이션만으로는 되살릴 수 없다.
 * 출하 기본값과 같은 0.4 로 복구한다(원래 저작 의도값 40/100).
 */
import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { normalizeMonsterSpeciesRecord } from "../src/project/monsterCollection.ts";

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(path)) return env;
  for (const line of fs.readFileSync(path, "utf8").split(/\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const projectId = process.argv[2] ?? env.VITE_SUPABASE_PROJECT_ID ?? env.PROJECT_ID;
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !projectId) {
  console.error("missing supabase config");
  process.exit(2);
}
const config = { url: env.VITE_SUPABASE_URL.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY, projectId };

const project = await loadProjectFromSupabase(config);
if (!project) {
  console.error(`project not found: ${projectId}`);
  process.exit(2);
}
const species = project.database.monsterSpecies ?? [];
const repaired = species.map((record) =>
  record.captureRate >= 1 ? normalizeMonsterSpeciesRecord({ ...record, captureRate: 0.4 }) : record
);
const changed = repaired.filter((record, index) => record.captureRate !== species[index]?.captureRate).length;
console.log("species", species.length, "repaired", changed);
project.database.monsterSpecies = repaired;
await saveProjectToSupabase(project, config);
const reloaded = await loadProjectFromSupabase(config);
const after = reloaded?.database.monsterSpecies ?? [];
const rates = after.map((record) => record.captureRate);
console.log("reloaded captureRate range", Math.min(...rates), "~", Math.max(...rates));
if (rates.some((rate) => rate >= 1)) process.exit(1);
console.log("OK: 저장·재로드 후 모든 종족 captureRate < 1");
