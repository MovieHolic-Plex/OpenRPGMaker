// 몬스터 마을 시스템 시각 QA — 출하 플레이어(player.html, export shim)에서 ④ 상점·센터와 ⑤ 트레이너 시야선 전투를 실제 입력으로 본다.
//
//   node scripts/qa/runtime/monster-town.mjs <project.json> [outDir]
//   TOWN_STAGE=shop|center|trainer|emote|all (기본 all)
//
// 디버그 쓰기는 SUMMARY 에 적는다: 맵 사이 이동(teleport), 소지금·소지품(__oprnDebug), 파티 체력 낮추기.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-town.mjs <project.json> [outDir]");
const STAGE = process.env.TOWN_STAGE ?? "all";
const want = (name) => STAGE === "all" || STAGE.split(",").includes(name);
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg ?? "verify-shots/runtime-qa/monster-town");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const report = { project: projectArg, steps: [], errors: [], debugWrites: [], audio: {} };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 }, recordVideo: { dir: join(out, "raw-video"), size: { width: 960, height: 720 } } });
const videoOrigin = Date.now();
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-town", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const state = () => page.evaluate(() => window.__oprnDebug.readState());
const live = () => page.evaluate(() => {
  const s = window.__oprnHooksScene.session;
  return { map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })), switches: s.switches, inventory: s.inventory };
});
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.png`) }); return `${name}.png`; };
const step = (id, ok, detail, image) => { report.steps.push({ id, ok, detail, image }); console.log(ok ? "✓" : "✗", id, detail); };
const present = (testid) => page.locator(`[data-testid="${testid}"]`).count().then((n) => n > 0);
const settled = async (done) => { for (let k = 0; k < 4; k++) { if (!(await done())) return false; await page.waitForTimeout(250); } return true; };
const pressEnterUntil = async (done, max = 40) => {
  for (let i = 0; i < max; i++) { if (await settled(done)) return true; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  return settled(done);
};
const teleport = async (mapId, x, y) => {
  report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(700);
};
const face = (dir) => page.evaluate((d) => window.__oprnInput.face(d), dir);
const talk = async (dir) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await face(dir); await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    if (await present("dialogue-box") || await present("battle-scene") || await present("shop-scene")) return true;
  }
  return false;
};
const eventOf = (mapId, eventId) => project.maps[mapId].events.find((event) => event.id === eventId);
const free = (mapId, x, y) => !project.maps[mapId].events.some((event) => event.x === x && event.y === y);
const besideOf = (mapId, event) => [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]]
  .map(([dx, dy, dir]) => ({ x: event.x + dx, y: event.y + dy, dir })).find((p) => free(mapId, p.x, p.y));

async function boot() {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);
  const start = await state();
  const lab = Object.values(project.maps).find((map) => map.events.some((event) => /professor/.test(event.id)));
  const professor = lab.events.find((event) => /professor/.test(event.id));
  const spot = besideOf(lab.id, professor);
  await teleport(lab.id, spot.x, spot.y);
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await pressEnterUntil(async () => (await live()).party.length > 0 && !(await present("dialogue-box")), 80);
  const afterStarter = await live();
  step("boot-starter", afterStarter.party.length === 1, `${start.currentMapId} → 스타터 ${afterStarter.party.map((m) => m.speciesId).join(",")}`);
  return start.currentMapId;
}

const frames = [];
/** 일정 간격으로 화면을 연속 캡처한다(센터 연출 점검). 끝날 때 stop() 하면 파일 목록을 돌려준다. */
function startFrameCapture(prefix, intervalMs = 140, max = 60) {
  let running = true, n = 0;
  const done = (async () => {
    while (running && n < max) {
      const t0 = Date.now();
      await page.screenshot({ path: join(out, `${prefix}-${String(n).padStart(2, "0")}.png`) }).catch(() => {});
      n++;
      await page.waitForTimeout(Math.max(0, intervalMs - (Date.now() - t0)));
    }
  })();
  return async () => { running = false; await done; return n; };
}

const stepMoves = async (dir) => {
  await page.evaluate((d) => window.__oprnInput.dir(d), dir);
  await page.waitForTimeout(280);
  await page.evaluate(() => window.__oprnInput.dir(null));
  await page.waitForTimeout(250);
};
/** 전투가 끝날 때까지: 포획 모드면 체력이 반 아래일 때 가방 → 첫 포획구, 아니면 싸운다 → 가장 강한 기술. */
async function fight(label, { capture = false, run = false } = {}) {
  const log = [];
  for (let turn = 0; turn < 40; turn++) {
    if (!(await present("battle-scene"))) break;
    if (await present("battle-result-panel")) {
      await pressEnterUntil(async () => !(await present("battle-scene")), 30);
      break;
    }
    // 앞 동료가 쓰러지면 「교체 필요」 — 남은 동료를 낸다(이 칸을 Enter 로만 누르면 1분 가까이 멈춰 있었다, 2026-10-07 영상).
    const forced = page.locator('[data-testid^="actor-switch-"]');
    if (!(await page.locator('[data-testid="actor-command-fight"]').count())) {
      if (await forced.count()) { log.push(`turn ${turn}: switch`); await forced.first().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(800); continue; }
      const pkmn = page.locator('[data-testid="actor-command-pkmn"]');
      if (await pkmn.count()) { await pkmn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(500); continue; }
    }
    // 길을 걷다 만난 야생은 플레이어처럼 도망간다 — 체력을 아껴 트레이너에게 간다.
    if (run && await page.locator('[data-testid="actor-command-run"]').count()) {
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
      await page.locator('[data-testid="actor-command-run"]').focus(); await page.keyboard.press("Enter"); log.push(`turn ${turn}: run`);
      await page.waitForTimeout(1500); continue;
    }
    const ready = await page.locator('[data-testid="actor-command-fight"]').count();
    if (!ready) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); continue; }
    // 적 체력은 화면 HUD 글자(「현재/최대」)에서 읽는다 — 플레이어가 보는 그 값.
    const enemyHp = await page.evaluate(() => {
      for (const node of document.querySelectorAll('[data-testid^="battle-enemy-hp-"]')) {
        const [hp, max] = (node.textContent ?? "").split("/").map(Number);
        if (max > 0 && hp > 0) return hp / max;
      }
      return null;
    });
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    if (capture && (enemyHp === null || enemyHp <= 0.5) && await page.locator('[data-testid="actor-command-item"]').isEnabled()) {
      await page.locator('[data-testid="actor-command-item"]').focus(); await page.keyboard.press("Enter");
      const ball = page.locator('[data-testid^="actor-capture-"]').first();
      if (await ball.count()) {
        await ball.focus(); await page.keyboard.press("Enter"); log.push(`turn ${turn}: capture`);
      } else { await page.keyboard.press("Escape"); }
    } else {
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
      await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
      const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
      await skills.first().waitFor({ timeout: 10000 });
      const pick = capture ? skills.first() : skills.last();
      log.push(`turn ${turn}: ${await pick.getAttribute("data-testid")}`);
      await pick.focus(); await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(300);
    const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
    if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
    // 턴이 끝나는 동안 서술(효과·경험치·상금·승리 대사)을 한 줄씩 찍는다 — 다음 명령 메뉴나 전투 종료까지.
    for (let k = 0, t0 = Date.now(); Date.now() - t0 < 45000; k++) {
      const done = await page.evaluate(() => !document.querySelector('[data-testid="battle-scene"]')
        || !!document.querySelector('[data-testid="battle-result-panel"]')
        || !!document.querySelector('[data-testid="actor-command-fight"]')
        || !!document.querySelector('[data-testid^="actor-switch-"]'));
      if (done) break;
      if (label === "trainer" && turn >= 1 && k < 30) await shot(`${label}-narr-${String(k).padStart(2, "0")}`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(500);
    if (turn === 1) await shot(`${label}-mid`);
  }
  // 승리 직후 전투 안의 결과·상금 줄을 찍는다 — 열려 있는 동안 Enter 로 한 줄씩 넘기며 매번.
  for (let k = 0; k < 14 && await present("battle-scene"); k++) {
    await shot(`${label}-result-${String(k).padStart(2, "0")}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(450);
  }
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]'), undefined, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  // 승리 뒤 이어지는 대사(보상 안내)를 닫는다 — 열린 채 두면 이벤트가 끝나지 않아 다음 조사가 먹지 않는다.
  for (let k = 0; k < 6 && !(await present("dialogue-box")); k++) await page.waitForTimeout(300);
  if (await present("dialogue-box")) await shot(`${label}-postwin-dialogue`);
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  return log;
}


async function trainerStage(townId) {
  const route = Object.values(project.maps).find((map) => (map.encounterTable ?? []).length > 0 && project.maps[project.startMapId].events.some((event) => JSON.stringify(event.pages).includes(`"mapId":"${map.id}"`)));
  // 맵 윗가장자리 근처 트레이너는 머리 위 「!」가 화면 밖으로 잘린다 — y ≥ 8 트레이너를 쓴다. 세로 시선(4칸)은 그래도 화면 위쪽에서 잘리므로 「!」 확인은 emoteStage(가로 시선)가 따로 한다.
  const sighted = route.events.filter((event) => event.pages?.some((page) => page.detectionEncounter));
  const trainer = sighted.find((event) => event.y >= 8) ?? sighted[0];
  const page0 = trainer.pages[0];
  const dir = page0.graphic.direction, range = page0.detectionEncounter.sight.range;
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const opposite = { up: "down", down: "up", left: "right", right: "left" }[dir];
  report.trainer = { map: route.id, id: trainer.id, at: [trainer.x, trainer.y], facing: dir, range, troop: JSON.stringify(page0.commands).match(/mx_troop_[A-Za-z0-9_]+/)?.[0] };
  // 주인공을 강하게(첫 길 트레이너에게 지지 않게) — 디버그 쓰기.
  await page.evaluate(() => {
    const s = window.__oprnHooksScene.session;
    const lead = s.monsterInstances[s.monsterParty[0]];
    lead.level = Math.max(lead.level, 14); lead.exp = Math.max(lead.exp ?? 0, 2800); lead.currentHp = undefined;
  });
  report.debugWrites.push("lead level ≥14");
  // 시선 끝 한 칸 바깥에서 한 걸음 들어선다 — 시선선 안으로 걸어 들어가는 장면.
  const outside = { x: trainer.x + dx * (range + 1), y: trainer.y + dy * (range + 1) };
  await teleport(route.id, outside.x, outside.y);
  await shot("trainer-00-outside");
  const t0 = Date.now(), frames = [];
  let n = 0;
  const grab = async (tag) => { const f = `trainer-f-${String(n++).padStart(2, "0")}-${tag}`; await page.screenshot({ path: join(out, `${f}.png`) }); frames.push(f); };
  await stepMoves(opposite);   // 트레이너 쪽으로 한 걸음
  let started = false;
  for (let i = 0; i < 90 && Date.now() - t0 < 45000; i++) {
    const flags = await page.evaluate(() => ({
      emote: (window.__oprnEmotes?.() ?? []).length,
      dialogue: !!document.querySelector('[data-testid="dialogue-box"]'),
      battle: !!document.querySelector('[data-testid="battle-scene"]'),
      intro: !!document.querySelector('[data-testid="emerald-trainer-intro"]'),
    }));
    await grab(`${flags.emote ? "emote" : "-"}${flags.dialogue ? "-dlg" : ""}${flags.battle ? "-battle" : ""}${flags.intro ? "-intro" : ""}`);
    if (flags.dialogue) { await page.waitForTimeout(500); await grab("dlg-full"); await page.keyboard.press("Enter"); }
    if (flags.battle) { started = true; break; }
    await page.waitForTimeout(120);
  }
  report.trainerFrames = frames;
  step("trainer-sight-engage", started, `${trainer.id} 시선 ${dir} ${range}칸 → 전투 시작 ${started ? "OK" : "안 열림"} (${frames.length}장)`, frames[frames.length - 1] + ".png");
  if (!started) return;
  // 소개 슬라이드 — 전투가 열린 뒤 몇 초간 연속 캡처.
  for (let k = 0; k < 24; k++) {
    const intro = await present("emerald-trainer-intro");
    await grab(`intro${intro ? "" : "-none"}`);
    if (await present("actor-command-fight")) break;
    await page.waitForTimeout(150);
  }
  report.introPresent = await present("emerald-trainer-intro");
  const before = await live();
  const log = await fight("trainer");
  report.trainerFightLog = log;
  const after = await state();
  step("trainer-win", after.battleResult === "victory", `${log.length}턴 → ${after.battleResult} · 소지금 ${before.gold} → ${(await live()).gold}`, await shot("trainer-99-after"));
}

// 「!」 말풍선 확인 — 가로 시선 트레이너(체육관 부하)는 화면이 가로로 넓어 머리 위 「!」가 잘리지 않는다. 전투는 열리는 대로 두고 끝낸다.
async function emoteStage() {
  const gym = Object.values(project.maps).find((map) => /_gym$/.test(map.id) && map.events.some((event) => event.pages?.some((pg) => pg.detectionEncounter && pg.graphic.direction === "left")));
  const grunt = gym.events.find((event) => event.pages?.some((pg) => pg.detectionEncounter && pg.graphic.direction === "left"));
  const range = grunt.pages[0].detectionEncounter.sight.range;
  await teleport(gym.id, grunt.x - range - 1, grunt.y);
  await stepMoves("right");
  let seen = null;
  for (let i = 0; i < 40 && !seen; i++) {
    const emotes = await page.evaluate(() => window.__oprnEmotes?.() ?? []);
    if (emotes.some((e) => e.alpha >= 0.9)) { seen = emotes; await page.screenshot({ path: join(out, "emote-gym.png") }); break; }
    await page.waitForTimeout(40);
  }
  step("emote-bang", !!seen, seen ? `${grunt.id} 머리 위 말풍선 ${JSON.stringify(seen[0])}` : `${grunt.id} 말풍선 못 봄`, "emote-gym.png");
}

async function shopStage(townId) {
  const mart = Object.values(project.maps).find((map) => map.id.startsWith(townId) && /_mart$/.test(map.id));
  const clerk = mart.events.find((event) => /_shop$/.test(event.id));
  const spot = besideOf(mart.id, clerk);
  await page.evaluate(() => { window.__oprnDebug.setGold(3000); window.__oprnDebug.giveItem("item_potion", 7); window.__oprnDebug.giveItem("item_capture_orb", 12); });
  report.debugWrites.push("gold 3000 · potion ×7 · capture_orb ×12");
  await teleport(mart.id, spot.x, spot.y);
  await talk(spot.dir);
  await shot("shop-00-greeting");
  await pressEnterUntil(() => present("shop-scene"), 20);
  await page.waitForTimeout(900);
  step("shop-open", await present("shop-scene"), "마트 점원에게 말을 걸어 상점 장면", await shot("shop-01-menu"));
  // 구매: 메뉴(사다) → 첫 물건 → 수량 2 → 확인
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await shot("shop-02-items");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(300);
  await shot("shop-03-quantity");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await shot("shop-04-confirm");
  const before = await live();
  await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  const afterBuy = await live();
  step("shop-buy", afterBuy.gold < before.gold, `소지금 ${before.gold} → ${afterBuy.gold}`, await shot("shop-05-bought"));
  // 판매 — 소지품을 한 번에 여러 개(상인 지갑이 막히지 않아야 한다).
  await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await shot("shop-06-back-to-menu");
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(250);
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await shot("shop-07-sell-list");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  const sellQtyBefore = await page.evaluate(() => document.querySelector(".emerald-shop-overlay")?.innerText ?? "");
  for (let i = 0; i < 6; i++) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(120); }
  await shot("shop-08-sell-quantity");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await shot("shop-09-sell-confirm");
  const goldBeforeSell = (await live()).gold;
  await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  const afterSell = await live();
  step("shop-sell-many", afterSell.gold > goldBeforeSell, `판매 소지금 ${goldBeforeSell} → ${afterSell.gold} · 소지품 ${JSON.stringify(afterSell.inventory)}`, await shot("shop-10-sold"));
  report.shopSellText = sellQtyBefore.slice(0, 160);
  // 상점을 닫는다 — 열린 채 다음 단계(센터)로 넘어가면 입력이 상점에 먹힌다.
  for (let k = 0; k < 10 && await present("shop-scene"); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(400); }
  await page.waitForTimeout(500);
}

async function centerStage(townId) {
  const center = Object.values(project.maps).find((map) => map.id.startsWith(townId) && /_center$/.test(map.id));
  const nurse = center.events.find((event) => /_nurse$/.test(event.id));
  const spot = besideOf(center.id, nurse);
  // 파티를 지치게 한다 — 체력 1, 한 기술의 남은 횟수 0(회복 전후를 화면 글자로 비교할 수 있게).
  await page.evaluate(() => {
    const s = window.__oprnHooksScene.session;
    // 볼 줄을 보려고 파티를 세 마리로 늘린다(스타터 복제 — 센터는 파티 수만큼 볼을 놓는다).
    const first = s.monsterParty[0];
    for (let k = 1; k <= 2; k++) { const id = `${first}_qa${k}`; s.monsterInstances[id] = { ...s.monsterInstances[first], instanceId: id }; s.monsterParty.push(id); }
    for (const id of s.monsterParty) { const m = s.monsterInstances[id]; m.currentHp = 1; }
  });
  report.debugWrites.push("파티를 스타터 복제로 3마리, 전원 currentHp = 1");
  await teleport(center.id, spot.x, spot.y);
  await shot("center-00-arrive");
  report.nurse = { x: nurse.x, y: nurse.y, spot };
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await shot("center-01-greeting");
  // 인사 → 선택지(맡긴다 / 괜찮아요). Enter 로 대사를 넘겨 선택지가 뜨면 멈춘다.
  for (let i = 0; i < 12 && !(await present("runtime-choices")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(350); }
  await shot("center-02-choice");
  await page.evaluate(() => { window.__centerAudioStart = (window.__oprnAudioObserved ?? []).length; });
  const stop = startFrameCapture("center-f", 110, 140);
  report.centerVideoStartMs = Date.now() - videoOrigin;
  await page.keyboard.press("Enter");
  // 연출이 끝나 마지막 인사 대사가 뜰 때까지 — 대사가 뜨면 Enter 로 넘긴다.
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const hp = (await live()).party.map((m) => m.currentHp);
    if (hp.every((v) => v === undefined || v > 1)) break;
    // 대사가 ▼ 로 멈춰 있으면 넘긴다(연출 중간에는 대사가 없다 — 눌러도 아무 일도 없다).
    if (await present("dialogue-box")) await page.keyboard.press("Enter");
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(900);
  const n = await stop();
  report.centerVideoEndMs = Date.now() - videoOrigin;
  report.audio.center = await page.evaluate(() => (window.__oprnAudioObserved ?? []).slice(window.__centerAudioStart ?? 0));
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  const healed = await live();
  step("center-heal", healed.party.every((m) => m.currentHp === undefined || m.currentHp > 1), `연속 캡처 ${n}장 · 파티 HP ${JSON.stringify(healed.party.map((m) => m.currentHp))} · 소리 ${JSON.stringify(report.audio.center)}`, await shot("center-99-done"));
}

try {
  const townId = await boot();
  if (want("shop")) await shopStage(townId);
  if (want("center")) await centerStage(townId);
  if (want("trainer")) await trainerStage(townId);
  if (want("emote")) await emoteStage();
} catch (error) {
  report.failure = String(error?.stack ?? error);
  await shot("failure").catch(() => {});
  console.error(report.failure);
} finally {
  const failed = report.steps.filter((s) => !s.ok);
  report.ok = !report.failure && failed.length === 0 && report.errors.length === 0;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "SUMMARY.md"), [
    `# monster-town — ${report.ok ? "통과" : "실패"}`, "",
    ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail}${s.image ? ` (${s.image})` : ""}`), "",
    `디버그 쓰기: ${report.debugWrites.join(" · ")}`, "",
    report.failure ? `예외: ${report.failure}` : "", ...report.errors.slice(0, 15).map((e) => `- 오류: ${e}`),
  ].join("\n"));
  const video = page.video();
  await context.close();
  if (video && report.centerVideoStartMs !== undefined) {
    // 센터 연출 구간을 영상에서 8fps 로 뽑는다(스크린샷 캡처는 4fps 라 볼이 놓이는 짧은 순간을 놓친다).
    const { execFileSync } = await import("node:child_process");
    const raw = await video.path();
    const from = Math.max(0, (report.centerVideoStartMs - 300) / 1000), len = (report.centerVideoEndMs - report.centerVideoStartMs + 900) / 1000;
    try { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(from), "-t", String(len), "-i", raw, "-vf", "fps=8", join(out, "center-v-%02d.png")]); } catch (error) { report.errors.push(`ffmpeg: ${error}`); }
  }
  await browser.close();
  await server.close();
}
process.exit(report.ok ? 0 : 1);
