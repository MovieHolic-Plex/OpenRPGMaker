// 드라이버 v6 — 워프(세이브 조작+로드) + 검증된 상호작용으로 상점/여관/성문/전투 수집
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence", "playtest-rm2003");
const URL = "http://127.0.0.1:5199/?devProject=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
  await page.addInitScript((json) => {
    for (let i = 1; i <= 3; i++) {
      localStorage.removeItem("oprn:save-slot:v5:" + i);
      localStorage.removeItem("oprn:save-slot:" + i);
    }
    window.__RPG_ZZU_E2E_PROJECT__ = JSON.parse(json);
  }, PROJECT_JSON);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  let ready = false;
  for (let i = 0; i < 8 && !ready; i++) {
    await page.keyboard.press("Enter");
    for (let j = 0; j < 8; j++) { await sleep(500); if (await page.evaluate(() => !!(window.__oprnPlayerSprite?.() && window.__oprnCharacterSprites?.()))) { ready = true; break; } }
  }
  console.log("ready:", ready);

  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };
  const key = async (k, t = 1, d = 500) => { for (let i = 0; i < t; i++) { await page.keyboard.press(k); await sleep(d); } };
  const tileOf = (px) => ({ x: Math.floor(px.x / 16), y: Math.floor(px.y / 16) - 1 });
  const playerTile = async () => { const s = await page.evaluate(() => window.__oprnPlayerSprite?.()); return s ? tileOf(s) : null; };
  const evTile = async (id) => { const s = await page.evaluate((e) => window.__oprnCharacterSprites?.()?.events?.[e], id); return s ? tileOf(s) : null; };
  const dlg = () => page.evaluate(() => !!document.querySelector(".dialogue-box"));
  const isAdj = (a, b) => a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const mapId = () => page.evaluate(() => window.__oprnDebug?.readState()?.currentMapId);
  const setSwitch = (id, v) => page.evaluate(([a, b]) => window.__oprnDebug?.setSwitch(a, b), [id, v]);
  const clickPlay = async (sel) => page.evaluate((q) => { const root = document.querySelector('[data-testid="test-play-window"]') ?? document; const el = q.startsWith("#") ? root.querySelector(`[data-testid="${q.slice(1)}"]`) : [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === q); if (el) el.click(); return !!el; }, sel);

  const drainDialogue = async () => { for (let i = 0; i < 10; i++) { if (!(await dlg())) return; await page.keyboard.press("Enter"); await sleep(500); } };
  const warpVia = async (m, x, y) => {
    await drainDialogue();
    await page.keyboard.down("ArrowDown"); await sleep(260); await page.keyboard.up("ArrowDown"); await sleep(250); // NPC 정면에서 물러나기
    await drainDialogue();
    let menuOpen = false;
    for (let i = 0; i < 5 && !menuOpen; i++) {
      await key("Escape", 1, 900);
      menuOpen = await clickPlay("저장");
      if (!menuOpen) { await key("Enter", 1, 500); await drainDialogue(); }
    }
    if (!menuOpen) { console.log("NO SAVE BTN"); return false; }
    await sleep(700);
    await page.evaluate(async () => {
      const { armSaveWriteSignal } = await import("/test/e2e/saveWriteSignal.ts");
      const { saveSlotKey } = await import("/src/player/saveSlots.ts");
      armSaveWriteSignal(saveSlotKey(1));
    });
    try {
      if (!(await clickPlay("#save-slot-1"))) await page.keyboard.press("Enter");
      const outcome = await page.evaluate(() => window.__saveWriteSignal.completion);
      if (outcome !== "written") throw new Error(`Save write failed: ${outcome}`);
    } finally {
      await page.evaluate(() => window.__saveWriteSignal.dispose());
    }
    const okSave = await page.evaluate(async () => {
      const { readSaveSlot, saveSlotKey } = await import("/src/player/saveSlots.ts");
      const text = localStorage.getItem(saveSlotKey(1));
      let snapshot;
      try { snapshot = JSON.parse(text ?? "null"); } catch { return false; }
      return snapshot?.schemaVersion === 5 && readSaveSlot(localStorage, 1).kind === "present";
    });
    if (!okSave) { console.log("SAVE FAILED"); return false; }
    await page.evaluate(async ([mm, px, py]) => {
      const { readSaveSlot, saveSlotKey } = await import("/src/player/saveSlots.ts");
      const key = saveSlotKey(1);
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (raw?.schemaVersion !== 5 || readSaveSlot(localStorage, 1).kind !== "present") throw new Error("Current save slot is missing or invalid");
      raw.session.currentMapId = mm; raw.session.x = px; raw.session.y = py;
      localStorage.setItem(key, JSON.stringify(raw));
    }, [m, x, y]);
    await key("Escape", 1, 700);
    if (!(await clickPlay("로드"))) { await key("Escape", 1, 600); await clickPlay("로드"); }
    await sleep(700);
    if (!(await clickPlay("#load-slot-1"))) await key("Enter", 1, 1000);
    await sleep(1100);
    await key("Enter", 1, 700);
    for (let i = 0; i < 14; i++) {
      const t = await playerTile(); const st = await mapId();
      if (st === m && t && Math.abs(t.x - x) <= 1 && Math.abs(t.y - y) <= 1) { console.log("WARP OK", m, x, y); return true; }
      await sleep(500);
    }
    console.log("WARP FAIL", m, x, y, JSON.stringify(await playerTile()), await mapId());
    return false;
  };
  const walkAdj = async (id, maxSteps = 20) => {
    for (let i = 0; i < maxSteps; i++) {
      const p = await playerTile(); const c = await evTile(id);
      if (!p || !c) { await sleep(400); continue; }
      if (isAdj(p, c)) return true;
      let k = null;
      if (p.x < c.x) k = "ArrowRight"; else if (p.x > c.x) k = "ArrowLeft";
      else if (p.y < c.y) k = "ArrowDown"; else if (p.y > c.y) k = "ArrowUp";
      if (!k) return true;
      await page.keyboard.down(k); await sleep(230); await page.keyboard.up(k); await sleep(220);
    }
    return false;
  };
  const interact = async (id) => {
    await walkAdj(id);
    const p = await playerTile(); const c = await evTile(id);
    if (!p || !c || !isAdj(p, c)) { console.log("ADJ FAIL", id, JSON.stringify(p), JSON.stringify(c)); return false; }
    const fk = c.x > p.x ? "ArrowRight" : c.x < p.x ? "ArrowLeft" : c.y > p.y ? "ArrowDown" : "ArrowUp";
    await key(fk, 1, 350);
    await page.keyboard.press("Space"); await sleep(1100);
    const opened = await dlg();
    console.log("interact", id, opened);
    return opened;
  };

  // ── 상점 ──
  const shopT = await evTile("ev_ember_shop");
  if (shopT) {
    await warpVia("map_ember_village", shopT.x, shopT.y + 1);
    await interact("ev_ember_shop");
    await shot("150-shop-greet"); await key("Enter", 1, 900); await shot("151-shop-menu");
    await key("Enter", 1, 1000); await shot("152-shop-buy-list");
    await key("ArrowDown", 1, 400); await shot("153-shop-row2");
    await key("Escape", 2, 500); await key("Enter", 2, 400); await key("Escape", 2, 400);
  }

  // ── 여관 ──
  const innT = await evTile("ev_ember_inn");
  if (innT) {
    await warpVia("map_ember_village", innT.x, innT.y + 1);
    await interact("ev_ember_inn");
    await shot("154-inn-greet"); await key("Enter", 1, 900); await shot("155-inn-choice");
    await key("Enter", 1, 1000); await shot("156-inn-fade");
    await sleep(1800); await key("Enter", 3, 550); await shot("157-inn-after");
  }

  // ── 성문 전이 ──
  await setSwitch("sw_ember_q1_started", true);
  const gateT = { x: 30, y: 12 }; // 픽스처 좌표 (투명 이벤트 — 스프라이트 없음)
  console.log("gate tile:", JSON.stringify(gateT));
  {
    await warpVia("map_ember_village", gateT.x - 1, gateT.y);
    await page.keyboard.down("ArrowRight"); await sleep(380); await shot("158-transfer-fade");
    await sleep(900); await page.keyboard.up("ArrowRight"); await sleep(1800);
    await shot("159-forest-arrival");
    console.log("map:", await mapId());
  }

  // ── 전투 ──
  if ((await mapId()) !== "map_mist_forest") {
    // 전이 실패 시 워프로 직접 (숲 입구 근처)
    await warpVia("map_mist_forest", 3, 14);
  }
  let slimeT = null;
  for (let i = 0; i < 15 && !slimeT; i++) { slimeT = await evTile("ev_forest_slime"); if (!slimeT) await sleep(500); }
  console.log("slime:", JSON.stringify(slimeT));
  if (slimeT) {
    await warpVia("map_mist_forest", slimeT.x, slimeT.y + 1);
    await interact("ev_forest_slime");
    await shot("160-battle-intro");
    await key("Enter", 3, 800);
    const started = await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15000 }).then(() => true).catch(() => false);
    console.log("battle started:", started);
    await sleep(1300); await shot("161-battle-field");
    await sleep(2200); await shot("162-battle-commands");
    const atk = page.locator('[data-testid="actor-command-attack"]');
    for (let r = 0; r < 8; r++) {
      if (!(await page.locator('[data-testid="battle-scene"]').isVisible().catch(() => false))) break;
      try {
        await atk.waitFor({ state: "visible", timeout: 7000 });
        await atk.click({ force: true }); await sleep(500);
        if (r === 0) await shot("163-battle-target");
        const enemy = page.locator('[data-testid^="battle-enemy"]').first();
        if (await enemy.isVisible().catch(() => false)) await enemy.click({ force: true });
        else await page.keyboard.press("Enter");
        await sleep(1900);
        if (r === 0) await shot("164-battle-after-attack");
      } catch { break; }
    }
    await sleep(1500); await shot("165-battle-result");
    await key("Enter", 2, 800); await shot("166-post-battle");
  }

  console.log("done");
  await browser.close();
})().catch((e) => { console.error("DRIVER FAIL:", String(e).slice(0, 300)); process.exit(1); });
