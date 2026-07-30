/**
 * AI 가 배치한 NPC 이벤트를 Supabase 에 업서트 + 재로드 검증한다.
 * 사용: npx tsx scripts/force-save-ai-npc-events.mts
 *
 * `?devProject=1&icePlain64=1` 쇼케이스 경로는 `dev-showcase` 세션이라
 * `remotePersistenceEnabled = false` 다 — 브라우저에서 AI 로 배치한 결과는 원격에 저장되지 않는다.
 * 그래서 e2e 가 남긴 events.json 을 읽어 기준 프로젝트에 병합하고 원격 저장 경로를 직접 탄다.
 */
import fs from "node:fs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { createIcePlain64Project } from "../src/project/defaults/defaultProject.ts";
import { ICE_PLAIN_MAP_ID } from "../src/project/defaults/iceGrandPlain64.ts";
import type { GameEvent } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-ai-npc-proof";
const EVENTS_FILE = "tmp/ai-npc-proof/events.json";

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
if (!url || !anonKey) throw new Error("Supabase 설정 없음 — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 확인");

if (!fs.existsSync(EVENTS_FILE)) throw new Error(`${EVENTS_FILE} 없음 — e2e 를 먼저 돌리세요`);
const events = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf8")) as GameEvent[];
if (events.length === 0) throw new Error("events.json 이 비어 있습니다 — 배치가 실패했습니다");

const project = createIcePlain64Project();
const map = project.maps[ICE_PLAIN_MAP_ID];
if (!map) throw new Error(`맵 없음: ${ICE_PLAIN_MAP_ID}`);
project.maps[ICE_PLAIN_MAP_ID] = { ...map, events };

const shopEvents = events.filter((event) =>
  (event.pages ?? []).some((page) => (page.commands ?? []).some((command) => command.kind === "shop"))
).length;
const withPages = events.filter((event) => (event.pages ?? []).length > 0).length;
console.log(`[ai-npc] 저장할 이벤트 ${events.length}개 · 대사 페이지 보유 ${withPages}개 · 상점 ${shopEvents}개`);

const config = { url, anonKey, projectId: PROJECT_ID };
const saved = await saveProjectToSupabase(project, config);
console.log("[ai-npc] save result:", saved);

const reloaded = await loadProjectFromSupabase(config);
const reloadedEvents = reloaded?.maps?.[ICE_PLAIN_MAP_ID]?.events ?? [];
const reloadedShop = reloadedEvents.filter((event) =>
  (event.pages ?? []).some((page) => (page.commands ?? []).some((command) => command.kind === "shop"))
).length;

const checks = {
  mapPresent: reloadedEvents.length > 0,
  eventCount: reloadedEvents.length === events.length,
  everyEventHasPages: reloadedEvents.every((event) => (event.pages ?? []).length > 0),
  shopPreserved: reloadedShop === shopEvents,
};
const ok = Object.values(checks).every(Boolean);
console.log("[ai-npc] verify:", { ok, ...checks, reloadedEvents: reloadedEvents.length, reloadedShop });
if (!ok) throw new Error("재로드 검증 실패");
console.log(`[ai-npc] OK — project id ${PROJECT_ID}`);
