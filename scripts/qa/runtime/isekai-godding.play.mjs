// 『이세계로 떠난 한국 고딩, 깽판치다』 실플레이 녹화 — 출하 플레이어(player.html, shim 경로), 1배 영상(+소리).
//   IG_FIXTURE=dist/demos/isekai-godding.play.json IG_AUDIO=1 node scripts/qa/runtime/isekai-godding.play.mjs [first,goblin,castle,home,stay,chaos]
// 결과: verify-shots/runtime-qa/isekai-godding/{facts.json, <구간>.webm, <구간>-audio.webm, native-*.png}
// ffmpeg 가 없으면(원격 VM) 소리 파일만 남기고 합치기는 건너뛴다 — 로컬에서 mux.sh 로 합친다.
// 대사는 사람 속도로 넘기고(한 줄 ~1.4초), 선택지는 구간마다 정한 번호를 고른다. 걷기는 길 찾기(playerRoute)로 실제로 걷는다.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { installOpeningEvidence } from "../../lib/runtimeOpeningEvidence.mjs";
import { execFileSync } from "node:child_process";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/isekai-godding");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.IG_FIXTURE ?? "dist/demos/isekai-godding.play.json"), "utf8"));
const project = fixture.project ?? fixture;
const only = new Set((process.argv[2] ?? "first").split(","));
const PACE = Number(process.env.IG_PACE ?? 1400);
const facts = { segments: {}, errors: [] };
const log = (...a) => console.error("[ig]", ...a);
const hasFfmpeg = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();

const evAt = (mapId, id) => {
  const e = project.maps[mapId]?.events.find((x) => x.id === id);
  if (!e) throw new Error(`${mapId}/${id} 없음`);
  return { x: e.x, y: e.y };
};
const doorTo = (mapId, toMap) => {
  const e = project.maps[mapId].events.find((x) => JSON.stringify(x.pages ?? x.commands).includes(`"mapId":"${toMap}"`));
  if (!e) throw new Error(`${mapId} → ${toMap} 문 없음`);
  return { x: e.x, y: e.y };
};
const M = { hall: "map_ig_hall", capital: "map_ig_capital", guild: "map_ig_guild", forest: "map_ig_forest", goblin: "map_ig_goblin", castle: "map_ig_castle", castle2: "map_ig_castle_f2", class: "map_ig_class" };
const hallExit = doorTo(M.hall, M.capital);
const capGuildDoor = doorTo(M.capital, M.guild);
const capEast = doorTo(M.capital, M.forest);
const guildExit = doorTo(M.guild, M.capital);
const forestToGoblin = doorTo(M.forest, M.goblin);
const goblinToCastle = doorTo(M.goblin, M.castle);
const castleUp = doorTo(M.castle, M.castle2);
log("doors", { hallExit, capGuildDoor, capEast, guildExit, forestToGoblin, goblinToCastle, castleUp });

const PARTY3 = [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_ig_edel", level: 6 }, { actorId: "actor_ig_fio", level: 6 }];
const PARTY4 = [...PARTY3.map((p) => ({ ...p, level: 9 })), { actorId: "actor_ig_kkur", level: 9 }];
const CP = {
  goblin: { id: "ig-goblin", mapId: M.forest, x: forestToGoblin.x - 1, y: forestToGoblin.y, facing: "right", variables: { var_ig_stage: 3, var_ig_chaos: 2 }, switches: { sw_ig_guild_line: true, sw_ig_slime_done: true }, party: PARTY3 },
  castle: { id: "ig-castle", mapId: M.goblin, x: goblinToCastle.x, y: goblinToCastle.y + 1, facing: "up", variables: { var_ig_stage: 4, var_ig_chaos: 3, var_ig_diplo: 2 }, switches: { sw_ig_guild_line: true, sw_ig_slime_done: true }, party: PARTY4 },
  top: { id: "ig-top", mapId: M.castle, x: castleUp.x, y: castleUp.y + 1, facing: "up", variables: { var_ig_stage: 5, var_ig_chaos: 3, var_ig_diplo: 2 }, switches: { sw_ig_guild_line: true, sw_ig_slime_done: true, sw_ig_quiz_done: true, sw_ig_dean_done: true, sw_ig_k1_seen: true }, party: PARTY4 },
};
const topWithTteok = { ...CP.top, id: "ig-top-tteok", items: { item_ig_tteokbokki: 1 } };
const topChaos = { ...CP.top, id: "ig-top-chaos", variables: { ...CP.top.variables, var_ig_chaos: 6 } };

const ui = (page) => page.evaluate(() => ({
  box: document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? null,
  choices: [...document.querySelectorAll('[data-testid^="runtime-choice-"]')].map((n) => n.innerText.trim()).filter(Boolean),
  battle: !!document.querySelector('[data-testid="battle-scene"]'),
  result: !!document.querySelector('[data-testid="battle-result-panel"]'),
  ending: !!document.querySelector('[data-testid="ending-screen"]'),
  title: !!document.querySelector('[data-testid="title-screen"]'),
}));
const st = (page) => page.evaluate(() => { const s = window.__oprnDebug?.readState(); return s ? { map: s.currentMapId, x: s.x, y: s.y, v: s.variables, party: s.partyActorIds } : null; });
const shots = [];
const shot = (page, tag, delay = 0) => shots.push(page.waitForTimeout(delay).then(() => page.screenshot({ path: resolve(out, `native-${tag}.png`) })).catch(() => {}));

async function read(page, seg, until = async () => false, { maxMs = 300_000, shotOn = null } = {}) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < maxMs) {
    const s = await ui(page);
    if (await until(s)) return "until";
    if (s.choices.length) return "choices";
    if (s.box === null) { await page.waitForTimeout(200); continue; }
    const clean = s.box.replace(/\s+/g, " ").trim();
    if (clean && clean !== last) {
      await page.waitForTimeout(500);
      const full = ((await ui(page)).box ?? clean).replace(/\s+/g, " ").trim();
      seg.texts.push(full); last = full;
      if (shotOn && shotOn.test(full)) shot(page, `${seg.key}-${seg.texts.length}`);
      await page.waitForTimeout(Math.min(4200, PACE + full.length * 22));
    } else {
      await page.waitForTimeout(250);
    }
    if ((await ui(page)).choices.length) return "choices";
    await page.keyboard.press("Enter", { delay: 90 });
    await page.waitForTimeout(220);
  }
  return "timeout";
}
async function choose(page, seg, index) {
  const s = await ui(page);
  seg.texts.push(`[선택지] ${s.choices.join(" | ")} → ${index}`);
  shot(page, `${seg.key}-choice-${seg.texts.length}`);
  await page.waitForTimeout(1600);
  for (let i = 0; i < index; i++) { await page.keyboard.press("ArrowDown", { delay: 80 }); await page.waitForTimeout(260); }
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter", { delay: 90 });
  await page.waitForTimeout(600);
}
async function play(page, seg, picks, until, opts) {
  const queue = [...picks];
  for (;;) {
    const r = await read(page, seg, until, opts);
    if (r !== "choices") return r;
    await choose(page, seg, queue.length ? queue.shift() : 0);
  }
}
let quietSince = null;
const idle = async (s) => {
  if (s.box !== null || s.choices.length || s.battle) { quietSince = null; return false; }
  quietSince ??= Date.now();
  if (Date.now() - quietSince < 2500) return false;
  quietSince = null; return true;
};
const quietAnd = (cond) => async (s) => (await idle(s)) && (await cond(s));
const onMap = (page, mapId) => async () => (await st(page))?.map === mapId;
async function walkTo(page, x, y, timeout = 45_000) {
  const from = await st(page);
  const go = () => page.evaluate(([x, y]) => window.__oprnDebug.playerRoute([{ kind: "approach", x, y, distance: 0 }]), [x, y]);
  await go();
  const t0 = Date.now();
  let ok = false, last = from, stillSince = Date.now(), retries = 0;
  while (Date.now() - t0 < timeout) {
    const s = await st(page); if (s && s.x === x && s.y === y) { ok = true; break; }
    const u = await ui(page); if (u.box !== null || u.choices.length || u.battle) { ok = true; break; }
    if (from && s && s.map !== from.map) { ok = true; await page.evaluate(() => window.__oprnDebug.playerRoute([])); break; }
    if (s && last && (s.x !== last.x || s.y !== last.y)) { stillSince = Date.now(); last = s; }
    else if (Date.now() - stillSince > 1800) { retries++; stillSince = Date.now(); await go(); }
    await page.waitForTimeout(200);
  }
  const to = await st(page);
  log("walk", `${from?.map}:${from?.x},${from?.y} → want ${x},${y} → ${to?.map}:${to?.x},${to?.y}`, ok ? "" : "TIMEOUT", retries ? `retries ${retries}` : "");
  return ok;
}
async function waitMap(page, mapId, ms = 20_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await st(page))?.map === mapId) return true; await page.waitForTimeout(250); }
  return false;
}
async function faceAndAct(page, dir) {
  await page.evaluate((dir) => window.__oprnDebug.playerRoute([{ kind: "turn", dir }]), dir);
  await page.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("z", { delay: 80 });
    await page.waitForTimeout(600);
    const u = await ui(page); if (u.box !== null || u.choices.length) return true;
  }
  return false;
}
async function step(page, dir, ms = 360) {
  const key = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[dir];
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
  await page.waitForTimeout(900);
}

async function battle(page, seg, plan) {
  const t0 = Date.now();
  let turns = 0;
  while (Date.now() - t0 < 600_000) {
    const s = await ui(page);
    if (!s.battle) return turns;
    if (s.box !== null && !s.choices.length) { await page.waitForTimeout(PACE); await page.keyboard.press("Enter", { delay: 90 }); await page.waitForTimeout(300); continue; }
    const done = await page.evaluate((plan) => {
      const live = [...document.querySelectorAll("button")].filter((n) => !n.disabled && n.offsetParent !== null && n.dataset.previewOnly !== "true");
      const by = (t) => live.find((n) => n.dataset.testid === t);
      const ok = by("battle-result-confirm"); if (ok) { ok.click(); return "confirm"; }
      const targets = live.filter((n) => (n.dataset.testid || "").startsWith("battle-target-") && n.dataset.testid !== "battle-target-cancel");
      if (targets.length) { targets[0].click(); return "target"; }
      const w = (window.__igb ??= { i: 0 });
      const want = plan[w.i % plan.length];
      if (want !== "attack") {
        const skill = by(`actor-skill-${want}`);
        if (skill) { w.i++; skill.click(); return `skill:${want}`; }
        const menu = by("actor-command-skill");
        if (menu && !w.triedMenu) { w.triedMenu = true; menu.click(); return "menu"; }
        w.triedMenu = false;
        const back = by("actor-command-back"); if (back) { w.i++; back.click(); return "back"; }
      }
      w.triedMenu = false;
      const attack = by("actor-command-attack"); if (attack) { w.i++; attack.click(); return "attack"; }
      return null;
    }, plan);
    if (done) { seg.texts.push(`[전투] ${done}`); if (done.startsWith("skill") || done === "attack") turns++; await page.waitForTimeout(900); }
    else { await page.waitForTimeout(500); }
    if (turns === 2 && !seg.battleShot) { seg.battleShot = true; shot(page, `${seg.key}-battle`, 1200); }
    if (done === "confirm") shot(page, `${seg.key}-result-${turns}`, 0);
  }
  return turns;
}

async function segment(browser, server, key, checkpoint, run) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
  const page = await context.newPage();
  const videoStart = Date.now();
  if (process.env.IG_AUDIO) await installOpeningEvidence(page, true);
  page.on("pageerror", (e) => facts.errors.push(`${key}: ${String(e).slice(0, 400)}`));
  page.on("console", (m) => {
    if (m.type() === "error") facts.errors.push(`${key} console: ${m.text().slice(0, 300)}`);
    else if (process.env.IG_DEBUG && !/public directory|Instead of/.test(m.text())) log("console", m.type(), m.text().slice(0, 300));
  });
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
    localStorage.clear();
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, ...(qaCheckpoint ? { qaCheckpoint } : {}) };
  }, ["/__runtime-qa/project.json", `ig-${key}-${Date.now()}`, checkpoint ?? null]);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  const t0 = Date.now();
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 300_000 });
  const seg = { key, texts: [], marks: {} };
  const mark = (name) => { seg.marks[name] = +((Date.now() - t0) / 1000).toFixed(1); log(key, name, seg.marks[name]); };
  try { await run(page, seg, mark); } catch (e) { seg.error = String(e); log(key, "ERR", e); }
  seg.final = await st(page).catch(() => null);
  await Promise.all(shots.splice(0));
  const sound = process.env.IG_AUDIO ? await page.evaluate(() => window.__oprnStopOpeningRecording?.()).catch((e) => { log(key, "audio ERR", e); return null; }) : null;
  const video = await page.video().path();
  await context.close();
  await copyFile(video, resolve(out, `${key}.webm`));
  if (sound?.dataUrl && sound.record?.startedAt) {
    const audioPath = resolve(out, `${key}-audio.webm`);
    await writeFile(audioPath, Buffer.from(sound.dataUrl.split(",")[1], "base64"));
    const offset = Math.max(0, (sound.record.startedAt - videoStart) / 1000).toFixed(2);
    seg.audio = { offset: Number(offset), media: sound.record.media.length, played: sound.record.media.filter((m) => m.played).length };
    if (hasFfmpeg) {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", resolve(out, `${key}.webm`), "-itsoffset", offset, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", resolve(out, `${key}-av.webm`)]);
      log(key, "audio muxed", offset, seg.audio);
    } else log(key, "audio saved (no ffmpeg — mux later)", offset, seg.audio);
  }
  facts.segments[key] = seg;
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
}
const ready = (page) => page.waitForFunction(() => !!window.__oprnDebug && !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 900_000 });
const startButton = async (page) => {
  for (let i = 0; i < 600; i++) {
    const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((n) => /시작하기|Start/.test(n.innerText) && n.offsetParent !== null); if (b) { b.click(); return true; } return false; });
    if (clicked) return true;
    const u = await ui(page); if (u.title || u.box !== null) return true;
    await page.waitForTimeout(500);
  }
  return false;
};
const fromCheckpoint = (fn) => async (page, seg, mark) => { await ready(page); await page.waitForTimeout(1500); mark("ready"); await fn(page, seg, mark); };

const PLAN3 = ["skill_ig_focus_fire", "skill_ig_royal_slash", "skill_ig_exam_fireball", "attack", "skill_ig_protocol_wall", "skill_ig_exam_fireball"];
const PLAN4 = ["skill_ig_focus_fire", "skill_ig_royal_slash", "skill_ig_summary_bolt", "skill_ig_group_call", "skill_ig_ping", "attack", "skill_ig_exam_fireball", "skill_ig_chief_roar"];

const B = {
  /** 타이틀 → 오프닝 → 소환 → 조작 → 길드 → 동쪽 숲 첫 전투. */
  async first(page, seg, mark) {
    await startButton(page);
    await page.waitForFunction(() => !!document.querySelector('[data-testid="title-screen"]'), null, { timeout: 600_000 });
    mark("title"); await page.waitForTimeout(3500); shot(page, "title");
    await page.waitForTimeout(2500);
    await page.keyboard.press("Enter"); mark("newgame");
    for (const [i, ms] of [[1, 3000], [2, 5000], [3, 5000]]) { await page.waitForTimeout(ms); shot(page, `opening-${i}`); }
    await ready(page); mark("runtime");
    await play(page, seg, [1], quietAnd(async () => (await st(page))?.v?.var_ig_stage === 1), { shotOn: /용사가 내려오셨다|모의고사|무릎/ }); mark("control");
    shot(page, "hall-control", 300);
    await walkTo(page, hallExit.x, hallExit.y - 1); await walkTo(page, hallExit.x, hallExit.y);
    await waitMap(page, M.capital); await page.waitForTimeout(1500); mark("capital");
    shot(page, "capital", 400);
    await walkTo(page, capGuildDoor.x, capGuildDoor.y + 1); await faceAndAct(page, "up"); await step(page, "up");
    await waitMap(page, M.guild); mark("guild");
    await play(page, seg, [0, 0, 1], quietAnd(async () => (await st(page))?.v?.var_ig_stage === 2), { shotOn: /한 분씩|번호|돌멩이|일곱 번째|단톡방/ }); mark("fio-joined");
    shot(page, "guild-after", 300);
    await walkTo(page, guildExit.x, guildExit.y - 1); await walkTo(page, guildExit.x, guildExit.y);
    await waitMap(page, M.capital); await page.waitForTimeout(1200); mark("capital2");
    await walkTo(page, capEast.x - 1, capEast.y); await walkTo(page, capEast.x, capEast.y);
    await waitMap(page, M.forest); mark("forest");
    await play(page, seg, [], async (s) => s.battle, { shotOn: /슬라임|점사/ }); mark("battle");
    shot(page, "first-battle", 2500);
    await battle(page, seg, PLAN3); mark("battle-end");
    await play(page, seg, [], idle, { shotOn: /PC방|점액/ }); mark("after");
    shot(page, "forest-after", 300);
  },
  async goblin(page, seg, mark) {
    await walkTo(page, forestToGoblin.x, forestToGoblin.y);
    await waitMap(page, M.goblin); mark("village");
    await play(page, seg, [1, 0], quietAnd(async () => (await st(page))?.v?.var_ig_stage === 4), { shotOn: /통행세|반반|공지방|단톡|방장/ }); mark("kkur");
    shot(page, "village-after", 300);
  },
  async goblinFight(page, seg, mark) {
    await walkTo(page, forestToGoblin.x, forestToGoblin.y);
    await waitMap(page, M.goblin); mark("village");
    await play(page, seg, [2, 2], async (s) => s.battle, { shotOn: /강퇴|비켜/ }); mark("battle");
    shot(page, "goblin-battle", 2500);
    await battle(page, seg, PLAN3); mark("battle-end");
    await play(page, seg, [], quietAnd(async () => (await st(page))?.v?.var_ig_stage === 4)); mark("kkur");
  },
  async castle(page, seg, mark) {
    await walkTo(page, goblinToCastle.x, goblinToCastle.y);
    await waitMap(page, M.castle); mark("castle");
    await play(page, seg, [], idle, { shotOn: /대본에 마왕성/ }); mark("enter");
    await walkTo(page, 8, 18);
    await play(page, seg, [2], idle, { shotOn: /출입 시험|1, 1, 2|의도/ }); mark("quiz");
    await walkTo(page, 8, 15); await walkTo(page, 18, 12); await walkTo(page, castleUp.x, castleUp.y + 2);
    await faceAndAct(page, "up");
    await play(page, seg, [], async (s) => s.battle, { shotOn: /명찰|벌점/ }); mark("dean");
    shot(page, "dean-battle", 2500);
    await battle(page, seg, PLAN4); mark("dean-end");
    await play(page, seg, [], idle); mark("after");
    shot(page, "castle-after", 300);
  },
  async ending(page, seg, mark, pick) {
    await walkTo(page, castleUp.x, castleUp.y);
    await waitMap(page, M.castle2); mark("top");
    await play(page, seg, [], idle, { shotOn: /연필/ });
    const maou = evAt(M.castle2, "ev_ig_k2_maou");
    await walkTo(page, maou.x, maou.y + 1); await faceAndAct(page, "up"); mark("maou");
    if (process.env.IG_DEBUG) {
      await play(page, seg, [pick], async (s) => s.battle || s.ending || (s.box ?? "").includes("쓰면 되지") || (s.box ?? "").includes("이번엔 도망"), { shotOn: /명찰|2009|수능|주문서/ });
      for (let i = 0; i < 16; i++) {
        const s = await st(page); const u = await ui(page);
        log("dbg", i, s && { map: s.map, x: s.x, y: s.y }, JSON.stringify(u).slice(0, 200));
        if (u.box !== null) await page.keyboard.press("Enter");
        await page.waitForTimeout(2500);
      }
      return;
    }
    await play(page, seg, [pick], async (s) => s.battle || s.ending, { shotOn: /명찰|2009|수능|주문서/ });
    if ((await ui(page)).battle) { mark("battle"); shot(page, `${seg.key}-maou-battle`, 2500); await battle(page, seg, PLAN4); mark("battle-end"); }
    await play(page, seg, [], async (s) => s.ending, { shotOn: /모의고사 날|열다섯|분식|날아갔다|깽판왕/ }); mark("ending");
    shot(page, `${seg.key}-ending`, 2500);
    await page.waitForTimeout(5000);
    for (let i = 0; i < 3; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(3500); shot(page, `${seg.key}-ending-next-${i}`, 200); }
  },
};

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  if (only.has("first")) await segment(browser, server, "first", null, B.first);
  if (only.has("goblin")) await segment(browser, server, "goblin", CP.goblin, fromCheckpoint(B.goblin));
  if (only.has("goblinfight")) await segment(browser, server, "goblinfight", CP.goblin, fromCheckpoint(B.goblinFight));
  if (only.has("castle")) await segment(browser, server, "castle", CP.castle, fromCheckpoint(B.castle));
  if (only.has("home")) await segment(browser, server, "home", CP.top, fromCheckpoint((p, s, m) => B.ending(p, s, m, 0)));
  if (only.has("stay")) await segment(browser, server, "stay", topWithTteok, fromCheckpoint((p, s, m) => B.ending(p, s, m, 1)));
  if (only.has("chaos")) await segment(browser, server, "chaos", topChaos, fromCheckpoint((p, s, m) => B.ending(p, s, m, 1)));
} finally {
  await browser.close();
  await server.close();
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
  log("done", Object.keys(facts.segments), "errors", facts.errors.length);
}
