// 드라이버 v4 — 세이브 조작 + 인게임 로드로 씬을 목표 좌표에 재구축한 뒤 실제 키 입력으로 플레이
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence", "playtest-rm2003");
const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
const DEV_KEY = "rpg-zzu:dev-project:127.0.0.1/?devProject=1";
const URL = "http://127.0.0.1:5199/?devProject=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freshGame(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v); for (let i = 1; i <= 3; i++) localStorage.removeItem("rpg-zzu:save-slot:" + i); }, [DEV_KEY, PROJECT_JSON]);
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
      if (await page.evaluate(() => { const sp = window.__rpgzzuCharacterSprites?.(); return !!(window.__rpgzzuDebug?.readState() && sp && Object.keys(sp.events ?? {}).length > 0); })) { ok = true; break; }
    }
    if (ok) break;
  }
  await sleep(800);
  return page;
}

function makeHelpers(page) {
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };
  const key = async (k, t = 1, d = 450) => { for (let i = 0; i < t; i++) { await page.keyboard.press(k); await sleep(d); } };
  const playerTile = () => page.evaluate(() => { const s = window.__rpgzzuPlayerSprite?.(); return s ? { x: Math.floor(s.x / 16), y: Math.floor(s.y / 16) - 1 } : null; });
  const spriteTile = (id) => page.evaluate((e) => { const s = window.__rpgzzuCharacterSprites?.().events?.[e]; return s ? { x: Math.floor(s.x / 16), y: Math.floor(s.y / 16) - 1 } : null; }, id);
  const realDialogue = () => page.evaluate(() => !!document.querySelector(".dialogue-box"));
  // 세이브 슬롯1 생성 → JSON 조작 → 인게임 로드로 씬 재배치
  const clickTestId = async (tid) => page.evaluate((t) => {
    const root = document.querySelector('[data-testid="test-play-window"]') ?? document;
    const el = root.querySelector(`[data-testid="${t}"]`);
    if (el) el.click();
    return !!el;
  }, tid);
  const clickMenuText = async (label) => page.evaluate((t) => {
    const root = document.querySelector('[data-testid="test-play-window"]') ?? document;
    const btn = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === t);
    if (btn) btn.click();
    return !!btn;
  }, label);
  const warpVia = async (mapId, x, y, switches = {}) => {
    await key("Escape", 1, 900);
    if (!(await clickMenuText("저장"))) console.log("NO SAVE BUTTON");
    await sleep(700);
    if (!(await clickTestId("save-slot-1"))) await key("Enter", 1, 900);
    await sleep(800);
    const okSave = await page.evaluate(() => !!localStorage.getItem("rpg-zzu:save-slot:1"));
    if (!okSave) { console.log("SAVE FAILED"); return false; }
    await page.evaluate(([m, px, py, sw]) => {
      const raw = JSON.parse(localStorage.getItem("rpg-zzu:save-slot:1"));
      const sess = raw.session ?? raw.snapshot?.session ?? raw;
      sess.currentMapId = m; sess.x = px; sess.y = py;
      for (const [k, v] of Object.entries(sw)) sess.switches[k] = v;
      localStorage.setItem("rpg-zzu:save-slot:1", JSON.stringify(raw));
    }, [mapId, x, y, switches]);
    await key("Escape", 1, 700);
    if (!(await clickMenuText("로드"))) { await key("Escape", 1, 600); await clickMenuText("로드"); }
    await sleep(700);
    if (!(await clickTestId("load-slot-1"))) await key("Enter", 1, 1000);
    await sleep(1000);
    await key("Enter", 1, 800);      // 확인(있다면)
    for (let i = 0; i < 15; i++) {
      const t = await playerTile(); const st = await page.evaluate(() => window.__rpgzzuDebug?.readState()?.currentMapId);
      if (st === mapId && t && Math.abs(t.x - x) <= 1 && Math.abs(t.y - y) <= 1) { console.log("WARP OK", mapId, JSON.stringify(t)); return true; }
      await sleep(500);
    }
    console.log("WARP FAILED", mapId, x, y, JSON.stringify(await playerTile()));
    return false;
  };
  // 목표 인접 칸까지 실제 걷기(단순 L자: x 먼저, y 다음) 후 방향 보고 조사
  const walkTo = async (tx, ty, maxSteps = 24) => {
    for (let i = 0; i < maxSteps; i++) {
      const t = await playerTile();
      if (!t) return false;
      if (t.x === tx && t.y === ty) return true;
      let k = null;
      if (t.x < tx) k = "ArrowRight"; else if (t.x > tx) k = "ArrowLeft";
      else if (t.y < ty) k = "ArrowDown"; else if (t.y > ty) k = "ArrowUp";
      if (!k) return true;
      await page.keyboard.down(k); await sleep(230); await page.keyboard.up(k); await sleep(180);
    }
    return false;
  };
  const interactNpc = async (eventId) => {
    const ev = await spriteTile(eventId);
    if (!ev) { console.log("NO SPRITE:", eventId); return false; }
    if (!(await walkTo(ev.x, ev.y + 1))) console.log("walk imperfect", eventId);
    await page.evaluate(() => window.__rpgzzuInput?.dir("up")); await sleep(130);
    await page.evaluate(() => window.__rpgzzuInput?.dir(null)); await sleep(300);
    await page.evaluate(() => window.__rpgzzuInput?.action()); await sleep(1000);
    let ok = await realDialogue();
    if (!ok) { await page.keyboard.press("Space"); await sleep(900); ok = await realDialogue(); }
    console.log("dialogue:", eventId, ok);
    return ok;
  };
  return { shot, key, playerTile, spriteTile, realDialogue, warpVia, walkTo, interactNpc };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });

  // ── 비트 A: 촌장 대화 + 선택지 ──
  {
    const page = await freshGame(browser); const h = makeHelpers(page);
    await h.warpVia("map_ember_village", 18, 12);
    await h.interactNpc("ev_ember_chief");
    await h.shot("90-dialogue-1");
    await h.key("Enter", 1, 800); await h.shot("91-dialogue-2");
    await h.key("Enter", 1, 900); await h.shot("92-choices");
    await h.key("Enter", 1, 900); await h.shot("93-after-choice");
    await page.context().close();
  }

  // ── 비트 B: 상점 ──
  {
    const page = await freshGame(browser); const h = makeHelpers(page);
    await h.warpVia("map_ember_village", 14, 12);
    await h.interactNpc("ev_ember_shop");
    await h.shot("94-shop-1"); await h.key("Enter", 1, 900); await h.shot("95-shop-2");
    await h.key("Enter", 1, 900); await h.shot("96-shop-buy");
    await h.key("ArrowDown", 1, 350); await h.shot("97-shop-cursor");
    await h.key("Enter", 1, 900); await h.shot("98-shop-confirm");
    await page.context().close();
  }

  // ── 비트 C: 여관 ──
  {
    const page = await freshGame(browser); const h = makeHelpers(page);
    await h.warpVia("map_ember_village", 6, 12);
    await h.interactNpc("ev_ember_inn");
    await h.shot("99-inn-1"); await h.key("Enter", 1, 900); await h.shot("100-inn-choice");
    await h.key("Enter", 1, 1100); await h.shot("101-inn-fade");
    await sleep(1800); await h.key("Enter", 2, 600); await h.shot("102-inn-after");
    await page.context().close();
  }

  // ── 비트 D: 성문 전이 (playerTouch) ──
  {
    const page = await freshGame(browser); const h = makeHelpers(page);
    await h.warpVia("map_ember_village", 28, 12, { sw_ember_q1_started: true });
    await page.keyboard.down("ArrowRight"); await sleep(520); await h.shot("103-transfer-fade");
    await sleep(1200); await page.keyboard.up("ArrowRight"); await sleep(1300);
    await h.shot("104-forest-arrival");
    console.log("map:", await page.evaluate(() => window.__rpgzzuDebug?.readState()?.currentMapId));
    await page.context().close();
  }

  // ── 비트 E: 전투 ──
  {
    const page = await freshGame(browser); const h = makeHelpers(page);
    await h.warpVia("map_mist_forest", 10, 16, { sw_ember_q1_started: true });
    await h.interactNpc("ev_forest_slime");
    await h.shot("105-battle-intro");
    await h.key("Enter", 3, 800);
    const started = await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15000 }).then(() => true).catch(() => false);
    console.log("battle started:", started);
    await sleep(1200); await h.shot("106-battle-field");
    await sleep(2200); await h.shot("107-battle-commands");
    const atk = page.locator('[data-testid="actor-command-attack"]');
    for (let r = 0; r < 8; r++) {
      if (!(await page.locator('[data-testid="battle-scene"]').isVisible().catch(() => false))) break;
      try {
        await atk.waitFor({ state: "visible", timeout: 7000 });
        await atk.click({ force: true }); await sleep(500);
        if (r === 0) await h.shot("108-battle-target");
        const enemy = page.locator('[data-testid^="battle-enemy"]').first();
        if (await enemy.isVisible().catch(() => false)) await enemy.click({ force: true });
        else await page.keyboard.press("Enter");
        await sleep(1800);
        if (r === 0) await h.shot("109-battle-after-attack");
      } catch { break; }
    }
    await sleep(1400); await h.shot("110-battle-result");
    await h.key("Enter", 2, 800); await h.shot("111-post-battle");
    await page.context().close();
  }

  console.log("done");
  await browser.close();
})().catch((e) => { console.error("DRIVER FAIL:", String(e).slice(0, 300)); process.exit(1); });
