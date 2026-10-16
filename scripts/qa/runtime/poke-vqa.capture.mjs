// 포켓몬 라이크 시각 QA 수리 확인 캡처 — 출하 플레이어(player.html + export shim), 원본 해상도 480×320(1×) 고정.
//   node scripts/qa/runtime/poke-vqa.capture.mjs <campaign.json> <outDir> [scene,scene,...]
// 캠페인은 `bun scripts/qa/poke-audit-fix/build-fixture.mts <out.json>` 으로 모델 없이 만든다.
// 장면: title opening town trainer gym champion dex wild moves ending
// 확대 크롭(4×)은 호출자가 PNG 에서 자른다. 디버그 쓰기(순간이동·레벨·챔피언 팀 줄이기)는 report.json 의 debugWrites 에 남는다.
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, sceneArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: poke-vqa.capture.mjs <project.json> <outDir> [scenes]");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/poke-vqa");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
const out = resolve(outArg ?? "qa-runs/poke-vqa");
await mkdir(out, { recursive: true });
const SCENES = (sceneArg ?? "title,opening,town,trainer,gym,dex,wild,moves").split(",");
const report = { steps: [], errors: [], debugWrites: [], shots: [] };

// 챔피언·관장 전투를 이기려면 상대를 줄이거나 내 몬스터를 키워야 한다 — 보고서에 남는 디버그 쓰기다.
if (SCENES.includes("champion") || SCENES.includes("ending")) {
  const champ = project.database.troops.find((t) => /league_4_league_challenge|champ/.test(t.id));
  if (champ && champ.enemyIds.length > 1) {
    report.debugWrites.push(`champion troop ${champ.id}: ${champ.enemyIds.length} -> 1 enemies`);
    champ.enemyIds = champ.enemyIds.slice(0, 1);
    if (champ.members) champ.members = champ.members.slice(0, 1);
  }
}
const projectJson = JSON.stringify(project);

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const context = await browser.newContext({ viewport: { width: 480, height: 320 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:poke-vqa", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const snap = async (name) => { await page.screenshot({ path: join(out, name + ".png") }); report.shots.push(name); };
const settled = async (done) => { for (let k = 0; k < 4; k++) { if (!(await done())) return false; await page.waitForTimeout(200); } return true; };
const pressEnterUntil = async (done, max = 40, ms = 250) => { for (let i = 0; i < max; i++) { if (await settled(done)) return true; await page.keyboard.press("Enter"); await page.waitForTimeout(ms); } return settled(done); };
const teleport = async (mapId, x, y) => {
  report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(900);
};
const live = () => page.evaluate(() => { const s = window.__oprnHooksScene.session; return { map: s.currentMapId, x: s.x, y: s.y, party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })) }; });
const free = (mapId, x, y) => !project.maps[mapId].events.some((e) => e.x === x && e.y === y);
const besideOf = (mapId, ev) => [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]].map(([dx, dy, dir]) => ({ x: ev.x + dx, y: ev.y + dy, dir })).find((p) => free(mapId, p.x, p.y));
const talk = async (dir) => {
  for (let a = 0; a < 6; a++) {
    await page.evaluate((d) => window.__oprnInput.face(d), dir);
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    if (await present("dialogue-box") || await present("battle-scene")) return true;
  }
  return false;
};
const step = (id, ok, detail) => { report.steps.push({ id, ok, detail }); console.log(ok ? "✓" : "✗", id, detail ?? ""); };
const setLead = (patch) => page.evaluate((patch) => { const s = window.__oprnHooksScene.session; const m = s.monsterInstances[s.monsterParty[0]]; Object.assign(m, patch); return m.level; }, patch);
const eventOf = (mapId, re) => project.maps[mapId].events.find((e) => re.test(e.id));
const waitCmd = (timeout = 40000) => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout }).then(() => true, () => false);

/** 빠르게 연속 촬영한다(전투 등장 연출처럼 짧은 장면). */
async function burst(prefix, count, gapMs) {
  for (let i = 0; i < count; i++) { await snap(`${prefix}${String(i).padStart(2, "0")}`); if (gapMs) await page.waitForTimeout(gapMs); }
}

async function boot(pressTitle = true) {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
  await page.waitForTimeout(1800);
  if (SCENES.includes("title")) await snap("title");
  if (!pressTitle) return;
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 180000 });
}
async function skipOpening(shots) {
  let n = 0;
  const busy = async () => (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("title-screen"));
  for (let i = 0; i < 100; i++) {
    if (!(await busy()) && (await settled(async () => !(await busy())))) break;
    if (shots && n < shots) { await snap(`opening${n}`); n += 1; await page.waitForTimeout(400); }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(shots ? 700 : 250);
  }
}
async function starter() {
  const lab = Object.values(project.maps).find((m) => m.events.some((e) => /professor/.test(e.id)));
  const prof = lab.events.find((e) => /professor/.test(e.id));
  const spot = besideOf(lab.id, prof);
  await teleport(lab.id, spot.x, spot.y);
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await pressEnterUntil(async () => (await live()).party.length > 0 && !(await present("dialogue-box")), 80);
  const st = await live();
  step("starter", st.party.length === 1, st.party.map((m) => `${m.speciesId} Lv${m.level}`).join(","));
}
async function fightWin(maxTurns = 40) {
  for (let turn = 0; turn < maxTurns; turn++) {
    if (!(await present("battle-scene"))) return true;
    if (await present("battle-result-panel")) { await pressEnterUntil(async () => !(await present("battle-scene")), 30); return true; }
    if (!(await page.locator('[data-testid="actor-command-fight"]').count())) { await page.keyboard.press("Enter"); await page.waitForTimeout(250); continue; }
    if (!(await waitCmd(8000))) { await page.keyboard.press("Enter"); continue; }
    await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
    const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
    await skills.first().waitFor({ timeout: 10000 });
    await skills.first().focus(); await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
    if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
    await page.waitForTimeout(900);
  }
  return false;
}
async function dismissAll() { await pressEnterUntil(async () => !(await present("dialogue-box")) && !(await present("battle-scene")) && !(await present("cinematic-sequence")), 60, 300); }

async function sceneTrainer() {
  const mapId = "mx_map_meadow";
  const ev = eventOf(mapId, /trainer_0$/);
  const spot = besideOf(mapId, ev);
  await teleport(mapId, spot.x, spot.y);
  await snap("trainer_field");
  await talk(spot.dir);
  await pressEnterUntil(async () => await present("battle-scene"), 20, 400);
  const t0 = Date.now();
  await burst("trainer_intro_", 14, 0);
  report.trainerIntroMs = Date.now() - t0;
  const ready = await waitCmd(60000);
  await page.waitForTimeout(500);
  await snap("trainer_command");
  step("trainer", ready, `intro burst ${report.trainerIntroMs}ms`);
  await setLead({ level: 60 });
  await fightWin();
  await dismissAll();
}

async function sceneGym(index = 0) {
  const gymId = Object.keys(project.maps).filter((id) => /_gym$/.test(id))[index];
  const leader = eventOf(gymId, /_leader$/);
  // 관장 앞 자리 — 퍼즐·졸개를 건너뛰고(디버그 쓰기) 곧장 서서 관장 소개·배지 수여를 본다.
  await setLead({ level: 70 });
  const spot = besideOf(gymId, leader);
  await page.evaluate(() => { const s = window.__oprnHooksScene.session; for (const k of Object.keys(window.__oprnHooksScene.session.switches)) void k; });
  report.debugWrites.push("gym puzzle switch on");
  await page.evaluate((i) => window.__oprnDebug.setSwitch(`mx_gym_${i + 1}_puzzle`, true), index);
  await teleport(gymId, spot.x, spot.y);
  await snap(`gym${index}_field`);
  await talk(spot.dir);
  await pressEnterUntil(async () => await present("battle-scene"), 30, 400);
  await burst(`gym${index}_intro_`, 14, 0);
  await waitCmd(60000);
  await snap(`gym${index}_command`);
  await fightWin(60);
  await page.waitForTimeout(600);
  for (let i = 0; i < 14; i++) { await snap(`gym${index}_after${String(i).padStart(2, "0")}`); await page.keyboard.press("Enter"); await page.waitForTimeout(500); }
  await dismissAll();
}

/** 한 화면(30×20칸)에 사람 이벤트가 가장 많이 모이는 자리 — 같은 얼굴이 몰려 보이는지 보기 좋다. */
function crowdSpot(mapId) {
  const map = project.maps[mapId];
  const people = map.events.filter((e) => e.pages?.[0]?.graphic?.sprite?.id?.includes("charset") && !e.pages[0].graphic.transparent);
  let best = null;
  for (const c of people) {
    const n = people.filter((e) => Math.abs(e.x - c.x) <= 13 && Math.abs(e.y - c.y) <= 8).length;
    const spot = besideOf(mapId, c);
    if (spot && (!best || n > best.n)) best = { n, ...spot };
  }
  return best;
}
async function sceneTown() {
  const gyms = Object.keys(project.maps).filter((m) => /_gym$/.test(m));
  for (const [id, name] of [["mx_map_prism", "prism"], ["mx_map_harbor", "harbor"], ["mx_map_home", "home"], [gyms[1], "gym2"], [gyms[4], "gym5"]]) {
    const spot = crowdSpot(id);
    if (!spot) continue;
    try { await teleport(id, spot.x, spot.y); } catch { report.errors.push(`teleport failed ${id}`); continue; }
    await page.waitForTimeout(500);
    await snap(`town_${name}`);
    report.towns = { ...(report.towns ?? {}), [name]: spot.n };
  }
}

async function sceneChampion() {
  const league = Object.keys(project.maps).filter((m) => /^mx_map_league_\d$/.test(m)).sort();
  const last = league[league.length - 1];
  const ev = eventOf(last, /league_challenge$/);
  await setLead({ level: 90 });
  const spot = besideOf(last, ev);
  await teleport(last, spot.x, spot.y);
  await snap("champion_field");
  await talk(spot.dir);
  await pressEnterUntil(async () => await present("battle-scene"), 30, 400);
  await burst("champion_intro_", 10, 0);
  await waitCmd(60000);
  await fightWin(60);
}

async function sceneEnding() {
  await page.waitForTimeout(1200);
  for (let i = 0; i < 24; i++) {
    await snap(`ending${String(i).padStart(2, "0")}`);
    if (await present("title-screen")) break;
    await page.waitForTimeout(i < 6 ? 700 : 2500);
    if (i > 14) await page.keyboard.press("Enter");
  }
}

async function sceneDex() {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await snap("menu");
  const items = page.locator('[data-testid^="field-menu-"], [role="menuitem"]');
  report.menuItems = await items.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") + ":" + (e.textContent ?? "").trim().slice(0, 12)));
  const dex = page.locator('[data-testid="field-menu-command-monster-dex"], [data-testid*="dex"]').first();
  if (await dex.count()) { await dex.click(); await page.waitForTimeout(900); await snap("dex"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await page.waitForTimeout(700); await snap("dex_detail"); }
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(400);
}

async function sceneWild() {
  const route = project.maps["mx_map_meadow"];
  const habitat = route.locations.find((l) => l.id === "mx_map_meadow_habitat");
  const cands = [];
  for (let y = habitat.y; y < habitat.y + habitat.h; y++) for (let x = habitat.x; x < habitat.x + habitat.w - 1; x++) if (free(route.id, x, y) && free(route.id, x + 1, y)) cands.push({ x, y });
  const c = cands[Math.floor(cands.length / 2)];
  await teleport(route.id, c.x, c.y);
  let enc = false;
  for (let i = 0; i < 200 && !enc; i++) { await page.evaluate((d) => window.__oprnInput.dir(d), i % 2 ? "left" : "right"); await page.waitForTimeout(260); await page.evaluate(() => window.__oprnInput.dir(null)); enc = await present("battle-scene"); }
  step("wild", enc);
  await waitCmd(60000);
  await page.waitForTimeout(800);
  await snap("wild_command");
  await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  await snap("wild_moves");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

try {
  await boot(!SCENES.every((s) => s === "title"));
  if (SCENES.some((s) => s !== "title")) {
    await skipOpening(SCENES.includes("opening") ? 6 : 0);
    if (SCENES.some((s) => s !== "title" && s !== "opening")) await starter();
    for (const s of SCENES) {
      if (s === "town") await sceneTown();
      else if (s === "trainer") await sceneTrainer();
      else if (s === "gym") await sceneGym(0);
      else if (s === "dex") await sceneDex();
      else if (s === "wild") await sceneWild();
      else if (s === "champion" || s === "ending") { if (s === "champion") await sceneChampion(); else await sceneEnding(); }
    }
  }
} catch (error) {
  report.errors.push("FATAL " + String(error?.stack ?? error));
  await snap("fatal").catch(() => {});
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close?.();
  console.log(JSON.stringify({ shots: report.shots.length, errors: report.errors.slice(0, 5), debugWrites: report.debugWrites.length }));
}
