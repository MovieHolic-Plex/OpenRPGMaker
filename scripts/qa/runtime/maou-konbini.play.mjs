// 『전생한 마왕, 편의점 알바 시작하다』 통짜 실플레이 녹화 — 출하 플레이어(player.html, shim 경로), 구간마다 체크포인트에서 시작, 1배 영상.
//   MK_FIXTURE=dist/demos/maou-konbini.play.json node scripts/qa/runtime/maou-konbini.play.mjs [full,power,lost | opening,interview,day1,evening1,day2,meeting,night]
// 결과: verify-shots/runtime-qa/maou-konbini/{facts.json, <구간>.webm, native-*.png}
// 대사는 사람 속도로 넘기고(한 줄 ~1.4초), 선택지는 구간마다 정한 번호를 고른다. 걷기는 길 찾기(playerRoute)로 실제로 걷는다.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { installOpeningEvidence } from "../../lib/runtimeOpeningEvidence.mjs";
import { execFileSync } from "node:child_process";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/maou-konbini");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.MK_FIXTURE ?? "dist/demos/maou-konbini.play.json"), "utf8"));
const project = fixture.project ?? fixture;
const only = new Set((process.argv[2] ?? "full,power,lost").split(","));
const PACE = Number(process.env.MK_PACE ?? 1400);
const facts = { segments: {}, errors: [] };
const log = (...a) => console.error("[maou]", ...a);

const ev = (mapId, id) => {
  const e = project.maps[mapId]?.events.find((x) => x.id === id);
  if (!e) throw new Error(`${mapId}/${id} 없음`);
  return { x: e.x, y: e.y };
};
const doorEvents = (mapId, toMap) => project.maps[mapId].events.filter((e) => JSON.stringify(e.pages ?? e.commands).includes(`"mapId":"${toMap}"`));
const konDoorOnStreet = doorEvents("map_mk_street", "map_mk_konbini")[0];
const roomDoorOnStreet = doorEvents("map_mk_street", "map_mk_room")[0];
const roomExit = doorEvents("map_mk_room", "map_mk_street")[0];
log("doors", konDoorOnStreet && [konDoorOnStreet.x, konDoorOnStreet.y], roomDoorOnStreet && [roomDoorOnStreet.x, roomDoorOnStreet.y], roomExit && [roomExit.x, roomExit.y]);

const HERO = [{ actorId: "actor_hero", level: 12 }];
const CP = {
  interview: { id: "mk-interview", mapId: "map_mk_street", x: roomDoorOnStreet.x + 1, y: roomDoorOnStreet.y, facing: "left", variables: { var_mk_stage: 2 }, party: HERO },
  day1: { id: "mk-day1", mapId: "map_mk_konbini", x: 12, y: 11, facing: "down", variables: { var_mk_stage: 3, var_mk_tasks: 0, var_mk_service: 2 }, switches: { sw_mk_on_shift: true, sw_mk_brief1: true }, party: HERO },
  evening1: { id: "mk-evening1", mapId: "map_mk_street", x: konDoorOnStreet.x + 1, y: konDoorOnStreet.y, facing: "right", variables: { var_mk_stage: 4, var_mk_service: 5 }, party: HERO },
  day2: { id: "mk-day2", mapId: "map_mk_konbini", x: 8, y: 14, facing: "up", variables: { var_mk_stage: 5, var_mk_tasks: 0, var_mk_service: 5 }, switches: { sw_mk_lily_met: true }, party: HERO },
  meeting: { id: "mk-meeting", mapId: "map_mk_street", x: konDoorOnStreet.x + 1, y: konDoorOnStreet.y, facing: "right", variables: { var_mk_stage: 6, var_mk_service: 8 }, switches: { sw_mk_lily_met: true, sw_mk_tanaka_order: true }, party: HERO },
  night: { id: "mk-night", mapId: "map_mk_konbini", x: 8, y: 14, facing: "up", variables: { var_mk_stage: 7, var_mk_tasks: 0, var_mk_service: 8 }, switches: { sw_mk_lily_met: true, sw_mk_tanaka_order: true, sw_mk_meeting_done: true }, party: HERO },
  power: { id: "mk-power", mapId: "map_mk_konbini", x: 12, y: 11, facing: "down", variables: { var_mk_stage: 7, var_mk_tasks: 3, var_mk_service: 8 }, switches: { sw_mk_lily_met: true, sw_mk_tanaka_order: true, sw_mk_meeting_done: true, sw_mk_brief3: true, sw_mk_t_reg3: true, sw_mk_t_box3: true, sw_mk_t_waste3: true, "sw_ev_mk_c3a_out": true, "sw_ev_mk_c3b_out": true }, party: HERO },
};

const ui = (page) => page.evaluate(() => ({
  box: document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? null,
  choices: [...document.querySelectorAll('[data-testid^="runtime-choice-"]')].map((n) => n.innerText.trim()).filter(Boolean),
  battle: !!document.querySelector('[data-testid="battle-scene"]'),
  result: !!document.querySelector('[data-testid="battle-result-panel"]'),
  ending: !!document.querySelector('[data-testid="ending-screen"]'),
  title: !!document.querySelector('[data-testid="title-screen"]'),
  cine: !!document.querySelector('[data-testid="cinematic-sequence"]'),
}));
const st = (page) => page.evaluate(() => { const s = window.__oprnDebug?.readState(); return s ? { map: s.currentMapId, x: s.x, y: s.y, v: s.variables, party: s.partyActorIds } : null; });
const shots = [];
const shot = (page, tag, delay = 0) => shots.push(page.waitForTimeout(delay).then(() => page.screenshot({ path: resolve(out, `native-${tag}.png`) })).catch(() => {}));

/** 대사를 사람 속도로 넘긴다. 선택지가 뜨거나 until 이 참이면 멈춘다. */
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
    // 질문 없는 선택지 앞 글은 다 나오면 스스로 닫히고 선택지가 바로 뜬다(main 의 beforeChoices) — 그때 Enter 를 누르면
    // 첫 선택지를 골라 버린다(2026-10-29 lost 구간이 매뉴얼 대신 마왕의 힘으로 갔다). 누르기 직전에 다시 본다.
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
/** 대사·선택지를 끝까지(선택지는 picks 순서대로). */
async function play(page, seg, picks, until, opts) {
  const queue = [...picks];
  for (;;) {
    const r = await read(page, seg, until, opts);
    if (r !== "choices") return r;
    await choose(page, seg, queue.length ? queue.shift() : 0);
  }
}
/** 대사·선택지·전투가 2.5초 넘게 조용해야 「끝났다」 — 대사 사이 잠깐 빈 상자를 끝으로 오인하지 않는다. */
let quietSince = null;
const idle = async (s) => {
  if (s.box !== null || s.choices.length || s.battle) { quietSince = null; return false; }
  quietSince ??= Date.now();
  if (Date.now() - quietSince < 2500) return false;
  quietSince = null; return true;
};
const quietAnd = (cond) => async (s) => (await idle(s)) && (await cond(s));
async function walkTo(page, x, y, timeout = 40_000) {
  const from = await st(page);
  const go = () => page.evaluate(([x, y]) => window.__oprnDebug.playerRoute([{ kind: "approach", x, y, distance: 0 }]), [x, y]);
  await go();
  const t0 = Date.now();
  let ok = false, last = from, stillSince = Date.now(), retries = 0;
  while (Date.now() - t0 < timeout) {
    const s = await st(page); if (s && s.x === x && s.y === y) { ok = true; break; }
    const u = await ui(page); if (u.box !== null || u.choices.length) { ok = true; break; }
    // 장소를 옮기면 길 찾기를 끊는다 — 경로는 이동 뒤에도 살아남아 새 맵에서 엉뚱한 문으로 걸어 들어갔다.
    if (from && s && s.map !== from.map) { ok = true; await page.evaluate(() => window.__oprnDebug.playerRoute([])); break; }
    // 걷는 사람(행인·리리)이 길을 잠깐 막으면 경로가 멈춘다 — 멈춰 있으면 다시 시킨다.
    if (s && last && (s.x !== last.x || s.y !== last.y)) { stillSince = Date.now(); last = s; }
    else if (Date.now() - stillSince > 1800) { retries++; stillSince = Date.now(); await go(); }
    await page.waitForTimeout(200);
  }
  const to = await st(page);
  log("walk", `${from?.map}:${from?.x},${from?.y} → want ${x},${y} → ${to?.map}:${to?.x},${to?.y}`, ok ? "" : "TIMEOUT", retries ? `retries ${retries}` : "");
  return ok;
}
/** 거리 걷기 — 길 찾기가 행인을 피해 원룸 문 칸을 밟으면 원룸으로 들어가 버린다. 그러면 나와서 다시 걷는다. */
async function streetWalk(page, x, y) {
  for (let i = 0; i < 3; i++) {
    await walkTo(page, x, y);
    if ((await st(page))?.map !== "map_mk_room") return;
    await page.waitForTimeout(1500);
    await walkTo(page, roomExit.x, roomExit.y);
    const t0 = Date.now();
    while (Date.now() - t0 < 15_000 && (await st(page))?.map !== "map_mk_street") await page.waitForTimeout(300);
    await page.waitForTimeout(1200);
  }
}
async function faceAndAct(page, dir) {
  // 방향키로 돌면 앞 칸이 비었을 때 한 걸음 걸어 버린다(문 칸이면 들어간다) — 제자리 돌기만 시킨다.
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

/** 전투 — 계획한 기술을 차례마다 고른다. 결과 창이 뜨면 확인. */
async function battle(page, seg, plan) {
  const t0 = Date.now();
  let turns = 0;
  while (Date.now() - t0 < 600_000) {
    const s = await ui(page);
    if (!s.battle) return turns;
    const done = await page.evaluate((plan) => {
      const live = [...document.querySelectorAll("button")].filter((n) => !n.disabled && n.offsetParent !== null && n.dataset.previewOnly !== "true");
      const by = (t) => live.find((n) => n.dataset.testid === t);
      const ok = by("battle-result-confirm"); if (ok) { ok.click(); return "confirm"; }
      const targets = live.filter((n) => (n.dataset.testid || "").startsWith("battle-target-") && n.dataset.testid !== "battle-target-cancel");
      if (targets.length) { targets[0].click(); return "target"; }
      const w = (window.__mkb ??= { i: 0 });
      const want = plan[w.i % plan.length];
      if (want !== "attack") {
        const skill = by(`actor-skill-${want}`);
        if (skill) { w.i++; skill.click(); return `skill:${want}`; }
        const menu = by("actor-command-skill");
        if (menu) { menu.click(); return "menu"; }
        const back = by("actor-command-back"); if (back) { w.i++; back.click(); return "back"; }
      }
      const attack = by("actor-command-attack"); if (attack) { w.i++; attack.click(); return "attack"; }
      return null;
    }, plan);
    if (done) { seg.texts.push(`[전투] ${done}`); if (done.startsWith("skill") || done === "attack") turns++; await page.waitForTimeout(900); }
    else { await page.waitForTimeout(500); }
    if (turns === 2 && !seg.battleShot) { seg.battleShot = true; shot(page, `${seg.key}-battle`, 1200); }
  }
  return turns;
}

async function segment(browser, server, key, checkpoint, run) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
  const page = await context.newPage();
  const videoStart = Date.now();
  // MK_AUDIO=1 — 소리도 녹음해 영상에 입힌다(HTMLMediaElement 로 나는 BGM·효과음. Web Audio 직결 전투 샘플은 빠진다).
  if (process.env.MK_AUDIO) await installOpeningEvidence(page, true);
  page.on("pageerror", (e) => facts.errors.push(`${key}: ${String(e).slice(0, 400)}`));
  page.on("console", (m) => { if (m.type() === "error") facts.errors.push(`${key} console: ${m.text().slice(0, 300)}`); });
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
    localStorage.clear();
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, ...(qaCheckpoint ? { qaCheckpoint } : {}) };
  }, ["/__runtime-qa/project.json", `mk-${key}-${Date.now()}`, checkpoint ?? null]);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  const t0 = Date.now();
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 300_000 });
  const seg = { key, texts: [], marks: {} };
  const mark = (name) => { seg.marks[name] = +((Date.now() - t0) / 1000).toFixed(1); log(key, name, seg.marks[name]); };
  try { await run(page, seg, mark); } catch (e) { seg.error = String(e); log(key, "ERR", e); }
  seg.final = await st(page).catch(() => null);
  await Promise.all(shots.splice(0));
  const sound = process.env.MK_AUDIO ? await page.evaluate(() => window.__oprnStopOpeningRecording?.()).catch((e) => { log(key, "audio ERR", e); return null; }) : null;
  const video = await page.video().path();
  await context.close();
  await copyFile(video, resolve(out, `${key}.webm`));
  if (sound?.dataUrl && sound.record?.startedAt) {
    const audioPath = resolve(out, `${key}-audio.webm`);
    await writeFile(audioPath, Buffer.from(sound.dataUrl.split(",")[1], "base64"));
    const offset = Math.max(0, (sound.record.startedAt - videoStart) / 1000).toFixed(2);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", resolve(out, `${key}.webm`), "-itsoffset", offset, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", resolve(out, `${key}-av.webm`)]);
    seg.audio = { offset: Number(offset), media: sound.record.media.length, played: sound.record.media.filter((m) => m.played).length };
    log(key, "audio muxed", offset, seg.audio);
  }
  facts.segments[key] = seg;
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
}
const ready = (page) => page.waitForFunction(() => !!window.__oprnDebug && !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 900_000 });
const startButton = async (page) => {
  // 웹 판본 부팅 로더의 「시작하기」.
  for (let i = 0; i < 600; i++) {
    const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((n) => /시작하기|Start/.test(n.innerText) && n.offsetParent !== null); if (b) { b.click(); return true; } return false; });
    if (clicked) return true;
    const u = await ui(page); if (u.title || u.box !== null) return true;
    await page.waitForTimeout(500);
  }
  return false;
};

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
// 구간 몸통 — 체크포인트 구간은 ready 뒤에 이것을 부르고, 「full」은 타이틀부터 끊지 않고 이어 부른다(같은 맵 이동 뒤 암전 같은 결함은 이어 할 때만 보인다).
const B = {
  async opening(page, seg, mark) {
    await startButton(page);
    await page.waitForFunction(() => !!document.querySelector('[data-testid="title-screen"]'), null, { timeout: 600_000 });
    mark("title"); await page.waitForTimeout(3500); shot(page, "title");
    await page.waitForTimeout(3000);
    await page.keyboard.press("Enter"); mark("newgame");
    for (const [i, ms] of [[1, 4500], [2, 7200], [3, 7000], [4, 6000], [5, 5400]].entries()) { await page.waitForTimeout(ms[1]); shot(page, `opening-${i + 1}`); }
    await ready(page); mark("runtime");
    await play(page, seg, [], async (s) => s.battle, { shotOn: /엉덩이|8분의 1|흔들리지/ }); mark("battle");
    shot(page, "battle-start", 2500);
    await battle(page, seg, ["skill_mk_dark_wave", "skill_mk_half_world", "skill_mk_hellfire", "skill_mk_dark_wave", "skill_mk_hellfire"]); mark("battle-end");
    await play(page, seg, [], quietAnd(async () => (await st(page))?.map === "map_mk_room"), { shotOn: /동귀어진|낯선 천장|0엔/ }); mark("woke");
    await walkTo(page, roomExit.x, roomExit.y - 1);
    await play(page, seg, [], idle, { shotOn: /폐기 도시락/ }); mark("flyer");
    shot(page, "room-after-flyer", 400);
    await walkTo(page, roomExit.x, roomExit.y); await play(page, seg, [], idle);
    if ((await st(page))?.map !== "map_mk_street") await walkTo(page, roomExit.x, roomExit.y);
    await play(page, seg, [], quietAnd(async () => (await st(page))?.map === "map_mk_street")); mark("street");
    shot(page, "street-first");
    await play(page, seg, [], idle);
  },
  async interview(page, seg, mark) {
    await play(page, seg, [], idle);
    await streetWalk(page, roomDoorOnStreet.x + 1, roomDoorOnStreet.y + 1); await streetWalk(page, roomDoorOnStreet.x - 3, roomDoorOnStreet.y + 1);
    await streetWalk(page, konDoorOnStreet.x + 1, konDoorOnStreet.y); await walkTo(page, konDoorOnStreet.x, konDoorOnStreet.y); await page.waitForTimeout(2000); mark("enter");
    await play(page, seg, [2, 1], quietAnd(async () => (await st(page))?.v?.var_mk_stage === 3), { shotOn: /이력서|마계|명찰|선배라고|매뉴얼 제1조/ }); mark("hired");
    shot(page, "shift-start", 600);
  },
  async day1(page, seg, mark) {
    await play(page, seg, [], idle, { shotOn: /첫째 날 · 오전/ }); mark("brief");
    await faceAndAct(page, "down"); mark("register");
    await play(page, seg, [0, 0, 1], idle, { shotOn: /업화|에코백|버스|영혼의 나이|열일곱/ }); mark("register-done");
    await walkTo(page, 8, 8); await faceAndAct(page, "up");
    await play(page, seg, [1], idle, { shotOn: /무너졌어|중력/ }); mark("box-done");
    shot(page, "box-cleared", 300);
    await walkTo(page, 6, 12); await faceAndAct(page, "down");
    await play(page, seg, [0], quietAnd(async () => { const x = await st(page); return x?.v?.var_mk_stage === 4 && x.map === "map_mk_street"; }), { shotOn: /분리수거|시련|근무 평가/ }); mark("day-end");
  },
  async evening1(page, seg, mark) {
    await play(page, seg, [], quietAnd(() => page.evaluate(() => !!window.__oprnDebug.readState().switches.sw_mk_lily_met)), { shotOn: /리리스|블랙 기업|재결성/ }); mark("lily");
    const cat = ev("map_mk_street", "ev_mk_st_cat");
    await walkTo(page, cat.x + 1, cat.y); await faceAndAct(page, "left"); await play(page, seg, [], idle); mark("cat");
    await streetWalk(page, 12, 10); await streetWalk(page, 14, 10); await streetWalk(page, 22, 10); await walkTo(page, 31, 9); await walkTo(page, 31, 0); await page.waitForTimeout(1500); mark("shrine");
    shot(page, "shrine", 800);
    const leon = ev("map_mk_shrine", "ev_mk_sh_leon");
    await walkTo(page, leon.x + 1, leon.y); await faceAndAct(page, "left"); await play(page, seg, [], idle, { shotOn: /세계의 절반을 주마|고기만두/ }); mark("leon");
    await walkTo(page, 29, 8); await faceAndAct(page, "up"); await play(page, seg, [2], idle); mark("pray");
    await walkTo(page, 23, 14); await faceAndAct(page, "down"); await play(page, seg, [], idle, { shotOn: /대흉/ }); mark("kuji");
    await walkTo(page, 19, 27); await page.waitForTimeout(1500); mark("back-street");
    await walkTo(page, 31, 9); await walkTo(page, 22, 10); await walkTo(page, roomDoorOnStreet.x + 1, roomDoorOnStreet.y + 1); await walkTo(page, roomDoorOnStreet.x, roomDoorOnStreet.y); await page.waitForTimeout(1500); mark("room");
    await walkTo(page, 2, 5); await faceAndAct(page, "up");
    await play(page, seg, [], async (s) => { const x = await st(page); return x?.v?.var_mk_stage === 5 && x.map === "map_mk_konbini"; }); mark("slept");
    await page.waitForTimeout(1500);
  },
  async day2(page, seg, mark) {
    await play(page, seg, [], idle); mark("brief");
    await faceAndAct(page, "down");
    await play(page, seg, [1, 0, 2, 1, 2], idle, { shotOn: /늘 먹던|피로|순서대로|본 적 있지|주먹이/ }); mark("register");
    await walkTo(page, 10, 8); await faceAndAct(page, "up"); await play(page, seg, [2], idle, { shotOn: /메이드/ }); mark("snack");
    await walkTo(page, 17, 8); await faceAndAct(page, "down");
    await play(page, seg, [1], quietAnd(async () => { const x = await st(page); return x?.v?.var_mk_stage === 6 && x.map === "map_mk_street"; }), { shotOn: /999|근무 평가/ }); mark("order-end");
  },
  async meeting(page, seg, mark) {
    await streetWalk(page, 12, 10); await streetWalk(page, 14, 10); await streetWalk(page, 22, 10); await walkTo(page, 31, 10); await walkTo(page, 31, 27); await page.waitForTimeout(1500); mark("park");
    await play(page, seg, [1], quietAnd(() => page.evaluate(() => !!window.__oprnDebug.readState().switches.sw_mk_meeting_done)), { shotOn: /가르곤|회비|보름달/ }); mark("meeting-done");
    shot(page, "park-after", 500);
    await walkTo(page, 20, 8); await page.waitForTimeout(1500);
    await walkTo(page, 31, 10); await walkTo(page, 22, 10); await walkTo(page, roomDoorOnStreet.x + 1, roomDoorOnStreet.y + 1); await walkTo(page, roomDoorOnStreet.x, roomDoorOnStreet.y); await page.waitForTimeout(1500); mark("room");
    await walkTo(page, 2, 5); await faceAndAct(page, "up");
    await play(page, seg, [], async () => { const x = await st(page); return x?.v?.var_mk_stage === 7 && x.map === "map_mk_konbini"; }); mark("slept");
    await page.waitForTimeout(1500);
  },
  async night(page, seg, mark, { lose = false } = {}) {
    await play(page, seg, [], idle); mark("brief");
    await faceAndAct(page, "down"); await play(page, seg, [1, 0], idle, { shotOn: /공물|간장|처음이에요/ }); mark("register");
    await walkTo(page, 8, 8); await faceAndAct(page, "up"); await play(page, seg, [0], idle); mark("box");
    await walkTo(page, 19, 7); await faceAndAct(page, "up");
    await B.manual(page, seg, mark, { lose, waste: true });
  },
  async manual(page, seg, mark, { lose = false, waste = false } = {}) {
    await play(page, seg, waste ? [1] : [], async (s) => s.choices.length >= 2 && s.choices.some((c) => /매뉴얼/.test(c)), { shotOn: /CCTV|찾았다|보름달|줄무늬/ }); mark("crisis");
    await play(page, seg, [1], async (s) => s.battle); mark("battle");
    shot(page, "manual-battle", 2500);
    await battle(page, seg, lose ? ["attack"] : ["skill_mk_irasshai", "skill_mk_nikuman", "skill_mk_point_card", "skill_mk_nikuman", "skill_mk_irasshai", "skill_mk_nikuman", "skill_mk_smile", "skill_mk_irasshai"]); mark("battle-end");
    await play(page, seg, [], async (s) => s.ending, { shotOn: /따뜻하다|일하면 된다|근무 평가|액자|평생|맞으라는/ }); mark("ending");
    shot(page, "ending", 2500);
    await page.waitForTimeout(4000);
    await play(page, seg, [], async () => false, { maxMs: 60_000 });
    shot(page, "ending-after", 300);
    // 카드 다음 장(크레딧)까지 넘겨 본다.
    for (let i = 0; i < 3; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(3500); shot(page, `${seg.key}-ending-next-${i}`, 200); }
  },
  async power(page, seg, mark) {
    await play(page, seg, [0], async (s) => s.battle, { shotOn: /뿔|용사의 힘/ }); mark("battle");
    shot(page, "power-battle", 2500);
    await battle(page, seg, ["skill_mk_dark_wave", "skill_mk_hellfire", "skill_mk_dark_wave", "skill_mk_hellfire"]); mark("battle-end");
    await play(page, seg, [], async (s) => s.ending, { shotOn: /전자레인지|CCTV|380만|빚의 절반/ }); mark("ending");
    shot(page, "power-ending", 2500);
    await page.waitForTimeout(4000);
    await play(page, seg, [], async () => false, { maxMs: 60_000 });
    for (let i = 0; i < 3; i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(3500); shot(page, `${seg.key}-ending-next-${i}`, 200); }
  },
};
const fromCheckpoint = (fn, opts) => async (page, seg, mark) => { await ready(page); await page.waitForTimeout(1500); mark("ready"); await fn(page, seg, mark, opts); };

try {
  // full = 타이틀부터 매뉴얼 결말까지 한 판(체크포인트 없이).
  if (only.has("full")) await segment(browser, server, "full", null, async (page, seg, mark) => {
    for (const key of ["opening", "interview", "day1", "evening1", "day2", "meeting", "night"]) { mark(`>${key}`); await B[key](page, seg, mark); }
  });
  for (const key of ["opening", "interview", "day1", "evening1", "day2", "meeting", "night", "power"]) {
    if (!only.has(key)) continue;
    await segment(browser, server, key, key === "opening" ? null : CP[key], key === "opening" ? B.opening : fromCheckpoint(B[key]));
  }
  // lost = 사흘째 결전에서 매뉴얼을 고르고 봉투(공격)만 휘두르다 진다 → 패배 분기 · 「내일도 출근」.
  if (only.has("lost")) await segment(browser, server, "lost", CP.power, fromCheckpoint(B.manual, { lose: true }));
} finally {
  await browser.close();
  await server.close();
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
  log("done", Object.keys(facts.segments), "errors", facts.errors.length);
}
