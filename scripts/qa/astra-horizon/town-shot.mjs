// 마을 외관 1배 사진: 새 센터·상점 킷(2224/2240 대)을 찾아 그 앞으로 가 480×320 으로 찍는다.
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
  await page.goto(`${server.url}/player.html`); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 60; i++) { if (!(await page.locator('[data-testid="cinematic-sequence"],[data-testid="dialogue-box"]').count())) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  for (const mapId of maps) {
    const m = project.maps[mapId];
    for (const [name, base] of [["center", 2224], ["mart", 2240]]) {
      let at = null;
      for (let i = 0; i < m.upperTiles.length; i++) if (m.upperTiles[i] === base) { at = [i % m.width, Math.floor(i / m.width)]; break; }
      if (!at) for (let i = 0; i < m.lowerTiles.length; i++) if (m.lowerTiles[i] === base) { at = [i % m.width, Math.floor(i / m.width)]; break; }
      if (!at) { console.log(mapId, name, "kit not found"); continue; }
      const [kx, ky] = at;
      await page.evaluate(([mm, x, y]) => window.__oprnDebug.teleport(mm, x, y), [mapId, kx + 2, ky + 5]);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(outDir, `${mapId}-${name}.png`) });
      console.log(mapId, name, "kit at", at);
    }
  }
} finally { await browser.close(); await server.close(); }
