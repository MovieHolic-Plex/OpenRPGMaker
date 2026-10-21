// 지정한 맵의 트레이너와 싸워 전투 화면 받침(발판)을 찍는다. 사용: <project.json> <outdir> <mapId> <x> <y> [face]
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, out, mapId, gx, gy, face = "up"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const projectJson = await readFile(projectArg, "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:plat", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
try {
  await page.goto(`${server.url}/player.html`, { timeout: 180000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) { await page.waitForTimeout(800); if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_lab", 7, 6)); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
  for (let i = 0; i < 60; i++) { const n = await page.evaluate(() => (window.__oprnHooksScene.session.monsterParty ?? []).length); if (n > 0 && !(await present("dialogue-box")) && !(await present("runtime-choices"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  console.log("party", await page.evaluate(() => (window.__oprnHooksScene.session.monsterParty ?? []).length));
  await page.evaluate(() => { for (const id of ["mx_starter", "mx_badge_1", "mx_badge_2", "mx_badge_3", "mx_badge_4", "mx_beacon", "mx_rescue"]) window.__oprnDebug.setSwitch(id, true); });
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, Number(x), Number(y)), [mapId, gx, gy]); await page.waitForTimeout(1500);
  await page.evaluate((f) => { window.__oprnInput.face(f); window.__oprnInput.action(); }, face);
  const seq = []; let n = 0;
  for (let i = 0; i < 80 && !(await present("battle-scene")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(400); }
  for (let k = 0; k < 14; k++) { await page.screenshot({ path: `${out}/intro-${String(k).padStart(2, "0")}.png` }); await page.waitForTimeout(250); }
  console.log("battle", await present("battle-scene"));
  await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(800);
  console.log(JSON.stringify(await page.evaluate(() => {
    const s = document.querySelector(".battle-scene");
    const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const pseudo = (el, w) => { const c = getComputedStyle(el, w); return { content: c.content, bg: c.backgroundImage.slice(0, 60), bottom: c.bottom, h: c.height, w: c.width }; };
    const out = { terrain: s.dataset.emeraldTerrain, bgcls: s.className, actors: [...s.querySelectorAll(".battle-actor")].map((a) => ({ cls: a.className, box: box(a), before: pseudo(a, "::before"), after: pseudo(a, "::after") })), enemies: [...s.querySelectorAll(".battle-enemy")].map((a) => ({ box: box(a), before: pseudo(a, "::before"), after: pseudo(a, "::after") })) };
    return out;
  })));
  await page.screenshot({ path: `${out}/battle.png` });
  await page.keyboard.press("Enter"); await page.waitForTimeout(150); await page.keyboard.press("Enter");
  for (let k = 0; k < 16; k++) { await page.waitForTimeout(220); await page.screenshot({ path: `${out}/atk-${String(k).padStart(2, "0")}.png` }); }
} finally { await browser.close(); await server.close(); }
