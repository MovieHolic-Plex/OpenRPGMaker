// 엔딩 크레딧 롤 촬영 — 새 게임 첫 맵에서 엔딩 화면을 직접 띄워 크레딧이 도는 동안 1배로 찍는다.
//   node scripts/qa/astra-horizon/ending-probe.mjs <project.json> <outDir>
// 롤은 아래 가장자리에서 들어오고 위 가장자리로 나간다. 보이는 글줄이 안전 영역(마스크가 불투명해지는 구간) 밖에서 잘리면 안 된다.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const ending = project.endings[0];
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:ending", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.evaluate((e) => window.__oprnHooksScene.showEndingScreen(e.name, "등대가 다시 밝아졌다.", e.presentation, e.id), ending);
  await page.waitForSelector("[data-testid='ending-screen']", { timeout: 20000 }); await page.waitForTimeout(2500);
  await shot("0-epilogue");
  await page.waitForSelector(".game-over-hint", { timeout: 20000 });
  for (let i = 0; i < 8 && !(await page.locator(".ending-credits").count()); i++) { await page.waitForTimeout(700); await page.keyboard.press("Enter"); await page.waitForTimeout(700); }
  await page.waitForSelector(".ending-credits", { timeout: 20000 });
  const rollTop = () => page.evaluate(() => document.querySelector(".ending-credits-roll").getBoundingClientRect().top);
  const t0 = Date.now();
  for (const t of [300, 1200, 2500, 4500]) {
    await page.waitForTimeout(Math.max(0, t - (Date.now() - t0)));
    await shot(`1-credits-${t}`);
  }
  // 속도: 1초 동안 읽기 속도, 1초 동안 Enter 를 누르고 있을 때, 뗀 뒤 다시 1초.
  const measure = async (label) => { const a = await rollTop(), t = Date.now(); await page.waitForTimeout(1000); const b = await rollTop(); console.log(label, ((a - b) / ((Date.now() - t) / 1000)).toFixed(1), "px/s"); };
  await measure("normal");
  await page.keyboard.down("Enter"); await page.waitForTimeout(150);
  await measure("held");
  await shot("2-held");
  await page.keyboard.up("Enter"); await page.waitForTimeout(150);
  await measure("released");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  console.log("after Escape: credits", await page.locator(".ending-credits").count(), "ending-screen", await page.locator("[data-testid='ending-screen']").count());
  await shot("3-after-escape");
} finally { await browser.close(); await server.close(); }
