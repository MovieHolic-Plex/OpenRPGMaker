/**
 * Phase 4 검증: captureRate 스케일 마이그레이션이 실제 저장 데이터에 적용되는지,
 * 종족 편집이 원격 저장 → 재로드 후에도 유지되는지 확인한다.
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
  console.error("missing supabase config (url/anonKey/projectId)");
  process.exit(2);
}
const config = { url: env.VITE_SUPABASE_URL.replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY, projectId };

const project = await loadProjectFromSupabase(config);
if (!project) {
  console.error(`project not found: ${projectId}`);
  process.exit(2);
}
const species = project.database.monsterSpecies ?? [];
console.log("projectId", projectId, "title", project.meta?.title, "species", species.length);
const rates = species.map((record) => record.captureRate);
console.log("captureRate range", Math.min(...rates), "~", Math.max(...rates));
const overOne = species.filter((record) => record.captureRate > 1);
console.log("captureRate > 1 (마이그레이션 미적용):", overOne.length);
if (overOne.length > 0) process.exit(1);

const target = species[0];
if (!target) {
  console.log("no species to edit — skipping write round trip");
  process.exit(0);
}
const nextRate = target.captureRate === 0.55 ? 0.45 : 0.55;
project.database.monsterSpecies = species.map((record) =>
  record.id === target.id ? normalizeMonsterSpeciesRecord({ ...record, captureRate: nextRate }) : record
);
await saveProjectToSupabase(project, config);
const reloaded = await loadProjectFromSupabase(config);
const after = (reloaded?.database.monsterSpecies ?? []).find((record) => record.id === target.id);
console.log("edited", target.id, target.captureRate, "→", nextRate, "reloaded:", after?.captureRate);
if (after?.captureRate !== nextRate) process.exit(1);
console.log("OK: remote save + reload preserved captureRate");
