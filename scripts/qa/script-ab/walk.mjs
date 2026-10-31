// Script A/B PoC — scripted playthrough of one generated game in the shipped player (wholeGamePlayer --serve + Firefox).
//
//   node scripts/qa/script-ab/walk.mjs --project-dir <run>/project --request escape|village|dungeon \
//     --bind <binding.json> --out <dir> [--video] [--netns]
//
// The CHECKS are fixed per request (written once, same for both arms). The binding only says where things are
// (event ids, a few cells) because every build lays its rooms out differently. Output: <out>/walk.json
// { checks: [{id, pass, note, texts}], ending, transcript } and, with --video, <out>/video/*.webm (1x).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "playwright";
import { battleQaOp } from "../../lib/runtimeQaBattle.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (process.argv.includes("--netns") && process.env.OPRN_QA_IN_NETNS !== "1") {
  const inner = process.argv.slice(1).filter((a) => a !== "--netns").map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");
  const r = spawnSync("unshare", ["-rn", "bash", "-c", `ip link set lo up && exec ${JSON.stringify(process.execPath)} ${inner}`], { stdio: "inherit", env: { ...process.env, OPRN_QA_IN_NETNS: "1" } });
  process.exit(r.status ?? 1);
}
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const projectDir = resolve(opt("project-dir"));
const request = opt("request");
const bind = JSON.parse(readFileSync(resolve(opt("bind")), "utf8"));
const out = resolve(opt("out"));
const video = argv.includes("--video");
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- server ----------
const serveOut = mkdtempSync(join(tmpdir(), "sab-walk-"));
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
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "sab-walk", qaInstrumentation: true };
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

const st = () => page.evaluate(() => window.__oprnDebug?.readState?.() ?? null);
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
      const want = choices.length ? choices.shift() : 0;
      let index = typeof want === "number" ? want : 0;
      if (typeof want === "string") {
        const opts = await page.evaluate(() => [...document.querySelectorAll("[data-testid='dialogue-choice-frame'] [role='option'], [data-testid='dialogue-choice-frame'] li, [data-testid='dialogue-choice-frame'] button")].map((n) => (n.textContent ?? "").trim()).filter(Boolean));
        const re = new RegExp(want); const k = opts.findIndex((o) => re.test(o)); index = k >= 0 ? k : 0;
      }
      for (let i = 0; i < index; i += 1) { await page.keyboard.press("ArrowDown"); await sleep(120); }
      await page.keyboard.press("Enter"); await sleep(500); freeSince = null; continue;
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
const dbg = (fn, ...a) => page.evaluate(([f, args]) => window.__oprnDebug[f](...args), [fn, a]);

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

try {
  if (request === "smoke") {
    const t = await talk(bind.talk, { choices: [0, 0] }); check("smoke-talk", t.length > 0, "talked", t);
  } else if (request === "escape") {
    const lockPlan = { numbers: ["1111"] };
    let t = await talk(bind.lock, lockPlan);
    check("lock-before-clues", /아직|단서.{0,12}(없|못)|(없|못).{0,12}단서|찾아/.test(joined(t)), "lock says no clue yet before any clue", t);
    const desk = await talk(bind.desk); check("clue-desk", /7/.test(joined(desk)) && /9/.test(joined(desk)), "desk shows 7 _ 9 _", desk);
    const frame = await talk(bind.frame); check("clue-frame", /2/.test(joined(frame)), "frame shows _ 2 _ _", frame);
    const pot = await talk(bind.pot); check("clue-pot", /4/.test(joined(pot)), "pot shows _ _ _ 4", pot);
    const w1 = await talk(bind.lock, { numbers: ["1111"] });
    const w2 = await talk(bind.lock, { numbers: ["2222"] });
    const w3 = await talk(bind.lock, { numbers: ["3333"] });
    const hintRe = /겹|순서|힌트|합쳐|합치/;
    check("wrong-1-no-hint", !hintRe.test(joined(w1)) && !(await endingVisible()), "1st wrong code: rejected, no hint yet", w1);
    check("wrong-2-no-hint", !hintRe.test(joined(w2)), "2nd wrong code: rejected, no hint yet", w2);
    check("wrong-3-hint", hintRe.test(joined(w3)), "3rd wrong code: hint shown", w3);
    const ok = await talk(bind.lock, { numbers: ["7294"] });
    const s = await st();
    check("code-opens", /열/.test(joined(ok)) || s.currentMapId !== findEvent(bind.lock).mapId || await endingVisible(), "7294 opens the door", ok);
    const ending = await finishTo(bind.afterOpen);
    check("ending", ending, "ending screen reached");
  } else if (request === "village") {
    const s0 = await st();
    check("start-8am", !s0.gameTime || s0.gameTime.hour === 8, `start clock ${s0.gameTime ? `${s0.gameTime.hour}:${String(s0.gameTime.minute).padStart(2, "0")}` : "(no time system)"}`);
    await dbg("setGold", 500);
    const q = await talk(bind.grandma, { choices: [0, 0] }); check("quest-given", /약초/.test(joined(q)), "grandma asks for 3 herbs", q);
    const shop0 = await talk(bind.shop, { choices: [0, 0] });
    const g0 = (await st()).gold;
    check("price-rep0", /50/.test(joined(shop0)), "potion 50G at reputation 0", shop0);
    check("buy-rep0", g0 === 450, `gold 500 → ${g0} after buying one at reputation 0`);
    // night: the gate keeps you in the village
    await dbg("setClock", 22, 0);
    const gk = bind.gate; // {walk:[map,x,y,dir,tiles], talk?: id}
    if (gk.talk) await talk(gk.talk);
    const walks = gk.walks ?? [gk.walk]; // approaches tried in order (a gate may be reachable from one side only)
    const fieldMap = findEvent(bind.herbs[0]).mapId;
    let night;
    for (const w of walks) { night = await tryWalk(...w); if (night.currentMapId === fieldMap) break; }
    check("gate-night-blocks", night.currentMapId !== fieldMap, `22:00 → still on ${night.currentMapId} (${night.x},${night.y})`, await logSince(Math.max(0, (await logLen()) - 3)));
    await dbg("setClock", 10, 0);
    if (gk.talk) await talk(gk.talk);
    let day; const tried = [];
    for (const w of walks) { day = await tryWalk(...w); tried.push(`${w[1]},${w[2]} ${w[3]} → ${day.currentMapId} (${day.x},${day.y})`); if (day.currentMapId === fieldMap) break; }
    check("gate-day-lets-through", day.currentMapId === fieldMap, `10:00: ${tried.join("; ")}`);
    const herbItem = bind.herbItem;
    for (const h of bind.herbs.slice(0, 2)) await talk(h, { choices: [0] });
    let inv = (await st()).inventory[herbItem] ?? 0;
    check("herbs-2", inv === 2, `picked 2 herbs → inventory ${inv}`);
    const short = await talk(bind.grandma, { choices: [0, 0] });
    inv = (await st()).inventory[herbItem] ?? 0;
    check("short-says-1-more", /1\s*(개|송이|포기)?/.test(joined(short)) && inv === 2, `with 2 herbs: says 1 more, keeps herbs (${inv})`, short);
    await talk(bind.herbs[2], { choices: [0] });
    const before = await st();
    const done = await talk(bind.grandma, { choices: [0, 0] });
    const after = await st();
    const repNow = bind.repVar ? after.variables[bind.repVar] ?? 0 : null;
    check("turn-in", (after.inventory[herbItem] ?? 0) === (before.inventory[herbItem] ?? 0) - 3 && after.gold - before.gold === 100, `herbs ${before.inventory[herbItem]}→${after.inventory[herbItem] ?? 0}, gold +${after.gold - before.gold}`, done);
    check("reputation-10", repNow === 10, `reputation ${repNow}`);
    const again = await talk(bind.grandma, { choices: [0, 0] });
    check("no-double-reward", (await st()).gold === after.gold, "talking again gives nothing more", again);
    const shop1 = await talk(bind.shop, { choices: [0, 0] });
    const g1 = (await st()).gold;
    check("price-rep10", /35/.test(joined(shop1)), "potion 35G at reputation 10", shop1);
    check("buy-rep10", g1 === after.gold - 35, `gold ${after.gold} → ${g1}`);
    const end = await talk(bind.chief, { choices: [0, 0] });
    const ending = await finishTo(bind.afterChief ?? []);
    check("ending", ending, "chief → ending", end);
  } else if (request === "dungeon") {
    const sign = await talk(bind.sign); check("sign-order", /빨.*파.*초.*노/.test(joined(sign)), "sign gives the order", sign);
    const P = bind.plates; // {red:[map,x,y,from], ...}
    const stepP = (c) => stepOn(P[c][0], P[c][1], P[c][2], P[c][3] ?? "down");
    await stepP("red"); const wrong = await stepP("green");
    const door = bind.door; // {walk:[map,x,y,dir,tiles], beyond:{map?|x,y}}
    const reached = (s, b) => (b.map ? s.currentMapId === b.map : true) && (b.y != null ? (b.dir === "up" ? s.y <= b.y : b.dir === "down" ? s.y >= b.y : true) : true) && (b.x != null ? (b.dir === "left" ? s.x <= b.x : b.dir === "right" ? s.x >= b.x : true) : true);
    check("wrong-order-reset", /철컥|처음|다시/.test(joined(wrong.texts)), "wrong plate → clunk / start over", wrong.texts);
    const shut = await tryWalk(...door.walk);
    check("door-shut-after-wrong", !reached(shut, door.beyond), `door stays shut (${shut.currentMapId} ${shut.x},${shut.y})`);
    for (const c of ["red", "blue", "green", "yellow"]) await stepP(c);
    const open = await tryWalk(...door.walk);
    check("door-opens-in-order", reached(open, door.beyond), `after R→B→G→Y: ${open.currentMapId} ${open.x},${open.y}`);
    const gate = bind.gate; // {lever:id, walk:[...], beyond:{...}}
    await talk(gate.lever, { choices: [0] });
    // The game timer counts frames; the headless test browser renders below 60 fps, so 10 game seconds take longer than
    // 10 wall seconds. Wait for the game's own timers to run out (cap 40 s), then 1.5 s more.
    const leverAt = Date.now(); await sleep(10_000);
    while (Date.now() - leverAt < 40_000) {
      const tm = (await st())?.timers;
      if (!tm || Object.values(tm).every((v) => !(v > 0))) break;
      await sleep(250);
    }
    await sleep(1500);
    const waited = ((Date.now() - leverAt) / 1000).toFixed(0);
    const late = await tryWalk(...gate.walk);
    check("gate-closes-after-10s", !reached(late, gate.beyond), `after the game timer ran out (${waited} s wall): ${late.currentMapId} ${late.x},${late.y}`);
    await talk(gate.lever, { choices: [0] });
    const quick = await tryWalk(...gate.walk);
    check("gate-open-in-time", reached(quick, gate.beyond), `right after the lever: ${quick.currentMapId} ${quick.x},${quick.y}`);
    const bossStart = await logLen();
    if (bind.boss.talk) await talk(bind.boss.talk, { choices: [0, 0] }, bind.boss.side);
    else if (bind.boss.step) await stepOn(...bind.boss.step);
    const fight = await fightBoss();
    const all = await logSince(bossStart);
    check("boss-phase-line", /이제 진짜다/.test(joined(all)), "boss shouts at half HP", all.filter((t) => /진짜|분노|화/.test(t)));
    check("boss-won", (await st()).battleResult !== "defeat", `battle result ${(await st()).battleResult}`);
    const ending = await finishTo(bind.afterBoss ?? []);
    check("ending", ending, "ending after the boss");
  }
} catch (error) {
  check("walk-error", false, String(error?.message ?? error).split("\n")[0]);
}

const transcript = await page.evaluate(() => window.__sabLog).catch(() => []);
await page.screenshot({ path: join(out, "final.png") }).catch(() => {});
writeFileSync(join(out, "walk.json"), JSON.stringify({ request, bind, ms: Date.now() - t0, pass: checks.filter((c) => c.pass).length, total: checks.length, checks, errors, transcript }, null, 1));
await context.close(); await browser.close(); child.kill("SIGTERM");
if (video) { const dir = join(out, "video"); for (const f of readdirSync(dir)) if (f.endsWith(".webm")) renameSync(join(dir, f), join(dir, "walk.webm")); }
console.log(`walk ${request}: ${checks.filter((c) => c.pass).length}/${checks.length}`);
process.exit(0);
