#!/usr/bin/env node
// One QA job in one headless browser against the mirror overlay. Boots the shipped player at the job's
// qaCheckpoint, drives it with the job's input mode (keyboard / mouse / touch), and records per step:
// a SETTLED frame (two samples agree, no transition overlay, dark frames waited out), the visible DOM text,
// DOM layout overflow, console/page errors, failed/blocked requests and missing textures.
//
// usage: node vm/player.mjs <job.json> <outDir>
// env:   QA_BASE=http://127.0.0.1:7812  CHROME=<chromium path>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
const BASE = `${process.env.QA_BASE ?? "http://127.0.0.1:7812"}/${job.slug}/${job.version}${job.plant ? "~" + job.plant : ""}`;
if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(BASE)) throw new Error("QA sessions may only read the local mirror overlay");
const CHROME = process.env.CHROME ?? "/root/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome";
const HARD_MS = job.hardMs ?? 240000;
const T0 = Date.now();
const trace = fs.createWriteStream(path.join(OUT, "trace.jsonl"));
const errors = [];
const net = [];
const blocked = [];
const recent = [];
let seq = 0;

const touch = job.input === "touch";
const vp = job.viewport ?? { width: 1440, height: 900 };
const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-dev-shm-usage", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required", "--disable-background-networking", "--disable-component-update"],
});
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, locale: "ko-KR", hasTouch: touch, isMobile: touch });
// Hard network guard: anything that is not the local overlay is aborted and recorded.
await ctx.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith("http://127.0.0.1:") || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
  blocked.push(url.slice(0, 200));
  return route.abort("blockedbyclient");
});
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
page.on("pageerror", (e) => errors.push({ kind: "pageerror", text: String(e?.message ?? e).slice(0, 300) }));
page.on("console", (m) => { if (m.type() === "error") errors.push({ kind: "console", text: m.text().slice(0, 300) }); });
page.on("requestfailed", (r) => { const u = r.url(); if (!blocked.includes(u.slice(0, 200))) net.push({ kind: "failed", url: u.slice(0, 200), why: r.failure()?.errorText ?? "" }); });
page.on("response", (r) => { if (r.status() >= 400) net.push({ kind: "http", status: r.status(), url: r.url().slice(0, 200) }); });

const boot = {
  projectUrl: `${BASE}/project.json`,
  saveNamespace: `qap-${job.id}-${Date.now()}`,
  touchControls: touch ? "on" : "auto",
  hostFeatures: ["fullscreen"],
  qaInstrumentation: true,
  ...(job.checkpoint ? { qaCheckpoint: job.checkpoint } : {}),
};
await page.addInitScript((b) => {
  try { Object.defineProperty(window, "__OPENRPG_BOOT__", { value: b, writable: false, configurable: false, enumerable: true }); }
  catch { window.__OPENRPG_BOOT__ = b; }
}, boot);

const sleep = (ms) => page.waitForTimeout(ms);
const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
function note(action) { recent.push({ t: Date.now() - T0, a: action }); if (recent.length > 12) recent.shift(); }

async function readState() {
  return page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid));
    let s = null;
    try { s = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent || "null"); } catch {}
    const screen = ids.has("title-screen") ? "title" : ids.has("ending-screen") ? "ending" : ids.has("game-over-screen") ? "gameover"
      : ids.has("battle-scene") ? "battle" : ids.has("shop-scene") ? "shop" : s ? "field" : "loading";
    const text = (sel) => { const n = document.querySelector(sel); return n ? (n.innerText || n.textContent || "").replace(/\s+/g, " ").trim() : null; };
    return {
      screen, mapId: s?.mapId ?? null, x: s?.player?.x ?? null, y: s?.player?.y ?? null,
      inputEnabled: s?.inputEnabled ?? null, running: s?.running ?? null, gold: s?.gold ?? null,
      dialogue: text("[data-testid='dialogue-box']"), choices: text("[data-testid='runtime-choices']"),
      menu: ids.has("main-menu"), grid: ids.has("battle-command-grid"), result: ids.has("battle-result-summary") || ids.has("battle-result-party"),
      transition: !!document.querySelector(".battle-transition-overlay, [data-testid='title-transition'], [data-testid='play-loading-overlay']"),
      missingResource: text("[data-testid='missing-resource-error']"),
      missingTextures: (() => { try { return window.__oprnMissingTextures?.()?.count ?? null; } catch { return null; } })(),
    };
  });
}

/** Visible UI text plus DOM-measured overflow: text clipped by its own box, or UI boxes leaving the viewport. */
async function domDump() {
  return page.evaluate(() => {
    const W = window.innerWidth, H = window.innerHeight;
    const app = document.querySelector("#app") ?? document.body;
    const overflow = [];
    const label = (el) => el.dataset?.testid ? `[${el.dataset.testid}]` : `${el.tagName.toLowerCase()}${el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : ""}`;
    for (const el of app.querySelectorAll("*")) {
      // QA-only mirrors and invisible event hit markers are instrumentation, not player-visible UI.
      if (el.tagName === "CANVAS" || el.closest("[data-testid='runtime-state-json'],[data-testid='status-menu-debug-json'],[data-testid='title-selection-json'],[data-testid^='event-']")) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const txt = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
      const clipsX = el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX + cs.overflow);
      const clipsY = el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY + cs.overflow);
      const offscreen = r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1;
      if (clipsX || clipsY || offscreen) overflow.push({ el: label(el), parent: el.parentElement ? label(el.parentElement) : null, text: txt, clipsX, clipsY, ellipsis: cs.textOverflow === "ellipsis", offscreen, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
      if (overflow.length >= 16) break;
    }
    const textOf = (n) => (n?.innerText || "").replace(/\s+/g, " ").trim();
    return { text: textOf(app).slice(0, 1600), overflow };
  });
}

async function frameStats(buf) {
  const { data } = await sharp(buf).resize(32, 18, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const v of data) sum += v;
  return { lum: sum / data.length, tiny: data };
}
function tinyDiff(a, b) { let d = 0; for (let i = 0; i < a.length; i += 1) d += Math.abs(a[i] - b[i]); return d / a.length; }
async function dhash(buf) {
  const { data } = await sharp(buf).resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

/**
 * Settled capture: wait out transition overlays, take two samples 300 ms apart and accept when they agree.
 * A fully dark frame is retried for up to 3.5 s; if it stays dark, that is recorded as a timeline, not a single frame.
 */
async function snap(label) {
  seq += 1;
  const t = Date.now() - T0;
  for (let i = 0; i < 10 && (await readState().catch(() => ({}))).transition; i += 1) await sleep(250);
  let buf = await page.screenshot({ type: "jpeg", quality: 80 }).catch(() => null);
  let settled = false;
  let darkMs = 0;
  let stats = buf ? await frameStats(buf) : null;
  for (let i = 0; buf && i < 12; i += 1) {
    await sleep(300);
    const nextBuf = await page.screenshot({ type: "jpeg", quality: 80 }).catch(() => null);
    if (!nextBuf) break;
    const nextStats = await frameStats(nextBuf);
    const dark = nextStats.lum < 10;
    if (dark) darkMs += 300;
    const agree = tinyDiff(stats.tiny, nextStats.tiny) < 3;
    buf = nextBuf;
    stats = nextStats;
    if (agree && (!dark || darkMs >= 3500)) { settled = true; break; }
  }
  const state = await readState().catch((e) => ({ screen: "unreadable", error: String(e).slice(0, 120) }));
  const dom = await domDump().catch(() => ({ text: "", overflow: [] }));
  const file = buf ? `${String(seq).padStart(3, "0")}-${String(label).replace(/[^a-zA-Z0-9_.-]+/g, "-").slice(0, 50)}.jpg` : null;
  if (buf) fs.writeFileSync(path.join(OUT, "shots", file), buf);
  const row = {
    seq, t, label, file, settled, darkMs, lum: stats ? Math.round(stats.lum) : null, hash: buf ? await dhash(buf) : null,
    state, dom, inputs: recent.map((r) => r.a), errors: errors.splice(0), net: net.splice(0), blocked: blocked.length,
  };
  trace.write(JSON.stringify(row) + "\n");
  return row;
}

// ---- input adapters: the same intent through keyboard, mouse or touch ----
async function confirm() {
  note(`${job.input}:confirm`);
  if (job.input === "keyboard") return page.keyboard.press("Enter");
  if (job.input === "touch" && (await visible("[data-testid='touch-action-a']"))) return page.locator("[data-testid='touch-action-a']").first().tap().catch(() => page.keyboard.press("Enter"));
  for (const sel of ["[data-testid='runtime-choices'] button:focus", "[data-testid='dialogue-box']", "[data-testid='title-press-start']"]) {
    if (await visible(sel)) return touch ? page.locator(sel).first().tap().catch(() => {}) : page.locator(sel).first().click({ timeout: 3000 }).catch(() => {});
  }
  return page.keyboard.press("Enter");
}
async function cancel() { note(`${job.input}:cancel`); return page.keyboard.press("Escape"); }
async function move(dir, ms = 500) {
  note(`${job.input}:move ${dir}`);
  if (job.input === "touch" && (await visible("[data-testid='touch-dpad']"))) {
    const box = await page.locator("[data-testid='touch-dpad']").first().boundingBox();
    if (box) {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2, d = box.width * 0.35;
      const [dx, dy] = { ArrowUp: [0, -d], ArrowDown: [0, d], ArrowLeft: [-d, 0], ArrowRight: [d, 0] }[dir];
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + dx, y: cy + dy }] });
      await sleep(ms);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach().catch(() => {});
      return;
    }
  }
  await page.keyboard.down(dir); await sleep(ms); await page.keyboard.up(dir);
}
async function pickChoice(index) {
  note(`${job.input}:choice ${index}`);
  const buttons = page.locator("[data-testid='runtime-choices'] button");
  const n = await buttons.count();
  if (n === 0) return confirm();
  const i = index % n;
  if (job.input === "keyboard") { for (let k = 0; k < i; k += 1) { await page.keyboard.press("ArrowDown"); await sleep(120); } return page.keyboard.press("Enter"); }
  return touch ? buttons.nth(i).tap().catch(() => buttons.nth(i).click()) : buttons.nth(i).click({ timeout: 3000 }).catch(() => page.keyboard.press("Enter"));
}

// ---- scripts ----
function sig(s) { return `${s.screen}|${s.mapId}|${s.x},${s.y}|${(s.dialogue ?? "").slice(0, 60)}|${(s.choices ?? "").slice(0, 40)}|${s.menu}|${s.grid}`; }

/** Drive whatever the game shows until control returns to the player; flags a stuck run when inputs stop changing anything. */
async function driveUntilFree({ maxSteps = 40, label = "ev" } = {}) {
  let same = 0;
  let last = "";
  let choiceRound = 0;
  for (let step = 0; step < maxSteps && Date.now() - T0 < HARD_MS; step += 1) {
    const s = await readState();
    const now = sig(s);
    same = now === last ? same + 1 : 0;
    last = now;
    if (same >= 6) { await snap(`${label}-stuck`); return { stuck: true, steps: step, state: s }; }
    if (s.screen === "battle") { await battle({ maxTurns: 6, label: `${label}-battle` }); continue; }
    if (s.screen === "shop") { await shop(label); continue; }
    if (s.screen === "ending" || s.screen === "gameover" || s.screen === "title") { await snap(`${label}-${s.screen}`); return { ended: s.screen, steps: step }; }
    if (s.choices) { await snap(`${label}-choice`); await pickChoice(choiceRound++); await sleep(400); continue; }
    if (s.dialogue) { if (step % 2 === 0) await snap(`${label}-dlg`); await confirm(); await sleep(350); continue; }
    if (s.menu) { await cancel(); await sleep(300); continue; }
    if (s.inputEnabled === true && s.running === false) { await snap(`${label}-free`); return { free: true, steps: step }; }
    await sleep(500);
  }
  await snap(`${label}-budget`);
  return { budget: true };
}

async function battle({ maxTurns = 8, label = "battle" } = {}) {
  const t0 = Date.now();
  let gridMs = null;
  for (let i = 0; i < 60 && !(await visible("[data-testid='battle-command-grid']")); i += 1) {
    if ((await readState()).result) break;
    await sleep(250);
  }
  gridMs = Date.now() - t0;
  await snap(`${label}-grid`);
  for (let turn = 0; turn < maxTurns && Date.now() - T0 < HARD_MS; turn += 1) {
    const s = await readState();
    if (s.result || s.screen !== "battle") break;
    if (s.grid) {
      const cmd = ["attack", "skill", "attack", "item", "defend", "attack"][turn % 6];
      const sel = `[data-testid='actor-command-${cmd}']`;
      if (job.input === "keyboard" || !(await visible(sel))) { note("battle:Enter"); await page.keyboard.press("Enter"); }
      else { note(`battle:${cmd}`); await (touch ? page.locator(sel).first().tap() : page.locator(sel).first().click({ timeout: 3000 })).catch(() => page.keyboard.press("Enter")); }
      await sleep(500);
      if (turn % 2 === 0) await snap(`${label}-t${turn}-${cmd}`);
      await page.keyboard.press("Enter"); await sleep(1400);
    } else { await page.keyboard.press("Enter"); await sleep(600); }
  }
  await snap(`${label}-end`);
  for (let i = 0; i < 8 && (await readState()).screen === "battle"; i += 1) { await page.keyboard.press("Enter"); await sleep(500); }
  return { gridMs };
}

async function shop(label) {
  await snap(`${label}-shop`);
  for (const [k, l] of [["ArrowDown", "down"], ["ArrowDown", "down2"], ["Enter", "detail"]]) { note(`shop:${k}`); await page.keyboard.press(k); await sleep(450); await snap(`${label}-shop-${l}`); }
  for (let i = 0; i < 5 && (await readState()).screen === "shop"; i += 1) { await cancel(); await sleep(350); }
}

async function menuTour() {
  note("menu:open"); await page.keyboard.press("Escape"); await sleep(700);
  await snap("menu-open");
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("ArrowDown"); await sleep(200);
    await page.keyboard.press("Enter"); await sleep(600); note(`menu:item ${i + 1}`);
    await snap(`menu-${i + 1}`);
    await page.keyboard.press("ArrowDown"); await sleep(200);
    await snap(`menu-${i + 1}-down`);
    await cancel(); await sleep(400);
  }
  for (let i = 0; i < 3 && (await readState()).menu; i += 1) { await cancel(); await sleep(300); }
}

const summary = { id: job.id, kind: job.kind, input: job.input, viewport: job.viewportName, plant: job.plant ?? null, target: job.target ?? null };
try {
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 120000 });
  // The file picker is what the player shows when it refuses a project (load-time validation failed).
  const ready = job.checkpoint ? "[data-testid='runtime-state-json'], [data-testid='battle-scene'], [data-testid='oprn-game-file-picker']" : "[data-testid='title-screen'], [data-testid='oprn-game-file-picker']";
  await page.waitForSelector(ready, { timeout: 120000, state: "attached" });
  summary.bootMs = Date.now() - T0;
  if (await page.locator("[data-testid='oprn-game-file-picker']").count()) {
    const why = await page.locator("[data-testid='oprn-game-file-picker-status']").innerText().catch(() => "");
    throw new Error(`boot refused: ${(why || (await page.evaluate(() => document.body.innerText))).replace(/\s+/g, " ").slice(0, 300)}`);
  }
  await sleep(700);
  if (job.script === "title") {
    await snap("title");
    await confirm(); await sleep(1500);
    summary.result = await driveUntilFree({ maxSteps: 30, label: "newgame" });
    await move("ArrowDown", 600); await snap("first-move");
  } else if (job.script === "menu") {
    await snap("boot");
    await menuTour();
  } else if (job.script === "walk") {
    await snap("enter");
    summary.result = await driveUntilFree({ maxSteps: 16, label: "enter" });
    for (const dir of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) {
      const before = await readState();
      await move(dir, 700);
      const s = await snap(`walk-${dir.replace("Arrow", "").toLowerCase()}`);
      s.moved = before.x !== s.state.x || before.y !== s.state.y;
      if (s.state.dialogue || s.state.screen !== "field") await driveUntilFree({ maxSteps: 12, label: "walk-ev" });
    }
  } else if (job.script === "battle") {
    summary.result = await battle({ maxTurns: 10 });
    summary.after = await driveUntilFree({ maxSteps: 12, label: "after-battle" });
  } else {
    await snap("start");
    summary.result = await driveUntilFree({ maxSteps: 50, label: "ev" });
  }
} catch (error) {
  summary.fatal = String(error?.message ?? error).slice(0, 400);
  await snap("fatal").catch(() => {});
} finally {
  summary.ms = Date.now() - T0;
  summary.steps = seq;
  summary.blocked = blocked.slice(0, 20);
  summary.blockedCount = blocked.length;
  summary.leftoverErrors = errors.slice(0, 20);
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
  trace.end();
  await browser.close().catch(() => {});
  console.log(JSON.stringify({ id: job.id, steps: seq, ms: summary.ms, fatal: summary.fatal ?? null }));
}
