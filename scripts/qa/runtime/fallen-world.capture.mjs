// 『폴른 스타』 월드 정비 확인(2026-11-04 fs2ov-world) — 체크포인트에서 바로 부팅해 장면 하나씩 1440×900 으로 남긴다. (진단 전용 · 게이트 아님)
//   node scripts/qa/runtime/fallen-world.capture.mjs <play.json> <outDir> <scene> [--opening]
//   scene: hub-shops · smith-front · craft · quest-<id> · merchant · room-<mapId> · opening
// 결과: <outDir>/<scene>/frames/*.png · report.json(대사·선택지·상태)
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, scene] = process.argv.slice(2);
if (!projectArg || !scene) throw new Error("usage: fallen-world.capture.mjs <play.json> <outDir> <scene>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/fallen-world");
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = join(resolve(outArg ?? "tmp/fs-world"), scene);
const party = (lv, n = 3) => [{ actorId: "actor_hero", level: lv }, { actorId: "actor_fs_elena", level: lv }, { actorId: "actor_fs_iris", level: lv }].slice(0, n);
const marched = { sw_fs_valen_marched: true, sw_fs_knight_marched: true, ...Object.fromEntries("abcdefgh".split("").map((k) => [`sw_fs_escort_${k}_marched`, true])) };
const act1 = { ...marched, sw_fs_main_started: true };
// 제2막 눈길(act2-b7-walk 와 같은 줄기 스위치).
const act2 = {
  sw_fs_main_started: true, sw_fs_main_done: true, sw_fs_iris_joined: true, sw_fs2_act2_started: true, sw_fs2_out_of_cells: true, sw_fs2_hub_arrived: true,
  sw_fs2_mire_well: true, sw_fs2_heard_carriage: true, sw_fs2_hanel_told: true, sw_fs2_rohan_spear: true, sw_fs2_bram_hole: true, sw_fs2_dawn_mem_0: true,
  sw_fs2_dawn_mem_1: true, sw_fs2_dawn_mem_2: true, sw_fs2_serin_form: true, sw_fs2_sarah_joined: true, sw_fs2_snow_arrived: true, sw_fs2_spear_returned: true,
  sw_fs2_bread_given: true, sw_fs2_cell_open: true, sw_fs2_barracks_cleared: true, sw_fs2_gear_meds: true, sw_fs2_b4_forest_edge: true, sw_fs2_fortress_f2_lever: true,
};
const act2Party = [{ actorId: "actor_hero", level: 16 }, { actorId: "actor_fs_elena", level: 16 }, { actorId: "actor_fs2_sarah", level: 16 }];

// 장면 = 체크포인트 + 동작 목록. 동작: ["key", k] · ["hold", k, ms] · ["wait", ms] · ["shot", tag] · ["read", {pick?: [i,...]}] · ["state"]
const env = JSON.parse(process.env.FS_WORLD_SCENE ?? "null");
const SCENES = {
  "hub-shops": { cp: { mapId: "fs_hub", x: 30, y: 33, facing: "down", switches: act1, party: party(6, 2) }, steps: [["wait", 1500], ["shot", "view"]] },
  "hub-north": { cp: { mapId: "fs_hub", x: 22, y: 22, facing: "down", switches: act1, party: party(6, 2) }, steps: [["wait", 1500], ["shot", "view"]] },
  ...(env ? { [scene]: env } : {}),
};
const def = SCENES[scene];
if (!def) throw new Error(`unknown scene ${scene} (FS_WORLD_SCENE 로 넘겨라)`);
const cp = { id: `world-${scene}`, selfSwitches: { ev_fs_event: { A: true } }, ...def.cp };

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const report = { scene, errors: [], lines: [], choices: [], states: [], shots: [] };
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push(`console: ${m.text().slice(0, 200)}`); });
page.on("requestfailed", (r) => report.errors.push(`requestfailed: ${r.url().slice(0, 160)} ${r.failure()?.errorText ?? ""}`));
page.on("response", (r) => { if (r.status() >= 400) report.errors.push(`http ${r.status()}: ${r.url().slice(0, 160)}`); });
const opening = def.opening === true;
await page.addInitScript(([c, op]) => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fallen-world", qaInstrumentation: true, ...(op ? {} : { qaCheckpoint: c }) };
}, [cp, opening]);
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const text = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.textContent?.replace(/\s+/g, " ").trim() ?? "", id);
let n = 0;
const shot = async (tag) => { const p = join(out, "frames", `${String(n++).padStart(3, "0")}-${tag}.png`); await page.screenshot({ path: p }); report.shots.push(p); };
const readState = () => page.evaluate(() => {
  const s = window.__oprnDebug?.readState?.();
  return s ? { map: s.currentMapId, x: s.playerX ?? s.player?.x, y: s.playerY ?? s.player?.y, gold: s.gold, inventory: s.inventory, switches: Object.fromEntries(Object.entries(s.switches ?? {}).filter(([k, v]) => v && /_q_|craft|merchant/.test(k))) } : null;
});
/** 대사를 넘기고, 선택지가 나오면 pick 순서대로 고른다(아래 화살표 횟수). 상점 창이 열리면 멈춘다. */
const read = async ({ pick = [], maxRounds = 80, stopOnShop = true } = {}) => {
  const picks = [...pick];
  let quiet = 0;
  for (let i = 0; i < maxRounds && quiet < 5; i++) {
    if (stopOnShop && ((await present("shop-window")) || (await page.locator('[data-testid^="shop"]').count()) > 0)) return "shop";
    if (await present("runtime-choices")) {
      quiet = 0;
      await page.waitForTimeout(500);
      const t = await text("runtime-choices");
      report.choices.push(t);
      await shot("choice");
      const down = picks.length ? picks.shift() : 0;
      for (let k = 0; k < down; k++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(140); }
      await page.keyboard.press("Enter");
    } else if (await present("dialogue-box")) {
      quiet = 0;
      await page.waitForTimeout(900);
      const t = await text("dialogue-box");
      if (t && report.lines.at(-1) !== t) { report.lines.push(t); await shot("line"); }
      await page.keyboard.press("Enter");
    } else quiet++;
    await page.waitForTimeout(300);
  }
  return "done";
};
try {
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  if (opening) {
    await page.waitForSelector("[data-testid='title-screen']", { state: "attached", timeout: 420000 });
    await page.waitForTimeout(2500);
    await shot("title");
    for (let i = 0; i < 6 && !(await present("cinematic-sequence")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(700); }
    // 컷 번호(1부터): 4 = 종이 울리는 마을(6초), 5 = 밤 거리(월드 정비 뒤) 또는 타이틀.
    const streetPage = process.env.FS_WORLD_STREET_PAGE ?? "5";
    const until = Date.now() + 90000;
    let took = new Set();
    while (Date.now() < until && (await present("cinematic-sequence"))) {
      const pg = await page.evaluate(() => document.querySelector("[data-testid='cinematic-sequence']")?.dataset.page ?? "");
      const tm = await page.evaluate(() => Number(document.querySelector("[data-testid='opening-animatic-stage']")?.dataset.timeMs ?? -1));
      for (const [want, at, tag] of [["4", 900, "bell-wide"], ["4", 3400, "bell-mid"], [streetPage, 1500, "street"]]) {
        if (pg === want && tm >= at && !took.has(tag)) { took.add(tag); await shot(tag); }
      }
      await page.waitForTimeout(150);
    }
  } else {
    await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 420000 });
    await page.waitForTimeout(2000);
    for (const step of def.steps ?? []) {
      const [kind, a, b] = step;
      if (kind === "key") { await page.keyboard.press(a); await page.waitForTimeout(400); }
      else if (kind === "hold") { await page.keyboard.down(a); await page.waitForTimeout(b); await page.keyboard.up(a); await page.waitForTimeout(300); }
      else if (kind === "wait") await page.waitForTimeout(a);
      else if (kind === "shot") await shot(a);
      else if (kind === "read") report.lines.push(`[read:${await read(a ?? {})}]`);
      else if (kind === "state") report.states.push(await readState());
      else if (kind === "esc") { await page.keyboard.press("Escape"); await page.waitForTimeout(600); }
    }
  }
} catch (e) {
  report.errors.push(String(e?.stack ?? e).slice(0, 500));
  await shot("error").catch(() => {});
} finally {
  report.final = await readState().catch(() => null);
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ scene, errors: report.errors.slice(0, 3), lines: report.lines.slice(0, 30), choices: report.choices, states: report.states, final: report.final }, null, 1));
  await context.close();
  await browser.close();
  await server.close();
}
