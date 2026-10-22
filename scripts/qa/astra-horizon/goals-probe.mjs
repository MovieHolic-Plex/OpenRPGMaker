// 배지·목표 페이지 촬영 — 목록 줄이 말줄임(…) 없이 읽히는지 확인한다.
//   node scripts/qa/astra-horizon/goals-probe.mjs <project.json> <outDir>
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg, sizeArg] = process.argv.slice(2);
const size = Number(sizeArg ?? 4);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:goals", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  let quiet = 0;
  for (let i = 0; i < 200 && quiet < 5; i++) { const busy = (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("runtime-choices")) || (await present("title-screen")); quiet = busy ? 0 : quiet + 1; await page.keyboard.press("Enter"); await page.waitForTimeout(350); }
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape"); await page.waitForTimeout(900);
  const entries = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='status-menu-command-']")].map((n) => n.dataset.testid).filter((t) => !/rail|icon/.test(t)));
  const idx = entries.findIndex((t) => /campaign-progress/.test(t));
  console.log("entries", JSON.stringify(entries), "idx", idx);
  for (let i = 0; i < idx; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(150); }
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  await shot("goals");
  console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".status-menu-detail-row")].map((r) => [...r.children].map((c) => ({ t: c.textContent.trim().slice(0, 60), clip: c.scrollWidth > c.clientWidth + 1 }))))));
} finally { await browser.close(); await server.close(); }
