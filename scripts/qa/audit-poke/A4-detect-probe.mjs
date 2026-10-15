// A4: 몬스터 캠페인 트레이너(시험 사본: detectionEncounter 부착)가 출하 플레이어에서 시야선 규칙을 실행하는가 + random 배회 NPC.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg); await mkdir(out, { recursive: true });
const report = { steps: [], errors: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("crash", () => console.log("PAGE CRASH")); page.on("close", () => console.log("PAGE CLOSE")); page.on("console", (m) => { if (m.type() === "error") console.log("console.error", m.text().slice(0, 300)); }); browser.on("disconnected", () => console.log("BROWSER DISCONNECTED"));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:a4d", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const live = () => page.evaluate(() => window.__oprnDebug.readLive());
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, data) => { report.steps.push({ id, ...data }); console.log(id, JSON.stringify(data).slice(0, 500)); };
const shot = (n) => page.screenshot({ path: join(out, `${n}.png`) });
const teleport = async (m, x, y) => {
  await page.evaluate(([a, b, c]) => window.__oprnDebug.teleport(a, b, c), [m, x, y]);
  await page.waitForFunction(([a, b, c]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === a && s.x === b && s.y === c; }, [m, x, y], { timeout: 15000 });
  await page.waitForTimeout(700);
};
const evPos = (id) => page.evaluate((i) => { const s = window.__oprnHooksScene; const p = s.eventPositions?.get ? s.eventPositions.get(i) : s.eventPositions?.[i]; return p ? { x: p.x, y: p.y } : null; }, id);
const sceneState = () => page.evaluate(() => { const s = window.__oprnHooksScene; return { running: s.running, inputEnabled: s.inputEnabled, x: s.tileX, y: s.tileY, emotes: (window.__oprnEmotes?.() ?? []).map((e) => `${e.target}:${e.frame}`), completions: s.session.detectionEncounterCompletions ?? null }; });
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1200); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  const idle = () => page.evaluate(() => { const sc = window.__oprnHooksScene; return !!sc && sc.running === false && sc.inputEnabled === true; });
  for (let i = 0; i < 200; i++) { if ((await idle()) && !(await present("dialogue-box")) && !(await present("cinematic-sequence"))) { await page.waitForTimeout(600); if (await idle()) break; } await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  step("opening-done", { idle: await idle(), live: await live() });
  // (A) random 배회 NPC
  await teleport("mx_map_home", 10, 10);
  const seen = new Set(); let first = await evPos("mx_map_home_local"); seen.add(JSON.stringify(first));
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(400); seen.add(JSON.stringify(await evPos("mx_map_home_local"))); }
  step("wander-random-npc", { start: first, distinctPositionsIn16s: seen.size });
  // starter
  await teleport("mx_map_lab", 7, 6);
  for (let k = 0; k < 6; k++) { await page.evaluate(() => window.__oprnInput.face("up")); await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700); if (await present("dialogue-box")) break; }
  for (let i = 0; i < 120; i++) { const n = await page.evaluate(() => window.__oprnHooksScene.session.monsterParty.length); if (n > 0 && (await idle())) break; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  step("starter", { party: await page.evaluate(() => window.__oprnHooksScene.session.monsterParty.length) });
  // (B) 시야선: 트레이너 (4,6) 아래 보기, 시야 6 forward. (5,8) 은 광선 밖.
  await teleport("mx_map_meadow", 5, 8);
  await page.waitForTimeout(1200);
  step("outside-ray-idle", { st: await sceneState(), battle: await present("battle-scene") });
  await page.evaluate(() => window.__oprnInput.dir("left")); await page.waitForTimeout(110); await page.evaluate(() => window.__oprnInput.dir(null));
  const timeline = []; let shotEmote = false, shotApproach = false, t0 = Date.now();
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(100);
    const st = await sceneState(); const tr = await evPos("mx_map_meadow_trainer_0");
    const battle = await present("battle-scene"), dlg = await present("dialogue-box");
    timeline.push({ t: Date.now() - t0, tr, p: { x: st.x, y: st.y }, inp: st.inputEnabled, run: st.running, em: st.emotes.join(","), battle, dlg });
    if (st.emotes.length && !shotEmote) { shotEmote = true; await shot("det-1-emote"); }
    if (tr && (tr.y > 6) && !shotApproach && !battle && !dlg) { shotApproach = true; await shot("det-2-approach"); }
    if (battle || dlg) { await shot("det-3-battle-or-dialogue"); break; }
  }
  const compact = []; let last = ""; for (const r of timeline) { const k = JSON.stringify([r.tr, r.p, r.inp, r.em, r.battle, r.dlg]); if (k !== last) { compact.push(r); last = k; } }
  step("detection-timeline", { rows: compact.slice(0, 40) });
  // 전투를 끝까지 넘겨 본다
  let ended = false;
  for (let i = 0; i < 160; i++) {
    if (!(await present("battle-scene")) && !(await present("dialogue-box")) && i > 5) { ended = true; break; }
    await page.keyboard.press("Enter"); await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1200);
  step("after-fight", { ended, st: await sceneState(), pos: await live() });
  await shot("det-4-after");
  // 다시 광선에 들어가 본다: 광선 밖으로 한 칸 나갔다 다시 들어오기
  const here = await live();
  if (here.currentMapId === "mx_map_meadow") {
    await teleport("mx_map_meadow", 5, 8); await page.waitForTimeout(800);
    await page.evaluate(() => window.__oprnInput.dir("left")); await page.waitForTimeout(110); await page.evaluate(() => window.__oprnInput.dir(null));
    await page.waitForTimeout(2500);
    const again = await sceneState();
    step("re-enter-ray", { st: again, battle: await present("battle-scene"), dialogue: await present("dialogue-box"), trainer: await evPos("mx_map_meadow_trainer_0") });
    await shot("det-5-reenter");
  } else step("re-enter-ray", { skipped: "player not on meadow after fight", map: here.currentMapId });
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
} catch (e) { report.errors.push(String(e?.stack ?? e)); await shot("failure").catch(() => {}); await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2)); }
finally { await browser.close(); await server.close(); }
console.log("errors", report.errors.length, report.errors.slice(0, 3).join(" | ").slice(0, 800));
