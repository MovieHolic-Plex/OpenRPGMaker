/**
 * 라이브 Supabase 프로젝트의 실내 칩셋 tileMeta를 새 시드(큐레이션 라벨)로 즉시 갱신한다.
 * (에디터는 로드 시 자동 재시드하지만, 열기 전에 미리 반영하는 용도.)
 * 실행: npx tsx scripts/reseed-live-tilemeta.mts
 */
import fs from "node:fs";
import { applyEasyRpgThemeMetadataPacks } from "../src/project/tilesetHarness/themePacks.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const base = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
};

const projectIds = [
  env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
  "rpg-zzu-room-practice",
];

for (const projectId of projectIds) {
  const config = { ...base, projectId };
  const project = await loadProjectFromSupabase(config);
  if (!project) {
    console.log(`${projectId}: 로드 실패 — 건너뜀`);
    continue;
  }
  const tileset = project.tilesets.easyrpg_chipset_interior;
  if (!tileset) {
    console.log(`${projectId}: 실내 타일셋 없음 — 건너뜀`);
    continue;
  }
  const changed = applyEasyRpgThemeMetadataPacks(tileset);
  if (!changed) {
    console.log(`${projectId}: 이미 최신 시드 — 저장 생략`);
    continue;
  }
  const result = await saveProjectToSupabase(project, config);
  console.log(`${projectId}: 재시드 저장 ${result.kind} (예: 타일 72 라벨 = "${tileset.tileMeta?.[72]?.label}")`);
}
