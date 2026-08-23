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

// `.env.local` 이 우선이고 모자라는 것은 `.env` 에서 보춘다 — Supabase URL/anon key 는
// 이 레포에서 `.env` 에 산다(2026-08-23 실측). `.env.local` 만 읽으면 undefined 에서 토한다.
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]!]) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 .env.local · .env 에 없습니다");
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
// 재로드 검증은 **픽스처 자신**과 대조한다. 이전에는 "이슬 마을의 종" 2맵을 박아 둥는데,
// 픽스처가 《이슬 장터 — 30분》(16맵)으로 교체된 뒤로는 저장이 성공해도 항상 FAILED 를
// 찍었다(2026-08-23 실측). 고정 문자열 대슸 픽스처 ↔ 재로드 일치를 볼수 있게 바꿄다.
const expectedMapIds = Object.keys(project.maps).sort();
const actualMapIds = Object.keys(verify?.maps ?? {}).sort();
const ok =
  verify?.meta?.title === project.meta?.title
  && actualMapIds.length === expectedMapIds.length
  && actualMapIds.every((id, index) => id === expectedMapIds[index]);

console.log("[dew-village] verify:", {
  ok,
  title: verify?.meta?.title,
  maps: actualMapIds.length,
  missing: expectedMapIds.filter((id) => !actualMapIds.includes(id)),
  startMapId: verify?.startMapId,
});

if (!ok) {
  console.error("[dew-village] FAILED — Supabase reload mismatch");
  process.exit(1);
}
console.log(`[dew-village] OK — open editor with project id ${DEW_VILLAGE_PROJECT_ID}`);
