// 런타임 이동 정지 프로브 — 방향키를 전부 뗀 뒤 주인공이 혼자 걷지 않는지 출하 경로(player.html)에서 잰다.
//
//   node scripts/qa/probe-runtime-hold-release.mjs
//
// 시나리오마다 키를 뗀 뒤 1.2초 지나 위치를 두 번(0.6초 간격) 읽는다. 두 위치가 다르면 「계속 걷는」 결함이다.
// 고치기 전 실측: [hold+tap] 에서 키를 다 뗀 뒤에도 벽에 닿을 때까지 걸었다(유닛 하네스 15칸).
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__probe/project.json";
const FIXTURE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");

async function boot(browser, serverUrl, projectJson) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript(([projectUrl]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "probe:hold-release", qaInstrumentation: true };
  }, [PROJECT_URL]);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${serverUrl}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug && window.__oprnDebug.readState().currentMapId, null, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  return page;
}

const readPos = async (page) => {
  const s = await page.evaluate(() => window.__oprnDebug.readState());
  return { x: s.x, y: s.y };
};

async function resetTo(page, x, y) {
  await page.evaluate(([x, y]) => {
    window.__oprnDebug.teleport("map_lantern_village", x, y);
    window.__oprnInput.face("down");
  }, [x, y]);
  await page.waitForTimeout(300);
}

async function scenario(page, label, drive) {
  await resetTo(page, 14, 18);
  const start = await readPos(page);
  await drive();
  await page.waitForTimeout(1200);
  const a = await readPos(page);
  await page.waitForTimeout(600);
  const b = await readPos(page);
  const stopped = a.x === b.x && a.y === b.y;
  console.log(`[${label}] start (${start.x},${start.y}) → after release (${a.x},${a.y}) → +600ms (${b.x},${b.y}) : ${stopped ? "STOPPED" : "STILL MOVING"}`);
  return stopped;
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
let allStopped = true;
try {
  const page = await boot(browser, server.url, await readFile(FIXTURE, "utf8"));
  const k = page.keyboard;
  allStopped &&= await scenario(page, "hold 500ms → release", async () => {
    await k.down("ArrowDown"); await page.waitForTimeout(500); await k.up("ArrowDown");
  });
  allStopped &&= await scenario(page, "hold down + tap left mid-walk → release all", async () => {
    await k.down("ArrowDown"); await page.waitForTimeout(250);
    await k.down("ArrowLeft"); await page.waitForTimeout(60); await k.up("ArrowLeft");
    await page.waitForTimeout(200); await k.up("ArrowDown");
  });
  allStopped &&= await scenario(page, "hold down + hold left (diagonal) → release both", async () => {
    await k.down("ArrowDown"); await page.waitForTimeout(250);
    await k.down("ArrowLeft"); await page.waitForTimeout(400);
    await k.up("ArrowLeft"); await k.up("ArrowDown");
  });
  allStopped &&= await scenario(page, "hold down, switch to up mid-walk → release", async () => {
    await k.down("ArrowDown"); await page.waitForTimeout(300);
    await k.down("ArrowUp"); await k.up("ArrowDown"); await page.waitForTimeout(300); await k.up("ArrowUp");
  });
  allStopped &&= await scenario(page, "hold down, tap up 3x mid-walk → release", async () => {
    await k.down("ArrowDown"); await page.waitForTimeout(200);
    for (let i = 0; i < 3; i += 1) { await k.press("ArrowUp"); await page.waitForTimeout(80); }
    await k.up("ArrowDown");
  });
  await page.close();
} finally {
  await browser.close();
  await server.close();
}
console.log(allStopped ? "RESULT: all scenarios stopped after release" : "RESULT: FAIL — hero kept walking after release");
process.exit(allStopped ? 0 : 1);
