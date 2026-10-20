// 회복 센터 직원 대화 뒤 입력이 살아 있는지 본다.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, out] = process.argv.slice(2);
const projectJson = await readFile(projectArg, "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 640 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:heal", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const live = () => page.evaluate(() => window.__oprnDebug.readLive());
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
const dom = () => page.evaluate(() => [...document.querySelectorAll("[data-testid]")].filter((n) => n.getBoundingClientRect().width > 0).map((n) => n.dataset.testid).join(","));
const press = async (d) => { const b = await live(); await page.evaluate((x) => window.__oprnInput.dir(x), d); await page.waitForTimeout(280); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(400); const a = await live(); return `${d}: (${b.x},${b.y})→(${a.x},${a.y})`; };
try {
  await page.goto(`${server.url}/player.html`); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) { await page.waitForTimeout(800); if (!(await present("cinematic-sequence")) && !(await present("dialogue-box"))) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  console.log("start", JSON.stringify(await live()), await dom());
  console.log(await press("right"));
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_home_center", 7, 7)); await page.waitForTimeout(1500);
  console.log("center", JSON.stringify(await live()));
  console.log("pre", await press("left")); console.log("pre", await press("right"));
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); }); await page.waitForTimeout(800);
  for (let i = 0; i < 30; i++) {
    const d = await dom();
    if (i < 12) { await page.screenshot({ path: `${out}/n${i}.png` }); console.log(i, d); }
    if (!(await present("dialogue-box")) && !(await present("runtime-choices"))) { await page.waitForTimeout(600); if (!(await present("dialogue-box")) && !(await present("runtime-choices"))) break; }
    await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  }
  console.log("after-heal", await dom());
  console.log(await page.evaluate(() => { const sc = window.__oprnHooksScene; return JSON.stringify({ busy: sc?.interpreterBusy ?? sc?.runningInterpreter ? true : undefined, keys: sc ? Object.keys(sc).filter((k) => /interp|mover|route|busy/i.test(k)).slice(0, 30) : null }); }));
  for (let t = 0; t < 30; t++) {
    console.log("t", (t * 0.5).toFixed(1), await page.evaluate(() => { const sc = window.__oprnHooksScene; const m = sc.autonomousNPCs?.get("mx_map_home_center_nurse"); return JSON.stringify({ running: !!sc.running, cmd: [...(sc.commandMoveRouteEventIds ?? [])], mover: m ? { step: m.step, moves: m.moves?.length, timer: m.timer, interval: m.moveIntervalMs, active: m.activeMove ? { e: m.activeMove.elapsedMs, d: m.activeMove.durationMs } : null } : null, dlg: !!document.querySelector('[data-testid=dialogue-box]') }); }));
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({ r: !!window.__oprnHooksScene.running, d: !!document.querySelector('[data-testid=dialogue-box]'), txt: document.querySelector('[data-testid=dialogue-box]')?.textContent?.slice(0, 40) }));
    console.log("drain", i, JSON.stringify(st));
    if (!st.r && !st.d) break;
    if (st.d) await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
  }
  console.log(await press("down"));
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_meadow", 10, 22)); await page.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) console.log("meadow", await press("up"), await page.evaluate(() => !!window.__oprnHooksScene.running));
  await page.screenshot({ path: `${out}/meadow.png` });
  console.log(await press("left"));
  await page.waitForTimeout(3000);
  console.log(await press("right"));
  await page.screenshot({ path: `${out}/after.png` });
} finally { await browser.close(); await server.close(); }
