// 폰 가로 터치 플레이 측정·녹화(2026-10-25): 출하 플레이어(player.html)를 아이폰 13 가로(844×390)·안드로이드 가로(915×412)로 띄워
// 타이틀·필드·대사·ESC 메뉴·전투 화면을 찍고, 조작(조이스틱·A/B·메뉴)이 게임 화면을 얼마나 덮는지, 게임 안 줄·단추 가운데를
// 조작이 가로채는지 잰다. 손가락 입력은 page.touchscreen.tap(실제 터치 이벤트)로 넣는다.
//
//   node scripts/qa/runtime/fallen-battle-fixture.mjs <chrono-bell.play.json> <fixture.json>   # 전투 이벤트를 붙인 프로젝트
//   node scripts/qa/runtime/landscape-touch.probe.mjs --project <fixture.json> --out <dir> [--devices iphone,android] [--video]
//
// 결과: <dir>/<기기>-<화면>.png, <dir>/result.json, --video 면 <dir>/video/<기기>-<흐름>.webm(1배 실시간).
import { chromium } from "@playwright/test";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

function arg(name, fallback) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; }
const projectPath = resolve(arg("project", "/tmp/fixture.json"));
const outRoot = resolve(arg("out", "/tmp/landscape-touch"));
const only = arg("devices", "iphone,android").split(",");
const video = process.argv.includes("--video");
const flows = arg("flows", "title,menu,dialogue,battle").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEVICES = {
  iphone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  android: { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" },
};
const PLAZA = {
  id: "lt-plaza", label: "왕도 광장", mapId: "fs_hub", x: 30, y: 33, facing: "left",
  switches: { sw_fs_valen_marched: true, sw_fs_main_started: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
  items: { item_potion: 3, item_ether: 2, item_antidote: 1 },
};
const SHRINE = {
  id: "lt-shrine", label: "숲 사당 기록 결정", mapId: "fs_forest_shrine", x: 24, y: 15, facing: "up",
  switches: { sw_fs_main_started: true, sw_fs_valen_marched: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
};
const BATTLE = {
  id: "lt-battle", label: "도깨비불 전투", mapId: "fs_forest_edge", x: 14, y: 22, facing: "up",
  switches: { sw_fs_main_started: true, sw_fs_valen_marched: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }], startEventId: "qa_fight_wisps",
};

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const projectJson = await readFile(projectPath, "utf8");
const result = {};
await mkdir(join(outRoot, "video"), { recursive: true });

async function boot(device, checkpoint, flow) {
  const context = await browser.newContext({ ...DEVICES[device], ...(video ? { recordVideo: { dir: join(outRoot, "video", `${device}-${flow}`), size: DEVICES[device].viewport } } : {}) });
  const page = await context.newPage();
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.addInitScript(([cp]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "landscape-touch", qaInstrumentation: true, ...(cp ? { qaCheckpoint: cp } : {}) };
  }, [checkpoint]);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 360_000 });
  return { context, page };
}

async function finish(context, device, flow) {
  await context.close();
  if (!video) return;
  const dir = join(outRoot, "video", `${device}-${flow}`);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".webm"));
  if (files[0]) await rename(join(dir, files[0]), join(outRoot, "video", `${device}-${flow}.webm`));
}

/** 무대·조작 사각형과 겹침, 게임 안 줄 가운데를 조작이 가로채는지. */
function measure(page, rowSelector) {
  return page.evaluate((rowSel) => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } : null; };
    const stage = r(document.querySelector(".play-stage"));
    const overlap = (a, b) => (!a || !b ? 0 : Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)));
    const controls = {};
    for (const [name, sel] of [["stick", ".touch-dpad-base"], ["a", '[data-testid="touch-action-a"]'], ["b", '[data-testid="touch-action-b"]'], ["menu", ".touch-menu-btn"], ["run", ".touch-run-btn"], ["fullscreen", ".play-fullscreen-toggle"]]) {
      const e = document.querySelector(sel);
      const box = r(e);
      if (!box || getComputedStyle(e).visibility === "hidden" || getComputedStyle(e).display === "none") continue;
      controls[name] = { ...box, overStage: Math.round(overlap(box, stage)), opacity: Number(getComputedStyle(e).opacity) };
    }
    const rows = rowSel ? [...document.querySelectorAll(rowSel)].map((row) => {
      const b = row.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) return null;
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { text: (row.textContent || "").trim().replace(/\s+/g, " ").slice(0, 10), h: Math.round(b.height), w: Math.round(b.width), covered: !(hit && (hit === row || row.contains(hit))), by: hit && !(hit === row || row.contains(hit)) ? (hit.className || hit.tagName).toString().slice(0, 40) : null };
    }).filter(Boolean) : [];
    const vp = { w: innerWidth, h: innerHeight };
    return { vp, stage, stageShare: stage ? Math.round((stage.w * stage.h) / (vp.w * vp.h) * 100) : 0, layout: document.querySelector(".play-viewport")?.dataset.touchLayout ?? null, overlay: document.querySelector(".play-viewport")?.dataset.touchOverlay ?? null, controls, rows, coveredRows: rows.filter((x) => x.covered).length };
  }, rowSelector);
}

async function tapEl(page, selector) {
  const box = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, selector);
  if (!box) return false;
  await page.touchscreen.tap(box.x, box.y);
  return true;
}

async function ready(page, settleTo) {
  await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  await sleep(2500);
  if (!settleTo) return;
  // 광장 체크포인트는 행진 컷신으로 시작한다 — 대사·메뉴를 닫고 주인공이 걸을 수 있을 때까지 기다린다(키보드는 준비에만 쓴다).
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    for (let calm = 0, i = 0; calm < 6 && i < 160; i += 1) {
      const open = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"], [data-testid="main-menu"]'));
      if (open) { calm = 0; const menu = await page.evaluate(() => !!document.querySelector('[data-testid="main-menu"]')); await page.keyboard.press(menu ? "Escape" : "Enter"); } else calm += 1;
      await sleep(300);
    }
    await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), settleTo);
    await sleep(400);
    const a = await page.evaluate(() => window.__oprnPlayerSprite?.());
    await page.evaluate(() => window.__oprnInput.dir("right")); await sleep(350);
    await page.evaluate(() => window.__oprnInput.dir(null)); await sleep(500);
    const b = await page.evaluate(() => window.__oprnPlayerSprite?.());
    if (a && b && a.x !== b.x) return;
    await sleep(1500);
  }
  throw new Error("settle failed");
}

for (const device of Object.keys(DEVICES)) {
  if (!only.includes(device)) continue;
  const out = (result[device] = {});
  // 타이틀
  if (flows.includes("title")) {
    const { context, page } = await boot(device, null, "title");
    await page.waitForSelector(".rm-title-menu-button", { timeout: 360_000 }); await sleep(3500);
    out.title = await measure(page, ".rm-title-menu-button");
    await page.screenshot({ path: join(outRoot, `${device}-title.png`) });
    await finish(context, device, "title");
  }
  // 필드 → 메뉴 단추 탭 → 아이템 탭 → 메뉴 단추로 닫기
  if (flows.includes("menu")) {
    const { context, page } = await boot(device, PLAZA, "menu");
    await ready(page, ["fs_hub", 30, 33]);
    out.field = await measure(page, null);
    await page.screenshot({ path: join(outRoot, `${device}-field.png`) });
    await sleep(800);
    out.menuTap = await tapEl(page, ".touch-menu-btn"); await sleep(1400);
    out.menuOpened = !!(await page.$('[data-testid="main-menu"]'));
    out.menu = await measure(page, '[data-testid="main-menu"] .status-menu-command');
    await page.screenshot({ path: join(outRoot, `${device}-menu.png`) });
    // 첫 명령(아이템): 손가락으로 두 번(커서 → 고르기)
    for (let i = 0; i < 2; i += 1) { await tapEl(page, '[data-testid="main-menu"] .status-menu-command'); await sleep(900); }
    out.items = await measure(page, '[data-testid="main-menu"] .status-menu-detail-list > *');
    await page.screenshot({ path: join(outRoot, `${device}-menu-items.png`) });
    for (let i = 0; i < 3 && (await page.$('[data-testid="main-menu"]')); i += 1) { await tapEl(page, ".touch-menu-btn"); await sleep(900); }
    out.menuClosedByTap = !(await page.$('[data-testid="main-menu"]'));
    await sleep(800);
    await finish(context, device, "menu");
  }
  // 대사·선택지
  if (flows.includes("dialogue")) {
    const { context, page } = await boot(device, SHRINE, "dialogue");
    await ready(page);
    await page.keyboard.down("ArrowUp"); await sleep(2400); await page.keyboard.up("ArrowUp"); await sleep(600);
    for (let i = 0; i < 6 && !(await page.$('[data-testid="runtime-choices"]')); i += 1) { await tapEl(page, '[data-testid="touch-action-a"]'); await sleep(900); }
    out.dialogue = await measure(page, '[data-testid="runtime-choices"] button, [data-testid="runtime-choices"] [role="option"], [data-testid="runtime-choices"] li');
    await page.screenshot({ path: join(outRoot, `${device}-dialogue.png`) });
    await finish(context, device, "dialogue");
  }
  // 전투: 명령을 손가락(A 단추)으로 고른다
  if (flows.includes("battle")) {
    const { context, page } = await boot(device, BATTLE, "battle");
    await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 360_000 }); await sleep(3500);
    out.battle = await measure(page, '[data-testid="battle-scene"] [data-testid^="battle-command"], [data-testid="battle-scene"] .battle-command');
    await page.screenshot({ path: join(outRoot, `${device}-battle.png`) });
    for (let i = 0; i < 6; i += 1) { await tapEl(page, '[data-testid="touch-action-a"]'); await sleep(1100); }
    await sleep(2500);
    await page.screenshot({ path: join(outRoot, `${device}-battle-after.png`) });
    await finish(context, device, "battle");
  }
  console.log(device, JSON.stringify({ title: out.title?.coveredRows, menuOpened: out.menuOpened, menuClosedByTap: out.menuClosedByTap, stageShare: out.field?.stageShare, overlay: out.field?.overlay, controls: out.field?.controls }));
}
await writeFile(join(outRoot, `result-${flows.join("-")}.json`), JSON.stringify(result, null, 2));
await browser.close();
await server.close();
