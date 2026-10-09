// C.2 웨이브 비전 QA 드라이버 (감독 수행)
// ①blankProject=1 진짜 빈 프로젝트 부팅 ②"예제로 시작" 메뉴 ③빈 프로젝트 플레이 진입
// ④freshProject=1 레거시(예제 어드벤처) 유지 ⑤AI 프로포절 수락 → 캔버스 자동 포커스 + 하이라이트
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "evidence", "c2-qa");
const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:5299";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const API_KEY = (() => {
  try {
    const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
    const m = env.match(/VITE_LLM_API_KEY=(.+)/);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
})();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const results = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  };

  // ── ① 빈 프로젝트 부팅 ──
  const ctx = await browser.newContext({ viewport: { width: 1720, height: 960 } });
  const page = await ctx.newPage();
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + ".png") }); console.log("shot:", n); };
  await page.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="map-tree"]', { timeout: 30000 });
  await sleep(1500);
  const blankProbe = await page.evaluate(() => ({
    modal: !!document.querySelector('[data-testid="login-modal"]'),
    treeNodes: document.querySelectorAll('[data-testid^="map-tree-node-"]').length,
    treeText: document.querySelector('[data-testid="map-tree"]')?.textContent?.slice(0, 80) ?? "",
  }));
  check("blankProject=1 → 로그인 모달 억제", !blankProbe.modal);
  check("blankProject=1 → 맵 1개(빈 맵)", blankProbe.treeNodes === 1 && blankProbe.treeText.includes("빈 맵"), `nodes=${blankProbe.treeNodes}`);
  await shot("01-blank-project");

  // ── ② 예제로 시작 메뉴 존재 ──
  await page.locator(".rm2k3-menu-item", { hasText: "프로젝트" }).first().click();
  await sleep(400);
  const sampleFound = await page.evaluate(() => !!document.querySelector('[data-testid="menu-project-sample-adventure"]'));
  await shot("02-project-menu");
  check("프로젝트 메뉴에 '예제로 시작'", sampleFound);
  // 메뉴 닫기: 같은 메뉴 항목 재클릭 → 그래도 열려 있으면 body 클릭
  await page.locator(".rm2k3-menu-item", { hasText: "프로젝트" }).first().click().catch(() => {});
  await sleep(300);
  await page.mouse.click(860, 500);
  await sleep(300);
  const popupGone = await page.evaluate(() => !document.querySelector('[data-testid="menu-popup-project"]'));
  if (!popupGone) await page.keyboard.press("Escape").catch(() => {});
  await sleep(200);

  // ── ③ 빈 프로젝트 플레이 진입 ──
  await page.click('[data-testid="mode-play"]');
  const playCanvas = await page.waitForSelector('[data-testid="play-canvas"], [data-testid="test-play-window"]', { timeout: 20000 }).catch(() => null);
  await sleep(2000);
  check("빈 프로젝트 플레이 진입 (크래시 없음)", !!playCanvas);
  await shot("03-blank-play");
  await ctx.close();

  // ── ④ freshProject=1 레거시 유지 ──
  const ctx2 = await browser.newContext({ viewport: { width: 1720, height: 960 } });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/?freshProject=1", { waitUntil: "domcontentloaded" });
  await p2.waitForSelector('[data-testid="map-tree"]', { timeout: 30000 });
  await sleep(1200);
  const legacyProbe = await p2.evaluate(() => ({
    modal: !!document.querySelector('[data-testid="login-modal"]'),
    treeNodes: document.querySelectorAll('[data-testid^="map-tree-node-"]').length,
    treeText: document.querySelector('[data-testid="map-tree"]')?.textContent?.slice(0, 120) ?? "",
  }));
  check("freshProject=1 → 모달 억제 + 예제 5맵 유지", !legacyProbe.modal && legacyProbe.treeNodes === 5, `nodes=${legacyProbe.treeNodes}`);
  await p2.screenshot({ path: path.join(OUT, "04-fresh-legacy.png") });
  await ctx2.close();

  // ── ⑤ AI 수락 → 자동 포커스 + 하이라이트 (blank 프로젝트에서) ──
  if (API_KEY) {
    const ctx3 = await browser.newContext({ viewport: { width: 1720, height: 960 } });
    const p3 = await ctx3.newPage();
    await p3.addInitScript((key) => {
      localStorage.setItem("oprn:ai-config", JSON.stringify({
        baseUrl: "https://example.invalid/v1", model: "google/gemini-3.1-flash-lite",
        apiKey: key, maxToolCalls: 30, maxTokens: 8192, reasoningEffort: "medium", autoApprove: false,
      }));
    }, API_KEY);
    await p3.goto(BASE + "/?blankProject=1", { waitUntil: "domcontentloaded" });
    await p3.waitForSelector('[data-testid="ai-input"]', { timeout: 30000 });
    await sleep(1000);
    await p3.fill('[data-testid="ai-input"]', "빈 맵의 좌표 (5,5)부터 (8,8)까지 잔디 타일을 칠해줘. 묻지 말고 paint 도구를 바로 사용해.");
    await p3.evaluate(() => document.querySelector('[data-testid="ai-send"]')?.click());
    // 스펙 게이트 승인(맵 변경 없음 → 하이라이트 없음)이 선행될 수 있어 프로포절을 계속 수락하며 마커를 폴링
    let focusSeen = false;
    let acceptCount = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 180000 && !focusSeen) {
      const hasCard = await p3.evaluate(() => !!document.querySelector('[data-testid="ai-proposal-accept"]'));
      if (hasCard) {
        acceptCount += 1;
        await p3.screenshot({ path: path.join(OUT, `05-proposal-${acceptCount}.png`) });
        await p3.evaluate(() => document.querySelector('[data-testid="ai-proposal-accept"]')?.click());
        for (let i = 0; i < 16 && !focusSeen; i++) {
          await sleep(150);
          focusSeen = await p3.evaluate(() => !!document.querySelector('[data-testid="agent-focus-highlight"]'));
        }
        if (focusSeen) await p3.screenshot({ path: path.join(OUT, "06-agent-focus-highlight.png") });
        continue;
      }
      await sleep(1000);
    }
    check("AI 프로포절 수락", acceptCount > 0, `accepts=${acceptCount}`);
    if (acceptCount > 0) check("수락 직후 agent-focus-highlight 표시", focusSeen, `accepts=${acceptCount}`);
    await p3.screenshot({ path: path.join(OUT, "07-after-accept.png") });
    await ctx3.close();
  } else {
    console.log("SKIP AI 하이라이트 QA — VITE_LLM_API_KEY 없음");
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length) { console.log("FAILURES:", failed.map((f) => f.name).join(" | ")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
