/**
 * 50×50 하네스 마을 — 맵 전부 지우고 이 맵만 저장.
 * 전용 project_id + gallery 에 기록.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildLargeRiverMarketVillageProject,
  VILLAGE_50_MAP_ID,
  VILLAGE_50_NAME,
} from "../src/editor/content/largeRiverMarketVillageBuild.ts";
import { LargeVillageBuildLog } from "../src/project/defaults/largeVillageBuildLog.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";

export const VILLAGE_50_PROJECT_ID = "rpg-zzu-village-50";
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

const logDir = path.join("output", "evidence", "village-50-harness");
const log = new LargeVillageBuildLog(logDir);

log.step("build", "50×50 하네스 마을 — 전체 맵 삭제 후 단 1장");
const built = buildLargeRiverMarketVillageProject({
  seed: 42,
  log,
  mapW: 50,
  mapH: 50,
  houses: 6,
  npcs: 10,
  mapId: VILLAGE_50_MAP_ID,
  mapName: VILLAGE_50_NAME,
  wipeAllMaps: true,
});

const mapCount = Object.keys(built.project.maps).length;
log.info("wipe-check", `maps=${mapCount}`, {
  mapIds: Object.keys(built.project.maps),
  tree: built.mapTreeIds,
  ok: built.ok,
  houses: built.housesBuilt,
  npcs: built.npcCount,
});

if (!built.ok) {
  log.error("qa-failed-still-saving", built.qa);
}

async function saveAndCheck(projectId: string, label: string) {
  const config = { ...base, projectId };
  log.step(`save-${label}`, `저장 → ${projectId}`);
  const saved = await saveProjectToSupabase(built.project, config);
  log.info("saved", label, saved);
  const verify = await loadProjectFromSupabase(config);
  const m = verify?.maps[VILLAGE_50_MAP_ID];
  const ok =
    verify?.meta?.title === VILLAGE_50_NAME
    && Boolean(m)
    && m!.width === 50
    && m!.height === 50
    && Object.keys(verify!.maps).length === 1;
  log.info("verify", label, {
    ok,
    title: verify?.meta?.title,
    maps: verify ? Object.keys(verify.maps) : null,
    size: m ? { w: m.width, h: m.height } : null,
    start: verify?.startMapId,
  });
  return { projectId, ok, title: verify?.meta?.title, maps: verify ? Object.keys(verify.maps) : [] };
}

const dedicated = await saveAndCheck(VILLAGE_50_PROJECT_ID, "dedicated");
const gallery = await saveAndCheck(GALLERY_PROJECT_ID, "gallery");

await new Promise((r) => setTimeout(r, 3500));
const galleryLater = await loadProjectFromSupabase({ ...base, projectId: GALLERY_PROJECT_ID });
const galleryStillOk =
  galleryLater?.meta?.title === VILLAGE_50_NAME
  && Boolean(galleryLater.maps[VILLAGE_50_MAP_ID])
  && Object.keys(galleryLater.maps).length === 1;
log.info("gallery-after-3.5s", galleryStillOk ? "still-village-50" : "OVERWRITTEN", {
  title: galleryLater?.meta?.title,
  maps: galleryLater ? Object.keys(galleryLater.maps) : null,
});

const handoff = {
  openProjectId: VILLAGE_50_PROJECT_ID,
  title: VILLAGE_50_NAME,
  size: "50x50",
  mapsOnly: [VILLAGE_50_MAP_ID],
  dedicated,
  gallery,
  galleryAfter3_5s: { stillOk: galleryStillOk, title: galleryLater?.meta?.title },
  howTo:
    `1) 에디터 DB 프로젝트 ID = ${VILLAGE_50_PROJECT_ID}\n`
    + "2) 강력 새로고침 (Ctrl+Shift+R)\n"
    + `3) 맵 트리에 「${VILLAGE_50_NAME}」 50×50 한 장만 확인`,
};

fs.writeFileSync(path.join(logDir, "HANDOFF.json"), JSON.stringify(handoff, null, 2), "utf8");
fs.writeFileSync(
  path.join(logDir, "README_OPEN_THIS.txt"),
  [
    "=== 하네스 마을 50 여는 법 ===",
    "",
    `전용 프로젝트 ID: ${VILLAGE_50_PROJECT_ID}`,
    `맵: ${VILLAGE_50_NAME} (50×50) — 다른 맵 없음`,
    "",
    "1. 에디터 상단 DB 연결 클릭",
    `2. 프로젝트 ID = ${VILLAGE_50_PROJECT_ID}`,
    "3. 저장/연결 후 Ctrl+Shift+R",
    "",
    `gallery 3.5초 후: ${galleryStillOk ? "아직 50 마을" : "덮어써짐 → 전용 ID 사용"}`,
    "로그: output/evidence/village-50-harness/build.log",
  ].join("\n"),
  "utf8",
);

log.step("done", "HANDOFF 작성");
console.log("========================================");
console.log("OPEN PROJECT ID:", VILLAGE_50_PROJECT_ID);
console.log("title:", VILLAGE_50_NAME, "50x50 single map");
console.log("dedicated ok=", dedicated.ok, "gallery ok=", gallery.ok, "after3.5s=", galleryStillOk);
console.log("Read:", path.join(logDir, "README_OPEN_THIS.txt"));
console.log("========================================");
