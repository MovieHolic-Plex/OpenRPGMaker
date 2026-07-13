/** 두 라이브 프로젝트의 현재 원격 상태 확인(어느 프로젝트에 뭐가 있는지). */
import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const base = { url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""), anonKey: env.VITE_SUPABASE_ANON_KEY ?? "" };

for (const projectId of ["rpg-zzu-house-template-gallery", "rpg-zzu-room-practice"]) {
  const p = await loadProjectFromSupabase({ ...base, projectId });
  if (!p) {
    console.log(`${projectId}: 로드 실패`);
    continue;
  }
  const ids = Object.keys(p.maps);
  const atelier = p.maps["map_rp_ai_atelier_v1"];
  console.log(`${projectId} | title="${p.meta?.title}" | maps=${ids.length} | atelier=${atelier ? "있음" : "없음"}`);
  if (atelier) {
    let hash = 0;
    for (const t of atelier.lowerTiles) hash = (hash * 31 + t) >>> 0;
    for (const t of atelier.upperTiles) hash = (hash * 31 + t) >>> 0;
    console.log(`   atelier 타일 해시: ${hash} (배치가 바뀌면 이 값이 바뀜)`);
  }
}
