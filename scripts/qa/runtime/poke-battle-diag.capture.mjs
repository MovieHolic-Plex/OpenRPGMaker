// 몬스터 수집(pokemon 스킨 + gen1) 전투 경험 진단 캡처 — 출하 플레이어(player.html + export shim) 한정.
//   node scripts/qa/runtime/poke-battle-diag.capture.mjs <campaign.json> <outDir> [scenario,scenario,...]
// 캠페인은 `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` 로 모델 없이 만든다.
// 시나리오: wild · catch · trainer · gym · faint · levelup · evolve
// 기록: CDP Page.startScreencast(PNG, 프레임별 실시각) + 페이지 안 MutationObserver 타임라인(단계·문장·HP·포즈).
// 산출: <outDir>/<scenario>/frames/*.png, frames.json, timeline.json. 디버그 쓰기(순간이동·레벨·HP 맞춤)는 report.debugWrites.
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, scenArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: poke-battle-diag.capture.mjs <project.json> <outDir> [scenarios]");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/poke-battle-diag");
let projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
if (process.env.TRAINER_ART) {
  // 캡처 전용 임시 그림(Actor1 정수배 확대) — 커밋·배포 대상이 아니다. 트레이너 슬라이드 인 연출 검증용.
  const art = JSON.parse(await readFile(resolve(process.env.TRAINER_ART), "utf8"));
  for (const [id, a] of Object.entries(art)) project.assets.uploaded[id] = { id, name: id, kind: "picture", dataUrl: a.dataUrl, meta: { mime: "image/png", width: a.w, height: a.h } };
  for (const troop of project.database.troops) if (troop.trainerBattle) troop.trainerSprite = { front: "tmp_tr_front", back: "tmp_tr_back", throw: "tmp_tr_throw", backThrow: "tmp_tr_backthrow" };
  projectJson = JSON.stringify(project);
}
const out = resolve(outArg ?? "qa-runs/pbd/out");
await mkdir(out, { recursive: true });
const SCEN = (scenArg ?? "wild,catch,levelup,evolve,trainer,gym,lose").split(",");
const VW = Number(process.env.VW ?? 960), VH = Number(process.env.VH ?? 720);

const report = { steps: [], errors: [], debugWrites: [], scenarios: {} };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const context = await browser.newContext({ viewport: { width: VW, height: VH } });
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:poke-battle-diag", qaInstrumentation: true };
  // 타임라인: 전투 DOM 이 바뀔 때마다(단계·문장·HP·포즈·결과) 실시각과 함께 남긴다.
  const T = (window.__pbdTimeline = []);
  const last = {};
  const push = (k, v) => { if (last[k] === v) return; last[k] = v; T.push({ t: performance.timeOrigin + performance.now(), k, v }); };
  const sample = () => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    push("scene", scene ? "on" : "off");
    if (!scene) return;
    push("phase", scene.dataset.battlePhase ?? "");
    push("step", scene.dataset.battleDirectorStep ?? "");
    push("busy", scene.dataset.battleSequenceBusy ?? "");
    const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden";
    const lines = [...scene.querySelectorAll(".battle-message-line")].filter(vis).map((n) => (n.textContent ?? "").trim()).filter(Boolean).join(" / ");
    push("msg", lines);
    push("msgAll", [...scene.querySelectorAll(".battle-message-line")].map((n) => (n.textContent ?? "").trim()).filter(Boolean).join(" / "));
    for (const n of scene.querySelectorAll("[data-testid^='battle-enemy-hp-'],[data-testid^='battle-actor-hp-'],[data-testid^='battle-party-hp-']")) push("hp:" + n.dataset.testid, (n.textContent ?? "").trim());
    const rows = [...scene.querySelectorAll(".battle-enemy-list-row")].filter(vis);
    rows.forEach((r, i) => push("enemyrow" + i, (r.textContent ?? "").replace(/\s+/g, " ").trim()));
    const party = [...scene.querySelectorAll(".battle-party .battle-actor-status")].filter(vis);
    party.forEach((r, i) => push("partyrow" + i, (r.textContent ?? "").replace(/\s+/g, " ").trim()));
    push("result", scene.querySelector(".battle-result-panel") ? (scene.querySelector(".battle-result-panel").textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120) : "");
    push("cmdVisible", [...scene.querySelectorAll("button.battle-command")].filter(vis).length > 0 ? "on" : "off");
    const en = scene.querySelector(".battle-enemy"); if (en) { const c = getComputedStyle(en), im = en.querySelector("img"), ci = im ? getComputedStyle(im) : null; push("enemyState", `${en.className.replace(/\s+/g, ".")} op=${c.opacity} vis=${c.visibility} im.op=${ci?.opacity} flt=${(ci?.filter ?? "").slice(0, 30)} an=${ci?.animationName} dc=${en.dataset.collapseState ?? "-"}`); }
    const ac = scene.querySelector(".battle-actor-group .battle-actor"); if (ac) { const c = getComputedStyle(ac); push("allyState", `${ac.className.replace(/\s+/g, ".")} op=${c.opacity} tf=${c.transform.slice(0, 40)}`); }
    push("enemyPose", [...scene.querySelectorAll(".battle-enemy")].map((n) => n.dataset.battlePoseFrame ?? n.dataset.pose ?? n.className.split(" ").filter((c) => /pose|act|defeat|hit|enter|exit/.test(c)).join(".")).join("|"));
  };
  // 소리 사건: WebAudio 버퍼·오실레이터·미디어 요소 재생을 시각과 함께 남긴다(귀 판정이 아니라 사건 목록).
  try {
    const log = (v) => T.push({ t: performance.timeOrigin + performance.now(), k: "AUDIO", v });
    const bs = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { try { log(`buf ${this.buffer ? this.buffer.duration.toFixed(2) + "s " + this.buffer.numberOfChannels + "ch" : "?"} rate${this.playbackRate?.value ?? 1}`); } catch { /* */ } return bs.apply(this, a); };
    const os = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { try { log(`osc ${this.type} ${Math.round(this.frequency.value)}Hz`); } catch { /* */ } return os.apply(this, a); };
    const pl = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) { try { log(`media ${(this.currentSrc || this.src || "").split("/").slice(-2).join("/").slice(0, 70)} loop=${this.loop} vol=${this.volume}`); } catch { /* */ } return pl.apply(this, a); };
  } catch { /* */ }
  const start = () => { new MutationObserver(sample).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); setInterval(sample, 50); };
  if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start);
});
if (process.env.FONTVAR) await page.addInitScript((f) => { const st = document.createElement('style'); st.textContent = `.battle-scene[data-battle-ui-style="pokemon"][data-monster-style="emerald"]{--runtime-pixel-font:${f} !important}`; document.documentElement.appendChild(st); }, process.env.FONTVAR);
if (process.env.FONT) {
  // 비교용: 번들에서 빠진 픽셀 글꼴(Galmuri9)을 이름 그대로 주입해 같은 전투를 다시 찍는다. 저장소에는 커밋하지 않는다.
  const fontBytes = await readFile(resolve(process.env.FONT));
  await page.route("**/__pbd/font.woff2", (route) => route.fulfill({ status: 200, contentType: "font/woff2", body: fontBytes }));
  await page.addInitScript(() => { const st = document.createElement("style"); st.textContent = '@font-face{font-family:"Galmuri9";src:url(/__pbd/font.woff2) format("woff2");font-display:block}'; (document.head || document.documentElement).appendChild(st); });
}
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

// ---------- 화면 녹화(CDP screencast) ----------
const cdp = await context.newCDPSession(page);
let rec = null;
cdp.on("Page.screencastFrame", async (ev) => {
  if (rec) {
    rec.frames.push({ ts: ev.metadata.timestamp * 1000, data: ev.data });
    if (rec.ring) { const cut = ev.metadata.timestamp * 1000 - rec.ring; while (rec.frames.length && rec.frames[0].ts < cut) rec.frames.shift(); }
  }
  await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
});
async function recStart(name, ring = 0) {
  rec = { name, frames: [], t0: Date.now(), ring };
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
}
async function recStop() {
  if (!rec) return null;
  await cdp.send("Page.stopScreencast").catch(() => {});
  const r = rec; rec = null;
  const dir = join(out, r.name, "frames");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const index = [];
  let i = 0;
  for (const f of r.frames) { const file = `${String(i).padStart(5, "0")}.png`; await writeFile(join(dir, file), Buffer.from(f.data, "base64")); index.push({ file, ts: f.ts }); i++; }
  const timeline = await page.evaluate(() => window.__pbdTimeline.splice(0));
  await writeFile(join(out, r.name, "frames.json"), JSON.stringify({ t0: r.t0, frames: index }));
  await writeFile(join(out, r.name, "timeline.json"), JSON.stringify(timeline, null, 1));
  const dur = index.length > 1 ? (index[index.length - 1].ts - index[0].ts) / 1000 : 0;
  const fps = dur ? (index.length / dur).toFixed(1) : "n/a";
  console.log(`rec ${r.name}: ${index.length} frames, ${dur.toFixed(1)}s, ${fps} fps`);
  report.scenarios[r.name] = { frames: index.length, seconds: Number(dur.toFixed(2)), fps: Number(fps) };
  return index;
}

// ---------- 공용 도우미 ----------
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, ok, detail) => { report.steps.push({ id, ok, detail }); console.log(ok ? "✓" : "✗", id, detail); };
const settled = async (done) => { for (let k = 0; k < 4; k++) { if (!(await done())) return false; await page.waitForTimeout(250); } return true; };
const pressEnterUntil = async (done, max = 40) => { for (let i = 0; i < max; i++) { if (await settled(done)) return true; await page.keyboard.press("Enter"); await page.waitForTimeout(250); } return settled(done); };
const teleport = async (mapId, x, y, quiet = false) => {
  if (!quiet) report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(600);
};
const live = () => page.evaluate(() => { const s = window.__oprnHooksScene.session; return { map: s.currentMapId, x: s.x, y: s.y, party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })), box: s.monsterBox ?? [], inventory: s.inventory }; });
const free = (mapId, x, y) => !project.maps[mapId].events.some((e) => e.x === x && e.y === y);
const besideOf = (mapId, ev) => [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]].map(([dx, dy, dir]) => ({ x: ev.x + dx, y: ev.y + dy, dir })).find((p) => free(mapId, p.x, p.y));
const talk = async (dir) => { for (let a = 0; a < 6; a++) { await page.evaluate((d) => window.__oprnInput.face(d), dir); await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700); if (await present("dialogue-box") || await present("battle-scene")) return true; } return false; };
const stepMoves = async (dir) => { const b = await page.evaluate(() => window.__oprnDebug.readLive()); await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(280); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(250); const a = await page.evaluate(() => window.__oprnDebug.readLive()); return a.x !== b.x || a.y !== b.y; };
const mark = (label) => page.evaluate((l) => { (window.__pbdTimeline ??= []).push({ t: performance.timeOrigin + performance.now(), k: "MARK", v: l }); }, label);

async function bootAndStarter() {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 180000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);
  const lab = Object.values(project.maps).find((m) => m.events.some((e) => /professor/.test(e.id)));
  const prof = lab.events.find((e) => /professor/.test(e.id));
  const spot = besideOf(lab.id, prof);
  await teleport(lab.id, spot.x, spot.y);
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await pressEnterUntil(async () => (await live()).party.length > 0 && !(await present("dialogue-box")), 80);
  const st = await live();
  step("starter", st.party.length === 1, st.party.map((m) => `${m.speciesId} Lv${m.level}`).join(","));
  return { lab };
}

const route = project.maps["mx_map_meadow"];
const habitat = route.locations.find((l) => l.id === "mx_map_meadow_habitat");
/** 야생 조우: 풀숲에서 좌우로 걸어 실제 조우를 건다(랜덤). */
async function findWild() {
  const cx = habitat.x + habitat.w / 2, cy = habitat.y + habitat.h / 2;
  const cand = [];
  for (let y = habitat.y; y < habitat.y + habitat.h; y++) for (let x = habitat.x; x < habitat.x + habitat.w - 1; x++) if (free(route.id, x, y) && free(route.id, x + 1, y)) cand.push({ x, y });
  cand.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  let cell = null;
  for (const c of cand.slice(0, 40)) {
    const ok = await teleport(route.id, c.x, c.y, true).then(() => true, () => false);
    if (ok && await stepMoves("right") && await stepMoves("left")) { cell = c; break; }
    if (await present("battle-scene")) { cell = c; break; }
  }
  report.debugWrites.push(`teleport ${route.id} grass (${cell?.x},${cell?.y})`);
  let enc = false;
  for (let i = 0; i < 160 && !enc; i++) {
    await page.evaluate((d) => window.__oprnInput.dir(d), i % 2 ? "left" : "right");
    await page.waitForTimeout(260);
    await page.evaluate(() => window.__oprnInput.dir(null));
    enc = await present("battle-scene");
  }
  return enc;
}

const waitCmd = (timeout = 40000) => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout }).then(() => true, () => false);
async function pressSkill(index = 0) {
  await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
  const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
  await skills.first().waitFor({ timeout: 10000 });
  const n = await skills.count();
  const pick = skills.nth(Math.min(index, n - 1));
  const id = await pick.getAttribute("data-testid");
  await pick.focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
  if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
  return id;
}
/** 전투가 끝날 때까지 싸운다. 정지하지 않고 최대 turns 턴. */
async function fightToEnd({ maxTurns = 30, skillIndex = 0, onTurn, holdResultMs = 0 } = {}) {
  for (let turn = 0; turn < maxTurns; turn++) {
    if (!(await present("battle-scene"))) return "ended";
    if (await present("battle-result-panel")) { if (holdResultMs) { await mark("result-hold"); await page.waitForTimeout(holdResultMs); } await pressEnterUntil(async () => !(await present("battle-scene")), 30); return "result"; }
    const forced = page.locator('[data-testid^="actor-switch-"]');
    if (!(await page.locator('[data-testid="actor-command-fight"]').count())) {
      if (await forced.count()) { await mark("forced-switch"); await forced.first().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(800); continue; }
      await page.keyboard.press("Enter"); await page.waitForTimeout(250); continue;
    }
    if (!(await waitCmd(8000))) { await page.keyboard.press("Enter"); continue; }
    if (onTurn && await onTurn(turn)) continue;
    await mark(`turn${turn}-skill`);
    await pressSkill(skillIndex);
    await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]') || document.querySelector('[data-testid="battle-result-panel"]') || (document.querySelector('[data-testid="actor-command-fight"]') && document.querySelector('[data-testid="battle-scene"]').dataset.battleSequenceBusy === "false") || document.querySelector('[data-testid^="actor-switch-"]'), undefined, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  return "maxTurns";
}
async function waitBattleOver() {
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]'), undefined, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
}

const snap = async (name) => page.screenshot({ path: join(out, name + ".png") });
const results = {};
const healLead = () => page.evaluate(() => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) { const m = s.monsterInstances[id]; m.currentHp = undefined; } });
const setLead = (patch) => page.evaluate((patch) => { const s = window.__oprnHooksScene.session; const m = s.monsterInstances[s.monsterParty[0]]; Object.assign(m, patch); return { level: m.level, exp: m.exp, species: m.speciesId }; }, patch);
const hpFrac = () => page.evaluate(() => { for (const n of document.querySelectorAll('[data-testid^="battle-enemy-hp-"]')) { const [h, m] = (n.textContent ?? "").split("/").map(Number); if (m > 0 && h > 0) return h / m; } return null; });
async function scenarioWild() {
  await recStart("wild", 5000);
  const enc = await findWild();
  if (rec) rec.ring = 0;
  await mark("encounter-detected");
  const ready = await waitCmd(60000);
  await mark("command-ready");
  await page.waitForTimeout(1200);
  await snap("wild-command");
  report.geo = await page.evaluate(() => {
    const r = (sel) => [...document.querySelectorAll(sel)].filter((n) => n.getClientRects().length).map((n) => { const b = n.getBoundingClientRect(); const c = getComputedStyle(n); return { sel, cls: n.className?.toString().slice(0, 60), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), font: c.fontFamily.slice(0, 40), fs: c.fontSize, z: c.zIndex }; });
    const scene = document.querySelector('[data-testid="battle-scene"]');
    const imgs = [...scene.querySelectorAll("img,canvas")].filter((n) => n.getClientRects().length).map((n) => { const b = n.getBoundingClientRect(); return { tag: n.tagName, cls: n.className?.toString().slice(0, 50), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), nat: n.naturalWidth ? `${n.naturalWidth}x${n.naturalHeight}` : `${n.width}x${n.height}` }; });
    return { viewport: [innerWidth, innerHeight], scene: scene.getBoundingClientRect().toJSON(), imgs, win: r(".battle-message-window"), cmd: r(".battle-pokemon-root,.battle-command-panel,.battle-command-card"), enemyRow: r(".battle-enemy-list-row"), party: r(".battle-party .battle-actor-status"), field: r(".battle-field"), enemy: r(".battle-enemy"), skin: scene.dataset.battleSkin, stage: getComputedStyle(document.querySelector(".play-stage")||document.body).transform };
  });
  await page.locator('[data-testid="actor-command-fight"]').focus();
  await page.keyboard.press("Enter");
  await page.locator('.battle-submenu-header').waitFor({ timeout: 5000 }).catch(() => {});
  await mark("move-menu-open");
  await page.waitForTimeout(900);
  await snap("wild-moves");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const end = await fightToEnd({ maxTurns: 3, skillIndex: 0 });
  await mark("fight-3-turns-done");
  await page.waitForTimeout(500);
  await recStop();
  step("wild", enc && ready, JSON.stringify({ enc, ready, end }));
  if (await present("battle-scene")) { await fightToEnd({ maxTurns: 40 }); await waitBattleOver(); }
}
async function scenarioCatch() {
  await healLead();
  await recStart("catch", 5000);
  const enc = await findWild();
  if (rec) rec.ring = 0;
  await mark("encounter-detected");
  await waitCmd(60000);
  let threw = false;
  for (let turn = 0; turn < 12 && (await present("battle-scene")); turn++) {
    if (!(await waitCmd(20000))) { await page.keyboard.press("Enter"); continue; }
    const f = await hpFrac();
    if (f !== null && f <= 0.5) {
      await mark("item-menu");
      await page.locator('[data-testid="actor-command-item"]').focus(); await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
      await snap("catch-bag");
      const ball = page.locator('[data-testid^="actor-capture-"]').first();
      if (await ball.count()) { await mark("throw-ball"); await ball.focus(); await page.keyboard.press("Enter"); threw = true; await page.waitForTimeout(9000); await mark("after-throw-wait"); }
      else { await page.keyboard.press("Escape"); }
      if (!(await present("battle-scene"))) break;
      continue;
    }
    await mark("weaken");
    await pressSkill(0);
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(3000);
  await recStop();
  step("catch", enc, JSON.stringify({ enc, threw, scene: await present("battle-scene") }));
  if (await present("battle-scene")) { await fightToEnd({ maxTurns: 40 }); }
  await waitBattleOver();
}
async function scenarioLevelup() {
  await healLead();
  const m0 = await live();
  const lead = m0.party[0];
  const sp = project.database.monsterSpecies.find((x) => x.id === lead.speciesId);
  const curve = sp.expCurve;
  const total = (L) => { let t = 0; for (let l = 2; l <= L; l++) { t += curve.base + Math.floor(curve.extra * Math.pow(l - 1, 0.9)); t += Math.floor((l - 2) * curve.acceleration); } return t; };
  const L = lead.level;
  report.debugWrites.push(`lead exp set to (next level cumulative - 1) lv${L}`);
  await setLead({ exp: total(L + 1) - 1 });
  await recStart("levelup", 5000);
  const enc = await findWild();
  if (rec) rec.ring = 0;
  await mark("encounter-detected");
  await waitCmd(60000);
  await fightToEnd({ maxTurns: 40, skillIndex: 0 });
  await page.waitForTimeout(800);
  await recStop();
  step("levelup", enc, JSON.stringify(await live().then((l) => l.party.map((m) => `${m.speciesId} Lv${m.level}`))));
  await waitBattleOver();
}
async function scenarioExp() {
  await healLead();
  const m0 = await live();
  const lead = m0.party[0];
  const sp = project.database.monsterSpecies.find((x) => x.id === lead.speciesId);
  const curve = sp.expCurve;
  const total = (L) => { let t = 0; for (let l = 2; l <= L; l++) { t += curve.base + Math.floor(curve.extra * Math.pow(l - 1, 0.9)); t += Math.floor((l - 2) * curve.acceleration); } return t; };
  const L = lead.level;
  report.debugWrites.push(`lead exp set to 40% of lv${L} band`);
  await setLead({ exp: Math.floor(total(L) + (total(L + 1) - total(L)) * 0.4) });
  await recStart("exp", 6000);
  const enc = await findWild();
  if (rec) rec.ring = 0;
  await waitCmd(60000);
  await fightToEnd({ maxTurns: 40, skillIndex: Number(process.env.SKILL ?? 0), holdResultMs: Number(process.env.HOLD ?? 5000) });
  await page.waitForTimeout(800);
  await recStop();
  step("exp", enc, JSON.stringify(await live().then((l) => l.party.map((m) => `${m.speciesId} Lv${m.level} exp${m.exp}`))));
  await waitBattleOver();
}
async function scenarioEvolve() {
  await healLead();
  const m0 = await live();
  const lead = m0.party[0];
  const sp = project.database.monsterSpecies.find((x) => x.id === lead.speciesId);
  const need = sp.evolutions?.[0]?.requires?.level;
  if (!need) { step("evolve", false, "no level evolution"); return; }
  const curve = sp.expCurve;
  const total = (L) => { let t = 0; for (let l = 2; l <= L; l++) { t += curve.base + Math.floor(curve.extra * Math.pow(l - 1, 0.9)); t += Math.floor((l - 2) * curve.acceleration); } return t; };
  report.debugWrites.push(`lead set to lv${need - 1} exp edge to force evolution on next win`);
  await setLead({ level: need - 1, exp: total(need) - 1 });
  await recStart("evolve", 5000);
  const enc = await findWild();
  if (rec) rec.ring = 0;
  await mark("encounter-detected");
  await waitCmd(60000);
  await fightToEnd({ maxTurns: 40, skillIndex: 0 });
  await page.waitForTimeout(1500);
  await mark("after-battle-field");
  await recStop();
  step("evolve", enc, JSON.stringify(await live().then((l) => l.party.map((m) => `${m.speciesId} Lv${m.level}`))));
  await waitBattleOver();
}
async function scenarioTrainer() {
  await healLead();
  const trainer = route.events.find((e) => JSON.stringify(e.pages).includes('"battleProcessing"'));
  const near = besideOf(route.id, trainer);
  await teleport(route.id, near.x, near.y);
  await recStart("trainer", 3000);
  await talk(near.dir);
  const started = await pressEnterUntil(() => present("battle-scene"), 40);
  if (rec) rec.ring = 0;
  await mark("trainer-battle-on");
  await waitCmd(60000);
  await page.waitForTimeout(600);
  await snap("trainer-command");
  const end = await fightToEnd({ maxTurns: 30, skillIndex: 0 });
  await waitBattleOver();
  await mark("trainer-over");
  await page.waitForTimeout(600);
  await recStop();
  const st = await page.evaluate(() => window.__oprnDebug.readState().battleResult);
  step("trainer", started, JSON.stringify({ end, result: st, trainer: trainer.id }));
}
async function scenarioGym() {
  const gym = Object.values(project.maps).find((m) => m.events.some((e) => /_leader$/.test(e.id)) && /gym/.test(m.id));
  const leader = gym.events.find((e) => /_leader$/.test(e.id));
  const sw = JSON.stringify(leader.pages).match(/mx_gym_\d+_puzzle/g) ?? [];
  await page.evaluate((ids) => { for (const id of ids) window.__oprnDebug.setSwitch(id, true); }, [...new Set(sw)]);
  await healLead();
  report.debugWrites.push(`gym switches on; lead level >= 14`);
  await setLead({ level: 14, exp: 2800 });
  let talked = false;
  for (const [dx, dy, dir] of [[0, 1, "up"], [0, 2, "up"], [-1, 0, "right"], [1, 0, "left"]]) {
    const at = { x: leader.x + dx, y: leader.y + dy };
    if (!free(gym.id, at.x, at.y)) continue;
    try { await teleport(gym.id, at.x, at.y); } catch { continue; }
    await page.waitForTimeout(1500);
    await recStart("gym", 3000);
    if (await talk(dir)) { talked = true; break; }
    await recStop();
  }
  const started = talked && await pressEnterUntil(() => present("battle-scene"), 40);
  if (rec) rec.ring = 0;
  await mark("gym-battle-on");
  await waitCmd(60000);
  await page.waitForTimeout(600);
  await snap("gym-command");
  const end = await fightToEnd({ maxTurns: 40, skillIndex: 3 });
  await waitBattleOver();
  await page.waitForTimeout(500);
  await recStop();
  step("gym", started, JSON.stringify({ end, leader: leader.id }));
}
async function scenarioLose() {
  { const sw = Object.values(project.maps).flatMap((m) => JSON.stringify(m.events.filter((e) => /_leader$/.test(e.id)).map((e) => e.pages)).match(/mx_gym_\\d+_puzzle/g) ?? []); await page.evaluate((ids) => { for (const id of ids) window.__oprnDebug.setSwitch(id, true); }, [...new Set(sw)]); }
  const gym = Object.values(project.maps).find((m) => m.events.some((e) => /_leader$/.test(e.id)) && /gym/.test(m.id));
  const leader = gym.events.find((e) => /_leader$/.test(e.id));
  await healLead();
  report.debugWrites.push(`lead level 5 hp 3 to force a loss`);
  await setLead({ level: 5, exp: 0, currentHp: 3 });
  let talked = false;
  for (const [dx, dy, dir] of [[0, 1, "up"], [0, 2, "up"], [-1, 0, "right"], [1, 0, "left"]]) {
    const at = { x: leader.x + dx, y: leader.y + dy };
    if (!free(gym.id, at.x, at.y)) continue;
    try { await teleport(gym.id, at.x, at.y); } catch { continue; }
    await page.waitForTimeout(1200);
    await recStart("lose", 2000);
    if (await talk(dir)) { talked = true; break; }
    await recStop();
  }
  await pressEnterUntil(() => present("battle-scene"), 40);
  if (rec) rec.ring = 0;
  await waitCmd(60000);
  await fightToEnd({ maxTurns: 6, skillIndex: 0 });
  for (let i = 0; i < 30 && (await present("battle-scene")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(500); }
  await page.waitForTimeout(4000);
  await mark("after-loss");
  await recStop();
  step("lose", talked, "loss flow");
}
async function scenarioMisc() {
  await healLead();
  await recStart("misc", 5000);
  const enc = await findWild();
  if (rec) rec.ring = 0;
  await waitCmd(60000);
  await page.waitForTimeout(500);
  // 몬스터(교체) 메뉴
  await mark("party-menu");
  await page.locator('[data-testid="actor-command-pkmn"]').focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  await snap("misc-party");
  const sw = page.locator('[data-testid^="actor-switch-"]');
  const n = await sw.count();
  report.misc = { switchButtons: n };
  if (n > 1) { await mark("switch-choose"); await sw.nth(1).focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(6000); await mark("after-switch"); }
  else { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
  await waitCmd(20000);
  // 가방
  await mark("bag-open");
  await page.locator('[data-testid="actor-command-item"]').focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  await snap("misc-bag");
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  // 도망
  await waitCmd(20000);
  await mark("run");
  await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(5000);
  await mark("after-run");
  if (await present("battle-scene")) { await page.waitForTimeout(4000); }
  await recStop();
  step("misc", enc, JSON.stringify(report.misc));
  if (await present("battle-scene")) { await fightToEnd({ maxTurns: 40 }); }
  await waitBattleOver();
}
async function scenarioDom() {
  await healLead();
  const enc = await findWild();
  await waitCmd(60000);
  await page.waitForTimeout(600);
  const dump = async (name) => { const html = await page.evaluate(() => document.querySelector(".battle-command-host")?.outerHTML ?? ""); await writeFile(join(out, `dom-${name}.html`), html); };
  await dump("root");
  await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(800); await dump("moves"); await snap("dom-moves");
  report.ppStyle = await page.evaluate(() => { const n = document.querySelector(".battle-move-pp"); const c = getComputedStyle(n), b = getComputedStyle(n, "::before"), a = getComputedStyle(n, "::after"); return { before: b.content, after: a.content, lh: c.lineHeight, fs: c.fontSize, ts: c.textShadow, wm: c.writingMode, ws: c.whiteSpace, html: n.outerHTML, kids: n.childNodes.length }; });
  report.moveInfoRects = await page.evaluate(() => [...document.querySelectorAll(".battle-move-info,.battle-move-pp")].map((n) => { const r = n.getBoundingClientRect(); const c = getComputedStyle(n); return { cls: n.className, slot: n.dataset.moveSlot, d: c.display, v: c.visibility, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400); await snap("dom-moves-right");
  report.idleSamples = await page.evaluate(async () => { const q = (sel) => document.querySelector(sel); const out = []; for (let i = 0; i < 24; i++) { const e = q(".battle-enemy .battle-enemy-image"), a = q(".battle-actor-group .battle-monster-image, .battle-actor-group .battle-actor-image"); out.push({ e: e ? getComputedStyle(e).translate + "|" + getComputedStyle(e).animationName : null, a: a ? getComputedStyle(a).translate + "|" + getComputedStyle(a).animationName : null }); await new Promise((r) => setTimeout(r, 100)); } return out; });
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  await page.locator('[data-testid="actor-command-pkmn"]').focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(800); await dump("party");
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  await page.locator('[data-testid="actor-command-item"]').focus(); await page.keyboard.press("Enter");
  await page.waitForTimeout(800); await dump("bag");
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  step("dom", enc, "dumped");
  await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter");
  await waitBattleOver();
}
const table = { exp: scenarioExp, dom: scenarioDom, misc: scenarioMisc, wild: scenarioWild, catch: scenarioCatch, levelup: scenarioLevelup, evolve: scenarioEvolve, trainer: scenarioTrainer, gym: scenarioGym, lose: scenarioLose };
try {
  await bootAndStarter();
  for (const name of SCEN) {
    if (!table[name]) continue;
    try { await table[name](); } catch (e) { step(name, false, String(e?.message ?? e).slice(0, 300)); if (rec) await recStop(); await snap("fail-" + name).catch(() => {}); }
  }
} catch (e) {
  report.failure = String(e?.stack ?? e);
  console.error(report.failure);
  await snap("failure").catch(() => {});
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
process.exit(0);
