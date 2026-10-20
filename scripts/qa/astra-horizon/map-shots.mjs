// 맵 1배 사진: POINTS 지점으로 가 480×320 으로 찍는다.
//   node town-shot.mjs <project.json> <outDir> [mapId ...]   (unshare -rn 안에서)
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outDir, ...maps] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:town", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 60; i++) { if (!(await page.locator('[data-testid="cinematic-sequence"],[data-testid="dialogue-box"]').count())) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  // POINTS="x,y;x,y" — 각 지점으로 순간이동해 1배로 찍는다. 첫 인자 맵 하나.
  const mapId = maps[0];
  const pts = (process.env.POINTS ?? "12,16").split(";").map((p) => p.split(",").map(Number));
  for (const [x, y] of pts) {
    await page.evaluate(([mm, xx, yy]) => window.__oprnDebug.teleport(mm, xx, yy), [mapId, x, y]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(outDir, `${mapId}-${x}-${y}.png`) });
    console.log(mapId, x, y);
  }
} finally { await browser.close(); await server.close(); }
