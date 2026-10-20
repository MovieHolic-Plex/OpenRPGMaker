// 선택지 상자가 화면 안에 들어오는지 잰다(회복 센터 직원 선택지).
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, out, vw = "1440", vh = "960"] = process.argv.slice(2);
const projectJson = await readFile(projectArg, "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: Number(vw), height: Number(vh) } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:choice", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) { await page.waitForTimeout(800); if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_home_center", 7, 7)); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); }); await page.waitForTimeout(800);
  for (let i = 0; i < 10 && !(await present("runtime-choices")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(500); }
  await page.waitForTimeout(600);
  console.log(await page.evaluate(() => {
    const r = (sel) => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); const c = getComputedStyle(n); return `${sel} x${Math.round(b.left)}-${Math.round(b.right)} y${Math.round(b.top)}-${Math.round(b.bottom)} w=${c.width} bs=${c.boxSizing} pad=${c.padding} ml=${c.marginLeft}`; };
    return [r(".play-stage, [data-testid=play-stage]"), r("[data-testid=play-viewport]"), r(".dialogue-overlay"), r(".dialogue-box.choices"), r("[data-testid=runtime-choices]")].join("\n");
  }));
  await page.screenshot({ path: `${out}/choice-${vw}.png` });
} finally { await browser.close(); await server.close(); }
