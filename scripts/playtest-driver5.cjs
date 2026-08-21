// 드라이버 v5 (최종) — 검증된 패턴: 라이브 좌표 걷기 + NPC 방향 바라보기 + Space 조사
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
  await page.addInitScript(() => { for (let i = 1; i <= 3; i++) localStorage.removeItem("oprn:save-slot:" + i); });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  let ready = false;
  for (let i = 0; i < 8 && !ready; i++) {
    await page.keyboard.press("Enter");
    for (let j = 0; j < 8; j++) { await sleep(500); if (await page.evaluate(() => !!(window.__rpgzzuPlayerSprite?.() && window.__rpgzzuCharacterSprites?.()))) { ready = true; break; } }
  }
  console.log("ready:", ready);

  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };
  const key = async (k, t = 1, d = 500) => { for (let i = 0; i < t; i++) { await page.keyboard.press(k); await sleep(d); } };
  const tileOf = (px) => ({ x: Math.floor(px.x / 16), y: Math.floor(px.y / 16) - 1 });
  const playerTile = async () => { const s = await page.evaluate(() => window.__rpgzzuPlayerSprite?.()); return s ? tileOf(s) : null; };
  const evTile = async (id) => { const s = await page.evaluate((e) => window.__rpgzzuCharacterSprites?.()?.events?.[e], id); return s ? tileOf(s) : null; };
  const dlg = () => page.evaluate(() => !!document.querySelector(".dialogue-box"));
  const isAdj = (a, b) => a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

  const walkAdj = async (getTarget, maxSteps = 40) => {
    for (let i = 0; i < maxSteps; i++) {
      const p = await playerTile(); const c = await getTarget();
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
    const ok = await walkAdj(() => evTile(id));
    const p = await playerTile(); const c = await evTile(id);
    if (!ok || !p || !c) { console.log("INTERACT WALK FAIL", id); return false; }
    const fk = c.x > p.x ? "ArrowRight" : c.x < p.x ? "ArrowLeft" : c.y > p.y ? "ArrowDown" : "ArrowUp";
    await key(fk, 1, 350);
    await page.keyboard.press("Space"); await sleep(1100);
    const opened = await dlg();
    console.log("interact", id, opened);
    return opened;
  };

  // ── A. 촌장: 대화 + 선택지 + 수락 (Q1 시작 → 성문 열림) ──
  await interact("ev_ember_chief");
  await shot("120-dialogue-1");
  await key("Enter", 1, 800); await shot("121-dialogue-2");
  await key("Enter", 1, 900); await shot("122-choices");
  await key("Enter", 1, 900); await shot("123-choice-accepted");
  await key("Enter", 6, 450);

  // ── B. 상점 ──
  await interact("ev_ember_shop");
  await shot("124-shop-greet"); await key("Enter", 1, 900); await shot("125-shop-menu");
  await key("Enter", 1, 900); await shot("126-shop-buy-list");
  await key("ArrowDown", 1, 350); await shot("127-shop-cursor");
  await key("Escape", 2, 500); await key("Enter", 1, 500); await key("Escape", 2, 400); await key("Enter", 3, 350);

  // ── C. 여관 ──
  await interact("ev_ember_inn");
  await shot("128-inn-greet"); await key("Enter", 1, 900); await shot("129-inn-choice");
  await key("Enter", 1, 1000); await shot("130-inn-fade");
  await sleep(1800); await key("Enter", 3, 550); await shot("131-inn-after");

  // ── D. 성문 → 숲 전이 ──
  const before = await page.evaluate(() => window.__rpgzzuDebug?.readState()?.currentMapId);
  const gateWalk = await walkAdj(() => evTile("ev_ember_gate_a"));
  console.log("gate adj:", gateWalk);
  // 성문 방향으로 한 걸음 더(playerTouch)
  const p0 = await playerTile(); const g0 = await evTile("ev_ember_gate_a");
  if (p0 && g0) {
    const fk = g0.x > p0.x ? "ArrowRight" : g0.x < p0.x ? "ArrowLeft" : g0.y > p0.y ? "ArrowDown" : "ArrowUp";
    await page.keyboard.down(fk); await sleep(350); await shot("132-transfer-fade"); await sleep(600); await page.keyboard.up(fk);
  }
  await sleep(1800); await shot("133-forest-arrival");
  console.log("map:", before, "→", await page.evaluate(() => window.__rpgzzuDebug?.readState()?.currentMapId));

  // ── E. 슬라임 전투 ──
  await interact("ev_forest_slime");
  await shot("134-battle-intro");
  await key("Enter", 3, 800);
  const started = await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15000 }).then(() => true).catch(() => false);
  console.log("battle started:", started);
  await sleep(1300); await shot("135-battle-field");
  await sleep(2200); await shot("136-battle-commands");
  const atk = page.locator('[data-testid="actor-command-attack"]');
  for (let r = 0; r < 8; r++) {
    if (!(await page.locator('[data-testid="battle-scene"]').isVisible().catch(() => false))) break;
    try {
      await atk.waitFor({ state: "visible", timeout: 7000 });
      await atk.click({ force: true }); await sleep(500);
      if (r === 0) await shot("137-battle-target");
      const enemy = page.locator('[data-testid^="battle-enemy"]').first();
      if (await enemy.isVisible().catch(() => false)) await enemy.click({ force: true });
      else await page.keyboard.press("Enter");
      await sleep(1900);
      if (r === 0) await shot("138-battle-after-attack");
    } catch { break; }
  }
  await sleep(1500); await shot("139-battle-result");
  await key("Enter", 2, 800); await shot("140-post-battle");

  console.log("done");
  await browser.close();
})().catch((e) => { console.error("DRIVER FAIL:", String(e).slice(0, 300)); process.exit(1); });
