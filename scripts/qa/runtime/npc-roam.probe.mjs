// NPC 배회 런타임 QA — 출하 player.html 에서 place_npc 로 놓은 NPC 가 실제로 칸을 옮기는지 본다.
//
//   npx vite-node scripts/qa/runtime/npc-roam.fixture.mts   # 픽스처 먼저
//   node scripts/qa/runtime/npc-roam.probe.mjs
//
// 판정 관측: __oprnCharacterSprites().events[id] 의 스프라이트 픽셀 좌표를 칸으로 환산한 값.
//
// 왜 eventLocations 가 아니라 이쪽인가 (2026-10-05 실측): session.eventLocations 는
// 일정·생활 이동 NPC 의 위치만 담는다. 페이지 자율 이동(random/approach) 무버는
// eventPositions 로 가므로 moveAutonomousRuntimePosition 이 session.eventLocations 를 안 건드린다 —
// 그래서 readState().eventLocations[id] 가 전부 null 이었는데도 스프라이트는 움직이고 있었다.
// 실제 화면에 그려지는 스프라이트 좌표가 이 기준의 진짜 관측면이다.
//
//   roam_a/roam_b/roam_c — 서로 다른 칸 2개 이상
//   stay_a/stay_b        — 정확히 1칸
// eventLocations 는 진단용으로 함께 기록한다(비어 있음이 정상).
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = join(REPO_ROOT, "verify-shots/npc-roam");
const FIXTURE = join(OUT, "fixture.json");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";
const ROAM_IDS = ["roam_a", "roam_b", "roam_c"];
const STAY_IDS = ["stay_a", "stay_b"];
const ALL_IDS = [...ROAM_IDS, ...STAY_IDS];
const POLL_MS = 10_000;
const POLL_INTERVAL_MS = 100;

const projectJson = await readFile(FIXTURE, "utf8");
const project = JSON.parse(projectJson);
const startMapId = project.startMapId;
await mkdir(OUT, { recursive: true });

const server = await startPlayerQaServer();
let browser;
let exitCode = 1;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  await page.setViewportSize({ width: 960, height: 720 });
  // vite dev 는 player.html 전 그래프를 변환한다 — 기본 30s goto 타임아웃은 부하에서 모자란다.
  page.setDefaultNavigationTimeout(180_000);
  page.setDefaultTimeout(180_000);
  await page.addInitScript((projectUrl) => {
    try { localStorage.clear(); } catch { /* 접근 불가 환경 */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "runtime-qa:npc-roam", qaInstrumentation: true };
  }, PROJECT_URL);
  await page.route(PROJECT_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  try {
    // 타이틀이 뜨면 Enter 로 넘기고, 타이틀 없이 바로 필드로 들어가는 프로젝트도 받는다.
    const boot = await page.waitForFunction(() => {
      if (document.querySelector("[data-testid='title-screen']")) return "title";
      return window.__oprnDebug?.readState?.().currentMapId ? "field" : false;
    }, undefined, { timeout: 180_000 });
    const reached = await boot.jsonValue();
    console.log(`BOOT reached=${reached}`);
    if (reached === "title") await page.keyboard.press("Enter");
    await page.waitForFunction(() => Boolean(window.__oprnDebug?.readState?.().currentMapId), undefined, { timeout: 120_000 });
  } catch (error) {
    await page.screenshot({ path: join(OUT, "boot-failure.png") }).catch(() => {});
    await writeFile(join(OUT, "boot-failure.json"), `${JSON.stringify({ message: String(error?.message ?? error), errors,
      testids: await page.evaluate(() => [...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid)).catch(() => null),
      body: await page.evaluate(() => document.body?.innerText?.slice(0, 2000)).catch(() => null) }, null, 2)}\n`);
    console.log(`BOOT_FAIL ${String(error?.message ?? error).split("\n")[0]}; errors=${errors.length}: ${errors.slice(0, 5).join(" | ")}`);
    throw error;
  }

  const samples = [];
  const seen = Object.fromEntries(ALL_IDS.map((id) => [id, new Set()]));
  const seenLocations = Object.fromEntries(ALL_IDS.map((id) => [id, new Set()]));
  const mapIds = new Set();
  const started = Date.now();
  while (Date.now() - started < POLL_MS) {
    const sample = await page.evaluate((ids) => {
      const state = window.__oprnDebug.readState();
      const sprites = window.__oprnCharacterSprites ? window.__oprnCharacterSprites() : null;
      const tile = window.__oprnCamera?.()?.tileSize ?? 16;
      const out = { t: performance.now(), currentMapId: state.currentMapId, player: { x: state.x, y: state.y }, eventLocations: {}, spriteTiles: {} };
      for (const id of ids) {
        out.eventLocations[id] = state.eventLocations?.[id] ?? null;
        const s = sprites?.events?.[id];
        out.spriteTiles[id] = s ? { px: s.x, py: s.y, tx: Math.floor(s.x / tile), ty: Math.floor((s.y - 1) / tile) } : null;
      }
      return out;
    }, ALL_IDS);
    samples.push(sample);
    mapIds.add(sample.currentMapId);
    for (const id of ALL_IDS) {
      const sp = sample.spriteTiles[id];
      if (sp) seen[id].add(`${sp.tx},${sp.ty}`);
      const loc = sample.eventLocations[id];
      if (loc) seenLocations[id].add(`${loc.x},${loc.y}`);
    }
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }

  await page.screenshot({ path: join(OUT, "runtime.png") });
  await writeFile(join(OUT, "samples.json"), `${JSON.stringify({
    startMapId,
    mapIdsSeen: [...mapIds],
    distinctSpriteTiles: Object.fromEntries(ALL_IDS.map((id) => [id, [...seen[id]]])),
    distinctEventLocations: Object.fromEntries(ALL_IDS.map((id) => [id, [...seenLocations[id]]])),
    pageErrors: errors,
    samples,
  }, null, 2)}\n`, "utf8");

  const onStartMap = mapIds.size === 1 && mapIds.has(startMapId);
  console.log(`MAP currentMapId=${[...mapIds].join("|")} expected=${startMapId} ${onStartMap ? "PASS" : "FAIL"}`);
  console.log(`SAMPLES ${samples.length} over ${POLL_MS}ms`);
  const failed = [];
  for (const id of ALL_IDS) {
    const n = seen[id].size;
    const ok = ROAM_IDS.includes(id) ? n >= 2 : n === 1;
    if (!ok) failed.push(id);
    console.log(`RESULT ${id} distinctSpriteTiles=${n} ${ok ? "PASS" : "FAIL"}  (eventLocations=${seenLocations[id].size}: ${[...seenLocations[id]].join(" ")})`);
  }
  if (!onStartMap) failed.push("currentMapId");
  if (errors.length) console.log(`PAGE_ERRORS ${errors.length}: ${errors.slice(0, 3).join(" | ")}`);
  console.log(failed.length === 0 ? "PROBE_RESULT PASS" : `PROBE_RESULT FAIL ${failed.join(",")}`);
  exitCode = failed.length === 0 ? 0 : 1;
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
    console.log(`CLEANUP browser and server closed (port ${server.port})`);
  }
}
process.exit(exitCode);
