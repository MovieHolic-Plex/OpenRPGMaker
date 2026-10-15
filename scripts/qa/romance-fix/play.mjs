// 감사 프로브: 출하 플레이어에서 연애 게임 대화 장면·타이틀을 캡처한다.
//   node scripts/qa/audit-romance/play.mjs <project.json> <outDir> <mapId> <x> <y> <facing> [more...]
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg, mapId, xs, ys] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:romance", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const shot = (n) => page.screenshot({ path: join(out, `${n}.png`) });
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1500); await shot("title");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 40; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  await page.waitForTimeout(800); await shot("start");
  await page.evaluate(([a, b, c]) => window.__oprnDebug.teleport(a, b, c), [mapId, Number(xs), Number(ys)]);
  await page.waitForTimeout(1200); await shot("near");
  const face = process.argv[7] ?? "up";
  await page.evaluate((d) => window.__oprnInput.dir(d), face); await page.waitForTimeout(80); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(300);
  await page.keyboard.press("Enter"); await page.waitForTimeout(1200); await shot("talk1");
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(700); await shot("talk" + (i + 2)); }
} catch (e) { errors.push("script:" + e.message); }
finally { console.log(JSON.stringify({ errors })); await browser.close(); await server.close(); }
