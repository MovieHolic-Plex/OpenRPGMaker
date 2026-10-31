// 「사냥꾼 계약」 계약 A 통짜 실플레이 — 출하 플레이어(player.html), 타이틀 「새로 하기」부터 「제1장 끝」까지 한 세션, 1배 영상.
//   node scripts/qa/runtime/hunter-a.play.mjs [--choice 1|2|3]
// 체크포인트·순간이동 없이 실제 방향 입력으로 걷고, 대사는 사람 읽는 속도로 넘기고, 전투는 명령 단추를 누른다.
// 결과: verify-shots/runtime-qa/hunter-a-play/{facts.json, play.webm, play.mp4, shot-*.png}
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/hunter-a-play");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.HC_FIXTURE ?? "dist/demos/hunter-contract.project.json"), "utf8"));
const project = fixture.project ?? fixture;
const choiceArg = process.argv.indexOf("--choice");
const FINAL_CHOICE = choiceArg > 0 ? Number(process.argv[choiceArg + 1]) : 2;
const facts = { marks: {}, texts: [], battles: [], walks: [], errors: [], choice: FINAL_CHOICE };
const log = (...a) => console.error("[hunter-a]", ...a);
const t0 = Date.now();
const mark = (name) => { facts.marks[name] = +((Date.now() - t0) / 1000).toFixed(1); log("mark", name, facts.marks[name]); };

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
const page = await context.newPage();
page.on("pageerror", (e) => facts.errors.push(String(e)));
await page.addInitScript(([projectUrl, ns]) => {
  localStorage.clear();
  window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true };
}, ["/__runtime-qa/project.json", `hunter-a-${Date.now()}`]);
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));

const present = (testid) => page.evaluate((t) => !!document.querySelector(`[data-testid="${t}"]`), testid);
const live = () => page.evaluate(() => window.__oprnDebug?.readLive?.() ?? null);
const vars = () => page.evaluate(() => { const s = window.__oprnDebug.readState(); return { v: s.variables, sw: s.switches, gold: s.gold, inv: s.inventory, time: s.time ?? s.clock ?? null }; });
let shotN = 0;
const shot = async (tag) => { shotN += 1; await page.screenshot({ path: resolve(out, `shot-${String(shotN).padStart(2, "0")}-${tag}.png`) }).catch(() => {}); };
const ui = () => page.evaluate(() => ({
  box: document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? null,
  choices: !!document.querySelector('[data-testid="runtime-choices"]'),
  battle: !!document.querySelector('[data-testid="battle-scene"]'),
  ending: !!document.querySelector('[data-testid="ending-screen"]'),
  over: !!document.querySelector('[data-testid="game-over-screen"]'),
}));

/** 대사를 1배로 읽는다 — 글 길이만큼 머물고 Enter. 선택지·전투가 뜨거나 until() 이 참이면 멈춘다. 대사 없이 idleMs 지나면 끝. */
async function read(until = async () => false, { maxMs = 120_000, idleMs = 1600 } = {}) {
  const start = Date.now();
  let last = null, idleSince = Date.now();
  while (Date.now() - start < maxMs) {
    const s = await ui();
    if (await until(s)) return "until";
    if (s.choices) return "choices";
    if (s.battle) return "battle";
    if (s.ending) return "ending";
    if (s.over) return "game-over";
    if (s.box === null) {
      if (Date.now() - idleSince > idleMs) return "idle";
      await page.waitForTimeout(150); continue;
    }
    idleSince = Date.now();
    const clean = s.box.replace(/\s+/g, " ").trim();
    if (clean && clean !== last) {
      await page.waitForTimeout(700);
      const full = ((await ui()).box ?? clean).replace(/\s+/g, " ").trim();
      facts.texts.push(full); last = full;
      await page.waitForTimeout(Math.min(3200, 500 + full.length * 45));
    } else await page.waitForTimeout(250);
    await page.keyboard.press("Enter", { delay: 80 });
    await page.waitForTimeout(250);
    idleSince = Date.now();
  }
  return "timeout";
}
/** 선택지 줄 idx(0부터)를 고른다 — 줄을 읽을 시간을 준다. */
async function choose(idx, tag) {
  await page.waitForSelector('[data-testid="runtime-choices"]', { timeout: 20_000 });
  await page.waitForTimeout(1600);
  if (tag) await shot(tag);
  const lines = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="runtime-choice-"]')].filter((n) => /^runtime-choice-\d+$/.test(n.dataset.testid)).map((n) => n.innerText.replace(/\s+/g, " ").trim()));
  facts.texts.push(`[선택지] ${lines.join(" / ")} → ${lines[idx]}`);
  await page.click(`[data-testid="runtime-choice-${idx}"]`);
  await page.waitForTimeout(400);
}

// ── 걷기: 런타임 canMove 로 뽑은 칸별 방향표(hunter-moves.mts) + 이벤트로 최단 경로, 실제 방향 입력 한 칸씩. 막히면 그 칸을 배우고 다시 짠다.
const MOVES = JSON.parse(await readFile(process.env.HC_MOVES ?? "/tmp/hc/moves.json", "utf8"));
const blocked = new Set();
const isDoor = (e) => /"kind":"transfer"/.test(JSON.stringify(e.pages ?? []));
const BIT = { up: 1, down: 2, left: 4, right: 8 };
function canStep(mapId, x, y, dir) {
  const map = project.maps[mapId];
  return (parseInt(MOVES[mapId][y * map.width + x], 16) & BIT[dir]) !== 0;
}
function passable(mapId, x, y, target) {
  const map = project.maps[mapId];
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (target && target.x === x && target.y === y) return true;
  if (blocked.has(`${mapId}:${x},${y}`)) return false;
  if (parseInt(MOVES[mapId][y * map.width + x], 16) === 0) return false;
  return !map.events.some((e) => e.x === x && e.y === y && (isDoor(e) || (e.pages ?? []).some((p) => p.priority === "same" && p.graphic && !p.graphic.transparent)));
}
const DIRS = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
/** 걷다가 대사·전투가 뜨면 처리하고 이어 간다(onInterrupt). */
async function walkTo(mapId, target, { maxSteps = 260, onInterrupt } = {}) {
  for (let n = 0; n < maxSteps; n++) {
    const here = await live();
    if (!here) { await page.waitForTimeout(300); continue; }
    if (here.currentMapId !== mapId) return "map-changed";
    if (here.x === target.x && here.y === target.y) return "arrived";
    const s = await ui();
    if (s.battle || s.box !== null || s.choices) {
      if (onInterrupt) { const r = await onInterrupt(s); if (r === "stop") return "interrupted"; continue; }
      return s.battle ? "battle" : "dialogue";
    }
    const prev = new Map([[`${here.x},${here.y}`, null]]), queue = [[here.x, here.y]];
    let found = false;
    for (let h = 0; h < queue.length && !found; h++) {
      const [x, y] = queue[h];
      for (const [, dx, dy] of DIRS) {
        const k = `${x + dx},${y + dy}`;
        const dname = DIRS.find((d) => d[1] === dx && d[2] === dy)[0];
        if (prev.has(k) || (!(x + dx === target.x && y + dy === target.y) && !canStep(mapId, x, y, dname)) || !passable(mapId, x + dx, y + dy, target)) continue;
        prev.set(k, `${x},${y}`); queue.push([x + dx, y + dy]);
        if (x + dx === target.x && y + dy === target.y) { found = true; break; }
      }
    }
    if (!found) return "no-path";
    let k = `${target.x},${target.y}`;
    while (prev.get(k) !== `${here.x},${here.y}`) k = prev.get(k);
    const [nx, ny] = k.split(",").map(Number);
    const dir = DIRS.find(([, dx, dy]) => here.x + dx === nx && here.y + dy === ny)[0];
    await page.evaluate((d) => window.__oprnInput.dir(d), dir);
    await page.waitForTimeout(90);
    await page.evaluate(() => window.__oprnInput.dir(null));
    for (let t = 0, last = ""; t < 10; t++) {
      await page.waitForTimeout(110);
      const now = await live();
      const key = now ? `${now.currentMapId}:${now.x},${now.y}` : "";
      if (key === last) break;
      last = key;
    }
    const now = await live();
    if (now && now.x === here.x && now.y === here.y && now.currentMapId === mapId) {
      await page.waitForTimeout(250);
      const again = await live();
      const s2 = await ui();
      if (again && again.x === here.x && again.y === here.y && !s2.box && !s2.battle && !s2.choices) blocked.add(`${mapId}:${nx},${ny}`);
    }
  }
  return "gave-up";
}
const ev = (mapId, id) => project.maps[mapId].events.find((e) => e.id === id);
const doorTo = (fromMapId, toMapId) => project.maps[fromMapId].events.find((e) => isDoor(e) && JSON.stringify(e.pages).includes(`"mapId":"${toMapId}"`));
const waitMap = (mapId, ms = 10_000) => page.waitForFunction((m) => window.__oprnDebug?.readLive?.()?.currentMapId === m, mapId, { timeout: ms }).then(() => true).catch(() => false);
/** 이벤트 옆 칸(아래·좌·우·위 순)에 서서 그쪽을 본다. */
async function approach(mapId, id, opts) {
  const e = ev(mapId, id);
  const sides = [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]].map(([dx, dy, dir]) => ({ x: e.x + dx, y: e.y + dy, dir })).filter((p) => passable(mapId, p.x, p.y));
  for (const side of sides) {
    const r = await walkTo(mapId, side, opts);
    facts.walks.push(`${mapId} → ${id} 옆 (${side.x},${side.y}): ${r}`);
    if (r === "arrived") { await page.evaluate((d) => window.__oprnInput.face(d), side.dir); await page.waitForTimeout(250); return true; }
  }
  return false;
}
async function talk(mapId, id, opts) {
  if (!(await approach(mapId, id, opts))) throw new Error(`${id} 에 못 다가감`);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    const s = await ui();
    if (s.box !== null || s.choices || s.battle) return;
  }
  throw new Error(`${id} 가 말을 안 함`);
}
async function goThrough(fromMapId, toMapId, opts) {
  const door = doorTo(fromMapId, toMapId);
  if (!door) throw new Error(`${fromMapId}→${toMapId} 문 없음`);
  const below = { x: door.x, y: door.y + 1 };
  let r = "skip";
  if (passable(fromMapId, below.x, below.y)) {
    r = await walkTo(fromMapId, below, opts);
    if (r === "arrived") { await page.evaluate(() => window.__oprnInput.dir("up")); await page.waitForTimeout(450); await page.evaluate(() => window.__oprnInput.dir(null)); }
  }
  if ((await live()).currentMapId === fromMapId) r = await walkTo(fromMapId, { x: door.x, y: door.y }, opts);
  const ok = await waitMap(toMapId, 12_000);
  facts.walks.push(`${fromMapId} ⇒ ${toMapId}: ${r}${ok ? "" : " (못 들어감)"}`);
  await page.waitForTimeout(1000);
  return ok;
}

/** 전투 — 대상이 뜨면 첫 적, 아니면 공격. 체력이 30% 아래면 물약. 결과 창은 확인. */
async function fight(tag) {
  mark(`battle_${tag}`);
  await page.waitForTimeout(2500);
  await shot(`battle-${tag}`);
  const msgs = [];
  const tEnd = Date.now() + 300_000;
  let idle = 0;
  while (Date.now() < tEnd) {
    const s = await ui();
    if (!s.battle) break;
    const msg = await page.evaluate(() => document.querySelector('[data-testid="battle-message-window"]')?.innerText ?? "");
    if (msg && msg !== msgs.at(-1)) msgs.push(msg.replace(/\s+/g, " ").trim());
    const step = await page.evaluate(() => {
      const liveBtns = [...document.querySelectorAll("button")].filter((n) => !n.disabled && n.offsetParent !== null && n.dataset.previewOnly !== "true");
      const by = (t) => liveBtns.find((n) => n.dataset.testid === t);
      const ok = by("battle-result-confirm"); if (ok) { ok.click(); return "confirm"; }
      const w = (window.__hq ??= {});
      const targets = liveBtns.filter((n) => (n.dataset.testid || "").startsWith("battle-target-") && n.dataset.testid !== "battle-target-cancel");
      if (targets.length) { targets[0].click(); w.healing = false; return "target"; }
      const ratio = (t) => { const m = /(\d+)\s*\/\s*(\d+)/.exec(t || ""); return m ? Number(m[1]) / Math.max(1, Number(m[2])) : 1; };
      const hp = [...document.querySelectorAll(".battle-actor-hp")].map((n) => ratio(n.innerText)).filter((r) => r > 0);
      const potion = liveBtns.find((n) => /^actor-item-/.test(n.dataset.testid || "") && /물약/.test(n.innerText));
      if (w.wantPotion && potion) { w.wantPotion = false; potion.click(); return "potion"; }
      const bag = by("actor-command-item");
      if (bag && hp.length && Math.min(...hp) < 0.3 && !w.noPotion) { w.wantPotion = true; bag.click(); setTimeout(() => { if (w.wantPotion) { w.wantPotion = false; w.noPotion = true; } }, 1500); return "bag"; }
      const back = by("actor-command-back"); if (w.noPotion && back && !by("actor-command-attack")) { back.click(); return "back"; }
      const attack = by("actor-command-attack"); if (attack) { attack.click(); return "attack"; }
      return null;
    });
    if (step) idle = 0;
    else if (s.box !== null || ++idle > 10) { await page.keyboard.press("Enter", { delay: 80 }); idle = 0; }
    await page.waitForTimeout(step ? 600 : 350);
  }
  facts.battles.push({ tag, msgs: msgs.slice(-12) });
  mark(`battle_${tag}_end`);
  await page.waitForTimeout(800);
}
/** 걷는 중 끼어든 것 — 대사는 읽고, 전투는 싸운다. */
let battleN = 0;
const handle = async (s) => {
  if (s.battle) { battleN += 1; await fight(`field-${battleN}`); return; }
  const r = await read();
  if (r === "battle") { battleN += 1; await fight(`field-${battleN}`); }
};

let failed = null;
try {
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  // 타이틀
  await page.waitForSelector('[data-testid="title-new-game"]', { timeout: 600_000 });
  mark("title");
  await page.waitForTimeout(3500);
  await shot("title");
  await page.click('[data-testid="title-new-game"]');
  // 오프닝 애니메틱(약 25초) — 건너뛰지 않고 본다.
  mark("opening");
  await page.waitForTimeout(9000); await shot("opening-camp");
  await page.waitForFunction(() => !!window.__oprnDebug?.readLive?.(), null, { timeout: 120_000 });
  mark("world");
  // P0 산길 독백(자동 실행)
  await page.waitForTimeout(1200);
  await shot("world-start");
  await page.waitForSelector('[data-testid="dialogue-box"]', { timeout: 15_000 }).catch(() => {});
  await read(async () => false, { idleMs: 3000 });
  const W = project.maps.hc_world;
  const swampDoor = doorTo("hc_world", "hc_swamp");
  mark("walk_world");
  const r1 = await walkTo("hc_world", { x: swampDoor.x, y: swampDoor.y }, { onInterrupt: handle });
  facts.walks.push(`world → swamp gate: ${r1}`);
  if (!(await waitMap("hc_swamp", 15_000))) throw new Error("갈대늪에 못 들어감");
  void W;
  mark("swamp");
  await page.waitForTimeout(1500); await shot("swamp-arrive");
  await read(async () => false, { idleMs: 1000 });
  // 여관 → 게시판 → 하그네
  if (!(await goThrough("hc_swamp", "hc_swamp_inn", { onInterrupt: handle }))) throw new Error("여관에 못 들어감");
  mark("inn");
  await shot("inn");
  await talk("hc_swamp_inn", "ev_hc_a_board"); await shot("board"); await read();
  await talk("hc_swamp_inn", "ev_hc_a_marta"); await page.waitForTimeout(800); await shot("hagne"); await read();
  mark("terms");
  // 단서 — 뱃사공 · 장례 마당 · 끈 자국 셋 · 세나
  if (!(await goThrough("hc_swamp_inn", "hc_swamp", { onInterrupt: handle }))) throw new Error("여관을 못 나감");
  await talk("hc_swamp", "ev_hc_a_boatman", { onInterrupt: handle }); await shot("boatman"); await read();
  mark("clue_boat");
  await talk("hc_swamp", "ev_hc_a_body", { onInterrupt: handle }); await shot("body"); await read();
  mark("clue_body");
  for (const id of ["ev_hc_a_trail1", "ev_hc_a_trail2", "ev_hc_a_trail3"]) {
    const e = ev("hc_swamp", id);
    const r = await walkTo("hc_swamp", { x: e.x, y: e.y }, { onInterrupt: handle });
    facts.walks.push(`trail ${id}: ${r}`);
    if (r !== "arrived") await approach("hc_swamp", id, { onInterrupt: handle });
    await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700);
    if (id.endsWith("1")) await shot("trail");
    await read();
  }
  mark("clue_trail");
  await talk("hc_swamp", "ev_hc_a_widow", { onInterrupt: handle }); await shot("widow"); await read();
  mark("clue_widow");
  facts.afterClues = await vars();
  // 여관 — 기름 사고 밤까지 쉰다
  if (!(await goThrough("hc_swamp", "hc_swamp_inn", { onInterrupt: handle }))) throw new Error("여관에 못 들어감(2)");
  await talk("hc_swamp_inn", "ev_hc_a_keeper"); await read();
  await choose(0, "keeper-shop"); await read();
  mark("oil");
  await talk("hc_swamp_inn", "ev_hc_a_keeper"); await read();
  await choose(1, "keeper-potion"); await read();
  await talk("hc_swamp_inn", "ev_hc_a_bed"); await read();
  await choose(0, "bed"); await read(async () => false, { idleMs: 2500 });
  mark("night");
  await shot("night-inn");
  facts.atNight = await vars();
  // 밤 — 둥지 입구에서 칼에 기름
  if (!(await goThrough("hc_swamp_inn", "hc_swamp", { onInterrupt: handle }))) throw new Error("여관을 못 나감(2)");
  await page.waitForTimeout(800); await shot("swamp-night");
  const gate = doorTo("hc_swamp", "hc_nest");
  const rg = await walkTo("hc_swamp", { x: gate.x, y: gate.y }, { onInterrupt: async (s) => {
    if (s.choices) { await choose(0, "oil-choice"); return; }
    await handle(s);
  } });
  facts.walks.push(`swamp → nest gate: ${rg}`);
  if ((await live()).currentMapId !== "hc_nest") {
    // 잠금 문은 조사로 열릴 수도 있다
    await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(800);
    const r = await read();
    if (r === "choices") { await choose(0, "oil-choice"); await read(); }
  }
  if (!(await waitMap("hc_nest", 20_000))) throw new Error("둥지에 못 들어감");
  mark("nest");
  await page.waitForTimeout(1500); await shot("nest");
  await read(async () => false, { idleMs: 800 });
  // 어미에게 — 익사귀가 쫓아오면 싸운다
  const boss = ev("hc_nest", "ev_hc_a_mother");
  let rb = "";
  for (let k = 0; k < 6; k++) {
    rb = await walkTo("hc_nest", { x: boss.x, y: boss.y + 1 }, { onInterrupt: async (s) => { await handle(s); } });
    facts.walks.push(`nest → boss: ${rb}`);
    if (rb === "arrived" || rb === "no-path") break;
  }
  await page.evaluate(() => window.__oprnInput.dir("up")); await page.waitForTimeout(400); await page.evaluate(() => window.__oprnInput.dir(null));
  const rm = await read(async () => false, { maxMs: 60_000, idleMs: 3000 });
  if (rm !== "battle") throw new Error(`어미 전투가 안 열림 (${rm})`);
  mark("boss");
  await fight("mother");
  if ((await ui()).over) throw new Error("게임 오버");
  // 진실과 선택
  const rt = await read(async () => false, { maxMs: 90_000, idleMs: 4000 });
  if (rt !== "choices") throw new Error(`진실 선택지가 안 뜸 (${rt}) map=${(await live())?.currentMapId}`);
  mark("truth");
  await choose(FINAL_CHOICE - 1, "truth-choice");
  await read(async () => false, { idleMs: 2500 });
  facts.afterChoice = await vars();
  // 돌아가 하그네
  const here = await live();
  if (here.currentMapId === "hc_nest") {
    if (!(await goThrough("hc_nest", "hc_swamp", { onInterrupt: handle }))) throw new Error("둥지를 못 나감");
  }
  if ((await live()).currentMapId === "hc_swamp") {
    if (!(await goThrough("hc_swamp", "hc_swamp_inn", { onInterrupt: handle }))) throw new Error("여관에 못 들어감(3)");
  }
  await talk("hc_swamp_inn", "ev_hc_a_marta"); await page.waitForTimeout(800); await shot("hagne-end"); await read();
  mark("paid");
  facts.afterPaid = await vars();
  // 여관을 나서면 1장 끝
  if (!(await goThrough("hc_swamp_inn", "hc_swamp", { onInterrupt: handle }))) throw new Error("여관을 못 나감(3)");
  const re = await read(async (s) => s.ending, { maxMs: 90_000, idleMs: 6000 });
  if (re !== "until" && re !== "ending") throw new Error(`엔딩이 안 뜸 (${re})`);
  mark("ending");
  await page.waitForTimeout(3500); await shot("ending");
  await page.waitForTimeout(6000);
  await page.keyboard.press("Enter"); await page.waitForTimeout(4000); await shot("ending-credits");
  await page.waitForTimeout(5000);
  mark("end");
} catch (e) {
  failed = String(e?.stack ?? e);
  log("FAIL", failed);
  await shot("fail");
  facts.failState = { live: await live().catch(() => null), ui: await ui().catch(() => null) };
}
facts.failed = failed;
const video = await page.video().path();
await context.close();
await browser.close();
await server.close?.();
await copyFile(video, resolve(out, "play.webm"));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", resolve(out, "play.webm"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", resolve(out, "play.mp4")]);
await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
console.error(failed ? "FAILED" : "DONE", facts.marks);
process.exit(failed ? 1 : 0);
