// 플레이테스트 드라이버 v2 — 라이브 NPC 좌표 기반 상호작용 (랜덤 보행 대응)
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "evidence", "playtest-rm2003");
const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
const DEV_KEY = "rpg-zzu:dev-project:127.0.0.1/?devProject=1";
const URL = "http://127.0.0.1:5199/?devProject=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1720, height: 960 } })).newPage();
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };
  const key = async (k, t = 1, d = 400) => { for (let i = 0; i < t; i++) { await page.keyboard.press(k); await sleep(d); } };

  const readState = () => page.evaluate(() => window.__rpgzzuDebug?.readState() ?? null);
  const teleport = (m, x, y) => page.evaluate(([a, b, c]) => window.__rpgzzuDebug?.teleport(a, b, c), [m, x, y]);
  const action = () => page.evaluate(() => window.__rpgzzuInput?.action());
  const face = async (dir) => {
    await page.evaluate((d) => window.__rpgzzuInput?.dir(d), dir);
    await sleep(120);
    await page.evaluate(() => window.__rpgzzuInput?.dir(null));
    await sleep(250);
  };
  const dialogueOpen = () => page.evaluate(() => !!document.querySelector(".dialogue-overlay"));
  const dismissOverlays = async () => {
    for (let i = 0; i < 8; i++) {
      if (!(await dialogueOpen())) return;
      await page.keyboard.press("Enter"); await sleep(450);
    }
  };
  const waitHooks = async () => { for (let i = 0; i < 30; i++) { if (await readState()) return true; await sleep(400); } return false; };
  // NPC의 현재 타일(floor 기준)을 읽어 인접 4방향에서 조사 시도 — 대화창 열릴 때까지
  const interact = async (mapId, eventId) => {
    await waitHooks();
    await dismissOverlays();
    const st = await readState();
    if (!st || st.currentMapId !== mapId) {
      await teleport(mapId, 5, 5);
      for (let i = 0; i < 20; i++) { const s = await readState(); if (s && s.currentMapId === mapId) break; await sleep(400); }
      await sleep(800);
    }
    let ev = null;
    for (let i = 0; i < 20 && !ev; i++) {
      ev = await page.evaluate((id) => {
        const s = window.__rpgzzuCharacterSprites?.();
        return s?.events?.[id] ?? null;
      }, eventId);
      if (!ev) await sleep(400);
    }
    if (!ev) {
      const dbg = await page.evaluate(() => ({
        st: window.__rpgzzuDebug?.readState()?.currentMapId ?? null,
        keys: window.__rpgzzuCharacterSprites ? Object.keys(window.__rpgzzuCharacterSprites()?.events ?? {}) : "no-hook",
        overlay: !!document.querySelector(".dialogue-overlay"),
      }));
      console.log("NO SPRITE:", eventId, JSON.stringify(dbg).slice(0, 300));
      return false;
    }
    const tx = Math.floor(ev.x / 16);
    const ty = Math.floor(ev.y / 16);
    const tries = [[tx, ty + 1, "up"], [tx, ty - 1, "down"], [tx - 1, ty, "right"], [tx + 1, ty, "left"]];
    for (const [px, py, dir] of tries) {
      await teleport(mapId, px, py); await sleep(450);
      await face(dir);
      await action(); await sleep(900);
      if (await dialogueOpen()) { console.log("DIALOGUE OPEN via", dir, eventId); return true; }
    }
    console.log("INTERACT FAILED:", eventId);
    return false;
  };

  await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); for (let i = 1; i <= 3; i++) localStorage.removeItem('rpg-zzu:save-slot:' + i); } catch (e) {} }, [DEV_KEY, PROJECT_JSON]);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1200);
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Enter");
    let ok = false;
    for (let j = 0; j < 8; j++) { await sleep(500); if (await readState()) { ok = true; break; } }
    if (ok) break;
  }
  console.log("state:", JSON.stringify(await readState()));

  // ── A. 촌장 대화 + 선택지 ──
  await interact("map_ember_village", "ev_ember_chief");
  await shot("40-dialogue-open");
  await key("Enter", 1, 800); await shot("41-dialogue-2");
  await key("Enter", 1, 800); await shot("42-dialogue-3");
  await key("Enter", 1, 900); await shot("43-choices");
  await key("Enter", 1, 900); await shot("44-after-accept");
  await key("Enter", 5, 450);

  // ── B. 상점 ──
  await interact("map_ember_village", "ev_ember_shop");
  await shot("45-shop-1"); await key("Enter", 1, 900); await shot("46-shop-2");
  await key("Enter", 1, 900); await shot("47-shop-3");
  await key("ArrowDown", 1, 350); await shot("48-shop-cursor");
  await key("Enter", 1, 800); await shot("49-shop-qty-or-buy");
  await key("Escape", 3, 400); await key("Enter", 2, 400); await key("Escape", 2, 400);

  // ── C. 여관 ──
  await interact("map_ember_village", "ev_ember_inn");
  await shot("50-inn-1"); await key("Enter", 1, 900); await shot("51-inn-choice");
  await key("Enter", 1, 1400); await shot("52-inn-fade");
  await sleep(1600); await key("Enter", 2, 600); await shot("53-inn-done");

  // ── D. 맵 전환 연출 (동문 — 조사 트리거) ──
  await teleport("map_ember_village", 29, 12); await sleep(400);
  await face("right"); await action(); await sleep(600); await shot("54-transfer-dialog");
  await key("Enter", 2, 800); await sleep(1200); await shot("55-forest");
  console.log("state:", JSON.stringify((await readState())?.currentMapId));

  // ── E. 전투 (숲 슬라임 블로커) ──
  await interact("map_mist_forest", "ev_forest_slime");
  await shot("56-battle-intro-text");
  await key("Enter", 3, 700);
  await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 15000 }).catch(() => console.log("no battle-scene"));
  await sleep(1500); await shot("57-battle-field");
  await sleep(2500); await shot("58-battle-command-window");
  // 키보드로 전투 진행 시도 + 클릭 폴백
  const atk = page.locator('[data-testid="actor-command-attack"]');
  for (let r = 0; r < 8; r++) {
    const inBattle = await page.locator('[data-testid="battle-scene"]').isVisible().catch(() => false);
    if (!inBattle) break;
    try {
      await atk.waitFor({ state: "visible", timeout: 6000 });
      await atk.click({ force: true }); await sleep(600);
      if (r === 0) await shot("59-battle-target");
      const enemy = page.locator('[data-testid^="battle-enemy"]').first();
      if (await enemy.isVisible().catch(() => false)) await enemy.click({ force: true });
      else await page.keyboard.press("Enter");
      await sleep(1800);
      if (r === 0) await shot("60-battle-damage");
    } catch { break; }
  }
  await sleep(1200); await shot("61-battle-end-or-victory");
  await key("Enter", 2, 800); await shot("62-post-battle");
  await key("Enter", 3, 500);

  // ── F. 세이브 화면 ──
  await key("Escape", 1, 800);
  await key("ArrowDown", 3, 300); // 아이템→스킬→장비→저장
  await key("Enter", 1, 800); await shot("63-save-screen");
  await key("Enter", 1, 800); await shot("64-save-slot-saved");

  console.log("done");
  await browser.close();
})().catch((e) => { console.error("DRIVER FAIL:", String(e).slice(0, 400)); process.exit(1); });
