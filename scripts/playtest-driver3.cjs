// 드라이버 v3 — 비트별 격리 세션 (전투 / 맵 전환 / 세이브)
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence", "playtest-rm2003");
const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
const DEV_KEY = "oprn:dev-project:127.0.0.1/?devProject=1";
const URL = "http://127.0.0.1:5199/?devProject=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freshGame(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v); for (let i = 1; i <= 3; i++) localStorage.removeItem("oprn:save-slot:" + i); }, [DEV_KEY, PROJECT_JSON]);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1200);
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Enter");
    let ok = false;
    for (let j = 0; j < 10; j++) {
      await sleep(500);
      const ready = await page.evaluate(() => {
        const sp = window.__oprnCharacterSprites?.();
        return !!(window.__oprnDebug?.readState() && sp && Object.keys(sp.events ?? {}).length > 0);
      });
      if (ready) { ok = true; break; }
    }
    if (ok) break;
  }
  await sleep(800);
  return page;
}
const helpers = (page) => ({
  shot: async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); },
  key: async (k, t = 1, d = 450) => { for (let i = 0; i < t; i++) { await page.keyboard.press(k); await sleep(d); } },
  teleport: async (m, x, y) => {
    for (let i = 0; i < 4; i++) {
      await page.evaluate(([a, b, c]) => window.__oprnDebug?.teleport(a, b, c), [m, x, y]);
      await sleep(500);
      const st = await page.evaluate(() => window.__oprnDebug?.readState());
      if (st && st.currentMapId === m && st.x === x && st.y === y) return true;
      await sleep(400);
    }
    console.log("TELEPORT UNSTABLE:", m, x, y);
    return false;
  },
  action: () => page.evaluate(() => window.__oprnInput?.action()),
  face: async (d) => { await page.evaluate((x) => window.__oprnInput?.dir(x), d); await sleep(120); await page.evaluate(() => window.__oprnInput?.dir(null)); await sleep(250); },
  mapId: () => page.evaluate(() => window.__oprnDebug?.readState()?.currentMapId),
  setSwitch: (id, v) => page.evaluate(([a, b]) => window.__oprnDebug?.setSwitch(a, b), [id, v]),
  spriteTile: (id) => page.evaluate((e) => { const s = window.__oprnCharacterSprites?.().events?.[e]; return s ? { x: Math.floor(s.x / 16), y: Math.floor(s.y / 16) } : null; }, id),
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });

  // ── 비트 1: 맵 전환 (동문) ──
  {
    const page = await freshGame(browser); const h = helpers(page);
    await h.teleport("map_ember_village", 29, 12); await sleep(450);
    await h.face("right"); await h.action(); await sleep(500);
    await h.shot("70-gate-closed-dialog"); // 퀘스트 게이팅 대사 (파수꾼)
    await h.key("Enter", 2, 500);
    await h.setSwitch("sw_ember_q1_started", true); await sleep(200);
    await page.keyboard.down("ArrowRight"); await sleep(500); await h.shot("71-transfer-fade");
    await sleep(1000); await page.keyboard.up("ArrowRight"); await sleep(1500);
    await h.shot("72-after-transfer");
    console.log("map after gate:", await h.mapId());
    await page.context().close();
  }

  // ── 비트 2: 전투 (숲 슬라임) ──
  {
    const page = await freshGame(browser); const h = helpers(page);
    // 성문을 통해 정상 전이 (인터프리터 경유가 씬 재구축을 보장)
    await h.setSwitch("sw_ember_q1_started", true); await sleep(200);
    await h.teleport("map_ember_village", 29, 12); await sleep(450);
    await page.keyboard.down("ArrowRight"); await sleep(1200); await page.keyboard.up("ArrowRight"); await sleep(2000);
    console.log("map:", await h.mapId());
    let t = null;
    for (let i = 0; i < 20 && !t; i++) { t = await h.spriteTile("ev_forest_slime"); if (!t) await sleep(400); }
    console.log("slime tile:", JSON.stringify(t));
    if (t) {
      const tries = [[t.x, t.y + 1, "up"], [t.x, t.y - 1, "down"], [t.x - 1, t.y, "right"], [t.x + 1, t.y, "left"]];
      for (const [px, py, dir] of tries) {
        await h.teleport("map_mist_forest", px, py); await sleep(450);
        await h.face(dir); await h.action(); await sleep(900);
        if (await page.evaluate(() => !!document.querySelector(".dialogue-overlay"))) { console.log("slime dialogue via", dir); break; }
      }
      await h.shot("73-battle-intro");
      await h.key("Enter", 3, 800);
      const started = await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15000 }).then(() => true).catch(() => false);
      console.log("battle started:", started);
      await sleep(1500); await h.shot("74-battle-field");
      await sleep(2000); await h.shot("75-battle-commands");
      const atk = page.locator('[data-testid="actor-command-attack"]');
      for (let r = 0; r < 8; r++) {
        if (!(await page.locator('[data-testid="battle-scene"]').isVisible().catch(() => false))) break;
        try {
          await atk.waitFor({ state: "visible", timeout: 7000 });
          await atk.click({ force: true }); await sleep(500);
          if (r === 0) await h.shot("76-battle-target");
          const enemy = page.locator('[data-testid^="battle-enemy"]').first();
          if (await enemy.isVisible().catch(() => false)) await enemy.click({ force: true });
          else await page.keyboard.press("Enter");
          await sleep(1800);
          if (r === 0) await h.shot("77-battle-after-attack");
        } catch { break; }
      }
      await sleep(1500); await h.shot("78-battle-result");
      await h.key("Enter", 2, 800); await h.shot("79-post-battle");
    }
    await page.context().close();
  }

  // ── 비트 3: 세이브 화면 ──
  {
    const page = await freshGame(browser); const h = helpers(page);
    await h.key("Escape", 1, 800);
    await h.key("ArrowDown", 3, 300);
    await h.key("Enter", 1, 800); await h.shot("80-save-screen");
    await h.key("Enter", 1, 900); await h.shot("81-save-done");
    await page.context().close();
  }

  console.log("done");
  await browser.close();
})().catch((e) => { console.error("DRIVER FAIL:", String(e).slice(0, 300)); process.exit(1); });
