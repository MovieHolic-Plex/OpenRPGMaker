// 연구소 스타터 선택 장면을 1배로 단계마다 찍는다(R2-3: 미리보기·대화창 겹침).
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/astra-horizon/starter-probe.mjs <project.json> <outDir>"
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, out, steps = "14"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const projectJson = await readFile(projectArg, "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:starter", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) { await page.waitForTimeout(800); if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(400); }
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_lab", 7, 6)); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/s00-arrive.png` });
  console.log("hero", await page.evaluate(() => { const s = window.__oprnDebug.readState(); return `${s.currentMapId} ${s.x},${s.y}`; }));
  await page.evaluate(() => { window.__oprnInput.face("up"); }); await page.waitForTimeout(300);
  await page.keyboard.press("Space"); await page.waitForTimeout(900);
  console.log("dialogue", await present("dialogue-box"), await present("runtime-choices"));
  for (let i = 1; i <= Number(steps); i++) {
    await page.screenshot({ path: `${out}/s${String(i).padStart(2, "0")}.png` });
    await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  }
} finally { await browser.close(); await server.close(); }
