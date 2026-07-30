/**
 * 얼음 대평원 64×64 → Supabase 강제 업서트 + 재로드 검증.
 * 사용: npx tsx scripts/force-save-ice-plain-64.mts
 *
 * `?devProject=1&icePlain64=1` 쇼케이스 경로는 `dev-showcase` 세션이라
 * `remotePersistenceEnabled = false` 다 — 그 경로로는 Supabase 에 저장되지 않는다.
 * 저작물의 정본은 Supabase 프로젝트 행이므로 이 스크립트가 원격 저장 경로를 직접 탄다.
 */
import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { createIcePlain64Project } from "../src/project/defaults/defaultProject.ts";
import {
  BANNED_WATER_TILES, CLIFF_LIP, ICE_PLAIN_MAP_ID, ICE_PLAIN_MAP_NAME, ICE_PLAIN_START, buildIcePlainTerrain,
} from "../src/project/defaults/iceGrandPlain64.ts";

export const ICE_PLAIN_PROJECT_ID = "rpg-zzu-ice-plain-64";

function loadEnv(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey || anonKey.startsWith("replace-with")) {
  console.error("[ice-plain-64] Supabase URL / anon key 없음 — 저장을 진행하지 않는다.");
  process.exit(1);
}

const config = { url, anonKey, projectId: ICE_PLAIN_PROJECT_ID };
const project = createIcePlain64Project();
const terrain = buildIcePlainTerrain();
const iceCells = [...terrain.iceMask].filter((cell) => cell === 1).length;
const lipCells = terrain.lowerTiles.filter((tile) => tile === CLIFF_LIP).length;

console.log(`[ice-plain-64] save → ${ICE_PLAIN_PROJECT_ID} @ ${url}`);
console.log(`[ice-plain-64] title=${project.meta?.title} maps=${Object.keys(project.maps).length} ice=${iceCells} lip343=${lipCells}`);

const saved = await saveProjectToSupabase(project, config);
console.log("[ice-plain-64] save result:", saved);

const verify = await loadProjectFromSupabase(config);
const map = verify?.maps?.[ICE_PLAIN_MAP_ID];
const reloadedLip = (map?.lowerTiles ?? []).filter((tile) => tile === CLIFF_LIP).length;
const reloadedWater = (map?.lowerTiles ?? []).filter((tile) => (BANNED_WATER_TILES as readonly number[]).includes(tile)).length;
const checks = {
  title: verify?.meta?.title === ICE_PLAIN_MAP_NAME,
  mapPresent: map !== undefined,
  size: map?.width === 64 && map?.height === 64,
  startPos: verify?.startPos?.x === ICE_PLAIN_START.x && verify?.startPos?.y === ICE_PLAIN_START.y,
  // 저장 직전 빌드와 재로드 결과의 립 칸 수가 같아야 원격 행이 이 판이라는 뜻이다.
  lipTiles: reloadedLip === lipCells,
  // 물은 한 칸도 없어야 한다(감독 지시).
  noWater: reloadedWater === 0,
};
const ok = Object.values(checks).every((value) => value === true);
console.log("[ice-plain-64] verify:", { ok, ...checks, reloadedLip, expectedLip: lipCells, reloadedWater });

if (!ok) {
  console.error("[ice-plain-64] FAILED — Supabase 재로드 불일치");
  process.exit(1);
}
console.log(`[ice-plain-64] OK — project id ${ICE_PLAIN_PROJECT_ID}`);
