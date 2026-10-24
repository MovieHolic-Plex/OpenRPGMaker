// 폴른 스타 제1막 새 뼈대 실플레이 녹화 — 출하 플레이어(player.html), 체크포인트에서 시작, 1배 영상 + 효과음 다시 섞기.
//   FS_FIXTURE=dist/demos/chrono-bell.project.json node scripts/qa/runtime/fallen-act1.play.mjs [valen,dragon,panel]
// 구간: valen(추락지 발렌 등장~전투 시작) · dragon(용이 깨어남~관통상·3배 마법) · panel(「달의 아이」) · siege(포위~제1막 끝 카드)
// 결과: verify-shots/runtime-qa/fallen-act1/{facts.json, <seg>.webm, clip-*.mp4, native-*.png}
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-act1");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.FS_FIXTURE ?? "dist/demos/chrono-bell.project.json"), "utf8"));
const project = fixture.project ?? fixture;
const only = new Set((process.argv[2] ?? "valen,lose,hanel,dragon,panel").split(","));
const withSiege = !process.env.FS_NO_SIEGE;
const facts = { segments: {}, errors: [] };
const log = (...a) => console.error("[act1]", ...a);

const BASE = { sw_fs_main_started: true, sw_fs_main_step0: true, sw_fs_valen_marched: true, sw_fs_main_step1: true, sw_fs_iris_awake: true, sw_fs_iris_joined: true };
const trio = (level) => ["actor_hero", "actor_fs_elena", "actor_fs_iris"].map((actorId) => ({ actorId, level }));
const AFTER_CRASH = { ...BASE, sw_fs_valen_crash_on: true, sw_fs_valen_crash_met: true, sw_fs_main_step2: true, sw_fs_vault_seal_open: true, sw_fs_b3_west_lever: true, sw_fs_b3_sun_lever: true, sw_fs_b3_moon_lever: true };
const SEGMENTS = {
  // 세 단계 전부 + 회로까지 보이게 Lv10 로 녹화한다(헤드리스 승률 표는 Lv6~7).
  valen: { id: "fs-act1-valen", mapId: "fs_forest", x: 15, y: 9, facing: "down", switches: { ...BASE, sw_fs_valen_crash_on: true }, party: trio(10), items: { item_potion: 6, item_hi_potion: 3, item_ether: 4 } },
  lose: { id: "fs-act1-lose", mapId: "fs_forest", x: 15, y: 9, facing: "down", switches: { ...BASE, sw_fs_valen_crash_on: true }, party: trio(6), items: { item_potion: 3 } },
  hanel: { id: "fs-act1-hanel", mapId: "fs_observatory", x: 12, y: 13, facing: "up", switches: { ...BASE, sw_fs_valen_crash_on: true, sw_fs_valen_crash_met: true, sw_fs_valen_soldiers_gone: true, sw_fs_main_step2: true }, variables: { var_fs_main_progress: 3 }, party: trio(8), items: { item_potion: 3, item_fs_star_key: 1, item_fs_circuit: 1 } },
  dragon: { id: "fs-act1-dragon", mapId: "fs_vault_b4", x: 14, y: 26, facing: "up", switches: { ...AFTER_CRASH }, party: trio(8), items: { item_potion: 6, item_hi_potion: 3, item_ether: 4 } },
  panel: { id: "fs-act1-panel", mapId: "fs_vault_b4", x: 14, y: 4, facing: "up", switches: { ...AFTER_CRASH, sw_fs_dragon_met: true, sw_fs_dragon_down: true }, party: trio(9), items: { item_potion: 3 } },
};

const state = (page) => page.evaluate(() => { const s = window.__oprnDebug.readState(); return { map: s.currentMapId, x: s.x, y: s.y }; });
const ui = (page) => page.evaluate(() => ({
  box: document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? null,
  battle: !!document.querySelector('[data-testid="battle-scene"]'),
  ending: !!document.querySelector('[data-testid="ending-screen"]'),
  msg: document.querySelector('[data-testid="battle-message-window"]')?.innerText ?? "",
}));
const shots = [];
let textShots = 0;
const shot = (page, tag, delay = 0) => shots.push(page.waitForTimeout(delay).then(() => page.screenshot({ path: resolve(out, `native-${tag}.png`) })).catch(() => {}));

/** 대사를 1배 속도로 읽는다 — 긴 단말 글은 길게 머문다. until() 이 참이면 멈춘다. */
async function read(page, texts, until, { maxMs = 240_000 } = {}) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < maxMs) {
    const s = await ui(page);
    if (await until(s)) return "until";
    if (s.box === null) { await page.waitForTimeout(150); continue; }
    const clean = s.box.replace(/\s+/g, " ").trim();
    if (clean && clean !== last) {
      await page.waitForTimeout(900);
      const full = ((await ui(page)).box ?? clean).replace(/\s+/g, " ").trim();
      texts.push(full); last = full;
      const long = full.length > 70 || /\[|▒/.test(full);
      await page.waitForTimeout(long ? 2800 : 900);
      if (/달의 아이|맏딸|정착 확인|잘 지내|잡아라|선생님/.test(clean) && textShots < 10) { textShots += 1; shot(page, `text-${texts.length}`); }
    } else {
      await page.waitForTimeout(250);
    }
    await page.keyboard.press("Enter", { delay: 100 });
    await page.waitForTimeout(250);
  }
  return "timeout";
}

/** 전투 한 걸음 — 지금 차례 배우의 계획(기술 id 또는 attack)대로 명령·대상을 누른다. */
const battleStep = (page, plan) => page.evaluate((plan) => {
  const live = [...document.querySelectorAll("button")].filter((n) => !n.disabled && n.offsetParent !== null && n.dataset.previewOnly !== "true");
  const by = (t) => live.find((n) => n.dataset.testid === t);
  const targets = live.filter((n) => (n.dataset.testid || "").startsWith("battle-target-") && n.dataset.testid !== "battle-target-cancel");
  const target = (plan.__target && targets.find((n) => (n.innerText || n.getAttribute("aria-label") || "").includes(plan.__target))) ?? targets[0];
  if (target) { target.click(); return "target"; }
  const name = document.querySelector("[data-actor-name]")?.dataset.actorName ?? "";
  const want = plan[name] ?? "attack";
  if (want !== "attack") {
    const skill = by(`actor-skill-${want}`) ?? by(`actor-command-skill-${want}`);
    if (skill) { skill.click(); return `skill:${want}`; }
    const menu = by("actor-command-skill");
    if (menu) { menu.click(); return `menu:${name}`; }
  }
  const attack = by("actor-command-attack");
  if (attack) { attack.click(); return `attack:${name}`; }
  return null;
}, plan);

async function segment(browser, server, key, run) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
  const t0 = Date.now();
  const marks = {};
  const mark = (name) => { marks[name] = +((Date.now() - t0) / 1000).toFixed(2); log(key, "mark", name, marks[name]); };
  const page = await context.newPage();
  page.on("pageerror", (e) => facts.errors.push(`${key}: ${String(e)}`));
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
    localStorage.clear();
    window.__qaSfx = [];
    // 미리 받은 소리는 blob: 주소로 재생된다 — 원래 주소로 되돌릴 수 있게 Response→Blob→URL 을 잇는다.
    const blobSrc = new WeakMap(); window.__qaBlobUrl = {};
    const rblob = Response.prototype.blob;
    Response.prototype.blob = function () { const url = this.url; return rblob.call(this).then((b) => { try { blobSrc.set(b, url); } catch {} return b; }); };
    const mk = URL.createObjectURL;
    URL.createObjectURL = function (o) { const u = mk.call(URL, o); try { const src = blobSrc.get(o); if (src) window.__qaBlobUrl[u] = src; } catch {} return u; };
    // 스트림으로 읽어 new Blob(chunks) 로 묶는 미리 받기(scenePreload)도 원래 주소를 잃지 않게 한다.
    const streamUrl = new WeakMap(), chunkUrl = new WeakMap();
    const bodyDesc = Object.getOwnPropertyDescriptor(Response.prototype, "body");
    Object.defineProperty(Response.prototype, "body", { configurable: true, get() { const b = bodyDesc.get.call(this); try { if (b) streamUrl.set(b, this.url); } catch {} return b; } });
    const getReader = ReadableStream.prototype.getReader;
    ReadableStream.prototype.getReader = function (...a) {
      const r = getReader.apply(this, a); const u = streamUrl.get(this);
      if (u && typeof r.read === "function") { const rd = r.read.bind(r); r.read = () => rd().then((res) => { try { if (res && res.value && typeof res.value === "object") chunkUrl.set(res.value, u); } catch {} return res; }); }
      return r;
    };
    const NativeBlob = window.Blob;
    window.Blob = class extends NativeBlob { constructor(parts, opts) { super(parts, opts); try { const u = parts && parts.length ? chunkUrl.get(parts[0]) : undefined; if (u) blobSrc.set(this, u); } catch {} } };
    // 효과음 대부분은 WebAudio 버퍼로 난다 — 받은 바이트 → 디코딩 버퍼 → 재생 시작을 원래 주소로 잇는다.
    const abUrl = new WeakMap(), bufUrl = new WeakMap();
    const abs = (u) => { try { return window.__qaBlobUrl[u] ?? new URL(u, location.href).href; } catch { return u; } };
    const rab = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = function () { const u = this.url; return rab.call(this).then((b) => { try { abUrl.set(b, abs(u)); } catch {} return b; }); };
    const xopen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u, ...r) { this.__qaUrl = String(u); return xopen.call(this, m, u, ...r); };
    const respDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "response");
    Object.defineProperty(XMLHttpRequest.prototype, "response", { configurable: true, get() { const r = respDesc.get.call(this); try { if (r instanceof ArrayBuffer && this.__qaUrl) abUrl.set(r, abs(this.__qaUrl)); } catch {} return r; } });
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (ab, ok, err) {
      const u = abUrl.get(ab);
      const tag = (buf) => { try { if (u && buf) bufUrl.set(buf, u); } catch {} return buf; };
      const p = decode.call(this, ab, ok ? (b) => { tag(b); ok(b); } : undefined, err);
      return p && typeof p.then === "function" ? p.then(tag) : p;
    };
    const startSrc = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      try { const u = this.buffer && bufUrl.get(this.buffer); if (u && !this.loop) window.__qaSfx.push({ at: Date.now(), src: u, volume: 0.85, via: "webaudio" }); } catch {}
      return startSrc.apply(this, a);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) {
      try { if (!this.loop) { const raw = this.currentSrc || this.src; window.__qaSfx.push({ at: Date.now(), src: window.__qaBlobUrl[raw] ?? raw, volume: this.volume }); } } catch {}
      return play.apply(this, a);
    };
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, qaCheckpoint };
  }, ["/__runtime-qa/project.json", `fs-act1-${key}-${Date.now()}`, SEGMENTS[key]]);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => !!window.__oprnDebug && !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  await page.waitForTimeout(2000);
  const seg = { marks, texts: [] };
  try { await run(page, mark, seg); } catch (e) { seg.error = String(e); log(key, "ERR", e); }
  await Promise.all(shots.splice(0));
  seg.sfx = (await page.evaluate(() => window.__qaSfx ?? [])).map((c) => ({ ...c, t: +((c.at - t0) / 1000).toFixed(3) }));
  const video = await page.video().path();
  await context.close();
  await copyFile(video, resolve(out, `${key}.webm`));
  seg.video = resolve(out, `${key}.webm`);
  facts.segments[key] = seg;
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  if (only.has("valen")) await segment(browser, server, "valen", async (page, mark, seg) => {
    mark("valen_start");
    // 체크포인트가 「발렌이 올라온다」 스위치를 켠 채로 맵에 들어온다 — 자동 실행 인트로가 곧바로 돈다.
    shot(page, "valen-walk", 4200);
    await read(page, seg.texts, (s) => s.battle);
    shot(page, "valen-p1", 3500);
    await page.waitForTimeout(2000);
    // 1단계 병사 → 2단계 발렌 → 3단계 기계(번개로). 끝나면 연막·회로까지.
    const plan = { 카엘: "attack", 엘레나: "skill_mage_fireball", 이리스: "attack" };
    const msgs = [];
    let idle = 0, p2 = false, p3 = false, bolts = 0;
    const tEnd = Date.now() + 420_000;
    while (Date.now() < tEnd) {
      const s = await ui(page);
      if (!s.battle) break;
      const line = s.box ? `[대사] ${s.box.replace(/\s+/g, " ").trim()}` : s.msg;
      if (line && line !== msgs.at(-1)) {
        msgs.push(line);
        if (!p2 && /쓸모없는 것들/.test(line)) { p2 = true; mark("valen_p2"); plan.__target = "발렌"; shot(page, "valen-p2", 1200); }
        if (!p3 && /금단의 주술/.test(line)) { p3 = true; mark("valen_p3"); shot(page, "valen-transform", 2500); }
        if (p3 && /전기로 태워요/.test(line)) { Object.assign(plan, { 이리스: "skill_fs_iris_shock", 엘레나: "skill_mage_chain_lightning", 카엘: "attack" }); }
        if (p3 && /전격탄|연쇄 번개/.test(line) && bolts < 3) { bolts += 1; shot(page, `valen-bolt-${bolts}`, 900); }
      }
      const step = await battleStep(page, plan);
      if (step) idle = 0; else if (s.box !== null || ++idle > 8) { await page.keyboard.press("Enter", { delay: 80 }); idle = 0; }
      await page.waitForTimeout(step ? 450 : 300);
    }
    seg.battleMessages = msgs;
    mark("valen_won");
    await read(page, seg.texts, (s) => /회로.*손에 넣었다/.test(s.box ?? "") , { maxMs: 120_000 });
    shot(page, "valen-circuit", 300);
    await read(page, seg.texts, async () => false, { maxMs: 9_000 });
    mark("valen_end");
  });
  if (only.has("lose")) await segment(browser, server, "lose", async (page, mark, seg) => {
    mark("lose_start");
    // 진 갈래: 일행 체력을 1 로 깎아 두고 막기만 한다 — 게임 오버 없이 브람의 기습으로 이어지는지 본다.
    await page.evaluate(() => { for (const id of window.__oprnDebug.readState().partyActorIds) window.__oprnSetActorVitals(id, 1, 999); });
    await read(page, seg.texts, (s) => s.battle);
    await page.waitForTimeout(1500);
    mark("lose_battle");
    const msgs = [];
    let idle = 0;
    const tEnd = Date.now() + 180_000;
    while (Date.now() < tEnd) {
      const s = await ui(page);
      if (!s.battle) break;
      const line = s.box ? `[대사] ${s.box.replace(/\s+/g, " ").trim()}` : s.msg;
      if (line && line !== msgs.at(-1)) msgs.push(line);
      const step = await page.evaluate(() => {
        const live = [...document.querySelectorAll("button")].filter((n) => !n.disabled && n.offsetParent !== null && n.dataset.previewOnly !== "true");
        const ok = live.find((n) => n.dataset.testid === "battle-result-confirm"); if (ok) { ok.click(); return "confirm"; }
        const d = live.find((n) => n.dataset.testid === "actor-command-defend"); if (d) { d.click(); return "defend"; }
        return null;
      });
      if (step) idle = 0; else if (s.box !== null || ++idle > 8) { await page.keyboard.press("Enter", { delay: 80 }); idle = 0; }
      await page.waitForTimeout(step ? 450 : 300);
    }
    seg.battleMessages = msgs;
    mark("lose_lost");
    await read(page, seg.texts, (s) => /연기 터진다/.test(s.box ?? ""), { maxMs: 60_000 });
    mark("lose_ambush");
    shot(page, "lose-ambush", 400);
    await read(page, seg.texts, (s) => /회로/.test(s.box ?? "") && /손에 넣었다|하넬/.test(s.box ?? ""), { maxMs: 90_000 });
    shot(page, "lose-circuit", 300);
    await read(page, seg.texts, async () => false, { maxMs: 12_000 });
    seg.after = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return { lost: s.switches.sw_fs_valen_lost === true, circuit: s.inventory.item_fs_circuit ?? 0, map: s.currentMapId, over: !!document.querySelector('[data-testid="game-over-screen"]') }; });
    mark("lose_end");
  });
  if (only.has("hanel")) await segment(browser, server, "hanel", async (page, mark, seg) => {
    mark("hanel_start");
    await page.evaluate(() => window.__oprnInput.action());
    await read(page, seg.texts, (s) => /렌즈가 문을 열거든/.test(s.box ?? ""), { maxMs: 180_000 });
    shot(page, "hanel-circuit", 300);
    await page.waitForTimeout(2500);
    mark("hanel_end");
  });
  if (only.has("dragon")) await segment(browser, server, "dragon", async (page, mark, seg) => {
    mark("dragon_start");
    shot(page, "dragon-map", 1500);
    await page.waitForTimeout(2500);
    await page.keyboard.down("ArrowUp"); await page.waitForTimeout(2200); await page.keyboard.up("ArrowUp");
    await read(page, seg.texts, (s) => s.battle);
    await page.waitForTimeout(2500);
    const plan = { 카엘: "skill_hero_rush_pierce", 엘레나: "skill_mage_fireball", 이리스: "attack" };
    const msgs = [];
    let cracked = 0, castsAfter = 0, idle = 0;
    const tEnd = Date.now() + 150_000;
    while (Date.now() < tEnd) {
      const s = await ui(page);
      const line = s.box ? `[대사] ${s.box.replace(/\s+/g, " ").trim()}` : s.msg;
      if (line && line !== msgs.at(-1)) {
        msgs.push(line);
        if (/비늘이 갈라졌다|관통상에 걸렸다/.test(line) && !cracked) { cracked = Date.now(); plan.카엘 = "attack"; shot(page, "dragon-crack", 200); }
        if (cracked && /엘레나가 파이어볼/.test(line)) { castsAfter += 1; shot(page, `dragon-magic-${castsAfter}`, 700); }
      }
      if (cracked && castsAfter >= 2) { await page.waitForTimeout(3500); break; }
      const step = await battleStep(page, plan);
      if (step) { log("battle", step); idle = 0; } else if (s.box !== null || ++idle > 8) { await page.keyboard.press("Enter", { delay: 80 }); idle = 0; }
      await page.waitForTimeout(step ? 450 : 300);
    }
    seg.battleMessages = msgs;
    mark("dragon_end");
  });
  if (only.has("panel")) await segment(browser, server, "panel", async (page, mark, seg) => {
    mark("panel_start");
    await page.evaluate(() => window.__oprnInput.action());
    await read(page, seg.texts, async () => (await state(page)).map !== "fs_vault_b4", { maxMs: 300_000 });
    mark("panel_end");
    if (!withSiege) return;
    mark("siege_start");
    await read(page, seg.texts, (s) => s.ending, { maxMs: 300_000 });
    shot(page, "ending-card", 2500);
    await page.waitForTimeout(6000);
    await page.keyboard.press("Enter"); await page.waitForTimeout(150); await page.keyboard.press("Enter");
    shot(page, "ending-credits", 3500);
    await page.waitForTimeout(7000);
    mark("siege_end");
  });
} finally {
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
  await browser.close();
  await server.close?.();
}

for (const [key, seg] of Object.entries(facts.segments)) {
  const clips = key === "panel" ? ["panel", "siege"] : [key];
  for (const tag of clips) {
    const a = seg.marks[`${tag}_start`], b = seg.marks[`${tag}_end`];
    if (a === undefined || b === undefined) continue;
    const start = Math.max(0, a - 0.3), end = b + 0.3;
    const file = resolve(out, `clip-${tag}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", seg.video, "-ss", String(start), "-to", String(end),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", file]);
    muxSfx(file, seg.sfx ?? [], start, end);
    log("clip", tag, start, end);
  }
}
await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
console.error("DONE");

/** 녹화에는 소리가 없다 — 실행 중 기록한 효과음 큐(시각·파일·음량)대로 실제 SE 파일을 그 시각에 섞는다(fallen-interact 와 같은 방식). */
function muxSfx(file, sfx, start, end) {
  const cues = sfx.filter((c) => c.t >= start - 0.05 && c.t <= end && c.src && !c.src.startsWith("blob:"));
  const local = (src) => resolve("public", decodeURIComponent(new URL(src).pathname).replace(/^\//, ""));
  const args = ["-y", "-loglevel", "error", "-i", file];
  const parts = [];
  cues.forEach((c, i) => {
    args.push("-i", local(c.src));
    const ms = Math.max(0, Math.round((c.t - start) * 1000));
    parts.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=${c.volume ?? 1}[a${i}]`);
  });
  const dur = (end - start).toFixed(3);
  const mix = cues.length
    ? `${parts.join(";")};${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:duration=longest,apad,atrim=0:${dur}[aout]`
    : `anullsrc=r=48000:cl=stereo,atrim=0:${dur}[aout]`;
  const tmp = file.replace(/\.mp4$/, ".mux.mp4");
  execFileSync("ffmpeg", [...args, "-filter_complex", mix, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", tmp]);
  execFileSync("mv", [tmp, file]);
  log("mux", file.split("/").pop(), `${cues.length} cues`);
}
