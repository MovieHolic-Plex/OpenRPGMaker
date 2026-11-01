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
  if (document.querySelector("[data-testid='dialogue-box'], [data-testid='battle-scene'], [data-testid='main-menu'], [data-testid='dialogue-choice-frame'], [data-testid='runtime-input-number'], [data-testid='battle-transition-overlay'], [data-testid='ending-screen'], [data-testid='present-item-scene'], .battle-return-settle")) return false;
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
    if (await has("[data-testid='present-item-scene']")) {
      const items = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='present-item-']")].filter((n) => n.tagName === "BUTTON" || n.getAttribute("role") === "button").map((n) => ({ id: n.dataset.testid, text: (n.textContent ?? "").replace(/\s+/g, " ").trim() })));
      seenChoices.push(items.map((i) => `[item] ${i.text}`));
      const want = plan.present ? new RegExp(plan.present) : null;
      const hit = (want && items.find((i) => i.id !== "present-item-cancel" && want.test(i.text))) ?? items.find((i) => i.id === "present-item-cancel");
      if (hit) await page.evaluate((id) => document.querySelector(`[data-testid='${id}']`)?.click(), hit.id); else await page.keyboard.press("Escape");
      await sleep(600); freeSince = null; continue;
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

