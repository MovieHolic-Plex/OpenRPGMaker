// 『폴른 스타』 마을 생활(상자 뒤지기·리사 현장 적발·토마 빵집·대장간) 실플레이 프로브 — 출하 플레이어로 밟는다.
// 타이틀을 거치지 않고 qaCheckpoint 로 광장에서 바로 시작한다(부팅 A). 적발 시퀀스는 영상으로 남기고,
// 저장 스냅샷을 체크포인트로 다시 부팅(부팅 B)해 추방·출입 금지가 저장 뒤에도 남는지, 빵 기믹·여관·대장간을 본다.
//
//   FS_FIXTURE=/tmp/fs-town-project.json node scripts/qa/runtime/fallen-townlife.play.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-townlife");
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
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
  gold: 100,
};

async function boot(browser, serverUrl, checkpoint, { video = false } = {}) {
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
  if (intro.length) facts.boots[facts.boots.length - 1].introDrained = intro;
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
      const again = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]') || !!document.querySelector('[data-testid="shop-scene"]'));
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

async function placeAt(page, mapId, x, y, dir) {
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

// ---------- 상점 ----------
async function openShopFrom(page, mapId, x, y, dir, counter) {
  await placeAt(page, mapId, x, y, dir);
  await page.evaluate(() => window.__oprnInput.action());
  await page.waitForFunction(() => !!document.querySelector('[data-testid="shop-scene"]') || !!document.querySelector('[data-testid="dialogue-box"]'), null, { timeout: 20_000 });
  const texts = [];
  const r = await drain(page, texts);
  return { r, texts };
}
async function shopKey(page, key) { await page.keyboard.press(key, { delay: 150 }); await page.waitForTimeout(450); }
async function shopBuyList(page) {
  await page.waitForSelector('[data-testid="shop-scene"]', { timeout: 20_000 });
  await shopKey(page, "Enter"); // 입구 → 사기 목록
  await page.waitForFunction(() => !!document.querySelector('[data-testid^="shop-buy-"]'), null, { timeout: 10_000 });
}
const buyRows = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid^="shop-buy-"]')].map((n) => ({ id: n.dataset.testid.replace("shop-buy-", ""), sel: n.getAttribute("aria-current") === "true", text: n.innerText.replace(/\s+/g, " ").trim(), invalid: n.className.includes("juice-menu-invalid") })));
async function moveBuyTo(page, id) {
  for (let i = 0; i < 40; i++) {
    const rows = await buyRows(page);
    const cur = rows.findIndex((r) => r.sel), want = rows.findIndex((r) => r.id === id);
    if (want < 0) throw new Error("no shop row " + id);
    if (cur === want) return;
    await shopKey(page, cur < want ? "ArrowDown" : "ArrowUp");
  }
  throw new Error("cursor stuck " + id);
}
async function buyOne(page, id) {
  await moveBuyTo(page, id);
  const row = (await buyRows(page)).find((r) => r.id === id);
  const g0 = (await state(page)).gold, n0 = invOf(await state(page), id);
  await shopKey(page, "Enter");
  await page.waitForTimeout(500);
  const s = await state(page);
  return { id, rowText: row.text, dGold: s.gold - g0, dCount: invOf(s, id) - n0 };
}
async function closeShop(page) {
  for (let i = 0; i < 6; i++) {
    if (!(await page.$('[data-testid="shop-scene"]'))) break;
    await shopKey(page, "Escape");
  }
  await page.waitForTimeout(500);
}

// ---------- 메뉴로 아이템 쓰기 ----------
async function useItem(page, itemId, actorId = "actor_hero") {
  await page.keyboard.press("x", { delay: 150 });
  await page.waitForSelector('[data-testid="main-menu"]', { timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.keyboard.press("z", { delay: 150 });
  await page.waitForSelector(`[data-testid="status-menu-item-${itemId}"]`, { timeout: 10_000 });
  const isSel = (id) => page.evaluate((i) => { const n = document.querySelector(`[data-testid="status-menu-item-${i}"]`); return !!n && (n.getAttribute("aria-current") === "true" || !!n.closest(".selected") || n.classList.contains("selected")); }, id);
  let ok = false;
  for (let i = 0; i < 40; i++) {
    if (await isSel(itemId)) { ok = true; break; }
    await page.keyboard.press("ArrowDown", { delay: 150 });
    await page.waitForTimeout(300);
  }
  if (!ok) throw new Error("item row not selectable " + itemId);
  await page.keyboard.press("z", { delay: 150 });
  await page.waitForSelector(`[data-testid="status-menu-item-target-${actorId}"]`, { timeout: 10_000 });
  const targetRowBefore = await page.evaluate((a) => document.querySelector(`[data-testid="status-menu-item-target-${a}"]`)?.innerText.replace(/\s+/g, " ").trim(), actorId);
  // 대상 행이 선택돼 있는지 맞춘다.
  for (let i = 0; i < 6; i++) {
    const sel = await page.evaluate((a) => { const n = document.querySelector(`[data-testid="status-menu-item-target-${a}"]`); return !!n && (n.getAttribute("aria-current") === "true" || !!n.closest(".selected") || n.classList.contains("selected")); }, actorId);
    if (sel) break;
    await page.keyboard.press("ArrowDown", { delay: 150 });
    await page.waitForTimeout(300);
  }
  await page.keyboard.press("z", { delay: 150 });
  await page.waitForTimeout(700);
  const targetRowAfter = await page.evaluate((a) => document.querySelector(`[data-testid="status-menu-item-target-${a}"]`)?.innerText.replace(/\s+/g, " ").trim(), actorId);
  for (let i = 0; i < 6; i++) {
    if (!(await page.$('[data-testid="main-menu"]'))) break;
    await page.keyboard.press("x", { delay: 150 });
    await page.waitForTimeout(350);
  }
  return { targetRowBefore, targetRowAfter };
}

async function gimmick(page, id, { hp = 40, states } = {}) {
  await page.evaluate(([h]) => window.__oprnSetActorVitals("actor_hero", h, 20), [hp]);
  const v0 = (await vitals(page)).actor_hero?.hp, st0 = (await stateIds(page)).actor_hero ?? [];
  const n0 = invOf(await state(page), id);
  const ui = await useItem(page, id);
  const v1 = (await vitals(page)).actor_hero?.hp, st1 = (await stateIds(page)).actor_hero ?? [];
  const n1 = invOf(await state(page), id);
  return { id, hp: [v0, v1], states: [st0, st1], count: [n0, n1], ui };
}

// ======================================================================
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
let snapshot = null;
try {
  // ---------------- 부팅 A: 상자·적발(영상) ----------------
  {
    const { page, context, startedAt } = await boot(browser, server.url, HERO_CHECKPOINT, { video: true });
    const mark = (name) => { facts.caught[name] = (Date.now() - startedAt) / 1000; };

    // 1) 대장간 상자 전부 + 두 번째 뒤지기("이미 뒤졌다")
    const smithy = [[16, 9], [21, 9], [19, 5], [21, 5], [16, 3], [20, 3]];
    for (const [bx, by] of smithy) facts.containers.push(await search(page, "fs_smithy", bx, by, { pace: 150 }));
    facts.containers.push({ again: true, ...(await search(page, "fs_smithy", smithy[0][0], smithy[0][1], { pace: 150 })) });
    // 2) 빈 상자로 확정된 빵집 안쪽 상자
    facts.containers.push(await search(page, "fs_bakery_home", 20, 9, { pace: 150 }));
    log("containers", JSON.stringify(facts.containers.map((c) => [c.mapId, c.box, c.dGold, c.dInv, c.texts?.[0]])));

    // 3) 적발 시퀀스(영상) — 광장에서 리사 집 문으로 걸어 들어간다.
    await page.evaluate(() => window.__oprnDebug.setGold(100));
    await placeAt(page, "fs_hub", 32, 22, "up");
    await page.waitForTimeout(1500);
    mark("tStart");
    const hubBefore = await state(page);
    await page.evaluate(() => window.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }]));
    await page.waitForFunction(() => window.__oprnDebug.readState().currentMapId === "fs_lisa_home", null, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    facts.caught.enterLisa = await state(page).then((s) => [s.map, s.x, s.y]);
    // 첫 번째 상자 — 경고
    const warnTexts = [];
    await placeAt(page, "fs_lisa_home", 10, 15, "up");
    await page.waitForTimeout(1200);
    const g0 = (await state(page)).gold;
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(900);
    await drain(page, warnTexts, { pace: 1700 });
    const afterWarn = await state(page);
    facts.caught.warn = { texts: warnTexts, var: afterWarn.vars?.var_fs_lisa_warned ?? 0, banned: !!afterWarn.sw?.sw_fs_lisa_banned, dGold: afterWarn.gold - g0, pos: [afterWarn.map, afterWarn.x, afterWarn.y] };
    mark("tWarn");
    await page.waitForTimeout(1200);
    // 두 번째 상자 — 호통·추방
    const scoldTexts = [];
    await placeAt(page, "fs_lisa_home", 4, 14, "up");
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(900);
    await drain(page, scoldTexts, { pace: 1700 });
    await page.waitForTimeout(1500);
    const afterScold = await state(page);
    facts.caught.scold = { texts: scoldTexts, var: afterScold.vars?.var_fs_lisa_warned ?? 0, banned: !!afterScold.sw?.sw_fs_lisa_banned, pos: [afterScold.map, afterScold.x, afterScold.y] };
    mark("tScold");
    // 쫓겨난 뒤 다시 문으로 — 거절
    const refusal = [];
    await placeAt(page, "fs_hub", 32, 22, "up");
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }]));
    await page.waitForTimeout(900);
    await drain(page, refusal, { pace: 1700 });
    await page.waitForTimeout(1500);
    const afterRefuse = await state(page);
    facts.caught.refusal = { texts: refusal, pos: [afterRefuse.map, afterRefuse.x, afterRefuse.y], stillHub: afterRefuse.map === "fs_hub" };
    mark("tEnd");
    log("caught", JSON.stringify(facts.caught));

    snapshot = await save(page);
    const video = page.video();
    await context.close();
    facts.videoPath = await video.path();
    await writeFile(resolve(out, "facts-a.json"), JSON.stringify(facts, null, 1));
  }

  // ---------------- 부팅 B: 저장 후 재로드 + 빵·여관·대장간 ----------------
  {
    const { page, context } = await boot(browser, server.url, {
      id: "fs-townlife-reload", snapshot,
      sessionPatch: { actorStateIds: { actor_hero: ["state_poison", "state_sleep"] } },
    });
    const s0 = await state(page);
    facts.persist.afterReload = { banned: !!s0.sw?.sw_fs_lisa_banned, warnedVar: s0.vars?.var_fs_lisa_warned ?? 0, pos: [s0.map, s0.x, s0.y] };
    // 이미 뒤진 상자는 재로드 뒤에도 그대로("이미 뒤졌다")
    facts.persist.searchedBoxAgain = await search(page, "fs_smithy", 16, 9, { pace: 150 });
    // 문 거절 재확인
    const refusal = [];
    await placeAt(page, "fs_hub", 32, 22, "up");
    await page.evaluate(() => window.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }]));
    await page.waitForTimeout(900);
    await drain(page, refusal, { pace: 350 });
    const s1 = await state(page);
    facts.persist.doorAfterReload = { texts: refusal, pos: [s1.map, s1.x, s1.y], stillHub: s1.map === "fs_hub" };
    log("persist", JSON.stringify(facts.persist));

    // 토마 빵집
    await page.evaluate(() => window.__oprnDebug.setGold(2000));
    const sh = await openShopFrom(page, "fs_bakery_home", 13, 12, "up");
    facts.bakery.opened = sh;
    await shopBuyList(page);
    facts.bakery.rows = await buyRows(page);
    const breads = ["fs_bread_warm", "fs_bread_herb", "fs_bread_hearty", "fs_bread_mystery", "fs_bread_stale"];
    facts.bakery.buys = [];
    for (const id of breads) facts.bakery.buys.push(await buyOne(page, id));
    // 신비의 빵·묵은 빵은 확률이라 몇 개 더
    facts.bakery.buys.push(await buyOne(page, "fs_bread_mystery"), await buyOne(page, "fs_bread_mystery"), await buyOne(page, "fs_bread_stale"), await buyOne(page, "fs_bread_stale"));
    // 일반 회복약도 팔리는지
    facts.bakery.buys.push(await buyOne(page, "item_potion"));
    // 되팔기
    await shopKey(page, "Escape");
    await page.waitForSelector('[data-testid="shop-mode-sell"]', { timeout: 10_000 });
    await shopKey(page, "ArrowDown");
    await shopKey(page, "Enter");
    await page.waitForFunction(() => !!document.querySelector('[data-testid^="shop-sell-"]'), null, { timeout: 10_000 });
    const sellRows = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="shop-sell-"]')].map((n) => ({ id: n.dataset.testid.replace("shop-sell-", ""), sel: n.getAttribute("aria-current") === "true", text: n.innerText.replace(/\s+/g, " ").trim() })));
    facts.bakery.sellRows = sellRows.slice(0, 12);
    const sellTarget = sellRows.find((r) => r.id === "item_potion") ?? sellRows[0];
    if (sellTarget) {
      for (let i = 0; i < 30; i++) {
        const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="shop-sell-"]')].map((n) => [n.dataset.testid.replace("shop-sell-", ""), n.getAttribute("aria-current") === "true"]));
        const cur = rows.findIndex((r) => r[1]), want = rows.findIndex((r) => r[0] === sellTarget.id);
        if (cur === want) break;
        await shopKey(page, cur < want ? "ArrowDown" : "ArrowUp");
      }
      const gb = (await state(page)).gold, nb = invOf(await state(page), sellTarget.id);
      await shopKey(page, "Enter");
      await page.waitForTimeout(500);
      const sa = await state(page);
      facts.bakery.sold = { id: sellTarget.id, row: sellTarget.text, dGold: sa.gold - gb, dCount: invOf(sa, sellTarget.id) - nb };
    }
    await closeShop(page);
    log("bakery buys", JSON.stringify(facts.bakery.buys));

    // 기믹 — 메뉴로 먹어 본다
    facts.bakery.use = [];
    facts.bakery.use.push(await gimmick(page, "fs_bread_herb", { hp: 40 })); // 독·수면 치료
    facts.bakery.use.push(await gimmick(page, "fs_bread_warm", { hp: 40 }));
    facts.bakery.use.push(await gimmick(page, "fs_bread_hearty", { hp: 40 }));
    for (let i = 0; i < 3; i++) facts.bakery.use.push(await gimmick(page, "fs_bread_mystery", { hp: 40 }));
    for (let i = 0; i < 3; i++) facts.bakery.use.push(await gimmick(page, "fs_bread_stale", { hp: 40 }));
    log("use", JSON.stringify(facts.bakery.use.map((u) => [u.id, u.hp, u.states[1]])));

    // 여관 — 든든한 빵의 「휴식 때까지」 효과가 풀리는지
    facts.inn.before = (await stateIds(page)).actor_hero ?? [];
    await placeAt(page, "fs_inn", 16, 14, "up");
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForSelector('[data-testid="inn-stay"]', { timeout: 20_000 });
    await page.evaluate(() => document.querySelector('[data-testid="inn-stay"]').click());
    await page.waitForTimeout(1500);
    facts.inn.after = (await stateIds(page)).actor_hero ?? [];
    for (let i = 0; i < 40; i++) {
      if (!(await page.$('[data-testid="inn-resting"]')) && !(await page.$('[data-testid="inn-wake"]')) && !(await page.$('[data-testid="inn-stay"]'))) break;
      await page.keyboard.press("Enter", { delay: 150 });
      await page.waitForTimeout(500);
    }
    log("inn", JSON.stringify(facts.inn));

    // 대장간
    await page.evaluate(() => window.__oprnDebug.setGold(2000));
    const sm = await openShopFrom(page, "fs_smithy", 10, 8, "up");
    facts.smithy.opened = sm;
    await shopBuyList(page);
    facts.smithy.rows = await buyRows(page);
    facts.smithy.buys = [];
    for (const id of ["equip_gen_sword_bronze", "equip_gen_spear_iron", "equip_gen_sword_flame", "equip_gen_armor_chain"]) facts.smithy.buys.push(await buyOne(page, id));
    await shopKey(page, "Escape");
    await page.waitForSelector('[data-testid="shop-mode-sell"]', { timeout: 10_000 });
    await shopKey(page, "ArrowDown");
    await shopKey(page, "Enter");
    await page.waitForFunction(() => !!document.querySelector('[data-testid^="shop-sell-"]'), null, { timeout: 10_000 });
    const sr = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="shop-sell-"]')].map((n) => ({ id: n.dataset.testid.replace("shop-sell-", ""), sel: n.getAttribute("aria-current") === "true", text: n.innerText.replace(/\s+/g, " ").trim() })));
    const tgt = sr.find((r) => r.id === "equip_gen_sword_bronze");
    if (tgt) {
      for (let i = 0; i < 30; i++) {
        const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="shop-sell-"]')].map((n) => [n.dataset.testid.replace("shop-sell-", ""), n.getAttribute("aria-current") === "true"]));
        const cur = rows.findIndex((r) => r[1]), want = rows.findIndex((r) => r[0] === tgt.id);
        if (cur === want) break;
        await shopKey(page, cur < want ? "ArrowDown" : "ArrowUp");
      }
      const gb = (await state(page)).gold;
      await shopKey(page, "Enter");
      await page.waitForTimeout(500);
      facts.smithy.sold = { id: tgt.id, row: tgt.text, dGold: (await state(page)).gold - gb };
    }
    await closeShop(page);
    log("smithy", JSON.stringify(facts.smithy.buys));
    await page.screenshot({ path: resolve(out, "smithy.png") });
    await context.close();
  }
} catch (e) {
  facts.fatal = String(e?.stack ?? e);
  log("FATAL", facts.fatal);
} finally {
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
  await browser.close();
  await server.close();
  log("done ->", resolve(out, "facts.json"));
}
