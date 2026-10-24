// 폴른 스타 마을 시선 판정(집주인이 볼 때만 들킴) 실플레이 — 출하 플레이어, 광장 체크포인트에서 시작.
//   FS_FIXTURE=/tmp/fs-bake/demos/chrono-bell.project.json node scripts/qa/runtime/fallen-townlife-los.play.mjs
//   FS_FIXTURE=/tmp/fs-town-project.json node scripts/qa/runtime/fallen-townlife.play.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-townlife-los");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.FS_FIXTURE ?? "/tmp/fs-town-project.json"), "utf8"));
const project = fixture.project ?? fixture;
const facts = { boots: [], containers: [], caught: {}, persist: {}, bakery: {}, inn: {}, smithy: {}, errors: [] };
const log = (...a) => console.error("[townlife]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HERO_CHECKPOINT = {
  id: "fs-townlife-start",
  mapId: "fs_hub", x: 32, y: 22, facing: "up",
  switches: { sw_fs_main_started: true, sw_fs_main_step0: true },
  party: [{ actorId: "actor_hero", level: 6 }],
  gold: 100,
};

async function boot(browser, serverUrl, checkpoint, { video = false } = {}) {
  // checkpoint 가 snapshot 이면 저장 파일 재로드
  const context = await browser.newContext({
    viewport: { width: 480, height: 270 },
    ...(video ? { recordVideo: { dir: out, size: { width: 960, height: 540 } } } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => facts.errors.push(String(e)));
  const t0 = Date.now();
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
    localStorage.clear();
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, qaCheckpoint };
  }, ["/__runtime-qa/project.json", `fs-townlife-${Date.now()}`, checkpoint]);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${serverUrl}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => !!window.__oprnDebug && !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  const err = await page.$(".player-export-error");
  if (err) throw new Error("player export error: " + (await err.innerText()));
  await page.waitForTimeout(1500);
  facts.boots.push({ checkpoint: checkpoint.id, bootMs: Date.now() - t0 });
  log("booted", checkpoint.id, Date.now() - t0, "ms");
  // 광장 시작 자동 이벤트(왕도 포고문)가 열려 있으면 먼저 넘긴다 — 열려 있으면 입력이 모두 대사창에 먹힌다.
  await page.waitForTimeout(2500);
  const intro = [];
  await drain(page, intro, { pace: 300 });
  const settled = await settle(page);
  facts.boots[facts.boots.length - 1].introDrained = intro;
  facts.boots[facts.boots.length - 1].settleIters = settled;
  return { page, context, startedAt: t0 };
}

const state = (page) => page.evaluate(() => {
  const s = window.__oprnDebug.readState();
  return { map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, inv: s.inventory, sw: s.switches, vars: s.variables, self: s.selfSwitches };
});
const save = (page) => page.evaluate(() => window.__oprnDebug.captureSave());
const stateIds = async (page) => (await save(page)).session.actorStateIds ?? {};
const vitals = async (page) => (await save(page)).session.actorVitals ?? {};
const invOf = (s, id) => (s.inv?.[id] ?? 0);

// 대사창이 열려 있는 동안 Enter 로 넘기며 글을 모은다. 상점이 뜨면 멈춘다.
async function drain(page, texts, { pace = 350, max = 80 } = {}) {
  let last = null;
  for (let i = 0; i < max; i++) {
    const info = await page.evaluate(() => ({
      box: document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? null,
      choices: !!document.querySelector('[data-testid="runtime-choices"]'),
      shop: !!document.querySelector('[data-testid="shop-scene"]'),
    }));
    if (info.shop) return "shop";
    if (info.box === null || info.choices) {
      await page.waitForTimeout(500);
      const again = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]') || !!document.querySelector('[data-testid="shop-scene"]') || window.__oprnHooksScene?.running === true);
      if (!again) return "done";
      continue;
    }
    const clean = info.box.replace(/\s+/g, " ").trim();
    if (clean && clean !== last) { texts.push(clean); last = clean; }
    await page.waitForTimeout(pace);
    await page.keyboard.press("Enter", { delay: 200 });
    await page.waitForTimeout(250);
  }
  return "max";
}

// 이벤트(시작 포고문 등)가 끝날 때까지 Enter 로 넘긴다. scene.running 이 true 면 action 이 조용히 버려진다.
async function settle(page, max = 200) {
  for (let i = 0; i < max; i++) {
    const info = await page.evaluate(() => ({
      running: window.__oprnHooksScene?.running === true,
      box: !!document.querySelector('[data-testid="dialogue-box"]'),
      shop: !!document.querySelector('[data-testid="shop-scene"]'),
    }));
    if (!info.running || info.shop) return i;
    if (info.box) await page.keyboard.press("Enter", { delay: 200 });
    await page.waitForTimeout(400);
  }
  return -1;
}

// 방향키를 눌러 걷는다(playerRoute 는 닿음(playerTouch) 문을 못 건드린다). stopOn 이 참이 되거나 ms 가 지나면 뗀다.
async function walkKey(page, key, ms, stopOnMapChange = false) {
  const from = await page.evaluate(() => window.__oprnDebug.readState().currentMapId);
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await page.waitForTimeout(80);
    if (stopOnMapChange && (await page.evaluate(() => window.__oprnDebug.readState().currentMapId)) !== from) break;
    if (await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]'))) break;
  }
  await page.keyboard.up(key);
}

async function placeAt(page, mapId, x, y, dir) {
  await settle(page);
  await page.evaluate(([m, px, py, d]) => { window.__oprnInput.face(d); window.__oprnDebug.teleport(m, px, py); }, [mapId, x, y, dir]);
  await page.waitForTimeout(700);
  await page.evaluate((d) => window.__oprnInput.face(d), dir);
  await page.waitForTimeout(200);
  return await state(page);
}

// 상자 한 칸 뒤지기: 밑칸(없으면 다른 이웃)에 서서 바라보고 action. 결과(골드·소지품 변화, 대사)를 돌려준다.
async function search(page, mapId, bx, by, { pace = 350 } = {}) {
  const tries = [[bx, by + 1, "up"], [bx, by - 1, "down"], [bx - 1, by, "right"], [bx + 1, by, "left"]];
  for (const [x, y, dir] of tries) {
    const before = await placeAt(page, mapId, x, y, dir);
    if (before.map !== mapId || before.x !== x || before.y !== y) continue;
    const texts = [];
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(500);
    const d = await drain(page, texts, { pace });
    const after = await state(page);
    const inv = {};
    for (const id of new Set([...Object.keys(before.inv ?? {}), ...Object.keys(after.inv ?? {})])) {
      if (invOf(after, id) !== invOf(before, id)) inv[id] = invOf(after, id) - invOf(before, id);
    }
    return { mapId, box: [bx, by], from: [x, y], dGold: after.gold - before.gold, dInv: inv, texts, drain: d, after: [after.map, after.x, after.y] };
  }
  return { mapId, box: [bx, by], error: "no walkable neighbour" };
}

// ======================================================================

const eventPos = (page, id) => page.evaluate((i) => { const e = window.__oprnHooksScene?.eventPositions?.[i]; return e ? { x: e.x, y: e.y, d: e.direction } : null; }, id);
const marks = {};
const mark = (startedAt, name) => { marks[name] = +((Date.now() - startedAt) / 1000).toFixed(2); log("mark", name, marks[name]); };

// 리사가 조건을 만족하는 순간 상자를 뒤진다. 눌린 순간과 끝난 뒤 리사 위치, 대사·변화를 돌려준다.
async function searchWhen(page, startedAt, tag, { box, from, dir, until, timeoutMs = 90_000 }) {
  await placeAt(page, "fs_lisa_home", from[0], from[1], dir);
  mark(startedAt, `${tag}_ready`);
  const t0 = Date.now();
  let lisa = null;
  while (Date.now() - t0 < timeoutMs) {
    lisa = await eventPos(page, "ev_fs_lisa");
    if (lisa && until(lisa)) break;
    await page.waitForTimeout(40);
  }
  const before = await state(page);
  mark(startedAt, `${tag}_press`);
  await page.evaluate(() => window.__oprnInput.action());
  const lisaAtPress = await eventPos(page, "ev_fs_lisa");
  await page.waitForTimeout(500);
  const texts = [];
  const d = await drain(page, texts, { pace: 900 });
  mark(startedAt, `${tag}_done`);
  const after = await state(page);
  const inv = {};
  for (const id of new Set([...Object.keys(before.inv ?? {}), ...Object.keys(after.inv ?? {})])) {
    if (invOf(after, id) !== invOf(before, id)) inv[id] = invOf(after, id) - invOf(before, id);
  }
  const r = {
    box, from, lisaTrigger: lisa, lisaAtPress, dGold: after.gold - before.gold, dInv: inv, texts, drain: d,
    after: [after.map, after.x, after.y], warned: after.vars?.var_fs_lisa_warned ?? 0, banned: !!after.sw?.sw_fs_lisa_banned,
  };
  log(tag, JSON.stringify(r));
  return r;
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
let snapshot = null;
try {
  // ---------------- 부팅 A: 광장 → 리사 집 → (a) 다른 방 / (b) 들킴 / 2회째 추방 ----------------
  {
    const { page, context, startedAt } = await boot(browser, server.url, HERO_CHECKPOINT, { video: true });
    mark(startedAt, "plaza");
    await walkKey(page, "ArrowUp", 4000, true);
    await page.waitForFunction(() => window.__oprnDebug.readState().currentMapId === "fs_lisa_home", null, { timeout: 20_000 }).catch(async () => {
      await placeAt(page, "fs_hub", 32, 22, "up");
      await walkKey(page, "ArrowUp", 4000, true);
    });
    await page.waitForFunction(() => window.__oprnDebug.readState().currentMapId === "fs_lisa_home", null, { timeout: 20_000 });
    await page.waitForTimeout(800);
    mark(startedAt, "entered");
    const s = await state(page);
    facts.entered = [s.map, s.x, s.y];

    // (a) 리사가 거실 쪽(x 14~15, 오른쪽으로 걷는 중) — 안방 상자를 뒤진다. 다른 방이라 안 들킨다(달그락 소리만).
    facts.caught.a = await searchWhen(page, startedAt, "a", {
      box: [8, 11], from: [8, 12], dir: "up", until: (l) => l.x >= 14 && l.x <= 15 && l.d === "right",
    });
    // (b) 리사가 안방 쪽으로 돌아와 왼쪽을 보며 걸을 때 — 다른 상자. 들킨다(경고).
    facts.caught.b = await searchWhen(page, startedAt, "b", {
      box: [6, 11], from: [6, 12], dir: "up", until: (l) => l.x === 11 && l.d === "left" && l.y === 13,
    });
    // 두 번째 — 추방 + 출입 금지.
    facts.caught.b2 = await searchWhen(page, startedAt, "b2", {
      box: [4, 13], from: [5, 13], dir: "left", until: (l) => l.x === 10 && l.d === "left" && l.y === 13,
    });
    await page.waitForTimeout(900);
    const sx = await state(page);
    facts.caught.afterEvict = [sx.map, sx.x, sx.y];
    snapshot = await save(page);
    const video = page.video();
    await context.close();
    facts.videoA = await video.path();
    facts.marksA = { ...marks };
    await writeFile(resolve(out, "facts-a.json"), JSON.stringify(facts, null, 1));
  }

  // ---------------- 부팅 B: 저장 후 재로드 — 금지가 남는가 + 길목 상자 ----------------
  {
    for (const k of Object.keys(marks)) delete marks[k];
    const { page, context, startedAt } = await boot(browser, server.url, { id: "fs-townlife-reload", snapshot }, { video: true });
    mark(startedAt, "reloaded");
    const s0 = await state(page);
    facts.persist.afterReload = { banned: !!s0.sw?.sw_fs_lisa_banned, warnedVar: s0.vars?.var_fs_lisa_warned ?? 0, pos: [s0.map, s0.x, s0.y] };
    await placeAt(page, "fs_hub", 32, 22, "up");
    mark(startedAt, "door_try");
    const refusal = [];
    await walkKey(page, "ArrowUp", 1200);
    await page.waitForTimeout(900);
    await drain(page, refusal, { pace: 1100 });
    const s1 = await state(page);
    facts.persist.door = { texts: refusal, pos: [s1.map, s1.x, s1.y], stillHub: s1.map === "fs_hub" };
    mark(startedAt, "door_done");
    // 이미 뒤진 상자는 재로드 뒤에도 그대로 — 다른 집 상자(오스본)는 새로.
    facts.persist.street = [];
    for (const [bx, by] of [[35, 29], [43, 33], [24, 43]]) facts.persist.street.push(await search(page, "fs_hub", bx, by, { pace: 400 }));
    log("persist", JSON.stringify(facts.persist));
    const video = page.video();
    await context.close();
    facts.videoB = await video.path();
    facts.marksB = { ...marks };
  }
} finally {
  facts.errors = facts.errors.slice(0, 5);
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
  await browser.close();
  await server.close?.();
}
console.error("DONE");
