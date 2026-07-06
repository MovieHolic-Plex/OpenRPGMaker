// UI/UX 웨이브 전/후 시각 증거 수집 — 타이틀/대화창/메뉴/상점/스케일
// 사용: node scripts/capture-uiux-evidence.cjs <before|after> [port]
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const MODE = process.argv[2] || "before";
const PORT = process.argv[3] || "5251";
const OUT = path.join(__dirname, "..", "evidence", "uiux-wave", MODE);
const URL = `http://127.0.0.1:${PORT}/?devProject=1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
  await page.addInitScript((json) => {
    for (let i = 1; i <= 3; i++) localStorage.removeItem("rpg-zzu:save-slot:" + i);
    window.__RPG_ZZU_E2E_PROJECT__ = JSON.parse(json);
  }, PROJECT_JSON);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };

  // 1) 타이틀 (풀 뷰포트 — 스케일/여백 증거 겸용)
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 }).catch(() => {});
  await shot("01-title-1720x960");

  // 시작
  let ready = false;
  for (let i = 0; i < 8 && !ready; i++) {
    await page.keyboard.press("Enter");
    for (let j = 0; j < 8; j++) { await sleep(500); if (await page.evaluate(() => !!(window.__rpgzzuPlayerSprite?.() && window.__rpgzzuCharacterSprites?.()))) { ready = true; break; } }
  }
  console.log("ready:", ready);
  await shot("02-field-1720x960");

  const tileOf = (px) => ({ x: Math.floor(px.x / 16), y: Math.floor(px.y / 16) - 1 });
  const playerTile = async () => { const s = await page.evaluate(() => window.__rpgzzuPlayerSprite?.()); return s ? tileOf(s) : null; };
  const evTile = async (id) => { const s = await page.evaluate((e) => window.__rpgzzuCharacterSprites?.()?.events?.[e], id); return s ? tileOf(s) : null; };
  const isAdj = (a, b) => a && b && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const key = async (k, t = 1, d = 500) => { for (let i = 0; i < t; i++) { await page.keyboard.press(k); await sleep(d); } };
  const walkAdj = async (id, maxSteps = 30) => {
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
    if (!p || !c || !isAdj(p, c)) { console.log("ADJ FAIL", id); return false; }
    const fk = c.x > p.x ? "ArrowRight" : c.x < p.x ? "ArrowLeft" : c.y > p.y ? "ArrowDown" : "ArrowUp";
    await key(fk, 1, 350);
    await page.keyboard.press("Space"); await sleep(1200);
    return page.evaluate(() => !!document.querySelector(".dialogue-box"));
  };

  // 2) 촌장 대화 — 페이지네이션/폰트/스킨 증거
  const opened = await interact("ev_ember_chief");
  console.log("chief dialogue:", opened);
  if (opened) {
    await sleep(2500); // 타이프라이터 완료 대기
    await shot("03-dialogue-page1");
    await key("Enter", 1, 800); await sleep(1800);
    await shot("04-dialogue-page2");
    for (let i = 0; i < 12; i++) {
      const hasChoice = await page.evaluate(() => !!document.querySelector('[data-testid="runtime-choices"]'));
      if (hasChoice) break;
      const hasDlg = await page.evaluate(() => !!document.querySelector(".dialogue-box"));
      if (!hasDlg) break;
      await key("Enter", 1, 900);
    }
    if (await page.evaluate(() => !!document.querySelector('[data-testid="runtime-choices"]'))) {
      await shot("05-choices");
      await key("Escape", 1, 500); await key("Enter", 1, 600);
    }
    for (let i = 0; i < 10; i++) { if (!(await page.evaluate(() => !!document.querySelector(".dialogue-box")))) break; await key("Enter", 1, 600); }
  }

  // 3) 메인 메뉴 — 폰트/스킨 증거
  await key("Escape", 1, 900);
  await shot("06-main-menu");
  await key("Escape", 1, 700);

  // 4) 상점 — 창 스킨 증거
  const shopOpened = await interact("ev_ember_shop");
  console.log("shop dialogue:", shopOpened);
  if (shopOpened) {
    await key("Enter", 1, 900);
    await shot("07-shop-menu");
    await key("Enter", 1, 1000);
    await shot("08-shop-buy-list");
    await key("Escape", 3, 500); await key("Enter", 2, 400); await key("Escape", 2, 400);
  }

  console.log("done:", OUT);
  await browser.close();
})().catch((e) => { console.error("CAPTURE FAIL:", String(e).slice(0, 300)); process.exit(1); });
