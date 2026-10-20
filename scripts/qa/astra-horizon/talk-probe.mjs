// 어느 맵에서든 한 사람에게 말을 걸어 단계마다 1배로 찍는다(대화가 다 나온 뒤 안정 프레임). env: MAP X Y FACE
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/astra-horizon/talk-probe.mjs <project.json> <outDir>"
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
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [process.env.MAP ?? "mx_map_lab", Number(process.env.X ?? 7), Number(process.env.Y ?? 6)]); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/s00-arrive.png` });
  console.log("hero", await page.evaluate(() => { const s = window.__oprnDebug.readState(); return `${s.currentMapId} ${s.x},${s.y}`; }));
  await page.evaluate((f) => { window.__oprnInput.face(f); }, process.env.FACE ?? "up"); await page.waitForTimeout(300);
  await page.keyboard.press("Space"); await page.waitForTimeout(900);
  console.log("dialogue", await present("dialogue-box"), await present("runtime-choices"));
  for (let i = 1; i <= Number(steps); i++) {
    await page.waitForTimeout(2200); await page.screenshot({ path: `${out}/s${String(i).padStart(2, "0")}.png` });
    await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  }
} finally { await browser.close(); await server.close(); }
