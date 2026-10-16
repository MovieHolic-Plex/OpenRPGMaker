// 필드 화면 증거: project.json 을 출하 player.html 에 올려 새 게임 → 첫 필드를 원 해상도(기본 960×720 뷰포트)로 찍는다.
//   node scripts/qa/fix-leftovers/field-shot.mjs <project.json> <outDir> <label> [mapId x y] [--vw 480 --vh 320]
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const args = process.argv.slice(2).filter((a) => a !== "--old-hud");
const take = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 && !Number.isNaN(Number(args[i + 1])) ? Number(args.splice(i, 2)[1]) : fallback; };
const vw = take("--vw", 960); const vh = take("--vh", 720);
const [projectArg, outArg, label, mapId, xs, ys] = args;
let projectJson = await readFile(resolve(projectArg), "utf8");
// --old-hud: 수리 전 동작(저장된 fieldHud 없음 → 기본 minimal 하트 HUD)을 수리 후 코드에서도 재현하려고 fieldHud 를 minimal 로 못 박는다.
if (take("--old-hud", 0) === 1 || process.argv.includes("--old-hud")) { const p = JSON.parse(projectJson); p.system.fieldHud = { theme: "minimal", vitals: true, clock: true, tools: true, objective: false, hideEmpty: true }; projectJson = JSON.stringify(p); }
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
try {
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fix-leftovers", qaInstrumentation: true }; });
  await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1200); await page.keyboard.press("Enter");
  for (let i = 0; i < 80; i++) { if (await page.evaluate(() => Boolean(window.__oprnDebug?.readState?.()?.currentMapId))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(400); }
  for (let i = 0; i < 40; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  if (mapId) await page.evaluate(([a, b, c]) => window.__oprnDebug.teleport(a, b, c), [mapId, Number(xs), Number(ys)]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, `${label}.png`) });
  const hud = await page.evaluate(() => { const r = document.querySelector("[data-testid='field-hud']"); const b = r?.getBoundingClientRect(); const widgets = [...document.querySelectorAll("[data-testid^='hud-widget-']")].filter((n) => n.getBoundingClientRect().width > 0).map((n) => n.getAttribute("data-testid")); return { theme: r?.getAttribute("data-theme"), widgets }; });
  await writeFile(join(out, `${label}.json`), JSON.stringify(hud));
  console.log(JSON.stringify({ label, ...hud }));
} finally { await browser.close(); await server.close(); }
