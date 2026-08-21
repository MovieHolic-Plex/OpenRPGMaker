// 성문 playerTouch 전이 실기 검증 (감독 직접 확인용, 저장/로드 없이 라이브 세션에서)
// phase1: 스위치 ON(로드 전 = 라이브 훅) → (29,12)→(30,12) 도보 진입 → 전이 여부
// phase2: 인게임 저장+로드 후 setSwitch → 동일 도보 → 스테일 훅 아티팩트 재현 확인
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence", "uiux-wave");
const URL = "http://127.0.0.1:5251/?devProject=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
  await page.addInitScript((json) => {
    for (let i = 1; i <= 3; i++) localStorage.removeItem("oprn:save-slot:" + i);
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
    for (let j = 0; j < 8; j++) { await sleep(500); if (await page.evaluate(() => !!(window.__rpgzzuPlayerSprite?.() && window.__rpgzzuCharacterSprites?.()))) { ready = true; break; } }
  }
  console.log("ready:", ready);
  return page;
}

const tileOf = (px) => ({ x: Math.floor(px.x / 16), y: Math.floor(px.y / 16) - 1 });

async function walkTo(page, tx, ty, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const s = await page.evaluate(() => window.__rpgzzuPlayerSprite?.());
    if (!s) { await sleep(400); continue; }
    const p = tileOf(s);
    if (p.x === tx && p.y === ty) return true;
    let k = null;
    if (p.y > ty) k = "ArrowUp"; else if (p.y < ty) k = "ArrowDown";
    else if (p.x < tx) k = "ArrowRight"; else if (p.x > tx) k = "ArrowLeft";
    if (!k) return true;
    await page.keyboard.down(k); await sleep(230); await page.keyboard.up(k); await sleep(240);
  }
  return false;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });

  // ── phase 1: 라이브 세션 (로드 없음) ──
  let page = await boot(browser);
  await page.evaluate(() => window.__rpgzzuDebug?.setSwitch("sw_ember_q1_started", true));
  const sw1 = await page.evaluate(() => window.__rpgzzuDebug?.readState()?.switches?.sw_ember_q1_started);
  console.log("phase1 switch on (live):", sw1);
  const arrived = await walkTo(page, 29, 12);
  console.log("phase1 at (29,12):", arrived, JSON.stringify(tileOf(await page.evaluate(() => window.__rpgzzuPlayerSprite?.()))));
  await page.screenshot({ path: path.join(OUT, "gate-p1-before.png") });
  await page.keyboard.down("ArrowRight"); await sleep(300); await page.keyboard.up("ArrowRight");
  await sleep(2500);
  const map1 = await page.evaluate(() => window.__rpgzzuDebug?.readState()?.currentMapId);
  const dlg1 = await page.evaluate(() => !!document.querySelector(".dialogue-box"));
  await page.screenshot({ path: path.join(OUT, "gate-p1-after.png") });
  console.log("phase1 result — map:", map1, "dialogue:", dlg1);
  await page.context().close();

  // ── phase 2: 인게임 저장+로드 후 setSwitch (스테일 훅 아티팩트 재현) ──
  page = await boot(browser);
  // 메뉴 열고 저장 → 슬롯1 → 메뉴 → 로드 → 슬롯1
  const clickBtn = async (label) => page.evaluate((q) => { const root = document.querySelector('[data-testid="test-play-window"]') ?? document; const el = q.startsWith("#") ? root.querySelector(`[data-testid="${q.slice(1)}"]`) : [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === q); if (el) el.click(); return !!el; }, label);
  await page.keyboard.press("Escape"); await sleep(900);
  await clickBtn("저장"); await sleep(700);
  await clickBtn("#save-slot-1"); await sleep(900);
  const saved = await page.evaluate(() => !!localStorage.getItem("oprn:save-slot:1"));
  console.log("phase2 saved:", saved);
  await page.keyboard.press("Escape"); await sleep(700);
  await clickBtn("로드"); await sleep(700);
  await clickBtn("#load-slot-1"); await sleep(1400);
  await page.keyboard.press("Enter"); await sleep(700);
  await page.evaluate(() => window.__rpgzzuDebug?.setSwitch("sw_ember_q1_started", true));
  const sw2hook = await page.evaluate(() => window.__rpgzzuDebug?.readState()?.switches?.sw_ember_q1_started);
  const sw2json = await page.evaluate(() => { const t = document.querySelector('[data-testid="runtime-state-json"]')?.textContent; return t ? JSON.parse(t)?.switches?.sw_ember_q1_started : "no-json"; });
  console.log("phase2 switch — hook:", sw2hook, "| runtime-state-json:", sw2json);
  const arrived2 = await walkTo(page, 29, 12);
  console.log("phase2 at (29,12):", arrived2);
  await page.keyboard.down("ArrowRight"); await sleep(300); await page.keyboard.up("ArrowRight");
  await sleep(2500);
  const map2 = await page.evaluate(() => window.__rpgzzuDebug?.readState()?.currentMapId);
  const dlg2 = await page.evaluate(() => !!document.querySelector(".dialogue-box"));
  const dlgText = dlg2 ? await page.evaluate(() => document.querySelector(".dialogue-box")?.textContent?.slice(0, 60)) : "";
  await page.screenshot({ path: path.join(OUT, "gate-p2-after.png") });
  console.log("phase2 result — map(hook):", map2, "dialogue:", dlg2, dlgText);

  await browser.close();
})().catch((e) => { console.error("VERIFY FAIL:", String(e).slice(0, 400)); process.exit(1); });
