/**
 * 대형 마을을 전용 project_id 에 저장 + gallery 에 재저장.
 * 열린 에디터 탭이 gallery(호수 마을)를 autosave 로 덮는 문제를 우회한다.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildLargeRiverMarketVillageProject,
  LARGE_RIVER_MARKET_VILLAGE_MAP_ID,
} from "../src/project/defaults/largeRiverMarketVillageBuild.ts";
import { LargeVillageBuildLog } from "../src/project/defaults/largeVillageBuildLog.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";

/** 열린 탭 autosave 와 충돌하지 않는 전용 ID */
export const LARGE_VILLAGE_PROJECT_ID = "rpg-zzu-large-river-market";
const GALLERY_PROJECT_ID = "rpg-zzu-house-template-gallery";

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

const logDir = path.join("output", "evidence", "large-river-market-village");
const log = new LargeVillageBuildLog(logDir);

log.step("build", "100x100 시공");
const built = buildLargeRiverMarketVillageProject({ seed: 42, log });
if (!built.ok) {
  log.error("qa-failed-still-saving", built.qa);
}

async function saveAndCheck(projectId: string, label: string) {
  const config = { ...base, projectId };
  log.step(`save-${label}`, `저장 → ${projectId}`);
  const saved = await saveProjectToSupabase(built.project, config);
  log.info("saved", label, saved);
  const verify = await loadProjectFromSupabase(config);
  const ok =
    verify?.meta?.title === "큰 강호 장터 마을"
    && Boolean(verify.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID])
    && (verify.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID]?.width ?? 0) === 100;
  log.info("verify", label, {
    ok,
    title: verify?.meta?.title,
    maps: verify ? Object.keys(verify.maps) : null,
    size: verify?.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID]
      ? {
          w: verify.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID]!.width,
          h: verify.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID]!.height,
        }
      : null,
    start: verify?.startMapId,
  });
  return { projectId, ok, title: verify?.meta?.title, maps: verify ? Object.keys(verify.maps) : [] };
}

const dedicated = await saveAndCheck(LARGE_VILLAGE_PROJECT_ID, "dedicated");
const gallery = await saveAndCheck(GALLERY_PROJECT_ID, "gallery");

// gallery 가 3초 뒤 덮였는지 확인 (열린 탭 autosave 증거)
await new Promise((r) => setTimeout(r, 3500));
const galleryLater = await loadProjectFromSupabase({ ...base, projectId: GALLERY_PROJECT_ID });
const galleryStillOk =
  galleryLater?.meta?.title === "큰 강호 장터 마을"
  && Boolean(galleryLater.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID]);
log.info("gallery-after-3.5s", galleryStillOk ? "still-large-village" : "OVERWRITTEN", {
  title: galleryLater?.meta?.title,
  maps: galleryLater ? Object.keys(galleryLater.maps) : null,
});

const handoff = {
  instruction:
    "에디터 DB 설정에서 projectId 를 rpg-zzu-large-river-market 로 바꾼 뒤 재연결/새로고침. "
    + "열려 있는 탭이 gallery 에 호수 마을을 autosave 하면 gallery 는 다시 덮인다.",
  openProjectId: LARGE_VILLAGE_PROJECT_ID,
  dedicated,
  gallery,
  galleryAfter3_5s: {
    stillOk: galleryStillOk,
    title: galleryLater?.meta?.title,
    maps: galleryLater ? Object.keys(galleryLater.maps) : null,
  },
  howTo:
    "1) 에디터 상단 DB 연결 칩 클릭 → 프로젝트 ID에 rpg-zzu-large-river-market 입력 → 저장/연결\n"
    + "2) 페이지 새로고침\n"
    + "3) 맵 트리에 「큰 강호 장터 마을」 100x100 확인",
};

fs.writeFileSync(path.join(logDir, "HANDOFF.json"), JSON.stringify(handoff, null, 2), "utf8");
fs.writeFileSync(
  path.join(logDir, "README_OPEN_THIS.txt"),
  [
    "=== 큰 강호 장터 마을 여는 법 ===",
    "",
    "원인: 브라우저에 열린 에디터가 「호수 마을」을 몇 초마다 gallery 프로젝트에 자동저장해서",
    "      스크립트가 올린 100x100 맵을 계속 덮어씀.",
    "",
    `전용 프로젝트 ID (이걸 열 것): ${LARGE_VILLAGE_PROJECT_ID}`,
    "",
    "1. 에디터 상단 DB 연결 상태 클릭",
    `2. 프로젝트 ID = ${LARGE_VILLAGE_PROJECT_ID}`,
    "3. 저장/연결 후 강력 새로고침 (Ctrl+Shift+R)",
    "4. 맵 이름: 큰 강호 장터 마을 / 100x100",
    "",
    `gallery 3.5초 후 상태: ${galleryStillOk ? "아직 대형 마을" : "덮어써짐 → 전용 ID 쓸 것"}`,
    `gallery title now: ${galleryLater?.meta?.title ?? "?"}`,
    "",
    "로그: output/evidence/large-river-market-village/build.log",
  ].join("\n"),
  "utf8",
);

log.step("done", "HANDOFF.json + README_OPEN_THIS.txt 작성");
console.log("\n========================================");
console.log(`OPEN PROJECT ID: ${LARGE_VILLAGE_PROJECT_ID}`);
console.log(`dedicated ok=${dedicated.ok}`);
console.log(`gallery ok=${gallery.ok} after3.5s stillOk=${galleryStillOk} title=${galleryLater?.meta?.title}`);
console.log(`Read: ${path.join(logDir, "README_OPEN_THIS.txt")}`);
console.log("========================================\n");

if (!dedicated.ok) process.exitCode = 1;
