#!/usr/bin/env node
// One QA job in one headless browser against the mirror overlay. Boots the shipped player at the job's
// qaCheckpoint, drives it with the job's input mode (keyboard / mouse / touch), and records per step:
// a SETTLED frame (two samples agree, no transition overlay, dark frames waited out), the visible DOM text,
// DOM layout overflow, console/page errors, failed/blocked requests and missing textures.
//
// usage: node vm/player.mjs <job.json> <outDir>
// env:   QA_BASE=http://127.0.0.1:7812  CHROME=<chromium path>
//        QA_VIDEO=1  opt-in continuous recording -> <outDir>/video.webm (off by default; see recordVideo below)
//        QA_VIDEO_FPS=10  QA_VIDEO_FFMPEG=<ffmpeg path>  QA_VIDEO_KEEP_FRAMES=1
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { hiddenReason } from "../lib/hidden.mjs";
import { cutsceneOnScreen, isStuck, spendsStep } from "../lib/stuck.mjs";

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
const video = process.env.QA_VIDEO === "1" ? await startVideo() : null;
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
// The overflow measurement asks the same rule the tests pin (lib/hidden.mjs); an init script is not subject to the page CSP.
await page.addInitScript({ content: `window.__qaHiddenReason = ${hiddenReason.toString()};` });
await page.addInitScript({ content: `window.__qaCutsceneOnScreen = ${cutsceneOnScreen.toString()};` });

/**
 * Opt-in continuous recording (QA_VIDEO=1). CDP screencast frames carry the browser's capture time, so each frame is
 * stored with its offset from T0 — the same clock as trace.jsonl `t`. encode() resamples them to a constant frame rate
 * where video second s shows the last frame captured at or before T0 + s, i.e. the frame at trace `t` is at t/1000 s.
 * Frames are buffered on disk during play and encoded after the browser closes, so encoding does not compete with the
 * session; encode time is reported in summary.video.
 */
async function startVideo() {
  const dir = path.join(OUT, "video-frames");
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", (f) => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    const tMs = f.metadata?.timestamp ? Math.round(f.metadata.timestamp * 1000 - T0) : Date.now() - T0;
    const file = `${String(frames.length).padStart(6, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
    frames.push({ tMs, file });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
  return {
    stop: () => cdp.send("Page.stopScreencast"),
    async encode() {
      const fps = Number(process.env.QA_VIDEO_FPS ?? 10);
      const ffmpeg = process.env.QA_VIDEO_FFMPEG ?? findFfmpeg();
      const t0 = Date.now();
      frames.sort((a, b) => a.tMs - b.tMs);
      const out = { file: "video.webm", fps, frames: frames.length, firstFrameMs: frames[0]?.tMs ?? null, durationMs: Date.now() - T0 };
      if (!frames.length || !ffmpeg) return { ...out, error: frames.length ? "no ffmpeg" : "no frames" };
      // Before the first screencast frame there is nothing to show: those ticks repeat the first frame.
      const ticks = Math.ceil(((frames.at(-1).tMs + 1000) * fps) / 1000);
      const proc = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "pipe:0",
        "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "0", "-crf", "40",
        "-row-mt", "1", "-pix_fmt", "yuv420p", path.join(OUT, "video.webm")], { stdio: ["pipe", "ignore", "pipe"] });
      let err = "";
      proc.stderr.on("data", (d) => { err = (err + d).slice(-400); });
      proc.stdin.on("error", (e) => { err += ` stdin: ${e.code ?? e}`; });
      const closed = new Promise((resolve) => proc.on("close", resolve));
      let k = 0;
      for (let i = 0; i < ticks; i += 1) {
        const tick = (i * 1000) / fps;
        while (k + 1 < frames.length && frames[k + 1].tMs <= tick) k += 1;
        if (proc.exitCode !== null || proc.stdin.destroyed) break;
        if (!proc.stdin.write(fs.readFileSync(path.join(dir, frames[k].file)))) await Promise.race([new Promise((r) => proc.stdin.once("drain", r)), closed]);
      }
      proc.stdin.end();
      const code = await closed;
      if (code === 0 && process.env.QA_VIDEO_KEEP_FRAMES !== "1") fs.rmSync(dir, { recursive: true, force: true });
      else fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify(frames));
      return { ...out, ticks, encodeMs: Date.now() - t0, bytes: code === 0 ? fs.statSync(path.join(OUT, "video.webm")).size : 0, ...(code ? { error: `ffmpeg ${code}: ${err}` } : {}) };
    },
  };
}
/** Playwright ships an ffmpeg next to its browsers; a system ffmpeg works too. */
function findFfmpeg() {
  const root = path.join(process.env.HOME ?? "/root", ".cache/ms-playwright");
  for (const d of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    if (!d.startsWith("ffmpeg")) continue;
    for (const f of ["ffmpeg-linux", "ffmpeg-linux-arm64", "ffmpeg-mac"]) if (fs.existsSync(path.join(root, d, f))) return path.join(root, d, f);
  }
  for (const p of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) if (fs.existsSync(p)) return p;
  return null;
}

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
      cutscene: (() => { try { return window.__qaCutsceneOnScreen(document); } catch { return false; } })(),
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
      // Text the player cannot see (display:none / visually hidden on itself or an ancestor) is not measured.
      const chain = [];
      for (let n = el; n && n !== app.parentElement; n = n.parentElement) {
        const s = n === el ? cs : getComputedStyle(n);
        const box = n.getBoundingClientRect();
        chain.push({ cls: typeof n.className === "string" ? n.className : "", display: s.display, visibility: s.visibility, opacity: s.opacity, clip: s.clip, clipPath: s.clipPath, overflow: s.overflow + " " + s.overflowX + " " + s.overflowY, w: box.width, h: box.height });
      }
      if (window.__qaHiddenReason(chain)) continue;
      // An item scrolled out of a scrolling list is not "off screen": the list is the viewport for it.
      let scroller = el.parentElement;
      while (scroller && scroller !== app) {
        const sc = getComputedStyle(scroller);
        if (/(auto|scroll)/.test(sc.overflowY + sc.overflowX) && (scroller.scrollHeight > scroller.clientHeight + 2 || scroller.scrollWidth > scroller.clientWidth + 2)) break;
        scroller = scroller.parentElement;
      }
      if (scroller && scroller !== app) {
        const sr = scroller.getBoundingClientRect();
        if (r.bottom <= sr.top + 1 || r.top >= sr.bottom - 1 || r.right <= sr.left + 1 || r.left >= sr.right - 1) continue;
      }
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
  // With recording on, when the kept frame was captured: the video frame at shotT/1000 s shows this shot.
  let shotT = video && buf ? Date.now() - T0 : undefined;
  let settled = false;
  let darkMs = 0;
  let stats = buf ? await frameStats(buf) : null;
  for (let i = 0; buf && i < 12; i += 1) {
    await sleep(300);
    const nextBuf = await page.screenshot({ type: "jpeg", quality: 80 }).catch(() => null);
    if (!nextBuf) break;
    if (video) shotT = Date.now() - T0;
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
    seq, t, ...(video ? { shotT } : {}), label, file, settled, darkMs, lum: stats ? Math.round(stats.lum) : null, hash: buf ? await dhash(buf) : null,
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
  let sameSince = Date.now();
  let choiceRound = 0;
  let lastChoices = null;
  for (let step = 0; step < maxSteps && Date.now() - T0 < HARD_MS; step += 1) {
    const s = await readState();
    const now = sig(s);
    if (now === last) same += 1; else { same = 0; sameSince = Date.now(); }
    last = now;
    // A cutscene holding still must reach its stuck cap rather than run out the step budget (HARD_MS still bounds it).
    if (!spendsStep({ same, cutscene: s.cutscene === true })) step -= 1;
    // Stuck = no visible change for 6 polls AND 15 s: cutscenes with move routes and waits legitimately hold the
    // same state for several seconds while `running` is true. With a cutscene on screen the wait stretches to a fixed
    // cap (lib/stuck.mjs), so a cutscene waiting on its own timing is not a hang but a frozen one still is.
    if (isStuck({ same, unchangedMs: Date.now() - sameSince, cutscene: s.cutscene === true })) {
      // Before calling it stuck, try the plain keyboard path: if Enter moves the game where touch/mouse did not,
      // the defect is "this input mode is ignored here", not a soft-lock.
      if (job.input !== "keyboard") {
        note("fallback:Enter");
        await page.keyboard.press("Enter");
        await sleep(600);
        if (sig(await readState()) !== now) { await snap(`${label}-input-ignored`); same = 0; last = ""; continue; }
      }
      await snap(`${label}-stuck`);
      return { stuck: true, steps: step, state: s };
    }
    if (await visible("[data-testid='runtime-name-entry']")) {
      // Name entry: accept the default name through the confirm button (a scripted player cannot type a name).
      await snap(`${label}-name-entry`);
      note("name-entry:confirm");
      await page.locator("[data-testid='runtime-name-entry-confirm']").evaluate((n) => n.click()).catch(() => page.keyboard.press("Escape"));
      await sleep(600);
      continue;
    }
    if (s.screen === "battle") { await battle({ maxTurns: 6, label: `${label}-battle` }); continue; }
    if (s.screen === "shop") { await shop(label); continue; }
    if (s.screen === "ending" || s.screen === "gameover" || s.screen === "title") { await snap(`${label}-${s.screen}`); return { ended: s.screen, steps: step }; }
    // Vary choices across prompts for coverage, but take the first option when the same prompt comes back
    // (a "no" that re-asks would otherwise loop forever and read as a soft-lock).
    if (s.choices) { await snap(`${label}-choice`); await pickChoice(s.choices === lastChoices ? 0 : choiceRound++); lastChoices = s.choices; await sleep(400); continue; }
    if (s.dialogue) { if (step % 2 === 0) await snap(`${label}-dlg`); await confirm(); await sleep(350); continue; }
    if (s.menu) { await cancel(); await sleep(300); continue; }
    if (s.inputEnabled === true && s.running === false) { await snap(`${label}-free`); return { free: true, steps: step }; }
    // An event is running with nothing to answer (move routes, waits, fades): give it time rather than input.
    await sleep(1500);
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
  if ((await readState()).screen !== "battle") return { gridMs, noBattle: true };
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
  // Open the buy list first (the first command), then walk it: item names only exist on screen inside the list.
  for (const [k, l] of [["Enter", "buy-list"], ["ArrowDown", "down"], ["ArrowDown", "down2"], ["Enter", "detail"]]) { note(`shop:${k}`); await page.keyboard.press(k); await sleep(450); await snap(`${label}-shop-${l}`); }
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

/**
 * Adversarial input track. Each case does what a real player does on purpose and records what the game answered:
 * dialogue mashed through every input at once, menus opened mid-battle, a shop attempted with no gold, the party
 * shoved into every map edge, save/load in a loop, and mixed keyboard+mouse+touch in one session.
 * A finding is not "the script broke" but "the game got stuck / fell out of a screen / lost state" — those show up
 * in the settled frames and the deterministic checks the triage stage runs over this trace.
 */
async function adversarialScript(kind) {
  const s0 = await readState();
  await snap(`adv-${kind}-start`);
  if (kind === "mash-dialogue") {
    // Enter, arrows and a click at the same time: a dialogue that reads "press" as a state machine should advance and
    // never dead-end; an event that only handles one input shows up as a stuck frame.
    for (let i = 0; i < 30; i += 1) {
      note(`mash:${i}`);
      await Promise.all([
        page.keyboard.press("Enter").catch(() => {}),
        page.keyboard.press(i % 2 ? "ArrowDown" : "ArrowRight").catch(() => {}),
        page.mouse.click(700, 500).catch(() => {}),
      ]);
      await sleep(120);
      if (i % 6 === 0) await snap(`adv-mash-${i}`);
      const s = await readState();
      if (s.screen === "ending" || s.screen === "gameover") break;
    }
    await snap("adv-mash-end");
  } else if (kind === "mash-dialogue-touch") {
    for (let i = 0; i < 24; i += 1) {
      note(`mash-touch:${i}`);
      const box = await page.locator("[data-testid='dialogue-box']").first().boundingBox().catch(() => null);
      if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
      else await page.touchscreen.tap(vp.width / 2, vp.height / 2).catch(() => {});
      await sleep(150);
      if (i % 8 === 0) await snap(`adv-touch-mash-${i}`);
    }
    await snap("adv-touch-mash-end");
  } else if (kind === "menu-mid-battle" || kind === "menu-mid-battle-mouse") {
    // Enter the fight, then open the menu / cancel in the middle of command selection, then keep fighting.
    for (let i = 0; i < 40 && Date.now() - T0 < HARD_MS && (await readState()).screen !== "battle"; i += 1) {
      const s = await readState();
      if (s.choices) await pickChoice(0); else if (s.dialogue) await confirm(); else await sleep(700);
    }
    await snap("adv-battle-open");
    for (let round = 0; round < 4; round += 1) {
      note(`adv-battle:menu ${round}`);
      await page.keyboard.press("Escape"); await sleep(250);
      await snap(`adv-battle-menu-${round}`);
      await page.keyboard.press("Escape"); await sleep(200);
      await page.keyboard.press("ArrowDown"); await sleep(120);
      if (kind === "menu-mid-battle-mouse") {
        for (const sel of ["[data-testid='actor-command-fight']", "[data-testid='actor-command-item']"]) {
          if (await visible(sel)) { await page.locator(sel).first().click({ timeout: 2000 }).catch(() => {}); await sleep(200); }
        }
      }
      await page.keyboard.press("Enter"); await sleep(900);
      await page.keyboard.press("Enter"); await sleep(1400);
      await snap(`adv-battle-round-${round}`);
      if ((await readState()).screen !== "battle") break;
    }
    summary.after = await driveUntilFree({ maxSteps: 20, label: "adv-after-battle" });
  } else if (kind === "broke-shopper" || kind === "broke-shopper-touch") {
    // Walk to the shopkeeper and try to buy with zero gold: the game must refuse, not go negative or hang.
    await driveUntilFree({ maxSteps: 10, label: "adv-shop-enter" });
    for (let i = 0; i < 25 && Date.now() - T0 < HARD_MS * 0.6; i += 1) {
      const s = await readState();
      if (s.screen === "shop") break;
      if (s.choices) await pickChoice(0);
      else if (s.dialogue) await confirm();
      else {
        // Try every direction and the interact key; a shopkeeper indoors is usually adjacent.
        for (const dir of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) { await move(dir, 220); await confirm(); await sleep(120); if ((await readState()).screen === "shop") break; }
      }
      await sleep(400);
    }
    const at = await readState();
    summary.shopReached = at.screen === "shop";
    await snap("adv-shop-open");
    if (at.screen === "shop") {
      for (const key of ["Enter", "ArrowDown", "Enter", "Enter", "ArrowDown", "Enter"]) {
        note(`broke-shop:${key}`);
        await page.keyboard.press(key);
        await sleep(400);
        await snap(`adv-shop-${key}`);
      }
      for (let i = 0; i < 6 && (await readState()).screen === "shop"; i += 1) { await cancel(); await sleep(300); }
    }
    await snap("adv-shop-end");
  } else if (kind === "map-edges" || kind === "map-edges-mouse") {
    // Shove into each edge for a while; the player must stop at the border, never leave the map or the camera.
    for (const dir of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) {
      note(`edge:${dir}`);
      for (let i = 0; i < 6; i += 1) await move(dir, 500);
      const s = await snap(`adv-edge-${dir.toLowerCase()}`);
      const map = s.state;
      summary[`edge${dir.replace("Arrow", "")}`] = map ? { x: map.x, y: map.y, screen: map.screen } : null;
    }
    await snap("adv-edge-end");
  } else if (kind === "save-load") {
    // Open the save menu three times, saving and cancelling alternately; the session must survive every round.
    for (let round = 0; round < 3; round += 1) {
      note(`save-load:${round}`);
      await driveUntilFree({ maxSteps: 8, label: `adv-save-${round}` });
      await page.keyboard.press("Escape"); await sleep(600);
      await snap(`adv-save-menu-${round}`);
      for (let i = 0; i < 4; i += 1) { await page.keyboard.press("ArrowDown"); await sleep(150); }
      await page.keyboard.press("Enter"); await sleep(700);
      await snap(`adv-save-detail-${round}`);
      await page.keyboard.press("Enter"); await sleep(900);
      await snap(`adv-save-confirm-${round}`);
      await page.keyboard.press("Enter"); await sleep(900);
      await snap(`adv-save-done-${round}`);
      for (let i = 0; i < 3; i += 1) { await page.keyboard.press("Escape"); await sleep(300); }
      await snap(`adv-save-close-${round}`);
    }
  } else if (kind === "mixed-input") {
    // Keyboard for one action, a click for the next, a tap for the third — a state machine that reads them from
    // different places dead-ends here.
    for (let i = 0; i < 18; i += 1) {
      const s = await readState();
      note(`mixed:${i}:${s.screen}`);
      if (i % 3 === 0) await page.keyboard.press("Enter").catch(() => {});
      else if (i % 3 === 1) await page.mouse.click(vp.width / 2, vp.height * 0.62).catch(() => {});
      else await page.touchscreen.tap(vp.width / 2, vp.height * 0.62).catch(() => {});
      await sleep(350);
      if (i % 4 === 0) await snap(`adv-mixed-${i}`);
      if (s.dialogue) { await page.keyboard.press("ArrowDown").catch(() => {}); await sleep(120); }
    }
    await snap("adv-mixed-end");
  }
  return { kind, start: s0?.screen ?? null };
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
    // Story battles open with a cutscene: drive it until the battle screen shows up, then fight.
    for (let i = 0; i < 40 && Date.now() - T0 < HARD_MS && (await readState()).screen !== "battle"; i += 1) {
      const s = await readState();
      if (s.choices) await pickChoice(0); else if (s.dialogue) await confirm(); else await sleep(700);
      await sleep(300);
    }
    summary.result = await battle({ maxTurns: 10 });
    summary.after = await driveUntilFree({ maxSteps: 24, label: "after-battle" });
  } else if (job.script === "adversarial") {
    summary.result = await adversarialScript(job.adversarial);
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
  trace.end();
  if (video) await video.stop().catch(() => {});
  await browser.close().catch(() => {});
  if (video) summary.video = await video.encode().catch((e) => ({ error: String(e?.message ?? e).slice(0, 300) }));
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ id: job.id, steps: seq, ms: summary.ms, fatal: summary.fatal ?? null }));
}
