import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg, mapId, xs, ys, face] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:romance2", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const fr = () => page.evaluate(() => { const s = window.__oprnDebug.readState?.() ?? {}; return JSON.stringify(s.friendship ?? s.session?.friendship ?? Object.keys(s)); });
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
await page.waitForTimeout(1200); await page.keyboard.press("Enter");
await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
for (let i = 0; i < 40; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
await page.evaluate(([a, b, c]) => window.__oprnDebug.teleport(a, b, c), [mapId, Number(xs), Number(ys)]);
await page.waitForTimeout(1200);
await page.evaluate((d) => window.__oprnInput.dir(d), face); await page.waitForTimeout(80); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(300);
for (let n = 1; n <= 3; n++) {
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);   // 메뉴
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);   // 대화하기
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(600); await page.screenshot({ path: join(out, `t${n}-${i}.png`) }); }
  await page.screenshot({ path: join(out, `talk-${n}.png`) });
  console.log("after talk", n, await fr());
}
await browser.close(); await server.close();
