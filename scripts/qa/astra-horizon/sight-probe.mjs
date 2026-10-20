// 도로 트레이너 시선 조우 뒤 대사·전투가 실제로 뜨는지 본다.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, out, mapId = "mx_map_meadow", sx = "10", sy = "22", dir = "up"] = process.argv.slice(2);
const projectJson = await readFile(projectArg, "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 640 } })).newPage();
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("console", m.type(), m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 300)));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:sight", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const st = () => page.evaluate(() => { const l = window.__oprnDebug.readLive(); const sc = window.__oprnHooksScene; return `${l.currentMapId}(${l.x},${l.y}) run=${!!sc.running} dlg=${!!document.querySelector('[data-testid=dialogue-box]')} battle=${!!document.querySelector('[data-testid=battle-scene]')} txt=${(document.querySelector('[data-testid=dialogue-box]')?.textContent ?? "").slice(0, 30)}`; });
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) { await page.waitForTimeout(800); if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  await page.evaluate(() => window.__oprnDebug.setSwitch("mx_starter", true));
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [mapId, Number(sx), Number(sy)]); await page.waitForTimeout(2000);
  console.log("at", await st());
  for (let i = 0; i < 8; i++) {
    await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(150); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(500);
    console.log("step", i, await st());
    if (await present("dialogue-box") || await present("battle-scene")) break;
  }
  for (let t = 0; t < 16; t++) { console.log("t", t, await st()); if (t === 3) await page.screenshot({ path: `${out}/sight-${t}.png` }); if (await present("dialogue-box")) await page.keyboard.press("Enter"); if (await present("battle-scene")) break; await page.waitForTimeout(700); }
  await page.screenshot({ path: `${out}/sight-end.png` });
} finally { await browser.close(); await server.close(); }
