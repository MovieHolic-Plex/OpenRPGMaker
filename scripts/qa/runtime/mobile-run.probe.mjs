// 달리기 측정(2026-10-25): 조이스틱을 조금/끝까지 밀 때의 속도, 맵 탭 거리별 속도, 따로 달리기 단추 유무.
// 출하 플레이어(player.html) + 휴대폰 에뮬레이션 + CDP 터치. --video 면 1배 영상(손가락 표시)을 남긴다.
//
//   node scripts/qa/runtime/mobile-run.probe.mjs --project /tmp/mf/demos/chrono-bell.play.json --out /tmp/mf/run/after [--video] [--always-run] [--device iphone15]
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile, readdir, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

function arg(name, fallback) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; }
const projectPath = resolve(arg("project", "/tmp/mf/demos/chrono-bell.play.json"));
const outRoot = resolve(arg("out", "/tmp/mf/run/run"));
const wantVideo = process.argv.includes("--video");
const alwaysRun = process.argv.includes("--always-run"); // 「항상 달리기」를 켠 기기
const onlyDevice = arg("device", null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PLAZA = {
  id: "mobile-run-plaza", label: "왕도 광장", mapId: "fs_hub", x: 30, y: 33, facing: "right",
  switches: { sw_fs_valen_marched: true, sw_fs_main_started: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
};
// 손가락 표시(영상용) + 주인공 위치 기록.
const INSTRUMENT = `(() => {
  const install = () => {
    const dots = new Map();
    const dot = (id) => { let d = dots.get(id); if (!d) { d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:99999;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(255,64,160,.55);border:2px solid #fff;pointer-events:none'; document.documentElement.appendChild(d); dots.set(id, d); } return d; };
    const on = (e) => { if (e.pointerType === 'mouse') return; const d = dot(e.pointerId); d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; d.style.display = 'block'; };
    const off = (e) => { const d = dots.get(e.pointerId); if (d) setTimeout(() => { d.style.display = 'none'; }, 120); };
    window.addEventListener('pointerdown', on, true); window.addEventListener('pointermove', on, true);
    window.addEventListener('pointerup', off, true); window.addEventListener('pointercancel', off, true);
  };
  if (document.documentElement) install(); else document.addEventListener('DOMContentLoaded', install);
})();`;

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const projectJson = await readFile(projectPath, "utf8");

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
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, sel);

/** 주인공 x 를 시간에 따라 읽어 움직인 칸 수·칸당 ms 를 낸다. */
async function track(page, ms) {
  // 페이지 안 rAF 로 매 프레임 위치를 적는다(evaluate 왕복 지연이 짧은 경로를 흐리게 하지 않도록).
  return page.evaluate((ms) => new Promise((done) => {
    const out = []; const t0 = performance.now();
    const tick = () => { const t = performance.now() - t0; const s = window.__oprnPlayerSprite?.(); out.push({ t, x: s?.x ?? 0, y: s?.y ?? 0 }); if (t < ms) requestAnimationFrame(tick); else done(out); };
    requestAnimationFrame(tick);
  }), ms);
}
function speed(samples) {
  // 움직인 칸 수 + 첫 움직임부터 마지막 움직임까지 걸린 시간 / 칸 수 (페이지 안 rAF 기록).
  const start = samples[0];
  const movedAt = (i) => samples[i].x !== samples[i - 1].x || samples[i].y !== samples[i - 1].y;
  let first = -1, last = -1;
  for (let i = 1; i < samples.length; i += 1) if (movedAt(i)) { if (first < 0) first = i; last = i; }
  if (first < 0) return { tiles: 0, msPerTile: null };
  const end = samples[last];
  const tiles = Math.round((Math.abs(end.x - start.x) + Math.abs(end.y - start.y)) / 16);
  return { tiles, msPerTile: tiles ? Math.round((end.t - samples[first - 1].t) / tiles) : null };
}
async function runDevice(id, descriptor) {
  const outDir = join(outRoot, id);
  await mkdir(outDir, { recursive: true });
  const context = await browser.newContext({ ...descriptor, ...(wantVideo ? { recordVideo: { dir: outDir, size: descriptor.viewport } } : {}) });
  const page = await context.newPage();
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.addInitScript(([cp, always]) => { try { localStorage.clear(); if (always) localStorage.setItem("oprn:player-preferences:v1", JSON.stringify({ alwaysRun: true })); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "mobile-run", qaInstrumentation: true, qaCheckpoint: cp }; }, [PLAZA, alwaysRun]);
  await page.addInitScript(INSTRUMENT);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 360_000 });
  await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  await sleep(3000); await settle(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const result = { runButton: !!(await rect(page, '[data-testid="touch-run"]')) };
  const base = await rect(page, ".touch-dpad-base");
  const cx = base.x + base.w / 2, cy = base.y + base.h / 2, R = base.w / 2;
  await page.evaluate(() => { window.__mfStart = performance.now(); });
  const push = async (fraction, ms, label) => {
    await page.evaluate(() => window.__oprnDebug.teleport("fs_hub", 30, 33)); await sleep(700);
    await touch("touchStart", cx, cy); await sleep(60);
    for (let k = 1; k <= 4; k += 1) { await touch("touchMove", cx + R * fraction * k / 4, cy); await sleep(25); }
    const run = await page.evaluate(() => document.querySelector(".touch-stick-zone")?.dataset.run === "true");
    const samples = await track(page, ms);
    await touch("touchEnd"); await sleep(900);
    return { label, fraction, ringRun: run, ...speed(samples) };
  };
  result.stick = [await push(0.4, 1400, "small push (40% of radius)"), await push(0.95, 1400, "full push (95%)")];
  // 맵 탭: 3칸 / 9칸 오른쪽(주인공 화면 좌표 기준).
  const tapWalk = async (tiles) => {
    await page.evaluate(() => window.__oprnDebug.teleport("fs_hub", 30, 33)); await sleep(800);
    const hero = await page.evaluate(() => { const c = window.__oprnCamera(); const h = window.__oprnPlayerSprite(); const cv = document.querySelector(".play-stage canvas").getBoundingClientRect(); const k = cv.width / c.width; return { x: cv.left + (h.x - c.scrollX) * c.zoom * k, y: cv.top + (h.y - 8 - c.scrollY) * c.zoom * k, k: k * c.zoom }; });
    const tx = hero.x + tiles * 16 * hero.k, ty = hero.y;
    await touch("touchStart", tx, ty); await sleep(70); await touch("touchEnd");
    const samples = await track(page, 2600);
    await sleep(500);
    return { tiles, ...speed(samples) };
  };
  result.tap = [await tapWalk(4), await tapWalk(9)];
  await sleep(500);
  const video = page.video();
  await context.close();
  if (video) { const p = await video.path(); await rename(p, join(outDir, "run.webm")); }
  await writeFile(join(outDir, "result.json"), JSON.stringify(result, null, 2));
  console.log(id, JSON.stringify(result));
  return result;
}

await mkdir(outRoot, { recursive: true });
const summary = {};
try {
  for (const [id, d] of Object.entries({ "iphone15-land": devices["iPhone 15 landscape"], "iphone15": devices["iPhone 15"] })) if (!onlyDevice || id === onlyDevice) summary[id] = await runDevice(id, d);
} finally {
  await writeFile(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close(); await server.close();
}
