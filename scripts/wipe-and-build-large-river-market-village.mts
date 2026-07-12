/**
 * 맵 전부 제거 후 100×100 강·호수·장터 마을 시공·저장.
 * 로그: output/evidence/large-river-market-village/build.log + build.jsonl + report.json + ascii *.txt
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildLargeRiverMarketVillageProject,
  LARGE_RIVER_MARKET_VILLAGE_MAP_ID,
} from "../src/project/defaults/largeRiverMarketVillageBuild.ts";
import { LargeVillageBuildLog } from "../src/project/defaults/largeVillageBuildLog.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { collectMapIdsInTree } from "../src/editor/mapTreeActions.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};

const log = new LargeVillageBuildLog(path.join("output", "evidence", "large-river-market-village"));
log.step("supabase-before", "기존 프로젝트 로드");
try {
  const existing = await loadProjectFromSupabase(config);
  log.info("before", "loaded", {
    title: existing?.meta?.title,
    maps: existing ? Object.keys(existing.maps) : null,
    tree: existing ? [...collectMapIdsInTree(existing.mapTree)] : null,
  });
} catch (err) {
  log.warn("before-load-failed", { err: err instanceof Error ? err.message : String(err) });
}

log.step("build", "한 패스 시공 시작");
const built = buildLargeRiverMarketVillageProject({ seed: 42, log });

log.step("save", "Supabase 저장", { ok: built.ok });
if (!built.ok) {
  log.error("refuse-save-qa-failed", built.qa);
  // 그래도 사용자가 볼 수 있게 저장은 하되 exit code 실패
  log.warn("saving-despite-qa-fail", "디버깅용으로 저장은 진행");
}

const saved = await saveProjectToSupabase(built.project, config);
log.info("saved", JSON.stringify(saved));

log.step("verify", "재로드 검증");
const verify = await loadProjectFromSupabase(config);
const vMap = verify?.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID];
const vNpcs = vMap?.events.filter((e) => {
  const g = e.pages[0]?.graphic;
  return Boolean(g && !g.transparent && g.sprite);
}).length ?? 0;

const verifyReport = {
  reloaded: Boolean(verify),
  maps: verify ? Object.keys(verify.maps) : [],
  size: vMap ? { w: vMap.width, h: vMap.height } : null,
  housesBuilt: built.housesBuilt,
  visibleNpcs: vNpcs,
  shopCounters: built.shopCounters,
  fisher: built.fisher,
  startPos: verify?.startPos,
  titleResourceId: verify?.system?.titleResourceId,
  buildOk: built.ok,
  qa: built.qa,
  saved,
};

fs.writeFileSync(
  path.join(log.outDir, "verify.json"),
  JSON.stringify(verifyReport, null, 2),
  "utf8",
);
log.info("verify-written", "verify.json", verifyReport);

// final report already written by build; append save status
const reportPath = path.join(log.outDir, "report.json");
if (fs.existsSync(reportPath)) {
  const prev = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
  prev.verify = verifyReport;
  prev.saved = saved;
  fs.writeFileSync(reportPath, JSON.stringify(prev, null, 2), "utf8");
}

log.step("done", `로그 디렉터리: ${log.outDir}`);
console.log("\n=== LOG FILES ===");
console.log(path.join(log.outDir, "build.log"));
console.log(path.join(log.outDir, "build.jsonl"));
console.log(path.join(log.outDir, "report.json"));
console.log(path.join(log.outDir, "verify.json"));
console.log(path.join(log.outDir, "01-after-water.txt"));
console.log(path.join(log.outDir, "02-after-village.txt"));
console.log(path.join(log.outDir, "03-after-roads.txt"));
console.log(path.join(log.outDir, "04-after-market.txt"));
console.log(path.join(log.outDir, "05-final-overview.txt"));
console.log(path.join(log.outDir, "05-final-village.txt"));

if (!built.ok) process.exitCode = 1;
