// 연애 ESC 메뉴 증거: project.json 을 출하 player.html 에 올려 ESC 메뉴를 원 해상도로 찍고 명령 레일 기하를 잰다.
//   node scripts/qa/fix-leftovers/esc-shot.mjs <project.json> <outDir> [label]
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg, label = "esc"] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fix-leftovers", qaInstrumentation: true }; });
  await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1200); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 40; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape"); await page.waitForSelector("[data-testid='main-menu']", { timeout: 30000 }); await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, `${label}.png`) });
  const geo = await page.evaluate(() => {
    const r = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
    const rail = document.querySelector("[data-testid='status-menu-command-rail']");
    const cmds = [...document.querySelectorAll("[data-testid^='status-menu-command-'][role]")].map((n) => ({ id: n.id, text: n.textContent.trim(), ...r(n) }));
    return { skin: document.querySelector(".oprn-status-menu")?.getAttribute("data-menu-skin"), rail: r(rail), railScrollH: rail?.scrollHeight, railClientH: rail?.clientHeight, cmds };
  });
  await writeFile(join(out, `${label}.json`), JSON.stringify(geo, null, 1));
  console.log(JSON.stringify({ skin: geo.skin, rail: geo.rail, railScrollH: geo.railScrollH, railClientH: geo.railClientH, last: geo.cmds.at(-1), n: geo.cmds.length }));
} finally { await browser.close(); await server.close(); }
