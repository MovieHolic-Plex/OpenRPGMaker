// 관장 전투의 받침(발판) 색이 맞는 순간에도 회색 타원으로 남는지 본다. 사용: <project.json> <outdir>
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, out] = process.argv.slice(2);
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
  await page.evaluate(() => { window.__oprnDebug.setSwitch("mx_starter", true); window.__oprnDebug.setSwitch("mx_badge_1", true); });
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_grove_gym", 14, 4)); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
  for (let i = 0; i < 60 && !(await present("battle-scene")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(400); }
  console.log("battle", await present("battle-scene"));
  const snap = () => page.evaluate(() => {
    const s = document.querySelector(".battle-scene"); const e = s?.querySelector(".battle-enemy"); if (!e) return null;
    const cs = getComputedStyle(e), b = getComputedStyle(e, "::before");
    return { cls: e.className, terrain: s.dataset.emeraldTerrain, skin: s.dataset.battleSkin, filter: cs.filter, bg: b.backgroundColor, bfilter: b.filter, bop: b.opacity, anim: cs.animationName, scls: s.className };
  });
  let shots = 0, last = "";
  for (let turn = 0; turn < 8 && shots < 6; turn++) {
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    if (await present("actor-command-fight")) { await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(250); await page.keyboard.press("Enter"); await page.waitForTimeout(150); await page.keyboard.press("Enter"); }
    for (let k = 0; k < 40; k++) {
      const s = await snap(); if (!s) break;
      const key = JSON.stringify([s.cls, s.filter, s.anim, s.scls]);
      if (key !== last) { last = key; console.log(k, JSON.stringify(s)); if (/knockback|juice|hit/.test(s.cls + s.scls) && shots < 6) { await page.screenshot({ path: `${out}/hit-${shots++}.png` }); } }
      await page.waitForTimeout(60);
    }
  }
} finally { await browser.close(); await server.close(); }
