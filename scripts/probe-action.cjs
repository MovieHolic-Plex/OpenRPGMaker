// action-dialogue 회귀 판별 프로브: PORT와 FIXTURE를 인자로 받아 촌장 조사 시도
const { chromium } = require("@playwright/test");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2];
const FIXTURE = process.argv[3];
const SHOT = process.argv[4];
(async () => {
  const b = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const p = await (await b.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  const json = fs.readFileSync(FIXTURE, "utf8");
  const KEY = `rpg-zzu:dev-project:127.0.0.1/?devProject=1`;
  await p.addInitScript(([k, v]) => { localStorage.setItem(k, v); for (let i = 1; i <= 3; i++) localStorage.removeItem("rpg-zzu:save-slot:" + i); }, [KEY, json]);
  await p.goto(`http://127.0.0.1:${PORT}/?devProject=1`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1500);
  await p.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  // 게임 시작 확실히: Enter 반복 + 훅 폴링
  let ready = false;
  for (let i = 0; i < 8 && !ready; i++) {
    await p.keyboard.press("Enter");
    for (let j = 0; j < 8; j++) {
      await sleep(500);
      ready = await p.evaluate(() => !!(window.__rpgzzuPlayerSprite?.() && window.__rpgzzuCharacterSprites?.()?.events?.ev_ember_chief));
      if (ready) break;
    }
  }
  console.log("ready:", ready);
  const dump = () => p.evaluate(() => {
    const ps = window.__rpgzzuPlayerSprite?.(); const ev = window.__rpgzzuCharacterSprites?.()?.events?.ev_ember_chief;
    return { p: ps ? { x: Math.floor(ps.x / 16), y: Math.floor(ps.y / 16) - 1 } : null, c: ev ? { x: Math.floor(ev.x / 16), y: Math.floor(ev.y / 16) - 1 } : null, dlg: !!document.querySelector(".dialogue-box") };
  });
  let d = await dump();
  console.log("start:", JSON.stringify(d));
  for (let i = 0; i < 26; i++) {
    d = await dump();
    if (!d.p || !d.c) { await sleep(400); continue; }
    if (d.p.x === d.c.x && d.p.y === d.c.y + 1) break;
    let k = null;
    if (d.p.x < d.c.x) k = "ArrowRight"; else if (d.p.x > d.c.x) k = "ArrowLeft";
    else if (d.p.y < d.c.y + 1) k = "ArrowDown"; else if (d.p.y > d.c.y + 1) k = "ArrowUp";
    if (!k) break;
    await p.keyboard.down(k); await sleep(230); await p.keyboard.up(k); await sleep(220);
  }
  d = await dump();
  const adjacent = d.p && d.c && d.p.x === d.c.x && d.p.y === d.c.y + 1;
  console.log("adjacent:", adjacent, JSON.stringify(d));
  await p.keyboard.press("ArrowUp"); await sleep(350);
  await p.keyboard.press("Space"); await sleep(1200);
  d = await dump(); console.log("dlg after Space:", d.dlg);
  if (!d.dlg) { await p.evaluate(() => window.__rpgzzuInput?.action()); await sleep(1100); d = await dump(); console.log("dlg after hook:", d.dlg); }
  if (SHOT) await p.screenshot({ path: SHOT });
  console.log("VERDICT:", d.dlg ? "DIALOGUE WORKS" : "DIALOGUE BROKEN");
  await b.close();
})().catch((e) => { console.error("PROBE FAIL:", String(e).slice(0, 300)); process.exit(1); });
