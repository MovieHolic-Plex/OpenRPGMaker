// 풀스크린 테스트플레이 스케일 전/후 증거 — Alt+Enter 토글 후 스크린샷 + 메트릭 로그
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const MODE = process.argv[2] || "after";
const PORT = process.argv[3] || "5251";
const OUT = path.join(__dirname, "..", "evidence", "uiux-wave", MODE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
  await page.addInitScript((json) => {
    for (let i = 1; i <= 3; i++) localStorage.removeItem("oprn:save-slot:" + i);
    window.__RPG_ZZU_E2E_PROJECT__ = JSON.parse(json);
  }, PROJECT_JSON);
  await page.goto(`http://127.0.0.1:${PORT}/?devProject=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Enter");
    await sleep(700);
    if (await page.evaluate(() => !!window.__rpgzzuPlayerSprite?.())) break;
  }
  // 풀스크린 토글 (Alt+Enter)
  await page.keyboard.press("Alt+Enter");
  await sleep(1200);
  const metrics = await page.evaluate(() => {
    const vp = document.querySelector('[data-testid="play-viewport"]');
    const st = document.querySelector('[data-testid="play-stage"]');
    const vb = vp?.getBoundingClientRect(); const sb = st?.getBoundingClientRect();
    return { scale: vp?.dataset?.scale, viewport: vb ? { w: Math.round(vb.width), h: Math.round(vb.height) } : null, stage: sb ? { w: Math.round(sb.width), h: Math.round(sb.height) } : null, mode: document.querySelector('[data-testid="test-play-window"]')?.dataset?.windowMode };
  });
  console.log("fullscreen metrics:", JSON.stringify(metrics));
  await page.screenshot({ path: path.join(OUT, "09-fullscreen-scale-1720x960.png") });
  console.log("shot: 09-fullscreen-scale-1720x960");
  await browser.close();
})().catch((e) => { console.error("CAPTURE FAIL:", String(e).slice(0, 300)); process.exit(1); });
