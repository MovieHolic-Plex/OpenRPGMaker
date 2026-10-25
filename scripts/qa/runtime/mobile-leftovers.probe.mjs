// 모바일 남은 결함 측정(2026-10-25): ESC 메뉴 행 터치 크기·한 번 탭 실행, 전체 화면 단추 크기,
// 컷신 건너뛰기 뒤 카메라, 가로 대사 중 조작 겹침. 출하 플레이어(player.html) + 휴대폰 에뮬레이션 + CDP 터치.
//
//   node scripts/qa/runtime/mobile-leftovers.probe.mjs --project /tmp/mf/demos/chrono-bell.play.json --out /tmp/mf/lo/after [--only menu,fullscreen,skip,overlap]
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

function arg(name, fallback) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; }
const projectPath = resolve(arg("project", "/tmp/mf/demos/chrono-bell.play.json"));
const outRoot = resolve(arg("out", "/tmp/mf/lo/run"));
const only = arg("only", "menu,fullscreen,skip,overlap,battle").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PLAZA = {
  id: "mobile-leftovers-plaza", label: "왕도 광장", mapId: "fs_hub", x: 30, y: 33, facing: "left",
  switches: { sw_fs_valen_marched: true, sw_fs_main_started: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
};
// 광장 체크포인트 직후 자동 컷신(행렬)이 돈다 — 건너뛰기 시험용.
const MARCH = { ...PLAZA, id: "mobile-leftovers-march", x: 40, y: 27, facing: "down" };
// 전투(숲 어귀, fallen-battle-fixture.mjs 가 붙인 qa_fight_* 이벤트) — 가로 전투에서 조작이 명령 창·파티 게이지를 가리는지.
const BATTLE = { id: "mobile-leftovers-battle", label: "숲 어귀 전투", mapId: "fs_forest_edge", x: 14, y: 22, facing: "up",
  switches: { sw_fs_main_started: true, sw_fs_valen_marched: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }], startEventId: "qa_fight_wolves" };
const battleProject = arg("battle-project", "/tmp/mf/lo/fsb-fixture.json");

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const projectJson = await readFile(projectPath, "utf8");
const result = {};

async function boot(descriptor, checkpoint, init, body = projectJson) {
  const context = await browser.newContext(descriptor);
  const page = await context.newPage();
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
  await page.addInitScript(([cp]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "mobile-leftovers", qaInstrumentation: true, qaCheckpoint: cp };
  }, [checkpoint]);
  if (init) await page.addInitScript(init);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 360_000 });
  await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  const cdp = await context.newCDPSession(page);
  const tap = async (x, y, hold = 60) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(hold);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  return { context, page, tap };
}
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; }, sel);
const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];

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

/** 손가락이 닿는 실제 칸: 행 가운데 세로줄을 1px 씩 훑어 elementFromPoint 가 그 행(또는 자식)을 돌려주는 높이. */
async function hitHeights(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="main-menu"] .status-menu-command')].filter((n) => n.getBoundingClientRect().height > 0);
    return rows.map((row) => {
      const r = row.getBoundingClientRect();
      const x = r.left + r.width / 2;
      let hit = 0;
      for (let y = Math.floor(r.top - 40); y <= r.bottom + 40; y += 1) {
        const e = document.elementFromPoint(x, y);
        if (e && (e === row || row.contains(e))) hit += 1;
      }
      return { text: (row.textContent || "").trim().slice(0, 10), visual: Math.round(r.height), hit, top: Math.round(r.top) };
    });
  });
}

async function menuStep(id, descriptor) {
  const { context, page, tap } = await boot(descriptor, PLAZA);
  await sleep(3000); await settle(page);
  const menuBtn = await rect(page, '[data-testid="touch-menu"]') ?? await rect(page, ".touch-menu-btn");
  await tap(...center(menuBtn)); await sleep(900);
  const rows = await hitHeights(page);
  await page.screenshot({ path: join(outRoot, `${id}-menu.png`) });
  const target = rows.find((r) => /스킬|Skill/.test(r.text)) ?? rows[1];
  const rowRect = await page.evaluate((t) => { const n = [...document.querySelectorAll('[data-testid="main-menu"] .status-menu-command')].find((e) => (e.textContent || "").trim().startsWith(t)); const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, target.text);
  // 행의 위쪽 가장자리 근처(보이는 글자 밖)를 한 번 탭한다.
  await tap(rowRect.x + rowRect.w / 2, rowRect.y + 2); await sleep(700);
  const afterOne = await page.evaluate(() => { const m = document.querySelector('[data-testid="main-menu"]'); return { screen: m?.dataset.statusMenuScreen ?? null, detailFocus: m?.classList.contains("status-menu-detail-focus") ?? false, selected: m?.querySelector(".status-menu-command.selected")?.textContent?.trim().slice(0, 10) ?? null }; });
  await page.screenshot({ path: join(outRoot, `${id}-menu-tap.png`) });
  await context.close();
  return { rows, tapped: target.text, afterOne };
}

async function fullscreenStep(id, descriptor) {
  const { context, page } = await boot(descriptor, PLAZA);
  await sleep(4000);
  const fs = await rect(page, ".play-fullscreen-toggle");
  await context.close();
  return { fullscreen: fs };
}

async function skipStep(id, descriptor) {
  const { context, page, tap } = await boot(descriptor, MARCH);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  const hint = () => page.evaluate(() => document.body.innerText.includes("컷신 건너뛰기"));
  const cam = () => page.evaluate(() => { const c = window.__oprnCamera?.(); const h = window.__oprnPlayerSprite?.(); return c && h ? { scrollX: Math.round(c.scrollX), scrollY: Math.round(c.scrollY), zoom: c.zoom, heroX: Math.round(h.x), heroY: Math.round(h.y), dx: Math.round(c.scrollX + c.width / 2 / c.zoom - h.x), dy: Math.round(c.scrollY + c.height / 2 / c.zoom - h.y) } : null; });
  let skippable = false;
  for (let i = 0; i < 120 && !skippable; i += 1) { await sleep(500); skippable = await hint(); }
  await sleep(3000);
  const before = await cam();
  await page.screenshot({ path: join(outRoot, `${id}-skip-before.png`) });
  const b = await rect(page, '[data-testid="touch-action-b"]');
  await page.evaluate(() => { window.__esc = []; document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__esc.push(Math.round(performance.now())); }, true); });
  const hitB = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName}.${e.className}` : null; }, center(b));
  await tap(...center(b), 50); await sleep(150); await tap(...center(b), 50);
  const escapes = await page.evaluate(() => window.__esc);
  const timeline = [{ b, hitB, escapes }];
  for (let i = 0; i < 8; i += 1) { await sleep(400); timeline.push({ t: (i + 1) * 400, hint: await hint(), cam: await cam(), letterbox: await page.evaluate(() => Math.round(document.querySelector('[data-testid="runtime-letterbox-top"]')?.getBoundingClientRect().height ?? 0)), dialogue: await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]')) }); }
  await quiet(page);
  await sleep(1500);
  const after = { ...(await cam()), letterbox: await page.evaluate(() => document.querySelector('[data-testid="runtime-letterbox-top"]')?.getBoundingClientRect().height ?? 0) };
  await page.screenshot({ path: join(outRoot, `${id}-skip-after.png`) });
  // 걸어서 카메라가 따라오는지: 왼쪽으로 3칸쯤.
  let walked = after;
  for (const dir of ["left", "down", "right", "up"]) {
    await page.evaluate((d) => window.__oprnInput.dir(d), dir); await sleep(1200); await page.evaluate(() => window.__oprnInput.dir(null)); await sleep(1000);
    walked = await cam();
    if (walked && after && (walked.heroX !== after.heroX || walked.heroY !== after.heroY)) break;
  }
  await page.screenshot({ path: join(outRoot, `${id}-skip-walk.png`) });
  await context.close();
  return { skippable, errors, timeline, before, after, walked, heroMoved: walked && after ? walked.heroX !== after.heroX : null, cameraCentered: walked ? Math.abs(walked.dx) <= 24 && Math.abs(walked.dy) <= 24 : null };
}

async function battleStep(id, descriptor) {
  const body = await readFile(battleProject, "utf8");
  const { context, page } = await boot(descriptor, BATTLE, null, body);
  await page.waitForSelector('[data-testid="actor-command-attack"]', { timeout: 120_000 });
  await sleep(1500);
  const m = await page.evaluate(() => {
    const box = (els) => { const rs = [...els].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0); if (!rs.length) return null; const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top)); return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(...rs.map((r) => r.right)) - x), h: Math.round(Math.max(...rs.map((r) => r.bottom)) - y) }; };
    const r = (s) => box(document.querySelectorAll(s));
    const op = (s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).opacity) : null; };
    return {
      commands: r('[data-testid^="actor-command-"]'),
      party: r('[data-testid^="battle-actor-status-"]'),
      stick: r(".touch-dpad-base"), a: r('[data-testid="touch-action-a"]'), b: r('[data-testid="touch-action-b"]'),
      opacity: { stick: op(".touch-dpad-base"), a: op('[data-testid="touch-action-a"]'), b: op('[data-testid="touch-action-b"]') },
    };
  });
  const inter = (p, q) => (p && q ? Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y)) : 0);
  const overlap = {};
  for (const c of ["stick", "a", "b"]) overlap[c] = { commands: inter(m[c], m.commands), party: inter(m[c], m.party) };
  await page.screenshot({ path: join(outRoot, `${id}-battle.png`) });
  await context.close();
  return { ...m, overlap };
}

async function overlapStep(id, descriptor) {
  const { context, page } = await boot(descriptor, PLAZA);
  await sleep(3000); await settle(page);
  await page.evaluate(() => window.__oprnDebug.teleport("fs_hub", 29, 33)); await sleep(500);
  await page.evaluate(() => window.__oprnInput.face?.("left")); await sleep(300);
  await page.keyboard.press("Enter"); await sleep(1800);
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; };
    const op = (s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).opacity) * Number(getComputedStyle(e.parentElement).opacity) : null; };
    return {
      text: r('[data-testid="dialogue-box"] .dialogue-text') ?? r('[data-testid="dialogue-text"]') ?? r('[data-testid="dialogue-box"]'),
      box: r('[data-testid="dialogue-box"]'),
      bust: r('[data-testid="dialogue-face"]') ?? r(".dialogue-face") ?? r(".dialogue-bust"),
      name: r(".dialogue-name") ?? r('[data-testid="dialogue-speaker"]'),
      stick: r(".touch-dpad-base"), a: r('[data-testid="touch-action-a"]'), b: r('[data-testid="touch-action-b"]'),
      opacity: { stick: op(".touch-dpad-base"), a: op('[data-testid="touch-action-a"]'), b: op('[data-testid="touch-action-b"]') },
    };
  });
  const inter = (p, q) => (p && q ? Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y)) : 0);
  const overlap = {};
  for (const c of ["stick", "a", "b"]) overlap[c] = { text: inter(m[c], m.text), bust: inter(m[c], m.bust), name: inter(m[c], m.name) };
  await page.screenshot({ path: join(outRoot, `${id}-overlap.png`) });
  await context.close();
  return { ...m, overlap };
}

await mkdir(outRoot, { recursive: true });
const PHONES = { "iphone15": devices["iPhone 15"], "iphone15-land": devices["iPhone 15 landscape"], "galaxy-s24-land": devices["Galaxy S24 landscape"] };
try {
  for (const [id, d] of Object.entries(PHONES)) {
    result[id] = {};
    if (only.includes("menu")) { result[id].menu = await menuStep(id, d); console.log(id, "menu", JSON.stringify(result[id].menu).slice(0, 400)); }
    if (only.includes("fullscreen")) { result[id].fullscreen = await fullscreenStep(id, d); console.log(id, "fs", JSON.stringify(result[id].fullscreen)); }
    if (only.includes("battle") && id !== "iphone15") { result[id].battle = await battleStep(id, d); console.log(id, "battle", JSON.stringify(result[id].battle.overlap), JSON.stringify(result[id].battle.opacity)); }
    if (only.includes("overlap") && id !== "iphone15") { result[id].overlap = await overlapStep(id, d); console.log(id, "overlap", JSON.stringify(result[id].overlap.overlap), JSON.stringify(result[id].overlap.opacity)); }
  }
  if (only.includes("skip")) { result.skip = await skipStep("iphone15-land", PHONES["iphone15-land"]); console.log("skip", JSON.stringify(result.skip)); }
} finally {
  await writeFile(join(outRoot, "result.json"), JSON.stringify(result, null, 2));
  await browser.close();
  await server.close();
}
