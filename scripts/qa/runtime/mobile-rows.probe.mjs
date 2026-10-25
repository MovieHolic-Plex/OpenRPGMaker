// 모바일 목록 줄 터치 높이 측정(2026-10-25): 타이틀 메뉴·불러오기 칸·ESC 메뉴 명령 줄·아이템 목록·저장 칸.
// 줄 가운데 세로선을 1px 씩 훑어 elementFromPoint 가 그 줄(또는 자식)을 돌려주는 높이 = 손가락이 닿는 칸.
// 출하 플레이어(player.html) + 휴대폰 에뮬레이션. PC 크기도 같이 재서 PC 모양이 그대로인지 본다.
//
//   node scripts/qa/runtime/mobile-rows.probe.mjs --project /tmp/mf/demos/chrono-bell.play.json --out /tmp/ui-trio/rows/before
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

function arg(name, fallback) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; }
const projectPath = resolve(arg("project", "/tmp/mf/demos/chrono-bell.play.json"));
const outRoot = resolve(arg("out", "/tmp/ui-trio/rows/run"));
const only = arg("devices", "phone,phone-land,pc").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PLAZA = {
  id: "mobile-rows-plaza", label: "왕도 광장", mapId: "fs_hub", x: 30, y: 33, facing: "left",
  switches: { sw_fs_valen_marched: true, sw_fs_main_started: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
  items: { item_potion: 3, item_ether: 2, item_antidote: 1, item_hi_potion: 2, item_wake_herb: 1 },
};

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
// --skin <id>: ESC 메뉴 스킨을 바꿔 잰다(system.menuUiStyle, 필드 HUD 덮어쓰기는 지운다). --menu-only: 타이틀을 건너뛴다.
// --lists items,save: 메뉴 안에서 열어 볼 목록(기본 넷 다).
const skin = arg("skin", null);
const menuOnly = process.argv.includes("--menu-only");
const lists = arg("lists", "items,save,load,options").split(",");
let projectJson = await readFile(projectPath, "utf8");
if (skin) {
  const project = JSON.parse(projectJson);
  project.system.menuUiStyle = skin;
  if (project.system.fieldHud) delete project.system.fieldHud.menuStyle;
  projectJson = JSON.stringify(project);
}
const result = {};

async function boot(descriptor, checkpoint) {
  const context = await browser.newContext(descriptor);
  const page = await context.newPage();
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.addInitScript(([cp]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "mobile-rows", qaInstrumentation: true, ...(cp ? { qaCheckpoint: cp } : {}) };
  }, [checkpoint]);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 360_000 });
  return { context, page };
}

/** 선택자에 맞는 줄마다 보이는 높이와 손가락 닿는 높이. */
function hitHeights(page, selector) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((n) => n.getBoundingClientRect().height > 0).map((row) => {
    const r = row.getBoundingClientRect();
    const x = r.left + Math.min(r.width / 2, 40);
    let hit = 0;
    for (let y = Math.floor(r.top - 40); y <= r.bottom + 40; y += 1) {
      const e = document.elementFromPoint(x, y);
      if (e && (e === row || row.contains(e))) hit += 1;
    }
    return { text: (row.textContent || "").trim().replace(/\s+/g, " ").slice(0, 14), visual: Math.round(r.height), hit, top: Math.round(r.top) };
  }), selector);
}

async function titleStep(id, d) {
  const { context, page } = await boot(d, null);
  await page.waitForSelector(".rm-title-menu-button", { timeout: 360_000 });
  await sleep(4000);
  const title = await hitHeights(page, ".rm-title-menu-button");
  await page.screenshot({ path: join(outRoot, `${id}-title.png`) });
  // 불러오기 칸: 「이어하기/불러오기」 줄을 누른다(세이브가 없으면 비활성일 수 있다).
  let load = null;
  const loadRow = await page.$('.rm-title-menu-button[data-testid*="load"], .rm-title-menu-button[data-testid*="continue"]');
  if (loadRow) {
    await page.evaluate(() => { const n = document.querySelector('.rm-title-menu-button[data-testid*="load"], .rm-title-menu-button[data-testid*="continue"]'); n?.click(); });
    await sleep(1200);
    load = { slots: await hitHeights(page, ".oprn-load-slot"), back: await hitHeights(page, ".oprn-load-back") };
    await page.screenshot({ path: join(outRoot, `${id}-load.png`) });
  }
  await context.close();
  return { title, load };
}

async function quiet(page) {
  for (let calm = 0, i = 0; calm < 6 && i < 160; i += 1) {
    const open = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"], [data-testid="main-menu"]'));
    if (open) { calm = 0; const menu = await page.evaluate(() => !!document.querySelector('[data-testid="main-menu"]')); await page.keyboard.press(menu ? "Escape" : "Enter"); } else calm += 1;
    await sleep(300);
  }
}

async function settle(page) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await quiet(page);
    await page.evaluate(() => window.__oprnDebug.teleport("fs_hub", 30, 33));
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

async function openCommand(page, re, group = /시스템|System/) {
  const find = (src) => page.evaluate((s) => [...document.querySelectorAll('[data-testid="main-menu"] .status-menu-command, [data-testid="main-menu"] .status-menu-detail-action')].some((e) => new RegExp(s).test((e.textContent || "").trim())), src);
  if (!(await find(re.source)) && group) {
    await page.evaluate((s) => { const n = [...document.querySelectorAll('[data-testid="main-menu"] .status-menu-command')].find((e) => new RegExp(s).test((e.textContent || "").trim())); n?.click(); }, group.source);
    await sleep(900);
  }
  const ok = await page.evaluate((src) => {
    const re = new RegExp(src);
    const n = [...document.querySelectorAll('[data-testid="main-menu"] .status-menu-command, [data-testid="main-menu"] .status-menu-detail-action')].find((e) => re.test((e.textContent || "").trim()));
    if (!n) return false; n.click(); return true;
  }, re.source);
  await sleep(900);
  // 그룹 목록(시스템)에서 고른 줄은 첫 탭 = 커서일 수 있다 — 한 번 더 누른다.
  if (ok && group) await page.evaluate((src) => { const re = new RegExp(src); const n = [...document.querySelectorAll('[data-testid="main-menu"] .status-menu-detail-action.selected')].find((e) => re.test((e.textContent || "").trim())); n?.click(); }, re.source);
  await sleep(700);
  return ok;
}

async function menuStep(id, d) {
  const { context, page } = await boot(d, PLAZA);
  await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  await sleep(3000); await settle(page);
  await page.keyboard.press("Escape"); await sleep(1000);
  if (!(await page.$('[data-testid="main-menu"]'))) { await page.keyboard.press("Escape"); await sleep(1000); }
  const out = { skin: await page.evaluate(() => document.querySelector('[data-testid="main-menu"]')?.dataset.menuSkin ?? null) };
  out.commands = await hitHeights(page, '[data-testid="main-menu"] .status-menu-command');
  await page.screenshot({ path: join(outRoot, `${id}-menu.png`) });
  for (const [key, re] of [["items", /^아이템|^Items?/], ["save", /^저장|^Save/], ["load", /^불러오기|^Load/], ["options", /^옵션|^설정|^Options/]].filter(([key]) => lists.includes(key))) {
    if (!(await openCommand(page, re))) { out[key] = null; continue; }
    out[key] = await hitHeights(page, '[data-testid="main-menu"] .status-menu-detail-list > *, [data-testid="main-menu"] .status-menu-detail-action:not(.status-menu-detail-row)');
    await page.screenshot({ path: join(outRoot, `${id}-menu-${key}.png`) });
    // 처음 메뉴로 돌아간다: 메뉴가 닫힐 때까지 Esc, 다시 연다.
    for (let i = 0; i < 4 && (await page.$('[data-testid="main-menu"]')); i += 1) { await page.keyboard.press("Escape"); await sleep(600); }
    await page.keyboard.press("Escape"); await sleep(900);
  }
  await context.close();
  return out;
}

await mkdir(outRoot, { recursive: true });
const DEVICES = {
  phone: devices["iPhone 13"],
  "phone-land": devices["iPhone 13 landscape"],
  pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
try {
  for (const [id, d] of Object.entries(DEVICES)) {
    if (!only.includes(id)) continue;
    result[id] = {};
    if (!menuOnly) { result[id].title = await titleStep(id, d); console.log(id, "title", JSON.stringify(result[id].title).slice(0, 600)); }
    result[id].menu = await menuStep(id, d); console.log(id, "menu", JSON.stringify(result[id].menu).slice(0, 1500));
  }
} finally {
  await writeFile(join(outRoot, "result.json"), JSON.stringify(result, null, 2));
  await browser.close();
  await server.close();
}
