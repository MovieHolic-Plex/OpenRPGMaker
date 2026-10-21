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
  let picked = false;
  for (let i = 0; i < 60; i++) { const n = await page.evaluate(() => (window.__oprnHooksScene.session.monsterParty ?? []).length); if (n > 0 && !(await present("dialogue-box")) && !(await present("runtime-choices"))) break; if (!picked && await present("runtime-choices")) { picked = true; await page.waitForTimeout(500); for (let k = 0; k < Number(process.env.QA_STARTER ?? 0); k++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(120); } } await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  console.log("party", await page.evaluate(() => JSON.stringify((window.__oprnHooksScene.session.monsterParty ?? []).map((m) => Object.keys(m).slice(0, 12)))));
  await page.evaluate(() => { for (const id of ["mx_starter", "mx_badge_1", "mx_badge_2", "mx_badge_3", "mx_badge_4", "mx_beacon", "mx_rescue"]) window.__oprnDebug.setSwitch(id, true); });
  if (process.env.QA_BOOST) await page.evaluate((lv) => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) { s.monsterInstances[id].level = lv; delete s.monsterInstances[id].currentHp; } }, Number(process.env.QA_BOOST));
  // QA_PP0=1: 첫 기술의 PP 를 0 으로 — 기술 창의 「PP 없음」 표시가 「뒤로」 와 겹치는지 본다.
  if (process.env.QA_PP0) await page.evaluate(() => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) { const i = s.monsterInstances[id]; const first = (i.skillIds ?? [])[0]; if (first) i.skillPp = { ...(i.skillPp ?? {}), [first]: 0 }; } });
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
  // 싸운다 → 첫 기술(스타터의 기본 기술). 선택 뒤 연출 구간을 촘촘히 찍으며 상대 받침·스프라이트·HP 박스 위치를 함께 남긴다.
  await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
  const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
  await skills.first().waitFor({ timeout: 10000 });
  if (process.env.QA_PP0) { await page.locator(`[data-testid^="actor-skill-"]`).first().focus(); await page.waitForTimeout(600); await page.screenshot({ path: `${out}/pp0.png` }); const first = page.locator('[data-testid^="actor-skill-"]').first(); console.log("pp0 first", await first.getAttribute("data-testid"), await first.getAttribute("disabled"), await page.evaluate(() => [...document.querySelectorAll(".battle-move-info")].map((e) => e.textContent + "|" + getComputedStyle(e).visibility).join(" / "))); process.exit(0); }
  const ids = await skills.evaluateAll((els) => els.map((e) => e.dataset.testid));
  console.log("skills", ids.join(","));
  const want = process.env.QA_SKILL ? page.locator(`[data-testid="actor-skill-${process.env.QA_SKILL}"]`) : skills.first();
  const geo = () => page.evaluate(() => {
    const s = document.querySelector(".battle-scene"); if (!s) return null;
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), c.visibility, c.opacity]; };
    return { enemy: box(s.querySelector(".battle-enemy")), ecls: s.querySelector(".battle-enemy")?.className, panel: box(s.querySelector(".battle-enemy-list-panel")), pbox: box(s.querySelector(".battle-party")), hp: [...s.querySelectorAll('[data-testid^="battle-enemy-hp-"], .battle-enemy-list-row')].map(box), step: s.dataset.battleDirectorStep, busy: s.dataset.battleSequenceBusy };
  });
  // 상대가 쓰러질 때까지 여러 번 공격한다(QA_ROUNDS). 라운드마다 연출을 촘촘히 찍는다.
  const rounds = Number(process.env.QA_ROUNDS ?? 1);
  for (let r = 0; r < rounds; r++) {
    if (r > 0) {
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command" || !document.querySelector('[data-testid="battle-scene"]'), undefined, { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(600);
      if (!(await present("battle-scene"))) break;
      await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
      await skills.first().waitFor({ timeout: 10000 });
    }
    await (process.env.QA_SKILL ? page.locator(`[data-testid="actor-skill-${process.env.QA_SKILL}"]`) : skills.first()).click();
    const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
    if (await target.count()) await target.first().click().catch(() => {});
    for (let k = 0; k < 30; k++) { if (!(await present("battle-scene"))) break; await page.screenshot({ path: `${out}/r${r}-${String(k).padStart(2, "0")}.png` }); console.log(r, k, JSON.stringify(await geo())); await page.waitForTimeout(110); }
  }
} finally { await browser.close(); await server.close(); }
