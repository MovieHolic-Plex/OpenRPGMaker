// 메뉴 화면 1배 촬영 — 출하 플레이어(480x320)에서 메뉴를 열고 항목마다 한 장씩.
//   node scripts/qa/astra-horizon/menu-probe.mjs <project.json> <outDir> [teleportMap x y]
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg, ...rest] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:menu", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 }); await page.waitForTimeout(2500);
  await shot("00-title");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) { await page.waitForTimeout(800); if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  if (rest[0]) { await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, +x, +y), rest); await page.waitForTimeout(1500); }
  await shot("01-field");
  await page.keyboard.press("Escape"); await page.waitForTimeout(900);
  await shot("02-menu");
  const entries = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='status-menu-command-']")].map((n) => n.dataset.testid).filter((t) => !/rail|icon/.test(t)));
  console.log("entries", JSON.stringify(entries));
  for (let i = 0; i < Math.min(entries.length, 14); i++) {
    await page.keyboard.press("Enter"); await page.waitForTimeout(700); await shot(`03-cmd${String(i).padStart(2, "0")}-${(entries[i] ?? "").replace("status-menu-command-", "")}`);
    const small = await page.evaluate(() => [...document.querySelectorAll(".oprn-status-menu *")].filter((n) => n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && n.offsetParent && parseFloat(getComputedStyle(n).fontSize) < 8).map((n) => `${n.className}|${getComputedStyle(n).fontSize}|${n.textContent.trim().slice(0, 24)}`));
    if (small.length) console.log(entries[i], "SMALL", JSON.stringify(small));
    await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(300);
  }
} finally { await browser.close(); await server.close(); }
