// 문 이벤트마다 아래 칸에서 위로 밀어 실제로 들어가지는지 잰다.  node door-probe.mjs <project.json> <mapId>
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, mapId] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 640 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:door", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const live = () => page.evaluate(() => window.__oprnDebug.readLive());
try {
  await page.goto(`${server.url}/player.html`); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 60; i++) { if (!(await page.locator('[data-testid="cinematic-sequence"],[data-testid="dialogue-box"]').count())) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  await page.evaluate(() => window.__oprnDebug.setSwitch("mx_starter", true));
  const map = project.maps[mapId];
  for (const ev of map.events.filter((e) => /"kind":"transfer"/.test(JSON.stringify(e.pages)))) {
    let result = "?";
    for (const [dx, dy, dir] of [[0, 1, "up"], [0, -1, "down"], [-1, 0, "right"], [1, 0, "left"]]) {
      try {
        await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [mapId, ev.x + dx, ev.y + dy]);
        await page.waitForTimeout(700);
        const s = await live();
        if (s.currentMapId !== mapId || s.x !== ev.x + dx || s.y !== ev.y + dy) { continue; }
        await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(400); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(1300);
        for (let i = 0; i < 5 && await page.locator('[data-testid="dialogue-box"]').count(); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
        const a = await live();
        result = a.currentMapId !== mapId ? `OK from ${dir} → ${a.currentMapId}` : `stuck at (${a.x},${a.y}) pushing ${dir}`;
        if (a.currentMapId !== mapId) break;
      } catch (e) { result = `err ${e.message.slice(0, 60)}`; }
    }
    console.log(ev.id.padEnd(46), `(${ev.x},${ev.y})`, result);
  }
} finally { await browser.close(); await server.close(); }
