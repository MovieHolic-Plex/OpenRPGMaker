// 폴른 스타 전투·아이템·경제 검증 프로브 (출하 플레이어 브라우저).
//   node scripts/qa/runtime/fallen-battle-items.probe.mjs <phase> [FIXTURE=/tmp/fsb-dist/demos/chrono-bell.play.json]
//   phase: steps | weapons | potion | flask | smoke | drops
// 구운 play.json 을 읽어 phase 마다 필요한 값(조우율·적 HP·장비)만 바꿔 route 로 서빙한다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const phase = process.argv[2] ?? "steps";
const FIXTURE = process.env.FIXTURE ?? "/tmp/fsb-dist/demos/chrono-bell.play.json";
const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-battle-items", phase);
await mkdir(out, { recursive: true });
const base = JSON.parse(await readFile(FIXTURE, "utf8"));

function fixture({ rate, table, weapon, hpOne, heroHp }) {
  const p = structuredClone(base);
  const forest = p.maps.fs_forest;
  if (rate !== undefined) forest.encounterRate = rate;
  if (table) forest.encounterTable = table.map((troopId) => ({ troopId, weight: 1 }));
  if (weapon) Object.values(p.database.actors).find((a) => a.id === "actor_hero").initialEquipment.weapon = weapon;
  if (hpOne) for (const e of Object.values(p.database.enemies)) { e.maxHp = 1; if (e.parameterCurves) delete e.parameterCurves; }
  if (heroHp) Object.values(p.database.actors).find((a) => a.id === "actor_hero").maxHp = heroHp;
  p.system.escapeGraceSteps = 0;
  return p;
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const results = { phase, errors: [] };

async function boot(project) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on("pageerror", (e) => results.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__x/project.json", saveNamespace: "fsb-" + Math.random(), qaInstrumentation: true };
    window.__log = [];
    const seen = new Set();
    const push = (t) => { t = (t || "").trim(); if (t && !seen.has(t + window.__log.length)) window.__log.push(t); };
    new MutationObserver(() => {
      for (const n of document.querySelectorAll('[data-testid="battle-message-window"], .battle-damage-popup, .battle-actor-hp')) push(n.className.includes("actor-hp") ? "" : n.textContent);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.route("**/__x/project.json", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 90_000 });
  await page.waitForSelector('[data-testid="title-screen"][data-seq-state="done"]', { timeout: 40_000 });
  // 새 게임 → 오프닝 연출이 뜬다. 뜰 때까지 Enter, 사라질 때까지 Escape.
  for (let i = 0; i < 6 && !(await page.locator('[data-testid="cinematic-sequence"]').count()); i++) {
    await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
  }
  for (let i = 0; i < 10 && (await page.locator('[data-testid="cinematic-sequence"]').count()); i++) {
    await page.keyboard.press("Escape"); await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 120_000 });
  await page.waitForTimeout(800);
  // 오프닝 직후 포고·행진 연출이 입력과 조우를 잠근다 — 대사창이 열려 있는 동안만 Enter 를 길게(350ms) 눌러 닫고,
  // 장면이 풀려(running=false) 400ms 유지될 때까지 기다린다. 짧은 Enter 는 플레이어가 놓친다.
  let freeSince = 0;
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => ({ run: window.__oprnHooksScene?.running, dlg: !!document.querySelector('[data-testid="dialogue-box"]') && !document.querySelector('[data-testid="runtime-choices"]') }));
    if (!st.run) { freeSince ||= Date.now(); if (Date.now() - freeSince > 1200) break; await page.waitForTimeout(200); continue; }
    freeSince = 0;
    if (st.dlg) { await page.keyboard.press("Enter", { delay: 350 }); await page.waitForTimeout(250); }
    else await page.waitForTimeout(400);
  }
  if (process.env.HB) setInterval(async () => { try { console.log("hb", JSON.stringify(await page.evaluate(() => ({ ids: [...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid).slice(0, 14), run: window.__oprnHooksScene?.running })))); await page.screenshot({ path: resolve(out, "hb.png") }); } catch {} }, 20000).unref();
  console.log("boot done", JSON.stringify((await page.evaluate(() => window.__oprnDebug.readState())).currentMapId));
  return page;
}

const state = (page) => page.evaluate(() => window.__oprnDebug.readState());
const inBattle = (page) => page.locator('[data-testid="battle-scene"]').count().then((n) => n > 0);

async function toForest(page) {
  await page.evaluate(() => window.__oprnDebug.teleport("fs_forest", 15, 20));
  await page.waitForFunction(() => window.__oprnDebug.readState().currentMapId === "fs_forest", undefined, { timeout: 20_000 });
  await page.waitForTimeout(500);
  // 숲 진입 연출(자동 실행 이벤트)이 입력·조우를 잠근다 — 끝날 때까지 대사를 닫는다.
  for (let i = 0; i < 120; i++) {
    const r = await page.evaluate(() => window.__oprnHooksScene.running);
    if (!r) break;
    await page.keyboard.press("Enter", { delay: 350 }); await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
}

/** 한 걸음씩 걷다 전투가 뜨면 센 걸음 수를 돌려준다. 막히면 다른 방향. */
async function walkUntilBattle(page, maxSteps = 400) {
  const dirs = ["up", "down", "left", "right"];
  let steps = 0, dir = "up", stuck = 0;
  while (steps < maxSteps) {
    if (await inBattle(page)) return steps;
    const before = await state(page);
    await page.evaluate((d) => window.__oprnDebug.playerRoute([{ kind: "move", dir: d }]), dir);
    let moved = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(50);
      if (await inBattle(page)) return steps + 1;
      const s = await state(page);
      if (s.x !== before.x || s.y !== before.y) { moved = true; break; }
    }
    if (process.env.TRACE) console.log(`t=${Date.now()%100000} dir=${dir} moved=${moved} steps=${steps} pos=${(await state(page)).x},${(await state(page)).y}`);
    if (moved) { steps++; stuck = 0; await page.waitForTimeout(300); if (Math.random() < 0.25) dir = dirs[(Math.random() * 4) | 0]; }
    else { stuck++; dir = dirs[(Math.random() * 4) | 0]; if (stuck > 6) { await toForest(page); stuck = 0; } }
  }
  return null;
}

async function click(page, testid, timeout = 15_000) {
  // 부하가 큰 박스에서 Playwright 의 안정성 대기가 멈추는 일이 있어 DOM click 을 직접 보낸다.
  const t0 = Date.now();
  for (;;) {
    const ok = await page.evaluate((id) => { const n = document.querySelector(`[data-testid="${id}"]`); if (!n) return false; n.click(); return true; }, testid);
    if (ok) return;
    if (Date.now() - t0 > timeout) throw new Error("click timeout " + testid);
    await page.waitForTimeout(150);
  }
}
async function ready(page) {
  try { await page.locator('[data-testid^="actor-command-"]').first().waitFor({ timeout: 60_000 }); }
  catch (e) {
    await shot(page, "ready-fail");
    results.readyFail = await page.evaluate(() => ({ ids: [...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid).slice(0, 60), state: window.__oprnDebug.readState().currentMapId }));
    throw e;
  }
}
async function firstTarget(page) {
  const t = page.locator('[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])').first();
  await t.waitFor({ timeout: 8000 });
  const id = await t.getAttribute("data-testid");
  await t.evaluate((n) => n.click());
  return id;
}
const logOf = (page) => page.evaluate(() => window.__log.slice());
const shot = (page, n) => page.screenshot({ path: resolve(out, n + ".png") });

try {
  if (phase === "diag") {
    const page = await boot(fixture({ rate: 3000, table: ["troop_fs_wolves"] }));
    const dump0 = async (l) => console.log(l, JSON.stringify(await page.evaluate(() => { const sc = window.__oprnHooksScene; return { running: sc.running, inputEnabled: sc.inputEnabled, dialog: !!document.querySelector('[data-testid*="dialogue"],[data-testid*="message"]'), ids: [...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid).slice(0, 25) }; })));
    await dump0("hub");
    await page.evaluate(() => window.__oprnDebug.teleport("fs_forest", 15, 24));
    await page.waitForTimeout(3000);
    await dump0("forest@3s");
    await shot(page, "diag0");
    const dump = async (l) => console.log(l, JSON.stringify(await page.evaluate(() => { const sc = window.__oprnHooksScene; return { running: sc.running, moving: sc.moving, inputEnabled: sc.inputEnabled, rate: sc.map.encounterRate, table: sc.map.encounterTable?.length, guard: sc.session.encounterGuard, st: (({ currentMapId, x, y }) => ({ currentMapId, x, y }))(window.__oprnDebug.readState()) }; })));
    await dump("after teleport");
    for (const d of ["up", "up", "right", "right", "down"]) { await page.evaluate((x) => window.__oprnDebug.playerRoute([{ kind: "move", dir: x }]), d); await page.waitForTimeout(700); await dump("after " + d + " battle=" + (await inBattle(page))); }
    await shot(page, "diag");
  } else if (phase === "stepcheck") {
    // 한 번의 route move 가 몇 칸 가는지 — 걸음 수 측정이 실제 조우 판정 횟수와 맞는지 본다.
    const page = await boot(fixture({ rate: 0.001 }));
    await toForest(page);
    const out2 = [];
    for (const d of ["up", "right", "down", "left", "up", "right"]) {
      const a = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return [s.x, s.y]; });
      await page.evaluate((x) => window.__oprnDebug.playerRoute([{ kind: "move", dir: x }]), d);
      await page.waitForTimeout(1500);
      const b = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return [s.x, s.y]; });
      out2.push({ d, a, b });
    }
    results.stepcheck = out2; console.log("STEPCHECK", JSON.stringify(out2));
    await page.close();
  } else if (phase === "steps") {
    const N = Number(process.env.N ?? 14);
    for (const rate of (process.env.RATES ?? "12,1.6").split(",").map((r) => (r === "baked" ? undefined : Number(r)))) {
      const page = await boot(fixture({ rate }));
      await toForest(page);
      const counts = [];
      for (let k = 0; k < N; k++) {
        const c = await walkUntilBattle(page);
        if (c === null) break;
        if (c === 0) k--; else { counts.push(c); console.log(`rate ${rate} #${k} steps=${c}`); }
        // 도망 — 실패하면 다시. 전투 화면이 사라질 때까지 기다린다.
        for (let t = 0; t < 8 && (await inBattle(page)); t++) {
          try { await ready(page); await click(page, "actor-command-escape", 6000); } catch (e) { console.log('escape-try', t, String(e).slice(0, 80)); }
          for (let w = 0; w < 30 && (await inBattle(page)); w++) {
            await page.waitForTimeout(400);
            if (await page.locator('[data-testid="battle-result-confirm"]').count()) await click(page, "battle-result-confirm", 2000).catch(() => {});
          }
        }
        for (let w = 0; w < 30 && (await page.evaluate(() => window.__oprnHooksScene.running)); w++) { await page.keyboard.press("Enter", { delay: 350 }); await page.waitForTimeout(250); }
        await page.waitForTimeout(800);
      }
      const mean = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
      results[`rate_${rate}`] = { counts, mean: Math.round(mean * 10) / 10 };
      console.log(`rate ${rate}: ${JSON.stringify(counts)} mean=${mean.toFixed(1)}`);
      await page.close();
    }
  } else {
    const cfg = {
      weapons: null, potion: { table: ["troop_fs_wolves"] }, flask: { table: ["troop_fs_wolves"] },
      smoke: { table: ["troop_fs_wolves"] }, drops: { table: ["troop_fs_wolves", "troop_fs_spiders", "troop_fs_wisps"], hpOne: true },
    };
    const runs = phase === "weapons"
      ? [{ weapon: "equip_fs_sword_gale" }, { weapon: "equip_fs_spear_pike" }].map((w) => ({ ...w, table: ["troop_fs_spiders"] }))
      : [cfg[phase]];
    for (const [ri, c] of runs.entries()) {
      const page = await boot(fixture({ rate: 3000, ...c }));
      if (phase === "potion") await page.evaluate(() => { window.__oprnSetActorVitals("actor_hero", 120, 10); window.__oprnDebug.giveItem("item_potion", 3); });
      if (phase === "flask") await page.evaluate(() => { window.__oprnDebug.giveItem("item_fs_fire_flask", 3); window.__oprnDebug.giveItem("item_fs_water_flask", 3); });
      if (phase === "smoke") await page.evaluate(() => window.__oprnDebug.giveItem("item_fs_smoke_pellet", 2));
      await toForest(page);
      const rounds = phase === "drops" ? 10 : 1;
      const inv = [];
      for (let r = 0; r < rounds; r++) {
        const steps = await walkUntilBattle(page, 60);
        if (steps === null) { await shot(page, "no-battle"); results.noBattle = await page.evaluate(() => ({ ids: [...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid).slice(0, 60), st: window.__oprnDebug.readState() })); throw new Error("walkUntilBattle: no encounter in 60 steps"); }
        await ready(page);
        await shot(page, `${ri}-${r}-start`);
        if (phase === "potion") {
          const hp = () => page.evaluate(() => [...document.querySelectorAll(".battle-party .battle-actor-status .battle-actor-hp")].map((n) => n.textContent));
          const before = await hp();
          await click(page, "actor-command-item"); await click(page, "actor-item-item_potion");
          const tid = await firstTarget(page);
          await page.waitForTimeout(2500);
          results.potion = { before, after: await hp(), target: tid, log: await logOf(page) };
        } else if (phase === "flask") {
          await click(page, "actor-command-item"); await click(page, "actor-item-item_fs_fire_flask");
          results.fireTarget = await firstTarget(page);
          await page.waitForTimeout(3000);
          results.flaskLog = await logOf(page);
        } else if (phase === "smoke") {
          await click(page, "actor-command-item"); await click(page, "actor-item-item_fs_smoke_pellet");
          try { await firstTarget(page); } catch {}
          await page.waitForTimeout(3000);
          results.smokeLog = await logOf(page);
          results.smokeEscaped = !(await inBattle(page));
        } else {
          // 공격 반복 — 영웅 행동 때마다 첫 대상.
          for (let t = 0; t < 40 && (await inBattle(page)); t++) {
            try {
              if (await page.locator('[data-testid="actor-command-attack"]').count()) {
                await click(page, "actor-command-attack", 3000); await firstTarget(page);
              } else if (await page.locator('[data-testid="battle-result-confirm"]').count()) await click(page, "battle-result-confirm", 3000);
            } catch {}
            await page.waitForTimeout(500);
            if (phase !== "drops" && t > 14) break;
          }
          if (phase === "weapons") {
            const l = await logOf(page);
            results[c.weapon] = l.filter((x) => /카엘|피해|굉장|별로/.test(x)).slice(0, 14);
          } else {
            await page.waitForTimeout(1200);
            await page.keyboard.press("z"); await page.waitForTimeout(600);
            inv.push((await state(page)).inventory);
          }
        }
        if (phase === "drops") {
          const drops = (await logOf(page)).filter((x) => /획득|손에 넣|얻/.test(x));
          console.log(`battle ${r} steps=${steps} inv=${JSON.stringify(inv.at(-1))} dropLog=${JSON.stringify(drops.slice(-3))}`);
          await page.waitForTimeout(500);
        }
      }
      if (phase === "drops") results.inventory = inv;
      await shot(page, `${ri}-end`);
      await page.close();
    }
  }
} finally {
  await writeFile(resolve(out, "result.json"), JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
  await server.close();
}
