// 마을 하늘 새(R5-5)와 엔딩 타이틀 줄바꿈(R5-6) 확인. node bird-probe.mjs <project.json> <outDir>  (unshare -rn 안에서)
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outDir] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:bird", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await page.locator('[data-testid="cinematic-sequence"],[data-testid="dialogue-box"]').count())) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  for (const mapId of ["mx_map_home", "mx_map_meadow", "mx_map_observatory"]) {
    const m = project.maps[mapId]; if (!m) continue;
    for (const e of m.events.filter((e) => /skybird/.test(e.id))) {
      const ty = Math.min(m.height - 1, e.y + 3), tx = e.x;
      await page.evaluate(([mm, x, y]) => window.__oprnDebug.teleport(mm, x, y), [mapId, tx, ty]);
      await page.waitForTimeout(1600);
      await page.screenshot({ path: join(outDir, `${mapId}-${e.id}.png`) });
      console.log("bird", mapId, e.id, e.x, e.y);
    }
  }
  await page.evaluate(() => window.__oprnDebug.setSwitch("mx_ending", true));
  await page.evaluate((pr) => { const sc = window.__oprnHooksScene; sc.showEndingScreen("아스트라 호라이즌 · 여명의 날개", "등대가 다시 밝아졌다.", pr, "mx_ending_starlight"); }, project.endings[0].presentation);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1000);
    if (await page.locator('[data-testid="ending-screen"]').count()) break;
  }
  console.log("ending present", await page.locator('[data-testid="ending-screen"]').count());
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(outDir, `ending-${i}.png`) });
    await page.keyboard.press("Enter");
  }
  console.log("done");
} finally { await browser.close(); await server.close(); }
