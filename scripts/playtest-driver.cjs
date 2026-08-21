// 감독 직접 플레이테스트 드라이버 (RM2003 비교용 증거 수집)
// 사용: node scripts/playtest-driver.cjs
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "evidence", "playtest-rm2003");
const PROJECT_JSON = fs.readFileSync(path.join(__dirname, "..", ".playwright-mcp", "ember-quest.json"), "utf8");
const DEV_KEY = "oprn:dev-project:127.0.0.1/?devProject=1";
const URL = "http://127.0.0.1:5199/?devProject=1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1720, height: 960 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });

  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + ".png") }); console.log("shot:", name); };
  const key = async (k, times = 1, delay = 350) => { for (let i = 0; i < times; i++) { await page.keyboard.press(k); await sleep(delay); } };
  const hold = async (k, ms) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); await sleep(200); };
  const teleport = (mapId, x, y) => page.evaluate(([m, a, b]) => window.__rpgzzuDebug?.teleport(m, a, b), [mapId, x, y]);
  const state = () => page.evaluate(() => { const el = document.querySelector('[data-testid="runtime-state-json"]'); if (!el) return null; try { const s = JSON.parse(el.textContent); return { map: s.currentMapId, x: s.x, y: s.y }; } catch { return null; } });

  await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [DEV_KEY, PROJECT_JSON]);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="mode-play"]', { timeout: 30000 });
  await sleep(1500);

  // ── 1. 플레이 진입 → 타이틀 ──
  await page.evaluate(() => document.querySelector('[data-testid="mode-play"]')?.click());
  await sleep(2500);
  await shot("01-title");
  // 타이틀 키보드 탐색 확인 (아래 → 위)
  await key("ArrowDown"); await shot("02-title-cursor-down");
  await key("ArrowUp");
  await key("Enter"); // 새 게임
  await sleep(1800);
  await shot("03-field-village-start");
  console.log("state:", JSON.stringify(await state()));

  // ── 2. 이동 감각: 4방향 + 대각선 + 달리기 여부 ──
  await hold("ArrowRight", 700); await shot("04-move-right");
  await page.keyboard.down("ArrowRight"); await page.keyboard.down("ArrowUp"); await sleep(600);
  await page.keyboard.up("ArrowUp"); await page.keyboard.up("ArrowRight"); await sleep(250);
  await shot("05-move-diagonal-test");
  await page.keyboard.down("Shift"); await hold("ArrowLeft", 700); await page.keyboard.up("Shift");
  await shot("06-move-dash-test");
  console.log("state:", JSON.stringify(await state()));

  // ── 3. 촌장 대화 (메시지 창 + 선택지) ──
  await teleport("map_ember_village", 18, 11); await sleep(400);
  await key("ArrowUp", 1, 250); // NPC가 막아 방향만 전환
  await key("Enter", 1, 600); await shot("07-dialogue-chief");
  await key("Enter", 2, 700); await shot("08-dialogue-more");
  await key("Enter", 3, 700); await shot("09-choices-chief");
  await key("Enter", 1, 700); await shot("10-after-choice");
  await key("Enter", 4, 500); // 잔여 대사 소진

  // ── 4. 메인 메뉴 ──
  await key("Escape", 1, 700); await shot("11-main-menu");
  await key("Enter", 1, 600); await shot("12-menu-items"); // 첫 항목(아이템 예상)
  await key("Escape", 1, 500);
  await key("ArrowDown", 3, 300); await shot("13-menu-cursor");
  await key("Escape", 1, 500); await key("Escape", 1, 500); // 메뉴 닫기

  // ── 5. 상점 ──
  await teleport("map_ember_village", 14, 10); await sleep(400);
  await key("ArrowUp", 1, 250);
  await key("Enter", 1, 800); await shot("14-shop-greeting");
  await key("Enter", 1, 800); await shot("15-shop-menu");
  await key("Enter", 1, 800); await shot("16-shop-buy-list");
  await key("ArrowDown", 1, 300); await shot("17-shop-buy-cursor");
  await key("Escape", 1, 500); await key("Escape", 1, 500); await key("Enter", 1, 400); // 이탈
  await key("Escape", 1, 400);

  // ── 6. 여관 ──
  await teleport("map_ember_village", 6, 10); await sleep(400);
  await key("ArrowUp", 1, 250);
  await key("Enter", 1, 800); await shot("18-inn-greeting");
  await key("Enter", 1, 800); await shot("19-inn-choice");
  await key("Enter", 1, 1200); await shot("20-inn-rest-fade");
  await sleep(1500); await key("Enter", 2, 600); await shot("21-inn-after");

  // ── 7. 맵 전환 (동문 → 안개 숲) — 전이 연출 ──
  await teleport("map_ember_village", 29, 12); await sleep(300);
  await page.keyboard.down("ArrowRight"); await sleep(350);
  await shot("22-transfer-mid");
  await sleep(700); await page.keyboard.up("ArrowRight"); await sleep(600);
  await shot("23-forest-arrived");
  console.log("state:", JSON.stringify(await state()));

  // ── 8. 전투 (숲 슬라임) ──
  await teleport("map_mist_forest", 10, 15); await sleep(400);
  await key("ArrowUp", 1, 250);
  await key("Enter", 1, 700); // 인트로 대사
  await key("Enter", 3, 600);
  await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 12000 }).catch(() => {});
  await sleep(1200); await shot("24-battle-start");
  await sleep(2500); await shot("25-battle-atb-wait");
  // 공격 커맨드 (클릭)
  const atk = page.locator('[data-testid="actor-command-attack"]');
  for (let round = 0; round < 6; round++) {
    try {
      await atk.waitFor({ state: "visible", timeout: 8000 });
      await atk.click(); await sleep(500);
      if (round === 0) await shot("26-battle-target-select");
      const enemy = page.locator('[data-testid^="battle-enemy"]').first();
      if (await enemy.isVisible().catch(() => false)) { await enemy.click(); }
      else { await page.keyboard.press("Enter"); }
      await sleep(1500);
      if (round === 0) await shot("27-battle-after-attack");
    } catch { break; }
    const done = await page.locator('[data-testid="battle-scene"]').isVisible().catch(() => false);
    if (!done) break;
  }
  await sleep(1500); await shot("28-battle-victory-or-state");
  await key("Enter", 3, 700); await shot("29-after-battle");

  // ── 9. 세이브 화면 ──
  await key("Escape", 1, 700);
  await key("ArrowDown", 5, 250); await shot("30-menu-bottom");
  await key("Enter", 1, 700); await shot("31-maybe-save-screen");

  console.log("PAGE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
  await browser.close();
})().catch((e) => { console.error("DRIVER FAIL:", e); process.exit(1); });
