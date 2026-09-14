/**
 * 첫 방문 공용 데모 「큰 강호 장터 마을」을 전용 행(rpg-zzu-first-visit-demo)에 저장한다.
 *
 * 이 행은 모든 첫 방문자가 읽기 전용으로 여는 정본이다 —
 * 클라이언트는 store 의 shared-demo 가드로 이 행에 쓸 수 없고,
 * 내용 갱신은 이 스크립트(스토어 우회)만이 담당한다.
 *
 *   npx tsx scripts/publish-first-visit-demo.mts          # 빌드 + 검증만
 *   npx tsx scripts/publish-first-visit-demo.mts --apply # 저장 + 재로드 일치 검증
 */
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { configFromEnv } from "./supabase-resource-root/supabaseRest.mjs";
import {
  buildLargeRiverMarketVillageProject,
  LARGE_RIVER_MARKET_VILLAGE_MAP_ID,
  LARGE_RIVER_MARKET_VILLAGE_NAME,
} from "../src/editor/content/largeRiverMarketVillageBuild";
import { LargeVillageBuildLog } from "../src/project/defaults/largeVillageBuildLog";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { serialize, serializeForComparison } from "../src/project/io";
import { projectWithoutEventDrafts } from "../src/project/eventDrafts";
import { SHARED_DEMO_PROJECT_ID } from "../src/project/sharedDemoProject";

const base = await configFromEnv();
const config = { url: base.url, anonKey: base.anonKey, projectId: SHARED_DEMO_PROJECT_ID };

const out = "output/evidence/first-visit-demo";
fs.mkdirSync(out, { recursive: true });
const log = new LargeVillageBuildLog(out);

const seed = 42;
const built = buildLargeRiverMarketVillageProject({ seed, log });
assert.ok(built.ok, `Demo build QA failed: ${JSON.stringify(built.qa)}`);

const project = built.project;
const map = project.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID];
assert.ok(map, "village map missing");
assert.equal(map.width, 100);
assert.equal(map.height, 100);
assert.equal(project.meta?.title, LARGE_RIVER_MARKET_VILLAGE_NAME);
assert.equal(project.startMapId, LARGE_RIVER_MARKET_VILLAGE_MAP_ID);
assert.ok(built.npcCount >= 40, `demo must feel alive — npcCount=${built.npcCount}`);
assert.ok(map.events.length >= built.npcCount, "NPC events missing from the map");

fs.writeFileSync(`${out}/preview-project.json`, serialize(project));
const proof = {
  projectId: SHARED_DEMO_PROJECT_ID,
  mapId: LARGE_RIVER_MARKET_VILLAGE_MAP_ID,
  title: project.meta?.title,
  width: map.width,
  height: map.height,
  seed,
  npcCount: built.npcCount,
  shopCounters: built.qa["shopCounters"],
  totalEvents: map.events.length,
  startMapId: project.startMapId,
  projectSHA256: createHash("sha256").update(serialize(project)).digest("hex"),
  buildOk: built.ok,
  verifiedAt: new Date().toISOString(),
};
fs.writeFileSync(`${out}/build-proof.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));

if (process.argv.includes("--apply")) {
  const saved = await saveProjectToSupabase(project, config);
  assert.equal(saved.kind, "saved");
  const reloaded = await loadProjectFromSupabase(config);
  assert.ok(reloaded, "Demo row did not reload");
  // 저장 경로는 이벤트 드래프트를 벗긴다 — 정본 비교는 persisted 형태로 맞춘다.
  assert.equal(
    serializeForComparison(reloaded),
    serializeForComparison(projectWithoutEventDrafts(saved.project ?? project)),
    "Full normalized Supabase readback mismatch",
  );
  fs.writeFileSync(`${out}/reloaded-project.json`, serialize(reloaded));
  fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify({
    ...proof,
    saved: true,
    reloaded: true,
    savedSHA256: saved.sha256,
    reloadedTitle: reloaded.meta?.title,
    reloadedMaps: Object.keys(reloaded.maps).length,
    reloadedNpcEvents: reloaded.maps[LARGE_RIVER_MARKET_VILLAGE_MAP_ID]?.events.length ?? 0,
  }, null, 2));
  console.log(JSON.stringify({ saved: true, reloaded: true, projectId: SHARED_DEMO_PROJECT_ID }));
}
