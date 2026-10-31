// Hard-logic battery — scripted playthrough of one run's game in the SHIPPED player (wholeGamePlayer --serve + Firefox).
//
//   node scripts/qa/script-ab/hard/walk-hard.mjs --project-dir <run>/project --mech <id> --out <dir> [--video] [--netns]
//
// Checks are fixed per mechanic (same for every model). Events are found by their stage names («@name»), so no binding
// file is needed. Each mechanic covers its success AND failure paths, and save → reload → load where the request asks
// for persistence. Output <out>/walk.json {checks:[{id,pass,note,texts}], transcript, choices} and <out>/video/walk.webm.
// Generated from walk-head/walk-base/walk-mechs parts by build-walk.sh — edit the parts.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "playwright";
import { battleQaOp } from "../../../lib/runtimeQaBattle.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
if (process.argv.includes("--netns") && process.env.OPRN_QA_IN_NETNS !== "1") {
  const inner = process.argv.slice(1).filter((a) => a !== "--netns").map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");
  const r = spawnSync("unshare", ["-rn", "bash", "-c", `ip link set lo up && exec ${JSON.stringify(process.execPath)} ${inner}`], { stdio: "inherit", env: { ...process.env, OPRN_QA_IN_NETNS: "1" } });
  process.exit(r.status ?? 1);
}
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const projectDir = resolve(opt("project-dir"));
const request = opt("mech");
let bind = {};
const out = resolve(opt("out"));
const video = argv.includes("--video");
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- server ----------
const serveOut = mkdtempSync(join(tmpdir(), "hard-walk-"));
const child = spawn(process.execPath, [join(REPO, "src/harnesses/assistant-capability/node/wholeGamePlayer.mjs"), "--project-dir", projectDir, "--out", serveOut, "--serve"], { cwd: REPO, stdio: ["ignore", "pipe", "inherit"] });
const served = await new Promise((done, fail) => {
  let buf = "";
  const timer = setTimeout(() => fail(new Error("serve timeout")), 600_000);
  child.stdout.on("data", (c) => { buf += c; const line = buf.split("\n").find((r) => r.startsWith("{")); if (line) { try { done(JSON.parse(line)); clearTimeout(timer); } catch {} } });
  child.on("exit", (code) => fail(new Error(`wholeGamePlayer exit ${code}`)));
});
const project = JSON.parse(readFileSync(join(serveOut, "player.json"), "utf8"));
const maps = project.maps ?? {};
const mapList = Array.isArray(maps) ? maps : Object.values(maps);
// A/B 2: a binding string «@<event name>» resolves to the id of the event with that name (stage checkpoints fix the
// names; a run that replaced an event with a new one keeps the name). «@<name>#n» picks the n-th such event.
const byName = (name) => { const [n, k] = name.split("#"); const hits = mapList.flatMap((m) => (m.events ?? []).filter((e) => (e.name ?? e.pages?.[0]?.name ?? "").trim() === n)); return hits[Number(k ?? 0)]?.id; };
const resolveBind = (v) => typeof v === "string" && v.startsWith("@") ? (byName(v.slice(1)) ?? v) : Array.isArray(v) ? v.map(resolveBind) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveBind(x)])) : v;
bind = resolveBind(bind);
function findEvent(id) {
  for (const m of mapList) for (const e of m.events ?? []) if (e.id === id) return { mapId: m.id, x: e.x, y: e.y, event: e, map: m };
  throw new Error(`event ${id} not found`);
}

// ---------- browser ----------
const browser = await firefox.launch({ firefoxUserPrefs: { "network.notify.changed": false, "network.notify.IPv6": false } });
const viewport = { width: 960, height: 720 };
const videoT0 = Date.now();
const context = await browser.newContext({ viewport, ...(video ? { recordVideo: { dir: join(out, "video"), size: viewport } } : {}) });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));
await page.addInitScript(([projectUrl]) => {
  try { if (!sessionStorage.getItem('hw-init')) { localStorage.clear(); sessionStorage.setItem('hw-init', '1'); } } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "hard-walk", qaInstrumentation: true };
  // Transcript: every distinct dialogue / choice / number prompt / battle message text, in order.
  window.__sabLog = [];
  let last = "";
  const grab = () => {
    const parts = [];
    for (const sel of ["[data-testid='dialogue-box']", "[data-testid='dialogue-choice-frame']", "[data-testid='runtime-input-number']", "[data-testid='battle-message-window']", "[data-testid='ending-screen']"]) {
      for (const n of document.querySelectorAll(sel)) { const t = (n.textContent ?? "").replace(/\s+/g, " ").trim(); if (t) parts.push(t); }
    }
    const text = parts.join(" | ");
    if (!text || text === last) return;
    // Typewriter: a longer text that shares (almost) all of the previous one replaces it instead of adding a row.
    let k = 0; while (k < last.length && k < text.length && last[k] === text[k]) k += 1;
    const log = window.__sabLog;
    if (log.length && text.length >= last.length && k >= Math.max(1, last.replace(/[▼■].*$/u, "").length - 12) && Date.now() - log[log.length - 1].t < 4000) log[log.length - 1] = { t: Date.now(), text };
    else log.push({ t: Date.now(), text });
    last = text;
  };
  new MutationObserver(() => grab()).observe(document, { subtree: true, childList: true, characterData: true });
}, [served.boot.projectUrl]);
await page.goto(served.playUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 180_000 });

const st = async () => { for (let i = 0; i < 40; i += 1) { const v = await page.evaluate(() => window.__oprnDebug?.readState?.() ?? null).catch(() => null); if (v) return v; await sleep(250); } return null; };
const fieldReadyJs = `(() => { const s = window.__oprnDebug?.readState?.(); if (!s?.currentMapId) return false;
  if (document.querySelector("[data-testid='dialogue-box'], [data-testid='battle-scene'], [data-testid='main-menu'], [data-testid='dialogue-choice-frame'], [data-testid='runtime-input-number'], [data-testid='battle-transition-overlay'], [data-testid='ending-screen'], .battle-return-settle")) return false;
  return !/건너뛰기/.test(document.body.innerText); })()`;
const fieldReady = () => page.evaluate(fieldReadyJs).catch(() => false);
const has = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((n) => { const cs = getComputedStyle(n); return n.getClientRects().length > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; }), sel).catch(() => false);
const boxText = () => page.evaluate(() => (document.querySelector("[data-testid='dialogue-box']")?.textContent ?? "").replace(/\s+/g, " ").trim()).catch(() => "");
/** Press Enter on an open message and wait until it changed or closed — never press Enter on the free field (that is «interact»). */
async function advanceMessage() {
  const before = await boxText();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 20; i += 1) {
    await sleep(100);
    if (!(await has("[data-testid='dialogue-box']"))) { await sleep(250); return; }
    const now = await boxText();
    if (now !== before) { await sleep(150); return; }
  }
}
const endingVisible = () => has("[data-testid='ending-screen']");
const logLen = () => page.evaluate(() => window.__sabLog.length);
const logSince = (n) => page.evaluate((k) => window.__sabLog.slice(k).map((r) => r.text), n);

/**
 * Advance whatever the game shows until the field is free again: Enter through messages, answer choices from
 * plan.choices (index or RegExp source), type plan.numbers into number input. Returns the texts shown meanwhile.
 */
const seenChoices = [];
async function drain(plan = {}, { maxMs = 45_000, start: from } = {}) {
  const choices = [...(plan.choices ?? [])], numbers = [...(plan.numbers ?? [])];
  const start = from ?? await logLen();
  const t0 = Date.now(); let freeSince = null;
  while (Date.now() - t0 < maxMs) {
    if (await endingVisible()) break;
    if (await has("[data-testid='battle-scene']")) break;
    if (await has("[data-testid='runtime-input-number']")) {
      const n = numbers.length ? String(numbers.shift()) : "0000";
      for (const d of n) { await page.keyboard.press(d); await sleep(80); }
      await sleep(150); await page.keyboard.press("Enter"); await sleep(500); freeSince = null; continue;
    }
    if (await has("[data-testid='dialogue-choice-frame']")) {
      const opts = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='runtime-choice-']")].filter((n) => /^runtime-choice-\d+$/.test(n.dataset.testid ?? "")).map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim()));
      seenChoices.push(opts);
      let index = 0;
      if (plan.chooser) index = await plan.chooser(opts, await logSince(start));
      else {
        const want = choices.length ? choices.shift() : (plan.defaultChoice ?? 0);
        index = typeof want === "number" ? want : 0;
        if (typeof want === "string") { const re = new RegExp(want); const k = opts.findIndex((o) => re.test(o)); index = k >= 0 ? k : (plan.missChoice ?? 0); }
      }
      if (index < 0) index = 0;
      const clicked = opts.length ? await page.evaluate((k) => { const b = document.querySelector(`[data-testid='runtime-choice-${k}']`); if (!b) return false; b.click(); return true; }, index) : false;
      if (!clicked) { for (let i = 0; i < index; i += 1) { await page.keyboard.press("ArrowDown"); await sleep(120); } await page.keyboard.press("Enter"); }
      await sleep(500); if (clicked && await has("[data-testid='dialogue-choice-frame']") && JSON.stringify(opts) === JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("[data-testid^='runtime-choice-']")].filter((n) => /^runtime-choice-\d+$/.test(n.dataset.testid ?? "")).map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim())))) { for (let i = 0; i < index; i += 1) { await page.keyboard.press("ArrowDown"); await sleep(120); } await page.keyboard.press("Enter"); await sleep(400); }
      freeSince = null; continue;
    }
    if (await has("[data-testid='dialogue-box']")) { await advanceMessage(); freeSince = null; continue; }
    if (await fieldReady()) { freeSince ??= Date.now(); if (Date.now() - freeSince > 900) break; }
    else freeSince = null;
    await sleep(150);
  }
  return logSince(start);
}
async function toField() { await drain({}, { maxMs: 30_000 }); }
async function teleport(mapId, x, y) {
  for (let i = 0; i < 80; i += 1) { if (await page.evaluate(() => Boolean(window.__oprnDebug?.teleport)).catch(() => false)) break; await sleep(250); }
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [mapId, x, y]);
  for (let i = 0; i < 60; i += 1) { const s = await st(); if (s?.currentMapId === mapId && s.x === x && s.y === y && await fieldReady()) break; await sleep(150); }
  await sleep(250);
}
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: "down", down: "up", left: "right", right: "left" };
function livePos(s, id) { const loc = s?.eventLocations?.[id]; return loc ? { x: loc.x, y: loc.y, mapId: loc.mapId } : null; }
function passable(map, x, y) {
  if (x < 0 || y < 0 || x >= (map.width ?? 999) || y >= (map.height ?? 999)) return false;
  const p = map.passability ?? map.passable; // best effort — teleport result is the real check
  return p ? p[y * map.width + x] !== false && p[y * map.width + x] !== 0 : true;
}
/** Stand next to an event (or a cell), face it, press action, drain. side: preferred side ('down' = stand below). */
async function talk(id, plan = {}, side) {
  await toField();
  const ev = findEvent(id);
  const s0 = await st();
  const live = livePos(s0, id);
  const ex = live?.x ?? ev.x, ey = live?.y ?? ev.y;
  const order = [side, "down", "up", "left", "right"].filter(Boolean);
  const occupied = new Set((ev.map.events ?? []).map((e) => `${e.x},${e.y}`));
  for (const sd of order) {
    const [dx, dy] = DIRS[sd]; const x = ex + dx, y = ey + dy;
    if (!passable(ev.map, x, y) || occupied.has(`${x},${y}`)) continue;
    await teleport(ev.mapId, x, y);
    const s = await st();
    if (s?.x !== x || s?.y !== y || s.currentMapId !== ev.mapId) continue;
    await page.evaluate((d) => window.__oprnInput.face(d), OPP[sd]); await sleep(150);
    const before = await logLen();
    await page.evaluate(() => window.__oprnInput.action()); await sleep(400);
    const texts = await drain(plan, { start: before });
    if (texts.length || (await logLen()) > before || plan.silentOk) return texts;
  }
  return [];
}
/** Walk onto a cell from a neighbour (touch / step triggers). from = side the player comes from. */
async function stepOn(mapId, x, y, from = "down", plan = {}) {
  await toField();
  for (const side of [from, "down", "up", "left", "right"].filter((v, i, a) => a.indexOf(v) === i)) {
    const [dx, dy] = DIRS[side];
    await teleport(mapId, x + dx, y + dy);
    const s = await st();
    if (s?.currentMapId !== mapId || s.x !== x + dx || s.y !== y + dy) continue;
    const before = await logLen();
    await page.evaluate((d) => window.__oprnInput.dir(d), OPP[side]); await sleep(420);
    await page.evaluate(() => window.__oprnInput.dir(null)); await sleep(500);
    const texts = await drain(plan, { start: before });
    return { texts: texts.length ? texts : await logSince(before), at: await st() };
  }
  return { texts: [], at: await st() };
}
/** Try to walk `tiles` cells in `dir` from a cell. Returns the final state (map, x, y). */
async function tryWalk(mapId, x, y, dir, tiles = 2) {
  await toField(); await teleport(mapId, x, y);
  await page.evaluate((d) => window.__oprnInput.face(d), dir); await sleep(100);
  await page.evaluate((d) => window.__oprnInput.dir(d), dir); await sleep(320 * tiles + 250);
  await page.evaluate(() => window.__oprnInput.dir(null)); await sleep(700);
  await drain({}, { maxMs: 8000 });
  for (let i = 0; i < 20; i += 1) { if (await fieldReady()) break; await sleep(200); }
  return st();
}
const dbg = async (fn, ...a) => { for (let i = 0; i < 80; i += 1) { if (await page.evaluate(() => Boolean(window.__oprnDebug)).catch(() => false)) break; await sleep(250); } return page.evaluate(([f, args]) => window.__oprnDebug[f](...args), [fn, a]); };

// ---------- checks ----------
const checks = [];
let lastCheckAt = Date.now();
const check = (id, pass, note, texts = []) => { const now = Date.now(); checks.push({ id, pass: Boolean(pass), note, texts: texts.slice(-8), startSec: (lastCheckAt - videoT0) / 1000, endSec: (now - videoT0) / 1000 }); lastCheckAt = now; console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${note}`); };
const joined = (t) => t.join(" / ");
const t0 = Date.now();

// Boot → new game → first controllable field.
for (let i = 0; i < 25; i += 1) { if ((await st())?.currentMapId) break; await page.keyboard.press("Enter"); await sleep(2500); }
await page.evaluate(() => window.__oprnDebug.setSeed?.(1)).catch(() => {});
for (let i = 0; i < 60 && !(await fieldReady()); i += 1) { if (/건너뛰기/.test(await page.evaluate(() => document.body.innerText))) await page.keyboard.press("Escape"); else await page.keyboard.press("Enter"); await sleep(600); }
const boot = await st();
check("boot", Boolean(boot?.currentMapId) && await fieldReady(), `field ${boot?.currentMapId} (${boot?.x},${boot?.y})`);

async function finishTo(steps) {
  // Follow the binding's route to the ending: talk / step / walk entries.
  for (const s of steps ?? []) {
    if (await endingVisible()) break;
    if (s.talk) await talk(s.talk, s.plan ?? {}, s.side);
    else if (s.step) await stepOn(s.step[0], s.step[1], s.step[2], s.step[3] ?? "down", s.plan ?? {});
    else if (s.walk) await tryWalk(s.walk[0], s.walk[1], s.walk[2], s.walk[3], s.walk[4] ?? 2);
    else if (s.battle) await fightBoss();
    await sleep(500);
  }
  for (let i = 0; i < 40 && !(await endingVisible()); i += 1) { await page.keyboard.press("Enter"); await sleep(500); }
  return endingVisible();
}
async function fightBoss() {
  const start = await logLen();
  for (let round = 0; round < 40; round += 1) {
    if (!(await has("[data-testid='battle-scene']"))) { await sleep(800); if (!(await has("[data-testid='battle-scene']"))) break; }
    await page.evaluate(() => { const ids = window.__oprnDebug.readState().partyActorIds; for (const id of ids) window.__oprnSetActorVitals?.(id, 9999, 999); }).catch(() => {});
    await battleQaOp(page, { kind: "battle", fallback: "attack", commands: 1, timeoutMs: 60_000 }).catch(() => {});
  }
  // battle result → field
  await drain({}, { maxMs: 30_000 });
  return { texts: await logSince(start), battleLog: await page.evaluate(() => window.__qaBattleLog ?? []) };
}

// ---------- battery helpers ----------
const evId = (name) => { const v = byName(name); if (!v) throw new Error(`no event named «${name}»`); return v; };
const T = (name, plan = {}, side) => talk(evId(name), plan, side);
const evPos = async (name) => { const ev = findEvent(evId(name)); const l = livePos(await st(), ev.event.id); return { mapId: l?.mapId ?? ev.mapId, x: l?.x ?? ev.x, y: l?.y ?? ev.y, dir: (await st())?.eventLocations?.[ev.event.id]?.direction ?? null }; };
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const stepEv = async (name, from = "left", plan = {}) => { const p = await evPos(name); return stepOn(p.mapId, p.x, p.y, from, plan); };
async function guard(cid, fn) { try { await fn(); } catch (e) { check(cid, false, `error: ${String(e?.message ?? e).split("\n")[0]}`); } }
const db = project.database ?? {};
const recs = (k) => { const v = db[k]; return Array.isArray(v) ? v : v ? Object.values(v) : []; };
const itemIds = (name) => recs("items").filter((i) => (i.name ?? "").trim() === name).map((i) => i.id);
const itemIdsLike = (re) => recs("items").filter((i) => re.test(i.name ?? "")).map((i) => i.id);
const count = (s, ids) => ids.reduce((n, id) => n + (s?.inventory?.[id] ?? 0), 0);
const inv = async (name) => count(await st(), itemIds(name));
/** chooser that walks a list of preference regexes (stateful per step) and falls back to `fallback` regexes. */
function prefer(steps, fallback = [], { cap = 30 } = {}) {
  let i = 0, n = 0;
  return (opts) => {
    n += 1; if (n > cap) { const k = opts.findIndex((o) => /그만|취소|아니|나가|됐|끝|안 해|안 할|돌아/.test(o)); return k >= 0 ? k : opts.length - 1; }
    if (i < steps.length) for (const re of [steps[i]].flat()) { const k = opts.findIndex((o) => re.test(o)); if (k >= 0) { i += 1; return k; } }
    for (const re of fallback.flat()) { const k = opts.findIndex((o) => re.test(o)); if (k >= 0) return k; }
    return 0;
  };
}
async function openMainMenu() {
  await toField();
  for (let k = 0; k < 3; k += 1) {
    await page.keyboard.press("Escape");
    for (let i = 0; i < 20; i += 1) { if (await has("[data-testid='status-menu-command-save'], [data-testid='status-menu-command-rail']")) return true; await sleep(200); }
  }
  return false;
}
async function closeMenus() { for (let i = 0; i < 8 && !(await fieldReady()); i += 1) { await page.keyboard.press("Escape"); await sleep(400); } }
const domClick = (sel) => page.evaluate((q) => { const n = [...document.querySelectorAll(q)].find((x) => x.getClientRects().length) ?? document.querySelector(q); if (!n) return false; n.click(); return true; }, sel);
async function waitSel(sel, ms = 8000) { for (let t = 0; t < ms; t += 200) { if (await page.$(sel)) return true; await sleep(200); } return false; }
let lastSaveMsg = "";
async function saveGame() {
  if (!(await openMainMenu())) throw new Error("main menu did not open");
  if (!(await domClick("[data-testid='status-menu-command-save']"))) { await domClick("[data-testid='status-menu-command-system-menu']"); await sleep(700); if (!(await domClick("[data-testid='status-menu-group-command-save']"))) throw new Error("no save command in the menu"); }
  if (!(await waitSel("[data-testid='save-slot-1']"))) throw new Error("save slots did not open");
  await domClick("[data-testid='save-slot-1']");
  await sleep(900);
  let msg = await page.evaluate(() => document.querySelector("[data-testid='status-menu-message']")?.textContent?.trim() ?? "");
  if (/다시 선택/.test(msg)) { await domClick("[data-testid='save-slot-1']"); await sleep(900); msg = await page.evaluate(() => document.querySelector("[data-testid='status-menu-message']")?.textContent?.trim() ?? ""); }
  lastSaveMsg = msg;
  const saved = /저장했습니다/.test(msg) ? 1 : 0;
  await closeMenus();
  if (!saved) console.log(`save refused: «${msg}»`);
  return saved > 0;
}
async function loadGame() {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 180_000 });
  await sleep(1500);
  const clicked = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[data-testid='title-screen'] [data-testid], [data-testid='title-screen'] button, [data-testid='title-screen'] li")];
    const hit = nodes.find((n) => n.dataset?.testid === "title-load-game") ?? nodes.find((n) => /불러오기|이어하기|이어서/.test(n.textContent ?? "") && !/방금/.test(n.textContent ?? ""));
    if (hit) { hit.click(); return hit.dataset?.testid || hit.textContent.trim(); }
    return null;
  });
  if (!clicked) { await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await sleep(300); await page.keyboard.press("Enter"); }
  if (!(await waitSel("[data-testid='save-slot-1']", 10_000))) throw new Error(`load panel did not open (title pick ${clicked})`);
  const slotText = await page.evaluate(() => document.querySelector("[data-testid='save-slot-1']")?.textContent ?? "");
  if (/비어/.test(slotText)) throw new Error(`slot 1 is empty — the save was refused («${lastSaveMsg}»)`);
  await domClick("[data-testid='save-slot-1']");
  for (let i = 0; i < 60; i += 1) { if ((await st())?.currentMapId && !(await has("[data-testid='title-screen']"))) break; await sleep(500); }
  for (let i = 0; i < 40 && !(await fieldReady()); i += 1) { if (await has("[data-testid='dialogue-box'], [data-testid='dialogue-choice-frame']")) await page.keyboard.press("Enter"); await sleep(400); }
  return Boolean((await st())?.currentMapId);
}
/** Is a door passable now? Tries to walk into it from each free neighbour (after talking to it once). */
async function doorOpen(name) {
  const ev = findEvent(evId(name));
  await talk(ev.event.id, { silentOk: true, choices: [0, 0] }).catch(() => {});
  const p = await evPos(name);
  const occupied = new Set((ev.map.events ?? []).filter((e) => e.id !== ev.event.id).map((e) => `${e.x},${e.y}`));
  const tried = [];
  for (const side of ["down", "up", "left", "right"]) {
    const [dx, dy] = DIRS[side]; const x = p.x + dx, y = p.y + dy;
    if (!passable(ev.map, x, y) || occupied.has(`${x},${y}`)) continue;
    const s = await tryWalk(p.mapId, x, y, OPP[side], 2);
    if (!(s.currentMapId === p.mapId && s.x === x && s.y === y) && !(s.currentMapId === p.mapId && dist(s, { x, y }) === 0)) {
      const moved = s.currentMapId !== p.mapId || (OPP[side] === "up" ? s.y <= p.y : OPP[side] === "down" ? s.y >= p.y : OPP[side] === "left" ? s.x <= p.x : s.x >= p.x);
      tried.push(`${side}:${s.currentMapId === p.mapId ? `${s.x},${s.y}` : s.currentMapId}`);
      if (moved) return { open: true, note: tried.join(" ") };
    } else tried.push(`${side}:stuck`);
  }
  return { open: false, note: tried.join(" ") || "no free side" };
}
const lines = (t) => t.length;

try {
  if (request === "probe-menu") {
    await openMainMenu(); await page.evaluate(() => document.querySelector("[data-testid='status-menu-command-system-menu']").click()); await sleep(1000);
    const ids = await page.evaluate(() => [...document.querySelectorAll("[data-testid]")].filter((n) => n.getClientRects().length).map((n) => `${n.dataset.testid}:${(n.textContent ?? "").trim().slice(0, 12)}`));
    console.log(ids.join("\n")); await page.screenshot({ path: join(out, "menu.png") });
  } else if (request === "probe-loc") {
    const ev = findEvent(evId(opt("name") ?? "석상 1")); await teleport(ev.mapId, ev.x, ev.y + 1); await sleep(1500);
    const s = await st(); console.log(JSON.stringify(s.eventLocations?.[ev.event.id]), Object.keys(s.eventLocations ?? {}).length);
    console.log(JSON.stringify(await page.evaluate(() => window.__oprnCharacterSprites?.() ?? null)).slice(0, 1500));
  } else if (request === "smoke-save") {
    const t = await T("힌트 팻말"); check("smoke-talk", t.length > 0, "talk", t);
    await dbg("setGold", 123); const b = await st(); const saved = await saveGame(); await dbg("setGold", 5); const loaded = await loadGame(); const a = await st();
    check("smoke-save-load", saved && loaded && a.gold === 123 && a.x === b.x && a.y === b.y, `saved ${saved}${saved ? "" : ` «${lastSaveMsg}»`} loaded ${loaded} gold ${a.gold} pos ${b.x},${b.y}→${a.x},${a.y}`);
  } else if (request === "lights") {
    const solvedRe = /모든 불|꺼졌/;
    await guard("lights-door-shut-at-start", async () => { const d = await doorOpen("등불 방 문"); check("lights-door-shut-at-start", !d.open, `door before solving: ${d.note}`); });
    await guard("lights-wrong-move", async () => { const t = await T("등 22"); check("lights-wrong-move", !solvedRe.test(joined(t)) && !(await doorOpen("등불 방 문")).open, "pressing 등 22 first does not solve / open", t); });
    await guard("lights-reset", async () => { const t = await T("초기화 레버", { choices: [0, 0] }); check("lights-reset-lever", t.length > 0, "reset lever responds", t); });
    await guard("lights-first-half", async () => { const t = await T("등 11"); check("lights-11-not-solved", !solvedRe.test(joined(t)), "after reset, 등 11 alone does not solve", t); });
    await guard("lights-save-load", async () => {
      const before = await st(); const saved = await saveGame(); const loaded = saved ? await loadGame() : false; const after = await st();
      const same = JSON.stringify(before.switches) === JSON.stringify(after.switches) && JSON.stringify(before.variables) === JSON.stringify(after.variables) && JSON.stringify(before.selfSwitches) === JSON.stringify(after.selfSwitches);
      check("lights-save-load", saved && loaded && same, `saved ${saved}${saved ? "" : ` «${lastSaveMsg}»`} loaded ${loaded}; switches/variables/self-switches identical after load: ${same}`);
    });
    await guard("lights-solve", async () => { const t = await T("등 44"); check("lights-solved-after-load", solvedRe.test(joined(t)), "등 44 after the load turns the last lights off → «모든 불이 꺼졌다»", t); });
    await guard("lights-door", async () => { const d = await doorOpen("등불 방 문"); check("lights-door-opens", d.open, `door after solving: ${d.note}`); });
  } else if (request === "statues") {
    const FACE = { up: "북", right: "동", down: "남", left: "서" };
    const ROW = ["down", "left", "right", "up"];
    // Facing as the player SEES it: the event sprite's charset frame row (3 columns × 4 rows: 아래·왼·오른·위). Static events
    // have no eventLocations entry, so the live sprite is the only witness.
    const dirs = async () => { const sp = await page.evaluate(() => window.__oprnCharacterSprites?.()?.events ?? {}).catch(() => ({})); const s = await st();
      return [1, 2, 3, 4].map((k) => { const id = evId(`석상 ${k}`); const live = s?.eventLocations?.[id]?.direction; const f = sp[id]?.frame; return live ?? (typeof f === "number" ? ROW[Math.floor(f / 3) % 4] : "?"); }); };
    const fmt = (d) => d.map((x) => FACE[x] ?? x).join("");
    const P = (k) => T(`석상 ${k}`, { choices: [0, 0] });
    await guard("statues-undo-empty", async () => { const t = await T("되돌리기 돌", { choices: [0, 0] }); check("statues-undo-empty", /없/.test(joined(t)), "undo with no history says nothing to undo", t); });
    await guard("statues-initial", async () => { const d = await dirs(); check("statues-initial-facing-visible", fmt(d) === "북동남서", `sprites face ${fmt(d)} (expect 북동남서)`); });
    let afterRot = "";
    await guard("statues-rotate", async () => { const b = await dirs(); await P(3); const d = await dirs(); afterRot = fmt(d); check("statues-rotate-visible", d[2] !== b[2] && d[2] === "left", `석상 3 sprite ${FACE[b[2]] ?? b[2]} → ${FACE[d[2]] ?? d[2]} (expect 남→서)`); });
    await guard("statues-undo", async () => { await T("되돌리기 돌", { choices: [0, 0] }); const d = await dirs(); check("statues-undo-visible", d[2] === "down", `undo → 석상 3 sprite ${FACE[d[2]] ?? d[2]} (expect 남)`); });
    let before = null;
    await guard("statues-save-load", async () => {
      await P(1); await P(1); await P(3);
      before = await st(); const b = await dirs(); const saved = await saveGame(); const loaded = saved ? await loadGame() : false; const a = await st();
      const same = JSON.stringify(before.switches) === JSON.stringify(a.switches) && JSON.stringify(before.variables) === JSON.stringify(a.variables) && JSON.stringify(before.selfSwitches) === JSON.stringify(a.selfSwitches);
      check("statues-save-load", saved && loaded && same, `saved ${saved}${saved ? "" : ` «${lastSaveMsg}»`} loaded ${loaded}; switches/variables/self-switches identical: ${same} (sprites ${fmt(b)})`);
      await T("되돌리기 돌", { choices: [0, 0] });
    });
    await guard("statues-solve", async () => {
      // Correct only if: rotation is clockwise, the first undo reverted 석상 3, and the post-load undo reverted 석상 3 again.
      const all = [];
      all.push(...await P(2));
      for (let k = 0; k < 3; k += 1) all.push(...await P(4));
      const d = await dirs();
      check("statues-solved-via-undo", /숙|열/.test(joined(all)), `after 석상2×1, 석상4×3 (needs both undos to have worked): message; sprites ${fmt(d)}`, all.slice(-4));
      const o = await doorOpen("석상 방 문"); check("statues-door-opens", o.open, `door: ${o.note}`);
    });
  } else if (request === "stealth") {
    const guardId = evId("경비병");
    const gpos = async () => { const s = await st(); const l = s?.eventLocations?.[guardId]; const ev = findEvent(guardId); return { mapId: l?.mapId ?? ev.mapId, x: l?.x ?? ev.x, y: l?.y ?? ev.y, dir: l?.direction ?? null }; };
    const flag = await evPos("체크포인트 깃발"); const exitDoor = await evPos("탈출 문");
    const caughtRe = /거기 서/;
    async function speed(ms = 6000) { let steps = 0, prev = await gpos(); const t0 = Date.now(); while (Date.now() - t0 < ms) { await sleep(250); const p = await gpos(); if (p.x !== prev.x || p.y !== prev.y) steps += 1; prev = p; } return steps; }
    async function motionDir() { const a = await gpos(); for (let i = 0; i < 16; i += 1) { await sleep(250); const b = await gpos(); if (b.x !== a.x || b.y !== a.y) return { at: b, dir: b.x > a.x ? "right" : b.x < a.x ? "left" : b.y > a.y ? "down" : "up" }; } return { at: a, dir: a.dir }; }
    const map = findEvent(guardId).map;
    await guard("stealth-patrol", async () => { await toField(); const s1 = await speed(8000); check("stealth-guard-patrols", s1 >= 2, `guard moved ${s1} cells in 8 s`); });
    let base = 0;
    await guard("stealth-behind", async () => {
      let ok = null, note = "";
      for (let k = 0; k < 6 && ok === null; k += 1) {
        const m = await motionDir(); if (!m.dir) { await sleep(800); continue; }
        const lim = m.dir === "right" ? exitDoor.x : m.dir === "left" ? flag.x : null;
        if (lim != null && Math.abs(lim - m.at.x) < 7) { await sleep(1200); continue; }
        const [dx, dy] = DIRS[OPP[m.dir]]; const x = m.at.x + dx * 2, y = m.at.y + dy * 2;
        if (!passable(map, x, y)) { await sleep(800); continue; }
        const n0 = await logLen(); await teleport(m.at.mapId ?? map.id, x, y); await sleep(2500);
        const s = await st(); const said = joined(await logSince(n0));
        ok = !caughtRe.test(said) && dist(s, { x, y }) <= 3; note = `behind guard (moving ${m.dir}) at ${x},${y} → player ${s.x},${s.y}${said ? ` «${said.slice(0, 60)}»` : ""}`;
      }
      check("stealth-behind-safe", ok === true, note || "no safe moment found");
      await drain({}, { maxMs: 8000 });
    });
    const catches = [];
    await guard("stealth-caught", async () => {
      for (let k = 0; k < 3; k += 1) {
        let got = null;
        for (let tries = 0; tries < 6 && !got; tries += 1) {
          await toField(); const m = await motionDir(); if (!m.dir) { await sleep(800); continue; }
          const [dx, dy] = DIRS[m.dir]; const x = m.at.x + dx * 2, y = m.at.y + dy * 2;
          if (!passable(map, x, y)) { await sleep(1000); continue; }
          const n0 = await logLen(); await teleport(m.at.mapId ?? map.id, x, y);
          let caught = false;
          for (let i = 0; i < 24 && !caught; i += 1) { await sleep(250); const said = joined(await logSince(n0)); if (caughtRe.test(said)) caught = true; }
          const texts = await drain({}, { maxMs: 20_000, start: n0 }); await sleep(800);
          const s = await st();
          got = { caught: caught || caughtRe.test(joined(texts)), back: dist(s, flag) <= 3 && s.currentMapId === flag.mapId, at: `${s.x},${s.y}`, texts };
        }
        catches.push(got ?? { caught: false, back: false, at: "?", texts: [] });
        if (k === 0) { const c = catches[0]; check("stealth-caught-in-sight", c.caught && c.back, `2 cells in front of the walking guard: «거기 서» ${c.caught}, back at flag ${c.back} (${c.at})`, c.texts); base = await speed(6000); }
      }
      const third = catches[2];
      check("stealth-third-catch-alert", /강화/.test(joined(third.texts)) && catches.every((c) => c.caught), `3 catches ${catches.map((c) => c.caught).join(",")}; 3rd says «강화»`, third.texts);
      const fast = await speed(6000);
      check("stealth-guard-faster", fast > base, `guard steps per 6 s: ${base} → ${fast}`);
    });
    await guard("stealth-escape", async () => { let t = await T("탈출 문", { silentOk: true }); if (!(await endingVisible())) t = (await stepEv("탈출 문", "left")).texts; check("stealth-escape-ending", await finishTo([]) || /탈출 성공/.test(joined(t)), "reaching the exit door ends the game", t); });
  } else if (request === "cards") {
    const jin = "도박사 진";
    await guard("cards-refuse", async () => {
      await dbg("setGold", 30);
      const t = await T(jin, { chooser: prefer([[/50/]], [/그만|취소|안 해|나가|됐/]) });
      check("cards-bet-over-gold-refused", /모자/.test(joined(t)) && (await st()).gold === 30, `gold 30, bet 50 → «모자» and gold ${(await st()).gold}`, t);
    });
    const deltas = [];
    await guard("cards-stand", async () => {
      await dbg("setGold", 200);
      for (let r = 0; r < 4; r += 1) {
        const g0 = (await st()).gold;
        const t = await T(jin, { chooser: prefer([[/^\s*10(?!0)|[^0-9]10\s*(골드|G)/]], [/멈/, /아니|그만|끝|안 해/]) });
        const d = (await st()).gold - g0; deltas.push({ d, t });
      }
      check("cards-stand-payouts", deltas.every((x) => [-10, 0, 10].includes(x.d)) && deltas.some((x) => x.t.some((l) => /합/.test(l))), `bet 10 + stand ×4 → gold changes ${deltas.map((x) => x.d).join(", ")} (each must be −10/0/+10, sums shown)`, deltas.at(-1)?.t ?? []);
    });
    await guard("cards-bust", async () => {
      const g0 = (await st()).gold;
      const t = await T(jin, { chooser: prefer([[/^\s*10(?!0)|[^0-9]10\s*(골드|G)/]], [/한 장|더 받|히트|카드/, /아니|그만|끝|안 해/], { cap: 16 }) });
      const d = (await st()).gold - g0;
      check("cards-bust-loses", d === -10 && /넘|버스트|패|졌/.test(joined(t)), `always «한 장 더» → gold ${d} (expect −10), bust message`, t);
    });
    await guard("cards-big-bet", async () => {
      const g0 = (await st()).gold;
      const t = await T(jin, { chooser: prefer([[/100/]], [/멈/, /아니|그만|끝|안 해/]) });
      const d = (await st()).gold - g0;
      check("cards-bet-100", [-100, 0, 100].includes(d), `bet 100 + stand → gold ${d}`, t);
    });
  } else if (request === "craft") {
    const bench = "제작대";
    const invAll = async () => Object.fromEntries(await Promise.all(["약초", "철광석", "나무", "보석", "꽃", "포션", "철검", "행운의 부적"].map(async (n) => [n, await inv(n)])));
    let i0;
    await guard("craft-start", async () => { i0 = await invAll(); check("craft-start-inventory", i0.약초 === 4 && i0.철광석 === 9 && i0.나무 === 3 && i0.보석 === 2 && i0.꽃 === 4, JSON.stringify(i0)); });
    await guard("craft-known-only", async () => {
      const c0 = seenChoices.length;
      const t = await T(bench, { chooser: prefer([[/포션/]], [/예|네|만든|제작|확인/, /그만|취소|아니|닫/]) });
      const menus = seenChoices.slice(c0).flat().join(" / ");
      const i1 = await invAll();
      check("craft-menu-before-book", /포션/.test(menus) && !/철검|부적/.test(menus), `menu: ${menus.slice(0, 120)}`, t);
      check("craft-potion", i1.포션 === i0.포션 + 1 && i1.약초 === i0.약초 - 2, `potion ${i0.포션}→${i1.포션}, herbs ${i0.약초}→${i1.약초}`);
    });
    await guard("craft-book", async () => {
      await T("레시피 책장", { choices: [0, 0] });
      const c0 = seenChoices.length;
      await T(bench, { chooser: prefer([[/그만|취소|닫|아니/]], [/그만|취소|닫|아니/]) });
      const menus = seenChoices.slice(c0).flat().join(" / ");
      check("craft-book-unlocks", /철검/.test(menus) && /부적/.test(menus), `menu after the bookshelf: ${menus.slice(0, 160)}`);
    });
    await guard("craft-sword", async () => {
      const a = await invAll(); const tx = [];
      for (let k = 0; k < 3; k += 1) tx.push(await T(bench, { chooser: prefer([[/철검/]], [/예|네|만든|제작|확인/, /그만|취소|아니|닫/]) }));
      const b = await invAll(); const fails = tx.filter((t) => /실패/.test(joined(t))).length;
      check("craft-sword-consumes", b.철광석 === a.철광석 - 9 && b.나무 === a.나무 - 3, `ore ${a.철광석}→${b.철광석}, wood ${a.나무}→${b.나무}`);
      check("craft-sword-outcomes", (b.철검 - a.철검) + fails === 3, `3 tries: swords +${b.철검 - a.철검}, «실패» ${fails}`);
      const t = await T(bench, { chooser: prefer([[/철검/]], [/예|네|만든|제작|확인/, /그만|취소|아니|닫/]) });
      const c = await invAll();
      check("craft-missing-says-what", /모자|부족/.test(joined(t)) && /철광석/.test(joined(t)) && /3/.test(joined(t)) && c.철검 === b.철검 && c.나무 === b.나무, "4th sword with no ore: says 철광석 3 missing, nothing used", t);
    });
    await guard("craft-charm", async () => {
      const a = await invAll(); const tx = [];
      for (let k = 0; k < 2; k += 1) tx.push(await T(bench, { chooser: prefer([[/부적/]], [/예|네|만든|제작|확인/, /그만|취소|아니|닫/]) }));
      const b = await invAll(); const fails = tx.filter((t) => /실패/.test(joined(t))).length;
      check("craft-charm", b.보석 === a.보석 - 2 && b.꽃 === a.꽃 - 4 && (b["행운의 부적"] - a["행운의 부적"]) + fails === 2, `gems ${a.보석}→${b.보석}, flowers ${a.꽃}→${b.꽃}, charms +${b["행운의 부적"] - a["행운의 부적"]}, fails ${fails}`);
    });
    await guard("craft-rate", async () => {
      const ore = itemIds("철광석")[0], wood = itemIds("나무")[0];
      await dbg("giveItem", ore, 60); await dbg("giveItem", wood, 20);
      const a = await invAll(); let fails = 0;
      for (let k = 0; k < 20; k += 1) { const t = await T(bench, { chooser: prefer([[/철검/]], [/예|네|만든|제작|확인/, /그만|취소|아니|닫/]) }); if (/실패/.test(joined(t))) fails += 1; }
      const b = await invAll(); const made = b.철검 - a.철검;
      check("craft-sword-rate", made + fails === 20 && made >= 9 && made <= 19, `20 sword tries: ${made} made, ${fails} failed (70% → expect ~14)`);
    });
  } else if (request === "schedule") {
    const toma = "빵집 주인 토마";
    const near = async (marker) => { const a = await evPos(toma), b = await evPos(marker); return { ok: a.mapId === b.mapId && dist(a, b) <= 2, note: `토마 ${a.x},${a.y} vs ${marker} ${b.x},${b.y}` }; };
    // NPCs may WALK to their next spot after the clock jump: poll up to 30 s (wall) for arrival.
    const at = async (h) => { await dbg("setClock", h, 0); const mk = h >= 6 && h < 11 ? "빵집 앞" : h >= 11 && h < 18 ? "광장 분수" : "토마의 집 앞"; const t0 = Date.now(); let n;
      do { await sleep(1500); n = await near(mk); } while (!n.ok && Date.now() - t0 < 30_000); return { ...n, note: `${n.note} after ${((Date.now() - t0) / 1000).toFixed(0)} s` }; };
    await guard("schedule-clock", async () => { const s0 = await st(); await sleep(15000); const s1 = await st(); check("schedule-starts-7-and-flows", s0.gameTime?.hour === 7 && (s1.gameTime.hour * 60 + s1.gameTime.minute) > (s0.gameTime.hour * 60 + s0.gameTime.minute), `clock ${s0.gameTime?.hour}:${s0.gameTime?.minute} → ${s1.gameTime?.hour}:${s1.gameTime?.minute} after 15 s`); });
    await guard("schedule-morning", async () => {
      const n = await at(8); check("schedule-8-bakery", n.ok, `08:00 ${n.note}`);
      const g0 = (await st()).gold, b0 = await inv("빵");
      const t = await T(toma, { chooser: prefer([[/예|네|산|살|구매/]], [/예|네/]) });
      check("schedule-buy-bread", /50/.test(joined(t)) && (await st()).gold === g0 - 50 && (await inv("빵")) === b0 + 1, `gold ${g0}→${(await st()).gold}, bread ${b0}→${await inv("빵")}`, t);
    });
    await guard("schedule-noon", async () => {
      const n = await at(13); check("schedule-13-fountain", n.ok, `13:00 ${n.note}`);
      const g0 = (await st()).gold; const t = await T(toma, { chooser: prefer([], [/아니|그만|안/]) });
      check("schedule-noon-talk", (await st()).gold === g0 && !/문 닫/.test(joined(t)) && t.length > 0, "fountain line, no sale", t);
      const saved = await saveGame(); const loaded = saved ? await loadGame() : false; await sleep(2500);
      const m = await near("광장 분수"); const s = await st();
      check("schedule-save-load", saved && loaded && m.ok && s.gameTime?.hour >= 13 && s.gameTime?.hour < 18, `after load ${s.gameTime?.hour}:${s.gameTime?.minute} ${m.note}`);
    });
    await guard("schedule-night", async () => {
      const n = await at(21); check("schedule-21-home", n.ok, `21:00 ${n.note}`);
      const t = await T(toma, { chooser: prefer([], [/아니|그만|안/]) }); check("schedule-night-closed", /문 닫|내일/.test(joined(t)), "closed line at night", t);
      const n2 = await at(5); check("schedule-5-still-home", n2.ok, `05:00 ${n2.note}`);
      const n3 = await at(10); check("schedule-10-back-to-bakery", n3.ok, `10:00 next day ${n3.note}`);
    });
  } else if (request === "affinity") {
    const gift = (who, item) => T(who, { chooser: prefer([[/선물/], [new RegExp(item)]], [/예|네|준다|줄래|그래/, /그만|아니|닫/], { cap: 8 }) });
    await guard("aff-start", async () => { const a = [await inv("꽃"), await inv("빵"), await inv("보석")]; check("aff-start-inventory", a.join() === "10,10,10", `flowers/bread/gems ${a.join("/")}`); });
    const tx = [];
    await guard("aff-gifts", async () => {
      const g0 = await inv("보석"); tx.push(await gift("리나", "보석"));
      check("aff-gift-consumed", (await inv("보석")) === g0 - 1, `gems ${g0}→${await inv("보석")}`, tx[0]);
      for (let k = 0; k < 4; k += 1) tx.push(await gift("리나", "꽃"));
      // -10 +20+20+20 = 50 at the 3rd flower (tx[3]); 4th flower (tx[4]) must not repeat it.
      check("aff-special-at-50", lines(tx[3]) >= lines(tx[2]) + 2, `transcript lines per gift: ${tx.map(lines).join(",")} — 3rd flower (50) longer`, tx[3]);
      check("aff-special-once", lines(tx[4]) < lines(tx[3]), `4th flower (70) lines ${lines(tx[4])} < ${lines(tx[3])}`, tx[4]);
    });
    await guard("aff-save-load", async () => {
      const b = await st(); const saved = await saveGame(); const loaded = saved ? await loadGame() : false; const a = await st();
      check("aff-save-load", saved && loaded && JSON.stringify(b.variables) === JSON.stringify(a.variables) && JSON.stringify(b.switches) === JSON.stringify(a.switches), `variables/switches identical after load`);
    });
    await guard("aff-partner", async () => {
      const t1 = await gift("리나", "꽃"); const t2 = await gift("리나", "꽃");
      check("aff-lover-at-100", /연인/.test(joined([...t1, ...t2])), "6th flower (110) → lover", [...t1, ...t2]);
      const b0 = await inv("빵"); const t = await gift("미오", "빵");
      check("aff-others-refuse", (await inv("빵")) === b0 && /마음/.test(joined(t)), `미오 refuses bread: bread ${b0}→${await inv("빵")}`, t);
      const e = await T("리나", { chooser: prefer([], [/함께|떠나|예|네/]) });
      check("aff-ending", await finishTo([]), "talking to the lover → ending", e);
    });
  } else if (request === "boss") {
    const enemyNames = () => page.evaluate(() => [...document.querySelectorAll("[data-testid='battle-enemy']")].filter((n) => n.getClientRects().length).map((n) => (n.querySelector("[data-testid='battle-enemy-name']")?.textContent ?? n.textContent ?? "").trim()));
    async function fight(hp) {
      const start = await logLen(); let maxEnemies = 0; const names = new Set();
      for (let round = 0; round < 60; round += 1) {
        if (!(await has("[data-testid='battle-scene']"))) { await sleep(800); if (!(await has("[data-testid='battle-scene']"))) break; }
        const en = await enemyNames(); maxEnemies = Math.max(maxEnemies, en.length); en.forEach((n) => names.add(n));
        await page.evaluate((v) => { const ids = window.__oprnDebug.readState().partyActorIds; for (const id of ids) window.__oprnSetActorVitals?.(id, v, v > 1 ? 999 : 0); }, hp).catch(() => {});
        await battleQaOp(page, { kind: "battle", fallback: "attack", commands: 1, timeoutMs: 60_000 }).catch(() => {});
      }
      return { start, maxEnemies, names: [...names] };
    }
    const boss = await evPos("보스");
    await guard("boss-defeat", async () => {
      await T("보스", { choices: [0, 0] });
      const f = await fight(1);
      const t = await drain({ chooser: prefer([[/예|네|도전/]], [/예|네/]) }, { maxMs: 40_000, start: f.start });
      await sleep(1500);
      const s = await st(); const title = await has("[data-testid='title-screen']"); const over = await has("[data-testid='game-over-screen']");
      check("boss-defeat-retry", /다시 도전/.test(joined(t)) && !title && !over && s.currentMapId === boss.mapId && dist(s, boss) >= 2 && (await fieldReady()), `lost on purpose → retry asked; now ${s.currentMapId} ${s.x},${s.y} (boss ${boss.x},${boss.y}) title ${title} gameover ${over}`, t);
    });
    await guard("boss-win", async () => {
      await T("보스", { choices: [0, 0] });
      const f = await fight(9999);
      const all = await logSince(f.start);
      const i2 = all.findIndex((x) => /부하/.test(x)), i3 = all.findIndex((x) => /끝까지/.test(x));
      check("boss-phase2-line", i2 >= 0, "«나와라, 내 부하들!» at 50%", all.filter((x) => /부하/.test(x)));
      check("boss-adds-summoned", f.maxEnemies >= 3 || f.names.some((n) => /박쥐/.test(n)), `enemies seen: max ${f.maxEnemies} [${f.names.join(", ")}]`);
      check("boss-phase3-line", i3 >= 0 && (i2 < 0 || i3 > i2), "«끝까지 간다!» at 20%, after phase 2", all.filter((x) => /끝까지/.test(x)));
      check("boss-lines-once", all.filter((x) => /부하/.test(x)).length <= 1 && all.filter((x) => /끝까지/.test(x)).length <= 1, "each shout at most once");
      const ending = await finishTo([]);
      check("boss-victory-ending", ending && /쓰러뜨/.test(joined(await logSince(f.start))), "victory line then ending");
    });
  } else if (request === "collapse") {
    const tval = async () => { const v = Object.values((await st())?.timers ?? {}).filter((x) => typeof x === "number"); return v.length ? Math.max(...v) : null; };
    const plate = await evPos("붕괴 발판");
    let unit = 1;
    await guard("collapse-start", async () => {
      const r = await stepEv("붕괴 발판", "left");
      const v = await tval(); unit = v && v > 200 ? 60 : 1;
      const hud = await has("[data-testid='runtime-timer-hud']");
      check("collapse-timer-starts", v > 0 && /무너/.test(joined(r.texts)) && hud, `timer ${v} (${unit === 60 ? "frames" : "seconds"}), HUD ${hud}`, r.texts);
      await page.screenshot({ path: join(out, "collapse-timer.png") }).catch(() => {});
    });
    async function rate() { const a = await tval(), t0 = Date.now(); await sleep(2000); const b = await tval(); return (a - b) / ((Date.now() - t0) / 1000); }
    async function rock(name, quick) {
      const r0 = await rate(); const v0 = await tval(); const t0 = Date.now(); const n0 = await logLen();
      const p = await evPos(name); await toField(); await teleport(p.mapId, p.x - 1, p.y);
      await page.evaluate(() => window.__oprnInput.dir("right")); await sleep(420); await page.evaluate(() => window.__oprnInput.dir(null));
      if (quick) { for (let i = 0; i < 8; i += 1) { await sleep(180); await page.keyboard.press("Enter"); } } else await sleep(2600);
      const texts = await drain({}, { maxMs: 15_000, start: n0 });
      const v1 = await tval(); const wall = (Date.now() - t0) / 1000;
      return { extra: (v0 - v1 - r0 * wall) / unit, texts, r0, wall };
    }
    await guard("collapse-qte", async () => {
      const q = await rock("낙석 1", true); const s = await rock("낙석 2", false);
      check("collapse-qte-prompt", /피해/.test(joined(q.texts)) && /피해/.test(joined(s.texts)), "both rocks prompt «피해!»", [...q.texts, ...s.texts]);
      check("collapse-qte-quick-no-penalty", q.extra < 2.5 && /피했/.test(joined(q.texts)), `quick press: extra timer loss ${q.extra.toFixed(1)} s`, q.texts);
      check("collapse-qte-slow-penalty", s.extra > 2.5, `no press: extra timer loss ${s.extra.toFixed(1)} s (expect ~5)`, s.texts);
    });
    await guard("collapse-timeout", async () => {
      const n0 = await logLen(); const t0 = Date.now();
      while (Date.now() - t0 < 120_000) { const v = await tval(); if (!(v > 0)) break; if (await has("[data-testid='dialogue-box']")) break; await sleep(500); }
      const t = await drain({}, { maxMs: 30_000, start: n0 }); await sleep(1000); const s = await st();
      check("collapse-timeout-fails", /깔/.test(joined(t)) && !(await endingVisible()) && s.currentMapId === plate.mapId && dist(s, plate) <= 2, `time out → player ${s.x},${s.y} (plate ${plate.x},${plate.y})`, t);
    });
    await guard("collapse-retry", async () => {
      const r = await stepEv("붕괴 발판", "left"); const v = await tval();
      const q = await rock("낙석 1", true);
      check("collapse-retry-resets", v > 0 && /피해/.test(joined(q.texts)), `second attempt: timer ${v}, rock 1 falls again`, q.texts);
      const ex = await evPos("동굴 출구"); const e = await stepOn(ex.mapId, ex.x, ex.y, "left");
      const ending = await finishTo([]);
      check("collapse-escape-ending", ending && /빠져나/.test(joined([...e.texts, ...(await logSince(0))])), "reaching the exit in time → ending", e.texts);
    });
  } else if (request === "random") {
    const keyIds = itemIdsLike(/황금 ?열쇠/); const blessIds = itemIdsLike(/축복/);
    const open = async (k) => { const s0 = await st(); const t = await T(`보물 상자 ${k}`, { choices: [0, 0] }); const s1 = await st(); return { gold: s1.gold - s0.gold, key: count(s1, keyIds) - count(s0, keyIds), t }; };
    const boxes = {}; const qs = [];
    async function sphinxRound(record) {
      const wrong = {}; let lastQ = "";
      const chooser = (opts, texts) => { const q = (texts.filter((x) => !opts.some((o) => x.includes(o) && x === o)).at(-1) ?? "").replace(/\s+/g, " ").slice(0, 80); lastQ = q; const bad = wrong[q] ?? []; const k = opts.findIndex((_, i) => !bad.includes(i)); record.push({ q, pick: k, opts }); return k < 0 ? 0 : k; };
      for (let talkN = 0; talkN < 14; talkN += 1) {
        const t = await T("스핑크스", { chooser });
        // mark wrong answers: a pick followed by «틀» in the transcript
        for (const r of record.filter((r) => r.result === undefined)) r.result = "?";
        if (/틀/.test(joined(t))) { const last = record.filter((r) => r.result === "?").at(-1); if (last) { (wrong[last.q] ??= []).push(last.pick); last.result = "wrong"; } }
        if (count(await st(), blessIds) > 0) return t;
      }
      return [];
    }
    await guard("random-box1", async () => { boxes[1] = await open(1); });
    let snapQ = []; let randomSaved = false;
    await guard("random-save", async () => { const saved = await saveGame(); randomSaved = saved; check("random-saved", saved, `saved after opening box 1${saved ? "" : ` — refused «${lastSaveMsg}»`}`); });
    await guard("random-boxes", async () => {
      for (const k of [2, 3, 4, 5]) boxes[k] = await open(k);
      const vals = Object.values(boxes); const keys = vals.filter((b) => b.key > 0).length; const golds = vals.filter((b) => b.key === 0).map((b) => b.gold);
      check("random-one-key", keys === 1, `boxes: ${Object.entries(boxes).map(([k, b]) => `${k}:${b.key ? "KEY" : b.gold}`).join(" ")}`);
      check("random-gold-range", golds.length === 4 && golds.every((g) => g >= 50 && g <= 150), `gold ${golds.join(", ")} (50~150)`);
      const again = await open(2); check("random-box-empty-after", again.gold === 0 && again.key === 0, `reopen box 2 → +${again.gold}G key ${again.key}`, again.t);
    });
    await guard("random-sphinx", async () => {
      const rec = []; await sphinxRound(rec); snapQ = [...new Set(rec.map((r) => r.q))];
      const retried = rec.some((r, i) => r.result === "wrong" && rec.slice(i + 1).some((x) => x.q === r.q));
      check("random-riddles-3", count(await st(), blessIds) > 0 && snapQ.length >= 3 && snapQ.length <= 4, `blessing ${count(await st(), blessIds)}; distinct prompts ${snapQ.length}: ${snapQ.map((q) => q.slice(0, 24)).join(" | ")}`);
      check("random-wrong-repeats-same", retried || !rec.some((r) => r.result === "wrong"), `after a wrong answer the same riddle comes back (${rec.filter((r) => r.result === "wrong").length} wrong tries)`);
      qs.push(...rec);
    });
    await guard("random-load", async () => {
      if (!randomSaved) throw new Error("no save to load");
      const loaded = await loadGame(); const b2 = {};
      for (const k of [2, 3, 4, 5]) b2[k] = await open(k);
      const same = [2, 3, 4, 5].every((k) => b2[k].gold === boxes[k].gold && b2[k].key === boxes[k].key);
      check("random-boxes-same-after-load", loaded && same, `after load: ${[2, 3, 4, 5].map((k) => `${k}:${b2[k].key ? "KEY" : b2[k].gold}`).join(" ")} vs ${[2, 3, 4, 5].map((k) => `${k}:${boxes[k].key ? "KEY" : boxes[k].gold}`).join(" ")}`);
      const rec = []; await sphinxRound(rec); const q2 = [...new Set(rec.map((r) => r.q))];
      check("random-riddles-same-after-load", q2.length && q2.slice(0, 3).join("|") === snapQ.slice(0, 3).join("|"), `riddles after load ${q2.map((q) => q.slice(0, 20)).join(" | ")}`);
    });
  }
} catch (error) {
  check("walk-error", false, String(error?.message ?? error).split("\n")[0]);
}

const transcript = await page.evaluate(() => window.__sabLog).catch(() => []);
await page.screenshot({ path: join(out, "final.png") }).catch(() => {});
writeFileSync(join(out, "walk.json"), JSON.stringify({ request, ms: Date.now() - t0, pass: checks.filter((c) => c.pass).length, total: checks.length, checks, errors, transcript, choices: seenChoices.slice(0, 200) }, null, 1));
await context.close(); await browser.close(); child.kill("SIGTERM");
if (video) { const dir = join(out, "video"); for (const f of readdirSync(dir)) if (f.endsWith(".webm")) renameSync(join(dir, f), join(dir, "walk.webm")); }
console.log(`walk ${request}: ${checks.filter((c) => c.pass).length}/${checks.length}`);
process.exit(0);
