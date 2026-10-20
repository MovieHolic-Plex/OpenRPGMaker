// 마을 NPC 가장자리 잘림(R3-4) 확인. node npc-probe.mjs <project.json> <outDir>  (unshare -rn 안에서)
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
  const m = project.maps.mx_map_home;
  for (const e of m.events.filter((e) => e.pages?.[0]?.graphic?.sprite && !/skybird/.test(e.id))) {
    await page.evaluate(([mm, x, y]) => window.__oprnDebug.teleport(mm, x, y), ["mx_map_home", e.x, Math.min(m.height - 1, e.y + 2)]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(outDir, `npc-${e.id}.png`) });
    console.log("npc", e.id, e.x, e.y);
  }
} finally { await browser.close(); await server.close(); }
