// 『폴른 스타』 마을 잔 일 셋(Q1 납작빵·Q2 은수저·Q3 창)과 새 마을 대사 실플레이 — 출하 플레이어(play.json 투영)로 밟는다.
// 부팅 A: 광장 체크포인트 → 새 대사 셋 → Q1 수락·세 사람에게 건넴 → 의뢰 도중 저장.
// 부팅 B: 그 저장으로 다시 부팅(영상) → Q1 마무리(브람·토마) → Q2 전부 → Q3 전부 → 일지 상태.
//
//   npm run bake:demos -- --only chrono-bell --out /tmp/fsq-bake
//   FS_FIXTURE=/tmp/fsq-bake/demos/chrono-bell.play.json node scripts/qa/runtime/fallen-quests.play.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-quests");
await mkdir(out, { recursive: true });
const projectJson = await readFile(resolve(process.env.FS_FIXTURE ?? "/tmp/fsq-bake/demos/chrono-bell.play.json"), "utf8");
const facts = { dialogues: {}, q1: {}, q2: {}, q3: {}, reload: {}, journal: null, marks: {}, errors: [] };
const log = (...a) => console.error("[quests]", ...a);

const START = {
  id: "fs-quests-start",
  mapId: "fs_hub", x: 32, y: 24, facing: "up",
  switches: { sw_fs_main_started: true, sw_fs_valen_marched: true, sw_fs_knight_marched: true },
  party: [{ actorId: "actor_hero", level: 6 }],
  gold: 200,
};

async function boot(browser, serverUrl, checkpoint, { video = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 480, height: 270 },
    ...(video ? { recordVideo: { dir: out, size: { width: 960, height: 540 } } } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => facts.errors.push(String(e).slice(0, 200)));
  const t0 = Date.now();
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
    localStorage.clear();
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, qaCheckpoint };
  }, ["/__runtime-qa/project.json", `fs-quests-${Date.now()}`, checkpoint]);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: projectJson }));
  await page.goto(`${serverUrl}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => !!window.__oprnDebug && !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  await page.waitForTimeout(3000);
  await settle(page);
  log("booted", checkpoint.id, Date.now() - t0, "ms");
  return { page, context, t0 };
}

const state = (page) => page.evaluate(() => {
  const s = window.__oprnDebug.readState();
  return { map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, inv: s.inventory ?? {}, sw: s.switches ?? {}, vars: s.variables ?? {} };
});
const inv = (s, id) => s.inv?.[id] ?? 0;

async function settle(page, max = 200) {
  for (let i = 0; i < max; i++) {
    const info = await page.evaluate(() => ({
      running: window.__oprnHooksScene?.running === true,
      box: !!document.querySelector('[data-testid="dialogue-box"]'),
      choices: !!document.querySelector('[data-testid="runtime-choices"]'),
      shop: !!document.querySelector('[data-testid="shop-scene"]'),
    }));
    if (info.shop) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); continue; }
    if (!info.running && !info.box) return i;
    if (info.box || info.choices) await page.keyboard.press("Enter", { delay: 150 });
    await page.waitForTimeout(350);
  }
  return -1;
}

/**
 * 대사를 넘기며 글을 모은다. 선택지가 뜨면 picks 에서 하나씩 꺼내 고른다(0=첫째). 상점이 뜨면 닫는다.
 * 끝나면 모은 글을 돌려준다.
 */
async function converse(page, picks = [], { pace = 260 } = {}) {
  const texts = [];
  let last = null;
  const queue = [...picks];
  for (let i = 0; i < 160; i++) {
    const info = await page.evaluate(() => ({
      box: document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? null,
      choices: [...document.querySelectorAll('[data-testid="runtime-choices"] button, [data-testid="runtime-choices"] [role="option"], [data-testid="runtime-choices"] li')].map((n) => n.innerText.trim()),
      choicesOpen: !!document.querySelector('[data-testid="runtime-choices"]'),
      shop: !!document.querySelector('[data-testid="shop-scene"]'),
      running: window.__oprnHooksScene?.running === true,
      inn: !!document.querySelector('[data-testid="inn-cancel"]'),
    }));
    if (info.inn) {
      texts.push("[여관]");
      await page.evaluate(() => document.querySelector('[data-testid="inn-cancel"]')?.click());
      await page.waitForTimeout(500);
      continue;
    }
    if (info.shop) {
      texts.push("[상점]");
      for (let k = 0; k < 6 && (await page.$('[data-testid="shop-scene"]')); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
      continue;
    }
    if (info.choicesOpen) {
      const pick = queue.length ? queue.shift() : 0;
      texts.push(`[선택 ${pick}: ${info.choices[pick] ?? "?"}]`);
      for (let k = 0; k < pick; k++) { await page.keyboard.press("ArrowDown", { delay: 120 }); await page.waitForTimeout(200); }
      await page.keyboard.press("Enter", { delay: 150 });
      await page.waitForTimeout(500);
      continue;
    }
    if (info.box !== null) {
      const clean = info.box.replace(/\s+/g, " ").trim();
      if (clean && clean !== last) { texts.push(clean); last = clean; }
      await page.waitForTimeout(pace);
      await page.keyboard.press("Enter", { delay: 150 });
      await page.waitForTimeout(220);
      continue;
    }
    if (!info.running) {
      await page.waitForTimeout(450);
      const again = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]') || !!document.querySelector('[data-testid="runtime-choices"]') || !!document.querySelector('[data-testid="shop-scene"]') || window.__oprnHooksScene?.running === true);
      if (!again) return texts;
      continue;
    }
    await page.waitForTimeout(200);
  }
  return texts;
}

/** 이벤트의 지금 칸. 걷는 사람은 세이브의 이벤트 자리, 아니면 프로젝트의 자리. */
async function eventCell(page, mapId, id) {
  const pos = await page.evaluate(([m, e]) => {
    const live = window.__oprnHooksScene?.eventPositions?.[e];
    if (live && Number.isFinite(live.x)) return { x: live.x, y: live.y };
    const snap = window.__oprnDebug.captureSave?.();
    const s = snap?.session ?? {};
    const pick = (src) => src?.[m]?.[e] ?? src?.[e];
    return pick(s.eventLocations) ?? pick(s.eventPositions) ?? null;
  }, [mapId, id]);
  if (pos && Number.isFinite(pos.x)) return { x: pos.x, y: pos.y };
  return null;
}

const project = JSON.parse(projectJson);
const P = project.project ?? project;
const staticCell = (mapId, id) => { const e = P.maps[mapId]?.events.find((v) => v.id === id); return e ? { x: e.x, y: e.y } : null; };

/** 사람 곁에 서서 바라보고 말을 건다. */
async function talk(page, mapId, who, picks = []) {
  // 계산대 뒤 주인은 손님 쪽 계산대 칸(<id>_counter)에서 말을 받는다 — 실제 손님처럼 그 앞에 선다.
  const id = staticCell(mapId, `${who}_counter`) ? `${who}_counter` : who;
  for (let attempt = 0; attempt < 6; attempt++) {
    const at = (await eventCell(page, mapId, id)) ?? staticCell(mapId, id);
    if (!at) throw new Error(`no event ${mapId}/${id}`);
    const tries = [[at.x, at.y + 1, "up"], [at.x - 1, at.y, "right"], [at.x + 1, at.y, "left"], [at.x, at.y - 1, "down"]];
    for (const [x, y, dir] of tries) {
      await settle(page);
      await page.evaluate(([m, px, py, d]) => { window.__oprnInput.face(d); window.__oprnDebug.teleport(m, px, py); }, [mapId, x, y, dir]);
      await page.waitForTimeout(500);
      await page.evaluate((d) => window.__oprnInput.face(d), dir);
      await page.waitForTimeout(150);
      const s = await state(page);
      if (s.map !== mapId || s.x !== x || s.y !== y) continue;
      await page.evaluate(() => window.__oprnInput.action());
      await page.waitForTimeout(450);
      const texts = await converse(page, picks);
      if (texts.length) return texts;
    }
    await page.waitForTimeout(700); // 걷는 사람이 자리를 옮기는 중
  }
  return [];
}

/** 수납 한 칸 뒤지기. */
async function search(page, mapId, bx, by, picks = []) {
  for (const [x, y, dir] of [[bx, by + 1, "up"], [bx, by - 1, "down"], [bx - 1, by, "right"], [bx + 1, by, "left"]]) {
    await settle(page);
    await page.evaluate(([m, px, py, d]) => { window.__oprnInput.face(d); window.__oprnDebug.teleport(m, px, py); }, [mapId, x, y, dir]);
    await page.waitForTimeout(500);
    await page.evaluate((d) => window.__oprnInput.face(d), dir);
    await page.waitForTimeout(150);
    const s = await state(page);
    if (s.map !== mapId || s.x !== x || s.y !== y) continue;
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(450);
    return await converse(page, picks);
  }
  return ["(닿을 칸 없음)"];
}

const boxBy = (mapId, re) => P.maps[mapId].events.filter((e) => e.id.startsWith("ev_fs_box_") && re.test(e.name)).sort((a, b) => a.y - b.y || a.x - b.x)[0];

async function shot(page, name) { await page.screenshot({ path: `${out}/${name}.png` }); }

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
let snapshot = null;
try {
  // ───────── 부팅 A ─────────
  {
    const { page, context } = await boot(browser, server.url, START);
    facts.dialogues.mire = await talk(page, "fs_hub", "ev_fs_baker");
    facts.dialogues.gate = await talk(page, "fs_hub", "ev_fs_gate");
    facts.dialogues.tobi = await talk(page, "fs_hub", "ev_fs_kid");
    await shot(page, "a-hub");
    log("dialogues", JSON.stringify(facts.dialogues).slice(0, 600));

    facts.q1.first = await talk(page, "fs_bakery_home", "ev_fs_baker_husband");
    facts.q1.offer = await talk(page, "fs_bakery_home", "ev_fs_baker_husband", [0]);
    let s = await state(page);
    facts.q1.accepted = { on: s.sw.sw_fs_q_bread_on === true, flat: inv(s, "fs_bread_flat") };
    facts.q1.gate = await talk(page, "fs_hub", "ev_fs_gate");
    facts.q1.rino = await talk(page, "fs_hub", "ev_fs_rino");
    facts.q1.osborn = await talk(page, "fs_stargazer_home", "ev_fs_old_stargazer");
    s = await state(page);
    facts.q1.midway = { given: s.vars.var_fs_q_bread_given, flat: inv(s, "fs_bread_flat"), gate: s.sw.sw_fs_q_bread_gate, rino: s.sw.sw_fs_q_bread_rino, osborn: s.sw.sw_fs_q_bread_osborn };
    log("q1 midway", JSON.stringify(facts.q1.midway));
    snapshot = await page.evaluate(() => window.__oprnDebug.captureSave());
    // 숲 재료(늑대·도깨비불 드롭)는 이 실험의 범위 밖 — 저장 뒤 부팅 B 에서 디버그로 쥐여 준다.
    await context.close();
  }
  // ───────── 부팅 B: 저장에서 다시 ─────────
  {
    const { page, context, t0 } = await boot(browser, server.url, { id: "fs-quests-reload", snapshot }, { video: true });
    const mark = (k) => { facts.marks[k] = (Date.now() - t0) / 1000; };
    let s = await state(page);
    facts.reload = { map: s.map, given: s.vars.var_fs_q_bread_given, flat: inv(s, "fs_bread_flat"), on: s.sw.sw_fs_q_bread_on, osborn: s.sw.sw_fs_q_bread_osborn };
    log("reload", JSON.stringify(facts.reload));

    facts.q1.bram = await talk(page, "fs_forest", "ev_fs_bram");
    mark("q1DoneStart");
    facts.q1.done = await talk(page, "fs_bakery_home", "ev_fs_baker_husband");
    mark("q1DoneEnd");
    s = await state(page);
    facts.q1.result = { done: s.sw.sw_fs_q_bread_done, starlight: inv(s, "fs_bread_starlight") };
    log("q1", JSON.stringify(facts.q1.result));

    // Q2
    facts.q2.offer = await talk(page, "fs_inn", "ev_fs_inn_keeper", [0]);
    const innBox = boxBy("fs_inn", /^수납 · 상자$/) ?? boxBy("fs_inn", /궤짝/);
    facts.q2.inn = await search(page, "fs_inn", innBox.x, innBox.y);
    const sack = boxBy("fs_apothecary", /^수납 · 자루$/);
    facts.q2.sack = await search(page, "fs_apothecary", sack.x, sack.y);
    const flour = boxBy("fs_bakery_home", /밀가루/);
    facts.q2.flour = await search(page, "fs_bakery_home", flour.x, flour.y);
    s = await state(page);
    facts.q2.afterFlour = { spoons: inv(s, "item_fs_silver_spoon"), flour: s.sw.sw_fs_q_spoon_flour };
    mark("bridgeStart");
    facts.q2.bridge = await talk(page, "fs_hub", "ev_fs_kid_bridge");
    mark("bridgeEnd");
    await shot(page, "b-bridge-after");
    facts.q2.done = await talk(page, "fs_inn", "ev_fs_inn_keeper", [1]);
    s = await state(page);
    facts.q2.result = { done: s.sw.sw_fs_q_spoon_done, spoons: inv(s, "item_fs_silver_spoon"), ticket: inv(s, "item_fs_free_night") };
    log("q2", JSON.stringify(facts.q2.result));

    // Q3
    facts.q3.first = await talk(page, "fs_smithy", "ev_fs_smith", [0]);
    s = await state(page);
    facts.q3.accepted = s.sw.sw_fs_q_spear_on;
    facts.q3.short = await talk(page, "fs_smithy", "ev_fs_smith");
    await page.evaluate(() => { window.__oprnDebug.giveItem("item_fs_wolf_fang", 3); window.__oprnDebug.giveItem("item_fs_wisp_ember", 1); });
    mark("q3Start");
    facts.q3.craft = await talk(page, "fs_smithy", "ev_fs_smith", [0]);
    mark("q3End");
    s = await state(page);
    facts.q3.result = { done: s.sw.sw_fs_q_spear_done, spear: inv(s, "equip_fs_spear_pike"), fangs: inv(s, "item_fs_wolf_fang"), ember: inv(s, "item_fs_wisp_ember") };
    log("q3", JSON.stringify(facts.q3.result));

    // 일지: 퀘스트 상태(그래프 퀘스트는 스위치로 단계가 찬다)
    facts.journal = await page.evaluate(() => {
      const sw = window.__oprnDebug.readState().switches ?? {};
      return ["sw_fs_q_bread_done", "sw_fs_q_spoon_done", "sw_fs_q_spear_done"].map((k) => `${k}=${sw[k] === true}`);
    });
    await context.close();
    facts.video = (await page.video()?.path()) ?? null;
  }
} catch (e) {
  facts.errors.push(String(e?.stack ?? e).slice(0, 600));
} finally {
  await browser.close();
  await server.close?.();
}
await writeFile(`${out}/facts.json`, JSON.stringify(facts, null, 1));
console.log(JSON.stringify({ errors: facts.errors, q1: facts.q1.result, q2: facts.q2.result, q3: facts.q3.result, reload: facts.reload, marks: facts.marks, video: facts.video }));
